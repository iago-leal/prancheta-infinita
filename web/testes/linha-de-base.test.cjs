// Linha de base: o código do artefato, sem mudanças, no modo local, sem
// window.claude. Executar a partir da raiz do repositório:
// node --test web/testes/*.test.cjs

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const RAIZ = path.join(__dirname, '..');
// Mesma versão que o artefato importa do jsDelivr, já copiada do npm para a casca.
const PERFECT_FREEHAND = path.join(__dirname, '..', '..', 'android', 'app', 'src', 'main', 'assets', 'vendor', 'perfect-freehand', 'index.js');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mp3': 'audio/mpeg' };

let servidor;
let base;
let navegador;

before(async () => {
  servidor = http.createServer((req, res) => {
    let relativo = decodeURIComponent(new URL(req.url, 'http://local').pathname).replace(/^\/+/, '');
    if (relativo === '') relativo = 'index.html';
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

async function abrir(contexto) {
  const pagina = await contexto.newPage();
  const externas = [];
  const erros = [];
  pagina.on('pageerror', (e) => erros.push(e.message));
  await pagina.route('**/*', (rota) => {
    const url = rota.request().url();
    if (url.startsWith(base)) return rota.continue();
    externas.push(url);
    if (url.includes('/perfect-freehand@1.2.2/')) {
      return rota.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(PERFECT_FREEHAND) });
    }
    return rota.abort();
  });
  await pagina.goto(`${base}/index.html`);
  await pagina.waitForFunction(() => window.__booted === true);
  return { pagina, externas, erros };
}

test('abre no modo local, sem window.claude e sem erros', async () => {
  const contexto = await navegador.newContext({ viewport: { width: 1200, height: 800 } });
  const { pagina, externas, erros } = await abrir(contexto);
  assert.equal(await pagina.evaluate(() => typeof window.claude), 'undefined');
  assert.equal(await pagina.locator('#resgate').count(), 0, 'o aviso de resgate não deve aparecer');
  assert.deepEqual(erros, []);
  // Registra as requisições externas para o inventário.
  console.log('requisições externas:', JSON.stringify([...new Set(externas)]));
  await contexto.close();
});

test('cartão e traço criados no modo local continuam lá depois de recarregar', async () => {
  const contexto = await navegador.newContext({ viewport: { width: 1200, height: 800 } });
  const { pagina, erros } = await abrir(contexto);

  // Duplo clique numa área vazia cria um cartão em edição.
  await pagina.mouse.dblclick(700, 450);
  await pagina.keyboard.type('Linha de base');
  await pagina.keyboard.press('Escape');
  await pagina.locator('.card', { hasText: 'Linha de base' }).waitFor();

  // A tecla p ativa a caneta; o traço é feito com o mouse.
  await pagina.mouse.click(1100, 700);
  await pagina.keyboard.press('p');
  await pagina.mouse.move(300, 600);
  await pagina.mouse.down();
  for (let i = 1; i <= 20; i += 1) await pagina.mouse.move(300 + i * 15, 600 + Math.sin(i / 3) * 30);
  await pagina.mouse.up();
  await pagina.waitForFunction(() => document.querySelectorAll('#ink path').length >= 1);

  // A gravação local acontece cerca de 1,3 s depois da última mudança, e
  // cada item é guardado como uma string JSON própria.
  await pagina.waitForFunction(() => {
    const salvo = localStorage.getItem('prancheta.board');
    if (!salvo) return false;
    const itens = JSON.parse(salvo).items.map((it) => (typeof it === 'string' ? JSON.parse(it) : it));
    const temCartao = itens.some((it) => it.type === 'card' && JSON.stringify(it.blocks).includes('Linha de base'));
    return temCartao && itens.some((it) => it.type === 'stroke');
  }, null, { timeout: 5000 });

  await pagina.reload();
  await pagina.waitForFunction(() => window.__booted === true);
  await pagina.locator('.card', { hasText: 'Linha de base' }).waitFor();
  assert.ok((await pagina.locator('#ink path').count()) >= 1, 'o traço deve continuar desenhado');
  assert.deepEqual(erros, []);
  await contexto.close();
});
