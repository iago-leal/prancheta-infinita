---
tipo: etapa
plano: "001"
etapa: "04"
titulo: Teste no Boox e decisão
status: em_andamento
depende_de: ["03"]
iniciada_em: 2026-11-08
concluida_em:
---

# Etapa 04: teste no Boox e decisão

## Objetivo

Instalar o APK no Boox Note Air4 C do autor, testar a escrita e os gestos e registrar a decisão de arquitetura. Os resultados vêm do autor, que usa o aparelho; o Claude os registra.

## Critérios de conclusão

- [x] O meio de levar o APK ao Boox está definido, registrado e funcionando.
- [x] O APK está instalado no Boox Note Air4 C do autor.
- [ ] A latência percebida foi comparada com a do app de notas nativo, e o resultado está registrado.
- [ ] Os traços caem no lugar certo depois de mover e ampliar a área de desenho.
- [x] Os toques dos dedos chegam à página enquanto a caneta está ativa, permitindo mover e ampliar com dois dedos.
- [ ] O autor avaliou o salto entre o traço provisório e o traço final, e a avaliação está registrada.
- [ ] A decisão de seguir com a casca, ajustá-la ou recorrer à PWA está registrada no plano e no estado.

## Registro

### 2026-11-08

- O PR #3 foi mesclado no `main`, a pedido do autor, e o branch de trabalho recomeçou a partir dele.
- Meio escolhido pelo autor para levar o APK ao Boox: envio pelo aplicativo do Claude. O APK foi compilado do zero a partir do commit `e6154ef` do `main`, com os testes passando, e enviado como `prancheta-casca-0.1.0-debug.apk`, com 21 MB e SHA-256 `6678126e166f5dbe641cd4696fe55adfedb923b7c63c1f0982338330a4b0db34`. Ele é assinado com a chave de depuração do Android.
- Falta o autor confirmar a instalação e relatar o teste. Roteiro combinado:
  1. Abrir o aplicativo e conferir, na barra, se aparece "tinta nativa".
  2. Escrever à mão e comparar a sensação de atraso com a do aplicativo de notas da Boox.
  3. Mover e ampliar com dois dedos e escrever de novo, conferindo se o traço cai sob a caneta.
  4. Observar se o traço provisório some e o definitivo aparece sem salto incômodo.
  5. Tocar em "Limpar" e "Reiniciar vista" com a caneta e com o dedo.
- Primeiro relato do autor: o APK foi instalado no Boox, a barra mostra "tinta nativa" e a escrita está rápida. Isso confirma que o aparelho foi reconhecido como Onyx, que o SDK carregou sem cair na tinta web e que a camada desenha com latência baixa sobre a WebView. Faltam a comparação direta com o aplicativo de notas da Boox, o teste depois de mover e ampliar, os gestos de dois dedos e a avaliação do salto ao levantar a caneta.
- Segundo relato do autor: o zoom com dois dedos funciona muito bem, e o botão "Reiniciar vista" também. O botão "Limpar", porém, deixa os traços na tela; eles só somem depois que o autor move a área com os dedos.
- Diagnóstico: o "Limpar" apaga os traços da página, mas os traços provisórios desenhados pelo controlador da tela continuam visíveis enquanto a camada da Onyx está ligada. O gesto de dois dedos suspende a camada e, por isso, limpa a tela. Antes desse relato, a primeira suspeita era que o SDK bloqueasse os toques da WebView: o modo `FEATURE_ALL_TOUCH_RENDER` inclui o `AppTouchRender`, que instala um ouvinte de toque na WebView e devolve "consumido" para os eventos seguintes ao toque inicial. Como o zoom e o "Reiniciar vista" funcionaram, esse ouvinte não atrapalhou na prática, mas fica anotado caso surjam toques perdidos.
- Correção, na versão 0.1.1: a página chama `Casca.redesenharTela()` depois de limpar, e a `CamadaOnyx.redesenharTudo` desliga a camada, pede uma atualização completa da tela com o modo `GC` e religa a camada 150 ms depois, o mesmo ciclo que o gesto de dois dedos provoca. Um teste novo da página verifica o pedido de redesenho e falha quando ele é retirado.
- O APK `prancheta-casca-0.1.1-debug.apk`, com versionCode 2 e SHA-256 `8aa7c9b4da2f6cd66d56459f623d547000199852f30148ad6a75c1efc80d3844`, foi compilado do zero com essa correção, com os testes passando, e enviado ao autor pelo aplicativo do Claude.

## Resultado
