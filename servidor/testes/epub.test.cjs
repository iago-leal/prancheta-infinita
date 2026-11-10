// Título e autor dos livros, etapa 01 do plano 008: o servidor lê os de um
// EPUB de dentro do arquivo, com limites, e a lista da biblioteca nunca cai
// por causa de um arquivo fora do padrão.
// Executar a partir da raiz do repositório: node --test servidor/testes/*.test.cjs

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { lerDadosDoEpub, dadosDoPacote, caminhoDoPacote } = require('../epub.cjs');
const { Biblioteca } = require('../biblioteca.cjs');

const temporaria = (nome) => fs.mkdtempSync(path.join(os.tmpdir(), `prancheta-${nome}-`));

// Um ZIP montado à mão, para controlar cada campo: cada arquivo é
// { nome, conteudo, metodo, cifrado, mentir }, e as opções mexem no fim do índice.
function criarZip(arquivos, { comentario = '', entradas, tamanhoDoIndice, comecoDoIndice } = {}) {
  const locais = [];
  const indice = [];
  let posicao = 0;
  for (const arquivo of arquivos) {
    const nome = Buffer.from(arquivo.nome);
    const aberto = Buffer.from(arquivo.conteudo);
    const metodo = arquivo.metodo === undefined ? 8 : arquivo.metodo;
    const dados = metodo === 8 ? zlib.deflateRawSync(aberto) : aberto;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(arquivo.cifrado ? 1 : 0, 6);
    local.writeUInt16LE(metodo, 8);
    local.writeUInt32LE(dados.length, 18);
    local.writeUInt32LE(aberto.length, 22);
    local.writeUInt16LE(nome.length, 26);
    // Um campo extra no cabeçalho local, que o leitor precisa pular.
    const extra = Buffer.from([0x55, 0x54, 0x01, 0x00, 0x00]);
    local.writeUInt16LE(extra.length, 28);
    locais.push(local, nome, extra, dados);
    const entrada = Buffer.alloc(46);
    entrada.writeUInt32LE(0x02014b50, 0);
    entrada.writeUInt16LE(20, 4);
    entrada.writeUInt16LE(20, 6);
    entrada.writeUInt16LE(arquivo.cifrado ? 1 : 0, 8);
    entrada.writeUInt16LE(metodo, 10);
    entrada.writeUInt32LE(dados.length, 20);
    entrada.writeUInt32LE(arquivo.mentir ? arquivo.mentir : aberto.length, 24);
    entrada.writeUInt16LE(nome.length, 28);
    entrada.writeUInt32LE(posicao, 42);
    indice.push(entrada, nome);
    posicao += local.length + nome.length + extra.length + dados.length;
  }
  const corpoDoIndice = Buffer.concat(indice);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(arquivos.length, 8);
  fim.writeUInt16LE(entradas === undefined ? arquivos.length : entradas, 10);
  fim.writeUInt32LE(tamanhoDoIndice === undefined ? corpoDoIndice.length : tamanhoDoIndice, 12);
  fim.writeUInt32LE(comecoDoIndice === undefined ? posicao : comecoDoIndice, 16);
  fim.writeUInt16LE(Buffer.byteLength(comentario), 20);
  return Buffer.concat([...locais, corpoDoIndice, fim, Buffer.from(comentario)]);
}

const RECIPIENTE = (pacote = 'OEBPS/content.opf') => `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="${pacote}" media-type="application/oebps-package+xml"/></rootfiles>
</container>`;

const PACOTE = (metadados) => `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:identifier id="uid">urn:uuid:00000000-0000-4000-8000-000000000001</dc:identifier>
    ${metadados}
    <dc:language>pt</dc:language>
  </metadata>
  <manifest><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/></manifest>
  <spine><itemref idref="c1"/></spine>
</package>`;

function criarEpub(metadados, { pacote = 'OEBPS/content.opf', metodo, zip = {} } = {}) {
  return criarZip([
    { nome: 'mimetype', conteudo: 'application/epub+zip', metodo: 0 },
    { nome: 'META-INF/container.xml', conteudo: RECIPIENTE(pacote), metodo },
    { nome: pacote, conteudo: PACOTE(metadados), metodo },
    { nome: 'OEBPS/c1.xhtml', conteudo: '<html><body><p>Texto.</p></body></html>', metodo },
  ], zip);
}

