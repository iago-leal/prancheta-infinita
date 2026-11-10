// Ficha do livro, etapa 02 do plano 008: de cada livro, os destaques e os
// quadros que o citam, com os cartões de cada um, achados em todos os quadros
// guardados no aparelho; o caminho de volta para o trecho e para o quadro; e,
// na lista da biblioteca, em quantos quadros cada livro aparece. A página e o
// servidor ficam num só endereço, como na VPS.
// Executar a partir da raiz do repositório: node --test web/testes/*.test.cjs

'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const { Armazem } = require('../../servidor/armazem.cjs');
const { criarServidor } = require('../../servidor/servidor.cjs');
const { criarServidorDaPagina } = require('../../servidor/pagina.cjs');
const { Biblioteca } = require('../../servidor/biblioteca.cjs');
const { criarEpub, criarPdf } = require('./apoio/livros.cjs');
const { esperarLista, abrirABiblioteca, abrirPelaBiblioteca, abrirAFicha } = require('./apoio/biblioteca.cjs');

globalThis.crypto ??= crypto.webcrypto;
require('../app/compat/cifra.js');
require('../app/compat/biblioteca.js');
require('../app/compat/marcacoes.js');
const { organizar, situacaoDe } = globalThis.BibliotecaPrancheta;
const { Marcacoes, citacoesNosItens, enderecoDe } = globalThis.MarcacoesPrancheta;

const CHAVE = 'chave-de-teste-da-ficha-0123456789abcdef';
const TELA = { width: 1200, height: 800 };
const APP = path.join(__dirname, '..', 'app');

let navegador;
before(async () => { navegador = await chromium.launch(); });
after(async () => { await navegador?.close(); });

async function subirComoNaVps() {
  const livros = fs.mkdtempSync(path.join(os.tmpdir(), 'prancheta-ficha-'));
  fs.mkdirSync(path.join(livros, 'Machado de Assis'));
  fs.mkdirSync(path.join(livros, 'Clarice Lispector'));
  fs.writeFileSync(path.join(livros, 'Machado de Assis', 'dc-1899.epub'), await criarEpub({ titulo: 'Dom Casmurro', autor: 'Assis, Machado de' }));
  fs.writeFileSync(path.join(livros, 'Clarice Lispector', 'A hora da estrela.pdf'), criarPdf(['Pagina um da estrela', 'Pagina dois', 'Pagina tres']));
  fs.writeFileSync(path.join(livros, 'Solto.pdf'), criarPdf(['Um documento solto', 'Segunda pagina dele']));
  const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'prancheta-vps-'));
  const armazem = await Armazem.abrir(dados);
  const sincronia = criarServidor({ armazem, chave: CHAVE, biblioteca: new Biblioteca(livros) }).listeners('request')[0];
  const pagina = criarServidorDaPagina({ pasta: APP }).listeners('request')[0];
  const borda = http.createServer((req, res) => (req.url.startsWith('/sync/') ? sincronia : pagina)(req, res));
  await new Promise((pronto) => borda.listen(0, '127.0.0.1', pronto));
  return {
    base: `http://127.0.0.1:${borda.address().port}`,
    dados,
    fechar: () => new Promise((pronto) => { borda.close(() => pronto()); borda.closeAllConnections(); }),
  };
}

const pronta = async (pagina) => {
  await pagina.waitForFunction(() => window.__booted === true && navigator.serviceWorker.controller !== null, null, { timeout: 10000 });
  await pagina.waitForFunction(() => Boolean(window.marcacoesDaPrancheta && document.getElementById('leitor') && document.getElementById('tela-biblioteca')), null, { timeout: 10000 });
  await pagina.evaluate(() => { if (!document.body.classList.contains('side')) toggleSide(true); });
};

async function abrirPrancheta(contexto, base, chaveDaCifra) {
  const pagina = await contexto.newPage();
  const erros = [];
  pagina.on('pageerror', (e) => erros.push(e.message));
  await pagina.addInitScript(() => { window.opcoesDaSincronizacao = { intervalo: 1000, esperaDepoisDeGravar: 300 }; });
  await pagina.goto(`${base}/`);
  await pronta(pagina);
  await pagina.evaluate(async ([endereco, chave, cifra]) => {
    if (cifra) await window.sincronizacaoDaPrancheta.usarChaveDaCifra(cifra);
    await window.sincronizacaoDaPrancheta.configurar({ endereco, chave });
  }, [base, CHAVE, chaveDaCifra]);
  await esperarLista(pagina, 3);
  return { pagina, erros };
}

// Espera uma condição que depende de uma leitura assíncrona na página: cada
// tentativa é uma avaliação inteira, esperada até o fim.
async function esperar(pagina, condicao, argumento, { prazo = 20000, descricao = 'a condição' } = {}) {
  const fim = Date.now() + prazo;
  for (;;) {
    if (await pagina.evaluate(condicao, argumento)) return;
    if (Date.now() > fim) throw new Error(`tempo esgotado à espera de ${descricao}`);
    await pagina.waitForTimeout(200);
  }
}

const aguardarSincronizado = (pagina) => esperar(pagina, async () => {
  const s = window.sincronizacaoDaPrancheta;
  if (s.estado.situacao !== 'sincronizada') return false;
  return (await (await claude.use('db')).mudancas()).length === 0;
}, null, { descricao: 'a sincronização' });

// Espera o quadro aberto e o índice dos quadros estarem gravados no banco local.
const aguardarGravado = (pagina) => esperar(pagina, async () => {
  if (S.dirty.size || S.saving || S.metaDirty) return false;
  const indice = await (await claude.use('db')).doc('library/index').get();
  return indice.exists && JSON.stringify(indice.data().boards.map((b) => [b.id, b.title, Boolean(b.deleted)])) === JSON.stringify(L.boards.map((b) => [b.id, b.title, Boolean(b.deleted)]));
}, null, { descricao: 'a gravação do quadro' });

