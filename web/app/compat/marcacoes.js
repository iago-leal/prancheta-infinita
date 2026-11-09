// Marcações dos livros, segunda parte da etapa 04 do plano 005: os destaques
// de cada livro, os cartões levados ao quadro e o link de volta, que reabre o
// livro na posição.
//
// - Os destaques de um livro ficam no documento marcacoes/<identificador do
//   livro>, no banco dos quadros, numa lista em que cada destaque tem o seu
//   id. Assim, eles sobem cifrados como os quadros, e a sincronização combina
//   os destaques feitos nos dois aparelhos, item a item.
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

    /** Os destaques de um livro, na ordem em que foram feitos. */
    async destaques(livro) {
      const instantaneo = await this._documento(livro).get();
      const dados = instantaneo.exists ? instantaneo.data() : null;
      return dados && Array.isArray(dados.itens) ? dados.itens : [];
    }

    /** Avisa a cada mudança nos destaques do livro, inclusive as que chegam de outro aparelho. */
    acompanhar(livro, aoMudar) {
      return this._documento(livro).onSnapshot((instantaneo) => {
        const dados = instantaneo.exists ? instantaneo.data() : null;
        aoMudar(dados && Array.isArray(dados.itens) ? dados.itens : []);
      }, () => {});
    }

    /** Guarda um destaque do livro aberto e o devolve. */
    async destacar({ livro, nome, tipo }, { texto, posicao, rotulo }) {
      const destaque = { id: novoId(), trecho: String(texto).slice(0, 4000), posicao, rotulo: rotulo || '', criadoEm: Date.now() };
      const documento = this._documento(livro);
      const atual = await documento.get();
      const dados = atual.exists ? atual.data() : null;
      const itens = dados && Array.isArray(dados.itens) ? dados.itens : [];
      await documento.set({ livro, nome, tipo, itens: [...itens, destaque] });
      return destaque;
    }

    /**
     * Cria no quadro aberto um cartão com o trecho, se houver, o nome do
     * livro, a posição e o link de volta, no meio da parte visível do quadro.
     */
    levarAoQuadro({ livro, nome }, { trecho, posicao, rotulo }) {
      const blocos = [];
      if (trecho) blocos.push({ k: 'quote', h: escapar(semMarcasDeLink(trecho)) });
      const onde = rotulo ? `, ${escapar(semMarcasDeLink(rotulo))}` : '';
      blocos.push({ h: `<i>${escapar(semMarcasDeLink(nome))}</i>${onde} · [abrir no livro](${enderecoDe(livro, posicao)})` });
      // A parte visível do quadro fica entre o painel dos quadros, se aberto, e o leitor, se ao lado.
      const lateral = document.getElementById('side');
      const esquerda = lateral && !lateral.hidden && getComputedStyle(lateral).display !== 'none' ? lateral.getBoundingClientRect().right : 0;
      const direita = document.body.classList.contains('leitor-lado')
        ? document.getElementById('leitor').getBoundingClientRect().left : global.innerWidth;
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
