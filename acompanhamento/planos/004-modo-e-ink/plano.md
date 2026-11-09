---
tipo: plano
id: "004"
titulo: Modo e-ink e ferramentas de reorganização
status: concluido
criado_em: 2026-11-09
concluido_em: 2026-11-09
---

# Plano 004: modo e-ink e ferramentas de reorganização

## Objetivo

Adaptar a interface da Prancheta ao e-ink do Boox, com controles que ocupem pouco espaço e fiquem longe da mão que escreve, sem sombras, animações ou transparências, e com as ferramentas de reorganização previstas para o e-ink: contorno durante o arrasto e mover por toque.

## Por que agora

O plano 003 deixou a escrita no Boox rápida e igual antes e depois da troca do traço, e a sincronização com o computador funcionando. Com o uso diário no Boox, o autor relatou que os controles ocupavam espaço demais no alto da tela, e os ícones selecionados já tinham se mostrado pouco legíveis no e-ink.

## Critério de conclusão do plano

- [ ] No Boox, o autor usa a Prancheta com os controles numa faixa só no alto da tela, sem sombras, animações ou transparências, e reorganiza um quadro com contorno durante o arrasto e mover por toque, confirmando que a tela continua legível e que nada atrapalha a escrita.

## Etapas

| Etapa | Título | Status |
|---|---|---|
| [01](etapas/01-faixa-unica-no-boox.md) | Controles numa faixa só no alto da tela do Boox | concluida |
| [02](etapas/02-modo-e-ink.md) | Modo e-ink na casca e refazer com três dedos | concluida |
| [03](etapas/03-formas-e-laco.md) | Formas num botão só e seleção por laço | concluida |
| [04](etapas/04-sensibilidade-e-pontos.md) | Sensibilidade à pressão e pontos do fundo mais espaçados | concluida |

A etapa 03, pedida pelo autor em 2026-11-09, junta num só botão da barra as formas, a linha e os símbolos elétricos e acrescenta a seleção por laço. A etapa 04, pedida pelo autor no mesmo dia, traz o controle da sensibilidade à pressão e afasta os pontos do fundo.

## Mudança de escopo

Em 2026-11-09, ao detalhar a etapa seguinte à 03, o autor dispensou as duas ferramentas de reorganização previstas, o contorno durante o arrasto e o mover por toque: no Boox, o arrasto atual já está bom e não deixa rastro. Com isso, fica dispensada a parte "e reorganiza um quadro com contorno durante o arrasto e mover por toque" do critério do plano, cujo texto completo é: "No Boox, o autor usa a Prancheta com os controles numa faixa só no alto da tela, sem sombras, animações ou transparências, e reorganiza um quadro com contorno durante o arrasto e mover por toque, confirmando que a tela continua legível e que nada atrapalha a escrita." Na mesma data, o autor confirmou no Boox, com a casca 0.3.9, que a tela continua legível e que nada atrapalha a escrita. As duas ferramentas ficam guardadas como ideia para depois. No lugar delas, o autor pediu a etapa 04.

## Verificação do critério do plano

Verificado em 2026-11-09, exceto a parte dispensada pelo autor, por isso o critério fica sem marca: no Boox, os controles ficam numa faixa só no alto da tela, como o autor confirmou na etapa 01, sem sombras, animações ou transparências, como confirmou na etapa 02; e o autor confirmou, com a casca 0.3.9, que a tela continua legível e que nada atrapalha a escrita. Com a etapa 04 concluída, o plano foi encerrado na mesma data.

## Riscos

- A largura da página na WebView do Boox não foi medida; se ela for menor que 930 px CSS, a faixa passa a ocupar duas linhas.
- O código do artefato é mantido como o original com mudanças listadas; adaptações grandes de interface podem exigir muitas mudanças, e as que valem só na casca ficam no adaptador `web/app/compat/casca.js`.

## Fora do escopo

- Livros e PDFs, previstos para o plano 005.
- Mudanças na interface do computador, exceto as que o autor pedir.