const selecionarNoEpub = (pagina, id, de, ate) => pagina.evaluate(([alvo, inicio, fim]) => {
  const doc = document.querySelector('#leitor iframe').contentDocument;
  const texto = doc.getElementById(alvo).firstChild;
  const intervalo = doc.createRange();
  intervalo.setStart(texto, inicio);
  intervalo.setEnd(texto, fim);
  doc.getSelection().removeAllRanges();
  doc.getSelection().addRange(intervalo);
}, [id, de, ate]);

const textoDoEpub = (pagina) => pagina.evaluate(() => document.querySelector('#leitor iframe')?.contentDocument?.body?.innerText || '');
const noCapitulo = (pagina, expressao) => pagina.waitForFunction(
  (fonte) => new RegExp(fonte).test(document.querySelector('#leitor iframe')?.contentDocument?.body?.innerText || ''), expressao.source, { timeout: 15000 },
);
const idDe = (pagina, arquivo) => pagina.evaluate((nome) => window.bibliotecaDaPrancheta.estado.lista.find((l) => l.nome === nome).id, arquivo);
const telaAberta = (pagina) => pagina.locator('#tela-biblioteca').isVisible();
const estadoDe = (pagina, arquivo) => pagina.textContent(`#tela-biblioteca .tb-livro[data-arquivo="${arquivo}"] .tb-estado`);
const titulos = (pagina) => pagina.$$eval('#tela-biblioteca .tb-livro .tb-titulo', (itens) => itens.map((item) => item.textContent));

// O que a ficha mostra, de cima para baixo.
const ficha = (pagina) => pagina.$$eval('#tela-biblioteca .tb-ficha > *', (itens) => itens.map((item) => {
  if (item.classList.contains('tb-grupo')) return `# ${item.firstChild.textContent} (${item.querySelector('span').textContent})`;
  if (item.classList.contains('tb-quadro')) return `## ${item.textContent}`;
  if (item.classList.contains('tb-item')) return `- ${[...item.children].map((parte) => `${parte.className.slice(3)}: ${parte.textContent}`).join(' | ')}`;
  if (item.classList.contains('tb-vazio')) return `! ${item.textContent}`;
  return `${item.className.replace('tb-ficha-', '')}: ${item.textContent}`;
}));

// Onde um cartão está na tela, em relação à parte visível do quadro.
const cartaoNaTela = (pagina, id) => pagina.evaluate((cartao) => {
  const r = document.querySelector(`#cards [data-id="${cartao}"]`).getBoundingClientRect();
  const lateral = document.getElementById('side');
  let esquerda = document.body.classList.contains('side') ? lateral.getBoundingClientRect().right : 0;
  let direita = innerWidth;
  if (document.body.classList.contains('leitor-lado')) {
    const leitor = document.getElementById('leitor').getBoundingClientRect();
    if (document.body.classList.contains('leitor-esquerda')) esquerda = Math.max(esquerda, leitor.right);
    else direita = leitor.left;
  }
  const [x, y] = [r.left + r.width / 2, r.top + r.height / 2];
  return {
    foraDoMeio: [Math.round(x - (esquerda + direita) / 2), Math.round(y - innerHeight / 2)],
    aVista: r.left >= esquerda && r.right <= direita && r.top >= 0 && r.bottom <= innerHeight,
    noTopo: Boolean(document.elementFromPoint(x, y)?.closest(`#cards [data-id="${cartao}"]`)),
    selecionado: [...S.sel].join(',') === cartao,
  };
}, id);

