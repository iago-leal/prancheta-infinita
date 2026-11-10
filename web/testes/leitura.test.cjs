// Leitura no e-ink, etapa 02 do plano 006: o toque nas laterais da página, com
// as exceções dele, o sumário, a busca no livro inteiro e os destaques no modo
// e-ink da casca, no EPUB e no PDF. A página e o servidor ficam num só
// endereço, como na VPS.
// Executar a partir da raiz do repositório: node --test web/testes/*.test.cjs

'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const { Armazem } = require('../../servidor/armazem.cjs');
const { criarServidor } = require('../../servidor/servidor.cjs');
const { criarServidorDaPagina } = require('../../servidor/pagina.cjs');
const { Biblioteca } = require('../../servidor/biblioteca.cjs');
const { criarEpub, criarPdf } = require('./apoio/livros.cjs');

require('../app/compat/leitor.js');
const { procurarNosTextos } = globalThis.LeitorPrancheta;

const CHAVE = 'chave-de-teste-da-leitura-0123456789abcdef';
const TELA = { width: 1200, height: 800 };
const APP = path.join(__dirname, '..', 'app');

let navegador;
let vps;
before(async () => {
  navegador = await chromium.launch();
  const livros = fs.mkdtempSync(path.join(os.tmpdir(), 'prancheta-leitura-'));
  fs.writeFileSync(path.join(livros, 'Livro rico.epub'), await criarEpub({ rico: true }));
  fs.writeFileSync(path.join(livros, 'Livro longo.epub'), await criarEpub({ titulo: 'Livro longo', longo: true }));
  fs.writeFileSync(path.join(livros, 'Paginado.epub'), await criarEpub({ titulo: 'Paginado', longo: true, paginas: true }));
  fs.writeFileSync(path.join(livros, 'Sem sumario.epub'), await criarEpub({ titulo: 'Sem sumário', semSumario: true }));
  fs.writeFileSync(path.join(livros, 'Marcado.pdf'), criarPdf(['Primeira p\\341gina do PDF', 'Segunda P\\301GINA do PDF'], { marcadores: ['Parte um', 'Parte dois'] }));
  fs.writeFileSync(path.join(livros, 'Linhas.pdf'), criarPdf(['Uma linha do PDF\ncontinua na linha de baixo']));
  fs.writeFileSync(path.join(livros, 'Documento.pdf'), criarPdf());
  const armazem = await Armazem.abrir(fs.mkdtempSync(path.join(os.tmpdir(), 'prancheta-vps-')));
  const sincronia = criarServidor({ armazem, chave: CHAVE, biblioteca: new Biblioteca(livros) }).listeners('request')[0];
  const pagina = criarServidorDaPagina({ pasta: APP }).listeners('request')[0];
  const borda = http.createServer((req, res) => (req.url.startsWith('/sync/') ? sincronia : pagina)(req, res));
  await new Promise((pronto) => borda.listen(0, '127.0.0.1', pronto));
  vps = {
    base: `http://127.0.0.1:${borda.address().port}`,
    fechar: () => new Promise((pronto) => { borda.close(() => pronto()); borda.closeAllConnections(); }),
  };
});
after(async () => {
  await navegador?.close();
  await vps?.fechar();
});

