# Prancheta Infinita

Quadro infinito pessoal, nascido como artefato do claude.ai, que está sendo transformado em aplicação independente, hospedada na VPS do autor e pensada para escrita à mão em e-ink, sobretudo no Boox Note Air4 C.

## Estado atual

O arquivo abaixo é importado em toda sessão e resume onde o projeto está.

@acompanhamento/estado.md

## Protocolo de acompanhamento

O andamento do projeto fica em `acompanhamento/`. Os modelos de arquivo e os passos detalhados estão na skill `acompanhamento`, em `.claude/skills/acompanhamento/SKILL.md`.

1. Ao iniciar uma sessão, além do estado acima, leia as entradas mais recentes de `acompanhamento/progresso.md`, rode `git log --oneline -15` e, se houver plano ativo, leia o `plano.md` e a etapa atual.
2. Trabalhe em uma etapa por vez e registre na seção Registro da etapa o que foi feito, as descobertas e os desvios.
3. Critérios de conclusão, depois de escritos, só podem ser marcados. Nunca edite nem remova um critério; se ele se mostrar errado, registre o problema e consulte o autor.
4. Só marque uma etapa como `concluida` depois de verificar todos os critérios, e registre como cada um foi verificado.
5. Ao encerrar a sessão, acrescente uma entrada no topo de `acompanhamento/progresso.md` e atualize `acompanhamento/estado.md`, que deve ficar com no máximo 60 linhas.
6. Inclua as atualizações de acompanhamento no mesmo commit do trabalho a que se referem.

## Convenções

- Escreva documentação, mensagens de commit e comentários em português.
- Use datas no formato AAAA-MM-DD.
- Proponha mudanças no ambiente de nuvem `prancheta-infinita` somente diante de uma necessidade concreta, como um bloqueio real da rede, e salve-as apenas com a aprovação do autor.

## Comandos

- Compilar a casca Android: `cd android && ./gradlew assembleDebug`. O APK sai em `android/app/build/outputs/apk/debug/app-debug.apk`.
- O Android SDK fica em `/opt/android-sdk`, instalado pelo script de configuração do ambiente. Se `android/local.properties` não existir, crie-o com `echo "sdk.dir=/opt/android-sdk" > android/local.properties`.
- O Maven Central às vezes responde 429, excesso de requisições, mesmo com as repetições configuradas no `android/gradle.properties`; nesse caso, repita a compilação, que aproveita o que já foi baixado. Não troque o endereço do Maven Central: isso invalida o cache.
- Testar a lógica nativa com JUnit: `cd android && ./gradlew testDebugUnitTest`.
- Testar a página da casca no Chromium, a partir da raiz do repositório: `node --test android/testes/*.test.cjs`. Usa o Playwright e o Chromium já instalados na máquina.
- Testar a Prancheta em `web/` no Chromium, a partir da raiz do repositório: `node --test web/testes/*.test.cjs`.
- Conferir que `web/` guarda a versão publicada do artefato: `sha256sum -c web/artefato-publicado.sha256`.
- Testar o montador da exportação: `python3 -m unittest discover -s web/exportacao`. Os dados exportados nunca vão para o Git.
