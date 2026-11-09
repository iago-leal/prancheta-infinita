// Cifra ponta a ponta no servidor, etapa 02 do plano 005: o servidor guarda só
// envelopes cifrados depois da primeira gravação cifrada, e servidor/cifra.cjs
// confere a pasta dos dados e tira do histórico as versões legíveis. Os
// envelopes são feitos pelo próprio módulo dos aparelhos, web/app/compat/cifra.js.
// Executar a partir da raiz do repositório: node --test servidor/testes/*.test.cjs

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Armazem } = require('../armazem.cjs');
const { criarServidor } = require('../servidor.cjs');
const { conferir, apagarLegiveis } = require('../cifra.cjs');

require('../../web/app/compat/cifra.js');

const Cifra = globalThis.CifraPrancheta;
const CHAVE = 'chave-de-teste-com-mais-de-32-caracteres-0123456789';
const APARELHO_A = 'aaaaaaaaaaaaaaaa';
const APARELHO_B = 'bbbbbbbbbbbbbbbb';
const SEGREDO = 'texto-secreto-do-quadro';

async function subir(pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'prancheta-cifra-'))) {
  const armazem = await Armazem.abrir(pasta);
  const servidor = criarServidor({ armazem, chave: CHAVE });
  await new Promise((pronto) => servidor.listen(0, '127.0.0.1', pronto));
  return {
    pasta,
    armazem,
    base: `http://127.0.0.1:${servidor.address().port}`,
    fechar: () => new Promise((pronto) => { servidor.close(pronto); servidor.closeAllConnections(); }),
  };
}

async function pedir(s, metodo, rota, { corpo, cabecalhos = {} } = {}) {
  const opcoes = { method: metodo, headers: { Authorization: `Bearer ${CHAVE}`, ...cabecalhos } };
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
  return { status: resposta.status, bruto, json };
}

function registro(caminho, dados, { versao = 1, apagado = false, dispositivo = APARELHO_A } = {}) {
  const partes = caminho.split('/');
  return {
    caminho, colecao: partes.slice(0, -1).join('/'), id: partes[partes.length - 1],
    dados: apagado ? null : dados, apagado, versao, atualizadoEm: 1762700000000 + versao, dispositivo,
  };
}

async function cifrado(cifra, caminho, dados, opcoes) {
  const r = registro(caminho, dados, opcoes);
  return { ...r, dados: await Cifra.cifrarDocumento(cifra, r) };
}

const enviar = (s, dispositivo, mudancas) => pedir(s, 'POST', '/sync/mudancas', { corpo: { dispositivo, mudancas } });
const guardar = (s, id, corpo) => pedir(s, 'PUT', `/sync/arquivos/${id}`, { corpo, cabecalhos: { 'X-Prancheta-Dispositivo': APARELHO_A, 'Content-Type': 'application/octet-stream' } });

async function arquivoCifrado(cifra, id, texto) {
  return Buffer.from(await (await Cifra.cifrarArquivo(cifra, id, new Blob([texto]), 'image/png')).arrayBuffer());
}

const novaCifra = () => Cifra.prepararChave(Cifra.gerarChave());

