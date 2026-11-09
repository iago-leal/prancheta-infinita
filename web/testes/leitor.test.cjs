// Leitor de livros, etapa 04 do plano 005: EPUB e PDF abertos da biblioteca,
// ao lado do quadro e em tela inteira, com as páginas viradas, a última
// posição lembrada, o trecho selecionado mostrado e o uso sem rede. A página e
// o servidor ficam num só endereço, como na VPS.
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

const CHAVE = 'chave-de-teste-do-leitor-0123456789abcdef';
const TELA = { width: 1200, height: 800 };
const APP = path.join(__dirname, '..', 'app');

let navegador;
before(async () => { navegador = await chromium.launch(); });
after(async () => { await navegador?.close(); });

async function subirComoNaVps() {
  const livros = fs.mkdtempSync(path.join(os.tmpdir(), 'prancheta-leitor-'));
  fs.writeFileSync(path.join(livros, 'Livro de teste.epub'), await criarEpub());
  fs.writeFileSync(path.join(livros, 'Documento.pdf'), criarPdf());
  const armazem = await Armazem.abrir(fs.mkdtempSync(path.join(os.tmpdir(), 'prancheta-vps-')));
  const sincronia = criarServidor({ armazem, chave: CHAVE, biblioteca: new Biblioteca(livros) }).listeners('request')[0];
  const pagina = criarServidorDaPagina({ pasta: APP }).listeners('request')[0];
  const borda = http.createServer((req, res) => (req.url.startsWith('/sync/') ? sincronia : pagina)(req, res));
  await new Promise((pronto) => borda.listen(0, '127.0.0.1', pronto));
  return {
    base: `http://127.0.0.1:${borda.address().port}`,
    fechar: () => new Promise((pronto) => { borda.close(() => pronto()); borda.closeAllConnections(); }),
  };
}

