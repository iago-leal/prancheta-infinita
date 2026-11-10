// Tela da biblioteca, etapa 01 do plano 008: a lista completa dos livros numa
// tela própria, por cima do quadro, para achar uma obra quando a biblioteca
// crescer.
//
// - Um livro por linha, com o título, o autor escrito nele quando difere do
//   grupo, se está guardado neste aparelho, a porcentagem lida e o formato.
// - A lista vem agrupada por autor, que é a primeira pasta do caminho no
//   servidor, e pode ser ordenada pelo título ou pelos lidos por último. A
//   busca olha o título, o autor, a pasta e o nome do arquivo, sem distinguir
//   maiúsculas nem acentos, e um filtro deixa só os guardados neste aparelho.
//   A organização é feita por BibliotecaPrancheta.organizar().
// - Tocar num livro o abre no leitor e fecha a tela; se ele ainda não está
//   neste aparelho, a linha mostra o andamento do download, e a tela só fecha
//   quando ele termina.
// - A tela fecha pelo botão e pela tecla Esc. Enquanto está aberta, as
//   teclas, o copiar e o colar não chegam ao quadro, que fica como estava:
//   sem isso, um atalho trocaria a ferramenta, e um texto colado viraria um
//   cartão no quadro coberto.
// - A ordem e o filtro escolhidos ficam guardados neste aparelho.
//
// Deve ser carregado depois de compat/biblioteca.js, que monta a tela ao
// ligar a biblioteca e a abre pelo botão do painel lateral.

