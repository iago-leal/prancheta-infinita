// Cifra ponta a ponta, etapa 02 do plano 005: o módulo web/app/compat/cifra.js
// roda no Node, que tem a mesma WebCrypto do navegador.
// Executar a partir da raiz do repositório: node --test web/testes/*.test.cjs

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

require('../app/compat/cifra.js');

const Cifra = globalThis.CifraPrancheta;

const registro = (dados, extra = {}) => ({
  caminho: 'canvas-shards/abc123', colecao: 'canvas-shards', id: 'abc123',
  dados, apagado: false, versao: 3, atualizadoEm: 1762700000000, dispositivo: 'boox-1', ...extra,
});

const QUADRO = { items: [{ type: 'card', blocks: [{ h: 'segredo do quadro' }] }], titulo: 'Leituras' };

test('a chave nova tem 13 grupos de 4 e é lida de volta, com minúsculas, espaços e letras confundíveis', () => {
  const texto = Cifra.gerarChave();
  assert.match(texto, /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){12}$/);
  const bytes = Cifra.lerChave(texto);
  assert.equal(bytes.length, 32);
  assert.equal(Cifra.formatarChave(bytes), texto);
  const relaxado = texto.toLowerCase().replace(/-/g, ' ').replace(/0/g, 'o').replace(/1/g, 'l');
  assert.deepEqual(Cifra.lerChave(relaxado), bytes);
  assert.notEqual(Cifra.gerarChave(), texto);
});

test('uma chave com tamanho, letra ou fim errados é recusada', () => {
  const texto = Cifra.gerarChave();
  assert.throws(() => Cifra.lerChave(texto.slice(0, -1)), { code: 'chave_invalida' });
  assert.throws(() => Cifra.lerChave(`${texto}0`), { code: 'chave_invalida' });
  assert.throws(() => Cifra.lerChave(texto.replace(/^./, 'U')), { code: 'chave_invalida' });
  // A última letra só pode carregar 1 bit da chave; as outras 4 posições são zero.
  const ultima = texto.slice(-1);
  const trocada = ultima === 'Z' ? 'Y' : 'Z';
  assert.throws(() => Cifra.lerChave(texto.slice(0, -1) + trocada), { code: 'chave_invalida' });
});

test('a mesma chave dá o mesmo identificador, e outra chave dá outro, sem revelar a chave', async () => {
  const texto = Cifra.gerarChave();
  const a = await Cifra.prepararChave(texto);
  const b = await Cifra.prepararChave(texto.toLowerCase());
  const c = await Cifra.prepararChave(Cifra.gerarChave());
  assert.match(a.id, /^[A-Za-z0-9_-]{22}$/);
  assert.equal(a.id, b.id);
  assert.notEqual(a.id, c.id);
  assert.equal(a.chave.extractable, false);
  assert.deepEqual([...a.chave.usages].sort(), ['decrypt', 'encrypt']);
  assert.ok(!a.id.includes(texto.replace(/-/g, '').slice(0, 8)));
});

test('o documento sai num envelope sem nada legível e volta igual', async () => {
  const cifra = await Cifra.prepararChave(Cifra.gerarChave());
  const original = registro(QUADRO);
  const envelope = await Cifra.cifrarDocumento(cifra, original);
  assert.ok(Cifra.ehEnvelope(envelope));
  assert.deepEqual(Object.keys(envelope).sort(), ['chave', 'cifra', 'conteudo', 'iv']);
  assert.equal(envelope.chave, cifra.id);
  const texto = JSON.stringify(envelope);
  for (const legivel of ['segredo', 'Leituras', 'card', 'items']) assert.ok(!texto.includes(legivel), legivel);
  assert.deepEqual(await Cifra.decifrarDocumento(cifra, { ...original, dados: envelope }), QUADRO);
  // Cada cifragem usa outro vetor inicial.
  const outro = await Cifra.cifrarDocumento(cifra, original);
  assert.notEqual(outro.iv, envelope.iv);
  assert.notEqual(outro.conteudo, envelope.conteudo);
  assert.ok(!Cifra.ehEnvelope(QUADRO));
});

test('conteúdo alterado, trocado de documento ou com outro horário é recusado', async () => {
  const cifra = await Cifra.prepararChave(Cifra.gerarChave());
  const original = registro(QUADRO);
  const envelope = await Cifra.cifrarDocumento(cifra, original);
  const alterado = { ...envelope, conteudo: (envelope.conteudo[0] === 'A' ? 'B' : 'A') + envelope.conteudo.slice(1) };
  const casos = [
    { ...original, dados: alterado },
    { ...original, caminho: 'canvas-shards/outro', id: 'outro', dados: envelope },
    { ...original, atualizadoEm: original.atualizadoEm + 1, dados: envelope },
    { ...original, versao: original.versao + 1, dados: envelope },
    { ...original, dispositivo: 'computador', dados: envelope },
  ];
  for (const caso of casos) await assert.rejects(Cifra.decifrarDocumento(cifra, caso), { code: 'cifra_invalida' });
});

test('outra chave não abre o documento nem o arquivo', async () => {
  const cifra = await Cifra.prepararChave(Cifra.gerarChave());
  const outra = await Cifra.prepararChave(Cifra.gerarChave());
  const envelope = await Cifra.cifrarDocumento(cifra, registro(QUADRO));
  await assert.rejects(Cifra.decifrarDocumento(outra, registro(envelope)), { code: 'cifra_diferente' });
  // Mesmo com o identificador forjado, a decifragem falha.
  await assert.rejects(Cifra.decifrarDocumento(outra, registro({ ...envelope, chave: outra.id })), { code: 'cifra_invalida' });
  const blob = await Cifra.cifrarArquivo(cifra, 'arquivo-1234', new Blob([new Uint8Array([1, 2, 3])]), 'image/png');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  await assert.rejects(Cifra.decifrarArquivo(outra, 'arquivo-1234', bytes), { code: 'cifra_diferente' });
});

test('o arquivo sai cifrado com o tipo dentro e volta igual; trocado de id ou alterado, é recusado', async () => {
  const cifra = await Cifra.prepararChave(Cifra.gerarChave());
  const conteudo = new Uint8Array(70000).map((_, i) => (i * 7) % 251);
  const blob = await Cifra.cifrarArquivo(cifra, 'arquivo-1234', new Blob([conteudo]), 'image/png');
  assert.equal(blob.type, 'application/octet-stream');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.ok(Cifra.ehArquivoCifrado(bytes));
  assert.equal(new TextDecoder().decode(bytes.subarray(0, 8)), 'PRCIFRA1');
  assert.ok(!Buffer.from(bytes).includes(Buffer.from('image/png')));
  assert.ok(!Buffer.from(bytes).includes(Buffer.from(conteudo.subarray(1000, 1032))));
  const aberto = await Cifra.decifrarArquivo(cifra, 'arquivo-1234', bytes);
  assert.equal(aberto.tipo, 'image/png');
  assert.deepEqual(new Uint8Array(await aberto.blob.arrayBuffer()), conteudo);
  await assert.rejects(Cifra.decifrarArquivo(cifra, 'arquivo-9999', bytes), { code: 'cifra_invalida' });
  const alterado = bytes.slice();
  alterado[alterado.length - 40] ^= 1;
  await assert.rejects(Cifra.decifrarArquivo(cifra, 'arquivo-1234', alterado), { code: 'cifra_invalida' });
  assert.ok(!Cifra.ehArquivoCifrado(conteudo));
});
