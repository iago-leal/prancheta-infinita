---
tipo: progresso
---

# Progresso

Diário do projeto. Cada sessão acrescenta uma entrada no topo; entradas antigas não são reescritas, e correções entram como entrada nova.

## 2026-11-09 · Plano 003 concluído e plano 004 aberto: faixa única no Boox

### Feito

- O autor confirmou, com a casca 0.3.5, que o traço forte não afina mais na troca, que a espessura e a cor valem em qualquer zoom e que o traço não muda nem na atualização completa; com isso, a [etapa 02](planos/003-boox-e-sincronizacao/etapas/02-traco-sensivel-a-pressao.md) e o plano 003 foram concluídos.
- Instalada no projeto a skill de design Impeccable, em `.claude/skills/impeccable/`, a pedido do autor.
- Aberto o plano 004, com a [etapa 01](planos/004-modo-e-ink/etapas/01-faixa-unica-no-boox.md): na casca 0.3.6, os controles ficam numa faixa só no alto da tela, de 47 px, no lugar das duas faixas de cerca de 150 px da 0.3.5.

### Decidido

- **Uma faixa só, título numa linha e todas as ferramentas à vista.** Escolhas do autor entre as organizações propostas com a skill Impeccable; a descrição do quadro, o aviso "Salvo" e os botões de aumentar e diminuir o zoom deixam de aparecer no Boox.

### Pendências

- O autor confirmar no Boox, com a 0.3.6, que a faixa ocupa pouco espaço e que os controles continuam ao alcance.
- Detalhar com o autor as etapas seguintes do plano 004.

## 2026-11-09 · Etapa 02 do plano 003: casca 0.3.5, traço forte, mão apoiada e barra no alto

### Feito

- O autor confirmou, com a casca 0.3.4, que os traços seguidos aparecem na hora, mas relatou que o traço forte fica mais fino quando a tela se atualiza.
- Versão 0.3.5, código 9: o contorno definitivo é engrossado conforme a pressão de cada ponto, em 20% até a pressão média, como antes, e em até 40% na pressão máxima, conforme a medição do vídeo IMG_5257 e o relato do autor.
- Na mesma versão, a pedido do autor: a barra de ferramentas e o zoom passam para o alto da tela na casca; a casca descarta os dedos até 1 s depois da caneta, cancela o gesto de dedos quando a caneta chega e trata contatos grandes como palma; desfazer e refazer pelos dedos pedem dois toques seguidos; e um gesto cancelado não deixa efeito.

### Decidido

- **Desfazer e refazer por dois toques seguidos.** Por sugestão do autor, que usa esses gestos, no lugar de desligá-los no Boox.
- **Controle de sensibilidade à pressão adiado.** O SDK da Onyx não permite aplicá-lo ao traço provisório, e aplicá-lo só ao definitivo faria o traço mudar na troca; o autor decide depois de testar a 0.3.5 se ele ainda faz falta.

### Pendências

- O autor atualizar para a 0.3.5 e confirmar no Boox que o traço forte não afina mais na troca, para fechar o critério 5 e verificar os critérios 1 e 2 da etapa 02; com ela, o plano 003 se encerra.
- O autor confirmar que a mão apoiada não move mais o quadro e que a barra no alto ficou boa.

## 2026-11-09 · Etapa 05 do plano 003 concluída: Boox e computador sincronizam pela VPS

### Feito

- O autor configurou a sincronização no computador e no Boox, cada um com a sua chave, guardada no Bitwarden, e confirmou que os quadros passam nos dois sentidos e que a Prancheta abre sem internet no computador depois da primeira visita.
- Concluída a etapa 05, com os cinco critérios verificados, e marcado o critério do plano 003.
- Agendada no Mac a cópia de segurança diária, às 3h30, pelo launchd, com a chave `copia` guardada nas Chaves do Mac, tirada do Bitwarden sem aparecer na tela; a primeira cópia trouxe 15 documentos e 2 arquivos.

### Pendências

- A etapa 02: o autor confirmar no Boox, com a casca 0.3.4, que os traços seguidos aparecem na hora e que o traço não muda de forma perceptível na troca; com ela, o plano 003 se encerra.

## 2026-11-08 · Etapa 05 do plano 003: Prancheta no ar na VPS

### Feito

- Mesclado o PR #19. A sessão do Mac, com a aprovação do autor, corrigiu a posse de dois arquivos do administrador, rodou o roteiro, acrescentou a rede ao arquivo do Traefik sem recriá-lo e cadastrou o segredo do endereço; o autor criou as chaves dos três aparelhos no próprio terminal, direto no Bitwarden.
- A publicação pelo GitHub passou: a versão c8967a3 respondeu por https no endereço da Prancheta seis segundos depois do envio.
- A conferência de cada publicação passou a verificar que a sincronização recusa pedidos sem a chave no endereço real.
- Mesclado o PR #20; a publicação disparada pelo envio à `main` pôs ce7fda3 no ar e confirmou a recusa sem a chave, o que verificou os critérios 1 e 3 da etapa 05.
- Recebido o levantamento do WebDAV, lido no histórico da sessão do Mac.

### Decidido

- **Chaves fora de qualquer histórico.** As chaves são criadas pelo autor no próprio terminal e vão direto ao Bitwarden, porque esta sessão consegue ler o histórico da sessão do Mac.
- **Livros pela pasta do WebDAV, só leitura.** Em vez de os aparelhos falarem com o WebDAV, que não tem usuário só de leitura, o servidor da Prancheta lê a biblioteca por uma montagem só de leitura e a entrega com a chave de cada aparelho.

### Pendências

- O autor configurar a sincronização no Boox e no computador e confirmar os critérios 4 e 5 da etapa 05.

