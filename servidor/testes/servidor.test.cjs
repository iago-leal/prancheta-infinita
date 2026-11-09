// Testes do servidor de sincronização, em servidor/.
// Executar a partir da raiz do repositório: node --test servidor/testes/*.test.cjs

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Armazem } = require('../armazem.cjs');
const { criarServidor } = require('../servidor.cjs');

const CHAVE = 'chave-de-teste-com-mais-de-32-caracteres-0123456789';
const ORIGEM_DA_CASCA = 'https://appassets.androidplatform.net';
const APARELHO_A = 'aaaaaaaaaaaaaaaa';
const APARELHO_B = 'bbbbbbbbbbbbbbbb';

// Sobe um servidor numa porta livre, com a pasta de dados dada ou uma nova.
async function subir(pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'prancheta-servidor-'))) {
  const armazem = await Armazem.abrir(pasta);
  const servidor = criarServidor({ armazem, chave: CHAVE, origens: [ORIGEM_DA_CASCA] });
  await new Promise((pronto) => servidor.listen(0, '127.0.0.1', pronto));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  return {
    pasta,
    armazem,
    base,
    fechar: () => new Promise((pronto) => { servidor.close(pronto); servidor.closeAllConnections(); }),
  };
}

async function pedir(s, metodo, rota, { corpo, chave = CHAVE, cabecalhos = {} } = {}) {
  const opcoes = { method: metodo, headers: { ...cabecalhos } };
  if (chave) opcoes.headers.Authorization = `Bearer ${chave}`;
  if (corpo !== undefined) {
    if (Buffer.isBuffer(corpo)) {
      opcoes.body = corpo;
    } else {
      opcoes.body = JSON.stringify(corpo);
      opcoes.headers['Content-Type'] = 'application/json';
    }
  }
  const resposta = await fetch(s.base + rota, opcoes);
  const bruto = Buffer.from(await resposta.arrayBuffer());
  let json = null;
  try { json = JSON.parse(bruto.toString('utf8')); } catch (e) { /* corpo binário */ }
  return { status: resposta.status, cabecalhos: resposta.headers, bruto, json };
}

// Registro de documento no formato do banco local da Prancheta.
function registro(caminho, dados, { versao = 1, apagado = false, dispositivo = APARELHO_A, atualizadoEm = 1762600000000 } = {}) {
  const partes = caminho.split('/');
  return {
    caminho, colecao: partes.slice(0, -1).join('/'), id: partes[partes.length - 1],
    dados: apagado ? null : dados, apagado, versao, atualizadoEm, dispositivo,
  };
}

const enviar = (s, dispositivo, mudancas) => pedir(s, 'POST', '/sync/mudancas', { corpo: { dispositivo, mudancas } });

test('sem a chave, responde 401 a qualquer pedido, sem revelar dados', async () => {
  const s = await subir();
  try {
    const segredo = registro('canvas-shards/s1', { items: [{ id: 'c1', type: 'card', text: 'conteúdo secreto' }] });
    assert.equal((await enviar(s, APARELHO_A, [{ seq: 1, base: null, registro: segredo }])).status, 200);
    const png = Buffer.from('imagem secreta');
    assert.equal((await pedir(s, 'PUT', '/sync/arquivos/0123456789abcdef', { corpo: png, cabecalhos: { 'X-Prancheta-Dispositivo': APARELHO_A } })).status, 201);
    const pedidos = [
      ['GET', '/sync/estado'], ['GET', '/sync/mudancas?desde=0'], ['POST', '/sync/mudancas'],
      ['PUT', '/sync/arquivos/0123456789abcdef'], ['GET', '/sync/arquivos/0123456789abcdef'], ['GET', '/'], ['DELETE', '/sync/estado'],
    ];
    for (const chave of [null, 'chave-errada', `${CHAVE}x`, CHAVE.slice(0, -1)]) {
      for (const [metodo, rota] of pedidos) {
        const r = await pedir(s, metodo, rota, { chave, corpo: metodo === 'POST' ? { dispositivo: APARELHO_A, mudancas: [] } : undefined });
        assert.equal(r.status, 401, `${metodo} ${rota} com a chave ${chave}`);
        assert.deepEqual(r.json, { erro: 'nao_autorizado' });
        assert.ok(!r.bruto.toString().includes('secret'));
      }
    }
    // A consulta prévia do navegador só é respondida para a origem da casca, e sem dados.
    const previa = await fetch(`${s.base}/sync/mudancas`, { method: 'OPTIONS', headers: { Origin: ORIGEM_DA_CASCA, 'Access-Control-Request-Method': 'GET' } });
    assert.equal(previa.status, 204);
    assert.equal(previa.headers.get('access-control-allow-origin'), ORIGEM_DA_CASCA);
    assert.equal((await previa.text()), '');
    const estranha = await fetch(`${s.base}/sync/mudancas`, { method: 'OPTIONS', headers: { Origin: 'https://exemplo.com' } });
    assert.equal(estranha.status, 401);
    assert.equal(estranha.headers.get('access-control-allow-origin'), null);
  } finally {
    await s.fechar();
  }
});

