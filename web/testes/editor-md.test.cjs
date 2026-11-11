// Editor de markdown dos cartões, do plano 009: a marcação formatada enquanto
// se escreve, o recuo com Tab, o desfazer próprio, o colar, as imagens dentro
// do cartão e a compatibilidade com os cartões guardados antes.
// Executar a partir da raiz do repositório: node --test web/testes/*.test.cjs

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { servirWeb } = require('./apoio/servidor.cjs');

let servidor;
let navegador;

before(async () => {
  servidor = await servirWeb();
  navegador = await chromium.launch();
});

after(async () => {
  await navegador?.close();
  await servidor?.fechar();
});

const esperar = (pagina, condicao, argumento, timeout = 8000) => pagina.waitForFunction(condicao, argumento, { timeout });

async function abrir() {
  const contexto = await navegador.newContext({ viewport: { width: 1200, height: 900 } });
  const externas = [];
  contexto.on('request', (pedido) => {
    const url = pedido.url();
    if (!url.startsWith(servidor.base) && !url.startsWith('blob:') && !url.startsWith('data:')) externas.push(url);
  });
  const pagina = await contexto.newPage();
  const erros = [];
  pagina.on('pageerror', (e) => erros.push(e.message));
  pagina.on('console', (m) => { if (m.type() === 'error') erros.push(`console: ${m.text()}`); });
  await pagina.goto(`${servidor.base}/app/index.html`);
  await esperar(pagina, () => window.__booted === true && navigator.serviceWorker.controller !== null);
  await esperar(pagina, () => document.getElementById('status').textContent === 'Salvo');
  return { contexto, pagina, erros, externas };
}

// Cria um cartão com os blocos dados e entra na edição dele.
function cartao(pagina, blocos = [{ h: '' }], editar = true) {
  return pagina.evaluate(({ blocos, editar }) => {
    const w = toWorld(600, 300);
    begin();
    const it = add({ type: 'card', x: Math.round(w.x - 240), y: Math.round(w.y - 200), w: 480, h: 0, blocks: blocos, c: 'none' });
    commit();
    if (editar) enterEdit(it.id);
    return it.id;
  }, { blocos, editar });
}

const blocos = (pagina, id) => pagina.evaluate((id) => { if (S.editing === id) persistEdit(); return S.items.get(id).blocks; }, id);
const digitar = (pagina, texto) => pagina.keyboard.type(texto, { delay: 2 });
const linhas = (pagina) => pagina.evaluate(() => [...document.querySelector('.editor[contenteditable=true]').children].map((l) => ({
  k: l.dataset.k, n: l.dataset.n || '', num: l.dataset.num || '', classe: l.className, html: l.innerHTML, texto: EditorMd.textoDe(l).replace(/\u00a0/g, ' '),
})));

// Põe o cursor na linha i do editor, no deslocamento o do texto.
const cursor = (pagina, i, o = 0) => pagina.evaluate(({ i, o }) => {
  const ed = document.querySelector('.editor[contenteditable=true]');
  const l = ed.children[i];
  const r = document.createRange();
  let n = o;
  const andar = (no) => {
    for (const c of no.childNodes) {
      if (c.nodeType === 3) { if (n <= c.data.length) { r.setStart(c, n); return true; } n -= c.data.length; } else if (c.nodeType === 1 && c.getAttribute('contenteditable') !== 'false' && andar(c)) return true;
    }
    return false;
  };
  if (!andar(l)) r.setStart(l, l.childNodes.length);
  r.collapse(true);
  getSelection().removeAllRanges();
  getSelection().addRange(r);
}, { i, o });

