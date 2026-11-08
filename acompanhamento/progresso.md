---
tipo: progresso
---

# Progresso

Diário do projeto. Cada sessão acrescenta uma entrada no topo; entradas antigas não são reescritas, e correções entram como entrada nova.

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