async function lerDe(conteudo) {
  const arquivo = path.join(temporaria('epub'), 'livro.epub');
  fs.writeFileSync(arquivo, conteudo);
  return lerDadosDoEpub(arquivo);
}

test('o título e o autor de um EPUB são lidos de dentro do arquivo', async () => {
  const comum = '<dc:title>Dom Casmurro</dc:title><dc:creator>Machado de Assis</dc:creator>';
  assert.deepEqual(await lerDe(criarEpub(comum)), { titulo: 'Dom Casmurro', autor: 'Machado de Assis' });
  // Sem compressão, com o pacote em outro lugar e com um comentário no fim do ZIP.
  assert.deepEqual(await lerDe(criarEpub(comum, { metodo: 0 })), { titulo: 'Dom Casmurro', autor: 'Machado de Assis' });
  assert.deepEqual(await lerDe(criarEpub(comum, { pacote: 'pacote.opf' })), { titulo: 'Dom Casmurro', autor: 'Machado de Assis' });
  assert.deepEqual(await lerDe(criarEpub(comum, { zip: { comentario: 'feito à mão '.repeat(200) } })), { titulo: 'Dom Casmurro', autor: 'Machado de Assis' });

  // Atributos, entidades, marcas e espaços de sobra; só o primeiro título vale.
  assert.deepEqual(await lerDe(criarEpub(`
    <dc:title id="t1">  Mem&#243;rias   p&#xF3;stumas
       de <i>Br&aacute;s</i> &amp; &lt;Cubas&gt; </dc:title>
    <dc:title id="t2">Subtítulo</dc:title>
    <dc:creator opf:role="aut" opf:file-as="Assis, Machado de"><![CDATA[Machado de Assis]]></dc:creator>`)),
  { titulo: 'Memórias póstumas de Br&aacute;s & <Cubas>', autor: 'Machado de Assis' });

  // Vários autores: até três, sem repetidos, na ordem do arquivo.
  assert.deepEqual(await lerDe(criarEpub('<dc:title>Antologia</dc:title><dc:creator>Ana</dc:creator><dc:creator>Bia</dc:creator><dc:creator>Ana</dc:creator><dc:creator>Caio</dc:creator><dc:creator>Davi</dc:creator>')),
    { titulo: 'Antologia', autor: 'Ana, Bia, Caio' });
  // Só um dos dois, ou nenhum.
  assert.deepEqual(await lerDe(criarEpub('<dc:title>Sem autor</dc:title>')), { titulo: 'Sem autor' });
  assert.deepEqual(await lerDe(criarEpub('<dc:creator>Sem título</dc:creator><dc:title>  </dc:title>')), { autor: 'Sem título' });
  assert.equal(await lerDe(criarEpub('')), null);
  // Um título enorme é cortado, e os caracteres de controle saem.
  const longo = await lerDe(criarEpub(`<dc:title>${'a'.repeat(1000)}</dc:title><dc:creator>Um\u0007 nome\u001b[31m</dc:creator>`));
  assert.equal(longo.titulo.length, 300);
  assert.equal(longo.autor, 'Um nome [31m');
});

test('o documento do pacote é lido com qualquer prefixo, e só dentro dos metadados', () => {
  assert.deepEqual(dadosDoPacote('<package><metadata><title>Sem prefixo</title><creator>Alguém</creator></metadata></package>'), { titulo: 'Sem prefixo', autor: 'Alguém' });
  assert.deepEqual(dadosDoPacote('<opf:package><opf:metadata><DC:Title>Maiúsculas</DC:Title></opf:metadata></opf:package>'), { titulo: 'Maiúsculas' });
  // Um título fora dos metadados não conta, nem um elemento de nome parecido.
  assert.equal(dadosDoPacote('<package><dc:title>Fora</dc:title><metadata><dc:subtitle>Parecido</dc:subtitle><dc:titles>Outro</dc:titles></metadata></package>'), null);
  assert.equal(dadosDoPacote('<package><manifest/></package>'), null);
  assert.equal(dadosDoPacote(''), null);

  assert.equal(caminhoDoPacote(RECIPIENTE('a/b c.opf')), 'a/b c.opf');
  assert.equal(caminhoDoPacote("<container><rootfiles><rootfile media-type='x' full-path='um &amp; dois.opf'/></rootfiles></container>"), 'um & dois.opf');
  assert.equal(caminhoDoPacote('<container><rootfiles/></container>'), null);
  assert.equal(caminhoDoPacote(RECIPIENTE('')), null);
  assert.equal(caminhoDoPacote(RECIPIENTE('a'.repeat(2000))), null);
});

