---
tipo: etapa
plano: "002"
etapa: "03"
titulo: Servidor de compatibilidade
status: pendente
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

## Resultado
