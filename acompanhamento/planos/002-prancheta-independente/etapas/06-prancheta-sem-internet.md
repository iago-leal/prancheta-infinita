---
tipo: etapa
plano: "002"
etapa: "06"
titulo: Cliente de compatibilidade e Prancheta sem internet
status: concluida
depende_de: ["05"]
iniciada_em: 2026-11-08
concluida_em: 2026-11-08
---

# Etapa 06: cliente de compatibilidade e Prancheta sem internet

## Objetivo

Ligar o código do artefato ao banco local da etapa 05 por um `window.claude.use(nome)` carregado antes dele, com o mínimo de mudanças no código original, e confirmar que a Prancheta funciona inteira sem depender de nenhum servidor para guardar ou ler dados.

## Critérios de conclusão

- [x] `claude.use('db')` entrega o banco local da etapa 05, e `assets`, `downloads`, `user` e `permissions` têm equivalentes que funcionam sem rede.
- [x] Os recursos sem equivalente, como a conversa com o Claude, os conectores MCP, os comentários e a autopublicação, ficam indisponíveis sem erros, e a interface esconde o que depende deles.
- [x] A página não faz nenhuma requisição a servidores externos: a `perfect-freehand` e a fonte são entregues junto com a página.
- [x] Testes no Chromium criam um quadro com cartão, seta, traço e imagem com o servidor que entrega a página já inacessível, recarregam a página depois e confirmam que tudo persistiu.
- [x] Duas abas abertas no mesmo quadro veem as mudanças uma da outra.
- [x] As mudanças feitas no código original estão listadas, com o motivo de cada uma.

## Registro

### 2026-11-08

- A Prancheta independente fica em `web/app/`, uma pasta que qualquer servidor de arquivos estáticos pode entregar. O banco local da etapa 05 passou de `web/compat/` para `web/app/compat/banco-local.js`, para que a pasta reúna tudo o que a página usa; a página de apoio dos testes do banco aponta para o novo lugar.
- `web/app/index.html` é montado a partir do original por `web/montagem/montar.cjs`, que aplica as mudanças listadas em `web/montagem/mudancas.cjs`, cada uma com o motivo. O original `web/index.html` continua sem mudanças e conferido pelos hashes. As sete mudanças: a fonte Inter local no lugar do Google Fonts; o carregamento do banco e do cliente de compatibilidade antes do código; duas trocas no aviso de falha na inicialização, cujo botão passa de restaurar pela autopublicação para recarregar; a `perfect-freehand` local no lugar do jsDelivr; o pdf.js e o mammoth locais no lugar do cdnjs; e a cópia para o Drive, que sem conectores deixa de ser tentada, em vez de marcar cada arquivo com "não foi ao Drive" e oferecer uma ação que não funciona.
- `web/app/compat/claude.js` responde por `window.claude.use(nome)`: `db` entrega o banco local; `assets` guarda os arquivos no banco; `downloads` baixa pelo próprio navegador; `user` é um único usuário, `autor`, que pode editar; `permissions` responde sem conceder nada. Os demais nomes, como `sample`, `mcp`, `artifact` e `comments`, são recusados com o código `unavailable`, e o artefato desliga o que depende deles: o botão e o atalho da conversa, as permissões dos conectores e a restauração do código no menu.
- `web/app/sw.js` guarda os arquivos da página, para abri-la sem rede, e entrega os arquivos enviados em `/_blob/<id>`, lendo-os do banco local, porque o artefato os exibe por `<img src="/_blob/<id>">` e os lê por `fetch`. Cada pedido tenta primeiro o servidor, com prazo de 3 s, e usa a cópia guardada quando ele não responde. Como os arquivos enviados só aparecem com o service worker, `assets` espera até 4 s que ele assuma a página; sem service worker, o recurso é recusado, e o artefato embute as imagens reduzidas no próprio quadro.
- O artefato também carregava o pdf.js e o mammoth do cdnjs ao abrir a prévia de um PDF ou de um documento do Word. Para cumprir o critério de nenhuma requisição externa, as duas bibliotecas passaram a vir de `web/app/vendor/`, nas mesmas versões; o pdf.js também servirá à leitura de PDFs prevista para o futuro. A fonte Inter vem do pacote `@fontsource-variable/inter` 5.3.0, no subconjunto latino. Origens, licenças e hashes estão em `web/montagem/LEIA-ME.md`.
- Ficaram como estão, por dependerem só da conversa com o Claude: as citações a CDNs dos desenhos por código e das instruções da conversa, e os pedidos de ajuda, que só aparecem dentro da conversa. A prévia de links mostra "A leitura da página não está disponível aqui.", sem erro, e mantém a ação de abrir o link.
- O banco local passou a ler e criar o identificador do aparelho numa única transação, porque agora também o service worker abre o banco.
- Testes em `web/testes/app.test.cjs`, 7 no total. O servidor de testes ganhou os tipos de CSS e de fonte, entrega `index.html` para pastas e, ao fechar, corta as conexões abertas, para simular um servidor fora do ar.
- Descoberta: a espera do Playwright, `waitForFunction`, não aguarda funções assíncronas e se dá por satisfeita com a promessa devolvida. Duas esperas pelo banco não esperavam de fato; foram trocadas por uma consulta repetida a partir do Node. Nos testes do banco da etapa 05, as esperas usam só funções síncronas.
- Verificação por mutação: 14 defeitos introduzidos, um de cada vez, na lista de mudanças, no cliente de compatibilidade e no service worker; os testes acusaram todos.
- Observação do autor no Boox, sobre a casca do plano 001: ao tirar a caneta da tela, o traço às vezes muda e fica mais fino, no momento em que o aparelho atualiza a região, conforme o intervalo configurado no tablet, ou quando o autor pede a atualização completa da tela. A causa provável é que o traço provisório da Onyx tem espessura constante, de 4 px CSS ajustados ao zoom, enquanto o traço definitivo da página afina conforme a pressão; a Prancheta real faz o mesmo. Registrado para o plano 003, com a escolha entre traço de espessura constante e traço sensível à pressão a cargo do autor.