## 2026-11-08 · Etapa 05 do plano 003: publicação na VPS preparada

### Feito

- Mesclado o PR #18 no `main`, a pedido do autor, com a casca 0.3.4 e a sincronização.
- Levantadas a VPS e, depois, o WebDAV, por uma sessão do Mac, a pedido do autor; o autor autorizou esta sessão a falar com as sessões do computador, o que a limita aos aparelhos confiáveis dele.
- Debate de segurança com oito agentes, a pedido do autor, sobre como expor a Prancheta; o autor aceitou a recomendação: página aberta, quadros com a chave, reforço de base agora, e rede privada e cifra no aparelho antes dos livros.
- Iniciada a etapa 05: página entregue pelo servidor, chaves por aparelho, cabeçalhos de segurança, arquivos isolados, versão nova só quando o autor pede, histórico de 30 dias, cópia de segurança puxada pelo computador, contêiner sem privilégios, publicação pela conta `prancheta` sem Docker, roteiro do administrador e ações do GitHub fixadas por hash. 14 testes novos, que acusam as 14 mutações introduzidas.

### Decidido

- **Página aberta, quadros com a chave.** A página é o código público; a proteção está na chave de cada aparelho, na política da página e no isolamento dos arquivos.
- **Livros no WebDAV.** A biblioteca de livros e PDFs do futuro deve ficar no WebDAV da VPS, que o KOReader já usa, e não no servidor da Prancheta; as marcações ficam na sincronização.
- **Endereço fora do repositório.** O nome escolhido identifica a máquina e fica só no ambiente da VPS e num segredo do GitHub.

### Pendências

- O autor executar o roteiro na VPS, acrescentar a rede ao arquivo do Traefik, criar as chaves, cadastrar o segredo do endereço, fazer a primeira publicação e confirmar a sincronização entre o Boox e o computador.
- Receber o levantamento do WebDAV, pedido à sessão do Mac, para o plano dos livros.

## 2026-11-08 · Etapa 04 do plano 003: sincronização no banco local

### Feito

- Criada a sincronização em `web/app/compat/sincronizacao.js`: com rede, o banco local recebe o que mudou no servidor, envia arquivos e documentos pendentes, combina os conflitos e poda o registro de mudanças conforme o servidor confirma; sem rede, a Prancheta segue igual e retoma sozinha quando a rede volta.
- Criada a combinação em três vias em `web/app/compat/combinar.js`, item a item pelo id e campo a campo, usada também na gravação da página, para que uma gravação feita a partir da cópia na memória não apague o que chegou do outro aparelho.
- Botão "Sincronizar" ao lado do indicador "Salvo", com o diálogo do endereço e da chave, guardados no banco local de cada aparelho.
- 23 testes novos, 6 deles com dois perfis do Chromium e o servidor; os testes acusam as 14 mutações introduzidas. Concluída a etapa 04.

### Decidido

- **Mesmo campo mudado nos dois aparelhos.** Prevalece a gravação mais recente, pelo horário de cada aparelho, e, no empate, a do servidor; apagar de um lado e mudar do outro mantém a mudança.
- **Sem mudar o esquema do banco.** O que a sincronização guarda fica na loja `meta`, para não quebrar o service worker de uma versão anterior.

### Pendências

- Etapa 05: publicar a Prancheta e o servidor na VPS, o que depende do endereço e do servidor web de lá. A casca 0.3.4 já leva a sincronização ao Boox.

## 2026-11-08 · Casca 0.3.4: troca do traço só com a caneta afastada

### Feito

- Mesclado o PR #17 no `main`, a pedido do autor, com a casca 0.3.3 e a medição da pressão.
- O autor relatou que um traço feito logo depois de outro às vezes só aparece junto com a troca do traço anterior. A 0.3.4 só troca o traço provisório pelo definitivo depois de 700 ms sem sinal da caneta, tocando ou pairando, para não desligar a camada da Onyx no meio da escrita.

### Decidido

- **Troca com a caneta afastada.** O traço provisório pode ficar mais tempo na tela, até a caneta se afastar, em troca de nunca interromper a escrita; com a caneta pairando por mais de 20 s, a troca acontece mesmo assim.

### Pendências

- O autor confirmar no Boox, com a 0.3.4, que os traços seguidos aparecem na hora e que o traço não muda de forma perceptível na troca, para o critério 5 da etapa 02.
- Continuar a etapa 04, a sincronização no banco local, que já tem o desenho da combinação item a item.

## 2026-11-08 · Casca 0.3.3: cor do traço provisório sem escurecer

### Feito

- Mesclado o PR #16 no `main`, a pedido do autor.
- O autor relatou que, na 0.3.2, o traço provisório da caneta verde sai preto e só fica verde na atualização, enquanto o vermelho continua vermelho. A 0.3.3 volta a mandar à camada da Onyx a cor da página sem mudança.
- Medida, no vídeo IMG_5257 do autor, a espessura de traços de pressão leve, média e forte antes e depois da troca: a espessura varia com a pressão, na proporção de 1 para 1,4 para 2,0; com pressão leve e média, ela não muda na troca, e com pressão forte o provisório pode sair até 20% mais largo. Marcado o critério 3 da etapa 02.

### Decidido

- **Cor do traço provisório igual à da página.** O modo rápido da tela colorida parece só acender ou apagar cada canal de cor; escurecer a cor para igualar o tom do traço definitivo apaga os canais e deixa o traço preto. O provisório fica mais claro que o definitivo, mas com a cor certa.

### Pendências

- O autor confirmar no Boox, com a 0.3.3, que o traço não muda de forma perceptível na atualização da tela, inclusive na completa e com pressão forte, para o critério 5 da etapa 02.

## 2026-11-08 · Etapa 03 do plano 003 concluída e casca 0.3.2 publicada

