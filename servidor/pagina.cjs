// Entrega a página da Prancheta, a pasta web/app, numa porta separada da
// sincronização. A página é a mesma do repositório público e não guarda
// segredo, por isso responde sem a chave; a sincronização, na outra porta,
// continua recusando qualquer pedido sem ela. Na VPS, o Traefik encaminha
// /sync/ para a sincronização e o resto para cá, no mesmo endereço, o que
// dispensa CORS no navegador do computador.
//
// Cabeçalhos:
// - em toda resposta: nosniff, sem referência a outros endereços e HSTS;
// - na página: uma política que limita as conexões ao próprio endereço, para
//   que um script injetado não envie a chave para fora, e proíbe objetos,
//   mudança da base dos endereços, formulários e a exibição dentro de outro
//   site. Os scripts não são restringidos, porque os desenhos por código rodam
//   em iframes isolados que herdam a política e carregam bibliotecas de CDNs.
// - sem cache do navegador: o service worker guarda a página para uso sem rede.

'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.map': 'application/json; charset=utf-8',
};

const CABECALHOS_COMUNS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Strict-Transport-Security': 'max-age=31536000',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

const POLITICA_DA_PAGINA = "connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";

function responderTexto(res, status, texto, extras = {}) {
  res.writeHead(status, { ...CABECALHOS_COMUNS, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...extras });
  res.end(texto);
}

// Traduz o caminho pedido para um arquivo dentro da pasta, ou null. Recusa
// segmentos vazios no meio, "..", nomes que começam com ponto e o caractere nulo.
function arquivoPedido(raiz, caminhoDaUrl) {
  let caminho;
  try {
    caminho = decodeURIComponent(caminhoDaUrl);
  } catch (e) {
    return null;
  }
  if (caminho.includes('\0') || caminho.includes('\\')) return null;
  if (caminho === '/' || caminho === '') caminho = '/index.html';
  const partes = caminho.split('/').slice(1);
  if (partes.some((p) => p === '' || p === '..' || p.startsWith('.'))) return null;
  const arquivo = path.join(raiz, ...partes);
  if (!arquivo.startsWith(raiz + path.sep)) return null;
  return arquivo;
}

function criarServidorDaPagina({ pasta }) {
  // A versão em uso é fixada ao iniciar; uma publicação nova reinicia o processo.
  const raiz = fs.realpathSync(pasta);
  return http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return responderTexto(res, 405, 'método não permitido', { Allow: 'GET, HEAD' });
    const url = new URL(req.url, 'http://local');
    const arquivo = arquivoPedido(raiz, url.pathname);
    let info = null;
    try {
      if (arquivo) info = fs.statSync(arquivo);
    } catch (e) { /* inexistente */ }
    if (!info || !info.isFile()) return responderTexto(res, 404, 'não encontrado');
    const extensao = path.extname(arquivo).toLowerCase();
    const etiqueta = `"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
    const cabecalhos = {
      ...CABECALHOS_COMUNS,
      'Content-Type': TIPOS[extensao] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      ETag: etiqueta,
    };
    if (extensao === '.html') cabecalhos['Content-Security-Policy'] = POLITICA_DA_PAGINA;
    if (req.headers['if-none-match'] === etiqueta) {
      res.writeHead(304, cabecalhos);
      return res.end();
    }
    cabecalhos['Content-Length'] = info.size;
    res.writeHead(200, cabecalhos);
    if (req.method === 'HEAD') return res.end();
    const leitura = fs.createReadStream(arquivo);
    leitura.on('error', () => res.destroy());
    leitura.pipe(res);
    return undefined;
  });
}

module.exports = { criarServidorDaPagina, POLITICA_DA_PAGINA, arquivoPedido };
