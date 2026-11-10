// Tela da biblioteca, etapa 01 do plano 008: a lista dos livros numa tela
// própria, com título e autor, agrupada por autor, com busca, ordenação e
// filtro, a porcentagem lida neste aparelho e, no painel lateral, o botão que
// a abre e os livros lidos por último. A página e o servidor ficam num só
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
const { criarEpub, criarPdf } = require('./apoio/livros.cjs');
const { esperarLista, abrirABiblioteca, abrirPelaBiblioteca } = require('./apoio/biblioteca.cjs');

require('../app/compat/biblioteca.js');
const { organizar, tituloDe, grupoDe, situacaoDe, normalizar } = globalThis.BibliotecaPrancheta;

const CHAVE = 'chave-de-teste-da-tela-0123456789abcdef';
const TELA = { width: 1200, height: 800 };
const APP = path.join(__dirname, '..', 'app');

let navegador;
let vps;
before(async () => {
  navegador = await chromium.launch();
  // Uma biblioteca por autor, como a do autor: uma pasta para cada um, uma
  // subpasta, um arquivo cujo nome não diz o título e dois livros fora de pasta.
  const livros = fs.mkdtempSync(path.join(os.tmpdir(), 'prancheta-tela-'));
  fs.mkdirSync(path.join(livros, 'Machado de Assis'));
  fs.mkdirSync(path.join(livros, 'Clarice Lispector', 'Contos'), { recursive: true });
  fs.writeFileSync(path.join(livros, 'Machado de Assis', 'dc-1899.epub'), await criarEpub({ titulo: 'Dom Casmurro' }));
  fs.writeFileSync(path.join(livros, 'Machado de Assis', 'Memórias póstumas.epub'), await criarEpub({ titulo: 'Memórias póstumas de Brás Cubas', autor: 'Assis, Machado de' }));
  fs.writeFileSync(path.join(livros, 'Clarice Lispector', 'A hora da estrela.pdf'), criarPdf(['Pagina um da estrela', 'Pagina dois', 'Pagina tres']));
  fs.writeFileSync(path.join(livros, 'Clarice Lispector', 'Contos', 'Laços.epub'), await criarEpub({ titulo: 'Laços de família', autor: 'Clarice Lispector' }));
  fs.writeFileSync(path.join(livros, 'Solto.pdf'), criarPdf(['Um documento solto', 'Segunda pagina dele']));
  fs.writeFileSync(path.join(livros, 'Avulso.epub'), await criarEpub({ titulo: 'Um avulso', autor: 'Ana Cristina Cesar' }));
  const armazem = await Armazem.abrir(fs.mkdtempSync(path.join(os.tmpdir(), 'prancheta-vps-')));
  const sincronia = criarServidor({ armazem, chave: CHAVE, biblioteca: new Biblioteca(livros) }).listeners('request')[0];
  const pagina = criarServidorDaPagina({ pasta: APP }).listeners('request')[0];
  const borda = http.createServer((req, res) => (req.url.startsWith('/sync/') ? sincronia : pagina)(req, res));
  await new Promise((pronto) => borda.listen(0, '127.0.0.1', pronto));
  vps = {
    base: `http://127.0.0.1:${borda.address().port}`,
    fechar: () => new Promise((pronto) => { borda.close(() => pronto()); borda.closeAllConnections(); }),
  };
});
after(async () => {
  await navegador?.close();
  await vps?.fechar();
});

// Abre a Prancheta, ligada ao servidor, com o painel lateral à vista; com naCasca, dentro de uma casca simulada.
async function abrirPrancheta({ naCasca = false, tela = TELA } = {}) {
  const contexto = await navegador.newContext({ viewport: tela, hasTouch: naCasca });
  if (naCasca) {
    await contexto.addInitScript(() => {
      const nada = () => {};
      window.Casca = { pronta: nada, transformacao: nada, areasReservadas: nada, canetaEscreve: nada, redesenharTela: nada, tinta: nada, toqueNoLeitor: nada };
    });
  }
  const pagina = await contexto.newPage();
  const erros = [];
  pagina.on('pageerror', (e) => erros.push(e.message));
  await pagina.goto(`${vps.base}/`);
  await pagina.waitForFunction(() => window.__booted === true && navigator.serviceWorker.controller !== null, null, { timeout: 10000 });
  await pagina.waitForFunction(() => Boolean(window.marcacoesDaPrancheta && document.getElementById('biblioteca') && document.getElementById('tela-biblioteca')), null, { timeout: 10000 });
  await pagina.evaluate(([endereco, chave]) => window.sincronizacaoDaPrancheta.configurar({ endereco, chave }), [vps.base, CHAVE]);
  await esperarLista(pagina, 6);
  await pagina.evaluate(() => { if (!document.body.classList.contains('side')) toggleSide(true); });
  return { contexto, pagina, erros };
}

// O que a tela mostra, de cima para baixo: o nome de cada grupo e, de cada livro, o título, o autor, a situação e o formato.
const linhas = (pagina) => pagina.$$eval('#tela-biblioteca .tb-lista > *', (itens) => itens.map((item) => {
  if (item.classList.contains('tb-grupo')) return `# ${item.firstChild.textContent} (${item.querySelector('span').textContent})`;
  if (!item.classList.contains('tb-livro')) return `! ${item.textContent}`;
  return ['.tb-titulo', '.tb-autor', '.tb-estado', '.tb-formato'].map((parte) => item.querySelector(parte).textContent).join(' | ');
}));
const titulos = (pagina) => pagina.$$eval('#tela-biblioteca .tb-livro .tb-titulo', (itens) => itens.map((item) => item.textContent));
const telaAberta = (pagina) => pagina.locator('#tela-biblioteca').isVisible();
const idDe = (pagina, arquivo) => pagina.evaluate((nome) => window.bibliotecaDaPrancheta.estado.lista.find((l) => l.nome === nome).id, arquivo);

