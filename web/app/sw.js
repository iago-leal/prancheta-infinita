// Service worker da Prancheta independente. Faz duas coisas:
//
// 1. Guarda os arquivos da página, para que ela abra sem rede. Na casca
//    Android, a página vem do próprio APK, assinado, e cada pedido tenta
//    primeiro os arquivos do APK. Fora dela, como na VPS, a página usa sempre
//    a versão guardada, e uma versão nova, baixada em segundo plano, só entra
//    quando o autor pede, pelo aviso que compat/claude.js mostra: assim, um
//    código trocado no servidor não entra sozinho na página que guarda a chave.
// 2. Entrega os arquivos enviados em /_blob/<id>, lendo-os do banco local,
//    porque o código do artefato os exibe e lê por esse caminho, sempre com
//    cabeçalhos que impedem um arquivo de executar código na origem da página.
//
// Os pedidos de sincronização, em /sync/, nunca passam pelo cache.
//
// VERSAO é carimbada por web/montagem/montar.cjs com um resumo dos arquivos
// guardados e deste próprio arquivo; não a edite à mão.

'use strict';

importScripts('compat/banco-local.js');

const VERSAO = 'prancheta-app-f75397c6b2fd';
const ARQUIVOS = [
  'index.html',
  'compat/banco-local.js',
  'compat/combinar.js',
  'compat/cifra.js',
  'compat/sincronizacao.js',
  'compat/biblioteca.js',
  'compat/tela-da-biblioteca.js',
  'compat/leitor.js',
  'compat/marcacoes.js',
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
  'vendor/jszip/jszip.min.js',
  'vendor/epubjs/epub.min.js',
];
// Sem resposta do servidor nesse prazo, vale a cópia guardada.
const PRAZO_DA_REDE = 3000;
const CAMINHO_DE_ARQUIVO = /^\/_blob\/([\w-]{8,64})$/;
const NA_CASCA = self.location.hostname === 'appassets.androidplatform.net';

self.addEventListener('install', (evento) => {
  // A instalação busca cada arquivo no servidor, sem o cache do navegador.
  const pedidos = ARQUIVOS.map((a) => new Request(a, { cache: 'reload' }));
  evento.waitUntil(caches.open(VERSAO).then((cache) => cache.addAll(pedidos)).then(() => {
    if (NA_CASCA) return self.skipWaiting();
    return undefined;
  }));
});

// Fora da casca, a versão nova espera o autor pedir a atualização.
self.addEventListener('message', (evento) => {
  if (evento.data && evento.data.tipo === 'ativar') self.skipWaiting();
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

const IMAGENS_EXIBIVEIS = /^image\/(png|jpeg|gif|webp|avif|bmp)$/;

// Mesmos cabeçalhos da rota de arquivos do servidor, em servidor/servidor.cjs:
// fora do PDF, o arquivo vai isolado; só imagens e PDF abrem no navegador.
function cabecalhosDeArquivo(tipo) {
  const seguro = BancoLocal.tipoSeguro(tipo);
  const pdf = seguro === 'application/pdf';
  const cabecalhos = {
    'content-type': seguro,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'content-disposition': pdf || IMAGENS_EXIBIVEIS.test(seguro) ? 'inline' : 'attachment',
  };
  if (!pdf) cabecalhos['content-security-policy'] = "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'";
  return cabecalhos;
}

async function entregarArquivo(id) {
  try {
    const blob = await lerArquivo(id);
    if (!blob) return new Response('arquivo não encontrado', { status: 404 });
    return new Response(blob, { headers: cabecalhosDeArquivo(blob.type) });
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

// Fora da casca: a versão guardada primeiro. Um arquivo que não está nela
// vem do servidor, mas não é guardado; só a instalação de uma versão guarda arquivos.
async function guardadaPrimeiro(pedido) {
  const cache = await caches.open(VERSAO);
  if (pedido.mode === 'navigate') {
    const pagina = await cache.match('index.html');
    if (pagina) return pagina;
  }
  const guardada = await cache.match(pedido, { ignoreSearch: true });
  if (guardada) return guardada;
  try {
    return await fetch(pedido);
  } catch (e) {
    return Response.error();
  }
}

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin || pedido.method !== 'GET') return;
  if (url.pathname.startsWith('/sync/')) return;
  const arquivo = url.pathname.match(CAMINHO_DE_ARQUIVO);
  if (arquivo) {
    evento.respondWith(entregarArquivo(arquivo[1]));
    return;
  }
  if (url.href.startsWith(self.registration.scope)) evento.respondWith(NA_CASCA ? redeComReserva(pedido) : guardadaPrimeiro(pedido));
});