## Resultado

Etapa concluída. Verificação de cada critério:

1. O teste "abre com o banco local e recursos sem rede, sem requisições externas e sem erros" confirma, com a rede desligada, que `claude.use('db')` entrega o banco local, que grava e lê; que `assets` guarda um arquivo e o service worker o devolve em `/_blob/<id>`, com 404 para um id inexistente; que `downloads` tem `save`; que `user` é `autor` e pode editar; e que `permissions` responde sem conceder nada. O teste "esconde o que depende da conversa, dos conectores, dos comentários e da autopublicação" baixa um PNG pelo menu com a rede desligada, e o teste da persistência envia uma imagem com o servidor fora do ar.
2. O mesmo teste do item 1 confirma que `sample`, `mcp`, `artifact` e `comments` são recusados com `unavailable`, sem erros na página. O teste "esconde o que depende da conversa, dos conectores, dos comentários e da autopublicação" confirma que o botão e o atalho da conversa não a abrem, que o menu não oferece permissões dos conectores nem restauração do código, e que um arquivo enviado não mostra marca nem ação do Drive. O teste "o aviso de falha na inicialização oferece recarregar, sem depender da autopublicação" simula uma falha e confirma que o aviso oferece só recarregar.
3. Os testes registram todos os pedidos do contexto do navegador, inclusive os do service worker, e confirmam que nenhum sai da origem da página, inclusive ao carregar o pdf.js e o mammoth e ao abrir a prévia de um PDF. O teste "a página independente é o original com as mudanças listadas, cada uma com motivo" confirma que a página não carrega mais a fonte do Google, a `perfect-freehand` do jsDelivr nem o pdf.js e o mammoth do cdnjs; a fonte Inter local aparece carregada.
4. O teste "cria cartão, seta, traço e imagem com o servidor da página fora do ar, e tudo persiste ao recarregar" abre a página, fecha o servidor que a entrega e confirma que ele recusa conexões; cria um cartão, uma seta pelo puxador do cartão até um segundo cartão, um traço com a caneta e uma imagem; confirma no banco local os quatro tipos de item, a seta ligando os dois cartões e a imagem guardada como arquivo; e recarrega a página, ainda com o servidor fora do ar e com o `localStorage` apagado antes do código rodar, para que o quadro só possa vir do banco local. Depois da recarga, os dois cartões, a seta, o traço e a imagem, com 64 por 48 pixels, estão na tela.
5. O teste "duas abas abertas no mesmo quadro veem as mudanças uma da outra" cria um cartão em cada aba e confirma que a outra o vê, e apaga um cartão numa aba e confirma que ele some da outra.
6. As mudanças estão em `web/montagem/mudancas.cjs`, cada uma com o motivo, e resumidas no Registro. O teste do item 3 confirma que `web/app/index.html` é exatamente o original com essas mudanças, e que o montador recusa mudança sem motivo ou com trecho ausente ou repetido.

A bateria `node --test web/testes/*.test.cjs`, com 20 testes, passou três vezes seguidas; o teste "sem service worker, as imagens ficam embutidas no quadro e continuam visíveis" cobre também o caminho sem service worker.
