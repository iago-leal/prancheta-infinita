---
tipo: etapa
plano: "002"
etapa: "01"
titulo: Código do artefato no repositório
status: concluida
depende_de: []
iniciada_em: 2026-11-08
concluida_em: 2026-11-08
---

# Etapa 01: código do artefato no repositório

## Objetivo

Trazer o código do artefato e os seis áudios do roteiro guiado para o repositório, sem mudar o comportamento, e registrar o inventário de tudo o que o código pede ao claude.ai. Essa versão intacta serve de linha de base para as etapas seguintes.

## Critérios de conclusão

- [x] O `index.html` e os seis áudios do artefato estão em `web/`, como publicados, e o hash de cada arquivo confere com o da versão publicada.
- [x] A página abre no Chromium, servida localmente e sem `window.claude`, no modo local do próprio artefato, sem erros de JavaScript.
- [x] Um teste no Chromium cria um cartão e um traço no modo local e confirma que eles continuam lá depois de recarregar a página.
- [x] Um documento em `web/` lista cada recurso do claude.ai que o código usa, os métodos chamados, os caminhos do banco e o que acontece quando o recurso falta.
- [x] O documento também lista as requisições externas que a página faz, como a `perfect-freehand` e a fonte Inter.

## Registro

### 2026-11-08

- A versão publicada do artefato continuava a `1793918104-39f4`, a mesma lida em 2026-11-07. Os sete arquivos publicados foram baixados pela ferramenta de artefatos, que informa o SHA-256 de cada um, e copiados para `web/`.
- O teste da linha de base, em `web/testes/linha-de-base.test.cjs`, serve `web/` localmente e responde à requisição da `perfect-freehand` no jsDelivr com a cópia idêntica já usada na casca, já que a rede do ambiente não alcança o jsDelivr. A fonte do Google é bloqueada, e todas as requisições externas são registradas.
- Na primeira versão do teste, a verificação da gravação local falhou porque cada item é guardado no `localStorage` como uma string JSON própria; o teste passou a decodificar os itens.
- Descobertas que orientam as próximas etapas:
  - Os arquivos enviados são lidos por `fetch('/_blob/<id>')` e `<img src="/_blob/<id>">`, na mesma origem da página; o servidor precisará responder nesse caminho.
  - Os quadros guardam os itens em fragmentos, num documento de metadados e numa coleção por quadro, e a assinatura da coleção usa `docChanges()` e `metadata.fromCache`.
  - Os seis MP3 não aparecem no código: cada etapa de um roteiro guardado no banco aponta para um arquivo em `audio.arquivo`, ou para uma sessão do ElevenLabs lida pelos conectores.
  - Sem o recurso `assets`, a página embute as imagens como `data:` URL, reduzidas a 1.400 px, e recusa os demais arquivos.

## Resultado

Etapa concluída. Verificação de cada critério:

1. `sha256sum -c web/artefato-publicado.sha256` confere os sete arquivos com os hashes informados pela ferramenta de artefatos, e os tamanhos batem com a listagem dos arquivos publicados.
2. O teste "abre no modo local, sem window.claude e sem erros" confirma que `window.claude` não existe, que o aviso de resgate não aparece e que não há erros de JavaScript.
3. O teste "cartão e traço criados no modo local continuam lá depois de recarregar" cria um cartão com duplo clique e um traço com a caneta, espera a gravação no `localStorage`, recarrega a página e encontra os dois. Os dois testes passaram em duas execuções seguidas.
4. `web/inventario-claude.md` lista os nove recursos, os métodos chamados, as operações e os caminhos do banco, os códigos de erro tratados, o modo local e o comportamento de cada recurso quando ele falta.
5. O mesmo documento lista as duas requisições externas observadas no teste, a fonte Inter e a `perfect-freehand`, além dos áudios do ElevenLabs, que só aparecem com os conectores.
