---
tipo: etapa
plano: "007"
etapa: "02"
titulo: "A Prancheta abre o livro onde o KOReader parou"
status: em_andamento
depende_de: ["01"]
iniciada_em: 2026-11-10
concluida_em:
---

# Etapa 02: a Prancheta abre o livro onde o KOReader parou

## Objetivo

Ao abrir um livro da biblioteca, o leitor da Prancheta descobre até onde o KOReader chegou nele e oferece continuar de lá.

## Critérios de conclusão

- [x] O servidor entrega a um aparelho da Prancheta, com a chave dele, o último progresso gravado de um livro, e nada sem a chave; a credencial do KOSync continua sem valer nessa rota.
- [x] Ao abrir um livro com um progresso do KOReader mais novo que a última leitura neste aparelho, e em outro lugar, o leitor mostra um aviso com a porcentagem, o aparelho e o horário, e um botão que leva até lá; sem o toque no botão, o livro continua onde estava.
- [x] Num PDF, o botão leva à página gravada. Num EPUB, leva ao parágrafo gravado, ou ao começo do capítulo dele quando o parágrafo não é achado; um progresso que não dá para entender não mostra o aviso nem gera erro.
- [x] Um progresso mais antigo que a última leitura neste aparelho, ou no mesmo lugar, não mostra o aviso; sem rede, o livro abre como hoje, sem demora e sem erro.
- [x] Os testes automáticos cobrem a rota, o aviso, a conversão no EPUB e no PDF e os casos sem aviso, e acusam mutações introduzidas.
- [ ] No Boox, o autor lê um livro no KOReader, abre o mesmo livro na Prancheta, toca no botão do aviso e chega ao trecho em que parou, num EPUB e num PDF.

## Registro

### 2026-11-10

- Mesclado o PR #44, com a etapa 01. O autor mandou seguir antes de ver os critérios desta etapa; como eles não podem ser alterados depois de escritos, foram mostrados a ele, que os aprovou com o aviso em vez do salto automático.
- Implementação, a publicar com a casca 0.12.0:
  - Servidor: `GET /sync/progresso/<id>`, com a chave do aparelho, devolve o progresso mais recente do livro entre os usuários do KOSync, ou nulo. Os aparelhos da Prancheta não guardam a senha do KOSync.
  - Leitor: depois de aberto o livro, sem atrasar a abertura, consulta o progresso. Se ele é mais novo que a última leitura guardada neste aparelho e fica fora da página à vista, aparece no rodapé "No KOReader, em <aparelho>, você parou em N%, hoje às HH:MM.", com um botão que leva até lá e outro que dispensa; virar a página também dispensa. Aberto pelo link de um cartão, o livro vai à posição do link, sem consulta.
  - Conversão: num PDF, a posição é o número da página. Num EPUB, o caminho do KOReader dá o capítulo, na ordem de leitura, e os passos até o elemento; o leitor vai até o parágrafo, sem o deslocamento dentro dele. Quando um passo não é achado, vale o último elemento achado, que é o começo do capítulo quando nem o primeiro passo existe. Um caminho fora dessa forma, ou de um capítulo que não existe, não mostra nada.
  - A comparação com a página à vista espera a página assentar: até quase meio segundo depois de abrir, a epub.js ainda ajusta o capítulo, e duas leituras com meio segundo entre elas precisam coincidir. Por isso o aviso aparece cerca de um segundo depois de o livro abrir.
- Defeito antigo achado pelos testes e corrigido: as barras de baixo do leitor, a do destaque aberto e a dos avisos, encolhiam a área do livro, e a epub.js não refaz as páginas quando isso acontece; o fim da página ficava cortado enquanto a barra estava à vista, e um capítulo desenhado nesse momento ficava com outra paginação. Agora essas barras e o aviso do KOReader ficam por cima do rodapé da página, sem mudar a altura dela, e o aviso de texto sai sozinho em 5 segundos, para não esconder a última linha.
- Outro ajuste: ao fechar o livro, fica guardada a página à vista naquele momento; antes, valia a do último aviso de mudança da epub.js, que logo depois de um salto podia ser de um instante antes de o texto assentar.
- Escolha desta etapa, dentro do critério 3: quando só o fim do caminho do KOReader não é achado, por exemplo um trecho em itálico dentro do parágrafo, o leitor fica no parágrafo já encontrado, em vez de voltar ao começo do capítulo; o começo do capítulo vale quando nada do caminho é achado.
- Critérios 1 a 5 verificados pelos testes. No servidor, um teste novo em `servidor/testes/kosync.test.cjs` cobre a rota com a chave do aparelho, o progresso mais recente entre dois usuários, a recusa sem a chave e com a credencial do KOSync, o identificador fora do formato e o servidor sem o KOSync; os testes do servidor são 44. Na página, `web/testes/progresso.test.cjs`, com 5 testes e o KOReader simulado por pedidos no protocolo dele: a leitura do caminho e do horário; no EPUB, o aviso com a porcentagem, o aparelho e o horário, o livro parado sem o toque, o salto ao parágrafo 40, o mesmo lugar sem aviso, inclusive o parágrafo em que a página começa, o fim do caminho não achado, o capítulo inteiro não achado, os dois modos de dispensar, o aviso que não passa para outro livro e a posição guardada ao fechar; o progresso mais antigo, o incompreensível e a abertura por link sem consulta; no PDF, a página gravada, a mesma página e a página que não existe; sem rede e sem o KOSync. A suíte da página tem 105 testes, todos passando.
- Das 30 mutações introduzidas, 24 foram acusadas na primeira rodada. As 6 que passaram mostraram falhas dos testes, que foram reforçados: um arquivo estranho na pasta do progresso, a página que começa no parágrafo gravado, o parágrafo vizinho no lugar do certo, o fim do caminho não achado, o aviso que passava de um livro para o outro e a posição guardada ao fechar. Repetidas, as 6 foram acusadas, e a execução de controle passou.
- O detector da skill `impeccable` não apontou nada.
- Falta, para o critério 6: mesclar; depende de a etapa 01 estar no ar na VPS, com o usuário do KOSync criado e o KOReader configurado. A conversão do caminho do KOReader nos EPUBs foi feita pela descrição do formato, sem o KOReader à mão, e só o teste do autor confirma que o parágrafo é o certo.

## Resultado
