// Cifra ponta a ponta dos quadros, etapa 02 do plano 005. Os documentos e os
// arquivos saem do aparelho cifrados com AES-GCM, numa chave de 256 bits que
// só os aparelhos do autor e o Bitwarden dele conhecem; o servidor guarda e
// entrega apenas o conteúdo cifrado.
//
// A chave é criada no primeiro aparelho e mostrada uma única vez, em 13 grupos
// de 4 letras e algarismos, na base 32 de Crockford, que não distingue
// maiúsculas de minúsculas e lê O como 0 e I ou L como 1. Dela derivam-se, por
// HKDF, a chave da cifra, que o navegador guarda sem permitir que seja lida de
// volta, e um identificador curto, que vai em cada envelope: com ele, o
// servidor e os aparelhos percebem uma chave diferente sem conhecer a chave.
//
// Documento: os dados viram { cifra: 1, chave, iv, conteudo }, e o caminho, a
// versão, o horário e o aparelho entram como dados associados, de modo que o
// conteúdo não possa ser trocado de documento nem ter o horário mudado sem que
// a decifragem falhe.
//
// Arquivo: "PRCIFRA1", os 16 bytes do identificador da chave, o vetor inicial
// e, cifrados, o tamanho e o texto do tipo do arquivo seguidos do conteúdo,
// com o id do arquivo como dado associado.
//
// Funciona no navegador e no Node, que tem a mesma WebCrypto, para os testes.

