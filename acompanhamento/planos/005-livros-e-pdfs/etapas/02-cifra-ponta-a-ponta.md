---
tipo: etapa
plano: "005"
etapa: "02"
titulo: Cifra ponta a ponta dos quadros
status: em_andamento
depende_de: ["01"]
iniciada_em: 2026-11-09
concluida_em:
---

# Etapa 02: cifra ponta a ponta dos quadros

## Objetivo

Fazer os quadros e os arquivos enviados saírem cifrados do aparelho, com uma chave que só os aparelhos do autor e o Bitwarden conhecem, de modo que a VPS guarde e entregue apenas dados que ela não consegue ler, e apagar dela as cópias legíveis que já existem.

## Critérios de conclusão

- [ ] No diálogo "Sincronizar", o primeiro aparelho cria uma chave aleatória de 256 bits, mostrada uma única vez, em grupos fáceis de copiar, para o autor guardar no Bitwarden; nos outros aparelhos, a mesma chave é informada no mesmo diálogo, e uma chave diferente é recusada com um aviso, sem aplicar nem enviar nenhum quadro.
- [ ] Com a chave, cada documento e cada arquivo sai do aparelho cifrado com AES-GCM, e o servidor guarda e entrega só o conteúdo cifrado; um conteúdo alterado ou trocado de documento no servidor é recusado pelo aparelho; a chave nunca é enviada ao servidor nem entra no repositório.
- [ ] A sincronização e a combinação de mudanças nos dois aparelhos continuam funcionando com os dados cifrados, inclusive depois de um período sem rede.
- [ ] Depois da primeira gravação cifrada, o servidor recusa gravações legíveis e gravações cifradas com outra chave; um aparelho sem a chave não aplica o que chega cifrado, não envia nada e pede a chave.
- [ ] Um comando executado pelo autor na VPS confere que todos os documentos e arquivos atuais estão cifrados e só então apaga do histórico as versões legíveis e os arquivos legíveis; sem essa conferência, ele não apaga nada.
- [x] Os testes automáticos cobrem a criação e a recusa da chave, a cifra dos documentos e dos arquivos, o conteúdo adulterado, a recusa do servidor, a migração e a limpeza, e acusam mutações introduzidas no código da cifra.
- [ ] O autor confirma, no Boox e no computador, que os quadros sincronizam com a cifra ligada, sem perder nenhum, e a conferência na VPS mostra que nenhum quadro legível ficou guardado nela.

## Registro

### 2026-11-09

- O autor aprovou estes critérios e mandou seguir.
- Decisões do autor para esta etapa: a chave é aleatória, criada pelo primeiro aparelho e guardada no Bitwarden, em vez de uma senha memorizada; a recuperação depende só do Bitwarden, e, se ele e todos os aparelhos se perderem, a cópia da VPS fica ilegível; as versões legíveis que já estão na VPS são apagadas dela depois que tudo estiver lá cifrado.
- O servidor já não lê o conteúdo dos quadros: ele confere só a posição, a base, o caminho, a exclusão, a versão e se os dados são um objeto, e a combinação dos conflitos é feita no aparelho. Com isso, um objeto cifrado no lugar dos dados passa pela validação atual, e a mudança fica quase toda no aparelho.
- Desenho proposto, a confirmar ao implementar:
  - A cifra fica em `web/app/compat/sincronizacao.js`, na passagem entre o banco local e o servidor: os dados de cada documento viram um envelope com o conteúdo cifrado, o vetor inicial e um identificador curto da chave, derivado dela, que não permite reconstruí-la. O caminho, a versão e o horário entram como dados associados da cifra, de modo que o servidor não consiga trocar o conteúdo de lugar nem mudar o horário que decide os conflitos sem que o aparelho perceba. Os arquivos vão cifrados inteiros, com o tipo dentro da cifra.
  - O banco local de cada aparelho continua legível, como decidido pelo autor: a cifra é ponta a ponta, não do banco local. A chave fica no banco local como chave não exportável do navegador, que a página usa sem conseguir lê-la de volta; por isso, um aparelho novo sempre recebe a chave do Bitwarden.
  - O servidor passa a lembrar, na pasta dos dados, o identificador da chave da primeira gravação cifrada e, a partir dela, recusa gravações legíveis e gravações com outro identificador. Assim, um aparelho antigo, ou sem a chave, não volta a pôr quadros legíveis na VPS durante a troca.
  - Continuam visíveis para a VPS o caminho de cada documento, que usa identificadores aleatórios, a versão, os horários, o nome do aparelho e o tamanho de cada item; o conteúdo dos quadros, os títulos, os textos, os traços e as imagens deixam de ser.
  - A cópia puxada pelo computador, por `servidor/copia-de-seguranca.cjs`, passa a guardar os dados cifrados; restaurá-la continua sendo devolvê-la ao servidor, e lê-la exige a chave.
