---
tipo: etapa
plano: "004"
etapa: "03"
titulo: Formas num botão só e seleção por laço
status: em_andamento
depende_de: ["02"]
iniciada_em: 2026-11-09
concluida_em:
---

# Etapa 03: formas num botão só e seleção por laço

## Objetivo

Enxugar a barra de ferramentas, juntando num só botão as formas, a linha e os símbolos elétricos, e acrescentar uma ferramenta de seleção por laço, com que a caneta ou o dedo circula os itens a selecionar, inclusive os traços escritos à mão.

## Critérios de conclusão

- [x] Um botão "Formas" substitui na barra o retângulo, a elipse, o losango, a linha e o símbolo; tocado, abre um painel com as quatro formas e os sete símbolos elétricos à vista. A forma escolhida fica ativa e aparece no ícone do botão; os atalhos de teclado R, O, D, L e S continuam valendo.
- [x] Uma ferramenta de laço, ao lado da seleção: a caneta ou o dedo desenha uma linha livre, e entra na seleção o item que estiver na maior parte dentro do laço, os traços pela maioria dos pontos e os demais itens pelo centro.
- [x] O que o laço seleciona pode ser movido, copiado e apagado como numa seleção comum.
- [ ] No Boox, a caneta desenha o laço, sem escrever, e a faixa continua cabendo numa linha.
- [x] Testes cobrem o painel de formas e a seleção pelo laço, com traços, cartões e formas.
- [ ] O autor confirma no Boox que o laço seleciona o que ele circula e que o botão de formas deixa a barra mais fácil de usar.

## Registro

### 2026-11-09

- O autor pediu, ao começar a etapa 02, a seleção por laço e um botão só para o quadrado, o círculo, o losango, a seta e os símbolos elétricos, que depois mostrasse tudo o que tem dentro; aprovou estes critérios depois de concluir a etapa 02.
- Hoje, a seleção só funciona por retângulo, arrastando sobre o fundo com a ferramenta de seleção, e cada forma, a linha e o símbolo têm um botão; o botão do símbolo abre um menu com os sete símbolos elétricos, que entram no centro da tela.
- Botão de formas, com cinco mudanças novas na lista da página: na barra, o botão "Formas e símbolos" toma o lugar do retângulo, da elipse, do losango, da linha e do símbolo, e a barra passa de 14 para 11 botões. Tocado, ele abre um painel com as quatro formas e os sete símbolos elétricos, para baixo com a barra no alto, na casca, e para cima com ela embaixo, no navegador. A forma escolhida fica ativa e aparece no ícone do botão; um símbolo entra no centro da tela, como antes. As teclas R, O, D e L continuam escolhendo as formas, e S abre o painel.
- Laço, com sete mudanças novas, 31 ao todo: a ferramenta fica ao lado da seleção, com a tecla A. A caneta, o mouse ou um dedo desenham uma linha livre, e, ao soltar, entra na seleção o traço com a maioria dos pontos dentro do laço e o item com o centro dentro dele; com Shift, o laço soma à seleção. Tocar dentro da seleção já feita a arrasta, como na seleção comum, para que no Boox a própria caneta circule e mova os itens; copiar e apagar seguem pela barra de seleção e pelo teclado. Na casca, o laço não está entre as ferramentas em que a caneta escreve, e a caneta age sobre a página.
- Uma constante `FORMAS` já existia no código original, usada pela conversa com o Claude; a da barra passou a se chamar `FORMAS_DA_BARRA`.
- Testes: 3 testes novos no Chromium, 68 na web, que acusam as 8 mutações introduzidas no painel e no laço; o teste da faixa segue conferindo uma linha só em 860 px. O detector da skill Impeccable aponta, na página, a fonte Inter e o brilho colorido do roteiro guiado, ambos do artefato original; o brilho já some na casca. Versão 0.3.9 da casca, código 13.
- Os critérios 1, 2, 3 e 5 foram verificados pelos testes "o botão de formas abre um painel com as quatro formas e os sete símbolos elétricos", "o laço seleciona os traços pela maioria dos pontos e os demais itens pelo centro", em que a caneta desenha o laço, e "o que o laço seleciona pode ser movido, copiado e apagado como numa seleção comum". Faltam a verificação no Boox, do critério 4, e a confirmação do autor.

## Resultado
