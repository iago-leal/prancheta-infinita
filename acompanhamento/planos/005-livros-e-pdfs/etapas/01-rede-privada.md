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

- [x] No Boox, o Tailscale fica ligado junto com a casca, e a escrita com a tinta da Onyx continua como antes.
- [x] A VPS entra na rede privada, e a página e a sincronização da Prancheta respondem por https num nome da rede privada, com certificado válido, no Boox e no computador.
- [ ] O endereço público da Prancheta deixa de responder à página e à sincronização.
- [x] A publicação pelo GitHub continua funcionando e confere, na própria VPS, que a versão nova está no ar e que a sincronização recusa pedidos sem a chave.
- [ ] As ações de administrador na VPS ficam num roteiro do repositório, executado pelo autor; nenhum nome da rede privada, chave do Tailscale ou endereço entra no repositório.
- [x] O autor confirma, no Boox e no computador, que a Prancheta abre e sincroniza pela rede privada, sem perder nenhum quadro na troca de endereço.

## Registro

### 2026-11-09

- O autor aprovou o plano 005 e estes critérios. Decisões dele: o Tailscale como rede privada; depois que ela funcionar, o endereço público da Prancheta fecha de vez; a cifra, na etapa 02, é ponta a ponta.
- Desenho proposto para a VPS, a confirmar ao implementar: um contêiner do Tailscale ao lado do da Prancheta, na mesma rede interna dela e numa segunda rede só para a conexão com o Tailscale, entrega por https, com o certificado do próprio Tailscale, a página e, em `/sync/`, a sincronização, como o Traefik faz hoje. O login do contêiner na rede privada é feito pelo autor, por um endereço de login, sem chave guardada. Fechar o endereço público é tirar do contêiner da Prancheta as etiquetas do Traefik e desligar o Traefik da rede dela, sem tocar nos outros serviços.
- Conferência da publicação na própria VPS: ao começar, o servidor anota na pasta de dados a versão que entrega e o resultado de um pedido sem a chave à própria sincronização, e o comando de publicação espera essa anotação mostrar a versão nova. O fluxo do GitHub passa a conferir também que o endereço público não responde mais à Prancheta.
- Primeiro passo, do autor: criar a rede no Tailscale, ligar nela o Boox e o computador, ativar os nomes da rede, MagicDNS, e os certificados https no painel do Tailscale, e conferir no Boox que a casca continua escrevendo com o Tailscale ligado, critério 1. Se o Tailscale não conviver com a casca, o desenho muda antes de qualquer ação na VPS.

- O autor criou a rede no Tailscale e ligou nela o Boox e os outros aparelhos; no Boox, com o Tailscale ligado, abriu a Prancheta pela casca e escreveu, e a tinta continuou rápida e igual. Critério 1 verificado pela confirmação dele.
- Primeira fase, com o endereço público ainda aberto, para os aparelhos passarem para a rede privada sem perder nada:
  - `compose.yml` ganha o contêiner `tailscale`: imagem `tailscale/tailscale:stable`, trocável por `TAILSCALE_IMAGEM` no ambiente da VPS; nome `prancheta` na rede privada; modo sem interface de rede do sistema, `TS_USERSPACE`, sem nenhuma capacidade nem privilégio; login guardado em `/var/lib/prancheta-tailscale`; na rede da Prancheta e numa rede nova, `prancheta_saida`, só dele. Nenhuma chave do Tailscale fica no repositório nem na VPS: o login é feito pelo autor, pelo endereço que o contêiner mostra.
  - `tailscale-serve.json` entrega por https, no nome da rede privada, a página em `/`, pela porta 8788, e a sincronização em `/sync/`, pela 8787, como o Traefik faz hoje, sem o Funnel, que abriria o endereço para a internet. Como o Tailscale pode tirar o começo `/sync/` do caminho, a sincronização passou a aceitar as rotas com ele ou sem ele.
  - O servidor, ao começar, anota em `no-ar.json`, na pasta dos dados, a versão em uso e o código que a própria sincronização devolve a um pedido sem a chave; `prancheta-publicar` espera, por até 90 segundos, a anotação da versão nova com a recusa e termina com `no ar <commit>`. O fluxo do GitHub mostra essa conferência e avisa se o comando da VPS ainda for o antigo; enquanto o endereço público estiver aberto, a versão também é conferida nele.
  - O roteiro cria a pasta do login do Tailscale, instala `tailscale-serve.json`, liga os dois contêineres e mostra o endereço de login ou, já aprovado, o endereço da Prancheta na rede privada, sem gravá-lo em lugar nenhum.