- Ordem da troca, proposta:
  1. Publicar a página e o servidor novos e a casca nova, que traz a página para o Boox; o servidor aceita os dois formatos até a primeira gravação cifrada.
  2. Instalar a casca no Boox e conferir que os dois aparelhos estão sincronizados, sem nada pendente.
  3. No computador, criar a chave, guardá-la no Bitwarden e confirmar; o computador reenvia cifrados todos os documentos e arquivos. O Boox, ainda sem a chave, para de sincronizar e pede a chave.
  4. No Boox, informar a chave; ele volta a sincronizar.
  5. Na VPS, o autor roda o comando de limpeza, que confere tudo antes de apagar.
  6. O autor confere os quadros nos dois aparelhos.
- Riscos próprios da etapa:
  - As cópias de segurança e os instantâneos da VPS feitos pela Hostinger antes da limpeza guardam os quadros legíveis até expirarem; o autor pode apagá-los no painel dela. As cópias antigas puxadas pelo computador continuam legíveis, no computador do autor.
  - Apagar um arquivo não sobrescreve o disco da VPS; restos dos dados legíveis podem ficar nos blocos livres até serem reaproveitados.
  - Digitar a chave no Boox é trabalhoso; por isso, ela é mostrada em grupos curtos, sem distinção entre maiúsculas e minúsculas, e pode ser colada do Bitwarden.
  - Trocar a chave depois de criada fica fora desta etapa.