test('a marcação aparece formatada enquanto se escreve, com os marcadores só na linha do cursor, e o cartão guarda o markdown', async () => {
  const { contexto, pagina, erros } = await abrir();
  try {
    const id = await cartao(pagina);
    await digitar(pagina, 'Um **negrito**, *itálico*, _outro_, ~~riscado~~, `código`, ==marca== e [site](https://example.com).');
    await pagina.keyboard.press('Enter');
    await digitar(pagina, 'Segunda linha com ***os dois*** e \\*escape\\*.');
    let ls = await linhas(pagina);
    assert.match(ls[0].html, /<span class="mk">\*\*<\/span><strong>negrito<\/strong><span class="mk">\*\*<\/span>/);
    assert.match(ls[0].html, /<em>itálico<\/em>/);
    assert.match(ls[0].html, /<span class="mk">_<\/span><em>outro<\/em>/);
    assert.match(ls[0].html, /<del>riscado<\/del>/);
    assert.match(ls[0].html, /<code>código<\/code>/);
    assert.match(ls[0].html, /<mark class="c-yellow">marca<\/mark>/);
    assert.match(ls[0].html, /<span class="lk">site<\/span><span class="mk">\]\(https:\/\/example\.com\)<\/span>/);
    assert.match(ls[1].html, /<strong class="md-bi">os dois<\/strong>/);
    assert.match(ls[1].html, /<span class="mk">\\<\/span><span class="md-esc">\*<\/span>/);
    // O cursor está na segunda linha: só ela mostra os marcadores.
    assert.ok(ls[1].classe.includes('cur') && !ls[0].classe.includes('cur'));
    const fonte = await pagina.evaluate(() => getComputedStyle(document.querySelector('.editor[contenteditable=true]')).fontSize);
    const tamanhos = await pagina.evaluate(() => [...document.querySelectorAll('.editor[contenteditable=true] > .b')].map((l) => getComputedStyle(l.querySelector('.mk')).fontSize));
    assert.deepEqual(tamanhos, ['0px', fonte]);
    await cursor(pagina, 0, 3);
    await esperar(pagina, () => document.querySelector('.editor[contenteditable=true]').children[0].classList.contains('cur'));
    assert.equal(await pagina.evaluate(() => getComputedStyle(document.querySelector('.editor[contenteditable=true] .b .mk')).fontSize), fonte);
    // O texto, com os marcadores, é o que fica guardado.
    const b = await blocos(pagina, id);
    assert.equal(b[0].h, 'Um **negrito**, *itálico*, _outro_, ~~riscado~~, `código`, ==marca== e [site](https://example.com).');
    assert.equal(b[1].h, 'Segunda linha com ***os dois*** e \\*escape\\*.');
    // Fora da edição, a exibição mostra o mesmo, sem os marcadores.
    await pagina.evaluate(() => exitEdit());
    const exibido = await pagina.evaluate((id) => doms.get(id).querySelector('.editor').innerHTML, id);
    assert.match(exibido, /<strong>negrito<\/strong>/);
    assert.match(exibido, /<em>outro<\/em>/);
    assert.match(exibido, /<strong class="md-bi">os dois<\/strong>/);
    assert.match(exibido, /<span class="md-esc">\*<\/span>escape<span class="md-esc">\*<\/span>/);
    assert.doesNotMatch(exibido, /class="mk"/);
    // Sublinhado no meio de uma palavra não vira itálico.
    const nome = await cartao(pagina, [{ h: 'arquivo_de_teste, a_b_ c e __forte__' }], false);
    const h = await pagina.evaluate((id) => doms.get(id).querySelector('.editor').innerHTML, nome);
    assert.match(h, /arquivo_de_teste, a_b_ c e <strong>forte<\/strong>/);
    assert.deepEqual(erros, []);
  } finally {
    await contexto.close();
  }
});

