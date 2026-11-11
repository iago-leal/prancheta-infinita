---
tipo: etapa
plano: "009"
etapa: "01"
titulo: "A marcação formatada enquanto se escreve"
status: concluida
depende_de: []
iniciada_em: 2026-11-11
concluida_em: 2026-11-11
---

# Etapa 01: a marcação formatada enquanto se escreve

## Objetivo

Mostrar, durante a edição do cartão, a marcação do GitHub já formatada, com os marcadores visíveis só na linha do cursor, sem mudar o que o cartão guarda.

## Critérios de conclusão

- [x] Durante a edição, negrito, itálico com asterisco e com sublinhado, negrito com itálico, riscado, código, marca, cor, links, links entre quadros e escapes com barra aparecem formatados; os marcadores ficam à vista só na linha do cursor.
- [x] Durante a edição, blocos de código, tabelas, réguas e alertas aparecem formatados; o código não recebe formatação dentro dele, e a tabela mostra o texto dela, com as barras, quando o cursor está nela.
- [x] O cartão guarda o markdown de cada linha, e a exibição fora da edição mostra o mesmo que a edição, sem os marcadores.
- [x] Ctrl+Z e Ctrl+Shift+Z desfazem e refazem dentro do cartão; Ctrl+B, Ctrl+I, Ctrl+E e Ctrl+K, e os botões da barra, escrevem a marcação em volta da seleção e a retiram quando já está lá.
- [x] Colar várias linhas cria as linhas com os tipos e o recuo de cada uma, e colar um endereço sobre um texto selecionado faz um link.
- [x] Os cartões guardados antes aparecem iguais; o negrito, o itálico, o riscado e o código guardados como HTML viram a marcação equivalente quando o cartão é editado.
- [x] Durante a composição do teclado, as linhas não são redesenhadas.
- [x] Os testes automáticos cobrem os itens acima e acusam mutações introduzidas no editor.
- [x] O autor escreve num cartão, no Boox e no computador, e confirma que a marcação aparece formatada enquanto escreve, sem atrapalhar o teclado.

## Registro

### 2026-11-11

- O autor pediu a edição completa de markdown nos cartões, com pré-visualização ao vivo, e o Fable 5.2 como conselheiro. O conselho e a escolha da abordagem estão no [plano](../plano.md).
- Implementação, a publicar com a casca 0.20.0:
  - `web/app/compat/editor-md.js`, novo: a gramática da marcação dentro da linha, a mesma para a edição e a exibição; o desenho de cada linha a partir do texto, com os marcadores em `span.mk`; a classificação das linhas em código, tabela, régua e alerta, como a exibição do artefato agrupa os blocos; a guarda e a reposição do cursor por deslocamento no texto; o desfazer próprio; os atalhos, o colar e os botões novos da barra.
  - Em `web/montagem/mudancas.cjs`, 16 mudanças novas ligam o artefato ao editor: a gramática e a decoração da exibição, a leitura e a gravação do cartão em edição, a entrada, o colar, o tipo das linhas, a barra da edição, o texto colado no quadro, a exportação em PNG e a ajuda dos atalhos.
  - Só as linhas cuja forma mudou são redesenhadas, comparando o desenho novo com o atual; nada é redesenhado entre o começo e o fim de uma composição do teclado.
  - A tabela, durante a edição, é uma linha flexível por linha da tabela, com a largura de cada coluna medida pela fonte do cartão, para as colunas ficarem alinhadas; o alinhamento à direita e ao centro vem da linha separadora.
- Descobertas: o tratador de colar do quadro, em fase de captura, levava a imagem colada para fora do cartão em edição; uma mudança a manda para o cartão. A margem entre linhas do artefato separava as linhas da tabela e do código; o editor as junta.
- A visualização foi feita no Chromium, pelo Playwright, porque esta sessão não tem o MCP do Chrome DevTools; as capturas foram enviadas ao autor.
- Testes: `web/testes/editor-md.test.cjs`, novo, com 9 testes no Chromium.
- Critério 8: das 26 mutações introduzidas em `editor-md.js`, cobrindo as três etapas, 25 foram acusadas na primeira rodada. A que passou mostrou um caso sem teste, o sublinhado colado ao fim de uma palavra, como em `a_b_ c`; com o teste reforçado, ela foi acusada, e a execução de controle passou.
- O detector da skill `impeccable` não apontou nada. A casca compila, e os testes nativos passam. A suíte da página tem 132 testes, e a do servidor, 50, todos passando; `web/index.html` continua igual ao artefato publicado.
- Critérios 1 a 8 verificados pelos testes, como descrito acima. Falta, para o critério 9, o teste do autor no Boox e no computador, com a casca 0.20.0.

### 2026-11-11, depois da publicação

- Mesclado o PR #54; a casca 0.20.0 foi publicada como `casca-32`, e a página, na VPS. O autor disse que testou e que "ficou muito bom", sem dizer em quais aparelhos; o critério do teste dele fica aberto até ele confirmar o Boox e o computador.

### 2026-11-11, depois do teste do autor

- O autor confirmou, depois de perguntado se o teste incluiu o Boox, o computador e a sincronização de um cartão com imagem: "Sim, todos os testes passaram. Deu tudo certo." Com isso, o critério do teste dele foi marcado.

## Resultado

Concluída em 2026-11-11. Os critérios 1 a 8 foram verificados pelos 9 testes de `web/testes/editor-md.test.cjs`, no Chromium, e pela rodada de 26 mutações, todas acusadas depois de um reforço no teste, como descrito no Registro. O critério 9 foi verificado pelo autor, que testou no Boox e no computador e confirmou que deu tudo certo.
