---
tipo: etapa
plano: "005"
etapa: "04"
titulo: Leitor de PDF e EPUB com marcações ligadas a quadros
status: concluida
depende_de: ["03"]
iniciada_em: 2026-11-09
concluida_em: 2026-11-09
---

# Etapa 04: leitor de PDF e EPUB com marcações ligadas a quadros

## Objetivo

Ler na Prancheta, ao lado do quadro ou em tela inteira, os PDFs e EPUBs da biblioteca, destacar trechos e levar ao quadro um trecho destacado ou qualquer posição do livro como um cartão com um link de volta, que reabre o livro naquele ponto, no Boox e no computador.

## Critérios de conclusão

- [x] Tocar num livro da biblioteca o abre ao lado do quadro atual, com um botão que passa o leitor para a tela inteira e volta; EPUB e PDF abrem no Boox e no computador, e os livros guardados abrem também sem rede.
- [x] No leitor, um trecho selecionado pode ser destacado; o destaque guarda o trecho e a posição no livro, reaparece ao reabrir o livro e sincroniza entre os aparelhos, cifrado como os quadros.
- [x] Um destaque, ou a posição atual do livro sem destaque, vai para o quadro aberto como um cartão com o nome do livro e o trecho ou a página; tocar no link do cartão abre o livro naquela posição, inclusive no outro aparelho.
- [x] No Boox, a caneta continua escrevendo no quadro com a tinta da Onyx sem riscar o leitor ao lado, e a seleção de um trecho funciona no leitor.
- [x] Os testes automáticos cobrem abrir EPUB e PDF, destacar, levar ao quadro um destaque e uma posição, reabrir pelo link, sincronizar os destaques entre dois perfis e o uso sem rede, e acusam mutações introduzidas.
- [x] O autor confirma o critério do plano: no Boox, abre um livro da biblioteca, faz uma marcação, a leva a um quadro, e a marcação aparece no computador depois da sincronização, com o link abrindo o livro na mesma posição.

## Registro

### 2026-11-09

- O autor aprovou estes critérios e mandou seguir.
- Decisões do autor para esta etapa: a marcação é um destaque de trecho com a posição, e também deve ser possível levar ao quadro qualquer posição ou página do livro sem destacar; o que vai ao quadro é um cartão com o trecho, que serve de link de volta: tocar nele abre o livro naquela posição; o leitor abre lado a lado com o quadro, com a opção de tela inteira; EPUB e PDF entram juntos nesta etapa.
- Desenho proposto, a confirmar ao implementar:
  - EPUB: a biblioteca epub.js, com a JSZip de que ela depende, entregue junto com a página, sem nenhuma requisição externa, como o pdf.js e a perfect-freehand. A posição é um EPUB CFI, o padrão de localização do formato, que aponta um ponto ou um trecho dentro do livro e não depende do tamanho da tela.
  - PDF: o pdf.js que a página já traz, com a camada de texto para a seleção. A posição é a página e, num destaque, o trecho e o lugar dele no texto da página.
  - Marcações: um documento por livro no banco dos quadros, com uma lista de marcações identificadas cada uma pelo seu id, para que a combinação item a item da sincronização junte as marcações feitas nos dois aparelhos; como os demais documentos, elas sobem cifradas. O livro é identificado pelo identificador do KOReader, da etapa 03.
  - Cartão: criado no quadro aberto, perto do centro da vista, no formato dos cartões da Prancheta, com o nome do livro, o trecho ou a página e um link de volta próprio da Prancheta, que a página intercepta para abrir o livro na posição; num aparelho que ainda não guardou o livro, o link o baixa antes, se houver rede.
  - Leitor: um painel à direita do quadro, com a divisória fixa, e um botão para a tela inteira e de volta; em telas estreitas, só a tela inteira. O painel não tem sombras nem animações no modo e-ink.
  - Casca: o painel do leitor entra nas áreas reservadas que a página já informa à casca, para que a tinta da Onyx não risque o livro, e o toque e a caneta no painel vão para a página.
