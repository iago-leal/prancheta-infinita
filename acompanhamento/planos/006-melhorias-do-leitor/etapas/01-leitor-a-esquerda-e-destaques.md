---
tipo: etapa
plano: "006"
etapa: "01"
titulo: Leitor à esquerda e destaques editáveis ao toque
status: em_andamento
depende_de: []
iniciada_em: 2026-11-10
concluida_em:
---

# Etapa 01: leitor à esquerda e destaques editáveis ao toque

## Objetivo

Abrir o leitor à esquerda do quadro, para que a mão direita escreva no quadro sem cobrir o livro, e fazer do toque num destaque o caminho para apagá-lo, trocar o estilo dele, anotá-lo e levá-lo ao quadro.

## Critérios de conclusão

- [ ] Lado a lado, o leitor abre à esquerda do quadro, com o quadro e os controles dele à direita; um botão do leitor troca o lado, e a escolha fica guardada no aparelho.
- [ ] Tocar num destaque, no EPUB e no PDF, mostra na barra do leitor o trecho dele com "Apagar", a troca de estilo entre realce e sublinhado, a nota e "Levar ao quadro".
- [ ] Apagar um destaque o tira do livro neste aparelho e, depois da sincronização, no outro; a exclusão é marcada, e não removida da lista, para que os aparelhos a combinem; o cartão já levado ao quadro continua lá, com o link abrindo o livro na posição.
- [ ] Um destaque pode receber e ter editada uma nota, que sincroniza com ele e vai para o cartão quando o destaque é levado ao quadro.
- [x] Os testes automáticos cobrem o lado do leitor e a troca, o toque no destaque, apagar, trocar o estilo e anotar no EPUB e no PDF, a sincronização dessas mudanças entre dois perfis com a cifra, e acusam mutações introduzidas.
- [ ] O autor confirma no Boox que o leitor abre à esquerda, que a caneta escreve no quadro à direita sem riscar o livro, e que apaga e anota um destaque tocando nele.

## Registro

### 2026-11-10

- O autor aprovou o plano 006 e estes critérios. Duas escolhas da proposta, aceitas com ela: um botão troca o lado do leitor, guardado em cada aparelho, e apagar um destaque não apaga o cartão que já foi para o quadro.
- Implementação, a publicar com a casca 0.9.0:
  - Lado do leitor: lado a lado, o painel abre à esquerda do quadro, depois do painel dos quadros quando ele está aberto em telas largas; o título, o botão do painel e as ferramentas do quadro passam para a direita do leitor. O botão "⇄" do leitor troca o lado, e a escolha fica no armazenamento local do aparelho. Em tela inteira, o leitor fica por cima de tudo; lado a lado, fica abaixo do painel dos quadros, que em telas estreitas abre por cima dele. Fora da casca, o controle de zoom some quando sobra pouco quadro ao lado do leitor, para não ficar sobre as ferramentas; na casca, os controles ficam na faixa do alto, acima do leitor.
  - Toque no destaque: no EPUB, a epub.js entrega o toque na anotação, e um toque que é o fim de uma seleção é ignorado; no PDF, cada pedaço de texto destacado leva o id do destaque. O toque abre a barra do destaque, no lugar da barra da seleção, com o trecho, o campo da nota com "Guardar nota", também por Enter, a troca de estilo, "Levar ao quadro", "Apagar" e "Fechar". Selecionar outro trecho fecha a barra.
  - Dados: cada destaque ganhou `estilo`, realce ou sublinhado, `nota`, `mudadoEm` e, quando apagado, `apagadoEm`; o apagado continua na lista do documento do livro, e as leituras o deixam de fora. Como a sincronização combina a lista item a item, a exclusão e as mudanças chegam ao outro aparelho, e a barra aberta nele fecha quando o destaque some.
  - Desenho: no EPUB, o sublinhado usa a anotação de sublinhado da epub.js, com a linha desenhada pelo estilo do leitor, porque o estilo padrão dela contornava o trecho inteiro; no PDF, uma linha sob cada pedaço de texto.
  - Cartão: a nota do destaque entra entre o trecho e a linha do livro; o cartão nasce na parte do quadro que sobra do painel dos quadros e do leitor, de qualquer lado.
- Testes: o do leitor passou a conferir o leitor à esquerda, começando onde termina o painel dos quadros, com o título, os controles e as ferramentas do quadro à direita dele, a troca de lado pelo botão e o lado guardado depois de recarregar. Dois novos nas marcações: no EPUB, com dois perfis e a cifra, o toque abre a barra, o toque fora não, o estilo muda o desenho, a nota vai para o cartão, o apagado fica marcado na lista e some do livro, o outro perfil recebe o sublinhado com a nota, e o destaque apagado nele some do primeiro com a barra aberta; no PDF, o toque, o estilo, a nota e apagar. O teste da casca confere o painel à esquerda nas áreas reservadas, o quadro à direita livre e nenhum controle debaixo do leitor. A página tem 92 testes.
- Critério 5 verificado: das 11 mutações introduzidas, 10 foram acusadas: o lado padrão, o lado não guardado, as ferramentas sob o leitor, o toque ignorado no EPUB e no PDF, a exclusão que remove em vez de marcar, os apagados visíveis, o estilo sem mudar o desenho, a nota fora do cartão e o cartão sob o leitor. A que passou tira uma limpeza do id do destaque aberto que não muda o comportamento, porque a barra já some quando o destaque não está mais na lista.
- O detector da skill `impeccable` não apontou nada.
- A testar no Boox, com a casca 0.9.0: o toque num destaque dentro do livro, com o dedo e com a caneta, que é o risco da etapa, e a largura do quadro ao lado do leitor.

## Resultado
