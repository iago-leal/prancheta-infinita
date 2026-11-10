// Testes do progresso de leitura do KOReader, pelo protocolo KOSync, em
// servidor/kosync.cjs, e do comando que cria a credencial dele na VPS.
// Executar a partir da raiz do repositório: node --test servidor/testes/*.test.cjs

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { Armazem } = require('../armazem.cjs');
const { criarServidor, iniciar } = require('../servidor.cjs');
const { Kosync } = require('../kosync.cjs');
const { Biblioteca } = require('../biblioteca.cjs');

const CHAVE = 'chave-de-teste-com-mais-de-32-caracteres-0123456789';
const USUARIO = 'leitor';
const SENHA = 'senha-de-teste-do-kosync';
const COMANDO = path.join(__dirname, '..', 'implantacao', 'prancheta-kosync');
const LIVRO = '0123456789abcdef0123456789abcdef';
const OUTRO = 'fedcba9876543210fedcba9876543210';
const md5 = (texto) => crypto.createHash('md5').update(texto).digest('hex');
const temporaria = (nome) => fs.mkdtempSync(path.join(os.tmpdir(), `prancheta-${nome}-`));

// Sobe o servidor com o KOSync; `opcoes` troca a credencial pelo arquivo de usuários, ou tira o KOSync.
async function subir({ pasta = temporaria('kosync'), arquivo, semKosync = false, relogio, limiteDeLivros } = {}) {
  const armazem = await Armazem.abrir(pasta);
  const kosync = semKosync ? null : new Kosync({
    pasta, ...(arquivo ? { arquivo } : { credencial: { usuario: USUARIO, senha: SENHA } }), ...(relogio ? { agora: relogio } : {}), ...(limiteDeLivros ? { limiteDeLivros } : {}),
  });
  const livros = temporaria('livros');
  const servidor = criarServidor({ armazem, chave: CHAVE, kosync, biblioteca: new Biblioteca(livros) });
  await new Promise((pronto) => servidor.listen(0, '127.0.0.1', pronto));
  return {
    pasta, armazem, base: `http://127.0.0.1:${servidor.address().port}`,
    fechar: () => new Promise((pronto) => { servidor.close(pronto); servidor.closeAllConnections(); }),
  };
}

// Um pedido como o do KOReader: o usuário e o MD5 da senha nos cabeçalhos.
async function pedir(s, metodo, rota, { corpo, usuario = USUARIO, senha = SENHA, cabecalhos = {}, bruto } = {}) {
  const opcoes = { method: metodo, headers: { Accept: 'application/vnd.koreader.v1+json', ...cabecalhos } };
  if (usuario !== null) opcoes.headers['x-auth-user'] = usuario;
  if (senha !== null) opcoes.headers['x-auth-key'] = md5(senha);
  if (bruto !== undefined) opcoes.body = bruto;
  if (corpo !== undefined) {
    opcoes.body = JSON.stringify(corpo);
    opcoes.headers['Content-Type'] = 'application/json';
  }
  const resposta = await fetch(s.base + rota, opcoes);
  const texto = await resposta.text();
  let json = null;
  try { json = JSON.parse(texto); } catch (e) { /* sem corpo JSON */ }
  return { status: resposta.status, json, texto };
}

const progresso = (extra = {}) => ({
  document: LIVRO, progress: '/body/DocFragment[3]/body/p[12]/text().34', percentage: 0.2504, device: 'boox', device_id: 'A1B2C3D4E5F60718293A4B5C6D7E8F90', ...extra,
});
const NAO_AUTORIZADO = { code: 2001, message: 'Unauthorized' };