- Riscos próprios da etapa:
  - A seleção de texto no navegador da casca, com o dedo ou a caneta, pode não funcionar como no computador; o primeiro passo no Boox é testar isso com um protótipo.
  - O EPUB paginado no e-ink: cada virada de página redesenha o painel; o leitor vira páginas sem animação.
  - O tamanho das bibliotecas novas: a epub.js e a JSZip somam algumas centenas de KB à página e à casca.
  - Esta etapa é maior que as anteriores e pode ser entregue em mais de um PR: primeiro o leitor, depois as marcações e os cartões.

- Primeira parte, o leitor, a publicar com a casca 0.7.0:
  - Bibliotecas: a epub.js 0.3.93, licença BSD-2-Clause, e a JSZip 3.10.1, licença MIT, baixadas do registro do npm, com a integridade conferida contra a que o registro publica, e entregues em `web/app/vendor/`, com as licenças; o service worker as guarda para o uso sem rede, e elas só são carregadas quando o primeiro EPUB é aberto.
  - `web/app/compat/leitor.js`, novo: o painel "Leitor", à direita do quadro, com a metade da largura da tela, entre 320 e 960 px, e o botão "Tela inteira", que vira "Lado a lado"; em telas com menos de 600 px, só a tela inteira. Lado a lado, os controles do quadro passam para a esquerda do leitor, como a página já faz com o painel de conversa, e o título do quadro passa a quebrar antes deles.
  - EPUB: paginado, sem animação, num iframe em que os scripts do livro não rodam. A epub.js põe em cada capítulo uma tag `base` que a política da página recusa; como o livro é aberto do próprio arquivo, com os recursos por endereços locais, o gancho que a põe foi tirado, e a política da página ficou como estava. A posição é o EPUB CFI, mostrada como página do capítulo e porcentagem do livro.
  - PDF: o pdf.js que a página já traz, uma página por vez, na largura do painel, com a camada de texto para a seleção. A posição é a página.
  - O trecho selecionado aparece numa barra do leitor, com a página no PDF; transformá-lo em destaque e em cartão é a segunda parte.
  - A última posição de cada livro fica no banco da biblioteca, neste aparelho, e o livro reabre nela. Tocar num livro da biblioteca agora o abre no leitor, baixando-o antes se preciso.
  - Na casca, o painel entra nas áreas reservadas que a página informa, e a tinta da Onyx não risca o livro.
- Testes: 3 no Chromium para o leitor, com um EPUB de dois capítulos, que traz um script, e um PDF de duas páginas, feitos na hora: o EPUB abre lado a lado, com os controles do quadro fora do leitor, vira de capítulo, mostra o trecho selecionado com o CFI, passa à tela inteira e volta e reabre na última posição, sem nenhuma violação da política da página e sem rodar o script do livro; o PDF abre página a página, com o texto na camada de seleção e a página no trecho selecionado, e reabre na última página; sem rede, o livro guardado abre, e um não guardado avisa; em tela estreita, o leitor ocupa a tela inteira. Mais 1 na casca, simulada, em que o painel aberto entra nas áreas reservadas e o quadro ao lado não. As 7 mutações introduzidas foram acusadas, e o detector da skill `impeccable` não apontou nada.
- A testar no Boox: a seleção de um trecho com o dedo ou a caneta, que é o risco principal da etapa, e a leitura lado a lado na largura da tela dele.

- Mesclado o PR #39, com a primeira parte e a casca 0.7.0. O autor mandou seguir para a segunda parte antes do teste da seleção no Boox, que fica para a casca com as duas partes.
- Segunda parte, as marcações, a publicar com a casca 0.8.0:
  - `web/app/compat/marcacoes.js`, novo: os destaques de cada livro ficam no documento `marcacoes/<identificador do livro>`, no banco dos quadros, numa lista em que cada destaque tem o seu id; eles sobem cifrados como os quadros, e a sincronização os combina item a item. Cada destaque guarda o trecho, a posição e o rótulo da posição: no EPUB, o CFI do trecho e o capítulo; no PDF, a página e o lugar do trecho no texto da página.
  - O cartão é criado no quadro aberto, no meio da parte visível dele, entre o painel dos quadros e o leitor, pelas mesmas funções com que a página cria um cartão de texto colado. Ele tem o trecho como citação, quando há, e uma linha com o nome do livro, a posição e o link "abrir no livro", no formato de link que os cartões já desenham, `[rótulo](endereço)`; colchetes do trecho viram os de largura total, para não formarem links.
  - O endereço do link é `https://prancheta.invalid/livro/<livro>/<posição>`, com a posição em JSON, em base64url, porque o CFI tem parênteses, que fechariam o link. O domínio `.invalid` é reservado e nunca responde. A página intercepta o toque no link antes do quadro, que o abriria numa aba nova, confere o endereço, aceitando só CFIs e números na posição, e abre o livro no leitor, que o baixa antes se o aparelho ainda não o guardou.
  - No leitor, a barra da seleção ganhou "Destacar" e "Levar ao quadro", que destaca e cria o cartão, e o alto do leitor ganhou "Ao quadro", que leva a posição atual sem destaque. Os destaques aparecem sombreados em cinza: no EPUB, pelas anotações da epub.js; no PDF, nos pedaços da camada de texto que o trecho cobre. Com o livro aberto, os destaques que chegam de outro aparelho aparecem sem reabrir.
