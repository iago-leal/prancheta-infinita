---
tipo: etapa
plano: "008"
etapa: "01"
titulo: "A tela da biblioteca, com título, autor, busca e ordenação"
status: concluida
depende_de: []
iniciada_em: 2026-11-10
concluida_em: 2026-11-10
---

# Etapa 01: a tela da biblioteca, com título, autor, busca e ordenação

## Objetivo

Trocar a lista do painel lateral por uma tela própria da biblioteca, em que cada livro aparece com título e autor, e em que o autor acha uma obra pela busca, pelo autor ou pela ordem de leitura.

## Critérios de conclusão

- [x] O servidor entrega, na lista da biblioteca, o título e o autor de cada EPUB, lidos de dentro do arquivo; um PDF, e um EPUB sem esses dados, estragado ou grande demais, ficam com o nome do arquivo como título e a pasta como autor, sem erro e sem derrubar a lista.
- [x] Um botão do painel lateral abre a biblioteca em tela própria, por cima do quadro, no Boox e no computador; ela fecha por um botão e pela tecla Esc, e o quadro volta como estava.
- [x] A tela lista os livros agrupados por autor, uma linha por livro, com o título, o formato, a marca de guardado neste aparelho e a porcentagem lida neste aparelho, quando houver.
- [x] Um campo de busca filtra por título, autor e nome do arquivo, sem distinguir maiúsculas nem acentos; a lista pode ser ordenada por autor, por título e pelos lidos por último, e filtrada pelos guardados neste aparelho.
- [x] Tocar num livro o abre no leitor e fecha a biblioteca, baixando-o antes, se preciso, com o andamento à vista; sem rede, a tela mostra a última lista recebida e abre os livros guardados.
- [x] No painel lateral, a seção Biblioteca fica só com o botão que abre a tela e com os livros lidos por último, até cinco.
- [x] Com 500 livros, a tela abre e a busca responde em menos de um segundo no teste; na casca, a tela não tem sombras, animações nem transparências.
- [x] Os testes automáticos cobrem a leitura do título e do autor, a tela, a busca, a ordenação, o filtro e o uso sem rede, e acusam mutações introduzidas.
- [x] O autor confirma no Boox que abre a biblioteca, acha um livro pela busca e pelo autor e o abre.

## Registro

### 2026-11-10

- O autor pediu este plano, respondeu às quatro perguntas que estão nas decisões do plano e aprovou estes critérios.
- Implementação, a publicar com a casca 0.15.0:
  - Servidor: `servidor/epub.cjs`, novo, lê o título e os autores de um EPUB de dentro do arquivo. Um EPUB é um ZIP: o servidor lê o índice dele e só os dois arquivos que dizem onde está o pacote e o que ele traz, o título em `dc:title` e até três autores em `dc:creator`, sem bibliotecas de terceiros. Cada tamanho tem limite, nada é gravado, e um arquivo estragado, cifrado, do formato de 64 bits ou grande demais fica sem dados, sem erro. A lista da biblioteca, em `servidor/biblioteca.cjs`, passou a trazer `titulo` e `autor`: os do EPUB, ou o nome do arquivo sem a extensão e a primeira pasta do caminho. Os dados são lidos junto com o resumo, só quando o arquivo muda.
  - Página, organização: em `web/app/compat/biblioteca.js`, a função `organizar` faz a busca, a ordem e o filtro. A busca exige cada palavra em algum lugar do título, do autor, da pasta ou do nome do arquivo, sem acentos nem maiúsculas. A porcentagem lida passou a ser guardada junto com a posição, neste aparelho, a cada virada de página.
  - Página, tela: `web/app/compat/tela-da-biblioteca.js`, novo. A tela cobre a página inteira, com o botão de fechar, a contagem, o botão de atualizar, o campo de busca, as três ordens e o filtro "Neste aparelho". Cada linha tem o título, o autor escrito no livro quando difere do grupo, a situação, que é "guardado" ou o tamanho do arquivo, seguida da porcentagem lida, e o formato. Um livro que ainda não está no aparelho mostra "baixando", de 10 em 10%, e a tela só fecha quando ele chega.
  - Painel lateral: a seção Biblioteca ficou com o botão "Abrir a biblioteca", com a contagem dos livros, e, sob "Lidos por último", até cinco livros, do mais recente para o mais antigo; tocar num deles abre o livro direto.
