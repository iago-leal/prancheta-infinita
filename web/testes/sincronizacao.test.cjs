// Sincronização do banco local com o servidor, etapa 04 do plano 003: dois
// perfis do Chromium, cada um com o próprio banco, conversam com o servidor
// de servidor/, como o Boox e o computador.
// Executar a partir da raiz do repositório: node --test web/testes/*.test.cjs

'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');
const { servirWeb } = require('./apoio/servidor.cjs');
const { Armazem } = require('../../servidor/armazem.cjs');
const { criarServidor } = require('../../servidor/servidor.cjs');

const CHAVE = 'chave-de-teste-da-sincronizacao-0123456789abcdef';
const TELA = { width: 1200, height: 800 };

let web;
// Servidor de sincronização do teste em andamento; cada teste começa com um vazio.
let sinc;

before(async () => {
  web = await servirWeb();
});

after(async () => {
  await web?.fechar();
});

async function subirServidor() {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'prancheta-sinc-'));
  const armazem = await Armazem.abrir(pasta);
  const servidor = criarServidor({ armazem, chave: CHAVE, origens: [web.base] });
  await new Promise((pronto) => servidor.listen(0, '127.0.0.1', pronto));
  sinc = {
    base: `http://127.0.0.1:${servidor.address().port}`,
    armazem,
    fechar: () => new Promise((pronto) => {
      servidor.close(() => pronto());
      servidor.closeAllConnections();
      fs.rmSync(pasta, { recursive: true, force: true });
    }),
  };
}

const dormir = (ms) => new Promise((pronto) => setTimeout(pronto, ms));

// Dois perfis de navegador, cada um com a própria pasta de dados, como dois
// aparelhos. Os intervalos da sincronização são encurtados para o teste.
async function abrirPerfis(quantos = 2, opcoes = { intervalo: 1000, esperaDepoisDeGravar: 300 }) {
  await subirServidor();
  const perfis = [];
  for (let i = 0; i < quantos; i++) {
    const pasta = fs.mkdtempSync(path.join(os.tmpdir(), `prancheta-perfil-${i}-`));
    const contexto = await chromium.launchPersistentContext(pasta, { viewport: TELA });
    await contexto.addInitScript((o) => {
      window.opcoesDaSincronizacao = o;
    }, opcoes);
    perfis.push({ contexto, pasta });
  }
  return perfis;
}

async function fecharPerfis(perfis) {
  for (const p of perfis) {
    await p.contexto.close().catch(() => {});
    fs.rmSync(p.pasta, { recursive: true, force: true });
  }
  await sinc.fechar();
}

async function abrirApp(contexto) {
  const pagina = contexto.pages()[0] || await contexto.newPage();
  const erros = [];
  pagina.on('pageerror', (e) => erros.push(e.message));
  await pagina.goto(`${web.base}/app/index.html`);
  await pagina.waitForFunction(() => window.__booted === true && document.getElementById('status').textContent === 'Salvo', null, { timeout: 10000 });
  await pagina.waitForFunction(() => Boolean(window.sincronizacaoDaPrancheta && document.getElementById('sinc')), null, { timeout: 10000 });
  return { pagina, erros };
}

// Consulta a página até a função, que pode ser assíncrona, devolver um valor
// verdadeiro; a espera do Playwright não aguarda funções assíncronas.
async function aguardar(pagina, funcao, argumento, { timeout = 20000, descricao = 'a condição' } = {}) {
  const fim = Date.now() + timeout;
  for (;;) {
    const valor = await pagina.evaluate(funcao, argumento);
    if (valor) return valor;
    if (Date.now() > fim) throw new Error(`não chegou a ${descricao}`);
    await dormir(200);
  }
}

// Sincronizado e sem nada pendente no registro de mudanças.
function aguardarSincronizado(pagina) {
  return aguardar(pagina, async () => {
    const s = window.sincronizacaoDaPrancheta;
    if (!s || s.estado.situacao !== 'sincronizada') return false;
    const db = await claude.use('db');
    return (await db.mudancas()).length === 0;
  }, null, { descricao: 'o estado sincronizado, sem mudanças pendentes' });
}

