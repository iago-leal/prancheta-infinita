// Faixa dos controles no alto da tela, no navegador, como na casca: pedida
// pelo autor em 2026-11-11, com as coisas agrupadas num lugar só.
// Executar a partir da raiz do repositório: node --test web/testes/*.test.cjs

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { servirWeb } = require('./apoio/servidor.cjs');

let servidor;
let navegador;

before(async () => {
  servidor = await servirWeb();
  navegador = await chromium.launch();
});

after(async () => {
  await navegador?.close();
  await servidor?.fechar();
});

const esperar = (pagina, condicao, argumento, timeout = 8000) => pagina.waitForFunction(condicao, argumento, { timeout });

async function abrir(largura, altura) {
  const contexto = await navegador.newContext({ viewport: { width: largura, height: altura } });
  const pagina = await contexto.newPage();
  const erros = [];
  pagina.on('pageerror', (e) => erros.push(e.message));
  pagina.on('console', (m) => { if (m.type() === 'error') erros.push(`console: ${m.text()}`); });
  await pagina.goto(`${servidor.base}/app/index.html`);
  await esperar(pagina, () => window.__booted === true && navigator.serviceWorker.controller !== null);
  await esperar(pagina, () => document.getElementById('status').textContent === 'Salvo');
  return { contexto, pagina, erros };
}

