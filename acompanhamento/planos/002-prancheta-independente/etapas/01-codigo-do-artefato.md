---
tipo: etapa
plano: "002"
etapa: "01"
titulo: Código do artefato no repositório
status: pendente
depende_de: []
iniciada_em:
concluida_em:
---

# Etapa 01: código do artefato no repositório

## Objetivo

Trazer o código do artefato e os seis áudios do roteiro guiado para o repositório, sem mudar o comportamento, e registrar o inventário de tudo o que o código pede ao claude.ai. Essa versão intacta serve de linha de base para as etapas seguintes.

## Critérios de conclusão

- [ ] O `index.html` e os seis áudios do artefato estão em `web/`, como publicados, e o hash de cada arquivo confere com o da versão publicada.
- [ ] A página abre no Chromium, servida localmente e sem `window.claude`, no modo local do próprio artefato, sem erros de JavaScript.
- [ ] Um teste no Chromium cria um cartão e um traço no modo local e confirma que eles continuam lá depois de recarregar a página.
- [ ] Um documento em `web/` lista cada recurso do claude.ai que o código usa, os métodos chamados, os caminhos do banco e o que acontece quando o recurso falta.
- [ ] O documento também lista as requisições externas que a página faz, como a `perfect-freehand` e a fonte Inter.

## Registro

## Resultado
