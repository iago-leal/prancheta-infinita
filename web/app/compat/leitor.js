// Leitor de livros, etapa 04 do plano 005: abre os EPUBs e PDFs da
// biblioteca num painel ao lado do quadro, com um botão para a tela inteira
// e de volta. O trecho selecionado pode ser destacado e levado ao quadro como
// cartão, e a posição atual também, sem destaque, por compat/marcacoes.js.
//
// Desde o plano 006, o painel abre à esquerda do quadro, para quem escreve
// com a mão direita, e um botão o passa para o outro lado; a escolha fica
// guardada neste aparelho. Tocar num destaque o abre na barra do leitor, com
// apagar, a troca de estilo entre realce e sublinhado, a nota e levar ao
// quadro, como no Readest, de que só o comportamento foi aproveitado.
//
// - EPUB: pela epub.js, com a JSZip de que ela depende, entregues junto com a
//   página, em vendor/, e carregadas só quando o primeiro EPUB é aberto. O
//   livro é desenhado num iframe sem scripts, paginado, sem animação. A
//   posição é um EPUB CFI, que não depende do tamanho da tela.
// - PDF: pelo pdf.js que a página já traz, uma página por vez, na largura do
//   painel, com a camada de texto para a seleção. A posição é a página.
// - A última posição de cada livro fica no banco da biblioteca, neste
//   aparelho, e o livro reabre nela.
// - Na casca, o painel é um elemento da interface fora do palco: entra nas
//   áreas reservadas, e a tinta da Onyx não risca o livro.
// - Em telas com menos de 600 px de largura, o leitor abre só em tela inteira.
//
// Deve ser carregado depois de compat/biblioteca.js; compat/claude.js o liga à
// biblioteca em window.leitorDaPrancheta.