test('grava e devolve os documentos no formato do banco local, sem converter', async () => {
  const s = await subir();
  try {
    const registros = [
      registro('library/index', { boards: [{ id: 'main', title: 'Principal' }], open: 'main' }),
      registro('canvas-shards/s1', { items: [{ id: 'c1', type: 'card', x: 10.5, y: -3, blocks: [{ h: 'olá, mundo' }] }, { id: 't1', type: 'stroke', d: '1,2,3', nf: '4,5,6', em: 1762600000123, dur: 640 }], rev: 'r1', by: 'aparelho' }, { versao: 7 }),
      registro('canvas-shards/s2', null, { apagado: true, versao: 3 }),
      registro('boards/q1/meta/main', { title: 'Quadro 1', sub: '', rev: 'r2' }),
    ];
    const r = await enviar(s, APARELHO_A, registros.map((reg, i) => ({ seq: i + 1, base: null, registro: reg })));
    assert.equal(r.status, 200);
    assert.deepEqual(r.json.resultados.map((x) => [x.seq, x.estado, x.pos]), [[1, 'aplicada', 1], [2, 'aplicada', 2], [3, 'aplicada', 3], [4, 'aplicada', 4]]);
    assert.equal(r.json.posicao, 4);
    const lista = await pedir(s, 'GET', '/sync/mudancas?desde=0');
    assert.equal(lista.status, 200);
    assert.deepEqual(lista.json.documentos.map((d) => d.registro), registros);
    assert.deepEqual(lista.json.documentos.map((d) => d.pos), [1, 2, 3, 4]);
    assert.equal(lista.json.posicao, 4);
    assert.equal(lista.json.mais, false);
    assert.deepEqual((await pedir(s, 'GET', '/sync/estado')).json, { posicao: 4 });
  } finally {
    await s.fechar();
  }
});

test('cada mudança ganha uma posição, e o aparelho pede só o que veio depois da última que recebeu', async () => {
  const s = await subir();
  try {
    await enviar(s, APARELHO_A, [1, 2, 3].map((i) => ({ seq: i, base: null, registro: registro(`canvas-shards/s${i}`, { items: [], rev: `r${i}` }) })));
    const nada = await pedir(s, 'GET', '/sync/mudancas?desde=3');
    assert.deepEqual(nada.json, { posicao: 3, mais: false, documentos: [], arquivos: [], cifra: null });
    // O documento s2 muda duas vezes depois da posição 3 e aparece uma vez, na versão mais nova.
    await enviar(s, APARELHO_A, [
      { seq: 4, base: 2, registro: registro('canvas-shards/s2', { items: [1], rev: 'r4' }, { versao: 2 }) },
      { seq: 5, base: null, registro: registro('canvas-shards/s4', { items: [], rev: 'r5' }) },
      { seq: 6, base: 4, registro: registro('canvas-shards/s2', { items: [1, 2], rev: 'r6' }, { versao: 3 }) },
    ]);
    const depois = await pedir(s, 'GET', '/sync/mudancas?desde=3');
    assert.deepEqual(depois.json.documentos.map((d) => [d.registro.caminho, d.pos, d.registro.dados.rev]), [['canvas-shards/s4', 5, 'r5'], ['canvas-shards/s2', 6, 'r6']]);
    assert.equal(depois.json.posicao, 6);
    // Em páginas: com limite 2, a primeira página para numa posição e a segunda continua dela.
    const p1 = await pedir(s, 'GET', '/sync/mudancas?desde=0&limite=2');
    assert.deepEqual(p1.json.documentos.map((d) => d.pos), [1, 3]);
    assert.equal(p1.json.mais, true);
    const p2 = await pedir(s, 'GET', `/sync/mudancas?desde=${p1.json.posicao}&limite=2`);
    assert.deepEqual(p2.json.documentos.map((d) => d.pos), [5, 6]);
    assert.equal(p2.json.mais, false);
    assert.equal(p2.json.posicao, 6);
  } finally {
    await s.fechar();
  }
});

