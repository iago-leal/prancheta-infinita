// Testes da combinação em três vias, em web/app/compat/combinar.js, que a
// sincronização usa para juntar as mudanças de dois aparelhos sem perder itens.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { combinar, igual } = require('../app/compat/combinar.js');

const cartao = (id, texto, extra = {}) => ({ id, type: 'card', x: 0, y: 0, blocks: [{ h: texto }], ...extra });
const fragmento = (items, rev = 'r0') => ({ items, rev, by: 'a' });
const ids = (dados) => dados.items.map((it) => it.id);
const porId = (dados, id) => dados.items.find((it) => it.id === id);

test('igualdade de valores JSON, sem depender da ordem dos campos', () => {
  assert.ok(igual({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 }));
  assert.ok(igual({ a: 1, b: undefined }, { a: 1 }));
  assert.ok(!igual({ a: 1 }, { a: 2 }));
  assert.ok(!igual([1, 2], [2, 1]));
  assert.ok(!igual({ a: [] }, { a: {} }));
  assert.ok(!igual(null, {}));
});

test('o que só um lado mudou fica com a mudança desse lado', () => {
  const base = fragmento([cartao('c1', 'um')]);
  const local = fragmento([cartao('c1', 'um'), cartao('c2', 'dois')], 'r1');
  assert.deepEqual(combinar(base, local, base), local);
  assert.deepEqual(combinar(base, local, local), local);
  // Só o remoto mudou: o resultado traz as mudanças dele, com um rev novo,
  // porque difere da versão local.
  const r = combinar(base, base, local);
  assert.deepEqual({ ...r, rev: 'r1' }, local);
  assert.notEqual(r.rev, 'r0');
});

test('itens novos dos dois aparelhos no mesmo fragmento ficam todos', () => {
  const base = fragmento([cartao('c1', 'um')]);
  const local = fragmento([cartao('c1', 'um'), cartao('c2', 'do Boox')], 'r1');
  const remoto = fragmento([cartao('c1', 'um'), cartao('c3', 'do computador')], 'r2');
  const r = combinar(base, local, remoto);
  assert.deepEqual(ids(r), ['c1', 'c2', 'c3']);
  assert.equal(porId(r, 'c3').blocks[0].h, 'do computador');
  // O resultado difere da versão local, e o rev novo faz a página aplicá-lo.
  assert.notEqual(r.rev, 'r1');
  assert.notEqual(r.rev, 'r2');
  assert.match(r.rev, /^s[0-9a-z]+$/);
});

test('o mesmo item mudado em campos diferentes junta as duas mudanças', () => {
  const base = fragmento([cartao('c1', 'texto', { x: 0, y: 0 })]);
  const local = fragmento([cartao('c1', 'texto', { x: 120, y: 40 })], 'r1');
  const remoto = fragmento([cartao('c1', 'texto editado', { x: 0, y: 0 })], 'r2');
  const r = combinar(base, local, remoto);
  assert.deepEqual(porId(r, 'c1'), cartao('c1', 'texto editado', { x: 120, y: 40 }));
});

test('o mesmo campo mudado dos dois lados fica com o lado que prevalece', () => {
  const base = fragmento([cartao('c1', 'original')]);
  const local = fragmento([cartao('c1', 'versão do Boox')], 'r1');
  const remoto = fragmento([cartao('c1', 'versão do computador')], 'r2');
  assert.equal(porId(combinar(base, local, remoto, { prevalece: 'remoto' }), 'c1').blocks[0].h, 'versão do computador');
  assert.equal(porId(combinar(base, local, remoto, { prevalece: 'local' }), 'c1').blocks[0].h, 'versão do Boox');
});

test('um item apagado de um lado e mudado do outro fica com a mudança', () => {
  const base = fragmento([cartao('c1', 'um'), cartao('c2', 'dois')]);
  const apagouC1 = fragmento([cartao('c2', 'dois')], 'r1');
  const mudouC1 = fragmento([cartao('c1', 'um, revisto'), cartao('c2', 'dois')], 'r2');
  assert.deepEqual(ids(combinar(base, apagouC1, mudouC1)), ['c2', 'c1']);
  assert.equal(porId(combinar(base, apagouC1, mudouC1), 'c1').blocks[0].h, 'um, revisto');
  assert.deepEqual(ids(combinar(base, mudouC1, apagouC1)), ['c1', 'c2']);
});

