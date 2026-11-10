// Progresso do KOReader no leitor, etapa 02 do plano 007: ao abrir um livro, a
// Prancheta pede ao servidor o último progresso gravado pelo KOReader e, se
// ele é mais novo que a leitura neste aparelho e está em outro lugar, oferece
// ir até lá, sem pular sozinha. A página e o servidor ficam num só endereço,
// como na VPS, e o KOReader é simulado por pedidos no protocolo dele.
// Executar a partir da raiz do repositório: node --test web/testes/*.test.cjs

'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { chromium } = require('playwright');
const { Armazem } = require('../../servidor/armazem.cjs');
const { criarServidor } = require('../../servidor/servidor.cjs');
const { criarServidorDaPagina } = require('../../servidor/pagina.cjs');
const { Biblioteca } = require('../../servidor/biblioteca.cjs');
const { Kosync } = require('../../servidor/kosync.cjs');
const { criarEpub, criarPdf } = require('./apoio/livros.cjs');

require('../app/compat/leitor.js');
const { lerCaminhoDoKoreader, quandoFoi } = globalThis.LeitorPrancheta;

const CHAVE = 'chave-de-teste-do-progresso-0123456789abcdef';
const USUARIO = 'leitor';
const SENHA = 'senha-de-teste-do-kosync';
const TELA = { width: 1200, height: 800 };
const APP = path.join(__dirname, '..', 'app');
const UM_DIA = 24 * 60 * 60 * 1000;
const md5 = (texto) => crypto.createHash('md5').update(texto).digest('hex');

let navegador;
before(async () => { navegador = await chromium.launch(); });
after(async () => { await navegador?.close(); });

// Sobe a página e o servidor num só endereço, com a biblioteca e o KOSync; o
// relógio do KOSync é o dos testes, para gravar progressos mais novos ou mais
// antigos que a leitura na Prancheta.
async function subirComoNaVps({ semKosync = false } = {}) {
  const livros = fs.mkdtempSync(path.join(os.tmpdir(), 'prancheta-progresso-'));
  fs.writeFileSync(path.join(livros, 'Livro longo.epub'), await criarEpub({ titulo: 'Livro longo', rico: true, longo: true }));
  fs.writeFileSync(path.join(livros, 'Tres paginas.pdf'), criarPdf(['Primeira pagina do PDF', 'Segunda pagina do PDF', 'Terceira pagina do PDF']));
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'prancheta-vps-'));
  const armazem = await Armazem.abrir(pasta);
  const relogio = { agora: Date.now() };
  const kosync = semKosync ? null : new Kosync({ pasta, credencial: { usuario: USUARIO, senha: SENHA }, agora: () => relogio.agora });
  const biblioteca = new Biblioteca(livros);
  const sincronia = criarServidor({ armazem, chave: CHAVE, biblioteca, kosync }).listeners('request')[0];
  const pagina = criarServidorDaPagina({ pasta: APP }).listeners('request')[0];
  const borda = http.createServer((req, res) => (req.url.startsWith('/sync/') ? sincronia : pagina)(req, res));
  await new Promise((pronto) => borda.listen(0, '127.0.0.1', pronto));
  const base = `http://127.0.0.1:${borda.address().port}`;
  const ids = Object.fromEntries((await biblioteca.listar()).map((l) => [l.nome, l.id]));
  return {
    base, relogio, ids,
    // Grava um progresso como o KOReader faz, no horário dado em relação a agora.
    async koreader(nome, progress, percentage, { daqui = UM_DIA, device = 'boox' } = {}) {
      relogio.agora = Date.now() + daqui;
      const r = await fetch(`${base}/sync/kosync/syncs/progress`, {
        method: 'PUT',
        headers: { 'x-auth-user': USUARIO, 'x-auth-key': md5(SENHA), 'Content-Type': 'application/json' },
        body: JSON.stringify({ document: ids[nome], progress, percentage, device, device_id: 'A1B2' }),
      });
      assert.equal(r.status, 200);
    },
    fechar: () => new Promise((pronto) => { borda.close(() => pronto()); borda.closeAllConnections(); }),
  };
}

