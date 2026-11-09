// Livros de exemplo para os testes do leitor, feitos na hora: um EPUB 3 com
// dois capítulos, montado com a JSZip entregue junto com a página, e um PDF de
// duas páginas, escrito à mão. O EPUB traz um script, que o leitor nunca deve
// executar.

'use strict';

const JSZip = require('../../app/vendor/jszip/jszip.min.js');

const xhtml = (titulo, corpo) => `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="pt">
<head><title>${titulo}</title></head>
<body>${corpo}</body>
</html>`;

async function criarEpub({ titulo = 'Livro de teste' } = {}) {
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
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="c1" href="c1.xhtml" media-type="application/xhtml+xml" properties="scripted"/>
    <item id="c2" href="c2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine><itemref idref="c1"/><itemref idref="c2"/></spine>
</package>`);
  zip.file('OEBPS/nav.xhtml', xhtml('Sumário', `<nav epub:type="toc"><ol>
<li><a href="c1.xhtml">Capítulo um</a></li><li><a href="c2.xhtml">Capítulo dois</a></li></ol></nav>`));
  zip.file('OEBPS/c1.xhtml', xhtml('Capítulo um', `<h1>Capítulo um</h1>
<p id="p1">Texto do primeiro capítulo, que fala de cartas e de quadros.</p>
<script>try { parent.__scriptDoLivro = true; } catch (e) {} window.__scriptDoLivro = true;</script>`));
  zip.file('OEBPS/c2.xhtml', xhtml('Capítulo dois', `<h1>Capítulo dois</h1>
<p id="p2">O segundo capítulo guarda a frase que será destacada.</p>`));
  return zip.generateAsync({ type: 'nodebuffer', mimeType: 'application/epub+zip' });
}

// Um PDF mínimo, com o texto de cada página na fonte Helvetica.
function criarPdf(paginas = ['Primeira pagina do PDF', 'Segunda pagina do PDF']) {
  const objetos = [];
  const fonte = 3 + paginas.length * 2;
  const filhos = paginas.map((_, i) => `${3 + i * 2} 0 R`).join(' ');
  objetos.push('<< /Type /Catalog /Pages 2 0 R >>');
  objetos.push(`<< /Type /Pages /Kids [${filhos}] /Count ${paginas.length} >>`);
  for (const [i, texto] of paginas.entries()) {
    const conteudo = `BT /F1 16 Tf 30 340 Td (${texto}) Tj ET`;
    objetos.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Contents ${4 + i * 2} 0 R /Resources << /Font << /F1 ${fonte} 0 R >> >> >>`);
    objetos.push(`<< /Length ${Buffer.byteLength(conteudo)} >>\nstream\n${conteudo}\nendstream`);
  }
  objetos.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
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
