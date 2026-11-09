// Marcações dos livros, segunda parte da etapa 04 do plano 005: destaques que
// reaparecem e sincronizam, cifrados, entre dois aparelhos; cartões levados
// ao quadro com o trecho ou só a posição; e o link do cartão, que reabre o
// livro na posição, inclusive no outro aparelho. A página e o servidor ficam
// num só endereço, como na VPS.
// Executar a partir da raiz do repositório: node --test web/testes/*.test.cjs

'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { chromium } = require('playwright');
const { Armazem, chaveDoDocumento } = require('../../servidor/armazem.cjs');
const { criarServidor } = require('../../servidor/servidor.cjs');
const { criarServidorDaPagina } = require('../../servidor/pagina.cjs');
const { Biblioteca } = require('../../servidor/biblioteca.cjs');
const { criarEpub, criarPdf } = require('./apoio/livros.cjs');

globalThis.crypto ??= crypto.webcrypto;
require('../app/compat/cifra.js');

const CHAVE = 'chave-de-teste-das-marcacoes-0123456789abcdef';
const TELA = { width: 1200, height: 800 };
const APP = path.join(__dirname, '..', 'app');

let navegador;
before(async () => { navegador = await chromium.launch(); });
after(async () => { await navegador?.close(); });

async function subirComoNaVps() {
  const livros = fs.mkdtempSync(path.join(os.tmpdir(), 'prancheta-marcacoes-'));
  fs.writeFileSync(path.join(livros, 'Livro de teste.epub'), await criarEpub());
  fs.writeFileSync(path.join(livros, 'Documento.pdf'), criarPdf());
  const armazem = await Armazem.abrir(fs.mkdtempSync(path.join(os.tmpdir(), 'prancheta-vps-')));
  const sincronia = criarServidor({ armazem, chave: CHAVE, biblioteca: new Biblioteca(livros) }).listeners('request')[0];
  const pagina = criarServidorDaPagina({ pasta: APP }).listeners('request')[0];
  const borda = http.createServer((req, res) => (req.url.startsWith('/sync/') ? sincronia : pagina)(req, res));
  await new Promise((pronto) => borda.listen(0, '127.0.0.1', pronto));
  return {
    base: `http://127.0.0.1:${borda.address().port}`,
    armazem,
    fechar: () => new Promise((pronto) => { borda.close(() => pronto()); borda.closeAllConnections(); }),
  };
}

async function abrirPrancheta(contexto, base, chaveDaCifra) {
  const pagina = await contexto.newPage();
  const erros = [];
  pagina.on('pageerror', (e) => erros.push(e.message));
  await pagina.addInitScript(() => {
    window.__violacoes = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__violacoes.push(`${e.violatedDirective} ${e.blockedURI}`));
    window.opcoesDaSincronizacao = { intervalo: 1000, esperaDepoisDeGravar: 300 };
  });
  await pagina.goto(`${base}/`);
  await pagina.waitForFunction(() => window.__booted === true && navigator.serviceWorker.controller !== null, null, { timeout: 10000 });
  await pagina.waitForFunction(() => Boolean(window.marcacoesDaPrancheta && document.getElementById('leitor')), null, { timeout: 10000 });
  await pagina.evaluate(async ([endereco, chave, cifra]) => {
    if (cifra) await window.sincronizacaoDaPrancheta.usarChaveDaCifra(cifra);
    await window.sincronizacaoDaPrancheta.configurar({ endereco, chave });
  }, [base, CHAVE, chaveDaCifra]);
  await pagina.locator('#biblioteca .bib-livro').nth(1).waitFor();
  return { pagina, erros };
}

const aguardarSincronizado = (pagina) => pagina.waitForFunction(async () => {
  const s = window.sincronizacaoDaPrancheta;
  if (s.estado.situacao !== 'sincronizada') return false;
  return (await (await claude.use('db')).mudancas()).length === 0;
}, null, { timeout: 20000, polling: 300 });

