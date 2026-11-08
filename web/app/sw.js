// Service worker da Prancheta independente. Faz duas coisas:
//
// 1. Guarda os arquivos da página, para que ela abra sem rede. Cada pedido
//    tenta primeiro o servidor, para receber versões novas, e usa a cópia
//    guardada quando o servidor não responde.
// 2. Entrega os arquivos enviados em /_blob/<id>, lendo-os do banco local,
//    porque o código do artefato os exibe e lê por esse caminho.

'use strict';

importScripts('compat/banco-local.js');

const VERSAO = 'prancheta-app-4';
const ARQUIVOS = [
  'index.html',
  'compat/banco-local.js',
  'compat/combinar.js',
  'compat/sincronizacao.js',
  'compat/claude.js',
  'compat/casca.js',
  'compat/traco-onyx.js',
  'fontes/inter.css',
  'fontes/inter-latin-opsz-normal.woff2',
  'fontes/inter-latin-opsz-italic.woff2',
  'vendor/perfect-freehand/index.js',
  'vendor/pdfjs/pdf.min.js',
  'vendor/pdfjs/pdf.worker.min.js',
  'vendor/mammoth/mammoth.browser.min.js',
];
// Sem resposta do servidor nesse prazo, vale a cópia guardada.
const PRAZO_DA_REDE = 3000;
const CAMINHO_DE_ARQUIVO = /^\/_blob\/([\w-]{8,64})$/;

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(VERSAO).then((cache) => cache.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil((async () => {
    for (const nome of await caches.keys()) if (nome !== VERSAO) await caches.delete(nome);
    await self.clients.claim();
  })());
});

let banco = null;
async function lerArquivo(id) {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      if (!banco) banco = BancoLocal.abrir({ nome: 'prancheta' });
      return await (await banco).lerArquivo(id);
    } catch (e) {
      // O banco pode ter sido fechado por uma versão nova do esquema; abre de novo uma vez.
      banco = null;
      if (tentativa === 1) throw e;
    }
  }
  return null;
}

async function entregarArquivo(id) {
  try {
    const blob = await lerArquivo(id);
    if (!blob) return new Response('arquivo não encontrado', { status: 404 });
    return new Response(blob, {
      headers: { 'content-type': blob.type || 'application/octet-stream', 'cache-control': 'no-store' },
    });
  } catch (e) {
    return new Response('banco local indisponível', { status: 503 });
  }
}

async function redeComReserva(pedido) {
  const cache = await caches.open(VERSAO);
  const controle = new AbortController();
  const limite = setTimeout(() => controle.abort(), PRAZO_DA_REDE);
  try {
    // Um pedido de navegação não pode ser recriado com opções; pede-se a mesma URL.
    const resposta = await fetch(pedido.mode === 'navigate' ? pedido.url : pedido, { signal: controle.signal });
    if (resposta.ok && resposta.type === 'basic') await cache.put(pedido, resposta.clone());
    return resposta;
  } catch (e) {
    const guardada = await cache.match(pedido, { ignoreSearch: true });
    if (guardada) return guardada;
    if (pedido.mode === 'navigate') {
      const pagina = await cache.match('index.html');
      if (pagina) return pagina;
    }
    return Response.error();
  } finally {
    clearTimeout(limite);
  }
}

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin || pedido.method !== 'GET') return;
  const arquivo = url.pathname.match(CAMINHO_DE_ARQUIVO);
  if (arquivo) {
    evento.respondWith(entregarArquivo(arquivo[1]));
    return;
  }
  if (url.href.startsWith(self.registration.scope)) evento.respondWith(redeComReserva(pedido));
});
