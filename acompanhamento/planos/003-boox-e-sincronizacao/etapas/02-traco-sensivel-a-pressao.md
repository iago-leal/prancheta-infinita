---
tipo: etapa
plano: "003"
etapa: "02"
titulo: Traço sensível à pressão igual na Onyx e na página
status: pendente
depende_de: ["01"]
iniciada_em:
concluida_em:
---

# Etapa 02: traço sensível à pressão igual na Onyx e na página

## Objetivo

Fazer o traço provisório da camada da Onyx e o traço definitivo da página terem a mesma forma, variando com a pressão, para que nada mude quando a tela se atualiza. O caminho preferido é a casca calcular o contorno de cada traço com o mesmo motor de canetas da Onyx que desenha o traço provisório, como `NeoFountainPen`, e a Prancheta desenhar esse contorno; se isso não for possível, a página aproxima o traço da Onyx por calibração.

## Critérios de conclusão

- [ ] A camada da Onyx desenha com um estilo de caneta sensível à pressão, e a espessura e a cor escolhidas na Prancheta valem também para ela, em qualquer zoom.
- [ ] A Prancheta desenha os traços vindos da casca com a mesma forma do traço provisório, e o traço guardado continua com os pontos, a pressão e o horário originais.
- [ ] O Registro traz uma medição feita no Boox, com traços de pressão leve, média e forte, comparando a espessura do traço provisório com a do definitivo.
- [ ] Testes cobrem a conversão dos traços da casca para a Prancheta, inclusive a escala no zoom.
- [ ] O autor confirma no Boox que, na escrita normal, o traço não muda de forma perceptível quando a tela se atualiza, inclusive na atualização completa.

## Registro

## Resultado
