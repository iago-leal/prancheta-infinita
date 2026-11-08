// Banco local da etapa 05 do plano 002, em web/compat/banco-local.js.
// Executar a partir da raiz do repositório: node --test web/testes/*.test.cjs

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');
const { servirWeb } = require('./apoio/servidor.cjs');

let servidor;
let base;
let navegador;

before(async () => {
  servidor = await servirWeb();
  base = servidor.base;
  navegador = await chromium.launch();
});

after(async () => {
  await navegador?.close();
  await servidor?.fechar();
});

// Abre a página de apoio e deixa o banco em window.banco.
async function abrirPagina(contexto) {
  const pagina = await contexto.newPage();
  const erros = [];
  pagina.on('pageerror', (e) => erros.push(e.message));
  await pagina.goto(`${base}/testes/apoio/banco.html`);
  await pagina.evaluate(async () => {
    window.banco = await BancoLocal.abrir();
    window.eventos = [];
  });
  return { pagina, erros };
}

const esperar = (pagina, condicao, argumento) => pagina.waitForFunction(condicao, argumento, { timeout: 5000 });
const pausa = (ms) => new Promise((pronto) => setTimeout(pronto, ms));

// Funções que a página usa para guardar o que as assinaturas entregam.
async function instalarRegistro(pagina) {
  await pagina.evaluate(() => {
    window.resumirDocumento = (s) => ({ id: s.id, exists: s.exists, data: s.data() ?? null, fromCache: s.metadata.fromCache });
    window.resumirColecao = (s) => ({
      ids: s.docs.map((d) => d.id),
      fromCache: s.metadata.fromCache,
      changes: s.docChanges().map((c) => ({
        type: c.type, id: c.doc.id, oldIndex: c.oldIndex, newIndex: c.newIndex, data: c.type === 'removed' ? null : c.doc.data(),
      })),
    });
  });
}

