// Sincronização do banco local com o servidor da Prancheta, em servidor/.
// Sempre que há rede, envia as mudanças ainda não confirmadas, recebe as dos
// outros aparelhos e combina item a item, por compat/combinar.js, o que os
// dois lados mudaram no mesmo documento. Tudo acontece em segundo plano: a
// Prancheta continua lendo e gravando no banco local, com ou sem rede, e as
// assinaturas do banco avisam a página do que chegou.
//
// O endereço do servidor e a chave de acesso são informados uma vez em cada
// aparelho, pelo botão de sincronização ao lado do indicador "Salvo", e
// ficam no banco local, em meta, nunca no código.
//
// Ciclo, um de cada vez, mesmo com várias abas abertas:
// 1. recebe o que mudou no servidor depois da última posição recebida: a
//    versão do servidor substitui a local, ou é combinada com ela, se houver
//    mudanças locais pendentes; os arquivos novos são baixados;
// 2. envia os arquivos e depois os documentos pendentes, cada documento com
//    a base, a posição da versão do servidor que este aparelho conhece; no
//    conflito, combina com a versão atual do servidor e envia de novo;
// 3. o que o servidor confirma sai do registro de mudanças.
//
// Ciclos: logo ao abrir, alguns segundos depois de cada gravação, a cada
// meio minuto, quando a página volta a ficar visível e quando a rede volta.
// Sem rede, as tentativas se espaçam até um minuto.
//
// Deve ser carregado depois de compat/banco-local.js e compat/combinar.js.