async function abrirPrancheta(vps) {
  const contexto = await navegador.newContext({ viewport: TELA });
  const pagina = await contexto.newPage();
  const erros = [];
  const pedidos = [];
  pagina.on('pageerror', (e) => erros.push(e.message));
  pagina.on('request', (pedido) => { if (/\/sync\/progresso\//.test(pedido.url())) pedidos.push(pedido.url()); });
  await pagina.goto(`${vps.base}/`);
  await pagina.waitForFunction(() => window.__booted === true && navigator.serviceWorker.controller !== null, null, { timeout: 10000 });
  await pagina.waitForFunction(() => Boolean(window.marcacoesDaPrancheta && document.getElementById('leitor')), null, { timeout: 10000 });
  await pagina.evaluate(([endereco, chave]) => window.sincronizacaoDaPrancheta.configurar({ endereco, chave }), [vps.base, CHAVE]);
  await pagina.waitForFunction(() => window.bibliotecaDaPrancheta.estado.lista.length === 2, null, { timeout: 10000 });
  // Conta as conferências do progresso que terminaram.
  await pagina.evaluate(() => {
    window.__conferencias = 0;
    const leitor = window.leitorDaPrancheta;
    const original = leitor._conferirProgressoRemoto.bind(leitor);
    leitor._conferirProgressoRemoto = async (...argumentos) => {
      try {
        return await original(...argumentos);
      } finally {
        window.__conferencias += 1;
      }
    };
  });
  return { contexto, pagina, erros, pedidos };
}

// Abre o livro como o toque nele faz e espera a conferência do progresso
// terminar, para os casos em que o aviso não deve aparecer.
async function abrirLivro(p, vps, nome, posicao) {
  const antes = await p.pagina.evaluate(() => window.__conferencias);
  await p.pagina.evaluate(async ([id, onde]) => {
    await window.bibliotecaDaPrancheta.guardar(id);
    await window.leitorDaPrancheta.abrir(id, onde || undefined);
  }, [vps.ids[nome], posicao || null]);
  if (!posicao) await p.pagina.waitForFunction((n) => window.__conferencias > n, antes, { timeout: 10000 });
}

const aviso = (pagina) => pagina.evaluate(() => {
  const barra = document.querySelector('#leitor .lt-remoto');
  return barra.hidden ? null : barra.querySelector('.lt-remoto-texto').textContent;
});
const textoDoEpub = (pagina) => pagina.evaluate(() => document.querySelector('#leitor iframe')?.contentDocument?.body?.innerText || '');
const noCapitulo = (pagina, expressao) => pagina.waitForFunction(
  (fonte) => new RegExp(fonte).test(document.querySelector('#leitor iframe')?.contentDocument?.body?.innerText || ''), expressao.source, { timeout: 15000 },
);
// Diz se um elemento do capítulo aberto está na página à vista.
const aVista = (pagina, id) => pagina.evaluate((alvo) => {
  const quadro = document.querySelector('#leitor iframe');
  const elemento = quadro.contentDocument.getElementById(alvo);
  if (!elemento) return false;
  const area = document.querySelector('#leitor .lt-conteudo').getBoundingClientRect();
  const r = elemento.getBoundingClientRect();
  const esquerda = quadro.getBoundingClientRect().left + r.left;
  return esquerda >= area.left - 1 && esquerda < area.right;
}, id);
const dois = (n) => String(n).padStart(2, '0');

test('a posição do KOReader num EPUB é lida até o parágrafo, e o horário do aviso diz se foi hoje', () => {
  assert.deepEqual(lerCaminhoDoKoreader('/body/DocFragment[3]/body/div/p[12]/text().34'), { fragmento: 3, passos: [{ nome: 'div', indice: 1 }, { nome: 'p', indice: 12 }] });
  // Sem número, vale o primeiro; o nó de texto e o deslocamento ficam de fora.
  assert.deepEqual(lerCaminhoDoKoreader('/body/DocFragment/body/P/text()[2].5'), { fragmento: 1, passos: [{ nome: 'p', indice: 1 }] });
  assert.deepEqual(lerCaminhoDoKoreader('/body/DocFragment[20]/body/p[22]/img.0'), { fragmento: 20, passos: [{ nome: 'p', indice: 22 }, { nome: 'img', indice: 1 }] });
  assert.deepEqual(lerCaminhoDoKoreader(' /body/DocFragment[2]/body '), { fragmento: 2, passos: [] });
  for (const estranho of ['42', '', null, 'xyz', '/body/DocFragment[0]/body', '/body/DocFragment[2]/body/p[x]', '/body/DocFragment[2]/corpo/p', '/body/DocFragment[-1]/body', '/body/DocFragment[2]/body/<p>']) {
    assert.equal(lerCaminhoDoKoreader(estranho), null, String(estranho));
  }
  const agora = new Date(2026, 10, 10, 15, 0).getTime();
  assert.equal(quandoFoi(new Date(2026, 10, 10, 9, 5).getTime(), agora), 'hoje às 09:05');
  assert.equal(quandoFoi(new Date(2026, 10, 9, 22, 40).getTime(), agora), 'em 09/11 às 22:40');
});

test('num EPUB, o leitor avisa do progresso mais novo do KOReader e só vai até o parágrafo com o toque no botão', async () => {
  const vps = await subirComoNaVps();
  const p = await abrirPrancheta(vps);
  const { pagina } = p;
  try {
    // O KOReader parou no parágrafo 40 do terceiro capítulo; este aparelho nunca abriu o livro.
    await vps.koreader('Livro longo.epub', '/body/DocFragment[3]/body/p[40]/text().12', 0.6249);
    await abrirLivro(p, vps, 'Livro longo.epub');
    await pagina.locator('#leitor .lt-remoto').waitFor();
    const amanha = new Date(vps.relogio.agora);
    assert.equal(await aviso(pagina), `No KOReader, em boox, você parou em 62%, em ${dois(amanha.getDate())}/${dois(amanha.getMonth() + 1)} às ${dois(amanha.getHours())}:${dois(amanha.getMinutes())}.`);
    // Os dois botões do aviso têm ícone e rótulo, como os outros do leitor.
    assert.deepEqual(await pagina.evaluate(() => [...document.querySelectorAll('#leitor .lt-remoto button')].map((b) => [b.getAttribute('aria-label'), b.textContent, b.querySelectorAll('svg.i').length])),
      [['Ir para onde o KOReader parou', '', 1], ['Ficar onde estou', '', 1]]);
    // Sem o toque, o livro continua onde abriu.
    await pagina.waitForTimeout(600);
    assert.match(await textoDoEpub(pagina), /primeiro capítulo/);
    // O aviso fica por cima do rodapé da página: a área do livro não encolhe, e a página não é cortada nem refeita.
    const alturas = await pagina.evaluate(() => {
      const altura = (seletor) => Math.round(document.querySelector(seletor).getBoundingClientRect().height);
      const leitor = document.getElementById('leitor').getBoundingClientRect();
      const barra = document.querySelector('#leitor .lt-remoto').getBoundingClientRect();
      return { livro: altura('#leitor .lt-conteudo'), quadro: altura('#leitor iframe'), barraNoRodape: Math.round(leitor.bottom - barra.bottom), barra: Math.round(barra.height) };
    });
    assert.equal(alturas.livro, alturas.quadro, `a área do livro tem a altura da página: ${JSON.stringify(alturas)}`);
    assert.ok(alturas.barraNoRodape === 0 && alturas.barra > 30, `o aviso fica no rodapé do leitor: ${JSON.stringify(alturas)}`);

    // O botão leva ao parágrafo gravado, e o aviso sai.
    assert.match(await pagina.evaluate(() => window.leitorDaPrancheta.remoto.alvo), /\[l40\]\)$/, 'o alvo é o parágrafo 40, e não um vizinho');
    await pagina.click('#leitor [data-acao="remoto-ir"]');
    await noCapitulo(pagina, /Parágrafo 40 do capítulo longo/);
    await pagina.waitForFunction(() => document.querySelector('#leitor .lt-remoto').hidden);
    assert.equal(await aVista(pagina, 'l40'), true, 'o parágrafo 40 está na página à vista');
    assert.equal(await aVista(pagina, 'l1'), false);
    assert.equal(await pagina.evaluate(() => Math.round(document.querySelector('#leitor .lt-conteudo').getBoundingClientRect().height)), alturas.livro, 'sem o aviso, a área do livro tem a mesma altura');
    // Um aviso de texto também fica por cima do rodapé, e sai sozinho em alguns segundos.
    await pagina.evaluate(() => window.leitorDaPrancheta.aviso('Aviso de teste.'));
    assert.equal(await pagina.evaluate(() => Math.round(document.querySelector('#leitor .lt-conteudo').getBoundingClientRect().height)), alturas.livro);
    assert.equal(await pagina.isVisible('#leitor .lt-aviso'), true);
    await pagina.waitForFunction(() => document.querySelector('#leitor .lt-aviso').textContent === '', null, { timeout: 8000 });

    // Reaberto, o livro volta a este lugar, e o mesmo progresso, agora no mesmo lugar, não avisa de novo.
    await pagina.click('#leitor [data-acao="fechar"]');
    await abrirLivro(p, vps, 'Livro longo.epub');
    await noCapitulo(pagina, /Parágrafo 40 do capítulo longo/);
    assert.equal(await aviso(pagina), null, 'no mesmo lugar, sem aviso');
    // O mesmo vale para um parágrafo mais adiante na mesma página, e o seguinte à página avisa.
    await vps.koreader('Livro longo.epub', '/body/DocFragment[3]/body/p[41]/text().0', 0.63, { daqui: 1.5 * UM_DIA });
    await pagina.click('#leitor [data-acao="fechar"]');
    await abrirLivro(p, vps, 'Livro longo.epub');
    assert.equal(await aVista(pagina, 'l41'), true);
    assert.equal(await aviso(pagina), null, 'parágrafo na página à vista, sem aviso');
    // E para o parágrafo em que a página começa.
    const primeiro = await pagina.evaluate(() => {
      const quadro = document.querySelector('#leitor iframe');
      const area = document.querySelector('#leitor .lt-conteudo').getBoundingClientRect();
      const esquerda = quadro.getBoundingClientRect().left;
      return Number([...quadro.contentDocument.querySelectorAll('p[id^=l]')].find((e) => esquerda + e.getBoundingClientRect().left >= area.left - 1).id.slice(1));
    });
    assert.ok(primeiro > 1 && primeiro < 40, `a página começa num parágrafo antes do 40: ${primeiro}`);
    await vps.koreader('Livro longo.epub', `/body/DocFragment[3]/body/p[${primeiro}]/text().0`, 0.6, { daqui: 1.6 * UM_DIA });
    await pagina.click('#leitor [data-acao="fechar"]');
    await abrirLivro(p, vps, 'Livro longo.epub');
    assert.equal(await aviso(pagina), null, 'o parágrafo em que a página começa, sem aviso');

    // Quando só o fim do caminho não é achado, vale o último elemento achado: aqui, o parágrafo 70.
    await vps.koreader('Livro longo.epub', '/body/DocFragment[3]/body/p[70]/span[3]/text().0', 0.88, { daqui: 1.8 * UM_DIA });
    await pagina.click('#leitor [data-acao="fechar"]');
    await abrirLivro(p, vps, 'Livro longo.epub');
    await pagina.locator('#leitor .lt-remoto').waitFor();
    assert.match(await pagina.evaluate(() => window.leitorDaPrancheta.remoto.alvo), /\[l70\]\)$/);
    await pagina.click('#leitor [data-acao="remoto-ir"]');
    await pagina.waitForFunction(() => document.querySelector('#leitor .lt-remoto').hidden);
    await pagina.waitForFunction(() => {
      const quadro = document.querySelector('#leitor iframe');
      const area = document.querySelector('#leitor .lt-conteudo').getBoundingClientRect();
      const x = quadro.getBoundingClientRect().left + quadro.contentDocument.getElementById('l70').getBoundingClientRect().left;
      return x >= area.left - 1 && x < area.right;
    });

    // Um parágrafo que não existe, num caminho em que nada é achado, leva ao começo do capítulo dele.
    await vps.koreader('Livro longo.epub', '/body/DocFragment[2]/body/div[7]/p[999]/text().0', 0.3, { daqui: 2 * UM_DIA, device: '' });
    await pagina.click('#leitor [data-acao="fechar"]');
    await abrirLivro(p, vps, 'Livro longo.epub');
    await pagina.locator('#leitor .lt-remoto').waitFor();
    assert.match(await aviso(pagina), /^No KOReader, você parou em 30%, em \d\d\/\d\d às \d\d:\d\d\.$/);
    await pagina.click('#leitor [data-acao="remoto-ir"]');
    await noCapitulo(pagina, /segundo capítulo/);
    assert.equal(await aviso(pagina), null);

    // "Ficar onde estou" tira o aviso sem sair do lugar; virar a página também.
    await vps.koreader('Livro longo.epub', '/body/DocFragment[3]/body/p[70]', 0.9, { daqui: 3 * UM_DIA });
    for (const acao of ['remoto-fechar', 'anterior']) {
      await pagina.click('#leitor [data-acao="fechar"]');
      await abrirLivro(p, vps, 'Livro longo.epub');
      await pagina.locator('#leitor .lt-remoto').waitFor();
      await pagina.click(`#leitor [data-acao="${acao}"]`);
      await pagina.waitForFunction(() => document.querySelector('#leitor .lt-remoto').hidden);
      assert.doesNotMatch(await textoDoEpub(pagina), /capítulo longo/);
    }
    // Com o aviso à vista, abrir outro livro o tira: ele não passa de um livro para o outro.
    await pagina.click('#leitor [data-acao="fechar"]');
    await abrirLivro(p, vps, 'Livro longo.epub');
    await pagina.locator('#leitor .lt-remoto').waitFor();
    await abrirLivro(p, vps, 'Tres paginas.pdf');
    await pagina.waitForFunction(() => document.querySelector('#leitor .lt-posicao')?.textContent === 'p. 1 de 3', null, { timeout: 15000 });
    assert.equal(await aviso(pagina), null, 'o aviso de um livro não aparece no outro');

    // Fechado logo depois de um salto, o livro guarda a página à vista, e não a de antes do salto.
    await abrirLivro(p, vps, 'Livro longo.epub');
    const guardada = await pagina.evaluate(async (id) => {
      const leitor = window.leitorDaPrancheta;
      const vista = leitor.vista;
      const secao = vista.livro.spine.spineItems[2];
      const doc = await vista.livro.load(secao.url);
      await vista.irPara(secao.cfiFromElement(doc.querySelector('#l70')));
      leitor.fechar();
      return (await window.bibliotecaDaPrancheta.lerPosicao(id)).cfi;
    }, vps.ids['Livro longo.epub']);
    assert.match(guardada, /^epubcfi\(\/6\/6!/, `a posição guardada ao fechar é a do terceiro capítulo: ${guardada}`);
    assert.deepEqual(p.erros, []);
  } finally {
    await p.contexto.close();
    await vps.fechar();
  }
});

test('progresso mais antigo, no mesmo lugar, incompreensível ou de um capítulo que não existe não mostra o aviso', async () => {
  const vps = await subirComoNaVps();
  const p = await abrirPrancheta(vps);
  const { pagina } = p;
  try {
    // Este aparelho lê primeiro; o progresso do KOReader, gravado uma hora antes, é mais antigo.
    await abrirLivro(p, vps, 'Livro longo.epub');
    await noCapitulo(pagina, /primeiro capítulo/);
    assert.equal(await aviso(pagina), null, 'sem progresso gravado, sem aviso');
    await pagina.click('#leitor [data-acao="fechar"]');
    await vps.koreader('Livro longo.epub', '/body/DocFragment[3]/body/p[40]/text().0', 0.62, { daqui: -60 * 60 * 1000 });
    await abrirLivro(p, vps, 'Livro longo.epub');
    await noCapitulo(pagina, /primeiro capítulo/);
    assert.equal(await aviso(pagina), null, 'progresso mais antigo que a leitura neste aparelho');

    // Mais novo, mas na página à vista: sem aviso.
    await pagina.click('#leitor [data-acao="fechar"]');
    await vps.koreader('Livro longo.epub', '/body/DocFragment[1]/body/p[2]/em/text().0', 0.01);
    await abrirLivro(p, vps, 'Livro longo.epub');
    assert.equal(await aviso(pagina), null, 'progresso na página à vista');

    // Posições que não dão para entender, ou fora do livro: sem aviso e sem erro.
    for (const estranha of ['xyz', '/body/DocFragment[99]/body/p[1]', '/corpo/p[3]', '42']) {
      await pagina.click('#leitor [data-acao="fechar"]');
      await vps.koreader('Livro longo.epub', estranha, 0.5, { daqui: 2 * UM_DIA });
      await abrirLivro(p, vps, 'Livro longo.epub');
      await noCapitulo(pagina, /primeiro capítulo/);
      assert.equal(await aviso(pagina), null, estranha);
    }

    // Aberto pelo link de um cartão, o livro vai à posição do link, sem consultar o progresso.
    await pagina.click('#leitor [data-acao="fechar"]');
    await vps.koreader('Tres paginas.pdf', '2', 0.66);
    const consultas = p.pedidos.length;
    await abrirLivro(p, vps, 'Tres paginas.pdf', { pagina: 3 });
    await pagina.waitForFunction(() => document.querySelector('#leitor .lt-posicao')?.textContent === 'p. 3 de 3', null, { timeout: 15000 });
    await pagina.waitForTimeout(500);
    assert.equal(p.pedidos.length, consultas, 'nenhuma consulta ao abrir por um link');
    assert.equal(await aviso(pagina), null);
    assert.deepEqual(p.erros, []);
  } finally {
    await p.contexto.close();
    await vps.fechar();
  }
});

test('num PDF, o botão do aviso leva à página gravada pelo KOReader; uma página que não existe não avisa', async () => {
  const vps = await subirComoNaVps();
  const p = await abrirPrancheta(vps);
  const { pagina } = p;
  const naPagina = (rotulo) => pagina.waitForFunction((texto) => document.querySelector('#leitor .lt-posicao')?.textContent === texto, rotulo, { timeout: 15000 });
  try {
    await vps.koreader('Tres paginas.pdf', 3, 1, { device: 'Boox Note Air4 C' });
    await abrirLivro(p, vps, 'Tres paginas.pdf');
    await naPagina('p. 1 de 3');
    await pagina.locator('#leitor .lt-remoto').waitFor();
    assert.match(await aviso(pagina), /^No KOReader, em Boox Note Air4 C, você parou em 100%, em \d\d\/\d\d às \d\d:\d\d\.$/);
    await pagina.click('#leitor [data-acao="remoto-ir"]');
    await naPagina('p. 3 de 3');
    assert.equal(await aviso(pagina), null);

    // Na mesma página, fora do livro ou sem número: sem aviso.
    for (const [posicao, motivo] of [['3', 'mesma página'], ['4', 'página que não existe'], ['0', 'página zero'], ['/body/DocFragment[2]/body/p[1]', 'caminho de EPUB num PDF']]) {
      await pagina.click('#leitor [data-acao="fechar"]');
      await vps.koreader('Tres paginas.pdf', posicao, 0.5, { daqui: 2 * UM_DIA });
      await abrirLivro(p, vps, 'Tres paginas.pdf');
      await naPagina('p. 3 de 3');
      assert.equal(await aviso(pagina), null, motivo);
    }
    assert.deepEqual(p.erros, []);
  } finally {
    await p.contexto.close();
    await vps.fechar();
  }
});

test('sem rede, ou com o servidor sem o KOSync, o livro abre como hoje, sem demora e sem aviso', async () => {
  const vps = await subirComoNaVps();
  const p = await abrirPrancheta(vps);
  const { pagina } = p;
  try {
    await vps.koreader('Tres paginas.pdf', 2, 0.66);
    // Guardado no aparelho e sem rede: abre do aparelho, e a consulta que falha não aparece para o leitor.
    await pagina.evaluate((id) => window.bibliotecaDaPrancheta.guardar(id), vps.ids['Tres paginas.pdf']);
    await p.contexto.setOffline(true);
    const inicio = Date.now();
    await pagina.evaluate((id) => window.leitorDaPrancheta.abrir(id), vps.ids['Tres paginas.pdf']);
    await pagina.waitForFunction(() => document.querySelector('#leitor .lt-posicao')?.textContent === 'p. 1 de 3', null, { timeout: 15000 });
    assert.ok(Date.now() - inicio < 5000, 'o livro abre sem esperar a rede');
    assert.equal(await pagina.evaluate((id) => window.bibliotecaDaPrancheta.progressoRemoto(id), vps.ids['Tres paginas.pdf']), null);
    assert.equal(await aviso(pagina), null);
    assert.equal(await pagina.textContent('#leitor .lt-aviso'), '');
    // Com a rede de volta, a consulta devolve o progresso gravado.
    await p.contexto.setOffline(false);
    assert.equal((await pagina.evaluate((id) => window.bibliotecaDaPrancheta.progressoRemoto(id), vps.ids['Tres paginas.pdf'])).progress, '2');
    assert.deepEqual(p.erros, []);
  } finally {
    await p.contexto.close();
    await vps.fechar();
  }

  const semKosync = await subirComoNaVps({ semKosync: true });
  const q = await abrirPrancheta(semKosync);
  try {
    await abrirLivro(q, semKosync, 'Tres paginas.pdf');
    await q.pagina.waitForFunction(() => document.querySelector('#leitor .lt-posicao')?.textContent === 'p. 1 de 3', null, { timeout: 15000 });
    assert.equal(await aviso(q.pagina), null);
    assert.deepEqual(q.erros, []);
  } finally {
    await q.contexto.close();
    await semKosync.fechar();
  }
});