test('a primeira gravação cifrada liga a cifra, e depois o servidor recusa o legível e a outra chave', async () => {
  const s = await subir();
  const cifra = await novaCifra();
  const outra = await novaCifra();
  try {
    // Antes da cifra, tudo como antes.
    assert.equal((await enviar(s, APARELHO_A, [{ seq: 1, base: null, registro: registro('canvas-shards/s1', { texto: SEGREDO }) }])).status, 200);
    let lista = await pedir(s, 'GET', '/sync/mudancas?desde=0');
    assert.equal(lista.json.cifra, null);
    assert.equal(fs.existsSync(path.join(s.pasta, 'cifra.json')), false);

    // A primeira gravação cifrada liga a cifra na posição em que o servidor estava.
    const r = await enviar(s, APARELHO_A, [{ seq: 2, base: 1, registro: await cifrado(cifra, 'canvas-shards/s1', { texto: SEGREDO }, { versao: 2 }) }]);
    assert.equal(r.status, 200);
    assert.equal(r.json.resultados[0].estado, 'aplicada');
    lista = await pedir(s, 'GET', '/sync/mudancas?desde=0');
    assert.deepEqual(lista.json.cifra, { chave: cifra.id, desde: 1 });
    assert.ok(!lista.bruto.toString().includes(SEGREDO));
    const guardado = JSON.parse(fs.readFileSync(path.join(s.pasta, 'cifra.json'), 'utf8'));
    assert.equal(guardado.chave, cifra.id);
    assert.equal(guardado.desde, 1);

    // Legível ou de outra chave: recusado inteiro, sem gravar nada.
    const posicao = s.armazem.posicao;
    const legivel = await enviar(s, APARELHO_B, [
      { seq: 1, base: null, registro: await cifrado(cifra, 'canvas-shards/s2', { a: 1 }, { dispositivo: APARELHO_B }) },
      { seq: 2, base: null, registro: registro('canvas-shards/s3', { texto: SEGREDO }, { dispositivo: APARELHO_B }) },
    ]);
    assert.equal(legivel.status, 409);
    assert.deepEqual(legivel.json, { erro: 'cifra_exigida' });
    const deOutra = await enviar(s, APARELHO_B, [{ seq: 3, base: null, registro: await cifrado(outra, 'canvas-shards/s4', { a: 1 }, { dispositivo: APARELHO_B }) }]);
    assert.equal(deOutra.status, 409);
    assert.deepEqual(deOutra.json, { erro: 'cifra_diferente' });
    assert.equal(s.armazem.posicao, posicao);
    assert.equal(await s.armazem.lerDocumento('canvas-shards/s2'), null);

    // Um envelope malformado conta como legível.
    const quebrado = { ...(await cifrado(cifra, 'canvas-shards/s5', { a: 1 })) };
    quebrado.dados = { ...quebrado.dados, extra: true };
    assert.equal((await enviar(s, APARELHO_A, [{ seq: 3, base: null, registro: quebrado }])).json.erro, 'cifra_exigida');

    // Exclusões não têm conteúdo e continuam aceitas; uma mudança já aplicada, reenviada, é repetida.
    const exclusao = await enviar(s, APARELHO_A, [{ seq: 4, base: s.armazem.posicao, registro: registro('canvas-shards/s1', null, { versao: 3, apagado: true }) }]);
    assert.equal(exclusao.json.resultados[0].estado, 'aplicada');
    const repetida = await enviar(s, APARELHO_A, [{ seq: 1, base: null, registro: registro('canvas-shards/s1', { texto: SEGREDO }) }]);
    assert.equal(repetida.status, 200);
    assert.equal(repetida.json.resultados[0].estado, 'repetida');
  } finally {
    await s.fechar();
  }
});

test('um pedido que mistura chaves antes da cifra é recusado e não liga a cifra', async () => {
  const s = await subir();
  try {
    const a = await novaCifra();
    const b = await novaCifra();
    const r = await enviar(s, APARELHO_A, [
      { seq: 1, base: null, registro: await cifrado(a, 'canvas-shards/s1', { a: 1 }) },
      { seq: 2, base: null, registro: await cifrado(b, 'canvas-shards/s2', { b: 1 }) },
    ]);
    assert.equal(r.status, 409);
    assert.deepEqual(r.json, { erro: 'cifra_diferente' });
    assert.equal(s.armazem.cifra, null);
    assert.equal(s.armazem.posicao, 0);
  } finally {
    await s.fechar();
  }
});