test('o KOSync confere a credencial, grava o progresso de um livro e devolve o último gravado', async () => {
  let agora = 1762740000000;
  const s = await subir({ relogio: () => agora });
  try {
    const entrada = await pedir(s, 'GET', '/sync/kosync/users/auth');
    assert.deepEqual([entrada.status, entrada.json], [200, { authorized: 'OK' }]);

    // Um livro sem progresso devolve uma resposta vazia.
    const vazio = await pedir(s, 'GET', `/sync/kosync/syncs/progress/${LIVRO}`);
    assert.deepEqual([vazio.status, vazio.json], [200, {}]);

    const gravado = await pedir(s, 'PUT', '/sync/kosync/syncs/progress', { corpo: progresso() });
    assert.deepEqual([gravado.status, gravado.json], [200, { document: LIVRO, timestamp: 1762740000 }]);
    const lido = await pedir(s, 'GET', `/sync/kosync/syncs/progress/${LIVRO}`);
    assert.deepEqual([lido.status, lido.json], [200, { ...progresso(), timestamp: 1762740000 }]);

    // Uma gravação nova substitui a anterior; num PDF, a posição é o número da página.
    agora += 90000;
    await pedir(s, 'PUT', '/sync/kosync/syncs/progress', { corpo: progresso({ progress: 42, percentage: 0.5, device: 'computador' }) });
    const depois = await pedir(s, 'GET', `/sync/kosync/syncs/progress/${LIVRO}`);
    assert.deepEqual(depois.json, { ...progresso({ progress: '42', percentage: 0.5, device: 'computador' }), timestamp: 1762740090 });
    // Cada livro tem o seu progresso.
    await pedir(s, 'PUT', '/sync/kosync/syncs/progress', { corpo: progresso({ document: OUTRO, percentage: 1 }) });
    assert.equal((await pedir(s, 'GET', `/sync/kosync/syncs/progress/${OUTRO}`)).json.percentage, 1);
    assert.equal((await pedir(s, 'GET', `/sync/kosync/syncs/progress/${LIVRO}`)).json.percentage, 0.5);

    // Pela rede privada, o Tailscale pode tirar o /sync do caminho: as rotas valem sem ele.
    assert.equal((await pedir(s, 'GET', '/kosync/users/auth')).status, 200);
    assert.equal((await pedir(s, 'GET', `/kosync/syncs/progress/${LIVRO}`)).json.percentage, 0.5);
  } finally {
    await s.fechar();
  }
  // O progresso continua lá depois de o servidor recomeçar.
  const de_novo = await subir({ pasta: s.pasta });
  try {
    assert.equal((await pedir(de_novo, 'GET', `/sync/kosync/syncs/progress/${LIVRO}`)).json.progress, '42');
  } finally {
    await de_novo.fechar();
  }
});

test('sem a credencial certa, o KOSync recusa tudo sem revelar nada, e o cadastro fica fechado', async () => {
  const s = await subir();
  try {
    await pedir(s, 'PUT', '/sync/kosync/syncs/progress', { corpo: progresso() });
    const rotas = [['GET', '/sync/kosync/users/auth'], ['GET', `/sync/kosync/syncs/progress/${LIVRO}`], ['PUT', '/sync/kosync/syncs/progress'], ['GET', '/sync/kosync/qualquer'], ['OPTIONS', '/sync/kosync/users/auth']];
    const tentativas = [
      { senha: 'outra-senha-qualquer' }, { usuario: 'outro' }, { usuario: null }, { senha: null }, { usuario: null, senha: null },
      // A chave de um aparelho não vale como credencial do KOSync.
      { usuario: null, senha: null, cabecalhos: { Authorization: `Bearer ${CHAVE}` } },
      { cabecalhos: { 'x-auth-key': CHAVE }, senha: null },
      { cabecalhos: { 'x-auth-key': md5(SENHA).toUpperCase() }, senha: null },
    ];
    for (const [metodo, rota] of rotas) {
      for (const tentativa of tentativas) {
        const r = await pedir(s, metodo, rota, { ...tentativa, ...(metodo === 'PUT' ? { corpo: progresso({ percentage: 0.9 }) } : {}) });
        assert.equal(r.status, 401, `${metodo} ${rota} ${JSON.stringify(tentativa)}`);
        if (metodo !== 'OPTIONS') assert.deepEqual(r.json, NAO_AUTORIZADO);
      }
    }
    // Nenhuma tentativa recusada gravou nada.
    assert.equal((await pedir(s, 'GET', `/sync/kosync/syncs/progress/${LIVRO}`)).json.percentage, 0.2504);

    // O cadastro pelo KOReader é recusado, com ou sem credencial, e não cria usuário.
    for (const tentativa of [{ usuario: null, senha: null }, {}]) {
      const cadastro = await pedir(s, 'POST', '/sync/kosync/users/create', { ...tentativa, corpo: { username: 'novo', password: md5('qualquer-senha-nova') } });
      assert.deepEqual([cadastro.status, cadastro.json], [402, { code: 2005, message: 'User registration is disabled.' }]);
    }
    assert.equal((await pedir(s, 'GET', '/sync/kosync/users/auth', { usuario: 'novo', senha: 'qualquer-senha-nova' })).status, 401);

    // A credencial do KOSync não abre os quadros, os arquivos nem a biblioteca.
    const cabecalhos = { 'x-auth-user': USUARIO, 'x-auth-key': md5(SENHA) };
    for (const [metodo, rota] of [['GET', '/sync/estado'], ['GET', '/sync/mudancas?desde=0'], ['POST', '/sync/mudancas'], ['GET', '/sync/biblioteca'], ['GET', `/sync/arquivos/${'a'.repeat(32)}`], ['PUT', `/sync/arquivos/${'a'.repeat(32)}`]]) {
      for (const extra of [{}, { Authorization: `Bearer ${md5(SENHA)}` }, { Authorization: `Bearer ${SENHA}` }]) {
        const r = await fetch(s.base + rota, { method: metodo, headers: { ...cabecalhos, ...extra } });
        assert.equal(r.status, 401, `${metodo} ${rota}`);
        assert.deepEqual(await r.json(), { erro: 'nao_autorizado' });
      }
    }
  } finally {
    await s.fechar();
  }
});