### Feito

- Mesclado o PR #15 no `main`, a pedido do autor, com a casca 0.3.2 e o servidor de sincronização; o GitHub publicou a versão `casca-6`, que a Prancheta passa a oferecer ao abrir com internet.
- Concluída a etapa 03: marcado o critério 3, depois da decisão do autor, e escrito o Resultado, com o teste que verifica cada critério.

### Decidido

- **Consulta prévia do navegador aceita.** O autor aceitou que a consulta prévia, que não leva a chave, seja respondida com 204 e sem dados quando vem da origem da casca; qualquer outro pedido sem a chave recebe 401. Assim, a etapa 04 sincroniza pela própria página, sem um caminho nativo na casca.

### Pendências

- O autor atualizar para a 0.3.2, conferir a cor do traço provisório e medir traços de pressão leve, média e forte, para a etapa 02.

## 2026-11-08 · Etapa 03 do plano 003: servidor de sincronização

### Feito

- Mesclado o PR #14 no `main`, a pedido do autor, e iniciada a etapa 03.
- Criado o servidor de sincronização em `servidor/`, em Node puro: recebe e devolve documentos e arquivos no formato do banco local, numera cada mudança, reconhece reenvios, recusa sobrescrever às cegas o documento mudado por outro aparelho e só atende com a chave de acesso, lida do ambiente.
- 10 testes, que acusam as 12 mutações introduzidas, e o fluxo `.github/workflows/servidor.yml`, que os roda nos Node 18 e 22.

### Decidido

- **Conflitos resolvidos no aparelho.** O servidor não combina versões: devolve a versão atual, e o aparelho combina item a item na etapa 04, onde conhece a forma dos fragmentos.
- **Arquivos em disco, sem banco de dados.** Gravações atômicas e um registro de linhas bastam para um usuário, sem exigir nada além do Node na VPS.

### Pendências

- O autor decidir se aceita que a consulta prévia do navegador, que não leva a chave nem recebe dados, seja respondida para a origem da casca, no critério 3.

## 2026-11-08 · Casca 0.3.2: cor do traço provisório

### Feito

- Analisado o vídeo do autor com a 0.3.1: a troca do traço acontece cerca de 1 s depois de levantar a caneta, sem a tela piscar, a linha fantasma não apareceu, e a espessura antes e depois da troca difere menos de 2%.
- O verde provisório saía mais claro que o definitivo; a 0.3.2 manda à camada da Onyx a cor da caneta escurecida em 0,65.

### Pendências

- Mesclar a 0.3.2, conferir a cor e medir traços de pressão leve, média e forte.

## 2026-11-08 · Primeira atualização da casca pelo próprio aplicativo

### Feito

- Mesclado o PR #13; o GitHub publicou a versão `casca-5`, a 0.3.1, com a assinatura das versões instaladas.
- O autor recebeu a 0.3.1 pela atualização dentro do aplicativo no Boox, sem receber o APK por outro meio, e viu a mensagem da versão nova ao abrir.

### Pendências

- O autor testar o traço na 0.3.1 e enviar um vídeo com traços de pressão leve, média e forte.

### Concluído depois

- O autor confirmou que os quadros continuaram depois da atualização e que a Prancheta abre sem internet; a etapa 06 do plano 003 foi concluída.

## 2026-11-08 · Primeira publicação pelo GitHub e casca 0.3.1

### Feito

- O autor cadastrou o segredo `CASCA_CHAVE_BASE64`; mesclado o PR #12, o GitHub publicou a versão `casca-4`, a 0.3.0, com a mesma assinatura das versões instaladas, e não a substituiu ao rodar de novo.
- Analisado o vídeo do autor com a 0.3.0: as cores funcionam; o traço provisório só sumia numa atualização completa da tela e aparece cerca de 20% mais grosso que o definitivo; uma linha escura aparecia e sumia sem ser gravada.
- Preparada a versão 0.3.1: ajustes da camada sem reabri-la e fora dos traços em andamento, troca do traço provisório na região escrita depois de levantar a caneta e contorno definitivo 20% mais grosso.

### Pendências

- Mesclar a 0.3.1 e o autor recebê-la pela atualização dentro do aplicativo.
- Medir os traços de pressão leve, média e forte com a 0.3.1.

## 2026-11-08 · Etapas 02 e 06 do plano 003: traço da Onyx e atualização pelo aplicativo

### Feito

- Mesclado o PR #11 no `main`, a pedido do autor, e iniciada a etapa 02 do plano 003.
- A camada da Onyx passou a usar a caneta-tinteiro sensível à pressão, com a cor e a espessura escolhidas na Prancheta, e um tempo fixo de 600 ms para a troca pelo traço definitivo.
- A casca calcula, com o motor de canetas da Onyx, a espessura de cada ponto do traço, e a Prancheta desenha o traço definitivo com ela, pelo novo `web/app/compat/traco-onyx.js`.
- A pedido do autor, criada a etapa 06: o fluxo `.github/workflows/casca.yml` compila e publica cada versão da casca, e o `Atualizador` da casca oferece a atualização ao abrir e a instala por dentro do aplicativo.
- Compilada a versão 0.3.0, a última enviada ao autor à mão.

### Decidido

- **Atualizações pelo GitHub, por enquanto.** As versões ficam nas versões do repositório, que funcionam sem configurar a VPS; a VPS pode guardá-las depois, na etapa 05.
- **A mesma chave das versões instaladas.** O GitHub assina com a chave de depuração usada desde o plano 001, guardada num segredo, para que a atualização não exija desinstalar o aplicativo e apagar os quadros do Boox.

### Pendências

- O autor cadastrar o segredo `CASCA_CHAVE_BASE64` no GitHub.
- O autor testar a versão 0.3.0 e enviar fotos dos traços para a medição da etapa 02.

