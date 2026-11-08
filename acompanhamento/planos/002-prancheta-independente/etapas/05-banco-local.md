---
tipo: etapa
plano: "002"
etapa: "05"
titulo: Banco local no navegador
status: concluida
depende_de: ["01"]
iniciada_em: 2026-11-08
concluida_em: 2026-11-08
---

# Etapa 05: banco local no navegador

## Objetivo

Implementar, dentro da página, um banco local em IndexedDB com a interface de documentos e coleções que o código do artefato usa, para que a Prancheta funcione sem internet, no Boox e em qualquer navegador. A sincronização com a VPS fica para o plano 003.

## Critérios de conclusão

- [x] O banco local implementa, para documentos e coleções, as operações de ler, gravar, atualizar, apagar e listar, com os caminhos e as formas de resposta descritos em `web/inventario-claude.md`.
- [x] As assinaturas em tempo real avisam a própria página e as outras abas da mesma origem, com `docChanges()` e `metadata.fromCache` como o artefato espera.
- [x] Os arquivos enviados ficam guardados no banco local e são exibidos de volta sem rede.
- [x] Cada gravação registra o que mudou e quando, de modo que o plano 003 possa sincronizar com a VPS sem mudar o formato dos dados.
- [x] Testes no Chromium cobrem cada operação e confirmam que os dados sobrevivem a recarregar a página e a fechar e reabrir o navegador.

## Registro

### 2026-11-08

- Criado `web/compat/banco-local.js`, um script clássico que expõe `BancoLocal.abrir({ nome })`. O banco devolvido oferece `doc(caminho)` e `collection(caminho)` na forma descrita em `web/inventario-claude.md`, além de `guardarArquivo`, `lerArquivo`, `mudancas` e `fechar`. Os dados ficam no IndexedDB `prancheta-banco-<nome>`, esquema 1, em quatro depósitos: `documentos`, `mudancas`, `arquivos` e `meta`.
- Antes dos testes, o uso do banco no código do artefato foi conferido. O artefato grava com `set` sem mesclagem e com `update` só em campos do primeiro nível; lê o primeiro instantâneo dos fragmentos como `added` de todos os documentos; considera o quadro sincronizado no primeiro instantâneo com `metadata.fromCache` falso; e, se uma gravação falha com `invalid_argument`, deixa o quadro somente para leitura. Por isso, o banco usa `invalid_argument` apenas para caminhos e dados malformados e traduz os erros do IndexedDB: a falta de espaço vira `quota_exceeded`, que mostra o aviso de quadro cheio, e as demais falhas viram `unavailable`, que leva o artefato a repetir a gravação.
- Formato pensado para o plano 003: cada documento guarda versão, horário e aparelho da última gravação; a exclusão deixa uma marca, com `apagado` verdadeiro e `dados` nulo, e a versão continua a subir; toda gravação entra no registro de mudanças com posição, caminho, tipo, versão, horário e aparelho, e o `update` informa também os campos alterados. Os arquivos entram no registro como `_arquivos/<id>`, com o tipo `arquivo`. O identificador do aparelho é criado na primeira abertura e fica em `meta`; junto com a posição no registro, ele identifica cada mudança sem repetição.
- A leitura e a gravação de cada documento acontecem na mesma transação, de modo que vinte atualizações simultâneas no mesmo documento não perdem campos nem repetem versão.
- Avisos: a própria página chama as assinaturas assim que a transação termina, e as outras abas recebem o caminho alterado por um `BroadcastChannel` chamado `prancheta-banco:<nome>`. Cada assinatura relê o banco a cada aviso, e só a leitura mais recente é entregue, o que protege contra leituras que terminam fora de ordem; cancelar a assinatura descarta também a leitura em curso.
- Arquivos: o `Blob` fica no IndexedDB com o tipo informado no envio, e o id tem 32 caracteres hexadecimais, dentro do formato que o artefato aceita em `/_blob/<id>`. Entregar `/_blob/<id>` ao `<img>` e ao `fetch` do artefato fica para a etapa 06, que liga o recurso `assets` ao banco.
- Ao abrir, o banco pede ao navegador armazenamento persistente, por `navigator.storage.persist()`.
- Testes em `web/testes/banco-local.test.cjs`, 11 no total, com a página `web/testes/apoio/banco.html`. O servidor estático dos testes passou para `web/testes/apoio/servidor.cjs`, usado também pelo teste da linha de base.
- Verificação por mutação: 16 defeitos introduzidos no banco, um de cada vez. Na primeira rodada, os testes acusaram 14; os dois que escaparam, cancelar sem descartar a leitura em curso e entregar leituras fora de ordem, ganharam testes próprios, e a segunda rodada acusou os 16. Ainda na primeira rodada, uma mutação deixou aberto o navegador do contexto persistente e prendeu o Node; o teste agora fecha o contexto num `finally`.
- Observações para o plano 003: o registro de mudanças cresce a cada gravação, cerca de 100 bytes por entrada, e deve ser podado depois de cada sincronização; o horário vem do relógio de cada aparelho, que pode divergir entre o Boox e o computador, então a sincronização não deve ordenar mudanças só pelo horário.