test('as citações são achadas pelo link de volta nos cartões, uma por cartão e livro, em todos os quadros que não foram apagados', async () => {
  const [A, B] = ['a'.repeat(32), 'b'.repeat(32)];
  const link = (livro, posicao, rotulo = 'abrir no livro') => `[${rotulo}](${enderecoDe(livro, posicao)})`;
  const cartao = (id, ...blocos) => ({ id, type: 'card', x: 0, y: 0, w: 320, blocks: blocos });
  const itens = [
    cartao('c1', { k: 'quote', h: 'Um trecho com <b>negrito</b> &amp; um e comercial' }, { h: 'Uma nota minha' }, { h: `<i>dc-1899.epub</i>, Capítulo um, p. 12 · ${link(A, { cfi: 'epubcfi(/6/2!/4/2,/1:0,/1:5)' })}` }),
    // Só a posição, sem trecho.
    cartao('c2', { h: `<i>dc-1899.epub</i>, p. 3 · ${link(A, { pagina: 3 })}` }),
    // Dois links para o mesmo livro contam uma vez; outro livro no mesmo cartão conta à parte.
    cartao('c3', { k: 'quote', h: 'Primeira' }, { k: 'quote', h: 'e segunda' }, { h: `${link(A, { pagina: 1 })} e ${link(A, { pagina: 2 }, 'de novo')}` }, { h: `<i>Outro.pdf</i> · ${link(B, { pagina: 9 }, 'ver')}` }),
    // Não são citações: outro tipo de item, um link comum, um endereço estragado e um cartão sem blocos.
    { id: 't1', type: 'stroke', blocks: [{ h: link(A, { pagina: 1 }) }] },
    cartao('c4', { h: '[um site](https://exemplo.invalid/pagina)' }),
    cartao('c5', { h: `[abrir](https://prancheta.invalid/livro/${A}/@@@) e [abrir](https://prancheta.invalid/livro/curto/abc)` }),
    { id: 'c6', type: 'card' },
    null,
  ];
  assert.deepEqual(citacoesNosItens(itens), [
    { livro: A, posicao: { cfi: 'epubcfi(/6/2!/4/2,/1:0,/1:5)' }, cartao: 'c1', trecho: 'Um trecho com negrito & um e comercial', onde: 'Capítulo um, p. 12' },
    { livro: A, posicao: { pagina: 3 }, cartao: 'c2', trecho: '', onde: 'p. 3' },
    { livro: A, posicao: { pagina: 1 }, cartao: 'c3', trecho: 'Primeira e segunda', onde: 'e' },
    { livro: B, posicao: { pagina: 9 }, cartao: 'c3', trecho: 'Primeira e segunda', onde: '' },
  ]);
  assert.deepEqual(citacoesNosItens(null), []);
  // Um trecho enorme é cortado.
  assert.equal(citacoesNosItens([cartao('g', { k: 'quote', h: 'x'.repeat(5000) }, { h: link(A, { pagina: 1 }) })])[0].trecho.length, 600);

  // Os quadros: o aberto vale pelo que está na tela, e os outros, pelo banco; os apagados ficam de fora.
  const pedacos = {
    'boards/q2/shards': [{ items: [itens[1]] }, { rev: 'um pedaço sem itens' }, { items: [itens[2]] }],
    'boards/q3/shards': [{ items: [cartao('x', { h: link(A, { pagina: 5 }) })] }],
    'canvas-shards': [{ items: [cartao('velho', { h: link(B, { pagina: 1 }) })] }],
    'boards/q4/shards': [],
  };
  const lidas = [];
  const banco = {
    collection: (caminho) => ({
      get: async () => {
        lidas.push(caminho);
        if (caminho === 'boards/q5/shards') throw new Error('quadro ilegível');
        return { docs: (pedacos[caminho] || []).map((dados) => ({ data: () => dados })) };
      },
    }),
    doc: () => ({ get: async () => ({ exists: true, data: () => ({ boards: [{ id: 'q2', title: 'Só no banco' }, { id: 'q3', title: 'Apagado', deleted: 1 }] }) }) }),
  };
  const quadros = [
    { id: 'main', title: '' }, { id: 'q2', title: 'Leituras' }, { id: 'q3', title: 'Apagado', deleted: 1762700000000 },
    { id: 'q4', title: 'Vazio' }, { id: 'q5', title: 'Ilegível' }, null, { title: 'sem id' },
  ];
  const pagina = { quadros: () => quadros, aberto: () => ({ id: 'main', itens: [itens[0]] }) };
  const citacoes = await new Marcacoes(null, banco, pagina).citacoes();
  assert.deepEqual([...citacoes.keys()], [A, B]);
  // Na ordem dos títulos, com o quadro sem título como "Sem título".
  assert.deepEqual(citacoes.get(A), [
    { quadro: 'q2', titulo: 'Leituras', cartoes: [{ id: 'c2', trecho: '', onde: 'p. 3', posicao: { pagina: 3 } }, { id: 'c3', trecho: 'Primeira e segunda', onde: 'e', posicao: { pagina: 1 } }] },
    { quadro: 'main', titulo: 'Sem título', cartoes: [{ id: 'c1', trecho: 'Um trecho com negrito & um e comercial', onde: 'Capítulo um, p. 12', posicao: { cfi: 'epubcfi(/6/2!/4/2,/1:0,/1:5)' } }] },
  ]);
  assert.deepEqual(citacoes.get(B), [{ quadro: 'q2', titulo: 'Leituras', cartoes: [{ id: 'c3', trecho: 'Primeira e segunda', onde: '', posicao: { pagina: 9 } }] }]);
  // O quadro aberto não é lido do banco, nem o apagado.
  assert.deepEqual(lidas.sort(), ['boards/q2/shards', 'boards/q4/shards', 'boards/q5/shards']);
  // Sem a página, os quadros vêm do índice guardado no banco.
  const semPagina = await new Marcacoes(null, banco, { quadros: () => null, aberto: () => null }).citacoes();
  assert.deepEqual(semPagina.get(A).map((q) => [q.quadro, q.titulo, q.cartoes.length]), [['q2', 'Só no banco', 2]]);

  // Na lista: o filtro dos citados e a contagem dos quadros em cada linha.
  const lista = [{ id: A, nome: 'a.epub', pasta: 'X', titulo: 'Alfa' }, { id: B, nome: 'b.pdf', pasta: 'X', titulo: 'Beta' }, { id: 'c'.repeat(32), nome: 'c.pdf', pasta: 'X', titulo: 'Gama' }];
  const achar = (opcoes) => organizar(lista, { ordem: 'titulo', ...opcoes }).map((l) => l.livro.titulo).join(' ');
  assert.equal(achar({ soCitados: true, citados: new Set(citacoes.keys()) }), 'Alfa Beta');
  assert.equal(achar({ soCitados: true, citados: new Set([B]), soGuardados: true, guardados: new Set([A, B]) }), 'Beta');
  assert.equal(achar({ soCitados: true, citados: new Set([B]), consulta: 'alfa' }), '');
  assert.equal(achar({ soCitados: true }), '');
  assert.equal(achar({ citados: new Set([B]) }), 'Alfa Beta Gama');
  const estado = { guardados: new Set([A]), leituras: new Map([[A, { em: 1, porcentagem: 0.5 }]]) };
  assert.equal(situacaoDe(lista[0], estado, null, 2), 'guardado · 50% · 2 quadros');
  assert.equal(situacaoDe(lista[0], estado, null, 1), 'guardado · 50% · 1 quadro');
  assert.equal(situacaoDe(lista[0], estado, null, 0), 'guardado · 50%');
  assert.equal(situacaoDe(lista[1], estado, null, 3), '0,0 MB · 3 quadros');
});