### Referências

- Etapa 02: `acompanhamento/planos/003-boox-e-sincronizacao/etapas/02-traco-sensivel-a-pressao.md`
- Etapa 06: `acompanhamento/planos/003-boox-e-sincronizacao/etapas/06-atualizacao-pelo-aplicativo.md`

## 2026-11-08 · Etapa 01 do plano 003 concluída: Prancheta real na casca

### Feito

- O autor confirmou no Boox, com a casca 0.2.0, todos os itens do teste: a Prancheta sem internet, um dedo selecionando e arrastando, dois dedos movendo e ampliando, a borracha com a caneta, a mão apoiada sem mover o quadro, e a imagem e o quadro presentes depois de fechar e reabrir o aplicativo.
- Concluída a etapa 01 do plano 003, com a verificação de cada critério.

### Decidido

- **Ícones no plano 004.** O autor decidiu não antecipar o contraste dos ícones selecionados, que fica no modo e-ink.

### Pendências

- Etapa 02: traço provisório da Onyx com a mesma forma e cor do definitivo e tempo fixo de atualização depois de levantar a caneta.

## 2026-11-08 · Primeiro teste da casca 0.2.0 no Boox

### Feito

- Registrado o primeiro retorno do autor sobre a versão 0.2.0: ficou boa, e a resposta da escrita está bem rápida.

### Observado no aparelho

- Ao escrever em laranja, o traço sai preto e só fica laranja quando a tela se atualiza, porque a casca fixa em preto a cor do traço provisório da Onyx.
- Os ícones selecionados ficam pouco legíveis na tela e-ink, por causa das cores.

### Pendências

- Na etapa 02, passar à camada da Onyx a cor escolhida, testar como a tela colorida a mostra e fixar o tempo da atualização depois de levantar a caneta.
- Decidir com o autor se o contraste dos ícones selecionados entra antes do modo e-ink do plano 004.
- Confirmar com o autor os itens restantes do teste da etapa 01.

## 2026-11-08 · Etapa 01 do plano 003: Prancheta real dentro da casca

### Feito

- Mesclado o PR #10 no `main`, a pedido do autor, e iniciada a etapa 01 do plano 003.
- A compilação da casca passou a copiar `web/app/` para o APK, e a casca abre a Prancheta real; a página de teste do plano 001 e os testes dela foram removidos.
- Criado o adaptador `web/app/compat/casca.js`, que liga a ponte da casca ao código do artefato, com 6 testes no Chromium usando uma casca simulada.
- O roteador de toques ganhou a regra da ferramenta e a rejeição da palma, com 4 testes JUnit novos; a casca ganhou seletor de arquivos, abertura de links externos no navegador e o encaminhamento do service worker.
- Cada traço passou a guardar horário de início e duração.
- Compilada a versão 0.2.0 da casca, enviada ao autor para o teste no Boox.

### Decidido

- **Caneta conforme a ferramenta.** Com a seleção, que é a ferramenta inicial, a caneta escreve e um dedo seleciona e arrasta; com a borracha, as formas e o texto, a caneta age sobre a página.
- **Rejeição da palma na casca.** Um toque de dedo com a caneta encostada ou até 400 ms depois do último sinal dela é descartado, para que a mão apoiada não mova o quadro.

### Pendências

- Teste do autor no Boox com a versão 0.2.0, que decide os critérios restantes da etapa 01.
- Downloads, como a exportação em PNG, ainda não funcionam na casca.

### Referências

- Etapa 01: `acompanhamento/planos/003-boox-e-sincronizacao/etapas/01-prancheta-na-casca.md`
- Adaptador: `web/app/compat/casca.js`

## 2026-11-08 · Plano 003 aberto: Prancheta no Boox e sincronização com a VPS

### Feito

- Mesclado o PR #9 no `main`, a pedido do autor, o que fecha o plano 002.
- Aberto o plano 003, com cinco etapas: a Prancheta real dentro da casca, o traço sensível à pressão igual na Onyx e na página, o servidor de sincronização, a sincronização no banco local e a publicação na VPS.

### Decidido

- **Traço sensível à pressão.** O autor escolheu o traço que varia com a pressão, e não o de espessura constante. Para que nada mude quando a tela se atualiza, o caminho preferido é a casca calcular o contorno de cada traço com o mesmo motor de canetas da Onyx que desenha o traço provisório; o SDK traz esse motor, em classes como `NeoFountainPen` e `NeoBrushPen`, configuradas por `NeoPenConfig`, que considera pressão e velocidade.
- **Duas frentes no plano 003.** O Boox, nas etapas 01 e 02, e a sincronização, nas etapas 03 a 05, podem avançar em paralelo; a publicação só fecha com a casca sincronizando.

### Pendências

- Iniciar a etapa 01 do plano 003.
- Saber do autor o endereço da Prancheta na VPS e que servidor web com HTTPS já atende lá, antes da etapa 05.

### Referências

- Plano 003: `acompanhamento/planos/003-boox-e-sincronizacao/plano.md`

## 2026-11-08 · Etapa 06 e plano 002 concluídos: Prancheta sem internet

### Feito

- Mesclado o PR #8 no `main`, a pedido do autor.
- Criada a Prancheta independente em `web/app/`: o código do artefato montado a partir do original por `web/montagem/montar.cjs`, com sete mudanças listadas e justificadas em `web/montagem/mudancas.cjs`; o cliente de compatibilidade `compat/claude.js`; e o service worker `sw.js`, que guarda a página para abrir sem rede e entrega os arquivos enviados em `/_blob/<id>`.
- Passaram a vir junto com a página a fonte Inter, a `perfect-freehand`, o pdf.js e o mammoth, nas mesmas versões que o artefato buscava em CDNs.
- O banco local mudou de `web/compat/` para `web/app/compat/`.
- Criados 7 testes no Chromium, em `web/testes/app.test.cjs`, entre eles um que monta um quadro com cartão, seta, traço e imagem com o servidor da página fora do ar e recarrega a página só com o banco local. Os testes acusam as 14 mutações introduzidas.
- Concluído o plano 002, com o trecho dos quadros exportados dispensado pelo autor.

