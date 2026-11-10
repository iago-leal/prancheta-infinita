// Biblioteca de livros da Prancheta, etapa 03 do plano 005: os PDFs e EPUBs
// de uma pasta, na VPS a subpasta de livros do WebDAV, montada só para
// leitura no contêiner. O servidor lista os livros e entrega cada um, sempre
// com a chave de um aparelho, por servidor/servidor.cjs.
//
// - A pasta é percorrida sem seguir atalhos, e pastas ocultas, como as .sdr
//   em que o KOReader guarda o progresso de cada livro, ficam de fora.
// - Cada livro é identificado pelo mesmo resumo parcial MD5 que o KOReader
//   calcula: o MD5 de trechos de 1 KB no começo do arquivo e nas posições
//   1 KB, 4 KB, 16 KB, e assim por diante, multiplicando por 4, até 1 GB ou o
//   fim do arquivo. Ele não muda quando o livro é renomeado ou trocado de
//   pasta, o que permite ligar marcações e, mais adiante, o progresso do
//   KOReader ao livro.
// - Um livro só é entregue pelo identificador, se estiver na lista; o caminho
//   nunca vem do pedido, e o arquivo é conferido dentro da pasta na hora de abrir.
// - A lista é refeita no máximo a cada `validade` ms, e o resumo de cada
//   arquivo só é recalculado quando o tamanho ou a data dele mudam.
// - Cada livro vai com título e autor, etapa 01 do plano 008: os de um EPUB
//   são lidos de dentro do arquivo, por servidor/epub.cjs, junto com o
//   resumo; um PDF, e um EPUB sem esses dados ou que não pôde ser lido, ficam
//   com o nome do arquivo, sem a extensão, como título, e com a primeira
//   pasta do caminho que tenha cara de nome como autor. Uma pasta com cara de
//   identificador, como as que alguns leitores criam para cada livro, com o
//   resumo dele no nome, não é nome de autor, e o livro fica sem autor.

'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { lerDadosDoEpub } = require('./epub.cjs');

const TIPOS = { '.pdf': 'application/pdf', '.epub': 'application/epub+zip' };
const ID_DE_LIVRO = /^[0-9a-f]{32}$/;
const TRECHO = 1024;

/** O resumo parcial MD5 do KOReader, de util.partialMD5. */
async function resumoDoKoreader(caminho) {
  const arquivo = await fsp.open(caminho, 'r');
  try {
    const md5 = crypto.createHash('md5');
    const trecho = Buffer.alloc(TRECHO);
    // No KOReader, a primeira posição, 1024 deslocado por -2 bits, dá zero.
    for (let i = -1; i <= 10; i++) {
      const posicao = i < 0 ? 0 : TRECHO * 4 ** i;
      const { bytesRead } = await arquivo.read(trecho, 0, TRECHO, posicao);
      if (bytesRead === 0) break;
      md5.update(trecho.subarray(0, bytesRead));
    }
    return md5.digest('hex');
  } finally {
    await arquivo.close();
  }
}

const oculto = (nome) => nome.startsWith('.') || nome.endsWith('.sdr');

/**
 * Diz se o nome de uma pasta parece um identificador, e não um nome de gente:
 * sem nenhuma letra, só algarismos hexadecimais e hifens, como um resumo ou
 * um UUID, ou uma sequência comprida, sem espaços, que mistura letras e algarismos.
 */
function pareceIdentificador(nome) {
  if (!/\p{L}/u.test(nome)) return true;
  if (/^[0-9a-f]{8}(-?[0-9a-f]{4}){3}-?[0-9a-f]{12}$/i.test(nome) || /^[0-9a-f]{16,}$/i.test(nome)) return true;
  return nome.length >= 20 && /^[\w-]+$/.test(nome) && /\d/.test(nome);
}

/** A primeira pasta do caminho com cara de nome, para servir de autor, ou ''. */
const pastaDoAutor = (relativa) => relativa.split('/').find((pasta) => pasta && !pareceIdentificador(pasta)) || '';

class Biblioteca {
  /**
   * @param pasta a pasta da biblioteca, ou null para uma biblioteca vazia.
   * @param opcoes.validade por quanto tempo uma lista é reaproveitada, em ms.
   */
  constructor(pasta, { validade = 30000 } = {}) {
    this.pasta = pasta ? path.resolve(pasta) : null;
    this.validade = validade;
    this._lista = null;
    this._feitaEm = 0;
    this._resumos = new Map();
    this._fazendo = null;
  }

  /** Os livros, na ordem das pastas e dos nomes, sem o caminho completo na VPS. */
  async listar() {
    const indice = await this._indice();
    return [...indice.values()].map(({ id, nome, pasta, tipo, bytes, modificadoEm, titulo, autor }) => ({ id, nome, pasta, tipo, bytes, modificadoEm, titulo, autor }));
  }

