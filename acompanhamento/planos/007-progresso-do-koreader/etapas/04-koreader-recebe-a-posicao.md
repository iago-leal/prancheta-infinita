---
tipo: etapa
plano: "007"
etapa: "04"
titulo: "O KOReader recebe a posição da Prancheta"
status: em_andamento
depende_de: ["03"]
iniciada_em: 2026-11-10
concluida_em:
---

# Etapa 04: o KOReader recebe a posição da Prancheta

## Objetivo

Fechar a troca nos dois sentidos: o que o autor lê na Prancheta, o KOReader oferece como ponto de retomada.

## Critérios de conclusão

- [x] Ao gravar a posição, a Prancheta grava também o caminho até o parágrafo em que a página começa, no formato do KOReader.
- [x] O KOReader, ao pedir o progresso de um livro, recebe o mais recente entre o que ele gravou e o que a Prancheta gravou: a página, nos PDFs, e esse caminho, nos EPUBs, com o aparelho identificado como Prancheta.
- [x] Uma posição da Prancheta sem caminho não é entregue ao KOReader, que continua recebendo a dele.
- [x] Nos testes, o caminho gerado pela Prancheta, lido de volta pela conversão da etapa 02, cai no mesmo parágrafo, com mutações.
- [ ] O autor lê na Prancheta, abre o livro no KOReader, aceita a sincronização e chega ao trecho, num EPUB e num PDF.

## Registro

### 2026-11-10

- Mesclado o PR #46, com a etapa 03. O autor aprovou estes critérios, ciente do risco de o KOReader não entender o caminho, e contou que fez os testes e que a sincronização funcionou.
- Implementação, a publicar com a casca 0.14.0:
  - Leitor: ao gravar a posição de um EPUB, monta o caminho no formato do KOReader até o bloco de texto, parágrafo ou título, em que a página à vista começa: o capítulo, na ordem de leitura e a partir de 1, e os passos desde o corpo dele, cada um com o nome do elemento e, só quando há irmãos de mesmo nome, a ordem entre eles; termina em `/text().0` quando o bloco tem texto próprio, e em `.0` quando não tem. O caminho sobe do itálico ou do link até o parágrafo, para depender menos de como cada leitor divide o texto.
  - Servidor: o pedido de gravação aceita `caminho`, conferido pelo formato e pelo tamanho, e recusado num PDF. A rota do KOSync passa a devolver ao KOReader o mais recente entre o que ele gravou e o que a Prancheta gravou no formato dele, com o aparelho como "Prancheta (Boox)" ou "Prancheta (computador)" e sem a posição exata. No mesmo segundo, vale o do KOReader.
  - A leitura do caminho, da etapa 02, passou a aceitar o começo do capítulo escrito como `/body/DocFragment[N]/body.0`, que é como a Prancheta o grava quando a página começa fora de um parágrafo.
- Limites conhecidos: o caminho aponta o começo do parágrafo, e não a linha em que a página começa, de modo que o KOReader pode abrir até uma página antes; e ele foi montado pela descrição do formato, sem o KOReader à mão, como a leitura da etapa 02. Se o KOReader não entender um caminho, ele deve ficar onde estava, mas só o teste do autor confirma.
- Critérios 1 e 4 verificados pelo teste novo de `web/testes/progresso.test.cjs`, com a página e o servidor num só endereço: no começo do livro e em três pontos do capítulo longo, o caminho montado aponta o título ou o parágrafo em que a página à vista começa, com a ordem dele entre os parágrafos, e, lido de volta pela conversão da etapa 02, cai nesse mesmo parágrafo, na página à vista; o caminho sobe do itálico até o parágrafo, termina em `.0` num parágrafo que só tem um link, aponta o começo do capítulo quando parte do corpo e fica vazio para um nó de fora do livro; ao virar a página, o pedido de gravação leva o caminho, e o KOReader simulado o recebe, com a porcentagem e o aparelho como "Prancheta (computador)", sem a posição exata; num PDF, a gravação vai sem caminho, e o KOReader recebe o número da página.
- Critérios 2 e 3 verificados pelo teste novo de `servidor/testes/kosync.test.cjs`: o KOReader recebe a posição mais nova da Prancheta, num EPUB e num PDF, com o aparelho identificado como Prancheta e só com os campos do protocolo, enquanto o aparelho da Prancheta continua lendo a posição exata; recebe a dele quando ela é a mais nova ou do mesmo segundo; continua com a dele quando a Prancheta gravou sem caminho, e recebe uma resposta vazia para um livro que só a Prancheta leu, sem caminho; e o servidor recusa um caminho fora do formato, grande demais ou num PDF.
- As 27 mutações desta etapa e do rótulo da posição, descrito na etapa 02 do plano 006, foram todas acusadas, uma delas depois de um reforço no teste da página do livro, e a execução de controle passou. A suíte da página tem 108 testes, e a do servidor, 46, todos passando.
- Critério 5 espera o autor, com a casca 0.14.0 e a versão nova do servidor, que o GitHub publica na VPS depois da mescla, sem rodar o roteiro de novo.
