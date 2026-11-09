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
    motivo: 'O banco local e o cliente de compatibilidade são carregados antes de todo o código do artefato, para que window.claude.use(nome) já exista quando ele procurar os recursos; vêm junto a sincronização com o servidor e a combinação item a item que ela usa, o adaptador da casca Android, que não faz nada fora dela, e o desenho dos traços feitos no Boox.',
    de: `<title>Prancheta Infinita</title>`,
    para: `<title>Prancheta Infinita</title>
<script src="compat/banco-local.js"></script>
<script src="compat/combinar.js"></script>
<script src="compat/sincronizacao.js"></script>
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
];