test('a lista é organizada por autor, por título ou pelos lidos por último, com busca sem acentos e filtro dos guardados', () => {
  const lista = [
    { id: 'a', nome: 'dc-1899.epub', pasta: 'Machado de Assis', titulo: 'Dom Casmurro', autor: 'Machado de Assis', bytes: 2 * 1024 * 1024 },
    { id: 'b', nome: 'Memórias.epub', pasta: 'Machado de Assis/Romances', titulo: 'Memórias póstumas de Brás Cubas', autor: 'Assis, Machado de' },
    { id: 'c', nome: 'A hora da estrela.pdf', pasta: 'Clarice Lispector', titulo: 'A hora da estrela', autor: 'Clarice Lispector' },
    { id: 'd', nome: 'Solto.pdf', pasta: '', titulo: 'Solto', autor: '' },
    { id: 'e', nome: 'Avulso.epub', pasta: '', titulo: 'Água viva', autor: 'clarice lispector' },
    // Uma lista guardada por uma versão anterior, sem título nem autor.
    { id: 'f', nome: 'Écloga antiga.EPUB', pasta: 'machado de assis' },
  ];
  const resumo = (itens) => itens.map((l) => (l.tipo === 'grupo' ? `# ${l.nome} (${l.quantos})` : `${tituloDe(l.livro)}${l.autor ? ` [${l.autor}]` : ''}`));

  // O título e o grupo de cada livro.
  assert.deepEqual(lista.map(tituloDe), ['Dom Casmurro', 'Memórias póstumas de Brás Cubas', 'A hora da estrela', 'Solto', 'Água viva', 'Écloga antiga']);
  assert.deepEqual(lista.map(grupoDe), ['Machado de Assis', 'Machado de Assis', 'Clarice Lispector', '', 'clarice lispector', 'machado de assis']);
  assert.equal(tituloDe(null), '');
  assert.equal(normalizar('  Água   VIVÁ '), 'agua viva');

  // Por autor: a pasta agrupa, sem distinguir maiúsculas, o autor escrito no
  // livro só aparece quando difere dela, e os sem autor vão para o fim.
  assert.deepEqual(resumo(organizar(lista)), [
    '# Clarice Lispector (2)', 'A hora da estrela', 'Água viva',
    '# Machado de Assis (3)', 'Dom Casmurro', 'Écloga antiga', 'Memórias póstumas de Brás Cubas [Assis, Machado de]',
    '# Sem autor (1)', 'Solto',
  ]);
  // Por título, sem grupos, com o autor em cada linha, e os acentos na ordem do alfabeto.
  assert.deepEqual(resumo(organizar(lista, { ordem: 'titulo' })), [
    'A hora da estrela [Clarice Lispector]', 'Água viva [clarice lispector]', 'Dom Casmurro [Machado de Assis]', 'Écloga antiga [machado de assis]',
    'Memórias póstumas de Brás Cubas [Machado de Assis]', 'Solto',
  ]);
  // Lidos por último: os mais recentes primeiro, e depois os nunca lidos, por título.
  const leituras = new Map([['d', { em: 300 }], ['a', { em: 500, porcentagem: 0.4 }], ['c', { em: 100 }]]);
  assert.deepEqual(resumo(organizar(lista, { ordem: 'recentes', leituras })).map((l) => l.replace(/ \[.*/, '')), [
    'Dom Casmurro', 'Solto', 'A hora da estrela', 'Água viva', 'Écloga antiga', 'Memórias póstumas de Brás Cubas',
  ]);

  // A busca: sem acentos nem maiúsculas, cada palavra em qualquer lugar do título, do autor, da pasta ou do arquivo.
  const achar = (consulta, opcoes) => organizar(lista, { ordem: 'titulo', consulta, ...opcoes }).map((l) => l.livro.id).join('');
  assert.equal(achar('memorias'), 'b');
  assert.equal(achar('  BRAS   memórias '), 'b');
  assert.equal(achar('agua'), 'e');
  assert.equal(achar('ÁGUA'), 'e');
  assert.equal(achar('machado'), 'afb');
  assert.equal(achar('assis machado de'), 'afb');
  assert.equal(achar('romances'), 'b');
  assert.equal(achar('dc-1899'), 'a');
  assert.equal(achar('ecloga'), 'f');
  assert.equal(achar('clarice estrela'), 'c');
  assert.equal(achar('lispector agua'), 'e');
  assert.equal(achar('clarice machado'), '');
  assert.equal(achar(''), 'ceafbd');
  // O filtro dos guardados neste aparelho, sozinho e com a busca.
  const guardados = new Set(['a', 'c']);
  assert.equal(achar('', { soGuardados: true, guardados }), 'ca');
  assert.equal(achar('machado', { soGuardados: true, guardados }), 'a');
  assert.equal(achar('', { soGuardados: true }), '');
  assert.deepEqual(organizar(null), []);

  // O que cada linha diz do livro neste aparelho.
  const estado = { guardados, leituras };
  assert.equal(situacaoDe(lista[0], estado), 'guardado · 40%');
  assert.equal(situacaoDe(lista[2], estado), 'guardado');
  assert.equal(situacaoDe(lista[3], estado), '0,0 MB');
  assert.equal(situacaoDe(lista[0], { guardados: new Set(), leituras: new Map() }), '2,0 MB');
  assert.equal(situacaoDe(lista[0], estado, new Map([['a', { andamento: { recebidos: 700, total: 2000 } }]])), 'baixando 30%');
  assert.equal(situacaoDe(lista[0], estado, new Map([['a', { andamento: { recebidos: 3 * 1024 * 1024, total: 0 } }]])), 'baixando 3,0 MB');
  assert.equal(situacaoDe(lista[1], { guardados, leituras: new Map([['b', { em: 1, porcentagem: 0.996 }]]) }), '0,0 MB · 100%');
});

test('o botão do painel abre a biblioteca por cima do quadro, com os livros por autor; ela fecha pelo botão e pelo Esc, e o quadro fica como estava', async () => {
  const { contexto, pagina, erros } = await abrirPrancheta();
  try {
    // Um cartão selecionado no quadro, para conferir que nada nele muda.
    await pagina.evaluate(() => {
      begin();
      const cartao = add({ type: 'card', x: 300, y: 200, w: 240, h: 0, blocks: [{ h: 'Um cartão do quadro' }], c: 'none' });
      commit();
      select([cartao.id]);
    });
    const doQuadro = () => pagina.evaluate(() => JSON.stringify([S.view, S.board, S.tool, [...S.items.keys()], [...S.sel], document.body.classList.contains('side')]));
    const antes = await doQuadro();

    assert.equal(await telaAberta(pagina), false);
    await pagina.evaluate(() => {
      const biblioteca = window.bibliotecaDaPrancheta;
      const original = biblioteca.atualizar.bind(biblioteca);
      window.__atualizacoes = 0;
      biblioteca.atualizar = () => { window.__atualizacoes += 1; return original(); };
    });
    assert.equal(await pagina.textContent('#biblioteca .bib-abrir .nm'), 'Abrir a biblioteca');
    assert.equal(await pagina.textContent('#biblioteca .bib-abrir .bib-estado'), '6');
    // No painel, não há mais a lista inteira: só o botão, enquanto nada foi lido.
    assert.equal(await pagina.locator('#biblioteca .bib-livro').count(), 0);
    await pagina.locator('#biblioteca [data-acao="abrir-a-biblioteca"]').click();
    assert.equal(await telaAberta(pagina), true);
    assert.deepEqual(await pagina.$eval('#tela-biblioteca', (t) => [t.getAttribute('role'), t.getAttribute('aria-modal'), t.getAttribute('aria-label')]), ['dialog', 'true', 'Biblioteca']);
    // A tela cobre a página inteira, por cima do quadro, do painel e dos controles.
    const cobre = await pagina.evaluate(() => {
      const r = document.getElementById('tela-biblioteca').getBoundingClientRect();
      const noTopo = (x, y) => Boolean(document.elementFromPoint(x, y).closest('#tela-biblioteca'));
      return [r.left, r.top, r.width === innerWidth, r.height === innerHeight, noTopo(20, 20), noTopo(innerWidth - 20, 20), noTopo(innerWidth / 2, innerHeight / 2), noTopo(20, innerHeight - 20)];
    });
    assert.deepEqual(cobre, [0, 0, true, true, true, true, true, true]);
    // Abrir a tela pede a lista atual ao servidor.
    assert.equal(await pagina.evaluate(() => window.__atualizacoes), 1);
    // No computador, o campo de busca já recebe o que for digitado.
    assert.equal(await pagina.evaluate(() => document.activeElement.className), 'tb-busca');

    // Os livros por autor: a pasta de cada um, com o autor escrito no livro só quando difere dela.
    assert.deepEqual(await linhas(pagina), [
      '# Ana Cristina Cesar (1)', 'Um avulso |  | 0,0 MB | EPUB',
      '# Clarice Lispector (2)', 'A hora da estrela |  | 0,0 MB | PDF', 'Laços de família |  | 0,0 MB | EPUB',
      '# Machado de Assis (2)', 'Dom Casmurro |  | 0,0 MB | EPUB', 'Memórias póstumas de Brás Cubas | Assis, Machado de | 0,0 MB | EPUB',
      '# Sem autor (1)', 'Solto |  | 0,0 MB | PDF',
    ]);
    assert.equal(await pagina.textContent('#tela-biblioteca .tb-conta'), '6 livros');
    assert.deepEqual(await pagina.$$eval('#tela-biblioteca [data-ordem]', (b) => b.map((x) => `${x.textContent}:${x.getAttribute('aria-pressed')}`)), ['Autor:true', 'Título:false', 'Lidos por último:false']);
    assert.equal(await pagina.getAttribute('#tela-biblioteca [data-acao="so-guardados"]', 'aria-pressed'), 'false');
    // Cada linha guarda o nome do arquivo, que o título pode não dizer.
    assert.equal(await pagina.getAttribute('#tela-biblioteca .tb-livro[data-arquivo="dc-1899.epub"]', 'title'), 'dc-1899.epub');

    // Com a tela aberta, as teclas não chegam aos atalhos do quadro: no campo de
    // busca, numa linha da lista e fora da tela; a roda do mouse também não.
    await pagina.keyboard.type('pb');
    assert.equal(await pagina.inputValue('#tela-biblioteca .tb-busca'), 'pb');
    await pagina.fill('#tela-biblioteca .tb-busca', '');
    await pagina.locator('#tela-biblioteca .tb-livro').first().focus();
    for (const tecla of ['p', 'b', 'Delete', 'Backspace']) await pagina.keyboard.press(tecla);
    await pagina.evaluate(() => document.activeElement.blur());
    for (const tecla of ['p', 'b', 'Delete']) await pagina.keyboard.press(tecla);
    await pagina.mouse.move(600, 500);
    await pagina.mouse.wheel(0, 400);
    await pagina.mouse.click(600, 760);
    // Um texto colado, numa linha da lista ou fora da tela, não vira cartão no quadro coberto;
    // um arquivo solto sobre a tela não vai para o quadro nem tira o navegador da página.
    const colarESoltar = () => pagina.evaluate(() => {
      const tela = document.getElementById('tela-biblioteca');
      const dados = new DataTransfer();
      dados.setData('text/plain', 'um texto colado');
      for (const alvo of [tela.hidden ? document.body : tela.querySelector('.tb-livro'), document.body]) {
        alvo.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dados }));
      }
      const solto = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() });
      const sobre = new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() });
      tela.dispatchEvent(sobre);
      tela.dispatchEvent(solto);
      return [sobre.defaultPrevented, solto.defaultPrevented];
    });
    assert.deepEqual(await colarESoltar(), [true, true]);
    assert.equal(await doQuadro(), antes);
    assert.equal(await telaAberta(pagina), true);

    // Esc fecha a tela, de qualquer lugar, sem desfazer a seleção do quadro, e o foco volta ao botão.
    await pagina.locator('#biblioteca').evaluate(() => {});
    await pagina.keyboard.press('Escape');
    assert.equal(await telaAberta(pagina), false);
    assert.equal(await doQuadro(), antes);
    // Fechada a tela, os atalhos do quadro voltam a valer.
    await pagina.evaluate(() => document.activeElement.blur());
    await pagina.keyboard.press('p');
    assert.equal(await pagina.evaluate(() => S.tool), 'pen');
    // E o mesmo texto colado agora vira um cartão, o que mostra que a tela é que o segurava.
    await pagina.keyboard.press('v');
    await colarESoltar();
    assert.equal(await pagina.evaluate(() => [...S.items.values()].filter((i) => i.type === 'card' && i.blocks.some((b) => /um texto colado/.test(b.h))).length > 0), true);
    await pagina.evaluate(() => { while (S.items.size > 1) undo(); });
    assert.equal(await pagina.evaluate(() => S.items.size), 1);
    // A caneta desfaz a seleção; ela é refeita para as conferências seguintes.
    await pagina.keyboard.press('v');
    await pagina.evaluate(() => select([...S.items.keys()]));
    assert.equal(await doQuadro(), antes);

    // Pelo teclado, a partir do botão do painel, e fechando pelo botão da tela.
    await pagina.locator('#biblioteca [data-acao="abrir-a-biblioteca"]').focus();
    await pagina.keyboard.press('Enter');
    assert.equal(await telaAberta(pagina), true);
    await pagina.locator('#tela-biblioteca .tb-livro').first().focus();
    await pagina.keyboard.press('Escape');
    assert.equal(await telaAberta(pagina), false);
    assert.equal(await pagina.evaluate(() => document.activeElement.dataset.acao), 'abrir-a-biblioteca', 'o foco volta ao botão que abriu a tela');
    await pagina.keyboard.press(' ');
    assert.equal(await telaAberta(pagina), true);
    await pagina.locator('#tela-biblioteca [data-acao="fechar"]').click();
    assert.equal(await telaAberta(pagina), false);
    assert.equal(await doQuadro(), antes);
    assert.deepEqual(erros, []);
  } finally {
    await contexto.close();
  }
});