test('um pedido fora do formato ou grande demais é recusado, e o progresso fica à parte dos quadros, só com os campos do protocolo', async () => {
  const s = await subir();
  try {
    const recusados = [
      [{ ...progresso(), document: undefined }, 403, 2004],
      [{ ...progresso(), document: '' }, 403, 2004],
      [progresso({ document: 'livro.epub' }), 403, 2003],
      [progresso({ document: `../${'a'.repeat(29)}` }), 403, 2003],
      [progresso({ document: LIVRO.toUpperCase() }), 403, 2003],
      [progresso({ document: 42 }), 403, 2003],
      [progresso({ progress: '' }), 403, 2003],
      [progresso({ progress: 'x'.repeat(2049) }), 403, 2003],
      [progresso({ progress: { caminho: 1 } }), 403, 2003],
      [progresso({ percentage: 1.01 }), 403, 2003],
      [progresso({ percentage: -0.1 }), 403, 2003],
      [progresso({ percentage: '0.5' }), 403, 2003],
      [progresso({ device: 'x'.repeat(129) }), 403, 2003],
      [progresso({ device: 7 }), 403, 2003],
      [progresso({ device_id: ['a'] }), 403, 2003],
      [[progresso()], 403, 2004],
      [null, 403, 2004],
    ];
    for (const [corpo, status, codigo] of recusados) {
      const r = await pedir(s, 'PUT', '/sync/kosync/syncs/progress', { corpo });
      assert.deepEqual([r.status, r.json && r.json.code], [status, codigo], JSON.stringify(corpo).slice(0, 80));
    }
    assert.equal((await pedir(s, 'PUT', '/sync/kosync/syncs/progress', { bruto: '{isto não é json' })).status, 403);
    assert.equal((await pedir(s, 'PUT', '/sync/kosync/syncs/progress', { corpo: progresso({ device: 'boox', enchimento: 'x'.repeat(20000) }) })).status, 413);
    assert.equal((await pedir(s, 'GET', '/sync/kosync/syncs/progress/livro.epub')).status, 403);
    assert.equal((await pedir(s, 'GET', '/sync/kosync/syncs/progress')).status, 404);
    assert.equal((await pedir(s, 'DELETE', '/sync/kosync/users/me')).status, 404);
    // Nada do que foi recusado ficou guardado.
    assert.deepEqual((await pedir(s, 'GET', `/sync/kosync/syncs/progress/${LIVRO}`)).json, {});
    assert.equal(fs.existsSync(path.join(s.pasta, 'kosync')), false);

    // O que é aceito vai para um arquivo próprio, só com os campos do protocolo, sem tocar nos quadros.
    const posicaoAntes = s.armazem.posicao;
    const aceito = await pedir(s, 'PUT', '/sync/kosync/syncs/progress', { corpo: progresso({ segredo: 'não guardar', progress: 'x'.repeat(2048), device_id: undefined }) });
    assert.equal(aceito.status, 200);
    const guardado = JSON.parse(fs.readFileSync(path.join(s.pasta, 'kosync', `${USUARIO}.json`), 'utf8'));
    assert.deepEqual(Object.keys(guardado), ['livros']);
    assert.deepEqual(Object.keys(guardado.livros), [LIVRO]);
    assert.deepEqual(Object.keys(guardado.livros[LIVRO]).sort(), ['device', 'device_id', 'percentage', 'progress', 'timestamp']);
    assert.equal(s.armazem.posicao, posicaoAntes, 'o progresso não entra na sincronização dos quadros');
    assert.deepEqual(fs.readdirSync(path.join(s.pasta, 'kosync')), [`${USUARIO}.json`]);
    assert.equal(fs.statSync(path.join(s.pasta, 'kosync', `${USUARIO}.json`)).mode & 0o077, 0, 'o arquivo do progresso só é lido pelo servidor');
  } finally {
    await s.fechar();
  }
});

