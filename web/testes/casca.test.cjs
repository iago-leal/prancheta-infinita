// Adaptador da casca Android, em web/app/compat/casca.js, testado com uma
// casca simulada: um objeto window.Casca que registra cada chamada.
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

const TELA = { width: 1200, height: 800 };
const esperar = (pagina, condicao, argumento, timeout = 8000) => pagina.waitForFunction(condicao, argumento, { timeout });
const pausa = (ms) => new Promise((pronto) => setTimeout(pronto, ms));

// Abre a Prancheta com uma casca simulada, que guarda em window.__chamadas
// cada chamada da página, já com os textos JSON convertidos.
async function abrirNaCasca(opcoes = {}) {
  const contexto = await navegador.newContext({ viewport: TELA, hasTouch: true });
  if (opcoes.casca !== false) {
    await contexto.addInitScript(() => {
      window.__chamadas = [];
      const registrar = (nome, json) => (...a) => window.__chamadas.push([nome, ...(json ? a.map((x) => JSON.parse(x)) : a)]);
      window.Casca = {
        pronta: registrar('pronta'),
        transformacao: registrar('transformacao', true),
        areasReservadas: registrar('areasReservadas', true),
        canetaEscreve: registrar('canetaEscreve'),
        redesenharTela: registrar('redesenharTela'),
        tinta: registrar('tinta', true),
      };
    });
  }
  const pagina = await contexto.newPage();
  const erros = [];
  pagina.on('pageerror', (e) => erros.push(e.message));
  await pagina.goto(`${servidor.base}/app/index.html`);
  await esperar(pagina, () => window.__booted === true);
  await esperar(pagina, () => document.getElementById('status').textContent === 'Salvo');
  return { contexto, pagina, erros };
}

const chamadas = (pagina, nome) => pagina.evaluate((nome) => window.__chamadas.filter((c) => c[0] === nome).map((c) => c.slice(1)), nome);
const ultima = async (pagina, nome) => (await chamadas(pagina, nome)).at(-1);
const dentro = (areas, x, y) => areas.some((a) => x >= a.x && x <= a.x + a.largura && y >= a.y && y <= a.y + a.altura);

async function centro(pagina, seletor) {
  const r = await pagina.locator(seletor).boundingBox();
  return [r.x + r.width / 2, r.y + r.height / 2];
}

// Consulta o banco até a condição, avaliada no Node, ser verdadeira.
async function aguardarItens(pagina, condicao, timeout = 8000) {
  const fim = Date.now() + timeout;
  for (;;) {
    const itens = await pagina.evaluate(async () => {
      const db = await claude.use('db');
      return (await db.collection('canvas-shards').get()).docs.flatMap((d) => d.data().items || []);
    });
    if (condicao(itens)) return itens;
    if (Date.now() > fim) throw new Error(`o banco não chegou ao estado esperado: ${JSON.stringify(itens.map((it) => it.type))}`);
    await pausa(150);
  }
}

// Pontos de um traço em pixels CSS de tela, com pressão e tempo.
function traco(x0, y0, x1, y1, n, pressao, t0 = 1000) {
  return Array.from({ length: n + 1 }, (_, i) => ({ x: x0 + ((x1 - x0) * i) / n, y: y0 + ((y1 - y0) * i) / n, p: pressao, t: t0 + i * 10 }));
}