test('um item apagado de um lado e intacto do outro sai', () => {
  const base = fragmento([cartao('c1', 'um'), cartao('c2', 'dois')]);
  const apagouC1 = fragmento([cartao('c2', 'dois')], 'r1');
  const novoC3 = fragmento([cartao('c1', 'um'), cartao('c2', 'dois'), cartao('c3', 'três')], 'r2');
  assert.deepEqual(ids(combinar(base, apagouC1, novoC3)), ['c2', 'c3']);
  assert.deepEqual(ids(combinar(base, novoC3, apagouC1)), ['c2', 'c3']);
});

test('documento apagado de um lado e mudado do outro continua existindo', () => {
  const base = fragmento([cartao('c1', 'um')]);
  const mudado = fragmento([cartao('c1', 'um'), cartao('c2', 'dois')], 'r1');
  assert.deepEqual(ids(combinar(base, undefined, mudado)), ['c1', 'c2']);
  assert.deepEqual(ids(combinar(base, mudado, undefined)), ['c1', 'c2']);
  // Apagado de um lado e intacto do outro, o documento fica apagado.
  assert.equal(combinar(base, undefined, base), undefined);
  assert.equal(combinar(base, base, undefined), undefined);
});

test('sem base, as duas versões criadas são combinadas, como a biblioteca de dois aparelhos novos', () => {
  const local = { folders: [{ id: 'p1', name: 'Estudos' }], boards: [{ id: 'main', title: 'Principal', folder: null }], rev: 'a1' };
  const remoto = { folders: [], boards: [{ id: 'main', title: 'Principal', folder: null }, { id: 'q2', title: 'Plano', folder: null }], rev: 'b1' };
  const r = combinar(undefined, local, remoto);
  assert.deepEqual(r.boards.map((b) => b.id), ['main', 'q2']);
  assert.deepEqual(r.folders.map((p) => p.id), ['p1']);
});

test('listas sem id e valores simples mudados dos dois lados ficam com o lado que prevalece', () => {
  const base = { tags: ['a'], n: 1 };
  const local = { tags: ['a', 'b'], n: 2 };
  const remoto = { tags: ['a', 'c'], n: 3 };
  assert.deepEqual(combinar(base, local, remoto, { prevalece: 'remoto' }), remoto);
  assert.deepEqual(combinar(base, local, remoto, { prevalece: 'local' }), local);
});

test('o rev só muda quando o resultado difere da versão local', () => {
  const base = fragmento([cartao('c1', 'um')]);
  const local = fragmento([cartao('c1', 'um'), cartao('c2', 'dois')], 'r1');
  assert.equal(combinar(base, local, base).rev, 'r1');
  const remoto = fragmento([cartao('c1', 'um')], 'r2');
  // Só o rev mudou do outro lado; prevalecendo o local, o resultado é o próprio local.
  assert.equal(combinar(base, local, remoto, { prevalece: 'local' }).rev, 'r1');
});

test('quem gravou e a marca da gravação acompanham a versão local', () => {
  const base = { items: [cartao('c1', 'um')], rev: 'p1', by: 'a' };
  const local = { items: [cartao('c1', 'um, editado')], rev: 'p2', by: 'a' };
  const remoto = { items: [cartao('c1', 'um'), cartao('c2', 'dois')], rev: 'r2', by: 'b' };
  const r = combinar(base, local, remoto, { prevalece: 'local' });
  assert.equal(r.by, 'a');
  assert.notEqual(r.rev, 'p2');
  // Se a única diferença do remoto é quem gravou e o rev, o resultado é o próprio local.
  const soMarcas = { items: [cartao('c1', 'um')], rev: 'r3', by: 'b' };
  assert.deepEqual(combinar(base, local, soMarcas), local);
});

test('não muda as versões recebidas', () => {
  const base = fragmento([cartao('c1', 'um')]);
  const local = fragmento([cartao('c1', 'um'), cartao('c2', 'dois')], 'r1');
  const remoto = fragmento([cartao('c1', 'um'), cartao('c3', 'três')], 'r2');
  const copias = JSON.stringify([base, local, remoto]);
  combinar(base, local, remoto);
  assert.equal(JSON.stringify([base, local, remoto]), copias);
});
