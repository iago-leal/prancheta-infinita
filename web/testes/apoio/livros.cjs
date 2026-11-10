// Livros de exemplo para os testes do leitor, feitos na hora: um EPUB 3 com
// dois capítulos, montado com a JSZip entregue junto com a página, e um PDF de
// duas páginas, escrito à mão. O EPUB traz um script, que o leitor nunca deve
// executar. Com a opção rico, o EPUB ganha um trecho com acentos, itálico e
// espaços a mais, para a busca, links internos e um sumário com um subitem;
// com semSumario, fica sem o documento de navegação; com longo, ganha um
// terceiro capítulo, de várias páginas. O PDF aceita marcadores,
// um por página, letras acentuadas, escritas em octal, como \\341 para o á, e
// mais de uma linha por página, separadas por \\n.

'use strict';

const JSZip = require('../../app/vendor/jszip/jszip.min.js');

const xhtml = (titulo, corpo) => `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="pt">
<head><title>${titulo}</title></head>
<body>${corpo}</body>
</html>`;

async function criarEpub({ titulo = 'Livro de teste', rico = false, semSumario = false, longo = false } = {}) {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`);
  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">urn:uuid:00000000-0000-4000-8000-000000000001</dc:identifier>
    <dc:title>${titulo}</dc:title>
    <dc:language>pt</dc:language>
    <meta property="dcterms:modified">2026-01-01T00:00:00Z</meta>
  </metadata>
  <manifest>
    ${semSumario ? '' : '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>'}
    <item id="c1" href="c1.xhtml" media-type="application/xhtml+xml" properties="scripted"/>
    <item id="c2" href="c2.xhtml" media-type="application/xhtml+xml"/>
    ${longo ? '<item id="c3" href="c3.xhtml" media-type="application/xhtml+xml"/>' : ''}
  </manifest>
  <spine><itemref idref="c1"/><itemref idref="c2"/>${longo ? '<itemref idref="c3"/>' : ''}</spine>
</package>`);
  zip.file('OEBPS/nav.xhtml', xhtml('Sumário', `<nav epub:type="toc"><ol>
<li><a href="c1.xhtml">Capítulo um</a></li><li><a href="c2.xhtml">Capítulo dois</a>${rico ? '<ol><li><a href="c2.xhtml#p2">A frase</a></li></ol>' : ''}</li>${longo ? '<li><a href="c3.xhtml">Capítulo longo</a></li>' : ''}</ol></nav>`));
  zip.file('OEBPS/c1.xhtml', xhtml('Capítulo um', `<h1>Capítulo um</h1>
<p id="p1">Texto do primeiro capítulo, que fala de cartas e de quadros.</p>
${rico ? '<p id="p3">Um <em>cora</em>ção de papel e a AÇÃO   do\nvento.</p><p id="p6"><a id="adiante" href="c2.xhtml#p5">Ver o fim</a></p>' : ''}
<script>try { parent.__scriptDoLivro = true; } catch (e) {} window.__scriptDoLivro = true;</script>`));
  zip.file('OEBPS/c2.xhtml', xhtml('Capítulo dois', `<h1>Capítulo dois</h1>
<p id="p2">O segundo capítulo guarda a frase que será destacada.</p>
${rico ? '<p id="p4"><a id="elo" href="c2.xhtml#p2">Ir à frase</a></p><p id="p5">No fim, o CORAÇÃO volta ao papel.</p>' : ''}`));
  if (longo) {
    const paragrafos = Array.from({ length: 80 }, (_, i) => `<p id="l${i + 1}">Parágrafo ${i + 1} do capítulo longo, com texto bastante para ocupar mais de uma linha da página do leitor.</p>`);
    zip.file('OEBPS/c3.xhtml', xhtml('Capítulo longo', `<h1>Capítulo longo</h1>\n${paragrafos.join('\n')}`));
  }
  return zip.generateAsync({ type: 'nodebuffer', mimeType: 'application/epub+zip' });
}

// Um PDF mínimo, com o texto de cada página na fonte Helvetica.
function criarPdf(paginas = ['Primeira pagina do PDF', 'Segunda pagina do PDF'], { marcadores = null } = {}) {
  const objetos = [];
  const fonte = 3 + paginas.length * 2;
  const filhos = paginas.map((_, i) => `${3 + i * 2} 0 R`).join(' ');
  // Os marcadores vêm depois da fonte: a raiz e, em seguida, um por título, cada um apontando para a página de mesma ordem.
  const raizDosMarcadores = fonte + 1;
  objetos.push(`<< /Type /Catalog /Pages 2 0 R${marcadores ? ` /Outlines ${raizDosMarcadores} 0 R` : ''} >>`);
  objetos.push(`<< /Type /Pages /Kids [${filhos}] /Count ${paginas.length} >>`);
  for (const [i, texto] of paginas.entries()) {
    // Cada linha do texto da página vai numa linha do PDF, 24 pontos abaixo da anterior.
    const conteudo = `BT /F1 16 Tf 30 340 Td ${texto.split('\n').map((linha) => `(${linha}) Tj`).join(' 0 -24 Td ')} ET`;
    objetos.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Contents ${4 + i * 2} 0 R /Resources << /Font << /F1 ${fonte} 0 R >> >> >>`);
    objetos.push(`<< /Length ${Buffer.byteLength(conteudo)} >>\nstream\n${conteudo}\nendstream`);
  }
  objetos.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  if (marcadores) {
    const n = marcadores.length;
    objetos.push(`<< /Type /Outlines /First ${raizDosMarcadores + 1} 0 R /Last ${raizDosMarcadores + n} 0 R /Count ${n} >>`);
    marcadores.forEach((marcador, i) => {
      const vizinhos = `${i > 0 ? ` /Prev ${raizDosMarcadores + i} 0 R` : ''}${i < n - 1 ? ` /Next ${raizDosMarcadores + i + 2} 0 R` : ''}`;
      objetos.push(`<< /Title (${marcador}) /Parent ${raizDosMarcadores} 0 R${vizinhos} /Dest [${3 + i * 2} 0 R /Fit] >>`);
    });
  }
  let corpo = '%PDF-1.4\n';
  const posicoes = [];
  objetos.forEach((objeto, i) => {
    posicoes.push(Buffer.byteLength(corpo));
    corpo += `${i + 1} 0 obj\n${objeto}\nendobj\n`;
  });
  const inicioDaTabela = Buffer.byteLength(corpo);
  corpo += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (const p of posicoes) corpo += `${String(p).padStart(10, '0')} 00000 n \n`;
  corpo += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicioDaTabela}\n%%EOF\n`;
  return Buffer.from(corpo, 'latin1');
}

module.exports = { criarEpub, criarPdf };
