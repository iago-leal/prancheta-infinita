// Testa a página de teste da casca no Chromium, simulando a ponte nativa.
// Executar a partir da raiz do repositório: node --test android/testes/*.test.cjs

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const RAIZ = path.join(__dirname, '..', 'app', 'src', 'main', 'assets');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

let servidor;
let base;
let navegador;

before(async () => {
  servidor = http.createServer((req, res) => {
    const relativo = decodeURIComponent(new URL(req.url, 'http://local').pathname).replace(/^\/+/, '');
    const arquivo = path.resolve(RAIZ, relativo);
    if (!arquivo.startsWith(RAIZ + path.sep) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'content-type': TIPOS[path.extname(arquivo)] ?? 'application/octet-stream' });
    fs.createReadStream(arquivo).pipe(res);
  });
  await new Promise((pronto) => servidor.listen(0, '127.0.0.1', pronto));
  base = `http://127.0.0.1:${servidor.address().port}`;
  navegador = await chromium.launch();
});

after(async () => {
  await navegador?.close();
  servidor?.close();
});

async function abrir() {
  const contexto = await navegador.newContext({ viewport: { width: 800, height: 600 }, hasTouch: true });
  const pagina = await contexto.newPage();
  const externas = [];
  const erros = [];
  pagina.on('pageerror', (e) => erros.push(e.message));
  await pagina.route('**/*', (rota) => {
    const url = rota.request().url();
    if (url.startsWith(base)) return rota.continue();
    externas.push(url);
    return rota.abort();
  });
  // Ponte nativa simulada: registra o que a página envia à casca.
  await pagina.addInitScript(() => {
    window.__transformacoes = [];
    window.__areas = [];
    window.__prontas = 0;
    window.Casca = {
      pronta: () => { window.__prontas += 1; },
      transformacao: (json) => { window.__transformacoes.push(JSON.parse(json)); },
      areasReservadas: (json) => { window.__areas.push(JSON.parse(json)); },
    };
  });
  await pagina.goto(`${base}/pagina-teste.html`);
  await pagina.waitForFunction(() => window.prancheta && window.__prontas === 1);
  const cdp = await contexto.newCDPSession(pagina);
  return { contexto, pagina, cdp, externas, erros };
}

// Traço de caneta com pressão, por eventos de entrada do próprio navegador.
async function caneta(cdp, pontos) {
  const evento = (type, [x, y, force], buttons) =>
    cdp.send('Input.dispatchMouseEvent', { type, x, y, force, button: 'left', buttons, clickCount: 1, pointerType: 'pen' });
  await evento('mousePressed', pontos[0], 1);
  for (const p of pontos.slice(1)) await evento('mouseMoved', p, 1);
  await evento('mouseReleased', pontos.at(-1), 0);
}

// Gesto de dois dedos, interpolado entre as posições iniciais e finais.
async function pinca(cdp, inicio, fim, passos = 12) {
  const toques = (pares) => pares.map(([x, y], i) => ({ x, y, id: i + 1 }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: toques(inicio) });
  for (let i = 1; i <= passos; i += 1) {
    const t = i / passos;
    const atual = inicio.map(([x, y], j) => [x + (fim[j][0] - x) * t, y + (fim[j][1] - y) * t]);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: toques(atual) });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

function linha(x0, y0, x1, y1, n, pressao) {
  return Array.from({ length: n + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, pressao]);
}

async function caixaDoTraco(pagina, id) {
  return pagina.evaluate((id) => {
    const r = document.querySelector(`#mundo path[data-id="${id}"]`).getBoundingClientRect();
    return { esquerda: r.left, direita: r.right, topo: r.top, base: r.bottom };
  }, id);
}

function perto(real, esperado, tolerancia, rotulo) {
  assert.ok(Math.abs(real - esperado) <= tolerancia, `${rotulo}: ${real} está a mais de ${tolerancia} de ${esperado}`);
}

test('carrega só com arquivos locais e avisa a casca', async () => {
  const { contexto, pagina, externas, erros } = await abrir();
  assert.deepEqual(externas, []);
  assert.deepEqual(erros, []);
  await pagina.waitForFunction(() => window.__transformacoes.length >= 1);
  assert.deepEqual(await pagina.evaluate(() => window.__transformacoes.at(-1)), { x: 0, y: 0, k: 1 });
  // A barra, com 52 px de altura no topo, é informada como área reservada.
  assert.deepEqual(await pagina.evaluate(() => window.__areas.at(-1)), [{ x: 0, y: 0, largura: 800, altura: 52 }]);
  await contexto.close();
});

