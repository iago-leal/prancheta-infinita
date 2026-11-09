// Biblioteca de livros, etapa 03 do plano 005: o servidor lista os PDFs e
// EPUBs de uma pasta e entrega cada um só com a chave, sem seguir atalhos nem
// sair da pasta, e identifica cada livro como o KOReader.
// Executar a partir da raiz do repositório: node --test servidor/testes/*.test.cjs

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { Armazem } = require('../armazem.cjs');
const { criarServidor } = require('../servidor.cjs');
const { Biblioteca, resumoDoKoreader } = require('../biblioteca.cjs');

const CHAVE = 'chave-de-teste-com-mais-de-32-caracteres-0123456789';
const ORIGEM_DA_CASCA = 'https://appassets.androidplatform.net';
const temporaria = (nome) => fs.mkdtempSync(path.join(os.tmpdir(), `prancheta-${nome}-`));

// O resumo parcial do KOReader, escrito à parte, com as posições por extenso.
function resumoEsperado(conteudo) {
  const md5 = crypto.createHash('md5');
  for (const posicao of [0, 1024, 4096, 16384, 65536, 262144, 1048576, 4194304, 16777216, 67108864, 268435456, 1073741824]) {
    if (posicao >= conteudo.length) break;
    md5.update(conteudo.subarray(posicao, posicao + 1024));
  }
  return md5.digest('hex');
}

const conteudoDe = (tamanho, semente) => Buffer.from(Array.from({ length: tamanho }, (_, i) => (i * 31 + semente) % 251));

// Uma biblioteca com livros, arquivos que não são livros, pastas ocultas do
// KOReader, atalhos para fora e um segredo fora da pasta.
function montarBiblioteca() {
  const raiz = temporaria('biblioteca');
  const livros = path.join(raiz, 'livros');
  const fora = path.join(raiz, 'fora');
  fs.mkdirSync(path.join(livros, 'Romances', 'Antigos'), { recursive: true });
  fs.mkdirSync(path.join(livros, '.oculta'));
  fs.mkdirSync(path.join(livros, 'Romances', 'Dom Casmurro.sdr'));
  fs.mkdirSync(fora);
  const arquivos = {
    grande: conteudoDe(300000, 1),
    epub: conteudoDe(5000, 2),
    pequeno: conteudoDe(700, 3),
  };
  fs.writeFileSync(path.join(livros, 'Manual.pdf'), arquivos.grande);
  fs.writeFileSync(path.join(livros, 'Romances', 'Dom Casmurro.EPUB'), arquivos.epub);
  fs.writeFileSync(path.join(livros, 'Romances', 'Antigos', 'Conto.pdf'), arquivos.pequeno);
  fs.writeFileSync(path.join(livros, 'Romances', 'notas.txt'), 'não é livro');
  fs.writeFileSync(path.join(livros, '.oculta', 'escondido.pdf'), conteudoDe(100, 4));
  fs.writeFileSync(path.join(livros, 'Romances', 'Dom Casmurro.sdr', 'metadata.pdf'), conteudoDe(100, 5));
  fs.writeFileSync(path.join(fora, 'segredo.pdf'), Buffer.from('segredo fora da biblioteca'));
  fs.symlinkSync(path.join(fora, 'segredo.pdf'), path.join(livros, 'atalho.pdf'));
  fs.symlinkSync(fora, path.join(livros, 'pasta-atalho'));
  return { raiz, livros, fora, arquivos };
}

async function subir({ biblioteca = null } = {}) {
  const pasta = temporaria('dados');
  const armazem = await Armazem.abrir(pasta);
  const servidor = criarServidor({ armazem, chave: CHAVE, origens: [ORIGEM_DA_CASCA], biblioteca });
  await new Promise((pronto) => servidor.listen(0, '127.0.0.1', pronto));
  return {
    base: `http://127.0.0.1:${servidor.address().port}`,
    fechar: () => new Promise((pronto) => { servidor.close(pronto); servidor.closeAllConnections(); }),
  };
}