test('Tab e Shift+Tab mudam o recuo das linhas, e as listas numeradas contam por nível', async () => {
  const { contexto, pagina, erros } = await abrir();
  try {
    const id = await cartao(pagina);
    await digitar(pagina, '- um');
    await pagina.keyboard.press('Enter');
    await pagina.keyboard.press('Tab');
    await digitar(pagina, 'dois');
    await pagina.keyboard.press('Enter');
    await pagina.keyboard.press('Tab');
    await digitar(pagina, 'três');
    await pagina.keyboard.press('Enter');
    // Enter numa linha de lista vazia e recuada diminui o recuo.
    await pagina.keyboard.press('Enter');
    let ls = await linhas(pagina);
    assert.deepEqual(ls.map((l) => [l.k, l.n]), [['li', ''], ['li', '1'], ['li', '2'], ['li', '1']]);
    // Backspace no início de uma linha recuada também diminui o recuo; Enter
    // na linha vazia sem recuo a transforma em parágrafo, como antes.
    await pagina.keyboard.press('Backspace');
    ls = await linhas(pagina);
    assert.deepEqual(ls.at(-1).n, '');
    await pagina.keyboard.press('Enter');
    await digitar(pagina, '1. a');
    await pagina.keyboard.press('Enter');
    await pagina.keyboard.press('Tab');
    await digitar(pagina, 'b');
    await pagina.keyboard.press('Enter');
    await digitar(pagina, 'c');
    await pagina.keyboard.press('Enter');
    await pagina.keyboard.press('Shift+Tab');
    await digitar(pagina, 'd');
    ls = await linhas(pagina);
    const ol = ls.filter((l) => l.k === 'ol');
    assert.deepEqual(ol.map((l) => [l.texto, l.n, l.num]), [['a', '', '1'], ['b', '1', 'i'], ['c', '1', 'ii'], ['d', '', '2']]);
    // Um parágrafo também recua, e o recuo é guardado.
    await pagina.keyboard.press('Enter');
    await pagina.keyboard.press('Enter');
    await digitar(pagina, 'parágrafo');
    await pagina.keyboard.press('Tab');
    await pagina.keyboard.press('Tab');
    await pagina.keyboard.press('Shift+Tab');
    const b = await blocos(pagina, id);
    assert.deepEqual(b.map((x) => [x.k || 'p', x.n || 0, x.h]), [
      ['li', 0, 'um'], ['li', 1, 'dois'], ['li', 2, 'três'],
      ['ol', 0, 'a'], ['ol', 1, 'b'], ['ol', 1, 'c'], ['ol', 0, 'd'], ['p', 1, 'parágrafo'],
    ]);
    // Na exibição, cada nível fica 2em, 32px, mais à direita, com o número dele.
    await pagina.evaluate(() => exitEdit());
    const exib = await pagina.evaluate((id) => [...doms.get(id).querySelectorAll('.editor > .b')].map((l) => [l.dataset.n || '', l.dataset.num || '', getComputedStyle(l).marginLeft, getComputedStyle(l, '::before').content]), id);
    assert.deepEqual(exib[1].slice(0, 3), ['1', '', '32px']);
    assert.deepEqual(exib[2].slice(0, 3), ['2', '', '64px']);
    assert.deepEqual(exib[4], ['1', 'i', '32px', '"i."']);
    assert.deepEqual(exib[6], ['', '2', '0px', '"2."']);
    // Mais de seis níveis não passa de seis.
    await pagina.evaluate((id) => enterEdit(id), id);
    await cursor(pagina, 2, 0);
    for (let i = 0; i < 8; i++) await pagina.keyboard.press('Tab');
    assert.equal((await linhas(pagina))[2].n, '6');
    assert.deepEqual(erros, []);
  } finally {
    await contexto.close();
  }
});

