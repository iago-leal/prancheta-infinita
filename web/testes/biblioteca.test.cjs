// Biblioteca de livros, etapa 03 do plano 005: a biblioteca lista os livros
// que o servidor entrega, guarda cada livro aberto num banco próprio, fora da
// sincronização dos quadros, e continua mostrando a lista e os livros
// guardados sem rede. Desde a etapa 01 do plano 008, a lista fica na tela da
// biblioteca, testada em tela-da-biblioteca.test.cjs, e a seção do painel
// lateral tem o botão que a abre. A página e o servidor ficam num só
// endereço, como na VPS.
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
const { Biblioteca } = require('../../servidor/biblioteca.cjs');
const { esperarLista, abrirABiblioteca, abrirPelaBiblioteca } = require('./apoio/biblioteca.cjs');

const CHAVE = 'chave-de-teste-da-biblioteca-0123456789abcdef';
const TELA = { width: 1200, height: 800 };
const APP = path.join(__dirname, '..', 'app');

let navegador;
before(async () => { navegador = await chromium.launch(); });
after(async () => { await navegador?.close(); });

const conteudoDe = (tamanho, semente) => Buffer.from(Array.from({ length: tamanho }, (_, i) => (i * 31 + semente) % 251));

function montarLivros() {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'prancheta-livros-'));
  fs.mkdirSync(path.join(pasta, 'Romances'));
  const livros = {
    'Manual de leitura.pdf': conteudoDe(400000, 1),
    'Romances/Dom Casmurro.epub': conteudoDe(9000, 2),
  };
  for (const [nome, conteudo] of Object.entries(livros)) fs.writeFileSync(path.join(pasta, nome), conteudo);
  fs.writeFileSync(path.join(pasta, 'Romances', 'notas.txt'), 'não é livro');
  return { pasta, livros };
}

// Página e sincronização num só endereço, com a biblioteca.
async function subirComoNaVps(pastaDosLivros) {
  const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'prancheta-vps-'));
  const armazem = await Armazem.abrir(dados);
  const biblioteca = new Biblioteca(pastaDosLivros, { validade: 0 });
  const pedidosDeLivros = [];
  const sincronia = criarServidor({ armazem, chave: CHAVE, biblioteca }).listeners('request')[0];
  const pagina = criarServidorDaPagina({ pasta: APP }).listeners('request')[0];
  const borda = http.createServer((req, res) => {
    if (req.url.startsWith('/sync/biblioteca')) pedidosDeLivros.push(req.url);
    (req.url.startsWith('/sync/') ? sincronia : pagina)(req, res);
  });
  await new Promise((pronto) => borda.listen(0, '127.0.0.1', pronto));
  return {
    base: `http://127.0.0.1:${borda.address().port}`,
    dados,
    armazem,
    pedidosDeLivros,
    fechar: () => new Promise((pronto) => { borda.close(() => pronto()); borda.closeAllConnections(); }),
  };
}

async function abrir(contexto, base) {
  const pagina = await contexto.newPage();
  const erros = [];
  pagina.on('pageerror', (e) => erros.push(e.message));
  await pagina.goto(`${base}/`);
  await pagina.waitForFunction(() => window.__booted === true && navigator.serviceWorker.controller !== null, null, { timeout: 10000 });
  await pagina.waitForFunction(() => Boolean(window.bibliotecaDaPrancheta && document.getElementById('biblioteca')), null, { timeout: 10000 });
  return { pagina, erros };
}

// O título e a situação de cada livro, na ordem da tela da biblioteca.
const estados = (pagina) => pagina.$$eval('#tela-biblioteca .tb-livro', (linhas) => linhas.map((l) => `${l.querySelector('.tb-titulo').textContent}: ${l.querySelector('.tb-estado').textContent}`));

