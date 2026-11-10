// Marcações dos livros, segunda parte da etapa 04 do plano 005: os destaques
// de cada livro, os cartões levados ao quadro e o link de volta, que reabre o
// livro na posição.
//
// - Os destaques de um livro ficam no documento marcacoes/<identificador do
//   livro>, no banco dos quadros, numa lista em que cada destaque tem o seu
//   id. Assim, eles sobem cifrados como os quadros, e a sincronização combina
//   os destaques feitos nos dois aparelhos, item a item.
// - Cada destaque tem o trecho, a posição, o estilo, realce ou sublinhado, e
//   uma nota. Um destaque apagado continua na lista, marcado com a data em
//   apagadoEm, para que a exclusão chegue aos outros aparelhos; o cartão que
//   ele já tenha no quadro não é tocado.
// - Um destaque, ou só a posição atual do livro, vai ao quadro aberto como um
//   cartão: o trecho, quando há, o nome do livro, a posição e o link "abrir no
//   livro", escrito no formato de link dos cartões, [rótulo](endereço).
// - O endereço do link é https://prancheta.invalid/livro/<livro>/<posição>,
//   com a posição em JSON, em base64url. O domínio .invalid é reservado e
//   nunca responde; a página intercepta o toque no link e abre o livro no
//   leitor, que o baixa antes, se este aparelho ainda não o guardou.
//
// Deve ser carregado depois de compat/leitor.js; compat/claude.js o liga ao
// leitor em window.marcacoesDaPrancheta.

