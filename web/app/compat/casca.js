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
// Na casca, os controles ficam numa faixa só, no alto da tela, longe da mão
// que escreve, que se apoia na parte de baixo e tocava os botões sem querer:
// à esquerda, o painel de quadros e o título, numa linha; ao centro, as
// ferramentas; à direita, a sincronização, desfazer, refazer, o zoom em
// porcentagem e mais opções. A descrição do quadro, o aviso "Salvo" e os
// botões de aumentar e diminuir o zoom só aparecem no computador. A faixa, as
// opções da caneta e os menus não têm sombras, que o e-ink mostra como manchas.

(function () {
  'use strict';

  const casca = window.Casca;
  if (!casca) return;

  const ESTILO_DA_CASCA = `
html.casca #faixa-casca{position:fixed;top:0;left:0;right:0;z-index:6;display:flex;flex-wrap:wrap;align-items:center;gap:4px 6px;
  padding:calc(env(safe-area-inset-top,0px) + 6px) max(10px,env(safe-area-inset-right,0px)) 6px max(10px,env(safe-area-inset-left,0px));
  background:var(--bg);border-bottom:1px solid var(--line)}
@media (min-width:761px){html.casca body.side #faixa-casca{left:260px}}
html.casca #faixa-casca>.lado{flex:1 1 0;display:flex;align-items:center;gap:4px;min-width:0}
html.casca #faixa-casca>.lado.esquerdo{min-width:100px}
html.casca #sinc{width:32px;height:34px;padding:0;font-size:0;display:flex;align-items:center;justify-content:center;border-radius:9px;text-decoration:none}
html.casca #sinc::before{content:"";width:18px;height:18px;background:currentColor;-webkit-mask:var(--icone-sinc) center/contain no-repeat;mask:var(--icone-sinc) center/contain no-repeat}
html.casca #sinc[data-situacao="erro"]{color:var(--fg)}`;

  // Na faixa, a sincronização aparece como um ícone, no mesmo traço dos
  // ícones da Prancheta, que muda com a situação; o texto continua no botão
  // para leitores de tela, e o diálogo mostra a situação por extenso.
  const ICONES_DA_SINCRONIZACAO = {
    desligada: '<path d="M12 13v8"/><path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2"/><path d="m8 17 4-4 4 4"/>',
    sincronizando: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    sincronizada: '<path d="m17 15-5.5 5.5L9 18"/><path d="M5 17.7A7 7 0 1 1 15.7 10h1.8a4.5 4.5 0 0 1 1.5 8.7"/>',
    sem_rede: '<path d="m2 2 20 20"/><path d="M5.8 5.8A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.3-.2"/><path d="M21.5 16.5A4.5 4.5 0 0 0 17.5 10h-1.8A7 7 0 0 0 10 5.1"/>',
    erro: '<path d="M12 12v4"/><path d="M12 20h.01"/><path d="M17 18h.5a1 1 0 0 0 0-9h-1.8A7 7 0 1 0 7 17.7"/>',
  };
  const mascara = (caminhos) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${caminhos}</svg>`)}")`;
  const ESTILO_DOS_ICONES = Object.entries(ICONES_DA_SINCRONIZACAO)
    .map(([situacao, caminhos]) => `html.casca #sinc${situacao === 'desligada' ? '' : `[data-situacao="${situacao}"]`}{--icone-sinc:${mascara(caminhos)}}`)
    .join('\n');

  const ESTILO_DA_FAIXA = `
html.casca #faixa-casca>.lado.direito{justify-content:flex-end;min-width:max-content}
html.casca #sideBtn,html.casca #head,html.casca #top{position:static}
html.casca #head{width:auto!important;min-width:0;flex:1 1 auto;display:flex;align-items:center;gap:8px;pointer-events:auto}
html.casca #bTitle{font-size:15px;font-weight:600;line-height:1.3;letter-spacing:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;min-width:0}
html.casca #bSub,html.casca #status,html.casca #zoom{display:none}
html.casca #backl{margin:0;flex:none}
html.casca #tools{flex:0 0 auto}
html.casca #faixa-casca .pill{background:none;border:0;box-shadow:none;padding:0;border-radius:0}
html.casca #faixa-casca .btn{width:32px}
html.casca #zoomPct{min-width:48px;height:34px;padding:0 4px;font:inherit;font-size:13px;font-variant-numeric:tabular-nums;color:var(--fg);background:none;border:0;border-radius:9px}
html.casca #bottom{top:calc(var(--casca-faixa,48px) + 8px);bottom:auto}
html.tinta-nativa #inkbar .stab,html.tinta-nativa #inkbar>span.sep:last-of-type{display:none}
html.casca #keys{top:calc(var(--casca-faixa,48px) + 8px)}
html.casca #toast{bottom:auto;top:calc(var(--casca-faixa,48px) + 64px)}`;

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
  estilo.textContent = `${ESTILO_DA_CASCA}\n${ESTILO_DOS_ICONES}${ESTILO_DA_FAIXA}${ESTILO_DO_E_INK}`;
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

  // Monta a faixa do alto com os elementos que o artefato já criou, sem
  // recriá-los: os botões continuam com os mesmos ids e as mesmas ações.
  function montarFaixa() {
    if (document.getElementById('faixa-casca')) return;
    const pegar = (id) => document.getElementById(id);
    const [painel, cabecalho, ferramentas, topo, porcentagem, mais] = ['sideBtn', 'head', 'tools', 'top', 'zoomPct', 'bMore'].map(pegar);
    if (!cabecalho || !ferramentas || !topo) return;
    const faixa = document.createElement('div');
    faixa.id = 'faixa-casca';
    const esquerdo = document.createElement('div');
    esquerdo.className = 'lado esquerdo';
    const direito = document.createElement('div');
    direito.className = 'lado direito';
    if (painel) esquerdo.appendChild(painel);
    esquerdo.appendChild(cabecalho);
    direito.appendChild(topo);
    // O zoom em porcentagem fica entre refazer e mais opções; o menu dele
    // ajusta à tela e escolhe 50, 100 ou 200%.
    if (porcentagem && mais && mais.parentNode) mais.parentNode.insertBefore(porcentagem, mais);
    faixa.append(esquerdo, ferramentas, direito);
    document.body.appendChild(faixa);
  }

  // As opções da caneta, os avisos e os atalhos começam logo abaixo da faixa.
  function arrumarNoAlto() {
    const faixa = document.getElementById('faixa-casca');
    const r = faixa && faixa.getBoundingClientRect();
    if (r && r.height) document.documentElement.style.setProperty('--casca-faixa', `${Math.ceil(r.bottom)}px`);
  }

  function iniciar() {
    if (!artefatoPronto()) return;
    montarFaixa();
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