test('passado o limite de livros, saem os gravados há mais tempo', async () => {
  const s = await subir({ limiteDeLivros: 3 });
  try {
    const livro = (n) => String(n).repeat(32);
    for (const n of [1, 2, 3]) await pedir(s, 'PUT', '/sync/kosync/syncs/progress', { corpo: progresso({ document: livro(n) }) });
    // Regravar o primeiro o torna o mais recente; o quarto livro tira o segundo.
    await pedir(s, 'PUT', '/sync/kosync/syncs/progress', { corpo: progresso({ document: livro(1), percentage: 0.9 }) });
    await pedir(s, 'PUT', '/sync/kosync/syncs/progress', { corpo: progresso({ document: livro(4) }) });
    const guardados = [];
    for (const n of [1, 2, 3, 4]) guardados.push(Object.keys((await pedir(s, 'GET', `/sync/kosync/syncs/progress/${livro(n)}`)).json).length > 0);
    assert.deepEqual(guardados, [true, false, true, true]);
  } finally {
    await s.fechar();
  }
});

test('o comando da VPS cria o usuário com a senha mostrada uma vez, o servidor guarda só o resumo, e revogar vale na hora', async () => {
  const arquivo = path.join(temporaria('usuarios'), 'kosync');
  const comando = (...args) => spawnSync('bash', [COMANDO, ...args], { env: { PATH: process.env.PATH, PRANCHETA_KOSYNC: arquivo }, encoding: 'utf8' });
  // Sem o arquivo, o comando pede o roteiro, e o servidor recusa todos sem cair.
  assert.notEqual(comando('listar').status, 0);
  const s = await subir({ arquivo });
  try {
    assert.equal((await pedir(s, 'GET', '/sync/kosync/users/auth')).status, 401);
    fs.writeFileSync(arquivo, '');
    assert.equal((await pedir(s, 'GET', '/sync/kosync/users/auth')).status, 401);

    const criado = comando('novo', 'leitor');
    assert.equal(criado.status, 0, criado.stderr);
    const senha = criado.stdout.trim().split('\n').pop();
    assert.match(senha, /^[a-z2-7]{20}$/);
    const conteudo = fs.readFileSync(arquivo, 'utf8');
    assert.match(conteudo, /^leitor [0-9a-f]{64}\n$/);
    assert.ok(!conteudo.includes(senha) && !conteudo.includes(md5(senha)), 'nem a senha nem o MD5 dela ficam no arquivo');
    // O usuário novo vale na hora, sem reiniciar, e só com a senha dele.
    assert.equal((await pedir(s, 'GET', '/sync/kosync/users/auth', { senha })).status, 200);
    assert.equal((await pedir(s, 'GET', '/sync/kosync/users/auth', { senha: SENHA })).status, 401);
    assert.equal((await pedir(s, 'GET', '/sync/kosync/users/auth', { usuario: 'outro', senha })).status, 401);
    assert.equal((await pedir(s, 'PUT', '/sync/kosync/syncs/progress', { senha, corpo: progresso() })).status, 200);

    assert.notEqual(comando('novo', 'leitor').status, 0, 'um usuário que já existe não ganha outra senha');
    assert.equal(comando('novo', 'nome com espaço').status, 2);
    const segundo = comando('novo', 'visita').stdout.trim().split('\n').pop();
    assert.notEqual(segundo, senha);
    assert.deepEqual(comando('listar').stdout.trim().split('\n'), ['leitor', 'visita']);
    // Cada usuário tem o seu progresso.
    assert.deepEqual((await pedir(s, 'GET', `/sync/kosync/syncs/progress/${LIVRO}`, { usuario: 'visita', senha: segundo })).json, {});

    // Revogar vale na hora, e o progresso gravado fica guardado.
    assert.equal(comando('revogar', 'leitor').status, 0);
    assert.deepEqual(comando('listar').stdout.trim().split('\n'), ['visita']);
    assert.equal((await pedir(s, 'GET', '/sync/kosync/users/auth', { senha })).status, 401);
    assert.equal((await pedir(s, 'GET', '/sync/kosync/users/auth', { usuario: 'visita', senha: segundo })).status, 200);
    assert.notEqual(comando('revogar', 'leitor').status, 0);
    assert.ok(fs.existsSync(path.join(s.pasta, 'kosync', 'leitor.json')));
    // Um arquivo estragado não autoriza ninguém e não derruba o servidor.
    fs.writeFileSync(arquivo, 'linha fora do formato\n');
    assert.equal((await pedir(s, 'GET', '/sync/kosync/users/auth', { usuario: 'visita', senha: segundo })).status, 401);
  } finally {
    await s.fechar();
  }
});

