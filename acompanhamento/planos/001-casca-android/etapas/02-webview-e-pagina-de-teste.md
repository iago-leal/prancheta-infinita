---
tipo: etapa
plano: "001"
etapa: "02"
titulo: WebView com página de teste e ponte JavaScript
status: pendente
depende_de: ["01"]
iniciada_em:
concluida_em:
---

# Etapa 02: WebView com página de teste e ponte JavaScript

## Objetivo

Exibir numa WebView em tela cheia uma página de teste local que desenha com a tinta web atual e que já oferece a ponte para receber traços do lado nativo.

## Critérios de conclusão

- [ ] A Activity exibe em tela cheia uma WebView que carrega `pagina-teste.html` dos assets do APK, sem depender de rede.
- [ ] A página desenha traços da caneta com a `perfect-freehand`, empacotada localmente e usando a pressão, como referência de tinta web.
- [ ] A página move e amplia a área de desenho com dois dedos e informa ao lado nativo a transformação atual, isto é, deslocamento e zoom.
- [ ] A página expõe uma função que recebe uma lista de pontos em coordenadas de tela, com x, y, pressão e tempo, converte-os para as coordenadas do quadro e desenha o traço.
- [ ] A conversão de coordenadas foi verificada no Chromium com Playwright, simulando a ponte nativa, inclusive depois de mover e ampliar a área de desenho.
- [ ] O APK continua compilando com `./gradlew assembleDebug`.

## Registro

## Resultado
