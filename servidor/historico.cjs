// Consulta as versões guardadas de um documento no histórico do servidor,
// para recuperar um documento sobrescrito ou apagado. Só lê a pasta dos dados.
//
// Uso:
//   node servidor/historico.cjs <pasta dos dados> listar <caminho>
//   node servidor/historico.cjs <pasta dos dados> mostrar <caminho> <posição>
//
// "listar" mostra uma linha por versão: posição, data em UTC, aparelho, se
// era uma exclusão e o tamanho dos dados. "mostrar" imprime o registro da
// versão, no formato do banco local, para que ela seja recriada num aparelho.

'use strict';

const { Armazem } = require('./armazem.cjs');

async function principal([pasta, acao, caminho, posicao]) {
  if (!pasta || !caminho || !['listar', 'mostrar'].includes(acao)) {
    console.error('uso: node servidor/historico.cjs <pasta dos dados> listar|mostrar <caminho> [posição]');
    return 2;
  }
  // diasDeHistorico infinito: a consulta não apaga nada do histórico.
  const armazem = await Armazem.abrir(pasta, { diasDeHistorico: Infinity });
  const versoes = await armazem.historico(caminho);
  if (acao === 'listar') {
    if (!versoes.length) console.log(`nenhuma versão guardada de ${caminho}`);
    for (const v of versoes) {
      const tamanho = v.registro.dados ? JSON.stringify(v.registro.dados).length : 0;
      console.log(`${v.pos}\t${new Date(v.em).toISOString()}\t${v.dispositivo}\t${v.registro.apagado ? 'apagado' : 'gravado'}\t${tamanho} bytes`);
    }
    return 0;
  }
  const versao = versoes.find((v) => v.pos === Number(posicao));
  if (!versao) {
    console.error(`não há versão de ${caminho} na posição ${posicao}`);
    return 1;
  }
  console.log(JSON.stringify(versao.registro, null, 2));
  return 0;
}

if (require.main === module) {
  principal(process.argv.slice(2)).then((codigo) => process.exit(codigo), (e) => {
    console.error(e.message);
    process.exit(1);
  });
}

module.exports = { principal };