test('mudanças repetidas pelo mesmo aparelho não se duplicam', async () => {
  const s = await subir();
  try {
    const m = { seq: 1, base: null, registro: registro('library/index', { boards: [] }) };
    assert.equal((await enviar(s, APARELHO_A, [m])).json.resultados[0].estado, 'aplicada');
    // A mesma mudança reenviada, por exemplo depois de uma resposta perdida, não muda nada.
    const de_novo = await enviar(s, APARELHO_A, [m, m]);
    assert.deepEqual(de_novo.json.resultados.map((r) => [r.estado, r.pos]), [['repetida', 1], ['repetida', 1]]);
    assert.equal(de_novo.json.posicao, 1);
    assert.equal((await pedir(s, 'GET', '/sync/mudancas?desde=0')).json.documentos.length, 1);
    // O mesmo número vindo de outro aparelho é outra mudança.
    const outro = await enviar(s, APARELHO_B, [{ seq: 1, base: 1, registro: registro('library/index', { boards: ['b'] }, { versao: 2, dispositivo: APARELHO_B }) }]);
    assert.deepEqual(outro.json.resultados.map((r) => [r.estado, r.pos]), [['aplicada', 2]]);
  } finally {
    await s.fechar();
  }
});

test('mudanças de aparelhos diferentes no mesmo documento não se sobrescrevem às cegas', async () => {
  const s = await subir();
  try {
    const deA = registro('canvas-shards/s1', { items: ['de A'] });
    assert.equal((await enviar(s, APARELHO_A, [{ seq: 1, base: null, registro: deA }])).json.resultados[0].pos, 1);
    // B mudou o mesmo documento sem conhecer a versão de A: conflito, com a versão atual.
    const deB = registro('canvas-shards/s1', { items: ['de B'] }, { dispositivo: APARELHO_B });
    const conflito = await enviar(s, APARELHO_B, [{ seq: 1, base: null, registro: deB }]);
    assert.deepEqual(conflito.json.resultados[0], { seq: 1, estado: 'conflito', atual: { pos: 1, registro: deA } });
    assert.deepEqual((await pedir(s, 'GET', '/sync/mudancas?desde=0')).json.documentos[0].registro, deA);
    // B combina as versões e reenvia sobre a posição 1: aceita.
    const combinado = registro('canvas-shards/s1', { items: ['de A', 'de B'] }, { versao: 2, dispositivo: APARELHO_B });
    assert.deepEqual((await enviar(s, APARELHO_B, [{ seq: 2, base: 1, registro: combinado }])).json.resultados[0], { seq: 2, estado: 'aplicada', pos: 2 });
    // A, ainda sobre a posição 1, recebe conflito com a versão combinada.
    const deA2 = registro('canvas-shards/s1', { items: ['de A', 'mais de A'] }, { versao: 2 });
    const conflitoA = await enviar(s, APARELHO_A, [{ seq: 2, base: 1, registro: deA2 }]);
    assert.equal(conflitoA.json.resultados[0].estado, 'conflito');
    assert.deepEqual(conflitoA.json.resultados[0].atual, { pos: 2, registro: combinado });
    // Um aparelho que muda de novo a própria versão, sem ter recebido a posição dela, não entra em conflito.
    const r = await enviar(s, APARELHO_B, [
      { seq: 3, base: 2, registro: registro('canvas-shards/s1', { items: [1] }, { versao: 3, dispositivo: APARELHO_B }) },
      { seq: 4, base: 2, registro: registro('canvas-shards/s1', { items: [1, 2] }, { versao: 4, dispositivo: APARELHO_B }) },
    ]);
    assert.deepEqual(r.json.resultados.map((x) => [x.estado, x.pos]), [['aplicada', 3], ['aplicada', 4]]);
    // Um documento novo criado nos dois aparelhos ao mesmo tempo também dá conflito para o segundo.
    assert.equal((await enviar(s, APARELHO_A, [{ seq: 3, base: null, registro: registro('ajuda/x', { t: 'A' }) }])).json.resultados[0].estado, 'aplicada');
    assert.equal((await enviar(s, APARELHO_B, [{ seq: 5, base: null, registro: registro('ajuda/x', { t: 'B' }, { dispositivo: APARELHO_B }) }])).json.resultados[0].estado, 'conflito');
  } finally {
    await s.fechar();
  }
});

