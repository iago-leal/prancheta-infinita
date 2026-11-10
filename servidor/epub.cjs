// Título e autor de um EPUB, etapa 01 do plano 008: lidos de dentro do
// arquivo, para a lista da biblioteca mostrar a obra e quem a escreveu, e não
// só o nome do arquivo.
//
// - Um EPUB é um arquivo ZIP. O arquivo META-INF/container.xml aponta o
//   documento do pacote, e nele ficam o título, em dc:title, e os autores, em
//   dc:creator. Só esses dois arquivos são lidos, pelo índice do ZIP, sem
//   abrir o resto do livro e sem bibliotecas de terceiros.
// - Os livros vêm de uma pasta que o servidor não controla: cada tamanho tem
//   um limite, nada é escrito em disco, e qualquer coisa fora do esperado,
//   como um ZIP estragado, cifrado ou do formato de 64 bits, faz a leitura
//   devolver null. Quem chama fica então com o nome do arquivo.

'use strict';

const fsp = require('node:fs/promises');
const zlib = require('node:zlib');

const FIM_DO_INDICE = 0x06054b50;
const ENTRADA_DO_INDICE = 0x02014b50;
const CABECALHO_LOCAL = 0x04034b50;
// O fim do índice tem 22 bytes e pode ser seguido de um comentário de até 64 KB.
const CAUDA = 22 + 0xffff;
const LIMITE_DO_INDICE = 8 * 1024 * 1024;
const LIMITE_COMPRIMIDO = 1024 * 1024;
const LIMITE_ABERTO = 4 * 1024 * 1024;
const LIMITE_DO_TEXTO = 300;
const LIMITE_DE_AUTORES = 3;

async function lerTrecho(arquivo, posicao, tamanho) {
  const trecho = Buffer.alloc(tamanho);
  const { bytesRead } = await arquivo.read(trecho, 0, tamanho, posicao);
  return bytesRead === tamanho ? trecho : null;
}

// O índice do ZIP: o nome de cada arquivo e onde ele está.
async function lerIndice(arquivo, tamanho) {
  const tamanhoDaCauda = Math.min(tamanho, CAUDA);
  const cauda = await lerTrecho(arquivo, tamanho - tamanhoDaCauda, tamanhoDaCauda);
  if (!cauda) return null;
  let fim = -1;
  for (let i = cauda.length - 22; i >= 0; i--) {
    if (cauda.readUInt32LE(i) === FIM_DO_INDICE) {
      fim = i;
      break;
    }
  }
  if (fim < 0) return null;
  const entradas = cauda.readUInt16LE(fim + 10);
  const tamanhoDoIndice = cauda.readUInt32LE(fim + 12);
  const comecoDoIndice = cauda.readUInt32LE(fim + 16);
  // Os valores cheios marcam o formato de 64 bits, que não é lido aqui.
  if (entradas === 0xffff || tamanhoDoIndice === 0xffffffff || comecoDoIndice === 0xffffffff) return null;
  if (tamanhoDoIndice > LIMITE_DO_INDICE || comecoDoIndice + tamanhoDoIndice > tamanho) return null;
  const dados = await lerTrecho(arquivo, comecoDoIndice, tamanhoDoIndice);
  if (!dados) return null;
  const indice = new Map();
  let p = 0;
  for (let n = 0; n < entradas; n++) {
    if (p + 46 > dados.length || dados.readUInt32LE(p) !== ENTRADA_DO_INDICE) return null;
    const tamanhoDoNome = dados.readUInt16LE(p + 28);
    const fimDaEntrada = p + 46 + tamanhoDoNome + dados.readUInt16LE(p + 30) + dados.readUInt16LE(p + 32);
    if (fimDaEntrada > dados.length) return null;
    indice.set(dados.toString('utf8', p + 46, p + 46 + tamanhoDoNome), {
      cifrado: (dados.readUInt16LE(p + 8) & 1) === 1,
      metodo: dados.readUInt16LE(p + 10),
      comprimido: dados.readUInt32LE(p + 20),
      aberto: dados.readUInt32LE(p + 24),
      posicao: dados.readUInt32LE(p + 42),
    });
    p = fimDaEntrada;
  }
  return indice;
}

