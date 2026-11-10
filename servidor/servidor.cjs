// Servidor de sincronização da Prancheta: guarda a cópia central dos quadros
// e troca mudanças com cada aparelho, no formato do banco local. Só atende
// quem apresenta uma chave de acesso válida, em Authorization: Bearer <chave>.
// Com PRANCHETA_WEB, entrega também a página, noutra porta, por servidor/pagina.cjs.
//
// Rotas, todas sob /sync e todas com a chave:
// - GET  /sync/estado                      → { posicao }
// - POST /sync/mudancas                    → aplica mudanças de um aparelho
// - GET  /sync/mudancas?desde=P&limite=L   → o que mudou depois da posição P,
//   com a cifra ligada no servidor, se houver
// - PUT  /sync/arquivos/<id>               → guarda um arquivo enviado
// - GET  /sync/arquivos/<id>               → devolve um arquivo enviado
// - GET  /sync/biblioteca                  → os livros da biblioteca, por servidor/biblioteca.cjs
// - GET  /sync/biblioteca/<id>             → um livro da biblioteca
// - GET  /sync/progresso/<id>              → { progresso }: o último progresso de
//   leitura do livro gravado pelo KOReader, ou null
//
// À parte, em /sync/kosync/, o progresso de leitura do KOReader, com a
// credencial própria dele em vez da chave de um aparelho, por servidor/kosync.cjs.
//
// Configuração por variáveis de ambiente, nunca no repositório:
// - PRANCHETA_CHAVES_ARQUIVO: o arquivo com o resumo da chave de cada aparelho,
//   descrito em servidor/chaves.cjs; ou, para rodar localmente,
//   PRANCHETA_CHAVE: uma chave única, com pelo menos 32 caracteres;
// - PRANCHETA_DADOS: a pasta dos dados, por padrão ./dados;
// - PRANCHETA_PORTA e PRANCHETA_ENDERECO: onde ouvir, por padrão 127.0.0.1:8787;
// - PRANCHETA_ORIGENS: origens de navegador aceitas, separadas por vírgula,
//   por padrão a da casca Android, https://appassets.androidplatform.net;
// - PRANCHETA_WEB e PRANCHETA_PORTA_DA_PAGINA: a pasta da página e a porta em
//   que ela é entregue, por padrão 8788;
// - PRANCHETA_VERSAO: o atalho para a versão publicada; quando ele passa a
//   apontar para outra versão, o servidor termina, e o contêiner o reinicia
//   com o código novo;
// - PRANCHETA_HISTORICO_DIAS: por quantos dias as versões antigas dos
//   documentos ficam guardadas, por padrão 30;
// - PRANCHETA_BIBLIOTECA: a pasta dos livros, só lida, por padrão nenhuma;
// - PRANCHETA_KOSYNC_ARQUIVO: o arquivo com os usuários do KOSync, descrito em
//   servidor/kosync.cjs; sem ele, as rotas do KOSync recusam todos os pedidos.
//
// Com PRANCHETA_VERSAO, depois de começar, o servidor anota em no-ar.json, na
// pasta dos dados, a versão que entrega e se a sincronização recusa um pedido
// sem a chave; o comando de publicação, na VPS, espera essa anotação para
// confirmar que a versão nova entrou no ar.
//
// Cifra ponta a ponta: os aparelhos cifram os quadros antes de enviá-los, e o
// servidor só os guarda; depois da primeira gravação cifrada, ele responde 409
// com cifra_exigida a uma gravação legível e com cifra_diferente a uma de
// outra chave, como descrito em servidor/armazem.cjs.

'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { Armazem, ID_DE_ARQUIVO } = require('./armazem.cjs');
const { Biblioteca } = require('./biblioteca.cjs');
const { criarVerificador } = require('./chaves.cjs');
const { Kosync } = require('./kosync.cjs');
const { criarServidorDaPagina } = require('./pagina.cjs');

const LIMITE_DO_JSON = 25 * 1024 * 1024;
// Com a cifra ligada, o servidor recusa gravações legíveis e as de outra chave.
const ERROS_DA_CIFRA = new Set(['cifra_exigida', 'cifra_diferente']);
const LIMITE_DO_ARQUIVO = 25 * 1024 * 1024;
const LIMITE_DA_LISTA = 500;
const DISPOSITIVO = /^[0-9a-f]{8,64}$/;
const ROTA_DO_KOSYNC = '/sync/kosync/';
const ID_DE_LIVRO = /^[0-9a-f]{32}$/;
const CABECALHOS_PERMITIDOS = 'Authorization, Content-Type, X-Prancheta-Dispositivo, X-Prancheta-Criado-Em';

