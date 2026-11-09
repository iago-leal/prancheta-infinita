---
tipo: etapa
plano: "004"
etapa: "01"
titulo: Controles numa faixa só no alto da tela do Boox
status: em_andamento
depende_de: []
iniciada_em: 2026-11-09
concluida_em:
---

# Etapa 01: controles numa faixa só no alto da tela do Boox

## Objetivo

Reunir os controles da Prancheta na casca numa faixa só, no alto da tela, para que eles ocupem pouco espaço e fiquem longe da mão que escreve, conforme as escolhas do autor: uma faixa só, o título numa linha e as 14 ferramentas à vista.

## Critérios de conclusão

- [x] Na casca, os controles ficam numa faixa só no alto da tela, com menos de 56 px de altura numa página de 930 px de largura com o painel de quadros fechado, e as 14 ferramentas cabem sem rolar.
- [x] Na casca, o título aparece numa linha, cortado com reticências se for longo, e a descrição do quadro, o aviso "Salvo" e os botões de aumentar e diminuir o zoom não aparecem; no navegador, a interface não muda.
- [x] Na casca, as opções da caneta, o menu do zoom e os avisos abrem abaixo da faixa, sem sombras, e, com a tinta da Onyx, as opções da caneta mostram só a cor e a espessura.
- [ ] O autor confirma no Boox que a faixa ocupa pouco espaço e que todos os controles continuam ao alcance.

## Registro

### 2026-11-09

- O autor relatou, com a casca 0.3.5, que a barra de ferramentas no alto, o título, desfazer, refazer e o zoom ocupavam espaço demais, cerca de 150 px CSS em duas faixas, e pediu para instalar a skill de design Impeccable, de Paul Bakaus, para melhorar a tela do Boox. A skill foi instalada em `.claude/skills/impeccable/`, na versão 4.8.1, com o executável que ela baixa ficando fora do Git e sem os ganchos automáticos.
- Seguindo as referências de adaptação, de simplificação e de interfaces de trabalho da skill, foram propostas três organizações; o autor escolheu uma faixa só, com o título numa linha e todas as ferramentas à vista.
- O adaptador `web/app/compat/casca.js` monta a faixa com os elementos que o artefato já cria, sem recriá-los: à esquerda, o botão do painel de quadros e o título; ao centro, as ferramentas; à direita, a sincronização, desfazer, refazer, o zoom em porcentagem e mais opções. A faixa tem fundo opaco, uma linha embaixo e nenhuma sombra; os botões dela ficam com 32 px de largura. Quando a largura não basta, como com o painel de quadros aberto numa página de 930 px, a faixa ganha uma segunda linha em vez de rolar as ferramentas.
- A descrição do quadro, o aviso "Salvo" e os botões de aumentar e diminuir o zoom deixam de aparecer na casca; o menu do zoom continua com ajustar à tela, 50, 100 e 200%, e o gesto de dois dedos segue ampliando. As opções da caneta, os menus e os avisos abrem abaixo da faixa, sem sombras, e, com a tinta da Onyx, as opções da caneta deixam de mostrar a estabilização e a previsão, que só valem para a tinta desenhada pela página.
- Medição no Chromium, com a casca simulada: a faixa tem 47 px de altura numa página de 930 por 1240 px e de 1240 por 930 px, e 85 px com o painel de quadros aberto em 930 px.
- O detector da skill, `impeccable detect --json web/app/compat/casca.js`, não apontou problemas.
- Testes: os testes da casca passaram a conferir a faixa, com um teste novo para a segunda linha; 61 testes na web, que acusam as 9 mutações introduzidas na faixa. Versão 0.3.6 da casca, código 10.
- Os critérios 1 a 3 foram verificados pelos testes "na casca, os controles ficam numa faixa só, no alto da tela" e "com o painel de quadros aberto numa tela estreita, a faixa ganha uma segunda linha em vez de rolar", e pelo teste "fora da casca, o adaptador não faz nada", que confere a barra embaixo no navegador. Falta a confirmação do autor no Boox.

## Resultado