test('blocos de código, tabelas, réguas e alertas aparecem formatados na edição, e Tab no código põe dois espaços', async () => {
  const { contexto, pagina, erros } = await abrir();
  try {
    const id = await cartao(pagina);
    const E = () => pagina.keyboard.press('Enter');
    await digitar(pagina, '```'); await E();
    await digitar(pagina, 'se (x) {'); await E();
    await pagina.keyboard.press('Tab');
    await digitar(pagina, '**não** decora'); await E();
    await pagina.keyboard.press('Tab');
    await pagina.keyboard.press('Shift+Tab');
    await digitar(pagina, '}'); await E();
    await digitar(pagina, '```'); await E();
    await digitar(pagina, '| Nome | Valor |'); await E();
    await digitar(pagina, '|---|---:|'); await E();
    await digitar(pagina, '| primeiro | 1 |'); await E();
    await digitar(pagina, '| um nome bem mais comprido | 200 |'); await E();
    await digitar(pagina, '---'); await E();
    await digitar(pagina, '> [!WARNING]'); await E();
    await digitar(pagina, 'cuidado'); await E(); await E();
    await digitar(pagina, 'fim');
    const ls = await linhas(pagina);
    const classes = ls.map((l) => l.classe.replace(/ cur(-g)?/g, ''));
    assert.deepEqual(classes.slice(0, 5), ['b md-fence ini', 'b md-code', 'b md-code', 'b md-code', 'b md-fence fim']);
    assert.equal(ls[2].texto, '  **não** decora');
    assert.equal(ls[2].html, '  **não** decora');
    assert.equal(ls[3].texto, '}');
    assert.deepEqual(classes.slice(5, 9), ['b md-tr md-th', 'b md-tsep', 'b md-tr', 'b md-tr']);
    assert.equal(classes[9], 'b md-hr');
    assert.equal(classes[10], 'b md-at a-warning');
    assert.equal(classes[11], 'b md-ab a-warning');
    // As colunas da tabela ficam alinhadas, e a separadora some fora dela.
    const geo = await pagina.evaluate(() => {
      const rows = [...document.querySelectorAll('.editor[contenteditable=true] .md-tr')];
      return {
        x: rows.map((r) => [...r.querySelectorAll('.md-td')].map((t) => Math.round(t.getBoundingClientRect().left))),
        sep: getComputedStyle(document.querySelector('.editor[contenteditable=true] .md-tsep')).display,
        alin: getComputedStyle(rows[1].querySelectorAll('.md-td')[1]).textAlign,
        regua: document.querySelector('.editor[contenteditable=true] .md-hr').getBoundingClientRect().height,
        alerta: getComputedStyle(document.querySelector('.editor[contenteditable=true] .md-at'), '::after').content,
      };
    });
    assert.ok(geo.x.every((r) => r[1] === geo.x[0][1]), JSON.stringify(geo.x));
    assert.ok(geo.x[0][1] > geo.x[0][0] + 150, JSON.stringify(geo.x));
    assert.equal(geo.sep, 'none');
    assert.equal(geo.alin, 'right');
    assert.equal(geo.regua, 4);
    assert.equal(geo.alerta, '"Aviso"');
    // Com o cursor na tabela, ela mostra o texto dela, com as barras.
    await cursor(pagina, 7, 2);
    await esperar(pagina, () => document.querySelector('.editor[contenteditable=true] .md-tsep').classList.contains('cur-g'));
    assert.notEqual(await pagina.evaluate(() => getComputedStyle(document.querySelector('.editor[contenteditable=true] .md-tsep')).display), 'none');
    const b = await blocos(pagina, id);
    assert.equal(b[2].h, '  **não** decora');
    assert.equal(b[8].h, '| um nome bem mais comprido | 200 |');
    assert.deepEqual(erros, []);
  } finally {
    await contexto.close();
  }
});

