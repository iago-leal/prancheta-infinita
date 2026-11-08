// Chaves de acesso do servidor da Prancheta.
//
// Em produção, cada aparelho tem a sua chave, e o servidor guarda só o resumo
// SHA-256 de cada uma, num arquivo indicado por PRANCHETA_CHAVES_ARQUIVO,
// com uma linha por aparelho:
//
//   <nome do aparelho> <resumo SHA-256 da chave, em hexadecimal>
//
// Linhas vazias e as que começam com # são ignoradas. A chave em si nunca
// fica no servidor nem no ambiente do contêiner; revogar um aparelho é
// apagar a linha dele, e o arquivo é relido quando muda, sem reiniciar.
// O roteiro de implantação cria as chaves com servidor/implantacao/prancheta-chave.
//
// Para rodar localmente e nos testes, uma chave única pode vir de
// PRANCHETA_CHAVE, como antes.

'use strict';

const fs = require('node:fs');
const crypto = require('node:crypto');

const resumo = (texto) => crypto.createHash('sha256').update(texto).digest();
const LINHA = /^([\w.-]{1,64})\s+([0-9a-f]{64})$/;

// Lê o arquivo de resumos; uma linha fora do formato é recusada, para que um
// erro de edição não passe despercebido.
function lerResumos(texto) {
  const resumos = [];
  texto.split('\n').forEach((bruta, i) => {
    const linha = bruta.trim();
    if (linha === '' || linha.startsWith('#')) return;
    const m = linha.match(LINHA);
    if (!m) throw new Error(`linha ${i + 1} do arquivo de chaves fora do formato "<nome> <sha256>"`);
    resumos.push({ nome: m[1], resumo: Buffer.from(m[2], 'hex') });
  });
  return resumos;
}

/**
 * Cria a função que confere a chave apresentada num pedido. Com `arquivo`,
 * aceita qualquer chave cujo resumo esteja nele, relendo-o quando a data de
 * modificação ou o tamanho mudam; com `chave`, aceita só ela.
 *
 * Devolve o nome do aparelho dono da chave, ou null.
 */
function criarVerificador({ arquivo, chave } = {}) {
  if (!arquivo) {
    if (typeof chave !== 'string' || chave.length < 32) throw new Error('a chave de acesso precisa ter pelo menos 32 caracteres');
    const esperada = resumo(chave);
    return (apresentada) => (crypto.timingSafeEqual(resumo(apresentada), esperada) ? 'unica' : null);
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
  atualizar();
  return (apresentada) => {
    try {
      atualizar();
    } catch (e) {
      // Sem conseguir ler o arquivo, nenhuma chave vale.
      console.error('arquivo de chaves ilegível:', e.message);
      resumos = [];
      marca = null;
    }
    const r = resumo(apresentada);
    let dono = null;
    // Compara com todos os resumos, sem parar no primeiro, para não variar o tempo conforme a posição.
    for (const item of resumos) if (crypto.timingSafeEqual(r, item.resumo) && !dono) dono = item.nome;
    return dono;
  };
}

module.exports = { criarVerificador, lerResumos };
