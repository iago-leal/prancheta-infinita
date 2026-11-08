// Prancheta independente da etapa 06 do plano 002, em web/app/: o código do
// artefato ligado ao banco local pelo cliente de compatibilidade.
// Executar a partir da raiz do repositório: node --test web/testes/*.test.cjs

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const { chromium } = require('playwright');
const { servirWeb } = require('./apoio/servidor.cjs');
const { montar, carimbarServiceWorker, DESTINO, SERVICE_WORKER } = require('../montagem/montar.cjs');
const mudancas = require('../montagem/mudancas.cjs');

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

// Registra, em todo o contexto, os pedidos que saem da origem da página,
// inclusive os do service worker.
function registrarExternas(contexto, base) {
  const externas = [];
  contexto.on('request', (pedido) => {
    const url = pedido.url();
    if (!url.startsWith(base) && !url.startsWith('blob:') && !url.startsWith('data:')) externas.push(url);
  });
  return externas;
}

// Abre a Prancheta e espera o service worker assumir a página e o banco local
// entregar o quadro, o que o artefato indica com o estado "Salvo".
async function abrirApp(contexto, base) {
  const pagina = await contexto.newPage();
  const erros = [];
  pagina.on('pageerror', (e) => erros.push(e.message));
  pagina.on('console', (m) => { if (m.type() === 'error') erros.push(`console: ${m.text()} (${m.location().url})`); });
  await pagina.goto(`${base}/app/index.html`);
  await esperar(pagina, () => window.__booted === true);
  await esperar(pagina, () => navigator.serviceWorker.controller !== null);
  await esperar(pagina, () => document.getElementById('status').textContent === 'Salvo');
  return { pagina, erros };
}

// Lê do banco local todos os itens do quadro principal.
function itensNoBanco(pagina) {
  return pagina.evaluate(async () => {
    const db = await claude.use('db');
    const fragmentos = await db.collection('canvas-shards').get();
    return fragmentos.docs.flatMap((d) => d.data().items || []);
  });
}

// Consulta o banco até a condição, avaliada no Node, ser verdadeira. A espera
// do Playwright não serve aqui: ela não aguarda funções assíncronas da página.
async function aguardarItens(pagina, condicao, timeout = 15000) {
  const fim = Date.now() + timeout;
  for (;;) {
    const itens = await itensNoBanco(pagina);
    if (condicao(itens)) return itens;
    if (Date.now() > fim) throw new Error(`o banco não chegou ao estado esperado: ${JSON.stringify(itens.map((it) => it.type))}`);
    await new Promise((pronto) => setTimeout(pronto, 200));
  }
}

async function criarCartao(pagina, x, y, texto) {
  await pagina.mouse.dblclick(x, y);
  await pagina.keyboard.type(texto);
  await pagina.keyboard.press('Escape');
  await pagina.locator('.card', { hasText: texto }).waitFor();
}

function pngVermelho(pagina) {
  return pagina.evaluate(() => {
    const tela = document.createElement('canvas');
    tela.width = 64;
    tela.height = 48;
    const g = tela.getContext('2d');
    g.fillStyle = 'rgb(204, 51, 51)';
    g.fillRect(0, 0, 64, 48);
    return tela.toDataURL('image/png').split(',')[1];
  }).then((b64) => Buffer.from(b64, 'base64'));
}

// Um PDF mínimo, de uma página; o pdf.js reconstrói a tabela de referências.
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 100]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');

