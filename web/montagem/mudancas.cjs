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
    motivo: 'O banco local e o cliente de compatibilidade são carregados antes de todo o código do artefato, para que window.claude.use(nome) já exista quando ele procurar os recursos.',
    de: `<title>Prancheta Infinita</title>`,
    para: `<title>Prancheta Infinita</title>
<script src="compat/banco-local.js"></script>
<script src="compat/claude.js"></script>`,
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
];
