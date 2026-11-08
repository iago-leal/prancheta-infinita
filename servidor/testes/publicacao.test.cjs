// Testes do que a etapa 05 do plano 003 acrescentou ao servidor para rodar na
// VPS: a página, as chaves por aparelho, os cabeçalhos dos arquivos, o
// histórico de versões, o reinício com uma versão nova e a cópia de segurança.
// Executar a partir da raiz do repositório: node --test servidor/testes/*.test.cjs

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const { Armazem } = require('../armazem.cjs');
const { criarServidor, vigiarVersao } = require('../servidor.cjs');
const { criarServidorDaPagina, POLITICA_DA_PAGINA } = require('../pagina.cjs');
const { criarVerificador, lerResumos } = require('../chaves.cjs');
const { copiar } = require('../copia-de-seguranca.cjs');

const RAIZ = path.join(__dirname, '..', '..');
const APARELHO = 'aaaaaaaaaaaaaaaa';
const temporaria = (nome) => fs.mkdtempSync(path.join(os.tmpdir(), `prancheta-${nome}-`));
const resumoHex = (chave) => crypto.createHash('sha256').update(chave).digest('hex');
const dormir = (ms) => new Promise((pronto) => setTimeout(pronto, ms));

async function ouvir(servidor) {
  await new Promise((pronto) => servidor.listen(0, '127.0.0.1', pronto));
  return {
    base: `http://127.0.0.1:${servidor.address().port}`,
    fechar: () => new Promise((pronto) => { servidor.close(pronto); servidor.closeAllConnections(); }),
  };
}

function registro(caminho, dados, extra = {}) {
  const partes = caminho.split('/');
  return {
    caminho, colecao: partes.slice(0, -1).join('/'), id: partes[partes.length - 1],
    dados, apagado: false, versao: 1, atualizadoEm: 1762600000000, dispositivo: APARELHO, ...extra,
  };
}

