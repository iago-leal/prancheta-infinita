// Desenho dos traços feitos no Boox. Para cada traço da caneta, a casca
// Android calcula, com o motor de canetas da Onyx, a espessura de cada ponto,
// a mesma do traço provisório que a camada da Onyx mostra enquanto se
// escreve. A Prancheta guarda esses pontos no campo nf do traço e os desenha
// por esta função, para que o traço definitivo tenha a mesma forma.
//
// Carregado em toda parte, e não só na casca, para que um quadro feito no
// Boox apareça igual no navegador do computador.

(function (global) {
  'use strict';

  const arredondar = (n) => Math.round(n * 100) / 100;

  // Junta pontos repetidos, que não têm direção, guardando a maior espessura.
  function semRepetidos(p) {
    const q = [];
    for (let i = 0; i + 2 < p.length; i += 3) {
      const k = q.length;
      if (k && Math.hypot(p[i] - q[k - 3], p[i + 1] - q[k - 2]) < 0.01) {
        q[k - 1] = Math.max(q[k - 1], p[i + 2]);
        continue;
      }
      q.push(p[i], p[i + 1], p[i + 2]);
    }
    return q;
  }

  function circulo(x, y, r) {
    const a = arredondar(x - r);
    const b = arredondar(x + r);
    const yy = arredondar(y);
    const rr = arredondar(r);
    return `M${a} ${yy}A${rr} ${rr} 0 1 0 ${b} ${yy}A${rr} ${rr} 0 1 0 ${a} ${yy}Z`;
  }

  // Recebe [x, y, espessura, ...] em coordenadas do quadro e devolve o
  // contorno do traço como caminho SVG preenchido, com as pontas arredondadas.
  function contornoOnyx(pontos) {
    const p = semRepetidos(pontos || []);
    const n = p.length / 3;
    if (n === 0) return '';
    if (n === 1) return circulo(p[0], p[1], Math.max(p[2], 0.1) / 2);
    const esquerda = [];
    const direita = [];
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1);
      const b = Math.min(n - 1, i + 1);
      let tx = p[b * 3] - p[a * 3];
      let ty = p[b * 3 + 1] - p[a * 3 + 1];
      const m = Math.hypot(tx, ty) || 1;
      tx /= m;
      ty /= m;
      const r = Math.max(p[i * 3 + 2], 0.1) / 2;
      esquerda.push([p[i * 3] - ty * r, p[i * 3 + 1] + tx * r]);
      direita.push([p[i * 3] + ty * r, p[i * 3 + 1] - tx * r]);
    }
    const lado = (pts) => {
      let d = '';
      for (let i = 1; i < pts.length - 1; i++) {
        const [x, y] = pts[i];
        const [u, v] = pts[i + 1];
        d += `Q${arredondar(x)} ${arredondar(y)} ${arredondar((x + u) / 2)} ${arredondar((y + v) / 2)}`;
      }
      const [ex, ey] = pts[pts.length - 1];
      return `${d}L${arredondar(ex)} ${arredondar(ey)}`;
    };
    const volta = direita.slice().reverse();
    const rFim = arredondar(Math.max(p[(n - 1) * 3 + 2], 0.1) / 2);
    const rInicio = arredondar(Math.max(p[2], 0.1) / 2);
    return `M${arredondar(esquerda[0][0])} ${arredondar(esquerda[0][1])}${lado(esquerda)}`
      + `A${rFim} ${rFim} 0 0 0 ${arredondar(volta[0][0])} ${arredondar(volta[0][1])}${lado(volta)}`
      + `A${rInicio} ${rInicio} 0 0 0 ${arredondar(esquerda[0][0])} ${arredondar(esquerda[0][1])}Z`;
  }

  global.contornoOnyx = contornoOnyx;
})(typeof window !== 'undefined' ? window : globalThis);