test('um arquivo legível dá lugar ao mesmo arquivo cifrado uma vez, e depois só valem arquivos cifrados com a chave', async () => {
  const s = await subir();
  const cifra = await novaCifra();
  const outra = await novaCifra();
  const id = '0123456789abcdef';
  try {
    assert.equal((await guardar(s, id, Buffer.from(SEGREDO))).status, 201);
    // O primeiro envio cifrado pode ser um arquivo, e ele também liga a cifra.
    const corpo = await arquivoCifrado(cifra, id, SEGREDO);
    const troca = await guardar(s, id, corpo);
    assert.equal(troca.status, 201);
    assert.deepEqual(s.armazem.cifra && s.armazem.cifra.chave, cifra.id);
    const devolvido = await pedir(s, 'GET', `/sync/arquivos/${id}`);
    assert.deepEqual(devolvido.bruto, corpo);
    assert.ok(!fs.readFileSync(path.join(s.pasta, 'arquivos', `${id}.bin`)).includes(Buffer.from(SEGREDO)));
    const lista = await pedir(s, 'GET', '/sync/mudancas?desde=1');
    assert.deepEqual(lista.json.arquivos.map((a) => a.id), [id]);

    // O mesmo conteúdo cifrado é repetido; outro conteúdo cifrado com o mesmo id não troca o primeiro.
    assert.equal((await guardar(s, id, corpo)).status, 200);
    const outroConteudo = await guardar(s, id, await arquivoCifrado(cifra, id, 'outro'));
    assert.equal(outroConteudo.status, 409);
    assert.deepEqual(outroConteudo.json, { erro: 'conflito' });
    assert.deepEqual((await pedir(s, 'GET', `/sync/arquivos/${id}`)).bruto, corpo);

    const legivel = await guardar(s, 'fedcba9876543210', Buffer.from('legível'));
    assert.equal(legivel.status, 409);
    assert.deepEqual(legivel.json, { erro: 'cifra_exigida' });
    const deOutra = await guardar(s, 'fedcba9876543210', await arquivoCifrado(outra, 'fedcba9876543210', 'x'));
    assert.equal(deOutra.status, 409);
    assert.deepEqual(deOutra.json, { erro: 'cifra_diferente' });
    assert.equal((await pedir(s, 'GET', '/sync/arquivos/fedcba9876543210')).status, 404);
  } finally {
    await s.fechar();
  }
});

test('a cifra ligada continua valendo depois de reiniciar o servidor', async () => {
  const s = await subir();
  const cifra = await novaCifra();
  await enviar(s, APARELHO_A, [{ seq: 1, base: null, registro: await cifrado(cifra, 'canvas-shards/s1', { a: 1 }) }]);
  await s.fechar();
  const s2 = await subir(s.pasta);
  try {
    assert.deepEqual((await pedir(s2, 'GET', '/sync/mudancas?desde=0')).json.cifra, { chave: cifra.id, desde: 0 });
    assert.equal((await enviar(s2, APARELHO_A, [{ seq: 2, base: null, registro: registro('canvas-shards/s2', { a: 1 }) }])).json.erro, 'cifra_exigida');
  } finally {
    await s2.fechar();
  }
});