test('a página é entregue sem a chave, com os cabeçalhos de segurança, e nada fora da pasta', async () => {
  const s = await ouvir(criarServidorDaPagina({ pasta: path.join(RAIZ, 'web', 'app') }));
  try {
    const pagina = await fetch(`${s.base}/`);
    assert.equal(pagina.status, 200);
    assert.match(pagina.headers.get('content-type'), /^text\/html/);
    assert.equal(pagina.headers.get('content-security-policy'), POLITICA_DA_PAGINA);
    assert.match(POLITICA_DA_PAGINA, /connect-src 'self'/);
    assert.equal(pagina.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(pagina.headers.get('referrer-policy'), 'no-referrer');
    assert.match(pagina.headers.get('strict-transport-security'), /max-age=\d+/);
    assert.equal(pagina.headers.get('cache-control'), 'no-cache');
    assert.ok((await pagina.text()).includes('compat/sincronizacao.js'));
    // Revalidação pela etiqueta.
    const etiqueta = pagina.headers.get('etag');
    assert.equal((await fetch(`${s.base}/index.html`, { headers: { 'If-None-Match': etiqueta } })).status, 304);
    const js = await fetch(`${s.base}/compat/banco-local.js`);
    assert.equal(js.status, 200);
    assert.match(js.headers.get('content-type'), /^text\/javascript/);
    assert.equal(js.headers.get('content-security-policy'), null);
    assert.equal((await fetch(`${s.base}/sw.js`, { method: 'HEAD' })).status, 200);
    for (const rota of ['/../servidor/servidor.cjs', '/%2e%2e/servidor/servidor.cjs', '/compat/%2e%2e/%2e%2e/servidor/armazem.cjs', '/.git/config', '/compat//banco-local.js', '/nada.js', '/sync/estado', '/index.html%00']) {
      assert.equal((await fetch(`${s.base}${rota}`)).status, 404, rota);
    }
    assert.equal((await fetch(`${s.base}/`, { method: 'POST' })).status, 405);
  } finally {
    await s.fechar();
  }
});

test('cada aparelho tem a sua chave, guardada só como resumo, e revogar vale sem reiniciar', async () => {
  const pasta = temporaria('chaves');
  const arquivo = path.join(pasta, 'chaves');
  const boox = 'chave-do-boox-com-mais-de-32-caracteres-0001';
  const computador = 'chave-do-computador-com-mais-de-32-caracteres-02';
  fs.writeFileSync(arquivo, `# aparelhos\nboox ${resumoHex(boox)}\n\ncomputador ${resumoHex(computador)}\n`);
  const verificar = criarVerificador({ arquivo });
  assert.equal(verificar(boox), 'boox');
  assert.equal(verificar(computador), 'computador');
  assert.equal(verificar('outra-chave-qualquer-com-mais-de-32-caracteres'), null);
  assert.ok(!fs.readFileSync(arquivo, 'utf8').includes(boox));

  const armazem = await Armazem.abrir(temporaria('dados'));
  const s = await ouvir(criarServidor({ armazem, verificar }));
  try {
    const estado = (chave) => fetch(`${s.base}/sync/estado`, { headers: { Authorization: `Bearer ${chave}` } }).then((r) => r.status);
    assert.equal(await estado(boox), 200);
    assert.equal(await estado(computador), 200);
    // Revoga o Boox apagando a linha dele; o arquivo é relido no pedido seguinte.
    await dormir(20);
    fs.writeFileSync(arquivo, `computador ${resumoHex(computador)}\n`);
    assert.equal(await estado(boox), 401);
    assert.equal(await estado(computador), 200);
    // Sem conseguir ler o arquivo, nenhuma chave vale.
    fs.rmSync(arquivo);
    assert.equal(await estado(computador), 401);
  } finally {
    await s.fechar();
  }
  assert.throws(() => lerResumos('boox nao-e-um-resumo\n'), /linha 1/);
  assert.throws(() => criarVerificador({ chave: 'curta' }), /32 caracteres/);
});

test('os arquivos são devolvidos com o tipo normalizado e isolados da origem de quem os abre', async () => {
  const CHAVE = 'chave-de-teste-com-mais-de-32-caracteres-0123456789';
  const armazem = await Armazem.abrir(temporaria('dados'));
  const s = await ouvir(criarServidor({ armazem, chave: CHAVE }));
  const autorizacao = { Authorization: `Bearer ${CHAVE}`, 'X-Prancheta-Dispositivo': APARELHO };
  try {
    const casos = [
      ['aaaaaaaaaaaaaaa1', 'image/png', 'image/png', 'inline', true],
      ['aaaaaaaaaaaaaaa2', 'Image/SVG+xml; charset=utf-8', 'image/svg+xml', 'attachment', true],
      ['aaaaaaaaaaaaaaa3', 'text/html', 'text/html', 'attachment', true],
      ['aaaaaaaaaaaaaaa4', 'application/pdf', 'application/pdf', 'inline', false],
      ['aaaaaaaaaaaaaaa5', '<script>alert(1)</script>', 'application/octet-stream', 'attachment', true],
    ];
    for (const [id, enviado, esperado, disposicao, isolado] of casos) {
      const envio = await fetch(`${s.base}/sync/arquivos/${id}`, { method: 'PUT', headers: { ...autorizacao, 'Content-Type': enviado }, body: Buffer.from('<svg onload="alert(1)"/>') });
      assert.equal(envio.status, 201, enviado);
      const r = await fetch(`${s.base}/sync/arquivos/${id}`, { headers: autorizacao });
      assert.equal(r.headers.get('content-type'), esperado, enviado);
      assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(r.headers.get('content-disposition'), disposicao, enviado);
      assert.equal(Boolean(r.headers.get('content-security-policy')?.startsWith('sandbox')), isolado, enviado);
    }
    // A lista que vai aos outros aparelhos traz o tipo já normalizado.
    const lista = await (await fetch(`${s.base}/sync/mudancas?desde=0`, { headers: autorizacao })).json();
    const tipos = Object.fromEntries(lista.arquivos.map((a) => [a.id, a.tipo]));
    for (const [id, , esperado] of casos) assert.equal(tipos[id], esperado, id);
    // A sincronização também responde com nosniff e HSTS.
    const estado = await fetch(`${s.base}/sync/estado`, { headers: autorizacao });
    assert.equal(estado.headers.get('x-content-type-options'), 'nosniff');
    assert.match(estado.headers.get('strict-transport-security'), /max-age/);
  } finally {
    await s.fechar();
  }
});

test('cada versão aceita fica no histórico, consultável, e o histórico antigo é apagado no prazo', async () => {
  const pasta = temporaria('dados');
  const armazem = await Armazem.abrir(pasta);
  const caminho = 'canvas-shards/s1';
  await armazem.aplicar(APARELHO, [{ seq: 1, base: null, registro: registro(caminho, { items: [{ id: 'c1' }] }) }]);
  await armazem.aplicar(APARELHO, [{ seq: 2, base: 1, registro: registro(caminho, { items: [{ id: 'c1' }, { id: 'c2' }] }, { versao: 2 }) }]);
  await armazem.aplicar(APARELHO, [{ seq: 3, base: 2, registro: registro(caminho, null, { versao: 3, apagado: true }) }]);
  await armazem.aplicar(APARELHO, [{ seq: 4, base: null, registro: registro('canvas-shards/s2', { items: [] }) }]);
  const versoes = await armazem.historico(caminho);
  assert.deepEqual(versoes.map((v) => [v.pos, v.registro.apagado]), [[1, false], [2, false], [3, true]]);
  assert.deepEqual(versoes[1].registro.dados.items.map((it) => it.id), ['c1', 'c2']);

  // A consulta pela linha de comando lista e mostra uma versão.
  const programa = path.join(RAIZ, 'servidor', 'historico.cjs');
  const lista = spawnSync(process.execPath, [programa, pasta, 'listar', caminho], { encoding: 'utf8' });
  assert.equal(lista.status, 0, lista.stderr);
  assert.equal(lista.stdout.trim().split('\n').length, 3);
  assert.match(lista.stdout, /\tapagado\t/);
  const versao = spawnSync(process.execPath, [programa, pasta, 'mostrar', caminho, '2'], { encoding: 'utf8' });
  assert.equal(versao.status, 0, versao.stderr);
  assert.deepEqual(JSON.parse(versao.stdout).dados.items.map((it) => it.id), ['c1', 'c2']);
  assert.equal(spawnSync(process.execPath, [programa, pasta, 'mostrar', caminho, '9'], { encoding: 'utf8' }).status, 1);

  // Um arquivo de histórico mais antigo que o prazo é apagado ao abrir.
  const antigo = path.join(pasta, 'historico', '2001-01-01.jsonl');
  fs.writeFileSync(antigo, '');
  const hoje = fs.readdirSync(path.join(pasta, 'historico')).filter((n) => n !== '2001-01-01.jsonl');
  await Armazem.abrir(pasta, { diasDeHistorico: 30 });
  assert.ok(!fs.existsSync(antigo));
  assert.deepEqual(fs.readdirSync(path.join(pasta, 'historico')), hoje);
});

test('uma versão nova publicada faz o servidor terminar, para recomeçar com ela', async () => {
  const pasta = temporaria('publicado');
  fs.mkdirSync(path.join(pasta, 'versoes', 'v1'), { recursive: true });
  fs.mkdirSync(path.join(pasta, 'versoes', 'v2'), { recursive: true });
  fs.symlinkSync('versoes/v1', path.join(pasta, 'atual'));
  let avisada = null;
  const parar = vigiarVersao(path.join(pasta, 'atual'), (nova) => { avisada = nova; }, 20);
  await dormir(80);
  assert.equal(avisada, null);
  fs.symlinkSync('versoes/v2', path.join(pasta, 'atual.novo'));
  fs.renameSync(path.join(pasta, 'atual.novo'), path.join(pasta, 'atual'));
  await dormir(120);
  parar();
  assert.equal(avisada, fs.realpathSync(path.join(pasta, 'versoes', 'v2')));

  // O processo inteiro, com a página e a sincronização, termina com código 0.
  const dados = temporaria('dados');
  const chaves = path.join(temporaria('chaves'), 'chaves');
  fs.writeFileSync(chaves, `boox ${resumoHex('x'.repeat(40))}\n`);
  const filho = spawn(process.execPath, [path.join(RAIZ, 'servidor', 'servidor.cjs')], {
    env: {
      PATH: process.env.PATH, PRANCHETA_DADOS: dados, PRANCHETA_CHAVES_ARQUIVO: chaves, PRANCHETA_PORTA: '0',
      PRANCHETA_WEB: path.join(RAIZ, 'web', 'app'), PRANCHETA_PORTA_DA_PAGINA: '0',
      PRANCHETA_VERSAO: path.join(pasta, 'atual'), PRANCHETA_VIGIA_MS: '50',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let saida = '';
  filho.stdout.on('data', (d) => { saida += d; });
  filho.stderr.on('data', (d) => { saida += d; });
  const fim = new Promise((pronto) => filho.on('exit', (codigo) => pronto(codigo)));
  for (let i = 0; i < 100 && !saida.includes('página da Prancheta'); i++) await dormir(50);
  assert.match(saida, /sincronização da Prancheta em http/);
  assert.match(saida, /página da Prancheta em http/);
  fs.symlinkSync('versoes/v1', path.join(pasta, 'atual.novo'));
  fs.renameSync(path.join(pasta, 'atual.novo'), path.join(pasta, 'atual'));
  const codigo = await Promise.race([fim, dormir(5000).then(() => 'tempo esgotado')]);
  if (codigo === 'tempo esgotado') filho.kill('SIGKILL');
  assert.equal(codigo, 0, saida);
  assert.match(saida, /versão nova publicada/);
});

test('a cópia de segurança puxa documentos e arquivos e não baixa de novo o que já tem', async () => {
  const CHAVE = 'chave-da-copia-com-mais-de-32-caracteres-000000';
  const armazem = await Armazem.abrir(temporaria('dados'));
  await armazem.aplicar(APARELHO, [
    { seq: 1, base: null, registro: registro('library/index', { boards: [{ id: 'main' }] }) },
    { seq: 2, base: null, registro: registro('canvas-shards/s1', { items: [{ id: 'c1' }] }) },
  ]);
  await armazem.guardarArquivo('0123456789abcdef', Buffer.from('imagem'), { tipo: 'image/png', dispositivo: APARELHO, criadoEm: 1 });
  const s = await ouvir(criarServidor({ armazem, chave: CHAVE }));
  const pasta = temporaria('copias');
  try {
    let pedidosDeArquivo = 0;
    const contar = (url, opcoes) => {
      if (String(url).includes('/sync/arquivos/')) pedidosDeArquivo += 1;
      return fetch(url, opcoes);
    };
    const primeira = await copiar({ endereco: s.base, chave: CHAVE, pasta, fetch: contar, agora: new Date('2026-11-08T10:00:00Z') });
    assert.deepEqual([primeira.documentos, primeira.arquivos, primeira.baixados], [2, 1, 1]);
    const linhas = fs.readFileSync(path.join(primeira.destino, 'documentos.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    assert.deepEqual(linhas.map((d) => d.registro.caminho).sort(), ['canvas-shards/s1', 'library/index']);
    assert.equal(fs.readFileSync(path.join(pasta, 'arquivos', '0123456789abcdef'), 'utf8'), 'imagem');
    const segunda = await copiar({ endereco: s.base, chave: CHAVE, pasta, fetch: contar, agora: new Date('2026-11-09T10:00:00Z') });
    assert.equal(segunda.baixados, 0);
    assert.equal(pedidosDeArquivo, 1);
    assert.notEqual(segunda.destino, primeira.destino);
    await assert.rejects(copiar({ endereco: s.base, chave: 'errada-com-mais-de-32-caracteres-0000000000', pasta }), /401/);
    await assert.rejects(copiar({ endereco: 'http://exemplo.com', chave: CHAVE, pasta }), /https/);
  } finally {
    await s.fechar();
  }
});
