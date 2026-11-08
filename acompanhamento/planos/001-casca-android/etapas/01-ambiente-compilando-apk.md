---
tipo: etapa
plano: "001"
etapa: "01"
titulo: Ambiente de nuvem compilando um APK mínimo
status: concluida
depende_de: []
iniciada_em: 2026-11-07
concluida_em: 2026-11-08
---

# Etapa 01: ambiente de nuvem compilando um APK mínimo

## Objetivo

Ter um projeto Android mínimo em `android/` que compile no ambiente de nuvem e deixar o ambiente `prancheta-infinita` preparado para que novas sessões compilem sem configuração manual.

## Critérios de conclusão

- [x] Existe um projeto Android mínimo em `android/`, em Kotlin, com uma Activity vazia e o Gradle Wrapper versionado.
- [x] O comando `./gradlew assembleDebug`, executado em `android/`, gera um APK numa sessão de nuvem.
- [x] Os hosts necessários foram identificados pelos bloqueios reais da rede e liberados no ambiente `prancheta-infinita`, com aprovação do autor.
- [x] O script de configuração foi executado do zero numa sessão de nuvem e salvo no ambiente, com aprovação do autor.
- [x] O comando de compilação está registrado na seção Comandos do `AGENTS.md`.

## Registro

### 2026-11-08

- A máquina já trazia JDK 21, Gradle 8.14.3 e 30 GB livres. O Maven Central, o portal de plugins do Gradle, o `services.gradle.org` e o `maven.google.com` respondiam; o `dl.google.com` era recusado pelo proxy com 403.
- O `dl.google.com` é necessário duas vezes: serve o Android SDK, e o `maven.google.com` redireciona para ele os artefatos do plugin Android. O autor aprovou a liberação desse único host.
- Versões escolhidas: plugin Android 9.5.1, com Kotlin embutido, que dispensa o plugin `org.jetbrains.kotlin.android` e usa o Kotlin 2.2.10; Gradle 9.9.0; compileSdk e targetSdk 36; minSdk 26, igual ao do Boox E-Ink Draw; Java 17 como alvo. A Activity estende `android.app.Activity`, sem dependências do AndroidX.
- O `sdkmanager` está obsoleto e agora delega a uma nova Android CLI, que se instala em `~/.android`, com cerca de 250 MB, e dispensa o passo de aceitar licenças. A CLI registrou `hasOptedIn: false`, ou seja, não envia métricas.
- O plugin Android baixou sozinho o `build-tools` 36.0.0, que é o seu padrão; por isso, o script instala essa versão.
- O único aviso de obsolescência da compilação, `Configuration.setVisible`, vem do plugin Android, e não dos nossos scripts.
- A tentativa de gravar `ANDROID_HOME` no `~/.bashrc` foi barrada pelo sistema de permissões, por alterar o perfil do shell; o caminho do SDK ficou no `android/local.properties`, criado pelo script.
- No primeiro teste do zero, a compilação inicial falhou porque o Maven Central respondeu 429; a repetição passou. O script ganhou uma segunda tentativa, e uma falha nessa compilação apenas gera um aviso, sem impedir a sessão de começar.
- Durante uma compilação, o proxy recusou uma conexão a `play.google.com`, sem nenhum efeito no resultado; por isso, esse host não foi liberado.
- Espaço ocupado: SDK 488 MB, Android CLI 248 MB e cache do Gradle 692 MB.

## Resultado

Etapa concluída. Verificação de cada critério:

1. `git ls-files android` lista o `gradlew`, o `gradlew.bat`, o `gradle-wrapper.jar` e o `gradle-wrapper.properties`; a `MainActivity.kt` declara uma Activity sem conteúdo.
2. `./gradlew assembleDebug` gerou `app-debug.apk`, com 872 KB, em três execuções. O `aapt2 dump badging` confirmou o pacote `com.iagoleal.prancheta`, a `MainActivity` como atividade de entrada e o targetSdk 36.
3. O `dl.google.com`, bloqueado com 403 tanto para o SDK quanto para o plugin Android, foi liberado com aprovação do autor. Os demais hosts usados já eram permitidos.
4. Depois de apagar `/opt/android-sdk`, `~/.android`, `~/.gradle` e o `local.properties`, o script foi executado a partir de `/home/user` e terminou com sucesso em 2 min 09 s, deixando o APK compilado. Em seguida, foi salvo no ambiente com aprovação do autor. Ressalva: a execução dentro de um contêiner novo só poderá ser observada no início da próxima sessão.
5. A seção Comandos do `AGENTS.md` traz o comando de compilação, o caminho do SDK e o que fazer se faltar o `local.properties`.