test('desfazer e refazer próprios, os atalhos e os botões de formatação', async () => {
  const { contexto, pagina, erros } = await abrir();
  try {
    const id = await cartao(pagina);
    await digitar(pagina, 'texto inicial');
    await pagina.waitForTimeout(1100);
    await digitar(pagina, ' e mais');
    await pagina.keyboard.press('Control+z');
    assert.equal((await linhas(pagina))[0].texto, 'texto inicial');
    await pagina.keyboard.press('Control+Shift+z');
    assert.equal((await linhas(pagina))[0].texto, 'texto inicial e mais');
    // Ctrl+B envolve a seleção e, de novo, desfaz o negrito.
    await pagina.keyboard.press('Shift+ArrowLeft');
    await pagina.keyboard.press('Shift+ArrowLeft');
    await pagina.keyboard.press('Shift+ArrowLeft');
    await pagina.keyboard.press('Shift+ArrowLeft');
    await pagina.keyboard.press('Control+b');
    assert.equal((await linhas(pagina))[0].texto, 'texto inicial e **mais**');
    assert.equal(await pagina.evaluate(() => getSelection().toString()), 'mais');
    await pagina.keyboard.press('Control+b');
    assert.equal((await linhas(pagina))[0].texto, 'texto inicial e mais');
    await pagina.keyboard.press('Control+i');
    await pagina.keyboard.press('Control+e');
    assert.equal((await linhas(pagina))[0].texto, 'texto inicial e *`mais`*');
    await pagina.keyboard.press('Control+z');
    await pagina.keyboard.press('Control+z');
    assert.equal((await linhas(pagina))[0].texto, 'texto inicial e mais');
    // Ctrl+K faz um link e deixa o endereço selecionado para trocar.
    await pagina.keyboard.press('Control+k');
    assert.equal((await linhas(pagina))[0].texto, 'texto inicial e [mais](url)');
    assert.equal(await pagina.evaluate(() => getSelection().toString()), 'url');
    await digitar(pagina, 'https://exemplo.org');
    assert.equal((await linhas(pagina))[0].texto, 'texto inicial e [mais](https://exemplo.org)');
    // Os botões da barra, sem teclado.
    await cursor(pagina, 0, 0);
    await pagina.evaluate(() => { const l = document.querySelector('.editor[contenteditable=true] .b'); const t = l.firstChild; const r = document.createRange(); r.setStart(t, 0); r.setEnd(t, 5); getSelection().removeAllRanges(); getSelection().addRange(r); });
    await pagina.click('#selbar [data-cmd=strikeThrough]');
    await pagina.click('#selbar [data-cmd=code]');
    assert.equal((await linhas(pagina))[0].texto, '~~`texto`~~ inicial e [mais](https://exemplo.org)');
    await pagina.click('#selbar [data-cmd=indent]');
    assert.equal((await linhas(pagina))[0].n, '1');
    await pagina.click('#selbar [data-cmd=outdent]');
    assert.equal((await linhas(pagina))[0].n, '');
    // Mudar o tipo pela barra entra no desfazer.
    await pagina.click('#selbar [data-kind=h1]');
    assert.equal((await linhas(pagina))[0].k, 'h1');
    await pagina.keyboard.press('Control+z');
    assert.equal((await linhas(pagina))[0].k, 'p');
    // O desfazer do quadro, fora da edição, continua desfazendo o cartão inteiro.
    await pagina.evaluate(() => exitEdit());
    assert.equal((await blocos(pagina, id))[0].h, '~~`texto`~~ inicial e [mais](https://exemplo.org)');
    assert.deepEqual(erros, []);
  } finally {
    await contexto.close();
  }
});