function textosNoBanco(pagina, colecao = 'canvas-shards') {
  return pagina.evaluate(async (c) => {
    const db = await claude.use('db');
    const fragmentos = await db.collection(c).get();
    return fragmentos.docs.flatMap((d) => d.data().items || []).filter((it) => it.type === 'card')
      .map((it) => (it.blocks || []).map((b) => b.h).join(' ')).sort();
  }, colecao);
}

async function aguardarTextos(pagina, esperados, colecao) {
  const fim = Date.now() + 20000;
  let textos;
  for (;;) {
    textos = await textosNoBanco(pagina, colecao);
    if (JSON.stringify(textos) === JSON.stringify([...esperados].sort())) return textos;
    if (Date.now() > fim) throw new Error(`o banco tem ${JSON.stringify(textos)}, e não ${JSON.stringify(esperados)}`);
    await dormir(200);
  }
}

async function configurarPelaInterface(pagina) {
  await pagina.click('#sinc');
  await pagina.fill('#sincDialogo input[name=endereco]', sinc.base);
  await pagina.fill('#sincDialogo input[name=chave]', CHAVE);
  await pagina.click('#sincDialogo button[type=submit]');
  await pagina.waitForFunction(() => document.getElementById('sinc').textContent === 'Sincronizado', null, { timeout: 15000 });
}

async function criarCartao(pagina, x, y, texto) {
  await pagina.mouse.dblclick(x, y);
  await pagina.keyboard.type(texto);
  await pagina.keyboard.press('Escape');
  await pagina.locator('.card', { hasText: texto }).waitFor();
}

// Seleciona o cartão com um clique, entra na edição com Enter e troca o texto.
async function editarCartao(pagina, textoAtual, novoTexto) {
  await pagina.keyboard.press('Escape');
  await pagina.locator('.card', { hasText: textoAtual }).click();
  await pagina.keyboard.press('Enter');
  await pagina.keyboard.press('Control+A');
  await pagina.keyboard.type(novoTexto);
  await pagina.keyboard.press('Escape');
  await pagina.locator('.card', { hasText: novoTexto }).waitFor();
}

test('um quadro feito num perfil aparece no outro, com o servidor informado uma vez em cada um', async () => {
  const perfis = await abrirPerfis();
  try {
    const a = await abrirApp(perfis[0].contexto);
    assert.equal(await a.pagina.textContent('#sinc'), 'Sincronizar');
    await configurarPelaInterface(a.pagina);
    await criarCartao(a.pagina, 420, 320, 'Cartão do perfil A');
    // Um arquivo enviado, como uma imagem colada no quadro.
    const arquivo = await a.pagina.evaluate(async () => {
      const assets = await claude.use('assets');
      const bytes = new Uint8Array(3000).map((_, i) => i % 251);
      return (await assets.upload(new Blob([bytes], { type: 'image/png' }), { type: 'image/png' })).id;
    });
    const quadro = await a.pagina.evaluate(() => newBoard(null, 'Plano de estudos').then((b) => b.id));
    await criarCartao(a.pagina, 520, 420, 'No quadro novo');
    await aguardarSincronizado(a.pagina);

    // O registro de mudanças foi podado depois que o servidor confirmou tudo.
    assert.equal(await a.pagina.evaluate(async () => (await (await claude.use('db')).mudancas()).length), 0);
    assert.ok(sinc.armazem.posicao > 0);

    const b = await abrirApp(perfis[1].contexto);
    await configurarPelaInterface(b.pagina);
    await aguardarTextos(b.pagina, ['Cartão do perfil A']);
    await b.pagina.locator('.card', { hasText: 'Cartão do perfil A' }).waitFor();
    await b.pagina.locator('#tree', { hasText: 'Plano de estudos' }).waitFor();
    await b.pagina.evaluate((id) => openBoard(id), quadro);
    await b.pagina.locator('.card', { hasText: 'No quadro novo' }).waitFor();
    // O arquivo chegou ao banco do perfil B, e o service worker o entrega em /_blob/<id>.
    await aguardar(b.pagina, async (id) => Boolean(await (await claude.use('db')).lerArquivo(id)), arquivo, { descricao: 'o arquivo no perfil B' });
    const entregue = await b.pagina.evaluate(async (id) => {
      const r = await fetch(`/_blob/${id}`);
      const bytes = new Uint8Array(await r.arrayBuffer());
      return { status: r.status, tipo: r.headers.get('content-type'), tamanho: bytes.length, confere: bytes.every((x, i) => x === i % 251) };
    }, arquivo);
    assert.deepEqual(entregue, { status: 200, tipo: 'image/png', tamanho: 3000, confere: true });

    // O servidor e a chave ficam no banco local de cada perfil: ao reabrir, a
    // sincronização continua sem pedir de novo, e a chave não vai para o localStorage.
    await a.pagina.reload();
    await a.pagina.waitForFunction(() => window.__booted === true && Boolean(window.sincronizacaoDaPrancheta), null, { timeout: 10000 });
    await a.pagina.waitForFunction(() => document.getElementById('sinc')?.textContent === 'Sincronizado', null, { timeout: 15000 });
    const guardada = await a.pagina.evaluate(async () => (await claude.use('db'))._lerMeta('sinc:servidor'));
    assert.equal(guardada.endereco, sinc.base);
    assert.equal(guardada.chaveDeAcesso, CHAVE);
    assert.ok(!(await a.pagina.evaluate(() => JSON.stringify(localStorage))).includes(CHAVE));
    assert.deepEqual([...a.erros, ...b.erros], []);
  } finally {
    await fecharPerfis(perfis);
  }
});

