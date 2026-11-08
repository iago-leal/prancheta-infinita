---
tipo: etapa
plano: "003"
etapa: "04"
titulo: Sincronização no banco local
status: concluida
depende_de: ["03"]
iniciada_em: 2026-11-08
concluida_em: 2026-11-08
---

# Etapa 04: sincronização no banco local

## Objetivo

Ensinar o banco local a conversar com o servidor da etapa 03: enviar as mudanças registradas desde a última sincronização, receber as dos outros aparelhos e combiná-las sem perder itens, sempre que houver rede, sem que a Prancheta dependa disso para funcionar.

## Critérios de conclusão

- [x] Com rede, o banco local envia as mudanças registradas desde a última sincronização e recebe as dos outros aparelhos, sem travar a página, e as assinaturas avisam a Prancheta do que chegou.
- [x] Quando dois aparelhos mudam o mesmo fragmento de um quadro, nenhum item se perde: os itens são combinados um a um, e a regra para o mesmo item mudado nos dois aparelhos está descrita no Registro.
- [x] Sem rede, a Prancheta funciona como antes, e a sincronização retoma sozinha quando a rede volta.
- [x] O registro de mudanças é podado depois de cada sincronização confirmada pelo servidor.
- [x] O endereço do servidor e a chave de acesso são informados uma única vez em cada aparelho e ficam no banco local, fora do código.
- [x] Testes no Chromium, com dois perfis de navegador e o servidor da etapa 03, confirmam que um quadro feito num perfil aparece no outro, inclusive com edições simultâneas e um período sem rede.

## Registro

### 2026-11-08

- Arquivos: `web/app/compat/sincronizacao.js` faz os ciclos e a interface; `web/app/compat/combinar.js` combina duas versões de um documento a partir da base; o banco local, em `web/app/compat/banco-local.js`, ganhou as operações que a sincronização usa. A página montada carrega os dois arquivos novos, pela mudança 2 de `web/montagem/mudancas.cjs`, e o service worker os guarda para abrir sem rede, na versão `prancheta-app-4`.
- No banco local, tudo o que a sincronização guarda fica na loja `meta`, sem mudar o esquema, para não quebrar o service worker de uma versão anterior que abra o banco: `sinc:servidor`, com o endereço e a chave de acesso; `sinc:posicao`, até onde o aparelho recebeu; `base:<caminho>`, a versão do servidor que o aparelho conhece de cada documento, com a posição; e `pagina:<caminho>`, a última gravação da página em cada documento.
- Ciclo, um por vez, mesmo com várias abas, por `navigator.locks`: recebe o que mudou no servidor depois da posição guardada, baixando os arquivos novos antes dos documentos; envia os arquivos e depois os documentos pendentes, em lotes de até 100 documentos ou 4 MB, cada um com a base; no conflito, combina com a versão atual que o servidor devolve e envia de novo, em até cinco rodadas. O que o servidor confirma, como aplicada ou repetida, sai do registro de mudanças, e só até o número enviado, porque uma gravação feita durante o envio continua pendente.
- Quando: ao abrir, 3 s depois de cada gravação, a cada 30 s, quando a página volta a ficar visível e quando a rede volta. Sem rede, a página segue gravando no banco local, o botão mostra "Sem rede", e as tentativas se espaçam de 5 s até 60 s; o evento de rede de volta dispara um ciclo na hora.
- Configuração: o botão "Sincronizar", ao lado do indicador "Salvo", abre um diálogo com o endereço do servidor e a chave de acesso, que ficam em `sinc:servidor`. Reaberto, o diálogo não mostra a chave, só avisa que ela está guardada. Trocar de servidor esquece as bases e a posição e marca todos os documentos e arquivos para envio; "Desligar" faz o mesmo e para de sincronizar.
- Regra de combinação, para o critério 2, aplicada em cada nível dos dados: o que só um lado mudou fica com a mudança desse lado; objetos mudados dos dois lados são combinados campo a campo; listas de objetos com id, como os itens de um fragmento e os quadros e pastas da biblioteca, são combinadas item a item, pelo id, na ordem local, seguida dos itens novos do outro lado; um item ou documento apagado de um lado e mudado do outro fica com a mudança. Para o mesmo campo do mesmo item mudado nos dois aparelhos para valores diferentes, como o texto de um cartão editado nos dois, prevalece a versão do documento gravada por último, pelo horário de cada aparelho, e, no empate, a do servidor. Assim, mover um cartão no Boox e editar o texto dele no computador junta as duas mudanças; só a mesma propriedade editada nos dois lados antes de sincronizar perde uma das edições. O horário decide só esse caso; a ordem das mudanças é a das posições do servidor.
- Os campos `by` e `rev` de primeiro nível, com que a página marca quem gravou e reconhece as próprias gravações, acompanham a versão local, e o `rev` ganha um valor novo quando o resultado difere dela, para que a página aplique o resultado em vez de tomá-lo pela própria gravação.
- Descoberta: a página grava cada fragmento inteiro a partir da cópia na memória e ignora as mudanças de um fragmento que ela tem por gravar. Uma mudança do outro aparelho que chegasse nesse intervalo seria apagada pela gravação seguinte da página. Por isso, cada gravação da página é combinada com o que mudou no banco desde a gravação anterior dela, guardada em `pagina:<caminho>`; sem mudança da sincronização no meio, a gravação passa direto, sem comparar os dados.
- Descoberta: dois aparelhos podem gravar o mesmo número de versão de um documento; as assinaturas passaram a reconhecer uma versão nova pela versão, pela exclusão, pelo horário e pelo aparelho, e não só pela versão.
- Descoberta dos testes: o registro de configuração guardava a chave de acesso num campo chamado `chave`, que em `meta` é o campo que identifica o registro; a configuração ficava guardada sob a própria chave de acesso e nunca era encontrada. O campo passou a se chamar `chaveDeAcesso`.
- Origem: a página da casca tem a origem aceita pelo servidor no padrão. No computador, a Prancheta servida pelo mesmo endereço do servidor não precisa de nada, o que fica para a etapa 05; o uso está em `servidor/LEIA-ME.md`.
- A casca 0.3.4, publicada junto com esta etapa, já traz a sincronização, porque a compilação copia `web/app/`. Sem servidor configurado, o botão mostra "Sincronizar", e nada sai do aparelho; o servidor na VPS fica para a etapa 05.
- Interface no e-ink: os ciclos de rotina não trocam "Sincronizado" por "Sincronizando…", porque cada troca de texto atualiza a região da tela e, na casca, muda as áreas reservadas.
- Testes: `web/testes/combinar.test.cjs`, com 13 testes da combinação; 4 testes novos em `web/testes/banco-local.test.cjs`, para a gravação combinada da página, a versão do servidor com mudanças pendentes, a poda e as assinaturas; e `web/testes/sincronizacao.test.cjs`, com 6 testes em dois perfis persistentes do Chromium e o servidor de `servidor/`, cada teste com um servidor vazio. Ao todo, 52 testes da Prancheta, aprovados.
- Verificação por mutação: os testes acusam as 14 mutações introduzidas no banco, na sincronização e na combinação. Na primeira rodada, escapou a remoção do aviso de rede de volta, porque as novas tentativas espaçadas também retomavam dentro do prazo do teste; o espaçamento passou a ser configurável, e um teste com espera longa depois da falha garante que é o aviso de rede de volta que retoma na hora.

