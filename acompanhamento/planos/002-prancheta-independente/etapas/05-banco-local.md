---
tipo: etapa
plano: "002"
etapa: "05"
titulo: Banco local no navegador
status: pendente
depende_de: ["01"]
iniciada_em:
concluida_em:
---

# Etapa 05: banco local no navegador

## Objetivo

Implementar, dentro da página, um banco local em IndexedDB com a interface de documentos e coleções que o código do artefato usa, para que a Prancheta funcione sem internet, no Boox e em qualquer navegador. A sincronização com a VPS fica para o plano 003.

## Critérios de conclusão

- [ ] O banco local implementa, para documentos e coleções, as operações de ler, gravar, atualizar, apagar e listar, com os caminhos e as formas de resposta descritos em `web/inventario-claude.md`.
- [ ] As assinaturas em tempo real avisam a própria página e as outras abas da mesma origem, com `docChanges()` e `metadata.fromCache` como o artefato espera.
- [ ] Os arquivos enviados ficam guardados no banco local e são exibidos de volta sem rede.
- [ ] Cada gravação registra o que mudou e quando, de modo que o plano 003 possa sincronizar com a VPS sem mudar o formato dos dados.
- [ ] Testes no Chromium cobrem cada operação e confirmam que os dados sobrevivem a recarregar a página e a fechar e reabrir o navegador.

## Registro

## Resultado
