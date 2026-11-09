// Mudanças no código original do artefato, web/index.html, para formar a
// Prancheta independente em web/app/index.html. Esta lista é a única fonte
// dessas mudanças: o montador, em montar.cjs, aplica cada uma ao original, e
// os testes conferem que web/app/index.html é exatamente o resultado.
//
// Cada mudança troca um trecho que aparece uma única vez no original.

module.exports = [
  {
    motivo: 'A fonte Inter passa a ser entregue junto com a página, em fontes/, em vez de vir do Google Fonts, para que a página funcione sem internet e não faça requisições a servidores externos.',
    de: `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,400..700;1,14..32,400..700&display=swap">`,
    para: `<link rel="stylesheet" href="fontes/inter.css">`,
  },
  {
    motivo: 'O banco local e o cliente de compatibilidade são carregados antes de todo o código do artefato, para que window.claude.use(nome) já exista quando ele procurar os recursos; vêm junto a sincronização com o servidor, a combinação item a item e a cifra ponta a ponta que ela usa, a biblioteca de livros e o leitor deles, o adaptador da casca Android, que não faz nada fora dela, e o desenho dos traços feitos no Boox.',
    de: `<title>Prancheta Infinita</title>`,
    para: `<title>Prancheta Infinita</title>
<script src="compat/banco-local.js"></script>
<script src="compat/combinar.js"></script>
<script src="compat/cifra.js"></script>
<script src="compat/sincronizacao.js"></script>
<script src="compat/biblioteca.js"></script>
<script src="compat/leitor.js"></script>
<script src="compat/claude.js"></script>
<script src="compat/casca.js"></script>
<script src="compat/traco-onyx.js"></script>`,
  },
  {
    motivo: 'O aviso de falha na inicialização oferecia restaurar uma versão anterior pela autopublicação do claude.ai, que não existe fora dele; o botão passa a recarregar a página, e os quadros continuam a salvo no banco local.',
    de: `b.textContent='Restaurar versão anterior';`,
    para: `b.textContent='Recarregar';`,
  },
  {
    motivo: 'Mesma razão da mudança anterior: o clique recarrega a página em vez de chamar a restauração pela autopublicação.',
    de: `b.onclick=function(){b.disabled=true;t.textContent='Restaurando…';window.__restore().catch(function(){t.textContent='Não há cópia para restaurar. Peça ao Claude na conversa original.'})};`,
    para: `b.onclick=function(){b.disabled=true;location.reload()};`,
  },
  {
    motivo: 'A perfect-freehand, que desenha os traços, passa a ser entregue junto com a página, em vendor/, em vez de vir do jsDelivr; é a mesma versão 1.2.2.',
    de: `import('https://cdn.jsdelivr.net/npm/perfect-freehand@1.2.2/dist/esm/index.mjs')`,
    para: `import('./vendor/perfect-freehand/index.js')`,
  },
  {
    motivo: 'O pdf.js e o mammoth, que mostram a prévia de PDFs e de documentos do Word, passam a ser entregues junto com a página, em vendor/, em vez de virem do cdnjs; são as mesmas versões 3.11.174 e 1.6.0.',
    de: `const PDFJS='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/',MAMMOTH='https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';`,
    para: `const PDFJS='vendor/pdfjs/',MAMMOTH='vendor/mammoth/mammoth.browser.min.js';`,
  },
  {
    motivo: 'Sem os conectores, cada arquivo enviado ganhava a marca "não foi ao Drive" e uma ação "Enviar ao Drive" que não pode funcionar; sem conectores, a cópia para o Drive simplesmente não é tentada, e o cartão mostra só o tamanho do arquivo.',
    de: `if(!M.mcp){setDrive(it,{ds:'falhou'});return false}`,
    para: `if(!M.mcp)return false;`,
  },
  {
    motivo: 'Cada traço passa a guardar o horário de início, em milissegundos desde 1970, e a duração, para permitir agrupamento e transcrição no futuro, como prevê a decisão sobre os traços. Aqui, o traço feito na página registra esses dados ao terminar.',
    de: `S.pend.push({tool:a.tool,c:a.cfg.c,w:a.cfg.w,sim:a.sim,p:a.p,k:S.view.k})`,
    para: `S.pend.push({tool:a.tool,c:a.cfg.c,w:a.cfg.w,sim:a.sim,p:a.p,k:S.view.k,em:Math.round(performance.timeOrigin+a.stat.t0),dur:Math.round(performance.now()-a.stat.t0)})`,
  },
  {
    motivo: 'Continuação da mudança anterior: ao entrar no quadro, o traço leva o horário e a duração, venha da página ou da casca Android. O traço da casca leva também, no campo nf, os pontos com a espessura que o motor de canetas da Onyx calculou, para ser desenhado com a mesma forma do traço provisório.',
    de: `add({type:'stroke',tool:q.tool,c:q.c,w:q.w,ox:0,oy:0,v:2,sl:0,...(q.sim?{sim:1}:{}),d:encode(p)})`,
    para: `add({type:'stroke',tool:q.tool,c:q.c,w:q.w,ox:0,oy:0,v:2,sl:0,...(q.sim?{sim:1}:{}),...(q.em?{em:q.em,dur:q.dur}:{}),...(q.nf?{nf:encode(q.nf)}:{}),d:encode(p)})`,
  },
  {
    motivo: 'Um traço com o campo nf, feito no Boox, é desenhado com as espessuras calculadas pela Onyx, por contornoOnyx, de compat/traco-onyx.js; assim, o traço definitivo tem a mesma forma do provisório, e nada muda quando a tela e-ink se atualiza. Os demais traços continuam desenhados pela perfect-freehand.',
    de: `function inkD(it){`,
    para: `function inkD(it){if(it.nf&&window.contornoOnyx){const d=contornoOnyx(decode(it.nf));if(d)return d}`,
  },
  {
    motivo: 'No Boox, a mão apoiada para escrever é lida como dois ou três dedos e, num contato rápido, desfazia ou refazia a última ação. Desfazer e refazer pelos dedos passam a exigir dois toques seguidos, com 2 ou 3 dedos, o segundo começado até 500 ms depois do fim do primeiro. Aqui, cada toque válido é guardado, e só o segundo age; quatro ou mais dedos contam como três, e, se um dos toques perdeu um dedo, vale o maior número de dedos dos dois. Sem nada a desfazer ou refazer, um aviso diz isso, para que se saiba que o gesto foi reconhecido.',
    de: `if(g.n===2){if(S.undo.length||S.pend.length){undo();flash('Desfeito')}}else if(g.n===3){if(S.redo.length){redo();flash('Refeito')}}`,
    para: `const n=Math.min(g.n,3),l=S.gTap;if(!l||g.t-l.fim>500){S.gTap={n,fim:now};return}S.gTap=null;
  if(Math.max(n,l.n)===2){if(S.undo.length||S.pend.length){undo();flash('Desfeito')}else flash('Nada a desfazer')}else if(S.redo.length){redo();flash('Refeito')}else flash('Nada a refazer')`,
  },
  {
    motivo: 'Continuação da mudança anterior: a ajuda dos atalhos descreve o novo gesto, que vale em qualquer tela de toque.',
    de: `<dt>Desfazer, refazer no iPad</dt><dd>toque com 2 ou 3 dedos</dd>`,
    para: `<dt>Desfazer, refazer no tablet</dt><dd>dois toques seguidos com 2 ou 3 dedos</dd>`,
  },
  {
    motivo: 'Um gesto de dedos cancelado não deve deixar efeito. A casca Android cancela o gesto quando a caneta se aproxima, porque ele costuma ser a mão apoiada; o navegador também cancela toques que assume para si. Aqui, cada gesto guarda a vista em que começou.',
    de: `function gestureDown(e){if(!S.g)S.g={t:performance.now(),n:0,moved:false,live:false,p:new Map()};`,
    para: `function gestureDown(e){if(!S.g)S.g={t:performance.now(),n:0,moved:false,live:false,p:new Map(),v:{x:S.view.x,y:S.view.y,k:S.view.k}};`,
  },
  {
    motivo: 'Continuação da mudança anterior: quando um toque é cancelado, a vista volta à posição e ao zoom do início do gesto, e um item arrastado pelo dedo volta ao lugar, sem deixar o arrasto no histórico. O gesto cancelado não conta como toque para desfazer, mas um toque de três ou mais dedos, curto e parado, ainda conta para refazer: o sistema do Boox pode cancelar os toques de três dedos, por causa do gesto de captura de tela, e a mão apoiada dificilmente faz dois toques assim seguidos.',
    de: `function onCancelPtr(e){if(e.pointerType==='touch')diagTouch('cancelado',e);S.ptrs.delete(e.pointerId);if(e.pointerType==='touch')gestureUp();if(S.pinch&&[...S.ptrs.values()].filter(p=>p.type==='touch').length<2)S.pinch=null;if(S.act&&S.act.pid===e.pointerId)cancelAct()}`,
    para: `function onCancelPtr(e){if(e.pointerType==='touch'){diagTouch('cancelado',e);const g=S.g;if(g&&!g.cancel){g.cancel=true;if(g.n<3||g.moved||performance.now()-g.t>650){S.gTap=null;g.moved=true}const v=S.view,o=g.v;if(o&&(v.x!==o.x||v.y!==o.y||v.k!==o.k)){v.x=o.x;v.y=o.y;v.k=o.k;applyView()}}}S.ptrs.delete(e.pointerId);if(e.pointerType==='touch')gestureUp();if(S.pinch&&[...S.ptrs.values()].filter(p=>p.type==='touch').length<2)S.pinch=null;if(S.act&&S.act.pid===e.pointerId){const a=S.act,u=S.undo.length;cancelAct();if(a.touch&&S.undo.length>u){undo();S.redo.pop();refreshHist()}}}`,
  },
  {
    motivo: 'Na casca Android, a barra de ferramentas e o zoom ficam no alto da tela, longe da mão que escreve; um menu que abria para cima, como o do zoom, passa a abrir para baixo quando não há espaço acima do botão.',
    de: `menu.style.top=(up?r.top-h-8:r.bottom+8)+'px';`,
    para: `menu.style.top=(up&&r.top-h-8>=8?r.top-h-8:r.bottom+8)+'px';`,
  },
  {
    motivo: 'Continuação das mudanças do toque duplo: um toque de três ou mais dedos pode durar até 650 ms, em vez de 450, porque três dedos demoram mais para pousar e sair da tela juntos.',
    de: `if(g.moved||now-g.t>450||g.n<2||now-(S.penUp||0)<500||S.ro)return;`,
    para: `if(g.moved||now-g.t>(g.n>2?650:450)||g.n<2||now-(S.penUp||0)<500||S.ro)return;`,
  },
  {
    motivo: 'Continuação da mudança anterior: num toque de três ou mais dedos, cada dedo pode se deslocar até 28 px, em vez de 16, antes de o gesto contar como movimento.',
    de: `if(o&&Math.hypot(e.clientX-o[0],e.clientY-o[1])>16)S.g.moved=true`,
    para: `if(o&&Math.hypot(e.clientX-o[0],e.clientY-o[1])>(S.g.n>2?28:16))S.g.moved=true`,
  },
  {
    motivo: 'Com o diagnóstico ligado, cada gesto de dedos aparece num aviso ao terminar, com o número de dedos, a duração e se houve movimento ou cancelamento, e cada toque descartado como palma também; a casca Android avisa também os toques que ela mesma descarta, com o motivo. Assim, o autor vê no Boox por que um gesto não funcionou.',
    de: `function diagTouch(k,e,x){diagTs.push([k,Math.round(e.width||0),Math.round(e.height||0),S.tool,S.penSeen?1:0,S.act?S.act.kind:'',x||0]);if(diagTs.length>40)diagTs.shift();diagSave()}`,
    para: `function diagTouch(k,e,x){diagTs.push([k,Math.round(e.width||0),Math.round(e.height||0),S.tool,S.penSeen?1:0,S.act?S.act.kind:'',x||0]);if(diagTs.length>40)diagTs.shift();diagSave();if(!S.diag||k==='toque')return;if(k==='cancelado'){S.diagCancel=true;return}if(k==='palma'){flash('Toque descartado como palma');return}const c=S.diagCancel;S.diagCancel=false;flash(\`Toque de \${e.width} dedo\${e.width>1?'s':''}, \${Math.round(e.height)} ms\${c?', cancelado':x?', com movimento':''}\`)}`,
  },
  {
    motivo: 'Continuação da mudança anterior: o item do menu passa a dizer que o diagnóstico mostra também os toques.',
    de: `[S.diag?'Desligar diagnóstico do traço':'Ligar diagnóstico do traço','',()=>{S.diag=!S.diag;toast(S.diag?'Faça um traço longo para ver a medição.':'Diagnóstico desligado.')}]`,
    para: `[S.diag?'Desligar diagnóstico do traço e dos toques':'Ligar diagnóstico do traço e dos toques','',()=>{S.diag=!S.diag;toast(S.diag?'Faça um traço longo ou um gesto de dedos para ver a medição.':'Diagnóstico desligado.')}]`,
  },
  {
    motivo: 'A barra de ferramentas fica mais enxuta, sobretudo no Boox: um só botão de formas toma o lugar do retângulo, da elipse, do losango, da linha e do símbolo, e abre um painel com tudo o que há dentro; ao lado da seleção entra a ferramenta de laço. O botão de formas mostra o ícone da última forma escolhida.',
    de: `const TOOLS=[['select','Selecionar (V)'],['hand','Mover o quadro (H)'],'|',['text','Cartão de texto (T)'],['rect','Retângulo (R)'],['ellipse','Elipse (O)'],['diamond','Losango (D)'],['line','Linha (L)'],['symbol','Símbolo (S)'],['frame','Grupo (G)'],['image','Imagem (I)'],['file','Arquivo (F)'],'|',['pen','Caneta (P)'],['hl','Marca-texto (M)'],['eraser','Borracha (E)']];`,
    para: `I.shapes=I.rect;I.lasso='<path d="M7 22a5 5 0 0 1-2-4"/><path d="M3.3 14A6.8 6.8 0 0 1 2 10c0-4.4 4.5-8 10-8s10 3.6 10 8-4.5 8-10 8a12 12 0 0 1-5-1"/><circle cx="5" cy="16" r="2"/>';
const FORMAS_DA_BARRA=['rect','ellipse','diamond','line'],NOMES_DAS_FORMAS={rect:'Retângulo (R)',ellipse:'Elipse (O)',diamond:'Losango (D)',line:'Linha (L)'};
const TOOLS=[['select','Selecionar (V)'],['lasso','Laço (A)'],['hand','Mover o quadro (H)'],'|',['text','Cartão de texto (T)'],['shapes','Formas e símbolos (R, O, D, L, S)'],['frame','Grupo (G)'],['image','Imagem (I)'],['file','Arquivo (F)'],'|',['pen','Caneta (P)'],['hl','Marca-texto (M)'],['eraser','Borracha (E)']];`,
  },
  {
    motivo: 'Continuação da mudança anterior: tocar no botão de formas abre o painel delas.',
    de: `if(b.dataset.t==='symbol'){symbolMenu(b);return}`,
    para: `if(b.dataset.t==='shapes'){shapesPanel(b);return}`,
  },
  {
    motivo: 'Continuação das mudanças anteriores: o painel de formas mostra à vista as quatro formas e os sete símbolos elétricos, num menu que abre para cima com a barra embaixo e para baixo com a barra no alto; escolher uma forma a deixa ativa, e escolher um símbolo o insere no centro da tela, como o antigo menu de símbolos, que passa a abrir o painel. Vêm junto as funções do laço: entra na seleção o traço com a maioria dos pontos dentro do laço e o item com o centro dentro dele.',
    de: `function symbolMenu(b){if(S.ro)return;openMenu(b,Object.keys(SYMS).map(k=>[SYMS[k].t,'',()=>{const c=toWorld(visC(),innerHeight/2),[W,H]=SYMS[k].vb;begin();const it=add({type:'card',v:'symbol',sym:k,x:Math.round(c.x-W/2),y:Math.round(c.y-H/2),w:W,h:H,blocks:[{h:''}],c:'none'});commit();setTool('select');select([it.id])}]),true)}`,
    para: `function insertSymbol(k){const c=toWorld(visC(),innerHeight/2),[W,H]=SYMS[k].vb;begin();const it=add({type:'card',v:'symbol',sym:k,x:Math.round(c.x-W/2),y:Math.round(c.y-H/2),w:W,h:H,blocks:[{h:''}],c:'none'});commit();setTool('select');select([it.id])}
function symbolMenu(b){if(S.ro)return;shapesPanel(b)}
function shapesPanel(b){if(S.ro||!b)return;const open=!menu.hidden&&menu._a===b;closePops();if(open)return;menu._a=b;
  const forma=f=>\`<button class="btn" data-forma="\${f}" title="\${NOMES_DAS_FORMAS[f]}" aria-label="\${NOMES_DAS_FORMAS[f]}" aria-pressed="\${S.tool===f}">\${icon(f)}</button>\`;
  const simbolo=k=>{const q=SYMS[k],[W,H]=q.vb,m=Math.max(W,H);return \`<button class="btn" data-sym="\${k}" title="\${q.t}" aria-label="\${q.t}"><svg class="i" viewBox="\${-(m-W)/2-2} \${-(m-H)/2-2} \${m+4} \${m+4}" style="stroke-width:\${(m/18*1.4).toFixed(2)}">\${q.svg}</svg></button>\`};
  menu.innerHTML=\`<div class="formas" role="group" aria-label="Formas">\${FORMAS_DA_BARRA.map(forma).join('')}</div><hr><div class="formas" role="group" aria-label="Símbolos elétricos">\${Object.keys(SYMS).map(simbolo).join('')}</div>\`;
  menu.onclick=e=>{const f=e.target.closest('[data-forma]'),s=e.target.closest('[data-sym]');if(!f&&!s)return;closePops();if(f)setTool(f.dataset.forma);else insertSymbol(s.dataset.sym)};
  menu.hidden=false;const r=b.getBoundingClientRect(),w=menu.offsetWidth,h=menu.offsetHeight;menu.style.left=clamp(r.left+r.width/2-w/2,8,innerWidth-w-8)+'px';menu.style.top=(r.top>innerHeight/2&&r.top-h-8>=8?r.top-h-8:r.bottom+8)+'px';
}
function inSelBox(w){let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const it of selOf()){const r=rectOf(it);if(!r)continue;x0=Math.min(x0,r.x);y0=Math.min(y0,r.y);x1=Math.max(x1,r.x+r.w);y1=Math.max(y1,r.y+r.h)}const m=8/S.view.k;return w.x>=x0-m&&w.x<=x1+m&&w.y>=y0-m&&w.y<=y1+m}
function lassoSelect(p,base){const ids=new Set(base||[]);if(p.length>=6){const dentro=(x,y)=>{let c=false;for(let i=0,j=p.length-2;i<p.length;j=i,i+=2){const xi=p[i],yi=p[i+1],xj=p[j],yj=p[j+1];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c}return c};
  for(const it of S.items.values()){if(it.type==='edge'&&!hasFree(it))continue;if(it.type==='stroke'){const q=decode(it.d);let n=0,m=0;for(let i=0;i+1<q.length;i+=3){m++;if(dentro(q[i]+it.ox,q[i+1]+it.oy))n++}if(m&&n*2>m)ids.add(it.id);continue}const r=rectOf(it);if(r&&dentro(r.x+r.w/2,r.y+r.h/2))ids.add(it.id)}}
  select([...ids])}`,
  },
  {
    motivo: 'Continuação das mudanças anteriores: a forma escolhida no painel deixa o botão de formas ligado e com o ícone dela.',
    de: `document.querySelectorAll('#tools [data-t]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.t===t));`,
    para: `document.querySelectorAll('#tools [data-t]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.t===t||b.dataset.t==='shapes'&&FORMAS_DA_BARRA.includes(t)));if(FORMAS_DA_BARRA.includes(t)){const b=$('#t-shapes');if(b)b.innerHTML=icon(t)}`,
  },
  {
    motivo: 'Continuação das mudanças anteriores: a tecla S abre o painel de formas, onde estão os símbolos, e a tecla A escolhe o laço; R, O, D e L continuam escolhendo as formas.',
    de: `if(k==='s'){if(!S.ro)symbolMenu($('#t-symbol'));return}`,
    para: `if(k==='s'){if(!S.ro)shapesPanel($('#t-shapes'));return}`,
  },
  {
    motivo: 'Continuação da mudança anterior: a tecla A escolhe o laço.',
    de: `const map={v:'select',h:'hand',t:'text',r:'rect',o:'ellipse',d:'diamond',l:'line',g:'frame',p:'pen',m:'hl',e:'eraser'};`,
    para: `const map={v:'select',a:'lasso',h:'hand',t:'text',r:'rect',o:'ellipse',d:'diamond',l:'line',g:'frame',p:'pen',m:'hl',e:'eraser'};`,
  },
  {
    motivo: 'Com o laço, a caneta, o mouse ou um dedo desenham uma linha livre sobre o quadro; tocar dentro da seleção já feita a arrasta, como na seleção comum, para que no Boox a própria caneta circule e mova os itens. Com Shift, o laço soma à seleção.',
    de: `  if(S.tool==='line'){const from=e.altKey?null:snapAt(e,w,null),el=mkEdgeEl();`,
    para: `  if(S.tool==='lasso'){if(S.sel.size&&inSelBox(w)){startMove(e,w,[...S.sel][0],t);return}if(!e.shiftKey&&S.sel.size)select([]);const sv=document.createElementNS('http://www.w3.org/2000/svg','svg');sv.setAttribute('class','laco');const pa=document.createElementNS('http://www.w3.org/2000/svg','path');sv.appendChild(pa);overEl.appendChild(sv);setAct({kind:'lasso',pts:[w.x,w.y],el:sv,path:pa,base:e.shiftKey?new Set(S.sel):new Set()},e);return}
  if(S.tool==='line'){const from=e.altKey?null:snapAt(e,w,null),el=mkEdgeEl();`,
  },
  {
    motivo: 'Continuação da mudança anterior: enquanto se desenha, o laço cresce com os pontos do traço, fechado de volta ao começo.',
    de: `  if(a.kind==='marquee'||a.kind==='create'){`,
    para: `  if(a.kind==='lasso'){const n=a.pts.length,dx=w.x-a.pts[n-2],dy=w.y-a.pts[n-1];if(dx*dx+dy*dy>=Math.pow(3/S.view.k,2)){a.pts.push(w.x,w.y);let d='M'+a.pts[0]+' '+a.pts[1];for(let i=2;i<a.pts.length;i+=2)d+='L'+a.pts[i]+' '+a.pts[i+1];a.path.setAttribute('d',d+'Z')}return}
  if(a.kind==='marquee'||a.kind==='create'){`,
  },
  {
    motivo: 'Continuação das mudanças anteriores: ao soltar, o laço some e os itens dentro dele ficam selecionados.',
    de: `  if(a.kind==='marquee'){a.el.remove();renderSel();return}`,
    para: `  if(a.kind==='lasso'){a.el.remove();lassoSelect(a.pts,a.base);return}
  if(a.kind==='marquee'){a.el.remove();renderSel();return}`,
  },
  {
    motivo: 'Continuação das mudanças anteriores: um laço interrompido, como pelo cancelamento do toque, some sem selecionar nada.',
    de: `if(a.kind==='marquee'||a.kind==='create')a.el.remove();`,
    para: `if(a.kind==='marquee'||a.kind==='create'||a.kind==='lasso')a.el.remove();`,
  },
  {
    motivo: 'Continuação das mudanças anteriores: o estilo do painel de formas, em grade, e da linha do laço, fina e contínua na cor de destaque.',
    de: `.menu{position:fixed;background:var(--panel);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow);padding:5px;min-width:200px;z-index:20}`,
    para: `.menu{position:fixed;background:var(--panel);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow);padding:5px;min-width:200px;z-index:20}
.menu .formas{display:grid;grid-template-columns:repeat(4,36px);gap:2px;padding:2px;justify-content:center}
#over .laco{position:absolute;left:0;top:0;width:1px;height:1px;overflow:visible;pointer-events:none}
#over .laco path{fill:none;stroke:var(--accent);stroke-width:calc(1.5px/var(--k));stroke-linejoin:round}`,
  },
  {
    motivo: 'Continuação das mudanças anteriores: a ajuda dos atalhos inclui o laço.',
    de: `<dt>Selecionar, mão</dt><dd>V, H</dd>`,
    para: `<dt>Selecionar, laço, mão</dt><dd>V, A, H</dd>`,
  },
  {
    motivo: 'A pedido do autor, os pontos do fundo ficam 15% mais espaçados em todos os níveis de zoom: o passo continua dobrando e caindo à metade com o zoom, e o resultado é multiplicado por 1,15.',
    de: `let s=24*v.k;while(s<14)s*=2;while(s>44)s/=2;`,
    para: `let s=24*v.k;while(s<14)s*=2;while(s>44)s/=2;s*=1.15;`,
  },
];
