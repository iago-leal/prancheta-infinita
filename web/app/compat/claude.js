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

  // Fora da casca, uma versão nova da página, baixada em segundo plano, só
  // entra quando o autor toca no aviso; então a página recarrega com ela. Na
  // casca, a página vem do APK, e o service worker a troca sozinho.
  const NA_CASCA = location.hostname === 'appassets.androidplatform.net';
  let pediuAtualizacao = false;

  function avisarVersaoNova(reg) {
    const montar = () => {
      const topo = document.getElementById('top');
      if (!topo || document.getElementById('versaoNova')) return;
      const botao = document.createElement('button');
      botao.id = 'versaoNova';
      botao.type = 'button';
      botao.textContent = 'Nova versão: atualizar';
      botao.title = 'Uma versão nova da Prancheta foi baixada; atualizar recarrega a página com ela.';
      botao.style.cssText = 'font:inherit;font-size:12.5px;color:inherit;background:none;border:1px solid currentColor;border-radius:6px;padding:3px 8px;cursor:pointer;white-space:nowrap';
      botao.addEventListener('click', () => {
        const nova = reg.waiting;
        if (!nova) return;
        pediuAtualizacao = true;
        botao.disabled = true;
        botao.textContent = 'Atualizando…';
        nova.postMessage({ tipo: 'ativar' });
      });
      topo.insertBefore(botao, topo.firstChild);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar, { once: true });
    else montar();
  }

  if ('serviceWorker' in navigator && !NA_CASCA) {
    registro.then((reg) => {
      if (!reg) return;
      if (reg.waiting && navigator.serviceWorker.controller) avisarVersaoNova(reg);
      reg.addEventListener('updatefound', () => {
        const nova = reg.installing;
        if (!nova) return;
        nova.addEventListener('statechange', () => {
          if (nova.state === 'installed' && navigator.serviceWorker.controller) avisarVersaoNova(reg);
        });
      });
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (pediuAtualizacao) location.reload();
    });
  }

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
        // A biblioteca de livros usa o endereço e a chave da sincronização.
        if (window.BibliotecaPrancheta && window.sincronizacaoDaPrancheta && !window.bibliotecaDaPrancheta) {
          window.bibliotecaDaPrancheta = window.BibliotecaPrancheta.ligar(window.sincronizacaoDaPrancheta);
        }
        // O leitor abre os livros guardados pela biblioteca.
        if (window.LeitorPrancheta && window.bibliotecaDaPrancheta && !window.leitorDaPrancheta) {
          window.leitorDaPrancheta = window.LeitorPrancheta.ligar(window.bibliotecaDaPrancheta);
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
