---
tipo: plano
id: "008"
titulo: Biblioteca organizada
status: concluido
criado_em: 2026-11-10
concluido_em: 2026-11-13
---

# Plano 008: biblioteca organizada

## Objetivo

Achar um livro com facilidade quando a biblioteca crescer, numa tela própria, com busca, autores e ordenação, e ver, de cada livro, os destaques e os quadros que citam trechos dele.

## Por que agora

A biblioteca é uma lista no painel lateral, agrupada pelas pastas do servidor. O autor avisou, em 2026-11-10, que ela vai ficar grande demais para localizar as obras, e pediu para abri-la como uma biblioteca e para ver quais quadros fazem link com cada livro. Ele pôs este plano à frente da escrita à mão sobre a página do livro, que não é uma necessidade tão grande.

## Decisões do autor, em 2026-11-10

- A biblioteca abre em tela própria, por cima do quadro; no painel lateral ficam o atalho e os livros lidos por último.
- Os livros aparecem em lista, com título e autor, sem capas.
- As pastas do servidor são por autor e bastam para organizar; a Prancheta não cria estantes próprias.
- Os quadros que citam um livro aparecem na ficha do livro, na biblioteca, e num botão do leitor.

## Critério de conclusão do plano

- [x] No Boox, o autor abre a biblioteca, acha um livro pela busca, abre-o e, pela ficha dele, chega a um quadro que cita um trecho do livro.

## Etapas

| Etapa | Título | Status |
|---|---|---|
| [01](etapas/01-tela-da-biblioteca.md) | A tela da biblioteca, com título, autor, busca e ordenação | concluida |
| [02](etapas/02-ficha-do-livro.md) | A ficha do livro, com os destaques e os quadros que o citam | concluida |

## Riscos

- O título e o autor saem de dentro de arquivos que o servidor não controla. A leitura é feita com limites de tamanho e sem bibliotecas de terceiros; um arquivo fora do padrão fica com o nome do arquivo.
- Os nomes dos livros já são vistos pelo servidor, que lista a pasta; o título e o autor não mudam isso. Eles continuam fora do repositório e das sessões do Claude.
- A lista dos quadros que citam um livro lê todos os quadros guardados no aparelho. Com muitos quadros, pode levar alguns instantes; o resultado fica guardado enquanto a tela está aberta.
- A citação é reconhecida pelo link "abrir no livro" do cartão. Um cartão cujo link foi apagado à mão deixa de contar.

## Fora do escopo

- Capas dos livros e a grade com capas.
- Estantes, etiquetas ou coleções criadas na Prancheta.
- Corrigir o título ou o autor de um livro pela Prancheta.
- Enviar livros ao servidor pela Prancheta.
- Escrever à mão sobre a página do livro.

## Resultado

Concluído em 2026-11-13, com as duas etapas concluídas. O critério do plano foi verificado pelo autor no Boox: na etapa 01, ele achou um livro pela busca e o abriu, em 2026-11-10; na etapa 02, confirmou que a ficha do livro funcionou, em 2026-11-13.
