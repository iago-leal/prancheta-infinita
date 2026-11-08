---
tipo: etapa
plano: "003"
etapa: "06"
titulo: Atualização da casca pelo próprio aplicativo
status: em_andamento
depende_de: ["01"]
iniciada_em: 2026-11-08
concluida_em:
---

# Etapa 06: atualização da casca pelo próprio aplicativo

## Objetivo

Acabar com o envio do APK a cada versão: o GitHub compila e publica cada versão da casca, e a própria casca, ao abrir com internet, oferece a atualização, baixa e instala o APK, mantendo os quadros do aparelho.

## Critérios de conclusão

- [ ] A cada envio à `main` que mude a casca ou a Prancheta, o GitHub testa e compila o APK, assinado com a mesma chave das versões instaladas, e o publica como versão do repositório, sem substituir uma versão já publicada.
- [ ] Ao abrir com internet, a casca consulta a última versão e, se houver uma mais nova, oferece atualizar; sem internet, abre normalmente, sem atraso nem erro.
- [ ] A atualização é baixada e instalada por dentro do aplicativo, com a confirmação do Android, e mantém os quadros do aparelho.
- [x] A casca só baixa APKs anexados às versões deste repositório.
- [x] Testes JUnit cobrem a leitura da versão publicada e a decisão de atualizar.
- [ ] O autor atualiza o aplicativo no Boox por dentro dele, sem receber o APK por outro meio.

## Registro

### 2026-11-08

- Criada a pedido do autor, que achou trabalhoso receber o APK a cada versão.
- O fluxo `.github/workflows/casca.yml` testa e compila a casca a cada mudança em `android/` ou `web/app/`, inclusive nos PRs, e, na `main`, publica o APK como versão com a etiqueta `casca-<versionCode>`, sem substituir uma etiqueta que já exista; para publicar uma versão nova, basta aumentar o `versionCode`.
- O APK precisa da mesma chave das versões instaladas, que é a chave de depuração deste ambiente, criada no plano 001, com SHA-256 `22:93:58:5A:45:48:7E:21:A0:FD:43:C4:52:78:D8:4E:FB:F9:BE:EE:3B:A0:C7:CF:D8:1E:73:A8:59:36:74:8B`. Com outra chave, a atualização exigiria desinstalar o aplicativo, o que apagaria os quadros do aparelho enquanto não houver sincronização. O fluxo lê a chave do segredo `CASCA_CHAVE_BASE64`, que só o autor pode cadastrar; sem ele, compila e testa, mas não publica.
- A casca ganhou o `Atualizador`: ao voltar ao primeiro plano, no máximo a cada 6 horas, consulta a API do GitHub numa thread própria; se a versão publicada tiver `versionCode` maior, oferece atualizar. Na primeira vez, o Android pede que o autor permita a instalação de atualizações pela Prancheta. O APK é baixado direto para uma sessão do `PackageInstaller`, e o Android mostra a confirmação. A classe `Atualizacao` só aceita anexos de `https://github.com/iago-leal/prancheta-infinita/releases/download/`.
- Testes: 4 JUnit da `Atualizacao`, que acusam as 3 mutações introduzidas.
- A versão 0.3.0 é a última enviada ao autor à mão; as seguintes chegam pelo próprio aplicativo depois que o segredo for cadastrado e o fluxo publicar a primeira versão.

### 2026-11-08, primeira publicação

- O autor cadastrou o segredo `CASCA_CHAVE_BASE64`, e o PR #12 foi mesclado. O envio à `main` disparou o fluxo, que testou, compilou e publicou a versão `casca-4`, com o nome Casca 0.3.0 e o anexo `prancheta-casca-0.3.0.apk`, de 21.990.910 bytes e SHA-256 `d48a6ff75a145a4b2cbcc2ca75b08ce73cec515a61d983155f2cc1e9b5cc8b80`.
- O APK publicado, baixado do endereço da versão, tem `versionCode` 4, `versionName` 0.3.0 e a mesma assinatura das versões instaladas, com certificado de SHA-256 `2293585a45487e21a0fd43c45278d84efbf9beee3ba0c7cfd81e73a85936748b`, conferida com `apksigner`.
- A resposta real da API do GitHub para essa versão virou um teste JUnit, em `android/app/src/test/resources/ultima-versao-casca-4.json`, e a `Atualizacao` a lê corretamente; são 20 testes JUnit ao todo.
- Para confirmar que uma versão publicada não é substituída, o fluxo foi disparado de novo na `main`, sem mudar o `versionCode`.

## Resultado