(function (global) {
  'use strict';

  const CONFIGURACAO = 'sinc:servidor';
  const POSICAO = 'sinc:posicao';
  const LIMITE_DA_LISTA = 200;
  const LIMITE_DO_LOTE = 4 * 1024 * 1024;
  const MUDANCAS_POR_LOTE = 100;
  const MAXIMO_DE_RODADAS = 5;
  const PRAZO_DO_PEDIDO = 30000;

  function erro(codigo, mensagem, extra = {}) {
    const e = new Error(mensagem);
    e.code = codigo;
    Object.assign(e, extra);
    return e;
  }

  function validarConfiguracao({ endereco, chave } = {}) {
    let url;
    try {
      url = new URL(String(endereco || '').trim());
    } catch (e) {
      throw erro('invalid_argument', 'endereço do servidor inválido');
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw erro('invalid_argument', 'o endereço precisa começar com https://');
    if (typeof chave !== 'string' || chave.trim().length < 32) throw erro('invalid_argument', 'a chave de acesso tem pelo menos 32 caracteres');
    return { endereco: url.href.replace(/\/+$/, ''), chave: chave.trim() };
  }

  class Sincronizacao {
    constructor(banco, opcoes = {}) {
      this.banco = banco;
      this._fetch = opcoes.fetch || global.fetch.bind(global);
      this.intervalo = opcoes.intervalo ?? 30000;
      this.esperaDepoisDeGravar = opcoes.esperaDepoisDeGravar ?? 3000;
      // Depois de uma falha, a espera dobra a cada nova falha, até o máximo.
      this.esperaAposFalha = opcoes.esperaAposFalha ?? 5000;
      this.esperaMaxima = opcoes.esperaMaxima ?? 60000;
      this.estado = { situacao: 'desligada', mensagem: '', ultimaEm: null };
      this._ouvintes = new Set();
      this._temporizador = null;
      this._rodando = null;
      this._falhas = 0;
      this._iniciada = false;
    }

    // ---- Configuração ----

    async configuracao() {
      // Em meta, o campo chave identifica o registro; a chave de acesso fica em chaveDeAcesso.
      const r = await this.banco._lerMeta(CONFIGURACAO);
      return r && r.endereco ? { endereco: r.endereco, chave: r.chaveDeAcesso } : null;
    }

    /** Guarda o endereço e a chave neste aparelho e sincroniza logo. */
    async configurar(dados) {
      const nova = validarConfiguracao(dados);
      const atual = await this.configuracao();
      if (atual && atual.endereco !== nova.endereco) await this.banco._prepararParaOutroServidor();
      await this.banco._gravarMeta({ chave: CONFIGURACAO, endereco: nova.endereco, chaveDeAcesso: nova.chave });
      this._falhas = 0;
      return this.sincronizar();
    }

    /** Esquece o servidor neste aparelho; os quadros continuam no banco local. */
    async desligar() {
      await this.banco._gravarMeta({ chave: CONFIGURACAO, endereco: null, chaveDeAcesso: null });
      await this.banco._prepararParaOutroServidor();
      clearTimeout(this._temporizador);
      this._mudarEstado({ situacao: 'desligada', mensagem: '' });
    }

    // ---- Estado ----

    aoMudarEstado(ouvinte) {
      this._ouvintes.add(ouvinte);
      ouvinte(this.estado);
      return () => this._ouvintes.delete(ouvinte);
    }

    _mudarEstado(mudanca) {
      this.estado = { ...this.estado, ...mudanca };
      for (const ouvinte of this._ouvintes) {
        try {
          ouvinte(this.estado);
        } catch (e) { /* um ouvinte com erro não interrompe a sincronização */ }
      }
    }

    // ---- Agenda ----

    /** Começa a sincronizar sozinha: ao abrir, depois das gravações, periodicamente e quando a rede volta. */
    iniciar() {
      if (this._iniciada) return this;
      this._iniciada = true;
      this.banco.aoGravar = () => this.agendar(this.esperaDepoisDeGravar);
      if (typeof addEventListener === 'function') {
        addEventListener('online', () => this.agendar(0));
        if (typeof document !== 'undefined') {
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') this.agendar(0);
          });
        }
      }
      this.agendar(0);
      return this;
    }

    /** Marca o próximo ciclo para daqui a `espera` ms, se não houver um marcado para antes. */
    agendar(espera) {
      const quando = Date.now() + espera;
      if (this._temporizador && this._quando <= quando) return;
      clearTimeout(this._temporizador);
      this._quando = quando;
      this._temporizador = setTimeout(() => {
        this._temporizador = null;
        this.sincronizar().catch(() => {});
      }, espera);
    }

    // ---- Ciclo ----

    /**
     * Faz um ciclo completo, se houver servidor configurado, e marca o
     * próximo. Um ciclo pedido durante outro espera ele terminar e roda em seguida.
     */
    sincronizar() {
      if (this._rodando) {
        this._denovo = true;
        return this._rodando;
      }
      const ciclo = async () => {
        try {
          do {
            this._denovo = false;
            await this._comTrava(() => this._ciclo());
          } while (this._denovo);
        } finally {
          this._rodando = null;
        }
      };
      this._rodando = ciclo();
      return this._rodando;
    }

    // Com várias abas abertas, só uma sincroniza por vez.
    _comTrava(tarefa) {
      const travas = global.navigator && global.navigator.locks;
      if (!travas) return tarefa();
      return travas.request(`prancheta-sincronizacao:${this.banco.nome}`, tarefa);
    }

    async _ciclo() {
      const configuracao = await this.configuracao();
      if (!configuracao || !configuracao.endereco) {
        this._mudarEstado({ situacao: 'desligada', mensagem: '' });
        return;
      }
      this._mudarEstado({ situacao: 'sincronizando', mensagem: '' });
      try {
        await this._receber(configuracao);
        await this._enviar(configuracao);
        this._falhas = 0;
        this._mudarEstado({ situacao: 'sincronizada', mensagem: '', ultimaEm: Date.now() });
        if (this._iniciada) this.agendar(this.intervalo);
      } catch (e) {
        this._falhas += 1;
        if (e.code === 'nao_autorizado') {
          this._mudarEstado({ situacao: 'erro', mensagem: 'O servidor recusou a chave de acesso.' });
        } else if (e.code === 'sem_rede') {
          this._mudarEstado({ situacao: 'sem_rede', mensagem: 'Sem conexão com o servidor.' });
        } else {
          this._mudarEstado({ situacao: 'erro', mensagem: e.message || String(e) });
        }
        if (this._iniciada) this.agendar(Math.min(this.esperaMaxima, this.esperaAposFalha * 2 ** (this._falhas - 1)));
        throw e;
      }
    }

    async _pedir(configuracao, metodo, rota, { json, corpo, cabecalhos = {}, comoBlob = false } = {}) {
      const controle = typeof AbortController === 'function' ? new AbortController() : null;
      const limite = controle ? setTimeout(() => controle.abort(), PRAZO_DO_PEDIDO) : null;
      let resposta;
      try {
        resposta = await this._fetch(`${configuracao.endereco}${rota}`, {
          method: metodo,
          headers: {
            Authorization: `Bearer ${configuracao.chave}`,
            ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
            ...cabecalhos,
          },
          body: json !== undefined ? JSON.stringify(json) : corpo,
          cache: 'no-store',
          signal: controle ? controle.signal : undefined,
        });
      } catch (e) {
        throw erro('sem_rede', 'sem conexão com o servidor');
      } finally {
        if (limite) clearTimeout(limite);
      }
      if (resposta.status === 401) throw erro('nao_autorizado', 'chave recusada');
      if (comoBlob && resposta.ok) return { status: resposta.status, blob: await resposta.blob() };
      let dados = null;
      try {
        dados = await resposta.json();
      } catch (e) { /* uma resposta sem JSON fica com dados nulos */ }
      if (!resposta.ok) throw erro('servidor', `o servidor respondeu ${resposta.status}${dados && dados.erro ? ` (${dados.erro})` : ''}`, { status: resposta.status });
      return { status: resposta.status, dados };
    }

    async _receber(configuracao) {
      const meta = await this.banco._lerMeta(POSICAO);
      let desde = meta ? meta.valor : 0;
      for (;;) {
        const { dados } = await this._pedir(configuracao, 'GET', `/sync/mudancas?desde=${desde}&limite=${LIMITE_DA_LISTA}`);
        // Os arquivos primeiro, para que um quadro que chegue já encontre as imagens.
        for (const arquivo of dados.arquivos) {
          if (await this.banco._lerRegistroDeArquivo(arquivo.id)) continue;
          const resposta = await this._pedir(configuracao, 'GET', `/sync/arquivos/${encodeURIComponent(arquivo.id)}`, { comoBlob: true });
          await this.banco._guardarArquivoDoServidor(arquivo, resposta.blob);
        }
        for (const documento of dados.documentos) await this.banco._aplicarDoServidor(documento.registro, documento.pos);
        desde = dados.posicao;
        await this.banco._gravarMeta({ chave: POSICAO, valor: desde });
        if (!dados.mais) return;
      }
    }

    async _enviar(configuracao) {
      for (let rodada = 0; rodada < MAXIMO_DE_RODADAS; rodada++) {
        const { documentos, arquivos } = await this.banco._pendentes();
        for (const [id, seq] of arquivos) await this._enviarArquivo(configuracao, id, seq);
        if (documentos.size === 0) return;
        let conflitos = 0;
        for (const lote of await this._lotes(documentos)) {
          const { dados } = await this._pedir(configuracao, 'POST', '/sync/mudancas', {
            json: { dispositivo: this.banco.dispositivo, mudancas: lote.map(({ seq, base, registro }) => ({ seq, base, registro })) },
          });
          const porSeq = new Map(lote.map((m) => [m.seq, m]));
          for (const r of dados.resultados) {
            const enviada = porSeq.get(r.seq);
            if (!enviada) continue;
            if (r.estado === 'aplicada' || r.estado === 'repetida') {
              await this.banco._confirmarEnvio(enviada.registro.caminho, enviada.seq, r.pos, enviada.registro);
            } else if (r.estado === 'conflito') {
              conflitos += 1;
              if (r.atual && r.atual.registro) await this.banco._aplicarDoServidor(r.atual.registro, r.atual.pos);
              else await this.banco._esquecerBase(enviada.registro.caminho);
            }
          }
        }
        if (conflitos === 0) return;
      }
    }

    // Separa os documentos pendentes em lotes que o servidor aceita de uma vez.
    async _lotes(documentos) {
      const lotes = [];
      let lote = [];
      let tamanho = 0;
      for (const [caminho, seq] of documentos) {
        const { registro, base } = await this.banco._paraEnviar(caminho);
        if (!registro) continue;
        const mudanca = {
          seq,
          base: base ? base.pos : null,
          registro: {
            caminho: registro.caminho, colecao: registro.colecao, id: registro.id,
            dados: registro.apagado ? null : registro.dados, apagado: registro.apagado,
            versao: registro.versao, atualizadoEm: registro.atualizadoEm, dispositivo: registro.dispositivo,
          },
        };
        const peso = JSON.stringify(mudanca).length;
        if (lote.length && (tamanho + peso > LIMITE_DO_LOTE || lote.length >= MUDANCAS_POR_LOTE)) {
          lotes.push(lote);
          lote = [];
          tamanho = 0;
        }
        lote.push(mudanca);
        tamanho += peso;
      }
      if (lote.length) lotes.push(lote);
      return lotes;
    }

    async _enviarArquivo(configuracao, id, seq) {
      const registro = await this.banco._lerRegistroDeArquivo(id);
      if (registro) {
        try {
          await this._pedir(configuracao, 'PUT', `/sync/arquivos/${encodeURIComponent(id)}`, {
            corpo: registro.blob,
            cabecalhos: {
              'Content-Type': registro.tipo || 'application/octet-stream',
              'X-Prancheta-Dispositivo': this.banco.dispositivo,
              'X-Prancheta-Criado-Em': String(registro.criadoEm || Date.now()),
            },
          });
        } catch (e) {
          // Outro conteúdo com o mesmo id já está no servidor; como os ids são aleatórios, não há o que reenviar.
          if (e.status !== 409) throw e;
        }
      }
      await this.banco._confirmarArquivo(id, seq);
    }
  }

  // ---- Interface: botão ao lado do indicador "Salvo" e diálogo de configuração ----

  const ROTULOS = {
    desligada: 'Sincronizar',
    sincronizando: 'Sincronizando…',
    sincronizada: 'Sincronizado',
    sem_rede: 'Sem rede',
    erro: 'Erro ao sincronizar',
  };

  const ESTILO = `
#sinc{font:inherit;font-size:12.5px;color:var(--muted,#6b6b6b);background:none;border:0;padding:4px 6px;cursor:pointer;white-space:nowrap}
#sinc[data-situacao="erro"]{text-decoration:underline}
#sincDialogo{position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.25)}
#sincDialogo[hidden]{display:none}
#sincDialogo form{background:var(--bg,#fff);color:var(--ink,#222);border:1px solid currentColor;border-radius:10px;padding:18px;width:min(420px,calc(100vw - 32px));display:grid;gap:10px;font-size:14px}
#sincDialogo label{display:grid;gap:4px}
#sincDialogo input{font:inherit;padding:8px;border:1px solid currentColor;border-radius:6px;background:transparent;color:inherit}
#sincDialogo .acoes{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}
#sincDialogo button{font:inherit;padding:8px 12px;border:1px solid currentColor;border-radius:6px;background:transparent;color:inherit;cursor:pointer}
#sincDialogo p{margin:0}
`;

  function montarInterface(sincronizacao) {
    const topo = document.getElementById('top');
    if (!topo || document.getElementById('sinc')) return;
    const estilo = document.createElement('style');
    estilo.textContent = ESTILO;
    document.head.appendChild(estilo);

    const botao = document.createElement('button');
    botao.id = 'sinc';
    botao.type = 'button';
    botao.title = 'Sincronização com o servidor';
    topo.insertBefore(botao, topo.firstChild);

    const dialogo = document.createElement('div');
    dialogo.id = 'sincDialogo';
    dialogo.hidden = true;
    dialogo.innerHTML = `
<form role="dialog" aria-label="Sincronização" novalidate>
  <b>Sincronização</b>
  <p>Os quadros deste aparelho são enviados ao servidor e recebidos dos outros aparelhos sempre que houver rede.</p>
  <label>Endereço do servidor<input name="endereco" type="url" autocomplete="off" spellcheck="false" placeholder="https://"></label>
  <label>Chave de acesso<input name="chave" type="password" autocomplete="off" spellcheck="false"></label>
  <p data-estado role="status"></p>
  <div class="acoes">
    <button type="button" data-acao="desligar">Desligar</button>
    <button type="button" data-acao="agora">Sincronizar agora</button>
    <button type="submit">Salvar</button>
    <button type="button" data-acao="fechar">Fechar</button>
  </div>
</form>`;
    document.body.appendChild(dialogo);
    const formulario = dialogo.querySelector('form');
    const campoEndereco = formulario.elements.endereco;
    const campoChave = formulario.elements.chave;
    const linhaDeEstado = dialogo.querySelector('[data-estado]');
    let configurada = false;

    function descrever(estado) {
      if (estado.situacao === 'desligada') return 'Sincronização desligada neste aparelho.';
      const quando = estado.ultimaEm ? ` Última sincronização às ${new Date(estado.ultimaEm).toLocaleTimeString()}.` : '';
      return `${ROTULOS[estado.situacao]}.${estado.mensagem ? ` ${estado.mensagem}` : ''}${quando}`;
    }

    // Os ciclos de rotina não trocam "Sincronizado" por "Sincronizando…": no
    // e-ink, cada troca de texto atualiza a região, e na casca muda as áreas reservadas.
    sincronizacao.aoMudarEstado((estado) => {
      linhaDeEstado.textContent = descrever(estado);
      if (estado.situacao === 'sincronizando' && botao.dataset.situacao === 'sincronizada') return;
      botao.textContent = ROTULOS[estado.situacao] || ROTULOS.desligada;
      botao.dataset.situacao = estado.situacao;
    });

    async function abrir() {
      const configuracao = await sincronizacao.configuracao();
      configurada = Boolean(configuracao && configuracao.endereco);
      campoEndereco.value = configurada ? configuracao.endereco : '';
      campoChave.value = '';
      campoChave.placeholder = configurada ? 'guardada neste aparelho' : 'pelo menos 32 caracteres';
      dialogo.hidden = false;
      (configurada ? campoChave : campoEndereco).focus();
    }

    function fechar() {
      dialogo.hidden = true;
    }

    botao.addEventListener('click', abrir);
    dialogo.addEventListener('click', (e) => {
      if (e.target === dialogo) fechar();
    });
    formulario.addEventListener('click', async (e) => {
      const acao = e.target && e.target.dataset ? e.target.dataset.acao : null;
      if (acao === 'fechar') fechar();
      if (acao === 'agora') sincronizacao.sincronizar().catch(() => {});
      if (acao === 'desligar') {
        await sincronizacao.desligar();
        fechar();
      }
    });
    formulario.addEventListener('submit', async (e) => {
      e.preventDefault();
      let chave = campoChave.value;
      if (!chave && configurada) chave = (await sincronizacao.configuracao()).chave;
      try {
        const pronto = sincronizacao.configurar({ endereco: campoEndereco.value, chave });
        fechar();
        await pronto;
      } catch (erroDeConfiguracao) {
        if (erroDeConfiguracao.code === 'invalid_argument') {
          dialogo.hidden = false;
          linhaDeEstado.textContent = `Não foi possível salvar: ${erroDeConfiguracao.message}.`;
        }
      }
    });
  }

  /** Cria a sincronização do banco, começa a sincronizar e mostra o botão na página. */
  function ligar(banco, opcoes) {
    const sincronizacao = new Sincronizacao(banco, opcoes).iniciar();
    if (typeof document !== 'undefined') {
      const montar = () => montarInterface(sincronizacao);
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar, { once: true });
      else montar();
    }
    return sincronizacao;
  }

  global.SincronizacaoPrancheta = Object.freeze({ Sincronizacao, ligar, validarConfiguracao });
})(typeof window !== 'undefined' ? window : globalThis);
