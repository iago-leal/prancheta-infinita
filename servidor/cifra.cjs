// Conferência e limpeza da cifra ponta a ponta na pasta dos dados do
// servidor, etapa 02 do plano 005. Não decifra nada nem precisa da chave: só
// reconhece o formato dos envelopes, como servidor/armazem.cjs.
//
// Uso, como administrador, com o servidor rodando:
//   docker compose --env-file /etc/prancheta/ambiente -f /opt/prancheta/compose.yml exec servidor \
//     node atual/servidor/cifra.cjs /dados conferir
//   docker compose --env-file /etc/prancheta/ambiente -f /opt/prancheta/compose.yml exec servidor \
//     node atual/servidor/cifra.cjs /dados apagar-legiveis
//
// "conferir" só lê: mostra quantos documentos e arquivos atuais e quantas
// versões do histórico estão cifrados, legíveis ou cifrados com outra chave,
// e termina com erro se houver algum legível.
//
// "apagar-legiveis" faz a mesma conferência e, só se a cifra estiver ligada no
// servidor e todos os documentos e arquivos atuais estiverem cifrados com a
// chave dela, ou apagados, tira do histórico as versões legíveis e apaga os
// temporários antigos, restos de gravações interrompidas. Senão, não apaga
// nada. Pode rodar com o servidor no ar: uma versão acrescentada ao histórico
// durante a limpeza é conferida e mantida, se estiver cifrada.

'use strict';

const fsp = require('node:fs/promises');
const path = require('node:path');
const { chaveDoDocumento, chaveDoArquivoEmDisco } = require('./armazem.cjs');

// Temporários mais novos que isto podem ser de uma gravação em andamento.
const IDADE_DO_TEMPORARIO = 10 * 60 * 1000;
const dormir = (ms) => new Promise((pronto) => setTimeout(pronto, ms));

