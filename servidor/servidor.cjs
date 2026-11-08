// Servidor de sincronização da Prancheta: guarda a cópia central dos quadros
// e troca mudanças com cada aparelho, no formato do banco local. Só atende
// quem apresenta a chave de acesso do autor, em Authorization: Bearer <chave>.
//
// Rotas, todas sob /sync e todas com a chave:
// - GET  /sync/estado                      → { posicao }
// - POST /sync/mudancas                    → aplica mudanças de um aparelho
// - GET  /sync/mudancas?desde=P&limite=L   → o que mudou depois da posição P
// - PUT  /sync/arquivos/<id>               → guarda um arquivo enviado
// - GET  /sync/arquivos/<id>               → devolve um arquivo enviado
//
// Configuração por variáveis de ambiente, nunca no repositório:
// - PRANCHETA_CHAVE: a chave de acesso, com pelo menos 32 caracteres;
// - PRANCHETA_DADOS: a pasta dos dados, por padrão ./dados;
// - PRANCHETA_PORTA e PRANCHETA_ENDERECO: onde ouvir, por padrão 127.0.0.1:8787;
// - PRANCHETA_ORIGENS: origens de navegador aceitas, separadas por vírgula,
//   por padrão a da casca Android, https://appassets.androidplatform.net.

'use strict';

const http = require('node:http');
const crypto = require('node:crypto');
const path = require('node:path');
const { Armazem, ID_DE_ARQUIVO } = require('./armazem.cjs');

const LIMITE_DO_JSON = 25 * 1024 * 1024;
const LIMITE_DO_ARQUIVO = 25 * 1024 * 1024;
const LIMITE_DA_LISTA = 500;
const DISPOSITIVO = /^[0-9a-f]{8,64}$/;
const CABECALHOS_PERMITIDOS = 'Authorization, Content-Type, X-Prancheta-Dispositivo, X-Prancheta-Criado-Em';

const resumo = (texto) => crypto.createHash('sha256').update(texto).digest();

function responder(res, status, corpo, cabecalhos = {}) {
  const texto = corpo === undefined ? '' : JSON.stringify(corpo);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(texto),
    ...cabecalhos,
  });
  res.end(texto);
}

// Lê o corpo até o limite. Acima dele, descarta o resto e responde 413 no fim,
// para que o cliente receba a resposta; só corta a conexão se o envio passar
// muito do limite.
function lerCorpo(req, limite) {
  return new Promise((pronto, falha) => {
    const partes = [];
    let tamanho = 0;
    req.on('data', (parte) => {
      tamanho += parte.length;
      if (tamanho > limite * 4) {
        req.destroy();
        return;
      }
      if (tamanho <= limite) partes.push(parte);
    });
    req.on('end', () => {
      if (tamanho <= limite) return pronto(Buffer.concat(partes));
      const e = new Error('corpo grande demais');
      e.status = 413;
      return falha(e);
    });
    req.on('error', falha);
    req.on('close', () => { if (!req.complete) falha(new Error('pedido interrompido')); });
  });
}

// Caminhos alternam coleção e documento, como no banco local: "a/b" é documento.
function caminhoDeDocumento(caminho) {
  if (typeof caminho !== 'string' || caminho === '' || caminho.length > 1024) return false;
  const partes = caminho.split('/');
  return partes.length % 2 === 0 && partes.every((p) => p !== '') && !caminho.startsWith('_arquivos/');
}

// O registro precisa ter a forma do banco local; o conteúdo de dados não é
// examinado nem convertido.
function validarMudanca(m) {
  if (!m || typeof m !== 'object') return 'mudança sem objeto';
  if (!Number.isSafeInteger(m.seq) || m.seq < 1) return 'seq precisa ser um inteiro positivo';
  if (m.base != null && (!Number.isSafeInteger(m.base) || m.base < 1)) return 'base precisa ser nula ou um inteiro positivo';
  const r = m.registro;
  if (!r || typeof r !== 'object') return 'mudança sem registro';
  if (!caminhoDeDocumento(r.caminho)) return 'caminho de documento inválido';
  if (typeof r.apagado !== 'boolean') return 'apagado precisa ser booleano';
  if (!Number.isSafeInteger(r.versao) || r.versao < 1) return 'versao precisa ser um inteiro positivo';
  if (r.apagado ? r.dados !== null : (!r.dados || typeof r.dados !== 'object' || Array.isArray(r.dados))) {
    return 'dados precisa ser um objeto, ou nulo num documento apagado';
  }
  return null;
}