- Testes: 4 novos no servidor, 23 ao todo, com o arquivo do contêiner conferido pelo Docker Compose, que agora existe no ambiente da nuvem. Acusam as sete mutações introduzidas: o servidor sem a anotação, a rota sem aceitar a falta de `/sync/`, a publicação sem esperar a anotação, a recusa sem a chave ignorada, o Tailscale com uma capacidade, a porta trocada no que ele entrega e o contêiner da Prancheta com saída para a internet. Um teste deixava o servidor de teste rodando quando falhava, o que travava a suíte; passou a encerrá-lo.
- Segunda fase, depois que o Boox e o computador sincronizarem pela rede privada: tirar os rótulos do Traefik, desligá-lo da rede da Prancheta e fazer o fluxo do GitHub conferir que o endereço público não responde mais.

- O autor ativou no painel do Tailscale o MagicDNS, que já estava ligado, e os certificados HTTPS, ciente de que o nome da máquina que pede o certificado e o da rede ficam em listas públicas de transparência de certificados.
- Mesclado o PR #32, com a casca 0.4.2 publicada como `casca-16`. A sessão do Mac, com a aprovação do autor dada nela, rodou o roteiro na VPS. A trava do roteiro acusou arquivos antigos do administrador com o mesmo dono numérico da conta `prancheta`, que o autor aprovou passar ao administrador, e o roteiro terminou sem erro. O autor aprovou a máquina `prancheta` no Tailscale e desativou a expiração da chave dela. Na segunda rodada, o Tailscale estava na rede, sem reinícios, entregando `/` e `/sync/`. Do Mac, pela rede privada, `/versao.txt` mostrou 8021f46, a versão em uso, e `/sync/estado` respondeu 401. O endereço público continuou respondendo normalmente.
- Problemas na implantação, relatados pela sessão do Mac e corrigidos no repositório:
  - O contêiner do serviço do Tailscale dá só 60 segundos ao login interativo, depois recomeça e gera outro endereço; a primeira aprovação do autor caiu num endereço já morto e deixou uma máquina desligada no painel, que ele removeu. A sessão do Mac fez o login à mão num contêiner provisório, sem prazo, com o mesmo login guardado. O roteiro passou a fazer isso: sem login, ele desliga o serviço, liga o provisório, `prancheta-tailscale-login`, e mostra o endereço; rodado de novo depois da aprovação, apaga o provisório e religa o serviço.
  - O `scp -r` do guia, com a pasta já existente na VPS, cria uma subpasta, e o roteiro executado seria o antigo; o guia e o cabeçalho do roteiro passaram a apagar a pasta antes da cópia.
  - O primeiro acesso pela rede privada falhou por cerca de 8 minutos com erro de TLS, porque a criação do registro de DNS do certificado falhava no lado do Tailscale, e cessou sozinho; o guia e o roteiro passaram a avisar que isso pode durar alguns minutos.
- Critério 4 verificado: a publicação disparada à mão em 2026-11-09, pelo GitHub, terminou com "no ar 8021f46…" e "conferido na VPS: a versão 8021f46… está no ar, e a sincronização recusa pedidos sem a chave", pelo comando novo, instalado pelo roteiro.

- Passagem dos aparelhos: no computador, depois de conferir que tudo estava sincronizado pelo endereço público, o autor abriu a Prancheta pelo endereço da rede privada, informou nele o endereço e a chave do computador, e os quadros vieram do servidor. No Boox, trocou o endereço da sincronização pelo da rede privada, com a mesma chave, e sincronizou; depois a sincronização caiu, com "Sem rede", porque o Tailscale do Boox tinha se desconectado, e voltou assim que ele se reconectou. O sistema da Boox costuma congelar os aplicativos em segundo plano; com o endereço público fechado, o Boox só sincroniza com o Tailscale ligado, e a recomendação ao autor é permitir o Tailscale em segundo plano, sem congelamento, e ligar para ele a "VPN sempre ativa" do Android.
- Critério 2 verificado: a VPS está na rede privada; no computador, a página e a sincronização responderam por https no nome da rede privada, com certificado válido, e no Boox a sincronização respondeu por ele. Na casca, a página vem do APK, e só a sincronização passa pela rede.
- Segunda fase preparada, a aplicar depois da confirmação do autor de que nenhum quadro se perdeu: o contêiner da Prancheta perde os rótulos do Traefik, e o roteiro deixa de pedir o endereço público, desliga o Traefik da rede da Prancheta sem reiniciá-lo e mostra o trecho a tirar do arquivo dele; o fluxo do GitHub passa a conferir que o endereço público não entrega mais a versão publicada nem uma sincronização que pede a chave. O guia e o do servidor passam a tratar só do endereço da rede privada. Os testes acusam as duas mutações introduzidas: um rótulo do Traefik de volta no contêiner e o roteiro ligando o Traefik à rede.

- Critério 6 verificado: o autor confirmou que os quadros estão todos no Boox e no computador, sincronizando pela rede privada, e que ajustou o Tailscale do Boox para ficar sempre ligado.

## Resultado
