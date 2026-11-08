// Cliente de compatibilidade da Prancheta independente. Responde por
// window.claude.use(nome), a mesma porta que o código do artefato usa no
// claude.ai, com recursos que funcionam sem rede:
//
// - db: o banco local em IndexedDB, de compat/banco-local.js, sincronizado
//   com o servidor da Prancheta por compat/sincronizacao.js quando o aparelho
//   tem um servidor configurado;
// - assets: guarda os arquivos enviados nesse banco; o service worker, em
//   sw.js, entrega cada um de volta em /_blob/<id>, como o artefato espera;
// - downloads: baixa o arquivo pelo próprio navegador;
// - user: um único usuário, que pode editar;
// - permissions: responde sem conceder nada, porque não há conectores.
//
// A conversa com o Claude (sample), os conectores (mcp), os comentários e a
// autopublicação (artifact) não têm equivalente: claude.use recusa esses
// nomes, e o artefato desliga e esconde o que depende deles.
//
// Deve ser carregado depois de compat/banco-local.js, compat/combinar.js e
// compat/sincronizacao.js, e antes do código do artefato.

(function () {
  'use strict';

  const NOME_DO_BANCO = 'prancheta';
  // Tempo máximo de espera para que o service worker passe a controlar a página.
  const ESPERA_DO_SERVICE_WORKER = 4000;

  function erro(codigo, mensagem) {
    const e = new Error(mensagem);
    e.code = codigo;
    return e;
  }

  // O service worker guarda a página para abrir sem rede e entrega os arquivos
  // enviados. Só existe em contexto seguro: https, localhost ou a casca.
  const registro = 'serviceWorker' in navigator
    ? navigator.serviceWorker.register('sw.js').catch(() => null)
    : Promise.resolve(null);

  // Os arquivos enviados só podem ser exibidos se o service worker controla a
  // página. Na primeira visita, ele assume o controle logo depois de instalado.
  async function serviceWorkerNoControle() {
    if (!('serviceWorker' in navigator)) return false;
    if (navigator.serviceWorker.controller) return true;
    if (!(await registro)) return false;
    return new Promise((pronto) => {
      const fim = (valor) => {
        clearTimeout(limite);
        navigator.serviceWorker.removeEventListener('controllerchange', assumiu);
        pronto(valor);
      };
      const assumiu = () => fim(true);
      const limite = setTimeout(() => fim(Boolean(navigator.serviceWorker.controller)), ESPERA_DO_SERVICE_WORKER);
      navigator.serviceWorker.addEventListener('controllerchange', assumiu);
    });
  }

  let banco = null;
  function abrirBanco() {
    if (!banco) {
      banco = BancoLocal.abrir({ nome: NOME_DO_BANCO });
      banco.then((b) => {
        // A sincronização fica disponível em window.sincronizacaoDaPrancheta, para
        // diagnóstico; os testes encurtam os intervalos por window.opcoesDaSincronizacao.
        if (window.SincronizacaoPrancheta && !window.sincronizacaoDaPrancheta) {
          window.sincronizacaoDaPrancheta = window.SincronizacaoPrancheta.ligar(b, window.opcoesDaSincronizacao);
        }
      }, () => { banco = null; });
    }
    return banco;
  }

  function baixar(nome, dados) {
    const blob = dados instanceof Blob ? dados : new Blob([dados]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = String(nome || 'arquivo');
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  const recursos = {
    db: () => abrirBanco(),
    async assets() {
      // Sem o service worker, recusar o recurso faz o artefato embutir as
      // imagens no próprio quadro, em vez de guardar arquivos que não poderia exibir.
      if (!(await serviceWorkerNoControle())) throw erro('unavailable', 'os arquivos enviados precisam do service worker');
      const b = await abrirBanco();
      return Object.freeze({
        upload: (blob, opcoes = {}) => b.guardarArquivo(blob, opcoes),
      });
    },
    async downloads() {
      return Object.freeze({
        save: async ({ filename, data } = {}) => {
          if (data == null) throw erro('invalid_argument', 'nada para baixar');
          baixar(filename, data);
        },
      });
    },
    async user() {
      return Object.freeze({
        id: async () => 'autor',
        canEdit: async () => true,
      });
    },
    async permissions() {
      return Object.freeze({
        request: async () => ({ granted: [] }),
        manage: async () => undefined,
      });
    },
  };

  window.claude = Object.freeze({
    use(nome) {
      const recurso = Object.prototype.hasOwnProperty.call(recursos, nome) ? recursos[nome] : null;
      if (!recurso) return Promise.reject(erro('unavailable', `recurso sem equivalente fora do claude.ai: ${nome}`));
      return recurso();
    },
  });
})();
