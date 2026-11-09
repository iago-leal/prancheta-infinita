# Implantação na VPS

A Prancheta roda na VPS num contêiner próprio e só responde pela rede privada do Tailscale, num endereço terminado em `.ts.net`, que entrega a página, `web/app/`, e a sincronização, em `/sync/`, de modo que o navegador do computador não precisa de nada além dele. Até o plano 005, ela respondia num endereço público, pelo Traefik da VPS; esse endereço foi fechado. Nenhum dos dois endereços entra no repositório: o antigo fica só no segredo opcional do GitHub, que confere que ele está fechado, e o da rede privada, só nos aparelhos.

## Arquivos

| Arquivo | O que é | Onde fica na VPS |
|---|---|---|
| `preparar-vps.sh` | roteiro do administrador, executado uma vez e seguro para repetir | não fica instalado |
| `compose.yml` | os contêineres da Prancheta e do Tailscale | `/opt/prancheta/compose.yml` |
| `tailscale-serve.json` | o que o Tailscale entrega pela rede privada: a página em `/` e a sincronização em `/sync/` | `/opt/prancheta/tailscale-serve.json` |
| `prancheta-publicar` | comando forçado da conta `prancheta`, a única coisa que a chave do GitHub executa | `/usr/local/bin/prancheta-publicar` |
| `prancheta-chave` | cria, lista e revoga as chaves dos aparelhos | `/usr/local/sbin/prancheta-chave` |

## Uma vez, como administrador

No computador do autor, a partir da raiz do repositório:

```sh
ssh <vps> 'rm -rf /root/prancheta-implantacao'
scp -r servidor/implantacao <vps>:/root/prancheta-implantacao
ssh <vps> 'bash /root/prancheta-implantacao/preparar-vps.sh'
```

A pasta é apagada antes da cópia porque, se ela já existe, o `scp -r` cria uma subpasta dentro dela, e o roteiro executado seria o antigo.

O roteiro confere a conta `prancheta`, criada junto com o canal de publicação, e se recusa a seguir se ela estiver no grupo `docker`, o que equivaleria a dar a ela acesso de administrador, ou se algum arquivo do administrador, em `/root` e `/etc`, tiver o mesmo dono numérico que ela, porque o servidor da Prancheta roda com esse número. Em seguida, instala os dois comandos, cria as pastas, grava o ambiente e o `compose.yml`, cria a rede `prancheta_borda`, sem saída para a internet, só da Prancheta e do Tailscale, e liga os contêineres. Se o Traefik ainda estiver ligado a essa rede, do tempo do endereço público, o roteiro o desliga sem reiniciá-lo. Ele não edita o arquivo do Traefik: se a rede ainda estiver declarada nele, mostra o trecho a tirar, para que o Traefik não volte a se ligar a ela quando for recriado.

Depois, crie uma chave para cada aparelho. Cada chave aparece uma única vez, para ser digitada no botão "Sincronizar" da Prancheta daquele aparelho, junto com o endereço:

```sh
prancheta-chave nova boox
prancheta-chave nova computador
prancheta-chave nova copia
```

O servidor guarda só o resumo SHA-256 de cada chave, em `/etc/prancheta/acesso/chaves`, e relê o arquivo quando ele muda. Para desligar um aparelho perdido, `prancheta-chave revogar boox` vale na hora, sem trocar a chave dos outros.

Por fim, faça a primeira publicação no GitHub, em Actions, "Publicar na VPS", "Run workflow". O segredo opcional `VPS_PRANCHETA_ANFITRIAO`, com o endereço público antigo, faz cada publicação conferir que ele não entrega mais a Prancheta.

## Rede privada

Pelo plano 005, a Prancheta passou a responder pela rede privada do Tailscale, e o endereço público foi fechado depois que o Boox e o computador passaram para ela. Com isso, os aparelhos só sincronizam com o Tailscale ligado; no Boox, deixe o Tailscale rodar em segundo plano, sem congelamento, e ligue para ele a "VPN sempre ativa" do Android, porque o sistema da Boox o desliga quando a tela apaga. O contêiner `tailscale`, ao lado do da Prancheta, entrega por https, com o certificado do próprio Tailscale, a página e a sincronização num nome terminado em `.ts.net`. Ele fica na rede da Prancheta e numa segunda rede, `prancheta_saida`, só para falar com o Tailscale; roda no modo sem interface de rede do sistema, sem nenhum privilégio, e guarda o login em `/var/lib/prancheta-tailscale`. O contêiner da Prancheta continua sem saída para a internet.

Antes de rodar o roteiro, no painel do Tailscale, em DNS, deixe ligados o MagicDNS e os certificados HTTPS. Na primeira vez, o roteiro mostra um endereço de login: abra-o logado na sua conta do Tailscale para aprovar a máquina `prancheta` e, no painel, desative a expiração da chave dela, em Machines. Rode o roteiro de novo para ver o endereço da Prancheta na rede privada. Nenhuma chave do Tailscale é guardada, e o nome da rede não entra no repositório.