### Decidido

- **Página montada, e não editada à mão.** `web/app/index.html` é sempre o original com as mudanças da lista, e um teste confere isso; o original continua conferido pelos hashes.
- **pdf.js e mammoth junto com a página.** O artefato os buscava no cdnjs ao abrir prévias de PDF e de Word; entregá-los localmente cumpre o critério de nenhuma requisição externa e prepara a leitura de PDFs.
- **Sem service worker, imagens embutidas.** Se o service worker não assumir a página, o recurso de arquivos é recusado, e o artefato embute as imagens no quadro, em vez de guardar arquivos que não conseguiria exibir.

### Observado no aparelho

- O autor corrigiu uma observação anterior: no Boox, ao tirar a caneta da tela, o traço às vezes muda e fica mais fino, quando o aparelho atualiza a região, conforme o intervalo configurado no tablet, ou quando o autor pede a atualização completa da tela. A causa provável é a diferença entre o traço provisório da Onyx, de espessura constante, e o definitivo da página, que afina com a pressão.

### Pendências

- Decidir com o autor entre traço de espessura constante e traço sensível à pressão, e igualar o provisório e o definitivo na casca.
- Plano 003: sincronização com a VPS, implantação, autenticação e a Prancheta de `web/app/` empacotada na casca, com o service worker servido por ela.

### Referências

- Etapa 06: `acompanhamento/planos/002-prancheta-independente/etapas/06-prancheta-sem-internet.md`
- Montagem e arquivos de terceiros: `web/montagem/LEIA-ME.md`
- Testes: `web/testes/app.test.cjs`

## 2026-11-08 · Etapa 05 do plano 002 concluída: banco local no navegador

### Feito

- Mesclado o PR #6 no `main`, a pedido do autor.
- Criado `web/compat/banco-local.js`, o banco local em IndexedDB com documentos, coleções, assinaturas em tempo real, arquivos enviados e registro de mudanças, na forma que o código do artefato espera.
- Criados 11 testes no Chromium, em `web/testes/banco-local.test.cjs`, que cobrem cada operação, os avisos entre abas, os arquivos sem rede e a persistência ao recarregar a página e ao fechar e reabrir o navegador. O servidor estático dos testes passou para `web/testes/apoio/servidor.cjs`.
- Verificação por mutação: os testes acusam os 16 defeitos introduzidos no banco, depois de ganharem dois testes para os casos que tinham escapado.

### Decidido

- **Formato pronto para sincronizar.** Cada documento guarda versão, horário e aparelho; as exclusões deixam marca; e cada gravação entra num registro de mudanças, para que o plano 003 sincronize com a VPS sem mudar o formato dos dados.
- **Erros com os códigos que o artefato trata.** A falta de espaço sai como `quota_exceeded` e as demais falhas como `unavailable`, porque um `invalid_argument` deixaria o quadro somente para leitura.

### Pendências

- Etapa 06: ligar o código do artefato ao banco local por `claude.use(...)`, entregar `/_blob/<id>` a partir do banco e servir a fonte e a `perfect-freehand` junto com a página.
- Plano 003: podar o registro de mudanças depois de cada sincronização e não ordenar mudanças só pelo horário dos aparelhos.

### Referências

- Etapa 05: `acompanhamento/planos/002-prancheta-independente/etapas/05-banco-local.md`
- Banco local: `web/compat/banco-local.js`
- Testes: `web/testes/banco-local.test.cjs`

## 2026-11-08 · Canal de publicação na VPS pelo GitHub

### Feito

- Criado o fluxo `.github/workflows/publicar.yml`, que chama a VPS a cada envio à `main` e sob demanda.
- Criada na VPS uma conta sem privilégios, com uma chave que só executa uma ação fixa, a qual por enquanto apenas confirma o canal.
- Verificado direto na VPS: a chave executa a ação permitida e é recusada em comando arbitrário, encadeamento de comandos, sessão sem comando, túnel e entrada como root.
- Verificado pelo GitHub, numa execução a partir do branch: a VPS respondeu, e o registro público não expõe o endereço nem a chave.

### Decidido

- **Publicação pelo GitHub, e não por SSH saindo do ambiente de nuvem.** A documentação informa que o tráfego de saída das sessões passa por um proxy HTTP/HTTPS e não menciona SSH. A conexão direta não foi medida no ambiente, que permaneceu sem alteração.
- **Chave nova e restrita, e não a chave de administrador.** A VPS abriga outros serviços, e a restrição limita um vazamento a repetir uma ação fixa.

### Pendências

- No plano 003, acrescentar a ação de publicar ao roteiro da VPS e fazer o fluxo chamá-la.

### Referências

- Fluxo: `.github/workflows/publicar.yml`

## 2026-11-08 · Plano 002 reestruturado: Prancheta sem internet

### Feito

- Descartadas, antes de começar, as etapas 03, servidor de compatibilidade, e 04, cliente ligado a esse servidor.
- Criadas as etapas 05, banco local no navegador, e 06, cliente de compatibilidade e Prancheta sem internet.
- Registrada a mudança no plano 002 e no estado, e redefinido o plano 003, que passa a cobrir a sincronização com a VPS e a Prancheta empacotada na casca.

### Decidido

