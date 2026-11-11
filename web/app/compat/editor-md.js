// Editor de markdown dos cartões, do plano 009: a marcação do GitHub
// aparece formatada enquanto se escreve, com os marcadores visíveis só na
// linha do cursor, e o cartão aceita recuo com Tab e imagens.
//
// O formato gravado não muda: cada cartão continua com blocks [{k, h, d}],
// em que h guarda o markdown literal da linha, e ganha só o campo n, o nível
// de recuo, de 1 a 6. Por isso os cartões antigos, compat/marcacoes.js e um
// aparelho uma versão atrás continuam funcionando; este último mostra a
// marcação nova como texto e perde o recuo se editar o cartão.
//
// Durante a edição, cada linha é um div.b, como no artefato. A cada entrada
// fora de uma composição do teclado, as linhas cuja forma mudou são
// redesenhadas a partir do texto, com os marcadores em span.mk, e o cursor
// volta ao mesmo ponto do texto. Uma linha que não mudou não é tocada, para
// não atrapalhar o teclado do Android nem o do iPad. Como o redesenho
// desfaz a pilha do navegador, o editor tem um desfazer próprio.
//
// As imagens entram como uma linha ![descrição](/_blob/<id>), com o arquivo
// guardado no banco local pelo mesmo caminho das imagens soltas no quadro, e
// por isso sincronizado e cifrado como elas. Só imagens guardadas no aparelho
// são mostradas: um endereço de fora fica como link, sem requisição externa.
//
// As funções do artefato usadas aqui, como colorEl, LINK, KINDS, resolve,
// upload, shrink e toast, são chamadas só depois que ele carrega.

