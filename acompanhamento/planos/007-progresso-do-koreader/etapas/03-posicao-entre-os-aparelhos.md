---
tipo: etapa
plano: "007"
etapa: "03"
titulo: "A Prancheta envia a posição dela para o outro aparelho"
status: concluida
depende_de: ["02"]
iniciada_em: 2026-11-10
concluida_em: 2026-11-10
---

# Etapa 03: a Prancheta envia a posição dela para o outro aparelho

## Objetivo

Fazer o Boox e o computador compartilharem a posição de leitura: o leitor de um aparelho grava no servidor até onde chegou, e o do outro oferece continuar de lá.

## Critérios de conclusão

- [x] Ao virar páginas, a Prancheta grava no servidor, com a chave do aparelho, a posição exata, a porcentagem, o aparelho e o horário, sem atrasar a leitura e sem erro quando falta rede.
- [x] O outro aparelho da Prancheta, ao abrir o livro, mostra o aviso com o nome do aparelho, e o botão leva à mesma página, sem conversão.
- [x] Abrir um livro sem virar página não grava nada, e o aparelho não recebe aviso da própria gravação.
- [x] O progresso da Prancheta fica legível, junto do do KOReader.
- [x] Os testes automáticos cobrem, com dois perfis, a gravação, o aviso e os casos sem gravação, e acusam mutações introduzidas.
- [x] O autor lê no Boox, abre no computador e continua de lá, e o contrário.

## Registro

### 2026-11-10

- Mesclado o PR #45, com a etapa 02. O autor aprovou estes critérios e escolheu o escopo: esta etapa fica só entre os aparelhos da Prancheta, e o envio da posição ao KOReader, que exige converter para o formato dele, vira a etapa 04, depois de ele testar a etapa 02 com o KOReader de verdade.
- Implementação, a publicar com a casca 0.13.0:
  - Servidor: `PUT /sync/progresso/<id>`, com a chave do aparelho, grava a posição exata, de EPUB ou de PDF, a porcentagem, o nome do aparelho e o identificador dele, em `kosync/+prancheta.json`, um nome que nenhum usuário do KOSync pode ter. A leitura do progresso passa a devolver o mais recente entre o KOReader e os aparelhos. O KOReader continua recebendo só o que ele gravou. O servidor guarda esse progresso mesmo sem o arquivo dos usuários do KOSync, de modo que os aparelhos trocam a posição antes de o KOReader ser configurado.
  - Leitor: grava a posição cerca de dois segundos depois da última virada de página, e ao fechar o livro, só quando o leitor virou a página, saltou pelo sumário, pela busca ou por um link, ou aceitou o aviso; a mesma posição não é gravada duas vezes, e uma gravação que falha por falta de rede é tentada de novo na virada seguinte, sem aviso de erro.
  - Aviso: para o progresso de outro aparelho da Prancheta, o texto é "Na Prancheta do Boox, você parou em N%, hoje às HH:MM." ou "Na Prancheta do computador, …", e o botão vai à posição exata. A gravação do próprio aparelho não gera aviso.
- Defeito de uso achado pelo teste com dois perfis e corrigido: o aviso só era conferido ao abrir o livro, e fechar o livro contava como leitura. Com o livro deixado aberto no Boox enquanto a leitura seguia no computador, o Boox nunca avisava. Agora o aparelho guarda à parte o horário da última vez em que o leitor virou a página, que não muda ao abrir e fechar, e confere o progresso de novo quando a tela volta com o livro aberto. Um aviso dispensado não volta para o mesmo progresso enquanto o livro está aberto.
- Critérios 1 a 5 verificados pelos testes. No servidor, um teste novo cobre a gravação pelos aparelhos, a leitura do mais recente nos dois sentidos, o KOReader recebendo só o que gravou, as recusas sem a chave, 14 pedidos fora do formato, o limite de tamanho, os campos guardados e o servidor sem o arquivo dos usuários; os testes do servidor são 45. Na página, um teste com dois perfis, um deles numa casca simulada: abrir sem virar página não grava; duas viradas geram uma gravação só, com a posição exata, a porcentagem e o nome do aparelho; o outro perfil recebe o aviso com o nome do aparelho e vai à página em que o primeiro parou; o aparelho não recebe aviso da própria gravação, nem com o relógio do servidor adiantado; o livro deixado aberto avisa quando a tela volta, e o aviso dispensado não volta; abrir e fechar não conta como leitura; o PDF vai e volta do mesmo jeito; uma página fora do livro não avisa; sem rede, nada falha, e a posição chega depois. A suíte da página tem 106 testes, todos passando.
- Das 26 mutações introduzidas, 24 foram acusadas na primeira rodada. As 2 que passaram mostraram casos sem teste, o relógio do servidor adiantado e a página fora do livro vinda de outro aparelho; com os testes reforçados, foram acusadas, e a execução de controle passou.
- Um achado sobre os testes: o relógio do servidor de teste ficava parado no início do teste, o que invertia a ordem dos horários; os testes passaram a usar o horário real, com desvio só onde o caso pede.
- O detector da skill `impeccable` não apontou nada.
- Falta, para o critério 6, o teste do autor no Boox e no computador, com a casca 0.13.0.
- Depois da mescla do PR #47, o autor confirmou o critério 6: testou a Prancheta no MacBook e no Boox, e a sincronização da posição funcionou entre os dois. Ele esclareceu que ainda não testou nada com o KOReader; os critérios das etapas 01, 02 e 04 que dependem dele continuam abertos.

## Resultado

O Boox e o computador compartilham a posição de leitura: o leitor grava no servidor a posição exata pouco depois da última virada de página e ao fechar o livro, e o outro aparelho mostra o aviso com o nome do aparelho e um botão que leva à mesma página.

Como cada critério foi verificado:

1. Gravação da posição ao virar páginas, sem atraso e sem erro sem rede: pelos testes do servidor e pelo teste da página com dois perfis.
2. Aviso no outro aparelho, com o botão que leva à mesma página: pelo teste com dois perfis.
3. Abrir sem virar página não grava, e a própria gravação não gera aviso: pelo teste com dois perfis.
4. Progresso da Prancheta legível, junto do do KOReader: pelo teste do servidor, que confere os campos guardados.
5. Testes com dois perfis e mutações: 26 mutações acusadas, 2 delas depois de os testes serem reforçados.
6. Leitura no Boox continuada no computador, e o contrário: pelo autor, em 2026-11-10, no MacBook e no Boox.