- **Uso sem internet no Boox.** O autor quer usar a Prancheta sem rede. Os dados ficam num banco local, e a VPS serve para sincronizar.
- **Banco local em IndexedDB, dentro da página.** O mesmo código funciona no Boox, dentro da casca, e no computador, sem código nativo, e guarda bem imagens e arquivos. A alternativa de SQLite nativo, em Kotlin ou Rust, só serviria ao Boox e não traria ganho de latência perceptível: a escrita já passa pelo controlador da tela, e as operações no banco levam menos de um milissegundo diante de uma atualização de e-ink.
- **Rust fora, por enquanto.** O autor perguntou se um backend em Rust melhoraria a latência; a análise mostrou que a latência sentida não depende da linguagem do nosso código.

### Pendências

- Iniciar a etapa 05, o banco local em IndexedDB.

### Referências

- Plano 002: `acompanhamento/planos/002-prancheta-independente/plano.md`
- Etapas 05 e 06: `acompanhamento/planos/002-prancheta-independente/etapas/`

## 2026-11-08 · Etapa 02 do plano 002 concluída: dados exportados do artefato

### Feito

- Mesclado o PR #5 no `main`, a pedido do autor.
- Exportados, só com leituras, os 38 documentos do banco do artefato e os 9 arquivos enviados, cobrindo os 5 quadros da biblioteca, com 16 fragmentos e 722 itens.
- Criados o montador do pacote, `web/exportacao/montar_exportacao.py`, com testes de dados fictícios, e a descrição do formato, `web/exportacao/formato.md`.
- Enviado ao autor, pelo aplicativo do Claude, o pacote `prancheta-exportacao-2026-11-08.zip`.

### Decidido

- **Exportação fora do Git.** O autor escolheu receber o pacote e guardá-lo onde preferir, já que contém dados pessoais.
- **Exportação reproduzível.** O processo e o montador estão documentados, porque o autor continua usando o artefato até a migração terminar e precisará de uma exportação final.

### Mudança de escopo

- Depois da exportação, o autor decidiu começar a Prancheta independente com o banco limpo. A importação foi dispensada nas etapas 03 e 04, e as cópias temporárias dos dados foram apagadas. A skill de acompanhamento ganhou uma regra para critérios dispensados pelo autor.

### Pendências

- Iniciar a etapa 03, o servidor de compatibilidade, com o banco começando vazio.

### Referências

- Etapa 02: `acompanhamento/planos/002-prancheta-independente/etapas/02-exportacao-dos-dados.md`
- Formato: `web/exportacao/formato.md`
- PR #5, mesclado: https://github.com/iago-leal/prancheta-infinita/pull/5

## 2026-11-08 · Etapa 01 do plano 002 concluída: código do artefato no repositório

### Feito

- Copiados para `web/` o `index.html` e os seis áudios da versão `1793918104-39f4` do artefato, conferidos pelos hashes que a ferramenta de artefatos informa, guardados em `web/artefato-publicado.sha256`.
- Criado o teste da linha de base, que abre o código original no modo local, sem `window.claude`, cria um cartão e um traço e confirma que eles persistem depois de recarregar.
- Escrito `web/inventario-claude.md`, com os nove recursos do claude.ai que o código pede, as operações e os caminhos do banco, o modo local e as requisições externas.
- A máquina reiniciou, mas com o mesmo disco; a confirmação do script de configuração num contêiner novo continua pendente.

### Decidido

- **O código original fica intacto em `web/index.html`.** As mudanças da camada de compatibilidade virão nas etapas seguintes, sempre conferíveis contra os hashes da versão publicada.

### Pendências

- Decidir com o autor onde a exportação dos quadros fica guardada e iniciar a etapa 02.

### Referências

- Etapa 01: `acompanhamento/planos/002-prancheta-independente/etapas/01-codigo-do-artefato.md`
- Inventário: `web/inventario-claude.md`

## 2026-11-08 · Plano 002 aberto: Prancheta independente do claude.ai

### Feito

- Mesclado o PR #4 no `main`, a pedido do autor, encerrando o plano 001.
- Analisado como o código do artefato usa o claude.ai: banco de documentos e coleções, com leitura, gravação, atualização, exclusão e assinaturas em tempo real; envio de arquivos; downloads; identidade do usuário; e um modo local que salva no `localStorage` quando `claude.use` não existe.
- Aberto o plano 002, com quatro etapas: código do artefato no repositório, exportação dos dados, servidor de compatibilidade e cliente de compatibilidade.

### Decidido

- **Exportar os dados antes de construir o servidor.** Os quadros do autor continuam crescendo no artefato; tê-los exportados cedo reduz o risco de perda e dá dados reais para testar a importação.
- **Prancheta real dentro da casca no plano 003.** Ligar as duas coisas exige um servidor acessível pelo Boox, que só existirá com a implantação na VPS.

### Pendências

- Iniciar a etapa 01 do plano 002.
- Decidir com o autor onde a exportação dos quadros fica guardada, antes da etapa 02.

### Referências

- Plano 002: `acompanhamento/planos/002-prancheta-independente/plano.md`
- PR #4, mesclado: https://github.com/iago-leal/prancheta-infinita/pull/4

## 2026-11-08 · Plano 001 concluído: casca Android validada no Boox

### Feito

- O autor testou a casca no Boox Note Air4 C. A versão 0.1.0 mostrou "tinta nativa", escrita rápida, zoom com dois dedos e "Reiniciar vista" funcionando, mas o "Limpar" deixava os traços na tela até um gesto de dois dedos.
- Corrigido o "Limpar" na versão 0.1.1: a página pede à casca que redesenhe a tela inteira, e a casca desliga a camada da Onyx, atualiza a tela e a religa. O autor confirmou a correção.
- No relato final, o autor informou que a escrita tem a mesma velocidade do aplicativo de notas da Boox, que o traço cai no lugar certo depois de mover e ampliar e que não há salto ao levantar a caneta.
- Concluídas a etapa 04 e o plano 001, com a decisão registrada no plano e no estado.

