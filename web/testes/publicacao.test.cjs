// A Prancheta servida como na VPS, etapa 05 do plano 003: a página, por
// servidor/pagina.cjs, e a sincronização, por servidor/servidor.cjs, no mesmo
// endereço, com /sync/ encaminhado à sincronização, como o Traefik faz.
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
const { carimbarServiceWorker } = require('../montagem/montar.cjs');

const CHAVE = 'chave-de-teste-da-publicacao-0123456789abcdef';
const TELA = { width: 1200, height: 800 };
const APP = path.join(__dirname, '..', 'app');
const dormir = (ms) => new Promise((pronto) => setTimeout(pronto, ms));

let navegador;
before(async () => { navegador = await chromium.launch(); });
after(async () => { await navegador?.close(); });

// Página e sincronização num só endereço, como atrás do Traefik.
async function subirComoNaVps(pastaDaPagina = APP) {
  const armazem = await Armazem.abrir(fs.mkdtempSync(path.join(os.tmpdir(), 'prancheta-vps-')));
  const sincronia = criarServidor({ armazem, chave: CHAVE }).listeners('request')[0];
  const pagina = criarServidorDaPagina({ pasta: pastaDaPagina }).listeners('request')[0];
  const borda = http.createServer((req, res) => (req.url.startsWith('/sync/') ? sincronia : pagina)(req, res));
  await new Promise((pronto) => borda.listen(0, '127.0.0.1', pronto));
  return {
    base: `http://127.0.0.1:${borda.address().port}`,
    armazem,
    fechar: () => new Promise((pronto) => { borda.close(() => pronto()); borda.closeAllConnections(); }),
  };
}

async function abrir(contexto, base) {
  const pagina = await contexto.newPage();
  const erros = [];
  pagina.on('pageerror', (e) => erros.push(e.message));
  await pagina.addInitScript(() => {
    window.__violacoes = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__violacoes.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  await pagina.goto(`${base}/`);
  await pagina.waitForFunction(() => window.__booted === true && navigator.serviceWorker.controller !== null, null, { timeout: 10000 });
  await pagina.waitForFunction(() => document.getElementById('status').textContent === 'Salvo', null, { timeout: 10000 });
  return { pagina, erros };
}

async function aguardar(pagina, funcao, argumento, descricao, timeout = 15000) {
  const fim = Date.now() + timeout;
  for (;;) {
    if (await pagina.evaluate(funcao, argumento)) return;
    if (Date.now() > fim) throw new Error(`não chegou a ${descricao}`);
    await dormir(200);
  }
}

async function criarCartao(pagina, x, y, texto) {
  await pagina.mouse.dblclick(x, y);
  await pagina.keyboard.type(texto);
  await pagina.keyboard.press('Escape');
  await pagina.locator('.card', { hasText: texto }).waitFor();
}

test('servida como na VPS, a Prancheta sincroniza no mesmo endereço e abre sem rede depois da primeira visita', async () => {
  const vps = await subirComoNaVps();
  const contexto = await navegador.newContext({ viewport: TELA });
  try {
    const { pagina, erros } = await abrir(contexto, vps.base);
    await pagina.evaluate(([endereco, chave]) => window.sincronizacaoDaPrancheta.configurar({ endereco, chave }), [vps.base, CHAVE]);
    await criarCartao(pagina, 420, 320, 'Escrito no computador');
    // O cartão chega ao servidor, e nada fica pendente no aparelho.
    for (let fim = Date.now() + 15000; ;) {
      const noServidor = await vps.armazem.listar(0, 500);
      if (noServidor.documentos.some((d) => JSON.stringify(d.registro.dados).includes('Escrito no computador'))) break;
      if (Date.now() > fim) throw new Error('o cartão não chegou ao servidor');
      await dormir(200);
    }
    await aguardar(pagina, async () => {
      const db = await claude.use('db');
      return window.sincronizacaoDaPrancheta.estado.situacao === 'sincronizada' && (await db.mudancas()).length === 0;
    }, null, 'o estado sincronizado');

    // Nada da sincronização passa pelo cache do service worker.
    const guardados = await pagina.evaluate(async () => {
      const urls = [];
      for (const nome of await caches.keys()) for (const r of await (await caches.open(nome)).keys()) urls.push(r.url);
      return urls;
    });
    assert.ok(guardados.some((u) => u.endsWith('/index.html')));
    assert.deepEqual(guardados.filter((u) => u.includes('/sync/')), []);

    // Sem rede, a página abre da cópia guardada, com o cartão.
    await contexto.setOffline(true);
    await pagina.reload();
    await pagina.waitForFunction(() => window.__booted === true, null, { timeout: 10000 });
    await pagina.locator('.card', { hasText: 'Escrito no computador' }).waitFor();
    assert.deepEqual(await pagina.evaluate(() => window.__violacoes), []);
    assert.deepEqual(erros, []);
  } finally {
    await contexto.close();
    await vps.fechar();
  }
});

test('uma versão nova da página só entra quando o autor pede', async () => {
  const copia = fs.mkdtempSync(path.join(os.tmpdir(), 'prancheta-app-'));
  fs.cpSync(APP, copia, { recursive: true });
  const vps = await subirComoNaVps(copia);
  const contexto = await navegador.newContext({ viewport: TELA });
  try {
    const { pagina, erros } = await abrir(contexto, vps.base);
    assert.equal(await pagina.title(), 'Prancheta Infinita');

    // Uma versão nova é publicada: outro título, e a VERSAO carimbada de novo.
    const indice = path.join(copia, 'index.html');
    fs.writeFileSync(indice, fs.readFileSync(indice, 'utf8').replace('<title>Prancheta Infinita</title>', '<title>Prancheta Infinita nova</title>'));
    const sw = path.join(copia, 'sw.js');
    fs.writeFileSync(sw, carimbarServiceWorker(fs.readFileSync(sw, 'utf8'), (nome) => fs.readFileSync(path.join(copia, nome))));

    // Recarregar continua na versão guardada; a nova é baixada e anunciada.
    await pagina.reload();
    await pagina.waitForFunction(() => window.__booted === true, null, { timeout: 10000 });
    assert.equal(await pagina.title(), 'Prancheta Infinita');
    await pagina.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));
    await pagina.locator('#versaoNova').waitFor({ timeout: 15000 });
    assert.equal(await pagina.title(), 'Prancheta Infinita');

    // O autor toca no aviso, e a página recarrega com a versão nova.
    await Promise.all([pagina.waitForEvent('load', { timeout: 15000 }), pagina.click('#versaoNova')]);
    await pagina.waitForFunction(() => document.title === 'Prancheta Infinita nova', null, { timeout: 10000 });
    assert.deepEqual(erros, []);
  } finally {
    await contexto.close();
    await vps.fechar();
  }
});