(function (global) {
  'use strict';

  const LARGURA_MINIMA_LADO_A_LADO = 600;
  const CHAVE_DO_LADO = 'prancheta:leitor-lado';

  function lerLado() {
    try {
      return global.localStorage.getItem(CHAVE_DO_LADO) === 'direita' ? 'direita' : 'esquerda';
    } catch (e) {
      return 'esquerda';
    }
  }

  function gravarLado(lado) {
    try {
      global.localStorage.setItem(CHAVE_DO_LADO, lado);
    } catch (e) { /* sem o armazenamento, o lado vale só até fechar a página */ }
  }
  const PDFJS = 'vendor/pdfjs/';
  const SCRIPTS_DO_EPUB = ['vendor/jszip/jszip.min.js', 'vendor/epubjs/epub.min.js'];

  function erro(codigo, mensagem) {
    const e = new Error(mensagem);
    e.code = codigo;
    return e;
  }

  const carregados = new Map();
  function carregarScript(endereco) {
    if (!carregados.has(endereco)) {
      carregados.set(endereco, new Promise((pronto, falha) => {
        const s = document.createElement('script');
        s.src = endereco;
        s.onload = pronto;
        s.onerror = () => {
          carregados.delete(endereco);
          falha(erro('script', `não foi possível carregar ${endereco}`));
        };
        document.head.appendChild(s);
      }));
    }
    return carregados.get(endereco);
  }

  async function carregarEpub() {
    for (const s of SCRIPTS_DO_EPUB) await carregarScript(s);
    if (!global.ePub) throw erro('script', 'a epub.js não carregou');
    return global.ePub;
  }

  async function carregarPdf() {
    if (!global.pdfjsLib) await carregarScript(`${PDFJS}pdf.min.js`);
    const pdfjs = global.pdfjsLib;
    if (!pdfjs) throw erro('script', 'o pdf.js não carregou');
    if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS}pdf.worker.min.js`;
    return pdfjs;
  }

  const resumir = (texto, limite = 160) => {
    const limpo = String(texto || '').replace(/\s+/g, ' ').trim();
    return limpo.length > limite ? `${limpo.slice(0, limite - 1)}…` : limpo;
  };

  // ---- EPUB ----

  class VistaEpub {
    constructor(conteudo, aoMudar) {
      this.conteudo = conteudo;
      this.aoMudar = aoMudar;
      this.cfi = null;
      this.rotulo = '';
      this.capitulo = '';
      this.percentual = '';
      // Os destaques desenhados: de cada CFI, o tipo da anotação e o id do destaque.
      this._marcados = new Map();
    }

    async abrir(blob, posicao) {
      const ePub = await carregarEpub();
      this.livro = ePub(await blob.arrayBuffer());
      // A epub.js põe em cada capítulo uma tag base com o endereço do livro,
      // que a política da página recusa; num livro aberto do próprio arquivo,
      // os recursos já vêm por endereços locais, e o gancho que a põe sai.
      for (const ganchos of [this.livro.spine.hooks.content, this.livro.spine.hooks.serialize]) {
        if (ganchos && Array.isArray(ganchos.hooks)) ganchos.hooks = ganchos.hooks.filter((f) => !String(f).includes('createElement("base")'));
      }
      this.vista = this.livro.renderTo(this.conteudo, {
        width: '100%', height: '100%', flow: 'paginated', spread: 'none', allowScriptedContent: false,
      });
      this.vista.themes.default({
        body: { 'line-height': '1.5', margin: '0', padding: '0 4px' },
        '::selection': { background: '#cfcfcf' },
      });
      this.vista.on('relocated', (local) => {
        this.cfi = local.start.cfi;
        const { page, total } = local.start.displayed || {};
        this.percentual = this.livro.locations.length() ? `${Math.round(local.start.percentage * 100)}%` : '';
        this.rotulo = [page && total ? `${page}/${total}` : '', this.percentual].filter(Boolean).join(' · ');
        const item = this.livro.navigation && local.start.href ? this.livro.navigation.get(local.start.href) : null;
        this.capitulo = item && item.label ? item.label.trim() : '';
        this.aoMudar({ tipo: 'posicao' });
      });
      this.vista.on('selected', (cfiRange, conteudo) => {
        const texto = conteudo && conteudo.window ? conteudo.window.getSelection().toString() : '';
        this.aoMudar({ tipo: 'selecao', selecao: texto.trim() ? { texto: texto.trim(), posicao: { cfi: cfiRange } } : null });
      });
      await this.vista.display(posicao && posicao.cfi ? posicao.cfi : undefined);
      // As porcentagens vêm depois, sem atrasar a abertura.
      this.livro.ready.then(() => this.livro.locations.generate(1600)).then(() => {
        if (this.vista) this.vista.reportLocation();
      }).catch(() => {});
    }

    posicao() {
      return this.cfi ? { cfi: this.cfi } : null;
    }

    // O que vai no cartão para dizer onde está o trecho ou a posição.
    rotuloParaCartao() {
      return [this.capitulo, this.percentual].filter(Boolean).join(', ');
    }

    /** Mostra os destaques do livro, no estilo de cada um, tirando os que saíram. */
    marcar(destaques) {
      if (!this.vista) return;
      const novos = new Map();
      for (const d of destaques) {
        if (d.posicao && d.posicao.cfi) novos.set(d.posicao.cfi, { tipo: d.estilo === 'sublinhado' ? 'underline' : 'highlight', id: d.id });
      }
      for (const [cfi, atual] of this._marcados) {
        const novo = novos.get(cfi);
        if (!novo || novo.tipo !== atual.tipo) this.vista.annotations.remove(cfi, atual.tipo);
      }
      for (const [cfi, novo] of novos) {
        const atual = this._marcados.get(cfi);
        if (atual && atual.tipo === novo.tipo) continue;
        const aoTocar = () => this._tocouNoDestaque(cfi);
        // A linha do sublinhado é desenhada pelo estilo do leitor; a epub.js contornaria o trecho inteiro.
        if (novo.tipo === 'underline') this.vista.annotations.underline(cfi, {}, aoTocar, 'lt-sublinhado', { stroke: 'none' });
        else this.vista.annotations.highlight(cfi, {}, aoTocar, 'lt-destaque', { fill: '#000', 'fill-opacity': '0.18' });
      }
      this._marcados = novos;
    }

    // Um toque no destaque o abre; o fim de uma seleção sobre ele não.
    _tocouNoDestaque(cfi) {
      const marcado = this._marcados.get(cfi);
      if (!marcado || !this.vista) return;
      const selecionando = this.vista.getContents().some((c) => c.window && !c.window.getSelection().isCollapsed);
      if (!selecionando) this.aoMudar({ tipo: 'destaque', id: marcado.id });
    }

    limparSelecao() {
      for (const conteudo of this.vista ? this.vista.getContents() : []) {
        if (conteudo.window) conteudo.window.getSelection().removeAllRanges();
      }
    }

    proxima() {
      return this.vista && this.vista.next();
    }

    anterior() {
      return this.vista && this.vista.prev();
    }

    ajustar() {
      if (this.vista) this.vista.resize();
    }

    destruir() {
      try {
        if (this.livro) this.livro.destroy();
      } catch (e) { /* o livro já estava fechado */ }
      this.livro = null;
      this.vista = null;
    }
  }

  // ---- PDF ----

  class VistaPdf {
    constructor(conteudo, aoMudar) {
      this.conteudo = conteudo;
      this.aoMudar = aoMudar;
      this.pagina = 1;
      this.total = 0;
      this.rotulo = '';
      this._destaques = [];
      this._aoSelecionar = () => this._selecionou();
      this._aoTocar = (e) => this._tocou(e);
    }

    async abrir(blob, posicao) {
      const pdfjs = await carregarPdf();
      this.pdfjs = pdfjs;
      this.documento = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), isEvalSupported: false }).promise;
      this.total = this.documento.numPages;
      this.pagina = Math.min(Math.max(1, Number(posicao && posicao.pagina) || 1), this.total);
      this.conteudo.classList.add('lt-pdf');
      document.addEventListener('selectionchange', this._aoSelecionar);
      this.conteudo.addEventListener('click', this._aoTocar);
      await this._desenhar();
    }

    // Um toque num pedaço destacado, sem seleção em andamento, abre o destaque.
    _tocou(e) {
      const pedaco = e.target.closest && e.target.closest('.textLayer span[data-destaque]');
      const selecao = document.getSelection();
      if (pedaco && (!selecao || selecao.isCollapsed)) this.aoMudar({ tipo: 'destaque', id: pedaco.dataset.destaque });
    }

    async _desenhar() {
      const numero = this.pagina;
      const pagina = await this.documento.getPage(numero);
      const largura = Math.max(200, this.conteudo.clientWidth - 16);
      const base = pagina.getViewport({ scale: 1 });
      const vista = pagina.getViewport({ scale: largura / base.width });
      const densidade = global.devicePixelRatio || 1;
      const folha = document.createElement('div');
      folha.className = 'lt-folha';
      folha.style.width = `${Math.floor(vista.width)}px`;
      folha.style.height = `${Math.floor(vista.height)}px`;
      const tela = document.createElement('canvas');
      tela.width = Math.floor(vista.width * densidade);
      tela.height = Math.floor(vista.height * densidade);
      tela.style.width = `${Math.floor(vista.width)}px`;
      tela.style.height = `${Math.floor(vista.height)}px`;
      const texto = document.createElement('div');
      texto.className = 'textLayer';
      texto.style.setProperty('--scale-factor', String(vista.scale));
      folha.append(tela, texto);
      await pagina.render({ canvasContext: tela.getContext('2d'), viewport: vista, transform: densidade !== 1 ? [densidade, 0, 0, densidade, 0, 0] : null }).promise;
      await this.pdfjs.renderTextLayer({ textContentSource: await pagina.getTextContent(), container: texto, viewport: vista, textDivs: [] }).promise;
      // Uma virada de página mais nova pode ter terminado antes.
      if (numero !== this.pagina) return;
      this.conteudo.replaceChildren(folha);
      this.conteudo.scrollTop = 0;
      this._aplicarMarcas();
      this.rotulo = `p. ${this.pagina} de ${this.total}`;
      this.aoMudar({ tipo: 'posicao' });
      this.aoMudar({ tipo: 'selecao', selecao: null });
    }

    _selecionou() {
      const selecao = document.getSelection();
      if (!selecao || selecao.isCollapsed || !selecao.anchorNode || !selecao.rangeCount) return;
      const no = selecao.anchorNode.nodeType === 1 ? selecao.anchorNode : selecao.anchorNode.parentElement;
      const camada = this.conteudo.querySelector('.textLayer');
      if (!no || !camada || !camada.contains(no)) return;
      const intervalo = selecao.getRangeAt(0);
      const bruto = intervalo.toString();
      const texto = bruto.trim();
      // O lugar do trecho no texto da página: quantos caracteres vêm antes dele.
      const antes = document.createRange();
      antes.setStart(camada, 0);
      antes.setEnd(intervalo.startContainer, intervalo.startOffset);
      const inicio = antes.toString().length;
      const posicao = { pagina: this.pagina, inicio, fim: inicio + bruto.length };
      this.aoMudar({ tipo: 'selecao', selecao: texto ? { texto, posicao } : null });
    }

    rotuloParaCartao() {
      return `p. ${this.pagina}`;
    }

    /** Mostra os destaques da página aberta, sombreando os pedaços de texto que eles cobrem. */
    marcar(destaques) {
      this._destaques = destaques;
      this._aplicarMarcas();
    }

    _aplicarMarcas() {
      const camada = this.conteudo.querySelector('.textLayer');
      if (!camada) return;
      const daPagina = this._destaques
        .filter((d) => d.posicao && d.posicao.pagina === this.pagina && Number.isSafeInteger(d.posicao.inicio));
      let posicao = 0;
      for (const pedaco of camada.querySelectorAll('span')) {
        if (pedaco.childElementCount) continue;
        const tamanho = pedaco.textContent.length;
        const destaque = daPagina.find((d) => posicao < d.posicao.fim && posicao + tamanho > d.posicao.inicio);
        pedaco.classList.toggle('lt-destacado', Boolean(destaque) && destaque.estilo !== 'sublinhado');
        pedaco.classList.toggle('lt-sublinhado', Boolean(destaque) && destaque.estilo === 'sublinhado');
        if (destaque) pedaco.dataset.destaque = destaque.id;
        else delete pedaco.dataset.destaque;
        posicao += tamanho;
      }
    }

    limparSelecao() {
      document.getSelection().removeAllRanges();
    }

    posicao() {
      return this.total ? { pagina: this.pagina } : null;
    }

    async proxima() {
      if (this.pagina >= this.total) return;
      this.pagina += 1;
      await this._desenhar();
    }

    async anterior() {
      if (this.pagina <= 1) return;
      this.pagina -= 1;
      await this._desenhar();
    }

    ajustar() {
      if (this.documento) this._desenhar().catch(() => {});
    }

    destruir() {
      document.removeEventListener('selectionchange', this._aoSelecionar);
      this.conteudo.removeEventListener('click', this._aoTocar);
      this.conteudo.classList.remove('lt-pdf');
      if (this.documento) this.documento.destroy().catch(() => {});
      this.documento = null;
    }
  }

  // ---- Painel ----

  const ESTILO = `
body.leitor-lado{--leitor-largura:clamp(320px,50vw,960px);--leitor-inicio:0px}
@media (min-width:761px){body.leitor-lado.leitor-esquerda.side{--leitor-inicio:260px}}
body.leitor-lado:not(.leitor-esquerda) #top,body.leitor-lado:not(.leitor-esquerda) #zoom{right:calc(var(--leitor-largura) + 16px)}
body.leitor-lado:not(.leitor-esquerda) #bottom{padding-right:calc(var(--leitor-largura) + 16px)}
html:not(.casca) body.leitor-lado:not(.leitor-esquerda) #head{width:max(80px,calc(100vw - var(--leitor-largura) - 284px - 280px))!important}
html:not(.casca) body.leitor-lado:not(.leitor-esquerda):not(.side) #head{width:max(80px,calc(100vw - var(--leitor-largura) - 72px - 280px))!important}
body.leitor-lado.leitor-esquerda #bottom{padding-left:calc(var(--leitor-inicio) + var(--leitor-largura) + 16px)}
@media (max-width:1400px){html:not(.casca) body.leitor-lado #zoom{display:none}}
@media (max-width:1900px){html:not(.casca) body.leitor-lado.side #zoom{display:none}}
html:not(.casca) body.leitor-lado.leitor-esquerda #sideBtn{left:calc(var(--leitor-largura) + 16px)}
html:not(.casca) body.leitor-lado.leitor-esquerda #head{left:calc(var(--leitor-inicio) + var(--leitor-largura) + 72px)!important;width:max(80px,calc(100vw - var(--leitor-inicio) - var(--leitor-largura) - 72px - 250px))!important}
html:not(.casca) body.leitor-lado.leitor-esquerda.side #head{left:calc(var(--leitor-inicio) + var(--leitor-largura) + 24px)!important}
#leitor{position:fixed;top:var(--casca-faixa,0px);right:0;bottom:0;width:var(--leitor-largura,100vw);z-index:8;display:flex;flex-direction:column;background:var(--panel,#fff);color:var(--fg,#222);border-left:1px solid var(--line,#E3E1DD)}
body.leitor-lado.leitor-esquerda #leitor{left:var(--leitor-inicio);right:auto;border-left:0;border-right:1px solid var(--line,#E3E1DD)}
body.leitor-tela #leitor{left:0;right:0;width:100vw;border:0;z-index:10}
#leitor[hidden]{display:none}
#leitor .lt-barra{flex:none;display:flex;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid var(--line,#E3E1DD)}
#leitor .lt-titulo{flex:1;min-width:0;font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#leitor .lt-posicao{flex:none;font-size:12.5px;color:var(--muted,#7F7C76);font-variant-numeric:tabular-nums}
#leitor .lt-barra button{flex:none;font:inherit;font-size:13px;min-width:34px;height:34px;padding:0 8px;border:1px solid var(--line,#E3E1DD);border-radius:8px;background:transparent;color:inherit;cursor:pointer}
#leitor .lt-conteudo{flex:1;min-height:0;position:relative;overflow:hidden}
#leitor .lt-conteudo.lt-pdf{overflow:auto;padding:8px}
#leitor .lt-folha{position:relative;margin:0 auto;background:#fff}
#leitor .lt-folha canvas{display:block}
#leitor .textLayer{position:absolute;inset:0;overflow:hidden;line-height:1;text-align:initial;-webkit-text-size-adjust:none;text-size-adjust:none;transform-origin:0 0;z-index:2}
#leitor .textLayer :is(span,br){color:transparent;position:absolute;white-space:pre;cursor:text;transform-origin:0% 0%}
#leitor .textLayer span.markedContent{top:0;height:0}
#leitor .textLayer ::selection{background:rgba(0,0,0,.25)}
#leitor .textLayer span.lt-destacado{background:rgba(0,0,0,.18);cursor:pointer}
#leitor g.lt-sublinhado rect{stroke:none}
#leitor g.lt-sublinhado line{stroke:#000;stroke-opacity:.9;stroke-width:1.5px}
#leitor .textLayer span.lt-sublinhado{box-shadow:0 2px 0 rgba(0,0,0,.9);cursor:pointer}
#leitor .lt-marca{flex:none;display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 10px;border-top:1px solid var(--line,#E3E1DD);font-size:13px}
#leitor .lt-marca .lt-marca-trecho{flex:1 1 100%;min-width:0}
#leitor .lt-marca label{flex:1 1 180px;display:flex;align-items:center;gap:6px;min-width:0}
#leitor .lt-marca input{flex:1;min-width:0;font:inherit;font-size:13px;height:34px;padding:0 8px;border:1px solid var(--line,#E3E1DD);border-radius:8px;background:transparent;color:inherit}
#leitor .lt-marca button{font:inherit;font-size:13px;height:34px;padding:0 10px;border:1px solid var(--line,#E3E1DD);border-radius:8px;background:transparent;color:inherit;cursor:pointer}
#leitor .lt-selecao{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
#leitor .lt-selecao .lt-trecho{flex:1 1 200px;min-width:0}
#leitor .lt-selecao button,#leitor .lt-aviso button{font:inherit;font-size:13px;height:34px;padding:0 10px;border:1px solid var(--line,#E3E1DD);border-radius:8px;background:transparent;color:inherit;cursor:pointer}
#leitor .lt-selecao{flex:none;padding:8px 10px;border-top:1px solid var(--line,#E3E1DD);font-size:13px}
#leitor .lt-aviso{flex:none;margin:0;padding:6px 10px;font-size:12.5px;color:var(--muted,#7F7C76)}
#leitor .lt-aviso:empty{display:none}
#leitor [hidden]{display:none}
`;

  class Leitor {
    constructor(biblioteca) {
      this.biblioteca = biblioteca;
      this.livro = null;
      this.vista = null;
      this.selecao = null;
      this.modo = 'lado';
      // De que lado do quadro o leitor fica, guardado neste aparelho.
      this.lado = lerLado();
      // compat/marcacoes.js se liga aqui, com os destaques e os cartões.
      this.marcacoes = null;
      this.destaques = [];
      // O id do destaque aberto na barra do leitor, depois de um toque nele.
      this.destaqueAberto = null;
      this._ouvintes = new Set();
    }

    /** O destaque aberto na barra do leitor, ou null. */
    get destaque() {
      return this.destaques.find((d) => d.id === this.destaqueAberto) || null;
    }

    aoMudar(ouvinte) {
      this._ouvintes.add(ouvinte);
      return () => this._ouvintes.delete(ouvinte);
    }

    _avisar() {
      for (const ouvinte of this._ouvintes) {
        try {
          ouvinte(this);
        } catch (e) { /* um ouvinte com erro não interrompe o leitor */ }
      }
    }

    get aberto() {
      return Boolean(this.livro);
    }

    /** A posição atual do livro aberto, com o identificador do livro, ou null. */
    posicaoAtual() {
      if (!this.livro || !this.vista) return null;
      const posicao = this.vista.posicao();
      return posicao ? { livro: this.livro.id, tipo: this.livro.tipo, ...posicao, rotulo: this.vista.rotulo } : null;
    }

    /**
     * Abre um livro da biblioteca, baixando-o antes se ainda não estiver
     * guardado, na posição dada ou na última em que foi lido neste aparelho.
     */
    async abrir(id, posicao) {
      const biblioteca = this.biblioteca;
      let registro = await biblioteca.livro(id);
      if (!registro) registro = await biblioteca.guardar(id);
      if (!registro) throw erro('not_found', 'livro fora da biblioteca');
      this.fechar();
      const ondeParou = posicao || await biblioteca.lerPosicao(id);
      this.livro = { id, nome: registro.nome, tipo: registro.tipo };
      const Vista = registro.tipo === 'application/pdf' ? VistaPdf : VistaEpub;
      this._mostrar();
      const vista = new Vista(this._conteudo(), (mudanca) => this._mudou(vista, mudanca));
      this.vista = vista;
      try {
        await vista.abrir(registro.blob, ondeParou);
      } catch (e) {
        if (this.vista === vista) this.fechar();
        throw e;
      }
      if (this.marcacoes && this.vista === vista) {
        this._pararMarcas = this.marcacoes.acompanhar(id, (itens) => {
          if (this.vista !== vista) return;
          this.destaques = itens;
          // O destaque aberto pode ter sido apagado, aqui ou em outro aparelho.
          if (!this.destaque) this.destaqueAberto = null;
          vista.marcar(itens);
          this._avisar();
        });
      }
      this._avisar();
      return this.posicaoAtual();
    }

    // O livro aberto, como as marcações o identificam.
    _livroDasMarcacoes() {
      return { livro: this.livro.id, nome: this.livro.nome, tipo: this.livro.tipo };
    }

    /** Destaca o trecho selecionado e, com `levar`, cria no quadro o cartão com ele. */
    async destacarSelecao({ levar = false } = {}) {
      if (!this.selecao || !this.livro || !this.marcacoes) return null;
      const { texto, posicao } = this.selecao;
      const destaque = await this.marcacoes.destacar(this._livroDasMarcacoes(), { texto, posicao, rotulo: this.vista.rotuloParaCartao() });
      this.vista.marcar([...this.destaques, destaque]);
      if (levar) this.marcacoes.levarAoQuadro(this._livroDasMarcacoes(), destaque);
      this.vista.limparSelecao();
      this.selecao = null;
      if (this.aviso) this.aviso(levar ? 'Trecho destacado e levado ao quadro.' : 'Trecho destacado.');
      this._avisar();
      return destaque;
    }

    /** Abre um destaque na barra do leitor, no lugar da seleção. */
    abrirDestaque(id) {
      if (!this.destaques.some((d) => d.id === id)) return;
      this.destaqueAberto = id;
      this.selecao = null;
      if (this.aviso) this.aviso('');
      this._avisar();
    }

    fecharDestaque() {
      this.destaqueAberto = null;
      this._avisar();
    }

    /** Apaga o destaque aberto; o cartão que ele tenha no quadro continua lá. */
    async apagarDestaque() {
      const destaque = this.destaque;
      if (!destaque || !this.livro) return;
      this.destaqueAberto = null;
      await this.marcacoes.apagar(this.livro.id, destaque.id);
      if (this.aviso) this.aviso('Destaque apagado.');
      this._avisar();
    }

    /** Troca o estilo do destaque aberto, entre realce e sublinhado. */
    async trocarEstiloDoDestaque() {
      const destaque = this.destaque;
      if (!destaque || !this.livro) return;
      await this.marcacoes.trocarEstilo(this.livro.id, destaque.id, destaque.estilo === 'sublinhado' ? 'realce' : 'sublinhado');
    }

    /** Guarda a nota do destaque aberto. */
    async anotarDestaque(nota) {
      const destaque = this.destaque;
      if (!destaque || !this.livro) return;
      await this.marcacoes.anotar(this.livro.id, destaque.id, nota);
      if (this.aviso) this.aviso(String(nota || '').trim() ? 'Nota guardada.' : 'Nota retirada.');
    }

    /** Cria no quadro o cartão do destaque aberto, com a nota dele. */
    levarDestaqueAoQuadro() {
      const destaque = this.destaque;
      if (!destaque || !this.livro) return null;
      const cartao = this.marcacoes.levarAoQuadro(this._livroDasMarcacoes(), destaque);
      if (this.aviso) this.aviso('Destaque levado ao quadro.');
      return cartao;
    }

    /** Passa o leitor para o outro lado do quadro e guarda a escolha neste aparelho. */
    trocarLado() {
      this.lado = this.lado === 'esquerda' ? 'direita' : 'esquerda';
      gravarLado(this.lado);
      this._aplicarModo();
      this._avisar();
    }

    /** Cria no quadro um cartão com a posição atual do livro, sem destaque. */
    levarPosicaoAoQuadro() {
      if (!this.livro || !this.vista || !this.marcacoes) return null;
      const posicao = this.vista.posicao();
      if (!posicao) return null;
      const cartao = this.marcacoes.levarAoQuadro(this._livroDasMarcacoes(), { posicao, rotulo: this.vista.rotuloParaCartao() });
      if (this.aviso) this.aviso('Posição levada ao quadro.');
      return cartao;
    }

    _mudou(vista, mudanca) {
      if (vista !== this.vista) return;
      if (mudanca.tipo === 'selecao') {
        this.selecao = mudanca.selecao;
        if (mudanca.selecao) this.destaqueAberto = null;
      }
      if (mudanca.tipo === 'destaque') {
        this.abrirDestaque(mudanca.id);
        return;
      }
      if (mudanca.tipo === 'posicao' && this.livro) {
        const posicao = vista.posicao();
        if (posicao) this.biblioteca.gravarPosicao(this.livro.id, posicao).catch(() => {});
      }
      this._avisar();
    }

    proxima() {
      return this.vista ? this.vista.proxima() : undefined;
    }

    anterior() {
      return this.vista ? this.vista.anterior() : undefined;
    }

    /** Passa o leitor de lado a lado para a tela inteira e de volta. */
    alternarModo() {
      this.modo = this.modo === 'tela' ? 'lado' : 'tela';
      this._aplicarModo();
      if (this.vista) this.vista.ajustar();
      this._avisar();
    }

    _modoEfetivo() {
      return global.innerWidth < LARGURA_MINIMA_LADO_A_LADO ? 'tela' : this.modo;
    }

    _aplicarModo() {
      const aberto = Boolean(this.livro);
      const modo = this._modoEfetivo();
      document.body.classList.toggle('leitor-lado', aberto && modo === 'lado');
      document.body.classList.toggle('leitor-esquerda', aberto && modo === 'lado' && this.lado === 'esquerda');
      document.body.classList.toggle('leitor-tela', aberto && modo === 'tela');
    }

    _mostrar() {
      if (this._painel) {
        this._painel.hidden = false;
        this._aplicarModo();
      }
    }

    _conteudo() {
      const conteudo = this._painel.querySelector('.lt-conteudo');
      conteudo.replaceChildren();
      return conteudo;
    }

    fechar() {
      if (this._pararMarcas) this._pararMarcas();
      this._pararMarcas = null;
      this.destaques = [];
      this.destaqueAberto = null;
      if (this.vista) this.vista.destruir();
      this.vista = null;
      this.livro = null;
      this.selecao = null;
      if (this._painel) {
        this._painel.hidden = true;
        this._painel.querySelector('.lt-conteudo').replaceChildren();
      }
      this._aplicarModo();
      this._avisar();
    }

    montar() {
      if (typeof document === 'undefined' || document.getElementById('leitor')) return;
      const estilo = document.createElement('style');
      estilo.textContent = ESTILO;
      document.head.appendChild(estilo);
      const painel = document.createElement('section');
      painel.id = 'leitor';
      painel.hidden = true;
      painel.setAttribute('aria-label', 'Leitor');
      painel.innerHTML = `
<div class="lt-barra">
  <button type="button" data-acao="fechar" title="Fechar o livro" aria-label="Fechar o livro">✕</button>
  <span class="lt-titulo"></span>
  <span class="lt-posicao"></span>
  <button type="button" data-acao="anterior" title="Página anterior" aria-label="Página anterior">‹</button>
  <button type="button" data-acao="proxima" title="Próxima página" aria-label="Próxima página">›</button>
  <button type="button" data-acao="ao-quadro" title="Levar esta posição ao quadro, sem destacar">Ao quadro</button>
  <button type="button" data-acao="lado" title="Passar o leitor para o outro lado do quadro" aria-label="Passar o leitor para o outro lado do quadro">⇄</button>
  <button type="button" data-acao="modo"></button>
</div>
<div class="lt-conteudo"></div>
<div class="lt-selecao" hidden><span class="lt-trecho"></span><button type="button" data-acao="destacar">Destacar</button><button type="button" data-acao="levar">Levar ao quadro</button></div>
<div class="lt-marca" hidden>
  <span class="lt-marca-trecho"></span>
  <label>Nota<input name="nota" type="text" autocomplete="off" maxlength="4000"></label>
  <button type="button" data-acao="marca-nota">Guardar nota</button>
  <button type="button" data-acao="marca-estilo"></button>
  <button type="button" data-acao="marca-levar">Levar ao quadro</button>
  <button type="button" data-acao="marca-apagar">Apagar</button>
  <button type="button" data-acao="marca-fechar">Fechar</button>
</div>
<p class="lt-aviso" role="status"></p>`;
      document.body.appendChild(painel);
      this._painel = painel;
      const titulo = painel.querySelector('.lt-titulo');
      const posicao = painel.querySelector('.lt-posicao');
      const modo = painel.querySelector('[data-acao="modo"]');
      const selecao = painel.querySelector('.lt-selecao');
      const trecho = painel.querySelector('.lt-trecho');
      const aviso = painel.querySelector('.lt-aviso');
      const lado = painel.querySelector('[data-acao="lado"]');
      const marca = painel.querySelector('.lt-marca');
      const trechoDaMarca = painel.querySelector('.lt-marca-trecho');
      const nota = painel.querySelector('.lt-marca input[name="nota"]');
      const estiloDaMarca = painel.querySelector('[data-acao="marca-estilo"]');
      // O destaque cuja nota está no campo, para não sobrescrever o que o autor digita.
      let notaDe = null;
      // No e-ink, cada troca de texto atualiza a região: só escreve o que mudou.
      const escrever = (elemento, texto) => {
        if (elemento.textContent !== texto) elemento.textContent = texto;
      };
      this.aoMudar(() => {
        escrever(titulo, this.livro ? this.livro.nome : '');
        escrever(posicao, this.vista ? this.vista.rotulo : '');
        const estreita = global.innerWidth < LARGURA_MINIMA_LADO_A_LADO;
        modo.hidden = estreita;
        escrever(modo, this.modo === 'tela' ? 'Lado a lado' : 'Tela inteira');
        lado.hidden = estreita || this.modo === 'tela';
        const aberto = this.destaque;
        marca.hidden = !aberto;
        if (aberto) {
          escrever(trechoDaMarca, `Destaque: “${resumir(aberto.trecho)}”`);
          escrever(estiloDaMarca, aberto.estilo === 'sublinhado' ? 'Realçar' : 'Sublinhar');
          if (notaDe !== aberto.id) nota.value = aberto.nota || '';
        }
        notaDe = aberto ? aberto.id : null;
        selecao.hidden = !this.selecao;
        const onde = this.selecao && this.selecao.posicao.pagina ? ` (p. ${this.selecao.posicao.pagina})` : '';
        escrever(trecho, this.selecao ? `Selecionado: “${resumir(this.selecao.texto)}”${onde}` : '');
      });
      this.aviso = (texto) => escrever(aviso, texto || '');
      painel.addEventListener('click', (e) => {
        const botao = e.target.closest && e.target.closest('[data-acao]');
        if (!botao) return;
        const acao = botao.dataset.acao;
        if (acao === 'fechar') this.fechar();
        if (acao === 'proxima') Promise.resolve(this.proxima()).catch(() => {});
        if (acao === 'anterior') Promise.resolve(this.anterior()).catch(() => {});
        if (acao === 'modo') this.alternarModo();
        if (acao === 'ao-quadro') this.levarPosicaoAoQuadro();
        if (acao === 'lado') this.trocarLado();
        if (acao === 'marca-fechar') this.fecharDestaque();
        if (acao === 'marca-levar') this.levarDestaqueAoQuadro();
        const falhou = (erroNaMarca) => this.aviso(`Não foi possível mudar o destaque: ${erroNaMarca.message}.`);
        if (acao === 'marca-apagar') this.apagarDestaque().catch(falhou);
        if (acao === 'marca-estilo') this.trocarEstiloDoDestaque().catch(falhou);
        if (acao === 'marca-nota') this.anotarDestaque(nota.value).catch(falhou);
        if (acao === 'destacar' || acao === 'levar') {
          this.destacarSelecao({ levar: acao === 'levar' }).catch((erroAoDestacar) => {
            this.aviso(`Não foi possível destacar: ${erroAoDestacar.message}.`);
          });
        }
      });
      // As setas viram as páginas quando o foco está no leitor.
      painel.addEventListener('keydown', (e) => {
        // No campo da nota, as teclas escrevem, e Enter guarda a nota.
        if (e.target === nota) {
          e.stopPropagation();
          if (e.key === 'Enter') this.anotarDestaque(nota.value).catch(() => {});
          return;
        }
        if (e.key === 'ArrowRight' || e.key === 'PageDown') Promise.resolve(this.proxima()).catch(() => {});
        if (e.key === 'ArrowLeft' || e.key === 'PageUp') Promise.resolve(this.anterior()).catch(() => {});
      });
      let largura = global.innerWidth;
      global.addEventListener('resize', () => {
        if (!this.livro) return;
        this._aplicarModo();
        if (Math.abs(global.innerWidth - largura) > 1 && this.vista) this.vista.ajustar();
        largura = global.innerWidth;
        this._avisar();
      });
    }
  }

  /** Cria o leitor ligado à biblioteca e monta o painel na página. */
  function ligar(biblioteca) {
    const leitor = new Leitor(biblioteca);
    if (typeof document !== 'undefined') {
      const montar = () => leitor.montar();
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar, { once: true });
      else montar();
    }
    return leitor;
  }

  global.LeitorPrancheta = Object.freeze({ Leitor, ligar, LARGURA_MINIMA_LADO_A_LADO });
})(typeof window !== 'undefined' ? window : globalThis);
