// Adaptador da casca Android. Quando a Prancheta roda dentro da casca, que
// injeta o objeto window.Casca, este arquivo liga a ponte da casca ao código
// do artefato; no navegador, não faz nada.
//
// Contrato com a casca, em pixels CSS relativos ao canto superior esquerdo
// da página, com a vista seguindo tela = quadro * k + (x, y):
//
// - a página chama Casca.pronta() quando está pronta para receber traços;
//   Casca.transformacao(json) quando a vista muda; Casca.areasReservadas(json)
//   com as barras, menus e painéis em que a caneta deve agir sobre a página
//   em vez de escrever; Casca.canetaEscreve(booleano) conforme a ferramenta
//   ativa; Casca.tinta(json) com a ferramenta de tinta, a cor e a espessura
//   escolhidas, para a camada da Onyx desenhar igual; Casca.parametrosDoTraco(),
//   que devolve em texto os parâmetros de traço do sistema da Onyx, quando o
//   diagnóstico é ligado; e Casca.redesenharTela()
//   quando o traço provisório da Onyx pode ter ficado fora do lugar, porque a
//   vista mudou ou traços foram movidos ou apagados;
// - a casca chama prancheta.receberTraco(pontos, contorno), com x, y, pressão
//   p de 0 a 1 e tempo t em milissegundos e, quando há, o contorno calculado
//   pelo motor de canetas da Onyx, com x, y e a espessura l de cada ponto; e
//   prancheta.definirTinta(modo), com 'nativa' quando a camada da Onyx
//   desenha e 'web' quando não há camada; e prancheta.toqueDescartado(motivo)
//   quando descarta ou cancela um toque de dedos, para o diagnóstico.
//
// Usa o estado e as funções globais do artefato, como S, toWorld e flushInk,
// sem mudá-los; deve ser carregado antes do código do artefato e só começa
// depois que ele roda.
//
// Os controles ficam numa faixa só, no alto da tela, longe da mão que
// escreve, montada por compat/faixa.js, que vale também no navegador. Aqui
// ficam só as regras do e-ink: a faixa, as opções da caneta e os menus não
// têm sombras, que o e-ink mostra como manchas.