test('edições simultâneas no mesmo fragmento, feitas sem rede, se combinam sem perder itens', async () => {
  const perfis = await abrirPerfis();
  try {
    const a = await abrirApp(perfis[0].contexto);
    const b = await abrirApp(perfis[1].contexto);
    for (const { pagina } of [a, b]) {
      await pagina.evaluate(([endereco, chave]) => window.sincronizacaoDaPrancheta.configurar({ endereco, chave }), [sinc.base, CHAVE]);
    }
    await criarCartao(a.pagina, 420, 320, 'Ideia original');
    await aguardarSincronizado(a.pagina);
    await aguardarTextos(b.pagina, ['Ideia original']);
    await b.pagina.locator('.card', { hasText: 'Ideia original' }).waitFor();

    // Sem rede nos dois perfis: o perfil A acrescenta um cartão ao fragmento
    // dele, e o perfil B edita o cartão do A, no mesmo fragmento, e cria outro.
    await perfis[0].contexto.setOffline(true);
    await perfis[1].contexto.setOffline(true);
    await criarCartao(a.pagina, 420, 480, 'Novo no A');
    await editarCartao(b.pagina, 'Ideia original', 'Ideia revista no B');
    await criarCartao(b.pagina, 700, 480, 'Novo no B');
    for (const { pagina } of [a, b]) {
      await pagina.waitForFunction(() => document.getElementById('sinc').textContent === 'Sem rede', null, { timeout: 15000 });
    }
    // A Prancheta segue funcionando e gravando no banco local.
    await aguardarTextos(a.pagina, ['Ideia original', 'Novo no A']);
    await aguardarTextos(b.pagina, ['Ideia revista no B', 'Novo no B']);

    // A rede volta, primeiro no A e depois no B, e a sincronização retoma sozinha.
    await perfis[0].contexto.setOffline(false);
    await aguardarSincronizado(a.pagina);
    await perfis[1].contexto.setOffline(false);
    const esperados = ['Ideia revista no B', 'Novo no A', 'Novo no B'];
    await aguardarTextos(b.pagina, esperados);
    await aguardarTextos(a.pagina, esperados);
    for (const { pagina } of [a, b]) {
      for (const texto of esperados) await pagina.locator('.card', { hasText: texto }).waitFor();
      assert.equal(await pagina.locator('.card').count(), 3);
    }
    await aguardarSincronizado(a.pagina);
    await aguardarSincronizado(b.pagina);
    assert.deepEqual([...a.erros, ...b.erros], []);
  } finally {
    await fecharPerfis(perfis);
  }
});

