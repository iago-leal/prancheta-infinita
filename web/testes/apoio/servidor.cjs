// Servidor estático da pasta web/, usado pelos testes no Chromium. Escuta
// numa porta livre de 127.0.0.1 e só entrega arquivos de dentro de web/.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..', '..');
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2', '.mp3': 'audio/mpeg',
};

async function servirWeb() {
  const servidor = http.createServer((req, res) => {
    let relativo = decodeURIComponent(new URL(req.url, 'http://local').pathname).replace(/^\/+/, '');
    if (relativo === '' || relativo.endsWith('/')) relativo += 'index.html';
    const arquivo = path.resolve(RAIZ, relativo);
    if (!arquivo.startsWith(RAIZ + path.sep) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'content-type': TIPOS[path.extname(arquivo)] ?? 'application/octet-stream' });
    fs.createReadStream(arquivo).pipe(res);
  });
  await new Promise((pronto) => servidor.listen(0, '127.0.0.1', pronto));
  return {
    base: `http://127.0.0.1:${servidor.address().port}`,
    // Fecha também as conexões mantidas abertas, para que o servidor fique
    // inacessível de imediato, como num servidor fora do ar.
    fechar: () => new Promise((pronto) => {
      servidor.close(() => pronto());
      servidor.closeAllConnections();
    }),
  };
}

module.exports = { servirWeb };
