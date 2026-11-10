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
// - A ordem e os filtros escolhidos ficam guardados neste aparelho.
// - Etapa 02 do plano 008, a ficha do livro: o botão no fim de cada linha, e
//   um botão do leitor, abrem a ficha, na mesma tela, com os dados do livro,
//   o botão que o abre, os destaques dele e os quadros que o citam, com os
//   cartões de cada um, achados por marcacoes.citacoes(). Tocar num destaque
//   abre o livro no trecho; tocar num cartão abre o quadro com ele à vista.
//   Na lista, cada livro citado diz em quantos quadros aparece, e o filtro
//   "Citados" deixa só esses.
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
#tela-biblioteca .tb-livro{display:flex;align-items:center;gap:6px;min-height:48px;border-bottom:1px solid var(--line,#E3E1DD)}
#tela-biblioteca button.tb-abrir{flex:1;min-width:0;height:auto;min-height:48px;display:flex;align-items:center;gap:12px;padding:6px 4px;border:0;border-radius:0;background:none;text-align:left}
#tela-biblioteca button.tb-abrir:focus-visible,#tela-biblioteca button.tb-item:focus-visible{outline:2px solid var(--fg,#37352F);outline-offset:-2px}
#tela-biblioteca .tb-nome{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
#tela-biblioteca .tb-titulo,#tela-biblioteca .tb-autor{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#tela-biblioteca .tb-titulo{font-size:15px}
#tela-biblioteca .tb-autor{font-size:12.5px;color:var(--muted,#7F7C76)}
#tela-biblioteca .tb-autor:empty{display:none}
#tela-biblioteca .tb-estado,#tela-biblioteca .tb-formato{flex:none;font-size:12.5px;color:var(--muted,#7F7C76);font-variant-numeric:tabular-nums;text-align:right}
#tela-biblioteca .tb-formato{width:38px}
#tela-biblioteca .tb-vazio{margin:0;padding:28px 4px;font-size:14px;color:var(--muted,#7F7C76)}
#tela-biblioteca .tb-ficha{padding-top:20px;padding-bottom:32px}
#tela-biblioteca .tb-ficha-titulo{margin:0;font-size:20px;font-weight:600;letter-spacing:0;overflow-wrap:anywhere}
#tela-biblioteca button.tb-ficha-abrir{height:44px;padding:0 18px}
#tela-biblioteca .tb-ficha-dados{margin:4px 0 14px;font-size:13.5px;color:var(--muted,#7F7C76);font-variant-numeric:tabular-nums}
#tela-biblioteca .tb-quadro{margin:0;padding:14px 4px 2px;font-size:14px;font-weight:600}
#tela-biblioteca button.tb-item{width:100%;height:auto;min-height:48px;display:flex;flex-direction:column;align-items:stretch;gap:3px;padding:8px 4px;border:0;border-bottom:1px solid var(--line,#E3E1DD);border-radius:0;background:none;text-align:left}
#tela-biblioteca .tb-trecho{font-size:14.5px;line-height:1.4;overflow-wrap:anywhere;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:4;overflow:hidden}
#tela-biblioteca .tb-nota{font-size:13.5px;line-height:1.4;overflow-wrap:anywhere}
#tela-biblioteca .tb-nota::before{content:"Nota: ";color:var(--muted,#7F7C76)}
#tela-biblioteca .tb-onde{font-size:12.5px;color:var(--muted,#7F7C76);font-variant-numeric:tabular-nums}
@media (hover:hover){#tela-biblioteca button.tb-abrir:hover,#tela-biblioteca button.tb-item:hover{background:var(--hover,#EFEDEA)}}
`;

  const ICONE_DE_FECHAR = '<svg class="i" viewBox="0 0 24 24"><path d="M6 6l12 12"></path><path d="M18 6 6 18"></path></svg>';
  const ICONE_DE_ATUALIZAR = '<svg class="i" viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.7"></path><path d="M20 4v5h-5"></path></svg>';
  const ICONE_DE_VOLTAR = '<svg class="i" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"></path></svg>';
  const ICONE_DA_FICHA = '<svg class="i" viewBox="0 0 24 24"><path d="M6 4h12v16H6z"></path><path d="M9 9h6"></path><path d="M9 13h6"></path><path d="M9 17h3"></path></svg>';

  const FORMATOS = { 'application/pdf': 'PDF', 'application/epub+zip': 'EPUB' };

  function lerPreferencias() {
    try {
      const lidas = JSON.parse(global.localStorage.getItem(PREFERENCIAS) || 'null') || {};
      return {
        ordem: ORDENS.some(([ordem]) => ordem === lidas.ordem) ? lidas.ordem : 'autor', soGuardados: lidas.soGuardados === true, soCitados: lidas.soCitados === true,
      };
    } catch (e) {
      return { ordem: 'autor', soGuardados: false, soCitados: false };
    }
  }

  // Um elemento com uma classe e um texto, que entra sempre como texto, nunca como marcação.
  function criar(marca, classe, texto) {
    const elemento = document.createElement(marca);
    if (classe) elemento.className = classe;
    if (texto !== undefined) elemento.textContent = texto;
    return elemento;
  }

  function montar(biblioteca) {
    const existente = document.getElementById('tela-biblioteca');
    if (existente) return existente.telaDaBiblioteca;
    const { organizar, tituloDe, grupoDe, situacaoDe, normalizar } = global.BibliotecaPrancheta;
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
  <button type="button" class="tb-icone" data-acao="voltar" title="Voltar à lista dos livros" aria-label="Voltar à lista dos livros" hidden>${ICONE_DE_VOLTAR}</button>
  <h2>Biblioteca</h2>
  <span class="tb-conta"></span>
  <button type="button" class="tb-icone" data-acao="atualizar" title="Atualizar a lista" aria-label="Atualizar a lista">${ICONE_DE_ATUALIZAR}</button>
</div>
<div class="tb-coluna tb-barra">
  <input type="search" class="tb-busca" placeholder="Buscar por título ou autor" aria-label="Buscar na biblioteca" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search">
  <div class="tb-ordem" role="group" aria-label="Ordem da lista">${ORDENS.map(([ordem, rotulo]) => `<button type="button" data-ordem="${ordem}" aria-pressed="false">${rotulo}</button>`).join('')}</div>
  <div class="tb-ordem" role="group" aria-label="Filtros da lista">
    <button type="button" data-acao="so-guardados" aria-pressed="false" title="Mostrar só os livros guardados neste aparelho">Neste aparelho</button>
    <button type="button" data-acao="so-citados" aria-pressed="false" title="Mostrar só os livros citados em algum quadro">Citados</button>
  </div>
</div>
<p class="tb-coluna tb-aviso" role="status"></p>
<div class="tb-rolagem tb-da-lista"><div class="tb-coluna tb-lista"></div></div>
<div class="tb-rolagem tb-da-ficha" hidden><div class="tb-coluna tb-ficha"></div></div>`;
    document.body.appendChild(tela);

    const busca = tela.querySelector('.tb-busca');
    const conta = tela.querySelector('.tb-conta');
    const aviso = tela.querySelector('.tb-aviso');
    const listaEl = tela.querySelector('.tb-lista');
    const fichaEl = tela.querySelector('.tb-ficha');
    const rolagem = tela.querySelector('.tb-da-lista');
    const rolagemDaFicha = tela.querySelector('.tb-da-ficha');
    const preferencias = lerPreferencias();
    let consulta = '';
    let focoAnterior = null;
    // Os quadros que citam cada livro, achados a cada abertura da tela e de uma ficha.
    let citacoes = new Map();
    let varredura = 0;
    // A ficha à vista: o livro, o que se sabe dele quando não está na lista, e os destaques dele.
    let ficha = null;

    const marcacoes = () => global.marcacoesDaPrancheta || null;
    const quadrosDe = (id) => (citacoes.get(id) || []).length;

    function guardarPreferencias() {
      try {
        global.localStorage.setItem(PREFERENCIAS, JSON.stringify(preferencias));
      } catch (e) { /* sem onde guardar, a escolha vale até a página fechar */ }
    }

    function vazio(estado) {
      if (!estado.lista.length) return estado.situacao === 'atualizada' ? 'Nenhum livro na biblioteca.' : '';
      const { soGuardados, soCitados } = preferencias;
      if (consulta.trim()) {
        const entre = [soGuardados ? 'os guardados neste aparelho' : '', soCitados ? 'os citados em algum quadro' : ''].filter(Boolean).join(' e ');
        return `Nenhum livro com "${consulta.trim()}"${entre ? ` entre ${entre}` : ''}.`;
      }
      if (soGuardados && soCitados) return 'Nenhum livro guardado neste aparelho é citado em algum quadro.';
      if (soGuardados) return 'Nenhum livro guardado neste aparelho.';
      return soCitados ? 'Nenhum livro citado em algum quadro.' : '';
    }

    function desenharLista(estado) {
      const linhas = organizar(estado.lista, {
        consulta, ordem: preferencias.ordem, soGuardados: preferencias.soGuardados, guardados: estado.guardados,
        soCitados: preferencias.soCitados, citados: new Set(citacoes.keys()), leituras: estado.leituras,
      });
      const achados = linhas.filter((linha) => linha.tipo === 'livro').length;
      const total = estado.lista.length;
      conta.textContent = !total ? '' : achados === total ? `${total} ${total === 1 ? 'livro' : 'livros'}` : `${achados} de ${total}`;
      for (const botao of tela.querySelectorAll('[data-ordem]')) botao.setAttribute('aria-pressed', String(botao.dataset.ordem === preferencias.ordem));
      tela.querySelector('[data-acao="so-guardados"]').setAttribute('aria-pressed', String(preferencias.soGuardados));
      tela.querySelector('[data-acao="so-citados"]').setAttribute('aria-pressed', String(preferencias.soCitados));
      const pedaco = document.createDocumentFragment();
      for (const linha of linhas) {
        if (linha.tipo === 'grupo') {
          const grupo = criar('h3', 'tb-grupo', linha.nome);
          grupo.appendChild(criar('span', '', String(linha.quantos)));
          pedaco.appendChild(grupo);
          continue;
        }
        const { livro } = linha;
        const item = criar('div', 'tb-livro');
        item.dataset.id = livro.id;
        item.dataset.arquivo = livro.nome;
        item.title = livro.nome;
        item.innerHTML = '<button type="button" class="tb-abrir"><span class="tb-nome"><span class="tb-titulo"></span><span class="tb-autor"></span></span><span class="tb-estado"></span><span class="tb-formato"></span></button>'
          + `<button type="button" class="tb-icone" data-acao="ficha" title="Ficha do livro: destaques e quadros">${ICONE_DA_FICHA}</button>`;
        item.querySelector('.tb-titulo').textContent = tituloDe(livro);
        item.querySelector('.tb-autor').textContent = linha.autor;
        item.querySelector('.tb-estado').textContent = situacaoDe(livro, estado, biblioteca.baixando, quadrosDe(livro.id));
        item.querySelector('.tb-formato').textContent = FORMATOS[livro.tipo] || '';
        item.querySelector('[data-acao="ficha"]').setAttribute('aria-label', `Ficha de ${tituloDe(livro)}`);
        pedaco.appendChild(item);
      }
      if (!achados) {
        const texto = vazio(estado);
        if (texto) pedaco.appendChild(criar('p', 'tb-vazio', texto));
      }
      listaEl.replaceChildren(pedaco);
    }

    // O livro da ficha: o da lista ou, se ele saiu da biblioteca, o pouco que se sabe dele.
    const livroDaFicha = (estado) => estado.lista.find((l) => l.id === ficha.id) || { id: ficha.id, ...ficha.reserva };
    const noLeitor = (id) => Boolean(global.leitorDaPrancheta && global.leitorDaPrancheta.aberto && global.leitorDaPrancheta.livro && global.leitorDaPrancheta.livro.id === id);

    function desenharFicha(estado) {
      const livro = livroDaFicha(estado);
      const naLista = estado.lista.some((l) => l.id === livro.id);
      const pedaco = document.createDocumentFragment();
      pedaco.appendChild(criar('h3', 'tb-ficha-titulo', tituloDe(livro) || 'Livro fora da biblioteca'));
      const autores = [grupoDe(livro), livro.autor && normalizar(livro.autor) !== normalizar(grupoDe(livro)) ? livro.autor : ''].filter(Boolean).join(' · ');
      const dados = [autores, FORMATOS[livro.tipo] || '', naLista ? situacaoDe(livro, estado, biblioteca.baixando) : 'fora da biblioteca'].filter(Boolean).join(' · ');
      pedaco.appendChild(criar('p', 'tb-ficha-dados', dados));
      const abrir = criar('button', 'tb-ficha-abrir', noLeitor(livro.id) ? 'Voltar ao livro' : estado.leituras.has(livro.id) ? 'Continuar a leitura' : 'Abrir o livro');
      abrir.type = 'button';
      abrir.dataset.acao = 'ficha-abrir';
      pedaco.appendChild(abrir);

      // Os destaques, na ordem em que foram feitos.
      const tituloDosDestaques = criar('h4', 'tb-grupo', 'Destaques');
      tituloDosDestaques.appendChild(criar('span', '', String(ficha.destaques.length)));
      pedaco.appendChild(tituloDosDestaques);
      if (!ficha.destaques.length) pedaco.appendChild(criar('p', 'tb-vazio', 'Nenhum destaque neste livro.'));
      for (const destaque of ficha.destaques) {
        const item = criar('button', 'tb-item');
        item.type = 'button';
        item.dataset.destaque = destaque.id;
        item.appendChild(criar('span', 'tb-trecho', destaque.trecho || ''));
        if (destaque.nota) item.appendChild(criar('span', 'tb-nota', destaque.nota));
        if (destaque.rotulo) item.appendChild(criar('span', 'tb-onde', destaque.rotulo));
        pedaco.appendChild(item);
      }

      // Os quadros que citam o livro, cada um com os cartões levados a ele.
      const doLivro = citacoes.get(livro.id) || [];
      const tituloDosQuadros = criar('h4', 'tb-grupo', 'Nos quadros');
      tituloDosQuadros.appendChild(criar('span', '', String(doLivro.length)));
      pedaco.appendChild(tituloDosQuadros);
      if (!doLivro.length) pedaco.appendChild(criar('p', 'tb-vazio', 'Nenhum quadro cita este livro.'));
      for (const noQuadro of doLivro) {
        pedaco.appendChild(criar('h5', 'tb-quadro', noQuadro.titulo));
        for (const cartao of noQuadro.cartoes) {
          const item = criar('button', 'tb-item');
          item.type = 'button';
          item.dataset.quadro = noQuadro.quadro;
          item.dataset.cartao = cartao.id;
          item.appendChild(criar('span', 'tb-trecho', cartao.trecho || 'Posição do livro, sem trecho'));
          if (cartao.onde) item.appendChild(criar('span', 'tb-onde', cartao.onde));
          pedaco.appendChild(item);
        }
      }
      fichaEl.replaceChildren(pedaco);
    }

    // Mostra a lista ou a ficha, com os controles de cada uma.
    function mostrarVista() {
      const naFicha = ficha !== null;
      tela.querySelector('.tb-barra').hidden = naFicha;
      rolagem.hidden = naFicha;
      rolagemDaFicha.hidden = !naFicha;
      tela.querySelector('[data-acao="voltar"]').hidden = !naFicha;
      tela.querySelector('[data-acao="atualizar"]').hidden = naFicha;
      conta.hidden = naFicha;
      tela.querySelector('h2').textContent = naFicha ? 'Ficha do livro' : 'Biblioteca';
    }

    // O botão em foco na lista ou na ficha, para o foco voltar a ele depois de um redesenho.
    function botaoEmFoco() {
      const foco = document.activeElement;
      if (!foco || !(listaEl.contains(foco) || fichaEl.contains(foco))) return null;
      const linha = foco.closest('.tb-livro');
      if (linha) return `.tb-livro[data-id="${linha.dataset.id}"] ${foco.dataset.acao ? `[data-acao="${foco.dataset.acao}"]` : '.tb-abrir'}`;
      if (foco.dataset.destaque) return `[data-destaque="${foco.dataset.destaque}"]`;
      if (foco.dataset.cartao) return `[data-quadro="${foco.dataset.quadro}"][data-cartao="${foco.dataset.cartao}"]`;
      return foco.dataset.acao ? `[data-acao="${foco.dataset.acao}"]` : null;
    }

    // Só redesenha quando muda algo que a lista ou a ficha mostram, e só com a
    // tela aberta: um redesenho à toa tiraria o foco do botão e poderia engolir
    // um toque dado nesse instante. O aviso é trocado à parte, sem redesenho.
    let ultimo = '';
    function atualizar(forcar) {
      if (tela.hidden) return;
      const estado = biblioteca.estado;
      aviso.textContent = estado.aviso || estado.mensagem || '';
      const situacoes = estado.lista.map((l) => [l.id, l.titulo, l.autor, l.pasta, situacaoDe(l, estado, biblioteca.baixando, quadrosDe(l.id))]);
      const marca = JSON.stringify(ficha
        ? ['ficha', ficha.id, ficha.destaques, citacoes.get(ficha.id) || [], situacoes.find((l) => l[0] === ficha.id) || ficha.reserva, estado.leituras.has(ficha.id), noLeitor(ficha.id)]
        : ['lista', consulta, preferencias, estado.lista.length ? '' : estado.situacao, situacoes, [...citacoes.keys()],
          preferencias.ordem === 'recentes' ? [...estado.leituras].map(([id, leitura]) => [id, leitura.em]) : 0]);
      if (!forcar && marca === ultimo) return;
      ultimo = marca;
      const emFoco = botaoEmFoco();
      if (ficha) desenharFicha(estado);
      else desenharLista(estado);
      const mesmo = emFoco && (ficha ? fichaEl : listaEl).querySelector(emFoco);
      if (mesmo) mesmo.focus({ preventScroll: true });
    }
    biblioteca.aoMudar(() => atualizar(false));

    // Procura de novo os quadros que citam os livros; só a busca mais recente vale.
    async function varrer() {
      const origem = marcacoes();
      if (!origem) return;
      varredura += 1;
      const vez = varredura;
      try {
        const achadas = await origem.citacoes();
        if (vez !== varredura) return;
        citacoes = achadas;
        atualizar(false);
      } catch (e) { /* sem as citações, a lista e a ficha continuam valendo */ }
    }

    // Com a tela aberta, cada rodada da sincronização pode ter trazido cartões
    // de outro aparelho: as citações são procuradas de novo.
    if (biblioteca.sincronizacao && typeof biblioteca.sincronizacao.aoMudarEstado === 'function') {
      biblioteca.sincronizacao.aoMudarEstado((estado) => {
        if (!tela.hidden && estado.situacao === 'sincronizada') varrer();
      });
    }

    function largarFicha() {
      if (ficha && ficha.parar) ficha.parar();
      ficha = null;
    }

    function fechar() {
      if (tela.hidden) return;
      tela.hidden = true;
      largarFicha();
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

    // O que vale para a lista e para a ficha: a tela por cima da página e as citações procuradas de novo.
    function exibir() {
      if (tela.hidden) {
        focoAnterior = document.activeElement;
        tela.hidden = false;
        for (const tipo of DO_QUADRO) document.addEventListener(tipo, aoAgirNaPagina, true);
      }
      mostrarVista();
      atualizar(true);
      varrer();
    }

    function abrir() {
      if (!tela.hidden && !ficha) return;
      largarFicha();
      consulta = '';
      busca.value = '';
      exibir();
      rolagem.scrollTop = 0;
      // No computador, o campo de busca já recebe o que for digitado; no
      // toque, o foco nele abriria o teclado por cima da lista.
      const comTeclado = global.matchMedia && global.matchMedia('(hover:hover) and (pointer:fine)').matches;
      (comTeclado ? busca : tela.querySelector('[data-acao="fechar"]')).focus({ preventScroll: true });
      if (biblioteca.estado.situacao !== 'atualizando') biblioteca.atualizar().catch(() => {});
    }

    /** Abre a ficha de um livro; `reserva` é o que se sabe dele, { nome, tipo }, se ele não estiver na lista. */
    function abrirFicha(id, reserva = {}) {
      largarFicha();
      const nova = { id: String(id), reserva: { nome: reserva.nome || '', tipo: reserva.tipo || '' }, destaques: [], parar: null };
      ficha = nova;
      const origem = marcacoes();
      // Os destaques acompanham o que muda, inclusive o que chega de outro aparelho.
      if (origem) {
        nova.parar = origem.acompanhar(nova.id, (itens) => {
          if (ficha !== nova) return;
          nova.destaques = itens;
          atualizar(false);
        });
      }
      exibir();
      rolagemDaFicha.scrollTop = 0;
      tela.querySelector('[data-acao="voltar"]').focus({ preventScroll: true });
    }

    function voltarALista() {
      const id = ficha ? ficha.id : null;
      largarFicha();
      mostrarVista();
      atualizar(true);
      const botao = id && listaEl.querySelector(`.tb-livro[data-id="${id}"] [data-acao="ficha"]`);
      (botao || tela.querySelector('[data-acao="fechar"]')).focus({ preventScroll: true });
    }

    function abrirLivro(id, posicao) {
      // O livro que já está aberto no leitor continua onde está: basta fechar a tela.
      if (!posicao && noLeitor(id)) {
        fechar();
        return;
      }
      biblioteca.abrirNoLeitor(id, fechar, posicao).catch(() => {});
    }

    busca.addEventListener('input', () => {
      consulta = busca.value;
      atualizar(false);
      rolagem.scrollTop = 0;
    });

    tela.addEventListener('click', (e) => {
      const alvo = e.target.closest('[data-acao],[data-ordem],.tb-abrir,.tb-item');
      if (!alvo) return;
      const linha = alvo.closest('.tb-livro');
      if (alvo.dataset.ordem) {
        preferencias.ordem = alvo.dataset.ordem;
        guardarPreferencias();
        atualizar(false);
        rolagem.scrollTop = 0;
      } else if (alvo.dataset.acao === 'fechar') {
        fechar();
      } else if (alvo.dataset.acao === 'voltar') {
        voltarALista();
      } else if (alvo.dataset.acao === 'atualizar') {
        biblioteca._mudar({ aviso: '' });
        biblioteca.atualizar().catch(() => {});
        varrer();
      } else if (alvo.dataset.acao === 'so-guardados' || alvo.dataset.acao === 'so-citados') {
        const qual = alvo.dataset.acao === 'so-guardados' ? 'soGuardados' : 'soCitados';
        preferencias[qual] = !preferencias[qual];
        guardarPreferencias();
        atualizar(false);
        rolagem.scrollTop = 0;
      } else if (alvo.dataset.acao === 'ficha' && linha) {
        abrirFicha(linha.dataset.id);
      } else if (alvo.dataset.acao === 'ficha-abrir' && ficha) {
        abrirLivro(ficha.id);
      } else if (alvo.dataset.destaque && ficha) {
        const destaque = ficha.destaques.find((d) => d.id === alvo.dataset.destaque);
        if (destaque) abrirLivro(ficha.id, destaque.posicao);
      } else if (alvo.dataset.cartao) {
        const origem = marcacoes();
        const { quadro, cartao } = alvo.dataset;
        fechar();
        if (origem) origem.abrirNoQuadro(quadro, cartao).catch(() => {});
      } else if (alvo.classList.contains('tb-abrir') && linha) {
        abrirLivro(linha.dataset.id);
      }
    });

    // As teclas, o copiar e o colar feitos na tela ficam nela.
    for (const tipo of DO_QUADRO) tela.addEventListener(tipo, (e) => e.stopPropagation());
    // Um arquivo solto sobre a tela não vai para o quadro coberto nem faz o navegador sair da página.
    for (const tipo of ['dragover', 'drop']) {
      tela.addEventListener(tipo, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    }

    const controle = { abrir, abrirFicha, fechar, get aberta() { return !tela.hidden; }, elemento: tela };
    tela.telaDaBiblioteca = controle;
    return controle;
  }

  global.TelaDaBibliotecaPrancheta = Object.freeze({ montar });
})(typeof window !== 'undefined' ? window : globalThis);