test('a busca, a ordem e o filtro mudam a lista da tela, e a ordem e o filtro ficam guardados no aparelho', async () => {
  const { contexto, pagina, erros } = await abrirPrancheta();
  try {
    await abrirABiblioteca(pagina);
    const buscar = async (texto) => {
      await pagina.fill('#tela-biblioteca .tb-busca', texto);
      return titulos(pagina);
    };
    // A busca, pelo título, pelo autor, pela pasta e pelo nome do arquivo, sem acentos nem maiúsculas.
    assert.deepEqual(await buscar('memorias bras'), ['Memórias póstumas de Brás Cubas']);
    assert.equal(await pagina.textContent('#tela-biblioteca .tb-conta'), '1 de 6');
    assert.deepEqual(await linhas(pagina), ['# Machado de Assis (1)', 'Memórias póstumas de Brás Cubas | Assis, Machado de | 0,0 MB | EPUB']);
    assert.deepEqual(await buscar('MACHADO'), ['Dom Casmurro', 'Memórias póstumas de Brás Cubas']);
    assert.deepEqual(await buscar('lacos'), ['Laços de família']);
    assert.deepEqual(await buscar('contos'), ['Laços de família']);
    assert.deepEqual(await buscar('dc-1899'), ['Dom Casmurro']);
    assert.deepEqual(await buscar('ana cesar'), ['Um avulso']);
    assert.deepEqual(await buscar('nada disso'), []);
    assert.deepEqual(await linhas(pagina), ['! Nenhum livro com "nada disso".']);
    assert.equal(await pagina.textContent('#tela-biblioteca .tb-conta'), '0 de 6');
    assert.equal((await buscar('')).length, 6);

    // Por título: sem grupos, com o autor em cada linha.
    await pagina.locator('#tela-biblioteca [data-ordem="titulo"]').click();
    assert.deepEqual(await linhas(pagina), [
      'A hora da estrela | Clarice Lispector | 0,0 MB | PDF', 'Dom Casmurro | Machado de Assis | 0,0 MB | EPUB', 'Laços de família | Clarice Lispector | 0,0 MB | EPUB',
      'Memórias póstumas de Brás Cubas | Machado de Assis | 0,0 MB | EPUB', 'Solto |  | 0,0 MB | PDF', 'Um avulso | Ana Cristina Cesar | 0,0 MB | EPUB',
    ]);
    assert.deepEqual(await pagina.$$eval('#tela-biblioteca [data-ordem]', (b) => b.map((x) => x.getAttribute('aria-pressed'))), ['false', 'true', 'false']);
    // A busca vale junto com a ordem.
    assert.deepEqual(await buscar('clarice'), ['A hora da estrela', 'Laços de família']);
    await buscar('');

    // Lidos por último: os lidos neste aparelho primeiro, do mais recente para o mais antigo.
    const [estrela, solto] = [await idDe(pagina, 'A hora da estrela.pdf'), await idDe(pagina, 'Solto.pdf')];
    await pagina.evaluate(async ([a, b]) => {
      const biblioteca = window.bibliotecaDaPrancheta;
      await biblioteca.gravarPosicao(a, { pagina: 2 }, Date.now() - 60000, 2 / 3);
      await biblioteca.gravarPosicao(b, { pagina: 1 }, Date.now(), 0.5);
    }, [estrela, solto]);
    await pagina.locator('#tela-biblioteca [data-ordem="recentes"]').click();
    assert.deepEqual(await titulos(pagina), ['Solto', 'A hora da estrela', 'Dom Casmurro', 'Laços de família', 'Memórias póstumas de Brás Cubas', 'Um avulso']);
    // A porcentagem lida aparece na linha, e a ordem acompanha uma leitura nova.
    assert.deepEqual((await linhas(pagina)).slice(0, 2), ['Solto |  | 0,0 MB · 50% | PDF', 'A hora da estrela | Clarice Lispector | 0,0 MB · 67% | PDF']);
    await pagina.evaluate((id) => window.bibliotecaDaPrancheta.gravarPosicao(id, { pagina: 3 }, Date.now() + 1000, 1), estrela);
    await pagina.waitForFunction(() => document.querySelector('#tela-biblioteca .tb-livro .tb-titulo').textContent === 'A hora da estrela');
    assert.deepEqual((await linhas(pagina)).slice(0, 2), ['A hora da estrela | Clarice Lispector | 0,0 MB · 100% | PDF', 'Solto |  | 0,0 MB · 50% | PDF']);

    // O filtro dos guardados neste aparelho.
    await pagina.locator('#tela-biblioteca [data-acao="so-guardados"]').click();
    assert.equal(await pagina.getAttribute('#tela-biblioteca [data-acao="so-guardados"]', 'aria-pressed'), 'true');
    assert.deepEqual(await linhas(pagina), ['! Nenhum livro guardado neste aparelho.']);
    await pagina.evaluate((id) => window.bibliotecaDaPrancheta.guardar(id), solto);
    await pagina.waitForFunction(() => document.querySelectorAll('#tela-biblioteca .tb-livro').length === 1);
    assert.deepEqual(await linhas(pagina), ['Solto |  | guardado · 50% | PDF']);
    assert.equal(await pagina.textContent('#tela-biblioteca .tb-conta'), '1 de 6');
    assert.deepEqual(await buscar('estrela'), []);
    assert.deepEqual(await linhas(pagina), ['! Nenhum livro com "estrela" entre os guardados neste aparelho.']);

    // Ao reabrir a tela, a busca recomeça vazia; a ordem e o filtro continuam, também depois de recarregar a página.
    await pagina.keyboard.press('Escape');
    await abrirABiblioteca(pagina);
    assert.equal(await pagina.inputValue('#tela-biblioteca .tb-busca'), '');
    assert.deepEqual(await linhas(pagina), ['Solto |  | guardado · 50% | PDF']);
    await pagina.reload();
    await pagina.waitForFunction(() => window.__booted === true && Boolean(document.getElementById('tela-biblioteca')), null, { timeout: 10000 });
    await esperarLista(pagina, 6);
    await pagina.evaluate(() => { if (!document.body.classList.contains('side')) toggleSide(true); });
    await abrirABiblioteca(pagina);
    assert.deepEqual(await pagina.$$eval('#tela-biblioteca [data-ordem]', (b) => b.map((x) => x.getAttribute('aria-pressed'))), ['false', 'false', 'true']);
    assert.equal(await pagina.getAttribute('#tela-biblioteca [data-acao="so-guardados"]', 'aria-pressed'), 'true');
    assert.deepEqual(await linhas(pagina), ['Solto |  | guardado · 50% | PDF']);
    await pagina.locator('#tela-biblioteca [data-acao="so-guardados"]').click();
    assert.deepEqual((await titulos(pagina)).slice(0, 3), ['A hora da estrela', 'Solto', 'Dom Casmurro']);
    const recarregar = async () => {
      await pagina.reload();
      await pagina.waitForFunction(() => window.__booted === true && Boolean(document.getElementById('tela-biblioteca')), null, { timeout: 10000 });
      await esperarLista(pagina, 6);
      await pagina.evaluate(() => { if (!document.body.classList.contains('side')) toggleSide(true); });
      await abrirABiblioteca(pagina);
      return [
        ...await pagina.$$eval('#tela-biblioteca [data-ordem]', (b) => b.map((x) => x.getAttribute('aria-pressed'))),
        await pagina.getAttribute('#tela-biblioteca [data-acao="so-guardados"]', 'aria-pressed'),
      ];
    };
    // A ordem trocada por último, sem mexer no filtro, também fica guardada.
    await pagina.locator('#tela-biblioteca [data-ordem="titulo"]').click();
    assert.deepEqual(await recarregar(), ['false', 'true', 'false', 'false']);
    assert.deepEqual((await titulos(pagina)).slice(0, 2), ['A hora da estrela', 'Dom Casmurro']);
    // Uma preferência com valores desconhecidos, ou estragada, volta ao padrão, sem erro.
    for (const guardada of ['{"ordem":"capa","soGuardados":"sim"}', '{"ordem":"titulo","soGuardados":tr', '"titulo"', 'null']) {
      await pagina.evaluate((valor) => localStorage.setItem('prancheta.biblioteca.tela', valor), guardada);
      assert.deepEqual(await recarregar(), ['true', 'false', 'false', 'false'], guardada);
      assert.equal((await titulos(pagina)).length, 6);
      assert.equal(await pagina.locator('#tela-biblioteca .tb-grupo').count(), 4);
    }
    assert.deepEqual(erros, []);
  } finally {
    await contexto.close();
  }
});