- Escolhas desta etapa, a rever com o autor se o uso pedir:
  - O grupo de cada livro é a primeira pasta do caminho, que o autor disse ser a do autor da obra, e não o autor escrito no EPUB, que pode vir grafado de outro jeito, como "Assis, Machado de", e dividiria o mesmo autor em dois grupos. O autor escrito no livro aparece na linha quando difere do nome da pasta, e vale na busca. Um livro fora de pasta é agrupado pelo autor escrito nele, ou fica em "Sem autor", no fim da lista.
  - A ordem e o filtro escolhidos ficam guardados no aparelho; a busca recomeça vazia a cada abertura. Abrir a tela pede a lista atual ao servidor. No computador, o campo de busca já recebe o que for digitado; no toque, não, para o teclado não cobrir a lista.
  - Os avisos de livro guardado e de falta de rede passaram a dizer o título, e não o nome do arquivo.
- Defeito evitado, achado ao revisar: o quadro ouve as teclas, o copiar e o colar na página inteira. Com a tela aberta, um atalho trocaria a ferramenta, a tecla de apagar apagaria o cartão selecionado, e um texto colado viraria um cartão no quadro coberto. A tela segura esses eventos enquanto está aberta, de dentro e de fora dela, e um arquivo solto sobre ela não vai para o quadro nem tira o navegador da página.
- Limites conhecidos: a porcentagem só aparece para os livros lidos depois desta versão, porque as posições guardadas antes não a traziam; o título no alto do leitor e nos cartões levados ao quadro continua sendo o nome do arquivo; e o título de um PDF é sempre o nome do arquivo.
- Testes:
  - `servidor/testes/epub.test.cjs`, novo, com 4 testes, monta ZIPs à mão para controlar cada campo: o título e o autor com e sem compressão, com o pacote em outro lugar e com comentário no fim do ZIP; atributos, entidades, marcas e CDATA; vários autores; 19 casos de arquivo estragado, cifrado, grande demais ou fora do padrão, todos sem dados e sem erro; e a lista da biblioteca com os dados do EPUB, o nome do arquivo e a pasta, relidos só quando o arquivo muda. Os testes do servidor são 50.
  - `web/testes/tela-da-biblioteca.test.cjs`, novo, com 6 testes. No Node, a organização da lista. No Chromium, com a página e o servidor num só endereço: a tela aberta pelo botão e pelo teclado, cobrindo a página, com os livros por autor; as teclas, o texto colado e o arquivo solto sem efeito no quadro, e com efeito depois de a tela fechar; Esc e o botão de fechar, com o foco de volta; a busca, as três ordens e o filtro, guardados no aparelho, inclusive com a preferência estragada; o download com o andamento, o livro aberto no leitor pelo toque e pelo Enter, a porcentagem lida e os cinco lidos por último; o uso sem rede; e, numa casca simulada, os 500 livros e o estilo.
  - Os testes que abriam os livros pela lista do painel passaram a abri-los pela tela, com o apoio de `web/testes/apoio/biblioteca.cjs`. Um teste antigo conferia o aviso num instante em que ele some entre duas tentativas de atualização e falhava de vez em quando; passou a esperar o aviso. A suíte da página tem 114 testes, todos passando.
