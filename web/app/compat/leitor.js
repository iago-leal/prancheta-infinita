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
// As barras de baixo do leitor, a do destaque aberto, a do progresso do
// KOReader e a dos avisos, ficam por cima do rodapé da página, sem mudar a
// altura dela: a epub.js não refaz as páginas quando a área do livro encolhe,
// e o fim da página ficava cortado.
//
// Leitura no e-ink, etapa 02 do plano 006: tocar no terço direito da página
// avança, e no esquerdo volta, sem animação; o sumário e a busca abrem num
// painel sobre o livro, e a busca não distingue maiúsculas nem acentos; na
// casca, o realce aparece invertido, e o sublinhado, em linha cheia.
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

  // Quantos caracteres do livro cabem em cada posição de um EPUB sem páginas marcadas.
  const CARACTERES_POR_POSICAO = 1600;
  // Com a ponta de uma seleção fora da página, o tempo mínimo entre uma virada de página e a seguinte.
  const ESPERA_ENTRE_VIRADAS_DA_SELECAO = 900;
  // De quanto em quanto tempo o leitor confere, por fora, a seleção feita na página de um e-book: ver _conferirSelecao.
  const INTERVALO_DA_VIGIA_DA_SELECAO = 300;

  // ---- Busca no texto ----

  const LIMITE_DE_ACHADOS = 200;
  const CONTEXTO_DO_ACHADO = 40;

  // Sem acentos e em minúsculas, para comparar; pode devolver mais de um caractere, ou nenhum.
  const semAcento = (c) => c.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();

  /**
   * Procura a consulta numa sequência de textos, como os nós de texto de um
   * capítulo ou os pedaços de uma página de PDF, lidos em ordem como um texto
   * só: sem distinguir maiúsculas nem acentos, com cada série de espaços valendo
   * um espaço, e achando também o que atravessa mais de um texto. Devolve, de
   * cada ocorrência, o início e o fim, com o índice do texto e a posição nele,
   * e o trecho ao redor.
   */
  function procurarNosTextos(textos, consulta, limite = LIMITE_DE_ACHADOS) {
    let plano = '';
    // De cada caractere do texto comparável: o texto de origem, a posição nele e o tamanho do caractere original.
    const origem = [];
    let espaco = true;
    // A origem do último caractere comparável, para um acento escrito à parte entrar no caractere que ele acentua.
    let ultima = null;
    textos.forEach((texto, n) => {
      for (let o = 0; o < texto.length;) {
        const c = String.fromCodePoint(texto.codePointAt(o));
        if (/\s/.test(c)) {
          if (!espaco) {
            plano += ' ';
            ultima = [n, o, c.length];
            origem.push(ultima);
          }
          espaco = true;
        } else {
          const comparavel = semAcento(c);
          if (comparavel) {
            ultima = [n, o, c.length];
            for (let k = 0; k < comparavel.length; k++) origem.push(ultima);
            plano += comparavel;
            espaco = false;
          } else if (ultima && ultima[0] === n && ultima[1] + ultima[2] === o && !espaco) {
            ultima[2] += c.length;
          }
        }
        o += c.length;
      }
    });
    const alvo = procurarNosTextos.comparavel(consulta);
    const achados = [];
    if (!alvo) return achados;
    // O texto original de um intervalo do texto comparável, com os espaços já reduzidos.
    const original = (de, ate) => {
      let saida = '';
      let anterior = null;
      for (let k = Math.max(0, de); k < Math.min(plano.length, ate); k++) {
        const [n, o, tamanho] = origem[k];
        if (anterior === origem[k]) continue;
        anterior = origem[k];
        saida += plano[k] === ' ' ? ' ' : textos[n].substr(o, tamanho);
      }
      return saida;
    };
    for (let i = plano.indexOf(alvo); i >= 0 && achados.length < limite; i = plano.indexOf(alvo, i + alvo.length)) {
      const fim = i + alvo.length;
      const [nInicio, oInicio] = origem[i];
      const [nFim, oFim, tamanhoFim] = origem[fim - 1];
      achados.push({
        inicio: { texto: nInicio, posicao: oInicio },
        fim: { texto: nFim, posicao: oFim + tamanhoFim },
        antes: original(i - CONTEXTO_DO_ACHADO, i),
        termo: original(i, fim),
        depois: original(fim, fim + CONTEXTO_DO_ACHADO),
      });
    }
    return achados;
  }
  procurarNosTextos.comparavel = (texto) => [...String(texto || '').trim().replace(/\s+/g, ' ')].map((c) => (c === ' ' ? ' ' : semAcento(c))).join('');

  // Os elementos que separam o texto em blocos, entre os quais a busca põe um espaço.
  const BLOCO = /^(address|article|aside|blockquote|dd|div|dl|dt|figcaption|figure|footer|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|table|td|th|tr|ul)$/i;

  // O trecho ao redor de um achado, em três partes, com reticências onde o texto continua.
  const trechoDoAchado = (a) => ({
    antes: `${a.antes.length >= CONTEXTO_DO_ACHADO ? '…' : ''}${a.antes}`.trimStart(),
    termo: a.termo,
    depois: `${a.depois}${a.depois.length >= CONTEXTO_DO_ACHADO ? '…' : ''}`.trimEnd(),
  });

  // Os ícones dos botões do leitor, no traço dos ícones da Prancheta; cada
  // botão leva o nome da ação no rótulo, para leitores de tela e para a dica
  // que o computador mostra ao parar o mouse sobre ele.
  const ICONES = {
    fechar: '<path d="M6 6l12 12M18 6L6 18"/>',
    anterior: '<path d="M15 6l-6 6 6 6"/>',
    proxima: '<path d="M9 6l6 6-6 6"/>',
    sumario: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r=".8"/><circle cx="4.5" cy="12" r=".8"/><circle cx="4.5" cy="18" r=".8"/>',
    buscar: '<circle cx="11" cy="11" r="7"/><path d="M20.5 20.5l-4.5-4.5"/>',
    cartao: '<path d="M13 6H6a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-5"/><path d="M7 12h6M7 16h4M19 2v6M16 5h6"/>',
    ficha: '<path d="M6 4h12v16H6z"/><path d="M9 9h6M9 13h6M9 17h3"/>',
    lado: '<path d="M4 8h15M15 4l4 4-4 4M20 16H5M9 12l-4 4 4 4"/>',
    tela: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    dividida: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/>',
    realce: '<path d="M9 11l-6 6v3h9l3-3M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>',
    sublinhado: '<path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14"/>',
    guardar: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    ir: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    apagar: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
    copiar: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  };
  const icone = (nome) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONES[nome]}</svg>`;
  // Um botão só com o ícone, com o nome da ação no rótulo e na dica.
  const botao = (acao, nome, rotulo, tipo = 'button') => `<button type="${tipo}"${acao ? ` data-acao="${acao}"` : ''} title="${rotulo}" aria-label="${rotulo}">${icone(nome)}</button>`;

  // Na casca, avisa se o toque começou no leitor: lá, a barra da seleção é a
  // da Prancheta, e a casca esconde o menu de seleção do Android, que ficava
  // por cima dela. O aviso vai no começo do toque, antes de a seleção nascer.
  function avisarCascaDoToque(noLeitor) {
    const casca = global.Casca;
    if (casca && typeof casca.toqueNoLeitor === 'function') casca.toqueNoLeitor(Boolean(noLeitor));
  }

  // ---- Progresso do KOReader ----

  /**
   * Lê a posição com que o KOReader descreve um ponto de um EPUB, como
   * /body/DocFragment[3]/body/div/p[12]/text().34: o número do capítulo, na
   * ordem de leitura e a partir de 1, e os passos até o elemento dentro do
   * corpo dele, cada um com o nome e a ordem entre os irmãos de mesmo nome.
   * O texto e o deslocamento no fim são deixados de lado: a Prancheta vai até
   * o parágrafo. Devolve null se o texto não tem essa forma.
   */
  function lerCaminhoDoKoreader(texto) {
    const lido = /^\/body\/DocFragment(?:\[(\d+)\])?\/body(?:\.\d+)?((?:\/[^/]+)*)$/.exec(String(texto || '').trim());
    if (!lido) return null;
    const fragmento = Number(lido[1] || 1);
    if (!Number.isSafeInteger(fragmento) || fragmento < 1) return null;
    const passos = [];
    for (const parte of lido[2].split('/').filter(Boolean)) {
      // O deslocamento, depois do ponto, e o nó de texto encerram o caminho dos elementos.
      const passo = /^([A-Za-z][\w:-]*)(?:\[(\d+)\])?(?:\.\d+)?$/.exec(parte);
      if (!passo) {
        if (/^text\(\)(?:\[\d+\])?(?:\.\d+)?$/.test(parte)) break;
        return null;
      }
      passos.push({ nome: passo[1].toLowerCase(), indice: Number(passo[2] || 1) });
    }
    return { fragmento, passos };
  }

  // Quanto o leitor espera, depois da última virada de página, para gravar a posição no servidor.
  const ESPERA_DO_ENVIO = 2000;

  /**
   * Monta, no formato do KOReader, o caminho até o bloco de texto, como um
   * parágrafo ou um título, que contém o nó dado: o capítulo, na ordem de
   * leitura e a partir de 1, e os passos desde o corpo dele, cada um com o
   * nome do elemento e, quando há irmãos de mesmo nome, a ordem entre eles.
   * É o inverso de lerCaminhoDoKoreader. Devolve '' se o nó está fora do corpo.
   */
  function montarCaminhoDoKoreader(no, corpo, fragmento) {
    let elemento = no && (no.nodeType === 1 ? no : no.parentElement);
    while (elemento && elemento !== corpo && !BLOCO.test(elemento.localName)) elemento = elemento.parentElement;
    if (!elemento || !corpo || !corpo.contains(elemento)) return '';
    const passos = [];
    for (let e = elemento; e !== corpo; e = e.parentElement) {
      const irmaos = [...e.parentElement.children].filter((f) => f.localName === e.localName);
      passos.unshift(irmaos.length > 1 ? `${e.localName}[${irmaos.indexOf(e) + 1}]` : e.localName);
    }
    const temTexto = [...elemento.childNodes].some((f) => f.nodeType === 3 && f.nodeValue.trim() !== '');
    return `/body/DocFragment[${fragmento}]/body${passos.map((passo) => `/${passo}`).join('')}${temTexto ? '/text()' : ''}.0`;
  }

  // O horário de um progresso, para o aviso: a hora, se foi hoje; senão, o dia e a hora.
  function quandoFoi(ms, agora = Date.now()) {
    const d = new Date(ms);
    const dois = (n) => String(n).padStart(2, '0');
    const hora = `${dois(d.getHours())}:${dois(d.getMinutes())}`;
    return new Date(agora).toDateString() === d.toDateString() ? `hoje às ${hora}` : `em ${dois(d.getDate())}/${dois(d.getMonth() + 1)} às ${hora}`;
  }

  // O retângulo que envolve as partes de uma seleção que estão à vista, em
  // relação à área do livro; `desloca` é a posição, na tela, do quadro em que
  // as partes foram medidas. Devolve null se nenhuma parte está à vista.
  function retanguloAVista(partes, area, desloca = { left: 0, top: 0 }) {
    let r = null;
    for (const parte of partes) {
      const esquerda = desloca.left + parte.left - area.left;
      const direita = desloca.left + parte.right - area.left;
      const topo = desloca.top + parte.top - area.top;
      const base = desloca.top + parte.bottom - area.top;
      if (parte.width < 1 || direita <= 0 || esquerda >= area.width || base <= 0 || topo >= area.height) continue;
      r = r ? {
        esquerda: Math.min(r.esquerda, esquerda), direita: Math.max(r.direita, direita), topo: Math.min(r.topo, topo), base: Math.max(r.base, base),
      } : { esquerda, direita, topo, base };
    }
    return r;
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
      // A página do livro, pelas marcas de página dele, ou a posição no livro
      // inteiro, quando ele não as tem; e a página dentro do capítulo.
      this.lugar = '';
      this.noCapitulo = '';
      // As marcas de página do livro: de cada uma, o capítulo, o id do elemento e o número.
      this._marcasDePagina = [];
      // Se as posições do livro inteiro já foram lidas ou calculadas.
      this._posicoesProntas = false;
      // Os destaques desenhados: de cada CFI, o tipo da anotação e o id do destaque.
      this._marcados = new Map();
      this._tocouMarcaEm = 0;
      this._achado = null;
      // A posição em que a epub.js deixou a rolagem do livro, depois de travada.
      this._rolagem = null;
      // A vigia da seleção: o endereço do trecho na última leitura e o do último trecho avisado.
      this._vigia = null;
      this._selecaoLida = '';
      this._selecaoAvisada = '';
    }

    async abrir(blob, posicao, { locais } = {}) {
      const ePub = await carregarEpub();
      this._ePub = ePub;
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
        // Durante o cálculo, a lista de posições cresce capítulo a capítulo, e só vale quando está completa.
        const posicoes = this._posicoesProntas ? this.livro.locations.length() : 0;
        this.percentual = posicoes ? `${Math.round(local.start.percentage * 100)}%` : '';
        this.noCapitulo = page && total ? `${page}/${total}` : '';
        // No rótulo, a página do livro, se ele traz as páginas marcadas; sem
        // elas, a posição no livro inteiro; enquanto as posições são
        // calculadas, na primeira abertura, só a página dentro do capítulo.
        const paginaDoLivro = this._paginaDoLivro(local);
        if (paginaDoLivro) this.lugar = `p. ${paginaDoLivro.pagina} de ${paginaDoLivro.total}`;
        else if (posicoes && local.start.location >= 0) this.lugar = `pos. ${local.start.location + 1} de ${posicoes}`;
        else this.lugar = '';
        this.rotulo = [this.lugar || (this.noCapitulo && `${this.noCapitulo} no capítulo`), this.percentual].filter(Boolean).join(' · ');
        const item = this.livro.navigation && local.start.href ? this.livro.navigation.get(local.start.href) : null;
        this.capitulo = item && item.label ? item.label.trim() : '';
        this._reposicionarMarcas();
        this.aoMudar({ tipo: 'posicao' });
      });
      // Os links internos do livro: a epub.js os resolve pela tag base, que a
      // política da página recusa, e sem ela não acha o capítulo; o leitor
      // resolve o endereço pelo capítulo aberto e leva a ele.
      this.vista.hooks.content.register((conteudo) => {
        // Um toque que começa com um trecho selecionado só desfaz a seleção.
        conteudo.document.addEventListener('pointerdown', () => {
          avisarCascaDoToque(true);
          this._haviaSelecao = !conteudo.window.getSelection().isCollapsed;
        }, true);
        // Um arrasto em andamento, com o mouse ou o dedo: é ele que estende uma seleção para além da página.
        let arrasto = null;
        conteudo.document.addEventListener('pointerdown', (e) => {
          arrasto = { x: e.clientX, y: e.clientY, moveu: false };
        }, true);
        conteudo.document.addEventListener('pointermove', (e) => {
          if (arrasto && e.buttons && Math.hypot(e.clientX - arrasto.x, e.clientY - arrasto.y) > 6) arrasto.moveu = true;
        }, true);
        for (const fim of ['pointerup', 'pointercancel']) conteudo.document.addEventListener(fim, () => { arrasto = null; }, true);
        // A epub.js só avisa de uma seleção feita; a desfeita, por um toque fora dela, é avisada aqui.
        conteudo.document.addEventListener('selectionchange', () => {
          if (conteudo.window.getSelection().isCollapsed) {
            this._selecaoAvisada = '';
            this.aoMudar({ tipo: 'selecao', selecao: null, desfeita: true });
          } else if (arrasto && arrasto.moveu) this._seguirPontaDaSelecao(conteudo);
        });
        conteudo.document.addEventListener('click', (e) => {
          const elo = e.target.closest && e.target.closest('a[href]');
          if (!elo) return;
          e.preventDefault();
          e.stopPropagation();
          this._seguirLink(elo.getAttribute('href'), conteudo);
        }, true);
      });
      this.vista.on('click', (e, conteudo) => this._clicou(e, conteudo));
      this.vista.on('selected', (cfiRange, conteudo) => {
        const texto = conteudo && conteudo.window ? conteudo.window.getSelection().toString() : '';
        this._selecaoAvisada = texto.trim() ? cfiRange : '';
        this.aoMudar({
          tipo: 'selecao',
          selecao: texto.trim() ? { texto: texto.trim(), posicao: { cfi: cfiRange }, retangulo: this._retanguloDaSelecao(conteudo) } : null,
        });
      });
      this._seguiuEm = 0;
      await this.vista.display(posicao && posicao.cfi ? posicao.cfi : undefined);
      this._travarRolagem();
      this._vigia = setInterval(() => this._conferirSelecao(), INTERVALO_DA_VIGIA_DA_SELECAO);
      // As posições e as porcentagens vêm depois, sem atrasar a abertura: as
      // guardadas da primeira vez, ou calculadas agora, capítulo a capítulo, e
      // entregues para serem guardadas.
      this.livro.ready.then(async () => {
        this._lerMarcasDePagina();
        let guardadas = false;
        if (locais) {
          try {
            this.livro.locations.load(locais);
            guardadas = this.livro.locations.length() > 0;
          } catch (e) { /* posições guardadas estragadas: são calculadas de novo */ }
        }
        if (!guardadas) {
          await this.livro.locations.generate(CARACTERES_POR_POSICAO);
          if (this.vista) this.aoMudar({ tipo: 'locais', locais: this.livro.locations.save() });
        }
        this._posicoesProntas = true;
        if (this.vista) this.vista.reportLocation();
      }).catch(() => {});
    }

    // As marcas de página que o livro traz, do documento de navegação dele:
    // cada uma aponta para um elemento de um capítulo e tem o número da página.
    _lerMarcasDePagina() {
      const lista = this.livro.pageList && Array.isArray(this.livro.pageList.pageList) ? this.livro.pageList.pageList : [];
      const navegacao = (this.livro.packaging && this.livro.packaging.navPath) || '';
      const marcas = [];
      for (const item of lista) {
        const pagina = Number(item && item.page);
        if (!Number.isSafeInteger(pagina) || pagina < 1 || typeof item.href !== 'string') continue;
        let caminho;
        let id;
        try {
          // O endereço é relativo ao documento de navegação.
          const resolvido = new URL(item.href, `http://livro.invalid/${navegacao}`);
          caminho = decodeURIComponent(resolvido.pathname.slice(1));
          id = decodeURIComponent(resolvido.hash.slice(1));
        } catch (e) {
          continue;
        }
        const secao = this.livro.spine.get(caminho);
        if (secao) marcas.push({ secao: secao.index, id, pagina });
      }
      this._marcasDePagina = marcas;
    }

    // A página do livro em que a página à vista começa: a última marca de
    // página até o começo dela; antes da primeira marca do livro, a primeira
    // que aparece na página à vista. Devolve também o número da última página
    // do livro; null se o livro não traz as páginas marcadas ou se nenhuma
    // marca foi alcançada.
    _paginaDoLivro(local) {
      const marcas = this._marcasDePagina;
      if (!marcas.length || !local || !local.start) return null;
      const indice = local.start.index;
      let pagina = 0;
      let naVista = 0;
      for (const marca of marcas) if (marca.secao < indice) pagina = Math.max(pagina, marca.pagina);
      const secao = this.livro.spine.get(indice);
      const conteudo = this.vista.getContents().find((c) => c.sectionIndex === indice);
      if (secao && conteudo && conteudo.document) {
        const comparar = new this._ePub.CFI();
        for (const marca of marcas) {
          if (marca.secao !== indice) continue;
          const elemento = marca.id ? conteudo.document.getElementById(marca.id) : conteudo.document.body;
          if (!elemento) continue;
          const onde = secao.cfiFromElement(elemento);
          if (comparar.compare(onde, local.start.cfi) <= 0) pagina = Math.max(pagina, marca.pagina);
          else if (comparar.compare(onde, local.end.cfi) <= 0) naVista = naVista ? Math.min(naVista, marca.pagina) : marca.pagina;
        }
      }
      pagina = pagina || naVista;
      return pagina ? { pagina, total: Math.max(...marcas.map((m) => m.pagina)) } : null;
    }

    // A página à vista agora; o último aviso da epub.js pode ser de um
    // instante antes de o texto assentar, logo depois de um salto.
    posicao() {
      try {
        const local = this.vista && this.vista.currentLocation();
        if (local && local.start && local.start.cfi) return { cfi: local.start.cfi };
      } catch (e) { /* a página ainda não foi desenhada */ }
      return this.cfi ? { cfi: this.cfi } : null;
    }

    // O que vai no cartão para dizer onde está o trecho ou a posição.
    rotuloParaCartao() {
      return [this.capitulo, this.lugar.replace(/ de \d+$/, '') || this.percentual].filter(Boolean).join(', ');
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

    // Na volta a um capítulo, a epub.js redesenha as marcas antes de o texto
    // tomar o lugar definitivo, e elas ficavam acima do trecho; com a página
    // no lugar, cada marca é posta de novo sobre o seu trecho.
    _reposicionarMarcas() {
      if (!this.vista) return;
      this.vista.views().forEach((vista) => {
        if (vista.pane) vista.pane.render();
      });
    }

    // Só as viradas de página rolam o livro. Ao arrastar a ponta de uma seleção
    // para além da página, o navegador rola o livro para mostrá-la, e a página
    // ficava cortada ao meio; essa rolagem é desfeita antes de aparecer na tela.
    // Com um trecho selecionado, ela vira uma virada de página inteira, para a
    // seleção continuar na página seguinte: ver _seguirSelecao.
    _travarRolagem() {
      const gerente = this.vista && this.vista.manager;
      const recipiente = gerente && gerente.container;
      if (!recipiente || this._rolagem) return;
      const ler = () => [recipiente.scrollLeft, recipiente.scrollTop];
      this._rolagem = ler();
      // A epub.js rola o livro por estas duas funções; a posição que elas deixam é a que vale.
      for (const nome of ['scrollTo', 'scrollBy']) {
        const original = gerente[nome];
        gerente[nome] = (...argumentos) => {
          const saida = original.apply(gerente, argumentos);
          this._rolagem = ler();
          return saida;
        };
      }
      recipiente.addEventListener('scroll', () => {
        const [x, y] = this._rolagem;
        const desvio = recipiente.scrollLeft - x;
        if (Math.abs(desvio) > 1) {
          recipiente.scrollLeft = x;
          this._seguirSelecao(desvio > 0 ? 1 : -1);
        }
        if (Math.abs(recipiente.scrollTop - y) > 1) recipiente.scrollTop = y;
      });
    }

    // Num arrasto com o mouse, o navegador não rola o livro: a ponta da seleção
    // vai, sem aparecer, para o texto da página ao lado, que está logo depois
    // da borda. Quando ela passa da borda, o livro vira a página para mostrá-la.
    _seguirPontaDaSelecao(conteudo) {
      const selecao = conteudo.window.getSelection();
      const recipiente = this.vista && this.vista.manager && this.vista.manager.container;
      const quadro = conteudo.document.defaultView.frameElement;
      if (!recipiente || !quadro || !selecao.focusNode) return;
      const ponta = conteudo.document.createRange();
      try {
        ponta.setStart(selecao.focusNode, selecao.focusOffset);
      } catch (e) {
        return;
      }
      const r = ponta.getClientRects()[0] || ponta.getBoundingClientRect();
      if (!r || (!r.height && !r.width && !r.left && !r.top)) return;
      const x = quadro.getBoundingClientRect().left + r.left;
      const pagina = recipiente.getBoundingClientRect();
      if (x >= pagina.right - 1) this._seguirSelecao(1);
      else if (x < pagina.left - 1) this._seguirSelecao(-1);
    }

    // A seleção que chega ao fim da página segue para a página ao lado. O
    // navegador tenta rolar o livro para mostrar a ponta da seleção; com um
    // trecho selecionado, essa tentativa vira uma virada de página inteira,
    // no sentido dela, e a seleção fica de pé, porque as páginas de um
    // capítulo são o mesmo documento. Entre uma virada e a seguinte passa um
    // tempo, porque o navegador insiste enquanto a ponta está fora da página,
    // e sem a espera o livro correria até o fim do capítulo. No fim e no
    // começo do capítulo, a seleção para ali.
    _seguirSelecao(sentido) {
      const gerente = this.vista && this.vista.manager;
      const recipiente = gerente && gerente.container;
      if (!recipiente || !this.temSelecao()) return false;
      const agora = Date.now();
      if (agora - this._seguiuEm < ESPERA_ENTRE_VIRADAS_DA_SELECAO) return false;
      const passo = gerente.layout && gerente.layout.delta;
      const [x] = this._rolagem;
      if (!(passo > 0)) return false;
      if (sentido > 0 ? x + recipiente.offsetWidth + passo > recipiente.scrollWidth + 1 : x - passo < -1) return false;
      this._seguiuEm = agora;
      gerente.scrollBy(sentido * passo, 0, true);
      this.aoMudar({ tipo: 'salto' });
      this.vista.reportLocation();
      // A barra da seleção acompanha a parte do trecho que está na página nova.
      const atual = this._selecaoAtual();
      if (atual) this._avisarSelecao(atual);
      return true;
    }

    // O trecho selecionado no livro, com o endereço dele e a página em que está, ou null.
    _selecaoAtual() {
      const conteudo = this.vista ? this.vista.getContents().find((c) => c.window && !c.window.getSelection().isCollapsed) : null;
      if (!conteudo) return null;
      const selecao = conteudo.window.getSelection();
      const texto = selecao.toString().trim();
      let cfi = '';
      try {
        cfi = conteudo.cfiFromRange(selecao.getRangeAt(0));
      } catch (e) { /* sem endereço, a seleção fica sem a barra até mudar de novo */ }
      return texto && cfi ? { conteudo, texto, cfi } : null;
    }

    _avisarSelecao(atual) {
      this._selecaoAvisada = atual.cfi;
      this.aoMudar({ tipo: 'selecao', selecao: { texto: atual.texto, posicao: { cfi: atual.cfi }, retangulo: this._retanguloDaSelecao(atual.conteudo) } });
    }

    // A seleção é avisada pela página do livro, por eventos dela. No Safari, e
    // em todo navegador do iPad e do iPhone, a página do livro não avisa de
    // nada: ela fica num quadro em que nenhum código roda, para o livro não
    // alcançar os dados da Prancheta, e lá isso cala também os avisos pedidos
    // pelo leitor. Por isso o leitor confere a seleção por fora, de tempo em
    // tempo, e avisa do trecho quando ele para de mudar, com duas leituras
    // iguais, e da seleção desfeita. Onde a página avisa, o aviso dela chega
    // antes, e o trecho já avisado não é avisado de novo.
    _conferirSelecao() {
      if (!this.vista || document.hidden) return;
      const atual = this._selecaoAtual();
      const endereco = atual ? atual.cfi : '';
      if (endereco !== this._selecaoLida) {
        this._selecaoLida = endereco;
        return;
      }
      if (endereco === this._selecaoAvisada) return;
      if (atual) this._avisarSelecao(atual);
      else {
        this._selecaoAvisada = '';
        this.aoMudar({ tipo: 'selecao', selecao: null, desfeita: true });
      }
    }

    // Onde a seleção está na área do livro, para a barra dela aparecer acima do trecho.
    _retanguloDaSelecao(conteudo) {
      const selecao = conteudo.window.getSelection();
      const quadro = conteudo.document.defaultView.frameElement;
      if (!selecao.rangeCount || !quadro) return null;
      return retanguloAVista(selecao.getRangeAt(0).getClientRects(), this.conteudo.getBoundingClientRect(), quadro.getBoundingClientRect());
    }

    /**
     * Onde fica, neste livro, o ponto em que o KOReader parou: o endereço do
     * parágrafo, ou do último elemento achado no caminho até ele, que é o
     * começo do capítulo quando nada é achado, e se ele está na página à vista. Devolve null se o progresso não dá para entender.
     */
    async lugarDoKoreader(progresso) {
      const caminho = lerCaminhoDoKoreader(progresso && progresso.progress);
      const secao = caminho && this.livro.spine.spineItems[caminho.fragmento - 1];
      if (!secao) return null;
      const doc = await this.livro.load(secao.url);
      const corpo = doc && doc.querySelector('body');
      if (!corpo) return null;
      let elemento = corpo;
      for (const passo of caminho.passos) {
        const filho = [...elemento.children].filter((f) => f.localName.toLowerCase() === passo.nome)[passo.indice - 1];
        // Um passo que não é achado encerra o caminho: vale o último elemento
        // achado, que é o começo do capítulo quando nem o primeiro passo existe.
        if (!filho) break;
        elemento = filho;
      }
      const alvo = secao.cfiFromElement(elemento);
      const local = await this._paginaAssentada();
      if (!this.vista) return null;
      const comparar = new this._ePub.CFI();
      // Na página à vista: o elemento começa nela, ou ela começa dentro dele.
      const dentroDoAlvo = (ponto) => ponto.startsWith(`${alvo.slice(0, -1)}/`);
      const mesmoLugar = Boolean(local && local.start && local.end) && (dentroDoAlvo(local.start.cfi)
        || (comparar.compare(alvo, local.start.cfi) >= 0 && comparar.compare(alvo, local.end.cfi) <= 0));
      return { alvo, mesmoLugar };
    }

    /**
     * Onde fica a posição exata gravada pelo leitor de outro aparelho da
     * Prancheta, e se ela está na página à vista; null se não é uma posição de EPUB.
     */
    async lugarDaPrancheta(posicao) {
      const alvo = posicao && posicao.cfi;
      if (typeof alvo !== 'string' || !/^epubcfi\([^\s()]+\)$/.test(alvo)) return null;
      const local = await this._paginaAssentada();
      if (!this.vista) return null;
      const comparar = new this._ePub.CFI();
      const mesmoLugar = Boolean(local && local.start && local.end)
        && comparar.compare(alvo, local.start.cfi) >= 0 && comparar.compare(alvo, local.end.cfi) <= 0;
      return { alvo, mesmoLugar };
    }

    /**
     * O caminho, no formato do KOReader, até o parágrafo em que a página à
     * vista começa, para o KOReader continuar de lá; '' se não dá para montar.
     */
    caminhoDoKoreader() {
      try {
        const local = this.vista && this.vista.currentLocation();
        if (!local || !local.start) return '';
        const conteudo = this.vista.getContents().find((c) => c.sectionIndex === local.start.index);
        const intervalo = conteudo && conteudo.range(local.start.cfi);
        if (!intervalo) return '';
        return montarCaminhoDoKoreader(intervalo.startContainer, conteudo.document.body, local.start.index + 1);
      } catch (e) {
        return '';
      }
    }

    /** Até onde o livro foi lido, de 0 a 1: pelas porcentagens do livro, ou pelo capítulo e pela página nele. */
    porcentagem() {
      const local = this.vista && this.vista.currentLocation();
      if (!local || !local.start) return 0;
      if (this._posicoesProntas && this.livro.locations.length() && local.start.percentage >= 0) return Math.min(1, local.start.percentage);
      const visto = local.start.displayed || {};
      const noCapitulo = visto.total ? (visto.page - 1) / visto.total : 0;
      return Math.min(1, (local.start.index + noCapitulo) / (this.livro.spine.spineItems.length || 1));
    }

    // A página à vista, depois de assentada: até quase meio segundo depois de
    // abrir, a epub.js ainda ajusta o capítulo, e o texto muda de lugar; a
    // página só vale quando duas leituras, com meio segundo entre elas, dão a mesma.
    async _paginaAssentada() {
      let anterior = '';
      for (let tentativa = 0; tentativa < 6 && this.vista; tentativa++) {
        const local = this.vista.currentLocation();
        const marca = local && local.start && local.end ? `${local.start.cfi} ${local.end.cfi}` : '';
        if (marca && marca === anterior) return local;
        anterior = marca;
        await new Promise((pronto) => setTimeout(pronto, 500));
      }
      return this.vista ? this.vista.currentLocation() : null;
    }

    /** Diz se há um trecho selecionado no livro. */
    temSelecao() {
      return Boolean(this.vista) && this.vista.getContents().some((c) => c.window && !c.window.getSelection().isCollapsed);
    }

    // Leva ao capítulo e ao ponto de um link interno; um endereço de fora do
    // livro não é aberto, porque o leitor não sai do livro.
    _seguirLink(endereco, conteudo) {
      if (!endereco || !this.vista || /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(endereco)) return;
      const secao = this.livro.spine.get(conteudo.sectionIndex);
      if (!secao) return;
      let alvo;
      try {
        const resolvido = new URL(endereco, `http://livro.invalid/${secao.href}`);
        alvo = decodeURIComponent(resolvido.pathname.slice(1)) + resolvido.hash;
      } catch (e) {
        return;
      }
      if (!this.livro.spine.get(alvo)) return;
      this.limparSelecao();
      this.aoMudar({ tipo: 'selecao', selecao: null });
      this.aoMudar({ tipo: 'salto' });
      Promise.resolve(this.vista.display(alvo)).catch(() => {});
    }

    // Um toque na página, fora de um link, de um destaque e de uma seleção,
    // feita ou desfeita por ele, é avisado com a fração da largura em que caiu,
    // para virar a página.
    _clicou(e, conteudo) {
      if (this._haviaSelecao || (e.target.closest && e.target.closest('a[href]'))) return;
      const quadro = conteudo.document.defaultView.frameElement;
      const x = (quadro ? quadro.getBoundingClientRect().left : 0) + e.clientX;
      // O toque num destaque chega logo depois, pela camada das anotações.
      setTimeout(() => {
        if (!this.vista || Date.now() - this._tocouMarcaEm < 400) return;
        if (conteudo.window && !conteudo.window.getSelection().isCollapsed) return;
        const r = this.conteudo.getBoundingClientRect();
        this.aoMudar({ tipo: 'toque', fracao: (x - r.left) / r.width });
      }, 0);
    }

    /** Os itens do sumário do livro, com o nível de cada um. */
    async sumario() {
      const navegacao = await this.livro.loaded.navigation;
      const itens = [];
      const andar = (lista, nivel) => {
        for (const item of lista || []) {
          itens.push({ titulo: String(item.label || '').trim(), nivel, alvo: item.href });
          andar(item.subitems, nivel + 1);
        }
      };
      andar(navegacao && navegacao.toc, 0);
      return itens;
    }

    irPara(alvo) {
      return this.vista.display(alvo);
    }

    /** Procura no livro inteiro, capítulo a capítulo, numa cópia de cada um. */
    async procurar(consulta, cancelada) {
      const achados = [];
      const navegacao = await this.livro.loaded.navigation;
      for (const secao of this.livro.spine.spineItems) {
        if (cancelada() || achados.length >= LIMITE_DE_ACHADOS) break;
        let doc;
        try {
          doc = await this.livro.load(secao.url);
        } catch (e) {
          continue;
        }
        const raiz = doc && (doc.body || doc.documentElement);
        if (!raiz) continue;
        // Os nós de texto do capítulo, com null entre os de blocos diferentes,
        // para o fim de um parágrafo não colar no começo do seguinte.
        const nos = [];
        const blocoDe = (no) => {
          for (let pai = no.parentNode; pai && pai !== raiz; pai = pai.parentNode) if (BLOCO.test(pai.localName || '')) return pai;
          return raiz;
        };
        const caminhante = doc.createTreeWalker(raiz, 5);
        let anterior = null;
        let quebra = false;
        for (let no = caminhante.nextNode(); no; no = caminhante.nextNode()) {
          if (no.nodeType === 1) {
            if (no.localName === 'br') quebra = true;
            continue;
          }
          if (/^(script|style)$/i.test(no.parentNode.nodeName)) continue;
          const bloco = blocoDe(no);
          if (nos.length && (quebra || bloco !== anterior)) nos.push(null);
          nos.push(no);
          anterior = bloco;
          quebra = false;
        }
        const item = navegacao && secao.href ? navegacao.get(secao.href) : null;
        const rotulo = item && item.label ? item.label.trim() : `Seção ${secao.index + 1}`;
        for (const a of procurarNosTextos(nos.map((no) => (no ? no.nodeValue : ' ')), consulta, LIMITE_DE_ACHADOS - achados.length)) {
          const intervalo = doc.createRange();
          intervalo.setStart(nos[a.inicio.texto], a.inicio.posicao);
          intervalo.setEnd(nos[a.fim.texto], a.fim.posicao);
          achados.push({ trecho: trechoDoAchado(a), rotulo, alvo: secao.cfiFromRange(intervalo) });
        }
      }
      return achados;
    }

    /** Leva a um resultado da busca e o marca, no lugar do anterior. */
    async mostrarAchado(cfi) {
      if (this._achado) this.vista.annotations.remove(this._achado, 'highlight');
      this._achado = cfi;
      await this.vista.display(cfi);
      this.vista.annotations.highlight(cfi, {}, null, 'lt-achado', { fill: '#000', 'fill-opacity': '0.35' });
    }

    // Um toque no destaque o abre; o fim de uma seleção sobre ele não.
    _tocouNoDestaque(cfi) {
      this._tocouMarcaEm = Date.now();
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
      clearInterval(this._vigia);
      this._vigia = null;
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
      this._achado = null;
      this._aoSelecionar = () => this._selecionou();
      this._aoTocar = (e) => this._tocou(e);
      // Um toque que começa com um trecho selecionado só desfaz a seleção.
      this._aoBaixar = () => {
        const selecao = document.getSelection();
        this._haviaSelecao = Boolean(selecao && !selecao.isCollapsed);
      };
    }

    async abrir(blob, posicao) {
      const pdfjs = await carregarPdf();
      this.pdfjs = pdfjs;
      this.documento = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), isEvalSupported: false }).promise;
      this.total = this.documento.numPages;
      this.pagina = Math.min(Math.max(1, Number(posicao && posicao.pagina) || 1), this.total);
      this.conteudo.classList.add('lt-pdf');
      document.addEventListener('selectionchange', this._aoSelecionar);
      // Ao rolar a página, a barra da seleção acompanha o trecho.
      this.conteudo.addEventListener('scroll', this._aoSelecionar);
      this.conteudo.addEventListener('click', this._aoTocar);
      this.conteudo.addEventListener('pointerdown', this._aoBaixar, true);
      await this._desenhar();
    }

    // Um toque num pedaço destacado, sem seleção em andamento, abre o destaque;
    // fora dele, e sem ter desfeito uma seleção, é avisado com a fração da
    // largura em que caiu, para virar a página.
    _tocou(e) {
      const selecao = document.getSelection();
      if (this._haviaSelecao || (selecao && !selecao.isCollapsed)) return;
      const pedaco = e.target.closest && e.target.closest('.textLayer span[data-destaque]');
      if (pedaco) {
        this.aoMudar({ tipo: 'destaque', id: pedaco.dataset.destaque });
        return;
      }
      const r = this.conteudo.getBoundingClientRect();
      this.aoMudar({ tipo: 'toque', fracao: (e.clientX - r.left) / r.width });
    }

    // Os textos de uma página, na ordem dos pedaços da camada de texto, cada
    // um com a posição em que começa no texto da página; no fim de cada linha
    // entra um espaço que não conta na posição, para as linhas não colarem.
    async _textosDaPagina(numero) {
      const pagina = await this.documento.getPage(numero);
      const textos = [];
      let posicao = 0;
      for (const item of (await pagina.getTextContent()).items) {
        if (typeof item.str !== 'string') continue;
        textos.push({ texto: item.str, posicao });
        posicao += item.str.length;
        if (item.hasEOL) textos.push({ texto: ' ', posicao });
      }
      return textos;
    }

    /** Os marcadores do PDF que apontam para uma página, com o nível de cada um. */
    async sumario() {
      const itens = [];
      const andar = async (lista, nivel) => {
        for (const item of lista || []) {
          let pagina = null;
          try {
            const destino = typeof item.dest === 'string' ? await this.documento.getDestination(item.dest) : item.dest;
            if (Array.isArray(destino) && destino[0] != null) {
              pagina = (typeof destino[0] === 'object' ? await this.documento.getPageIndex(destino[0]) : Number(destino[0])) + 1;
            }
          } catch (e) { /* um marcador sem destino válido fica de fora */ }
          if (pagina) itens.push({ titulo: String(item.title || '').trim(), nivel, alvo: pagina });
          await andar(item.items, nivel + 1);
        }
      };
      await andar(await this.documento.getOutline(), 0);
      return itens;
    }

    async irPara(pagina) {
      this.pagina = Math.min(Math.max(1, Number(pagina) || 1), this.total);
      await this._desenhar();
    }

    /** Procura no PDF inteiro, página a página. */
    async procurar(consulta, cancelada) {
      const achados = [];
      for (let numero = 1; numero <= this.total; numero++) {
        if (cancelada() || achados.length >= LIMITE_DE_ACHADOS) break;
        const textos = await this._textosDaPagina(numero);
        for (const a of procurarNosTextos(textos.map((t) => t.texto), consulta, LIMITE_DE_ACHADOS - achados.length)) {
          achados.push({
            trecho: trechoDoAchado(a), rotulo: `p. ${numero}`,
            alvo: { pagina: numero, inicio: textos[a.inicio.texto].posicao + a.inicio.posicao, fim: textos[a.fim.texto].posicao + a.fim.posicao },
          });
        }
      }
      return achados;
    }

    /** Leva a um resultado da busca e o marca, no lugar do anterior. */
    async mostrarAchado(alvo) {
      this._achado = alvo;
      await this.irPara(alvo.pagina);
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
      if (!selecao || selecao.isCollapsed || !selecao.anchorNode || !selecao.rangeCount) {
        // Uma seleção desfeita, por um toque fora dela, tira a barra da seleção.
        this.aoMudar({ tipo: 'selecao', selecao: null, desfeita: true });
        return;
      }
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
      const retangulo = retanguloAVista(intervalo.getClientRects(), this.conteudo.getBoundingClientRect());
      this.aoMudar({ tipo: 'selecao', selecao: texto ? { texto, posicao, retangulo } : null });
    }

    /** Onde fica, neste PDF, a página em que o KOReader parou, e se é a página à vista; null se não é uma página do livro. */
    async lugarDoKoreader(progresso) {
      const pagina = Number(progresso && progresso.progress);
      if (!Number.isSafeInteger(pagina) || pagina < 1 || pagina > this.total) return null;
      return { alvo: pagina, mesmoLugar: pagina === this.pagina };
    }

    /** Onde fica a página gravada pelo leitor de outro aparelho da Prancheta, e se é a página à vista. */
    async lugarDaPrancheta(posicao) {
      const pagina = posicao && posicao.pagina;
      if (!Number.isSafeInteger(pagina) || pagina < 1 || pagina > this.total) return null;
      return { alvo: pagina, mesmoLugar: pagina === this.pagina };
    }

    /** Até onde o livro foi lido, de 0 a 1. */
    porcentagem() {
      return this.total ? this.pagina / this.total : 0;
    }

    /** Diz se há um trecho selecionado na página. */
    temSelecao() {
      const selecao = document.getSelection();
      const camada = this.conteudo.querySelector('.textLayer');
      return Boolean(selecao && !selecao.isCollapsed && camada && selecao.anchorNode && camada.contains(selecao.anchorNode));
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
        if (pedaco.childElementCount && !pedaco.querySelector(':scope > mark')) continue;
        const tamanho = pedaco.textContent.length;
        const destaque = daPagina.find((d) => posicao < d.posicao.fim && posicao + tamanho > d.posicao.inicio);
        pedaco.classList.toggle('lt-destacado', Boolean(destaque) && destaque.estilo !== 'sublinhado');
        pedaco.classList.toggle('lt-sublinhado', Boolean(destaque) && destaque.estilo === 'sublinhado');
        if (destaque) pedaco.dataset.destaque = destaque.id;
        else delete pedaco.dataset.destaque;
        // O termo achado pela busca fica numa marca dentro do pedaço, só sobre as letras dele.
        const marcado = pedaco.querySelector('mark');
        const achado = this._achado && this._achado.pagina === this.pagina && posicao < this._achado.fim && posicao + tamanho > this._achado.inicio;
        if (marcado || achado) {
          const texto = pedaco.textContent;
          if (achado) {
            const de = Math.max(0, this._achado.inicio - posicao);
            const ate = Math.min(tamanho, this._achado.fim - posicao);
            const marca = document.createElement('mark');
            marca.className = 'lt-achado';
            marca.textContent = texto.slice(de, ate);
            pedaco.replaceChildren(texto.slice(0, de), marca, texto.slice(ate));
          } else {
            pedaco.textContent = texto;
          }
        }
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
      this.conteudo.removeEventListener('scroll', this._aoSelecionar);
      this.conteudo.removeEventListener('click', this._aoTocar);
      this.conteudo.removeEventListener('pointerdown', this._aoBaixar, true);
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
#leitor .lt-barra{flex-wrap:wrap}
#leitor svg.i{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;display:block;margin:auto}
#leitor .lt-barra button{padding:0}
#leitor .lt-posicao{min-width:52px;text-align:center}
#leitor .lt-meio{flex:1;min-height:0;position:relative;display:flex}
#leitor .lt-conteudo{flex:1;min-width:0;min-height:0;position:relative;overflow:hidden}
#leitor .lt-painel{position:absolute;inset:0;z-index:3;display:flex;flex-direction:column;gap:8px;padding:10px;background:var(--panel,#fff);overflow:auto;font-size:14px}
#leitor .lt-painel-topo{display:flex;align-items:center;gap:8px}
#leitor .lt-painel-topo b{flex:1;min-width:0}
#leitor .lt-busca{display:flex;gap:8px}
#leitor .lt-busca input{flex:1;min-width:0;font:inherit;height:38px;padding:0 10px;border:1px solid var(--line,#E3E1DD);border-radius:8px;background:transparent;color:inherit}
#leitor .lt-painel button{font:inherit;font-size:13px;min-height:38px;padding:0 10px;border:1px solid var(--line,#E3E1DD);border-radius:8px;background:transparent;color:inherit;cursor:pointer}
#leitor .lt-painel-topo button,#leitor .lt-busca button{min-width:38px;padding:0}
#leitor .lt-painel-aviso{margin:0;font-size:13px;color:var(--muted,#7F7C76)}
#leitor .lt-painel-aviso:empty{display:none}
#leitor .lt-painel-lista{display:flex;flex-direction:column;gap:4px}
#leitor .lt-painel-lista button{display:block;width:100%;text-align:left;padding:8px 10px;border-color:transparent;border-bottom-color:var(--line,#E3E1DD);border-radius:0;line-height:1.35}
#leitor .lt-painel-lista button small{display:block;color:var(--muted,#7F7C76);font-size:12px}
#leitor .lt-conteudo.lt-pdf{overflow:auto;padding:8px}
#leitor .lt-folha{position:relative;margin:0 auto;background:#fff}
#leitor .lt-folha canvas{display:block}
#leitor .textLayer{position:absolute;inset:0;overflow:hidden;line-height:1;text-align:initial;-webkit-text-size-adjust:none;text-size-adjust:none;transform-origin:0 0}
#leitor .textLayer :is(span,br){color:transparent;position:absolute;white-space:pre;cursor:text;transform-origin:0% 0%}
#leitor .textLayer span.markedContent{top:0;height:0}
#leitor .textLayer ::selection{background:rgba(0,0,0,.25)}
#leitor .textLayer span.lt-destacado{background:rgba(0,0,0,.18);cursor:pointer}
#leitor g.lt-sublinhado rect{stroke:none}
#leitor g.lt-sublinhado line{stroke:#000;stroke-opacity:.9;stroke-width:1.5px}
#leitor .textLayer span.lt-sublinhado{box-shadow:0 2px 0 rgba(0,0,0,.9);cursor:pointer}
#leitor .textLayer mark.lt-achado{color:transparent;background:rgba(0,0,0,.22);outline:2px solid #000}
html.casca #leitor .epub-view>svg{mix-blend-mode:difference}
html.casca #leitor g.lt-destaque,html.casca #leitor g.lt-achado{fill:#fff;fill-opacity:1}
html.casca #leitor g.lt-sublinhado line{stroke:#fff;stroke-opacity:1;stroke-width:2px}
html.casca #leitor .textLayer span.lt-destacado{background:#fff;mix-blend-mode:difference}
html.casca #leitor .textLayer mark.lt-achado{background:transparent}
html.casca #leitor .textLayer span.lt-sublinhado{box-shadow:0 2px 0 #000}
#leitor .lt-marca{flex:none;display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 10px;border-top:1px solid var(--line,#E3E1DD);font-size:13px}
#leitor .lt-marca .lt-marca-trecho{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
#leitor .lt-marca{position:relative}
#leitor .lt-marca label{flex:1 1 180px;display:flex;align-items:center;gap:6px;min-width:0}
#leitor .lt-marca input{flex:1;min-width:0;font:inherit;font-size:13px;height:34px;padding:0 8px;border:1px solid var(--line,#E3E1DD);border-radius:8px;background:transparent;color:inherit}
#leitor .lt-marca button{font:inherit;font-size:13px;min-width:38px;height:34px;padding:0;border:1px solid var(--line,#E3E1DD);border-radius:8px;background:transparent;color:inherit;cursor:pointer}
#leitor .lt-selecao{position:absolute;z-index:2;display:flex;padding:3px;background:var(--panel,#fff);border:1.5px solid currentColor;border-radius:10px;font-size:13px;white-space:nowrap}
#leitor .lt-selecao button{font:inherit;font-size:13px;width:46px;height:38px;padding:0;border:0;border-radius:7px;background:transparent;color:inherit;cursor:pointer}
#leitor .lt-selecao button+button{border-left:1px solid var(--line,#E3E1DD);border-radius:0}
#leitor .lt-selecao button:last-child{border-radius:0 7px 7px 0}
#leitor .lt-aviso button{font:inherit;font-size:13px;height:34px;padding:0 10px;border:1px solid var(--line,#E3E1DD);border-radius:8px;background:transparent;color:inherit;cursor:pointer}
#leitor .lt-rodape{position:absolute;left:0;right:0;bottom:0;z-index:4;background:var(--panel,#fff)}
#leitor .lt-remoto{flex:none;display:flex;align-items:center;gap:8px;padding:8px 10px;border-top:1px solid var(--line,#E3E1DD);font-size:13px}
#leitor .lt-remoto .lt-remoto-texto{flex:1;min-width:0}
#leitor .lt-remoto button{flex:none;font:inherit;min-width:38px;height:34px;padding:0;border:1px solid var(--line,#E3E1DD);border-radius:8px;background:transparent;color:inherit;cursor:pointer}
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
      // O painel aberto sobre o livro, do sumário ou da busca, ou null.
      this.painel = null;
      this._achados = { consulta: '', itens: [], aviso: '' };
      this._busca = 0;
      // O ponto em que a leitura parou no KOReader ou em outro aparelho da Prancheta, mais novo que a deste aparelho, ou null.
      this.remoto = null;
      // Se o leitor virou a página ou saltou neste livro: só então a posição
      // dele é gravada no servidor, para o outro aparelho continuar de lá.
      this._leu = false;
      this._enviada = null;
      this._aEnviar = null;
      // Quando o leitor virou a página pela última vez no livro aberto, neste aparelho.
      this._lidoEm = 0;
      // O horário do progresso de outro leitor que já foi dispensado neste livro aberto.
      this._dispensadoAte = 0;
      // Quando um botão da barra da seleção foi tocado pela última vez.
      this._tocouBarraEm = 0;
      this._aLargar = null;
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
      // Aberto por um link de volta, o livro vai à posição do link, e o progresso do KOReader não é consultado.
      const local = posicao ? null : await biblioteca.lerPosicaoComHora(id);
      const ondeParou = posicao || (local && local.posicao) || undefined;
      this._lidoEm = local ? local.em : 0;
      this._dispensadoAte = 0;
      this.livro = { id, nome: registro.nome, tipo: registro.tipo };
      const Vista = registro.tipo === 'application/pdf' ? VistaPdf : VistaEpub;
      this._mostrar();
      const vista = new Vista(this._conteudo(), (mudanca) => this._mudou(vista, mudanca));
      this.vista = vista;
      try {
        const locais = Vista === VistaEpub ? await biblioteca.lerLocais(id).catch(() => undefined) : undefined;
        await vista.abrir(registro.blob, ondeParou, { locais });
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
      if (!posicao && this.vista === vista) this._conferirProgressoRemoto(vista, id).catch(() => {});
      return this.posicaoAtual();
    }

    // Depois de aberto o livro, sem atrasar a abertura, e quando a tela volta
    // com o livro aberto: se o KOReader ou outro aparelho da Prancheta gravou
    // um progresso mais novo que a última leitura neste aparelho, e em outro
    // lugar, o leitor oferece ir até lá, sem pular sozinho.
    async _conferirProgressoRemoto(vista, id) {
      if (this.remoto) return;
      const remoto = await this.biblioteca.progressoRemoto(id);
      if (!remoto || vista !== this.vista || this.remoto) return;
      // A gravação deste mesmo aparelho não é novidade para ele.
      if (remoto.device_id && remoto.device_id === this.biblioteca.dispositivo) return;
      const quando = Number(remoto.timestamp) * 1000;
      if (!(quando > this._lidoEm) || quando <= this._dispensadoAte) return;
      // O leitor de outro aparelho da Prancheta grava a posição exata; a do KOReader é convertida.
      const lugar = remoto.posicao ? await vista.lugarDaPrancheta(remoto.posicao) : await vista.lugarDoKoreader(remoto);
      if (!lugar || lugar.mesmoLugar || vista !== this.vista) return;
      const porcentagem = Number(remoto.percentage);
      this.remoto = {
        alvo: lugar.alvo, quando, aparelho: typeof remoto.device === 'string' ? remoto.device.slice(0, 40) : '',
        daPrancheta: Boolean(remoto.posicao),
        porcentagem: porcentagem >= 0 && porcentagem <= 1 ? Math.round(porcentagem * 100) : null,
      };
      this._avisar();
    }

    /** Leva ao ponto em que a leitura parou no outro leitor e tira o aviso. */
    async irAoProgressoRemoto() {
      const remoto = this.remoto;
      if (!remoto || !this.vista) return;
      this.remoto = null;
      this._leu = true;
      this._largarSelecao();
      this._avisar();
      await this.vista.irPara(remoto.alvo);
    }

    // Grava no servidor a posição do leitor, pouco depois da última virada de
    // página, sem atrasar a leitura; sem rede, tenta de novo na virada seguinte.
    _agendarEnvio() {
      clearTimeout(this._aEnviar);
      this._aEnviar = setTimeout(() => this._enviarProgresso(), ESPERA_DO_ENVIO);
    }

    _enviarProgresso() {
      clearTimeout(this._aEnviar);
      if (!this.livro || !this.vista || !this._leu) return;
      const posicao = this.vista.posicao();
      const marca = JSON.stringify(posicao);
      if (!posicao || marca === this._enviada) return;
      this._enviada = marca;
      // Num EPUB, vai junto o caminho no formato do KOReader, para ele continuar de lá.
      const caminho = typeof this.vista.caminhoDoKoreader === 'function' ? this.vista.caminhoDoKoreader() : '';
      this.biblioteca.gravarProgressoRemoto(this.livro.id, { posicao, porcentagem: this.vista.porcentagem(), caminho }).then((gravou) => {
        if (!gravou && this._enviada === marca) this._enviada = null;
      }, () => {});
    }

    /** Tira o aviso do progresso do KOReader, sem sair do lugar. */
    dispensarProgressoRemoto() {
      if (!this.remoto) return;
      this._dispensadoAte = this.remoto.quando;
      this.remoto = null;
      this._avisar();
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

    /** Copia o trecho selecionado para a área de transferência e desfaz a seleção. */
    async copiarSelecao() {
      if (!this.selecao || !this.vista) return false;
      const texto = this.selecao.texto;
      let copiou = false;
      try {
        await global.navigator.clipboard.writeText(texto);
        copiou = true;
      } catch (e) {
        // Sem a área de transferência do navegador, vale o comando antigo, num campo provisório.
        const campo = document.createElement('textarea');
        campo.value = texto;
        campo.setAttribute('readonly', '');
        campo.style.cssText = 'position:fixed;left:-9999px;top:0';
        document.body.appendChild(campo);
        campo.select();
        try {
          copiou = document.execCommand('copy');
        } catch (erroDoComando) {
          copiou = false;
        }
        campo.remove();
      }
      if (copiou) this._largarSelecao();
      if (this.aviso) this.aviso(copiou ? 'Trecho copiado.' : 'Não foi possível copiar o trecho.');
      return copiou;
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

    /** Abre o sumário do livro num painel sobre ele. */
    async abrirSumario() {
      if (!this.vista) return;
      const vista = this.vista;
      const itens = await vista.sumario();
      if (vista !== this.vista) return;
      this.painel = {
        tipo: 'sumario', titulo: 'Sumário', aviso: itens.length ? '' : 'Este livro não tem sumário.',
        itens: itens.map((i) => ({ texto: i.titulo || '(sem título)', nivel: i.nivel, alvo: i.alvo })),
      };
      this._avisar();
    }

    /** Abre a busca no texto, com os resultados da última consulta neste livro. */
    abrirBusca() {
      if (!this.vista) return;
      this.painel = { tipo: 'busca', titulo: 'Buscar no livro', ...this._achados };
      this._avisar();
    }

    /** Procura um termo no livro inteiro, sem distinguir maiúsculas nem acentos. */
    async procurar(consulta) {
      if (!this.vista) return [];
      const vista = this.vista;
      const numero = ++this._busca;
      const termo = String(consulta || '').trim();
      const mostrar = (achados) => {
        this._achados = achados;
        if (this.painel && this.painel.tipo === 'busca') this.painel = { tipo: 'busca', titulo: 'Buscar no livro', ...achados };
        this._avisar();
      };
      if (!termo) {
        mostrar({ consulta: '', itens: [], aviso: '' });
        return [];
      }
      mostrar({ consulta: termo, itens: [], aviso: 'Procurando…' });
      const achados = await vista.procurar(termo, () => numero !== this._busca || vista !== this.vista);
      if (numero !== this._busca || vista !== this.vista) return [];
      const quantos = achados.length >= LIMITE_DE_ACHADOS ? `As primeiras ${LIMITE_DE_ACHADOS} ocorrências.`
        : achados.length === 1 ? '1 ocorrência.' : `${achados.length} ocorrências.`;
      mostrar({
        consulta: termo, aviso: achados.length ? quantos : `Nada encontrado para “${termo}”.`,
        itens: achados.map((a) => ({ trecho: a.trecho, sub: a.rotulo, alvo: a.alvo })),
      });
      return achados;
    }

    /** Leva ao item tocado no painel, um capítulo do sumário ou um resultado da busca, e fecha o painel. */
    async irParaItem(indice) {
      const painel = this.painel;
      const item = painel && painel.itens[indice];
      if (!item || !this.vista) return;
      this.painel = null;
      this._leu = true;
      this._largarSelecao();
      this._avisar();
      if (painel.tipo === 'busca') await this.vista.mostrarAchado(item.alvo);
      else await this.vista.irPara(item.alvo);
    }

    fecharPainel() {
      this.painel = null;
      this._avisar();
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
        clearTimeout(this._aLargar);
        // A seleção desfeita tira a barra logo depois, e não na hora: o toque
        // num botão da barra pode desfazer a seleção antes de chegar ao botão.
        if (mudanca.desfeita) {
          if (this.selecao) this._aLargar = setTimeout(() => this._largarSeDesfeita(vista), 300);
          return;
        }
        this.selecao = mudanca.selecao;
        if (mudanca.selecao) this.destaqueAberto = null;
      }
      if (mudanca.tipo === 'destaque') {
        this.abrirDestaque(mudanca.id);
        return;
      }
      // O terço esquerdo da página volta, e o direito avança; o meio não vira a página.
      if (mudanca.tipo === 'toque') {
        if (mudanca.fracao < 1 / 3) Promise.resolve(this.anterior()).catch(() => {});
        else if (mudanca.fracao > 2 / 3) Promise.resolve(this.proxima()).catch(() => {});
        return;
      }
      if (mudanca.tipo === 'salto') {
        this._leu = true;
        return;
      }
      // As posições do livro, calculadas na primeira abertura, ficam guardadas neste aparelho.
      if (mudanca.tipo === 'locais') {
        if (this.livro && typeof mudanca.locais === 'string') this.biblioteca.gravarLocais(this.livro.id, mudanca.locais).catch(() => {});
        return;
      }
      if (mudanca.tipo === 'posicao' && this.livro) {
        const posicao = vista.posicao();
        if (this._leu) this._lidoEm = Date.now();
        if (posicao) this.biblioteca.gravarPosicao(this.livro.id, posicao, this._lidoEm, vista.porcentagem()).catch(() => {});
        if (this._leu) this._agendarEnvio();
      }
      this._avisar();
    }

    // Tira a barra de uma seleção desfeita, a não ser que um botão dela esteja sendo tocado.
    _largarSeDesfeita(vista) {
      if (vista !== this.vista || !this.selecao) return;
      if (Date.now() - this._tocouBarraEm < 700) {
        this._aLargar = setTimeout(() => this._largarSeDesfeita(vista), 700);
        return;
      }
      if (vista.temSelecao()) return;
      this.selecao = null;
      this._avisar();
    }

    // Ao sair da página, a seleção fica para trás, e a barra dela some.
    _largarSelecao() {
      if (!this.selecao) return;
      if (this.vista) this.vista.limparSelecao();
      this.selecao = null;
      this._avisar();
    }

    // Quem vira a página escolheu continuar daqui: o aviso da leitura em outro lugar sai.
    proxima() {
      this._leu = true;
      this._largarSelecao();
      this.dispensarProgressoRemoto();
      return this.vista ? this.vista.proxima() : undefined;
    }

    anterior() {
      this._leu = true;
      this._largarSelecao();
      this.dispensarProgressoRemoto();
      return this.vista ? this.vista.anterior() : undefined;
    }

    /** Abre a ficha do livro aberto, com os destaques dele e os quadros que o citam, na tela da biblioteca. */
    abrirFicha() {
      const tela = this.biblioteca.tela;
      if (tela && this.livro) tela.abrirFicha(this.livro.id, { nome: this.livro.nome, tipo: this.livro.tipo });
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
      this.remoto = null;
      this.painel = null;
      this._achados = { consulta: '', itens: [], aviso: '' };
      this._busca += 1;
      // Ao fechar, fica guardada a página à vista, e não a do último aviso de
      // mudança, e a posição que ainda esperava para ir ao servidor vai agora.
      if (this.vista && this.livro) {
        const posicao = this.vista.posicao();
        if (posicao) this.biblioteca.gravarPosicao(this.livro.id, posicao, this._lidoEm, this.vista.porcentagem()).catch(() => {});
        this._enviarProgresso();
      }
      clearTimeout(this._aEnviar);
      this._leu = false;
      this._enviada = null;
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
  ${botao('fechar', 'fechar', 'Fechar o livro')}
  <span class="lt-titulo"></span>
  ${botao('anterior', 'anterior', 'Página anterior')}
  <span class="lt-posicao"></span>
  ${botao('proxima', 'proxima', 'Próxima página')}
  ${botao('sumario', 'sumario', 'Sumário')}
  ${botao('buscar', 'buscar', 'Buscar no livro')}
  ${botao('ao-quadro', 'cartao', 'Levar esta posição ao quadro, sem destacar')}
  ${botao('ficha', 'ficha', 'Ficha do livro: destaques e quadros que o citam')}
  ${botao('lado', 'lado', 'Passar o leitor para o outro lado do quadro')}
  <button type="button" data-acao="modo"></button>
</div>
<div class="lt-meio">
  <div class="lt-conteudo"></div>
  <div class="lt-painel" hidden>
    <div class="lt-painel-topo"><b class="lt-painel-titulo"></b>${botao('painel-fechar', 'fechar', 'Fechar')}</div>
    <form class="lt-busca" hidden><input name="busca" type="search" autocomplete="off" spellcheck="false" aria-label="Termo a procurar">${botao('', 'buscar', 'Procurar', 'submit')}</form>
    <p class="lt-painel-aviso" role="status"></p>
    <div class="lt-painel-lista"></div>
  </div>
  <div class="lt-selecao" role="toolbar" aria-label="Trecho selecionado" hidden>${botao('destacar', 'realce', 'Destacar')}${botao('levar', 'cartao', 'Destacar e levar ao quadro')}${botao('copiar', 'copiar', 'Copiar')}</div>
</div>
<div class="lt-rodape">
<div class="lt-marca" hidden>
  <span class="lt-marca-trecho"></span>
  <label>Nota<input name="nota" type="text" autocomplete="off" maxlength="4000"></label>
  ${botao('marca-nota', 'guardar', 'Guardar a nota')}
  <button type="button" data-acao="marca-estilo"></button>
  ${botao('marca-levar', 'cartao', 'Levar o destaque ao quadro')}
  ${botao('marca-apagar', 'apagar', 'Apagar o destaque')}
  ${botao('marca-fechar', 'fechar', 'Fechar')}
</div>
<div class="lt-remoto" hidden>
  <span class="lt-remoto-texto" role="status"></span>
  ${botao('remoto-ir', 'ir', 'Ir para onde a leitura parou')}
  ${botao('remoto-fechar', 'fechar', 'Ficar onde estou')}
</div>
<p class="lt-aviso" role="status"></p>
</div>`;
      document.body.appendChild(painel);
      this._painel = painel;
      const titulo = painel.querySelector('.lt-titulo');
      const posicao = painel.querySelector('.lt-posicao');
      const modo = painel.querySelector('[data-acao="modo"]');
      const selecao = painel.querySelector('.lt-selecao');
      const remoto = painel.querySelector('.lt-remoto');
      const textoDoRemoto = painel.querySelector('.lt-remoto-texto');
      const meio = painel.querySelector('.lt-meio');
      // A barra da seleção fica acima do trecho; sem espaço ali, abaixo dele,
      // depois das alças da seleção, quando a tela é de toque. Num navegador
      // de tela de toque, fora da casca, é o contrário: o menu de seleção do
      // sistema aparece acima do trecho e não pode ser escondido pela página,
      // e a barra vai para baixo, para não ficar por baixo dele.
      const posicionarBarra = (r) => {
        const area = meio.getBoundingClientRect();
        // Sem nenhuma parte do trecho à vista, como logo depois de a seleção seguir para a página ao lado, a barra fica no alto, fora do caminho.
        const alvo = r || { esquerda: area.width / 2, direita: area.width / 2, topo: 0, base: 0 };
        const largura = selecao.offsetWidth;
        const altura = selecao.offsetHeight;
        const toque = Boolean(global.matchMedia && global.matchMedia('(pointer: coarse)').matches);
        const abaixo = toque ? 34 : 10;
        let topo = alvo.topo - altura - 10;
        if (toque && !global.Casca && r) {
          if (alvo.base + abaixo + altura <= area.height - 4) topo = alvo.base + abaixo;
        } else if (topo < 4) topo = Math.min(alvo.base + abaixo, area.height - altura - 4);
        const esquerda = Math.min(Math.max(4, (alvo.esquerda + alvo.direita) / 2 - largura / 2), area.width - largura - 4);
        // No e-ink, cada mudança de posição atualiza a região: só escreve o que mudou.
        const lugar = { left: `${Math.round(esquerda)}px`, top: `${Math.round(Math.max(4, topo))}px` };
        for (const lado of ['left', 'top']) if (selecao.style[lado] !== lugar[lado]) selecao.style[lado] = lugar[lado];
      };
      // O toque num botão da barra não tira o foco nem a seleção do livro.
      selecao.addEventListener('pointerdown', (e) => {
        this._tocouBarraEm = Date.now();
        e.preventDefault();
      });
      const aviso = painel.querySelector('.lt-aviso');
      const lado = painel.querySelector('[data-acao="lado"]');
      const marca = painel.querySelector('.lt-marca');
      const trechoDaMarca = painel.querySelector('.lt-marca-trecho');
      const nota = painel.querySelector('.lt-marca input[name="nota"]');
      const estiloDaMarca = painel.querySelector('[data-acao="marca-estilo"]');
      // O destaque cuja nota está no campo, para não sobrescrever o que o autor digita.
      let notaDe = null;
      // O painel do sumário e da busca, sobre a página do livro.
      const sobre = {
        raiz: painel.querySelector('.lt-painel'),
        titulo: painel.querySelector('.lt-painel-titulo'),
        aviso: painel.querySelector('.lt-painel-aviso'),
        busca: painel.querySelector('form.lt-busca'),
        campo: painel.querySelector('input[name="busca"]'),
        lista: painel.querySelector('.lt-painel-lista'),
      };
      let painelDesenhado = null;
      // No e-ink, cada troca de texto atualiza a região: só escreve o que mudou.
      const escrever = (elemento, texto) => {
        if (elemento.textContent !== texto) elemento.textContent = texto;
      };
      // Troca o ícone e o rótulo de um botão que muda de função, também só quando mudam.
      const rotular = (elemento, nome, rotulo) => {
        if (elemento.dataset.icone === nome) return;
        elemento.dataset.icone = nome;
        elemento.innerHTML = icone(nome);
        elemento.title = rotulo;
        elemento.setAttribute('aria-label', rotulo);
      };
      this.aoMudar(() => {
        escrever(titulo, this.livro ? this.livro.nome : '');
        escrever(posicao, this.vista ? this.vista.rotulo : '');
        // A página dentro do capítulo fica à mão, para a dica do computador.
        const noCapitulo = (this.vista && this.vista.noCapitulo) || '';
        if (posicao.dataset.noCapitulo !== noCapitulo) {
          posicao.dataset.noCapitulo = noCapitulo;
          posicao.title = noCapitulo ? `Página ${noCapitulo.replace('/', ' de ')} do capítulo` : '';
        }
        const estreita = global.innerWidth < LARGURA_MINIMA_LADO_A_LADO;
        modo.hidden = estreita;
        if (this.modo === 'tela') rotular(modo, 'dividida', 'Lado a lado');
        else rotular(modo, 'tela', 'Tela inteira');
        lado.hidden = estreita || this.modo === 'tela';
        const aberto = this.destaque;
        marca.hidden = !aberto;
        if (aberto) {
          escrever(trechoDaMarca, `Destaque: “${resumir(aberto.trecho)}”`);
          if (aberto.estilo === 'sublinhado') rotular(estiloDaMarca, 'realce', 'Realçar');
          else rotular(estiloDaMarca, 'sublinhado', 'Sublinhar');
          if (notaDe !== aberto.id) nota.value = aberto.nota || '';
        }
        notaDe = aberto ? aberto.id : null;
        // O painel só é redesenhado quando muda, para não piscar no e-ink.
        if (this.painel !== painelDesenhado) {
          const antes = painelDesenhado;
          painelDesenhado = this.painel;
          sobre.raiz.hidden = !this.painel;
          if (this.painel) {
            escrever(sobre.titulo, this.painel.titulo);
            escrever(sobre.aviso, this.painel.aviso || '');
            sobre.busca.hidden = this.painel.tipo !== 'busca';
            if (this.painel.tipo === 'busca' && (!antes || antes.tipo !== 'busca')) {
              sobre.campo.value = this.painel.consulta || '';
              sobre.campo.focus();
            }
            sobre.lista.replaceChildren(...this.painel.itens.map((item, i) => {
              const botao = document.createElement('button');
              botao.type = 'button';
              botao.dataset.item = String(i);
              if (item.trecho) {
                const termo = document.createElement('b');
                termo.textContent = item.trecho.termo;
                const texto = document.createElement('span');
                texto.append(item.trecho.antes, termo, item.trecho.depois);
                botao.appendChild(texto);
              } else {
                botao.textContent = item.texto;
              }
              if (item.nivel) botao.style.paddingLeft = `${10 + item.nivel * 16}px`;
              if (item.sub) {
                const sub = document.createElement('small');
                sub.textContent = item.sub;
                botao.appendChild(sub);
              }
              return botao;
            }));
          }
        }
        selecao.hidden = !this.selecao;
        if (this.selecao) posicionarBarra(this.selecao.retangulo);
        remoto.hidden = !this.remoto;
        if (this.remoto) {
          const r = this.remoto;
          const onde = r.daPrancheta ? `Na Prancheta${r.aparelho ? ` do ${r.aparelho}` : ''}` : `No KOReader${r.aparelho ? `, em ${r.aparelho}` : ''}`;
          escrever(textoDoRemoto, `${onde}, você parou${r.porcentagem === null ? '' : ` em ${r.porcentagem}%`}, ${quandoFoi(r.quando)}.`);
        }
      });
      // O aviso fica por cima do rodapé da página e sai sozinho, para não esconder a última linha.
      let saidaDoAviso = null;
      this.aviso = (texto) => {
        escrever(aviso, texto || '');
        clearTimeout(saidaDoAviso);
        if (texto) saidaDoAviso = setTimeout(() => escrever(aviso, ''), 5000);
      };
      sobre.busca.addEventListener('submit', (e) => {
        e.preventDefault();
        this.procurar(sobre.campo.value).catch((erroNaBusca) => this.aviso(`Não foi possível procurar: ${erroNaBusca.message}.`));
      });
      painel.addEventListener('click', (e) => {
        const item = e.target.closest && e.target.closest('.lt-painel-lista [data-item]');
        if (item) {
          this.irParaItem(Number(item.dataset.item)).catch(() => {});
          return;
        }
        const botao = e.target.closest && e.target.closest('[data-acao]');
        if (!botao) return;
        const acao = botao.dataset.acao;
        if (acao === 'fechar') this.fechar();
        if (acao === 'proxima') Promise.resolve(this.proxima()).catch(() => {});
        if (acao === 'anterior') Promise.resolve(this.anterior()).catch(() => {});
        if (acao === 'modo') this.alternarModo();
        if (acao === 'ao-quadro') this.levarPosicaoAoQuadro();
        if (acao === 'ficha') this.abrirFicha();
        if (acao === 'lado') this.trocarLado();
        if (acao === 'sumario') this.abrirSumario().catch(() => {});
        if (acao === 'buscar') this.abrirBusca();
        if (acao === 'painel-fechar') this.fecharPainel();
        if (acao === 'remoto-ir') this.irAoProgressoRemoto().catch(() => this.aviso('Não foi possível ir até onde a leitura parou.'));
        if (acao === 'remoto-fechar') this.dispensarProgressoRemoto();
        if (acao === 'marca-fechar') this.fecharDestaque();
        if (acao === 'marca-levar') this.levarDestaqueAoQuadro();
        const falhou = (erroNaMarca) => this.aviso(`Não foi possível mudar o destaque: ${erroNaMarca.message}.`);
        if (acao === 'marca-apagar') this.apagarDestaque().catch(falhou);
        if (acao === 'marca-estilo') this.trocarEstiloDoDestaque().catch(falhou);
        if (acao === 'marca-nota') this.anotarDestaque(nota.value).catch(falhou);
        if (acao === 'copiar') this.copiarSelecao().catch(() => {});
        if (acao === 'destacar' || acao === 'levar') {
          this.destacarSelecao({ levar: acao === 'levar' }).catch((erroAoDestacar) => {
            this.aviso(`Não foi possível destacar: ${erroAoDestacar.message}.`);
          });
        }
      });
      // As setas viram as páginas quando o foco está no leitor.
      painel.addEventListener('keydown', (e) => {
        // Nos campos da nota e da busca, as teclas escrevem; Enter guarda a nota ou procura.
        if (e.target === nota || e.target === sobre.campo) {
          e.stopPropagation();
          if (e.key === 'Enter' && e.target === nota) this.anotarDestaque(nota.value).catch(() => {});
          return;
        }
        if (e.key === 'ArrowRight' || e.key === 'PageDown') Promise.resolve(this.proxima()).catch(() => {});
        if (e.key === 'ArrowLeft' || e.key === 'PageUp') Promise.resolve(this.anterior()).catch(() => {});
      });
      // Todo toque na página diz à casca se começou na área do livro; o do EPUB,
      // que acontece dentro do quadro do capítulo, avisa por lá.
      document.addEventListener('pointerdown', (e) => {
        avisarCascaDoToque(Boolean(e.target && e.target.closest && e.target.closest('#leitor .lt-conteudo')));
      }, true);
      // O livro pode ficar aberto enquanto a leitura continua em outro aparelho:
      // quando a tela volta, o leitor confere de novo o progresso.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.livro && this.vista) this._conferirProgressoRemoto(this.vista, this.livro.id).catch(() => {});
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

  global.LeitorPrancheta = Object.freeze({
    Leitor, ligar, procurarNosTextos, lerCaminhoDoKoreader, montarCaminhoDoKoreader, quandoFoi, LARGURA_MINIMA_LADO_A_LADO,
  });
})(typeof window !== 'undefined' ? window : globalThis);
