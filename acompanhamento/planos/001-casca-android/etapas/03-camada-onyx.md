---
tipo: etapa
plano: "001"
etapa: "03"
titulo: Camada de tinta da Onyx ligada à página
status: pendente
depende_de: ["02"]
iniciada_em:
concluida_em:
---

# Etapa 03: camada de tinta da Onyx ligada à página

## Objetivo

Sobrepor à WebView a camada de tinta da Onyx, de modo que a caneta desenhe com latência baixa e os pontos de cada traço cheguem à página quando a caneta for levantada. Como a nuvem não tem o aparelho, aqui a verificação é feita pela compilação e pela revisão do código; o comportamento na tela é confirmado na etapa 04.

## Critérios de conclusão

- [ ] As dependências `onyxsdk-base`, `onyxsdk-device` e `onyxsdk-pen` são resolvidas, com versões fixadas e registradas nesta etapa.
- [ ] O código liga a camada da Onyx sobre a WebView e, ao levantar a caneta, entrega os pontos do traço à página pela ponte da etapa 02.
- [ ] O código desliga a camada na área da barra de ferramentas e durante gestos de dois dedos, e a religa quando eles terminam.
- [ ] O código encaminha os toques dos dedos à WebView enquanto a camada está ativa.
- [ ] Em aparelhos sem o SDK da Onyx, o código recorre à tinta web da página em vez de falhar.
- [ ] O APK compila com `./gradlew assembleDebug`.

## Registro

## Resultado
