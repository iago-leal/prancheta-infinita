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

- Compilar a casca Android: `cd android && ./gradlew assembleDebug`. O APK sai em `android/app/build/outputs/apk/debug/app-debug.apk`. A compilação copia `web/app/` para dentro do APK; não há outra cópia da Prancheta em `android/`.
- O Android SDK fica em `/opt/android-sdk`, instalado pelo script de configuração do ambiente. Se `android/local.properties` não existir, crie-o com `echo "sdk.dir=/opt/android-sdk" > android/local.properties`.
- O Maven Central às vezes responde 429, excesso de requisições, mesmo com as repetições configuradas no `android/gradle.properties`; nesse caso, repita a compilação, que aproveita o que já foi baixado. Não troque o endereço do Maven Central: isso invalida o cache.
- Testar a lógica nativa com JUnit: `cd android && ./gradlew testDebugUnitTest`.
- O fluxo `.github/workflows/casca.yml` testa e compila a casca a cada mudança em `android/` ou `web/app/` e, na `main`, publica o APK como versão `casca-<versionCode>`, de onde a casca se atualiza. Para publicar uma versão nova, aumente `versionCode` e `versionName` em `android/app/build.gradle.kts`; uma etiqueta já publicada nunca é substituída.
- Testar a Prancheta, o banco local, a sincronização com o servidor, em dois perfis do Chromium, e a ponte com a casca, simulada, a partir da raiz do repositório: `node --test web/testes/*.test.cjs`. Usa o Playwright e o Chromium já instalados na máquina.
- Conferir que `web/` guarda a versão publicada do artefato: `sha256sum -c web/artefato-publicado.sha256`.
- Montar a Prancheta independente em `web/app/` a partir do original: `node web/montagem/montar.cjs`. Não edite `web/app/index.html` à mão: cada mudança no código do artefato entra em `web/montagem/mudancas.cjs`, com o motivo, e `node web/montagem/montar.cjs --conferir` confirma que a página montada está em dia. A montagem também carimba a `VERSAO` de `web/app/sw.js`; rode-a depois de mudar qualquer arquivo de `web/app/`, ou o teste da página acusa a versão desatualizada.
- Testar o servidor de sincronização, a página entregue por ele e os scripts de implantação: `node --test servidor/testes/*.test.cjs`. Rodá-lo localmente exige `PRANCHETA_CHAVE`, que nunca vai para o Git; o uso está em `servidor/LEIA-ME.md`.
- Publicar na VPS: o fluxo `.github/workflows/publicar.yml` publica `web/app/` e `servidor/` a cada mudança deles na `main`, pela conta sem privilégios `prancheta`. As ações de administrador ficam no roteiro `servidor/implantacao/preparar-vps.sh`, executado pelo autor; o endereço da Prancheta nunca entra no repositório.
- Testar o montador da exportação: `python3 -m unittest discover -s web/exportacao`. Os dados exportados nunca vão para o Git.
