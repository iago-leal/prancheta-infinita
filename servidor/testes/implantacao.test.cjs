// Testes dos scripts de implantação na VPS, em servidor/implantacao: o comando
// forçado da conta prancheta, a ferramenta de chaves e o arquivo do contêiner.
// O roteiro do administrador só tem a sintaxe conferida, porque mexe na VPS.
// Executar a partir da raiz do repositório: node --test servidor/testes/*.test.cjs

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { criarVerificador } = require('../chaves.cjs');
const { criarServidorDaPagina } = require('../pagina.cjs');

const RAIZ = path.join(__dirname, '..', '..');
const PASTA = path.join(RAIZ, 'servidor', 'implantacao');
const PUBLICAR = path.join(PASTA, 'prancheta-publicar');
const CHAVE = path.join(PASTA, 'prancheta-chave');
const temporaria = (nome) => fs.mkdtempSync(path.join(os.tmpdir(), `prancheta-${nome}-`));
const commit = (n) => String(n).repeat(40).slice(0, 40);

// O pacote como o GitHub o monta: git archive de web/app e servidor, a partir
// da árvore de trabalho, por um índice temporário que não toca o do repositório.
function pacoteDoGit(destino) {
  const env = { ...process.env, GIT_INDEX_FILE: path.join(temporaria('indice'), 'indice') };
  const git = (...args) => {
    const r = spawnSync('git', args, { cwd: RAIZ, env, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  };
  git('read-tree', 'HEAD');
  git('add', '-A', 'web/app', 'servidor');
  const arvore = git('write-tree');
  git('archive', '--format=tar.gz', '-o', destino, arvore, 'web/app', 'servidor');
  return destino;
}

// Monta um tar.gz com entradas escolhidas, inclusive maliciosas, pelo Python.
function pacoteFeito(destino, entradas) {
  const codigo = `
import io, json, sys, tarfile
entradas = json.loads(sys.argv[2])
with tarfile.open(sys.argv[1], 'w:gz') as t:
    for e in entradas:
        info = tarfile.TarInfo(e['nome'])
        if e.get('atalho'):
            info.type = tarfile.SYMTYPE
            info.linkname = e['atalho']
            t.addfile(info)
        else:
            dados = e.get('conteudo', 'x').encode()
            info.size = len(dados)
            t.addfile(info, io.BytesIO(dados))
`;
  const r = spawnSync('python3', ['-c', codigo, destino, JSON.stringify(entradas)], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return destino;
}

function publicar(publicado, comando, pacote = null, extra = {}) {
  return spawnSync('bash', [PUBLICAR], {
    env: { PATH: process.env.PATH, PRANCHETA_PUBLICADO: publicado, SSH_ORIGINAL_COMMAND: comando, ...extra },
    input: pacote ? fs.readFileSync(pacote) : '',
    encoding: 'utf8',
  });
}

const atual = (publicado) => path.basename(fs.readlinkSync(path.join(publicado, 'atual')));
const versoes = (publicado) => fs.readdirSync(path.join(publicado, 'versoes')).sort();

test('a publicação recebe a versão, troca o atalho, guarda as cinco mais recentes e permite voltar', async () => {
  const publicado = temporaria('publicado');
  const pacote = pacoteDoGit(path.join(temporaria('pacote'), 'pacote.tgz'));
  assert.equal(publicar(publicado, 'verificar').stdout.trim(), 'canal de publicacao ok');

  const r = publicar(publicado, `publicar ${commit(1)}`, pacote);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), `publicado ${commit(1)}`);
  assert.equal(fs.readlinkSync(path.join(publicado, 'atual')), `versoes/${commit(1)}`);
  assert.ok(fs.existsSync(path.join(publicado, 'atual', 'servidor', 'servidor.cjs')));
  assert.equal(fs.readFileSync(path.join(publicado, 'atual', 'web', 'app', 'versao.txt'), 'utf8').trim(), commit(1));
  assert.equal(publicar(publicado, `publicar ${commit(1)}`, pacote).stdout.trim(), `ja publicado ${commit(1)}`);
  // Datas distintas e crescentes, na ordem das publicações, para que a ordem
  // das versões não dependa de publicações feitas no mesmo instante.
  const datar = (n) => {
    const quando = new Date(Date.UTC(2026, 0, n));
    fs.utimesSync(path.join(publicado, 'versoes', commit(n)), quando, quando);
  };
  datar(1);

  // A página entregue a partir da versão em uso responde com ela.
  const pagina = criarServidorDaPagina({ pasta: path.join(publicado, 'atual', 'web', 'app') });
  await new Promise((pronto) => pagina.listen(0, '127.0.0.1', pronto));
  try {
    const resposta = await fetch(`http://127.0.0.1:${pagina.address().port}/versao.txt`);
    assert.equal((await resposta.text()).trim(), commit(1));
  } finally {
    pagina.close();
  }

  for (let n = 2; n <= 7; n++) {
    const s = publicar(publicado, `publicar ${commit(n)}`, pacote);
    assert.equal(s.status, 0, s.stderr);
    datar(n);
  }
  assert.equal(atual(publicado), commit(7));
  assert.deepEqual(versoes(publicado), [3, 4, 5, 6, 7].map(commit));
  const lista = publicar(publicado, 'versoes').stdout.trim().split('\n');
  assert.equal(lista[0], `${commit(7)} atual`);
  assert.equal(lista.length, 5);

  assert.equal(publicar(publicado, `voltar ${commit(6)}`).stdout.trim(), `em uso ${commit(6)}`);
  assert.equal(atual(publicado), commit(6));
  const inexistente = publicar(publicado, `voltar ${commit(1)}`);
  assert.equal(inexistente.status, 1);
  assert.equal(atual(publicado), commit(6));
});

test('a publicação recusa ações fora da lista e pacotes que levariam para fora da versão', () => {
  const publicado = temporaria('publicado');
  const pacote = pacoteDoGit(path.join(temporaria('pacote'), 'pacote.tgz'));
  assert.equal(publicar(publicado, `publicar ${commit(1)}`, pacote).status, 0);

  for (const comando of ['', 'rm -rf /', 'publicar', 'publicar abc', `publicar ${commit(2)} extra`, 'verificar mais', `voltar ../${commit(2)}`, 'bash']) {
    const r = publicar(publicado, comando, pacote);
    assert.equal(r.status, 2, comando);
    assert.match(r.stderr, /acao nao permitida/, comando);
  }

  const pasta = temporaria('maliciosos');
  const basicos = [
    { nome: 'web/app/index.html' }, { nome: 'web/app/sw.js' }, { nome: 'servidor/servidor.cjs' },
    { nome: 'servidor/armazem.cjs' }, { nome: 'servidor/pagina.cjs' }, { nome: 'servidor/chaves.cjs' },
  ];
  const casos = {
    'subida de pasta': [...basicos, { nome: 'web/app/../../fora.txt' }],
    'caminho absoluto': [...basicos, { nome: '/tmp/fora.txt' }],
    atalho: [...basicos, { nome: 'web/app/senha', atalho: '/etc/shadow' }],
    'fora de web/app e servidor': [...basicos, { nome: 'android/app.txt' }],
    'sem os arquivos obrigatórios': [{ nome: 'web/app/index.html' }],
  };
  for (const [i, [nome, entradas]] of Object.entries(casos).entries()) {
    const r = publicar(publicado, `publicar ${commit(3)}`, pacoteFeito(path.join(pasta, `caso-${i}.tgz`), entradas));
    assert.notEqual(r.status, 0, nome);
    assert.equal(atual(publicado), commit(1), nome);
    assert.deepEqual(versoes(publicado), [commit(1)], nome);
  }
  fs.writeFileSync(path.join(pasta, 'lixo.tgz'), 'isto não é um pacote');
  assert.match(publicar(publicado, `publicar ${commit(3)}`, path.join(pasta, 'lixo.tgz')).stderr, /ilegivel/);
  const grande = path.join(pasta, 'grande.tgz');
  fs.writeFileSync(grande, Buffer.alloc(2 * 1024 * 1024 + 10, 1));
  assert.match(publicar(publicado, `publicar ${commit(3)}`, grande, { PRANCHETA_LIMITE_MB: '1' }).stderr, /limite/);
  assert.equal(atual(publicado), commit(1));
  assert.deepEqual(versoes(publicado), [commit(1)]);
  assert.ok(!fs.existsSync('/tmp/fora.txt') || fs.statSync('/tmp/fora.txt').mtimeMs < Date.now() - 60000);
});

test('a ferramenta de chaves cria uma chave por aparelho, que o servidor aceita, e a revoga', () => {
  const arquivo = path.join(temporaria('chaves'), 'chaves');
  fs.writeFileSync(arquivo, '');
  const chave = (...args) => spawnSync('bash', [CHAVE, ...args], { env: { PATH: process.env.PATH, PRANCHETA_CHAVES: arquivo }, encoding: 'utf8' });

  const boox = chave('nova', 'boox');
  assert.equal(boox.status, 0, boox.stderr);
  const chaveDoBoox = boox.stdout.trim().split('\n').pop();
  assert.match(chaveDoBoox, /^[A-Za-z0-9_-]{43}$/);
  assert.ok(!fs.readFileSync(arquivo, 'utf8').includes(chaveDoBoox));
  const verificar = criarVerificador({ arquivo });
  assert.equal(verificar(chaveDoBoox), 'boox');

  assert.notEqual(chave('nova', 'boox').status, 0);
  assert.equal(chave('nova', 'nome com espaço').status, 2);
  const computador = chave('nova', 'computador').stdout.trim().split('\n').pop();
  assert.deepEqual(chave('listar').stdout.trim().split('\n'), ['boox', 'computador']);
  assert.equal(chave('revogar', 'boox').status, 0);
  assert.deepEqual(chave('listar').stdout.trim().split('\n'), ['computador']);
  assert.equal(verificar(chaveDoBoox), null);
  assert.equal(verificar(computador), 'computador');
  assert.notEqual(chave('revogar', 'boox').status, 0);
});

test('o roteiro tem sintaxe válida, e o contêiner só monta com o endereço vindo do ambiente', (t) => {
  for (const script of ['preparar-vps.sh', 'prancheta-publicar', 'prancheta-chave']) {
    const r = spawnSync('bash', ['-n', path.join(PASTA, script)], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${script}: ${r.stderr}`);
    assert.ok(fs.statSync(path.join(PASTA, script)).mode & 0o111, `${script} sem permissão de execução`);
  }
  const versao = spawnSync('docker', ['compose', 'version'], { encoding: 'utf8' });
  if (versao.status !== 0) {
    t.skip('docker compose indisponível; o arquivo do contêiner não foi conferido');
    return;
  }
  const pasta = temporaria('compose');
  fs.writeFileSync(path.join(pasta, 'ambiente'), 'ANFITRIAO=prancheta.exemplo.invalid\nPRANCHETA_UID=1001\nPRANCHETA_GID=1002\n');
  const config = spawnSync('docker', ['compose', '--env-file', path.join(pasta, 'ambiente'), '-f', path.join(PASTA, 'compose.yml'), 'config', '--format', 'json'], { encoding: 'utf8' });
  assert.equal(config.status, 0, config.stderr);
  const servico = JSON.parse(config.stdout).services.servidor;
  assert.equal(servico.user, '1001:1002');
  assert.equal(servico.read_only, true);
  assert.deepEqual(servico.cap_drop, ['ALL']);
  assert.equal(servico.labels['traefik.http.routers.prancheta-pagina.rule'], 'Host(`prancheta.exemplo.invalid`)');
  assert.equal(servico.labels['traefik.http.routers.prancheta-sincronizacao.rule'], 'Host(`prancheta.exemplo.invalid`) && PathPrefix(`/sync/`)');
  assert.ok(servico.volumes.every((v) => v.target === '/dados' || v.read_only), 'só os dados podem ser gravados');
  assert.ok(!Object.keys(servico.environment).some((k) => /CHAVE$/.test(k)), 'nenhuma chave no ambiente do contêiner');
  fs.writeFileSync(path.join(pasta, 'sem'), 'PRANCHETA_UID=1001\nPRANCHETA_GID=1002\n');
  const sem = spawnSync('docker', ['compose', '--env-file', path.join(pasta, 'sem'), '-f', path.join(PASTA, 'compose.yml'), 'config'], { encoding: 'utf8' });
  assert.notEqual(sem.status, 0);
  assert.match(sem.stderr, /ANFITRIAO/);
});
