---
tipo: etapa
plano: "008"
etapa: "02"
titulo: "A ficha do livro, com os destaques e os quadros que o citam"
status: em_andamento
depende_de: ["01"]
iniciada_em: 2026-11-10
concluida_em:
---

# Etapa 02: a ficha do livro, com os destaques e os quadros que o citam

## Objetivo

Dar a cada livro uma ficha, que reúne o que o autor já tirou dele: os destaques e os cartões levados aos quadros, com o caminho de volta para o trecho e para o quadro.

## Critérios de conclusão

- [x] Cada livro tem uma ficha, aberta pela linha dele na biblioteca e por um botão do leitor, com o título, o autor, o formato, a porcentagem lida e um botão que abre o livro ou continua a leitura.
- [x] A ficha lista os destaques do livro, com o trecho, a nota e a posição; tocar num deles abre o livro no trecho.
- [x] A ficha lista os quadros que citam o livro e, em cada quadro, os cartões levados a ele, com o trecho ou a posição; tocar num cartão abre o quadro com o cartão à vista.
- [x] A lista considera todos os quadros guardados no aparelho, inclusive os que não foram abertos nesta sessão, deixa de fora os quadros e os cartões apagados e funciona sem rede.
- [x] Um cartão levado ao quadro num aparelho aparece na ficha do livro no outro, depois da sincronização.
- [x] Na lista da biblioteca, cada livro citado mostra em quantos quadros aparece, e um filtro mostra só os livros citados.
- [x] Os testes automáticos cobrem a ficha, os destaques, os quadros que citam, os apagados e os dois aparelhos, e acusam mutações introduzidas.
- [ ] O autor confirma no Boox que, pela ficha de um livro, chega a um destaque no livro e a um quadro que o cita.

## Registro

### 2026-11-10

- O autor aprovou estes critérios junto com os da etapa 01.
- Mesclado o PR #48, com a etapa 01. O autor pediu para prosseguir com esta etapa antes de testar a 01 no Boox: "merge e prossiga".
- Implementação, a publicar com a casca 0.16.0:
  - Citações, em `web/app/compat/marcacoes.js`: uma citação é um cartão com o link de volta de um livro. A função `citacoes` lê o texto dos cartões de todos os quadros do índice, sem abri-los, direto do banco local; no quadro aberto, lê o que está na tela, que pode ainda não ter sido gravado. Quadros apagados ficam de fora, e cartões apagados já não estão nos quadros. Cada cartão conta uma vez por livro; o trecho vem dos blocos de citação do cartão, e a posição, do texto ao lado do link.
  - Ficha, em `web/app/compat/tela-da-biblioteca.js`: a mesma tela da biblioteca passa da lista para a ficha, com um botão de voltar. A ficha tem o título, o autor, o formato, a situação com a porcentagem lida, o botão "Abrir o livro", "Continuar a leitura" ou "Voltar ao livro", os destaques na ordem em que foram feitos, com o trecho, a nota e a posição, e os quadros na ordem dos títulos, cada um com os cartões levados a ele. Um cartão sem trecho aparece como "Posição do livro, sem trecho".
  - Caminhos de volta: tocar num destaque abre o livro no trecho, e não onde a leitura parou; tocar num cartão abre o quadro, seleciona o cartão e o põe no meio da parte visível do quadro. Com o leitor em tela inteira, que cobriria o quadro, ele passa para o lado; numa tela em que os dois não cabem, o leitor é fechado.
  - Lista: cada linha ganhou um botão, no fim, que abre a ficha; a situação de um livro citado diz "1 quadro" ou "N quadros", e o filtro "Citados" deixa só esses livros, guardado no aparelho como o outro filtro.
  - Leitor: um botão novo na barra abre a ficha do livro aberto, por cima dele.
- Mudança na estrutura da linha, sem mudar o que a etapa 01 entregou: a linha deixou de ser um botão só e passou a ter dois botões de verdade, o do livro e o da ficha, para não haver um botão dentro de outro.
- Descobertas durante os testes:
  - Com a tela aberta num aparelho, um cartão criado no outro só aparecia ao fechar e abrir a tela, porque as citações eram procuradas só na abertura. Agora, a cada rodada da sincronização com a tela aberta, elas são procuradas de novo, e a lista e a ficha se atualizam sozinhas.
  - A lista era redesenhada a cada atualização vinda do servidor, mesmo sem mudança, o que tirava o foco do botão e podia engolir um toque dado naquele instante. Agora ela só é redesenhada quando muda algo que mostra, o aviso é trocado à parte, e o foco volta ao mesmo botão depois de um redesenho.
  - Nos testes, uma espera com condição assíncrona passou antes da hora; as esperas que dependem de leitura no banco passaram a ser feitas uma avaliação por vez.
- Limites conhecidos: a citação é reconhecida pelo link do cartão, e um cartão cujo link foi apagado à mão deixa de contar; a ficha de um livro que saiu da biblioteca só aparece pelo leitor, com o nome do arquivo; e a posição escrita no cartão é a de quando ele foi criado.
- Testes: `web/testes/ficha-do-livro.test.cjs`, novo, com 4 testes. No Node, as citações nos itens de um quadro, com cartões de vários formatos, e a varredura dos quadros com um banco e uma página simulados. No Chromium, com a página e o servidor num só endereço: a ficha vazia e a preenchida, os destaques feitos pelo leitor, três quadros com cartões, um cartão e um quadro apagados, a página recarregada para os quadros serem lidos do banco, a contagem e o filtro na lista, os dois caminhos de volta, o botão do leitor, o leitor em tela inteira e na tela estreita, o foco depois de um redesenho, o livro fora da biblioteca e o uso sem rede; com dois aparelhos e a cifra, o cartão criado num deles chegando à ficha aberta no outro, o quadro nunca aberto ali, o conteúdo ilegível no servidor e o cartão apagado saindo da ficha; e, numa casca simulada, o estilo. A suíte da página tem 118 testes, e a do servidor, 50, todos passando.
- Critério 7: das 67 mutações introduzidas, 61 foram acusadas na primeira rodada. Uma mostrou uma regra de estilo repetida, que a página já tinha, e foi retirada com a regra. As outras 5 mostraram casos sem teste: um pedaço de quadro sem itens, o filtro dos citados lido de volta, a ficha largada ao fechar e ao reabrir a lista, e o item mais baixo da ficha. Com os testes reforçados, as 66 mutações restantes foram acusadas, e a execução de controle passou.
- O detector da skill `impeccable` não apontou nada. A casca compila, e os testes nativos passam.
- Critérios 1 a 7 verificados pelos testes, como descrito acima. Falta, para o critério 8, o teste do autor no Boox, com a casca 0.16.0.

## Resultado
