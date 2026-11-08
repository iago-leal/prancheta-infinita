// Página de teste da casca Android. Desenha com a tinta web, move e amplia
// a área com dois dedos e recebe traços da camada nativa pela ponte.
//
// Contrato com a casca: as coordenadas de tela são pixels CSS relativos ao
// canto superior esquerdo da página, e a vista segue tela = quadro * k + (x, y).
// A página chama window.Casca.pronta() ao carregar e
// window.Casca.transformacao(json) quando a vista muda; a casca chama
// window.prancheta.receberTraco(pontos).

import { getStroke } from './vendor/perfect-freehand/index.js';

const NS = 'http://www.w3.org/2000/svg';
const OPCOES_TINTA = { size: 4, thinning: 0.6, smoothing: 0.5, streamline: 0.4 };
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 8;

const tela = document.getElementById('tela');
const mundo = document.getElementById('mundo');
const info = document.getElementById('info');

const vista = { x: 0, y: 0, k: 1 };
const tracos = [];
const elementos = new Map();
const pendentes = new Set();
const toques = new Map();
let proximoId = 1;
let tracoAtual = null;
let gesto = null;
let avisoPendente = false;

function telaParaQuadro(x, y) {
  return { x: (x - vista.x) / vista.k, y: (y - vista.y) / vista.k };
}

function quadroParaTela(x, y) {
  return { x: x * vista.k + vista.x, y: y * vista.k + vista.y };
}

// Converte o contorno da perfect-freehand num caminho SVG suavizado,
// como recomenda a documentação da biblioteca.
function caminhoSvg(contorno) {
  if (!contorno.length) return '';
  const d = contorno.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ['M', ...contorno[0], 'Q'],
  );
  d.push('Z');
  return d.join(' ');
}

function desenhar(traco) {
  let el = elementos.get(traco.id);
  if (!el) {
    el = document.createElementNS(NS, 'path');
    el.dataset.id = traco.id;
    el.dataset.origem = traco.origem;
    mundo.appendChild(el);
    elementos.set(traco.id, el);
  }
  const contorno = getStroke(traco.pontos, { ...OPCOES_TINTA, simulatePressure: traco.simularPressao, last: !traco.emAndamento });
  el.setAttribute('d', caminhoSvg(contorno));
}

function agendarDesenho(traco) {
  if (pendentes.size === 0) {
    requestAnimationFrame(() => {
      for (const t of pendentes) desenhar(t);
      pendentes.clear();
    });
  }
  pendentes.add(traco);
}

function atualizarInfo() {
  info.textContent = `${tracos.length} traços · zoom ${vista.k.toFixed(2)}`;
}

function avisarCasca() {
  if (avisoPendente) return;
  avisoPendente = true;
  requestAnimationFrame(() => {
    avisoPendente = false;
    window.Casca?.transformacao(JSON.stringify(vista));
  });
}

function aplicarVista() {
  mundo.setAttribute('transform', `translate(${vista.x} ${vista.y}) scale(${vista.k})`);
  atualizarInfo();
  avisarCasca();
}

function novoTraco(origem, simularPressao) {
  const traco = { id: proximoId++, origem, criadoEm: Date.now(), simularPressao, emAndamento: false, pontos: [] };
  tracos.push(traco);
  return traco;
}

function acrescentar(traco, ev) {
  const q = telaParaQuadro(ev.clientX, ev.clientY);
  traco.pontos.push([q.x, q.y, traco.simularPressao ? 0.5 : ev.pressure]);
}

// Gesto de dois dedos: o ponto do quadro que estava sob o meio dos dedos
// no início continua sob o meio dos dedos, e o zoom acompanha a distância.
function iniciarGesto() {
  if (toques.size !== 2) {
    gesto = null;
    return;
  }
  const [a, b] = [...toques.values()];
  gesto = { meio: meio(a, b), distancia: Math.max(distancia(a, b), 1), vista: { ...vista } };
}

function atualizarGesto() {
  if (!gesto || toques.size !== 2) return;
  const [a, b] = [...toques.values()];
  const m = meio(a, b);
  const k = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, (gesto.vista.k * distancia(a, b)) / gesto.distancia));
  const qx = (gesto.meio.x - gesto.vista.x) / gesto.vista.k;
  const qy = (gesto.meio.y - gesto.vista.y) / gesto.vista.k;
  vista.k = k;
  vista.x = m.x - qx * k;
  vista.y = m.y - qy * k;
  aplicarVista();
}

function meio(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distancia(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

tela.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch') {
    toques.set(e.pointerId, { x: e.clientX, y: e.clientY });
    iniciarGesto();
    return;
  }
  if (e.button !== 0 || tracoAtual) return;
  tela.setPointerCapture(e.pointerId);
  const traco = novoTraco('web', e.pointerType !== 'pen');
  traco.emAndamento = true;
  tracoAtual = { traco, ponteiro: e.pointerId };
  acrescentar(traco, e);
  agendarDesenho(traco);
});

tela.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') {
    if (toques.has(e.pointerId)) {
      toques.set(e.pointerId, { x: e.clientX, y: e.clientY });
      atualizarGesto();
    }
    return;
  }
  if (!tracoAtual || e.pointerId !== tracoAtual.ponteiro) return;
  const eventos = e.getCoalescedEvents?.() ?? [];
  for (const ev of eventos.length ? eventos : [e]) acrescentar(tracoAtual.traco, ev);
  agendarDesenho(tracoAtual.traco);
});

function terminar(e) {
  if (e.pointerType === 'touch') {
    toques.delete(e.pointerId);
    iniciarGesto();
    return;
  }
  if (!tracoAtual || e.pointerId !== tracoAtual.ponteiro) return;
  const { traco } = tracoAtual;
  tracoAtual = null;
  traco.emAndamento = false;
  pendentes.delete(traco);
  desenhar(traco);
  atualizarInfo();
}

tela.addEventListener('pointerup', terminar);
tela.addEventListener('pointercancel', terminar);

// Recebe um traço desenhado pela camada nativa. Cada ponto traz x e y em
// pixels CSS de tela, p de 0 a 1 e t em milissegundos.
function receberTraco(pontos) {
  if (!Array.isArray(pontos) || pontos.length === 0) return null;
  const traco = novoTraco('nativo', false);
  for (const p of pontos) {
    const q = telaParaQuadro(p.x, p.y);
    traco.pontos.push([q.x, q.y, p.p ?? 0.5]);
  }
  desenhar(traco);
  atualizarInfo();
  return traco.id;
}

function limpar() {
  tracos.length = 0;
  elementos.clear();
  pendentes.clear();
  tracoAtual = null;
  mundo.replaceChildren();
  atualizarInfo();
}

function reiniciarVista() {
  Object.assign(vista, { x: 0, y: 0, k: 1 });
  aplicarVista();
}

document.getElementById('limpar').addEventListener('click', limpar);
document.getElementById('reiniciar').addEventListener('click', reiniciarVista);

window.prancheta = Object.freeze({
  receberTraco,
  telaParaQuadro,
  quadroParaTela,
  vista: () => ({ ...vista }),
  tracos: () => tracos.map(({ id, origem, criadoEm, pontos }) => ({ id, origem, criadoEm, pontos: pontos.map((p) => [...p]) })),
  limpar,
  reiniciarVista,
});

aplicarVista();
window.Casca?.pronta();