(function (global) {
  'use strict';

  const COLECAO = 'marcacoes';
  const ENDERECO = 'https://prancheta.invalid/livro/';
  const ID_DE_LIVRO = /^[0-9a-f]{32}$/;

  const ESTILOS = new Set(['realce', 'sublinhado']);
  const LIMITE_DO_TEXTO = 4000;
  const visiveis = (itens) => itens.filter((d) => d && !d.apagadoEm);

  const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const escapar = (texto) => String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Nos cartões, colchetes e parênteses no texto formariam links; viram os equivalentes de largura total.
  const semMarcasDeLink = (texto) => String(texto).replace(/\[/g, '［').replace(/\]/g, '］');

  function paraBase64url(texto) {
    const bytes = new TextEncoder().encode(texto);
    let binario = '';
    for (const b of bytes) binario += String.fromCharCode(b);
    return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function deBase64url(texto) {
    const normal = texto.replace(/-/g, '+').replace(/_/g, '/');
    const binario = atob(normal + '='.repeat((4 - (normal.length % 4)) % 4));
    return new TextDecoder().decode(Uint8Array.from(binario, (c) => c.charCodeAt(0)));
  }

  /** O endereço do link de volta para uma posição de um livro. */
  function enderecoDe(livro, posicao) {
    return `${ENDERECO}${livro}/${paraBase64url(JSON.stringify(posicao))}`;
  }

  /** O livro e a posição de um endereço de link de volta, ou null. */
  function lerEndereco(endereco) {
    const texto = String(endereco || '');
    if (!texto.startsWith(ENDERECO)) return null;
    const [livro, posicao] = texto.slice(ENDERECO.length).split('/');
    if (!ID_DE_LIVRO.test(livro || '') || !/^[A-Za-z0-9_-]+$/.test(posicao || '')) return null;
    try {
      const lida = JSON.parse(deBase64url(posicao));
      if (!lida || typeof lida !== 'object' || Array.isArray(lida)) return null;
      const limpa = {};
      if (typeof lida.cfi === 'string' && /^epubcfi\(/.test(lida.cfi)) limpa.cfi = lida.cfi;
      for (const campo of ['pagina', 'inicio', 'fim']) if (Number.isSafeInteger(lida[campo]) && lida[campo] >= 0) limpa[campo] = lida[campo];
      return Object.keys(limpa).length ? { livro, posicao: limpa } : null;
    } catch (e) {
      return null;
    }
  }

  class Marcacoes {
    constructor(leitor, banco) {
      this.leitor = leitor;
      this.banco = banco;
    }

    _documento(livro) {
      return this.banco.doc(`${COLECAO}/${livro}`);
    }

    // O documento do livro, com todos os itens, inclusive os apagados.
    async _ler(livro) {
      const instantaneo = await this._documento(livro).get();
      const dados = instantaneo.exists ? instantaneo.data() : null;
      return dados && Array.isArray(dados.itens) ? dados : { livro, itens: [] };
    }

    /** Os destaques de um livro, sem os apagados, na ordem em que foram feitos. */
    async destaques(livro) {
      return visiveis((await this._ler(livro)).itens);
    }

    /** Avisa a cada mudança nos destaques do livro, inclusive as que chegam de outro aparelho. */
    acompanhar(livro, aoMudar) {
      return this._documento(livro).onSnapshot((instantaneo) => {
        const dados = instantaneo.exists ? instantaneo.data() : null;
        aoMudar(visiveis(dados && Array.isArray(dados.itens) ? dados.itens : []));
      }, () => {});
    }

    /** Guarda um destaque do livro aberto e o devolve. */
    async destacar({ livro, nome, tipo }, { texto, posicao, rotulo }) {
      const destaque = {
        id: novoId(), trecho: String(texto).slice(0, LIMITE_DO_TEXTO), posicao, rotulo: rotulo || '', estilo: 'realce', criadoEm: Date.now(),
      };
      const dados = await this._ler(livro);
      await this._documento(livro).set({ ...dados, livro, nome, tipo, itens: [...dados.itens, destaque] });
      return destaque;
    }

    // Troca campos de um destaque que ainda existe; devolve o destaque mudado, ou null.
    async _mudar(livro, id, mudanca) {
      const dados = await this._ler(livro);
      const atual = dados.itens.find((d) => d.id === id && !d.apagadoEm);
      if (!atual) return null;
      const mudado = { ...atual, ...mudanca, mudadoEm: Date.now() };
      await this._documento(livro).set({ ...dados, itens: dados.itens.map((d) => (d.id === id ? mudado : d)) });
      return mudado;
    }

    /** Troca o estilo de um destaque, entre realce e sublinhado. */
    trocarEstilo(livro, id, estilo) {
      if (!ESTILOS.has(estilo)) throw new Error('estilo de destaque desconhecido');
      return this._mudar(livro, id, { estilo });
    }

    /** Guarda a nota de um destaque; uma nota vazia a tira. */
    anotar(livro, id, nota) {
      return this._mudar(livro, id, { nota: String(nota || '').trim().slice(0, LIMITE_DO_TEXTO) });
    }

    /** Apaga um destaque: ele continua na lista, marcado, para a exclusão sincronizar. */
    apagar(livro, id) {
      return this._mudar(livro, id, { apagadoEm: Date.now() });
    }

    /**
     * Cria no quadro aberto um cartão com o trecho, se houver, o nome do
     * livro, a posição e o link de volta, no meio da parte visível do quadro.
     */
    levarAoQuadro({ livro, nome }, { trecho, posicao, rotulo, nota }) {
      const blocos = [];
      if (trecho) blocos.push({ k: 'quote', h: escapar(semMarcasDeLink(trecho)) });
      if (nota) blocos.push({ h: escapar(semMarcasDeLink(nota)) });
      const onde = rotulo ? `, ${escapar(semMarcasDeLink(rotulo))}` : '';
      blocos.push({ h: `<i>${escapar(semMarcasDeLink(nome))}</i>${onde} · [abrir no livro](${enderecoDe(livro, posicao)})` });
      // A parte visível do quadro: o que sobra do painel dos quadros, se aberto,
      // e do leitor, se ao lado, à esquerda ou à direita.
      const lateral = document.getElementById('side');
      let esquerda = lateral && !lateral.hidden && getComputedStyle(lateral).display !== 'none' ? lateral.getBoundingClientRect().right : 0;
      let direita = global.innerWidth;
      if (document.body.classList.contains('leitor-lado')) {
        const leitor = document.getElementById('leitor').getBoundingClientRect();
        if (document.body.classList.contains('leitor-esquerda')) esquerda = Math.max(esquerda, leitor.right);
        else direita = leitor.left;
      }
      const centro = global.toWorld((esquerda + direita) / 2, global.innerHeight / 2);
      global.begin();
      const cartao = global.add({
        type: 'card', x: Math.round(centro.x - 160), y: Math.round(centro.y - 40), w: 320, h: 0, blocks: blocos, c: 'none',
      });
      global.commit();
      return cartao;
    }

    /** Abre o livro de um link de volta; devolve false se o endereço não é um link de livro. */
    abrirLink(endereco) {
      const lido = lerEndereco(endereco);
      if (!lido) return false;
      this.leitor.abrir(lido.livro, lido.posicao).catch((e) => {
        const mensagem = e.code === 'sem_rede'
          ? 'Sem rede: este livro ainda não está guardado neste aparelho.'
          : e.code === 'not_found' ? 'Este livro não está na biblioteca.' : `Não foi possível abrir o livro: ${e.message}.`;
        if (typeof global.toast === 'function') global.toast(mensagem);
      });
      return true;
    }

    montar() {
      // Antes do quadro, que deixaria o link abrir uma aba nova.
      document.addEventListener('click', (e) => {
        const a = e.target.closest && e.target.closest(`a[href^="${ENDERECO}"]`);
        if (!a) return;
        e.preventDefault();
        e.stopPropagation();
        this.abrirLink(a.getAttribute('href'));
      }, true);
    }
  }

  /** Cria as marcações do leitor, no banco dos quadros, e passa a interceptar os links de volta. */
  function ligar(leitor, banco) {
    const marcacoes = new Marcacoes(leitor, banco);
    leitor.marcacoes = marcacoes;
    if (typeof document !== 'undefined') marcacoes.montar();
    return marcacoes;
  }

  global.MarcacoesPrancheta = Object.freeze({ Marcacoes, ligar, enderecoDe, lerEndereco, ENDERECO });
})(typeof window !== 'undefined' ? window : globalThis);
