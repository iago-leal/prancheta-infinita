// Armazém do servidor de sincronização: guarda em disco a cópia central dos
// quadros, no formato do banco local da Prancheta, e o registro das mudanças.
//
// Pasta de dados:
// - registro.jsonl: uma linha por mudança aceita, com a posição, o caminho,
//   o aparelho e o número da mudança nele; é o índice, lido inteiro ao abrir;
// - documentos/<sha256 do caminho>.json: a versão atual de cada documento,
//   com o registro exatamente como o aparelho o enviou;
// - arquivos/<id>.bin e arquivos/<id>.json: os arquivos enviados e os dados deles;
// - historico/<AAAA-MM-DD>.jsonl: cada versão aceita, com o registro inteiro,
//   num arquivo por dia, em UTC, apagado depois de `diasDeHistorico` dias; serve
//   para recuperar um documento sobrescrito ou apagado, por servidor/historico.cjs;
// - cifra.json: a chave da cifra ponta a ponta, só pelo identificador, e a
//   posição em que ela foi ligada, gravados na primeira gravação cifrada.
//
// Cifra ponta a ponta, etapa 02 do plano 005: o servidor não decifra nada. Ele
// só reconhece o formato dos envelopes de web/app/compat/cifra.js e o
// identificador da chave que vem neles. Depois da primeira gravação cifrada,
// recusa gravações legíveis e as de outra chave, para que nenhum aparelho sem
// a chave volte a pôr quadros legíveis na VPS; um arquivo legível pode dar
// lugar ao mesmo arquivo cifrado, com o mesmo id, uma vez.
//
// Cada documento é gravado num arquivo temporário e renomeado, e só depois a
// linha do registro é acrescentada. Ao abrir, uma linha cortada no fim do
// registro é descartada, e um documento ou arquivo gravado sem a sua linha,
// por uma queda entre as duas gravações, ganha a linha que faltava.

'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const ID_DE_ARQUIVO = /^[\w-]{8,64}$/;
const ID_DA_CHAVE = /^[A-Za-z0-9_-]{22}$/;
const IV_DO_ENVELOPE = /^[A-Za-z0-9_-]{16}$/;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const MAGICO = Buffer.from('PRCIFRA1');
// O começo de um arquivo cifrado: o marcador, o identificador da chave, o vetor
// inicial e, no mínimo, a etiqueta de autenticação.
const MENOR_ARQUIVO_CIFRADO = MAGICO.length + 16 + 12 + 16;

/** O identificador da chave de um envelope de documento, ou null se os dados não estão cifrados. */
function chaveDoDocumento(dados) {
  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) return null;
  if (Object.keys(dados).length !== 4 || dados.cifra !== 1) return null;
  if (typeof dados.chave !== 'string' || !ID_DA_CHAVE.test(dados.chave)) return null;
  if (typeof dados.iv !== 'string' || !IV_DO_ENVELOPE.test(dados.iv)) return null;
  if (typeof dados.conteudo !== 'string' || !BASE64URL.test(dados.conteudo)) return null;
  return dados.chave;
}

/** O identificador da chave de um arquivo cifrado, pelo começo dele, ou null se ele é legível. */
function chaveDoArquivo(conteudo) {
  if (!conteudo || conteudo.length < MENOR_ARQUIVO_CIFRADO) return null;
  if (!conteudo.subarray(0, MAGICO.length).equals(MAGICO)) return null;
  return conteudo.subarray(MAGICO.length, MAGICO.length + 16).toString('base64url');
}

/** O identificador da chave de um arquivo guardado em disco, lendo só o começo dele. */
async function chaveDoArquivoEmDisco(caminho) {
  const arquivo = await fsp.open(caminho, 'r');
  try {
    const cabeca = Buffer.alloc(MENOR_ARQUIVO_CIFRADO);
    const { bytesRead } = await arquivo.read(cabeca, 0, cabeca.length, 0);
    return chaveDoArquivo(cabeca.subarray(0, bytesRead));
  } finally {
    await arquivo.close();
  }
}

const sha256 = (dados) => crypto.createHash('sha256').update(dados).digest('hex');

function erro(codigo, mensagem) {
  const e = new Error(mensagem);
  e.codigo = codigo;
  return e;
}

