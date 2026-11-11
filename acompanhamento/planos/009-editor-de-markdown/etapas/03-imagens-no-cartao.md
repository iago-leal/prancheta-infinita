---
tipo: etapa
plano: "009"
etapa: "03"
titulo: "Imagens dentro do cartão"
status: em_andamento
depende_de: []
iniciada_em: 2026-11-11
concluida_em:
---

# Etapa 03: imagens dentro do cartão

## Objetivo

Pôr imagens dentro de um cartão de nota, entre as linhas de texto, sincronizadas como as demais imagens do quadro.

## Critérios de conclusão

- [x] Com um cartão em edição, uma imagem colada, solta sobre ele ou escolhida pelo botão da barra entra no cartão, na linha seguinte à do cursor, e não vira uma imagem solta no quadro.
- [x] A imagem é guardada no banco local pelo mesmo caminho das imagens soltas, e o cartão guarda a linha `![descrição](/_blob/<id>)`; `![descrição|largura](...)` dá a largura.
- [x] Fora da linha do cursor, só a imagem aparece; na linha do cursor, aparecem também o texto dela e a imagem.
- [x] Um endereço de fora numa imagem fica como link, sem requisição externa.
- [x] A exportação em PNG desenha as imagens dos cartões.
- [x] Os testes automáticos cobrem os itens acima.
- [ ] O autor põe uma imagem num cartão no computador e a vê no Boox, depois da sincronização.

## Registro

### 2026-11-11

- Imagens grandes, acima de 2 MB ou de 2400 pixels no lado maior, são reduzidas antes de guardar, para o cartão não pesar na sincronização.
- Se a edição termina enquanto a imagem é guardada, a linha vai para o fim do cartão, pelo desfazer do quadro.
- Os critérios automáticos foram verificados pelos testes de `web/testes/editor-md.test.cjs` e pela rodada de mutações registrada na [etapa 01](01-pre-visualizacao.md). Falta o teste do autor.

### 2026-11-11, depois da publicação

- Mesclado o PR #54; a casca 0.20.0 foi publicada como `casca-32`, e a página, na VPS. O autor disse que testou e que "ficou muito bom", sem dizer em quais aparelhos; o critério do teste dele fica aberto até ele confirmar o Boox e o computador.