- Implementação, a publicar:
  - `web/app/compat/cifra.js`, novo, com a chave em base 32 de Crockford, 52 letras e algarismos em 13 grupos de 4, lida sem distinguir maiúsculas de minúsculas e com O e I ou L lidos como 0 e 1; as 4 posições que sobram depois dos 256 bits são zero e acusam parte dos erros de digitação na última letra. Por HKDF, saem da chave a chave da cifra AES-GCM, não exportável, e um identificador de 128 bits. O documento vira `{ cifra: 1, chave, iv, conteudo }`, com o caminho, a versão, o horário e o aparelho como dados associados; o arquivo vira `PRCIFRA1`, o identificador, o vetor inicial e, cifrados, o tipo e o conteúdo, com o id do arquivo como dado associado. O módulo roda também no Node, o que permitiu testá-lo sem navegador e usá-lo nos testes do servidor.
  - `web/app/compat/sincronizacao.js` cifra os documentos e os arquivos no envio e os decifra ao receber, inclusive a versão devolvida num conflito; a base de cada documento, usada para combinar, continua legível no banco local. Antes de aplicar qualquer coisa, confere a cifra que o servidor informa: sem a chave, ou com outra, para com um aviso e não aplica nem envia nada. Com a chave, recusa um conteúdo que não se decifra e o que chegar legível depois da posição em que a cifra foi ligada, mesmo que o servidor deixe de informar a cifra, porque o aparelho guarda o que ele já informou.
  - No diálogo "Sincronizar", a seção "Cifra ponta a ponta" cria a chave, mostra-a com "Copiar" e "Descartar" e só a guarda depois de "Já guardei no Bitwarden"; nos outros aparelhos, recebe a chave num campo de senha, com "Mostrar", para que o teclado do Android não a aprenda. "Criar chave" some quando o servidor já tem cifra. Uma chave ligada só pode dar lugar à do servidor: sem isso, um aparelho que criasse outra chave por engano ficaria travado.
  - O primeiro aparelho a ligar a cifra, sem cifra no servidor, marca todos os documentos e arquivos para reenvio; os outros não reenviam nada. Antes de decidir, o aparelho pergunta ao servidor, se houver rede, se a cifra já está ligada, para que o Boox não reenvie todas as imagens à toa.
  - `servidor/armazem.cjs` reconhece os envelopes sem decifrá-los. A primeira gravação cifrada grava `cifra.json` com o identificador da chave e a posição; daí em diante, o pedido inteiro é recusado com 409, `cifra_exigida` ou `cifra_diferente`, antes de gravar qualquer parte. Exclusões e mudanças já aplicadas, reenviadas, continuam aceitas. Um arquivo legível pode dar lugar ao mesmo arquivo cifrado, com o mesmo id, uma vez. A lista de mudanças passou a trazer `cifra`.
  - `servidor/cifra.cjs`, novo, com `conferir`, que só lê e conta o que está cifrado, legível ou com outra chave nos documentos atuais, nos arquivos e no histórico, e `apagar-legiveis`, que só apaga se a cifra estiver ligada e todos os documentos e arquivos atuais estiverem cifrados com a chave dela ou apagados. Ele reescreve cada arquivo do histórico sem as versões legíveis e, como o servidor só acrescenta linhas abrindo o arquivo pelo nome, leva ao arquivo novo o que tiver sido acrescentado ao antigo durante a troca; apaga também temporários com mais de 10 minutos, restos de gravações interrompidas. Pode rodar com o servidor no ar, pelo `docker compose exec`.
  - Casca 0.5.0, `versionCode` 17, porque a página do Boox vem dentro do aplicativo; `compat/cifra.js` entrou na montagem e no service worker.
  - Guias: `servidor/LEIA-ME.md` ganhou a seção da cifra e os comandos de conferência; `servidor/implantacao/LEIA-ME.md`, a ordem da troca e os comandos da VPS.
- Testes: 7 da cifra no Node; 6 novos no servidor, 29 ao todo; 4 novos no Chromium, com até três perfis, cobrindo a criação e a recusa da chave pelo diálogo, a migração de dois aparelhos com um quadro, um quadro novo e uma imagem, um terceiro aparelho que só recebe depois de informar a chave, a limpeza do histórico, a combinação de edições feitas sem rede com a cifra, o conteúdo trocado de documento, alterado ou legível vindo do servidor e a troca de uma chave criada por engano pela do servidor. Os testes conferem também que a chave não aparece em nenhum pedido ao servidor nem no `localStorage` e que fica no banco como chave não exportável. A página tem 81 testes, todos passando; a casca compilou, com os 36 testes JUnit passando.
- Critério 6 verificado por mutações: das 12 introduzidas, 11 foram acusadas: dados associados retirados, documento ou arquivo enviado legível, conteúdo legível aceito depois da cifra, servidor que esquece a cifra aceito, chave de outro aparelho aceita, servidor aceitando o legível ou outra chave, arquivo cifrado substituível, limpeza sem conferência e limpeza que perde a versão acrescentada durante a troca. Esta última passou despercebida na primeira rodada, porque o teste dependia do tempo e a versão chegava depois da troca; o teste passou a acrescentá-la exatamente entre a leitura e a troca. A mutação não acusada tira a parada do aparelho sem a chave ao ler a lista de mudanças e não muda o comportamento, porque a decifragem e o envio também param; são barreiras sobrepostas.
- O detector da skill `impeccable` não apontou nada no diálogo.

## Resultado
