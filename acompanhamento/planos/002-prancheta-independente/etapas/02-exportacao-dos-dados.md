---
tipo: etapa
plano: "002"
etapa: "02"
titulo: Exportação dos dados do artefato
status: concluida
depende_de: ["01"]
iniciada_em: 2026-11-08
concluida_em: 2026-11-08
---

# Etapa 02: exportação dos dados do artefato

## Objetivo

Extrair do banco e do armazenamento de arquivos do artefato todos os dados do autor, como a biblioteca, os quadros, as ajudas, os roteiros e os arquivos enviados, para um formato que o servidor da etapa 03 consiga importar.

## Critérios de conclusão

- [x] O lugar onde a exportação fica guardada foi decidido com o autor, e nenhum dado pessoal vai para o Git sem a aprovação dele.
- [x] A exportação contém todos os documentos das coleções listadas no inventário da etapa 01, e a contagem de quadros bate com a da biblioteca.
- [x] Os arquivos enviados aos quadros, como imagens e PDFs, estão incluídos na exportação, cada um ligado ao quadro que o referencia.
- [x] O formato da exportação está descrito num documento, com um exemplo.
- [x] O artefato original continua intacto: nenhuma escrita foi feita no banco nem nos arquivos dele.

## Registro

### 2026-11-08

- O autor escolheu guardar a exportação fora do Git: o pacote é montado nesta sessão e entregue a ele pelo aplicativo do Claude.
- Coleta feita só com ações de leitura: `list` da ferramenta `ArtifactData`, gravando cada documento como JSON, e `list` e `read` da ferramenta `Artifact` para os arquivos enviados. Foram lidas as coleções `library`, `canvas-meta`, `canvas-shards`, `roteiros`, `ajuda`, `web`, `diag`, `code`, `code-backup`, `data/users/me`, `boards` e, para cada um dos quatro quadros além do principal, `boards/<id>/meta` e `boards/<id>/shards`. A coleção `boards` não tem documentos próprios, e um dos quadros não tem fragmentos.
- O parâmetro `paths` da leitura de artefatos aceita só arquivos publicados; os arquivos enviados precisaram ser lidos um a um pelo parâmetro `path`.
- O script `web/exportacao/montar_exportacao.py` monta o pacote com o manifesto, os documentos e os arquivos, e confere as contagens e as citações. Os testes em `web/exportacao/test_montar_exportacao.py` usam dados fictícios. A primeira versão do script só verificava citações pelo campo `asset`; passou a verificar também o campo `dc`, que cita o texto de arquivos.
- Resultado: 38 documentos, 9 arquivos, 16 fragmentos e 722 itens; os 5 quadros da biblioteca têm metadados exportados. Três arquivos estão ligados aos fragmentos que os citam; seis não são citados por nenhum documento atual, um deles cópia idêntica de outro, e foram incluídos mesmo assim. Nenhum item cita arquivo ausente.
- O pacote `prancheta-exportacao-2026-11-08.zip`, com 669 KB e SHA-256 `326cc6004dfec695ed30913d2eca71af1cf1c6ed21a3288bb2c79794072b8c0e`, passou no teste de integridade do `unzip` e foi enviado ao autor. Ele existe só no espaço temporário desta sessão; numa sessão nova, a etapa 03 vai precisar que o autor reenvie o pacote, ou que a exportação seja refeita conforme `web/exportacao/formato.md`.

### 2026-11-08, depois da conclusão

- O autor decidiu que a Prancheta independente começa com o banco limpo, sem migrar os dados do artefato. As cópias temporárias da exportação nesta sessão foram apagadas; o pacote enviado ao autor e o artefato original continuam intactos. O montador e a descrição do formato ficam no repositório, caso o autor mude de ideia.

## Resultado

Etapa concluída. Verificação de cada critério:

1. O autor escolheu a opção de guardar a exportação fora do Git. O repositório recebeu apenas o script, os testes com dados fictícios e a descrição do formato; os documentos e os arquivos ficaram só no espaço temporário da sessão e no pacote enviado ao autor.
2. Foram exportados todos os documentos das coleções listadas em `web/inventario-claude.md`, 38 no total, e o manifesto confirma 5 quadros na biblioteca e 5 quadros com metadados exportados, com `quadros_conferem` verdadeiro.
3. Os 9 arquivos enviados estão no pacote, com hashes iguais aos da listagem do artefato. Os 3 citados estão ligados, no manifesto, aos fragmentos dos quadros que os citam; os 6 sem citação aparecem em `arquivos_sem_referencia`.
4. `web/exportacao/formato.md` descreve o pacote, o manifesto e como refazer a exportação, com um exemplo fictício.
5. Só foram usadas ações de leitura das ferramentas de artefato, sem nenhuma escrita no banco nem nos arquivos.
