// Progresso de leitura do KOReader, pelo protocolo KOSync: etapa 01 do plano 007.
//
// O KOReader sincroniza até onde o leitor chegou em cada livro com um servidor
// próprio. O servidor da Prancheta fala esse protocolo em /sync/kosync/, para
// que o leitor da Prancheta continue de onde o KOReader parou. Só o protocolo
// foi aproveitado, descrito em palavras; o servidor de referência é AGPL, e
// nenhum código dele entra aqui.
//
// Rotas, com o usuário em X-Auth-User e, em X-Auth-Key, o resumo MD5 da senha,
// que é o que o KOReader envia:
// - GET  /users/auth                  → { authorized: "OK" }
// - PUT  /syncs/progress              → grava { document, progress, percentage,
//   device, device_id } e devolve { document, timestamp }
// - GET  /syncs/progress/<documento>  → o último progresso gravado, ou {}
// - POST /users/create                → recusado: o cadastro é fechado, e a
//   credencial é criada na VPS, por servidor/implantacao/prancheta-kosync
//
// Exceção à cifra ponta a ponta, aceita pelo autor: o KOReader não conhece a
// chave da cifra, e o progresso fica legível, em <dados>/kosync/<usuário>.json,
// só com o identificador do livro, que é um resumo do arquivo e não o nome, a
// posição, a porcentagem, o aparelho e o horário.
//
// A credencial do KOSync é mais fraca que a chave de um aparelho, porque o
// protocolo envia um resumo MD5 da senha; por isso ela só vale nestas rotas, e
// a chave de um aparelho não vale nelas. O servidor guarda, de cada usuário, o
// resumo SHA-256 do que o KOReader envia, num arquivo com uma linha por
// usuário, relido quando muda:
//
//   <usuário> <resumo SHA-256, em hexadecimal, do MD5 da senha em hexadecimal>

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { lerResumos } = require('./chaves.cjs');

const DOCUMENTO = /^[0-9a-f]{32}$/;
const USUARIO = /^[\w.-]{1,64}$/;
const CHAVE = /^[0-9a-f]{32}$/;
const LIMITE_DO_PEDIDO = 16 * 1024;
const LIMITE_DA_POSICAO = 2048;
const LIMITE_DO_APARELHO = 128;
const LIMITE_DE_LIVROS = 5000;

const sha256 = (texto) => crypto.createHash('sha256').update(texto).digest();
const md5 = (texto) => crypto.createHash('md5').update(texto).digest('hex');

const ERROS = {
  2001: [401, 'Unauthorized'],
  2003: [403, 'Invalid request'],
  2004: [403, "Field 'document' not provided."],
  2005: [402, 'User registration is disabled.'],
};
const erro = (codigo) => ({ status: ERROS[codigo][0], corpo: { code: codigo, message: ERROS[codigo][1] } });

/**
 * Cria a função que confere o usuário e a chave de um pedido. Com `arquivo`,
 * vale o que estiver nele, relido quando a data ou o tamanho mudam; um arquivo
 * ausente ou ilegível não autoriza ninguém. Com `credencial`, para rodar
 * localmente e nos testes, vale um usuário com a senha dada.
 */
function criarConferencia({ arquivo, credencial } = {}) {
  if (!arquivo) {
    if (!credencial) return () => false;
    if (!USUARIO.test(credencial.usuario || '') || typeof credencial.senha !== 'string' || credencial.senha.length < 12) {
      throw new Error('a credencial do KOSync precisa de um usuário e de uma senha com pelo menos 12 caracteres');
    }
    const esperado = sha256(md5(credencial.senha));
    return (usuario, chave) => crypto.timingSafeEqual(sha256(chave), esperado) && usuario === credencial.usuario;
  }
  let marca = null;
  let resumos = [];
  const atualizar = () => {
    const info = fs.statSync(arquivo);
    const atual = `${info.mtimeMs}:${info.size}`;
    if (atual === marca) return;
    resumos = lerResumos(fs.readFileSync(arquivo, 'utf8'));
    marca = atual;
  };
  return (usuario, chave) => {
    try {
      atualizar();
    } catch (e) {
      if (e.code !== 'ENOENT') console.error('arquivo de usuários do KOSync ilegível:', e.message);
      resumos = [];
      marca = null;
    }
    const r = sha256(chave);
    let achou = false;
    // Compara com todos, sem parar no primeiro, para não variar o tempo conforme a posição.
    for (const item of resumos) if (crypto.timingSafeEqual(r, item.resumo) && item.nome === usuario) achou = true;
    return achou;
  };
}

// O progresso de um pedido, conferido e reduzido aos campos do protocolo; null se fugir do formato.
function lerProgresso(pedido) {
  if (!pedido || typeof pedido !== 'object' || Array.isArray(pedido)) return null;
  const posicao = typeof pedido.progress === 'number' && Number.isFinite(pedido.progress) ? String(pedido.progress) : pedido.progress;
  if (typeof posicao !== 'string' || posicao === '' || posicao.length > LIMITE_DA_POSICAO) return null;
  if (typeof pedido.percentage !== 'number' || !(pedido.percentage >= 0 && pedido.percentage <= 1)) return null;
  const textoCurto = (valor) => typeof valor === 'string' && valor.length <= LIMITE_DO_APARELHO;
  if (!textoCurto(pedido.device) || (pedido.device_id !== undefined && !textoCurto(pedido.device_id))) return null;
  return { progress: posicao, percentage: pedido.percentage, device: pedido.device, device_id: pedido.device_id || '' };
}