// O conteúdo de um arquivo do ZIP, em texto, ou null.
async function lerArquivoDoZip(arquivo, tamanho, entrada) {
  if (!entrada || entrada.cifrado) return null;
  if (entrada.comprimido > LIMITE_COMPRIMIDO || entrada.aberto > LIMITE_ABERTO) return null;
  const cabecalho = await lerTrecho(arquivo, entrada.posicao, 30);
  if (!cabecalho || cabecalho.readUInt32LE(0) !== CABECALHO_LOCAL) return null;
  const comeco = entrada.posicao + 30 + cabecalho.readUInt16LE(26) + cabecalho.readUInt16LE(28);
  if (comeco + entrada.comprimido > tamanho) return null;
  const dados = entrada.comprimido ? await lerTrecho(arquivo, comeco, entrada.comprimido) : Buffer.alloc(0);
  if (!dados) return null;
  let aberto;
  if (entrada.metodo === 0) aberto = dados;
  else if (entrada.metodo === 8) aberto = zlib.inflateRawSync(dados, { maxOutputLength: LIMITE_ABERTO });
  else return null;
  // Um documento em UTF-16 fica de fora: sem ele, vale o nome do arquivo.
  if (aberto.length >= 2 && ((aberto[0] === 0xff && aberto[1] === 0xfe) || (aberto[0] === 0xfe && aberto[1] === 0xff))) return null;
  return aberto.toString('utf8').replace(/^﻿/, '');
}

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function semEntidades(texto) {
  return texto.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]+);/gi, (tudo, nome) => {
    if (nome[0] !== '#') return Object.prototype.hasOwnProperty.call(ENTIDADES, nome.toLowerCase()) ? ENTIDADES[nome.toLowerCase()] : tudo;
    const codigo = nome[1] === 'x' || nome[1] === 'X' ? parseInt(nome.slice(2), 16) : parseInt(nome.slice(1), 10);
    return codigo > 0 && codigo <= 0x10ffff && !(codigo >= 0xd800 && codigo <= 0xdfff) ? String.fromCodePoint(codigo) : '';
  });
}

// O texto de um elemento, sem as marcas de dentro dele, numa linha só e sem caracteres de controle.
function limpar(texto) {
  const semMarcas = texto.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]*>/g, ' ');
  // eslint-disable-next-line no-control-regex
  return semEntidades(semMarcas).replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, LIMITE_DO_TEXTO);
}

// O texto de cada elemento com este nome, com qualquer prefixo, na ordem do documento.
function elementos(xml, nome) {
  const achados = [];
  const marca = new RegExp(`<(?:[\\w.-]+:)?${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${nome}\\s*>`, 'gi');
  for (const achado of xml.matchAll(marca)) {
    const texto = limpar(achado[1]);
    if (texto) achados.push(texto);
  }
  return achados;
}

/** O título e o autor escritos no documento do pacote de um EPUB. */
function dadosDoPacote(xml) {
  const metadados = /<(?:[\w.-]+:)?metadata(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?metadata\s*>/i.exec(xml);
  if (!metadados) return null;
  const titulo = elementos(metadados[1], 'title')[0];
  const autores = [...new Set(elementos(metadados[1], 'creator'))].slice(0, LIMITE_DE_AUTORES);
  const dados = {};
  if (titulo) dados.titulo = titulo;
  // Mais de um autor: separados por ponto e vírgula, porque a vírgula aparece dentro de um nome, como em "Assis, Machado de".
  if (autores.length) dados.autor = autores.join('; ').slice(0, LIMITE_DO_TEXTO);
  return Object.keys(dados).length ? dados : null;
}

/** O caminho do documento do pacote, escrito em META-INF/container.xml. */
function caminhoDoPacote(xml) {
  const achado = /<(?:[\w.-]+:)?rootfile\s[^>]*?full-path\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(xml);
  const caminho = achado ? semEntidades(achado[1] !== undefined ? achado[1] : achado[2]).trim() : '';
  return caminho && caminho.length <= 1024 ? caminho : null;
}

/**
 * O título e o autor de um EPUB: { titulo, autor }, só com o que foi achado,
 * ou null quando o arquivo não tem esses dados ou não pôde ser lido.
 */
async function lerDadosDoEpub(caminho) {
  let arquivo;
  try {
    arquivo = await fsp.open(caminho, 'r');
    const { size: tamanho } = await arquivo.stat();
    if (tamanho < 22) return null;
    const indice = await lerIndice(arquivo, tamanho);
    if (!indice) return null;
    const recipiente = await lerArquivoDoZip(arquivo, tamanho, indice.get('META-INF/container.xml'));
    const pacote = recipiente && caminhoDoPacote(recipiente);
    const xml = pacote && await lerArquivoDoZip(arquivo, tamanho, indice.get(pacote));
    return xml ? dadosDoPacote(xml) : null;
  } catch (e) {
    return null;
  } finally {
    if (arquivo) await arquivo.close().catch(() => {});
  }
}

module.exports = { lerDadosDoEpub, dadosDoPacote, caminhoDoPacote };