test('os arquivos enviados são entregues isolados da página que guarda a chave', async () => {
  const vps = await subirComoNaVps();
  const contexto = await navegador.newContext({ viewport: TELA, acceptDownloads: true });
  try {
    const { pagina, erros } = await abrir(contexto, vps.base);
    const r = await pagina.evaluate(async () => {
      const assets = await claude.use('assets');
      const html = (await assets.upload(new Blob(['<script>localStorage.setItem("invadiu", "1")</script>'], { type: 'Text/HTML; charset=utf-8' }))).id;
      const png = (await assets.upload(new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }))).id;
      const estranho = (await assets.upload(new Blob(['x'], { type: '<b>tipo</b>' }))).id;
      const cabecalhos = async (id) => {
        const resposta = await fetch(`/_blob/${id}`);
        return ['content-type', 'content-disposition', 'content-security-policy', 'x-content-type-options'].map((n) => resposta.headers.get(n));
      };
      return { html, cabecalhosHtml: await cabecalhos(html), cabecalhosPng: await cabecalhos(png), cabecalhosEstranho: await cabecalhos(estranho) };
    });
    assert.deepEqual(r.cabecalhosHtml.slice(0, 2), ['text/html', 'attachment']);
    assert.match(r.cabecalhosHtml[2], /^sandbox/);
    assert.equal(r.cabecalhosHtml[3], 'nosniff');
    assert.deepEqual(r.cabecalhosPng.slice(0, 2), ['image/png', 'inline']);
    assert.deepEqual(r.cabecalhosEstranho.slice(0, 2), ['application/octet-stream', 'attachment']);

    // Abrir o arquivo HTML pelo endereço não executa o script na origem da página.
    const aba = await contexto.newPage();
    await aba.goto(`${vps.base}/_blob/${r.html}`).catch(() => {});
    await dormir(500);
    assert.equal(await pagina.evaluate(() => localStorage.getItem('invadiu')), null);
    assert.deepEqual(erros, []);
  } finally {
    await contexto.close();
    await vps.fechar();
  }
});