test('a página independente é o original com as mudanças listadas, cada uma com motivo', () => {
  assert.equal(fs.readFileSync(DESTINO, 'utf8'), montar(), 'web/app/index.html difere da montagem; rode node web/montagem/montar.cjs');
  // A versão do cache do service worker corresponde aos arquivos que ele guarda.
  const sw = fs.readFileSync(SERVICE_WORKER, 'utf8');
  assert.equal(sw, carimbarServiceWorker(sw), 'a VERSAO de web/app/sw.js está desatualizada; rode node web/montagem/montar.cjs');
  assert.equal(mudancas.length, 10);
  for (const m of mudancas) assert.ok(m.motivo.length > 40, `motivo curto: ${m.motivo}`);
  // Os endereços externos que a página carregava não aparecem mais. Restam
  // citações a CDNs só nos desenhos por código e nas instruções da conversa,
  // que dependem da conversa com o Claude.
  const app = fs.readFileSync(DESTINO, 'utf8');
  for (const externo of ['href="https://fonts.', 'https://cdn.jsdelivr.net/npm/perfect-freehand', 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js', 'https://cdnjs.cloudflare.com/ajax/libs/mammoth']) {
    assert.ok(!app.includes(externo), `a página ainda carrega ${externo}`);
  }
  // O montador recusa mudanças sem motivo e trechos ausentes ou repetidos.
  assert.throws(() => montar('aba', [{ motivo: 'x', de: 'z', para: 'y' }]), /aparece 0 vezes/);
  assert.throws(() => montar('aba', [{ motivo: 'x', de: 'a', para: 'y' }]), /aparece 2 vezes/);
  assert.throws(() => montar('aba', [{ motivo: '', de: 'b', para: 'y' }]), /sem motivo/);
});

test('abre com o banco local e recursos sem rede, sem requisições externas e sem erros', async () => {
  const contexto = await navegador.newContext({ viewport: TELA });
  const externas = registrarExternas(contexto, servidor.base);
  const { pagina, erros } = await abrirApp(contexto, servidor.base);
  await contexto.setOffline(true);
  const r = await pagina.evaluate(async () => {
    const codigo = (p) => p.then(() => null, (e) => e.code);
    const [db, assets, downloads, user, permissions] = await Promise.all(['db', 'assets', 'downloads', 'user', 'permissions'].map((n) => claude.use(n)));
    await db.doc('teste/sem-rede').set({ ok: true });
    const { id } = await assets.upload(new Blob(['conteúdo do arquivo'], { type: 'text/plain' }));
    const servido = await fetch(`/_blob/${id}`);
    return {
      db: typeof db.doc === 'function' && typeof db.collection === 'function' && (await db.doc('teste/sem-rede').get()).data().ok,
      arquivo: { status: servido.status, tipo: servido.headers.get('content-type'), texto: await servido.text() },
      inexistente: (await fetch('/_blob/0123456789abcdef')).status,
      downloads: typeof downloads.save,
      user: { id: await user.id(), canEdit: await user.canEdit() },
      permissions: { request: await permissions.request(['mcp']), manage: typeof permissions.manage },
      semEquivalente: await Promise.all(['sample', 'mcp', 'artifact', 'comments', 'outro'].map((n) => codigo(claude.use(n)))),
      fonte: document.fonts.check('16px Inter') && [...document.fonts].some((f) => f.family === 'Inter' && f.status === 'loaded'),
    };
  });
  assert.equal(r.db, true);
  assert.deepEqual(r.arquivo, { status: 200, tipo: 'text/plain', texto: 'conteúdo do arquivo' });
  assert.equal(r.inexistente, 404);
  assert.equal(r.downloads, 'function');
  assert.deepEqual(r.user, { id: 'autor', canEdit: true });
  assert.deepEqual(r.permissions, { request: { granted: [] }, manage: 'function' });
  assert.deepEqual(r.semEquivalente, Array(5).fill('unavailable'));
  assert.equal(r.fonte, true, 'a fonte Inter local deve estar carregada');

  // O pdf.js e o mammoth, das prévias, vêm de vendor/, e o pdf.js abre um PDF sem rede.
  const bibliotecas = await pagina.evaluate(async (pdf) => {
    await loadScript(PDFJS + 'pdf.min.js');
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
    const documento = await pdfjsLib.getDocument({ data: Uint8Array.from(atob(pdf), (c) => c.charCodeAt(0)), isEvalSupported: false }).promise;
    await loadScript(MAMMOTH);
    return { paginas: documento.numPages, mammoth: typeof mammoth.convertToHtml };
  }, PDF.toString('base64'));
  assert.deepEqual(bibliotecas, { paginas: 1, mammoth: 'function' });
  assert.deepEqual(externas, []);
  // O único erro esperado é o 404 do arquivo inexistente, pedido de propósito.
  assert.deepEqual(erros.filter((e) => !e.includes('/_blob/0123456789abcdef')), []);
  await contexto.close();
});

test('esconde o que depende da conversa, dos conectores, dos comentários e da autopublicação', async () => {
  const contexto = await navegador.newContext({ viewport: TELA, acceptDownloads: true });
  const externas = registrarExternas(contexto, servidor.base);
  const { pagina, erros } = await abrirApp(contexto, servidor.base);
  await contexto.setOffline(true);

  // A conversa não aparece, nem pelo botão nem pelo atalho.
  assert.equal(await pagina.locator('#bChat').isHidden(), true);
  await pagina.mouse.click(1000, 650);
  await pagina.keyboard.press('c');
  assert.equal(await pagina.locator('#chat').isHidden(), true);

  // O menu não oferece permissões de conectores nem restauração do código.
  await pagina.locator('#bMore').click();
  const menu = await pagina.locator('#menu').innerText();
  assert.match(menu, /Exportar como PNG/);
  assert.doesNotMatch(menu, /Permissões dos conectores|Restaurar versão anterior/);

  // Exportar como PNG baixa o arquivo pelo próprio navegador, sem rede; o
  // artefato só exporta quadros com algum item.
  await pagina.keyboard.press('Escape');
  await criarCartao(pagina, 400, 300, 'Para exportar');
  await pagina.locator('#bMore').click();
  const [baixado] = await Promise.all([pagina.waitForEvent('download'), pagina.locator('#menu').getByText('Exportar como PNG').click()]);
  assert.match(baixado.suggestedFilename(), /\.png$/);
  const caminho = await baixado.path();
  assert.deepEqual([...fs.readFileSync(caminho).subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);

  // Um arquivo enviado mostra só o tamanho, sem marca nem ação do Drive.
  await pagina.locator('#fileInput').setInputFiles({ name: 'documento.pdf', mimeType: 'application/pdf', buffer: PDF });
  const cartao = pagina.locator('.card.v-file', { hasText: 'documento.pdf' });
  await cartao.waitFor();
  await esperar(pagina, () => !document.body.innerText.includes('Enviando…'));
  assert.doesNotMatch(await cartao.innerText(), /Drive/);
  // A prévia do PDF abre sem rede, com o pdf.js local, e sem ação do Drive.
  await cartao.dblclick();
  await esperar(pagina, () => /1 página/.test(document.getElementById('prevSub').textContent));
  const acoes = await pagina.locator('#prevActs').innerText();
  assert.doesNotMatch(acoes, /Drive/);
  assert.match(acoes, /Baixar/);
  assert.deepEqual(externas, []);
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('cria cartão, seta, traço e imagem com o servidor da página fora do ar, e tudo persiste ao recarregar', async () => {
  const proprio = await servirWeb();
  const contexto = await navegador.newContext({ viewport: TELA });
  const externas = registrarExternas(contexto, proprio.base);
  try {
    const { pagina, erros } = await abrirApp(contexto, proprio.base);
    const png = await pngVermelho(pagina);

    // Daqui em diante, o servidor que entrega a página não responde mais.
    await proprio.fechar();
    const recusado = await new Promise((pronto) => {
      http.get(`${proprio.base}/app/index.html`, () => pronto(false)).on('error', () => pronto(true));
    });
    assert.equal(recusado, true, 'o servidor deveria estar inacessível');

    await criarCartao(pagina, 350, 300, 'Cartão sem rede');
    // A seta nasce do puxador direito do cartão e cria o cartão de destino.
    const origem = pagina.locator('.card', { hasText: 'Cartão sem rede' });
    const caixa = await origem.boundingBox();
    await pagina.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
    const puxador = await origem.locator('.h[data-s="r"]').boundingBox();
    await pagina.mouse.move(puxador.x + puxador.width / 2, puxador.y + puxador.height / 2);
    await pagina.mouse.down();
    for (let i = 1; i <= 10; i++) await pagina.mouse.move(puxador.x + i * 30, puxador.y + puxador.height / 2);
    await pagina.mouse.up();
    await pagina.keyboard.type('Destino da seta');
    await pagina.keyboard.press('Escape');
    await pagina.locator('.card', { hasText: 'Destino da seta' }).waitFor();

    // O traço, com a caneta.
    await pagina.mouse.click(1100, 720);
    await pagina.keyboard.press('p');
    await pagina.mouse.move(300, 560);
    await pagina.mouse.down();
    for (let i = 1; i <= 20; i++) await pagina.mouse.move(300 + i * 15, 560 + Math.sin(i / 3) * 30);
    await pagina.mouse.up();
    await pagina.keyboard.press('v');

    // A imagem, enviada pelo seletor de arquivos e guardada no banco local.
    await pagina.locator('#imgInput').setInputFiles({ name: 'quadrado.png', mimeType: 'image/png', buffer: png });

    const gravados = await aguardarItens(pagina, (itens) => {
      const tipos = new Set(itens.map((it) => it.type));
      return ['card', 'edge', 'stroke', 'image'].every((t) => tipos.has(t)) && itens.some((it) => it.type === 'image' && it.asset);
    });
    await esperar(pagina, () => document.getElementById('status').textContent === 'Salvo');
    const cartoes = gravados.filter((it) => it.type === 'card');
    const seta = gravados.find((it) => it.type === 'edge');
    assert.equal(cartoes.length, 2);
    assert.deepEqual(new Set([seta.a.id, seta.b.id]), new Set(cartoes.map((c) => c.id)), 'a seta liga os dois cartões');
    // Cada traço guarda o horário de início e a duração.
    const tracoGravado = gravados.find((it) => it.type === 'stroke');
    assert.ok(tracoGravado.em > Date.now() - 120000 && tracoGravado.em <= Date.now(), `horário ${tracoGravado.em}`);
    assert.ok(tracoGravado.dur > 0, `duração ${tracoGravado.dur}`);
    const imagem = gravados.find((it) => it.type === 'image');
    assert.match(imagem.asset, /^[\w-]{8,64}$/);
    assert.equal(imagem.src, undefined, 'a imagem fica no banco local, e não embutida no quadro');

    // Na recarga, o localStorage é apagado antes do código do artefato rodar,
    // para que o quadro só possa vir do banco local.
    await pagina.addInitScript(() => localStorage.clear());
    await pagina.reload();
    await esperar(pagina, () => window.__booted === true);
    await pagina.locator('.card', { hasText: 'Cartão sem rede' }).waitFor();
    await pagina.locator('.card', { hasText: 'Destino da seta' }).waitFor();
    await esperar(pagina, () => document.querySelectorAll('#ink path').length >= 1 && document.querySelectorAll('#edges path').length >= 1);
    const figura = await pagina.evaluate(async () => {
      const img = [...document.querySelectorAll('#world img')].find((i) => i.getAttribute('src')?.startsWith('/_blob/'));
      if (!img) return null;
      await img.decode();
      return { largura: img.naturalWidth, altura: img.naturalHeight };
    });
    assert.deepEqual(figura, { largura: 64, altura: 48 });
    assert.deepEqual(externas, []);
    assert.deepEqual(erros, []);
  } finally {
    await contexto.close();
    await proprio.fechar();
  }
});

test('duas abas abertas no mesmo quadro veem as mudanças uma da outra', async () => {
  const contexto = await navegador.newContext({ viewport: TELA });
  const a = await abrirApp(contexto, servidor.base);
  const b = await abrirApp(contexto, servidor.base);

  await criarCartao(a.pagina, 350, 300, 'Escrito na aba A');
  await b.pagina.locator('.card', { hasText: 'Escrito na aba A' }).waitFor({ timeout: 8000 });

  await criarCartao(b.pagina, 700, 450, 'Escrito na aba B');
  await a.pagina.locator('.card', { hasText: 'Escrito na aba B' }).waitFor({ timeout: 8000 });

  // Apagar na aba A também some na aba B.
  await a.pagina.locator('.card', { hasText: 'Escrito na aba A' }).click();
  await a.pagina.keyboard.press('Delete');
  await b.pagina.locator('.card', { hasText: 'Escrito na aba A' }).waitFor({ state: 'detached', timeout: 8000 });
  assert.equal(await b.pagina.locator('.card', { hasText: 'Escrito na aba B' }).count(), 1);
  assert.deepEqual([...a.erros, ...b.erros], []);
  await contexto.close();
});

test('sem service worker, as imagens ficam embutidas no quadro e continuam visíveis', async () => {
  // Sem service worker, não há quem entregue /_blob/<id>; o recurso assets é
  // recusado, e o artefato embute a imagem reduzida no próprio quadro.
  const contexto = await navegador.newContext({ viewport: TELA, serviceWorkers: 'block' });
  const pagina = await contexto.newPage();
  const erros = [];
  pagina.on('pageerror', (e) => erros.push(e.message));
  await pagina.goto(`${servidor.base}/app/index.html`);
  await esperar(pagina, () => window.__booted === true);
  await esperar(pagina, () => document.getElementById('status').textContent === 'Salvo');
  assert.equal(await pagina.evaluate(() => claude.use('assets').then(() => 'entregue', (e) => e.code)), 'unavailable');
  await pagina.locator('#imgInput').setInputFiles({ name: 'quadrado.png', mimeType: 'image/png', buffer: await pngVermelho(pagina) });
  const imagem = (await aguardarItens(pagina, (itens) => itens.some((it) => it.type === 'image'))).find((it) => it.type === 'image');
  assert.equal(imagem.asset, undefined);
  assert.match(imagem.src, /^data:image\//);
  await pagina.reload();
  await esperar(pagina, () => window.__booted === true);
  const largura = await pagina.evaluate(async () => {
    const img = await new Promise((pronto) => {
      const procurar = () => { const i = document.querySelector('#world img[src^="data:image/"]'); if (i) pronto(i); else setTimeout(procurar, 50); };
      procurar();
    });
    await img.decode();
    return img.naturalWidth;
  });
  assert.equal(largura, 64);
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('o aviso de falha na inicialização oferece recarregar, sem depender da autopublicação', async () => {
  const contexto = await navegador.newContext({ viewport: TELA });
  const pagina = await contexto.newPage();
  // Simula uma falha no fim da inicialização: gravar window.__booted lança um erro.
  await pagina.addInitScript(() => {
    Object.defineProperty(window, '__booted', { configurable: true, get: () => undefined, set: () => { throw new Error('falha simulada'); } });
  });
  await pagina.goto(`${servidor.base}/app/index.html`);
  const aviso = pagina.locator('#resgate');
  await aviso.waitFor();
  assert.match(await aviso.innerText(), /Esta versão do código não iniciou\. Seus quadros estão a salvo\./);
  assert.doesNotMatch(await aviso.innerText(), /Restaurar|Claude/);
  const [navegacao] = await Promise.all([
    pagina.waitForEvent('framenavigated'),
    aviso.getByRole('button', { name: 'Recarregar' }).click(),
  ]);
  assert.equal(navegacao.url(), `${servidor.base}/app/index.html`);
  await contexto.close();
});
