// Faixa dos controles, no alto da tela, na casca Android e no navegador.
//
// Os controles ficam numa faixa só, no alto da tela: à esquerda, o painel de
// quadros e o título, numa linha; ao centro, as ferramentas; à direita, a
// sincronização, desfazer, refazer, o zoom em porcentagem e mais opções. No
// Boox, isso tirou os botões de baixo da mão que escreve; a pedido do autor,
// em 2026-11-11, o navegador do computador e do iPad passou a ter a mesma
// faixa, com as coisas agrupadas num lugar só. A descrição do quadro, o aviso
// "Salvo" e os botões de aumentar e diminuir o zoom saem da tela: o zoom
// continua no menu da porcentagem, no Ctrl com a rolagem e na pinça.
//
// A faixa é montada com os elementos que o artefato já criou, sem recriá-los:
// os botões continuam com os mesmos ids e as mesmas ações. A altura dela fica
// em --altura-da-faixa, que as opções da caneta, os avisos, os atalhos e o
// leitor de livros usam para começar logo abaixo dela.
//
// Usa só elementos do artefato; deve ser carregado antes do código dele e
// só monta a faixa depois que ele roda.

(function () {
  'use strict';

  const ESTILO = `
html.faixa #faixa{position:fixed;top:0;left:0;right:0;z-index:6;display:flex;flex-wrap:wrap;align-items:center;gap:4px 6px;
  padding:calc(env(safe-area-inset-top,0px) + 6px) max(10px,env(safe-area-inset-right,0px)) 6px max(10px,env(safe-area-inset-left,0px));
  background:var(--bg);border-bottom:1px solid var(--line)}
@media (min-width:761px){html.faixa body.side #faixa{left:260px}}
html.faixa #faixa>.lado{flex:1 1 0;display:flex;align-items:center;gap:4px;min-width:0}
html.faixa #faixa>.lado.esquerdo{min-width:100px}
html.faixa #faixa>.lado.direito{justify-content:flex-end;min-width:max-content}
html.faixa #sinc{width:32px;height:34px;padding:0;font-size:0;display:flex;align-items:center;justify-content:center;border-radius:9px;text-decoration:none}
html.faixa #sinc::before{content:"";width:18px;height:18px;background:currentColor;-webkit-mask:var(--icone-sinc) center/contain no-repeat;mask:var(--icone-sinc) center/contain no-repeat}
html.faixa #sinc[data-situacao="erro"]{color:var(--fg)}
html.faixa #sideBtn,html.faixa #head,html.faixa #top{position:static}
html.faixa #head{width:auto!important;min-width:0;flex:1 1 auto;display:flex;align-items:center;gap:8px;pointer-events:auto}
html.faixa #bTitle{font-size:15px;font-weight:600;line-height:1.3;letter-spacing:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;min-width:0}
html.faixa #bSub,html.faixa #status,html.faixa #zoom{display:none}
html.faixa #backl{margin:0;flex:none}
html.faixa #tools{flex:0 0 auto}
html.faixa #faixa .pill{background:none;border:0;box-shadow:none;padding:0;border-radius:0}
html.faixa #faixa .btn{width:32px}
html.faixa #zoomPct{min-width:48px;height:34px;padding:0 4px;font:inherit;font-size:13px;font-variant-numeric:tabular-nums;color:var(--fg);background:none;border:0;border-radius:9px}
html.faixa #bottom{top:calc(var(--altura-da-faixa,48px) + 8px);bottom:auto}
html.faixa #keys{top:calc(var(--altura-da-faixa,48px) + 8px)}
html.faixa #toast{bottom:auto;top:calc(var(--altura-da-faixa,48px) + 64px)}`;

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
    .map(([situacao, caminhos]) => `html.faixa #sinc${situacao === 'desligada' ? '' : `[data-situacao="${situacao}"]`}{--icone-sinc:${mascara(caminhos)}}`)
    .join('\n');

  document.documentElement.classList.add('faixa');
  const estilo = document.createElement('style');
  estilo.id = 'estilo-da-faixa';
  estilo.textContent = `${ESTILO}\n${ESTILO_DOS_ICONES}`;
  document.head.appendChild(estilo);

  function montar() {
    const existente = document.getElementById('faixa');
    if (existente) return existente;
    const pegar = (id) => document.getElementById(id);
    const [painel, cabecalho, ferramentas, topo, porcentagem, mais] = ['sideBtn', 'head', 'tools', 'top', 'zoomPct', 'bMore'].map(pegar);
    if (!cabecalho || !ferramentas || !topo) return null;
    const faixa = document.createElement('div');
    faixa.id = 'faixa';
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
    return faixa;
  }

  // O que abre abaixo da faixa acompanha a altura dela, que ganha uma
  // segunda linha numa tela estreita.
  function medir() {
    const faixa = document.getElementById('faixa');
    const r = faixa && faixa.getBoundingClientRect();
    if (r && r.height) document.documentElement.style.setProperty('--altura-da-faixa', `${Math.ceil(r.bottom)}px`);
  }

  function iniciar() {
    const faixa = montar();
    if (!faixa) return;
    if (typeof ResizeObserver === 'function') new ResizeObserver(medir).observe(faixa);
    window.addEventListener('resize', medir);
    medir();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();

  window.Faixa = Object.freeze({ medir });
})();