test('sem o KOSync configurado, as rotas dele recusam tudo; configurado pelo ambiente, o servidor o liga', async () => {
  const sem = await subir({ semKosync: true });
  try {
    for (const [metodo, rota] of [['GET', '/sync/kosync/users/auth'], ['POST', '/sync/kosync/users/create'], ['GET', `/sync/kosync/syncs/progress/${LIVRO}`]]) {
      const r = await pedir(sem, metodo, rota);
      assert.deepEqual([r.status, r.json], [401, NAO_AUTORIZADO]);
    }
  } finally {
    await sem.fechar();
  }

  const arquivo = path.join(temporaria('usuarios'), 'kosync');
  const resumo = crypto.createHash('sha256').update(md5(SENHA)).digest('hex');
  fs.writeFileSync(arquivo, `# usuários do KOSync\n${USUARIO} ${resumo}\n`);
  const pasta = temporaria('dados');
  const ligado = await iniciar({ PRANCHETA_CHAVE: CHAVE, PRANCHETA_DADOS: pasta, PRANCHETA_PORTA: '0', PRANCHETA_KOSYNC_ARQUIVO: arquivo });
  try {
    const s = { base: `http://127.0.0.1:${ligado.servidores[0].address().port}` };
    assert.equal((await pedir(s, 'GET', '/sync/kosync/users/auth')).status, 200);
    assert.equal((await pedir(s, 'PUT', '/sync/kosync/syncs/progress', { corpo: progresso() })).status, 200);
    assert.ok(fs.existsSync(path.join(pasta, 'kosync', `${USUARIO}.json`)));
    // A sincronização dos quadros continua pedindo a chave de um aparelho.
    assert.equal((await fetch(`${s.base}/sync/estado`)).status, 401);
    assert.equal((await fetch(`${s.base}/sync/estado`, { headers: { Authorization: `Bearer ${CHAVE}` } })).status, 200);
  } finally {
    await ligado.fechar();
  }
});