test('documentos: gravar, ler, atualizar e apagar', async () => {
  const contexto = await navegador.newContext();
  const { pagina, erros } = await abrirPagina(contexto);
  const r = await pagina.evaluate(async () => {
    const ref = banco.doc('canvas-meta/main');
    const vazio = await ref.get();
    await ref.set({ title: 'Quadro', sub: 'teste', rev: 'r1' });
    const lido = await ref.get();
    await ref.update({ sub: 'mudou' });
    const atualizado = (await ref.get()).data();
    // set substitui o documento inteiro.
    await ref.set({ title: 'Novo' });
    const substituido = (await ref.get()).data();
    // data() entrega uma cópia: mudar o objeto lido não muda o banco.
    const copia = (await ref.get()).data();
    copia.title = 'alterado fora';
    const intacto = (await ref.get()).data().title;
    await ref.delete();
    const apagado = await ref.get();
    await ref.delete();
    const codigo = async (f) => { try { await f(); return null; } catch (e) { return e.code; } };
    const atualizarApagado = await codigo(() => ref.update({ x: 1 }));
    const atualizarInexistente = await codigo(() => banco.doc('library/index').update({ x: 1 }));
    // Um fragmento do tamanho máximo que o artefato grava, cerca de 230 KB.
    const items = Array.from({ length: 1500 }, (_, i) => ({ id: `i${i}`, type: 'card', x: i, y: -i, text: 'texto '.repeat(20) }));
    await banco.doc('boards/q1/shards/s1').set({ items, rev: 'r9', by: 'aparelho' });
    const grande = (await banco.doc('boards/q1/shards/s1').get()).data();
    return {
      vazio: { exists: vazio.exists, data: vazio.data() ?? null, id: vazio.id, fromCache: vazio.metadata.fromCache },
      lido: { exists: lido.exists, data: lido.data(), id: lido.id, fromCache: lido.metadata.fromCache, ref: lido.ref.path },
      atualizado, substituido, intacto,
      apagado: { exists: apagado.exists, data: apagado.data() ?? null },
      atualizarApagado, atualizarInexistente,
      grande: { n: grande.items.length, ultimo: grande.items[1499], rev: grande.rev, by: grande.by, bytes: JSON.stringify(grande).length },
    };
  });
  assert.deepEqual(r.vazio, { exists: false, data: null, id: 'main', fromCache: false });
  assert.deepEqual(r.lido, { exists: true, data: { title: 'Quadro', sub: 'teste', rev: 'r1' }, id: 'main', fromCache: false, ref: 'canvas-meta/main' });
  assert.deepEqual(r.atualizado, { title: 'Quadro', sub: 'mudou', rev: 'r1' });
  assert.deepEqual(r.substituido, { title: 'Novo' });
  assert.equal(r.intacto, 'Novo');
  assert.deepEqual(r.apagado, { exists: false, data: null });
  assert.equal(r.atualizarApagado, 'not_found');
  assert.equal(r.atualizarInexistente, 'not_found');
  assert.equal(r.grande.n, 1500);
  assert.deepEqual(r.grande.ultimo, { id: 'i1499', type: 'card', x: 1499, y: -1499, text: 'texto '.repeat(20) });
  assert.equal(r.grande.rev, 'r9');
  assert.equal(r.grande.by, 'aparelho');
  assert.ok(r.grande.bytes > 200000, `fragmento de ${r.grande.bytes} bytes`);
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('coleções: listam só os próprios documentos, em ordem, sem os apagados', async () => {
  const contexto = await navegador.newContext();
  const { pagina, erros } = await abrirPagina(contexto);
  const r = await pagina.evaluate(async () => {
    await banco.doc('canvas-shards/b').set({ items: [2] });
    await banco.doc('canvas-shards/a').set({ items: [1] });
    await banco.doc('canvas-shards/c').set({ items: [5] });
    await banco.doc('canvas-shards/c').delete();
    await banco.doc('canvas-meta/main').set({ title: 'principal' });
    await banco.doc('boards/q1/shards/s1').set({ items: [3] });
    await banco.doc('boards/q2/shards/s1').set({ items: [4] });
    await banco.doc('boards/q1/meta/main').set({ title: 'q1' });
    const resumir = (s) => ({
      ids: s.docs.map((d) => d.id), dados: s.docs.map((d) => d.data()), size: s.size, empty: s.empty,
      fromCache: s.metadata.fromCache, changes: s.docChanges().map((c) => `${c.type}:${c.doc.id}`),
    });
    const principal = resumir(await banco.collection('canvas-shards').get());
    const q1 = resumir(await banco.collection('boards/q1/shards').get());
    const vazia = resumir(await banco.collection('ajuda').get());
    const porColecao = banco.collection('boards/q1/shards').doc('s1');
    const lidoPorColecao = (await porColecao.get()).data();
    const automatico = banco.collection('ajuda').doc();
    const vistos = [];
    (await banco.collection('canvas-shards').get()).forEach((d) => vistos.push(d.id));
    return { principal, q1, vazia, caminho: porColecao.path, lidoPorColecao, automatico: automatico.path, vistos };
  });
  assert.deepEqual(r.principal, {
    ids: ['a', 'b'], dados: [{ items: [1] }, { items: [2] }], size: 2, empty: false, fromCache: false, changes: ['added:a', 'added:b'],
  });
  assert.deepEqual(r.q1.ids, ['s1']);
  assert.deepEqual(r.q1.dados, [{ items: [3] }]);
  assert.equal(r.vazia.empty, true);
  assert.equal(r.vazia.size, 0);
  assert.equal(r.caminho, 'boards/q1/shards/s1');
  assert.deepEqual(r.lidoPorColecao, { items: [3] });
  assert.match(r.automatico, /^ajuda\/[0-9a-f]{20}$/);
  assert.deepEqual(r.vistos, ['a', 'b']);
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('caminhos e dados inválidos são recusados com invalid_argument', async () => {
  const contexto = await navegador.newContext();
  const { pagina, erros } = await abrirPagina(contexto);
  const r = await pagina.evaluate(async () => {
    const sincrono = (f) => { try { f(); return null; } catch (e) { return e.code; } };
    const assincrono = async (f) => { try { await f(); return null; } catch (e) { return e.code; } };
    return {
      caminhos: [
        () => banco.doc('library'), () => banco.doc('boards/q1/shards'), () => banco.collection('canvas-meta/main'),
        () => banco.doc(''), () => banco.doc('a//b'), () => banco.doc('/a/b'), () => banco.collection(undefined),
      ].map(sincrono),
      dados: [
        await assincrono(() => banco.doc('a/b').set([1, 2])),
        await assincrono(() => banco.doc('a/b').set(null)),
        await assincrono(() => banco.doc('a/b').set('texto')),
        await assincrono(() => banco.doc('a/b').update(7)),
        await assincrono(() => banco.guardarArquivo('não é Blob')),
      ],
      nadaGravado: (await banco.doc('a/b').get()).exists,
    };
  });
  assert.deepEqual(r.caminhos, Array(7).fill('invalid_argument'));
  assert.deepEqual(r.dados, Array(5).fill('invalid_argument'));
  assert.equal(r.nadaGravado, false);
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('assinatura de documento avisa a própria página e para quando cancelada', async () => {
  const contexto = await navegador.newContext();
  const { pagina, erros } = await abrirPagina(contexto);
  await instalarRegistro(pagina);
  await pagina.evaluate(() => {
    window.cancelar = banco.doc('library/index').onSnapshot((s) => eventos.push(resumirDocumento(s)));
  });
  await esperar(pagina, () => eventos.length === 1);
  await pagina.evaluate(() => banco.doc('library/index').set({ boards: ['a'] }));
  await esperar(pagina, () => eventos.length === 2);
  // Gravar outro documento não avisa esta assinatura.
  await pagina.evaluate(() => banco.doc('library/outro').set({ x: 1 }));
  await pagina.evaluate(() => banco.doc('library/index').update({ open: 'a' }));
  await esperar(pagina, () => eventos.length === 3);
  await pagina.evaluate(() => banco.doc('library/index').delete());
  await esperar(pagina, () => eventos.length === 4);
  // Cancelar logo depois de gravar descarta a leitura que já estava em curso.
  await pagina.evaluate(async () => { await banco.doc('library/index').set({ boards: ['antes'] }); cancelar(); });
  await pagina.evaluate(() => banco.doc('library/index').set({ boards: ['depois'] }));
  await pausa(300);
  const eventos = await pagina.evaluate(() => eventos);
  assert.deepEqual(eventos, [
    { id: 'index', exists: false, data: null, fromCache: false },
    { id: 'index', exists: true, data: { boards: ['a'] }, fromCache: false },
    { id: 'index', exists: true, data: { boards: ['a'], open: 'a' }, fromCache: false },
    { id: 'index', exists: false, data: null, fromCache: false },
  ]);
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('assinatura de coleção entrega docChanges com added, modified e removed', async () => {
  const contexto = await navegador.newContext();
  const { pagina, erros } = await abrirPagina(contexto);
  await instalarRegistro(pagina);
  await pagina.evaluate(async () => {
    await banco.doc('boards/q1/shards/a').set({ items: [{ id: 'x' }], rev: 'r1' });
    window.cancelar = banco.collection('boards/q1/shards').onSnapshot((s) => eventos.push(resumirColecao(s)));
  });
  await esperar(pagina, () => eventos.length === 1);
  await pagina.evaluate(() => banco.doc('boards/q1/shards/b').set({ items: [], rev: 'r2' }));
  await esperar(pagina, () => eventos.length === 2);
  await pagina.evaluate(() => banco.doc('boards/q1/shards/a').update({ rev: 'r3' }));
  await esperar(pagina, () => eventos.length === 3);
  await pagina.evaluate(() => banco.doc('boards/q1/shards/a').delete());
  await esperar(pagina, () => eventos.length === 4);
  // Outras coleções, inclusive a vizinha boards/q1/meta, não avisam esta assinatura.
  await pagina.evaluate(async () => {
    await banco.doc('boards/q2/shards/a').set({ items: [] });
    await banco.doc('boards/q1/meta/main').set({ title: 'q1' });
    await banco.doc('boards/q1/shards/c').set({ items: [] });
  });
  await esperar(pagina, () => eventos.length === 5);
  await pausa(200);
  const eventos = await pagina.evaluate(() => eventos);
  assert.equal(eventos.length, 5);
  assert.ok(eventos.every((e) => e.fromCache === false));
  assert.deepEqual(eventos.map((e) => e.ids), [['a'], ['a', 'b'], ['a', 'b'], ['b'], ['b', 'c']]);
  assert.deepEqual(eventos.map((e) => e.changes), [
    [{ type: 'added', id: 'a', oldIndex: -1, newIndex: 0, data: { items: [{ id: 'x' }], rev: 'r1' } }],
    [{ type: 'added', id: 'b', oldIndex: -1, newIndex: 1, data: { items: [], rev: 'r2' } }],
    [{ type: 'modified', id: 'a', oldIndex: 0, newIndex: 0, data: { items: [{ id: 'x' }], rev: 'r3' } }],
    [{ type: 'removed', id: 'a', oldIndex: 0, newIndex: -1, data: null }],
    [{ type: 'added', id: 'c', oldIndex: -1, newIndex: 1, data: { items: [] } }],
  ]);

  // Uma rajada de gravações nunca entrega um estado mais antigo depois de um mais novo.
  await pagina.evaluate(async () => {
    eventos.length = 0;
    await Promise.all(Array.from({ length: 30 }, (_, n) => banco.doc('boards/q1/shards/b').set({ items: [], n })));
  });
  await esperar(pagina, () => eventos.length > 0 && eventos.at(-1).changes.some((c) => c.id === 'b' && c.data.n === 29));
  await pausa(200);
  const rajada = await pagina.evaluate(() => eventos.flatMap((e) => e.changes.filter((c) => c.id === 'b').map((c) => c.data.n)));
  assert.equal(rajada.at(-1), 29);
  assert.deepEqual(rajada, [...rajada].sort((x, y) => x - y), `ordem entregue: ${rajada.join(',')}`);

  await pagina.evaluate(() => { cancelar(); eventos.length = 0; return banco.doc('boards/q1/shards/d').set({ items: [] }); });
  await pausa(300);
  assert.equal(await pagina.evaluate(() => eventos.length), 0);
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('leituras que terminam fora de ordem não entregam um estado antigo', async () => {
  const contexto = await navegador.newContext();
  const { pagina, erros } = await abrirPagina(contexto);
  await pagina.evaluate(async () => {
    await banco.doc('library/index').set({ n: 0 });
    banco.doc('library/index').onSnapshot((s) => eventos.push(s.data().n));
  });
  await esperar(pagina, () => eventos.length === 1);
  // Atrasa a primeira leitura depois de feita, para que ela termine depois da segunda.
  await pagina.evaluate(async () => {
    const lerOriginal = banco._ler.bind(banco);
    let atrasar = true;
    banco._ler = async (caminho) => {
      const registro = await lerOriginal(caminho);
      if (atrasar) {
        atrasar = false;
        await new Promise((pronto) => setTimeout(pronto, 300));
      }
      return registro;
    };
    await banco.doc('library/index').set({ n: 1 });
    await banco.doc('library/index').set({ n: 2 });
  });
  await pausa(600);
  assert.deepEqual(await pagina.evaluate(() => eventos), [0, 2]);
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('assinaturas avisam as outras abas da mesma origem', async () => {
  const contexto = await navegador.newContext();
  const a = await abrirPagina(contexto);
  const b = await abrirPagina(contexto);
  for (const { pagina } of [a, b]) {
    await instalarRegistro(pagina);
    await pagina.evaluate(() => {
      window.eventosDoc = [];
      banco.collection('canvas-shards').onSnapshot((s) => eventos.push(resumirColecao(s)));
      banco.doc('library/index').onSnapshot((s) => eventosDoc.push(resumirDocumento(s)));
    });
    await esperar(pagina, () => eventos.length === 1 && eventosDoc.length === 1);
  }
  // A aba B grava; a aba A vê.
  await b.pagina.evaluate(() => banco.doc('canvas-shards/s1').set({ items: [{ id: 'cartao' }], rev: 'b1', by: 'aba-b' }));
  await esperar(a.pagina, () => eventos.length === 2);
  await b.pagina.evaluate(() => banco.doc('canvas-shards/s1').update({ rev: 'b2' }));
  await esperar(a.pagina, () => eventos.length === 3);
  await b.pagina.evaluate(() => banco.doc('canvas-shards/s1').delete());
  await esperar(a.pagina, () => eventos.length === 4);
  await b.pagina.evaluate(() => banco.doc('library/index').set({ boards: ['main'] }));
  await esperar(a.pagina, () => eventosDoc.length === 2);
  // A aba A grava; a aba B vê, e a própria aba A também.
  await a.pagina.evaluate(() => banco.doc('canvas-shards/s2').set({ items: [], rev: 'a1', by: 'aba-a' }));
  await esperar(b.pagina, () => eventos.length === 5);
  await esperar(a.pagina, () => eventos.length === 5);

  const vistosEmA = await a.pagina.evaluate(() => ({ eventos, eventosDoc }));
  assert.deepEqual(vistosEmA.eventos.map((e) => e.changes.map((c) => `${c.type}:${c.id}`)), [[], ['added:s1'], ['modified:s1'], ['removed:s1'], ['added:s2']]);
  assert.deepEqual(vistosEmA.eventos[1].changes[0].data, { items: [{ id: 'cartao' }], rev: 'b1', by: 'aba-b' });
  assert.ok(vistosEmA.eventos.every((e) => e.fromCache === false));
  assert.deepEqual(vistosEmA.eventosDoc.at(-1), { id: 'index', exists: true, data: { boards: ['main'] }, fromCache: false });
  const vistoEmB = await b.pagina.evaluate(() => eventos.at(-1));
  assert.deepEqual(vistoEmB.changes, [{ type: 'added', id: 's2', oldIndex: -1, newIndex: 0, data: { items: [], rev: 'a1', by: 'aba-a' } }]);
  assert.deepEqual([...a.erros, ...b.erros], []);
  await contexto.close();
});

test('arquivos enviados ficam no banco local e são exibidos sem rede', async () => {
  const contexto = await navegador.newContext();
  const { pagina, erros } = await abrirPagina(contexto);
  const { imagem, documento } = await pagina.evaluate(async () => {
    const tela = document.createElement('canvas');
    tela.width = 64;
    tela.height = 48;
    const g = tela.getContext('2d');
    g.fillStyle = 'rgb(204, 51, 51)';
    g.fillRect(0, 0, 64, 48);
    const png = await new Promise((pronto) => tela.toBlob(pronto, 'image/png'));
    const imagem = (await banco.guardarArquivo(png, { type: 'image/png' })).id;
    // Sem tipo no Blob, vale o tipo informado no envio, como no upload do artefato.
    const documento = (await banco.guardarArquivo(new Blob(['%PDF-1.4 conteúdo']), { type: 'application/pdf' })).id;
    return { imagem, documento };
  });
  // Mesmo formato de id que o artefato aceita em /_blob/<id>.
  assert.match(imagem, /^[A-Za-z0-9_-]{8,64}$/);
  assert.notEqual(imagem, documento);

  await contexto.setOffline(true);
  const r = await pagina.evaluate(async ({ imagem, documento }) => {
    const blob = await banco.lerArquivo(imagem);
    const img = document.createElement('img');
    img.src = URL.createObjectURL(blob);
    document.body.append(img);
    await img.decode();
    const tela = document.createElement('canvas');
    tela.width = img.naturalWidth;
    tela.height = img.naturalHeight;
    const g = tela.getContext('2d');
    g.drawImage(img, 0, 0);
    const pdf = await banco.lerArquivo(documento);
    // O banco continua gravando e lendo documentos sem rede.
    await banco.doc('boards/q1/shards/s1').set({ items: [{ id: 'img', type: 'image', asset: imagem }] });
    return {
      online: navigator.onLine,
      tipo: blob.type, largura: img.naturalWidth, altura: img.naturalHeight, pixel: Array.from(g.getImageData(10, 10, 1, 1).data),
      pdf: { tipo: pdf.type, texto: await pdf.text() },
      inexistente: await banco.lerArquivo('0123456789abcdef'),
      citacao: (await banco.doc('boards/q1/shards/s1').get()).data().items[0].asset,
    };
  }, { imagem, documento });
  assert.equal(r.online, false);
  assert.equal(r.tipo, 'image/png');
  assert.equal(r.largura, 64);
  assert.equal(r.altura, 48);
  assert.deepEqual(r.pixel, [204, 51, 51, 255]);
  assert.deepEqual(r.pdf, { tipo: 'application/pdf', texto: '%PDF-1.4 conteúdo' });
  assert.equal(r.inexistente, null);
  assert.equal(r.citacao, imagem);
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('cada gravação registra o que mudou, quando e em qual aparelho', async () => {
  const contexto = await navegador.newContext();
  const { pagina, erros } = await abrirPagina(contexto);
  const r = await pagina.evaluate(async () => {
    const lerRegistro = (caminho) => new Promise((pronto, falha) => {
      const abertura = indexedDB.open('prancheta-banco-prancheta');
      abertura.onerror = () => falha(abertura.error);
      abertura.onsuccess = () => {
        const idb = abertura.result;
        const pedido = idb.transaction('documentos').objectStore('documentos').get(caminho);
        pedido.onsuccess = () => { pronto(pedido.result); idb.close(); };
      };
    });
    const inicio = Date.now();
    const ref = banco.doc('canvas-meta/main');
    await ref.set({ title: 'a' });
    await ref.update({ sub: 'b', rev: 'r1' });
    await ref.delete();
    const marca = await lerRegistro('canvas-meta/main');
    await ref.delete();
    await ref.set({ title: 'c' });
    const arquivo = (await banco.guardarArquivo(new Blob(['x']), { type: 'text/plain' })).id;
    const registro = await lerRegistro('canvas-meta/main');
    const log = await banco.mudancas();
    const desde = await banco.mudancas(log[1].seq);
    // Vinte atualizações ao mesmo tempo no mesmo documento: nenhuma se perde e nenhuma versão se repete.
    const concorrido = banco.doc('boards/q1/shards/s1');
    await concorrido.set({ items: [] });
    await Promise.all(Array.from({ length: 20 }, (_, i) => concorrido.update({ [`f${i}`]: i })));
    const final = (await concorrido.get()).data();
    const versoes = (await banco.mudancas(log.at(-1).seq)).map((m) => m.versao);
    return { inicio, fim: Date.now(), marca, registro, log, desde, arquivo, dispositivo: banco.dispositivo, final, versoes };
  });
  assert.match(r.dispositivo, /^[0-9a-f]{16}$/);
  assert.deepEqual(r.log.map((m) => [m.caminho, m.tipo, m.versao]), [
    ['canvas-meta/main', 'set', 1],
    ['canvas-meta/main', 'update', 2],
    ['canvas-meta/main', 'delete', 3],
    ['canvas-meta/main', 'set', 4],
    [`_arquivos/${r.arquivo}`, 'arquivo', 1],
  ]);
  assert.deepEqual(r.log[1].campos, ['sub', 'rev']);
  for (let i = 0; i < r.log.length; i++) {
    const m = r.log[i];
    assert.equal(m.dispositivo, r.dispositivo);
    assert.ok(m.em >= r.inicio && m.em <= r.fim, `horário ${m.em}`);
    if (i > 0) {
      assert.ok(m.seq > r.log[i - 1].seq);
      assert.ok(m.em >= r.log[i - 1].em);
    }
  }
  assert.deepEqual(r.desde.map((m) => m.seq), r.log.slice(2).map((m) => m.seq));
  // A exclusão deixa uma marca com a versão, em vez de apagar o registro.
  assert.equal(r.marca.apagado, true);
  assert.equal(r.marca.dados, null);
  assert.equal(r.marca.versao, 3);
  assert.deepEqual(
    { ...r.registro, atualizadoEm: undefined },
    { caminho: 'canvas-meta/main', colecao: 'canvas-meta', id: 'main', dados: { title: 'c' }, apagado: false, versao: 4, atualizadoEm: undefined, dispositivo: r.dispositivo },
  );
  assert.equal(r.registro.atualizadoEm, r.log[3].em);
  assert.deepEqual(Object.keys(r.final).length, 21);
  assert.deepEqual(r.versoes, Array.from({ length: 21 }, (_, i) => i + 1));
  assert.deepEqual(erros, []);
  await contexto.close();
});

// Grava um quadro pequeno: documento, fragmento e arquivo.
async function gravarQuadro(pagina) {
  return pagina.evaluate(async () => {
    await banco.doc('library/index').set({ boards: [{ id: 'main', title: 'Principal' }] });
    await banco.doc('canvas-shards/s1').set({ items: [{ id: 'c1', type: 'card', text: 'persistiu' }], rev: 'r1', by: 'teste' });
    await banco.doc('canvas-shards/s2').set({ items: [] });
    await banco.doc('canvas-shards/s2').delete();
    const { id } = await banco.guardarArquivo(new Blob(['bytes do arquivo'], { type: 'text/plain' }));
    return { arquivo: id, dispositivo: banco.dispositivo, mudancas: (await banco.mudancas()).length };
  });
}

async function lerQuadro(pagina, arquivo) {
  return pagina.evaluate(async (arquivo) => {
    const fragmentos = await banco.collection('canvas-shards').get();
    return {
      biblioteca: (await banco.doc('library/index').get()).data(),
      fragmentos: fragmentos.docs.map((d) => [d.id, d.data()]),
      arquivo: await (await banco.lerArquivo(arquivo)).text(),
      dispositivo: banco.dispositivo,
      mudancas: (await banco.mudancas()).length,
    };
  }, arquivo);
}

function conferirQuadro(lido, gravado) {
  assert.deepEqual(lido.biblioteca, { boards: [{ id: 'main', title: 'Principal' }] });
  assert.deepEqual(lido.fragmentos, [['s1', { items: [{ id: 'c1', type: 'card', text: 'persistiu' }], rev: 'r1', by: 'teste' }]]);
  assert.equal(lido.arquivo, 'bytes do arquivo');
  assert.equal(lido.dispositivo, gravado.dispositivo, 'o aparelho mantém o mesmo identificador');
  assert.equal(lido.mudancas, gravado.mudancas);
}

test('os dados sobrevivem a recarregar a página', async () => {
  const contexto = await navegador.newContext();
  const { pagina, erros } = await abrirPagina(contexto);
  const gravado = await gravarQuadro(pagina);
  await pagina.reload();
  await pagina.evaluate(async () => { window.banco = await BancoLocal.abrir(); });
  conferirQuadro(await lerQuadro(pagina, gravado.arquivo), gravado);
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('os dados sobrevivem a fechar e reabrir o navegador', async () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'prancheta-banco-'));
  // Cada contexto persistente é um processo do navegador; se um teste falhar
  // com ele aberto, o processo prende o Node, por isso o finally o fecha.
  let contexto = null;
  try {
    contexto = await chromium.launchPersistentContext(pasta);
    let { pagina, erros } = await abrirPagina(contexto);
    const gravado = await gravarQuadro(pagina);
    assert.deepEqual(erros, []);
    await contexto.close();
    contexto = null;

    // Outro processo do navegador, com a mesma pasta de perfil e a mesma origem.
    contexto = await chromium.launchPersistentContext(pasta);
    ({ pagina, erros } = await abrirPagina(contexto));
    await contexto.setOffline(true);
    conferirQuadro(await lerQuadro(pagina, gravado.arquivo), gravado);
    assert.deepEqual(erros, []);
  } finally {
    await contexto?.close();
    fs.rmSync(pasta, { recursive: true, force: true });
  }
});
