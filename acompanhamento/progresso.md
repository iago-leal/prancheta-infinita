---
tipo: progresso
---

# Progresso

Diário do projeto. Cada sessão acrescenta uma entrada no topo; entradas antigas não são reescritas, e correções entram como entrada nova.

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
