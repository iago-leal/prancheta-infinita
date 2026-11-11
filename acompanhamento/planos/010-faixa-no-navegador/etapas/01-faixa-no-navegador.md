---
tipo: etapa
plano: "010"
etapa: "01"
titulo: "A mesma faixa da casca no navegador"
status: concluida
depende_de: []
iniciada_em: 2026-11-11
concluida_em: 2026-11-11
---

# Etapa 01: a mesma faixa da casca no navegador

## Objetivo

Montar, no navegador, a faixa que a casca já tem, com os mesmos elementos, a mesma ordem e o mesmo comportamento.

## Critérios de conclusão

- [x] No navegador, o título, as ferramentas, a sincronização, desfazer, refazer, o zoom em porcentagem e mais opções ficam numa faixa só, no alto, nessa ordem, com as ferramentas no meio, e a faixa começa depois do painel de quadros quando ele está aberto.
- [x] A descrição, o aviso "Salvo" e os botões de aumentar e diminuir o zoom saem da tela, como na casca, e o menu da porcentagem continua mudando o zoom.
- [x] As opções da caneta, os avisos, os menus, a barra da seleção e o leitor de livros abrem abaixo da faixa, que ganha uma segunda linha numa tela estreita e é medida de novo quando muda de altura.
- [x] A casca continua com a mesma faixa e o mesmo modo e-ink.
- [x] Os testes automáticos cobrem os itens acima e acusam mutações introduzidas.
- [x] O autor confirma no navegador do computador que a faixa ficou como na casca.

## Registro

### 2026-11-11

- A faixa saiu de `web/app/compat/casca.js` para `web/app/compat/faixa.js`, novo, carregado também fora da casca. A casca ficou só com as regras do e-ink e da tinta da Onyx. O elemento passou a se chamar `#faixa`, e a altura dela, `--altura-da-faixa`, que o leitor de livros também usa.
- A altura é medida de novo quando a faixa muda de tamanho, como ao abrir o painel de quadros numa tela estreita, e não só quando a casca avisa uma mudança.
- Uma mudança nova em `web/montagem/mudancas.cjs` faz a barra da seleção de um item perto do alto abrir abaixo dele, em vez de cobrir a faixa; vale também na casca.
- Três testes da casca descreviam a barra do navegador embaixo, com sombra, e o painel de formas abrindo para cima; foram ajustados ao pedido do autor, e a sombra passou a ser conferida na barra da seleção.
- Testes: `web/testes/faixa.test.cjs`, novo, com 2 testes no Chromium, no tamanho de um computador e no de um iPad em pé. Das 10 primeiras mutações introduzidas na faixa e na barra da seleção, 5 foram acusadas na primeira rodada; as outras mostraram casos sem teste, a posição das opções da caneta e dos avisos, a nova medida ao fechar o painel, a barra da seleção numa altura intermediária e as ferramentas no meio. Com o teste reforçado, as 10 foram acusadas.
- Descoberta na suíte completa: com o leitor ao lado do quadro, o navegador ainda punha o título e os controles ao lado do livro, por regras de `web/app/compat/leitor.js` que valiam fora da casca. Elas passaram a valer só sem a faixa, e o leitor, como na casca, começa abaixo dela, com os controles acima. O teste do leitor ao lado do quadro passou a conferir isso; e, num teste do KOReader, o leitor 47 px mais baixo fez a página começar no próprio parágrafo 40, o que o teste passou a aceitar.
- Uma 11ª mutação, o leitor começando no alto da tela, também foi acusada.
- O detector da skill `impeccable` não apontou nada. A casca 0.21.0 compila, e os testes nativos passam. A suíte da página tem 134 testes, e a do servidor, 50, todos passando; `web/index.html` continua igual ao artefato publicado.
- Critérios 1 a 5 verificados pelos testes, como descrito acima. Falta, para o critério 6, o teste do autor no navegador do computador.

### 2026-11-11, depois do teste do autor

- Mesclado o PR #55, e a página publicada na VPS. Perguntado sobre a faixa no navegador do computador e sobre os testes do plano 009, o autor respondeu: "Sim, todos os testes passaram. Deu tudo certo." Com isso, o critério do teste dele foi marcado.

## Resultado

Concluída em 2026-11-11. Os critérios 1 a 5 foram verificados pelos 2 testes de `web/testes/faixa.test.cjs`, pelos testes da casca, do leitor e do KOReader ajustados ao novo leiaute e pela rodada de 11 mutações, todas acusadas, como descrito no Registro. O critério 6 foi verificado pelo autor, que confirmou a faixa no navegador.
