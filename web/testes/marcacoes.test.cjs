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
// O meio, na tela, dos caracteres [de, ate) de um parágrafo do EPUB aberto.
const meioNoEpub = (pagina, id, de, ate) => pagina.evaluate(([alvo, inicio, fim]) => {
  const quadro = document.querySelector('#leitor iframe');
  const doc = quadro.contentDocument;
  const intervalo = doc.createRange();
  intervalo.setStart(doc.getElementById(alvo).firstChild, inicio);
  intervalo.setEnd(doc.getElementById(alvo).firstChild, fim);
  const r = intervalo.getBoundingClientRect();
  const q = quadro.getBoundingClientRect();
  return [q.left + r.left + r.width / 2, q.top + r.top + r.height / 2];
}, [id, de, ate]);

const marcasNoEpub = (pagina) => pagina.evaluate(() => ({
  realces: document.querySelectorAll('#leitor g.lt-destaque').length,
  sublinhados: document.querySelectorAll('#leitor g.lt-sublinhado').length,
}));

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
      return { esquerda: r.left, direita: r.right, leitor: document.getElementById('leitor').getBoundingClientRect().right };
    }, doTrecho.id);
    assert.ok(lugar.esquerda >= lugar.leitor && lugar.direita <= 1200, `o cartão fica na parte do quadro à direita do leitor: ${JSON.stringify(lugar)}`);

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

test('tocar num destaque do EPUB abre apagar, estilo e nota, e as mudanças chegam ao outro aparelho', async () => {
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
    for (const [de, ate] of [[2, 18], [43, 52]]) {
      await selecionarNoEpub(a.pagina, 'p2', de, ate);
      await a.pagina.locator('#leitor .lt-selecao [data-acao="destacar"]').waitFor();
      await a.pagina.click('#leitor .lt-selecao [data-acao="destacar"]');
      await a.pagina.waitForFunction(() => document.querySelector('#leitor .lt-selecao').hidden);
    }
    await a.pagina.waitForFunction(() => document.querySelectorAll('#leitor g.lt-destaque').length === 2);
    const livro = await a.pagina.evaluate(() => window.leitorDaPrancheta.livro.id);

    // Tocar no primeiro destaque o abre na barra do leitor.
    assert.equal(await a.pagina.isVisible('#leitor .lt-marca'), false);
    await a.pagina.mouse.click(...await meioNoEpub(a.pagina, 'p2', 2, 18));
    await a.pagina.locator('#leitor .lt-marca').waitFor();
    assert.equal(await a.pagina.textContent('#leitor .lt-marca-trecho'), 'Destaque: “segundo capítulo”');
    assert.equal(await a.pagina.textContent('#leitor [data-acao="marca-estilo"]'), 'Sublinhar');
    // Tocar fora dos destaques não abre nada, e Fechar fecha a barra.
    await a.pagina.click('#leitor [data-acao="marca-fechar"]');
    assert.equal(await a.pagina.isVisible('#leitor .lt-marca'), false);
    await a.pagina.mouse.click(...await meioNoEpub(a.pagina, 'p2', 22, 26));
    await a.pagina.waitForTimeout(300);
    assert.equal(await a.pagina.isVisible('#leitor .lt-marca'), false);

    // Estilo: de realce para sublinhado, e o botão passa a oferecer a volta.
    await a.pagina.mouse.click(...await meioNoEpub(a.pagina, 'p2', 2, 18));
    await a.pagina.locator('#leitor .lt-marca').waitFor();
    await a.pagina.click('#leitor [data-acao="marca-estilo"]');
    await a.pagina.waitForFunction(() => document.querySelectorAll('#leitor g.lt-sublinhado').length === 1);
    assert.deepEqual(await marcasNoEpub(a.pagina), { realces: 1, sublinhados: 1 });
    assert.equal(await a.pagina.textContent('#leitor [data-acao="marca-estilo"]'), 'Realçar');

    // Nota: guardada com Enter, vai para o cartão levado ao quadro.
    await a.pagina.fill('#leitor .lt-marca input[name="nota"]', 'Voltar a este ponto');
    await a.pagina.press('#leitor .lt-marca input[name="nota"]', 'Enter');
    await a.pagina.waitForFunction(() => document.querySelector('#leitor .lt-aviso').textContent === 'Nota guardada.');
    await a.pagina.click('#leitor [data-acao="marca-levar"]');
    const [cartao] = await cartoes(a.pagina);
    assert.match(cartao.texto, /segundo capítulo\nVoltar a este ponto\n<i>Livro de teste\.epub<\/i>.*\[abrir no livro\]/);

    // Apagar o segundo destaque: some do livro, fica marcado na lista, e o cartão continua.
    await a.pagina.mouse.click(...await meioNoEpub(a.pagina, 'p2', 43, 52));
    await a.pagina.waitForFunction(() => /destacada/.test(document.querySelector('#leitor .lt-marca-trecho').textContent));
    assert.equal(await a.pagina.inputValue('#leitor .lt-marca input[name="nota"]'), '');
    await a.pagina.click('#leitor [data-acao="marca-apagar"]');
    await a.pagina.waitForFunction(() => document.querySelectorAll('#leitor g.lt-destaque').length === 0);
    assert.deepEqual(await marcasNoEpub(a.pagina), { realces: 0, sublinhados: 1 });
    assert.equal(await a.pagina.isVisible('#leitor .lt-marca'), false);
    const naLista = await a.pagina.evaluate(async (id) => (await (await claude.use('db')).doc(`marcacoes/${id}`).get()).data().itens
      .map((d) => ({ trecho: d.trecho, estilo: d.estilo, nota: d.nota || '', apagado: Boolean(d.apagadoEm) })), livro);
    assert.deepEqual(naLista, [
      { trecho: 'segundo capítulo', estilo: 'sublinhado', nota: 'Voltar a este ponto', apagado: false },
      { trecho: 'destacada', estilo: 'realce', nota: '', apagado: true },
    ]);
    assert.equal((await cartoes(a.pagina)).length, 1);
    await aguardarSincronizado(a.pagina);

    // O outro aparelho abre o livro pelo link do cartão: um só destaque, sublinhado, com a nota.
    const b = await abrirPrancheta(contextoB, vps.base, chaveDaCifra);
    await b.pagina.locator(`[data-id="${cartao.id}"] a.lk[href^="https://prancheta.invalid/livro/"]`).click({ timeout: 20000 });
    await b.pagina.waitForFunction(() => /segundo capítulo/.test(document.querySelector('#leitor iframe')?.contentDocument?.body?.innerText || ''), null, { timeout: 20000 });
    await b.pagina.waitForFunction(() => document.querySelectorAll('#leitor g.lt-sublinhado').length === 1, null, { timeout: 10000 });
    assert.deepEqual(await marcasNoEpub(b.pagina), { realces: 0, sublinhados: 1 });
    await b.pagina.mouse.click(...await meioNoEpub(b.pagina, 'p2', 2, 18));
    await b.pagina.locator('#leitor .lt-marca').waitFor();
    assert.equal(await b.pagina.inputValue('#leitor .lt-marca input[name="nota"]'), 'Voltar a este ponto');

    // Apagado no outro aparelho, o destaque some do primeiro, com o livro e a barra abertos.
    await a.pagina.mouse.click(...await meioNoEpub(a.pagina, 'p2', 2, 18));
    await a.pagina.locator('#leitor .lt-marca').waitFor();
    await b.pagina.click('#leitor [data-acao="marca-apagar"]');
    await b.pagina.waitForFunction(() => document.querySelectorAll('#leitor g.lt-sublinhado').length === 0);
    await a.pagina.waitForFunction(() => document.querySelectorAll('#leitor g.lt-sublinhado').length === 0, null, { timeout: 20000 });
    assert.equal(await a.pagina.isVisible('#leitor .lt-marca'), false);
    assert.deepEqual(await a.pagina.evaluate((id) => window.marcacoesDaPrancheta.destaques(id), livro), []);
    // O cartão continua nos dois, e o link ainda abre o livro.
    assert.equal((await cartoes(b.pagina)).length, 1);
    const noServidor = await vps.armazem.lerDocumento(`marcacoes/${livro}`);
    assert.ok(chaveDoDocumento(noServidor.registro.dados));
    for (const { pagina } of [a, b]) assert.deepEqual(await pagina.evaluate(() => window.__violacoes), []);
    assert.deepEqual([...a.erros, ...b.erros], []);
  } finally {
    await contextoA.close();
    await contextoB.close();
    await vps.fechar();
  }
});