test('um EPUB estragado, cifrado, grande demais ou fora do padrão não tem dados e não gera erro', async () => {
  const comum = '<dc:title>Título</dc:title><dc:creator>Autor</dc:creator>';
  const bom = criarEpub(comum);
  assert.deepEqual(await lerDe(bom), { titulo: 'Título', autor: 'Autor' });

  const casos = {
    'arquivo vazio': Buffer.alloc(0),
    'não é um ZIP': Buffer.from('isto não é um livro, é só um texto com mais de vinte e dois bytes'),
    'cortado no meio': bom.subarray(0, Math.floor(bom.length / 2)),
    'cortado no fim': bom.subarray(0, bom.length - 10),
    'índice fora do arquivo': criarEpub(comum, { zip: { comecoDoIndice: 10 * 1024 * 1024 } }),
    'índice maior que o limite': criarEpub(comum, { zip: { tamanhoDoIndice: 9 * 1024 * 1024 } }),
    'mais entradas que o índice': criarEpub(comum, { zip: { entradas: 9 } }),
    'ZIP de 64 bits': criarEpub(comum, { zip: { comecoDoIndice: 0xffffffff } }),
    'ZIP de 64 bits, pelas entradas': criarEpub(comum, { zip: { entradas: 0xffff } }),
    'sem o recipiente': criarZip([{ nome: 'OEBPS/content.opf', conteudo: PACOTE(comum) }]),
    'pacote que não existe': criarZip([{ nome: 'META-INF/container.xml', conteudo: RECIPIENTE('outro.opf') }, { nome: 'OEBPS/content.opf', conteudo: PACOTE(comum) }]),
    'recipiente cifrado': criarZip([{ nome: 'META-INF/container.xml', conteudo: RECIPIENTE(), cifrado: true }, { nome: 'OEBPS/content.opf', conteudo: PACOTE(comum) }]),
    'pacote cifrado': criarZip([{ nome: 'META-INF/container.xml', conteudo: RECIPIENTE() }, { nome: 'OEBPS/content.opf', conteudo: PACOTE(comum), cifrado: true }]),
    'compressão desconhecida': criarZip([{ nome: 'META-INF/container.xml', conteudo: RECIPIENTE() }, { nome: 'OEBPS/content.opf', conteudo: PACOTE(comum), metodo: 12 }]),
    'pacote comprimido grande demais': criarZip([{ nome: 'META-INF/container.xml', conteudo: RECIPIENTE() }, { nome: 'OEBPS/content.opf', conteudo: PACOTE(comum) + ' '.repeat(1024 * 1024 + 10), metodo: 0 }]),
    'pacote aberto grande demais': criarZip([{ nome: 'META-INF/container.xml', conteudo: RECIPIENTE() }, { nome: 'OEBPS/content.opf', conteudo: PACOTE(comum) + ' '.repeat(5 * 1024 * 1024) }]),
    'pacote que abre maior do que diz': criarZip([{ nome: 'META-INF/container.xml', conteudo: RECIPIENTE() }, { nome: 'OEBPS/content.opf', conteudo: PACOTE(comum) + ' '.repeat(5 * 1024 * 1024), mentir: 100 }]),
    'pacote em UTF-16': criarZip([{ nome: 'META-INF/container.xml', conteudo: RECIPIENTE() }, { nome: 'OEBPS/content.opf', conteudo: Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(PACOTE(comum), 'utf16le')]) }]),
    'dados comprimidos estragados': (() => {
      const zip = criarZip([{ nome: 'META-INF/container.xml', conteudo: RECIPIENTE(), metodo: 0 }, { nome: 'OEBPS/content.opf', conteudo: PACOTE(comum) }]);
      // A segunda vez em que o nome aparece é o cabeçalho do pacote; a primeira está no texto do recipiente.
      const comeco = zip.indexOf('OEBPS/content.opf', zip.indexOf('OEBPS/content.opf') + 1) + 'OEBPS/content.opf'.length + 5;
      zip.fill(0xff, comeco, comeco + 40);
      return zip;
    })(),
  };
  for (const [nome, conteudo] of Object.entries(casos)) assert.equal(await lerDe(conteudo), null, nome);
  // Um arquivo que não existe também não gera erro.
  assert.equal(await lerDadosDoEpub(path.join(temporaria('epub'), 'nao-existe.epub')), null);
});