test('um aparelho da Prancheta lê, com a chave dele, o progresso mais recente de um livro; a credencial do KOSync não vale nessa rota', async () => {
  const arquivo = path.join(temporaria('usuarios'), 'kosync');
  const linha = (usuario, senha) => `${usuario} ${crypto.createHash('sha256').update(md5(senha)).digest('hex')}\n`;
  fs.writeFileSync(arquivo, linha('leitor', SENHA) + linha('visita', 'senha-da-visita-no-kosync'));
  let agora = 1762740000000;
  const s = await subir({ arquivo, relogio: () => agora });
  const ler = (livro, cabecalhos = { Authorization: `Bearer ${CHAVE}` }) => fetch(`${s.base}/sync/progresso/${livro}`, { headers: cabecalhos }).then(async (r) => [r.status, await r.json()]);
  try {
    assert.deepEqual(await ler(LIVRO), [200, { progresso: null }]);
    await pedir(s, 'PUT', '/sync/kosync/syncs/progress', { corpo: progresso() });
    assert.deepEqual(await ler(LIVRO), [200, { progresso: { ...progresso(), timestamp: 1762740000 } }]);
    assert.deepEqual(await ler(OUTRO), [200, { progresso: null }]);
    // Entre dois usuários, vale a gravação mais recente, qualquer que seja a ordem.
    agora += 60000;
    await pedir(s, 'PUT', '/sync/kosync/syncs/progress', { usuario: 'visita', senha: 'senha-da-visita-no-kosync', corpo: progresso({ percentage: 0.8, device: 'outro' }) });
    assert.deepEqual((await ler(LIVRO))[1].progresso, { ...progresso({ percentage: 0.8, device: 'outro' }), timestamp: 1762740060 });
    agora += 60000;
    await pedir(s, 'PUT', '/sync/kosync/syncs/progress', { corpo: progresso({ percentage: 0.9 }) });
    assert.equal((await ler(LIVRO))[1].progresso.percentage, 0.9);
    // Vale também sem o /sync no caminho, como as outras rotas.
    assert.equal((await fetch(`${s.base}/progresso/${LIVRO}`, { headers: { Authorization: `Bearer ${CHAVE}` } })).status, 200);

    // Sem a chave de um aparelho, nada; a credencial do KOSync não a substitui.
    const doKosync = { 'x-auth-user': USUARIO, 'x-auth-key': md5(SENHA) };
    for (const cabecalhos of [{}, doKosync, { ...doKosync, Authorization: `Bearer ${md5(SENHA)}` }, { Authorization: 'Bearer chave-errada-com-mais-de-32-caracteres-000000' }]) {
      assert.deepEqual(await ler(LIVRO, cabecalhos), [401, { erro: 'nao_autorizado' }]);
    }
    // Um identificador fora do formato é recusado, e um arquivo estranho na pasta não atrapalha.
    assert.deepEqual(await ler('livro.epub'), [400, { erro: 'livro_invalido' }]);
    assert.deepEqual(await ler(LIVRO.toUpperCase()), [400, { erro: 'livro_invalido' }]);
    fs.writeFileSync(path.join(s.pasta, 'kosync', 'anotacao.txt'), 'não é progresso');
    fs.writeFileSync(path.join(s.pasta, 'kosync', 'não é usuário.json'), '{isto não é json');
    assert.equal((await ler(LIVRO))[1].progresso.percentage, 0.9);
    assert.equal((await fetch(`${s.base}/sync/progresso/${LIVRO}`, { method: 'PUT', headers: { Authorization: `Bearer ${CHAVE}` } })).status, 404);
  } finally {
    await s.fechar();
  }
  // Sem o KOSync configurado, a rota responde que não há progresso.
  const sem = await subir({ semKosync: true });
  try {
    const r = await fetch(`${sem.base}/sync/progresso/${LIVRO}`, { headers: { Authorization: `Bearer ${CHAVE}` } });
    assert.deepEqual([r.status, await r.json()], [200, { progresso: null }]);
  } finally {
    await sem.fechar();
  }
});
