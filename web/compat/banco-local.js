// Banco local da Prancheta: documentos e coleções guardados em IndexedDB,
// com a interface que o código do artefato usa do claude.ai, descrita em
// web/inventario-claude.md. Funciona sem rede, no Boox e no computador.
//
// Para a sincronização com a VPS, prevista para o plano 003, cada documento
// guarda versão, horário e aparelho da última gravação; as exclusões deixam
// uma marca em vez de apagar o registro; e toda gravação entra no registro
// de mudanças, cuja posição, somada ao aparelho, identifica cada mudança.
//
// Uso: const banco = await BancoLocal.abrir({ nome: 'prancheta' });

(function (global) {
  'use strict';

  const VERSAO_DO_ESQUEMA = 1;

  function erro(codigo, mensagem, causa) {
    const e = new Error(mensagem, causa ? { cause: causa } : undefined);
    e.code = codigo;
    return e;
  }

  // O artefato decide o que fazer pelo e.code; os erros do IndexedDB chegam
  // com nomes próprios e precisam ser traduzidos para os códigos que ele trata.
  function traduzir(e) {
    if (e && typeof e.code === 'string') return e;
    if (e && e.name === 'QuotaExceededError') return erro('quota_exceeded', 'sem espaço no banco local', e);
    return erro('unavailable', `banco local indisponível: ${(e && e.message) || e}`, e);
  }

  function segmentos(caminho) {
    if (typeof caminho !== 'string' || caminho === '') throw erro('invalid_argument', 'caminho vazio');
    const partes = caminho.split('/');
    if (partes.some((p) => p === '')) throw erro('invalid_argument', `caminho inválido: ${caminho}`);
    return partes;
  }

  // Caminhos alternam coleção e documento: "a" é coleção, "a/b" é documento.
  function validarDocumento(caminho) {
    const partes = segmentos(caminho);
    if (partes.length % 2 !== 0) throw erro('invalid_argument', `não é caminho de documento: ${caminho}`);
    return partes;
  }

  function validarColecao(caminho) {
    const partes = segmentos(caminho);
    if (partes.length % 2 !== 1) throw erro('invalid_argument', `não é caminho de coleção: ${caminho}`);
    return partes;
  }

  function validarDados(dados) {
    if (dados === null || typeof dados !== 'object' || Array.isArray(dados)) {
      throw erro('invalid_argument', 'os dados de um documento precisam ser um objeto');
    }
  }

  const copiar = (valor) => (valor === undefined ? undefined : structuredClone(valor));

  function novoId(bytes) {
    const b = new Uint8Array(bytes);
    crypto.getRandomValues(b);
    return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  }

  function aguardar(requisicao) {
    return new Promise((ok, falha) => {
      requisicao.onsuccess = () => ok(requisicao.result);
      requisicao.onerror = () => falha(traduzir(requisicao.error));
    });
  }

  function concluida(transacao) {
    return new Promise((ok, falha) => {
      transacao.oncomplete = () => ok();
      transacao.onerror = () => falha(traduzir(transacao.error));
      transacao.onabort = () => falha(traduzir(transacao.error || erro('cancelled', 'transação abortada')));
    });
  }

  function abrirIndexedDB(nome) {
    const requisicao = indexedDB.open(nome, VERSAO_DO_ESQUEMA);
    requisicao.onupgradeneeded = () => {
      const idb = requisicao.result;
      const documentos = idb.createObjectStore('documentos', { keyPath: 'caminho' });
      documentos.createIndex('colecao', 'colecao');
      idb.createObjectStore('mudancas', { keyPath: 'seq', autoIncrement: true });
      idb.createObjectStore('arquivos', { keyPath: 'id' });
      idb.createObjectStore('meta', { keyPath: 'chave' });
    };
    return aguardar(requisicao);
  }

  // Instantâneos no formato que o artefato lê. Como o banco local é a fonte
  // dos dados, nenhum instantâneo vem de um cache: fromCache é sempre falso.
  function instantaneoDeDocumento(banco, caminho, registro) {
    const existe = Boolean(registro && !registro.apagado);
    const dados = existe ? registro.dados : undefined;
    return {
      id: caminho.split('/').pop(),
      ref: banco.doc(caminho),
      exists: existe,
      metadata: { fromCache: false, hasPendingWrites: false },
      data: () => copiar(dados),
    };
  }

  function instantaneoDeColecao(documentos, mudancas) {
    return {
      docs: documentos,
      size: documentos.length,
      empty: documentos.length === 0,
      metadata: { fromCache: false, hasPendingWrites: false },
      docChanges: () => mudancas.slice(),
      forEach: (f) => documentos.forEach(f),
    };
  }

  class Banco {
    constructor(nome, idb, dispositivo) {
      this.nome = nome;
      this.dispositivo = dispositivo;
      this._idb = idb;
      this._ouvintesDeDocumento = new Map();
      this._ouvintesDeColecao = new Map();
      this._canal = typeof BroadcastChannel === 'function' ? new BroadcastChannel(`prancheta-banco:${nome}`) : null;
      if (this._canal) this._canal.onmessage = (e) => this._avisar(e.data && e.data.caminho, false);
      // Uma versão nova do esquema, aberta em outra aba, só avança se esta soltar o banco.
      idb.onversionchange = () => this.fechar();
    }

    doc(caminho) {
      validarDocumento(caminho);
      const banco = this;
      return {
        id: caminho.split('/').pop(),
        path: caminho,
        get: () => banco._ler(caminho).then((r) => instantaneoDeDocumento(banco, caminho, r)),
        set: async (dados) => {
          validarDados(dados);
          const copia = copiar(dados);
          return banco._gravar(caminho, 'set', () => copia);
        },
        update: async (campos) => {
          validarDados(campos);
          const copia = copiar(campos);
          return banco._gravar(caminho, 'update', (atual) => {
            if (!atual || atual.apagado) throw erro('not_found', `documento inexistente: ${caminho}`);
            return { ...atual.dados, ...copia };
          }, Object.keys(copia));
        },
        delete: () => banco._gravar(caminho, 'delete', () => null),
        onSnapshot: (aoMudar, aoFalhar) => banco._acompanharDocumento(caminho, aoMudar, aoFalhar),
      };
    }

    collection(caminho) {
      validarColecao(caminho);
      const banco = this;
      return {
        id: caminho.split('/').pop(),
        path: caminho,
        doc: (id) => banco.doc(`${caminho}/${typeof id === 'string' && id !== '' ? id : novoId(10)}`),
        get: async () => {
          const registros = await banco._listar(caminho);
          const documentos = registros.map((r) => instantaneoDeDocumento(banco, r.caminho, r));
          return instantaneoDeColecao(documentos, documentos.map((d, i) => ({ type: 'added', doc: d, oldIndex: -1, newIndex: i })));
        },
        onSnapshot: (aoMudar, aoFalhar) => banco._acompanharColecao(caminho, aoMudar, aoFalhar),
      };
    }

    // Guarda um arquivo enviado e devolve seu id, como o upload do artefato.
    async guardarArquivo(blob, opcoes = {}) {
      if (!(blob instanceof Blob)) throw erro('invalid_argument', 'esperava um Blob');
      const id = novoId(16);
      const agora = Date.now();
      const transacao = this._transacao(['arquivos', 'mudancas'], 'readwrite');
      transacao.objectStore('arquivos').put({
        id, tipo: opcoes.type || blob.type || 'application/octet-stream', bytes: blob.size, criadoEm: agora,
        dispositivo: this.dispositivo, blob,
      });
      transacao.objectStore('mudancas').put({ caminho: `_arquivos/${id}`, tipo: 'arquivo', versao: 1, em: agora, dispositivo: this.dispositivo });
      await concluida(transacao);
      return { id };
    }

    // Devolve o arquivo guardado, com o tipo informado no envio, ou null.
    async lerArquivo(id) {
      const registro = await aguardar(this._transacao('arquivos').objectStore('arquivos').get(String(id)));
      if (!registro) return null;
      return registro.blob.type === registro.tipo ? registro.blob : registro.blob.slice(0, registro.blob.size, registro.tipo);
    }

    // Registro de mudanças, em ordem, depois de uma posição; serve à sincronização.
    async mudancas(desde = 0) {
      return aguardar(this._transacao('mudancas').objectStore('mudancas').getAll(IDBKeyRange.lowerBound(desde, true)));
    }

    fechar() {
      if (this._canal) this._canal.close();
      this._canal = null;
      this._idb.close();
    }

    // Abre uma transação; com o banco fechado, o erro sai com o código que o artefato trata.
    _transacao(lojas, modo = 'readonly') {
      try {
        return this._idb.transaction(lojas, modo);
      } catch (e) {
        throw traduzir(e);
      }
    }

    async _ler(caminho) {
      return aguardar(this._transacao('documentos').objectStore('documentos').get(caminho));
    }

    async _listar(colecao) {
      const indice = this._transacao('documentos').objectStore('documentos').index('colecao');
      const registros = await aguardar(indice.getAll(colecao));
      return registros.filter((r) => !r.apagado).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    }

    // Lê e grava na mesma transação, para que duas gravações seguidas no
    // mesmo documento nunca repitam a versão.
    async _gravar(caminho, tipo, calcular, campos) {
      const partes = validarDocumento(caminho);
      const transacao = this._transacao(['documentos', 'mudancas'], 'readwrite');
      const fim = concluida(transacao);
      // A falha da transação também chega pelas requisições; evita aviso de rejeição sem tratamento.
      fim.catch(() => {});
      const documentos = transacao.objectStore('documentos');
      const atual = await aguardar(documentos.get(caminho));
      let dados;
      try {
        dados = calcular(atual);
      } catch (e) {
        transacao.abort();
        throw e;
      }
      if (tipo === 'delete' && (!atual || atual.apagado)) {
        await fim;
        return;
      }
      const agora = Date.now();
      const versao = (atual ? atual.versao : 0) + 1;
      documentos.put({
        caminho, colecao: partes.slice(0, -1).join('/'), id: partes[partes.length - 1],
        dados: tipo === 'delete' ? null : dados, apagado: tipo === 'delete',
        versao, atualizadoEm: agora, dispositivo: this.dispositivo,
      });
      const mudanca = { caminho, tipo, versao, em: agora, dispositivo: this.dispositivo };
      if (campos) mudanca.campos = campos;
      transacao.objectStore('mudancas').put(mudanca);
      await fim;
      this._avisar(caminho, true);
    }

    _avisar(caminho, propagar) {
      if (typeof caminho !== 'string') return;
      const colecao = caminho.split('/').slice(0, -1).join('/');
      for (const ouvinte of this._ouvintesDeDocumento.get(caminho) || []) ouvinte.atualizar();
      for (const ouvinte of this._ouvintesDeColecao.get(colecao) || []) ouvinte.atualizar();
      if (propagar && this._canal) this._canal.postMessage({ caminho });
    }

    // Cada ouvinte relê o banco a cada aviso. Como duas leituras seguidas
    // podem terminar fora de ordem, só a resposta do pedido mais recente vale.
    _registrar(mapa, chave, ler, entregar, aoFalhar) {
      const ouvinte = { ativo: true, pedido: 0 };
      ouvinte.atualizar = () => {
        const pedido = ++ouvinte.pedido;
        ler().then((resultado) => {
          if (ouvinte.ativo && pedido === ouvinte.pedido) entregar(resultado);
        }, (e) => {
          if (ouvinte.ativo && pedido === ouvinte.pedido && aoFalhar) aoFalhar(e);
        });
      };
      if (!mapa.has(chave)) mapa.set(chave, new Set());
      mapa.get(chave).add(ouvinte);
      ouvinte.atualizar();
      return () => {
        ouvinte.ativo = false;
        mapa.get(chave)?.delete(ouvinte);
      };
    }

    // Avisa só quando a versão ou a existência do documento muda.
    _acompanharDocumento(caminho, aoMudar, aoFalhar) {
      validarDocumento(caminho);
      let ultima = null;
      return this._registrar(this._ouvintesDeDocumento, caminho, () => this._ler(caminho), (registro) => {
        const marca = registro ? `${registro.versao}:${registro.apagado}` : 'ausente';
        if (marca === ultima) return;
        ultima = marca;
        aoMudar(instantaneoDeDocumento(this, caminho, registro));
      }, aoFalhar);
    }

    // Compara com o último instantâneo entregue e descreve as mudanças; o
    // primeiro instantâneo traz todos os documentos como acrescentados.
    _acompanharColecao(colecao, aoMudar, aoFalhar) {
      validarColecao(colecao);
      let anterior = null;
      return this._registrar(this._ouvintesDeColecao, colecao, () => this._listar(colecao), (registros) => {
        const atual = new Map(registros.map((r, i) => [r.id, { registro: r, indice: i }]));
        const documentos = registros.map((r) => instantaneoDeDocumento(this, r.caminho, r));
        const mudancas = [];
        if (anterior) {
          for (const [id, antes] of anterior) {
            if (!atual.has(id)) {
              mudancas.push({ type: 'removed', doc: instantaneoDeDocumento(this, antes.registro.caminho, antes.registro), oldIndex: antes.indice, newIndex: -1 });
            }
          }
        }
        registros.forEach((r, i) => {
          const antes = anterior && anterior.get(r.id);
          if (!antes) mudancas.push({ type: 'added', doc: documentos[i], oldIndex: -1, newIndex: i });
          else if (antes.registro.versao !== r.versao) mudancas.push({ type: 'modified', doc: documentos[i], oldIndex: antes.indice, newIndex: i });
        });
        if (anterior && mudancas.length === 0) return;
        anterior = atual;
        aoMudar(instantaneoDeColecao(documentos, mudancas));
      }, aoFalhar);
    }
  }

  async function abrir(opcoes = {}) {
    const nome = opcoes.nome || 'prancheta';
    let idb;
    try {
      idb = await abrirIndexedDB(`prancheta-banco-${nome}`);
    } catch (e) {
      throw traduzir(e);
    }
    let meta = await aguardar(idb.transaction('meta').objectStore('meta').get('dispositivo'));
    if (!meta) {
      meta = { chave: 'dispositivo', valor: novoId(8) };
      const transacao = idb.transaction('meta', 'readwrite');
      transacao.objectStore('meta').put(meta);
      await concluida(transacao);
    }
    // Pede ao navegador que não apague os dados para liberar espaço.
    try {
      if (navigator.storage && navigator.storage.persist) await navigator.storage.persist();
    } catch (e) { /* o navegador pode recusar sem prejuízo para o funcionamento */ }
    return new Banco(nome, idb, meta.valor);
  }

  global.BancoLocal = Object.freeze({ abrir });
})(typeof window !== 'undefined' ? window : globalThis);
