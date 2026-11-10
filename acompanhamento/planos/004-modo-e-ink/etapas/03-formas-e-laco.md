---
tipo: etapa
plano: "004"
etapa: "03"
titulo: Formas num botão só e seleção por laço
status: concluida
depende_de: ["02"]
iniciada_em: 2026-11-09
concluida_em: 2026-11-09
---

# Etapa 03: formas num botão só e seleção por laço

## Objetivo

Enxugar a barra de ferramentas, juntando num só botão as formas, a linha e os símbolos elétricos, e acrescentar uma ferramenta de seleção por laço, com que a caneta ou o dedo circula os itens a selecionar, inclusive os traços escritos à mão.

## Critérios de conclusão

- [x] Um botão "Formas" substitui na barra o retângulo, a elipse, o losango, a linha e o símbolo; tocado, abre um painel com as quatro formas e os sete símbolos elétricos à vista. A forma escolhida fica ativa e aparece no ícone do botão; os atalhos de teclado R, O, D, L e S continuam valendo.
- [x] Uma ferramenta de laço, ao lado da seleção: a caneta ou o dedo desenha uma linha livre, e entra na seleção o item que estiver na maior parte dentro do laço, os traços pela maioria dos pontos e os demais itens pelo centro.
- [x] O que o laço seleciona pode ser movido, copiado e apagado como numa seleção comum.
- [x] No Boox, a caneta desenha o laço, sem escrever, e a faixa continua cabendo numa linha.
- [x] Testes cobrem o painel de formas e a seleção pelo laço, com traços, cartões e formas.
- [x] O autor confirma no Boox que o laço seleciona o que ele circula e que o botão de formas deixa a barra mais fácil de usar.

## Registro

### 2026-11-09

- O autor pediu, ao começar a etapa 02, a seleção por laço e um botão só para o quadrado, o círculo, o losango, a seta e os símbolos elétricos, que depois mostrasse tudo o que tem dentro; aprovou estes critérios depois de concluir a etapa 02.
- Hoje, a seleção só funciona por retângulo, arrastando sobre o fundo com a ferramenta de seleção, e cada forma, a linha e o símbolo têm um botão; o botão do símbolo abre um menu com os sete símbolos elétricos, que entram no centro da tela.
- Botão de formas, com cinco mudanças novas na lista da página: na barra, o botão "Formas e símbolos" toma o lugar do retângulo, da elipse, do losango, da linha e do símbolo, e a barra passa de 14 para 11 botões. Tocado, ele abre um painel com as quatro formas e os sete símbolos elétricos, para baixo com a barra no alto, na casca, e para cima com ela embaixo, no navegador. A forma escolhida fica ativa e aparece no ícone do botão; um símbolo entra no centro da tela, como antes. As teclas R, O, D e L continuam escolhendo as formas, e S abre o painel.
- Laço, com sete mudanças novas, 31 ao todo: a ferramenta fica ao lado da seleção, com a tecla A. A caneta, o mouse ou um dedo desenham uma linha livre, e, ao soltar, entra na seleção o traço com a maioria dos pontos dentro do laço e o item com o centro dentro dele; com Shift, o laço soma à seleção. Tocar dentro da seleção já feita a arrasta, como na seleção comum, para que no Boox a própria caneta circule e mova os itens; copiar e apagar seguem pela barra de seleção e pelo teclado. Na casca, o laço não está entre as ferramentas em que a caneta escreve, e a caneta age sobre a página.
- Uma constante `FORMAS` já existia no código original, usada pela conversa com o Claude; a da barra passou a se chamar `FORMAS_DA_BARRA`.
- Testes: 3 testes novos no Chromium, 68 na web, que acusam as 8 mutações introduzidas no painel e no laço; o teste da faixa segue conferindo uma linha só em 860 px. O detector da skill Impeccable aponta, na página, a fonte Inter e o brilho colorido do roteiro guiado, ambos do artefato original; o brilho já some na casca. Versão 0.3.9 da casca, código 13.
- Os critérios 1, 2, 3 e 5 foram verificados pelos testes "o botão de formas abre um painel com as quatro formas e os sete símbolos elétricos", "o laço seleciona os traços pela maioria dos pontos e os demais itens pelo centro", em que a caneta desenha o laço, e "o que o laço seleciona pode ser movido, copiado e apagado como numa seleção comum". Faltam a verificação no Boox, do critério 4, e a confirmação do autor.

### 2026-11-10

- Pedido do autor, depois de a etapa ter sido concluída: a seleção feita com o laço não mostrava a barra flutuante da seleção comum, com as cores, duplicar e excluir. A barra só aparecia com a ferramenta de seleção. Ajuste, na casca 0.18.0, sem mudar os critérios: a barra aparece também com o laço, junto dos itens selecionados; ela some enquanto um laço novo é desenhado e quando não há seleção, e os botões dela agem sobre os itens sem tirar o laço da mão.
- A mudança é a de número 33 em `web/montagem/mudancas.cjs`. O teste "o que o laço seleciona pode ser movido, copiado e apagado como numa seleção comum" passou a conferir a barra: visível com o laço, com os mesmos botões da seleção comum, junto da seleção e dentro da tela, escondida durante o laço, indo junto ao mover os itens, e com a cor, duplicar e excluir agindo sobre eles. Duas mutações foram acusadas: a barra sem o laço, e a barra com qualquer ferramenta e sem seleção. A suíte da página tem 118 testes, todos passando.
- O detector da skill `impeccable` aponta no `index.html` os mesmos 2 itens de antes da mudança, que vêm do artefato original.

## Resultado

Etapa concluída em 2026-11-09, com a casca 0.3.9. Cada critério foi verificado assim:

1. Botão de formas com o painel das quatro formas e dos sete símbolos, o ícone da forma escolhida e os atalhos R, O, D, L e S: o teste "o botão de formas abre um painel com as quatro formas e os sete símbolos elétricos", na casca e no navegador.
2. Laço ao lado da seleção, com os traços pela maioria dos pontos e os demais itens pelo centro: o teste "o laço seleciona os traços pela maioria dos pontos e os demais itens pelo centro", com a caneta e com o dedo.
3. Mover, copiar e apagar o que o laço seleciona: o teste "o que o laço seleciona pode ser movido, copiado e apagado como numa seleção comum".
4. No Boox, a caneta desenha o laço sem escrever, e a faixa cabe numa linha: o autor confirmou no Boox que o laço funcionou; com o laço, a casca deixa a caneta agir sobre a página, como confere o mesmo teste do laço; e a barra passou de 14 para 11 botões, menos que os da faixa que o autor já tinha confirmado numa linha com a 0.3.7, além do teste que confere uma linha só em 860 px.
5. Testes do painel de formas e do laço, com traços, cartões e formas: os três testes acima.
6. Confirmação do autor: no Boox, com a 0.3.9, o laço funcionou, e o botão de formas deixou a barra melhor.