async function gravarAtomico(destino, conteudo) {
  const temporario = `${destino}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  const arquivo = await fsp.open(temporario, 'w');
  try {
    await arquivo.writeFile(conteudo);
    await arquivo.sync();
  } finally {
    await arquivo.close();
  }
  await fsp.rename(temporario, destino);
}

const DIA = 24 * 60 * 60 * 1000;
const dataDe = (ms) => new Date(ms).toISOString().slice(0, 10);

class Armazem {
  constructor(pasta, { diasDeHistorico = 30 } = {}) {
    this.pasta = pasta;
    this.diasDeHistorico = diasDeHistorico;
    this.posicao = 0;
    // Última posição e autoria de cada caminho, inclusive _arquivos/<id>.
    this.ultimas = new Map();
    // Mudanças já aplicadas, por "aparelho:número", com a posição que ganharam.
    this.aplicadas = new Map();
    // A cifra ligada: { chave, desde, em }, ou null enquanto não houver gravação cifrada.
    this.cifra = null;
    this._fila = Promise.resolve();
  }

  static async abrir(pasta, opcoes = {}) {
    const armazem = new Armazem(pasta, opcoes);
    await fsp.mkdir(path.join(pasta, 'documentos'), { recursive: true });
    await fsp.mkdir(path.join(pasta, 'arquivos'), { recursive: true });
    await fsp.mkdir(path.join(pasta, 'historico'), { recursive: true });
    await armazem._lerCifra();
    await armazem._lerRegistro();
    await armazem._recuperar();
    await armazem._podarHistorico();
    return armazem;
  }

  // Guarda a versão aceita no arquivo do dia.
  async _arquivarVersao(entrada, registro) {
    const destino = path.join(this.pasta, 'historico', `${dataDe(entrada.em)}.jsonl`);
    const arquivo = await fsp.open(destino, 'a');
    try {
      await arquivo.appendFile(`${JSON.stringify({ ...entrada, registro })}\n`);
      await arquivo.sync();
    } finally {
      await arquivo.close();
    }
  }

  // Apaga os arquivos de histórico mais antigos que o prazo.
  async _podarHistorico(agora = Date.now()) {
    if (!Number.isFinite(this.diasDeHistorico)) return;
    const limite = dataDe(agora - this.diasDeHistorico * DIA);
    for (const nome of await fsp.readdir(path.join(this.pasta, 'historico'))) {
      const m = nome.match(/^(\d{4}-\d{2}-\d{2})\.jsonl$/);
      if (m && m[1] < limite) await fsp.unlink(path.join(this.pasta, 'historico', nome));
    }
  }

  /** As versões guardadas de um documento, da mais antiga para a mais nova. */
  async historico(caminho) {
    const versoes = [];
    const nomes = (await fsp.readdir(path.join(this.pasta, 'historico'))).filter((n) => n.endsWith('.jsonl')).sort();
    for (const nome of nomes) {
      for (const linha of (await fsp.readFile(path.join(this.pasta, 'historico', nome), 'utf8')).split('\n')) {
        if (!linha) continue;
        let entrada;
        try {
          entrada = JSON.parse(linha);
        } catch (e) {
          continue;
        }
        if (entrada.caminho === caminho) versoes.push(entrada);
      }
    }
    return versoes.sort((a, b) => a.pos - b.pos);
  }

  get _registro() {
    return path.join(this.pasta, 'registro.jsonl');
  }

  get _arquivoDaCifra() {
    return path.join(this.pasta, 'cifra.json');
  }

  async _lerCifra() {
    try {
      this.cifra = JSON.parse(await fsp.readFile(this._arquivoDaCifra, 'utf8'));
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }

  // Confere a cifra de um pedido antes de gravar qualquer parte dele. A
  // primeira gravação cifrada liga a cifra, com a chave dela; daí em diante,
  // o servidor recusa gravações legíveis e as de outra chave.
  async _conferirCifra(chaves, legivel) {
    if (!this.cifra && chaves.size > 0) {
      if (chaves.size > 1) throw erro('cifra_diferente', 'o pedido mistura chaves de cifra diferentes');
      const cifra = { chave: [...chaves][0], desde: this.posicao, em: new Date().toISOString() };
      await gravarAtomico(this._arquivoDaCifra, JSON.stringify(cifra));
      this.cifra = cifra;
    }
    if (!this.cifra) return;
    if (legivel) throw erro('cifra_exigida', 'o servidor só aceita quadros cifrados');
    for (const chave of chaves) {
      if (chave !== this.cifra.chave) throw erro('cifra_diferente', 'quadro cifrado com outra chave');
    }
  }

  _arquivoDoDocumento(caminho) {
    return path.join(this.pasta, 'documentos', `${sha256(caminho)}.json`);
  }

  _arquivoBinario(id) {
    return path.join(this.pasta, 'arquivos', `${id}.bin`);
  }

  _arquivoDeDados(id) {
    return path.join(this.pasta, 'arquivos', `${id}.json`);
  }

  _anotar(entrada) {
    this.posicao = Math.max(this.posicao, entrada.pos);
    this.ultimas.set(entrada.caminho, { pos: entrada.pos, dispositivo: entrada.dispositivo, seq: entrada.seq });
    if (entrada.seq != null) this.aplicadas.set(`${entrada.dispositivo}:${entrada.seq}`, entrada.pos);
  }

  async _lerRegistro() {
    let texto;
    try {
      texto = await fsp.readFile(this._registro, 'utf8');
    } catch (e) {
      if (e.code === 'ENOENT') return;
      throw e;
    }
    let validos = 0;
    for (const linha of texto.split('\n')) {
      if (linha === '') {
        validos += 1;
        continue;
      }
      let entrada;
      try {
        entrada = JSON.parse(linha);
      } catch (e) {
        break;
      }
      this._anotar(entrada);
      validos += Buffer.byteLength(linha) + 1;
    }
    // Uma queda no meio de uma linha deixa um fim cortado, que é descartado.
    const tamanho = Buffer.byteLength(texto);
    const corte = Math.min(validos, tamanho);
    if (corte < tamanho) await fsp.truncate(this._registro, corte);
  }

  async _acrescentar(entrada) {
    const arquivo = await fsp.open(this._registro, 'a');
    try {
      await arquivo.appendFile(`${JSON.stringify(entrada)}\n`);
      await arquivo.sync();
    } finally {
      await arquivo.close();
    }
    this._anotar(entrada);
  }

  async _recuperar() {
    const faltantes = [];
    for (const nome of await fsp.readdir(path.join(this.pasta, 'documentos'))) {
      if (!nome.endsWith('.json')) continue;
      const doc = JSON.parse(await fsp.readFile(path.join(this.pasta, 'documentos', nome), 'utf8'));
      if (doc.pos > this.posicao) faltantes.push({ pos: doc.pos, caminho: doc.caminho, dispositivo: doc.dispositivo, seq: doc.seq, tipo: doc.registro.apagado ? 'delete' : 'set' });
    }
    for (const nome of await fsp.readdir(path.join(this.pasta, 'arquivos'))) {
      if (!nome.endsWith('.json')) continue;
      const dados = JSON.parse(await fsp.readFile(path.join(this.pasta, 'arquivos', nome), 'utf8'));
      if (dados.pos > this.posicao) faltantes.push({ pos: dados.pos, caminho: `_arquivos/${dados.id}`, dispositivo: dados.dispositivo, seq: null, tipo: 'arquivo' });
    }
    faltantes.sort((a, b) => a.pos - b.pos);
    for (const entrada of faltantes) await this._acrescentar({ ...entrada, em: Date.now() });
  }

  // As gravações passam uma de cada vez, na ordem em que chegam.
  _emFila(tarefa) {
    const resultado = this._fila.then(tarefa);
    this._fila = resultado.catch(() => {});
    return resultado;
  }

  async lerDocumento(caminho) {
    try {
      return JSON.parse(await fsp.readFile(this._arquivoDoDocumento(caminho), 'utf8'));
    } catch (e) {
      if (e.code === 'ENOENT') return null;
      throw e;
    }
  }

  /**
   * Aplica as mudanças de um aparelho, na ordem recebida. Cada mudança traz o
   * número dela no aparelho, o registro do documento como o banco local o
   * guarda e a base, a posição da versão do documento que o aparelho tinha
   * quando o mudou, ou null se nunca o recebeu do servidor.
   *
   * - Uma mudança já aplicada, reenviada, é "repetida" e não muda nada.
   * - Uma mudança cuja base não é a versão atual é um "conflito", a menos que
   *   a versão atual tenha vindo de uma mudança anterior do mesmo aparelho, que
   *   então já a conhecia; no conflito, o documento não é sobrescrito, e a
   *   resposta traz a versão atual para o aparelho combinar e reenviar.
   * - As demais são "aplicadas" e ganham a próxima posição.
   */
  aplicar(dispositivo, mudancas) {
    return this._emFila(async () => {
      // Exclusões não têm conteúdo, e mudanças já aplicadas não gravam nada.
      const chaves = new Set();
      let legivel = false;
      for (const m of mudancas) {
        if (m.registro.apagado || this.aplicadas.has(`${dispositivo}:${m.seq}`)) continue;
        const chave = chaveDoDocumento(m.registro.dados);
        if (chave) chaves.add(chave);
        else legivel = true;
      }
      await this._conferirCifra(chaves, legivel);
      const resultados = [];
      for (const m of mudancas) {
        const chave = `${dispositivo}:${m.seq}`;
        if (this.aplicadas.has(chave)) {
          resultados.push({ seq: m.seq, estado: 'repetida', pos: this.aplicadas.get(chave) });
          continue;
        }
        const caminho = m.registro.caminho;
        const atual = this.ultimas.get(caminho) || null;
        const base = m.base == null ? null : m.base;
        const posAtual = atual ? atual.pos : null;
        const conheceAAtual = posAtual === base || (atual && atual.dispositivo === dispositivo && atual.seq != null && atual.seq < m.seq);
        if (!conheceAAtual) {
          const doc = await this.lerDocumento(caminho);
          resultados.push({ seq: m.seq, estado: 'conflito', atual: { pos: posAtual, registro: doc ? doc.registro : null } });
          continue;
        }
        const pos = this.posicao + 1;
        const entrada = { pos, caminho, dispositivo, seq: m.seq, tipo: m.registro.apagado ? 'delete' : 'set', em: Date.now() };
        await gravarAtomico(this._arquivoDoDocumento(caminho), JSON.stringify({ pos, caminho, dispositivo, seq: m.seq, registro: m.registro }));
        await this._arquivarVersao(entrada, m.registro);
        await this._acrescentar(entrada);
        resultados.push({ seq: m.seq, estado: 'aplicada', pos });
      }
      return { posicao: this.posicao, resultados };
    });
  }

  /**
   * Lista o que mudou depois de uma posição: a versão atual de cada documento
   * e os dados de cada arquivo, uma vez cada, na ordem da última mudança, no
   * máximo `limite` itens. `posicao` é até onde a lista chegou; com `mais`,
   * o aparelho pede de novo a partir dela.
   */
  async listar(desde, limite) {
    const depois = [...this.ultimas.entries()].filter(([, u]) => u.pos > desde).sort((a, b) => a[1].pos - b[1].pos);
    const pagina = depois.slice(0, limite);
    const documentos = [];
    const arquivos = [];
    for (const [caminho, u] of pagina) {
      if (caminho.startsWith('_arquivos/')) {
        const dados = await this.lerDadosDoArquivo(caminho.slice('_arquivos/'.length));
        if (dados) arquivos.push({ pos: u.pos, id: dados.id, tipo: dados.tipo, bytes: dados.bytes, sha256: dados.sha256, criadoEm: dados.criadoEm, dispositivo: dados.dispositivo });
      } else {
        const doc = await this.lerDocumento(caminho);
        if (doc) documentos.push({ pos: u.pos, registro: doc.registro });
      }
    }
    const mais = depois.length > pagina.length;
    const posicao = mais ? pagina[pagina.length - 1][1].pos : Math.max(desde, this.posicao);
    const cifra = this.cifra ? { chave: this.cifra.chave, desde: this.cifra.desde } : null;
    return { posicao, mais, documentos, arquivos, cifra };
  }

  async lerDadosDoArquivo(id) {
    if (!ID_DE_ARQUIVO.test(id)) return null;
    try {
      return JSON.parse(await fsp.readFile(this._arquivoDeDados(id), 'utf8'));
    } catch (e) {
      if (e.code === 'ENOENT') return null;
      throw e;
    }
  }

  abrirLeituraDoArquivo(id) {
    return fs.createReadStream(this._arquivoBinario(id));
  }

  /**
   * Guarda um arquivo enviado. O mesmo arquivo reenviado é "repetido"; um
   * conteúdo diferente com um id já usado é recusado, porque os ids são
   * aleatórios e não se repetem entre arquivos diferentes. A exceção é a troca
   * para a cifra: um arquivo legível dá lugar ao mesmo arquivo cifrado.
   */
  guardarArquivo(id, conteudo, { tipo, dispositivo, criadoEm }) {
    if (!ID_DE_ARQUIVO.test(id)) return Promise.reject(erro('id_invalido', 'id de arquivo inválido'));
    return this._emFila(async () => {
      const resumo = sha256(conteudo);
      const existente = await this.lerDadosDoArquivo(id);
      if (existente && existente.sha256 === resumo) return { estado: 'repetido', pos: existente.pos };
      const chave = chaveDoArquivo(conteudo);
      await this._conferirCifra(chave ? new Set([chave]) : new Set(), !chave);
      if (existente && (!chave || await chaveDoArquivoEmDisco(this._arquivoBinario(id)))) {
        throw erro('conflito', 'outro conteúdo já usa este id');
      }
      const pos = this.posicao + 1;
      await gravarAtomico(this._arquivoBinario(id), conteudo);
      const dados = { pos, id, tipo, bytes: conteudo.length, sha256: resumo, criadoEm, dispositivo, ...(chave ? { cifra: chave } : {}) };
      await gravarAtomico(this._arquivoDeDados(id), JSON.stringify(dados));
      await this._acrescentar({ pos, caminho: `_arquivos/${id}`, dispositivo, seq: null, tipo: 'arquivo', em: Date.now() });
      return { estado: 'aplicado', pos };
    });
  }
}

module.exports = { Armazem, ID_DE_ARQUIVO, chaveDoDocumento, chaveDoArquivo, chaveDoArquivoEmDisco };