// Abre a Prancheta, ligada ao servidor; com naCasca, dentro de uma casca simulada, com tela de toque.
async function abrirPrancheta({ naCasca = false } = {}) {
  const contexto = await navegador.newContext({ viewport: TELA, hasTouch: naCasca, permissions: ['clipboard-read', 'clipboard-write'] });
  if (naCasca) {
    await contexto.addInitScript(() => {
      const nada = () => {};
      // A casca simulada anota os avisos de onde cada toque começou.
      window.__toquesNoLeitor = [];
      window.Casca = {
        pronta: nada, transformacao: nada, areasReservadas: nada, canetaEscreve: nada, redesenharTela: nada, tinta: nada,
        toqueNoLeitor: (noLeitor) => window.__toquesNoLeitor.push(noLeitor),
      };
    });
  }
  const pagina = await contexto.newPage();
  const erros = [];
  pagina.on('pageerror', (e) => erros.push(e.message));
  await pagina.addInitScript(() => {
    window.__violacoes = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__violacoes.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  await pagina.goto(`${vps.base}/`);
  await pagina.waitForFunction(() => window.__booted === true && navigator.serviceWorker.controller !== null, null, { timeout: 10000 });
  await pagina.waitForFunction(() => Boolean(window.marcacoesDaPrancheta && document.getElementById('leitor')), null, { timeout: 10000 });
  await pagina.evaluate(([endereco, chave]) => window.sincronizacaoDaPrancheta.configurar({ endereco, chave }), [vps.base, CHAVE]);
  await pagina.waitForFunction(() => window.bibliotecaDaPrancheta.estado.lista.length === 7, null, { timeout: 10000 });
  return { contexto, pagina, erros };
}

// Abre um livro da biblioteca pelo nome, como o toque nele faz: guarda no aparelho e abre no leitor.
const abrirLivro = (pagina, nome) => pagina.evaluate(async (alvo) => {
  const livro = window.bibliotecaDaPrancheta.estado.lista.find((l) => l.nome === alvo);
  await window.bibliotecaDaPrancheta.guardar(livro.id);
  await window.leitorDaPrancheta.abrir(livro.id);
}, nome);

const textoDoEpub = (pagina) => pagina.evaluate(() => document.querySelector('#leitor iframe')?.contentDocument?.body?.innerText || '');
const noCapitulo = (pagina, expressao) => pagina.waitForFunction(
  (fonte) => new RegExp(fonte).test(document.querySelector('#leitor iframe')?.contentDocument?.body?.innerText || ''), expressao.source, { timeout: 15000 },
);
const naPagina = (pagina, rotulo) => pagina.waitForFunction((texto) => document.querySelector('#leitor .lt-posicao')?.textContent === texto, rotulo, { timeout: 15000 });
const pausa = (pagina) => pagina.waitForTimeout(500);

// O ponto da área do livro na fração dada da largura e da altura.
async function pontoNoLivro(pagina, fx, fy = 0.75) {
  const r = await pagina.locator('#leitor .lt-conteudo').boundingBox();
  return [r.x + r.width * fx, r.y + r.height * fy];
}
// A fração da largura da área do livro em que um ponto da tela cai.
async function fracaoDe(pagina, x) {
  const r = await pagina.locator('#leitor .lt-conteudo').boundingBox();
  return (x - r.x) / r.width;
}

// O ponto, na tela, do caractere dado de um parágrafo do EPUB aberto.
const pontoNoEpub = (pagina, id, indice) => pagina.evaluate(([alvo, i]) => {
  const quadro = document.querySelector('#leitor iframe');
  const doc = quadro.contentDocument;
  const intervalo = doc.createRange();
  const texto = doc.createTreeWalker(doc.getElementById(alvo), 4).nextNode();
  intervalo.setStart(texto, i);
  intervalo.setEnd(texto, i + 1);
  const r = intervalo.getBoundingClientRect();
  const q = quadro.getBoundingClientRect();
  return [q.left + r.left + r.width / 2, q.top + r.top + r.height / 2];
}, [id, indice]);

const selecionarNoEpub = (pagina, id, de, ate) => pagina.evaluate(([alvo, inicio, fim]) => {
  const doc = document.querySelector('#leitor iframe').contentDocument;
  const texto = doc.getElementById(alvo).firstChild;
  const intervalo = doc.createRange();
  intervalo.setStart(texto, inicio);
  intervalo.setEnd(texto, fim);
  doc.getSelection().removeAllRanges();
  doc.getSelection().addRange(intervalo);
}, [id, de, ate]);

async function destacarSelecao(pagina) {
  await pagina.locator('#leitor .lt-selecao [data-acao="destacar"]').waitFor();
  await pagina.click('#leitor .lt-selecao [data-acao="destacar"]');
  await pagina.waitForFunction(() => document.querySelector('#leitor .lt-selecao').hidden);
}

const selecionarAPaginaDoPdf = (pagina) => pagina.evaluate(() => {
  const intervalo = document.createRange();
  intervalo.selectNodeContents(document.querySelector('#leitor .textLayer'));
  document.getSelection().removeAllRanges();
  document.getSelection().addRange(intervalo);
});

// Arrasta o mouse de um ponto a outro, como quem seleciona um trecho. Os
// eventos vão direto ao navegador: o arrasto do Playwright espera executar um
// script em cada quadro, e o do livro, sem scripts, nunca responde. As
// coordenadas vão em pixels inteiros: com frações, o Chromium não estende a seleção.
async function arrastar(pagina, de, ate) {
  const cdp = await pagina.context().newCDPSession(pagina);
  const enviar = (type, [x, y], botoes) => cdp.send('Input.dispatchMouseEvent', {
    type, x: Math.round(x), y: Math.round(y), button: botoes === undefined ? 'none' : 'left', buttons: botoes || 0, clickCount: 1,
  });
  try {
    await enviar('mouseMoved', de);
    await enviar('mousePressed', de, 1);
    for (let i = 1; i <= 6; i++) await enviar('mouseMoved', [de[0] + ((ate[0] - de[0]) * i) / 6, de[1] + ((ate[1] - de[1]) * i) / 6], 1);
    await enviar('mouseReleased', ate, 0);
  } finally {
    await cdp.detach();
  }
}

// As frações de pontos escuros e claros num retângulo da tela.
async function tons(pagina, recorte) {
  const imagem = await pagina.screenshot({ clip: recorte });
  const folha = await pagina.context().newPage();
  try {
    return await folha.evaluate(async (dados) => {
      const figura = await createImageBitmap(await (await fetch(`data:image/png;base64,${dados}`)).blob());
      const tela = new OffscreenCanvas(figura.width, figura.height);
      const pincel = tela.getContext('2d');
      pincel.drawImage(figura, 0, 0);
      const { data } = pincel.getImageData(0, 0, figura.width, figura.height);
      let escuros = 0;
      let claros = 0;
      for (let i = 0; i < data.length; i += 4) {
        const luz = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        if (luz < 80) escuros += 1;
        if (luz > 175) claros += 1;
      }
      const total = data.length / 4;
      return { escuros: escuros / total, claros: claros / total };
    }, imagem.toString('base64'));
  } finally {
    await folha.close();
  }
}

// O retângulo, na tela, de um elemento do leitor, por dentro da borda.
const retangulo = (pagina, seletor) => pagina.evaluate((alvo) => {
  const r = document.querySelector(alvo).getBoundingClientRect();
  return { x: Math.ceil(r.left), y: Math.ceil(r.top), width: Math.max(1, Math.floor(r.width) - 1), height: Math.max(1, Math.floor(r.height) - 1) };
}, seletor);

test('a busca no texto ignora maiúsculas, acentos e espaços a mais, e acha o que atravessa mais de um texto', () => {
  const textos = ['Um ', 'cora', 'ção de  papel e a AÇÃO\n do vento, com o coracao.'];
  const achados = procurarNosTextos(textos, 'coracao');
  assert.deepEqual(achados.map((a) => [a.inicio, a.fim, a.termo]), [
    [{ texto: 1, posicao: 0 }, { texto: 2, posicao: 3 }, 'coração'],
    [{ texto: 2, posicao: 40 }, { texto: 2, posicao: 47 }, 'coracao'],
  ]);
  assert.equal(achados[0].antes, 'Um ');
  assert.equal(achados[0].depois, ' de papel e a AÇÃO do vento, com o corac');
  // A consulta também é comparada sem acentos, sem maiúsculas e com os espaços reduzidos.
  const [frase] = procurarNosTextos(textos, '  ação   DO Vento ');
  assert.deepEqual([frase.inicio, frase.fim, frase.termo], [{ texto: 2, posicao: 18 }, { texto: 2, posicao: 32 }, 'AÇÃO do vento']);
  assert.equal(textos[2].slice(frase.inicio.posicao, frase.fim.posicao), 'AÇÃO\n do vento');
  // Uma letra com o acento separado, em forma decomposta, é achada inteira.
  const [decomposto] = procurarNosTextos(['ão e café forte'], 'café');
  assert.deepEqual([decomposto.inicio.posicao, decomposto.fim.posicao, decomposto.termo], [6, 11, 'café']);
  assert.deepEqual(procurarNosTextos(textos, 'inexistente'), []);
  assert.deepEqual(procurarNosTextos(textos, '   '), []);
  assert.equal(procurarNosTextos(['aaaa aaaa aaaa'], 'aa', 3).length, 3, 'a busca para no limite de ocorrências');
});

test('no EPUB, tocar no terço direito avança e no esquerdo volta; o meio, um link, um destaque e o fim de uma seleção não viram a página', async () => {
  const { contexto, pagina, erros } = await abrirPrancheta();
  try {
    await abrirLivro(pagina, 'Livro rico.epub');
    await noCapitulo(pagina, /primeiro capítulo/);
    // O meio não vira; o terço direito avança; o esquerdo volta.
    await pagina.mouse.click(...await pontoNoLivro(pagina, 0.5));
    await pausa(pagina);
    assert.match(await textoDoEpub(pagina), /primeiro capítulo/);
    await pagina.mouse.click(...await pontoNoLivro(pagina, 0.9));
    await noCapitulo(pagina, /segundo capítulo/);
    await pagina.mouse.click(...await pontoNoLivro(pagina, 0.1));
    await noCapitulo(pagina, /primeiro capítulo/);

    // Um link do livro, no terço esquerdo, leva aonde aponta: o do primeiro
    // capítulo, ao segundo; o do segundo, ao próprio capítulo, e não à página anterior.
    const adiante = await pontoNoEpub(pagina, 'adiante', 3);
    assert.ok(await fracaoDe(pagina, adiante[0]) < 1 / 3, 'o link fica no terço esquerdo');
    await pagina.mouse.click(...adiante);
    await noCapitulo(pagina, /segundo capítulo/);
    const elo = await pontoNoEpub(pagina, 'elo', 3);
    assert.ok(await fracaoDe(pagina, elo[0]) < 1 / 3, 'o link fica no terço esquerdo');
    await pagina.mouse.click(...elo);
    await pausa(pagina);
    assert.match(await textoDoEpub(pagina), /segundo capítulo/);

    // Um destaque no terço esquerdo abre na barra do leitor, sem virar a página.
    await selecionarNoEpub(pagina, 'p2', 2, 18);
    await destacarSelecao(pagina);
    await pagina.waitForFunction(() => document.querySelectorAll('#leitor g.lt-destaque').length === 1);
    const destaque = await pontoNoEpub(pagina, 'p2', 8);
    assert.ok(await fracaoDe(pagina, destaque[0]) < 1 / 3, 'o destaque fica no terço esquerdo');
    await pagina.mouse.click(...destaque);
    await pagina.locator('#leitor .lt-marca').waitFor();
    await pausa(pagina);
    assert.match(await textoDoEpub(pagina), /segundo capítulo/);
    await pagina.click('#leitor [data-acao="marca-fechar"]');

    // O fim de uma seleção, solto no terço esquerdo, mostra o trecho e não vira a página.
    const fim = await pontoNoEpub(pagina, 'p5', 3);
    assert.ok(await fracaoDe(pagina, fim[0]) < 1 / 3, 'a seleção termina no terço esquerdo');
    await arrastar(pagina, await pontoNoEpub(pagina, 'p5', 16), fim);
    await pagina.locator('#leitor .lt-selecao').waitFor();
    await pausa(pagina);
    assert.match(await textoDoEpub(pagina), /segundo capítulo/);
    // O toque que desfaz a seleção, no terço esquerdo, também não vira; o seguinte volta a página.
    await pagina.mouse.click(...await pontoNoLivro(pagina, 0.1));
    await pausa(pagina);
    assert.match(await textoDoEpub(pagina), /segundo capítulo/);
    assert.equal(await pagina.evaluate(() => document.querySelector('#leitor iframe').contentDocument.getSelection().isCollapsed), true);
    await pagina.mouse.click(...await pontoNoLivro(pagina, 0.1));
    await noCapitulo(pagina, /primeiro capítulo/);
    assert.deepEqual(await pagina.evaluate(() => window.__violacoes), []);
    assert.deepEqual(erros, []);
  } finally {
    await contexto.close();
  }
});

test('no EPUB, a rolagem que o navegador faz para mostrar a ponta de uma seleção é desfeita, e a página não fica cortada', async () => {
  const { contexto, pagina, erros } = await abrirPrancheta();
  const rolagem = () => pagina.evaluate(() => {
    const recipiente = document.querySelector('#leitor .epub-container');
    return { x: recipiente.scrollLeft, largura: recipiente.scrollWidth, pagina: window.leitorDaPrancheta.vista.vista.manager.layout.delta };
  });
  const doisQuadros = () => pagina.evaluate(() => new Promise((pronto) => requestAnimationFrame(() => requestAnimationFrame(pronto))));
  try {
    await abrirLivro(pagina, 'Livro longo.epub');
    await noCapitulo(pagina, /primeiro capítulo/);
    await pagina.click('#leitor [data-acao="sumario"]');
    await pagina.locator('#leitor .lt-painel-lista button', { hasText: 'Capítulo longo' }).click();
    await noCapitulo(pagina, /Parágrafo 1 do capítulo longo/);
    await pagina.click('#leitor [data-acao="proxima"]');
    await pagina.waitForFunction(() => document.querySelector('#leitor .epub-container').scrollLeft > 0);
    const antes = await rolagem();
    assert.ok(antes.largura > antes.pagina * 3, `o capítulo tem várias páginas: ${JSON.stringify(antes)}`);
    assert.equal(antes.x, antes.pagina, 'a segunda página começa numa página inteira');
    // A página no rótulo, sem a porcentagem, que chega depois.
    const paginaNoRotulo = () => pagina.evaluate(() => document.querySelector('#leitor .lt-posicao').dataset.noCapitulo);
    await pagina.waitForFunction(() => /^2\//.test(document.querySelector('#leitor .lt-posicao').dataset.noCapitulo));
    const posicao = await paginaNoRotulo();

    // Como o Android faz com a ponta da seleção: mostrar um trecho de outra página rola o livro.
    await pagina.evaluate(() => document.querySelector('#leitor iframe').contentDocument.getElementById('l70').scrollIntoView());
    await doisQuadros();
    assert.equal((await rolagem()).x, antes.x, 'a rolagem para mostrar a seleção é desfeita');
    // Uma rolagem de meia página, como a da foto do autor, também.
    await pagina.evaluate(() => { document.querySelector('#leitor .epub-container').scrollLeft += 137; });
    await doisQuadros();
    assert.equal((await rolagem()).x, antes.x, 'a página não fica cortada ao meio');
    await pausa(pagina);
    assert.equal(await paginaNoRotulo(), posicao);

    // As viradas de página continuam a rolar o livro, de página em página.
    await pagina.click('#leitor [data-acao="proxima"]');
    await pagina.waitForFunction((x) => document.querySelector('#leitor .epub-container').scrollLeft > x, antes.x);
    assert.equal((await rolagem()).x, antes.pagina * 2);
    await pagina.mouse.click(...await pontoNoLivro(pagina, 0.05, 0.97));
    await pagina.waitForFunction((x) => document.querySelector('#leitor .epub-container').scrollLeft === x, antes.x);
    // Passar à tela inteira refaz as páginas, e o livro continua alinhado.
    await pagina.click('#leitor [data-acao="modo"]');
    await pagina.waitForFunction(() => document.body.classList.contains('leitor-tela'));
    await pausa(pagina);
    const inteira = await rolagem();
    assert.equal(inteira.x % inteira.pagina, 0, `em tela inteira, a rolagem fica numa página inteira: ${JSON.stringify(inteira)}`);
    await pagina.click('#leitor [data-acao="proxima"]');
    await pagina.waitForFunction((x) => document.querySelector('#leitor .epub-container').scrollLeft > x, inteira.x);
    assert.equal((await rolagem()).x, inteira.x + inteira.pagina);
    assert.deepEqual(erros, []);
  } finally {
    await contexto.close();
  }
});

// Onde estão, na tela, a barra da seleção e o trecho selecionado, e o que a barra mostra.
const barraDaSelecao = (pagina) => pagina.evaluate(() => {
  const barra = document.querySelector('#leitor .lt-selecao');
  const quadro = document.querySelector('#leitor iframe');
  const selecao = quadro ? quadro.contentDocument.getSelection() : document.getSelection();
  const desloca = quadro ? quadro.getBoundingClientRect() : { left: 0, top: 0 };
  const trecho = selecao.rangeCount && !selecao.isCollapsed ? selecao.getRangeAt(0).getBoundingClientRect() : null;
  const b = barra.getBoundingClientRect();
  const area = document.querySelector('#leitor .lt-meio').getBoundingClientRect();
  return {
    visivel: !barra.hidden, texto: barra.textContent, botoes: [...barra.querySelectorAll('button')].map((x) => x.getAttribute('aria-label')),
    icones: barra.querySelectorAll('button > svg').length,
    barra: { esquerda: b.left, direita: b.right, topo: b.top, base: b.bottom },
    trecho: trecho && { esquerda: desloca.left + trecho.left, direita: desloca.left + trecho.right, topo: desloca.top + trecho.top, base: desloca.top + trecho.bottom },
    area: { esquerda: area.left, direita: area.right, topo: area.top, base: area.bottom },
    dentro: barra.parentElement.classList.contains('lt-meio'),
  };
});
const barraSome = (pagina) => pagina.waitForFunction(() => document.querySelector('#leitor .lt-selecao').hidden, null, { timeout: 5000 });

test('a barra da seleção flutua acima do trecho, só com os botões, e some ao tocar fora dele', async () => {
  const { contexto, pagina, erros } = await abrirPrancheta();
  try {
    // EPUB: a barra aparece logo acima do trecho, centrada nele, só com os dois botões.
    await abrirLivro(pagina, 'Livro rico.epub');
    await noCapitulo(pagina, /primeiro capítulo/);
    assert.equal((await barraDaSelecao(pagina)).visivel, false);
    await selecionarNoEpub(pagina, 'p1', 9, 26);
    await pagina.locator('#leitor .lt-selecao').waitFor();
    let m = await barraDaSelecao(pagina);
    assert.deepEqual([m.dentro, m.botoes, m.icones, m.texto], [true, ['Destacar', 'Destacar e levar ao quadro', 'Copiar'], 3, ''], 'a barra fica sobre o livro, com um ícone em cada botão, e não transcreve o trecho');
    assert.ok(m.barra.base <= m.trecho.topo && m.trecho.topo - m.barra.base < 24, `a barra fica logo acima do trecho: ${JSON.stringify(m)}`);
    const meio = (r) => (r.esquerda + r.direita) / 2;
    assert.ok(Math.abs(meio(m.barra) - meio(m.trecho)) < 2, `a barra fica centrada no trecho: ${JSON.stringify(m)}`);
    // Todos os botões do leitor mostram um ícone, sem palavras, e dizem a ação no rótulo e na dica.
    const botoes = await pagina.evaluate(() => [...document.querySelectorAll('#leitor button')].filter((b) => !b.closest('.lt-painel-lista'))
      .map((b) => ({ acao: b.dataset.acao || b.type, texto: b.textContent.trim(), icone: b.querySelectorAll(':scope > svg.i').length, rotulo: b.getAttribute('aria-label'), dica: b.title })));
    assert.equal(botoes.length, 20);
    for (const b of botoes.filter((x) => x.acao !== 'marca-estilo')) {
      assert.ok(b.texto === '' && b.icone === 1 && b.rotulo && b.rotulo === b.dica, `botão com ícone e rótulo: ${JSON.stringify(b)}`);
    }
    // Com os ícones, a barra do alto do leitor cabe numa linha só.
    const alturas = await pagina.evaluate(() => [...document.querySelectorAll('#leitor .lt-barra > *')].map((e) => Math.round(e.getBoundingClientRect().top + e.getBoundingClientRect().height / 2)));
    assert.equal(new Set(alturas).size, 1, `a barra do leitor numa linha: ${alturas}`);
    // Tocar fora do trecho desfaz a seleção e tira a barra, sem virar a página.
    await pagina.mouse.click(...await pontoNoLivro(pagina, 0.5));
    await barraSome(pagina);
    assert.equal(await pagina.evaluate(() => window.leitorDaPrancheta.selecao), null);
    assert.match(await textoDoEpub(pagina), /primeiro capítulo/);

    // Sem espaço acima, no alto da página, a barra vai para baixo do trecho; na borda, não sai do livro.
    await pagina.evaluate(() => {
      const doc = document.querySelector('#leitor iframe').contentDocument;
      const titulo = doc.querySelector('h1').firstChild;
      const intervalo = doc.createRange();
      intervalo.setStart(titulo, 0);
      intervalo.setEnd(titulo, 3);
      doc.getSelection().removeAllRanges();
      doc.getSelection().addRange(intervalo);
    });
    await pagina.locator('#leitor .lt-selecao').waitFor();
    m = await barraDaSelecao(pagina);
    assert.ok(m.barra.topo >= m.trecho.base, `sem espaço acima, a barra fica abaixo do trecho: ${JSON.stringify(m)}`);
    assert.ok(m.barra.esquerda >= m.area.esquerda && m.barra.direita <= m.area.direita && m.barra.topo >= m.area.topo, `a barra não sai da área do livro: ${JSON.stringify(m)}`);
    // Virar a página deixa a seleção para trás, e a barra some.
    await pagina.click('#leitor [data-acao="proxima"]');
    await noCapitulo(pagina, /segundo capítulo/);
    await barraSome(pagina);

    // O botão da barra destaca o trecho, e a barra some com a seleção.
    await selecionarNoEpub(pagina, 'p2', 2, 18);
    await pagina.locator('#leitor .lt-selecao').waitFor();
    await pagina.click('#leitor .lt-selecao [data-acao="destacar"]');
    await pagina.waitForFunction(() => document.querySelectorAll('#leitor g.lt-destaque').length === 1);
    await barraSome(pagina);
    // Uma seleção desfeita com o botão ainda apertado não tira a barra antes do toque terminar.
    await selecionarNoEpub(pagina, 'p5', 3, 16);
    await pagina.locator('#leitor .lt-selecao').waitFor();
    const botao = await pagina.locator('#leitor .lt-selecao [data-acao="destacar"]').boundingBox();
    await pagina.mouse.move(botao.x + botao.width / 2, botao.y + botao.height / 2);
    await pagina.mouse.down();
    await pagina.evaluate(() => document.querySelector('#leitor iframe').contentDocument.getSelection().removeAllRanges());
    await pagina.waitForTimeout(450);
    assert.equal((await barraDaSelecao(pagina)).visivel, true, 'a barra espera o toque no botão terminar');
    await pagina.mouse.up();
    await pagina.waitForFunction(() => document.querySelectorAll('#leitor g.lt-destaque').length === 2);
    await barraSome(pagina);

    // Copiar leva o trecho à área de transferência, desfaz a seleção e tira a barra.
    await selecionarNoEpub(pagina, 'p5', 3, 16);
    await pagina.locator('#leitor .lt-selecao').waitFor();
    await pagina.click('#leitor .lt-selecao [data-acao="copiar"]');
    await pagina.waitForFunction(() => document.querySelector('#leitor .lt-aviso').textContent === 'Trecho copiado.');
    assert.equal(await pagina.evaluate(() => navigator.clipboard.readText()), 'fim, o CORAÇÃ');
    await barraSome(pagina);
    assert.equal(await pagina.evaluate(() => document.querySelector('#leitor iframe').contentDocument.getSelection().isCollapsed), true);
    assert.equal(await pagina.evaluate(() => document.querySelectorAll('#leitor g.lt-destaque').length), 2, 'copiar não destaca');

    // PDF: a barra acima do trecho, e tocar fora a tira.
    await abrirLivro(pagina, 'Marcado.pdf');
    await naPagina(pagina, 'p. 1 de 2');
    await pagina.waitForFunction(() => /Primeira/.test(document.querySelector('#leitor .textLayer')?.textContent || ''));
    await selecionarAPaginaDoPdf(pagina);
    await pagina.locator('#leitor .lt-selecao').waitFor();
    m = await barraDaSelecao(pagina);
    assert.deepEqual([m.dentro, m.texto], [true, '']);
    assert.ok(m.barra.base <= m.trecho.topo && m.trecho.topo - m.barra.base < 24, `no PDF, a barra fica logo acima do trecho: ${JSON.stringify(m)}`);
    await pagina.mouse.click(...await pontoNoLivro(pagina, 0.5));
    await barraSome(pagina);
    assert.equal(await pagina.textContent('#leitor .lt-posicao'), 'p. 1 de 2');
    // Copiar vale também no PDF.
    await selecionarAPaginaDoPdf(pagina);
    await pagina.locator('#leitor .lt-selecao').waitFor();
    await pagina.click('#leitor .lt-selecao [data-acao="copiar"]');
    await barraSome(pagina);
    assert.equal(await pagina.evaluate(() => navigator.clipboard.readText()), 'Primeira página do PDF');
    assert.deepEqual(erros, []);
  } finally {
    await contexto.close();
  }
});

test('nos e-books, o leitor mostra a página do livro, ou a posição no livro inteiro quando ele não traz as páginas', async () => {
  const { contexto, pagina, erros } = await abrirPrancheta();
  const rotulo = () => pagina.textContent('#leitor .lt-posicao');
  const irAo = (id) => pagina.evaluate(async (alvo) => {
    const vista = window.leitorDaPrancheta.vista;
    const secao = vista.livro.spine.spineItems[2];
    const doc = await vista.livro.load(secao.url);
    await vista.irPara(secao.cfiFromElement(doc.querySelector(`#${alvo}`)));
  }, id);
  try {
    // Sem páginas marcadas: a posição no livro inteiro e a porcentagem, depois de calculadas.
    await abrirLivro(pagina, 'Livro longo.epub');
    await noCapitulo(pagina, /primeiro capítulo/);
    await pagina.waitForFunction(() => /^pos\. 1 de \d+ · 0%$/.test(document.querySelector('#leitor .lt-posicao').textContent), null, { timeout: 15000 });
    const total = Number((await rotulo()).match(/de (\d+)/)[1]);
    assert.ok(total >= 4, `o livro tem várias posições: ${await rotulo()}`);
    // Mais adiante, a posição cresce, e a página dentro do capítulo fica na dica.
    await irAo('l60');
    await pagina.waitForFunction(() => /^pos\. (\d+) de/.test(document.querySelector('#leitor .lt-posicao').textContent) && !/^pos\. 1 de/.test(document.querySelector('#leitor .lt-posicao').textContent));
    const [, posicao, deTotal, porcento] = (await rotulo()).match(/^pos\. (\d+) de (\d+) · (\d+)%$/);
    assert.ok(Number(posicao) > 2 && Number(posicao) <= total && Number(deTotal) === total && Number(porcento) > 40, await rotulo());
    assert.match(await pagina.getAttribute('#leitor .lt-posicao', 'title'), /^Página \d+ de \d+ do capítulo$/);
    // A posição levada ao quadro vai com esse número.
    await pagina.click('#leitor [data-acao="ao-quadro"]');
    const cartao = await pagina.evaluate(() => [...S.items.values()].filter((i) => i.type === 'card').map((i) => i.blocks.map((b) => b.h).join(' ')).at(-1));
    assert.match(cartao, new RegExp(`Capítulo longo, pos\\. ${posicao} ·`));

    // As posições ficam guardadas no aparelho: na abertura seguinte, não são calculadas de novo.
    const livro = await pagina.evaluate(() => window.leitorDaPrancheta.livro.id);
    assert.equal(typeof await pagina.evaluate((id) => window.bibliotecaDaPrancheta.lerLocais(id), livro), 'string');
    await pagina.evaluate(() => {
      window.__gravadas = 0;
      const biblioteca = window.bibliotecaDaPrancheta;
      const original = biblioteca.gravarLocais.bind(biblioteca);
      biblioteca.gravarLocais = (...a) => { window.__gravadas += 1; return original(...a); };
    });
    await pagina.click('#leitor [data-acao="fechar"]');
    await abrirLivro(pagina, 'Livro longo.epub');
    await pagina.waitForFunction((texto) => document.querySelector('#leitor .lt-posicao').textContent.startsWith(texto), `pos. ${posicao} de ${total}`, { timeout: 15000 });
    await pausa(pagina);
    assert.equal(await pagina.evaluate(() => window.__gravadas), 0, 'as posições guardadas foram aproveitadas');
    // Posições guardadas estragadas são calculadas de novo.
    await pagina.click('#leitor [data-acao="fechar"]');
    await pagina.evaluate((id) => window.bibliotecaDaPrancheta.gravarLocais(id, '{isto não é uma lista'), livro);
    await pagina.evaluate(() => { window.__gravadas = 0; });
    await abrirLivro(pagina, 'Livro longo.epub');
    await pagina.waitForFunction((texto) => document.querySelector('#leitor .lt-posicao').textContent.startsWith(texto), `pos. ${posicao} de ${total}`, { timeout: 15000 });
    assert.equal(await pagina.evaluate(() => window.__gravadas), 1);

    // Com as páginas marcadas pelo livro: a página em que a página à vista começa, e a última do livro.
    await abrirLivro(pagina, 'Paginado.epub');
    await noCapitulo(pagina, /primeiro capítulo/);
    await pagina.waitForFunction(() => /^p\. 1 de 5 · 0%$/.test(document.querySelector('#leitor .lt-posicao').textContent), null, { timeout: 15000 });
    // No segundo capítulo, que não tem marca, continua a página 1; o terceiro começa na 2.
    await pagina.click('#leitor [data-acao="proxima"]');
    await noCapitulo(pagina, /segundo capítulo/);
    // O rótulo é conferido já com o capítulo novo, e não o que sobrou do anterior.
    await pagina.waitForFunction(() => {
      const vista = window.leitorDaPrancheta.vista;
      return vista.capitulo === 'Capítulo dois' && /^p\. 1 de 5 · \d+%$/.test(vista.rotulo)
        && document.querySelector('#leitor .lt-posicao').textContent === vista.rotulo;
    }, null, { timeout: 15000 });
    await pagina.click('#leitor [data-acao="proxima"]');
    await noCapitulo(pagina, /Parágrafo 1 do capítulo longo/);
    await pagina.waitForFunction(() => /^p\. 2 de 5 · /.test(document.querySelector('#leitor .lt-posicao').textContent));
    // A marca da página 4 está no parágrafo 40: a página que começa nele é a 4; a anterior ainda é a 3.
    await pagina.evaluate(async () => {
      const vista = window.leitorDaPrancheta.vista;
      const secao = vista.livro.spine.spineItems[2];
      const doc = await vista.livro.load(secao.url);
      await vista.irPara(secao.cfiFromElement(doc.querySelector('#l40')));
    });
    await pagina.waitForFunction(() => /^p\. [34] de 5 · /.test(document.querySelector('#leitor .lt-posicao').textContent));
    const comeca = await pagina.evaluate(() => /\[l(\d+)\]/.exec(window.leitorDaPrancheta.posicaoAtual().cfi)[1]);
    assert.equal(await rotulo().then((r) => r.slice(0, 9)), Number(comeca) >= 40 ? 'p. 4 de 5' : 'p. 3 de 5', `a página começa no parágrafo ${comeca}`);
    await irAo('l75');
    await pagina.waitForFunction(() => /^p\. 5 de 5 · /.test(document.querySelector('#leitor .lt-posicao').textContent));
    await pagina.click('#leitor [data-acao="ao-quadro"]');
    assert.match(await pagina.evaluate(() => [...S.items.values()].filter((i) => i.type === 'card').map((i) => i.blocks.map((b) => b.h).join(' ')).at(-1)), /Capítulo longo, p\. 5 ·/);
    assert.deepEqual(erros, []);
  } finally {
    await contexto.close();
  }
});

test('no PDF, tocar no terço direito avança e no esquerdo volta; o meio, um destaque e o fim de uma seleção não viram a página', async () => {
  const { contexto, pagina, erros } = await abrirPrancheta();
  try {
    await abrirLivro(pagina, 'Marcado.pdf');
    await naPagina(pagina, 'p. 1 de 2');
    await pagina.mouse.click(...await pontoNoLivro(pagina, 0.5));
    await pausa(pagina);
    assert.equal(await pagina.textContent('#leitor .lt-posicao'), 'p. 1 de 2');
    await pagina.mouse.click(...await pontoNoLivro(pagina, 0.9));
    await naPagina(pagina, 'p. 2 de 2');
    await pagina.mouse.click(...await pontoNoLivro(pagina, 0.1));
    await naPagina(pagina, 'p. 1 de 2');
    await pagina.mouse.click(...await pontoNoLivro(pagina, 0.9));
    await naPagina(pagina, 'p. 2 de 2');
    await pagina.waitForFunction(() => /Segunda/.test(document.querySelector('#leitor .textLayer')?.textContent || ''));

    // O fim de uma seleção, solto no terço esquerdo, não volta a página.
    const linha = await pagina.locator('#leitor .textLayer span').first().boundingBox();
    const meio = linha.y + linha.height / 2;
    assert.ok(await fracaoDe(pagina, linha.x + 12) < 1 / 3, 'o texto começa no terço esquerdo');
    await arrastar(pagina, [linha.x + linha.width * 0.6, meio], [linha.x + 12, meio]);
    await pagina.locator('#leitor .lt-selecao').waitFor();
    await pausa(pagina);
    assert.equal(await pagina.textContent('#leitor .lt-posicao'), 'p. 2 de 2');
    // O toque que desfaz a seleção, no terço esquerdo, também não volta a página.
    await pagina.mouse.click(...await pontoNoLivro(pagina, 0.1));
    await pausa(pagina);
    assert.equal(await pagina.textContent('#leitor .lt-posicao'), 'p. 2 de 2');
    assert.equal(await pagina.evaluate(() => document.getSelection().isCollapsed), true);

    // Um destaque no terço esquerdo abre na barra do leitor, sem voltar a página.
    await selecionarAPaginaDoPdf(pagina);
    await destacarSelecao(pagina);
    await pagina.locator('#leitor .textLayer span.lt-destacado').first().waitFor();
    await pagina.mouse.click(linha.x + 12, meio);
    await pagina.locator('#leitor .lt-marca').waitFor();
    await pausa(pagina);
    assert.equal(await pagina.textContent('#leitor .lt-posicao'), 'p. 2 de 2');
    // Sem seleção e fora do destaque, o terço esquerdo volta a página.
    await pagina.mouse.click(...await pontoNoLivro(pagina, 0.1));
    await naPagina(pagina, 'p. 1 de 2');
    assert.deepEqual(erros, []);
  } finally {
    await contexto.close();
  }
});

test('o sumário lista os capítulos do EPUB e os marcadores do PDF, leva ao item tocado e avisa quando o livro não tem sumário', async () => {
  const { contexto, pagina, erros } = await abrirPrancheta();
  const itens = () => pagina.evaluate(() => [...document.querySelectorAll('#leitor .lt-painel-lista button')].map((b) => [b.textContent, b.style.paddingLeft]));
  try {
    // EPUB: os capítulos, com o subitem recuado; o item tocado abre o capítulo, e o painel fecha.
    await abrirLivro(pagina, 'Livro rico.epub');
    await noCapitulo(pagina, /primeiro capítulo/);
    assert.equal(await pagina.isVisible('#leitor .lt-painel'), false);
    await pagina.click('#leitor [data-acao="sumario"]');
    await pagina.locator('#leitor .lt-painel').waitFor();
    assert.equal(await pagina.textContent('#leitor .lt-painel-titulo'), 'Sumário');
    assert.equal(await pagina.isVisible('#leitor .lt-busca'), false);
    assert.deepEqual(await itens(), [['Capítulo um', ''], ['Capítulo dois', ''], ['A frase', '26px']]);
    await pagina.locator('#leitor .lt-painel-lista button', { hasText: 'Capítulo dois' }).click();
    await noCapitulo(pagina, /segundo capítulo/);
    assert.equal(await pagina.isVisible('#leitor .lt-painel'), false);
    // Fechar fecha o painel sem sair do lugar.
    await pagina.click('#leitor [data-acao="sumario"]');
    await pagina.locator('#leitor .lt-painel').waitFor();
    await pagina.click('#leitor [data-acao="painel-fechar"]');
    assert.equal(await pagina.isVisible('#leitor .lt-painel'), false);
    assert.match(await textoDoEpub(pagina), /segundo capítulo/);

    // EPUB sem sumário: o aviso, sem itens.
    await abrirLivro(pagina, 'Sem sumario.epub');
    await noCapitulo(pagina, /primeiro capítulo/);
    await pagina.click('#leitor [data-acao="sumario"]');
    await pagina.locator('#leitor .lt-painel').waitFor();
    assert.equal(await pagina.textContent('#leitor .lt-painel-aviso'), 'Este livro não tem sumário.');
    assert.deepEqual(await itens(), []);

    // PDF: os marcadores levam à página; abrir outro livro fecha o painel do anterior.
    await abrirLivro(pagina, 'Marcado.pdf');
    await naPagina(pagina, 'p. 1 de 2');
    assert.equal(await pagina.isVisible('#leitor .lt-painel'), false);
    await pagina.click('#leitor [data-acao="sumario"]');
    await pagina.locator('#leitor .lt-painel').waitFor();
    assert.deepEqual(await itens(), [['Parte um', ''], ['Parte dois', '']]);
    await pagina.locator('#leitor .lt-painel-lista button', { hasText: 'Parte dois' }).click();
    await naPagina(pagina, 'p. 2 de 2');
    assert.equal(await pagina.isVisible('#leitor .lt-painel'), false);

    // PDF sem marcadores: o aviso.
    await abrirLivro(pagina, 'Documento.pdf');
    await naPagina(pagina, 'p. 1 de 2');
    await pagina.click('#leitor [data-acao="sumario"]');
    await pagina.locator('#leitor .lt-painel').waitFor();
    assert.equal(await pagina.textContent('#leitor .lt-painel-aviso'), 'Este livro não tem sumário.');
    assert.deepEqual(await itens(), []);
    assert.deepEqual(await pagina.evaluate(() => window.__violacoes), []);
    assert.deepEqual(erros, []);
  } finally {
    await contexto.close();
  }
});

test('a busca acha o termo no livro inteiro, sem distinguir maiúsculas nem acentos, lista as ocorrências e leva ao lugar, com o termo marcado', async () => {
  const { contexto, pagina, erros } = await abrirPrancheta();
  const achados = () => pagina.evaluate(() => [...document.querySelectorAll('#leitor .lt-painel-lista button')].map((b) => [b.querySelector('span').textContent, b.querySelector('b').textContent, b.querySelector('small').textContent]));
  const procurar = async (termo, aviso) => {
    await pagina.fill('#leitor .lt-busca input', termo);
    await pagina.press('#leitor .lt-busca input', 'Enter');
    await pagina.waitForFunction((texto) => document.querySelector('#leitor .lt-painel-aviso').textContent === texto, aviso, { timeout: 15000 });
  };
  try {
    // EPUB: o termo sem acento acha o acentuado, nos dois capítulos, inclusive atravessando o itálico.
    await abrirLivro(pagina, 'Livro rico.epub');
    await noCapitulo(pagina, /primeiro capítulo/);
    await pagina.click('#leitor [data-acao="buscar"]');
    await pagina.locator('#leitor .lt-busca').waitFor();
    assert.equal(await pagina.textContent('#leitor .lt-painel-titulo'), 'Buscar no livro');
    assert.ok(await pagina.evaluate(() => document.activeElement === document.querySelector('#leitor .lt-busca input')), 'o campo da busca recebe o foco');
    await procurar('coracao', '2 ocorrências.');
    assert.deepEqual(await achados(), [
      ['…lo, que fala de cartas e de quadros. Um coração de papel e a AÇÃO do vento. Ver o fim', 'coração', 'Capítulo um'],
      ['…ue será destacada. Ir à frase No fim, o CORAÇÃO volta ao papel.', 'CORAÇÃO', 'Capítulo dois'],
    ]);
    // As setas no campo da busca escrevem, sem virar a página.
    await pagina.press('#leitor .lt-busca input', 'ArrowRight');
    await pausa(pagina);
    assert.match(await textoDoEpub(pagina), /primeiro capítulo/);
    // Tocar numa ocorrência leva ao capítulo dela e marca o termo.
    await pagina.locator('#leitor .lt-painel-lista button').nth(1).click();
    await noCapitulo(pagina, /segundo capítulo/);
    await pagina.waitForFunction(() => document.querySelectorAll('#leitor g.lt-achado').length === 1);
    assert.equal(await pagina.isVisible('#leitor .lt-painel'), false);
    assert.equal(await pagina.evaluate(async () => {
      const { vista } = window.leitorDaPrancheta;
      return (await vista.livro.getRange(vista._achado)).toString();
    }), 'CORAÇÃO');
    // A marca do termo fica sobre a palavra, na página.
    const marca = await retangulo(pagina, '#leitor g.lt-achado rect');
    const palavra = await pontoNoEpub(pagina, 'p5', 13);
    assert.ok(palavra[0] > marca.x && palavra[0] < marca.x + marca.width && palavra[1] > marca.y && palavra[1] < marca.y + marca.height, 'a marca cobre a palavra achada');
    // Reaberta, a busca traz a última consulta e os resultados; outra ocorrência troca a marca de lugar.
    await pagina.click('#leitor [data-acao="buscar"]');
    await pagina.locator('#leitor .lt-busca').waitFor();
    assert.equal(await pagina.inputValue('#leitor .lt-busca input'), 'coracao');
    assert.equal((await achados()).length, 2);
    await pagina.locator('#leitor .lt-painel-lista button').nth(0).click();
    await noCapitulo(pagina, /primeiro capítulo/);
    await pagina.waitForFunction(() => document.querySelectorAll('#leitor g.lt-achado').length === 1);
    assert.equal(await pagina.evaluate(async () => {
      const { vista } = window.leitorDaPrancheta;
      return (await vista.livro.getRange(vista._achado)).toString();
    }), 'coração');
    // Uma frase com maiúsculas e espaços a mais no livro, e um termo que não existe.
    await pagina.click('#leitor [data-acao="buscar"]');
    await procurar('ação do VENTO', '1 ocorrência.');
    assert.deepEqual(await achados(), [['…s e de quadros. Um coração de papel e a AÇÃO do vento. Ver o fim', 'AÇÃO do vento', 'Capítulo um']]);
    // Outra ocorrência no mesmo capítulo troca a marca de lugar, sem deixar a anterior.
    await pagina.locator('#leitor .lt-painel-lista button').nth(0).click();
    await pagina.waitForFunction(async () => {
      const { vista } = window.leitorDaPrancheta;
      return vista._achado && (await vista.livro.getRange(vista._achado)).toString().replace(/\s+/g, ' ') === 'AÇÃO do vento';
    });
    await pausa(pagina);
    assert.equal(await pagina.locator('#leitor g.lt-achado').count(), 1, 'só o último termo achado fica marcado');
    await pagina.click('#leitor [data-acao="buscar"]');
    await procurar('inexistente', 'Nada encontrado para “inexistente”.');
    assert.deepEqual(await achados(), []);

    // PDF: as duas páginas, com a página de cada ocorrência; a tocada abre com o trecho marcado.
    await abrirLivro(pagina, 'Marcado.pdf');
    await naPagina(pagina, 'p. 1 de 2');
    await pagina.click('#leitor [data-acao="buscar"]');
    await pagina.locator('#leitor .lt-busca').waitFor();
    assert.equal(await pagina.inputValue('#leitor .lt-busca input'), '', 'a busca de um livro não passa para o outro');
    await procurar('pagina', '2 ocorrências.');
    assert.deepEqual(await achados(), [['Primeira página do PDF', 'página', 'p. 1'], ['Segunda PÁGINA do PDF', 'PÁGINA', 'p. 2']]);
    await pagina.locator('#leitor .lt-painel-lista button').nth(1).click();
    await naPagina(pagina, 'p. 2 de 2');
    await pagina.locator('#leitor .textLayer mark.lt-achado').first().waitFor();
    assert.equal(await pagina.textContent('#leitor .textLayer mark.lt-achado'), 'PÁGINA', 'a marca cobre só o termo');
    assert.equal(await pagina.textContent('#leitor .textLayer'), 'Segunda PÁGINA do PDF', 'o texto da página continua o mesmo');
    // Com a marca do termo na página, selecionar e destacar continuam a contar as posições do mesmo jeito.
    await selecionarAPaginaDoPdf(pagina);
    await pagina.waitForFunction(() => window.leitorDaPrancheta.selecao?.texto === 'Segunda PÁGINA do PDF' && window.leitorDaPrancheta.selecao.posicao.pagina === 2);
    await destacarSelecao(pagina);
    await pagina.locator('#leitor .textLayer span.lt-destacado').first().waitFor();
    assert.equal(await pagina.textContent('#leitor .textLayer mark.lt-achado'), 'PÁGINA');
    assert.deepEqual(await pagina.evaluate(async () => {
      const [d] = await window.marcacoesDaPrancheta.destaques(window.leitorDaPrancheta.livro.id);
      return [d.trecho, d.posicao];
    }), ['Segunda PÁGINA do PDF', { pagina: 2, inicio: 0, fim: 21 }]);
    // A marca do termo acompanha a página do achado, e some das outras.
    await pagina.click('#leitor [data-acao="anterior"]');
    await naPagina(pagina, 'p. 1 de 2');
    await pagina.waitForFunction(() => /Primeira/.test(document.querySelector('#leitor .textLayer')?.textContent || ''));
    assert.equal(await pagina.locator('#leitor .textLayer mark.lt-achado').count(), 0);

    // Um termo que atravessa duas linhas do PDF é achado, e a marca cobre as duas partes.
    await abrirLivro(pagina, 'Linhas.pdf');
    await naPagina(pagina, 'p. 1 de 1');
    await pagina.click('#leitor [data-acao="buscar"]');
    await pagina.locator('#leitor .lt-busca').waitFor();
    await procurar('pdf CONTINUA', '1 ocorrência.');
    assert.deepEqual(await achados(), [['Uma linha do PDF continua na linha de baixo', 'PDF continua', 'p. 1']]);
    await pagina.locator('#leitor .lt-painel-lista button').nth(0).click();
    await pagina.locator('#leitor .textLayer mark.lt-achado').first().waitFor();
    assert.deepEqual(await pagina.locator('#leitor .textLayer mark.lt-achado').allTextContents(), ['PDF', 'continua']);
    assert.deepEqual(await pagina.evaluate(() => window.__violacoes), []);
    assert.deepEqual(erros, []);
  } finally {
    await contexto.close();
  }
});

test('na casca, o realce aparece invertido e o sublinhado em linha preta cheia, e o toque do dedo vira a página; no computador, o realce continua cinza', async () => {
  // O mesmo destaque do EPUB, visto no computador e na casca.
  const medirNoEpub = async (pagina) => {
    await abrirLivro(pagina, 'Livro rico.epub');
    await noCapitulo(pagina, /primeiro capítulo/);
    await selecionarNoEpub(pagina, 'p1', 9, 26);
    await destacarSelecao(pagina);
    await pagina.locator('#leitor g.lt-destaque rect').first().waitFor({ state: 'attached' });
    return tons(pagina, await retangulo(pagina, '#leitor g.lt-destaque rect'));
  };
  const medirNoPdf = async (pagina) => {
    await abrirLivro(pagina, 'Documento.pdf');
    await naPagina(pagina, 'p. 1 de 2');
    await pagina.waitForFunction(() => /Primeira/.test(document.querySelector('#leitor .textLayer')?.textContent || ''));
    await selecionarAPaginaDoPdf(pagina);
    await destacarSelecao(pagina);
    await pagina.locator('#leitor .textLayer span.lt-destacado').first().waitFor();
    return tons(pagina, await retangulo(pagina, '#leitor .textLayer span.lt-destacado'));
  };

  const computador = await abrirPrancheta();
  try {
    assert.equal(await computador.pagina.evaluate(() => document.documentElement.classList.contains('casca')), false);
    for (const medir of [medirNoEpub, medirNoPdf]) {
      const realce = await medir(computador.pagina);
      assert.ok(realce.claros > 0.6 && realce.escuros < 0.3, `no computador, o realce é um fundo claro com o texto escuro: ${JSON.stringify(realce)}`);
    }
    assert.deepEqual(computador.erros, []);
  } finally {
    await computador.contexto.close();
  }

  const casca = await abrirPrancheta({ naCasca: true });
  const { pagina } = casca;
  try {
    assert.equal(await pagina.evaluate(() => document.documentElement.classList.contains('casca')), true);
    // EPUB: o realce invertido, com o fundo escuro e o texto claro.
    const realce = await medirNoEpub(pagina);
    assert.ok(realce.escuros > 0.6 && realce.claros > 0.03, `na casca, o realce do EPUB tem o fundo escuro e o texto claro: ${JSON.stringify(realce)}`);
    // Sublinhado: uma linha preta cheia sob o trecho.
    await pagina.mouse.click(...await pontoNoEpub(pagina, 'p1', 15));
    await pagina.locator('#leitor .lt-marca').waitFor();
    await pagina.click('#leitor [data-acao="marca-estilo"]');
    await pagina.locator('#leitor g.lt-sublinhado line').first().waitFor({ state: 'attached' });
    const linha = await pagina.evaluate(() => {
      const r = document.querySelector('#leitor g.lt-sublinhado line').getBoundingClientRect();
      return { x: Math.ceil(r.left) + 2, y: Math.round(r.top + r.height / 2) - 1, width: Math.floor(r.width) - 4, height: 2 };
    });
    const sublinhado = await tons(pagina, linha);
    assert.ok(sublinhado.escuros > 0.9, `na casca, o sublinhado é uma linha preta cheia: ${JSON.stringify(sublinhado)}`);
    await pagina.click('#leitor [data-acao="marca-fechar"]');

    // A cada toque, a página diz à casca se ele começou na área do livro, para ela esconder ali o menu de seleção do Android.
    const ultimoToque = () => pagina.evaluate(() => window.__toquesNoLeitor.at(-1));
    await pagina.touchscreen.tap(...await pontoNoLivro(pagina, 0.5, 0.9));
    assert.equal(await ultimoToque(), true, 'toque na página do EPUB');
    const leitor = await pagina.locator('#leitor').boundingBox();
    await pagina.touchscreen.tap(leitor.x + leitor.width + 200, leitor.y + leitor.height / 2);
    assert.equal(await ultimoToque(), false, 'toque no quadro, fora do leitor');
    await pagina.touchscreen.tap(...await pontoNoLivro(pagina, 0.5, 0.9));
    assert.equal(await ultimoToque(), true);
    const titulo = await pagina.locator('#leitor .lt-titulo').boundingBox();
    await pagina.touchscreen.tap(titulo.x + 10, titulo.y + titulo.height / 2);
    assert.equal(await ultimoToque(), false, 'toque na barra do leitor, fora da área do livro');
    // O toque do dedo no terço direito avança, e no esquerdo volta.
    await pausa(pagina);
    await pagina.touchscreen.tap(...await pontoNoLivro(pagina, 0.9));
    await noCapitulo(pagina, /segundo capítulo/);
    await pagina.touchscreen.tap(...await pontoNoLivro(pagina, 0.1));
    await noCapitulo(pagina, /primeiro capítulo/);
    // Na volta ao capítulo, o destaque é redesenhado sobre o trecho, e não acima dele.
    await pagina.locator('#leitor g.lt-sublinhado').first().waitFor({ state: 'attached' });
    const trecho = await pontoNoEpub(pagina, 'p1', 12);
    await pagina.waitForFunction(([, y]) => {
      const r = document.querySelector('#leitor g.lt-sublinhado').getBoundingClientRect();
      return y > r.top && y < r.bottom;
    }, trecho, { timeout: 5000 });
    // O toque do dedo no destaque o abre, sem virar a página.
    await pagina.touchscreen.tap(...await pontoNoEpub(pagina, 'p1', 12));
    await pagina.locator('#leitor .lt-marca').waitFor();
    await pausa(pagina);
    assert.match(await textoDoEpub(pagina), /primeiro capítulo/);

    // O termo achado pela busca também aparece invertido.
    await pagina.evaluate(async () => {
      const [achado] = await window.leitorDaPrancheta.procurar('quadros');
      await window.leitorDaPrancheta.vista.mostrarAchado(achado.alvo);
    });
    await pagina.locator('#leitor g.lt-achado rect').first().waitFor({ state: 'attached' });
    const achado = await tons(pagina, await retangulo(pagina, '#leitor g.lt-achado rect'));
    assert.ok(achado.escuros > 0.6 && achado.claros > 0.03, `na casca, o termo achado tem o fundo escuro e o texto claro: ${JSON.stringify(achado)}`);

    // PDF: o realce invertido sobre a página, e o toque do dedo vira a página.
    const noPdf = await medirNoPdf(pagina);
    assert.ok(noPdf.escuros > 0.6 && noPdf.claros > 0.03, `na casca, o realce do PDF tem o fundo escuro e o texto claro: ${JSON.stringify(noPdf)}`);
    await pagina.touchscreen.tap(...await pontoNoLivro(pagina, 0.9));
    await naPagina(pagina, 'p. 2 de 2');
    assert.equal(await ultimoToque(), true, 'toque na página do PDF');
    await pagina.touchscreen.tap(...await pontoNoLivro(pagina, 0.1));
    await naPagina(pagina, 'p. 1 de 2');
    assert.deepEqual(casca.erros, []);
  } finally {
    await casca.contexto.close();
  }
});