test('colar várias linhas cria as linhas certas, e colar um endereço sobre um texto faz um link', async () => {
  const { contexto, pagina, erros } = await abrir();
  try {
    const id = await cartao(pagina);
    await digitar(pagina, 'antes  depois');
    await cursor(pagina, 0, 6);
    const colar = (texto) => pagina.evaluate((texto) => {
      const dt = new DataTransfer();
      dt.setData('text/plain', texto);
      const s = getSelection();
      const alvo = s.anchorNode.nodeType === 3 ? s.anchorNode.parentNode : s.anchorNode;
      alvo.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    }, texto);
    await colar('A\n# Título\n- item\n  - dentro\n1. um\n- [x] feito\n```\n  código **cru**\n```\nB');
    const b = await blocos(pagina, id);
    assert.deepEqual(b.map((x) => [x.k || 'p', x.n || 0, x.d || 0, x.h]), [
      ['p', 0, 0, 'antes A'], ['h1', 0, 0, 'Título'], ['li', 0, 0, 'item'], ['li', 1, 0, 'dentro'], ['ol', 0, 0, 'um'],
      ['todo', 0, 1, 'feito'], ['p', 0, 0, '```'], ['p', 0, 0, '  código **cru**'], ['p', 0, 0, '```'], ['p', 0, 0, 'B depois'],
    ]);
    // O cursor fica no fim do texto colado.
    assert.equal(await pagina.evaluate(() => { const s = getSelection(); return s.anchorNode.textContent.slice(0, s.anchorOffset); }), 'B');
    // Um endereço colado sobre a seleção vira link.
    await pagina.evaluate(() => { const l = document.querySelector('.editor[contenteditable=true] .b'); const t = l.firstChild; const r = document.createRange(); r.setStart(t, 0); r.setEnd(t, 5); getSelection().removeAllRanges(); getSelection().addRange(r); });
    await colar('https://exemplo.org/a');
    assert.equal((await linhas(pagina))[0].texto, '[antes](https://exemplo.org/a) A');
    // O desfazer volta antes do que foi colado.
    await pagina.keyboard.press('Control+z');
    assert.equal((await linhas(pagina))[0].texto, 'antes A');
    await pagina.keyboard.press('Control+z');
    assert.deepEqual((await linhas(pagina)).map((l) => l.texto), ['antes  depois']);
    // Tópico seguido de "[ ] " vira tarefa, como "- [ ] " no GitHub, e "+ " também começa um tópico.
    await pagina.keyboard.press('Control+a');
    await digitar(pagina, 'x');
    await pagina.keyboard.press('Enter');
    await digitar(pagina, '- [ ] tarefa');
    await pagina.keyboard.press('Enter');
    await pagina.keyboard.press('Enter');
    await digitar(pagina, '+ tópico');
    const ls = await linhas(pagina);
    assert.deepEqual(ls.slice(1).map((l) => [l.k, l.texto]), [['todo', 'tarefa'], ['li', 'tópico']]);
    assert.deepEqual(erros, []);
  } finally {
    await contexto.close();
  }
});