- Testes: 3 no Chromium para as marcações. Com dois perfis e a cifra ligada: destacar no EPUB, levar um trecho e a posição ao quadro, reabrir o livro pelo link do cartão sem abrir aba nova, conferir os destaques cifrados no servidor, abrir no outro perfil pelo link, que baixa o livro, com os dois destaques, e ver um destaque feito nele chegar ao primeiro com o livro aberto. No PDF: o destaque sombreia o trecho, some nas outras páginas, volta ao virar para a página dele e ao reabrir pelo link. E os endereços malformados ou com uma posição que não é CFI nem número são recusados. Das 8 mutações introduzidas, todas foram acusadas; uma, esquecer as marcas ao virar a página do PDF, só depois de o teste passar a voltar à página sem reabrir o livro. O detector da skill `impeccable` não apontou nada.
- Critério 5 verificado pelos testes e pelas mutações das duas partes: 7 no leitor e 8 nas marcações, todas acusadas.
- A testar no Boox, com a casca 0.8.0: a seleção de um trecho com o dedo ou a caneta, a leitura lado a lado na largura da tela, a caneta escrevendo no quadro ao lado sem riscar o livro e o critério do plano, com a marcação chegando ao computador.

- Mesclado o PR #40, com a segunda parte e a casca 0.8.0. Antes do teste, o Boox perdeu a sincronização porque saiu do Wi-Fi, embora o Tailscale aparecesse ligado; com o Wi-Fi de volta, ela retomou sozinha.
- O autor instalou a casca 0.8.0 e testou no Boox e no computador: funcionou bem, inclusive a seleção, a caneta ao lado do livro e a marcação levada ao quadro no Boox e aberta pelo link no computador.
- Pedidos do autor depois do teste, para o próximo plano: o leitor abrir à esquerda do quadro, porque ele é destro e escreve à direita; apagar um destaque tocando nele de novo; e estudar o Readest, leitor de código aberto que já sincroniza com o KOReader, para aproveitar funções dele, conforme a licença, extraindo as especificações e implementando-as aqui.

## Resultado

A Prancheta lê os EPUBs e PDFs da biblioteca ao lado do quadro ou em tela inteira, no Boox e no computador, com a última posição lembrada. Um trecho selecionado vira destaque, sincronizado e cifrado como os quadros, e um destaque ou a posição atual vai ao quadro como cartão com o link "abrir no livro", que reabre o livro na posição, também no outro aparelho.

Como cada critério foi verificado:

1. Abrir ao lado e em tela inteira, EPUB e PDF, também sem rede: pelos testes do leitor no Chromium e pelo autor, no Boox e no computador.
2. Destaque guardado, reaparecendo e sincronizado cifrado: pelos testes das marcações, com dois perfis e a cifra, e pelo autor, com a marcação feita no Boox chegando ao computador.
3. Cartão com o trecho ou a posição e o link de volta, também no outro aparelho: pelos testes das marcações e pelo autor, que abriu no computador, pelo link, a marcação feita no Boox.
4. Caneta ao lado do leitor e seleção no Boox: pelo teste da casca, simulada, com o painel nas áreas reservadas, e pelo autor, no Boox.
5. Testes e mutações: 7 mutações no leitor e 8 nas marcações, todas acusadas.
6. Confirmação do autor do critério do plano: no Boox, abriu um livro, fez a marcação, levou-a ao quadro, e ela apareceu no computador, com o link abrindo o livro na posição.
