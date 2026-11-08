// Combinação em três vias dos dados de um documento, usada pela
// sincronização e pela gravação da página. Recebe a base, a versão que os
// dois lados conheciam, e as duas versões mudadas a partir dela, a local e a
// remota, e devolve uma versão com as mudanças dos dois lados.
//
// Regras, aplicadas em cada nível dos dados:
//
// - o que só um lado mudou fica com a mudança desse lado;
// - o que os dois lados mudaram para o mesmo valor fica com esse valor;
// - objetos mudados dos dois lados são combinados campo a campo;
// - listas de objetos com id, como os itens de um fragmento do quadro e os
//   quadros e pastas da biblioteca, são combinadas item a item, pelo id, na
//   ordem da lista local, seguida dos itens novos da remota;
// - um item ou campo apagado de um lado e mudado do outro fica com a mudança,
//   para que nenhuma edição se perca;
// - o mesmo valor mudado dos dois lados para valores diferentes, como o
//   texto de um cartão editado nos dois aparelhos, fica com o lado indicado
//   em `prevalece`, que quem chama escolhe pelo horário das duas versões.
//
// Os campos de primeiro nível `by` e `rev`, com que a página marca quem
// gravou e reconhece as próprias gravações, acompanham a versão local; o
// `rev` ganha um valor novo quando o resultado difere da versão local no
// restante, para que a página aplique o resultado em vez de ignorá-lo.
//
// No navegador, fica em window.CombinarPrancheta; no Node, em module.exports.

(function (global) {
  'use strict';

  const ehObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

  // Igualdade de valores JSON, sem depender da ordem dos campos; um campo
  // com valor undefined conta como ausente.
  function igual(a, b) {
    if (a === b) return true;
    if (Array.isArray(a)) {
      if (!Array.isArray(b) || a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) if (!igual(a[i], b[i])) return false;
      return true;
    }
    if (ehObjeto(a)) {
      if (!ehObjeto(b)) return false;
      const chavesA = Object.keys(a).filter((k) => a[k] !== undefined);
      const chavesB = Object.keys(b).filter((k) => b[k] !== undefined);
      if (chavesA.length !== chavesB.length) return false;
      for (const k of chavesA) if (!igual(a[k], b[k])) return false;
      return true;
    }
    return false;
  }

  // Lista de objetos, cada um com um id de texto, sem ids repetidos.
  function listaComIds(v) {
    if (!Array.isArray(v)) return false;
    const vistos = new Set();
    for (const e of v) {
      if (!ehObjeto(e) || typeof e.id !== 'string' || e.id === '' || vistos.has(e.id)) return false;
      vistos.add(e.id);
    }
    return true;
  }

  function combinarValor(base, local, remoto, prevalece) {
    if (igual(local, remoto)) return local;
    if (igual(base, local)) return remoto;
    if (igual(base, remoto)) return local;
    // Os dois lados mudaram, e de modos diferentes.
    if (local === undefined) return remoto;
    if (remoto === undefined) return local;
    if (ehObjeto(local) && ehObjeto(remoto)) return combinarObjetos(ehObjeto(base) ? base : {}, local, remoto, prevalece);
    if (listaComIds(local) && listaComIds(remoto)) return combinarListas(listaComIds(base) ? base : [], local, remoto, prevalece);
    return prevalece === 'local' ? local : remoto;
  }

  function combinarObjetos(base, local, remoto, prevalece) {
    const resultado = {};
    const chaves = [...Object.keys(local), ...Object.keys(remoto).filter((k) => !(k in local))];
    for (const k of chaves) {
      const valor = combinarValor(base[k], local[k], remoto[k], prevalece);
      if (valor !== undefined) resultado[k] = valor;
    }
    return resultado;
  }

  function combinarListas(base, local, remoto, prevalece) {
    const porId = (lista) => new Map(lista.map((e) => [e.id, e]));
    const b = porId(base);
    const l = porId(local);
    const r = porId(remoto);
    const ids = [...l.keys(), ...[...r.keys()].filter((id) => !l.has(id))];
    const resultado = [];
    for (const id of ids) {
      const valor = combinarValor(b.get(id), l.get(id), r.get(id), prevalece);
      if (valor !== undefined) resultado.push(valor);
    }
    return resultado;
  }

  function novoRev() {
    const bytes = new Uint8Array(6);
    (global.crypto || require('node:crypto').webcrypto).getRandomValues(bytes);
    return `s${Array.from(bytes, (x) => x.toString(36).padStart(2, '0')).join('').slice(0, 10)}`;
  }

  /**
   * Combina os dados de um documento. Cada versão é o objeto de dados, ou
   * undefined quando o documento não existe ou foi apagado; o resultado
   * undefined significa documento apagado.
   *
   * @param base dados que os dois lados conheciam, ou undefined.
   * @param local dados da versão local.
   * @param remoto dados da versão remota.
   * @param opcoes.prevalece 'local' ou 'remoto', para o mesmo valor mudado dos dois lados.
   */
  function combinar(base, local, remoto, { prevalece = 'remoto' } = {}) {
    const resultado = combinarValor(base, local, remoto, prevalece);
    if (!ehObjeto(resultado) || !ehObjeto(local)) return resultado;
    const marcado = { ...resultado };
    if ('by' in local) marcado.by = local.by;
    if (typeof marcado.rev === 'string' || typeof local.rev === 'string') {
      const semRev = ({ rev, ...resto }) => resto;
      marcado.rev = typeof local.rev === 'string' && igual(semRev(marcado), semRev(local)) ? local.rev : novoRev();
    }
    return marcado;
  }

  const api = Object.freeze({ combinar, igual });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.CombinarPrancheta = api;
})(typeof window !== 'undefined' ? window : globalThis);