test('imagens dentro do cartão: coladas, soltas e pelo botão, guardadas no aparelho, mostradas e exportadas', async () => {
  const { contexto, pagina, erros, externas } = await abrir();
  try {
    const id = await cartao(pagina);
    await digitar(pagina, 'Antes da imagem');
    const arquivo = (nome, cor) => pagina.evaluateHandle(async ({ nome, cor }) => {
      const c = document.createElement('canvas');
      c.width = 400; c.height = 200;
      const g = c.getContext('2d');
      g.fillStyle = cor; g.fillRect(0, 0, 400, 200);
      const blob = await new Promise((ok) => c.toBlob(ok, 'image/png'));
      return new File([blob], nome, { type: 'image/png' });
    }, { nome, cor });
    // Colada: pelo tratador de colar do quadro, que a leva para o cartão.
    const f1 = await arquivo('foto [1].png', '#ff0000');
    await pagina.evaluate((f) => {
      const dt = new DataTransfer();
      dt.items.add(f);
      document.querySelector('.editor[contenteditable=true] .b').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    }, f1);
    await esperar(pagina, () => document.querySelectorAll('.editor[contenteditable=true] .b').length === 2);
    let ls = await linhas(pagina);
    assert.match(ls[1].texto, /^!\[foto 1\]\(\/_blob\/[\w-]{8,64}\)$/);
    assert.equal(await pagina.evaluate(() => S.editing !== null && [...S.items.values()].filter((i) => i.type === 'image').length), 0);
    await esperar(pagina, () => { const i = document.querySelector('.editor[contenteditable=true] .md-imgw img'); return i && i.complete && i.naturalWidth === 400; });
    // Fora da linha do cursor, só a imagem aparece.
    await cursor(pagina, 0, 2);
    await esperar(pagina, () => getComputedStyle(document.querySelector('.editor[contenteditable=true] .md-fonte')).display === 'none');
    // Pelo botão, depois da linha do cursor.
    const [escolha] = await Promise.all([pagina.waitForEvent('filechooser'), pagina.click('#selbar [data-cmd=image]')]);
    const png = Buffer.from(await pagina.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 100; c.height = 50; c.getContext('2d').fillRect(0, 0, 100, 50);
      const b = await new Promise((ok) => c.toBlob(ok, 'image/png'));
      return [...new Uint8Array(await b.arrayBuffer())];
    }));
    await escolha.setFiles({ name: 'botao.png', mimeType: 'image/png', buffer: png });
    await esperar(pagina, () => document.querySelectorAll('.editor[contenteditable=true] .b').length === 3);
    ls = await linhas(pagina);
    assert.match(ls[1].texto, /^!\[botao\]\(\/_blob\//);
    assert.match(ls[2].texto, /^!\[foto 1\]\(/);
    // Solta sobre o cartão em edição.
    const f3 = await arquivo('solta.png', '#00ff00');
    await pagina.evaluate((f) => {
      const dt = new DataTransfer();
      dt.items.add(f);
      const alvo = document.querySelector('.editor[contenteditable=true] .b');
      const r = alvo.getBoundingClientRect();
      alvo.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true, clientX: r.left + 5, clientY: r.top + 5 }));
    }, f3);
    await esperar(pagina, () => document.querySelectorAll('.editor[contenteditable=true] .b').length === 4);
    assert.equal(await pagina.evaluate(() => [...S.items.values()].filter((i) => i.type === 'image').length), 0);
    // Uma imagem de fora fica como link, sem requisição externa, e uma largura pode ser dada.
    await cursor(pagina, 0, 15);
    await pagina.keyboard.press('Enter');
    await digitar(pagina, '![de fora](https://exemplo.invalid/x.png)');
    const id2 = (await linhas(pagina))[2].texto.match(/\/_blob\/([\w-]+)/)[1];
    await pagina.keyboard.press('Enter');
    await digitar(pagina, `![menor|120](/_blob/${id2})`);
    await pagina.evaluate(() => exitEdit());
    const exib = await pagina.evaluate((id) => {
      const ed = doms.get(id).querySelector('.editor');
      return { imgs: [...ed.querySelectorAll('img.md-img')].map((i) => [i.getAttribute('src').slice(0, 7), i.alt, i.getAttribute('width')]), links: [...ed.querySelectorAll('a.lk')].map((a) => a.textContent) };
    }, id);
    assert.deepEqual(exib.imgs.map((x) => x[1]), ['menor', 'solta', 'botao', 'foto 1']);
    assert.ok(exib.imgs.every((x) => x[0] === '/_blob/'));
    assert.equal(exib.imgs[0][2], '120');
    assert.deepEqual(exib.links, ['de fora']);
    await esperar(pagina, (id) => [...doms.get(id).querySelectorAll('img.md-img')].every((i) => i.complete && i.naturalWidth > 0), id);
    // A exportação em PNG desenha a imagem do cartão.
    const cor = await pagina.evaluate((id) => {
      const im = doms.get(id).querySelector('img[alt="foto 1"]');
      const it = S.items.get(id);
      const r = rectOf(it);
      const cv = renderCanvas(r.x, r.y, r.w, r.h, 1, false);
      const q = im.getBoundingClientRect();
      const c = toWorld(q.left + q.width / 2, q.top + q.height / 2);
      return [...cv.getContext('2d').getImageData(Math.round(c.x - r.x), Math.round(c.y - r.y), 1, 1).data];
    }, id);
    assert.ok(cor[0] > 200 && cor[1] < 60 && cor[2] < 60, String(cor));
    assert.deepEqual(externas, []);
    // A linha fica no banco, com o arquivo guardado no aparelho.
    const b = await blocos(pagina, id);
    assert.equal(b.filter((x) => /^!\[/.test(x.h)).length, 5);
    assert.deepEqual(erros, []);
  } finally {
    await contexto.close();
  }
});

