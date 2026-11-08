---
tipo: etapa
plano: "002"
etapa: "03"
titulo: Servidor de compatibilidade
status: descartada
depende_de: ["01", "02"]
iniciada_em:
concluida_em:
---

# Etapa 03: servidor de compatibilidade

## Objetivo

Criar um servidor que sirva a Prancheta e responda às operações de banco e de arquivos que o código do artefato faz, guardando tudo em SQLite e em disco, de modo que depois possa ser implantado na VPS.

## Critérios de conclusão

- [ ] O servidor serve a página e implementa, para documentos e coleções, as operações de ler, gravar, atualizar, apagar e listar, com caminhos no formato usado pelo artefato.
- [ ] As mudanças chegam em tempo real às páginas que acompanham um documento ou uma coleção, como o `onSnapshot` do artefato exige.
- [ ] Os arquivos enviados são guardados em disco e servidos de volta por um endereço próprio do servidor.
- [ ] Testes automatizados cobrem cada operação e confirmam que os dados sobrevivem a um reinício do servidor.
- [ ] A exportação da etapa 02 é importada, e as contagens de documentos e arquivos importados batem com as exportadas.

## Registro

### 2026-11-08

- Decisão do autor: a Prancheta independente começa com o banco limpo. O critério "A exportação da etapa 02 é importada, e as contagens de documentos e arquivos importados batem com as exportadas." fica dispensado pelo autor e não será marcado.
- Etapa descartada antes de começar: o autor decidiu usar a Prancheta sem internet no Boox. Os dados passam a ficar num banco local no próprio aparelho, em IndexedDB dentro da página, e a VPS vira o destino da sincronização, no plano 003. A etapa 05, banco local no navegador, assume o papel de guardar os dados, e o servidor passa a ser um serviço de sincronização, previsto para o plano 003.

## Resultado

Etapa descartada por decisão do autor, sem nenhum critério verificado; o motivo está no Registro.