test('a lista da biblioteca traz o título e o autor: do EPUB, ou o nome do arquivo e a pasta', async () => {
  const livros = temporaria('biblioteca');
  fs.mkdirSync(path.join(livros, 'Machado de Assis', 'Romances'), { recursive: true });
  fs.mkdirSync(path.join(livros, 'Clarice Lispector'));
  fs.writeFileSync(path.join(livros, 'Machado de Assis', 'Romances', 'dc.epub'), criarEpub('<dc:title>Dom Casmurro</dc:title><dc:creator>Assis, Machado de</dc:creator>'));
  fs.writeFileSync(path.join(livros, 'Machado de Assis', 'Quincas Borba.epub'), criarEpub('<dc:title>Quincas Borba</dc:title>'));
  fs.writeFileSync(path.join(livros, 'Machado de Assis', 'Romances', 'Esaú e Jacó.v2.pdf'), Buffer.from('%PDF-1.4 um'));
  fs.writeFileSync(path.join(livros, 'Clarice Lispector', 'A hora da estrela.epub'), Buffer.from('um EPUB estragado, que não é um ZIP de verdade'));
  fs.writeFileSync(path.join(livros, 'Clarice Lispector', 'Sem dados.EPUB'), criarEpub(''));
  fs.writeFileSync(path.join(livros, 'Solto.pdf'), Buffer.from('%PDF-1.4 dois'));
  fs.writeFileSync(path.join(livros, 'Solto com dados.epub'), criarEpub('<dc:title>Um título</dc:title><dc:creator>Uma autora</dc:creator>'));

  const biblioteca = new Biblioteca(livros, { validade: 0 });
  const dados = async () => Object.fromEntries((await biblioteca.listar()).map((l) => [l.nome, [l.titulo, l.autor]]));
  assert.deepEqual(await dados(), {
    'dc.epub': ['Dom Casmurro', 'Assis, Machado de'],
    'Quincas Borba.epub': ['Quincas Borba', 'Machado de Assis'],
    'Esaú e Jacó.v2.pdf': ['Esaú e Jacó.v2', 'Machado de Assis'],
    'A hora da estrela.epub': ['A hora da estrela', 'Clarice Lispector'],
    'Sem dados.EPUB': ['Sem dados', 'Clarice Lispector'],
    'Solto.pdf': ['Solto', ''],
    'Solto com dados.epub': ['Um título', 'Uma autora'],
  });
  // A lista continua sem o caminho na VPS, e cada livro só com os campos esperados.
  assert.deepEqual(Object.keys((await biblioteca.listar())[0]).sort(), ['autor', 'bytes', 'id', 'modificadoEm', 'nome', 'pasta', 'tipo', 'titulo']);

  // Os dados acompanham o arquivo: trocado o conteúdo, mudam; sem mudança, não são lidos de novo.
  const leituras = [];
  const original = fs.promises.open;
  fs.promises.open = (caminho, ...resto) => {
    leituras.push(path.basename(String(caminho)));
    return original.call(fs.promises, caminho, ...resto);
  };
  try {
    await biblioteca.listar();
    assert.deepEqual(leituras, [], 'nada foi lido de novo');
    fs.writeFileSync(path.join(livros, 'Clarice Lispector', 'A hora da estrela.epub'), criarEpub('<dc:title>A hora da estrela</dc:title><dc:creator>Clarice Lispector</dc:creator><dc:creator>Outra pessoa</dc:creator>'));
    assert.deepEqual((await dados())['A hora da estrela.epub'], ['A hora da estrela', 'Clarice Lispector, Outra pessoa']);
    assert.ok(leituras.length >= 2 && leituras.every((nome) => nome === 'A hora da estrela.epub'), `só o arquivo trocado foi lido: ${leituras}`);
  } finally {
    fs.promises.open = original;
  }
});