(function () {
  'use strict';

  const MAX_NIVEL = 6;
  const BLOB = /^\/_blob\/[\w-]{8,64}$/;
  const MONO = 'ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace';
  const LISTAS = new Set(['li', 'ol', 'todo']);
  const ALERTAS = { NOTE: ['note', 'Nota'], TIP: ['tip', 'Dica'], IMPORTANT: ['important', 'Importante'], WARNING: ['warning', 'Aviso'], CAUTION: ['caution', 'Cuidado'] };
  const PAUSA_DO_DESFAZER = 1000;
  const LIMITE_DO_DESFAZER = 200;

  const elemento = (tag, classe) => { const e = document.createElement(tag); if (classe) e.className = classe; return e; };
  const escapar = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const nivel = (b) => { const n = Math.floor(Number(b && b.n)); return n > 0 ? Math.min(n, MAX_NIVEL) : 0; };

  // ---------- gramática, a mesma na edição e na exibição ----------

  // Separa "descrição|320" em descrição e largura.
  function descricaoELargura(alt) {
    const m = /^(.*?)\|(\d{2,4})$/.exec(alt);
    return m ? [m[1], Math.min(Number(m[2]), 4000)] : [alt, 0];
  }

  function imagem(m) {
    if (!BLOB.test(m[2])) return null;
    const [descricao, largura] = descricaoELargura(m[1]);
    const img = elemento('img', 'md-img');
    img.src = m[2];
    img.alt = descricao || 'Imagem do cartão';
    img.draggable = false;
    if (largura) img.width = largura;
    return img;
  }

  // Cada regra: a expressão, o elemento, o grupo do conteúdo (g), o tamanho
  // do marcador final (s), raw para não decorar o conteúdo e img para a
  // imagem, que não tem conteúdo. As expressões do artefato, de código,
  // marca, cor, negrito, riscado e itálico com asterisco, ficam iguais; as
  // novas são o escape com barra, a imagem, o negrito com itálico e as
  // variantes com sublinhado, que não valem no meio de uma palavra.
  const INLINE = [
    { re: /\\([!-/:-@[-`{-~])/, mk: () => elemento('span', 'md-esc'), g: 1, s: 0, raw: 1 },
    { re: /`([^`\n]+)`/, mk: () => elemento('code'), g: 1, s: 1, raw: 1 },
    { re: /!\[([^\]\n]*)\]\(([^()\s]+)\)/, mk: imagem, g: 1, s: 0, img: 1 },
    { re: /==(?:\{([a-zà-ú]+)\})?([^=\n]+?)==/, mk: (m) => colorEl('mark', m[1] || 'amarelo', ''), g: 2, s: 2 },
    { re: /\{([a-zà-ú]+)\}([^{}\n]+?)\{\/\}/, mk: (m) => colorEl('span', m[1], ' tc'), g: 2, s: 3 },
    { re: /\*\*\*(?!\s)([^*\n]+?)(?<!\s)\*\*\*/, mk: () => elemento('strong', 'md-bi'), g: 1, s: 3 },
    { re: /\*\*([^*\n]+?)\*\*/, mk: () => elemento('strong'), g: 1, s: 2 },
    { re: /(?<![\p{L}\p{N}_])__(?!\s)([^_\n]+?)(?<!\s)__(?![\p{L}\p{N}_])/u, mk: () => elemento('strong'), g: 1, s: 2 },
    { re: /~~([^~\n]+?)~~/, mk: () => elemento('del'), g: 1, s: 2 },
    { re: /(?<![\w*])\*([^*\s](?:[^*\n]*[^*\s])?)\*(?![\w*])/, mk: () => elemento('em'), g: 1, s: 1 },
    { re: /(?<![\p{L}\p{N}_])_(?![\s_])([^_\n]*?[^_\s])_(?![\p{L}\p{N}_])/u, mk: () => elemento('em'), g: 1, s: 1 },
  ];

  function primeira(texto) {
    let melhor = null;
    for (const r of INLINE) {
      const m = r.re.exec(texto);
      if (m && (!melhor || m.index < melhor.m.index)) melhor = { m, r };
    }
    return melhor;
  }

  // Partes de uma ocorrência: o marcador inicial, o conteúdo e o final.
  function partes(m, r) {
    const tudo = m[0];
    if (r.img) return ['', tudo, ''];
    const c = m[r.g];
    const ini = tudo.length - r.s - c.length;
    return [tudo.slice(0, ini), c, tudo.slice(ini + c.length)];
  }

  // ---------- numeração das listas ----------

  function romano(n) {
    const t = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
    let s = '';
    for (const [v, l] of t) while (n >= v) { s += l; n -= v; }
    return s;
  }
  function letra(n) { let s = ''; while (n > 0) { n--; s = String.fromCharCode(97 + (n % 26)) + s; n = Math.floor(n / 26); } return s; }
  const formatos = [String, romano, letra];

  // Número de cada linha de lista numerada, como no GitHub: algarismos no
  // primeiro nível, romanos no segundo e letras no terceiro. Uma linha de
  // outro tipo encerra as listas do mesmo nível e dos mais fundos.
  function numeros(blocos) {
    const c = [];
    return (blocos || []).map((b) => {
      const n = nivel(b);
      if (b && b.k === 'ol') {
        c.length = n + 1;
        c[n] = (c[n] || 0) + 1;
        return formatos[n % 3](c[n]);
      }
      c.length = Math.min(c.length, n);
      return '';
    });
  }

  // ---------- texto para blocos ----------

  // Converte texto markdown em blocos, como o blocksFromText do artefato,
  // agora com o recuo das listas, a cada dois espaços ou um Tab, e com o
  // marcador "+". Linhas dentro de um bloco de código ficam como estão.
  function blocosCrus(texto) {
    let cerca = false;
    return texto.replace(/\r/g, '').split('\n').map((l) => {
      let m;
      if (/^\s*```/.test(l)) { cerca = !cerca; return { t: l }; }
      if (cerca) return { t: l };
      const recuo = (s) => Math.min(Math.floor(s.replace(/\t/g, '  ').length / 2), MAX_NIVEL);
      if ((m = l.match(/^(\s*)(?:[-*+]\s+)?\[( |x|X)?\]\s+(.*)$/))) return { k: 'todo', t: m[3], n: recuo(m[1]), ...(m[2] && m[2] !== ' ' ? { d: 1 } : {}) };
      if ((m = l.match(/^(\s*)[-*+•]\s+(.*)$/))) return { k: 'li', t: m[2], n: recuo(m[1]) };
      if ((m = l.match(/^(\s*)\d+[.)]\s+(.*)$/))) return { k: 'ol', t: m[2], n: recuo(m[1]) };
      if ((m = l.match(/^(#{1,6})\s+(.*)$/))) return { k: 'h' + m[1].length, t: m[2] };
      if ((m = l.match(/^>\s?(.*)$/))) return { k: 'quote', t: m[1] };
      return { t: l };
    });
  }

  function blocosDoTexto(texto) {
    return blocosCrus(texto).map((b) => {
      const o = { h: escapar(b.t) };
      if (b.k) o.k = b.k;
      if (b.d) o.d = 1;
      if (b.n) o.n = b.n;
      return o;
    }).filter((b, i, a) => b.h !== '' || (i && a[i - 1].h !== ''));
  }

  // O HTML guardado num cartão antigo pode ter negrito, itálico, riscado e
  // código do editor anterior; na edição, eles viram a marcação equivalente.
  function paraTexto(h) {
    const t = document.createElement('template');
    t.innerHTML = clean(h || '');
    const MARCAS = { B: '**', STRONG: '**', I: '*', EM: '*', S: '~~', STRIKE: '~~', DEL: '~~', CODE: '`' };
    const ler = (no) => {
      let s = '';
      for (const c of no.childNodes) {
        if (c.nodeType === 3) s += c.data;
        else if (c.nodeType === 1) {
          if (c.tagName === 'BR') { s += '\n'; continue; }
          const k = MARCAS[c.tagName] || '';
          s += k + ler(c) + k;
        }
      }
      return s;
    };
    return ler(t.content).replace(/ /g, ' ');
  }

  // ---------- texto e cursor dentro de uma linha do editor ----------

  const ehWidget = (no) => no.nodeType === 1 && no.getAttribute('contenteditable') === 'false';

  function textoCru(no) {
    let s = '';
    for (const c of no.childNodes) {
      if (c.nodeType === 3) s += c.data;
      else if (c.nodeType === 1) {
        if (c.tagName === 'BR') s += '\n';
        else if (!ehWidget(c)) s += textoCru(c);
      }
    }
    return s;
  }

  // O texto de uma linha; a quebra final é a que o navegador põe para a
  // linha vazia ou terminada por quebra aparecer, e não conta.
  function textoDe(bloco) {
    const s = textoCru(bloco);
    return s.endsWith('\n') ? s.slice(0, -1) : s;
  }

  function deslocamento(bloco, no, off) {
    const r = document.createRange();
    r.setStart(bloco, 0);
    try { r.setEnd(no, off); } catch { return 0; }
    return textoCru(r.cloneContents()).length;
  }

  function folhas(no, lista = []) {
    for (const c of no.childNodes) {
      if (c.nodeType === 3) lista.push(c);
      else if (c.nodeType === 1) {
        if (c.tagName === 'BR' || ehWidget(c)) lista.push(c);
        else folhas(c, lista);
      }
    }
    return lista;
  }

  // Ponto do DOM para um deslocamento no texto da linha. Entre dois textos,
  // fica no fim do anterior, onde o navegador continua a digitação.
  function ponto(bloco, alvo) {
    let n = 0;
    let depoisDe = null;
    for (const f of folhas(bloco)) {
      if (f.nodeType === 3) {
        if (alvo <= n + f.data.length) return [f, Math.max(0, alvo - n)];
        n += f.data.length;
      } else if (f.tagName === 'BR') {
        if (alvo <= n) return [f.parentNode, [...f.parentNode.childNodes].indexOf(f)];
        n += 1;
        depoisDe = f;
      } else depoisDe = f;
    }
    if (depoisDe) return [depoisDe.parentNode, [...depoisDe.parentNode.childNodes].indexOf(depoisDe) + 1];
    return [bloco, bloco.childNodes.length];
  }

  const linhas = (ed) => [...ed.children];
  function linhaDe(ed, no) {
    if (!no) return null;
    if (no === ed) return null;
    let n = no.nodeType === 1 ? no : no.parentNode;
    while (n && n.parentNode !== ed) n = n.parentNode;
    return n && n.parentNode === ed ? n : null;
  }

  function posicao(ed, no, off) {
    if (no === ed) {
      const ls = linhas(ed);
      if (!ls.length) return { i: 0, o: 0 };
      if (off >= ls.length) return { i: ls.length - 1, o: textoDe(ls[ls.length - 1]).length };
      return { i: off, o: 0 };
    }
    const l = linhaDe(ed, no);
    if (!l) return null;
    return { i: linhas(ed).indexOf(l), o: Math.min(deslocamento(l, no, off), textoDe(l).length) };
  }

  function salvarSelecao(ed) {
    const s = getSelection();
    if (!s || !s.rangeCount || !ed.contains(s.anchorNode)) return null;
    const a = posicao(ed, s.anchorNode, s.anchorOffset);
    const f = posicao(ed, s.focusNode, s.focusOffset);
    return a && f ? { a, f } : null;
  }

  function porPosicao(ed, p) {
    const ls = linhas(ed);
    const l = ls[Math.max(0, Math.min(p.i, ls.length - 1))];
    return l ? ponto(l, p.o) : [ed, 0];
  }

  function reporSelecao(ed, sel) {
    if (!sel) return;
    const s = getSelection();
    const [an, ao] = porPosicao(ed, sel.a);
    const [fn, fo] = porPosicao(ed, sel.f);
    try { s.setBaseAndExtent(an, ao, fn, fo); } catch { /* o editor mudou por baixo */ }
  }

  // ---------- desenho das linhas ----------

  function marcador(pai, s) { if (s) { const e = elemento('span', 'mk'); e.textContent = s; pai.append(e); } }

  function linkEd(texto, pai) {
    LINK.lastIndex = 0;
    let i = 0;
    let m;
    while ((m = LINK.exec(texto))) {
      if (m.index > i) pai.append(texto.slice(i, m.index));
      i = m.index + m[0].length;
      const tudo = m[0];
      if (m[1]) {
        const barra = m[2] != null ? tudo.indexOf('|') + 1 : 2;
        marcador(pai, tudo.slice(0, barra));
        const a = elemento('span', 'lk');
        let existe = true;
        try { existe = !!resolve(m[1]); } catch { /* fora do artefato */ }
        if (!existe) a.classList.add('miss');
        a.textContent = tudo.slice(barra, -2);
        pai.append(a);
        marcador(pai, ']]');
      } else if (m[4]) {
        marcador(pai, '[');
        const a = elemento('span', 'lk');
        a.textContent = m[3];
        pai.append(a);
        marcador(pai, tudo.slice(1 + m[3].length));
      } else {
        const u = m[5].replace(/[.,;:!?)]+$/, '');
        const a = elemento('span', 'lk');
        a.textContent = u;
        pai.append(a);
        if (m[5].length > u.length) pai.append(m[5].slice(u.length));
      }
    }
    if (i < texto.length) pai.append(texto.slice(i));
    LINK.lastIndex = 0;
  }

  // A mesma decoração da exibição, com os marcadores à vista em span.mk.
  function decorarEd(texto, pai) {
    if (!texto) return;
    const melhor = primeira(texto);
    if (!melhor) { linkEd(texto, pai); return; }
    const { m, r } = melhor;
    linkEd(texto.slice(0, m.index), pai);
    const [ini, conteudo, fim] = partes(m, r);
    const e = r.mk(m);
    if (!e) linkEd(m[0], pai);
    else if (r.img) {
      const fonte = elemento('span', 'mk md-fonte');
      fonte.textContent = m[0];
      const w = elemento('span', 'md-imgw');
      w.setAttribute('contenteditable', 'false');
      w.append(e);
      pai.append(fonte, w);
    } else {
      marcador(pai, ini);
      if (r.raw) e.append(conteudo);
      else decorarEd(conteudo, e);
      pai.append(e);
      marcador(pai, fim);
    }
    decorarEd(texto.slice(m.index + m[0].length), pai);
  }

  const COLUNAS = 20;
  const pedacosDaLinha = (texto) => texto.split(/(?<!\\)\|/);
  const ehBorda = (pedacos, i) => (i === 0 || i === pedacos.length - 1) && !pedacos[i].trim();

  // Alinhamento de cada coluna, lido da linha separadora.
  function alinhamentos(texto) {
    const p = pedacosDaLinha(texto);
    return p.filter((_, i) => !ehBorda(p, i)).map((c) => {
      const t = c.trim();
      return t.endsWith(':') ? (t.startsWith(':') ? ' ac' : ' ar') : '';
    });
  }

  function celulas(texto, pai, al) {
    const pedacos = pedacosDaLinha(texto);
    let c = 0;
    pedacos.forEach((x, i) => {
      if (i > 0) { const p = elemento('span', 'mk md-barra'); p.textContent = '|'; pai.append(p); }
      if (ehBorda(pedacos, i)) { if (x) pai.append(x); return; }
      const td = elemento('span', `md-td c${Math.min(c, COLUNAS - 1)}${(al && al[c]) || ''}`);
      c++;
      decorarEd(x, td);
      pai.append(td);
    });
  }

  const CRU = new Set(['code', 'fence', 'tsep', 'hr', 'at']);

  // O conteúdo de uma linha, com as quebras feitas com Shift+Enter como <br>.
  // Uma linha vazia ou terminada por quebra precisa de uma quebra a mais para
  // aparecer, como o navegador faz.
  function conteudo(texto, modo, w) {
    const d = document.createElement('div');
    texto.split('\n').forEach((t, i) => {
      if (i) d.append(elemento('br'));
      if (!t) return;
      if (CRU.has(modo)) d.append(t);
      else if (modo === 'tr' || modo === 'th') celulas(t, d, w);
      else decorarEd(t, d);
    });
    if (!texto || texto.endsWith('\n')) d.append(elemento('br'));
    return d;
  }

  // Classifica as linhas como a exibição do artefato agrupa os blocos:
  // código entre cercas, tabela, régua e alerta.
  function classificar(ls, textos) {
    const modos = ls.map(() => ({ modo: 'inline', g: 0, extra: '' }));
    const ehP = (i) => (ls[i].dataset.k || 'p') === 'p';
    const limpo = (i) => textos[i].trim();
    let grupo = 0;
    for (let i = 0; i < ls.length; i++) {
      const t = limpo(i);
      if (ehP(i) && /^```/.test(t)) {
        const g = ++grupo;
        modos[i] = { modo: 'fence', g, extra: ' ini' };
        let j = i + 1;
        while (j < ls.length && !/^```/.test(limpo(j))) { modos[j] = { modo: 'code', g, extra: '' }; j++; }
        if (j < ls.length) modos[j] = { modo: 'fence', g, extra: ' fim' };
        i = j;
        continue;
      }
      if (ehP(i) && /^(-{3,}|\*{3,}|_{3,})$/.test(t)) { modos[i] = { modo: 'hr', g: 0, extra: '' }; continue; }
      if (ehP(i) && t.startsWith('|') && ls[i + 1] && ehP(i + 1) && /^\|?[\s:|-]*-[\s:|-]*\|?$/.test(limpo(i + 1))) {
        const g = ++grupo;
        modos[i] = { modo: 'th', g, extra: '' };
        modos[i + 1] = { modo: 'tsep', g, extra: '' };
        let j = i + 2;
        while (j < ls.length && ehP(j) && limpo(j).startsWith('|')) { modos[j] = { modo: 'tr', g, extra: '' }; j++; }
        const al = alinhamentos(textos[i + 1]);
        for (let x = i; x < j; x++) modos[x].w = al;
        i = j - 1;
        continue;
      }
      const am = ls[i].dataset.k === 'quote' && t.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]$/i);
      if (am) {
        const [a, nome] = ALERTAS[am[1].toUpperCase()];
        modos[i] = { modo: 'at', g: 0, extra: ` a-${a}`, t: nome };
        let j = i + 1;
        while (j < ls.length && ls[j].dataset.k === 'quote' && !/^\[!/.test(limpo(j))) { modos[j] = { modo: 'inline', g: 0, extra: ` md-ab a-${a}` }; j++; }
        i = j - 1;
      }
    }
    return modos;
  }

  const CLASSE = { code: ' md-code', fence: ' md-fence', th: ' md-tr md-th', tr: ' md-tr', tsep: ' md-tsep', hr: ' md-hr', at: ' md-at' };

  // Redesenha as linhas cuja forma mudou e repõe o cursor. Devolve se algo
  // foi redesenhado.
  function atualizar(ed) {
    if (!ed || ed._compondo) return false;
    const sel = salvarSelecao(ed);
    const ls = linhas(ed);
    const textos = ls.map(textoDe);
    const modos = classificar(ls, textos);
    const nums = numeros(ls.map((l) => ({ k: l.dataset.k, n: Number(l.dataset.n) || 0 })));
    let mudou = false;
    ls.forEach((l, i) => {
      const { modo, g, extra, t, w } = modos[i];
      const classe = 'b' + (CLASSE[modo] || '') + extra;
      if (l.className.replace(/ cur(-g)?/g, '') !== classe) l.className = classe;
      if (g) l.dataset.g = g; else delete l.dataset.g;
      if (nums[i]) l.dataset.num = nums[i]; else delete l.dataset.num;
      if (t) l.dataset.t = t; else delete l.dataset.t;
      const novo = conteudo(textos[i], modo, w);
      if (novo.innerHTML !== l.innerHTML) { l.replaceChildren(...novo.childNodes); mudou = true; }
    });
    if (mudou) reporSelecao(ed, sel);
    medirTabelas(ed, ls, modos);
    marcarAtual(ed);
    return mudou;
  }

  // As linhas de uma tabela são elementos separados; para as colunas
  // ficarem alinhadas, cada coluna recebe a largura do texto mais longo
  // dela, medida com a fonte do cartão, e todas encolhem juntas se faltar
  // espaço.
  let regua = null;
  function medirTabelas(ed, ls, modos) {
    const grupos = new Map();
    ls.forEach((l, i) => {
      const m = modos[i];
      if (m.modo !== 'th' && m.modo !== 'tr') return;
      if (!grupos.has(m.g)) grupos.set(m.g, []);
      grupos.get(m.g).push(l);
    });
    if (!grupos.size) return;
    regua = regua || document.createElement('canvas').getContext('2d');
    const cs = getComputedStyle(ed);
    for (const rows of grupos.values()) {
      const w = [];
      for (const l of rows) {
        regua.font = `${l.classList.contains('md-th') ? 600 : cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        [...l.querySelectorAll(':scope > .md-td')].forEach((td, c) => { w[c] = Math.max(w[c] || 0, regua.measureText(td.textContent).width); });
      }
      for (const l of rows) w.forEach((x, c) => { if (c < COLUNAS) l.style.setProperty(`--c${c}`, `${Math.ceil(x + 28)}px`); });
    }
  }

  // A linha do cursor, e o grupo dela, mostram os marcadores.
  function marcarAtual(ed) {
    const s = getSelection();
    const r = s && s.rangeCount && ed.contains(s.anchorNode) ? s.getRangeAt(0) : null;
    const ls = linhas(ed);
    const grupos = new Set();
    for (const l of ls) {
      const cur = !!r && r.intersectsNode(l);
      if (cur !== l.classList.contains('cur')) l.classList.toggle('cur', cur);
      if (cur && l.dataset.g) grupos.add(l.dataset.g);
    }
    for (const l of ls) {
      const cg = !!l.dataset.g && grupos.has(l.dataset.g);
      if (cg !== l.classList.contains('cur-g')) l.classList.toggle('cur-g', cg);
    }
  }

  function novaLinha(k, n, d, texto) {
    const l = elemento('div', 'b');
    l.dataset.k = KINDS.has(k) ? k : 'p';
    if (d) l.dataset.d = '1';
    if (n) l.dataset.n = String(n);
    l.append(...conteudo(texto || '', 'inline').childNodes);
    return l;
  }

  // ---------- entrada e saída do editor ----------

  function preparar(ed, blocos) {
    const lista = blocos && blocos.length ? blocos : [{ h: '' }];
    ed.replaceChildren(...lista.map((b) => novaLinha(b.k, nivel(b), b.d, paraTexto(b.h))));
    ed._pilha = { desfazer: [], refazer: [], ultimo: null, t: 0 };
    ed._compondo = false;
    atualizar(ed);
  }

  function lerBlocos(ed) {
    return linhas(ed).map((l) => {
      const texto = textoDe(l).replace(/ /g, ' ').replace(/\n+$/, '');
      const o = { h: escapar(texto).replace(/\n/g, '<br>') };
      if (l.dataset.k && l.dataset.k !== 'p') o.k = l.dataset.k;
      if (l.dataset.d === '1') o.d = 1;
      const n = Number(l.dataset.n) || 0;
      if (n > 0) o.n = Math.min(n, MAX_NIVEL);
      return o;
    });
  }

  // ---------- desfazer próprio ----------

  function estado(ed) {
    return {
      linhas: linhas(ed).map((l) => ({ k: l.dataset.k, n: Number(l.dataset.n) || 0, d: l.dataset.d === '1', t: textoDe(l) })),
      sel: salvarSelecao(ed),
    };
  }

  function aplicar(ed, e) {
    ed.replaceChildren(...e.linhas.map((l) => novaLinha(l.k, l.n, l.d, l.t)));
    atualizar(ed);
    reporSelecao(ed, e.sel || { a: { i: 0, o: 0 }, f: { i: 0, o: 0 } });
    marcarAtual(ed);
    depoisDeMudar(ed);
  }

  function guardar(ed, tipo) {
    const p = ed._pilha;
    if (!p) return;
    const agora = Date.now();
    if (tipo === 'digitar' && p.ultimo === 'digitar' && agora - p.t < PAUSA_DO_DESFAZER) { p.t = agora; return; }
    p.desfazer.push(estado(ed));
    if (p.desfazer.length > LIMITE_DO_DESFAZER) p.desfazer.shift();
    p.refazer = [];
    p.ultimo = tipo;
    p.t = agora;
  }

  function desfazer(ed) {
    const p = ed._pilha;
    if (!p || !p.desfazer.length) return false;
    p.refazer.push(estado(ed));
    aplicar(ed, p.desfazer.pop());
    p.ultimo = null;
    return true;
  }

  function refazer(ed) {
    const p = ed._pilha;
    if (!p || !p.refazer.length) return false;
    p.desfazer.push(estado(ed));
    aplicar(ed, p.refazer.pop());
    p.ultimo = null;
    return true;
  }

  function depoisDeMudar(ed) {
    try { markEmpty(ed); persistEdit(); renderSelbar(); } catch { /* fora do artefato */ }
  }

  // ---------- comandos ----------

  function editorAtual() {
    try { return S.editing ? doms.get(S.editing).querySelector('.editor') : null; } catch { return null; }
  }

  // Envolve a seleção, numa linha, com os marcadores; se eles já a envolvem,
  // retira-os.
  function envolver(ed, a, z, selecionar) {
    const sel = salvarSelecao(ed);
    if (!sel || sel.a.i !== sel.f.i) return false;
    const l = linhas(ed)[sel.a.i];
    const t = textoDe(l);
    const s = Math.min(sel.a.o, sel.f.o);
    const f = Math.max(sel.a.o, sel.f.o);
    guardar(ed, 'op');
    let novo;
    let ns;
    let nf;
    if (t.slice(Math.max(0, s - a.length), s) === a && t.slice(f, f + z.length) === z && s >= a.length) {
      novo = t.slice(0, s - a.length) + t.slice(s, f) + t.slice(f + z.length);
      ns = s - a.length; nf = f - a.length;
    } else {
      novo = t.slice(0, s) + a + t.slice(s, f) + z + t.slice(f);
      [ns, nf] = selecionar ? selecionar(s, f) : [s + a.length, f + a.length];
    }
    l.replaceChildren(document.createTextNode(novo));
    atualizar(ed);
    reporSelecao(ed, { a: { i: sel.a.i, o: ns }, f: { i: sel.a.i, o: nf } });
    marcarAtual(ed);
    depoisDeMudar(ed);
    return true;
  }

  function link(ed) {
    return envolver(ed, '[', '](url)', (s, f) => (s === f ? [s + 1, s + 1] : [f + 3, f + 6]));
  }

  function linhasSelecionadas(ed) {
    const s = getSelection();
    if (!s || !s.rangeCount || !ed.contains(s.anchorNode)) return [];
    const r = s.getRangeAt(0);
    return linhas(ed).filter((l) => r.intersectsNode(l));
  }

  // Tab e Shift+Tab: muda o recuo das linhas selecionadas; numa linha de
  // código, põe ou tira dois espaços.
  function recuar(ed, delta) {
    const ls = linhasSelecionadas(ed);
    if (!ls.length) return false;
    if (ls.length === 1 && ls[0].classList.contains('md-code')) {
      guardar(ed, 'op');
      if (delta > 0) document.execCommand('insertText', false, '  ');
      else {
        const sel = salvarSelecao(ed);
        const t = textoDe(ls[0]);
        const tirar = t.match(/^ {1,2}/);
        if (!tirar) return true;
        ls[0].replaceChildren(document.createTextNode(t.slice(tirar[0].length)));
        atualizar(ed);
        const o = (p) => ({ i: p.i, o: Math.max(0, p.o - tirar[0].length) });
        reporSelecao(ed, { a: o(sel.a), f: o(sel.f) });
        depoisDeMudar(ed);
      }
      return true;
    }
    guardar(ed, 'op');
    for (const l of ls) {
      const n = Math.max(0, Math.min(MAX_NIVEL, (Number(l.dataset.n) || 0) + delta));
      if (n) l.dataset.n = String(n); else delete l.dataset.n;
    }
    atualizar(ed);
    depoisDeMudar(ed);
    return true;
  }

  // ---------- imagens ----------

  const entrada = (() => {
    let campo = null;
    let alvo = null;
    return {
      abrir(ed) {
        if (!campo) {
          campo = elemento('input');
          campo.type = 'file';
          campo.accept = 'image/*';
          campo.multiple = true;
          campo.hidden = true;
          campo.addEventListener('change', () => {
            const arquivos = [...campo.files].filter((f) => f.type.startsWith('image/') || !f.type);
            campo.value = '';
            if (arquivos.length && alvo) inserirImagens(alvo.ed, arquivos, alvo.i);
          });
          document.body.appendChild(campo);
        }
        const sel = salvarSelecao(ed);
        alvo = { ed, i: sel ? sel.f.i : linhas(ed).length - 1 };
        campo.click();
      },
    };
  })();

  function nomeDaImagem(arquivo) {
    const n = String((arquivo && arquivo.name) || '').replace(/\.[^.]+$/, '').replace(/[[\]()|\n\\]/g, ' ').replace(/\s+/g, ' ').trim();
    return (n || 'imagem').slice(0, 60);
  }

  async function prepararImagem(arquivo) {
    const url = URL.createObjectURL(arquivo);
    try {
      const img = await loadImg(url);
      const grande = Math.max(img.naturalWidth || 0, img.naturalHeight || 0) > 2400;
      if (!ACCEPT.has(arquivo.type) || arquivo.size > 2 * MB || grande) return await shrink(img, 2400);
      return arquivo;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // Guarda cada imagem e põe a linha dela depois da linha i. Se a edição
  // terminou enquanto a imagem subia, a linha vai para o fim do cartão.
  async function inserirImagens(ed, arquivos, i) {
    if (!S.assets) { toast('O armazenamento de arquivos não está disponível aqui.'); return; }
    const id = S.editing;
    let ref = linhas(ed)[Math.max(0, Math.min(i, linhas(ed).length - 1))] || null;
    for (const arquivo of arquivos) {
      toast('Guardando a imagem…');
      let texto;
      try {
        const blob = await prepararImagem(arquivo);
        texto = `![${nomeDaImagem(arquivo)}](/_blob/${(await upload(blob)).id})`;
      } catch (e) {
        toast((e && UPMSG[e.code]) || 'A imagem não foi guardada. Tente novamente.');
        continue;
      }
      $('#toast').hidden = true;
      if (S.editing === id && ed.isConnected && (!ref || ref.parentNode === ed)) {
        guardar(ed, 'op');
        const nova = novaLinha('p', ref ? Number(ref.dataset.n) || 0 : 0, false, texto);
        if (ref && !textoDe(ref).trim() && (ref.dataset.k || 'p') === 'p') ref.replaceWith(nova);
        else if (ref) ref.after(nova);
        else ed.append(nova);
        ref = nova;
        atualizar(ed);
        const p = linhas(ed).indexOf(nova);
        reporSelecao(ed, { a: { i: p, o: texto.length }, f: { i: p, o: texto.length } });
        marcarAtual(ed);
        depoisDeMudar(ed);
      } else {
        const it = S.items.get(id);
        if (!it) return;
        begin();
        touch(id);
        it.blocks = [...(it.blocks || []), { h: escapar(texto) }];
        esquecerDesenho(id);
        renderCard(it);
        commit();
      }
    }
  }

  function esquecerDesenho(id) { const el = doms.get(id); if (el) el._html = null; }

  // ---------- colar ----------

  function colarLinhas(ed, texto) {
    const s = getSelection();
    if (!s.isCollapsed) document.execCommand('delete');
    const sel = salvarSelecao(ed);
    if (!sel) return;
    const ls = linhas(ed);
    const l = ls[sel.f.i];
    const t = textoDe(l);
    const antes = t.slice(0, sel.f.o);
    const depois = t.slice(sel.f.o);
    const emCodigo = l.classList.contains('md-code');
    const novos = emCodigo ? texto.split('\n').map((x) => ({ t: x })) : blocosCrus(texto);
    const primeiro = novos[0];
    if (!antes && (l.dataset.k || 'p') === 'p' && primeiro.k) {
      l.dataset.k = primeiro.k;
      if (primeiro.n) l.dataset.n = String(primeiro.n);
      if (primeiro.d) l.dataset.d = '1';
    }
    l.replaceChildren(document.createTextNode(antes + primeiro.t));
    let ultimo = l;
    for (const b of novos.slice(1)) {
      const nova = novaLinha(b.k || 'p', b.n || 0, b.d, b.t);
      ultimo.after(nova);
      ultimo = nova;
    }
    const fim = textoDe(ultimo).length;
    ultimo.replaceChildren(document.createTextNode(textoDe(ultimo) + depois));
    atualizar(ed);
    const p = linhas(ed).indexOf(ultimo);
    reporSelecao(ed, { a: { i: p, o: fim }, f: { i: p, o: fim } });
    marcarAtual(ed);
    depoisDeMudar(ed);
  }

  function colarImagens(ed, imagens) {
    const sel = salvarSelecao(ed);
    inserirImagens(ed, imagens, sel ? sel.f.i : linhas(ed).length - 1);
  }

  function colar(e) {
    const ed = e.target.closest('.editor');
    if (!ed) return;
    e.preventDefault();
    e.stopPropagation();
    const cd = e.clipboardData;
    if (!cd) return;
    const texto = cd.getData('text/plain').replace(/\r/g, '');
    const imagens = [...cd.files].filter((f) => f.type.startsWith('image/'));
    if (imagens.length && !texto.trim()) { colarImagens(ed, imagens); return; }
    if (!texto) return;
    guardar(ed, 'op');
    const s = getSelection();
    const escolhido = s.toString();
    if (/^https?:\/\/\S+$/.test(texto.trim()) && escolhido.trim() && !escolhido.includes('\n')) {
      document.execCommand('insertText', false, `[${escolhido}](${texto.trim()})`);
      return;
    }
    if (!texto.includes('\n')) { document.execCommand('insertText', false, texto); return; }
    colarLinhas(ed, texto);
  }

  // Numa linha de tópico, "[ ] " ou "[x] " no início a transforma em tarefa.
  function tarefaDaLista(b) {
    if (!b || b.dataset.k !== 'li') return;
    const fn = b.firstChild;
    const m = fn && fn.nodeType === 3 && fn.data.replace(/\u00a0/g, ' ').match(/^\[( |x|X)?\] /);
    if (!m) return;
    fn.deleteData(0, m[0].length);
    if (!b.textContent) b.innerHTML = '<br>';
    b.dataset.k = 'todo';
    if (m[1] && m[1] !== ' ') b.dataset.d = '1'; else delete b.dataset.d;
    const r = document.createRange();
    r.setStart(b, 0);
    r.collapse(true);
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
  }

  // ---------- teclado, composição e cursor ----------

  const editorDe = (alvo) => (alvo && alvo.closest ? alvo.closest('.editor[contenteditable=true]') : null);

  function noInicio(ed) {
    const s = getSelection();
    if (!s.isCollapsed) return false;
    const p = posicao(ed, s.anchorNode, s.anchorOffset);
    return !!p && p.o === 0;
  }

  function teclas(e) {
    const ed = editorDe(e.target);
    if (!ed || e.isComposing || ed._compondo) return;
    try { if (Pick.open) return; } catch { /* fora do artefato */ }
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const parar = () => { e.preventDefault(); e.stopPropagation(); };
    if (mod && !e.altKey) {
      if (k === 'z') { parar(); if (e.shiftKey) refazer(ed); else desfazer(ed); return; }
      if (k === 'y') { parar(); refazer(ed); return; }
      if (k === 'b') { parar(); envolver(ed, '**', '**'); return; }
      if (k === 'i') { parar(); envolver(ed, '*', '*'); return; }
      if (k === 'e') { parar(); envolver(ed, '`', '`'); return; }
      if (k === 'k') { parar(); link(ed); return; }
      if (k === 'u') { parar(); return; }
    }
    if (k === 'Tab' && !mod && !e.altKey) { parar(); recuar(ed, e.shiftKey ? -1 : 1); return; }
    const l = linhaDe(ed, getSelection().anchorNode);
    if (!l || mod) return;
    const n = Number(l.dataset.n) || 0;
    if (k === 'Enter' && !e.shiftKey && n > 0 && LISTAS.has(l.dataset.k) && !textoDe(l)) {
      parar();
      guardar(ed, 'op');
      if (n > 1) l.dataset.n = String(n - 1); else delete l.dataset.n;
      atualizar(ed);
      depoisDeMudar(ed);
      return;
    }
    if (k === 'Backspace' && n > 0 && noInicio(ed)) {
      parar();
      guardar(ed, 'op');
      if (n > 1) l.dataset.n = String(n - 1); else delete l.dataset.n;
      atualizar(ed);
      depoisDeMudar(ed);
    }
  }

  function antesDaEntrada(e) {
    const ed = editorDe(e.target);
    if (!ed) return;
    if (e.inputType === 'historyUndo') { e.preventDefault(); desfazer(ed); return; }
    if (e.inputType === 'historyRedo') { e.preventDefault(); refazer(ed); return; }
    const t = e.inputType || '';
    guardar(ed, /^insert(Text|CompositionText|ReplacementText)$/.test(t) ? 'digitar' : t.startsWith('delete') ? 'apagar' : 'outro');
  }

  function aoDigitar(ed, e) {
    if (!ed || (e && e.isComposing) || ed._compondo) return;
    atualizar(ed);
  }

  function soltar(e) {
    const ed = editorDe(e.target);
    if (!ed || !e.dataTransfer) return;
    const arquivos = [...e.dataTransfer.files];
    if (!arquivos.length || !arquivos.every((f) => f.type.startsWith('image/'))) return;
    e.preventDefault();
    e.stopPropagation();
    let r = null;
    if (document.caretRangeFromPoint) r = document.caretRangeFromPoint(e.clientX, e.clientY);
    const l = r && linhaDe(ed, r.startContainer);
    inserirImagens(ed, arquivos, l ? linhas(ed).indexOf(l) : linhas(ed).length - 1);
  }

  function comando(nome) {
    const ed = editorAtual();
    if (!ed) return;
    if (nome === 'bold') envolver(ed, '**', '**');
    else if (nome === 'italic') envolver(ed, '*', '*');
    else if (nome === 'strikeThrough') envolver(ed, '~~', '~~');
    else if (nome === 'code') envolver(ed, '`', '`');
    else if (nome === 'link') link(ed);
    else if (nome === 'indent') recuar(ed, 1);
    else if (nome === 'outdent') recuar(ed, -1);
    else if (nome === 'image') entrada.abrir(ed);
  }

  // ---------- estilo ----------

  const recuos = Array.from({ length: MAX_NIVEL }, (_, i) => `.md .b[data-n="${i + 1}"]{margin-left:${2 * (i + 1)}em}`).join('\n');
  const ED = '.editor[contenteditable=true]';
  const colunas = Array.from({ length: 20 }, (_, c) => `${ED} .b.md-tr:not(.cur-g) .md-td.c${c}{flex:0 1 var(--c${c},auto)}`).join('\n');
  const ESTILO = `${recuos}
.md .b[data-k=li][data-n="1"]::before,.md .b[data-k=li][data-n="4"]::before{background:none;border:1px solid var(--fg);width:4px;height:4px}
.md .b[data-k=li][data-n="2"]::before,.md .b[data-k=li][data-n="5"]::before{border-radius:0}
.md .b[data-k=ol][data-num]::before{content:attr(data-num) "."}
.md img.md-img{max-width:100%;height:auto;vertical-align:bottom;border-radius:4px}
.md .md-bi{font-style:italic}
.md .md-imgw{display:block;max-width:100%;user-select:none;-webkit-user-select:none}
${ED} .mk{color:var(--mdmuted)}
${ED} .b:not(.cur):not(.cur-g) .mk{font-size:0}
${ED} .b.md-code,${ED} .b.md-fence{font-family:${MONO};font-size:85%;background:var(--mdpre);padding:0 16px;white-space:pre-wrap;line-height:1.45}
${ED} .b.md-fence{color:var(--mdmuted)}
${ED} .b.md-fence.ini{border-radius:6px 6px 0 0;padding-top:8px}
${ED} .b.md-fence.fim{border-radius:0 0 6px 6px;padding-bottom:8px}
${ED} .b.md-code,${ED} .b.md-fence:not(.ini),${ED} .b.md-tr:not(.md-th),${ED} .b.md-tsep{margin-top:0}
${ED} .b.md-tr:not(.cur-g){display:flex}
${ED} .b.md-th:not(.cur-g){font-weight:600}
${ED} .b.md-th:not(.cur-g) .md-td{border-top:1px solid var(--mdline)}
${ED} .b.md-tr:not(.cur-g) .md-td.c0{border-left:1px solid var(--mdline)}
${colunas}
${ED} .b.md-tr:not(.cur-g) .md-td.ar{text-align:right}
${ED} .b.md-tr:not(.cur-g) .md-td.ac{text-align:center}
${ED} .b.md-tr:not(.cur-g) .md-td{min-width:0;padding:6px 13px;border-right:1px solid var(--mdline);border-bottom:1px solid var(--mdline)}
${ED} .b.md-tsep:not(.cur-g){display:none}
${ED} .b.md-tr.cur-g,${ED} .b.md-tsep.cur-g{font-family:${MONO};font-size:85%}
${ED} .b.md-hr:not(.cur){font-size:0;min-height:0;height:4px;background:var(--mdline);margin:16px 0}
${ED} .b:not(.cur) .md-fonte{display:none}
${ED} .b.md-at,${ED} .b.md-ab{border-left-color:var(--ac)}
${ED} .b.md-at{color:var(--ac);font-weight:500}
${ED} .b.md-at:not(.cur){font-size:0}
${ED} .b.md-at:not(.cur)::after{content:attr(data-t);font-size:14px}
${ED} .b.md-ab{color:var(--fg)}`;

  // Ícones dos botões novos da barra de edição, no mesmo traço dos outros.
  const ICONES = {
    indent: '<path d="M4 6h16M11 12h9M4 18h16M4 9l3 3-3 3"/>',
    outdent: '<path d="M4 6h16M11 12h9M4 18h16M7 9l-3 3 3 3"/>',
    code: '<path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>',
  };

  // Botões da barra de seleção durante a edição.
  function botoes() {
    const b = (cmd, ic, titulo) => `<button class="btn" data-cmd="${cmd}" title="${titulo}" aria-label="${titulo}">${ic}</button>`;
    const ic = (n) => icon(n);
    return '<span class="sep"></span>' +
      b('bold', '<b>N</b>', 'Negrito (Ctrl+B)') + b('italic', '<i>I</i>', 'Itálico (Ctrl+I)') + b('strikeThrough', '<s>R</s>', 'Riscado') +
      b('code', ic('code'), 'Código (Ctrl+E)') + b('link', ic('link'), 'Link (Ctrl+K)') +
      '<span class="sep"></span>' +
      b('outdent', ic('outdent'), 'Diminuir recuo (Shift+Tab)') + b('indent', ic('indent'), 'Aumentar recuo (Tab)') + b('image', ic('image'), 'Imagem no cartão');
  }

  function iniciar() {
    const estilo = elemento('style');
    estilo.id = 'estilo-do-editor-md';
    estilo.textContent = ESTILO;
    document.body.appendChild(estilo);
    try { Object.assign(I, ICONES); } catch { /* fora do artefato */ }
    document.addEventListener('keydown', teclas, true);
    document.addEventListener('beforeinput', antesDaEntrada, true);
    document.addEventListener('drop', soltar, true);
    document.addEventListener('compositionstart', (e) => { const ed = editorDe(e.target); if (ed) ed._compondo = true; }, true);
    document.addEventListener('compositionend', (e) => {
      const ed = editorDe(e.target);
      if (!ed) return;
      ed._compondo = false;
      setTimeout(() => { if (!ed._compondo && ed.isConnected) atualizar(ed); }, 0);
    }, true);
    document.addEventListener('selectionchange', () => { const ed = editorAtual(); if (ed && ed.isContentEditable) marcarAtual(ed); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();

  window.EditorMd = {
    INLINE, partes, numeros, nivel, blocosDoTexto, paraTexto, preparar, lerBlocos, atualizar, aoDigitar, colar, colarImagens, comando, botoes,
    desfazer, refazer, guardar, tarefaDaLista, textoDe, ESTILO,
  };
})();