test('a biblioteca lista os livros, guarda o livro aberto fora dos quadros e funciona sem rede', async () => {
  const { pasta, livros } = montarLivros();
  const vps = await subirComoNaVps(pasta);
  const contexto = await navegador.newContext({ viewport: TELA });
  try {
    const { pagina, erros } = await abrir(contexto, vps.base);
    // Sem a sincronização configurada, a seção pede a configuração e nada é pedido ao servidor.
    await pagina.waitForFunction(() => /Configure a sincronização/.test(document.querySelector('#biblioteca .bib-aviso').textContent));
    assert.deepEqual(vps.pedidosDeLivros, []);

    await pagina.evaluate(([endereco, chave]) => window.sincronizacaoDaPrancheta.configurar({ endereco, chave }), [vps.base, CHAVE]);
    await esperarLista(pagina, 2);
    await abrirABiblioteca(pagina);
    assert.deepEqual(await estados(pagina), ['Dom Casmurro: 0,0 MB', 'Manual de leitura: 0,4 MB']);
    assert.deepEqual(await pagina.$$eval('#tela-biblioteca .tb-grupo', (p) => p.map((x) => x.firstChild.textContent)), ['Romances', 'Sem autor']);
    // Listar não baixa nenhum livro.
    assert.deepEqual(vps.pedidosDeLivros.filter((u) => /\/sync\/biblioteca\/[0-9a-f]{32}/.test(u)), []);

    // Tocar no livro o baixa e o guarda neste aparelho.
    await abrirPelaBiblioteca(pagina, 'Manual de leitura.pdf');
    await pagina.waitForFunction(() => window.bibliotecaDaPrancheta.estado.guardados.size === 1);
    await abrirABiblioteca(pagina);
    assert.deepEqual(await estados(pagina), ['Dom Casmurro: 0,0 MB', 'Manual de leitura: guardado']);
    const guardado = await pagina.evaluate(async () => {
      const b = window.bibliotecaDaPrancheta;
      const id = b.estado.lista.find((l) => l.nome === 'Manual de leitura.pdf').id;
      const livro = await b.livro(id);
      return { tipo: livro.blob.type, bytes: [...new Uint8Array(await livro.blob.arrayBuffer())] };
    });
    assert.equal(guardado.tipo, 'application/pdf');
    assert.deepEqual(Buffer.from(guardado.bytes), livros['Manual de leitura.pdf']);

    // O livro fica fora dos quadros: nada no registro de mudanças nem nos
    // arquivos do banco local, e nada sobe ao servidor da sincronização.
    await pagina.waitForFunction(() => window.sincronizacaoDaPrancheta.estado.situacao === 'sincronizada', null, { timeout: 15000 });
    const noBancoDosQuadros = await pagina.evaluate(async () => {
      const db = await claude.use('db');
      const mudancas = await db.mudancas();
      return { mudancas: mudancas.filter((m) => m.caminho.startsWith('_arquivos/')).length };
    });
    assert.deepEqual(noBancoDosQuadros, { mudancas: 0 });
    assert.deepEqual(fs.readdirSync(path.join(vps.dados, 'arquivos')), []);

    // Tocar de novo num livro guardado, ou pedir para guardá-lo, não o baixa outra vez.
    const antes = vps.pedidosDeLivros.length;
    await abrirPelaBiblioteca(pagina, 'Manual de leitura.pdf');
    await pagina.locator('#tela-biblioteca').waitFor({ state: 'hidden' });
    const deNovo = await pagina.evaluate(async () => {
      const b = window.bibliotecaDaPrancheta;
      return (await b.guardar(b.estado.lista.find((l) => l.nome === 'Manual de leitura.pdf').id)).bytes;
    });
    assert.equal(deNovo, livros['Manual de leitura.pdf'].length);
    assert.equal(vps.pedidosDeLivros.length, antes);

    // A seção continua no painel quando a lista de quadros é redesenhada.
    await pagina.evaluate(() => newBoard(null, 'Quadro novo'));
    await pagina.locator('#tree', { hasText: 'Quadro novo' }).waitFor();
    assert.equal(await pagina.locator('#biblioteca .bib-abrir').count(), 1);
    assert.equal(await pagina.textContent('#biblioteca .bib-abrir .bib-estado'), '2');

    // Sem rede, a página reabre da cópia guardada, com a lista e o livro guardado.
    await contexto.setOffline(true);
    await pagina.reload();
    await pagina.waitForFunction(() => window.__booted === true && Boolean(window.bibliotecaDaPrancheta), null, { timeout: 10000 });
    await pagina.waitForFunction(() => /Sem rede/.test(document.querySelector('#biblioteca .bib-aviso').textContent), null, { timeout: 15000 });
    await abrirABiblioteca(pagina);
    assert.deepEqual(await estados(pagina), ['Dom Casmurro: 0,0 MB', 'Manual de leitura: guardado']);
    const semRede = await pagina.evaluate(async () => {
      const b = window.bibliotecaDaPrancheta;
      const livro = await b.livro(b.estado.lista.find((l) => l.nome === 'Manual de leitura.pdf').id);
      return livro.blob.size;
    });
    assert.equal(semRede, livros['Manual de leitura.pdf'].length);
    // Um livro ainda não guardado avisa que precisa de rede.
    await abrirPelaBiblioteca(pagina, 'Dom Casmurro.epub');
    await pagina.waitForFunction(() => /Sem rede: "Dom Casmurro" ainda não está guardado/.test(document.querySelector('#biblioteca .bib-aviso').textContent));
    // A tela continua aberta, com o mesmo aviso.
    assert.match(await pagina.textContent('#tela-biblioteca .tb-aviso'), /Sem rede: "Dom Casmurro" ainda não está guardado/);

    // A rede volta, e o outro livro é guardado.
    await contexto.setOffline(false);
    await pagina.locator('#tela-biblioteca [data-acao="atualizar"]').click();
    await pagina.waitForFunction(() => window.bibliotecaDaPrancheta.estado.situacao === 'atualizada', null, { timeout: 15000 });
    await abrirPelaBiblioteca(pagina, 'Dom Casmurro.epub');
    await pagina.waitForFunction(() => window.bibliotecaDaPrancheta.estado.guardados.size === 2);
    await abrirABiblioteca(pagina);
    assert.deepEqual(await estados(pagina), ['Dom Casmurro: guardado', 'Manual de leitura: guardado']);
    assert.deepEqual(erros, []);
  } finally {
    await contexto.close();
    await vps.fechar();
  }
});