O login é feito num contêiner provisório, `prancheta-tailscale-login`, que espera a aprovação sem prazo: o contêiner do serviço daria só 60 segundos ao login e, a cada nova tentativa, geraria outro endereço, de modo que uma aprovação mais lenta cairia num endereço já morto e deixaria uma máquina desligada no painel, como aconteceu na primeira implantação. Rodado de novo depois da aprovação, o roteiro apaga o provisório e religa o serviço, que encontra o login salvo em `/var/lib/prancheta-tailscale`.

O primeiro acesso pelo endereço da rede privada pode falhar por alguns minutos, com um erro de TLS, enquanto o Tailscale emite o certificado. Na primeira implantação, o erro durou cerca de 8 minutos, com a criação do registro de DNS do certificado falhando no lado do Tailscale, e cessou sozinho, sem nenhuma mudança na VPS.

## A cada envio à main

O fluxo `.github/workflows/publicar.yml` testa o servidor, confere a página montada, monta um pacote com `web/app` e `servidor` por `git archive` e o envia pela conta `prancheta` com `publicar <commit>`. O comando forçado:

- aceita só `verificar`, `publicar <commit>`, `versoes` e `voltar <commit>`;
- recusa pacotes com mais de 80 MB, com atalhos, com caminhos absolutos, com `..` ou fora de `web/app` e `servidor`, e pacotes sem os arquivos do servidor e da página;
- guarda a versão em `/home/prancheta/publicado/versoes/<commit>`, grava `web/app/versao.txt` com o commit e troca o atalho `atual`, mantendo as cinco versões mais recentes;
- espera o servidor anotar, em `/var/lib/prancheta/no-ar.json`, que a versão nova está no ar e que a sincronização recusa um pedido sem a chave, e termina com `no ar <commit>`; sem isso em 90 segundos, a publicação falha.

O servidor, no contêiner, percebe em até 5 segundos que o atalho mudou e termina; o Docker o reinicia com a versão nova, que faz a anotação ao começar. A conferência é feita na própria VPS porque, com o endereço público fechado, o GitHub não alcança mais a Prancheta. A conta `prancheta` nunca usa o Docker nem o administrador.

Para voltar a uma versão guardada, como administrador:

```sh
sudo -u prancheta env SSH_ORIGINAL_COMMAND="versoes" /usr/local/bin/prancheta-publicar
sudo -u prancheta env SSH_ORIGINAL_COMMAND="voltar <commit>" /usr/local/bin/prancheta-publicar
```

## O contêiner

O servidor roda com a conta `prancheta`, sem privilégios, com o sistema de arquivos só para leitura, limite de memória e de processos e sem saída para a internet. Ele só grava em `/var/lib/prancheta`, os dados, e não recebe nenhuma chave pelo ambiente. A página vai com cabeçalhos de segurança e uma política que limita as conexões dela ao próprio endereço; os arquivos enviados vão isolados da origem da página.

## Histórico e cópia de segurança

Cada versão aceita de um documento fica por 30 dias em `/var/lib/prancheta/historico/`. Para consultar:

```sh
docker compose --env-file /etc/prancheta/ambiente -f /opt/prancheta/compose.yml exec servidor \
  node atual/servidor/historico.cjs /dados listar canvas-shards/<id>
```

A cópia fora da VPS é puxada pelo computador do autor, com a chave `copia`, por `servidor/copia-de-seguranca.cjs`, descrito em `servidor/LEIA-ME.md`; assim, a VPS não guarda credencial de nenhum outro serviço.

## Cifra ponta a ponta

Pelo plano 005, os quadros chegam à VPS cifrados pelos aparelhos, e ela não tem a chave; o formato está em `servidor/LEIA-ME.md`. A troca, uma vez:

1. Publicar a página e o servidor com a cifra e instalar no Boox a casca com a mesma versão da página, porque na casca a página vem dentro do aplicativo. Até a primeira gravação cifrada, o servidor aceita os dois formatos.
2. Conferir que o Boox e o computador estão sincronizados, sem nada pendente.
3. No computador, em "Sincronizar", criar a chave, guardá-la no Bitwarden e confirmar. O computador reenvia tudo cifrado, e o servidor passa a recusar gravações legíveis. O Boox para e pede a chave.
4. No Boox, informar a chave no mesmo diálogo.
5. Na VPS, como administrador, conferir e tirar do histórico as versões legíveis:

```sh
docker compose --env-file /etc/prancheta/ambiente -f /opt/prancheta/compose.yml exec servidor \
  node atual/servidor/cifra.cjs /dados conferir
docker compose --env-file /etc/prancheta/ambiente -f /opt/prancheta/compose.yml exec servidor \
  node atual/servidor/cifra.cjs /dados apagar-legiveis
docker compose --env-file /etc/prancheta/ambiente -f /opt/prancheta/compose.yml exec servidor \
  node atual/servidor/cifra.cjs /dados conferir
```

A limpeza só apaga se todos os documentos e arquivos atuais estiverem cifrados com a chave do servidor; senão, mostra o que falta e não apaga nada. Ela pode rodar com o servidor no ar. Apagar um arquivo não sobrescreve o disco, e as cópias e os instantâneos da VPS feitos pela Hostinger antes da limpeza guardam os quadros legíveis até expirarem; eles podem ser apagados no painel da Hostinger.

A chave da cifra nunca passa pela VPS, pelo repositório ou por uma sessão do Claude: ela é criada num aparelho, guardada no Bitwarden e digitada ou colada pelo autor nos outros.