test('tocar num livro o baixa com o andamento à vista, fecha a biblioteca e o abre no leitor; a porcentagem lida e os lidos por último aparecem', async () => {
  const { contexto, pagina, erros } = await abrirPrancheta();
  try {
    // O download demora um pouco, para o andamento aparecer na linha.
    await pagina.evaluate(() => {
      const biblioteca = window.bibliotecaDaPrancheta;
      const original = biblioteca._fetch;
      biblioteca._fetch = async (endereco, ...resto) => {
        if (/\/sync\/biblioteca\/[0-9a-f]{32}$/.test(endereco)) await new Promise((pronto) => setTimeout(pronto, 600));
        return original(endereco, ...resto);
      };
    });
    await abrirPelaBiblioteca(pagina, 'A hora da estrela.pdf');
    await pagina.waitForFunction(() => /^baixando/.test(document.querySelector('#tela-biblioteca .tb-livro[data-arquivo="A hora da estrela.pdf"] .tb-estado').textContent));
    assert.equal(await telaAberta(pagina), true, 'a tela continua aberta enquanto o livro é baixado');
    // Terminado o download, a tela fecha, e o livro abre no leitor.
    await pagina.locator('#tela-biblioteca').waitFor({ state: 'hidden', timeout: 15000 });
    await pagina.waitForFunction(() => document.querySelector('#leitor .lt-posicao').textContent === 'p. 1 de 3', null, { timeout: 15000 });
    assert.equal(await pagina.locator('#leitor').isVisible(), true);
    assert.match(await pagina.textContent('#biblioteca .bib-aviso'), /"A hora da estrela" foi guardado neste aparelho/);

    // Lida uma página, a porcentagem fica guardada neste aparelho e aparece na biblioteca.
    await pagina.click('#leitor [data-acao="proxima"]');
    await pagina.waitForFunction(() => document.querySelector('#leitor .lt-posicao').textContent === 'p. 2 de 3');
    const estrela = await idDe(pagina, 'A hora da estrela.pdf');
    await pagina.waitForFunction((id) => (window.bibliotecaDaPrancheta.estado.leituras.get(id) || {}).porcentagem > 0.6, estrela);
    await abrirABiblioteca(pagina);
    assert.equal(await pagina.textContent('#tela-biblioteca .tb-livro[data-arquivo="A hora da estrela.pdf"] .tb-estado'), 'guardado · 67%');
    // A biblioteca abre por cima do leitor, e o livro continua aberto ao fechá-la.
    assert.equal(await pagina.evaluate(() => Boolean(document.elementFromPoint(innerWidth - 40, innerHeight / 2).closest('#tela-biblioteca'))), true);
    await pagina.keyboard.press('Escape');
    assert.equal(await pagina.textContent('#leitor .lt-posicao'), 'p. 2 de 3');

    // Um livro já guardado fecha a tela na hora e abre; o EPUB também guarda a porcentagem.
    await pagina.evaluate((id) => window.bibliotecaDaPrancheta.guardar(id), await idDe(pagina, 'dc-1899.epub'));
    // Desta vez pelo teclado, com a linha em foco: outra tecla não abre nada, e Enter abre.
    await abrirABiblioteca(pagina);
    await pagina.locator('#tela-biblioteca .tb-livro[data-arquivo="dc-1899.epub"]').focus();
    await pagina.keyboard.press('x');
    assert.equal(await telaAberta(pagina), true);
    await pagina.keyboard.press('Enter');
    await pagina.locator('#tela-biblioteca').waitFor({ state: 'hidden' });
    await pagina.waitForFunction(() => /primeiro capítulo/.test(document.querySelector('#leitor iframe')?.contentDocument?.body?.innerText || ''), null, { timeout: 15000 });
    assert.match(await pagina.textContent('#biblioteca .bib-aviso'), /"Dom Casmurro" está guardado neste aparelho/);
    await pagina.click('#leitor [data-acao="proxima"]');
    const casmurro = await idDe(pagina, 'dc-1899.epub');
    await pagina.waitForFunction((id) => (window.bibliotecaDaPrancheta.estado.leituras.get(id) || {}).porcentagem > 0, casmurro, { timeout: 15000 });
    await pagina.click('#leitor [data-acao="fechar"]');

    // No painel, os lidos por último, o mais recente primeiro, com o título de cada um.
    const noPainel = () => pagina.$$eval('#biblioteca .bib-livro .nm', (itens) => itens.map((item) => item.textContent));
    assert.deepEqual(await noPainel(), ['Dom Casmurro', 'A hora da estrela']);
    assert.equal(await pagina.textContent('#biblioteca .bib-rotulo'), 'Lidos por último');
    assert.equal(await pagina.getAttribute('#biblioteca .bib-livro', 'title'), 'Dom Casmurro, Machado de Assis');
    // Tocar num deles abre o livro direto, sem passar pela tela, onde a leitura parou.
    await pagina.locator('#biblioteca .bib-livro', { hasText: 'A hora da estrela' }).click();
    await pagina.waitForFunction(() => document.querySelector('#leitor .lt-posicao').textContent === 'p. 2 de 3', null, { timeout: 15000 });
    assert.equal(await telaAberta(pagina), false);
    await pagina.click('#leitor [data-acao="fechar"]');

    // Só os cinco lidos por último ficam no painel.
    await pagina.evaluate(async () => {
      const biblioteca = window.bibliotecaDaPrancheta;
      const agora = Date.now();
      for (const [i, nome] of ['Solto.pdf', 'Avulso.epub', 'Laços.epub', 'Memórias póstumas.epub'].entries()) {
        await biblioteca.gravarPosicao(biblioteca.estado.lista.find((l) => l.nome === nome).id, { pagina: 1 }, agora + 10000 + i * 1000, 0.1);
      }
    });
    await pagina.waitForFunction(() => document.querySelectorAll('#biblioteca .bib-livro').length === 5);
    assert.deepEqual(await noPainel(), ['Memórias póstumas de Brás Cubas', 'Laços de família', 'Um avulso', 'Solto', 'Dom Casmurro']);
    // E continuam lá depois de recarregar a página.
    await pagina.reload();
    await pagina.waitForFunction(() => window.__booted === true && document.querySelectorAll('#biblioteca .bib-livro').length === 5, null, { timeout: 15000 });
    assert.deepEqual(await noPainel(), ['Memórias póstumas de Brás Cubas', 'Laços de família', 'Um avulso', 'Solto', 'Dom Casmurro']);
    assert.deepEqual(erros, []);
  } finally {
    await contexto.close();
  }
});

