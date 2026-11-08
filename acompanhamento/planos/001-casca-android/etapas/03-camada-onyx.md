---
tipo: etapa
plano: "001"
etapa: "03"
titulo: Camada de tinta da Onyx ligada à página
status: concluida
depende_de: ["02"]
iniciada_em: 2026-11-08
concluida_em: 2026-11-08
---

# Etapa 03: camada de tinta da Onyx ligada à página

## Objetivo

Sobrepor à WebView a camada de tinta da Onyx, de modo que a caneta desenhe com latência baixa e os pontos de cada traço cheguem à página quando a caneta for levantada. Como a nuvem não tem o aparelho, aqui a verificação é feita pela compilação e pela revisão do código; o comportamento na tela é confirmado na etapa 04.

## Critérios de conclusão

- [x] As dependências `onyxsdk-base`, `onyxsdk-device` e `onyxsdk-pen` são resolvidas, com versões fixadas e registradas nesta etapa.
- [x] O código liga a camada da Onyx sobre a WebView e, ao levantar a caneta, entrega os pontos do traço à página pela ponte da etapa 02.
- [x] O código desliga a camada na área da barra de ferramentas e durante gestos de dois dedos, e a religa quando eles terminam.
- [x] O código encaminha os toques dos dedos à WebView enquanto a camada está ativa.
- [x] Em aparelhos sem o SDK da Onyx, o código recorre à tinta web da página em vez de falhar.
- [x] O APK compila com `./gradlew assembleDebug`.

## Registro

### 2026-11-08

Descobertas feitas durante a etapa 01, ao consultar o Boox E-Ink Draw, que usa o SDK da Onyx no Note Air4 C:

- O projeto usa as bibliotecas `onyxsdk-base` 1.8.4, `onyxsdk-pen` 1.5.2 e `onyxsdk-device` 1.3.3 como arquivos `.aar` locais em `app/libs/`, além de RxJava 1 e 2 e da `hiddenapibypass` 4.3.
- Ele também inclui um `.jar` com classes nativas da caneta extraídas do aplicativo de notas do próprio aparelho, porque faltam no `onyxsdk-pen` publicado. Copiar esse arquivo levanta dúvidas de licença; a alternativa precisa ser estudada antes de usá-lo.
- O repositório Maven da Boox é acessado por HTTP sem criptografia, em `repo.boox.com`. Pela rede do ambiente, `repo.boox.com` e `jitpack.io` estão bloqueados hoje, e o acesso por HTTP pode não passar pelo proxy.

### 2026-11-08, execução da etapa

- O autor escolheu obter o SDK pelo repositório Maven da Boox e aprovou a liberação do host `repo.boox.com`. O repositório responde por HTTPS, mas oferece uma chave Diffie-Hellman que o OpenSSL 3 do `curl` recusa por ser pequena; o Java, que o Gradle usa, aceita a conexão por TLS 1.2. Não foi preciso afrouxar nenhuma configuração de segurança.
- Versões fixadas: `onyxsdk-pen` 1.5.9, `onyxsdk-base` 1.8.10 e `onyxsdk-device` 1.3.7, as mais recentes publicadas. O `onyxsdk-pen` traz ainda `onyxsdk-penbrush` 1.1.2, `onyxsdk-pennative` 1.0.5, `onyxsdk-geometry` 1.1.8, `onyxsdk-baselite` 1.1.2 e `onyxsdk-commons-io` 2.5.
- A dúvida de licença se resolveu: o SDK publicado já traz o `NeoPenConfig`, o `NeoPenUtils`, o `NeoPenNative` e a biblioteca `libneopen_jni.so`, que o Boox E-Ink Draw extraía do aparelho. Nada foi copiado de fora do SDK.
- O Boox E-Ink Draw não tem licença, o que significa todos os direitos reservados; por isso, serviu só para entender o uso da API, e nenhum trecho foi copiado. A API foi lida diretamente das classes da versão 1.5.9 com `javap`. Os repositórios de referência foram clonados apenas para leitura.
- Problemas de compilação e soluções:
  - O `onyxsdk-base` depende de `pub.devrel:easypermissions` 0.2.1 e `com.tencent:mmkv` 1.0.19, que só existem no repositório da Boox; o filtro do repositório passou a incluir esses dois grupos.
  - O `easypermissions` traz o antigo `appcompat-v7` 24.2.1, que duplicava classes do AndroidX. O Jetifier, ligado no `gradle.properties`, converte essas bibliotecas; o plugin avisa que a opção será removida no plugin Android 10.
  - A conversão gerou o `androidx.vectordrawable` 1.0.0, cujas duas partes repetem o mesmo namespace; restrições de versão exigem a 1.2.0.
  - A `hiddenapibypass` 6.2 exige compileSdk 37; ficou a 6.1.
  - Várias bibliotecas trazem a própria `libc++_shared.so`; o empacotamento usa a primeira.
