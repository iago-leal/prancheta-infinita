---
tipo: etapa
plano: "004"
etapa: "04"
titulo: Sensibilidade à pressão e pontos do fundo mais espaçados
status: concluida
depende_de: ["03"]
iniciada_em: 2026-11-09
concluida_em: 2026-11-09
---

# Etapa 04: sensibilidade à pressão e pontos do fundo mais espaçados

## Objetivo

Dar ao autor um controle da sensibilidade da caneta à pressão, porque o traço de hoje, que ele avalia como uns 90% de sensibilidade, varia demais de espessura com pouca diferença de força, e afastar um pouco mais os pontos do fundo do quadro, em cerca de 15%. As duas mudanças valem no Boox e no navegador do computador, por escolha do autor.

## Critérios de conclusão

- [ ] Nas opções da caneta, um controle deslizante "Sensibilidade à pressão", de 0 a 100%, que começa em 90% e, nessa posição, desenha o traço igual ao de hoje. Abaixo de 90%, a diferença entre a pressão leve e a forte diminui; a 0%, o traço tem espessura constante; acima de 90%, a diferença aumenta. A posição escolhida fica guardada no aparelho.
- [ ] No Boox, a casca aplica o mesmo ajuste à pressão que entrega à Onyx, para que o traço provisório e o definitivo continuem com a mesma forma em qualquer posição do controle.
- [x] Os pontos do fundo ficam 15% mais espaçados em todos os níveis de zoom.
- [x] Testes cobrem a curva de pressão, na página e na casca, e o espaçamento dos pontos.
- [ ] O autor confirma no Boox que o controle muda a sensibilidade como esperado, que o traço não muda quando a tela se atualiza e que os pontos ficaram mais espaçados.
- [x] Nas opções da caneta, o controle "Sensibilidade à pressão", de 0 a 100%, começa em 90%, o traço de antes. Abaixo de 90%, a escrita leve fica mais fina e é preciso mais força para engrossar o traço; a 0%, o traço fica sempre fino; acima de 90%, o traço engrossa com menos força. A posição escolhida fica guardada no aparelho.

## Registro

### 2026-11-09

- O autor pediu esta etapa ao detalhar a seguinte do plano 004, no lugar das ferramentas de reorganização, que dispensou, e aprovou os critérios acima; o controle de sensibilidade tinha sido adiado na etapa 02 do plano 003.
- Risco conhecido antes de começar: o SDK da Onyx não oferece ajuste documentado da resposta à pressão do traço provisório. No modo usado pela casca, o traço provisório é desenhado pelo sistema a partir da leitura direta da caneta, e não dos eventos que a casca recebe, de modo que mudar a pressão desses eventos não deve alcançá-lo. O sistema tem uma chamada não documentada, `setStrokeParameters`, que recebe parâmetros por estilo de traço, e o blog da Boox diz que o aplicativo de notas dela regula a sensibilidade da caneta padrão; resta descobrir no Boox se essa é a via.
- Controle na página, com seis mudanças novas na lista, 37 ao todo: nas opções da caneta, entre as espessuras e a estabilização, o controle "Sensibilidade à pressão", de 0 a 100% em passos de 5, começa em 90%. Na escala de pressão da Prancheta, a pressão bruta elevada a 0,65, o ajuste aproxima a pressão de 0,5, ou a afasta dele, na proporção da sensibilidade sobre 90: em 90%, nada muda; a 0%, toda pressão vale 0,5 e o traço tem espessura constante. A pressão ajustada é a que o traço guarda, de modo que mudar o controle não altera os traços já feitos. A escolha fica guardada com as opções da caneta, no armazenamento local do aparelho. O marca-texto, que não varia com a pressão, não tem o controle. Na casca, a estabilização e a previsão continuam escondidas com a tinta da Onyx, mas a sensibilidade aparece.
- Pontos do fundo: o passo continua dobrando e caindo à metade com o zoom, para ficar entre 14 e 44 pixels, e o resultado é multiplicado por 1,15, o que deixa os pontos 15% mais espaçados em qualquer zoom.
- Casca: a página envia a sensibilidade junto com a tinta, e a casca ajusta a pressão de cada ponto pela mesma conta, em `Tinta.ajustarPressao`, antes de entregá-lo à Prancheta e antes de calcular o contorno com o motor da Onyx; a tinta vale a do começo do traço. Em 90%, a pressão bruta segue intacta. O traço provisório continua desenhado pelo sistema com a pressão lida da caneta, e por isso, fora dos 90%, pode diferir do definitivo; isso depende do teste no Boox, pelo critério 2.
- Diagnóstico: ao ligar o diagnóstico em "Mais opções", a casca mostra, num aviso, a pressão máxima da caneta e os parâmetros de traço que o sistema da Onyx guarda para os estilos de 0 a 7, lidos por `getStrokeParameters`, a contraparte de leitura de `setStrokeParameters`. A leitura não muda nada; serve para descobrir, com o autor, se algum parâmetro regula a resposta à pressão do traço provisório, por exemplo comparando os valores antes e depois de mudar a sensibilidade da caneta no aplicativo de notas da Boox.
- Testes: 4 testes novos no Chromium, 72 na web, e 5 testes JUnit novos, 41 na casca. Os testes da web acusam as seis mutações introduzidas: o ajuste neutro, os pontos sem o fator de 1,15, o controle escondido na casca, a tinta sem a sensibilidade, o controle que não grava a escolha e o diagnóstico que não mostra os parâmetros. O detector da skill Impeccable aponta só os dois avisos que já vinham do artefato original, a fonte Inter e o brilho colorido do roteiro guiado. Versão 0.4.0 da casca, código 14.
- Os critérios 1, 3 e 4 foram verificados pelos testes "o controle de sensibilidade à pressão ajusta a pressão dos traços da caneta e fica guardado", com a caneta simulada pelo protocolo do Chromium, "na casca, o controle de sensibilidade aparece com a tinta nativa e chega à casca", "os pontos do fundo ficam 15% mais espaçados em todos os níveis de zoom" e pelos testes JUnit da sensibilidade, em `TintaTest`. Faltam o teste no Boox, do critério 2, e a confirmação do autor, do critério 5.

