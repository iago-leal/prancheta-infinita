---
tipo: etapa
plano: "005"
etapa: "01"
titulo: Rede privada com o Tailscale e endereço público fechado
status: em_andamento
depende_de: []
iniciada_em: 2026-11-09
concluida_em:
---

# Etapa 01: rede privada com o Tailscale e endereço público fechado

## Objetivo

Pôr o Boox, o computador e a VPS numa rede privada do Tailscale, fazer a página e a sincronização da Prancheta responderem só por ela, com https, e fechar o endereço público, sem perder a publicação pelo GitHub nem os quadros guardados nos aparelhos.

## Critérios de conclusão

- [ ] No Boox, o Tailscale fica ligado junto com a casca, e a escrita com a tinta da Onyx continua como antes.
- [ ] A VPS entra na rede privada, e a página e a sincronização da Prancheta respondem por https num nome da rede privada, com certificado válido, no Boox e no computador.
- [ ] O endereço público da Prancheta deixa de responder à página e à sincronização.
- [ ] A publicação pelo GitHub continua funcionando e confere, na própria VPS, que a versão nova está no ar e que a sincronização recusa pedidos sem a chave.
- [ ] As ações de administrador na VPS ficam num roteiro do repositório, executado pelo autor; nenhum nome da rede privada, chave do Tailscale ou endereço entra no repositório.
- [ ] O autor confirma, no Boox e no computador, que a Prancheta abre e sincroniza pela rede privada, sem perder nenhum quadro na troca de endereço.

## Registro

### 2026-11-09

- O autor aprovou o plano 005 e estes critérios. Decisões dele: o Tailscale como rede privada; depois que ela funcionar, o endereço público da Prancheta fecha de vez; a cifra, na etapa 02, é ponta a ponta.
- Desenho proposto para a VPS, a confirmar ao implementar: um contêiner do Tailscale ao lado do da Prancheta, na mesma rede interna dela e numa segunda rede só para a conexão com o Tailscale, entrega por https, com o certificado do próprio Tailscale, a página e, em `/sync/`, a sincronização, como o Traefik faz hoje. O login do contêiner na rede privada é feito pelo autor, por um endereço de login, sem chave guardada. Fechar o endereço público é tirar do contêiner da Prancheta as etiquetas do Traefik e desligar o Traefik da rede dela, sem tocar nos outros serviços.
- Conferência da publicação na própria VPS: ao começar, o servidor anota na pasta de dados a versão que entrega e o resultado de um pedido sem a chave à própria sincronização, e o comando de publicação espera essa anotação mostrar a versão nova. O fluxo do GitHub passa a conferir também que o endereço público não responde mais à Prancheta.
- Primeiro passo, do autor: criar a rede no Tailscale, ligar nela o Boox e o computador, ativar os nomes da rede, MagicDNS, e os certificados https no painel do Tailscale, e conferir no Boox que a casca continua escrevendo com o Tailscale ligado, critério 1. Se o Tailscale não conviver com a casca, o desenho muda antes de qualquer ação na VPS.

## Resultado