const SEGURANCA = {
  'X-Content-Type-Options': 'nosniff',
  'Strict-Transport-Security': 'max-age=31536000',
};

function responder(res, status, corpo, cabecalhos = {}) {
  const texto = corpo === undefined ? '' : JSON.stringify(corpo);
  res.writeHead(status, {
    ...SEGURANCA,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(texto),
    ...cabecalhos,
  });
  res.end(texto);
}

// Tipo de arquivo no formato tipo/subtipo, em minúsculas, sem parâmetros; o
// que fugir disso vira application/octet-stream.
function tipoSeguro(tipo) {
  const t = String(tipo || '').toLowerCase().split(';')[0].trim();
  return /^[a-z0-9.+-]{1,60}\/[a-z0-9.+-]{1,80}$/.test(t) ? t : 'application/octet-stream';
}

const IMAGENS_EXIBIVEIS = /^image\/(png|jpeg|gif|webp|avif|bmp)$/;

// Um arquivo enviado nunca executa código na origem de quem o abre: fora do
// PDF, que o navegador exibe no próprio leitor, ele vai com uma política que
// o isola; só imagens e PDF abrem no navegador, e o resto é baixado.
function cabecalhosDeArquivo(tipo) {
  const seguro = tipoSeguro(tipo);
  const pdf = seguro === 'application/pdf';
  const cabecalhos = {
    'Content-Type': seguro,
    'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': pdf || IMAGENS_EXIBIVEIS.test(seguro) ? 'inline' : 'attachment',
  };
  if (!pdf) cabecalhos['Content-Security-Policy'] = "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'";
  return cabecalhos;
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

/**
 * @param opcoes.armazem o armazém dos dados.
 * @param opcoes.chave uma chave única, para rodar localmente; ou
 * @param opcoes.verificar a função de servidor/chaves.cjs, que confere a chave de cada aparelho.
 * @param opcoes.origens as origens de navegador aceitas.
 * @param opcoes.biblioteca a Biblioteca de servidor/biblioteca.cjs, se houver.
 * @param opcoes.kosync o Kosync de servidor/kosync.cjs, se houver.
 */
function criarServidor({ armazem, chave, verificar, origens = [], biblioteca = null, kosync = null }) {
  const conferir = verificar || criarVerificador({ chave });
  const origensAceitas = new Set(origens);

  function autorizado(req) {
    const cabecalho = req.headers.authorization || '';
    if (!cabecalho.startsWith('Bearer ')) return false;
    return Boolean(conferir(cabecalho.slice('Bearer '.length)));
  }

  function cabecalhosDeOrigem(req) {
    const origem = req.headers.origin;
    if (!origem || !origensAceitas.has(origem)) return {};
    return { 'Access-Control-Allow-Origin': origem, Vary: 'Origin' };
  }

  async function atender(req, res) {
    const url = new URL(req.url, 'http://local');
    const rota = rotaDaSincronizacao(url.pathname);
    // O progresso do KOReader tem a credencial dele: a chave de um aparelho não
    // vale aqui, e a credencial do KOSync não vale em nenhuma outra rota.
    if (rota.startsWith(ROTA_DO_KOSYNC)) {
      if (!kosync) return responder(res, 401, { code: 2001, message: 'Unauthorized' });
      const resposta = await kosync.atender({
        metodo: req.method, caminho: rota.slice(ROTA_DO_KOSYNC.length - 1), cabecalhos: req.headers, lerCorpo: (limite) => lerCorpo(req, limite),
      });
      return responder(res, resposta.status, resposta.corpo);
    }
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
      try {
        return responder(res, 200, await armazem.aplicar(pedido.dispositivo, pedido.mudancas), origem);
      } catch (e) {
        if (ERROS_DA_CIFRA.has(e.codigo)) return responder(res, 409, { erro: e.codigo }, origem);
        throw e;
      }
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
        const tipo = tipoSeguro(req.headers['content-type']);
        try {
          const r = await armazem.guardarArquivo(id, conteudo, { tipo, dispositivo, criadoEm });
          return responder(res, r.estado === 'aplicado' ? 201 : 200, r, origem);
        } catch (e) {
          if (e.codigo === 'conflito' || ERROS_DA_CIFRA.has(e.codigo)) return responder(res, 409, { erro: e.codigo }, origem);
          throw e;
        }
      }
      if (req.method === 'GET') {
        const dados = await armazem.lerDadosDoArquivo(id);
        if (!dados) return responder(res, 404, { erro: 'arquivo_inexistente' }, origem);
        res.writeHead(200, {
          ...SEGURANCA, ...origem, ...cabecalhosDeArquivo(dados.tipo),
          'Content-Length': dados.bytes, 'Cache-Control': 'private, max-age=31536000, immutable',
        });
        armazem.abrirLeituraDoArquivo(id).pipe(res);
        return undefined;
      }
    }

    if (rota === '/sync/biblioteca' && req.method === 'GET') {
      return responder(res, 200, { livros: biblioteca ? await biblioteca.listar() : [] }, origem);
    }

    const livro = rota.match(/^\/sync\/biblioteca\/([^/]+)$/);
    if (livro && req.method === 'GET') {
      const aberto = biblioteca ? await biblioteca.abrir(livro[1]) : null;
      if (!aberto) return responder(res, 404, { erro: 'livro_inexistente' }, origem);
      res.writeHead(200, {
        ...SEGURANCA, ...origem, ...cabecalhosDeArquivo(aberto.livro.tipo),
        'Content-Length': aberto.livro.bytes, 'Cache-Control': 'private, no-store',
      });
      aberto.fluxo.on('error', () => res.destroy());
      res.on('close', () => aberto.fluxo.destroy());
      aberto.fluxo.pipe(res);
      return undefined;
    }

    // O último progresso de leitura de um livro, gravado pelo KOReader, para o
    // leitor da Prancheta continuar de lá; com a chave do aparelho, como as outras rotas.
    const lido = rota.match(/^\/sync\/progresso\/([^/]+)$/);
    if (lido && req.method === 'GET') {
      if (!ID_DE_LIVRO.test(lido[1])) return responder(res, 400, { erro: 'livro_invalido' }, origem);
      return responder(res, 200, { progresso: kosync ? await kosync.ultimo(lido[1]) : null }, origem);
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

// Pela rede privada, o Tailscale entrega a sincronização montada em /sync/ e
// pode tirar esse começo do caminho; as rotas valem com ele ou sem ele.
function rotaDaSincronizacao(caminho) {
  if (caminho.startsWith('/sync/')) return caminho;
  return `/sync/${caminho.replace(/^\/+/, '')}`;
}

function verificadorDoAmbiente(ambiente) {
  if (ambiente.PRANCHETA_CHAVES_ARQUIVO) return criarVerificador({ arquivo: ambiente.PRANCHETA_CHAVES_ARQUIVO });
  const chave = ambiente.PRANCHETA_CHAVE;
  if (!chave || chave.length < 32) {
    throw new Error('defina PRANCHETA_CHAVES_ARQUIVO, ou PRANCHETA_CHAVE com pelo menos 32 caracteres; a chave nunca fica no repositório');
  }
  return criarVerificador({ chave });
}

/**
 * Chama `aoMudar` quando o atalho `caminho` passa a apontar para outro lugar,
 * conferindo a cada `intervalo` ms. Devolve a função que para a vigia.
 */
function vigiarVersao(caminho, aoMudar, intervalo = 5000) {
  const inicial = fs.realpathSync(caminho);
  const relogio = setInterval(() => {
    let atual;
    try {
      atual = fs.realpathSync(caminho);
    } catch (e) {
      return;
    }
    if (atual !== inicial) {
      clearInterval(relogio);
      aoMudar(atual);
    }
  }, intervalo);
  relogio.unref();
  return () => clearInterval(relogio);
}

const ouvir = (servidor, porta, endereco) => new Promise((pronto, falha) => {
  servidor.once('error', falha);
  servidor.listen(porta, endereco, pronto);
});

// Pede o estado à própria sincronização, sem a chave, e devolve o código da resposta.
function codigoSemChave(porta, endereco) {
  const anfitriao = endereco === '0.0.0.0' || endereco === '::' ? '127.0.0.1' : endereco;
  return new Promise((pronto) => {
    const pedido = http.get({ host: anfitriao, port: porta, path: '/sync/estado', timeout: 5000 }, (res) => {
      res.resume();
      pronto(res.statusCode);
    });
    pedido.on('timeout', () => pedido.destroy(new Error('tempo esgotado')));
    pedido.on('error', () => pronto(0));
  });
}

/**
 * Anota em `pasta`/no-ar.json, de uma vez, a versão em uso e se a
 * sincronização, já ouvindo, recusa um pedido sem a chave.
 */
async function anotarNoAr({ pasta, versao, porta, endereco }) {
  const codigo = await codigoSemChave(porta, endereco);
  const anotacao = { versao, recusaSemChave: codigo === 401, codigo, em: new Date().toISOString() };
  const provisorio = path.join(pasta, `.no-ar.${process.pid}`);
  await fs.promises.writeFile(provisorio, `${JSON.stringify(anotacao)}\n`, { mode: 0o644 });
  await fs.promises.rename(provisorio, path.join(pasta, 'no-ar.json'));
  return anotacao;
}

async function iniciar(ambiente = process.env) {
  const verificar = verificadorDoAmbiente(ambiente);
  const pasta = path.resolve(ambiente.PRANCHETA_DADOS || 'dados');
  const porta = Number(ambiente.PRANCHETA_PORTA || 8787);
  const endereco = ambiente.PRANCHETA_ENDERECO || '127.0.0.1';
  const origens = (ambiente.PRANCHETA_ORIGENS || 'https://appassets.androidplatform.net').split(',').map((o) => o.trim()).filter(Boolean);
  const diasDeHistorico = Number(ambiente.PRANCHETA_HISTORICO_DIAS || 30);
  const armazem = await Armazem.abrir(pasta, { diasDeHistorico });
  const biblioteca = new Biblioteca(ambiente.PRANCHETA_BIBLIOTECA || null);
  const kosync = ambiente.PRANCHETA_KOSYNC_ARQUIVO ? new Kosync({ pasta, arquivo: ambiente.PRANCHETA_KOSYNC_ARQUIVO }) : null;
  const servidores = [];
  const servidor = criarServidor({ armazem, verificar, origens, biblioteca, kosync });
  await ouvir(servidor, porta, endereco);
  servidores.push(servidor);
  console.log(`sincronização da Prancheta em http://${endereco}:${servidor.address().port}, posição ${armazem.posicao}`);
  if (ambiente.PRANCHETA_WEB) {
    const pagina = criarServidorDaPagina({ pasta: ambiente.PRANCHETA_WEB });
    await ouvir(pagina, Number(ambiente.PRANCHETA_PORTA_DA_PAGINA || 8788), endereco);
    servidores.push(pagina);
    console.log(`página da Prancheta em http://${endereco}:${pagina.address().port}`);
  }
  const fechar = () => Promise.all(servidores.map((s) => new Promise((pronto) => {
    s.close(() => pronto());
    s.closeIdleConnections();
  })));
  if (ambiente.PRANCHETA_VERSAO) {
    const versao = path.basename(fs.realpathSync(ambiente.PRANCHETA_VERSAO));
    const anotacao = await anotarNoAr({ pasta, versao, porta: servidor.address().port, endereco });
    console.log(`versão ${versao} no ar; sem a chave, a sincronização responde ${anotacao.codigo}`);
    vigiarVersao(ambiente.PRANCHETA_VERSAO, (nova) => {
      console.log(`versão nova publicada em ${nova}; o servidor termina para recomeçar com ela`);
      const limite = setTimeout(() => process.exit(0), 5000);
      limite.unref();
      fechar().then(() => process.exit(0));
    }, Number(ambiente.PRANCHETA_VIGIA_MS || 5000));
  }
  return { servidores, fechar };
}

if (require.main === module) {
  iniciar().then(({ fechar }) => {
    for (const sinal of ['SIGINT', 'SIGTERM']) process.on(sinal, () => fechar().then(() => process.exit(0)));
  }, (e) => {
    console.error(e.message);
    process.exit(1);
  });
}

module.exports = { criarServidor, iniciar, tipoSeguro, cabecalhosDeArquivo, vigiarVersao, anotarNoAr, rotaDaSincronizacao };