- O autor testou a 0.4.0 no Boox: a 0%, o traço fica grosso demais, porque a curva aproximava toda pressão da pressão média, e "não resolve". Também observou que o traço engrossou quando a tela se atualizou, o que confirma que o traço provisório da Onyx não segue o controle: o critério 2 não passa por ora. Perguntado, o autor escolheu que menos sensibilidade mantenha fina a escrita leve e exija mais força para engrossar, sabendo que, no Boox, o traço pode mudar na atualização da tela até descobrirmos como regular a Onyx.
- Curva refeita, na mesma mudança da lista e em `Tinta.ajustarPressao`: na escala de pressão da Prancheta, a pressão é elevada a 90 sobre a sensibilidade. Em 90%, nada muda; a 45%, a pressão é elevada ao quadrado; a 0%, toda pressão vale a mínima, 0,04, e o traço fica sempre fino; acima de 90%, o traço engrossa com menos força. A força máxima continua dando o traço mais grosso em qualquer sensibilidade acima de zero. Casca 0.4.1, código 15.
- Mudança de critério: o critério 1, "Nas opções da caneta, um controle deslizante "Sensibilidade à pressão", de 0 a 100%, que começa em 90% e, nessa posição, desenha o traço igual ao de hoje. Abaixo de 90%, a diferença entre a pressão leve e a forte diminui; a 0%, o traço tem espessura constante; acima de 90%, a diferença aumenta. A posição escolhida fica guardada no aparelho.", descreve a curva antiga e foi dispensado pelo autor em 2026-11-09, que aprovou no lugar dele o último critério da lista.
- O SDK do lado do aplicativo não tem parâmetro de sensibilidade: o cálculo do contorno da caneta-tinteiro recebe só os pontos, a espessura e a pressão máxima. Resta a chamada do sistema, `setStrokeParameters`, cujos valores o diagnóstico mostra.
- Testes: os testes do controle e da curva foram refeitos, na web e no JUnit, e acusam a volta da curva antiga; 72 testes na web e 41 na casca passam.
- Publicação da 0.4.1: o CI do PR #31 falhou duas vezes sem que o GitHub criasse nenhum job, e o mesmo fluxo, disparado à mão no mesmo commit, passou nos testes e na compilação; a casca 0.4.1 foi publicada como `casca-15`. A publicação na VPS falhou três vezes do mesmo modo, sem job, e passou na quarta tentativa, disparada à mão uns 10 minutos depois.
- O autor atualizou o Boox para a 0.4.1, testou e respondeu "ok". Perguntado, dispensou o critério 2, "No Boox, a casca aplica o mesmo ajuste à pressão que entrega à Onyx, para que o traço provisório e o definitivo continuem com a mesma forma em qualquer posição do controle.", e o trecho "que o traço não muda quando a tela se atualiza" do critério 5: fora de 90%, o traço provisório da Onyx continua com a sensibilidade de antes e muda quando a tela se atualiza. A investigação de `setStrokeParameters` fica guardada como ideia.

## Resultado

Etapa concluída em 2026-11-09, com a casca 0.4.1. Cada critério foi tratado assim:

1. Controle com a curva antiga: dispensado pelo autor, que aprovou o critério 6 no lugar dele.
2. Traço provisório igual ao definitivo em qualquer posição do controle: dispensado pelo autor. No Boox, o traço provisório é desenhado pelo sistema da Onyx com a pressão lida da caneta, e o SDK não oferece ajuste documentado dela; em 90%, nada muda na atualização da tela.
3. Pontos 15% mais espaçados em todos os níveis de zoom: o teste "os pontos do fundo ficam 15% mais espaçados em todos os níveis de zoom", de 0,1 a 4 vezes de zoom, e o teste do autor no Boox.
4. Testes da curva e do espaçamento: na página, os testes do controle com a caneta simulada e o do espaçamento; na casca, os testes JUnit de `Tinta.ajustarPressao`.
5. Confirmação do autor no Boox: o autor testou a 0.4.1 e respondeu "ok"; o trecho sobre o traço não mudar na atualização da tela foi dispensado por ele, e o critério fica sem marca.
6. Controle com a curva nova: o teste "o controle de sensibilidade à pressão ajusta a pressão dos traços da caneta e fica guardado", que confere a 90%, 45%, 0% e 100% a pressão gravada e a escolha guardada no aparelho, o teste da casca com a tinta nativa e o teste do autor no Boox.