const pedir = (s, rota, { chave = CHAVE, cabecalhos = {} } = {}) => fetch(`${s.base}${rota}`, {
  headers: { ...(chave ? { Authorization: `Bearer ${chave}` } : {}), ...cabecalhos },
});

test('o identificador de cada livro é o resumo parcial MD5 do KOReader', async () => {
  const pasta = temporaria('resumo');
  for (const [nome, tamanho] of [['vazio', 0], ['pequeno', 700], ['exato', 1024], ['meio', 5000], ['grande', 300000], ['maior', 1048576 + 10]]) {
    const conteudo = conteudoDe(tamanho, tamanho % 7);
    fs.writeFileSync(path.join(pasta, nome), conteudo);
    assert.equal(await resumoDoKoreader(path.join(pasta, nome)), resumoEsperado(conteudo), nome);
  }
  // O resumo do arquivo vazio é o MD5 de nada, como no KOReader.
  assert.equal(await resumoDoKoreader(path.join(pasta, 'vazio')), crypto.createHash('md5').digest('hex'));
});

test('a biblioteca lista só PDFs e EPUBs de dentro da pasta, sem atalhos nem pastas ocultas', async () => {
  const { livros, arquivos } = montarBiblioteca();
  const lista = await new Biblioteca(livros).listar();
  assert.deepEqual(lista.map((l) => `${l.pasta}|${l.nome}`), ['|Manual.pdf', 'Romances|Dom Casmurro.EPUB', 'Romances/Antigos|Conto.pdf']);
  const manual = lista.find((l) => l.nome === 'Manual.pdf');
  assert.equal(manual.id, resumoEsperado(arquivos.grande));
  assert.equal(manual.tipo, 'application/pdf');
  assert.equal(manual.bytes, arquivos.grande.length);
  assert.equal(lista.find((l) => l.nome === 'Dom Casmurro.EPUB').tipo, 'application/epub+zip');
  // A lista não revela o caminho na VPS.
  assert.ok(lista.every((l) => !('caminho' in l)));
  assert.ok(!JSON.stringify(lista).includes(livros));
  // Sem pasta, ou com uma pasta que não existe, a biblioteca é vazia.
  assert.deepEqual(await new Biblioteca(null).listar(), []);
  assert.deepEqual(await new Biblioteca(path.join(livros, 'nao-existe')).listar(), []);
});

test('o identificador acompanha o livro renomeado ou trocado de pasta', async () => {
  const { livros, arquivos } = montarBiblioteca();
  const biblioteca = new Biblioteca(livros, { validade: 0 });
  const antes = (await biblioteca.listar()).find((l) => l.nome === 'Conto.pdf');
  fs.renameSync(path.join(livros, 'Romances', 'Antigos', 'Conto.pdf'), path.join(livros, 'Conto renomeado.pdf'));
  const depois = (await biblioteca.listar()).find((l) => l.id === antes.id);
  assert.equal(depois.nome, 'Conto renomeado.pdf');
  assert.equal(depois.pasta, '');
  assert.equal(depois.id, resumoEsperado(arquivos.pequeno));
});