  // O índice por identificador, refeito quando passa da validade.
  async _indice({ forcar = false } = {}) {
    if (!this.pasta) return new Map();
    if (!forcar && this._lista && Date.now() - this._feitaEm < this.validade) return this._lista;
    if (!this._fazendo) {
      this._fazendo = this._percorrer().then((lista) => {
        this._lista = lista;
        this._feitaEm = Date.now();
        return lista;
      }).finally(() => {
        this._fazendo = null;
      });
    }
    return this._fazendo;
  }

  async _percorrer() {
    const indice = new Map();
    const vistos = new Set();
    let raiz;
    try {
      raiz = await fsp.realpath(this.pasta);
    } catch (e) {
      if (e.code === 'ENOENT') return indice;
      throw e;
    }
    const pendentes = [''];
    while (pendentes.length) {
      const relativa = pendentes.shift();
      let entradas;
      try {
        entradas = await fsp.readdir(path.join(raiz, relativa), { withFileTypes: true });
      } catch (e) {
        // Uma pasta que não pode ser lida fica de fora, sem derrubar a lista.
        if (e.code === 'EACCES' || e.code === 'ENOENT') continue;
        throw e;
      }
      entradas.sort((a, b) => a.name.localeCompare(b.name));
      for (const entrada of entradas) {
        if (oculto(entrada.name) || entrada.isSymbolicLink()) continue;
        const caminhoRelativo = relativa ? `${relativa}/${entrada.name}` : entrada.name;
        if (entrada.isDirectory()) {
          pendentes.push(caminhoRelativo);
          continue;
        }
        const tipo = TIPOS[path.extname(entrada.name).toLowerCase()];
        if (!entrada.isFile() || !tipo) continue;
        const completo = path.join(raiz, caminhoRelativo);
        let estado;
        try {
          estado = await fsp.lstat(completo);
        } catch (e) {
          continue;
        }
        if (!estado.isFile()) continue;
        vistos.add(completo);
        const marca = `${estado.size}:${estado.mtimeMs}`;
        let resumo = this._resumos.get(completo);
        if (!resumo || resumo.marca !== marca) {
          try {
            resumo = { marca, id: await resumoDoKoreader(completo) };
          } catch (e) {
            continue;
          }
          resumo.dados = (tipo === TIPOS['.epub'] && await lerDadosDoEpub(completo)) || {};
          this._resumos.set(completo, resumo);
        }
        // O mesmo conteúdo em dois lugares aparece uma vez, no primeiro encontrado.
        if (indice.has(resumo.id)) continue;
        indice.set(resumo.id, {
          id: resumo.id,
          nome: entrada.name,
          pasta: relativa,
          tipo,
          bytes: estado.size,
          modificadoEm: Math.round(estado.mtimeMs),
          titulo: resumo.dados.titulo || path.basename(entrada.name, path.extname(entrada.name)),
          autor: resumo.dados.autor || pastaDoAutor(relativa),
          caminho: completo,
        });
      }
    }
    for (const caminho of this._resumos.keys()) if (!vistos.has(caminho)) this._resumos.delete(caminho);
    return indice;
  }

  /**
   * Abre um livro pelo identificador: devolve { livro, fluxo } ou null. Um
   * identificador que não está na lista refaz a lista uma vez, para achar um
   * livro acrescentado há pouco.
   */
  async abrir(id) {
    if (!ID_DE_LIVRO.test(String(id))) return null;
    let livro = (await this._indice()).get(id);
    if (!livro) livro = (await this._indice({ forcar: true })).get(id);
    if (!livro) return null;
    // Conferido de novo na hora de abrir, porque a lista pode ter alguns
    // segundos: nenhuma pasta do caminho virou atalho, e o arquivo continua
    // dentro da pasta. O próprio arquivo é aberto sem seguir atalho.
    const raiz = await fsp.realpath(this.pasta);
    let real;
    try {
      real = await fsp.realpath(path.dirname(livro.caminho));
    } catch (e) {
      return null;
    }
    if (real !== path.dirname(livro.caminho) || (real !== raiz && !real.startsWith(raiz + path.sep))) return null;
    let descritor;
    try {
      descritor = await fsp.open(livro.caminho, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    } catch (e) {
      return null;
    }
    const estado = await descritor.stat();
    if (!estado.isFile()) {
      await descritor.close();
      return null;
    }
    const fluxo = descritor.createReadStream({ autoClose: true });
    return { livro: { ...livro, bytes: estado.size }, fluxo };
  }
}

module.exports = { Biblioteca, resumoDoKoreader, pareceIdentificador, ID_DE_LIVRO, TIPOS };
