// Monta web/app/index.html a partir do código original do artefato,
// web/index.html, aplicando as mudanças listadas em mudancas.cjs, e carimba
// em web/app/sw.js a versão do cache do service worker, um resumo dos
// arquivos que ele guarda e dele mesmo: qualquer mudança na página gera uma
// versão nova, que o service worker instala como atualização.
//
// Uso, a partir da raiz do repositório:
//   node web/montagem/montar.cjs            grava web/app/index.html e carimba web/app/sw.js
//   node web/montagem/montar.cjs --conferir falha se algum dos dois não
//                                           corresponder à montagem

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ORIGINAL = path.join(__dirname, '..', 'index.html');
const PASTA_DO_APP = path.join(__dirname, '..', 'app');
const DESTINO = path.join(PASTA_DO_APP, 'index.html');
const SERVICE_WORKER = path.join(PASTA_DO_APP, 'sw.js');
const LINHA_DA_VERSAO = /const VERSAO = '[^']*';/;

function contar(texto, trecho) {
  let n = 0;
  for (let i = texto.indexOf(trecho); i !== -1; i = texto.indexOf(trecho, i + trecho.length)) n++;
  return n;
}

// Aplica as mudanças em ordem; cada trecho precisa aparecer uma única vez.
function montar(original = fs.readFileSync(ORIGINAL, 'utf8'), mudancas = require('./mudancas.cjs')) {
  let texto = original;
  mudancas.forEach((m, i) => {
    const nome = `mudança ${i + 1}`;
    if (typeof m.motivo !== 'string' || m.motivo.trim() === '') throw new Error(`${nome} sem motivo`);
    if (typeof m.de !== 'string' || m.de === '' || typeof m.para !== 'string') throw new Error(`${nome} sem os trechos de e para`);
    const vezes = contar(texto, m.de);
    if (vezes !== 1) throw new Error(`${nome}: o trecho aparece ${vezes} vezes, e não uma`);
    texto = texto.replace(m.de, () => m.para);
  });
  return texto;
}

// Devolve o sw.js com a versão carimbada: o resumo SHA-256 dele mesmo, sem
// a linha da versão, e de cada arquivo da lista ARQUIVOS, lido por `ler`.
function carimbarServiceWorker(sw = fs.readFileSync(SERVICE_WORKER, 'utf8'), ler = (nome) => fs.readFileSync(path.join(PASTA_DO_APP, nome))) {
  if (!LINHA_DA_VERSAO.test(sw)) throw new Error('linha da VERSAO não encontrada em sw.js');
  const lista = sw.match(/const ARQUIVOS = \[([\s\S]*?)\];/);
  if (!lista) throw new Error('lista ARQUIVOS não encontrada em sw.js');
  const resumo = crypto.createHash('sha256');
  resumo.update(sw.replace(LINHA_DA_VERSAO, "const VERSAO = '';"));
  for (const [, nome] of lista[1].matchAll(/'([^']+)'/g)) {
    resumo.update(`\0${nome}\0`);
    resumo.update(ler(nome));
  }
  return sw.replace(LINHA_DA_VERSAO, `const VERSAO = 'prancheta-app-${resumo.digest('hex').slice(0, 12)}';`);
}

if (require.main === module) {
  const resultado = montar();
  const ler = (nome) => (nome === 'index.html' ? Buffer.from(resultado) : fs.readFileSync(path.join(PASTA_DO_APP, nome)));
  const swGravado = fs.readFileSync(SERVICE_WORKER, 'utf8');
  const swCarimbado = carimbarServiceWorker(swGravado, ler);
  if (process.argv.includes('--conferir')) {
    const gravado = fs.existsSync(DESTINO) ? fs.readFileSync(DESTINO, 'utf8') : null;
    if (gravado !== resultado) {
      console.error('web/app/index.html não corresponde à montagem; rode node web/montagem/montar.cjs');
      process.exit(1);
    }
    if (swGravado !== swCarimbado) {
      console.error('a VERSAO de web/app/sw.js não corresponde aos arquivos; rode node web/montagem/montar.cjs');
      process.exit(1);
    }
    console.log('web/app/index.html e a VERSAO de web/app/sw.js correspondem à montagem.');
  } else {
    fs.writeFileSync(DESTINO, resultado);
    fs.writeFileSync(SERVICE_WORKER, swCarimbado);
    console.log(`web/app/index.html montado com ${require('./mudancas.cjs').length} mudanças; ${swCarimbado.match(LINHA_DA_VERSAO)[0]}`);
  }
}

module.exports = { montar, carimbarServiceWorker, ORIGINAL, DESTINO, SERVICE_WORKER };