### Decidido

- **Seguir com a casca Android.** O experimento confirmou a suposição mais arriscada do projeto: a camada da Onyx funciona sobre a WebView, com a mesma latência do aplicativo de notas, sem bloquear os dedos e sem salto visível. A PWA deixa de ser alternativa para o Boox.
- **Redesenhar a tela inteira depois de apagar traços.** É o único jeito, visto até agora, de remover os traços provisórios do controlador da tela.

### Pendências

- Abrir o plano 002, com o código do artefato no repositório e a camada de compatibilidade.
- Confirmar, numa sessão em contêiner novo, que o script de configuração roda.
- Decidir como distribuir as próximas versões do APK.

### Referências

- Plano 001: `acompanhamento/planos/001-casca-android/plano.md`
- Etapa 04: `acompanhamento/planos/001-casca-android/etapas/04-teste-no-boox.md`
- PR #4: https://github.com/iago-leal/prancheta-infinita/pull/4

## 2026-11-08 · Etapa 04 iniciada: APK enviado para o teste no Boox

### Feito

- Mesclado o PR #3 no `main`, a pedido do autor; o branch de trabalho recomeçou a partir dele.
- Compilado do zero, a partir do `main`, o APK `prancheta-casca-0.1.0-debug.apk`, com os testes passando, e enviado ao autor pelo aplicativo do Claude. O hash está no Registro da etapa 04.

### Pendências

- Registrar o relato do autor sobre o teste no Boox e a decisão de arquitetura.

### Referências

- Etapa 04: `acompanhamento/planos/001-casca-android/etapas/04-teste-no-boox.md`
- PR #3, mesclado: https://github.com/iago-leal/prancheta-infinita/pull/3

## 2026-11-08 · Etapa 03 concluída: camada de tinta da Onyx

### Feito

- Mesclado o PR #2 no `main`, a pedido do autor; o branch de trabalho recomeçou a partir dele.
- Liberado o host `repo.boox.com` no ambiente, com aprovação do autor, e adicionado ao Gradle o SDK da Onyx: `onyxsdk-pen` 1.5.9, `onyxsdk-base` 1.8.10 e `onyxsdk-device` 1.3.7.
- Concluída a etapa 03 do plano 001: a `CamadaOnyx` desenha com o `TouchHelper` sobre a WebView e entrega os traços à página; o `RoteadorDeToques` separa caneta e dedos e suspende a camada nos gestos de dois dedos; a `PranchetaApp` faz a inicialização que o SDK exige.
- Criados seis testes JUnit para o roteador e um teste novo da página; a suíte da página tem agora cinco testes. Todos passam.

### Decidido

- **SDK pelo repositório Maven da Boox.** O autor escolheu essa opção. Ela resolveu a dúvida de licença: o SDK publicado já traz as classes nativas da caneta, que o Boox E-Ink Draw extraía do aparelho.
- **Jetifier ligado.** É a forma de usar as bibliotecas antigas de que o SDK depende sem removê-las; fica o risco de o plugin Android 10 retirar a opção.
- **Endereço padrão do Maven Central mantido.** Trocá-lo para contornar o 429 invalidou o cache e piorou o problema; as repetições configuradas no `gradle.properties`, somadas a uma nova tentativa manual, resolvem.

### Pendências

- Definir com o autor como o APK chegará ao Boox e executar a etapa 04.
- Reduzir o APK, hoje com 21 MB, limitando as bibliotecas nativas às arquiteturas ARM.

### Referências

- Etapa 03: `acompanhamento/planos/001-casca-android/etapas/03-camada-onyx.md`
- PR #2, mesclado: https://github.com/iago-leal/prancheta-infinita/pull/2
- Repositório Maven da Boox: https://repo.boox.com/repository/maven-public/

## 2026-11-08 · Etapa 02 concluída: WebView, página de teste e ponte

### Feito

- Mesclado o PR #1 no `main`, a pedido do autor; o branch de trabalho recomeçou a partir dele.
- Concluída a etapa 02 do plano 001. A casca abre em tela cheia uma WebView com a página de teste, servida dos assets do APK. A página desenha com a `perfect-freehand` usando a pressão, move e amplia com dois dedos e troca a transformação e os traços com a casca pelos objetos `Casca` e `prancheta`.
- Criados quatro testes no Chromium, em `android/testes/`. Todos passam, e dois defeitos introduzidos de propósito, na conversão de coordenadas e no uso da pressão, foram detectados.

### Decidido

- **Assets servidos pelo `WebViewAssetLoader`.** O endereço HTTPS interno permite módulos JavaScript sem liberar à WebView o acesso a arquivos.
- **Contrato da ponte em pixels CSS.** A página não precisa conhecer a densidade da tela; a casca faz a conversão antes de enviar os traços.

### Pendências

- Confirmar no Boox, na etapa 04, que a WebView aparece e funciona, já que esta máquina não roda emulador Android.
- Descobrir de onde obter o SDK da Onyx, no início da etapa 03.

### Referências

- Etapa 02: `acompanhamento/planos/001-casca-android/etapas/02-webview-e-pagina-de-teste.md`
- PR #1, mesclado: https://github.com/iago-leal/prancheta-infinita/pull/1

## 2026-11-08 · Etapa 01 concluída: ambiente compilando a casca Android

### Feito

- Concluída a etapa 01 do plano 001: há um projeto Android mínimo em `android/`, que compila com `./gradlew assembleDebug`. Os detalhes estão no Registro da etapa.
- Liberado o host `dl.google.com` no ambiente `prancheta-infinita`, com aprovação do autor.
- Salvo no ambiente, com aprovação do autor, o script de configuração que instala o Android SDK e faz a compilação inicial, depois de testado do zero nesta sessão.
- Registrados no `AGENTS.md` os comandos de compilação.

