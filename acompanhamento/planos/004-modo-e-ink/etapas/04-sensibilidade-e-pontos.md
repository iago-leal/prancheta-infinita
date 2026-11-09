---
tipo: etapa
plano: "004"
etapa: "04"
titulo: Sensibilidade à pressão e pontos do fundo mais espaçados
status: em_andamento
depende_de: ["03"]
iniciada_em: 2026-11-09
concluida_em:
---

# Etapa 04: sensibilidade à pressão e pontos do fundo mais espaçados

## Objetivo

Dar ao autor um controle da sensibilidade da caneta à pressão, porque o traço de hoje, que ele avalia como uns 90% de sensibilidade, varia demais de espessura com pouca diferença de força, e afastar um pouco mais os pontos do fundo do quadro, em cerca de 15%. As duas mudanças valem no Boox e no navegador do computador, por escolha do autor.

## Critérios de conclusão

- [ ] Nas opções da caneta, um controle deslizante "Sensibilidade à pressão", de 0 a 100%, que começa em 90% e, nessa posição, desenha o traço igual ao de hoje. Abaixo de 90%, a diferença entre a pressão leve e a forte diminui; a 0%, o traço tem espessura constante; acima de 90%, a diferença aumenta. A posição escolhida fica guardada no aparelho.
- [ ] No Boox, a casca aplica o mesmo ajuste à pressão que entrega à Onyx, para que o traço provisório e o definitivo continuem com a mesma forma em qualquer posição do controle.
- [ ] Os pontos do fundo ficam 15% mais espaçados em todos os níveis de zoom.
- [ ] Testes cobrem a curva de pressão, na página e na casca, e o espaçamento dos pontos.
- [ ] O autor confirma no Boox que o controle muda a sensibilidade como esperado, que o traço não muda quando a tela se atualiza e que os pontos ficaram mais espaçados.

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

## Resultado