test('o mesmo cartão editado nos dois perfis fica com a edição feita por último', async () => {
  const perfis = await abrirPerfis();
  try {
    const a = await abrirApp(perfis[0].contexto);
    const b = await abrirApp(perfis[1].contexto);
    for (const { pagina } of [a, b]) {
      await pagina.evaluate(([endereco, chave]) => window.sincronizacaoDaPrancheta.configurar({ endereco, chave }), [sinc.base, CHAVE]);
    }
    await criarCartao(a.pagina, 420, 320, 'Texto comum');
    await aguardarSincronizado(a.pagina);
    await aguardarTextos(b.pagina, ['Texto comum']);
    await b.pagina.locator('.card', { hasText: 'Texto comum' }).waitFor();

    await perfis[0].contexto.setOffline(true);
    await perfis[1].contexto.setOffline(true);
    await editarCartao(a.pagina, 'Texto comum', 'Versão do A');
    await aguardarTextos(a.pagina, ['Versão do A']);
    await dormir(50);
    await editarCartao(b.pagina, 'Texto comum', 'Versão do B');
    await aguardarTextos(b.pagina, ['Versão do B']);

    // O A sincroniza primeiro; o B, que editou depois, combina e prevalece.
    await perfis[0].contexto.setOffline(false);
    await aguardarSincronizado(a.pagina);
    await perfis[1].contexto.setOffline(false);
    await aguardarTextos(b.pagina, ['Versão do B']);
    await aguardarSincronizado(b.pagina);
    await aguardarTextos(a.pagina, ['Versão do B']);
    await a.pagina.locator('.card', { hasText: 'Versão do B' }).waitFor();
    assert.deepEqual([...a.erros, ...b.erros], []);
  } finally {
    await fecharPerfis(perfis);
  }
});

test('sem servidor configurado, nada sai do aparelho; com a chave errada, a página avisa e segue funcionando', async () => {
  const perfis = await abrirPerfis(1);
  try {
    const pedidos = [];
    perfis[0].contexto.on('request', (p) => { if (p.url().startsWith(sinc.base)) pedidos.push(p.url()); });
    const a = await abrirApp(perfis[0].contexto);
    await criarCartao(a.pagina, 420, 320, 'Só neste aparelho');
    await dormir(1500);
    assert.deepEqual(pedidos, []);
    assert.equal(await a.pagina.textContent('#sinc'), 'Sincronizar');

    const recusa = await a.pagina.evaluate(([endereco]) => window.sincronizacaoDaPrancheta
      .configurar({ endereco, chave: 'chave-errada-com-mais-de-32-caracteres-000' }).then(() => 'aceita', (e) => e.code), [sinc.base]);
    assert.equal(recusa, 'nao_autorizado');
    await a.pagina.waitForFunction(() => document.getElementById('sinc').textContent === 'Erro ao sincronizar');
    // As mudanças continuam guardadas para o próximo envio.
    assert.ok(await a.pagina.evaluate(async () => (await (await claude.use('db')).mudancas()).length) > 0);
    await criarCartao(a.pagina, 420, 480, 'Ainda funciona');
    await aguardarTextos(a.pagina, ['Ainda funciona', 'Só neste aparelho']);
    // Uma configuração inválida é recusada antes de qualquer pedido.
    const invalida = await a.pagina.evaluate(() => window.sincronizacaoDaPrancheta
      .configurar({ endereco: 'ftp://exemplo', chave: 'x'.repeat(40) }).then(() => 'aceita', (e) => e.code));
    assert.equal(invalida, 'invalid_argument');
    assert.deepEqual(a.erros, []);
  } finally {
    await fecharPerfis(perfis);
  }
});

