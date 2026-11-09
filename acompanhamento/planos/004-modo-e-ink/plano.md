---
tipo: plano
id: "004"
titulo: Modo e-ink e ferramentas de reorganização
status: em_andamento
criado_em: 2026-11-09
concluido_em:
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
| [02](etapas/02-modo-e-ink.md) | Modo e-ink na casca e refazer com três dedos | em_andamento |
| 03 | Formas num botão só e seleção por laço | pendente |

A etapa 03, pedida pelo autor em 2026-11-09, junta numa só ferramenta da barra as formas, a linha e os símbolos elétricos e acrescenta a seleção por laço; os critérios dela e as etapas seguintes, como as ferramentas de reorganização, serão detalhados com o autor antes de começar.

## Riscos

- A largura da página na WebView do Boox não foi medida; se ela for menor que 930 px CSS, a faixa passa a ocupar duas linhas.
- O código do artefato é mantido como o original com mudanças listadas; adaptações grandes de interface podem exigir muitas mudanças, e as que valem só na casca ficam no adaptador `web/app/compat/casca.js`.

## Fora do escopo

- Livros e PDFs, previstos para o plano 005.
- Mudanças na interface do computador, exceto as que o autor pedir.
