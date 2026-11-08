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

## Resultado