test('a limpeza confere tudo antes e só então tira do histórico as versões legíveis', async () => {
  const s = await subir();
  const cifra = await novaCifra();
  try {
    // Antes da troca: dois quadros e um arquivo legíveis, com histórico.
    await enviar(s, APARELHO_A, [
      { seq: 1, base: null, registro: registro('canvas-shards/s1', { texto: SEGREDO }) },
      { seq: 2, base: null, registro: registro('canvas-shards/s2', { texto: SEGREDO }) },
    ]);
    await guardar(s, '0123456789abcdef', Buffer.from(SEGREDO));

    // Sem cifra no servidor, a limpeza não apaga nada.
    let r = await apagarLegiveis(s.pasta, { espera: 0 });
    assert.equal(r.apagou, false);
    assert.match(r.motivo, /não foi ligada/);

    // Com só parte dos quadros cifrada, também não.
    await guardar(s, '0123456789abcdef', await arquivoCifrado(cifra, '0123456789abcdef', SEGREDO));
    await enviar(s, APARELHO_A, [{ seq: 3, base: 1, registro: await cifrado(cifra, 'canvas-shards/s1', { texto: SEGREDO }, { versao: 2 }) }]);
    const historicoAntes = fs.readdirSync(path.join(s.pasta, 'historico')).map((n) => fs.readFileSync(path.join(s.pasta, 'historico', n), 'utf8')).join('');
    r = await apagarLegiveis(s.pasta, { espera: 0 });
    assert.equal(r.apagou, false);
    assert.match(r.motivo, /1 documentos ou arquivos/);
    assert.deepEqual(r.antes.documentos.exemplos, ['canvas-shards/s2']);
    const historicoDepois = fs.readdirSync(path.join(s.pasta, 'historico')).map((n) => fs.readFileSync(path.join(s.pasta, 'historico', n), 'utf8')).join('');
    assert.equal(historicoDepois, historicoAntes);

    // Com tudo cifrado ou apagado, sai o legível do histórico e ficam as versões cifradas e as exclusões.
    await enviar(s, APARELHO_A, [{ seq: 4, base: 2, registro: registro('canvas-shards/s2', null, { versao: 2, apagado: true }) }]);
    const temporarioAntigo = path.join(s.pasta, 'documentos', 'resto.json.1.abc.tmp');
    const temporarioNovo = path.join(s.pasta, 'documentos', 'andamento.json.1.def.tmp');
    fs.writeFileSync(temporarioAntigo, SEGREDO);
    fs.writeFileSync(temporarioNovo, '{}');
    const antigo = (Date.now() - 60 * 60 * 1000) / 1000;
    fs.utimesSync(temporarioAntigo, antigo, antigo);

    // Uma versão cifrada que o servidor acrescenta ao arquivo antigo, entre a
    // leitura e a troca pelo arquivo limpo, é levada ao novo.
    const durante = await cifrado(cifra, 'canvas-shards/s9', { durante: true });
    let acrescentou = false;
    r = await apagarLegiveis(s.pasta, {
      espera: 0,
      aposLer: async () => {
        if (acrescentou) return;
        acrescentou = true;
        assert.equal((await enviar(s, APARELHO_A, [{ seq: 5, base: null, registro: durante }])).json.resultados[0].estado, 'aplicada');
      },
    });
    assert.equal(acrescentou, true);
    assert.equal(r.apagou, true);
    assert.equal(r.versoes, 2);
    assert.equal(r.temporarios, 1);
    assert.equal(fs.existsSync(temporarioAntigo), false);
    assert.equal(fs.existsSync(temporarioNovo), true);

    const historico = fs.readdirSync(path.join(s.pasta, 'historico')).map((n) => fs.readFileSync(path.join(s.pasta, 'historico', n), 'utf8')).join('');
    assert.ok(!historico.includes(SEGREDO));
    const caminhos = historico.trim().split('\n').map((l) => JSON.parse(l)).map((e) => `${e.caminho}@${e.pos}`).sort();
    assert.equal(caminhos.length, 3);
    assert.ok(caminhos.some((c) => c.startsWith('canvas-shards/s9@')), 'a versão gravada durante a limpeza ficou');
    const final = await conferir(s.pasta);
    assert.equal(final.documentos.legivel + final.arquivos.legivel + final.historico.legivel, 0);
    assert.equal(final.historico.cifrado, 2);
    assert.equal(final.historico.apagado, 1);
    assert.equal((await s.armazem.historico('canvas-shards/s1')).length, 1);

    // Pela linha de comando, a conferência termina sem erro e diz que nada é legível.
    const comando = spawnSync(process.execPath, [path.join(__dirname, '..', 'cifra.cjs'), s.pasta, 'conferir'], { encoding: 'utf8' });
    assert.equal(comando.status, 0, comando.stderr);
    assert.match(comando.stdout, /nada legível na pasta dos dados/);
    assert.ok(!comando.stdout.includes(SEGREDO));
  } finally {
    await s.fechar();
  }
});

test('pela linha de comando, a conferência acusa o legível, e a limpeza recusada termina com erro', () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'prancheta-cifra-cli-'));
  fs.mkdirSync(path.join(pasta, 'documentos'));
  fs.writeFileSync(path.join(pasta, 'documentos', 'a.json'), JSON.stringify({ pos: 1, caminho: 'canvas-shards/s1', registro: registro('canvas-shards/s1', { texto: SEGREDO }) }));
  const conferencia = spawnSync(process.execPath, [path.join(__dirname, '..', 'cifra.cjs'), pasta, 'conferir'], { encoding: 'utf8' });
  assert.equal(conferencia.status, 1);
  assert.match(conferencia.stdout, /documentos atuais: 0 cifrados, 0 sem conteúdo, 1 legíveis/);
  const limpeza = spawnSync(process.execPath, [path.join(__dirname, '..', 'cifra.cjs'), pasta, 'apagar-legiveis'], { encoding: 'utf8' });
  assert.equal(limpeza.status, 1);
  assert.match(limpeza.stderr, /nada foi apagado/);
  assert.ok(fs.existsSync(path.join(pasta, 'documentos', 'a.json')));
  const uso = spawnSync(process.execPath, [path.join(__dirname, '..', 'cifra.cjs'), pasta], { encoding: 'utf8' });
  assert.equal(uso.status, 2);
});