- O Maven Central respondeu 429 com frequência. Trocar o endereço para `repo1.maven.org` piorou, porque invalidou o cache e gerou uma rajada de requisições; a troca foi desfeita. O `gradle.properties` passou a pedir mais repetições, com intervalo maior, e, quando ainda falha, repetir a compilação resolve.
- Arquitetura implementada:
  - `RoteadorDeToques`: decide o destino de cada evento. A caneta vai para a camada, exceto quando o traço começa numa área reservada; os dedos vão para a WebView; dois ou mais dedos suspendem a camada até o último sair; a caneta que começa durante o gesto é descartada.
  - `CamadaOnyx`: cria o `TouchHelper` sobre a WebView e o configura numa thread própria, na ordem que o SDK exige, com estilo lápis, cor preta e as áreas reservadas excluídas do limite. Junta os pontos do traço, preferindo a lista completa que o SDK entrega, normaliza a pressão pela pressão máxima do aparelho e entrega o traço à ponte ao fim. Ajusta a largura do traço provisório ao zoom e atualiza a tela depois que a página desenha.
  - `PranchetaApp`: inicializa o `RxManager` e libera as APIs ocultas do Android, só em aparelhos Onyx.
  - A página informa a área da barra pela ponte, ao carregar e quando a tela muda de tamanho, e mostra na barra qual tinta está ativa.
- O APK passou de 2,1 MB para 21 MB, por causa das dependências do SDK e das bibliotecas nativas para cinco arquiteturas. Restringir às arquiteturas ARM pode reduzi-lo depois.

## Resultado

Etapa concluída. Como a nuvem não tem o aparelho, a verificação foi feita pela compilação, pela revisão do código e por testes da lógica que não depende do SDK. Verificação de cada critério:

1. O `app/build.gradle.kts` declara `onyxsdk-pen` 1.5.9, `onyxsdk-base` 1.8.10 e `onyxsdk-device` 1.3.7, e a árvore de dependências do Gradle as mostra resolvidas como dependências diretas. As versões estão registradas acima.
2. Revisão do código: a `MainActivity` cria a `CamadaOnyx` sobre a WebView, e o `onEndRawDrawing` entrega os pontos a `ponte.enviarTraco`, que chama `prancheta.receberTraco`. O teste da página da etapa 02 continua verificando a recepção e a conversão desses pontos.
3. Barra: a página informa sua área, a `CamadaOnyx` a exclui do limite do `TouchHelper`, e o roteador manda para a WebView o traço que começa nela. Dois dedos: o roteador suspende a camada e a religa ao fim do gesto. Os testes JUnit do `RoteadorDeToques` cobrem os dois casos e o cancelamento do gesto, e um teste da página confirma o envio da área da barra.
4. O roteador manda os dedos para a WebView, com e sem gesto de dois dedos, como verificam os testes JUnit, e a `MainActivity` repassa esses eventos ao `super.dispatchTouchEvent`.
5. Revisão do código: a `CamadaOnyx.criar` devolve `null` fora dos aparelhos Onyx ou quando o SDK lança qualquer erro, e então todos os eventos vão para a WebView. Uma falha posterior, na thread da camada, chama `usarTintaWeb`, que encerra a camada e avisa a página. O teste da página verifica a troca de tinta.
6. `./gradlew assembleDebug testDebugUnitTest` passa; o APK contém a `CamadaOnyx`, a `PranchetaApp` registrada no manifesto, o `TouchHelper`, o `NeoPenNative` e a `libneopen_jni.so`. Os seis testes JUnit passam, e um defeito introduzido de propósito na regra dos dois dedos derrubou dois deles.