test('tocar num destaque do PDF abre apagar, estilo e nota', async () => {
  const vps = await subirComoNaVps();
  const contexto = await navegador.newContext({ viewport: TELA });
  try {
    const { pagina, erros } = await abrirPrancheta(contexto, vps.base);
    await pagina.locator('#biblioteca .bib-livro', { hasText: 'Documento.pdf' }).click();
    await pagina.waitForFunction(() => /Primeira pagina/.test(document.querySelector('#leitor .textLayer')?.textContent || ''), null, { timeout: 15000 });
    await pagina.evaluate(() => {
      const intervalo = document.createRange();
      intervalo.selectNodeContents(document.querySelector('#leitor .textLayer'));
      document.getSelection().removeAllRanges();
      document.getSelection().addRange(intervalo);
    });
    await pagina.locator('#leitor .lt-selecao [data-acao="destacar"]').waitFor();
    await pagina.click('#leitor .lt-selecao [data-acao="destacar"]');
    await pagina.locator('#leitor .textLayer span.lt-destacado').first().waitFor();

    await pagina.locator('#leitor .textLayer span.lt-destacado').first().click();
    await pagina.locator('#leitor .lt-marca').waitFor();
    assert.equal(await pagina.textContent('#leitor .lt-marca-trecho'), 'Destaque: “Primeira pagina do PDF”');
    await pagina.click('#leitor [data-acao="marca-estilo"]');
    await pagina.locator('#leitor .textLayer span.lt-sublinhado').first().waitFor();
    assert.equal(await pagina.locator('#leitor .textLayer span.lt-destacado').count(), 0);
    await pagina.fill('#leitor .lt-marca input[name="nota"]', 'Nota do PDF');
    await pagina.click('#leitor [data-acao="marca-nota"]');
    await pagina.waitForFunction(() => document.querySelector('#leitor .lt-aviso').textContent === 'Nota guardada.');
    const livro = await pagina.evaluate(() => window.leitorDaPrancheta.livro.id);
    const [destaque] = await pagina.evaluate((id) => window.marcacoesDaPrancheta.destaques(id), livro);
    assert.deepEqual({ estilo: destaque.estilo, nota: destaque.nota }, { estilo: 'sublinhado', nota: 'Nota do PDF' });

    await pagina.click('#leitor [data-acao="marca-apagar"]');
    await pagina.waitForFunction(() => document.querySelectorAll('#leitor .textLayer span.lt-sublinhado, #leitor .textLayer span.lt-destacado').length === 0);
    assert.equal(await pagina.isVisible('#leitor .lt-marca'), false);
    assert.deepEqual(await pagina.evaluate((id) => window.marcacoesDaPrancheta.destaques(id), livro), []);
    assert.deepEqual(erros, []);
  } finally {
    await contexto.close();
    await vps.fechar();
  }
});
