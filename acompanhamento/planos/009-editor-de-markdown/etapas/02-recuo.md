---
tipo: etapa
plano: "009"
etapa: "02"
titulo: "Recuo com Tab e listas aninhadas"
status: em_andamento
depende_de: []
iniciada_em: 2026-11-11
concluida_em:
---

# Etapa 02: recuo com Tab e listas aninhadas

## Objetivo

Fazer o Tab recuar as linhas do cartão, para aninhar listas como no GitHub, também no iPad e no Boox sem teclado.

## Critérios de conclusão

- [x] Tab e Shift+Tab aumentam e diminuem o recuo das linhas selecionadas, até seis níveis, em qualquer tipo de linha; numa linha de código, põem e tiram dois espaços.
- [x] Enter numa linha de lista vazia e recuada, e Backspace no início de uma linha recuada, diminuem o recuo.
- [x] As listas numeradas contam por nível, em algarismos, romanos e letras, na edição, na exibição e na exportação em PNG; os tópicos mudam de marcador a cada nível.
- [x] O recuo é guardado no cartão, e o texto colado no quadro ou no cartão guarda o recuo das listas.
- [x] A barra da edição tem os dois botões de recuo.
- [x] Os testes automáticos cobrem os itens acima.
- [ ] O autor confirma no Boox e no computador que o Tab recua as linhas e que as listas aninhadas aparecem como espera.

## Registro

### 2026-11-11

- O recuo é o campo `n` de cada linha, de 1 a 6, e aparece como `data-n`, com 2em de margem por nível; a numeração é calculada em `EditorMd.numeros` e mostrada por `data-num`. Uma linha de outro tipo encerra as listas do mesmo nível e dos mais fundos.
- Um aparelho uma versão atrás ignora o recuo ao mostrar e o perde se editar o cartão.
- Os critérios automáticos foram verificados pelos testes de `web/testes/editor-md.test.cjs` e pela rodada de mutações registrada na [etapa 01](01-pre-visualizacao.md). Falta o teste do autor.

### 2026-11-11, depois da publicação

- Mesclado o PR #54; a casca 0.20.0 foi publicada como `casca-32`, e a página, na VPS. O autor disse que testou e que "ficou muito bom", sem dizer em quais aparelhos; o critério do teste dele fica aberto até ele confirmar o Boox e o computador.