test('o servidor lista e entrega os livros só com a chave e nada de fora da pasta', async () => {
  const { livros, arquivos } = montarBiblioteca();
  const s = await subir({ biblioteca: new Biblioteca(livros, { validade: 0 }) });
  try {
    for (const chave of [null, 'chave-errada-com-mais-de-32-caracteres-00000']) {
      assert.equal((await pedir(s, '/sync/biblioteca', { chave })).status, 401);
    }
    const resposta = await pedir(s, '/sync/biblioteca', { cabecalhos: { Origin: ORIGEM_DA_CASCA } });
    assert.equal(resposta.status, 200);
    assert.equal(resposta.headers.get('access-control-allow-origin'), ORIGEM_DA_CASCA);
    const { livros: lista } = await resposta.json();
    assert.equal(lista.length, 3);
    const manual = lista.find((l) => l.nome === 'Manual.pdf');

    assert.equal((await pedir(s, `/sync/biblioteca/${manual.id}`, { chave: null })).status, 401);
    const livro = await pedir(s, `/sync/biblioteca/${manual.id}`, { cabecalhos: { Origin: ORIGEM_DA_CASCA } });
    assert.equal(livro.status, 200);
    assert.equal(livro.headers.get('content-type'), 'application/pdf');
    assert.equal(livro.headers.get('content-length'), String(arquivos.grande.length));
    assert.equal(livro.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(livro.headers.get('access-control-allow-origin'), ORIGEM_DA_CASCA);
    assert.deepEqual(Buffer.from(await livro.arrayBuffer()), arquivos.grande);
    // O EPUB vai isolado e como anexo, como os arquivos enviados que não são PDF nem imagem.
    const epub = await pedir(s, `/sync/biblioteca/${lista.find((l) => l.tipo === 'application/epub+zip').id}`);
    assert.equal(epub.headers.get('content-disposition'), 'attachment');
    assert.match(epub.headers.get('content-security-policy'), /sandbox/);
    await epub.arrayBuffer();

    // Nenhum caminho, atalho ou identificador fora da lista chega a um arquivo.
    const segredo = resumoEsperado(Buffer.from('segredo fora da biblioteca'));
    for (const rota of [
      `/sync/biblioteca/${segredo}`, '/sync/biblioteca/..%2Ffora%2Fsegredo.pdf', '/sync/biblioteca/../fora/segredo.pdf',
      '/sync/biblioteca/atalho.pdf', '/sync/biblioteca/Manual.pdf', `/sync/biblioteca/${manual.id.toUpperCase()}`, `/sync/biblioteca/${manual.id}/x`,
    ]) {
      const r = await pedir(s, rota);
      assert.ok(r.status === 404, `${rota}: ${r.status}`);
      assert.ok(!(await r.text()).includes('segredo fora'), rota);
    }

  } finally {
    await s.fechar();
  }
});

test('um livro ou uma pasta trocados por atalho depois de listados não são entregues', async () => {
  const { livros, fora } = montarBiblioteca();
  // Com a lista guardada, a troca acontece entre a lista e o pedido do livro.
  const biblioteca = new Biblioteca(livros, { validade: 60000 });
  const lista = await biblioteca.listar();
  const s = await subir({ biblioteca });
  try {
    const conto = lista.find((l) => l.nome === 'Conto.pdf');
    const caminhoDoConto = path.join(livros, 'Romances', 'Antigos', 'Conto.pdf');
    fs.rmSync(caminhoDoConto);
    fs.symlinkSync(path.join(fora, 'segredo.pdf'), caminhoDoConto);
    const trocado = await pedir(s, `/sync/biblioteca/${conto.id}`);
    assert.equal(trocado.status, 404);
    assert.ok(!(await trocado.text()).includes('segredo fora'));

    // A pasta de um livro trocada por um atalho para fora, com um arquivo de mesmo nome lá.
    const epub = lista.find((l) => l.nome === 'Dom Casmurro.EPUB');
    fs.writeFileSync(path.join(fora, 'Dom Casmurro.EPUB'), Buffer.from('segredo fora da biblioteca, no lugar do livro'));
    fs.renameSync(path.join(livros, 'Romances'), path.join(livros, 'Romances-antes'));
    fs.symlinkSync(fora, path.join(livros, 'Romances'));
    const pelaPasta = await pedir(s, `/sync/biblioteca/${epub.id}`);
    assert.equal(pelaPasta.status, 404);
    assert.ok(!(await pelaPasta.text()).includes('segredo fora'));

    // O livro que não mudou continua sendo entregue.
    const manual = lista.find((l) => l.nome === 'Manual.pdf');
    assert.equal((await pedir(s, `/sync/biblioteca/${manual.id}`)).status, 200);
  } finally {
    await s.fechar();
  }
});

test('sem biblioteca configurada, a lista é vazia e nenhum livro é entregue', async () => {
  const s = await subir();
  try {
    assert.deepEqual(await (await pedir(s, '/sync/biblioteca')).json(), { livros: [] });
    assert.equal((await pedir(s, `/sync/biblioteca/${'0'.repeat(32)}`)).status, 404);
  } finally {
    await s.fechar();
  }
});