## Resultado

Etapa concluída. Verificação de cada critério:

1. Os testes "documentos: gravar, ler, atualizar e apagar", "coleções: listam só os próprios documentos, em ordem, sem os apagados" e "caminhos e dados inválidos são recusados com invalid_argument" cobrem ler, gravar, atualizar, apagar e listar com os caminhos do inventário, como `library/index`, `canvas-meta/main`, `canvas-shards`, `boards/<id>/meta/main`, `boards/<id>/shards` e `ajuda`. Eles conferem as formas de resposta, com `exists`, `data()`, `id`, `metadata.fromCache`, `docs`, `size`, `empty` e `docChanges()`; o isolamento entre coleções vizinhas, como `boards/q1/shards` e `boards/q1/meta`; o erro `not_found` ao atualizar documento inexistente ou apagado; e um fragmento de mais de 200 KB, perto do limite que o artefato grava.
2. Os testes "assinatura de documento avisa a própria página e para quando cancelada", "assinatura de coleção entrega docChanges com added, modified e removed", "leituras que terminam fora de ordem não entregam um estado antigo" e "assinaturas avisam as outras abas da mesma origem" verificam os avisos na própria página e entre duas abas da mesma origem, com `docChanges()` trazendo `added`, `modified` e `removed`, índices antigos e novos, e `metadata.fromCache` sempre falso.
3. O teste "arquivos enviados ficam no banco local e são exibidos sem rede" guarda uma imagem PNG gerada num `canvas`, desliga a rede do contexto, lê a imagem de volta, exibe-a num `<img>` com 64 por 48 pixels e confere a cor de um pixel; um PDF sem tipo no `Blob` volta com o tipo informado no envio. No teste de reabrir o navegador, o arquivo também é lido sem rede.
4. O teste "cada gravação registra o que mudou, quando e em qual aparelho" confere, para cada gravação, o caminho, o tipo, a versão, o horário, o aparelho e os campos do `update`; a marca deixada pela exclusão; a leitura do registro a partir de uma posição; e as vinte atualizações simultâneas sem perda.
5. Os 11 testes cobrem cada operação no Chromium. "os dados sobrevivem a recarregar a página" recarrega a página e relê documentos, coleção, arquivo, aparelho e registro; "os dados sobrevivem a fechar e reabrir o navegador" abre duas vezes, em processos separados do navegador, a mesma pasta de perfil e a mesma origem, e confere tudo de novo, já sem rede. A bateria `node --test web/testes/*.test.cjs` passou três vezes seguidas, com 13 testes, os 11 novos e os 2 da linha de base.