(function () {
  'use strict';

  const casca = window.Casca;
  if (!casca) return;

  // Com a tinta da Onyx, as opções da caneta não têm os ajustes da tinta da página.
  const ESTILO_DA_TINTA = `
html.tinta-nativa #inkbar .stab,html.tinta-nativa #inkbar>span.sep:last-of-type{display:none}`;

  // Modo e-ink, só na casca: o e-ink mostra sombras, transições, animações e
  // fundos translúcidos como manchas cinzas e rastros. O destaque passa a ser
  // escuro e opaco: a cor de destaque vira a cor do texto, o que deixa a
  // seleção dos itens com contorno escuro e contínuo, e os botões ligados
  // ficam invertidos. Bordas finas fazem o papel das sombras.
  const ESTILO_DO_E_INK = `
html.casca{--accent:var(--fg);--accent-soft:var(--hover);--on-accent:var(--bg)}
html.casca *,html.casca *::before,html.casca *::after{box-shadow:none!important;text-shadow:none!important;transition:none!important;animation:none!important}
html.casca .btn[aria-pressed=true],html.casca .wd[aria-pressed=true],html.casca .chip[aria-pressed=true]{background:var(--fg);color:var(--bg)}
html.casca .dot[aria-pressed=true]{outline:2px solid var(--fg);outline-offset:2px}
html.casca .dot span{outline:1px solid var(--line-strong);outline-offset:-1px}
html.casca .card.v-image img{outline:1px solid var(--line);outline-offset:-1px}
html.casca .row.on{background:none;outline:1.5px solid var(--fg);outline-offset:-1.5px}
html.casca .menu,html.casca .pill,html.casca .pbox,html.casca #keys,html.casca #inkbar,html.casca #selbar{background:var(--panel);border:1px solid var(--line-strong)}
html.casca #over .ghost{background:none}
html.casca #prev{background:var(--bg)}
html.casca #sincDialogo{background:none}
html.casca body.busy #head{opacity:1}`;

  document.documentElement.classList.add('casca');
  const estilo = document.createElement('style');
  estilo.id = 'estilo-da-casca';
  estilo.textContent = `${ESTILO_DA_TINTA}\n${ESTILO_DO_E_INK}`;
  document.head.appendChild(estilo);

  // Com a ferramenta de seleção, a caneta escreve e um dedo seleciona e
  // arrasta; com as demais ferramentas que não são de tinta, a caneta age
  // sobre a página, como um ponteiro.
  const FERRAMENTAS_EM_QUE_A_CANETA_ESCREVE = new Set(['select', 'pen', 'hl']);
  const ESPERA_PARA_REDESENHAR = 250;
  const ESPERA_PARA_OS_PARAMETROS = 3500;
  const ESPERA_PARA_CONFERIR_AREAS = 400;
  const IGNORADOS = new Set(['SCRIPT', 'STYLE', 'LINK', 'TEMPLATE', 'INPUT', 'NOSCRIPT']);

  let nativa = false;
  let tintaProvisoria = false;
  let redesenho = null;
  let quadroAgendado = false;
  let conferencia = null;
  let ultimaVista = '';
  let ultimasAreas = '';
  let ultimaCaneta = null;
  let ultimaTinta = '';
  let ultimoDiagnostico = false;

  function chamar(nome, ...argumentos) {
    try {
      if (typeof casca[nome] === 'function') casca[nome](...argumentos);
    } catch (e) {
      console.warn(`Casca.${nome} falhou:`, e);
    }
  }

  const arredondar = (n) => Math.round(n * 10) / 10;

  // Coleta as áreas dos elementos da interface que recebem toques. Um
  // contêiner que deixa os toques passarem, como a faixa inferior das
  // ferramentas, entra só pelos filhos que os recebem.
  function coletarAreas(elemento, areas) {
    if (elemento.hidden || IGNORADOS.has(elemento.tagName)) return;
    const estilo = getComputedStyle(elemento);
    if (estilo.display === 'none' || estilo.visibility === 'hidden') return;
    const r = elemento.getBoundingClientRect();
    if (estilo.pointerEvents === 'none' || r.width === 0 || r.height === 0) {
      for (const filho of elemento.children) coletarAreas(filho, areas);
      return;
    }
    areas.push({ x: arredondar(r.left), y: arredondar(r.top), largura: arredondar(r.width), altura: arredondar(r.height) });
  }

  function areasReservadas() {
    const areas = [];
    for (const elemento of document.body.children) if (elemento.id !== 'stage') coletarAreas(elemento, areas);
    return areas;
  }

  // A tinta que a casca deve usar: a do marca-texto quando ele está ativo, e
  // a da caneta nos demais casos, com a cor já resolvida para o valor final.
  function tintaAtiva() {
    const ferramenta = S.tool === 'hl' ? 'hl' : 'pen';
    const cfg = S.ink[ferramenta];
    const cor = getComputedStyle(document.documentElement).getPropertyValue(`--${cfg.c}`).trim();
    return { ferramenta, cor, largura: cfg.w };
  }

  // Ao ligar o diagnóstico, mostra os parâmetros de traço do sistema da Onyx,
  // para um dia descobrir se algum deles regula a resposta à pressão do traço provisório.
  function mostrarParametrosDoTraco() {
    if (typeof casca.parametrosDoTraco !== 'function') return;
    let texto = '';
    try {
      texto = String(casca.parametrosDoTraco());
    } catch (e) {
      texto = `falhou: ${e}`;
    }
    const avisar = typeof toast === 'function' ? toast : typeof flash === 'function' ? flash : null;
    if (avisar) avisar(`Casca: parâmetros do traço da Onyx: ${texto}`);
  }

  function canetaEscreve() {
    return !S.ro && FERRAMENTAS_EM_QUE_A_CANETA_ESCREVE.has(S.tool);
  }

  function avisarAgora() {
    quadroAgendado = false;
    arrumarNoAlto();
    const v = S.view;
    const vista = JSON.stringify({ x: v.x, y: v.y, k: v.k });
    if (vista !== ultimaVista) {
      ultimaVista = vista;
      chamar('transformacao', vista);
    }
    const areas = JSON.stringify(areasReservadas());
    if (areas !== ultimasAreas) {
      ultimasAreas = areas;
      chamar('areasReservadas', areas);
    }
    const escreve = canetaEscreve();
    if (escreve !== ultimaCaneta) {
      ultimaCaneta = escreve;
      chamar('canetaEscreve', escreve);
    }
    const tinta = JSON.stringify(tintaAtiva());
    if (tinta !== ultimaTinta) {
      ultimaTinta = tinta;
      chamar('tinta', tinta);
    }
    const diagnostico = !!S.diag;
    if (diagnostico !== ultimoDiagnostico) {
      ultimoDiagnostico = diagnostico;
      // Espera o aviso do próprio diagnóstico, que a página mostra ao ligá-lo.
      if (diagnostico) setTimeout(mostrarParametrosDoTraco, ESPERA_PARA_OS_PARAMETROS);
    }
  }

  // Avisa no próximo quadro e confere de novo um pouco depois, para pegar
  // painéis que terminam de se mover depois da mudança que os abriu.
  function agendar() {
    if (!quadroAgendado) {
      quadroAgendado = true;
      requestAnimationFrame(avisarAgora);
    }
    clearTimeout(conferencia);
    conferencia = setTimeout(avisarAgora, ESPERA_PARA_CONFERIR_AREAS);
  }

  // O traço provisório da Onyx fica parado na tela até ela ser redesenhada.
  // Se a vista muda ou um traço é movido ou apagado depois que a casca
  // desenhou, pede-se um redesenho quando a mudança termina.
  function pedirRedesenho() {
    if (!tintaProvisoria) return;
    clearTimeout(redesenho);
    redesenho = setTimeout(() => {
      tintaProvisoria = false;
      chamar('redesenharTela');
    }, ESPERA_PARA_REDESENHAR);
  }

  function mudouTinta(mutacoes) {
    const novos = new Set();
    for (const m of mutacoes) for (const n of m.addedNodes) novos.add(n);
    const dentroDeNovo = (alvo) => {
      for (let n = alvo; n; n = n.parentNode) if (novos.has(n)) return true;
      return false;
    };
    for (const m of mutacoes) {
      if (m.type === 'childList' && m.removedNodes.length) return pedirRedesenho();
      if (m.type === 'attributes' && !dentroDeNovo(m.target)) return pedirRedesenho();
    }
  }

  // Recebe da casca um traço feito pela camada da Onyx e o grava como um
  // traço da Prancheta, pelo mesmo caminho dos traços feitos na página. O
  // contorno da Onyx, quando vem, fica no campo nf e define a forma do traço.
  function receberTraco(pontos, contorno) {
    if (!Array.isArray(pontos) || pontos.length === 0 || S.ro) return false;
    const ferramenta = S.tool === 'hl' ? 'hl' : 'pen';
    const cfg = S.ink[ferramenta];
    const p = [];
    for (const ponto of pontos) {
      const q = toWorld(Number(ponto.x), Number(ponto.y));
      const bruta = Number(ponto.p);
      // A mesma curva de pressão que o artefato aplica à caneta no navegador.
      const pressao = bruta > 0 ? Math.min(1, Math.max(0.04, Math.pow(bruta, 0.65))) : 0.5;
      p.push(q.x, q.y, pressao);
    }
    const inicio = Number(pontos[0].t);
    const fim = Number(pontos[pontos.length - 1].t);
    const dur = Number.isFinite(inicio) && Number.isFinite(fim) && fim >= inicio ? Math.round(fim - inicio) : 0;
    if (typeof exitEdit === 'function') exitEdit();
    if (S.sel.size && typeof select === 'function') select([]);
    let nf = null;
    if (ferramenta === 'pen' && Array.isArray(contorno) && contorno.length) {
      nf = [];
      for (const c of contorno) {
        const q = toWorld(Number(c.x), Number(c.y));
        const l = Number(c.l) / S.view.k;
        if (Number.isFinite(q.x) && Number.isFinite(q.y) && Number.isFinite(l)) nf.push(q.x, q.y, l);
      }
      if (!nf.length) nf = null;
    }
    S.pend.push({ tool: ferramenta, c: cfg.c, w: cfg.w, sim: false, p, k: S.view.k, em: Date.now() - dur, dur, ...(nf ? { nf } : {}) });
    flushInk();
    tintaProvisoria = true;
    return true;
  }

  function definirTinta(modo) {
    nativa = modo === 'nativa';
    // Com a tinta nativa, os traços da caneta não chegam à página; marcar a
    // caneta como vista faz um dedo mover o quadro em vez de desenhar.
    if (nativa) S.penSeen = true;
    // A estabilização e a previsão só valem para a tinta desenhada pela
    // página; com a tinta da Onyx, as opções da caneta mostram só cor e espessura.
    document.documentElement.classList.toggle('tinta-nativa', nativa);
    agendar();
  }

  // A casca avisa cada toque de dedos que ela mesma descarta ou cancela, com o
  // motivo; com o diagnóstico ligado, em "Mais opções", o motivo aparece num aviso.
  function toqueDescartado(motivo) {
    if (S.diag && typeof flash === 'function') flash(`Casca: ${motivo}`);
  }

  function artefatoPronto() {
    try {
      return typeof S === 'object' && typeof toWorld === 'function' && typeof flushInk === 'function';
    } catch (e) {
      return false;
    }
  }

  // A faixa pode ganhar ou perder uma linha quando um painel abre.
  function arrumarNoAlto() {
    if (window.Faixa) window.Faixa.medir();
  }

  function iniciar() {
    if (!artefatoPronto()) return;
    window.prancheta = Object.freeze({ receberTraco, definirTinta, toqueDescartado, tintaNativa: () => nativa });
    const mundo = document.getElementById('world');
    const palco = document.getElementById('stage');
    const tinta = document.getElementById('ink');
    new MutationObserver(() => { agendar(); pedirRedesenho(); }).observe(mundo, { attributes: true, attributeFilter: ['style'] });
    new MutationObserver(agendar).observe(palco, { attributes: true, attributeFilter: ['data-tool'] });
    new MutationObserver(mudouTinta).observe(tinta, { childList: true, subtree: true, attributes: true, attributeFilter: ['d', 'transform'] });
    const interface_ = new MutationObserver(agendar);
    interface_.observe(document.body, { childList: true });
    for (const elemento of document.body.children) {
      if (elemento !== palco) interface_.observe(elemento, { attributes: true, attributeFilter: ['hidden', 'style', 'class'], childList: true, subtree: true });
    }
    new MutationObserver((mutacoes) => {
      for (const m of mutacoes) for (const n of m.addedNodes) {
        if (n.nodeType === 1 && n !== palco) interface_.observe(n, { attributes: true, attributeFilter: ['hidden', 'style', 'class'], childList: true, subtree: true });
      }
    }).observe(document.body, { childList: true });
    window.addEventListener('resize', agendar);
    avisarAgora();
    chamar('pronta');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