- Critério 7: com 500 livros de 50 autores, numa casca simulada, a tela abriu em 59 ms, a busca respondeu em 8 ms, e a troca de ordem, em 42 ms, medidos até a tela estar desenhada. Na casca, o teste confere que nada na tela tem sombra, transição, animação, opacidade ou fundo translúcido, que o botão ligado fica invertido e que cada linha tem altura para o dedo.
- Critério 8: as 88 mutações introduzidas foram todas acusadas, e a execução de controle passou. Na primeira rodada, 2 passaram: a ordem não guardada, porque o filtro a guardava junto, e a ordem desconhecida aceita, porque o teste só usava uma preferência que nem chegava a ser lida. Com os testes reforçados, foram acusadas.
- O detector da skill `impeccable` não apontou nada. A casca compila, e os testes nativos passam.
- Critérios 1 a 8 verificados pelos testes, como descrito acima. Falta, para o critério 9, o teste do autor no Boox, com a casca 0.15.0.
- Relato do autor depois de usar a casca 0.16.0: o agrupamento por autor mostrava um identificador no lugar do nome do autor. Causa: o grupo era a primeira pasta do caminho, e na biblioteca dele essa pasta não é a do autor, é um identificador de cada livro. A resposta "por autor", dada antes do plano, não descrevia as pastas do servidor.
  - Problema no critério 1: o trecho "a pasta como autor" só vale quando a pasta tem nome de gente. O critério não foi alterado; o autor relatou o defeito, e a correção segue o que ele descreveu.
  - Correção, na casca 0.17.0: o grupo de cada livro passa a ser o primeiro autor escrito nele. O servidor só usa uma pasta como autor quando ela tem cara de nome, a primeira do caminho que não seja um identificador: uma pasta sem letras, com um resumo ou um UUID no nome, ou com uma sequência comprida de letras e algarismos, não vale. Um livro sem autor escrito e sem pasta com nome fica em "Sem autor".
  - As grafias do mesmo nome ficam num grupo só, como "Assis, Machado de" e "Machado de Assis": a comparação usa as palavras do nome, sem acentos nem maiúsculas, em ordem alfabética. O grupo aparece na grafia mais usada entre os livros e, no empate, na sem vírgula, na que mistura maiúsculas e minúsculas e na com mais acentos. O nome do grupo não muda com a busca.
  - Vários autores no mesmo livro passam a vir separados por ponto e vírgula, porque a vírgula aparece dentro de um nome. O livro fica no grupo do primeiro autor, e os outros aparecem na linha dele.
  - Limite: os PDFs não trazem o autor lido de dentro do arquivo; numa biblioteca com pastas que são identificadores, eles ficam todos em "Sem autor".
  - Testes: o teste de unidade do agrupamento foi refeito com pastas que são identificadores, a biblioteca do teste no navegador ganhou duas dessas pastas, e o do servidor confere 7 identificadores, 10 nomes e a pasta com nome depois de um identificador. As 21 mutações desta correção foram acusadas, e a execução de controle passou. A suíte da página tem 118 testes, e a do servidor, 50, todos passando.
- Mesclado o PR #50, com a correção; casca 0.17.0. O autor confirmou no Boox que o agrupamento por autores deu certo. O critério 9 continua aberto até ele dizer se também achou um livro pela busca e o abriu.
- Critério 9 verificado: o autor confirmou no Boox que, além do agrupamento por autores, achou um livro pela busca e o abriu.

## Resultado

A biblioteca abre numa tela própria, por cima do quadro, com um livro por linha, o título e o autor lidos de dentro dos EPUBs, os livros agrupados pelo autor, a busca sem acentos, três ordens, o filtro dos guardados neste aparelho e a porcentagem lida. No painel lateral ficaram o botão que abre a tela e os cinco livros lidos por último.

Como cada critério foi verificado:

1. Título e autor de cada EPUB entregues pelo servidor, com o nome do arquivo e a pasta de reserva: pelos testes do servidor. O trecho "a pasta como autor" só vale para pastas com nome de gente, como registrado acima.
2. Tela própria, aberta pelo botão do painel e fechada pelo botão e pelo Esc, com o quadro como estava: pelo teste da tela no Chromium.
3. Lista agrupada por autor, com o título, o formato, a marca de guardado e a porcentagem lida: pelos testes da tela, e pelo autor, no Boox, depois da correção do agrupamento.
4. Busca sem maiúsculas nem acentos, três ordens e filtro dos guardados: pelo teste de unidade da organização e pelo teste da tela.
5. Tocar num livro o abre e fecha a biblioteca, com o download à vista, e o uso sem rede: pelos testes da tela.
6. Painel lateral com o botão e os cinco lidos por último: pelo teste da tela.
7. Com 500 livros, abrir e buscar em menos de um segundo, e a tela sem sombras, animações nem transparências na casca: pelo teste na casca simulada, com a tela aberta em 59 ms.
8. Testes e mutações: 88 mutações da etapa e 21 da correção do agrupamento, todas acusadas.
9. Abrir a biblioteca, achar um livro pela busca e pelo autor e abri-lo: pelo autor, no Boox, em 2026-11-10.