### Decidido

- **Plugin Android 9.5.1 com Kotlin embutido e Gradle 9.9.0.** São as versões estáveis mais recentes e compilaram na primeira tentativa; começar nelas evita uma migração logo adiante.
- **Caminho do SDK no `local.properties`.** Gravar `ANDROID_HOME` no perfil do shell foi barrado pelo sistema de permissões; por isso, o script cria o arquivo, que fica fora do Git.

### Pendências

- Confirmar, no início da próxima sessão, que o script de configuração rodou no contêiner novo.
- Estudar como obter as classes do SDK da Onyx sem copiar o `.jar` extraído pelo Boox E-Ink Draw, conforme o Registro da etapa 03.

### Referências

- Etapa 01: `acompanhamento/planos/001-casca-android/etapas/01-ambiente-compilando-apk.md`
- PR #1: https://github.com/iago-leal/prancheta-infinita/pull/1

## 2026-11-07 · Ambiente, brainstorm e estrutura de acompanhamento

### Feito

- Analisado o repositório, que continha apenas o `README.md`.
- Criado o ambiente de nuvem pessoal `prancheta-infinita`, vinculado ao repositório, sem hosts extras, variáveis, segredos ou script de configuração. O ambiente Default ficou intocado.
- Analisado o artefato de origem. Ele é um `index.html` de cerca de 292 KB, com seis MP3 do roteiro guiado, e acessa o claude.ai apenas por `claude.use(...)`, que fornece banco de dados, autopublicação, envio de arquivos, downloads, conversa com o Claude, conectores MCP, identidade, permissões e comentários. De fora, carrega só a `perfect-freehand` 1.2.2, pelo jsDelivr, e a fonte Inter, pelo Google Fonts. O código já tem um desvio para quando `claude.use` não existe.
- Realizado o brainstorm do produto, cujas conclusões estão nas decisões abaixo.
- Lida a documentação do Claude Code sobre memória e boas práticas, além do artigo da Anthropic sobre agentes de longa duração. Com base neles, criados o `AGENTS.md`, o `CLAUDE.md`, a skill `acompanhamento` e esta pasta.
- Aberto o plano 001, experimento da casca Android.

### Decidido

- **Aplicação independente na VPS.** O autor quer sair do claude.ai e hospedar a Prancheta na própria VPS.
- **Casca Android com o SDK da Onyx.** O autor pretende escrever à mão a maior parte do conteúdo no Boox. Relatos de desenvolvedores indicam de 200 a 300 ms de atraso para canvas HTML no navegador da Boox e no Chrome, enquanto o app de notas usa uma camada direta do controlador da tela. O projeto Boox E-Ink Draw, testado justamente no Note Air4 C, mostra que essa camada pode ser usada por um aplicativo de terceiros. Por isso, a PWA pura foi descartada como forma principal de uso no Boox; nos demais aparelhos, a tinta web continua valendo.
- **Experimento antes da migração.** A suposição mais arriscada do projeto é a camada da Onyx funcionar bem sobre uma WebView. Se ela falhar, o produto muda de forma; por isso, é testada primeiro.
- **Camada de compatibilidade.** Como o artefato só fala com o claude.ai por `claude.use(...)`, um servidor que responda por essa porta torna a Prancheta independente quase sem mudar o código. A refatoração vem depois, com testes.
- **Conversa com o Claude e conectores fora da primeira versão.** Fora do claude.ai, a conversa depende de chave de API cobrada por uso, e cada conector exigiria configuração própria.
- **Tinta livre, estrutura por gesto.** O autor teme que o agrupamento automático aumente a margem de erro. Como ele reorganiza bastante, a solução é tinta livre com laço, setas que acompanham a seleção e "manter junto" quando ele decidir. O código já guarda cada traço como item independente, então agrupar depois não exige migrar dados.
- **Reorganização no Boox.** O autor reorganiza no próprio aparelho. Por isso, a divisão entre caneta e dedos e as otimizações de arrasto para e-ink entram na primeira versão.
- **Acompanhamento no repositório.** A memória automática do Claude Code não é compartilhada entre ambientes de nuvem, então o estado do projeto precisa morar no repositório. O `estado.md` é importado pelo `AGENTS.md` para ser carregado em toda sessão; o progresso e as etapas são lidos sob demanda; os procedimentos ficam numa skill, para não pesar no contexto.

### Ideias guardadas

- Leitor de PDF e EPUB. Antes dele, testar a importação das marcações do NeoReader como cartões.
- Transcrição da escrita para busca e ligações, pelo ML Kit no aparelho ou pelo Claude no servidor.
- Blocos automáticos, caso o "manter junto" não baste.
- Volta da conversa com o Claude e, depois, dos conectores.

### Pendências

- Executar o plano 001, começando pela etapa 01.

### Referências

- Artefato de origem: https://claude.ai/artifact/8kN6XdqPT5mL5274xCRtEM
- Boox E-Ink Draw: https://github.com/steffest/boox-einkdraw
- Documentação não oficial do SDK da Onyx: https://progressive-kiwi.github.io/onyx-inking-unofficial-docs/
- Atraso do canvas HTML no Boox: https://help.boox.com/hc/en-us/community/posts/30564322233236-Drawing-latency-on-HTML5-canvas
- Memória no Claude Code: https://code.claude.com/docs/en/memory
- Boas práticas do Claude Code: https://code.claude.com/docs/en/best-practices
- Agentes de longa duração: https://www.anthropic.com/research/effective-harnesses-for-long-running-agents