test('um envio feito sobre uma versão desatualizada do servidor é combinado e enviado de novo', async () => {
  // Intervalos longos: os ciclos deste teste são chamados um a um.
  const perfis = await abrirPerfis(1, { intervalo: 600000, esperaDepoisDeGravar: 600000 });
  try {
    const a = await abrirApp(perfis[0].contexto);
    await a.pagina.evaluate(async ([endereco, chave]) => {
      const db = await claude.use('db');
      await db.doc('notas/n1').set({ items: [{ id: 'a', t: 'daqui' }], rev: 'p1' });
      await window.sincronizacaoDaPrancheta.configurar({ endereco, chave });
    }, [sinc.base, CHAVE]);
    const doServidor = await sinc.armazem.lerDocumento('notas/n1');
    assert.deepEqual(doServidor.registro.dados.items.map((it) => it.id), ['a']);

    // Outro aparelho grava no servidor depois do último recebimento deste.
    const outro = 'cccccccccccccccc';
    const aceita = await sinc.armazem.aplicar(outro, [{
      seq: 1, base: doServidor.pos,
      registro: { ...doServidor.registro, dados: { items: [{ id: 'a', t: 'daqui' }, { id: 'b', t: 'de outro aparelho' }], rev: 'r9' }, versao: 2, dispositivo: outro },
    }]);
    assert.equal(aceita.resultados[0].estado, 'aplicada');

    // Este aparelho muda o mesmo documento e envia sem receber antes.
    const local = await a.pagina.evaluate(async () => {
      const db = await claude.use('db');
      await db.doc('notas/n1').set({ items: [{ id: 'a', t: 'daqui' }, { id: 'c', t: 'também daqui' }], rev: 'p2' });
      const s = window.sincronizacaoDaPrancheta;
      await s._enviar(await s.configuracao());
      return { dados: (await db.doc('notas/n1').get()).data(), pendentes: (await db.mudancas()).length };
    });
    assert.deepEqual(local.dados.items.map((it) => it.id), ['a', 'c', 'b']);
    assert.equal(local.pendentes, 0);
    const final = await sinc.armazem.lerDocumento('notas/n1');
    assert.deepEqual(final.registro.dados.items.map((it) => it.id), ['a', 'c', 'b']);
    assert.deepEqual(a.erros, []);
  } finally {
    await fecharPerfis(perfis);
  }
});

test('a sincronização retoma assim que a rede volta, sem esperar a próxima tentativa', async () => {
  // Depois de uma falha, a próxima tentativa ficaria para daqui a 10 minutos.
  const perfis = await abrirPerfis(1, { intervalo: 600000, esperaDepoisDeGravar: 300, esperaAposFalha: 600000, esperaMaxima: 600000 });
  try {
    const a = await abrirApp(perfis[0].contexto);
    await a.pagina.evaluate(([endereco, chave]) => window.sincronizacaoDaPrancheta.configurar({ endereco, chave }), [sinc.base, CHAVE]);
    await perfis[0].contexto.setOffline(true);
    await criarCartao(a.pagina, 420, 320, 'Escrito sem rede');
    // O cartão chega ao banco local, e a tentativa de enviá-lo falha sem rede.
    await aguardarTextos(a.pagina, ['Escrito sem rede']);
    await aguardar(a.pagina, async () => {
      const db = await claude.use('db');
      const pendentes = (await db.mudancas()).some((m) => m.caminho.startsWith('canvas-shards/'));
      return pendentes && window.sincronizacaoDaPrancheta.estado.situacao === 'sem_rede' && !window.sincronizacaoDaPrancheta._rodando;
    }, null, { descricao: 'a falha do envio sem rede' });
    await dormir(500);
    assert.equal(await a.pagina.evaluate(() => window.sincronizacaoDaPrancheta.estado.situacao), 'sem_rede');
    await perfis[0].contexto.setOffline(false);
    const inicio = Date.now();
    await aguardarSincronizado(a.pagina);
    assert.ok(Date.now() - inicio < 10000);
    const fragmentos = [];
    for (let pos = 0; ; ) {
      const pagina = await sinc.armazem.listar(pos, 500);
      fragmentos.push(...pagina.documentos.filter((d) => d.registro.caminho.startsWith('canvas-shards/')));
      if (!pagina.mais) break;
      pos = pagina.posicao;
    }
    assert.ok(fragmentos.some((d) => JSON.stringify(d.registro.dados).includes('Escrito sem rede')));
    assert.deepEqual(a.erros, []);
  } finally {
    await fecharPerfis(perfis);
  }
});