async function lerJson(arquivo) {
  try {
    return JSON.parse(await fsp.readFile(arquivo, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}

async function listar(pasta) {
  try {
    return (await fsp.readdir(pasta)).sort();
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

// Classifica um registro de documento: sem conteúdo, cifrado, de outra chave ou legível.
function classificarRegistro(registro, cifra) {
  if (!registro || registro.apagado) return 'apagado';
  const chave = chaveDoDocumento(registro.dados);
  if (!chave) return 'legivel';
  return cifra && chave === cifra.chave ? 'cifrado' : 'outraChave';
}

const contagem = () => ({ cifrado: 0, apagado: 0, legivel: 0, outraChave: 0, exemplos: [] });

function contar(total, classe, exemplo) {
  total[classe] += 1;
  if (classe !== 'cifrado' && classe !== 'apagado' && total.exemplos.length < 10) total.exemplos.push(exemplo);
}

/** Lê a pasta dos dados e conta o que está cifrado, sem mudar nada. */
async function conferir(pasta) {
  const cifra = await lerJson(path.join(pasta, 'cifra.json'));
  const documentos = contagem();
  for (const nome of await listar(path.join(pasta, 'documentos'))) {
    if (!nome.endsWith('.json')) continue;
    const doc = await lerJson(path.join(pasta, 'documentos', nome));
    if (doc) contar(documentos, classificarRegistro(doc.registro, cifra), doc.caminho);
  }
  const arquivos = contagem();
  for (const nome of await listar(path.join(pasta, 'arquivos'))) {
    if (!nome.endsWith('.bin')) continue;
    const id = nome.slice(0, -'.bin'.length);
    const chave = await chaveDoArquivoEmDisco(path.join(pasta, 'arquivos', nome));
    contar(arquivos, !chave ? 'legivel' : (cifra && chave === cifra.chave ? 'cifrado' : 'outraChave'), id);
  }
  const historico = contagem();
  for (const nome of await listar(path.join(pasta, 'historico'))) {
    if (!nome.endsWith('.jsonl')) continue;
    for (const linha of (await fsp.readFile(path.join(pasta, 'historico', nome), 'utf8')).split('\n')) {
      if (!linha) continue;
      let entrada;
      try {
        entrada = JSON.parse(linha);
      } catch (e) {
        continue;
      }
      contar(historico, classificarRegistro(entrada.registro, cifra), `${entrada.caminho} na posição ${entrada.pos}`);
    }
  }
  return { cifra, documentos, arquivos, historico };
}

// Mantém do histórico só as linhas sem conteúdo legível; uma linha cortada ou
// ilegível como JSON também sai, porque não se pode conferir o que ela guarda.
function filtrarLinhas(texto, cifra) {
  let removidas = 0;
  const mantidas = [];
  for (const linha of texto.split('\n')) {
    if (!linha) continue;
    let entrada;
    try {
      entrada = JSON.parse(linha);
    } catch (e) {
      removidas += 1;
      continue;
    }
    const classe = classificarRegistro(entrada.registro, cifra);
    if (classe === 'cifrado' || classe === 'apagado') mantidas.push(linha);
    else removidas += 1;
  }
  return { texto: mantidas.map((l) => `${l}\n`).join(''), removidas };
}

// Reescreve um arquivo do histórico sem as versões legíveis. O servidor só
// acrescenta linhas, abrindo o arquivo pelo nome a cada vez: depois da troca,
// o que ele tiver acrescentado ao arquivo antigo é conferido e levado ao novo.
async function limparArquivoDoHistorico(arquivo, cifra, { espera, aposLer }) {
  const antigo = await fsp.open(arquivo, 'r');
  try {
    const bruto = await antigo.readFile();
    // Só as linhas completas; o resto pode estar sendo escrito agora.
    const corte = bruto.lastIndexOf(10) + 1;
    const { texto, removidas } = filtrarLinhas(bruto.subarray(0, corte).toString('utf8'), cifra);
    if (removidas === 0) return 0;
    // Só para os testes: simula o servidor acrescentando uma versão neste intervalo.
    if (aposLer) await aposLer(arquivo);
    const temporario = `${arquivo}.${process.pid}.limpeza`;
    await fsp.writeFile(temporario, texto, { mode: 0o600 });
    await fsp.rename(temporario, arquivo);
    await dormir(espera);
    const { size } = await antigo.stat();
    if (size > corte) {
      const resto = Buffer.alloc(size - corte);
      await antigo.read(resto, 0, resto.length, corte);
      const extra = filtrarLinhas(resto.toString('utf8'), cifra);
      if (extra.texto) await fsp.appendFile(arquivo, extra.texto);
      return removidas + extra.removidas;
    }
    return removidas;
  } finally {
    await antigo.close();
  }
}

/**
 * Confere e, se tudo o que é atual estiver cifrado com a chave do servidor,
 * tira do histórico as versões legíveis. Devolve { apagou, motivo, ... }.
 */
async function apagarLegiveis(pasta, { espera = 2000, agora = Date.now(), aposLer } = {}) {
  const antes = await conferir(pasta);
  const { cifra, documentos, arquivos } = antes;
  if (!cifra) return { apagou: false, motivo: 'a cifra ainda não foi ligada no servidor', antes };
  const pendentes = documentos.legivel + documentos.outraChave + arquivos.legivel + arquivos.outraChave;
  if (pendentes > 0) return { apagou: false, motivo: `${pendentes} documentos ou arquivos atuais ainda não estão cifrados com a chave do servidor`, antes };
  let versoes = 0;
  for (const nome of await listar(path.join(pasta, 'historico'))) {
    if (nome.endsWith('.jsonl')) versoes += await limparArquivoDoHistorico(path.join(pasta, 'historico', nome), cifra, { espera, aposLer });
  }
  let temporarios = 0;
  for (const sub of ['documentos', 'arquivos', 'historico']) {
    for (const nome of await listar(path.join(pasta, sub))) {
      if (!nome.endsWith('.tmp') && !nome.endsWith('.limpeza')) continue;
      const arquivo = path.join(pasta, sub, nome);
      const { mtimeMs } = await fsp.stat(arquivo);
      if (agora - mtimeMs < IDADE_DO_TEMPORARIO) continue;
      await fsp.unlink(arquivo);
      temporarios += 1;
    }
  }
  return { apagou: true, versoes, temporarios, antes, depois: await conferir(pasta) };
}

function descrever(titulo, c) {
  const linhas = [`${titulo}: ${c.cifrado} cifrados, ${c.apagado} sem conteúdo, ${c.legivel} legíveis, ${c.outraChave} com outra chave`];
  for (const exemplo of c.exemplos) linhas.push(`  não cifrado: ${exemplo}`);
  return linhas.join('\n');
}

function relatorio({ cifra, documentos, arquivos, historico }) {
  return [
    cifra ? `cifra ligada desde a posição ${cifra.desde}, em ${cifra.em}` : 'cifra ainda não ligada no servidor',
    descrever('documentos atuais', documentos),
    descrever('arquivos', arquivos),
    descrever('versões no histórico', historico),
  ].join('\n');
}

async function principal([pasta, acao]) {
  if (!pasta || !['conferir', 'apagar-legiveis'].includes(acao)) {
    console.error('uso: node servidor/cifra.cjs <pasta dos dados> conferir|apagar-legiveis');
    return 2;
  }
  if (acao === 'conferir') {
    const r = await conferir(pasta);
    console.log(relatorio(r));
    const legiveis = [r.documentos, r.arquivos, r.historico].reduce((n, c) => n + c.legivel + c.outraChave, 0);
    console.log(legiveis === 0 && r.cifra ? 'nada legível na pasta dos dados' : `${legiveis} itens não estão cifrados com a chave do servidor`);
    return legiveis === 0 && r.cifra ? 0 : 1;
  }
  const r = await apagarLegiveis(pasta);
  if (!r.apagou) {
    console.log(relatorio(r.antes));
    console.error(`nada foi apagado: ${r.motivo}`);
    return 1;
  }
  console.log(`apagadas ${r.versoes} versões legíveis do histórico e ${r.temporarios} temporários antigos`);
  console.log(relatorio(r.depois));
  return 0;
}

if (require.main === module) {
  principal(process.argv.slice(2)).then((codigo) => process.exit(codigo), (e) => {
    console.error(e.message);
    process.exit(1);
  });
}

module.exports = { conferir, apagarLegiveis, principal };