test('no navegador do computador, os controles ficam numa faixa só, no alto da tela, agrupados', async () => {
  const { contexto, pagina, erros } = await abrir(1280, 800);
  try {
    assert.equal(await pagina.evaluate(() => document.documentElement.classList.contains('casca')), false);
    const faixa = await pagina.locator('#faixa').boundingBox();
    assert.ok(faixa.y === 0 && faixa.height < 56, `uma faixa só, baixa, no alto: ${JSON.stringify(faixa)}`);
    const embaixo = faixa.y + faixa.height;
    for (const seletor of ['#bTitle', '#tools', '#sinc', '#bUndo', '#bRedo', '#zoomPct', '#bMore']) {
      const caixa = await pagina.locator(seletor).boundingBox();
      assert.ok(caixa && caixa.y >= faixa.y && caixa.y + caixa.height <= embaixo, `${seletor} fica dentro da faixa: ${JSON.stringify(caixa)}`);
    }
    // À esquerda o título, ao centro as ferramentas, à direita o resto, nessa ordem.
    const x = async (s) => (await pagina.locator(s).boundingBox()).x;
    assert.ok(await x('#bTitle') < await x('#tools'));
    assert.ok(await x('#tools') < await x('#sinc'));
    assert.ok(await x('#sinc') < await x('#bUndo') && await x('#bUndo') < await x('#zoomPct') && await x('#zoomPct') < await x('#bMore'));
    // As ferramentas ficam no meio da faixa.
    const meio = async (s) => { const c = await pagina.locator(s).boundingBox(); return c.x + c.width / 2; };
    assert.ok(Math.abs(await meio('#tools') - (faixa.x + faixa.width / 2)) < 60, 'as ferramentas ficam no meio');
    // Os elementos são os do artefato, sem cópias.
    assert.equal(await pagina.evaluate(() => document.querySelectorAll('#tools, #top, #head, #zoomPct').length), 4);
    // A sincronização vira um ícone, e o que a casca esconde também sai daqui.
    const sinc = await pagina.locator('#sinc').boundingBox();
    assert.ok(sinc.width >= 30 && sinc.width <= 36, JSON.stringify(sinc));
    for (const seletor of ['#bSub', '#status', '#zIn', '#zOut']) assert.equal(await pagina.locator(seletor).isVisible(), false, seletor);
    // Com o painel de quadros aberto, a faixa começa depois dele.
    if (!(await pagina.evaluate(() => document.body.classList.contains('side')))) await pagina.keyboard.press('b');
    await esperar(pagina, () => document.body.classList.contains('side'));
    assert.equal((await pagina.locator('#faixa').boundingBox()).x, 260);
    // As opções da caneta, os atalhos e os avisos abrem abaixo da faixa.
    assert.equal(await pagina.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--altura-da-faixa')), `${Math.ceil(embaixo)}px`);
    await pagina.locator('#tools [data-t="pen"]').click();
    await pagina.locator('#tools [data-t="pen"]').click();
    await pagina.locator('#inkbar').waitFor();
    const opcoes = await pagina.locator('#inkbar').boundingBox();
    assert.ok(opcoes.y >= embaixo && opcoes.y < embaixo + 30, `as opções da caneta abrem logo abaixo da faixa: ${JSON.stringify(opcoes)}`);
    await pagina.keyboard.press('Escape');
    await pagina.evaluate(() => toast('Um aviso'));
    const aviso = await pagina.locator('#toast').boundingBox();
    assert.ok(aviso.y >= embaixo && aviso.y < embaixo + 100, `o aviso abre logo abaixo da faixa: ${JSON.stringify(aviso)}`);
    // O leitor de livros começa logo abaixo da faixa.
    const leitor = await pagina.evaluate(() => { const l = document.getElementById('leitor'); l.hidden = false; const t = l.getBoundingClientRect().top; l.hidden = true; return t; });
    assert.equal(leitor, Math.ceil(embaixo));
    // O menu do zoom abre para baixo, dentro da tela, e o zoom continua funcionando.
    await pagina.locator('#zoomPct').click();
    await pagina.locator('#menu').waitFor();
    const menu = await pagina.locator('#menu').boundingBox();
    assert.ok(menu.y > embaixo, JSON.stringify(menu));
    await pagina.locator('#menu button', { hasText: '200%' }).click();
    await esperar(pagina, () => Math.abs(S.view.k - 2) < 0.01);
    assert.equal((await pagina.locator('#zoomPct').textContent()).trim(), '200%');
    // A barra da seleção de um cartão no alto abre abaixo dele, sem cobrir a faixa.
    await pagina.keyboard.press('Escape');
    await pagina.evaluate(() => { S.view.k = 1; const w = toWorld(700, 110); begin(); const it = add({ type: 'card', x: Math.round(w.x), y: Math.round(w.y), w: 200, h: 0, blocks: [{ h: 'no alto' }], c: 'none' }); commit(); applyView(); select([it.id]); });
    await pagina.locator('#selbar').waitFor();
    const barra = await pagina.locator('#selbar').boundingBox();
    assert.ok(barra.y >= embaixo, `a barra da seleção fica abaixo da faixa: ${JSON.stringify(barra)}`);
    assert.deepEqual(erros, []);
  } finally {
    await contexto.close();
  }
});

test('numa tela estreita, como a do iPad em pé com o painel aberto, a faixa ganha uma segunda linha em vez de rolar', async () => {
  const { contexto, pagina, erros } = await abrir(820, 1180);
  try {
    if (!(await pagina.evaluate(() => document.body.classList.contains('side')))) await pagina.keyboard.press('b');
    await esperar(pagina, () => document.body.classList.contains('side'));
    await esperar(pagina, () => document.getElementById('faixa').getBoundingClientRect().height > 56);
    const faixa = await pagina.locator('#faixa').boundingBox();
    assert.ok(faixa.height < 100, JSON.stringify(faixa));
    assert.ok(await pagina.evaluate(() => { const t = document.getElementById('tools'); return t.scrollWidth <= t.clientWidth; }), 'as ferramentas cabem sem rolar');
    await esperar(pagina, (h) => getComputedStyle(document.documentElement).getPropertyValue('--altura-da-faixa') === `${h}px`, Math.ceil(faixa.y + faixa.height));
    // Fechado o painel, a faixa volta a uma linha, e a altura medida a acompanha.
    await pagina.keyboard.press('b');
    await esperar(pagina, () => !document.body.classList.contains('side'));
    await esperar(pagina, () => document.getElementById('faixa').getBoundingClientRect().height < 56);
    const uma = await pagina.locator('#faixa').boundingBox();
    await esperar(pagina, (h) => getComputedStyle(document.documentElement).getPropertyValue('--altura-da-faixa') === `${h}px`, Math.ceil(uma.y + uma.height));
    assert.deepEqual(erros, []);
  } finally {
    await contexto.close();
  }
});
