---
tipo: etapa
plano: "001"
etapa: "02"
titulo: WebView com página de teste e ponte JavaScript
status: concluida
depende_de: ["01"]
iniciada_em: 2026-11-08
concluida_em: 2026-11-08
---

# Etapa 02: WebView com página de teste e ponte JavaScript

## Objetivo

Exibir numa WebView em tela cheia uma página de teste local que desenha com a tinta web atual e que já oferece a ponte para receber traços do lado nativo.

## Critérios de conclusão

- [x] A Activity exibe em tela cheia uma WebView que carrega `pagina-teste.html` dos assets do APK, sem depender de rede.
- [x] A página desenha traços da caneta com a `perfect-freehand`, empacotada localmente e usando a pressão, como referência de tinta web.
- [x] A página move e amplia a área de desenho com dois dedos e informa ao lado nativo a transformação atual, isto é, deslocamento e zoom.
- [x] A página expõe uma função que recebe uma lista de pontos em coordenadas de tela, com x, y, pressão e tempo, converte-os para as coordenadas do quadro e desenha o traço.
- [x] A conversão de coordenadas foi verificada no Chromium com Playwright, simulando a ponte nativa, inclusive depois de mover e ampliar a área de desenho.
- [x] O APK continua compilando com `./gradlew assembleDebug`.

## Registro

### 2026-11-08

- O PR #1 foi mesclado no `main`, e o branch de trabalho recomeçou a partir dele.
- A `perfect-freehand` 1.2.2, de licença MIT, foi copiada do npm para `assets/vendor/perfect-freehand/`, com a licença ao lado. O módulo tem 3,7 KB, não importa nada externo e tem SHA-256 `0ddf0e44c727ab39d7211af95685bf12234236f0e2eca376091e5791a71626e4`.
- O módulo foi salvo com extensão `.js`, e não `.mjs`, porque o carregador de assets do Android pode não reconhecer o tipo `.mjs`, e o navegador recusa módulos com tipo errado.
- A página é servida pelo `WebViewAssetLoader`, do `androidx.webkit` 1.18.0, no endereço `https://appassets.androidplatform.net/assets/`. Assim, os módulos JavaScript funcionam sem liberar o acesso a arquivos da WebView, que fica desligado.
- O manifesto pede a permissão de internet. A página não a usa, mas a Prancheta real virá da VPS, e isso evita depender de como cada WebView trata endereços interceptados sem essa permissão.
- Contrato da ponte, documentado no código: coordenadas em pixels CSS relativos ao canto superior esquerdo da página; vista segundo `tela = quadro * k + (x, y)`; a página chama `Casca.pronta()` e `Casca.transformacao(json)`; a casca chama `prancheta.receberTraco(pontos)`, e a `PonteCasca.enviarTraco` converte pixels físicos em CSS dividindo pela densidade da tela.
- Nas versões de depuração, a WebView aceita inspeção remota pelo `chrome://inspect`, útil no teste da etapa 04.
- O teste em `android/testes/pagina-teste.test.cjs` serve os assets num servidor local, bloqueia e registra acessos externos, simula a ponte com um objeto `Casca` falso e gera a caneta e os dois dedos por eventos de entrada do próprio Chromium. No Node 22, o `--test` não aceita diretório, então o comando usa o padrão `android/testes/*.test.cjs`.
- Para confirmar que os testes detectam defeitos, dois defeitos foram introduzidos de propósito e depois desfeitos: a conversão ignorando o zoom derrubou o teste do traço nativo, e a caneta ignorando a pressão derrubou o teste da pressão.
- A máquina de nuvem não tem virtualização por hardware, sem `/dev/kvm`, então não é possível rodar um emulador Android aqui.

## Resultado

Etapa concluída. Verificação de cada critério:

1. Verificado pelo código e pela inspeção do APK, sem execução num aparelho: a `MainActivity` cria a WebView como conteúdo da tela, esconde as barras do sistema e carrega `https://appassets.androidplatform.net/assets/pagina-teste.html`, que o `WebViewAssetLoader` responde a partir dos assets; o `unzip -l` do APK mostra `assets/pagina-teste.html`, o script e a biblioteca. A exibição em si será observada no Boox, na etapa 04.
2. O teste "a caneta desenha com a perfect-freehand e usa a pressão" desenha dois traços de caneta, com pressão 0,15 e 1, e confirma a pressão registrada e o traço leve com menos de 60% da espessura do forte. O teste de carregamento confirma que nenhum arquivo externo foi pedido.
3. O teste "dois dedos movem e ampliam a área e avisam a casca" afasta dois dedos de 100 para 200 px, confirma zoom 2 e o deslocamento esperado e espera que a última transformação enviada ao `Casca` seja igual à da página.
4. O teste do traço nativo chama `prancheta.receberTraco` com pontos de tela, com x, y, pressão e tempo, e confere cada ponto convertido para o quadro.
5. O mesmo teste, depois do gesto de dois dedos, confere que o traço nativo e um traço de caneta aparecem na tela sob os pontos de origem. Os quatro testes passam com `node --test android/testes/*.test.cjs`.
6. `./gradlew assembleDebug` gerou um APK de 2,1 MB com os assets, a permissão de internet e as classes `MainActivity`, `PonteCasca` e `WebViewAssetLoader`.