async function abrirPrancheta(contexto, base) {
  const pagina = await contexto.newPage();
  const erros = [];
  pagina.on('pageerror', (e) => erros.push(e.message));
  await pagina.addInitScript(() => {
    window.__violacoes = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__violacoes.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  await pagina.goto(`${base}/`);
  await pagina.waitForFunction(() => window.__booted === true && navigator.serviceWorker.controller !== null, null, { timeout: 10000 });
  await pagina.waitForFunction(() => Boolean(window.leitorDaPrancheta && document.getElementById('leitor')), null, { timeout: 10000 });
  await pagina.evaluate(([endereco, chave]) => window.sincronizacaoDaPrancheta.configurar({ endereco, chave }), [base, CHAVE]);
  await pagina.locator('#biblioteca .bib-livro').nth(1).waitFor();
  return { pagina, erros };
}

// O texto visível no iframe do EPUB.
const textoDoEpub = (pagina) => pagina.evaluate(() => {
  const quadro = document.querySelector('#leitor iframe');
  return quadro && quadro.contentDocument ? quadro.contentDocument.body.innerText : '';
});

test('o EPUB abre ao lado do quadro, vira as páginas, lembra a posição e passa à tela inteira', async () => {
  const vps = await subirComoNaVps();
  const contexto = await navegador.newContext({ viewport: TELA });
  try {
    const { pagina, erros } = await abrirPrancheta(contexto, vps.base);
    await pagina.locator('#biblioteca .bib-livro', { hasText: 'Livro de teste.epub' }).click();
    await pagina.waitForFunction(() => !document.getElementById('leitor').hidden);
    await pagina.waitForFunction(() => /primeiro capítulo/.test(document.querySelector('#leitor iframe')?.contentDocument?.body?.innerText || ''), null, { timeout: 15000 });
    assert.equal(await pagina.textContent('#leitor .lt-titulo'), 'Livro de teste.epub');
    // Lado a lado: o leitor ocupa a direita, e os controles do quadro passam para a esquerda dele.
    const disposicao = await pagina.evaluate(() => {
      const leitor = document.getElementById('leitor').getBoundingClientRect();
      const topo = document.getElementById('top').getBoundingClientRect();
      return { lado: document.body.classList.contains('leitor-lado'), esquerda: leitor.left, largura: leitor.width, topoDireita: topo.right };
    });
    assert.equal(disposicao.lado, true);
    assert.equal(Math.round(disposicao.largura), 600);
    assert.ok(disposicao.topoDireita <= disposicao.esquerda, 'os controles do quadro ficam fora do leitor');
    // O script do livro nunca roda.
    assert.equal(await pagina.evaluate(() => window.__scriptDoLivro), undefined);
    assert.equal(await pagina.evaluate(() => document.querySelector('#leitor iframe').contentWindow.__scriptDoLivro), undefined);

    // A próxima página leva ao segundo capítulo.
    await pagina.click('#leitor [data-acao="proxima"]');
    await pagina.waitForFunction(() => /segundo capítulo/.test(document.querySelector('#leitor iframe')?.contentDocument?.body?.innerText || ''), null, { timeout: 15000 });
    const posicao = await pagina.evaluate(() => window.leitorDaPrancheta.posicaoAtual());
    assert.match(posicao.cfi, /^epubcfi\(/);

    // Um trecho selecionado aparece na barra do leitor.
    await pagina.evaluate(() => {
      const doc = document.querySelector('#leitor iframe').contentDocument;
      const texto = doc.getElementById('p2').firstChild;
      const intervalo = doc.createRange();
      intervalo.setStart(texto, 2);
      intervalo.setEnd(texto, 19);
      const selecao = doc.getSelection();
      selecao.removeAllRanges();
      selecao.addRange(intervalo);
    });
    await pagina.waitForFunction(() => /Selecionado: “segundo capítulo”/.test(document.querySelector('#leitor .lt-trecho').textContent), null, { timeout: 5000 });
    const selecao = await pagina.evaluate(() => window.leitorDaPrancheta.selecao);
    assert.equal(selecao.texto, 'segundo capítulo');
    assert.match(selecao.posicao.cfi, /^epubcfi\(.*,/);

    // Tela inteira e de volta.
    await pagina.click('#leitor [data-acao="modo"]');
    assert.equal(await pagina.evaluate(() => document.body.classList.contains('leitor-tela')), true);
    assert.equal(Math.round(await pagina.evaluate(() => document.getElementById('leitor').getBoundingClientRect().width)), 1200);
    assert.equal(await pagina.textContent('#leitor [data-acao="modo"]'), 'Lado a lado');
    await pagina.click('#leitor [data-acao="modo"]');
    assert.equal(await pagina.evaluate(() => document.body.classList.contains('leitor-lado')), true);

    // Fechado e reaberto, o livro volta à última posição.
    await pagina.click('#leitor [data-acao="fechar"]');
    assert.equal(await pagina.evaluate(() => document.getElementById('leitor').hidden), true);
    assert.equal(await pagina.evaluate(() => document.body.classList.contains('leitor-lado')), false);
    await pagina.locator('#biblioteca .bib-livro', { hasText: 'Livro de teste.epub' }).click();
    await pagina.waitForFunction(() => /segundo capítulo/.test(document.querySelector('#leitor iframe')?.contentDocument?.body?.innerText || ''), null, { timeout: 15000 });
    assert.ok(!(await textoDoEpub(pagina)).includes('primeiro capítulo'));
    assert.deepEqual(await pagina.evaluate(() => window.__violacoes), []);
    assert.deepEqual(erros, []);
  } finally {
    await contexto.close();
    await vps.fechar();
  }
});

test('o PDF abre página a página, com o texto selecionável e a página no trecho selecionado', async () => {
  const vps = await subirComoNaVps();
  const contexto = await navegador.newContext({ viewport: TELA });
  try {
    const { pagina, erros } = await abrirPrancheta(contexto, vps.base);
    await pagina.locator('#biblioteca .bib-livro', { hasText: 'Documento.pdf' }).click();
    await pagina.waitForFunction(() => /Primeira pagina/.test(document.querySelector('#leitor .textLayer')?.textContent || ''), null, { timeout: 15000 });
    assert.equal(await pagina.textContent('#leitor .lt-posicao'), 'p. 1 de 2');
    assert.ok(await pagina.evaluate(() => document.querySelector('#leitor canvas').width > 0));
    await pagina.click('#leitor [data-acao="proxima"]');
    await pagina.waitForFunction(() => /Segunda pagina/.test(document.querySelector('#leitor .textLayer')?.textContent || ''), null, { timeout: 15000 });
    assert.equal(await pagina.textContent('#leitor .lt-posicao'), 'p. 2 de 2');
    assert.deepEqual(await pagina.evaluate(() => window.leitorDaPrancheta.posicaoAtual()).then((p) => ({ tipo: p.tipo, pagina: p.pagina })), { tipo: 'application/pdf', pagina: 2 });

    await pagina.evaluate(() => {
      const camada = document.querySelector('#leitor .textLayer');
      const intervalo = document.createRange();
      intervalo.selectNodeContents(camada);
      const selecao = document.getSelection();
      selecao.removeAllRanges();
      selecao.addRange(intervalo);
    });
    await pagina.waitForFunction(() => /Selecionado: “Segunda pagina do PDF” \(p\. 2\)/.test(document.querySelector('#leitor .lt-trecho').textContent), null, { timeout: 5000 });

    // A página anterior volta, e a última página lida é lembrada.
    await pagina.click('#leitor [data-acao="anterior"]');
    await pagina.waitForFunction(() => document.querySelector('#leitor .lt-posicao').textContent === 'p. 1 de 2');
    await pagina.click('#leitor [data-acao="proxima"]');
    await pagina.waitForFunction(() => document.querySelector('#leitor .lt-posicao').textContent === 'p. 2 de 2');
    await pagina.click('#leitor [data-acao="fechar"]');
    await pagina.locator('#biblioteca .bib-livro', { hasText: 'Documento.pdf' }).click();
    await pagina.waitForFunction(() => document.querySelector('#leitor .lt-posicao')?.textContent === 'p. 2 de 2', null, { timeout: 15000 });
    assert.deepEqual(await pagina.evaluate(() => window.__violacoes), []);
    assert.deepEqual(erros, []);
  } finally {
    await contexto.close();
    await vps.fechar();
  }
});

test('sem rede, um livro guardado abre do aparelho; em tela estreita, o leitor ocupa a tela inteira', async () => {
  const vps = await subirComoNaVps();
  const contexto = await navegador.newContext({ viewport: TELA });
  try {
    const { pagina, erros } = await abrirPrancheta(contexto, vps.base);
    await pagina.locator('#biblioteca .bib-livro', { hasText: 'Livro de teste.epub' }).click();
    await pagina.waitForFunction(() => /primeiro capítulo/.test(document.querySelector('#leitor iframe')?.contentDocument?.body?.innerText || ''), null, { timeout: 15000 });
    await pagina.click('#leitor [data-acao="fechar"]');

    await contexto.setOffline(true);
    await pagina.setViewportSize({ width: 500, height: 800 });
    await pagina.reload();
    await pagina.waitForFunction(() => window.__booted === true && Boolean(window.leitorDaPrancheta), null, { timeout: 10000 });
    await pagina.evaluate(() => window.bibliotecaDaPrancheta.atualizar());
    await pagina.evaluate(async () => {
      const b = window.bibliotecaDaPrancheta;
      await window.leitorDaPrancheta.abrir(b.estado.lista.find((l) => l.nome === 'Livro de teste.epub').id);
    });
    await pagina.waitForFunction(() => /primeiro capítulo/.test(document.querySelector('#leitor iframe')?.contentDocument?.body?.innerText || ''), null, { timeout: 15000 });
    const estreita = await pagina.evaluate(() => ({
      tela: document.body.classList.contains('leitor-tela'),
      largura: Math.round(document.getElementById('leitor').getBoundingClientRect().width),
      botao: document.querySelector('#leitor [data-acao="modo"]').hidden,
    }));
    assert.deepEqual(estreita, { tela: true, largura: 500, botao: true });
    // Um livro que nunca foi guardado não abre sem rede.
    const pdf = await pagina.evaluate(async () => {
      const b = window.bibliotecaDaPrancheta;
      return window.leitorDaPrancheta.abrir(b.estado.lista.find((l) => l.nome === 'Documento.pdf').id).then(() => 'abriu', (e) => e.code);
    });
    assert.equal(pdf, 'sem_rede');
    assert.deepEqual(erros, []);
  } finally {
    await contexto.close();
    await vps.fechar();
  }
});
