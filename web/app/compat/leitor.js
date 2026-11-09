// Leitor de livros, etapa 04 do plano 005: abre os EPUBs e PDFs da
// biblioteca num painel à direita do quadro, com um botão para a tela inteira
// e de volta. O trecho selecionado pode ser destacado e levado ao quadro como
// cartão, e a posição atual também, sem destaque, por compat/marcacoes.js.
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
      this._marcados = new Set();
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

    /** Mostra os destaques do livro, tirando os que saíram. */
    marcar(destaques) {
      if (!this.vista) return;
      const novos = new Set(destaques.filter((d) => d.posicao && d.posicao.cfi).map((d) => d.posicao.cfi));
      for (const cfi of this._marcados) if (!novos.has(cfi)) this.vista.annotations.remove(cfi, 'highlight');
      for (const cfi of novos) {
        if (!this._marcados.has(cfi)) this.vista.annotations.highlight(cfi, {}, null, 'lt-destaque', { fill: '#000', 'fill-opacity': '0.18' });
      }
      this._marcados = novos;
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
    }

    async abrir(blob, posicao) {
      const pdfjs = await carregarPdf();
      this.pdfjs = pdfjs;
      this.documento = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), isEvalSupported: false }).promise;
      this.total = this.documento.numPages;
      this.pagina = Math.min(Math.max(1, Number(posicao && posicao.pagina) || 1), this.total);
      this.conteudo.classList.add('lt-pdf');
      document.addEventListener('selectionchange', this._aoSelecionar);
      await this._desenhar();
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
      const intervalos = this._destaques
        .filter((d) => d.posicao && d.posicao.pagina === this.pagina && Number.isSafeInteger(d.posicao.inicio))
        .map((d) => [d.posicao.inicio, d.posicao.fim]);
      let posicao = 0;
      for (const pedaco of camada.querySelectorAll('span')) {
        if (pedaco.childElementCount) continue;
        const tamanho = pedaco.textContent.length;
        const marcado = intervalos.some(([inicio, fim]) => posicao < fim && posicao + tamanho > inicio);
        pedaco.classList.toggle('lt-destacado', marcado);
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
      this.conteudo.classList.remove('lt-pdf');
      if (this.documento) this.documento.destroy().catch(() => {});
      this.documento = null;
    }
  }

  // ---- Painel ----

  const ESTILO = `
body.leitor-lado{--leitor-largura:clamp(320px,50vw,960px)}
body.leitor-lado #top,body.leitor-lado #zoom{right:calc(var(--leitor-largura) + 16px)}
body.leitor-lado #bottom{padding-right:calc(var(--leitor-largura) + 16px)}
body.leitor-lado #head{width:max(80px,calc(100vw - var(--leitor-largura) - 284px - 280px))!important}
body.leitor-lado:not(.side) #head{width:max(80px,calc(100vw - var(--leitor-largura) - 72px - 280px))!important}
#leitor{position:fixed;top:var(--casca-faixa,0px);right:0;bottom:0;width:var(--leitor-largura,100vw);z-index:9;display:flex;flex-direction:column;background:var(--panel,#fff);color:var(--fg,#222);border-left:1px solid var(--line,#E3E1DD)}
body.leitor-tela #leitor{width:100vw;border-left:0}
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
#leitor .textLayer span.lt-destacado{background:rgba(0,0,0,.18)}
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
      // compat/marcacoes.js se liga aqui, com os destaques e os cartões.
      this.marcacoes = null;
      this.destaques = [];
      this._ouvintes = new Set();
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
      if (mudanca.tipo === 'selecao') this.selecao = mudanca.selecao;
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
  <button type="button" data-acao="modo"></button>
</div>
<div class="lt-conteudo"></div>
<div class="lt-selecao" hidden><span class="lt-trecho"></span><button type="button" data-acao="destacar">Destacar</button><button type="button" data-acao="levar">Levar ao quadro</button></div>
<p class="lt-aviso" role="status"></p>`;
      document.body.appendChild(painel);
      this._painel = painel;
      const titulo = painel.querySelector('.lt-titulo');
      const posicao = painel.querySelector('.lt-posicao');
      const modo = painel.querySelector('[data-acao="modo"]');
      const selecao = painel.querySelector('.lt-selecao');
      const trecho = painel.querySelector('.lt-trecho');
      const aviso = painel.querySelector('.lt-aviso');
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
        if (acao === 'destacar' || acao === 'levar') {
          this.destacarSelecao({ levar: acao === 'levar' }).catch((erroAoDestacar) => {
            this.aviso(`Não foi possível destacar: ${erroAoDestacar.message}.`);
          });
        }
      });
      // As setas viram as páginas quando o foco está no leitor.
      painel.addEventListener('keydown', (e) => {
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