function criarServidor({ armazem, chave, origens = [] }) {
  if (typeof chave !== 'string' || chave.length < 32) throw new Error('a chave de acesso precisa ter pelo menos 32 caracteres');
  const chaveEsperada = resumo(chave);
  const origensAceitas = new Set(origens);

  function autorizado(req) {
    const cabecalho = req.headers.authorization || '';
    if (!cabecalho.startsWith('Bearer ')) return false;
    return crypto.timingSafeEqual(resumo(cabecalho.slice('Bearer '.length)), chaveEsperada);
  }

  function cabecalhosDeOrigem(req) {
    const origem = req.headers.origin;
    if (!origem || !origensAceitas.has(origem)) return {};
    return { 'Access-Control-Allow-Origin': origem, Vary: 'Origin' };
  }

  async function atender(req, res) {
    const origem = cabecalhosDeOrigem(req);
    // A consulta prévia do navegador não traz a chave nem recebe dados; só é
    // respondida para as origens aceitas.
    if (req.method === 'OPTIONS') {
      if (!origem['Access-Control-Allow-Origin']) return responder(res, 401, { erro: 'nao_autorizado' });
      res.writeHead(204, {
        ...origem,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
        'Access-Control-Allow-Headers': CABECALHOS_PERMITIDOS,
        'Access-Control-Max-Age': '600',
      });
      return res.end();
    }
    if (!autorizado(req)) return responder(res, 401, { erro: 'nao_autorizado' }, origem);

    const url = new URL(req.url, 'http://local');
    const rota = url.pathname;

    if (req.method === 'GET' && rota === '/sync/estado') {
      return responder(res, 200, { posicao: armazem.posicao }, origem);
    }

    if (rota === '/sync/mudancas' && req.method === 'POST') {
      let pedido;
      try {
        pedido = JSON.parse((await lerCorpo(req, LIMITE_DO_JSON)).toString('utf8'));
      } catch (e) {
        return responder(res, e.status || 400, { erro: e.status === 413 ? 'grande_demais' : 'json_invalido' }, origem);
      }
      if (!pedido || !DISPOSITIVO.test(pedido.dispositivo || '')) return responder(res, 400, { erro: 'dispositivo_invalido' }, origem);
      if (!Array.isArray(pedido.mudancas)) return responder(res, 400, { erro: 'mudancas_invalidas' }, origem);
      for (const m of pedido.mudancas) {
        const problema = validarMudanca(m);
        if (problema) return responder(res, 400, { erro: 'mudanca_invalida', detalhe: problema, seq: m && m.seq }, origem);
      }
      return responder(res, 200, await armazem.aplicar(pedido.dispositivo, pedido.mudancas), origem);
    }

    if (rota === '/sync/mudancas' && req.method === 'GET') {
      const desde = Number(url.searchParams.get('desde') || 0);
      const limite = Number(url.searchParams.get('limite') || 200);
      if (!Number.isSafeInteger(desde) || desde < 0 || !Number.isSafeInteger(limite) || limite < 1) {
        return responder(res, 400, { erro: 'parametros_invalidos' }, origem);
      }
      return responder(res, 200, await armazem.listar(desde, Math.min(limite, LIMITE_DA_LISTA)), origem);
    }

    const arquivo = rota.match(/^\/sync\/arquivos\/([^/]+)$/);
    if (arquivo) {
      const id = arquivo[1];
      if (!ID_DE_ARQUIVO.test(id)) return responder(res, 400, { erro: 'id_invalido' }, origem);
      if (req.method === 'PUT') {
        const dispositivo = req.headers['x-prancheta-dispositivo'] || '';
        if (!DISPOSITIVO.test(dispositivo)) return responder(res, 400, { erro: 'dispositivo_invalido' }, origem);
        let conteudo;
        try {
          conteudo = await lerCorpo(req, LIMITE_DO_ARQUIVO);
        } catch (e) {
          return responder(res, e.status || 400, { erro: e.status === 413 ? 'grande_demais' : 'corpo_invalido' }, origem);
        }
        const criadoEm = Number(req.headers['x-prancheta-criado-em']) || Date.now();
        const tipo = (req.headers['content-type'] || 'application/octet-stream').slice(0, 200);
        try {
          const r = await armazem.guardarArquivo(id, conteudo, { tipo, dispositivo, criadoEm });
          return responder(res, r.estado === 'aplicado' ? 201 : 200, r, origem);
        } catch (e) {
          if (e.codigo === 'conflito') return responder(res, 409, { erro: 'conflito' }, origem);
          throw e;
        }
      }
      if (req.method === 'GET') {
        const dados = await armazem.lerDadosDoArquivo(id);
        if (!dados) return responder(res, 404, { erro: 'arquivo_inexistente' }, origem);
        res.writeHead(200, { ...origem, 'Content-Type': dados.tipo, 'Content-Length': dados.bytes, 'Cache-Control': 'private, max-age=31536000, immutable' });
        armazem.abrirLeituraDoArquivo(id).pipe(res);
        return undefined;
      }
    }

    return responder(res, 404, { erro: 'rota_inexistente' }, origem);
  }

  return http.createServer((req, res) => {
    atender(req, res).catch((e) => {
      console.error('erro ao atender:', e.message);
      if (!res.headersSent) responder(res, 500, { erro: 'erro_interno' });
      else res.destroy();
    });
  });
}

async function iniciar(ambiente = process.env) {
  const chave = ambiente.PRANCHETA_CHAVE;
  if (!chave || chave.length < 32) {
    throw new Error('defina PRANCHETA_CHAVE com pelo menos 32 caracteres; a chave nunca fica no repositório');
  }
  const pasta = path.resolve(ambiente.PRANCHETA_DADOS || 'dados');
  const porta = Number(ambiente.PRANCHETA_PORTA || 8787);
  const endereco = ambiente.PRANCHETA_ENDERECO || '127.0.0.1';
  const origens = (ambiente.PRANCHETA_ORIGENS || 'https://appassets.androidplatform.net').split(',').map((o) => o.trim()).filter(Boolean);
  const armazem = await Armazem.abrir(pasta);
  const servidor = criarServidor({ armazem, chave, origens });
  await new Promise((pronto) => servidor.listen(porta, endereco, pronto));
  console.log(`servidor da Prancheta em http://${endereco}:${servidor.address().port}, posição ${armazem.posicao}`);
  return servidor;
}

if (require.main === module) {
  iniciar().then((servidor) => {
    for (const sinal of ['SIGINT', 'SIGTERM']) process.on(sinal, () => servidor.close(() => process.exit(0)));
  }, (e) => {
    console.error(e.message);
    process.exit(1);
  });
}

module.exports = { criarServidor, iniciar };
