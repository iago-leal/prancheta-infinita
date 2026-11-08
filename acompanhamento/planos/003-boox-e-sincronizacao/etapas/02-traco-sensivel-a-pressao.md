---
tipo: etapa
plano: "003"
etapa: "02"
titulo: Traço sensível à pressão igual na Onyx e na página
status: em_andamento
depende_de: ["01"]
iniciada_em: 2026-11-08
concluida_em:
---

# Etapa 02: traço sensível à pressão igual na Onyx e na página

## Objetivo

Fazer o traço provisório da camada da Onyx e o traço definitivo da página terem a mesma forma, variando com a pressão, para que nada mude quando a tela se atualiza. O caminho preferido é a casca calcular o contorno de cada traço com o mesmo motor de canetas da Onyx que desenha o traço provisório, como `NeoFountainPen`, e a Prancheta desenhar esse contorno; se isso não for possível, a página aproxima o traço da Onyx por calibração.

## Critérios de conclusão

- [ ] A camada da Onyx desenha com um estilo de caneta sensível à pressão, e a espessura e a cor escolhidas na Prancheta valem também para ela, em qualquer zoom.
- [ ] A Prancheta desenha os traços vindos da casca com a mesma forma do traço provisório, e o traço guardado continua com os pontos, a pressão e o horário originais.
- [ ] O Registro traz uma medição feita no Boox, com traços de pressão leve, média e forte, comparando a espessura do traço provisório com a do definitivo.
- [x] Testes cobrem a conversão dos traços da casca para a Prancheta, inclusive a escala no zoom.
- [ ] O autor confirma no Boox que, na escrita normal, o traço não muda de forma perceptível quando a tela se atualiza, inclusive na atualização completa.

## Registro

### 2026-11-08

- O SDK da Onyx traz o motor das canetas sensíveis à pressão. `NeoFountainPenWrapper.computeStrokePoints(pontos, largura, pressãoMáxima)` devolve os pontos do traço com o tamanho de cada um, que o próprio SDK usa como espessura do segmento, com pontas arredondadas, ao desenhar o traço definitivo; é o caminho preferido do objetivo.
- Na casca, a camada passou a usar a caneta-tinteiro da Onyx, `STROKE_STYLE_FOUNTAIN`, ou o marca-texto, `STROKE_STYLE_MARKER`, conforme a ferramenta de tinta, com a cor e a espessura que a Prancheta informa pelo novo aviso `Casca.tinta(json)`. A classe `Tinta` converte a cor do CSS em ARGB e calcula a espessura na tela: a escolhida, vezes o zoom e a densidade, vezes 2,75 na caneta, que é o diâmetro da perfect-freehand do artefato na pressão forte.
- Ao fim de cada traço da caneta, a casca calcula o contorno com o motor da Onyx e o envia com os pontos. A Prancheta guarda os pontos com a espessura no campo `nf` do traço, em coordenadas do quadro, e desenha esses traços por `contornoOnyx`, de `web/app/compat/traco-onyx.js`, carregado também no navegador, para que um quadro feito no Boox apareça igual no computador. Os pontos originais, com a pressão e o horário, continuam guardados.
- A casca fixou em 600 ms o tempo entre levantar a caneta e trocar o traço provisório pelo definitivo, por `setPenUpRefreshTimeMs`, em vez da configuração do aparelho, que o autor observou variar.
- Mudanças novas na lista: o script de contorno carregado junto com os demais, o campo `nf` gravado no traço e o desenho pelo contorno quando ele existe; agora são 10.
- Testes: 3 novos no Chromium, com 9 no adaptador e 29 na bateria da web, e 5 JUnit da `Tinta`. Verificação por mutação: os testes acusam as 12 mutações introduzidas no adaptador, no contorno, na lista de mudanças e na `Tinta`.
- Versão 0.3.0 da casca, código 4, que também traz o atualizador da etapa 06.
- Falta o teste do autor no Boox: o critério 1 e o critério 2, que dependem de ver os traços na tela, a medição do critério 3, a partir de fotos dos traços antes e depois da atualização, e a confirmação do critério 5.

### 2026-11-08, vídeo do autor com a versão 0.3.0

- O autor confirmou que as cores funcionam: o traço provisório já sai na cor escolhida. O vídeo IMG_5255, de 39 s, foi gravado com a caneta preta de propósito.
- A troca do traço provisório pelo definitivo não aconteceu 0,6 s depois de levantar a caneta: o provisório ficou vários segundos na tela e só sumiu numa atualização completa, com a tela piscando, por volta de 5,7 s do vídeo. O aviso da Onyx depois de levantar a caneta chamava só o redesenho da WebView, que não apaga a camada da Onyx.
- Medição, na escrita normal com a caneta preta: nas letras "to" de "que está muito", a área escura passa de 1.304 pixels antes da troca para 1.047 depois, com limiar 80, e de 1.428 para 1.178 com limiar 60; como as letras são as mesmas, o traço provisório aparece cerca de 20% mais grosso que o definitivo. Falta medir separadamente os traços de pressão leve, média e forte.
- Uma linha grossa e escura, que o autor viu aparecer e sumir na atualização da tela, não foi gravada pela Prancheta: depois da atualização, não sobra nem traço nem faixa de marca-texto. A causa provável é a casca reabrir a camada da Onyx a cada mudança das áreas reservadas, que acontece, por exemplo, quando o indicador "Salvando…"/"Salvo" muda de largura depois de cada traço; reabrir a camada, ou mudá-la durante um traço, pode fazer a Onyx perder o fim de um traço e ligá-lo ao seguinte.
- Versão 0.3.1, código 5: as mudanças de áreas reservadas, cor, espessura e zoom passam a ser aplicadas sem reabrir a camada, por `setExcludeRect` e pelos ajustes de traço, e esperam o traço em andamento terminar; mudanças iguais às atuais são ignoradas. Depois de levantar a caneta, a casca desliga a camada por 100 ms e atualiza a região escrita no modo GU, para trocar o provisório pelo definitivo no tempo fixo, sem o piscar completo. O contorno definitivo é engrossado em 20%, por `Tinta.AJUSTE_DO_CONTORNO`, conforme a medição acima. Um teste JUnit novo cobre o ajuste; são 21 ao todo.

## Resultado