test('fora da casca, o adaptador não faz nada', async () => {
  const { contexto, pagina, erros } = await abrirNaCasca({ casca: false });
  assert.equal(await pagina.evaluate(() => typeof window.prancheta), 'undefined');
  assert.equal(await pagina.evaluate(() => document.documentElement.classList.contains('casca')), false);
  const barra = await pagina.locator('#tools').boundingBox();
  assert.ok(barra.y > TELA.height - 100, `no navegador, a barra continua embaixo: ${JSON.stringify(barra)}`);
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('avisa a casca que está pronta, com a vista, as áreas reservadas e a caneta', async () => {
  const { contexto, pagina, erros } = await abrirNaCasca();
  assert.equal((await chamadas(pagina, 'pronta')).length, 1);
  assert.deepEqual((await ultima(pagina, 'transformacao'))[0], await pagina.evaluate(() => ({ ...S.view })));
  assert.deepEqual(await ultima(pagina, 'canetaEscreve'), [true], 'com a seleção, a caneta escreve');
  const [areas] = await ultima(pagina, 'areasReservadas');
  for (const seletor of ['#tools [data-t="pen"]', '#bMore', '#zoomPct', '#bUndo']) {
    const [x, y] = await centro(pagina, seletor);
    assert.ok(dentro(areas, x, y), `${seletor} deveria estar numa área reservada`);
  }
  assert.ok(!dentro(areas, 600, 400), 'o meio do quadro não é área reservada');
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('a vista, a ferramenta e os menus abertos chegam à casca', async () => {
  const { contexto, pagina, erros } = await abrirNaCasca();
  await pagina.evaluate(() => zoomCenter(1.25));
  await esperar(pagina, () => window.__chamadas.filter((c) => c[0] === 'transformacao').at(-1)[1].k > 1);
  assert.deepEqual((await ultima(pagina, 'transformacao'))[0], await pagina.evaluate(() => ({ ...S.view })));

  await pagina.mouse.click(600, 400);
  const esperado = [['e', false], ['p', true], ['r', false], ['m', true], ['v', true]];
  for (const [tecla, escreve] of esperado) {
    await pagina.keyboard.press(tecla);
    await esperar(pagina, (e) => window.__chamadas.filter((c) => c[0] === 'canetaEscreve').at(-1)[1] === e, escreve);
  }

  await pagina.locator('#bMore').click();
  const [mx, my] = await centro(pagina, '#menu');
  await esperar(pagina, ([x, y]) => window.__chamadas.filter((c) => c[0] === 'areasReservadas').at(-1)[1]
    .some((a) => x >= a.x && x <= a.x + a.largura && y >= a.y && y <= a.y + a.altura), [mx, my]);
  await pagina.keyboard.press('Escape');
  await esperar(pagina, () => document.getElementById('menu').hidden);
  await esperar(pagina, ([x, y]) => !window.__chamadas.filter((c) => c[0] === 'areasReservadas').at(-1)[1]
    .some((a) => x >= a.x && x <= a.x + a.largura && y >= a.y && y <= a.y + a.altura), [mx, my]);
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('o traço da casca vira traço da Prancheta no lugar certo, com pressão e horário', async () => {
  const { contexto, pagina, erros } = await abrirNaCasca();
  await pagina.evaluate(() => { prancheta.definirTinta('nativa'); zoomAt(600, 400, 2); });
  const vista = await pagina.evaluate(() => ({ ...S.view }));
  assert.equal(vista.k, 2);
  const pontos = traco(300, 300, 500, 400, 20, 0.5);
  const antes = Date.now();
  assert.equal(await pagina.evaluate((p) => prancheta.receberTraco(p), pontos), true);
  const itens = await aguardarItens(pagina, (it) => it.some((i) => i.type === 'stroke'));
  const salvo = itens.find((i) => i.type === 'stroke');
  const cfg = await pagina.evaluate(() => ({ ...S.ink.pen }));
  assert.equal(salvo.tool, 'pen');
  assert.equal(salvo.c, cfg.c);
  assert.equal(salvo.w, cfg.w);
  assert.equal(salvo.dur, 200);
  assert.ok(salvo.em >= antes - 200 - 50 && salvo.em <= Date.now(), `horário ${salvo.em}`);
  // Os pontos guardados estão em coordenadas do quadro: tela = quadro * k + (x, y).
  const p = await pagina.evaluate((d) => decode(d), salvo.d);
  const primeiro = { x: (300 - vista.x) / vista.k, y: (300 - vista.y) / vista.k };
  const ultimo = { x: (500 - vista.x) / vista.k, y: (400 - vista.y) / vista.k };
  assert.ok(Math.abs(p[0] - primeiro.x) < 0.11 && Math.abs(p[1] - primeiro.y) < 0.11, `primeiro ponto ${p[0]},${p[1]}`);
  assert.ok(Math.abs(p.at(-3) - ultimo.x) < 0.11 && Math.abs(p.at(-2) - ultimo.y) < 0.11, `último ponto ${p.at(-3)},${p.at(-2)}`);
  // A pressão passa pela mesma curva da caneta no navegador.
  assert.equal(p[2], Math.round(Math.pow(0.5, 0.65) * 20) / 20);
  // Na tela, o traço desenhado cobre a região onde a caneta passou.
  const caixa = await pagina.evaluate((id) => document.querySelector(`#ink [data-id="${id}"]`).getBoundingClientRect().toJSON(), salvo.id);
  assert.ok(caixa.left < 305 && caixa.right > 495 && caixa.top < 305 && caixa.bottom > 395, JSON.stringify(caixa));

  // Com o marca-texto ativo, o traço da casca usa a configuração dele.
  await pagina.mouse.click(600, 600);
  await pagina.keyboard.press('m');
  await pagina.evaluate((p) => prancheta.receberTraco(p), traco(300, 500, 500, 500, 10, 0.5));
  const comMarca = await aguardarItens(pagina, (it) => it.some((i) => i.type === 'stroke' && i.tool === 'hl'));
  assert.equal(comMarca.find((i) => i.tool === 'hl').c, await pagina.evaluate(() => S.ink.hl.c));
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('informa a casca da tinta ativa, com a ferramenta, a cor e a espessura', async () => {
  const { contexto, pagina, erros } = await abrirNaCasca();
  const corDe = (nome) => pagina.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(`--${n}`).trim(), nome);
  const caneta = await pagina.evaluate(() => ({ ...S.ink.pen }));
  assert.deepEqual((await ultima(pagina, 'tinta'))[0], { ferramenta: 'pen', cor: await corDe(caneta.c), largura: caneta.w });
  await pagina.mouse.click(600, 600);
  await pagina.keyboard.press('m');
  const marca = await pagina.evaluate(() => ({ ...S.ink.hl }));
  await esperar(pagina, () => window.__chamadas.filter((c) => c[0] === 'tinta').at(-1)[1].ferramenta === 'hl');
  assert.deepEqual((await ultima(pagina, 'tinta'))[0], { ferramenta: 'hl', cor: await corDe(marca.c), largura: marca.w });
  // Trocar a cor da caneta chega à casca na próxima mudança da interface.
  await pagina.evaluate(() => { S.ink.pen.c = 'red'; S.ink.pen.w = 6; setTool('select'); });
  await esperar(pagina, () => window.__chamadas.filter((c) => c[0] === 'tinta').at(-1)[1].ferramenta === 'pen');
  assert.deepEqual((await ultima(pagina, 'tinta'))[0], { ferramenta: 'pen', cor: await corDe('red'), largura: 6 });
  assert.notEqual(await corDe('red'), '');
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('o traço com o contorno da Onyx guarda a espessura de cada ponto e é desenhado com ela', async () => {
  const { contexto, pagina, erros } = await abrirNaCasca();
  await pagina.evaluate(() => { prancheta.definirTinta('nativa'); zoomAt(600, 400, 2); });
  const vista = await pagina.evaluate(() => ({ ...S.view }));
  const pontos = traco(300, 300, 500, 300, 20, 0.5);
  // A espessura vem da Onyx em pixels CSS de tela: 10 px com zoom 2 são 5 no quadro.
  const contorno = Array.from({ length: 41 }, (_, i) => ({ x: 300 + i * 5, y: 300, l: 10 }));
  await pagina.evaluate(([p, c]) => prancheta.receberTraco(p, c), [pontos, contorno]);
  const salvo = (await aguardarItens(pagina, (it) => it.some((i) => i.type === 'stroke'))).find((i) => i.type === 'stroke');
  const nf = await pagina.evaluate((d) => decode(d), salvo.nf);
  assert.equal(nf.length, 41 * 3);
  assert.ok(Math.abs(nf[0] - (300 - vista.x) / vista.k) < 0.11 && Math.abs(nf[1] - (300 - vista.y) / vista.k) < 0.11);
  assert.ok(nf.filter((_, i) => i % 3 === 2).every((l) => l === 5), 'espessura de 5 no quadro em todos os pontos');
  // Os pontos originais, com a pressão, continuam guardados à parte.
  assert.equal((await pagina.evaluate((d) => decode(d), salvo.d))[2], Math.round(Math.pow(0.5, 0.65) * 20) / 20);
  // Na tela, o traço tem os 10 px de espessura da Onyx.
  const caixa = await pagina.evaluate((id) => document.querySelector(`#ink [data-id="${id}"]`).getBoundingClientRect().toJSON(), salvo.id);
  assert.ok(Math.abs(caixa.height - 10) < 0.6, `altura ${caixa.height}`);
  assert.ok(Math.abs(caixa.left - 295) < 0.6 && Math.abs(caixa.right - 505) < 0.6, JSON.stringify(caixa));
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('o contorno da Onyx segue a espessura de cada ponto, com pontas arredondadas', async () => {
  const { contexto, pagina, erros } = await abrirNaCasca({ casca: false });
  const caixas = await pagina.evaluate(() => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.append(svg);
    const medir = (p) => {
      const caminho = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      caminho.setAttribute('d', contornoOnyx(p));
      svg.append(caminho);
      const b = caminho.getBBox();
      return { x: b.x, y: b.y, largura: b.width, altura: b.height, d: caminho.getAttribute('d') };
    };
    return {
      constante: medir([0, 0, 4, 10, 0, 4, 20, 0, 4]),
      crescente: medir([0, 0, 2, 10, 0, 4, 20, 0, 8]),
      repetidos: medir([0, 0, 4, 0, 0, 6, 10, 0, 4]),
      ponto: medir([5, 5, 6]),
      vazio: contornoOnyx([]),
    };
  });
  const perto = (a, b) => Math.abs(a - b) < 0.05;
  assert.ok(perto(caixas.constante.altura, 4) && perto(caixas.constante.largura, 24), JSON.stringify(caixas.constante));
  assert.ok(perto(caixas.crescente.altura, 8) && perto(caixas.crescente.x, -1), JSON.stringify(caixas.crescente));
  assert.ok(perto(caixas.repetidos.altura, 6) && !caixas.repetidos.d.includes('NaN'), JSON.stringify(caixas.repetidos));
  assert.ok(perto(caixas.ponto.largura, 6) && perto(caixas.ponto.altura, 6), JSON.stringify(caixas.ponto));
  assert.equal(caixas.vazio, '');
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('pede para redesenhar a tela quando a vista muda ou um traço some depois da tinta da casca', async () => {
  const { contexto, pagina, erros } = await abrirNaCasca();
  await pagina.evaluate(() => prancheta.definirTinta('nativa'));
  // Sem tinta da casca na tela, mudar a vista não pede redesenho.
  await pagina.evaluate(() => zoomCenter(1.25));
  await pausa(600);
  assert.equal((await chamadas(pagina, 'redesenharTela')).length, 0);

  // Um traço novo, sozinho, também não pede.
  await pagina.evaluate((p) => prancheta.receberTraco(p), traco(300, 300, 500, 400, 20, 0.5));
  await aguardarItens(pagina, (it) => it.some((i) => i.type === 'stroke'));
  await pausa(600);
  assert.equal((await chamadas(pagina, 'redesenharTela')).length, 0);

  // Mudar a vista depois dele pede um único redesenho, quando a mudança termina.
  // Na casca, o zoom em passos é o mesmo dos botões de diminuir, que só aparecem no computador.
  await pagina.evaluate(() => zoomCenter(0.8));
  await pagina.evaluate(() => zoomCenter(0.8));
  await esperar(pagina, () => window.__chamadas.some((c) => c[0] === 'redesenharTela'));
  await pausa(600);
  assert.equal((await chamadas(pagina, 'redesenharTela')).length, 1);

  // Apagar um traço feito pela casca também pede.
  await pagina.evaluate((p) => prancheta.receberTraco(p), traco(300, 500, 500, 520, 10, 0.5));
  await aguardarItens(pagina, (it) => it.filter((i) => i.type === 'stroke').length === 2);
  await pagina.mouse.click(1000, 650);
  await pagina.keyboard.press('Control+a');
  await pagina.keyboard.press('Delete');
  await esperar(pagina, () => window.__chamadas.filter((c) => c[0] === 'redesenharTela').length === 2);
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('com a tinta nativa, um dedo move o quadro mesmo com a caneta ativa', async () => {
  const { contexto, pagina, erros } = await abrirNaCasca();
  await pagina.evaluate(() => prancheta.definirTinta('nativa'));
  await pagina.mouse.click(600, 600);
  await pagina.keyboard.press('p');
  const antes = await pagina.evaluate(() => ({ ...S.view }));
  const cdp = await contexto.newCDPSession(pagina);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 600, y: 400, id: 1 }] });
  for (let i = 1; i <= 12; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 600 + i * 10, y: 400 + i * 5, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await pausa(1800);
  const depois = await pagina.evaluate(() => ({ ...S.view }));
  // O artefato descarta o começo do movimento, até reconhecer o arrasto.
  assert.ok(depois.x - antes.x > 90 && depois.y - antes.y > 40, `vista de ${JSON.stringify(antes)} para ${JSON.stringify(depois)}`);
  assert.equal(await pagina.evaluate(() => [...S.items.values()].filter((it) => it.type === 'stroke').length), 0, 'o dedo não desenha');
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('na casca, os controles ficam numa faixa só, no alto da tela', async () => {
  const { contexto, pagina, erros } = await abrirNaCasca();
  await pagina.evaluate(() => prancheta.definirTinta('nativa'));
  assert.equal(await pagina.evaluate(() => document.documentElement.classList.contains('casca')), true);
  const faixa = await pagina.locator('#faixa-casca').boundingBox();
  assert.ok(faixa.y === 0 && faixa.height < 56, `uma faixa só, baixa, no alto: ${JSON.stringify(faixa)}`);
  const embaixo = faixa.y + faixa.height;
  for (const seletor of ['#bTitle', '#tools', '#sinc', '#bUndo', '#bRedo', '#zoomPct', '#bMore']) {
    const caixa = await pagina.locator(seletor).boundingBox();
    assert.ok(caixa && caixa.y >= faixa.y && caixa.y + caixa.height <= embaixo, `${seletor} fica dentro da faixa: ${JSON.stringify(caixa)}`);
  }
  assert.ok(await pagina.evaluate(() => { const t = document.getElementById('tools'); return t.scrollWidth <= t.clientWidth; }), 'as ferramentas cabem sem rolar');
  // A sincronização vira um ícone que muda com a situação, e o texto fica para leitores de tela.
  const sinc = await pagina.locator('#sinc').boundingBox();
  assert.ok(sinc.width >= 30 && sinc.width <= 36, `a sincronização ocupa o espaço de um botão de ícone: ${JSON.stringify(sinc)}`);
  assert.ok(await pagina.evaluate(() => { const b = document.getElementById('sinc'); return b.scrollWidth <= b.clientWidth; }), 'o texto da situação não aparece sobre os outros botões');
  assert.ok((await pagina.locator('#sinc').textContent()).length > 0, 'o botão continua com o texto da situação');
  const icones = await pagina.evaluate(() => {
    const b = document.getElementById('sinc');
    const icone = () => getComputedStyle(b).getPropertyValue('--icone-sinc');
    const antes = b.dataset.situacao;
    const lidos = ['desligada', 'sincronizada', 'sem_rede', 'erro'].map((s) => { b.dataset.situacao = s; return icone(); });
    b.dataset.situacao = antes || '';
    return lidos;
  });
  assert.ok(icones.every((i) => i.includes('data:image/svg+xml')), 'cada situação tem um ícone');
  assert.equal(new Set(icones).size, icones.length, 'cada situação tem um ícone diferente');
  // O título fica numa linha, e o que só serve no computador sai da tela.
  assert.equal(await pagina.evaluate(() => getComputedStyle(document.getElementById('bTitle')).whiteSpace), 'nowrap');
  for (const seletor of ['#bSub', '#status', '#zIn', '#zOut']) {
    assert.equal(await pagina.locator(seletor).isVisible(), false, `${seletor} não aparece na casca`);
  }
  // As opções da caneta abrem abaixo da faixa, sem os ajustes da tinta da página.
  await pagina.locator('#tools [data-t="pen"]').click();
  await pagina.locator('#tools [data-t="pen"]').click();
  await pagina.locator('#inkbar').waitFor();
  const opcoes = await pagina.locator('#inkbar').boundingBox();
  assert.ok(opcoes.y >= embaixo, `as opções da caneta abrem abaixo da faixa: ${JSON.stringify(opcoes)}`);
  assert.equal(await pagina.locator('#inkStab').isVisible(), false, 'sem estabilização com a tinta da Onyx');
  assert.equal(await pagina.locator('#inkPred').isVisible(), false, 'sem previsão com a tinta da Onyx');
  assert.equal(await pagina.evaluate(() => getComputedStyle(document.getElementById('inkbar')).boxShadow), 'none', 'sem sombra no e-ink');
  // O menu do zoom, que abria para cima, abre para baixo, dentro da tela.
  await pagina.keyboard.press('Escape');
  await pagina.locator('#zoomPct').click();
  await pagina.locator('#menu').waitFor();
  const menu = await pagina.locator('#menu').boundingBox();
  const zoom = await pagina.locator('#zoomPct').boundingBox();
  assert.ok(menu.y > zoom.y + zoom.height, `o menu do zoom abre para baixo: ${JSON.stringify(menu)}`);
  // A faixa inteira é área reservada: a caneta age sobre ela em vez de escrever.
  await esperar(pagina, () => {
    const areas = window.__chamadas.filter((c) => c[0] === 'areasReservadas').at(-1)[1];
    const r = document.getElementById('faixa-casca').getBoundingClientRect();
    return areas.some((a) => r.left + 1 >= a.x && r.right - 1 <= a.x + a.largura && r.top + 1 >= a.y && r.bottom - 1 <= a.y + a.altura);
  });
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('com o painel de quadros aberto numa tela estreita, a faixa ganha uma segunda linha em vez de rolar', async () => {
  const { contexto, pagina, erros } = await abrirNaCasca();
  await pagina.setViewportSize({ width: 930, height: 1240 });
  if (!(await pagina.evaluate(() => document.body.classList.contains('side')))) await pagina.keyboard.press('b');
  await esperar(pagina, () => document.body.classList.contains('side'));
  await pausa(300);
  const faixa = await pagina.locator('#faixa-casca').boundingBox();
  assert.ok(faixa.height > 56 && faixa.height < 100, `duas linhas: ${JSON.stringify(faixa)}`);
  assert.ok(await pagina.evaluate(() => { const t = document.getElementById('tools'); return t.scrollWidth <= t.clientWidth; }), 'as ferramentas cabem sem rolar');
  const opcoes = await pagina.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--casca-faixa'));
  assert.equal(opcoes, `${Math.ceil(faixa.y + faixa.height)}px`, 'o que abre abaixo da faixa acompanha a altura dela');
  // Com o painel fechado, tudo cabe numa linha, mesmo numa página um pouco
  // mais estreita que a do Boox, que tem cerca de 900 px.
  await pagina.keyboard.press('b');
  await esperar(pagina, () => !document.body.classList.contains('side'));
  await pagina.setViewportSize({ width: 860, height: 1150 });
  await pausa(300);
  const sozinha = await pagina.locator('#faixa-casca').boundingBox();
  assert.ok(sozinha.height < 56, `uma linha só com o painel fechado: ${JSON.stringify(sozinha)}`);
  assert.ok(await pagina.evaluate(() => { const t = document.getElementById('tools'); return t.scrollWidth <= t.clientWidth; }), 'as ferramentas cabem sem rolar');
  assert.deepEqual(erros, []);
  await contexto.close();
});

// Toques simultâneos com vários dedos, pelo protocolo do Chromium.
async function tocarComDedos(cdp, n, fim = 'touchEnd') {
  const pontos = Array.from({ length: n }, (_, i) => ({ x: 500 + i * 60, y: 500, id: i + 1 }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pontos });
  await cdp.send('Input.dispatchTouchEvent', { type: fim, touchPoints: [] });
}

const contarTracos = (pagina) => pagina.evaluate(() => [...S.items.values()].filter((it) => it.type === 'stroke').length);

test('desfazer e refazer pelos dedos pedem dois toques seguidos', async () => {
  const { contexto, pagina, erros } = await abrirNaCasca();
  await pagina.evaluate((pontos) => { prancheta.definirTinta('nativa'); prancheta.receberTraco(pontos); }, traco(300, 300, 700, 360, 20, 0.5));
  await esperar(pagina, () => [...S.items.values()].some((it) => it.type === 'stroke'));
  const cdp = await contexto.newCDPSession(pagina);

  // Um toque só, com dois dedos, como a mão apoiada, não desfaz.
  await tocarComDedos(cdp, 2);
  await pausa(600);
  assert.equal(await contarTracos(pagina), 1, 'um toque de dois dedos não desfaz');
  // Dois toques separados por mais de 400 ms também não.
  await tocarComDedos(cdp, 2);
  await pausa(600);
  assert.equal(await contarTracos(pagina), 1, 'toques afastados não desfazem');

  await tocarComDedos(cdp, 2);
  await pausa(80);
  await tocarComDedos(cdp, 2);
  await esperar(pagina, () => ![...S.items.values()].some((it) => it.type === 'stroke'));
  await pausa(600);

  // Se um dos toques perdeu um dedo, vale o maior número de dedos dos dois: refaz.
  await tocarComDedos(cdp, 2);
  await pausa(80);
  await tocarComDedos(cdp, 3);
  await esperar(pagina, () => [...S.items.values()].some((it) => it.type === 'stroke'));
  await pausa(600);
  // Sem nada a refazer, o gesto é reconhecido e avisa, também com três dedos e depois dois.
  await tocarComDedos(cdp, 3);
  await pausa(80);
  await tocarComDedos(cdp, 2);
  await esperar(pagina, () => document.getElementById('toast').textContent === 'Nada a refazer');
  assert.equal(await contarTracos(pagina), 1, 'três dedos e depois dois não desfazem');
  await pausa(600);
  // Desfaz o traço e, sem mais nada a desfazer, avisa.
  await tocarComDedos(cdp, 2);
  await pausa(80);
  await tocarComDedos(cdp, 2);
  await esperar(pagina, () => ![...S.items.values()].some((it) => it.type === 'stroke'));
  await pausa(600);
  await tocarComDedos(cdp, 2);
  await pausa(80);
  await tocarComDedos(cdp, 2);
  await esperar(pagina, () => document.getElementById('toast').textContent === 'Nada a desfazer');
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('um gesto de dedos cancelado devolve a vista e não desfaz nada', async () => {
  const { contexto, pagina, erros } = await abrirNaCasca();
  await pagina.evaluate((pontos) => { prancheta.definirTinta('nativa'); prancheta.receberTraco(pontos); }, traco(300, 300, 700, 360, 20, 0.5));
  await esperar(pagina, () => [...S.items.values()].some((it) => it.type === 'stroke'));
  await pagina.keyboard.press('p');
  const antes = await pagina.evaluate(() => ({ ...S.view }));
  const cdp = await contexto.newCDPSession(pagina);

  // Um dedo arrasta o quadro, e a casca cancela o gesto quando a caneta chega.
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 600, y: 400, id: 1 }] });
  for (let i = 1; i <= 12; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 600 + i * 10, y: 400 + i * 5, id: 1 }] });
  await pausa(100);
  const durante = await pagina.evaluate(() => ({ ...S.view }));
  assert.ok(durante.x - antes.x > 50, `o dedo moveu o quadro: ${JSON.stringify(durante)}`);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await pausa(100);
  assert.deepEqual(await pagina.evaluate(() => ({ ...S.view })), antes, 'a vista volta à do início do gesto');

  // Dois dedos que ampliam o quadro também voltam.
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 500, y: 400, id: 1 }, { x: 600, y: 400, id: 2 }] });
  for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 500 - i * 10, y: 400, id: 1 }, { x: 600 + i * 10, y: 400, id: 2 }] });
  await pausa(100);
  assert.ok(await pagina.evaluate((k) => S.view.k > k * 1.2, antes.k), 'os dois dedos ampliaram o quadro');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await pausa(100);
  assert.deepEqual(await pagina.evaluate(() => ({ ...S.view })), antes, 'o zoom volta ao do início do gesto');

  // Um toque duplo de dois dedos cujo segundo toque é cancelado não desfaz.
  await tocarComDedos(cdp, 2);
  await pausa(80);
  await tocarComDedos(cdp, 2, 'touchCancel');
  await pausa(600);
  assert.equal(await contarTracos(pagina), 1, 'o toque cancelado não desfaz');
  // Nem conta como o primeiro de dois toques seguidos.
  await tocarComDedos(cdp, 2, 'touchCancel');
  await pausa(80);
  await tocarComDedos(cdp, 2);
  await pausa(600);
  assert.equal(await contarTracos(pagina), 1, 'o toque cancelado não é o primeiro do toque duplo');
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('um item arrastado por um dedo volta ao lugar quando o gesto é cancelado', async () => {
  const { contexto, pagina, erros } = await abrirNaCasca();
  await pagina.evaluate(() => prancheta.definirTinta('nativa'));
  await pagina.mouse.dblclick(600, 500);
  await pagina.keyboard.type('arrastado');
  await pagina.keyboard.press('Escape');
  await pagina.locator('.card', { hasText: 'arrastado' }).waitFor();
  await pagina.mouse.click(900, 700);
  const posicao = () => pagina.evaluate(() => { const it = [...S.items.values()].find((x) => x.type === 'card'); return [it.x, it.y]; });
  const antes = await posicao();
  const historico = await pagina.evaluate(() => S.undo.length);
  const [x, y] = await centro(pagina, '.card');
  const cdp = await contexto.newCDPSession(pagina);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  for (let i = 1; i <= 12; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + i * 10, y: y + i * 6, id: 1 }] });
  await pausa(100);
  assert.notDeepEqual(await posicao(), antes, 'o dedo arrastou o cartão');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await pausa(200);
  assert.deepEqual(await posicao(), antes, 'o cartão volta ao lugar');
  assert.equal(await pagina.evaluate(() => S.undo.length), historico, 'o arrasto cancelado não fica no histórico');
  assert.equal(await pagina.evaluate(() => S.redo.length), 0, 'nem entre o que se pode refazer');
  assert.deepEqual(erros, []);
  await contexto.close();
});

// Um toque de vários dedos que dura e se desloca um pouco, como três dedos pousando juntos.
async function tocarDevagar(cdp, n, { duracao = 0, deslocamento = 0, fim = 'touchEnd' } = {}) {
  const pontos = Array.from({ length: n }, (_, i) => ({ x: 500 + i * 60, y: 500, id: i + 1 }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pontos });
  if (deslocamento) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pontos.map((p) => ({ ...p, x: p.x + deslocamento })) });
  if (duracao) await pausa(duracao);
  await cdp.send('Input.dispatchTouchEvent', { type: fim, touchPoints: [] });
}