test('a ficha mostra os destaques e os quadros que citam o livro, leva ao trecho e ao cartão, e a lista conta os quadros e filtra os citados', async () => {
  const vps = await subirComoNaVps();
  const contexto = await navegador.newContext({ viewport: TELA });
  try {
    const { pagina, erros } = await abrirPrancheta(contexto, vps.base);
    const [casmurro, estrela] = [await idDe(pagina, 'dc-1899.epub'), await idDe(pagina, 'A hora da estrela.pdf')];
    await pagina.evaluate(() => { entry(S.board).title = 'Caderno'; saveLib(); });

    // Antes de qualquer marcação: a ficha vazia, com o botão de abrir.
    await abrirAFicha(pagina, 'dc-1899.epub');
    assert.equal(await pagina.textContent('#tela-biblioteca h2'), 'Ficha do livro');
    assert.deepEqual(await ficha(pagina), [
      'titulo: Dom Casmurro', 'dados: Assis, Machado de · EPUB · 0,0 MB', 'abrir: Abrir o livro',
      '# Destaques (0)', '! Nenhum destaque neste livro.', '# Nos quadros (0)', '! Nenhum quadro cita este livro.',
    ]);
    // Na ficha, saem a busca e os filtros, e entra o botão de voltar à lista.
    assert.deepEqual(await pagina.evaluate(() => ['.tb-barra', '.tb-da-lista', '[data-acao="atualizar"]', '.tb-conta', '[data-acao="voltar"]', '.tb-da-ficha']
      .map((parte) => getComputedStyle(document.querySelector(`#tela-biblioteca ${parte}`)).display !== 'none')), [false, false, false, false, true, true]);
    assert.equal(await pagina.evaluate(() => document.activeElement.dataset.acao), 'voltar');
    // O botão da ficha abre o livro e fecha a tela.
    await pagina.click('#tela-biblioteca [data-acao="ficha-abrir"]');
    await pagina.locator('#tela-biblioteca').waitFor({ state: 'hidden', timeout: 15000 });
    await noCapitulo(pagina, /primeiro capítulo/);

    // No quadro "Caderno": um trecho destacado e levado ao quadro pelo leitor, com uma nota, e mais um destaque.
    await selecionarNoEpub(pagina, 'p1', 9, 26);
    await pagina.locator('#leitor .lt-selecao [data-acao="levar"]').waitFor();
    await pagina.click('#leitor .lt-selecao [data-acao="levar"]');
    await pagina.waitForFunction(() => [...S.items.values()].filter((i) => i.type === 'card').length === 1);
    const levado = (await pagina.evaluate((id) => window.marcacoesDaPrancheta.destaques(id), casmurro))[0];
    await pagina.evaluate(([livro, id]) => window.marcacoesDaPrancheta.anotar(livro, id, 'Uma nota sobre o começo'), [casmurro, levado.id]);
    await pagina.click('#leitor [data-acao="proxima"]');
    await noCapitulo(pagina, /segundo capítulo/);
    await selecionarNoEpub(pagina, 'p2', 2, 19);
    await pagina.locator('#leitor .lt-selecao [data-acao="destacar"]').waitFor();
    await pagina.click('#leitor .lt-selecao [data-acao="destacar"]');
    await esperar(pagina, (id) => window.marcacoesDaPrancheta.destaques(id).then((d) => d.length === 2), casmurro, { descricao: 'os dois destaques' });
    const noCaderno = await pagina.evaluate(() => [...S.items.values()].find((i) => i.type === 'card').id);
    await aguardarGravado(pagina);

    // No quadro "Leituras": a posição do PDF, sem trecho, e outro cartão do EPUB; um cartão apagado não conta.
    const leituras = await pagina.evaluate(() => newBoard(null, 'Leituras').then((b) => b.id));
    await abrirPelaBiblioteca(pagina, 'A hora da estrela.pdf');
    await pagina.waitForFunction(() => document.querySelector('#leitor .lt-posicao').textContent === 'p. 1 de 3', null, { timeout: 15000 });
    await pagina.click('#leitor [data-acao="proxima"]');
    await pagina.waitForFunction(() => document.querySelector('#leitor .lt-posicao').textContent === 'p. 2 de 3');
    await pagina.click('#leitor [data-acao="ao-quadro"]');
    await pagina.waitForFunction(() => [...S.items.values()].filter((i) => i.type === 'card').length === 1);
    const [outroDoEpub, apagado] = await pagina.evaluate((livro) => {
      const m = window.marcacoesDaPrancheta;
      const fica = m.levarAoQuadro({ livro, nome: 'dc-1899.epub' }, { trecho: 'Um trecho levado pela mão', posicao: { cfi: 'epubcfi(/6/4!/4/4,/1:0,/1:6)' }, rotulo: 'Capítulo dois, pos. 2' });
      const sai = m.levarAoQuadro({ livro, nome: 'dc-1899.epub' }, { trecho: 'Este cartão vai ser apagado', posicao: { cfi: 'epubcfi(/6/4!/4/2)' }, rotulo: 'Capítulo dois' });
      return [fica.id, sai.id];
    }, casmurro);
    // Logo depois de criado, antes de ser gravado, o cartão do quadro aberto já conta.
    assert.equal((await pagina.evaluate((id) => window.marcacoesDaPrancheta.citacoes().then((c) => c.get(id).map((q) => q.cartoes.length)), casmurro)).join(), '1,2');
    await pagina.evaluate((id) => deleteIds([id]), apagado);
    await pagina.click('#leitor [data-acao="fechar"]');
    await aguardarGravado(pagina);
    // Um quadro apagado, com uma citação, também não conta.
    const descartado = await pagina.evaluate(() => newBoard(null, 'Descartado').then((b) => b.id));
    await pagina.evaluate((livro) => { window.marcacoesDaPrancheta.levarAoQuadro({ livro, nome: 'A hora da estrela.pdf' }, { posicao: { pagina: 1 }, rotulo: 'p. 1' }); }, estrela);
    await aguardarGravado(pagina);
    await pagina.evaluate((id) => delBoard(id), descartado);
    await pagina.waitForFunction((id) => S.board !== id, descartado, { timeout: 15000 });
    await aguardarGravado(pagina);

    // A página é recarregada: os quadros são lidos do banco local, sem terem sido abertos nesta sessão.
    await pagina.reload();
    await pronta(pagina);
    await esperarLista(pagina, 3);
    assert.notEqual(await pagina.evaluate(() => S.board), descartado);

    // Na lista: em quantos quadros cada livro aparece, e o filtro dos citados.
    await abrirABiblioteca(pagina);
    await pagina.waitForFunction(() => / · 2 quadros$/.test(document.querySelector('#tela-biblioteca .tb-livro[data-arquivo="dc-1899.epub"] .tb-estado').textContent));
    assert.match(await estadoDe(pagina, 'dc-1899.epub'), /^guardado · \d+% · 2 quadros$/);
    assert.equal(await estadoDe(pagina, 'A hora da estrela.pdf'), 'guardado · 67% · 1 quadro');
    assert.equal(await estadoDe(pagina, 'Solto.pdf'), '0,0 MB');
    assert.equal(await pagina.getAttribute('#tela-biblioteca .tb-livro[data-arquivo="dc-1899.epub"] [data-acao="ficha"]', 'aria-label'), 'Ficha de Dom Casmurro');
    await pagina.click('#tela-biblioteca [data-acao="so-citados"]');
    assert.equal(await pagina.getAttribute('#tela-biblioteca [data-acao="so-citados"]', 'aria-pressed'), 'true');
    assert.deepEqual(await titulos(pagina), ['Dom Casmurro', 'A hora da estrela']);
    assert.equal(await pagina.textContent('#tela-biblioteca .tb-conta'), '2 de 3');
    await pagina.fill('#tela-biblioteca .tb-busca', 'solto');
    assert.equal(await pagina.textContent('#tela-biblioteca .tb-vazio'), 'Nenhum livro com "solto" entre os citados em algum quadro.');
    await pagina.fill('#tela-biblioteca .tb-busca', '');
    // O filtro fica guardado no aparelho.
    assert.equal(await pagina.evaluate(() => JSON.parse(localStorage.getItem('prancheta.biblioteca.tela')).soCitados), true);
    await pagina.click('#tela-biblioteca [data-acao="so-citados"]');
    assert.equal((await titulos(pagina)).length, 3);
    // Um redesenho da lista, aqui por uma leitura nova de outro livro, não tira o foco do botão em que ele estava.
    await pagina.locator('#tela-biblioteca .tb-livro[data-arquivo="dc-1899.epub"] [data-acao="ficha"]').focus();
    await pagina.evaluate((nome) => {
      const b = window.bibliotecaDaPrancheta;
      window.__linhaAntes = document.querySelector('#tela-biblioteca .tb-livro[data-arquivo="dc-1899.epub"]');
      return b.gravarPosicao(b.estado.lista.find((l) => l.nome === nome).id, { pagina: 1 }, Date.now(), 0.5);
    }, 'Solto.pdf');
    await pagina.waitForFunction(() => document.querySelector('#tela-biblioteca .tb-livro[data-arquivo="Solto.pdf"] .tb-estado').textContent === '0,0 MB · 50%');
    assert.deepEqual(await pagina.evaluate(() => [
      document.contains(window.__linhaAntes), document.activeElement.dataset.acao, document.activeElement.closest('.tb-livro')?.dataset.arquivo,
    ]), [false, 'ficha', 'dc-1899.epub'], 'a lista foi redesenhada, e o foco voltou ao mesmo botão');

    // A ficha do EPUB: os dados, os destaques na ordem em que foram feitos e os quadros na ordem dos títulos.
    await abrirAFicha(pagina, 'dc-1899.epub');
    await pagina.waitForFunction(() => document.querySelectorAll('#tela-biblioteca .tb-ficha .tb-item').length === 4);
    const daFicha = await ficha(pagina);
    assert.equal(daFicha[0], 'titulo: Dom Casmurro');
    assert.match(daFicha[1], /^dados: Assis, Machado de · EPUB · guardado · \d+%$/);
    assert.deepEqual(daFicha.slice(2, 4), ['abrir: Continuar a leitura', '# Destaques (2)']);
    assert.match(daFicha[4], /^- trecho: primeiro capítulo \| nota: Uma nota sobre o começo \| onde: Capítulo um/);
    assert.match(daFicha[5], /^- trecho: segundo capítulo \| onde: Capítulo dois/);
    assert.equal(daFicha[6], '# Nos quadros (2)');
    assert.equal(daFicha[7], '## Caderno');
    assert.match(daFicha[8], /^- trecho: primeiro capítulo \| onde: Capítulo um/);
    assert.deepEqual(daFicha.slice(9), ['## Leituras', '- trecho: Um trecho levado pela mão | onde: Capítulo dois, pos. 2']);

    // Tocar num destaque abre o livro no trecho, e não onde a leitura parou, que é o segundo capítulo, e fecha a tela.
    await pagina.locator('#tela-biblioteca .tb-ficha [data-destaque]').nth(0).click();
    await pagina.locator('#tela-biblioteca').waitFor({ state: 'hidden', timeout: 15000 });
    await noCapitulo(pagina, /primeiro capítulo/);
    assert.doesNotMatch(await textoDoEpub(pagina), /segundo capítulo/);

    // Pelo botão do leitor, a ficha do livro aberto, por cima dele; "Voltar ao livro" só fecha a tela.
    await pagina.click('#leitor [data-acao="ficha"]');
    await pagina.locator('#tela-biblioteca .tb-ficha-titulo').waitFor();
    assert.equal(await pagina.textContent('#tela-biblioteca .tb-ficha-titulo'), 'Dom Casmurro');
    assert.equal(await pagina.textContent('#tela-biblioteca [data-acao="ficha-abrir"]'), 'Voltar ao livro');
    const aberturas = await pagina.evaluate(() => {
      const leitor = window.leitorDaPrancheta;
      const original = leitor.abrir.bind(leitor);
      window.__aberturas = 0;
      leitor.abrir = (...a) => { window.__aberturas += 1; return original(...a); };
      return window.__aberturas;
    });
    await pagina.click('#tela-biblioteca [data-acao="ficha-abrir"]');
    assert.equal(await telaAberta(pagina), false);
    assert.equal(await pagina.evaluate(() => window.__aberturas), aberturas, 'o livro não é aberto de novo');
    assert.match(await textoDoEpub(pagina), /primeiro capítulo/);

    // O leitor em tela inteira cobriria o quadro: ao tocar num cartão, ele passa para o lado, e o
    // quadro abre com o cartão selecionado, no meio da parte visível.
    await pagina.click('#leitor [data-acao="modo"]');
    assert.equal(await pagina.evaluate(() => document.body.classList.contains('leitor-tela')), true);
    await pagina.click('#leitor [data-acao="ficha"]');
    await pagina.locator(`#tela-biblioteca .tb-ficha [data-cartao="${outroDoEpub}"]`).click();
    await pagina.waitForFunction(([quadro, cartao]) => S.board === quadro && [...S.sel].join() === cartao, [leituras, outroDoEpub], { timeout: 15000 });
    assert.equal(await telaAberta(pagina), false);
    assert.deepEqual(await pagina.evaluate(() => [document.body.classList.contains('leitor-tela'), document.body.classList.contains('leitor-lado')]), [false, true]);
    let visto = await cartaoNaTela(pagina, outroDoEpub);
    assert.ok(Math.abs(visto.foraDoMeio[0]) <= 2 && Math.abs(visto.foraDoMeio[1]) <= 2 && visto.aVista && visto.noTopo && visto.selecionado, JSON.stringify(visto));

    // O voltar da ficha leva à lista, com o foco no botão da ficha daquele livro; o cartão do outro quadro abre o quadro dele.
    await pagina.click('#leitor [data-acao="fechar"]');
    await abrirAFicha(pagina, 'dc-1899.epub');
    await pagina.click('#tela-biblioteca [data-acao="voltar"]');
    assert.equal(await pagina.textContent('#tela-biblioteca h2'), 'Biblioteca');
    assert.equal((await titulos(pagina)).length, 3);
    assert.equal(await pagina.evaluate(() => `${document.activeElement.dataset.acao} ${document.activeElement.closest('.tb-livro').dataset.arquivo}`), 'ficha dc-1899.epub');
    await pagina.keyboard.press('Enter');
    await pagina.locator(`#tela-biblioteca .tb-ficha [data-cartao="${noCaderno}"]`).click();
    await pagina.waitForFunction((cartao) => entry(S.board).title === 'Caderno' && [...S.sel].join() === cartao, noCaderno, { timeout: 15000 });
    visto = await cartaoNaTela(pagina, noCaderno);
    assert.ok(Math.abs(visto.foraDoMeio[0]) <= 2 && Math.abs(visto.foraDoMeio[1]) <= 2 && visto.aVista && visto.selecionado, JSON.stringify(visto));

    // A ficha do PDF: sem destaques, com a posição levada ao quadro, sem trecho. Esc fecha a tela a partir da ficha.
    await abrirAFicha(pagina, 'A hora da estrela.pdf');
    await pagina.waitForFunction(() => document.querySelectorAll('#tela-biblioteca .tb-ficha .tb-item').length === 1);
    assert.deepEqual(await ficha(pagina), [
      'titulo: A hora da estrela', 'dados: Clarice Lispector · PDF · guardado · 67%', 'abrir: Continuar a leitura',
      '# Destaques (0)', '! Nenhum destaque neste livro.', '# Nos quadros (1)', '## Leituras', '- trecho: Posição do livro, sem trecho | onde: p. 2',
    ]);
    // Fechada a tela, a ficha deixa de acompanhar os destaques do livro.
    await pagina.evaluate(() => {
      const m = window.marcacoesDaPrancheta;
      const original = m.acompanhar.bind(m);
      window.__acompanhando = 0;
      m.acompanhar = (...a) => {
        window.__acompanhando += 1;
        const parar = original(...a);
        return () => { window.__acompanhando -= 1; parar(); };
      };
    });
    await pagina.click('#tela-biblioteca [data-acao="voltar"]');
    await abrirAFicha(pagina, 'A hora da estrela.pdf');
    assert.equal(await pagina.evaluate(() => window.__acompanhando), 1);
    await pagina.keyboard.press('Escape');
    assert.equal(await telaAberta(pagina), false);
    assert.equal(await pagina.evaluate(() => window.__acompanhando), 0);
    // Aberta de novo, a biblioteca volta à lista, e não à ficha.
    await abrirABiblioteca(pagina);
    assert.equal(await pagina.textContent('#tela-biblioteca h2'), 'Biblioteca');
    assert.equal(await pagina.locator('#tela-biblioteca .tb-da-ficha').isVisible(), false);
    // Também quando a lista é pedida com uma ficha à vista.
    await abrirAFicha(pagina, 'A hora da estrela.pdf');
    await pagina.evaluate(() => window.bibliotecaDaPrancheta.tela.abrir());
    assert.equal(await pagina.textContent('#tela-biblioteca h2'), 'Biblioteca');
    assert.deepEqual(await pagina.evaluate(() => [document.querySelector('#tela-biblioteca .tb-da-ficha').hidden, window.__acompanhando]), [true, 0]);
    await pagina.keyboard.press('Escape');

    // Numa tela estreita, em que o leitor só cabe em tela inteira, ele é fechado para o quadro aparecer.
    await pagina.setViewportSize({ width: 560, height: 800 });
    await pagina.evaluate((id) => window.leitorDaPrancheta.abrir(id), estrela);
    await pagina.waitForFunction(() => document.querySelector('#leitor .lt-posicao').textContent === 'p. 2 de 3', null, { timeout: 15000 });
    await pagina.click('#leitor [data-acao="ficha"]');
    await pagina.locator('#tela-biblioteca .tb-ficha [data-cartao]').click();
    await pagina.waitForFunction((quadro) => S.board === quadro && S.sel.size === 1, leituras, { timeout: 15000 });
    assert.equal(await pagina.locator('#leitor').isVisible(), false);
    await pagina.setViewportSize(TELA);
    // Na tela estreita, abrir um quadro recolhe o painel lateral; ele é aberto de novo para o resto do teste.
    await pagina.evaluate(() => { if (!document.body.classList.contains('side')) toggleSide(true); });

    // Um cartão apagado some da ficha aberta, sem reabri-la, na rodada seguinte da sincronização.
    await abrirAFicha(pagina, 'dc-1899.epub');
    await pagina.waitForFunction(() => document.querySelectorAll('#tela-biblioteca .tb-ficha [data-cartao]').length === 2);
    await pagina.evaluate((id) => deleteIds([id]), outroDoEpub);
    await pagina.waitForFunction(() => document.querySelectorAll('#tela-biblioteca .tb-ficha [data-cartao]').length === 1, null, { timeout: 20000 });
    assert.equal((await ficha(pagina)).includes('## Leituras'), false);
    await pagina.keyboard.press('Escape');
    // Pedir um cartão que já não está no quadro avisa, sem erro.
    assert.equal(await pagina.evaluate(([quadro, cartao]) => window.marcacoesDaPrancheta.abrirNoQuadro(quadro, cartao), [leituras, outroDoEpub]), false);
    assert.match(await pagina.textContent('#toast'), /não está mais no quadro/);

    // Um livro que saiu da biblioteca ainda tem ficha, pelo que o leitor sabe dele.
    await pagina.evaluate(() => window.bibliotecaDaPrancheta.tela.abrirFicha('f'.repeat(32), { nome: 'Sumido.epub', tipo: 'application/epub+zip' }));
    assert.deepEqual((await ficha(pagina)).slice(0, 2), ['titulo: Sumido', 'dados: EPUB · fora da biblioteca']);
    await pagina.keyboard.press('Escape');

    // Sem rede, depois de recarregar: o filtro dos citados continua ligado, e a ficha, com os destaques e os quadros.
    await abrirABiblioteca(pagina);
    await pagina.click('#tela-biblioteca [data-acao="so-citados"]');
    await pagina.keyboard.press('Escape');
    await aguardarGravado(pagina);
    await contexto.setOffline(true);
    await pagina.reload();
    await pronta(pagina);
    await pagina.waitForFunction(() => window.bibliotecaDaPrancheta.estado.situacao === 'sem_rede', null, { timeout: 15000 });
    await abrirABiblioteca(pagina);
    assert.equal(await pagina.getAttribute('#tela-biblioteca [data-acao="so-citados"]', 'aria-pressed'), 'true');
    await pagina.waitForFunction(() => document.querySelectorAll('#tela-biblioteca .tb-livro').length === 2);
    assert.deepEqual(await titulos(pagina), ['Dom Casmurro', 'A hora da estrela']);
    await abrirAFicha(pagina, 'dc-1899.epub');
    await pagina.waitForFunction(() => document.querySelectorAll('#tela-biblioteca .tb-ficha .tb-item').length === 3);
    assert.deepEqual((await ficha(pagina)).filter((linha) => /^#/.test(linha)), ['# Destaques (2)', '# Nos quadros (1)', '## Caderno']);
    assert.deepEqual(erros, []);
  } finally {
    await contexto.close();
    await vps.fechar();
  }
});

test('um cartão levado ao quadro num aparelho aparece na ficha do livro no outro, depois da sincronização, com a cifra', async () => {
  const vps = await subirComoNaVps();
  const chaveDaCifra = globalThis.CifraPrancheta.gerarChave();
  const contextoA = await navegador.newContext({ viewport: TELA });
  const contextoB = await navegador.newContext({ viewport: TELA });
  try {
    const a = await abrirPrancheta(contextoA, vps.base, chaveDaCifra);
    const b = await abrirPrancheta(contextoB, vps.base, chaveDaCifra);
    const casmurro = await idDe(a.pagina, 'dc-1899.epub');

    // No aparelho B, antes de qualquer coisa: o livro não é citado.
    await abrirAFicha(b.pagina, 'dc-1899.epub');
    assert.deepEqual((await ficha(b.pagina)).slice(3), ['# Destaques (0)', '! Nenhum destaque neste livro.', '# Nos quadros (0)', '! Nenhum quadro cita este livro.']);

    // No aparelho A: um quadro novo, com um trecho destacado e levado a ele.
    const fichamento = await a.pagina.evaluate(() => newBoard(null, 'Fichamento').then((q) => q.id));
    await abrirPelaBiblioteca(a.pagina, 'dc-1899.epub');
    await noCapitulo(a.pagina, /primeiro capítulo/);
    await selecionarNoEpub(a.pagina, 'p1', 9, 26);
    await a.pagina.locator('#leitor .lt-selecao [data-acao="levar"]').waitFor();
    await a.pagina.click('#leitor .lt-selecao [data-acao="levar"]');
    await a.pagina.waitForFunction(() => [...S.items.values()].filter((i) => i.type === 'card').length === 1);
    const cartao = await a.pagina.evaluate(() => [...S.items.values()].find((i) => i.type === 'card').id);
    await aguardarSincronizado(a.pagina);

    // No aparelho B, a ficha ficou aberta: depois da sincronização, o destaque e o quadro chegam a ela, sem reabrir.
    await b.pagina.waitForFunction(() => document.querySelectorAll('#tela-biblioteca .tb-ficha [data-destaque]').length === 1
      && document.querySelectorAll('#tela-biblioteca .tb-ficha [data-cartao]').length === 1, null, { timeout: 30000 });
    // Na lista, o livro diz em quantos quadros aparece.
    await b.pagina.click('#tela-biblioteca [data-acao="voltar"]');
    assert.equal(await estadoDe(b.pagina, 'dc-1899.epub'), '0,0 MB · 1 quadro');
    await abrirAFicha(b.pagina, 'dc-1899.epub');
    await b.pagina.waitForFunction(() => document.querySelectorAll('#tela-biblioteca .tb-ficha .tb-item').length === 2);
    const noB = await ficha(b.pagina);
    assert.deepEqual([noB[3], noB[5], noB[6]], ['# Destaques (1)', '# Nos quadros (1)', '## Fichamento']);
    assert.match(noB[7], /^- trecho: primeiro capítulo \| onde: Capítulo um/);
    // O quadro nunca foi aberto no aparelho B: tocar no cartão o abre, com o cartão à vista.
    assert.notEqual(await b.pagina.evaluate(() => S.board), fichamento);
    await b.pagina.locator(`#tela-biblioteca .tb-ficha [data-cartao="${cartao}"]`).click();
    await b.pagina.waitForFunction(([quadro, id]) => S.board === quadro && [...S.sel].join() === id, [fichamento, cartao], { timeout: 15000 });
    const visto = await cartaoNaTela(b.pagina, cartao);
    assert.ok(visto.aVista && visto.selecionado && Math.abs(visto.foraDoMeio[0]) <= 2, JSON.stringify(visto));

    // No servidor, o conteúdo dos quadros não fica legível: nem o trecho citado, nem o nome do quadro, nem o link do livro.
    const guardado = fs.readdirSync(vps.dados, { recursive: true, withFileTypes: true }).filter((e) => e.isFile())
      .map((e) => fs.readFileSync(path.join(e.parentPath || e.path, e.name), 'latin1')).join('\n');
    assert.ok(guardado.length > 1000, 'o servidor guardou os dados dos dois aparelhos');
    for (const legivel of ['Fichamento', 'primeiro cap', 'prancheta.invalid']) assert.equal(guardado.includes(legivel), false, legivel);

    // O cartão apagado no aparelho A some da ficha no B.
    await abrirAFicha(b.pagina, 'dc-1899.epub');
    await b.pagina.waitForFunction(() => document.querySelectorAll('#tela-biblioteca .tb-ficha [data-cartao]').length === 1);
    await a.pagina.evaluate((id) => deleteIds([id]), cartao);
    await aguardarSincronizado(a.pagina);
    await b.pagina.waitForFunction(() => /Nenhum quadro cita este livro/.test(document.querySelector('#tela-biblioteca .tb-ficha').textContent), null, { timeout: 30000 });
    assert.equal(await b.pagina.locator('#tela-biblioteca .tb-ficha [data-destaque]').count(), 1, 'o destaque continua');
    assert.deepEqual(a.erros, []);
    assert.deepEqual(b.erros, []);
  } finally {
    await contextoA.close();
    await contextoB.close();
    await vps.fechar();
  }
});

test('na casca, a ficha não tem sombras, animações nem transparências, e cada item tem altura para o dedo', async () => {
  const vps = await subirComoNaVps();
  const contexto = await navegador.newContext({ viewport: { width: 930, height: 1240 }, hasTouch: true });
  await contexto.addInitScript(() => {
    const nada = () => {};
    window.Casca = { pronta: nada, transformacao: nada, areasReservadas: nada, canetaEscreve: nada, redesenharTela: nada, tinta: nada, toqueNoLeitor: nada };
  });
  try {
    const { pagina, erros } = await abrirPrancheta(contexto, vps.base);
    assert.equal(await pagina.evaluate(() => document.documentElement.classList.contains('casca')), true);
    const casmurro = await idDe(pagina, 'dc-1899.epub');
    await pagina.evaluate(async (livro) => {
      const m = window.marcacoesDaPrancheta;
      await m.destacar({ livro, nome: 'dc-1899.epub', tipo: 'application/epub+zip' }, { texto: 'Um destaque com um trecho comprido o bastante para ocupar mais de uma linha na ficha do livro. '.repeat(6), posicao: { cfi: 'epubcfi(/6/2!/4/4,/1:0,/1:9)' }, rotulo: 'Capítulo um, pos. 1' });
      m.levarAoQuadro({ livro, nome: 'dc-1899.epub' }, { trecho: 'Um trecho no quadro', posicao: { cfi: 'epubcfi(/6/2!/4/4)' }, rotulo: 'Capítulo um' });
      // O item mais baixo que a ficha pode ter: só um trecho curto, sem a posição escrita.
      m.levarAoQuadro({ livro, nome: 'dc-1899.epub' }, { trecho: 'Curto', posicao: { cfi: 'epubcfi(/6/2!/4/2)' } });
    }, casmurro);
    await abrirAFicha(pagina, 'dc-1899.epub');
    await pagina.waitForFunction(() => document.querySelectorAll('#tela-biblioteca .tb-ficha .tb-item').length === 3);
    const estilos = await pagina.evaluate(() => {
      const tela = document.getElementById('tela-biblioteca');
      const problemas = [];
      const cheio = (cor) => /^rgb\(/.test(cor) || cor === 'rgba(0, 0, 0, 0)';
      for (const elemento of [tela, ...tela.querySelectorAll('.tb-topo *, .tb-da-ficha, .tb-ficha, .tb-ficha *')]) {
        const estilo = getComputedStyle(elemento);
        const quem = elemento.className || elemento.tagName;
        if (estilo.boxShadow !== 'none' || estilo.textShadow !== 'none') problemas.push(`${quem}: sombra`);
        if (parseFloat(estilo.transitionDuration) || estilo.animationName !== 'none') problemas.push(`${quem}: animação`);
        if (estilo.opacity !== '1') problemas.push(`${quem}: opacidade`);
        if (!cheio(estilo.backgroundColor)) problemas.push(`${quem}: fundo ${estilo.backgroundColor}`);
      }
      const alturaDe = (seletor) => [...tela.querySelectorAll(seletor)].map((e) => Math.round(e.getBoundingClientRect().height));
      const alturas = { itens: alturaDe('.tb-ficha .tb-item'), abrir: alturaDe('.tb-ficha-abrir'), voltar: alturaDe('[data-acao="voltar"]') };
      const trecho = tela.querySelector('.tb-ficha .tb-trecho');
      return { problemas, alturas, linhasDoTrecho: Math.round(trecho.getBoundingClientRect().height / parseFloat(getComputedStyle(trecho).lineHeight)), largura: document.documentElement.scrollWidth <= innerWidth };
    });
    assert.deepEqual(estilos.problemas, []);
    assert.ok(estilos.alturas.itens.length === 3 && [...estilos.alturas.itens, ...estilos.alturas.abrir].every((altura) => altura >= 44) && estilos.alturas.voltar[0] >= 38,
      `cada item e cada botão da ficha têm altura para o dedo: ${JSON.stringify(estilos.alturas)}`);
    // Um trecho comprido é cortado em quatro linhas, e nada passa da largura da tela.
    assert.equal(estilos.linhasDoTrecho, 4);
    assert.equal(estilos.largura, true);
    // Na lista, o botão da ficha de cada linha também tem tamanho para o dedo.
    await pagina.click('#tela-biblioteca [data-acao="voltar"]');
    const botao = await pagina.evaluate(() => {
      const r = document.querySelector('#tela-biblioteca .tb-livro [data-acao="ficha"]').getBoundingClientRect();
      return [Math.round(r.width), Math.round(r.height)];
    });
    assert.ok(botao[0] >= 38 && botao[1] >= 38, `o botão da ficha: ${botao}`);
    assert.deepEqual(erros, []);
  } finally {
    await contexto.close();
    await vps.fechar();
  }
});
