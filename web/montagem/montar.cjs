// Monta web/app/index.html a partir do código original do artefato,
// web/index.html, aplicando as mudanças listadas em mudancas.cjs.
//
// Uso, a partir da raiz do repositório:
//   node web/montagem/montar.cjs            grava web/app/index.html
//   node web/montagem/montar.cjs --conferir falha se o arquivo gravado não
//                                           for o resultado da montagem

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ORIGINAL = path.join(__dirname, '..', 'index.html');
const DESTINO = path.join(__dirname, '..', 'app', 'index.html');

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

if (require.main === module) {
  const resultado = montar();
  if (process.argv.includes('--conferir')) {
    const gravado = fs.existsSync(DESTINO) ? fs.readFileSync(DESTINO, 'utf8') : null;
    if (gravado !== resultado) {
      console.error('web/app/index.html não corresponde à montagem; rode node web/montagem/montar.cjs');
      process.exit(1);
    }
    console.log('web/app/index.html corresponde à montagem.');
  } else {
    fs.writeFileSync(DESTINO, resultado);
    console.log(`web/app/index.html montado com ${require('./mudancas.cjs').length} mudanças.`);
  }
}

module.exports = { montar, ORIGINAL, DESTINO };
