---
tipo: etapa
plano: "003"
etapa: "01"
titulo: Prancheta real dentro da casca
status: pendente
depende_de: []
iniciada_em:
concluida_em:
---

# Etapa 01: Prancheta real dentro da casca

## Objetivo

Trocar a página de teste da casca pela Prancheta de `web/app/`, entregue de dentro do APK, e ligar a ponte da casca ao código do artefato, por mudanças listadas em `web/montagem/mudancas.cjs`, para que no Boox a caneta escreva com a tinta da Onyx, um dedo selecione e arraste, dois dedos movam e ampliem o quadro, e tudo funcione sem internet.

## Critérios de conclusão

- [ ] A compilação do APK copia a pasta `web/app/` do repositório para dentro dele, sem uma segunda cópia no Git, e a casca abre a Prancheta a partir dessa cópia, sem internet.
- [ ] Os traços feitos pela camada da Onyx viram traços da Prancheta, no lugar e na escala certos para qualquer zoom, guardados no banco local com identificador, pontos, pressão e horário.
- [ ] Um dedo seleciona e arrasta, dois dedos movem e ampliam o quadro, e a camada da Onyx acompanha a vista e não escreve sobre as barras da Prancheta.
- [ ] Imagens e arquivos enviados ficam no banco local e voltam a aparecer depois de fechar e reabrir o aplicativo.
- [ ] Testes no Chromium cobrem a ponte com uma casca simulada, e testes JUnit cobrem a parte nativa nova.
- [ ] O autor confirma no Boox, sem internet, que escreve, reorganiza e reencontra o quadro depois de fechar e reabrir o aplicativo.

## Registro

## Resultado
