# Prancheta independente: montagem

A pasta `web/app/` guarda a Prancheta independente do claude.ai, pronta para ser servida por qualquer servidor de arquivos estáticos. Ela funciona sem internet: os dados ficam num banco local em IndexedDB, dentro da página, e um service worker guarda a própria página para abri-la sem rede.

## Como a página é formada

`web/app/index.html` não é editado à mão. Ele é o código original do artefato, `web/index.html`, com as mudanças listadas em `web/montagem/mudancas.cjs`, cada uma com o seu motivo. O original continua sem nenhuma mudança e conferido por `web/artefato-publicado.sha256`.

- Montar, a partir da raiz do repositório: `node web/montagem/montar.cjs`.
- Conferir que o arquivo gravado é o resultado da montagem: `node web/montagem/montar.cjs --conferir`. O teste `web/testes/app.test.cjs` faz a mesma conferência.

Para mudar o código da Prancheta, acrescente uma entrada em `mudancas.cjs`, com o trecho original, o trecho novo e o motivo, e monte de novo.

## O que há em `web/app/`

| Caminho | O que é |
|---|---|
| `index.html` | página montada |
| `compat/banco-local.js` | banco local em IndexedDB, da etapa 05 do plano 002 |
| `compat/claude.js` | cliente de compatibilidade: responde por `window.claude.use(nome)` com o banco local e com equivalentes de `assets`, `downloads`, `user` e `permissions` |
| `sw.js` | service worker: guarda os arquivos da página e entrega os arquivos enviados em `/_blob/<id>`, lendo-os do banco local |
| `fontes/` | fonte Inter |
| `vendor/` | bibliotecas que o artefato buscava em CDNs |

## Arquivos de terceiros

Todos foram obtidos do registro do npm, nas mesmas versões que o artefato pedia às CDNs, com as licenças ao lado.

| Arquivo | Pacote e versão | Licença | SHA-256 |
|---|---|---|---|
| `vendor/perfect-freehand/index.js` | `perfect-freehand` 1.2.2, `dist/esm/index.mjs`, a mesma cópia da casca Android | MIT | `0ddf0e44c727ab39d7211af95685bf12234236f0e2eca376091e5791a71626e4` |
| `vendor/pdfjs/pdf.min.js` | `pdfjs-dist` 3.11.174, `build/pdf.min.js` | Apache-2.0 | `5b5799e6f8c680663207ac5b42ee14eed2a406fa7af48f50c154f0c0b1566946` |
| `vendor/pdfjs/pdf.worker.min.js` | `pdfjs-dist` 3.11.174, `build/pdf.worker.min.js` | Apache-2.0 | `feabdf309770ed24bba31a5467836cdc8cf639c705af27d52b585b041bb8527b` |
| `vendor/mammoth/mammoth.browser.min.js` | `mammoth` 1.6.0 | BSD-2-Clause | `596ef52239e52d8ee3cee10b2ee4a72596abf900d0e4f468593f956e9f1809b0` |
| `fontes/inter-latin-opsz-normal.woff2` | `@fontsource-variable/inter` 5.3.0, subconjunto latino com os eixos de peso e de tamanho óptico | OFL-1.1 | `2c295d99e26dcf357d4d01bcf270fd6924b600c9a13dd8c363ef114f4c6976fa` |
| `fontes/inter-latin-opsz-italic.woff2` | idem, itálico | OFL-1.1 | `c58f9d530baa7e96355f444502eca739d5eefa0f328f3d635b73648373214629` |

O subconjunto latino cobre o português; caracteres fora dele usam a fonte do sistema.

## Limites conhecidos

- O service worker só funciona em contexto seguro: `https`, `localhost` ou a casca. Sem ele, a página funciona, mas o recurso `assets` fica indisponível, e o artefato embute as imagens reduzidas no próprio quadro e recusa outros arquivos.
- Na primeira visita, a página só passa a abrir sem rede depois que o service worker termina de se instalar, o que leva menos de um segundo num servidor próximo. Uma recarga forçada, que ignora o service worker, também deixa os arquivos enviados sem exibição até a recarga seguinte.
- Os desenhos por código e as instruções da conversa ainda citam CDNs, mas só existem quando a conversa com o Claude está disponível, o que não acontece fora do claude.ai.
- Empacotar esta pasta dentro da casca Android, com o service worker servido pela casca, fica para o plano 003.