test('a casca define a tinta ativa, e a área reservada acompanha o tamanho da tela', async () => {
  const { contexto, pagina } = await abrir();
  assert.equal(await pagina.evaluate(() => window.prancheta.tinta()), 'web');
  await pagina.evaluate(() => window.prancheta.definirTinta('nativa'));
  assert.equal(await pagina.evaluate(() => window.prancheta.tinta()), 'nativa');
  assert.match(await pagina.textContent('#info'), /tinta nativa/);
  await pagina.setViewportSize({ width: 600, height: 500 });
  await pagina.waitForFunction(() => window.__areas.at(-1)?.[0]?.largura === 600);
  await contexto.close();
});

test('a caneta desenha com a perfect-freehand e usa a pressão', async () => {
  const { contexto, pagina, cdp } = await abrir();
  await caneta(cdp, linha(100, 200, 500, 200, 40, 0.15));
  await caneta(cdp, linha(100, 350, 500, 350, 40, 1));
  const tracos = await pagina.evaluate(() => window.prancheta.tracos());
  assert.equal(tracos.length, 2);
  assert.ok(tracos.every((t) => t.origem === 'web'));
  perto(tracos[0].pontos[5][2], 0.15, 0.01, 'pressão registrada no traço leve');
  perto(tracos[1].pontos[5][2], 1, 0.01, 'pressão registrada no traço forte');
  const leve = await caixaDoTraco(pagina, tracos[0].id);
  const forte = await caixaDoTraco(pagina, tracos[1].id);
  const espessuraLeve = leve.base - leve.topo;
  const espessuraForte = forte.base - forte.topo;
  assert.ok(espessuraLeve < espessuraForte * 0.6, `traço leve com ${espessuraLeve}px e forte com ${espessuraForte}px`);
  await contexto.close();
});

test('dois dedos movem e ampliam a área e avisam a casca', async () => {
  const { contexto, pagina, cdp } = await abrir();
  // Os dedos se afastam de 100 para 200 px, e o meio desce de y = 300 para y = 350.
  await pinca(cdp, [[300, 300], [400, 300]], [[250, 350], [450, 350]]);
  const vista = await pagina.evaluate(() => window.prancheta.vista());
  perto(vista.k, 2, 0.01, 'zoom');
  perto(vista.x, 350 - 350 * 2, 0.5, 'deslocamento x');
  perto(vista.y, 350 - 300 * 2, 0.5, 'deslocamento y');
  await pagina.waitForFunction((v) => {
    const ultima = window.__transformacoes.at(-1);
    return ultima && ultima.x === v.x && ultima.y === v.y && ultima.k === v.k;
  }, vista);
  await contexto.close();
});

test('depois de mover e ampliar, traços nativos e da caneta caem sob o ponto de origem', async () => {
  const { contexto, pagina, cdp } = await abrir();
  await pinca(cdp, [[300, 300], [400, 300]], [[250, 350], [450, 350]]);
  const vista = await pagina.evaluate(() => window.prancheta.vista());

  // Traço vindo da casca, como se a camada da Onyx o tivesse capturado.
  const pontosTela = linha(200, 200, 500, 450, 30, 0.5).map(([x, y, p], i) => ({ x, y, p, t: i * 8 }));
  const id = await pagina.evaluate((pontos) => window.prancheta.receberTraco(pontos), pontosTela);
  const nativo = (await pagina.evaluate(() => window.prancheta.tracos())).find((t) => t.id === id);
  assert.equal(nativo.origem, 'nativo');
  pontosTela.forEach((p, i) => {
    perto(nativo.pontos[i][0], (p.x - vista.x) / vista.k, 1e-9, `x do ponto ${i} no quadro`);
    perto(nativo.pontos[i][1], (p.y - vista.y) / vista.k, 1e-9, `y do ponto ${i} no quadro`);
  });
  // O traço desenhado ocupa na tela a mesma região dos pontos recebidos,
  // com folga para a espessura da tinta, que cresce com o zoom.
  const folga = 4 * vista.k + 2;
  const caixa = await caixaDoTraco(pagina, id);
  perto(caixa.esquerda, 200, folga, 'borda esquerda do traço nativo');
  perto(caixa.direita, 500, folga, 'borda direita do traço nativo');
  perto(caixa.topo, 200, folga, 'borda superior do traço nativo');
  perto(caixa.base, 450, folga, 'borda inferior do traço nativo');

  // A tinta web também continua sob a caneta depois do gesto.
  await caneta(cdp, linha(150, 520, 450, 520, 30, 0.5));
  const web = (await pagina.evaluate(() => window.prancheta.tracos())).at(-1);
  const caixaWeb = await caixaDoTraco(pagina, web.id);
  perto(caixaWeb.esquerda, 150, folga, 'borda esquerda do traço da caneta');
  perto(caixaWeb.direita, 450, folga, 'borda direita do traço da caneta');
  perto((caixaWeb.topo + caixaWeb.base) / 2, 520, 1, 'altura do traço da caneta');
  await contexto.close();
});
