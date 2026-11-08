# O que o código do artefato pede ao claude.ai

Inventário do `web/index.html`, copiado sem mudanças da versão `1793918104-39f4` do artefato <https://claude.ai/artifact/8kN6XdqPT5mL5274xCRtEM>, em 2026-11-08. Os hashes dos arquivos publicados estão em `web/artefato-publicado.sha256`; para conferir, rode `sha256sum -c web/artefato-publicado.sha256` a partir da raiz do repositório.

Este documento orienta a camada de compatibilidade do plano 002: ela precisa imitar só o que está listado aqui.

## Como o código obtém os recursos

A função `cloud()` chama `claude.use(nome)` para nove recursos ao mesmo tempo: `db`, `user`, `downloads`, `assets`, `sample`, `mcp`, `permissions`, `artifact` e `comments`. Cada recurso que falha vira `null`, e a página desliga o que depende dele.

Sem `window.claude`, ou sem o recurso `db`, a página entra no modo local: mostra o estado "local" e guarda tudo no `localStorage` do navegador. O script de resgate, no início da página, também usa `db` e `artifact` para restaurar uma cópia do código, e mostra um aviso se a página não terminar de iniciar em 8 segundos.

## Recursos

| Recurso | O que o código chama | Sem o recurso | A camada precisa oferecer? |
|---|---|---|---|
| `db` | documentos e coleções; ver a seção seguinte | modo local, no `localStorage` | sim |
| `assets` | `upload(blob, { type })`, que devolve `{ id }`; a leitura é feita por `fetch('/_blob/<id>')` e `<img src="/_blob/<id>">`, na mesma origem da página, com ids de 8 a 64 caracteres entre letras, números, `_` e `-` | imagens ficam embutidas como `data:` URL, reduzidas a 1.400 px; outros arquivos são recusados com um aviso | sim, incluindo o caminho `/_blob/<id>` |
| `downloads` | `save({ filename, data })`, com `data` em `Blob`, para exportar PNG e baixar arquivos | os botões de download não fazem nada | sim |
| `user` | `id()`, que identifica o usuário no histórico da conversa; `canEdit()`, que, quando falso, deixa o quadro somente para leitura | o quadro fica editável | sim, com um único usuário que pode editar |
| `sample` | o próprio recurso é chamado como função, `sample(mensagens, opções)`, para a conversa com o Claude; `limits()` informa os limites | a conversa fica desligada | não na primeira versão |
| `mcp` | `listTools()`, `describeTool(servidor, ferramenta)` e `callTool(servidor, ferramenta, argumentos, opções)`, usados pela conversa, por "salvar no Google Drive" e pela narração do roteiro guiado vinda do ElevenLabs | essas funções somem | não |
| `permissions` | `request([...])` e `manage()`, para pedir acesso à conversa e aos conectores | o item do menu some | não |
| `comments` | `canSendToClaude()`, `anchorFor(elemento)` e `sendToClaude({ anchor, text })`, para enviar pedidos de ajuda | o pedido de ajuda mostra que o envio não está disponível | não |
| `artifact` | `publish(html)`, para a autopublicação do código e o resgate; `metadata(urls)`, para mostrar o título de links para outros artefatos | a autopublicação some, e os links ficam sem título | não |

## O banco de dados

### Operações

- `db.doc(caminho)` devolve um documento com `get()`, `set(dados)`, `update(campos)`, `delete()` e `onSnapshot(aoMudar, aoFalhar)`.
- `db.collection(caminho)` devolve uma coleção com `get()`, `doc(id)` e `onSnapshot(aoMudar, aoFalhar)`.
- O instantâneo de um documento tem `exists`, `data()`, `id` e `metadata.fromCache`.
- O instantâneo de uma coleção tem `docs`, cada um com `id` e `data()`, `docChanges()`, cada mudança com `type`, incluindo `'removed'`, e `doc`, e `metadata.fromCache`.
- As assinaturas devolvem uma função que cancela o acompanhamento.
- O código trata estes códigos de erro em `e.code`: `revoked` e `not_granted`, que levam ao modo local; `store_unavailable`, que leva a repetir o envio de arquivo uma vez; além de `conflict`, `quota_exceeded`, `too_large`, `invalid_argument`, `unavailable`, `cancelled`, `not_in_manifest`, `invalid_request` e `unsupported_type`, ligados à gravação, aos arquivos e aos conectores.

### Caminhos

| Caminho | Tipo | Conteúdo |
|---|---|---|
| `library/index` | documento | biblioteca de quadros e pastas, acompanhada em tempo real |
| `canvas-meta/main` | documento | título e descrição do quadro principal |
| `canvas-shards` | coleção | fragmentos com os itens do quadro principal |
| `boards/<id>/meta/main` | documento | título e descrição de cada outro quadro |
| `boards/<id>/shards` | coleção | fragmentos de cada outro quadro; cada documento traz `items`, `rev` e `by` |
| `roteiros/<id>` | documento | roteiro guiado do quadro, com `etapas`; o áudio de cada etapa vem de `audio.arquivo`, como os MP3 de `web/audio/`, ou de uma sessão do ElevenLabs lida pelos conectores |
| `ajuda` | coleção | pedidos de ajuda enviados ao Claude pelos comentários |
| `data/users/<uid>/chat` e `data/users/<uid>/chat-<id>` | documento | histórico da conversa com o Claude, por usuário e por quadro |
| `web/usage` | documento | contagem mensal de uso da conversa |
| `diag/log` | documento | diagnóstico do aparelho: navegador, tela e desempenho |
| `code/main`, `code/c<n>`, `code-backup/main` e `code-backup/c<n>` | documentos | cópia do próprio código, em partes de 180.000 caracteres, para a autopublicação e o resgate |

## O modo local

No modo local, o quadro principal fica em `prancheta.board`, e cada outro quadro em `prancheta.board.<id>`. Os itens são guardados como strings JSON, um por item, e a gravação acontece cerca de 1,3 s depois da última mudança. A página também guarda `prancheta.view`, `prancheta.chat`, `prancheta.device`, `prancheta.ink`, `prancheta.last`, `prancheta.lib`, `prancheta.mode`, `prancheta.open`, `prancheta.pen`, `prancheta.quota`, `prancheta.see` e `prancheta.side`.

## Requisições externas

Observadas no teste da linha de base, com a página aberta no Chromium:

- `https://fonts.googleapis.com/css2?family=Inter:...`, a folha de estilo da fonte Inter, que por sua vez carrega os arquivos de fonte de `fonts.gstatic.com`; a página também abre conexão antecipada com os dois servidores.
- `https://cdn.jsdelivr.net/npm/perfect-freehand@1.2.2/dist/esm/index.mjs`, carregado por `import()` dinâmico; é a mesma versão já copiada para a casca Android.

Além dessas, a narração do roteiro guiado pode tocar áudios do ElevenLabs por endereços externos, mas só quando os conectores estão disponíveis.