test('sem rede, a tela mostra a última lista recebida, abre os livros guardados e avisa dos que ainda não estão no aparelho', async () => {
  const { contexto, pagina, erros } = await abrirPrancheta();
  try {
    await pagina.evaluate((id) => window.bibliotecaDaPrancheta.guardar(id), await idDe(pagina, 'Solto.pdf'));
    await contexto.setOffline(true);
    await pagina.reload();
    await pagina.waitForFunction(() => window.__booted === true && Boolean(document.getElementById('tela-biblioteca')), null, { timeout: 10000 });
    await pagina.waitForFunction(() => window.bibliotecaDaPrancheta.estado.situacao === 'sem_rede', null, { timeout: 15000 });
    await pagina.evaluate(() => { if (!document.body.classList.contains('side')) toggleSide(true); });
    await abrirABiblioteca(pagina);
    await pagina.waitForFunction(() => /^Sem rede\. Lista de /.test(document.querySelector('#tela-biblioteca .tb-aviso').textContent), null, { timeout: 15000 });
    // A lista é a última recebida, com o título e o autor de cada livro.
    assert.deepEqual(await linhas(pagina), [
      '# Ana Cristina Cesar (1)', 'Um avulso |  | 0,0 MB | EPUB',
      '# Clarice Lispector (2)', 'A hora da estrela |  | 0,0 MB | PDF', 'Laços de família |  | 0,0 MB | EPUB',
      '# Machado de Assis (2)', 'Dom Casmurro |  | 0,0 MB | EPUB', 'Memórias póstumas de Brás Cubas | Assis, Machado de | 0,0 MB | EPUB',
      '# Sem autor (1)', 'Solto |  | guardado | PDF',
    ]);
    // Um livro que ainda não está no aparelho avisa, e a tela continua aberta.
    await abrirPelaBiblioteca(pagina, 'dc-1899.epub');
    await pagina.waitForFunction(() => /Sem rede: "Dom Casmurro" ainda não está guardado neste aparelho\./.test(document.querySelector('#tela-biblioteca .tb-aviso').textContent), null, { timeout: 15000 });
    assert.equal(await telaAberta(pagina), true);
    assert.equal(await pagina.locator('#leitor').isVisible(), false);
    // O livro guardado abre, e a tela fecha.
    await abrirPelaBiblioteca(pagina, 'Solto.pdf');
    await pagina.locator('#tela-biblioteca').waitFor({ state: 'hidden' });
    await pagina.waitForFunction(() => document.querySelector('#leitor .lt-posicao').textContent === 'p. 1 de 2', null, { timeout: 15000 });
    assert.deepEqual(erros, []);
  } finally {
    await contexto.close();
  }
});

