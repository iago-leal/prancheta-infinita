// Biblioteca de livros, etapa 03 do plano 005: a seção "Biblioteca" do painel
// lateral lista os PDFs e EPUBs que o servidor da Prancheta entrega, da
// subpasta de livros do WebDAV, e guarda no aparelho cada livro aberto, para
// que ele continue disponível sem rede.
//
// - A lista vem de GET /sync/biblioteca, com o endereço e a chave da
//   sincronização; a última recebida fica guardada para o uso sem rede.
// - Os livros ficam num banco próprio, prancheta-biblioteca, separado do banco
//   dos quadros: não entram no registro de mudanças, não sobem ao servidor e
//   não passam pela cifra. Na VPS, eles já estão no WebDAV; no caminho, vão
//   cifrados pelo Tailscale.
// - Tocar num livro ainda não guardado o baixa, com o progresso em texto, sem
//   animação, e o guarda; com o leitor de compat/leitor.js, da etapa 04, o
//   livro abre em seguida. A última posição lida de cada livro também fica
//   neste banco, só neste aparelho.
//
// Deve ser carregado depois de compat/sincronizacao.js; compat/claude.js liga
// a biblioteca à sincronização em window.bibliotecaDaPrancheta.

(function (global) {
  'use strict';

  const NOME_DO_BANCO = 'prancheta-biblioteca';
  const LISTA = 'lista';
  const PRAZO_DA_LISTA = 30000;
  // Sem atividade da rede por este tempo, o download é interrompido.
  const PRAZO_SEM_DADOS = 60000;
  const ATUALIZAR_A_CADA = 5 * 60 * 1000;

  function erro(codigo, mensagem) {
    const e = new Error(mensagem);
    e.code = codigo;
    return e;
  }

  // ---- Banco próprio dos livros ----

  function abrirBanco(nome) {
    return new Promise((pronto, falha) => {
      const pedido = indexedDB.open(nome, 1);
      pedido.onupgradeneeded = () => {
        const idb = pedido.result;
        if (!idb.objectStoreNames.contains('livros')) idb.createObjectStore('livros', { keyPath: 'id' });
        if (!idb.objectStoreNames.contains('meta')) idb.createObjectStore('meta', { keyPath: 'chave' });
      };
      pedido.onsuccess = () => pronto(pedido.result);
      pedido.onerror = () => falha(pedido.error);
    });
  }

  function operar(idb, deposito, modo, fazer) {
    return new Promise((pronto, falha) => {
      const transacao = idb.transaction(deposito, modo);
      const pedido = fazer(transacao.objectStore(deposito));
      transacao.oncomplete = () => pronto(pedido ? pedido.result : undefined);
      transacao.onerror = () => falha(transacao.error);
      transacao.onabort = () => falha(transacao.error || erro('abortada', 'gravação interrompida'));
    });
  }

  function megabytes(bytes) {
    const mb = bytes / (1024 * 1024);
    return mb >= 10 ? `${Math.round(mb)} MB` : `${mb.toFixed(1).replace('.', ',')} MB`;
  }

  class Biblioteca {
    constructor(sincronizacao, opcoes = {}) {
      this.sincronizacao = sincronizacao;
      this._fetch = opcoes.fetch || global.fetch.bind(global);
      this._banco = abrirBanco(opcoes.nomeDoBanco || NOME_DO_BANCO);
      this._ouvintes = new Set();
      this.baixando = new Map();
      this.estado = { situacao: 'inicio', mensagem: '', lista: [], guardados: new Set(), recebidaEm: null };
    }

    aoMudar(ouvinte) {
      this._ouvintes.add(ouvinte);
      ouvinte(this.estado);
      return () => this._ouvintes.delete(ouvinte);
    }

    _mudar(mudanca) {
      this.estado = { ...this.estado, ...mudanca };
      for (const ouvinte of this._ouvintes) {
        try {
          ouvinte(this.estado);
        } catch (e) { /* um ouvinte com erro não interrompe a biblioteca */ }
      }
    }

    /** Os identificadores dos livros guardados neste aparelho. */
    async guardados() {
      const idb = await this._banco;
      return new Set(await operar(idb, 'livros', 'readonly', (d) => d.getAllKeys()));
    }

    /** Um livro guardado, com o conteúdo em blob, ou undefined. */
    async livro(id) {
      const idb = await this._banco;
      return operar(idb, 'livros', 'readonly', (d) => d.get(String(id)));
    }

    /** A última posição lida de um livro neste aparelho, ou undefined. */
    async lerPosicao(id) {
      const idb = await this._banco;
      const r = await operar(idb, 'meta', 'readonly', (d) => d.get(`posicao:${id}`));
      return r ? r.posicao : undefined;
    }

    /**
     * A última posição de um livro neste aparelho, com o horário da última
     * leitura nele, que é quando o leitor virou a página pela última vez, ou undefined.
     */
    async lerPosicaoComHora(id) {
      const idb = await this._banco;
      const r = await operar(idb, 'meta', 'readonly', (d) => d.get(`posicao:${id}`));
      return r ? { posicao: r.posicao, em: Number.isFinite(r.lidoEm) ? r.lidoEm : (r.em || 0) } : undefined;
    }

    /**
     * O último progresso de leitura do livro gravado pelo KOReader, pedido ao
     * servidor com a chave deste aparelho; null sem rede, sem servidor ou sem progresso.
     */
    async progressoRemoto(id) {
      try {
        const resposta = await this._pedir(`/sync/progresso/${id}`);
        const progresso = resposta && resposta.progresso;
        return progresso && typeof progresso === 'object' ? progresso : null;
      } catch (e) {
        return null;
      }
    }

    /**
     * As posições de um EPUB, que dividem o livro inteiro em trechos de mesmo
     * tamanho, calculadas pelo leitor na primeira abertura e guardadas para as
     * seguintes; undefined se ainda não foram calculadas neste aparelho.
     */
    async lerLocais(id) {
      const idb = await this._banco;
      const r = await operar(idb, 'meta', 'readonly', (d) => d.get(`locais:${id}`));
      return r && typeof r.locais === 'string' ? r.locais : undefined;
    }

    async gravarLocais(id, locais) {
      const idb = await this._banco;
      await operar(idb, 'meta', 'readwrite', (d) => d.put({ chave: `locais:${id}`, locais: String(locais), em: Date.now() }));
    }

    /** O identificador deste aparelho, o mesmo da sincronização dos quadros. */
    get dispositivo() {
      return this.sincronizacao.banco.dispositivo;
    }

    /**
     * Grava no servidor a posição a que o leitor deste aparelho chegou, com a
     * porcentagem, para o outro aparelho continuar de lá, e, num EPUB, com o
     * caminho no formato do KOReader, para ele também. Devolve se gravou; sem
     * rede ou sem servidor, não gravou, e nada falha.
     */
    async gravarProgressoRemoto(id, { posicao, porcentagem, caminho }) {
      const naCasca = typeof document !== 'undefined' && document.documentElement.classList.contains('casca');
      try {
        await this._pedir(`/sync/progresso/${id}`, {
          metodo: 'PUT',
          corpo: {
            posicao, porcentagem, aparelho: naCasca ? 'Boox' : 'computador', dispositivo: this.dispositivo,
            ...(typeof caminho === 'string' && caminho ? { caminho } : {}),
          },
        });
        return true;
      } catch (e) {
        return false;
      }
    }

    /**
     * Guarda a posição de um livro neste aparelho. `lidoEm` é o horário da
     * última leitura, que não muda quando o livro só é aberto e fechado; sem
     * ele, vale o horário desta gravação.
     */
    async gravarPosicao(id, posicao, lidoEm) {
      const idb = await this._banco;
      const agora = Date.now();
      await operar(idb, 'meta', 'readwrite', (d) => d.put({ chave: `posicao:${id}`, posicao, em: agora, lidoEm: Number.isFinite(lidoEm) ? lidoEm : agora }));
    }

    // A lista guardada da última vez, para mostrar logo e sem rede.
    async _listaGuardada() {
      const idb = await this._banco;
      return operar(idb, 'meta', 'readonly', (d) => d.get(LISTA));
    }

    async _pedir(rota, { comoFluxo = false, metodo = 'GET', corpo } = {}) {
      const configuracao = await this.sincronizacao.configuracao();
      if (!configuracao || !configuracao.endereco) throw erro('sem_servidor', 'sincronização não configurada');
      const controle = new AbortController();
      let limite = setTimeout(() => controle.abort(), comoFluxo ? PRAZO_SEM_DADOS : PRAZO_DA_LISTA);
      let resposta;
      try {
        resposta = await this._fetch(`${configuracao.endereco}${rota}`, {
          method: metodo,
          headers: { Authorization: `Bearer ${configuracao.chave}`, ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }) },
          ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
          cache: 'no-store',
          signal: controle.signal,
        });
      } catch (e) {
        clearTimeout(limite);
        throw erro('sem_rede', 'sem conexão com o servidor');
      }
      if (resposta.status === 401) {
        clearTimeout(limite);
        throw erro('nao_autorizado', 'o servidor recusou a chave de acesso');
      }
      if (!resposta.ok) {
        clearTimeout(limite);
        throw erro('servidor', `o servidor respondeu ${resposta.status}`);
      }
      if (!comoFluxo) {
        try {
          return await resposta.json();
        } finally {
          clearTimeout(limite);
        }
      }
      // O prazo passa a valer entre um pedaço e outro do download.
      const renovar = () => {
        clearTimeout(limite);
        limite = setTimeout(() => controle.abort(), PRAZO_SEM_DADOS);
      };
      return { resposta, renovar, terminar: () => clearTimeout(limite) };
    }

    /** Mostra a lista guardada e pede a atual ao servidor, se houver rede. */
    async atualizar() {
      const [guardada, guardados] = await Promise.all([this._listaGuardada(), this.guardados()]);
      if (guardada && this.estado.situacao === 'inicio') {
        this._mudar({ situacao: 'guardada', lista: guardada.livros, recebidaEm: guardada.em, guardados });
      } else {
        this._mudar({ guardados });
      }
      const configuracao = await this.sincronizacao.configuracao();
      if (!configuracao || !configuracao.endereco) {
        this._mudar({ situacao: 'sem_servidor', mensagem: 'Configure a sincronização para ver a biblioteca.' });
        return this.estado;
      }
      this._mudar({ situacao: 'atualizando', mensagem: '' });
      try {
        const { livros } = await this._pedir('/sync/biblioteca');
        const lista = Array.isArray(livros) ? livros.filter((l) => l && /^[0-9a-f]{32}$/.test(l.id)) : [];
        const em = Date.now();
        const idb = await this._banco;
        await operar(idb, 'meta', 'readwrite', (d) => d.put({ chave: LISTA, livros: lista, em }));
        this._atualizadaEm = em;
        this._mudar({ situacao: 'atualizada', mensagem: '', lista, recebidaEm: em });
      } catch (e) {
        const quando = this.estado.recebidaEm ? ` Lista de ${new Date(this.estado.recebidaEm).toLocaleString()}.` : '';
        const mensagem = e.code === 'sem_rede' ? `Sem rede.${quando}` : `Não foi possível atualizar a lista: ${e.message}.${quando}`;
        this._mudar({ situacao: e.code === 'sem_rede' ? 'sem_rede' : 'erro', mensagem });
      }
      return this.estado;
    }

    /** Baixa um livro da lista e o guarda neste aparelho. */
    async guardar(id) {
      const livro = this.estado.lista.find((l) => l.id === id);
      if (!livro) throw erro('not_found', 'livro fora da lista');
      if (this.estado.guardados.has(id)) return this.livro(id);
      if (this.baixando.has(id)) return this.baixando.get(id).pronto;
      const andamento = { recebidos: 0, total: livro.bytes || 0 };
      const pronto = (async () => {
        const { resposta, renovar, terminar } = await this._pedir(`/sync/biblioteca/${encodeURIComponent(id)}`, { comoFluxo: true });
        try {
          const total = Number(resposta.headers.get('content-length')) || andamento.total;
          andamento.total = total;
          const pedacos = [];
          const leitor = resposta.body.getReader();
          for (;;) {
            let lido;
            try {
              lido = await leitor.read();
            } catch (e) {
              throw erro('sem_rede', 'o download foi interrompido');
            }
            if (lido.done) break;
            renovar();
            pedacos.push(lido.value);
            andamento.recebidos += lido.value.length;
            this._mudar({ baixando: new Map(this.baixando) });
          }
          if (total && andamento.recebidos !== total) throw erro('incompleto', 'o download chegou incompleto');
          const registro = {
            id, nome: livro.nome, pasta: livro.pasta, tipo: livro.tipo, bytes: andamento.recebidos,
            guardadoEm: Date.now(), blob: new Blob(pedacos, { type: livro.tipo }),
          };
          const idb = await this._banco;
          await operar(idb, 'livros', 'readwrite', (d) => d.put(registro));
          const guardados = new Set(this.estado.guardados);
          guardados.add(id);
          this._mudar({ guardados });
          return registro;
        } finally {
          terminar();
        }
      })();
      this.baixando.set(id, { andamento, pronto });
      this._mudar({ baixando: new Map(this.baixando) });
      try {
        return await pronto;
      } finally {
        this.baixando.delete(id);
        this._mudar({ baixando: new Map(this.baixando) });
      }
    }

    // Atualiza a lista de tempos em tempos, quando a rede volta e quando a
    // sincronização é configurada ou volta a funcionar.
    iniciar() {
      if (this._iniciada) return this;
      this._iniciada = true;
      const talvez = () => {
        if (this.estado.situacao === 'atualizando') return;
        if (this._atualizadaEm && Date.now() - this._atualizadaEm < ATUALIZAR_A_CADA && this.estado.situacao === 'atualizada') return;
        this.atualizar().catch(() => {});
      };
      if (this.sincronizacao.aoMudarEstado) {
        this.sincronizacao.aoMudarEstado((estado) => {
          if (estado.situacao === 'sincronizada' || estado.situacao === 'desligada') talvez();
        });
      }
      if (typeof addEventListener === 'function') addEventListener('online', talvez);
      this.atualizar().catch(() => {});
      return this;
    }
  }

  // ---- Seção "Biblioteca" do painel lateral ----

  const ESTILO = `
#biblioteca{flex:none;max-height:45%;overflow-y:auto;padding:0 8px 14px;border-top:1px solid var(--line,#E3E1DD);overscroll-behavior:contain}
#biblioteca .bib-aviso{margin:0;padding:2px 8px 6px;font-size:12.5px;color:var(--muted,#7F7C76)}
#biblioteca .bib-aviso:empty{display:none}
#biblioteca .bib-pasta{padding:8px 8px 2px;font-size:12px;color:var(--muted,#7F7C76);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#biblioteca .bib-estado{flex:none;font-size:12.5px;color:var(--muted,#7F7C76);font-variant-numeric:tabular-nums}
#biblioteca .row{padding-left:4px}
`;

  const ICONE_DO_LIVRO = '<svg class="i" viewBox="0 0 24 24"><path d="M6 4h9a3 3 0 0 1 3 3v13H9a3 3 0 0 1-3-3z"></path><path d="M6 17a3 3 0 0 1 3-3h9"></path></svg>';
  const ICONE_DE_ATUALIZAR = '<svg class="i" viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.7"></path><path d="M20 4v5h-5"></path></svg>';

  function montarInterface(biblioteca) {
    const lateral = document.getElementById('side');
    if (!lateral || document.getElementById('biblioteca')) return;
    const estilo = document.createElement('style');
    estilo.textContent = ESTILO;
    document.head.appendChild(estilo);

    const secao = document.createElement('section');
    secao.id = 'biblioteca';
    secao.setAttribute('aria-label', 'Biblioteca');
    secao.innerHTML = `
<div class="slabel"><span>Biblioteca</span><button type="button" data-acao="atualizar" title="Atualizar a lista" aria-label="Atualizar a lista">${ICONE_DE_ATUALIZAR}</button></div>
<p class="bib-aviso" role="status"></p>
<div class="bib-lista"></div>`;
    lateral.appendChild(secao);
    const aviso = secao.querySelector('.bib-aviso');
    const listaEl = secao.querySelector('.bib-lista');
    let avisoProprio = '';

    function textoDoEstado(livro, estado) {
      const baixando = biblioteca.baixando.get(livro.id);
      if (baixando) {
        const { recebidos, total } = baixando.andamento;
        // De 10 em 10%, para não redesenhar o e-ink a cada pedaço.
        return total ? `${Math.floor((recebidos / total) * 10) * 10}%` : megabytes(recebidos);
      }
      if (estado.guardados.has(livro.id)) return 'guardado';
      return megabytes(livro.bytes || 0);
    }

    function desenhar(estado) {
      aviso.textContent = avisoProprio || estado.mensagem || (estado.situacao === 'atualizada' && !estado.lista.length ? 'Nenhum livro na biblioteca.' : '');
      const linhas = [];
      let pastaAtual = null;
      const ordenada = [...estado.lista].sort((a, b) => (a.pasta || '').localeCompare(b.pasta || '') || a.nome.localeCompare(b.nome));
      for (const livro of ordenada) {
        const pasta = livro.pasta || '';
        if (pasta !== pastaAtual) {
          pastaAtual = pasta;
          if (pasta) {
            const titulo = document.createElement('div');
            titulo.className = 'bib-pasta';
            titulo.textContent = pasta.split('/').join(' / ');
            linhas.push(titulo);
          }
        }
        const linha = document.createElement('div');
        linha.className = 'row bib-livro';
        linha.dataset.id = livro.id;
        linha.tabIndex = 0;
        linha.setAttribute('role', 'button');
        linha.innerHTML = `<span class="ic">${ICONE_DO_LIVRO}</span><span class="nm"></span><span class="bib-estado"></span>`;
        linha.querySelector('.nm').textContent = livro.nome;
        linha.querySelector('.nm').title = livro.nome;
        linha.querySelector('.bib-estado').textContent = textoDoEstado(livro, estado);
        linhas.push(linha);
      }
      listaEl.replaceChildren(...linhas);
    }

    // No e-ink, cada troca de texto atualiza a região: só redesenha o que mudou.
    let ultimo = '';
    biblioteca.aoMudar((estado) => {
      const marca = JSON.stringify([avisoProprio, estado.mensagem, estado.situacao, estado.lista.map((l) => [l.id, textoDoEstado(l, estado)])]);
      if (marca === ultimo) return;
      ultimo = marca;
      desenhar(estado);
    });
    const redesenhar = () => {
      ultimo = '';
      biblioteca._mudar({});
    };

    async function abrir(id) {
      const livro = biblioteca.estado.lista.find((l) => l.id === id);
      if (!livro) return;
      if (!biblioteca.estado.guardados.has(id)) {
        avisoProprio = '';
        try {
          await biblioteca.guardar(id);
          avisoProprio = `"${livro.nome}" foi guardado neste aparelho e fica disponível sem rede.`;
        } catch (e) {
          avisoProprio = e.code === 'sem_rede'
            ? `Sem rede: "${livro.nome}" ainda não está guardado neste aparelho.`
            : `Não foi possível guardar "${livro.nome}": ${e.message}.`;
          redesenhar();
          return;
        }
      } else {
        avisoProprio = `"${livro.nome}" está guardado neste aparelho.`;
      }
      redesenhar();
      const leitor = global.leitorDaPrancheta;
      if (!leitor) return;
      try {
        await leitor.abrir(id);
      } catch (e) {
        avisoProprio = `Não foi possível abrir "${livro.nome}": ${e.message}.`;
        redesenhar();
      }
    }

    secao.addEventListener('click', (e) => {
      if (e.target.closest('[data-acao="atualizar"]')) {
        avisoProprio = '';
        biblioteca.atualizar().catch(() => {});
        return;
      }
      const linha = e.target.closest('.bib-livro');
      if (linha) abrir(linha.dataset.id);
    });
    secao.addEventListener('keydown', (e) => {
      const linha = e.target.closest && e.target.closest('.bib-livro');
      if (linha && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        abrir(linha.dataset.id);
      }
    });
  }

  /** Cria a biblioteca ligada à sincronização, começa a atualizá-la e mostra a seção. */
  function ligar(sincronizacao, opcoes) {
    const biblioteca = new Biblioteca(sincronizacao, opcoes).iniciar();
    if (typeof document !== 'undefined') {
      const montar = () => montarInterface(biblioteca);
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar, { once: true });
      else montar();
    }
    return biblioteca;
  }

  global.BibliotecaPrancheta = Object.freeze({ Biblioteca, ligar, NOME_DO_BANCO });
})(typeof window !== 'undefined' ? window : globalThis);
