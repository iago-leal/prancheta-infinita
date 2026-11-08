---
tipo: etapa
plano: "003"
etapa: "05"
titulo: Publicação na VPS e acesso protegido
status: pendente
depende_de: ["01", "03", "04"]
iniciada_em:
concluida_em:
---

# Etapa 05: publicação na VPS e acesso protegido

## Objetivo

Publicar na VPS a Prancheta de `web/app/` e o servidor de sincronização a cada envio à `main`, pelo canal restrito do GitHub criado antes deste plano, servindo os dois por HTTPS no endereço escolhido pelo autor, e ligar a casca e o navegador do computador a esse servidor.

## Critérios de conclusão

- [ ] Cada envio à `main` publica na VPS a pasta `web/app/` e o servidor de sincronização, pelo canal restrito do GitHub, sem usar acesso de administrador.
- [ ] As ações de administrador na VPS, feitas uma única vez pelo autor, estão num roteiro do repositório, e o servidor da Prancheta roda numa conta sem privilégios, sem mexer nos outros serviços da VPS.
- [ ] A Prancheta e o servidor respondem por HTTPS no endereço escolhido pelo autor, e o servidor só atende com a chave de acesso.
- [ ] No navegador do computador, a Prancheta aberta no endereço da VPS continua funcionando sem internet depois da primeira visita.
- [ ] O autor confirma que um quadro feito no Boox aparece no computador e um quadro feito no computador aparece no Boox.

## Registro

## Resultado
