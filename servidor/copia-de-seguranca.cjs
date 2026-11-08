// Cópia de segurança dos quadros, puxada do servidor pelo computador do autor,
// para que exista uma cópia fora da VPS sem que ela guarde credenciais de
// outro serviço. Usa a mesma interface dos aparelhos, com uma chave própria,
// criada por servidor/implantacao/prancheta-chave.
//
// Uso, no computador:
//   PRANCHETA_CHAVE=<chave da cópia> node servidor/copia-de-seguranca.cjs https://<endereço> <pasta>
//
// Cada execução cria <pasta>/<data e hora em UTC>/ com documentos.jsonl, uma
// linha por documento, com a posição e o registro, e arquivos.jsonl, com os
// dados de cada arquivo enviado. O conteúdo dos arquivos fica em
// <pasta>/arquivos/<id>, compartilhado entre as cópias, e só é baixado uma vez.
// Para rodar todo dia, agende-a no computador, por exemplo com o launchd no Mac.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]']);

async function copiar({ endereco, chave, pasta, fetch = globalThis.fetch, agora = new Date() }) {
  const url = new URL(endereco);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && LOCAL.has(url.hostname))) {
    throw new Error('o endereço do servidor precisa começar com https://');
  }
  if (typeof chave !== 'string' || chave.length < 32) throw new Error('defina PRANCHETA_CHAVE com a chave da cópia');
  const base = url.href.replace(/\/+$/, '');
  const pedir = async (rota) => {
    const r = await fetch(`${base}${rota}`, { headers: { Authorization: `Bearer ${chave}` } });
    if (!r.ok) throw new Error(`o servidor respondeu ${r.status} em ${rota}`);
    return r;
  };

  const destino = path.join(pasta, agora.toISOString().replace(/[:.]/g, '-'));
  const pastaDosArquivos = path.join(pasta, 'arquivos');
  fs.mkdirSync(destino, { recursive: true });
  fs.mkdirSync(pastaDosArquivos, { recursive: true });

  const documentos = [];
  const arquivos = [];
  for (let desde = 0; ;) {
    const pagina = await (await pedir(`/sync/mudancas?desde=${desde}&limite=500`)).json();
    documentos.push(...pagina.documentos);
    arquivos.push(...pagina.arquivos);
    desde = pagina.posicao;
    if (!pagina.mais) break;
  }

  let baixados = 0;
  for (const a of arquivos) {
    const caminho = path.join(pastaDosArquivos, a.id);
    if (fs.existsSync(caminho)) {
      const resumo = crypto.createHash('sha256').update(fs.readFileSync(caminho)).digest('hex');
      if (resumo === a.sha256) continue;
    }
    const conteudo = Buffer.from(await (await pedir(`/sync/arquivos/${encodeURIComponent(a.id)}`)).arrayBuffer());
    const resumo = crypto.createHash('sha256').update(conteudo).digest('hex');
    if (resumo !== a.sha256) throw new Error(`o arquivo ${a.id} chegou diferente do esperado`);
    fs.writeFileSync(`${caminho}.parcial`, conteudo);
    fs.renameSync(`${caminho}.parcial`, caminho);
    baixados += 1;
  }

  const linhas = (lista) => lista.map((x) => JSON.stringify(x)).join('\n') + (lista.length ? '\n' : '');
  fs.writeFileSync(path.join(destino, 'documentos.jsonl'), linhas(documentos));
  fs.writeFileSync(path.join(destino, 'arquivos.jsonl'), linhas(arquivos));
  return { destino, documentos: documentos.length, arquivos: arquivos.length, baixados };
}

if (require.main === module) {
  const [endereco, pasta] = process.argv.slice(2);
  if (!endereco || !pasta) {
    console.error('uso: PRANCHETA_CHAVE=<chave> node servidor/copia-de-seguranca.cjs https://<endereço> <pasta>');
    process.exit(2);
  }
  copiar({ endereco, chave: process.env.PRANCHETA_CHAVE, pasta }).then((r) => {
    console.log(`cópia em ${r.destino}: ${r.documentos} documentos e ${r.arquivos} arquivos, ${r.baixados} baixados agora`);
  }, (e) => {
    console.error(e.message);
    process.exit(1);
  });
}

module.exports = { copiar };