test('cartões guardados antes continuam iguais, e o negrito em HTML vira marcação ao editar', async () => {
  const { contexto, pagina, erros } = await abrir();
  try {
    const antigos = [
      { h: 'Um <b>negrito</b>, <i>itálico</i>, <s>riscado</s> e <code>código</code><br>com quebra' },
      { k: 'h2', h: 'Título' },
      { k: 'ol', h: 'um' },
      { k: 'ol', h: 'dois' },
      { h: 'meio' },
      { k: 'ol', h: 'de novo' },
      { k: 'todo', d: 1, h: 'feita' },
      { k: 'quote', h: 'citação com [[Quadro]]' },
    ];
    const id = await cartao(pagina, antigos, false);
    const exib = await pagina.evaluate((id) => [...doms.get(id).querySelectorAll('.editor > .b')].map((l) => [l.dataset.k, l.dataset.num || '', l.innerHTML]), id);
    assert.equal(exib[0][2], 'Um <b>negrito</b>, <i>itálico</i>, <s>riscado</s> e <code>código</code><br>com quebra');
    assert.deepEqual(exib.filter((l) => l[0] === 'ol').map((l) => l[1]), ['1', '2', '1']);
    await pagina.evaluate((id) => enterEdit(id), id);
    const ls = await linhas(pagina);
    assert.equal(ls[0].texto, 'Um **negrito**, *itálico*, ~~riscado~~ e `código`\ncom quebra');
    assert.match(ls[0].html, /<br>com quebra$/);
    // Sem mudar nada, só o HTML vira marcação; o resto fica igual.
    const b = await blocos(pagina, id);
    assert.deepEqual(b, [{ h: 'Um **negrito**, *itálico*, ~~riscado~~ e `código`<br>com quebra' }, ...antigos.slice(1)]);
    await pagina.evaluate(() => exitEdit());
    const depois = await pagina.evaluate((id) => doms.get(id).querySelector('.editor > .b').innerHTML, id);
    assert.equal(depois, 'Um <strong>negrito</strong>, <em>itálico</em>, <del>riscado</del> e <code>código</code><br>com quebra');
    // Shift+Enter quebra a linha dentro do mesmo bloco.
    await pagina.evaluate((id) => enterEdit(id), id);
    await cursor(pagina, 1, 6);
    await pagina.keyboard.press('Shift+Enter');
    await digitar(pagina, 'x');
    assert.equal((await blocos(pagina, id))[1].h, 'Título<br>x');
    assert.deepEqual(erros, []);
  } finally {
    await contexto.close();
  }
});

test('durante a composição do teclado, as linhas não são redesenhadas', async () => {
  const { contexto, pagina, erros } = await abrir();
  try {
    await cartao(pagina);
    await digitar(pagina, 'a ');
    const ed = '.editor[contenteditable=true]';
    await pagina.evaluate((ed) => document.querySelector(ed).dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })), ed);
    await pagina.evaluate(() => document.execCommand('insertText', false, '**b**'));
    assert.doesNotMatch((await linhas(pagina))[0].html, /strong/);
    await pagina.evaluate((ed) => document.querySelector(ed).dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })), ed);
    await esperar(pagina, () => /<strong>b<\/strong>/.test(document.querySelector('.editor[contenteditable=true] .b').innerHTML));
    // O cursor continua no fim do texto.
    await digitar(pagina, 'c');
    assert.equal((await linhas(pagina))[0].texto, 'a **b**c');
    assert.deepEqual(erros, []);
  } finally {
    await contexto.close();
  }
});

test('texto colado no quadro guarda o recuo das listas', async () => {
  const { contexto, pagina } = await abrir();
  try {
    const b = await pagina.evaluate(() => blocksFromText('- a\n  - b\n\t\t- c\n+ d\n   1) e\n\n\n```\n  - cru\n```'));
    assert.deepEqual(b, [
      { h: 'a', k: 'li' }, { h: 'b', k: 'li', n: 1 }, { h: 'c', k: 'li', n: 2 }, { h: 'd', k: 'li' }, { h: 'e', k: 'ol', n: 1 },
      { h: '' }, { h: '```' }, { h: '  - cru' }, { h: '```' },
    ]);
  } finally {
    await contexto.close();
  }
});