test('com a chave recusada, a biblioteca avisa e não mostra livros', async () => {
  const { pasta } = montarLivros();
  const vps = await subirComoNaVps(pasta);
  const contexto = await navegador.newContext({ viewport: TELA });
  try {
    const { pagina, erros } = await abrir(contexto, vps.base);
    await pagina.evaluate(([endereco]) => window.sincronizacaoDaPrancheta
      .configurar({ endereco, chave: 'chave-errada-com-mais-de-32-caracteres-000' }).catch(() => {}), [vps.base]);
    await abrirABiblioteca(pagina);
    await pagina.locator('#tela-biblioteca [data-acao="atualizar"]').click();
    // O aviso aparece no painel e na tela; durante cada tentativa, ele sai por um instante.
    await pagina.waitForFunction(() => ['#biblioteca .bib-aviso', '#tela-biblioteca .tb-aviso']
      .every((onde) => /Não foi possível atualizar a lista: o servidor recusou a chave/.test(document.querySelector(onde).textContent))
      && window.bibliotecaDaPrancheta.estado.situacao === 'erro', null, { timeout: 15000 });
    assert.equal(await pagina.locator('#tela-biblioteca .tb-livro').count(), 0);
    assert.deepEqual(erros, []);
  } finally {
    await contexto.close();
    await vps.fechar();
  }
});
