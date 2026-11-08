// Banco local da Prancheta: documentos e coleções guardados em IndexedDB,
// com a interface que o código do artefato usa do claude.ai, descrita em
// web/inventario-claude.md. Funciona sem rede, no Boox e no computador, e
// também dentro do service worker, que o usa para entregar os arquivos enviados.
//
// Para a sincronização com a VPS, em compat/sincronizacao.js, cada documento
// guarda versão, horário e aparelho da última gravação; as exclusões deixam
// uma marca em vez de apagar o registro; e toda gravação entra no registro
// de mudanças, cuja posição, somada ao aparelho, identifica cada mudança. O
// registro guarda só o que ainda não foi confirmado pelo servidor.
//
// A página grava cada documento inteiro, a partir da cópia que tem na
// memória. Se a sincronização mudou o documento depois da última gravação da
// página, e a página ainda não aplicou essa mudança, gravar por cima a
// apagaria; por isso, a gravação da página é combinada item a item, por
// compat/combinar.js, com o que mudou no banco desde a última gravação dela.
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

  // Identifica uma versão gravada de um documento: duas gravações em
  // aparelhos diferentes podem ter o mesmo número de versão.
  const marca = (r) => (r ? `${r.versao}:${r.apagado}:${r.atualizadoEm}:${r.dispositivo}` : 'ausente');

  const dadosDe = (r) => (r && !r.apagado ? r.dados : undefined);

  // Combina a gravação da página com o que mudou no banco desde a última
  // gravação dela; sem compat/combinar.js, como no service worker, a
  // gravação substitui o documento.
  function combinarComAPagina(pagina, dados, atual) {
    const combinador = global.CombinarPrancheta;
    if (!combinador || !pagina || !atual) return dados;
    if (pagina.igual && pagina.marca === marca(atual)) return dados;
    return combinador.combinar(pagina.dados, dados, dadosDe(atual), { prevalece: 'local' });
  }

  function iguais(a, b) {
    if (a === b) return true;
    const combinador = global.CombinarPrancheta;
    return combinador ? combinador.igual(a, b) : JSON.stringify(a) === JSON.stringify(b);
  }

  // Registro de documento no formato do banco, a partir do que veio do servidor.
  function registroDoServidor(r) {
    const partes = validarDocumento(r.caminho);
    return {
      caminho: r.caminho, colecao: partes.slice(0, -1).join('/'), id: partes[partes.length - 1],
      dados: r.apagado ? null : r.dados, apagado: Boolean(r.apagado),
      versao: r.versao, atualizadoEm: r.atualizadoEm, dispositivo: r.dispositivo,
    };
  }

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
      // Chamado depois de cada gravação feita neste aparelho; a sincronização o usa.
      this.aoGravar = null;
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
      this._depoisDeGravar();
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
    // mesmo documento nunca repitam a versão. Cada gravação da página guarda,
    // em meta, os dados que a página gravou, com que a gravação seguinte é combinada.
    async _gravar(caminho, tipo, calcular, campos) {
      const partes = validarDocumento(caminho);
      const transacao = this._transacao(['documentos', 'mudancas', 'meta'], 'readwrite');
      const fim = concluida(transacao);
      // A falha da transação também chega pelas requisições; evita aviso de rejeição sem tratamento.
      fim.catch(() => {});
      const documentos = transacao.objectStore('documentos');
      const meta = transacao.objectStore('meta');
      const chaveDaPagina = `pagina:${caminho}`;
      const atual = await aguardar(documentos.get(caminho));
      const pagina = tipo === 'set' ? await aguardar(meta.get(chaveDaPagina)) : undefined;
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
      let final = dados;
      if (tipo === 'set') {
        final = combinarComAPagina(pagina, dados, atual);
        // A página regravou sem mudança um documento que o outro aparelho apagou: continua apagado.
        if (final === undefined) {
          await fim;
          return;
        }
      }
      const agora = Date.now();
      const versao = (atual ? atual.versao : 0) + 1;
      const registro = {
        caminho, colecao: partes.slice(0, -1).join('/'), id: partes[partes.length - 1],
        dados: tipo === 'delete' ? null : final, apagado: tipo === 'delete',
        versao, atualizadoEm: agora, dispositivo: this.dispositivo,
      };
      documentos.put(registro);
      if (tipo === 'delete') meta.delete(chaveDaPagina);
      else meta.put({ chave: chaveDaPagina, marca: marca(registro), dados, igual: final === dados || iguais(final, dados) });
      const mudanca = { caminho, tipo, versao, em: agora, dispositivo: this.dispositivo };
      if (campos) mudanca.campos = campos;
      transacao.objectStore('mudancas').put(mudanca);
      await fim;
      this._avisar(caminho, true);
      this._depoisDeGravar();
    }

    _depoisDeGravar() {
      if (typeof this.aoGravar !== 'function') return;
      try {
        this.aoGravar();
      } catch (e) { /* um erro de quem acompanha as gravações não desfaz a gravação */ }
    }

    // ---- Operações usadas pela sincronização, em compat/sincronizacao.js ----

    async _lerMeta(chave) {
      return aguardar(this._transacao('meta').objectStore('meta').get(chave));
    }

    async _gravarMeta(registro) {
      const transacao = this._transacao('meta', 'readwrite');
      transacao.objectStore('meta').put(registro);
      await concluida(transacao);
    }

    // Mudanças ainda não confirmadas pelo servidor: a última de cada
    // documento e a de cada arquivo enviado, com o número dela.
    async _pendentes() {
      const todas = await aguardar(this._transacao('mudancas').objectStore('mudancas').getAll());
      const documentos = new Map();
      const arquivos = new Map();
      for (const m of todas) {
        if (m.caminho.startsWith('_arquivos/')) arquivos.set(m.caminho.slice('_arquivos/'.length), m.seq);
        else documentos.set(m.caminho, Math.max(documentos.get(m.caminho) || 0, m.seq));
      }
      return { documentos, arquivos };
    }

    // O documento como está no banco e a base da sincronização, a versão do
    // servidor que este aparelho conhece, com a posição dela.
    async _paraEnviar(caminho) {
      const transacao = this._transacao(['documentos', 'meta']);
      const [registro, base] = await Promise.all([
        aguardar(transacao.objectStore('documentos').get(caminho)),
        aguardar(transacao.objectStore('meta').get(`base:${caminho}`)),
      ]);
      return { registro, base };
    }

    // Apaga do registro as mudanças de um caminho até o número dado.
    _podar(mudancas, caminho, ate) {
      return new Promise((ok, falha) => {
        const cursor = mudancas.openCursor(IDBKeyRange.upperBound(ate));
        cursor.onsuccess = () => {
          const c = cursor.result;
          if (!c) return ok();
          if (c.value.caminho === caminho) c.delete();
          c.continue();
        };
        cursor.onerror = () => falha(traduzir(cursor.error));
      });
    }

    // O servidor aceitou um documento enviado: a versão enviada passa a ser a
    // base, e as mudanças que ela inclui saem do registro.
    async _confirmarEnvio(caminho, seq, pos, registro) {
      const transacao = this._transacao(['mudancas', 'meta'], 'readwrite');
      const fim = concluida(transacao);
      fim.catch(() => {});
      const meta = transacao.objectStore('meta');
      const base = await aguardar(meta.get(`base:${caminho}`));
      if (!base || base.pos < pos) meta.put({ chave: `base:${caminho}`, pos, dados: dadosDe(registro) ?? null, apagado: Boolean(registro.apagado) });
      await this._podar(transacao.objectStore('mudancas'), caminho, seq);
      await fim;
    }

    // O servidor guardou um arquivo enviado: a mudança dele sai do registro.
    async _confirmarArquivo(id, seq) {
      const transacao = this._transacao('mudancas', 'readwrite');
      const fim = concluida(transacao);
      fim.catch(() => {});
      await this._podar(transacao.objectStore('mudancas'), `_arquivos/${id}`, seq);
      await fim;
    }

    /**
     * Aplica a versão de um documento recebida do servidor, na posição dada.
     * Sem mudanças locais pendentes, ela substitui a local. Com elas, as duas
     * são combinadas item a item a partir da base; no mesmo valor mudado dos
     * dois lados, prevalece a versão gravada por último, pelo horário de cada
     * aparelho, e, no empate, a do servidor. Um resultado diferente da versão
     * do servidor fica pendente, para ser enviado.
     *
     * Devolve 'conhecida', 'aplicada' ou 'combinada'.
     */
    async _aplicarDoServidor(recebido, pos) {
      const caminho = recebido.caminho;
      const partes = validarDocumento(caminho);
      const transacao = this._transacao(['documentos', 'mudancas', 'meta'], 'readwrite');
      const fim = concluida(transacao);
      fim.catch(() => {});
      const documentos = transacao.objectStore('documentos');
      const mudancas = transacao.objectStore('mudancas');
      const meta = transacao.objectStore('meta');
      const base = await aguardar(meta.get(`base:${caminho}`));
      if (base && base.pos >= pos) {
        await fim;
        return 'conhecida';
      }
      const atual = await aguardar(documentos.get(caminho));
      const pendentes = (await aguardar(mudancas.getAll())).filter((m) => m.caminho === caminho);
      const remoto = registroDoServidor(recebido);
      meta.put({ chave: `base:${caminho}`, pos, dados: remoto.dados, apagado: remoto.apagado });
      let resultado = 'aplicada';
      if (!atual || pendentes.length === 0) {
        if (marca(atual) !== marca(remoto) || !iguais(dadosDe(atual), dadosDe(remoto))) documentos.put(remoto);
      } else {
        const prevalece = atual.atualizadoEm > remoto.atualizadoEm ? 'local' : 'remoto';
        const combinador = global.CombinarPrancheta;
        const final = combinador.combinar(base && !base.apagado ? base.dados : undefined, dadosDe(atual), dadosDe(remoto), { prevalece });
        if (iguais(final, dadosDe(remoto))) {
          // As mudanças locais já estão na versão do servidor.
          documentos.put(remoto);
          for (const m of pendentes) mudancas.delete(m.seq);
        } else {
          const agora = Date.now();
          const versao = Math.max(atual.versao, remoto.versao) + 1;
          documentos.put({
            caminho, colecao: partes.slice(0, -1).join('/'), id: partes[partes.length - 1],
            dados: final === undefined ? null : final, apagado: final === undefined,
            versao, atualizadoEm: agora, dispositivo: this.dispositivo,
          });
          mudancas.put({ caminho, tipo: 'combinacao', versao, em: agora, dispositivo: this.dispositivo });
          resultado = 'combinada';
        }
      }
      await fim;
      this._avisar(caminho, true);
      return resultado;
    }

    // O servidor não tem a versão que este aparelho tomava por base, como
    // depois de perder os dados: o documento volta a ser enviado sem base.
    async _esquecerBase(caminho) {
      const transacao = this._transacao('meta', 'readwrite');
      transacao.objectStore('meta').delete(`base:${caminho}`);
      await concluida(transacao);
    }

    async _lerRegistroDeArquivo(id) {
      return aguardar(this._transacao('arquivos').objectStore('arquivos').get(String(id)));
    }

    // Guarda um arquivo recebido do servidor, sem registrar mudança.
    async _guardarArquivoDoServidor(dados, blob) {
      const transacao = this._transacao('arquivos', 'readwrite');
      transacao.objectStore('arquivos').put({
        id: dados.id, tipo: dados.tipo, bytes: blob.size, criadoEm: dados.criadoEm, dispositivo: dados.dispositivo, blob,
      });
      await concluida(transacao);
    }

    // Para um servidor novo: esquece as bases e a posição e marca todos os
    // documentos e arquivos para envio.
    async _prepararParaOutroServidor() {
      const transacao = this._transacao(['documentos', 'arquivos', 'mudancas', 'meta'], 'readwrite');
      const fim = concluida(transacao);
      fim.catch(() => {});
      const meta = transacao.objectStore('meta');
      meta.delete(IDBKeyRange.bound('base:', 'base:\uffff'));
      meta.delete('sinc:posicao');
      const mudancas = transacao.objectStore('mudancas');
      const agora = Date.now();
      for (const r of await aguardar(transacao.objectStore('documentos').getAll())) {
        mudancas.put({ caminho: r.caminho, tipo: 'reenvio', versao: r.versao, em: agora, dispositivo: this.dispositivo });
      }
      for (const id of await aguardar(transacao.objectStore('arquivos').getAllKeys())) {
        mudancas.put({ caminho: `_arquivos/${id}`, tipo: 'arquivo', versao: 1, em: agora, dispositivo: this.dispositivo });
      }
      await fim;
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

    // Avisa só quando o documento muda: outra versão, de qualquer aparelho, ou a existência.
    _acompanharDocumento(caminho, aoMudar, aoFalhar) {
      validarDocumento(caminho);
      let ultima = null;
      return this._registrar(this._ouvintesDeDocumento, caminho, () => this._ler(caminho), (registro) => {
        const atual = marca(registro);
        if (atual === ultima) return;
        ultima = atual;
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
          else if (marca(antes.registro) !== marca(r)) mudancas.push({ type: 'modified', doc: documentos[i], oldIndex: antes.indice, newIndex: i });
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
    // Lê e cria o identificador do aparelho na mesma transação, para que a
    // página e o service worker, abrindo o banco ao mesmo tempo, fiquem com o mesmo.
    const transacao = idb.transaction('meta', 'readwrite');
    const fim = concluida(transacao);
    fim.catch(() => {});
    let meta = await aguardar(transacao.objectStore('meta').get('dispositivo'));
    if (!meta) {
      meta = { chave: 'dispositivo', valor: novoId(8) };
      transacao.objectStore('meta').put(meta);
    }
    await fim;
    // Pede ao navegador que não apague os dados para liberar espaço.
    try {
      if (navigator.storage && navigator.storage.persist) await navigator.storage.persist();
    } catch (e) { /* o navegador pode recusar sem prejuízo para o funcionamento */ }
    return new Banco(nome, idb, meta.valor);
  }

  global.BancoLocal = Object.freeze({ abrir });
})(typeof window !== 'undefined' ? window : globalThis);