class Kosync {
  /**
   * @param opcoes.pasta a pasta dos dados; o progresso fica em <pasta>/kosync.
   * @param opcoes.arquivo o arquivo dos usuários, ou
   * @param opcoes.credencial { usuario, senha }, para rodar localmente e nos testes.
   * @param opcoes.agora o relógio, em milissegundos, para os testes.
   * @param opcoes.limiteDeLivros quantos livros cada usuário guarda, por padrão 5000.
   */
  constructor({ pasta, arquivo, credencial, agora = Date.now, limiteDeLivros = LIMITE_DE_LIVROS }) {
    this.limiteDeLivros = limiteDeLivros;
    this.pasta = path.join(pasta, 'kosync');
    this.conferir = criarConferencia({ arquivo, credencial });
    this.agora = agora;
    this._livros = new Map();
    this._fila = Promise.resolve();
  }

  /** O usuário de um pedido com a credencial certa, ou null. */
  usuarioDe(cabecalhos) {
    const usuario = cabecalhos['x-auth-user'];
    const chave = cabecalhos['x-auth-key'];
    if (typeof usuario !== 'string' || typeof chave !== 'string' || !USUARIO.test(usuario) || !CHAVE.test(chave)) return null;
    return this.conferir(usuario, chave) ? usuario : null;
  }

  // Os livros de um usuário, com o progresso de cada um, lidos do arquivo na primeira vez.
  async _livrosDe(usuario) {
    if (!this._livros.has(usuario)) {
      let livros = {};
      try {
        const lido = JSON.parse(await fs.promises.readFile(path.join(this.pasta, `${usuario}.json`), 'utf8'));
        if (lido && lido.livros && typeof lido.livros === 'object') livros = lido.livros;
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }
      this._livros.set(usuario, new Map(Object.entries(livros)));
    }
    return this._livros.get(usuario);
  }

  // Grava de uma vez, por um arquivo provisório, um pedido depois do outro.
  _guardar(usuario) {
    const gravar = async () => {
      await fs.promises.mkdir(this.pasta, { recursive: true, mode: 0o700 });
      const destino = path.join(this.pasta, `${usuario}.json`);
      const provisorio = `${destino}.${process.pid}.tmp`;
      await fs.promises.writeFile(provisorio, `${JSON.stringify({ livros: Object.fromEntries(this._livros.get(usuario)) })}\n`, { mode: 0o600 });
      await fs.promises.rename(provisorio, destino);
    };
    this._fila = this._fila.then(gravar, gravar);
    return this._fila;
  }

  /** O último progresso gravado de um livro, ou null. */
  async progresso(usuario, documento) {
    const guardado = (await this._livrosDe(usuario)).get(documento);
    return guardado ? { document: documento, ...guardado } : null;
  }

  /** Grava o progresso de um livro e devolve o horário, em segundos. */
  async gravar(usuario, documento, progresso) {
    const livros = await this._livrosDe(usuario);
    const timestamp = Math.floor(this.agora() / 1000);
    livros.delete(documento);
    livros.set(documento, { ...progresso, timestamp });
    // Passado o limite, saem os livros gravados há mais tempo.
    while (livros.size > this.limiteDeLivros) livros.delete(livros.keys().next().value);
    await this._guardar(usuario);
    return timestamp;
  }

  /**
   * Atende um pedido do KOSync e devolve { status, corpo }.
   * @param pedido.metodo o método do pedido.
   * @param pedido.caminho o caminho depois de /sync/kosync, como /users/auth.
   * @param pedido.cabecalhos os cabeçalhos do pedido.
   * @param pedido.lerCorpo a função que lê o corpo, até o limite dado.
   */
  async atender({ metodo, caminho, cabecalhos, lerCorpo }) {
    // O cadastro é fechado para todos; a resposta não diz nada sobre os usuários.
    if (metodo === 'POST' && caminho === '/users/create') return erro(2005);
    const usuario = this.usuarioDe(cabecalhos);
    if (!usuario) return erro(2001);

    if (metodo === 'GET' && caminho === '/users/auth') return { status: 200, corpo: { authorized: 'OK' } };

    if (metodo === 'PUT' && caminho === '/syncs/progress') {
      let pedido;
      try {
        pedido = JSON.parse((await lerCorpo(LIMITE_DO_PEDIDO)).toString('utf8'));
      } catch (e) {
        return e.status === 413 ? { status: 413, corpo: { code: 2003, message: ERROS[2003][1] } } : erro(2003);
      }
      if (!pedido || typeof pedido !== 'object' || pedido.document === undefined || pedido.document === '') return erro(2004);
      const progresso = lerProgresso(pedido);
      if (typeof pedido.document !== 'string' || !DOCUMENTO.test(pedido.document) || !progresso) return erro(2003);
      const timestamp = await this.gravar(usuario, pedido.document, progresso);
      return { status: 200, corpo: { document: pedido.document, timestamp } };
    }

    const livro = caminho.match(/^\/syncs\/progress\/([^/]+)$/);
    if (metodo === 'GET' && livro) {
      if (!DOCUMENTO.test(livro[1])) return erro(2003);
      return { status: 200, corpo: (await this.progresso(usuario, livro[1])) || {} };
    }

    return { status: 404, corpo: { code: 2003, message: ERROS[2003][1] } };
  }
}

module.exports = { Kosync, criarConferencia, lerProgresso, LIMITE_DE_LIVROS };