(function (global) {
  'use strict';

  const PREFERENCIAS = 'prancheta.biblioteca.tela';
  const ORDENS = [['autor', 'Autor'], ['titulo', 'Título'], ['recentes', 'Lidos por último']];
  // O que o quadro ouve na página inteira e não pode valer com a tela aberta.
  const DO_QUADRO = ['keydown', 'keyup', 'copy', 'cut', 'paste'];

  const ESTILO = `
#tela-biblioteca{position:fixed;inset:0;z-index:12;display:flex;flex-direction:column;background:var(--bg,#F5F4F2);color:var(--fg,#37352F);
  padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)}
#tela-biblioteca[hidden]{display:none}
#tela-biblioteca .tb-coluna{width:100%;max-width:760px;margin:0 auto;padding:0 16px}
#tela-biblioteca .tb-topo{flex:none;display:flex;align-items:center;gap:10px;padding-top:12px;padding-bottom:10px}
#tela-biblioteca h2{flex:1;min-width:0;margin:0;font-size:18px;font-weight:600;letter-spacing:0}
#tela-biblioteca .tb-conta{flex:none;font-size:13px;color:var(--muted,#7F7C76);font-variant-numeric:tabular-nums}
#tela-biblioteca button,#tela-biblioteca .tb-busca{font:inherit;font-size:14px;height:38px;border:1px solid var(--line-strong,#D6D3CE);border-radius:9px;background:var(--panel,#fff);color:inherit}
#tela-biblioteca button{flex:none;min-width:38px;padding:0 12px;cursor:pointer}
#tela-biblioteca button.tb-icone{padding:0}
#tela-biblioteca button[aria-pressed="true"]{background:var(--fg,#37352F);border-color:var(--fg,#37352F);color:var(--bg,#F5F4F2)}
#tela-biblioteca svg.i{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;display:block;margin:auto}
#tela-biblioteca .tb-barra{flex:none;display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding-bottom:10px}
#tela-biblioteca .tb-busca{flex:1 1 240px;min-width:0;padding:0 12px;outline-offset:1px}
#tela-biblioteca .tb-ordem{display:flex;gap:4px}
#tela-biblioteca .tb-aviso{flex:none;margin:0 auto;padding-bottom:8px;font-size:13px;color:var(--muted,#7F7C76)}
#tela-biblioteca .tb-aviso:empty{display:none}
#tela-biblioteca .tb-rolagem{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;border-top:1px solid var(--line,#E3E1DD)}
#tela-biblioteca .tb-lista{padding-bottom:32px}
#tela-biblioteca .tb-grupo{display:flex;align-items:baseline;gap:8px;margin:0;padding:20px 4px 6px;font-size:13px;font-weight:600;color:var(--muted,#7F7C76);border-bottom:1px solid var(--line-strong,#D6D3CE)}
#tela-biblioteca .tb-grupo span{font-weight:400;font-variant-numeric:tabular-nums}
#tela-biblioteca .tb-livro{display:flex;align-items:center;gap:12px;min-height:48px;padding:6px 4px;border-bottom:1px solid var(--line,#E3E1DD);cursor:pointer}
#tela-biblioteca .tb-livro:focus-visible{outline:2px solid var(--fg,#37352F);outline-offset:-2px}
#tela-biblioteca .tb-nome{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
#tela-biblioteca .tb-titulo,#tela-biblioteca .tb-autor{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#tela-biblioteca .tb-titulo{font-size:15px}
#tela-biblioteca .tb-autor{font-size:12.5px;color:var(--muted,#7F7C76)}
#tela-biblioteca .tb-autor:empty{display:none}
#tela-biblioteca .tb-estado,#tela-biblioteca .tb-formato{flex:none;font-size:12.5px;color:var(--muted,#7F7C76);font-variant-numeric:tabular-nums;text-align:right}
#tela-biblioteca .tb-formato{width:38px}
#tela-biblioteca .tb-vazio{margin:0;padding:28px 4px;font-size:14px;color:var(--muted,#7F7C76)}
@media (hover:hover){#tela-biblioteca .tb-livro:hover{background:var(--hover,#EFEDEA)}}
`;

  const ICONE_DE_FECHAR = '<svg class="i" viewBox="0 0 24 24"><path d="M6 6l12 12"></path><path d="M18 6 6 18"></path></svg>';
  const ICONE_DE_ATUALIZAR = '<svg class="i" viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.7"></path><path d="M20 4v5h-5"></path></svg>';

  const FORMATOS = { 'application/pdf': 'PDF', 'application/epub+zip': 'EPUB' };

  function lerPreferencias() {
    try {
      const lidas = JSON.parse(global.localStorage.getItem(PREFERENCIAS) || 'null') || {};
      return { ordem: ORDENS.some(([ordem]) => ordem === lidas.ordem) ? lidas.ordem : 'autor', soGuardados: lidas.soGuardados === true };
    } catch (e) {
      return { ordem: 'autor', soGuardados: false };
    }
  }

  function montar(biblioteca) {
    const existente = document.getElementById('tela-biblioteca');
    if (existente) return existente.telaDaBiblioteca;
    const { organizar, tituloDe, situacaoDe } = global.BibliotecaPrancheta;
    const estilo = document.createElement('style');
    estilo.textContent = ESTILO;
    document.head.appendChild(estilo);

    const tela = document.createElement('section');
    tela.id = 'tela-biblioteca';
    tela.hidden = true;
    tela.setAttribute('role', 'dialog');
    tela.setAttribute('aria-modal', 'true');
    tela.setAttribute('aria-label', 'Biblioteca');
    tela.innerHTML = `
<div class="tb-coluna tb-topo">
  <button type="button" class="tb-icone" data-acao="fechar" title="Fechar a biblioteca (Esc)" aria-label="Fechar a biblioteca">${ICONE_DE_FECHAR}</button>
  <h2>Biblioteca</h2>
  <span class="tb-conta"></span>
  <button type="button" class="tb-icone" data-acao="atualizar" title="Atualizar a lista" aria-label="Atualizar a lista">${ICONE_DE_ATUALIZAR}</button>
</div>
<div class="tb-coluna tb-barra">
  <input type="search" class="tb-busca" placeholder="Buscar por título ou autor" aria-label="Buscar na biblioteca" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search">
  <div class="tb-ordem" role="group" aria-label="Ordem da lista">${ORDENS.map(([ordem, rotulo]) => `<button type="button" data-ordem="${ordem}" aria-pressed="false">${rotulo}</button>`).join('')}</div>
  <button type="button" data-acao="so-guardados" aria-pressed="false" title="Mostrar só os livros guardados neste aparelho">Neste aparelho</button>
</div>
<p class="tb-coluna tb-aviso" role="status"></p>
<div class="tb-rolagem"><div class="tb-coluna tb-lista"></div></div>`;
    document.body.appendChild(tela);

    const busca = tela.querySelector('.tb-busca');
    const conta = tela.querySelector('.tb-conta');
    const aviso = tela.querySelector('.tb-aviso');
    const listaEl = tela.querySelector('.tb-lista');
    const rolagem = tela.querySelector('.tb-rolagem');
    const preferencias = lerPreferencias();
    let consulta = '';
    let focoAnterior = null;

    function guardarPreferencias() {
      try {
        global.localStorage.setItem(PREFERENCIAS, JSON.stringify(preferencias));
      } catch (e) { /* sem onde guardar, a escolha vale até a página fechar */ }
    }

    function vazio(estado) {
      if (!estado.lista.length) return estado.situacao === 'atualizada' ? 'Nenhum livro na biblioteca.' : '';
      if (consulta.trim()) return `Nenhum livro com "${consulta.trim()}"${preferencias.soGuardados ? ' entre os guardados neste aparelho' : ''}.`;
      return preferencias.soGuardados ? 'Nenhum livro guardado neste aparelho.' : '';
    }

    function desenhar(estado) {
      const linhas = organizar(estado.lista, {
        consulta, ordem: preferencias.ordem, soGuardados: preferencias.soGuardados, guardados: estado.guardados, leituras: estado.leituras,
      });
      const achados = linhas.filter((linha) => linha.tipo === 'livro').length;
      const total = estado.lista.length;
      conta.textContent = !total ? '' : achados === total ? `${total} ${total === 1 ? 'livro' : 'livros'}` : `${achados} de ${total}`;
      aviso.textContent = estado.aviso || estado.mensagem || '';
      for (const botao of tela.querySelectorAll('[data-ordem]')) botao.setAttribute('aria-pressed', String(botao.dataset.ordem === preferencias.ordem));
      tela.querySelector('[data-acao="so-guardados"]').setAttribute('aria-pressed', String(preferencias.soGuardados));
      const pedaco = document.createDocumentFragment();
      for (const linha of linhas) {
        if (linha.tipo === 'grupo') {
          const grupo = document.createElement('h3');
          grupo.className = 'tb-grupo';
          grupo.textContent = linha.nome;
          const quantos = document.createElement('span');
          quantos.textContent = String(linha.quantos);
          grupo.appendChild(quantos);
          pedaco.appendChild(grupo);
          continue;
        }
        const { livro } = linha;
        const item = document.createElement('div');
        item.className = 'tb-livro';
        item.dataset.id = livro.id;
        item.dataset.arquivo = livro.nome;
        item.tabIndex = 0;
        item.setAttribute('role', 'button');
        item.title = livro.nome;
        item.innerHTML = '<span class="tb-nome"><span class="tb-titulo"></span><span class="tb-autor"></span></span><span class="tb-estado"></span><span class="tb-formato"></span>';
        item.querySelector('.tb-titulo').textContent = tituloDe(livro);
        item.querySelector('.tb-autor').textContent = linha.autor;
        item.querySelector('.tb-estado').textContent = situacaoDe(livro, estado, biblioteca.baixando);
        item.querySelector('.tb-formato').textContent = FORMATOS[livro.tipo] || '';
        pedaco.appendChild(item);
      }
      if (!achados) {
        const texto = vazio(estado);
        if (texto) {
          const nada = document.createElement('p');
          nada.className = 'tb-vazio';
          nada.textContent = texto;
          pedaco.appendChild(nada);
        }
      }
      listaEl.replaceChildren(pedaco);
    }

    // Só redesenha quando muda algo que a tela mostra, e só enquanto está aberta.
    let ultimo = '';
    function atualizar(forcar) {
      if (tela.hidden) return;
      const estado = biblioteca.estado;
      const marca = JSON.stringify([
        consulta, preferencias, estado.aviso, estado.mensagem, estado.situacao,
        estado.lista.map((l) => [l.id, l.titulo, l.autor, l.pasta, situacaoDe(l, estado, biblioteca.baixando)]),
        preferencias.ordem === 'recentes' ? [...estado.leituras].map(([id, leitura]) => [id, leitura.em]) : 0,
      ]);
      if (!forcar && marca === ultimo) return;
      ultimo = marca;
      desenhar(estado);
    }
    biblioteca.aoMudar(() => atualizar(false));

    function fechar() {
      if (tela.hidden) return;
      tela.hidden = true;
      for (const tipo of DO_QUADRO) document.removeEventListener(tipo, aoAgirNaPagina, true);
      const voltar = focoAnterior;
      focoAnterior = null;
      if (voltar && document.contains(voltar) && typeof voltar.focus === 'function') voltar.focus({ preventScroll: true });
    }

    // Com a tela aberta, Esc a fecha de qualquer lugar, e as teclas, o copiar
    // e o colar feitos fora dela não chegam ao quadro, que está coberto.
    function aoAgirNaPagina(e) {
      if (e.type === 'keydown' && e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        fechar();
      } else if (!tela.contains(e.target)) {
        e.stopPropagation();
      }
    }

    function abrir() {
      if (!tela.hidden) return;
      focoAnterior = document.activeElement;
      consulta = '';
      busca.value = '';
      tela.hidden = false;
      for (const tipo of DO_QUADRO) document.addEventListener(tipo, aoAgirNaPagina, true);
      atualizar(true);
      rolagem.scrollTop = 0;
      // No computador, o campo de busca já recebe o que for digitado; no
      // toque, o foco nele abriria o teclado por cima da lista.
      const comTeclado = global.matchMedia && global.matchMedia('(hover:hover) and (pointer:fine)').matches;
      (comTeclado ? busca : tela.querySelector('[data-acao="fechar"]')).focus({ preventScroll: true });
      if (biblioteca.estado.situacao !== 'atualizando') biblioteca.atualizar().catch(() => {});
    }

    function abrirLivro(id) {
      biblioteca.abrirNoLeitor(id, fechar).catch(() => {});
    }

    busca.addEventListener('input', () => {
      consulta = busca.value;
      atualizar(false);
      rolagem.scrollTop = 0;
    });

    tela.addEventListener('click', (e) => {
      const alvo = e.target.closest('[data-acao],[data-ordem],.tb-livro');
      if (!alvo) return;
      if (alvo.dataset.ordem) {
        preferencias.ordem = alvo.dataset.ordem;
        guardarPreferencias();
        atualizar(false);
        rolagem.scrollTop = 0;
      } else if (alvo.dataset.acao === 'fechar') {
        fechar();
      } else if (alvo.dataset.acao === 'atualizar') {
        biblioteca._mudar({ aviso: '' });
        biblioteca.atualizar().catch(() => {});
      } else if (alvo.dataset.acao === 'so-guardados') {
        preferencias.soGuardados = !preferencias.soGuardados;
        guardarPreferencias();
        atualizar(false);
        rolagem.scrollTop = 0;
      } else if (alvo.classList.contains('tb-livro')) {
        abrirLivro(alvo.dataset.id);
      }
    });

    // As teclas, o copiar e o colar feitos na tela ficam nela, depois de valerem para a linha em foco.
    tela.addEventListener('keydown', (e) => {
      const linha = e.target.closest && e.target.closest('.tb-livro');
      if (linha && e.target === linha && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        abrirLivro(linha.dataset.id);
      }
    });
    for (const tipo of DO_QUADRO) tela.addEventListener(tipo, (e) => e.stopPropagation());
    // Um arquivo solto sobre a tela não vai para o quadro coberto nem faz o navegador sair da página.
    for (const tipo of ['dragover', 'drop']) {
      tela.addEventListener(tipo, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    }

    const controle = { abrir, fechar, get aberta() { return !tela.hidden; }, elemento: tela };
    tela.telaDaBiblioteca = controle;
    return controle;
  }

  global.TelaDaBibliotecaPrancheta = Object.freeze({ montar });
})(typeof window !== 'undefined' ? window : globalThis);
