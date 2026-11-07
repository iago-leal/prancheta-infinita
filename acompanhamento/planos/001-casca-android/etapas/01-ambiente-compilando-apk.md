---
tipo: etapa
plano: "001"
etapa: "01"
titulo: Ambiente de nuvem compilando um APK mínimo
status: pendente
depende_de: []
iniciada_em:
concluida_em:
---

# Etapa 01: ambiente de nuvem compilando um APK mínimo

## Objetivo

Ter um projeto Android mínimo em `android/` que compile no ambiente de nuvem e deixar o ambiente `prancheta-infinita` preparado para que novas sessões compilem sem configuração manual.

## Critérios de conclusão

- [ ] Existe um projeto Android mínimo em `android/`, em Kotlin, com uma Activity vazia e o Gradle Wrapper versionado.
- [ ] O comando `./gradlew assembleDebug`, executado em `android/`, gera um APK numa sessão de nuvem.
- [ ] Os hosts necessários foram identificados pelos bloqueios reais da rede e liberados no ambiente `prancheta-infinita`, com aprovação do autor.
- [ ] O script de configuração foi executado do zero numa sessão de nuvem e salvo no ambiente, com aprovação do autor.
- [ ] O comando de compilação está registrado na seção Comandos do `AGENTS.md`.

## Registro

## Resultado