test('com 500 livros, a tela abre e a busca responde em menos de um segundo; na casca, a tela não tem sombras, animações nem transparências', async (t) => {
  const { contexto, pagina, erros } = await abrirPrancheta({ naCasca: true, tela: { width: 930, height: 1240 } });
  try {
    assert.equal(await pagina.evaluate(() => document.documentElement.classList.contains('casca')), true);
    // Quinhentos livros de cinquenta autores, postos na lista sem passar pelo servidor.
    const tempos = await pagina.evaluate(async () => {
      const biblioteca = window.bibliotecaDaPrancheta;
      biblioteca.atualizar = async () => biblioteca.estado;
      const lista = Array.from({ length: 500 }, (_, i) => ({
        id: i.toString(16).padStart(32, '0'), nome: `arquivo-${i}.epub`, pasta: `Autora ${String(i % 50).padStart(2, '0')}`, tipo: 'application/epub+zip',
        bytes: 1024 * 1024 + i, titulo: `Título número ${i} da coleção`, autor: i % 7 ? '' : `Outra pessoa ${i}`,
      }));
      biblioteca._mudar({ situacao: 'atualizada', lista, guardados: new Set(lista.filter((_, i) => i % 3 === 0).map((l) => l.id)) });
      const tela = document.getElementById('tela-biblioteca');
      // O tempo vai até a tela estar desenhada, e não só até o código terminar.
      const desenhada = () => new Promise((pronto) => requestAnimationFrame(() => setTimeout(pronto, 0)));
      let inicio = performance.now();
      biblioteca.tela.abrir();
      await desenhada();
      const abrir = performance.now() - inicio;
      const aoAbrir = [tela.querySelectorAll('.tb-livro').length, tela.querySelectorAll('.tb-grupo').length];
      const busca = tela.querySelector('.tb-busca');
      inicio = performance.now();
      busca.value = 'NÚMERO 49';
      busca.dispatchEvent(new Event('input', { bubbles: true }));
      await desenhada();
      const buscar = performance.now() - inicio;
      const aoBuscar = [...tela.querySelectorAll('.tb-titulo')].map((t) => t.textContent);
      inicio = performance.now();
      tela.querySelector('[data-ordem="titulo"]').click();
      busca.value = '';
      busca.dispatchEvent(new Event('input', { bubbles: true }));
      await desenhada();
      const ordenar = performance.now() - inicio;
      return { abrir, buscar, ordenar, aoAbrir, aoBuscar, conta: tela.querySelector('.tb-conta').textContent, aoOrdenar: tela.querySelectorAll('.tb-livro').length };
    });
    assert.deepEqual(tempos.aoAbrir, [500, 50]);
    // A busca acha o 49 no título e no nome da autora, que é a pasta: os livros de número com 49 e os da autora 49.
    const esperados = Array.from({ length: 500 }, (_, i) => i).filter((i) => String(i).includes('49') || i % 50 === 49).map((i) => `Título número ${i} da coleção`);
    assert.equal(esperados.length, 19);
    assert.deepEqual([...tempos.aoBuscar].sort(), [...esperados].sort());
    assert.equal(tempos.aoOrdenar, 500);
    assert.equal(tempos.conta, '500 livros');
    for (const passo of ['abrir', 'buscar', 'ordenar']) assert.ok(tempos[passo] < 1000, `${passo} levou ${Math.round(tempos[passo])} ms`);
    t.diagnostic(`com 500 livros: abrir ${Math.round(tempos.abrir)} ms, buscar ${Math.round(tempos.buscar)} ms, ordenar ${Math.round(tempos.ordenar)} ms`);

    // Na casca: nenhuma sombra, transição ou animação, e fundos cheios, na tela e em tudo dentro dela.
    await pagina.locator('#tela-biblioteca [data-acao="so-guardados"]').click();
    const estilos = await pagina.evaluate(() => {
      const tela = document.getElementById('tela-biblioteca');
      const problemas = [];
      const cheio = (cor) => /^rgb\(/.test(cor) || /^rgba\(.*, 1\)$/.test(cor) || cor === 'rgba(0, 0, 0, 0)';
      for (const elemento of [tela, ...tela.querySelectorAll('.tb-topo *, .tb-barra *, .tb-aviso, .tb-rolagem, .tb-lista, .tb-grupo, .tb-livro:nth-child(-n+4), .tb-livro:nth-child(-n+4) *')]) {
        const estilo = getComputedStyle(elemento);
        const quem = elemento.className || elemento.tagName;
        if (estilo.boxShadow !== 'none') problemas.push(`${quem}: sombra`);
        if (estilo.textShadow !== 'none') problemas.push(`${quem}: sombra no texto`);
        if (parseFloat(estilo.transitionDuration) || estilo.animationName !== 'none') problemas.push(`${quem}: animação`);
        if (estilo.opacity !== '1') problemas.push(`${quem}: opacidade`);
        if (!cheio(estilo.backgroundColor)) problemas.push(`${quem}: fundo ${estilo.backgroundColor}`);
        if (estilo.backdropFilter && estilo.backdropFilter !== 'none') problemas.push(`${quem}: desfoque`);
      }
      const fundo = getComputedStyle(tela).backgroundColor;
      const ligado = getComputedStyle(tela.querySelector('[data-acao="so-guardados"]'));
      const escuro = (cor) => cor.match(/\d+/g).slice(0, 3).reduce((soma, parte) => soma + Number(parte), 0) < 300;
      return { problemas, fundoCheio: /^rgb\(/.test(fundo), ligadoInvertido: escuro(ligado.backgroundColor) && !escuro(ligado.color), tocavel: tela.querySelector('.tb-livro').getBoundingClientRect().height };
    });
    assert.deepEqual(estilos.problemas, []);
    assert.equal(estilos.fundoCheio, true, 'a tela tem fundo cheio e cobre o quadro');
    assert.equal(estilos.ligadoInvertido, true, 'o botão ligado fica invertido, claro sobre escuro');
    assert.ok(estilos.tocavel >= 44, `cada linha tem altura para o dedo: ${estilos.tocavel}`);
    // No toque, abrir a tela não põe o foco no campo de busca, para o teclado não cobrir a lista.
    await pagina.keyboard.press('Escape');
    await pagina.evaluate(() => window.bibliotecaDaPrancheta.tela.abrir());
    assert.equal(await pagina.evaluate(() => document.activeElement.dataset.acao), 'fechar');
    assert.deepEqual(erros, []);
  } finally {
    await contexto.close();
  }
});