test('arquivos enviados são guardados, listados e devolvidos', async () => {
  const s = await subir();
  try {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5]);
    const cabecalhos = { 'Content-Type': 'image/png', 'X-Prancheta-Dispositivo': APARELHO_A, 'X-Prancheta-Criado-Em': '1762600000999' };
    const r = await pedir(s, 'PUT', '/sync/arquivos/0123456789abcdef0123456789abcdef', { corpo: png, cabecalhos });
    assert.equal(r.status, 201);
    assert.deepEqual(r.json, { estado: 'aplicado', pos: 1 });
    const lido = await pedir(s, 'GET', '/sync/arquivos/0123456789abcdef0123456789abcdef');
    assert.equal(lido.status, 200);
    assert.equal(lido.cabecalhos.get('content-type'), 'image/png');
    assert.deepEqual(lido.bruto, png);
    const lista = await pedir(s, 'GET', '/sync/mudancas?desde=0');
    assert.deepEqual(lista.json.arquivos.map(({ pos, id, tipo, bytes, criadoEm, dispositivo }) => ({ pos, id, tipo, bytes, criadoEm, dispositivo })), [
      { pos: 1, id: '0123456789abcdef0123456789abcdef', tipo: 'image/png', bytes: png.length, criadoEm: 1762600000999, dispositivo: APARELHO_A },
    ]);
    // Reenviar o mesmo arquivo não muda nada; outro conteúdo com o mesmo id é recusado.
    assert.deepEqual((await pedir(s, 'PUT', '/sync/arquivos/0123456789abcdef0123456789abcdef', { corpo: png, cabecalhos })).json, { estado: 'repetido', pos: 1 });
    assert.equal((await pedir(s, 'PUT', '/sync/arquivos/0123456789abcdef0123456789abcdef', { corpo: Buffer.from('outro'), cabecalhos })).status, 409);
    assert.equal((await pedir(s, 'GET', '/sync/arquivos/ffffffffffffffff')).status, 404);
    assert.equal((await pedir(s, 'PUT', '/sync/arquivos/curto', { corpo: png, cabecalhos })).status, 400);
    assert.equal((await pedir(s, 'PUT', '/sync/arquivos/..%2F..%2Fsenha', { corpo: png, cabecalhos })).status, 400);
    assert.equal((await pedir(s, 'PUT', '/sync/arquivos/aaaaaaaaaaaaaaaa', { corpo: png, cabecalhos: { 'Content-Type': 'image/png' } })).status, 400);
    assert.equal((await pedir(s, 'PUT', '/sync/arquivos/bbbbbbbbbbbbbbbb', { corpo: Buffer.alloc(26 * 1024 * 1024), cabecalhos })).status, 413);
  } finally {
    await s.fechar();
  }
});

test('recusa pedidos malformados sem gravar nada', async () => {
  const s = await subir();
  try {
    const bom = registro('canvas-shards/s1', { items: [] });
    const casos = [
      { dispositivo: 'curto', mudancas: [] },
      { dispositivo: APARELHO_A },
      { dispositivo: APARELHO_A, mudancas: [{ base: null, registro: bom }] },
      { dispositivo: APARELHO_A, mudancas: [{ seq: 1, base: 0, registro: bom }] },
      { dispositivo: APARELHO_A, mudancas: [{ seq: 1, base: null, registro: { ...bom, caminho: 'canvas-shards' } }] },
      { dispositivo: APARELHO_A, mudancas: [{ seq: 1, base: null, registro: { ...bom, caminho: '_arquivos/x' } }] },
      { dispositivo: APARELHO_A, mudancas: [{ seq: 1, base: null, registro: { ...bom, dados: [1, 2] } }] },
      { dispositivo: APARELHO_A, mudancas: [{ seq: 1, base: null, registro: { ...bom, versao: 0 } }] },
      { dispositivo: APARELHO_A, mudancas: [{ seq: 1, base: null, registro: { ...bom, apagado: 'não' } }] },
    ];
    for (const corpo of casos) assert.equal((await pedir(s, 'POST', '/sync/mudancas', { corpo })).status, 400, JSON.stringify(corpo));
    const quebrado = await fetch(`${s.base}/sync/mudancas`, { method: 'POST', headers: { Authorization: `Bearer ${CHAVE}`, 'Content-Type': 'application/json' }, body: '{"dispositivo":' });
    assert.equal(quebrado.status, 400);
    assert.equal((await pedir(s, 'GET', '/sync/mudancas?desde=-1')).status, 400);
    assert.deepEqual((await pedir(s, 'GET', '/sync/estado')).json, { posicao: 0 });
  } finally {
    await s.fechar();
  }
});

