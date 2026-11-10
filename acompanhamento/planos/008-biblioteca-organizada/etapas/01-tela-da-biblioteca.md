---
tipo: etapa
plano: "008"
etapa: "01"
titulo: "A tela da biblioteca, com título, autor, busca e ordenação"
status: em_andamento
depende_de: []
iniciada_em: 2026-11-10
concluida_em:
---

# Etapa 01: a tela da biblioteca, com título, autor, busca e ordenação

## Objetivo

Trocar a lista do painel lateral por uma tela própria da biblioteca, em que cada livro aparece com título e autor, e em que o autor acha uma obra pela busca, pelo autor ou pela ordem de leitura.

## Critérios de conclusão

- [ ] O servidor entrega, na lista da biblioteca, o título e o autor de cada EPUB, lidos de dentro do arquivo; um PDF, e um EPUB sem esses dados, estragado ou grande demais, ficam com o nome do arquivo como título e a pasta como autor, sem erro e sem derrubar a lista.
- [ ] Um botão do painel lateral abre a biblioteca em tela própria, por cima do quadro, no Boox e no computador; ela fecha por um botão e pela tecla Esc, e o quadro volta como estava.
- [ ] A tela lista os livros agrupados por autor, uma linha por livro, com o título, o formato, a marca de guardado neste aparelho e a porcentagem lida neste aparelho, quando houver.
- [ ] Um campo de busca filtra por título, autor e nome do arquivo, sem distinguir maiúsculas nem acentos; a lista pode ser ordenada por autor, por título e pelos lidos por último, e filtrada pelos guardados neste aparelho.
- [ ] Tocar num livro o abre no leitor e fecha a biblioteca, baixando-o antes, se preciso, com o andamento à vista; sem rede, a tela mostra a última lista recebida e abre os livros guardados.
- [ ] No painel lateral, a seção Biblioteca fica só com o botão que abre a tela e com os livros lidos por último, até cinco.
- [ ] Com 500 livros, a tela abre e a busca responde em menos de um segundo no teste; na casca, a tela não tem sombras, animações nem transparências.
- [ ] Os testes automáticos cobrem a leitura do título e do autor, a tela, a busca, a ordenação, o filtro e o uso sem rede, e acusam mutações introduzidas.
- [ ] O autor confirma no Boox que abre a biblioteca, acha um livro pela busca e pelo autor e o abre.

## Registro

### 2026-11-10

- O autor pediu este plano, respondeu às quatro perguntas que estão nas decisões do plano e aprovou estes critérios.

## Resultado