(function (global) {
  'use strict';

  const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const BYTES_DA_CHAVE = 32;
  const LETRAS_DA_CHAVE = 52;
  const VERSAO = 1;
  const MAGICO = 'PRCIFRA1';
  const BYTES_DO_ID = 16;
  const BYTES_DO_IV = 12;
  const INICIO_DO_IV = MAGICO.length + BYTES_DO_ID;
  const INICIO_DA_CIFRA = INICIO_DO_IV + BYTES_DO_IV;
  // A etiqueta de autenticação do AES-GCM ocupa 16 bytes no fim da cifra.
  const MENOR_ARQUIVO = INICIO_DA_CIFRA + 16;
  const BASE64URL = /^[A-Za-z0-9_-]+$/;

  const codificador = new TextEncoder();
  const decodificador = new TextDecoder();
  const subtle = () => global.crypto.subtle;

  function erro(codigo, mensagem) {
    const e = new Error(mensagem);
    e.code = codigo;
    return e;
  }

  // ---- Base 32 de Crockford, para a chave mostrada ao autor ----

  function paraBase32(bytes) {
    let saida = '';
    let valor = 0;
    let bits = 0;
    for (const byte of bytes) {
      valor = (valor << 8) | byte;
      bits += 8;
      while (bits >= 5) {
        saida += ALFABETO[(valor >>> (bits - 5)) & 31];
        bits -= 5;
      }
      valor &= (1 << bits) - 1;
    }
    if (bits > 0) saida += ALFABETO[(valor << (5 - bits)) & 31];
    return saida;
  }

  const MENSAGEM_DA_CHAVE = 'a chave da cifra tem 52 letras e algarismos, em 13 grupos de 4';

  /** Lê a chave como o autor a digitou ou colou e devolve os 32 bytes dela. */
  function lerChave(texto) {
    const limpo = String(texto || '').toUpperCase().replace(/[\s-]/g, '')
      .replace(/O/g, '0').replace(/[IL]/g, '1');
    if (limpo.length !== LETRAS_DA_CHAVE) throw erro('chave_invalida', MENSAGEM_DA_CHAVE);
    const bytes = new Uint8Array(BYTES_DA_CHAVE);
    let valor = 0;
    let bits = 0;
    let n = 0;
    for (const letra of limpo) {
      const indice = ALFABETO.indexOf(letra);
      if (indice < 0) throw erro('chave_invalida', `${MENSAGEM_DA_CHAVE}; "${letra}" não faz parte dela`);
      valor = (valor << 5) | indice;
      bits += 5;
      if (bits >= 8) {
        if (n < BYTES_DA_CHAVE) bytes[n] = (valor >>> (bits - 8)) & 255;
        n += 1;
        bits -= 8;
      }
      valor &= (1 << bits) - 1;
    }
    // As 52 letras levam 260 bits; os 4 que sobram depois dos 256 da chave são zero.
    if (valor !== 0) throw erro('chave_invalida', `${MENSAGEM_DA_CHAVE}; a última letra não confere`);
    return bytes;
  }

  function formatarChave(bytes) {
    return paraBase32(bytes).match(/.{1,4}/g).join('-');
  }

  /** Uma chave nova, aleatória, já no formato mostrado ao autor. */
  function gerarChave() {
    const bytes = global.crypto.getRandomValues(new Uint8Array(BYTES_DA_CHAVE));
    const texto = formatarChave(bytes);
    bytes.fill(0);
    return texto;
  }

  // ---- Base64 sem preenchimento, segura para JSON e endereços ----

  function paraBase64url(bytes) {
    let binario = '';
    const PEDACO = 0x8000;
    for (let i = 0; i < bytes.length; i += PEDACO) {
      binario += String.fromCharCode.apply(null, bytes.subarray(i, i + PEDACO));
    }
    return global.btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function deBase64url(texto) {
    if (typeof texto !== 'string' || !BASE64URL.test(texto)) throw erro('cifra_invalida', 'envelope com texto inválido');
    const normal = texto.replace(/-/g, '+').replace(/_/g, '/');
    const binario = global.atob(normal + '='.repeat((4 - (normal.length % 4)) % 4));
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
    return bytes;
  }

  // ---- Chave da cifra ----

  const SAL = new Uint8Array(0);

  /**
   * Deriva da chave do autor a chave da cifra, que não pode ser exportada, e
   * o identificador dela. Devolve { chave, id }.
   */
  async function prepararChave(texto) {
    const bruta = lerChave(texto);
    try {
      const base = await subtle().importKey('raw', bruta, 'HKDF', false, ['deriveKey', 'deriveBits']);
      const chave = await subtle().deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt: SAL, info: codificador.encode('prancheta/cifra/v1/dados') },
        base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
      );
      const id = await subtle().deriveBits(
        { name: 'HKDF', hash: 'SHA-256', salt: SAL, info: codificador.encode('prancheta/cifra/v1/identificador') },
        base, BYTES_DO_ID * 8,
      );
      return { chave, id: paraBase64url(new Uint8Array(id)) };
    } finally {
      bruta.fill(0);
    }
  }

  // ---- Documentos ----

  function ehEnvelope(dados) {
    return Boolean(dados) && typeof dados === 'object' && !Array.isArray(dados)
      && Object.keys(dados).length === 4 && dados.cifra === VERSAO
      && typeof dados.chave === 'string' && typeof dados.iv === 'string' && typeof dados.conteudo === 'string';
  }

  function dadosAssociadosDoDocumento(registro) {
    return codificador.encode(JSON.stringify([
      'prancheta/documento/v1', registro.caminho, registro.versao,
      registro.atualizadoEm ?? null, registro.dispositivo ?? null,
    ]));
  }

  /** O envelope cifrado dos dados de um registro de documento. */
  async function cifrarDocumento(cifra, registro) {
    const iv = global.crypto.getRandomValues(new Uint8Array(BYTES_DO_IV));
    const conteudo = await subtle().encrypt(
      { name: 'AES-GCM', iv, additionalData: dadosAssociadosDoDocumento(registro) },
      cifra.chave, codificador.encode(JSON.stringify(registro.dados)),
    );
    return { cifra: VERSAO, chave: cifra.id, iv: paraBase64url(iv), conteudo: paraBase64url(new Uint8Array(conteudo)) };
  }

  /** Os dados de um registro cujo campo dados é um envelope. */
  async function decifrarDocumento(cifra, registro) {
    const envelope = registro.dados;
    if (!ehEnvelope(envelope)) throw erro('cifra_invalida', `o documento ${registro.caminho} não está cifrado`);
    if (envelope.chave !== cifra.id) throw erro('cifra_diferente', `o documento ${registro.caminho} foi cifrado com outra chave`);
    let claro;
    try {
      claro = await subtle().decrypt(
        { name: 'AES-GCM', iv: deBase64url(envelope.iv), additionalData: dadosAssociadosDoDocumento(registro) },
        cifra.chave, deBase64url(envelope.conteudo),
      );
    } catch (e) {
      throw erro('cifra_invalida', `o documento ${registro.caminho} chegou alterado e não pôde ser decifrado`);
    }
    return JSON.parse(decodificador.decode(claro));
  }

  // ---- Arquivos ----

  function ehArquivoCifrado(bytes) {
    if (!bytes || bytes.length < MENOR_ARQUIVO) return false;
    for (let i = 0; i < MAGICO.length; i++) if (bytes[i] !== MAGICO.charCodeAt(i)) return false;
    return true;
  }

  const dadosAssociadosDoArquivo = (id) => codificador.encode(`prancheta/arquivo/v1/${id}`);

  /** O conteúdo cifrado de um arquivo, com o tipo dentro da cifra, como Blob. */
  async function cifrarArquivo(cifra, id, blob, tipo) {
    const textoDoTipo = codificador.encode(String(tipo || 'application/octet-stream'));
    const conteudo = new Uint8Array(await blob.arrayBuffer());
    const claro = new Uint8Array(4 + textoDoTipo.length + conteudo.length);
    new DataView(claro.buffer).setUint32(0, textoDoTipo.length);
    claro.set(textoDoTipo, 4);
    claro.set(conteudo, 4 + textoDoTipo.length);
    const iv = global.crypto.getRandomValues(new Uint8Array(BYTES_DO_IV));
    const cifrado = await subtle().encrypt(
      { name: 'AES-GCM', iv, additionalData: dadosAssociadosDoArquivo(id) }, cifra.chave, claro,
    );
    claro.fill(0);
    return new Blob([codificador.encode(MAGICO), deBase64url(cifra.id), iv, new Uint8Array(cifrado)], { type: 'application/octet-stream' });
  }

  /** Decifra o conteúdo de um arquivo e devolve { tipo, blob }. */
  async function decifrarArquivo(cifra, id, bytes) {
    if (!ehArquivoCifrado(bytes)) throw erro('cifra_invalida', `o arquivo ${id} não está cifrado`);
    if (paraBase64url(bytes.subarray(MAGICO.length, INICIO_DO_IV)) !== cifra.id) {
      throw erro('cifra_diferente', `o arquivo ${id} foi cifrado com outra chave`);
    }
    let claro;
    try {
      claro = new Uint8Array(await subtle().decrypt(
        { name: 'AES-GCM', iv: bytes.slice(INICIO_DO_IV, INICIO_DA_CIFRA), additionalData: dadosAssociadosDoArquivo(id) },
        cifra.chave, bytes.slice(INICIO_DA_CIFRA),
      ));
    } catch (e) {
      throw erro('cifra_invalida', `o arquivo ${id} chegou alterado e não pôde ser decifrado`);
    }
    const tamanhoDoTipo = new DataView(claro.buffer).getUint32(0);
    const tipo = decodificador.decode(claro.subarray(4, 4 + tamanhoDoTipo));
    return { tipo, blob: new Blob([claro.subarray(4 + tamanhoDoTipo)], { type: tipo }) };
  }

  global.CifraPrancheta = Object.freeze({
    gerarChave, lerChave, formatarChave, prepararChave,
    ehEnvelope, cifrarDocumento, decifrarDocumento,
    ehArquivoCifrado, cifrarArquivo, decifrarArquivo,
  });
})(typeof window !== 'undefined' ? window : globalThis);