test('refazer com três dedos tolera toques mais lentos e o cancelamento pelo sistema', async () => {
  const { contexto, pagina, erros } = await abrirNaCasca();
  await pagina.evaluate((pontos) => { prancheta.definirTinta('nativa'); prancheta.receberTraco(pontos); }, traco(300, 300, 700, 360, 20, 0.5));
  await esperar(pagina, () => [...S.items.values()].some((it) => it.type === 'stroke'));
  // A página ignora gestos nos primeiros 500 ms, que confunde com a caneta recém-levantada.
  await esperar(pagina, () => performance.now() > 600);
  const cdp = await contexto.newCDPSession(pagina);
  const desfazer = async () => {
    await tocarComDedos(cdp, 2);
    await pausa(80);
    await tocarComDedos(cdp, 2);
    await esperar(pagina, () => ![...S.items.values()].some((it) => it.type === 'stroke'));
    await pausa(600);
  };

  // Três dedos que levam 550 ms e se deslocam 20 px ainda contam como toque.
  await desfazer();
  await tocarDevagar(cdp, 3, { duracao: 550, deslocamento: 20 });
  await pausa(80);
  await tocarDevagar(cdp, 3, { duracao: 550, deslocamento: 20 });
  await esperar(pagina, () => [...S.items.values()].some((it) => it.type === 'stroke'));
  await pausa(600);

  // Com dois dedos, os limites continuam os de antes: 550 ms já não é toque.
  await tocarDevagar(cdp, 2, { duracao: 550 });
  await pausa(80);
  await tocarDevagar(cdp, 2, { duracao: 550 });
  await pausa(600);
  assert.equal(await contarTracos(pagina), 1, 'dois dedos demorados não desfazem');

  // Toques de três dedos cancelados pelo sistema, curtos e parados, ainda refazem.
  await desfazer();
  await tocarComDedos(cdp, 3, 'touchCancel');
  await pausa(80);
  await tocarComDedos(cdp, 3, 'touchCancel');
  await esperar(pagina, () => [...S.items.values()].some((it) => it.type === 'stroke'));
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('com o diagnóstico ligado, os gestos e os toques descartados pela casca aparecem em avisos', async () => {
  const { contexto, pagina, erros } = await abrirNaCasca();
  await pagina.evaluate(() => prancheta.definirTinta('nativa'));
  const aviso = () => pagina.evaluate(() => document.getElementById('toast').textContent);
  // Desligado, o motivo da casca não aparece.
  await pagina.evaluate(() => prancheta.toqueDescartado('toque descartado: caneta perto há 300 ms'));
  assert.notEqual(await aviso(), 'Casca: toque descartado: caneta perto há 300 ms');
  await pagina.evaluate(() => { S.diag = true; });
  await pagina.evaluate(() => prancheta.toqueDescartado('o sistema cancelou o toque de 3 dedos'));
  assert.equal(await aviso(), 'Casca: o sistema cancelou o toque de 3 dedos');
  await esperar(pagina, () => performance.now() > 600);
  const cdp = await contexto.newCDPSession(pagina);
  await tocarComDedos(cdp, 3);
  await esperar(pagina, () => /^Toque de 3 dedos, \d+ ms$/.test(document.getElementById('toast').textContent));
  await tocarComDedos(cdp, 2, 'touchCancel');
  await esperar(pagina, () => /^Toque de 2 dedos, \d+ ms, cancelado$/.test(document.getElementById('toast').textContent));
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('na casca, a página fica sem sombras, transições, animações e fundos translúcidos', async () => {
  const { contexto, pagina, erros } = await abrirNaCasca();
  await pagina.evaluate(() => prancheta.definirTinta('nativa'));
  // Um cartão selecionado, as opções da caneta abertas e o menu de mais opções.
  await pagina.mouse.dblclick(600, 500);
  await pagina.keyboard.type('selecionado');
  await pagina.keyboard.press('Escape');
  await pagina.locator('.card', { hasText: 'selecionado' }).waitFor();
  await pagina.locator('.card', { hasText: 'selecionado' }).click();
  await esperar(pagina, () => document.querySelector('.card.sel') !== null);
  const restos = await pagina.evaluate(() => {
    const achados = [];
    for (const el of document.querySelectorAll('*')) {
      for (const pseudo of [null, '::before', '::after']) {
        const s = getComputedStyle(el, pseudo);
        if (s.boxShadow !== 'none') achados.push(`${el.id || el.className || el.tagName}${pseudo || ''}: sombra`);
        if (s.transitionDuration.split(',').some((d) => parseFloat(d) > 0)) achados.push(`${el.id || el.className || el.tagName}${pseudo || ''}: transição`);
        if (s.animationName !== 'none') achados.push(`${el.id || el.className || el.tagName}${pseudo || ''}: animação`);
      }
    }
    return achados;
  });
  assert.deepEqual(restos, [], 'nenhum elemento com sombra, transição ou animação');
  const cores = await pagina.evaluate(() => {
    const raiz = getComputedStyle(document.documentElement);
    const amostra = document.createElement('div');
    document.body.appendChild(amostra);
    const resolver = (v) => { amostra.style.color = v; return getComputedStyle(amostra).color; };
    const fg = resolver(raiz.getPropertyValue('--fg'));
    const bg = resolver(raiz.getPropertyValue('--bg'));
    amostra.remove();
    const ativo = getComputedStyle(document.querySelector('#tools .btn[aria-pressed="true"]'));
    const cartao = getComputedStyle(document.querySelector('.card.sel'));
    return { fg, bg, fundoAtivo: ativo.backgroundColor, iconeAtivo: ativo.color, contorno: cartao.outlineColor, estiloDoContorno: cartao.outlineStyle };
  });
  assert.equal(cores.fundoAtivo, cores.fg, 'a ferramenta ativa tem fundo escuro');
  assert.equal(cores.iconeAtivo, cores.bg, 'e ícone claro');
  assert.equal(cores.contorno, cores.fg, 'o item selecionado tem contorno escuro');
  assert.equal(cores.estiloDoContorno, 'solid', 'e contínuo');
  // Menus, barra de seleção e diálogos: fundo opaco e borda fina, sem escurecer atrás.
  await pagina.locator('#bMore').click();
  await pagina.locator('#menu').waitFor();
  const opacos = await pagina.evaluate(() => {
    const ver = (el) => { const s = getComputedStyle(el); return { fundo: s.backgroundColor, borda: s.borderTopWidth }; };
    const selbar = document.getElementById('selbar');
    return { menu: ver(document.getElementById('menu')), selbar: selbar ? ver(selbar) : null, dialogo: getComputedStyle(document.getElementById('sincDialogo')).backgroundColor, previa: getComputedStyle(document.getElementById('prev')).backgroundColor };
  });
  const opaco = (cor) => /^rgb\(/.test(cor);
  assert.ok(opaco(opacos.menu.fundo) && opacos.menu.borda === '1px', `menu opaco com borda: ${JSON.stringify(opacos.menu)}`);
  if (opacos.selbar) assert.ok(opaco(opacos.selbar.fundo) && opacos.selbar.borda === '1px', `barra de seleção opaca com borda: ${JSON.stringify(opacos.selbar)}`);
  assert.equal(opacos.dialogo, 'rgba(0, 0, 0, 0)', 'o diálogo de sincronização não escurece a tela');
  assert.ok(opaco(opacos.previa), `a prévia de arquivos tem fundo opaco: ${opacos.previa}`);
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('no navegador, a aparência continua com as sombras e o destaque de antes', async () => {
  const { contexto, pagina, erros } = await abrirNaCasca({ casca: false });
  const visto = await pagina.evaluate(() => ({
    sombra: getComputedStyle(document.getElementById('tools')).boxShadow,
    ativo: getComputedStyle(document.querySelector('#tools .btn[aria-pressed="true"]')).backgroundColor,
    transicao: getComputedStyle(document.getElementById('head')).transitionDuration,
  }));
  assert.notEqual(visto.sombra, 'none', 'a barra mantém a sombra');
  assert.equal(visto.ativo, 'rgb(233, 232, 251)', 'a ferramenta ativa mantém o fundo lilás');
  assert.notEqual(visto.transicao, '0s', 'as transições continuam');
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('o botão de formas abre um painel com as quatro formas e os sete símbolos elétricos', async () => {
  for (const naCasca of [true, false]) {
    const { contexto, pagina, erros } = await abrirNaCasca({ casca: naCasca });
    for (const antigo of ['rect', 'ellipse', 'diamond', 'line', 'symbol']) {
      assert.equal(await pagina.locator(`#t-${antigo}`).count(), 0, `o botão ${antigo} sai da barra`);
    }
    await pagina.locator('#t-shapes').click();
    await pagina.locator('#menu').waitFor();
    assert.equal(await pagina.locator('#menu [data-forma]').count(), 4, 'as quatro formas à vista');
    assert.equal(await pagina.locator('#menu [data-sym]').count(), 7, 'os sete símbolos à vista');
    // O painel abre para baixo com a barra no alto, na casca, e para cima com ela embaixo.
    const painel = await pagina.locator('#menu').boundingBox();
    const botao = await pagina.locator('#t-shapes').boundingBox();
    if (naCasca) assert.ok(painel.y > botao.y + botao.height, `abre para baixo: ${JSON.stringify(painel)}`);
    else assert.ok(painel.y + painel.height < botao.y, `abre para cima: ${JSON.stringify(painel)}`);
    // A forma escolhida fica ativa e aparece no ícone do botão.
    await pagina.locator('#menu [data-forma="ellipse"]').click();
    const estado = () => pagina.evaluate(() => ({ ferramenta: S.tool, ligado: document.getElementById('t-shapes').getAttribute('aria-pressed'), icone: document.getElementById('t-shapes').innerHTML }));
    let visto = await estado();
    assert.equal(visto.ferramenta, 'ellipse');
    assert.equal(visto.ligado, 'true');
    assert.match(visto.icone, /<ellipse/);
    // Os atalhos de teclado continuam valendo.
    for (const [tecla, forma, marca] of [['r', 'rect', /<rect/], ['d', 'diamond', /M12 3l9 9/], ['l', 'line', /M5 19L19 5/], ['o', 'ellipse', /<ellipse/]]) {
      await pagina.mouse.click(700, 760);
      await pagina.keyboard.press('Escape');
      await pagina.keyboard.press(tecla);
      visto = await estado();
      assert.equal(visto.ferramenta, forma, `a tecla ${tecla}`);
      assert.match(visto.icone, marca, `o ícone da forma ${forma}`);
    }
    // A tecla A escolhe o laço.
    await pagina.keyboard.press('Escape');
    await pagina.keyboard.press('a');
    assert.equal(await pagina.evaluate(() => S.tool), 'lasso', 'a tecla a');
    await pagina.keyboard.press('Escape');
    await pagina.keyboard.press('s');
    await pagina.locator('#menu [data-sym]').first().waitFor();
    // Um símbolo entra no centro da tela, selecionado.
    await pagina.locator('#menu [data-sym="resistor"]').click();
    await esperar(pagina, () => [...S.items.values()].some((it) => it.sym === 'resistor'));
    assert.equal(await pagina.evaluate(() => S.tool), 'select');
    assert.equal(await pagina.evaluate(() => S.items.get([...S.sel][0]).sym), 'resistor');
    assert.deepEqual(erros, []);
    await contexto.close();
  }
});

// Cria, em coordenadas de tela, os itens que o laço vai circular: dois traços e dois cartões.
async function montarCenaDoLaco(pagina) {
  await pagina.evaluate(() => prancheta.definirTinta('nativa'));
  const ids = await pagina.evaluate(() => {
    const tracar = (x0, y0, x1, y1) => prancheta.receberTraco(Array.from({ length: 21 }, (_, i) => ({ x: x0 + ((x1 - x0) * i) / 20, y: y0 + ((y1 - y0) * i) / 20, p: 0.5, t: 1000 + i * 10 })));
    const antes = new Set(S.items.keys());
    tracar(550, 300, 650, 320); // inteiro dentro do laço
    const a = [...S.items.keys()].find((id) => !antes.has(id));
    tracar(850, 400, 1100, 420); // só a ponta dentro
    const b = [...S.items.keys()].find((id) => !antes.has(id) && id !== a);
    const cartao = (cx, cy, texto) => { const w = toWorld(cx, cy); begin(); const it = add({ type: 'card', x: Math.round(w.x - 80), y: Math.round(w.y - 25), w: 160, h: 50, blocks: [{ h: texto }], c: 'none' }); commit(); return it.id; };
    const c = cartao(600, 450, 'dentro'); // centro dentro do laço
    const d = cartao(950, 300, 'fora'); // encosta no laço, com o centro fora
    return { a, b, c, d };
  });
  return ids;
}

// Um laço retangular, por padrão de (500, 250) a (900, 550), em pixels de tela, com pontos intermediários.
function contornoDoLaco(x0 = 500, y0 = 250, x1 = 900, y1 = 550) {
  const pts = [];
  for (let x = x0; x <= x1; x += 20) pts.push([x, y0]);
  for (let y = y0; y <= y1; y += 20) pts.push([x1, y]);
  for (let x = x1; x >= x0; x -= 20) pts.push([x, y1]);
  for (let y = y1; y >= y0; y -= 20) pts.push([x0, y]);
  return pts;
}

test('o laço seleciona os traços pela maioria dos pontos e os demais itens pelo centro', async () => {
  const { contexto, pagina, erros } = await abrirNaCasca();
  const ids = await montarCenaDoLaco(pagina);
  await pagina.locator('#t-lasso').click();
  // Com o laço, a caneta age sobre a página em vez de escrever.
  await esperar(pagina, () => window.__chamadas.filter((c) => c[0] === 'canetaEscreve').at(-1)[1] === false);
  // A caneta desenha o laço.
  const cdp = await contexto.newCDPSession(pagina);
  const pts = contornoDoLaco();
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pts[0][0], y: pts[0][1], button: 'left', buttons: 1, clickCount: 1, pointerType: 'pen' });
  for (const [x, y] of pts.slice(1)) await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1, pointerType: 'pen' });
  assert.equal(await pagina.locator('#over .laco path').count(), 1, 'o laço aparece enquanto é desenhado');
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pts.at(-1)[0], y: pts.at(-1)[1], button: 'left', buttons: 0, clickCount: 1, pointerType: 'pen' });
  await esperar(pagina, () => S.sel.size > 0);
  assert.deepEqual((await pagina.evaluate(() => [...S.sel])).sort(), [ids.a, ids.c].sort(), 'só o traço de dentro e o cartão com o centro dentro');
  assert.equal(await pagina.locator('#over .laco').count(), 0, 'o laço some ao soltar');
  assert.equal(await pagina.evaluate(() => S.tool), 'lasso', 'a ferramenta continua o laço');
  // Um dedo também desenha o laço, e Shift soma à seleção com o mouse.
  await pagina.keyboard.press('Escape');
  await pagina.locator('#t-lasso').click();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pts[0][0], y: pts[0][1], id: 1 }] });
  for (const [x, y] of pts.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await esperar(pagina, () => S.sel.size === 2);
  assert.deepEqual((await pagina.evaluate(() => [...S.sel])).sort(), [ids.a, ids.c].sort(), 'o dedo seleciona o mesmo');
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('o que o laço seleciona pode ser movido, copiado e apagado como numa seleção comum', async () => {
  const { contexto, pagina, erros } = await abrirNaCasca();
  const ids = await montarCenaDoLaco(pagina);
  await pagina.locator('#t-lasso').click();
  const pts = contornoDoLaco();
  await pagina.mouse.move(pts[0][0], pts[0][1]);
  await pagina.mouse.down();
  for (const [x, y] of pts.slice(1)) await pagina.mouse.move(x, y);
  await pagina.mouse.up();
  await esperar(pagina, () => S.sel.size === 2);
  const posicoes = () => pagina.evaluate((ids) => { const a = S.items.get(ids.a), c = S.items.get(ids.c); return { a: [a.ox, a.oy], c: [c.x, c.y], k: S.view.k }; }, ids);
  const antes = await posicoes();
  // Arrastar de dentro da seleção, com o laço ativo, move os itens em vez de começar outro laço.
  await pagina.mouse.move(600, 450);
  await pagina.mouse.down();
  for (let i = 1; i <= 10; i++) await pagina.mouse.move(600 + i * 10, 450 + i * 5);
  await pagina.mouse.up();
  const depois = await posicoes();
  const dx = 100 / antes.k, dy = 50 / antes.k;
  assert.ok(Math.abs(depois.c[0] - antes.c[0] - dx) < 2 && Math.abs(depois.c[1] - antes.c[1] - dy) < 2, `o cartão se moveu: ${JSON.stringify([antes, depois])}`);
  assert.ok(Math.abs(depois.a[0] - antes.a[0] - dx) < 2 && Math.abs(depois.a[1] - antes.a[1] - dy) < 2, `o traço se moveu: ${JSON.stringify([antes, depois])}`);
  assert.deepEqual((await pagina.evaluate(() => [...S.sel])).sort(), [ids.a, ids.c].sort(), 'a seleção continua');
  // Copiar e apagar.
  const total = () => pagina.evaluate(() => S.items.size);
  const n = await total();
  await pagina.keyboard.press('Control+d');
  await esperar(pagina, (n) => S.items.size === n + 2, n);
  await pagina.keyboard.press('Delete');
  await esperar(pagina, (n) => S.items.size === n, n);
  await pagina.evaluate(() => select([]));
  await pagina.locator('#t-lasso').click();
  // Um laço só em volta dos itens movidos, longe dos que ficaram fora.
  const outro = contornoDoLaco(620, 330, 820, 560);
  await pagina.mouse.move(outro[0][0], outro[0][1]);
  await pagina.mouse.down();
  for (const [x, y] of outro.slice(1)) await pagina.mouse.move(x, y);
  await pagina.mouse.up();
  await esperar(pagina, () => S.sel.size === 2);
  await pagina.keyboard.press('Delete');
  await esperar(pagina, (ids) => !S.items.has(ids.a) && !S.items.has(ids.c), ids);
  assert.ok(await pagina.evaluate((ids) => S.items.has(ids.b) && S.items.has(ids.d), ids), 'os itens de fora continuam');
  assert.deepEqual(erros, []);
  await contexto.close();
});