## Resultado

Etapa concluída em 2026-11-08. Os critérios foram verificados pelos testes, todos aprovados localmente:

1. Envio e recebimento: o teste "um quadro feito num perfil aparece no outro" cria cartões, um arquivo e um quadro novo no perfil A, e o perfil B, depois de configurado, recebe tudo sozinho: o cartão aparece na página pelas assinaturas, o quadro aparece na biblioteca e abre com o cartão dele, e o arquivo é entregue em `/_blob/<id>`. Os ciclos rodam em segundo plano, por temporizadores e pedidos assíncronos, sem esperar nada na gravação da página.
2. Mesmo fragmento: o teste "edições simultâneas no mesmo fragmento" acrescenta um cartão no perfil A e edita, no perfil B, o cartão do A, no mesmo fragmento, os dois sem rede; depois de sincronizar, os dois perfis têm os três cartões, com a edição do B. O teste "o mesmo cartão editado nos dois perfis" confirma a regra para o mesmo item, descrita acima, e os testes da combinação cobrem cada caso da regra.
3. Sem rede: no teste das edições simultâneas, os dois perfis seguem criando e editando cartões sem rede, com o botão em "Sem rede", e sincronizam sozinhos quando a rede volta; o teste "a sincronização retoma assim que a rede volta" confirma a retomada imediata pelo aviso de rede de volta.
4. Poda: o primeiro teste confere que o registro de mudanças fica vazio depois que o servidor confirma tudo, e o teste "confirmar um envio poda só as mudanças que ele inclui" confere que uma gravação feita durante o envio continua pendente.
5. Configuração: o primeiro teste informa o endereço e a chave pelo diálogo em cada perfil, recarrega a página e confere que a sincronização continua sem pedir de novo, que os dois ficam em `sinc:servidor` no banco local e que a chave não vai para o `localStorage`; o código não traz endereço nem chave.
6. Testes com dois perfis: os testes de `web/testes/sincronizacao.test.cjs` usam dois perfis persistentes do Chromium, cada um com a própria pasta de dados, e o servidor da etapa 03, com edições simultâneas e períodos sem rede.