test('os dados ficam em disco e sobrevivem a reiniciar o servidor', async () => {
  const primeiro = await subir();
  const reg = registro('canvas-shards/s1', { items: [{ id: 'c1', type: 'card', text: 'persistiu' }] });
  await enviar(primeiro, APARELHO_A, [{ seq: 1, base: null, registro: reg }]);
  await pedir(primeiro, 'PUT', '/sync/arquivos/0123456789abcdef', { corpo: Buffer.from('bytes'), cabecalhos: { 'Content-Type': 'text/plain', 'X-Prancheta-Dispositivo': APARELHO_A } });
  await primeiro.fechar();

  const segundo = await subir(primeiro.pasta);
  try {
    assert.deepEqual((await pedir(segundo, 'GET', '/sync/estado')).json, { posicao: 2 });
    const lista = await pedir(segundo, 'GET', '/sync/mudancas?desde=0');
    assert.deepEqual(lista.json.documentos.map((d) => d.registro), [reg]);
    assert.deepEqual(lista.json.arquivos.map((a) => a.id), ['0123456789abcdef']);
    assert.equal((await pedir(segundo, 'GET', '/sync/arquivos/0123456789abcdef')).bruto.toString(), 'bytes');
    // As mudanças já aplicadas continuam reconhecidas, e as novas seguem a numeração.
    assert.equal((await enviar(segundo, APARELHO_A, [{ seq: 1, base: null, registro: reg }])).json.resultados[0].estado, 'repetida');
    assert.equal((await enviar(segundo, APARELHO_A, [{ seq: 2, base: 1, registro: registro('canvas-shards/s1', { items: [] }, { versao: 2 }) }])).json.resultados[0].pos, 3);
  } finally {
    await segundo.fechar();
  }
});

test('depois de uma queda, descarta a linha cortada e recupera o documento gravado sem linha', async () => {
  const s = await subir();
  await enviar(s, APARELHO_A, [{ seq: 1, base: null, registro: registro('canvas-shards/s1', { items: [1] }) }]);
  await s.fechar();
  // Simula uma queda: o documento da mudança 2 foi gravado, mas a linha dela no registro ficou pela metade.
  const reg2 = registro('canvas-shards/s2', { items: [2] });
  const crypto = require('node:crypto');
  const nome = crypto.createHash('sha256').update('canvas-shards/s2').digest('hex');
  fs.writeFileSync(path.join(s.pasta, 'documentos', `${nome}.json`), JSON.stringify({ pos: 2, caminho: 'canvas-shards/s2', dispositivo: APARELHO_A, seq: 2, registro: reg2 }));
  fs.appendFileSync(path.join(s.pasta, 'registro.jsonl'), '{"pos":2,"caminho":"canvas-sh');

  const reaberto = await subir(s.pasta);
  try {
    assert.deepEqual((await pedir(reaberto, 'GET', '/sync/estado')).json, { posicao: 2 });
    const lista = await pedir(reaberto, 'GET', '/sync/mudancas?desde=1');
    assert.deepEqual(lista.json.documentos.map((d) => d.registro), [reg2]);
    assert.equal((await enviar(reaberto, APARELHO_A, [{ seq: 2, base: null, registro: reg2 }])).json.resultados[0].estado, 'repetida');
    const linhas = fs.readFileSync(path.join(s.pasta, 'registro.jsonl'), 'utf8').trim().split('\n');
    assert.deepEqual(linhas.map((l) => JSON.parse(l).pos), [1, 2]);
  } finally {
    await reaberto.fechar();
  }
});

test('o servidor não inicia sem uma chave de acesso, que não fica no repositório', () => {
  const programa = path.join(__dirname, '..', 'servidor.cjs');
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'prancheta-servidor-'));
  const ambiente = { PATH: process.env.PATH, PRANCHETA_DADOS: pasta, PRANCHETA_PORTA: '0' };
  const sem = spawnSync(process.execPath, [programa], { env: ambiente, encoding: 'utf8', timeout: 10000 });
  assert.notEqual(sem.status, 0);
  assert.match(sem.stderr, /PRANCHETA_CHAVE/);
  const curta = spawnSync(process.execPath, [programa], { env: { ...ambiente, PRANCHETA_CHAVE: 'curta' }, encoding: 'utf8', timeout: 10000 });
  assert.notEqual(curta.status, 0);
  // O código do servidor não traz chave nenhuma: ela vem só do ambiente.
  for (const arquivo of ['servidor.cjs', 'armazem.cjs']) {
    assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '..', arquivo), 'utf8'), /PRANCHETA_CHAVE\s*(\|\||\?\?|=)\s*['"`]/);
  }
});
