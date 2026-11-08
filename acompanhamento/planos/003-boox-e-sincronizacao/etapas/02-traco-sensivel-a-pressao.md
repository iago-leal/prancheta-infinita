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
- [x] O Registro traz uma medição feita no Boox, com traços de pressão leve, média e forte, comparando a espessura do traço provisório com a do definitivo.
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

### 2026-11-08, vídeo do autor com a versão 0.3.1

- O autor recebeu a 0.3.1 pela atualização dentro do aplicativo e gravou o vídeo IMG_5256, de 16 s, com a caneta verde.
- A troca do traço provisório pelo definitivo passou a acontecer cerca de 1 s depois de levantar a caneta, nos quatro traços do vídeo, sem o piscar da tela inteira. A linha fantasma não apareceu.
- Medição do primeiro traço, nos quadros sem a mão: 7.744 pixels escuros antes da troca, aos 4,0 s, e 7.612 depois, aos 5,5 s, uma diferença menor que 2%; o ajuste de 20% no contorno igualou a espessura.
- O traço provisório sai mais claro: contraste com o fundo de cerca de 58 níveis antes da troca e de 89 depois, como o autor observou, com o verde ficando mais escuro na atualização. O modo rápido da tela colorida mostra as cores mais pálidas.
- Versão 0.3.2, código 6: a cor da caneta vai escurecida para a camada da Onyx, multiplicada por 0,65, a proporção inversa do contraste medido, por `Tinta.AJUSTE_DE_COR`; o marca-texto segue com a cor original. Um teste JUnit novo cobre a cor da camada; são 23 ao todo.

### 2026-11-08, versão 0.3.2 no Boox

- O autor atualizou para a 0.3.2 e relatou que o traço provisório da caneta verde passou a sair preto e só fica verde na atualização da tela; o vermelho continuou vermelho, e só o verde escureceu.
- Interpretação: o modo rápido da tela colorida parece só acender ou apagar cada canal de cor, sem tons intermediários. O verde da caneta, `#2E8B57`, escurecido em 0,65, fica com o canal verde em 90 numa escala até 255 e se apaga por inteiro; o vermelho da Prancheta, `#D2453B`, escurecido, fica com o canal vermelho em 136 e continua aceso. O limite estaria entre esses dois valores, e o tom do traço provisório não pode ser ajustado pela cor enviada à camada: escurecer só faz a cor virar preto.
- Versão 0.3.3, código 7: a camada da Onyx volta a receber a cor da página sem mudança, como na 0.3.1, em que o verde provisório saía mais claro, mas verde. O teste da cor da camada passou a conferir que ela é igual à da página; seguem 23 testes JUnit.

### 2026-11-08, medição da pressão no vídeo do autor com a versão 0.3.2

- O autor gravou o vídeo IMG_5257, de 15,5 s, com três traços retos feitos com a caneta padrão, de cor `#2F2E2B`, em sequência: pressão leve, média e forte.
- Método: em cada quadro, a largura de cada traço foi medida à meia intensidade do perfil transversal, em pixels do vídeo, na mediana de cerca de 320 linhas. Como o foco e a exposição da câmera mudam ao longo do vídeo e alteram as larguras medidas em até 15%, cada traço foi comparado com um traço vizinho, já definitivo, no mesmo quadro.
- A troca do provisório pelo definitivo aconteceu cerca de 1 s depois de levantar a caneta nos três traços: aos 7,9 a 8,0 s, aos 11,4 a 11,6 s e entre 13,9 e 14,3 s.
- Espessura dos definitivos, no fim do vídeo: 3,2, 4,6 e 6,6 pixels do vídeo, na proporção de 1 para 1,4 para 2,0. A espessura varia com a pressão.
- Traço leve: 3,8 a 3,9 pixels antes da troca e 3,6 depois. Não havia traço vizinho para referência, e a exposição mudou no mesmo momento; a diferença, de até 7%, fica dentro da incerteza.
- Traço médio: em relação ao traço leve, a largura passou de 1,26 vez antes da troca para 1,29 vez depois. A espessura é a mesma, com diferença de até 3%.
- Traço forte: entre os quadros de 13,7 a 13,8 s e os de 14,4 a 14,5 s, com o foco e a exposição iguais, pois o traço médio mede 4,44 e 4,54 pixels, o provisório mediu 7,8 pixels e o definitivo, 6,5, cerca de 20% a menos. Já nos quadros de 13,3 a 13,5 s, com outra exposição, a proporção entre o traço forte e o médio foi de 1,43 antes e depois da troca. O provisório forte fica, portanto, entre 0 e 20% mais largo que o definitivo. Parte da diferença pode vir de ele ser mais escuro, porque a resposta da câmera às intensidades não é linear.
- Cor: o provisório sai preto e sólido, e o definitivo, cinza-escuro com uma textura pontilhada, mais visível no traço forte. A cor padrão da caneta, com os três canais em 47 de 255, já fica abaixo do limite do modo rápido; por isso, o provisório dessa caneta deve continuar preto na 0.3.3.
- Conclusão: com pressão leve e média, a espessura não muda na troca; com pressão forte, o provisório pode sair até 20% mais largo. O ajuste do contorno não foi mudado, porque a diferença é incerta e aparece só na pressão forte; a confirmação do autor no critério 5 decide se o traço forte precisa de um ajuste próprio.

## Resultado