// Seleciona, no capítulo aberto do EPUB, os caracteres [de, ate) do parágrafo dado.
const selecionarNoEpub = (pagina, id, de, ate) => pagina.evaluate(([alvo, inicio, fim]) => {
  const doc = document.querySelector('#leitor iframe').contentDocument;
  const texto = doc.getElementById(alvo).firstChild;
  const intervalo = doc.createRange();
  intervalo.setStart(texto, inicio);
  intervalo.setEnd(texto, fim);
  doc.getSelection().removeAllRanges();
  doc.getSelection().addRange(intervalo);
}, [id, de, ate]);

// Os cartões do quadro aberto, com o texto e os endereços dos links.
const cartoes = (pagina) => pagina.evaluate(() => [...S.items.values()].filter((i) => i.type === 'card')
  .map((i) => ({ id: i.id, texto: i.blocks.map((b) => b.h).join('\n') })));

test('o destaque e a posição vão ao quadro, e o link reabre o livro, também no outro aparelho, com os destaques cifrados', async () => {
  const vps = await subirComoNaVps();
  const chaveDaCifra = globalThis.CifraPrancheta.gerarChave();
  const contextoA = await navegador.newContext({ viewport: TELA });
  const contextoB = await navegador.newContext({ viewport: TELA });
  try {
    const a = await abrirPrancheta(contextoA, vps.base, chaveDaCifra);
    await a.pagina.locator('#biblioteca .bib-livro', { hasText: 'Livro de teste.epub' }).click();
    await a.pagina.waitForFunction(() => /primeiro capítulo/.test(document.querySelector('#leitor iframe')?.contentDocument?.body?.innerText || ''), null, { timeout: 15000 });
    await a.pagina.click('#leitor [data-acao="proxima"]');
    await a.pagina.waitForFunction(() => /segundo capítulo/.test(document.querySelector('#leitor iframe')?.contentDocument?.body?.innerText || ''), null, { timeout: 15000 });

    // Destacar: o trecho fica marcado no livro e guardado no banco dos quadros.
    await selecionarNoEpub(a.pagina, 'p2', 2, 19);
    await a.pagina.locator('#leitor .lt-selecao [data-acao="destacar"]').waitFor();
    await a.pagina.click('#leitor .lt-selecao [data-acao="destacar"]');
    await a.pagina.waitForFunction(() => document.querySelector('#leitor .lt-aviso').textContent === 'Trecho destacado.');
    await a.pagina.waitForFunction(() => document.querySelectorAll('#leitor g.lt-destaque').length === 1, null, { timeout: 5000 });
    const livro = await a.pagina.evaluate(() => window.leitorDaPrancheta.livro.id);
    const guardados = await a.pagina.evaluate((id) => window.marcacoesDaPrancheta.destaques(id), livro);
    assert.equal(guardados.length, 1);
    assert.equal(guardados[0].trecho, 'segundo capítulo');
    assert.match(guardados[0].posicao.cfi, /^epubcfi\(.*,/);
    assert.equal(guardados[0].rotulo.startsWith('Capítulo dois'), true);

    // Levar ao quadro: outro trecho, destacado e num cartão com o link de volta.
    await selecionarNoEpub(a.pagina, 'p2', 28, 33);
    await a.pagina.click('#leitor .lt-selecao [data-acao="levar"]');
    await a.pagina.waitForFunction(() => document.querySelector('#leitor .lt-aviso').textContent === 'Trecho destacado e levado ao quadro.');
    await a.pagina.waitForFunction(() => document.querySelectorAll('#leitor g.lt-destaque').length === 2);
    // A posição atual, sem destaque, também vira cartão.
    await a.pagina.click('#leitor [data-acao="ao-quadro"]');
    let noQuadro = await cartoes(a.pagina);
    assert.equal(noQuadro.length, 2);
    const doTrecho = noQuadro.find((c) => c.texto.includes('frase'));
    const daPosicao = noQuadro.find((c) => !c.texto.includes('frase'));
    assert.match(doTrecho.texto, /<i>Livro de teste\.epub<\/i>, Capítulo dois.* · \[abrir no livro\]\(https:\/\/prancheta\.invalid\/livro\/[0-9a-f]{32}\/[A-Za-z0-9_-]+\)/);
    assert.match(daPosicao.texto, /Livro de teste\.epub.*\[abrir no livro\]\(https:\/\/prancheta\.invalid\/livro\//);
    // O cartão fica na parte do quadro que aparece ao lado do leitor.
    const lugar = await a.pagina.evaluate((id) => {
      const r = document.querySelector(`[data-id="${id}"]`).getBoundingClientRect();
      return { esquerda: r.left, direita: r.right, painel: document.getElementById('side').getBoundingClientRect().right };
    }, doTrecho.id);
    assert.ok(lugar.direita <= 600 && lugar.esquerda >= lugar.painel, `o cartão fica entre o painel dos quadros e o leitor: ${JSON.stringify(lugar)}`);

    // O link do cartão reabre o livro no trecho, mesmo depois de fechado e
    // de outra posição, sem abrir uma aba nova.
    await a.pagina.click('#leitor [data-acao="anterior"]');
    await a.pagina.waitForFunction(() => /primeiro capítulo/.test(document.querySelector('#leitor iframe')?.contentDocument?.body?.innerText || ''));
    await a.pagina.click('#leitor [data-acao="fechar"]');
    const abas = contextoA.pages().length;
    const link = a.pagina.locator(`[data-id="${doTrecho.id}"] a.lk[href^="https://prancheta.invalid/livro/"]`);
    await link.click();
    await a.pagina.waitForFunction(() => /segundo capítulo/.test(document.querySelector('#leitor iframe')?.contentDocument?.body?.innerText || ''), null, { timeout: 15000 });
    assert.equal(contextoA.pages().length, abas);
    await aguardarSincronizado(a.pagina);

    // No servidor, os destaques estão cifrados como os quadros.
    const noServidor = await vps.armazem.lerDocumento(`marcacoes/${livro}`);
    assert.ok(chaveDoDocumento(noServidor.registro.dados), 'os destaques sobem cifrados');
    assert.ok(!JSON.stringify(noServidor).includes('segundo capítulo'));

    // O outro aparelho recebe o cartão, e o link baixa e abre o livro no trecho, com os dois destaques.
    const b = await abrirPrancheta(contextoB, vps.base, chaveDaCifra);
    await b.pagina.locator(`[data-id="${doTrecho.id}"] a.lk[href^="https://prancheta.invalid/livro/"]`).waitFor({ timeout: 20000 });
    await b.pagina.locator(`[data-id="${doTrecho.id}"] a.lk[href^="https://prancheta.invalid/livro/"]`).click();
    await b.pagina.waitForFunction(() => /segundo capítulo/.test(document.querySelector('#leitor iframe')?.contentDocument?.body?.innerText || ''), null, { timeout: 20000 });
    await b.pagina.waitForFunction(() => document.querySelectorAll('#leitor g.lt-destaque').length === 2, null, { timeout: 10000 });

    // Um destaque feito no outro aparelho chega ao primeiro, com o livro aberto.
    await selecionarNoEpub(b.pagina, 'p2', 43, 52);
    await b.pagina.click('#leitor .lt-selecao [data-acao="destacar"]');
    await b.pagina.waitForFunction(() => document.querySelectorAll('#leitor g.lt-destaque').length === 3);
    await a.pagina.waitForFunction(() => document.querySelectorAll('#leitor g.lt-destaque').length === 3, null, { timeout: 20000 });
    assert.equal((await a.pagina.evaluate((id) => window.marcacoesDaPrancheta.destaques(id), livro)).length, 3);
    noQuadro = await cartoes(b.pagina);
    assert.equal(noQuadro.length, 2);
    for (const { pagina } of [a, b]) assert.deepEqual(await pagina.evaluate(() => window.__violacoes), []);
    assert.deepEqual([...a.erros, ...b.erros], []);
  } finally {
    await contextoA.close();
    await contextoB.close();
    await vps.fechar();
  }
});

test('no PDF, o destaque sombreia o trecho na página, reaparece ao reabrir, e o link volta à página', async () => {
  const vps = await subirComoNaVps();
  const contexto = await navegador.newContext({ viewport: TELA });
  try {
    const { pagina, erros } = await abrirPrancheta(contexto, vps.base);
    await pagina.locator('#biblioteca .bib-livro', { hasText: 'Documento.pdf' }).click();
    await pagina.waitForFunction(() => /Primeira pagina/.test(document.querySelector('#leitor .textLayer')?.textContent || ''), null, { timeout: 15000 });
    await pagina.click('#leitor [data-acao="proxima"]');
    await pagina.waitForFunction(() => /Segunda pagina/.test(document.querySelector('#leitor .textLayer')?.textContent || ''), null, { timeout: 15000 });
    await pagina.evaluate(() => {
      const camada = document.querySelector('#leitor .textLayer');
      const intervalo = document.createRange();
      intervalo.selectNodeContents(camada);
      document.getSelection().removeAllRanges();
      document.getSelection().addRange(intervalo);
    });
    await pagina.locator('#leitor .lt-selecao [data-acao="levar"]').waitFor();
    await pagina.click('#leitor .lt-selecao [data-acao="levar"]');
    await pagina.waitForFunction(() => document.querySelectorAll('#leitor .textLayer span.lt-destacado').length > 0);
    const [cartao] = await cartoes(pagina);
    assert.match(cartao.texto, /Segunda pagina do PDF/);
    assert.match(cartao.texto, /<i>Documento\.pdf<\/i>, p\. 2 · \[abrir no livro\]/);
    const livro = await pagina.evaluate(() => window.leitorDaPrancheta.livro.id);
    const [destaque] = await pagina.evaluate((id) => window.marcacoesDaPrancheta.destaques(id), livro);
    assert.deepEqual({ pagina: destaque.posicao.pagina, inicio: destaque.posicao.inicio, fim: destaque.posicao.fim }, { pagina: 2, inicio: 0, fim: 'Segunda pagina do PDF'.length });

    // Na outra página não há destaque; de volta à segunda, ele reaparece.
    await pagina.click('#leitor [data-acao="anterior"]');
    await pagina.waitForFunction(() => document.querySelector('#leitor .lt-posicao').textContent === 'p. 1 de 2');
    assert.equal(await pagina.evaluate(() => document.querySelectorAll('#leitor .textLayer span.lt-destacado').length), 0);
    await pagina.click('#leitor [data-acao="proxima"]');
    await pagina.waitForFunction(() => document.querySelector('#leitor .lt-posicao').textContent === 'p. 2 de 2');
    await pagina.waitForFunction(() => document.querySelectorAll('#leitor .textLayer span.lt-destacado').length > 0, null, { timeout: 5000 });
    await pagina.click('#leitor [data-acao="fechar"]');
    await pagina.locator(`[data-id="${cartao.id}"] a.lk[href^="https://prancheta.invalid/livro/"]`).click();
    await pagina.waitForFunction(() => document.querySelector('#leitor .lt-posicao')?.textContent === 'p. 2 de 2', null, { timeout: 15000 });
    await pagina.waitForFunction(() => document.querySelectorAll('#leitor .textLayer span.lt-destacado').length > 0, null, { timeout: 5000 });
    assert.deepEqual(await pagina.evaluate(() => window.__violacoes), []);
    assert.deepEqual(erros, []);
  } finally {
    await contexto.close();
    await vps.fechar();
  }
});

test('um endereço de link de volta malformado não abre nada', async () => {
  require('../app/compat/marcacoes.js');
  const { enderecoDe, lerEndereco } = globalThis.MarcacoesPrancheta;
  const livro = 'a'.repeat(32);
  const ida = enderecoDe(livro, { cfi: 'epubcfi(/6/4!/4/2,/1:2,/1:19)' });
  assert.deepEqual(lerEndereco(ida), { livro, posicao: { cfi: 'epubcfi(/6/4!/4/2,/1:2,/1:19)' } });
  assert.deepEqual(lerEndereco(enderecoDe(livro, { pagina: 3, inicio: 0, fim: 10 })), { livro, posicao: { pagina: 3, inicio: 0, fim: 10 } });
  for (const ruim of [
    'https://prancheta.invalid/livro/naoehexa/eyJwYWdpbmEiOjF9',
    `https://prancheta.invalid/livro/${livro}/!!!`,
    `https://prancheta.invalid/livro/${livro}/${Buffer.from('{"cfi":"javascript:alert(1)"}').toString('base64url')}`,
    `https://prancheta.invalid/livro/${livro}/${Buffer.from('[1,2]').toString('base64url')}`,
    'https://exemplo.com/livro/x/y',
  ]) assert.equal(lerEndereco(ruim), null, ruim);
});
