# Implantação na VPS

A Prancheta roda na VPS num contêiner próprio, atrás do Traefik, que já emite os certificados e encaminha cada endereço. O mesmo endereço entrega a página, `web/app/`, e a sincronização, em `/sync/`, de modo que o navegador do computador não precisa de nada além dele. O endereço nunca entra no repositório: fica em `/etc/prancheta/ambiente`, legível só pelo administrador, e no segredo opcional do GitHub.

## Arquivos

| Arquivo | O que é | Onde fica na VPS |
|---|---|---|
| `preparar-vps.sh` | roteiro do administrador, executado uma vez e seguro para repetir | não fica instalado |
| `compose.yml` | o contêiner, com os rótulos do Traefik | `/opt/prancheta/compose.yml` |
| `prancheta-publicar` | comando forçado da conta `prancheta`, a única coisa que a chave do GitHub executa | `/usr/local/bin/prancheta-publicar` |
| `prancheta-chave` | cria, lista e revoga as chaves dos aparelhos | `/usr/local/sbin/prancheta-chave` |

## Uma vez, como administrador

No computador do autor, a partir da raiz do repositório:

```sh
scp -r servidor/implantacao <vps>:/root/prancheta-implantacao
ssh <vps> 'bash /root/prancheta-implantacao/preparar-vps.sh <endereço da Prancheta>'
```

O roteiro confere a conta `prancheta`, criada junto com o canal de publicação, e se recusa a seguir se ela estiver no grupo `docker`, o que equivaleria a dar a ela acesso de administrador, ou se algum arquivo do administrador, em `/root` e `/etc`, tiver o mesmo dono numérico que ela, porque o servidor da Prancheta roda com esse número. Em seguida, instala os dois comandos, cria as pastas, grava o ambiente e o `compose.yml`, cria a rede `prancheta_borda`, sem saída para a internet, liga o Traefik a ela sem reiniciá-lo e liga o contêiner. Ele não edita o arquivo do Traefik: se a rede ainda não estiver declarada nele, mostra o trecho a acrescentar, para que ela continue lá quando o Traefik for recriado.

Depois, crie uma chave para cada aparelho. Cada chave aparece uma única vez, para ser digitada no botão "Sincronizar" da Prancheta daquele aparelho, junto com o endereço:

```sh
prancheta-chave nova boox
prancheta-chave nova computador
prancheta-chave nova copia
```

O servidor guarda só o resumo SHA-256 de cada chave, em `/etc/prancheta/acesso/chaves`, e relê o arquivo quando ele muda. Para desligar um aparelho perdido, `prancheta-chave revogar boox` vale na hora, sem trocar a chave dos outros.

Por fim, no GitHub, cadastre o segredo `VPS_PRANCHETA_ANFITRIAO` com o endereço, para que cada publicação confira que a versão nova entrou no ar, e faça a primeira publicação em Actions, "Publicar na VPS", "Run workflow".

## A cada envio à main

O fluxo `.github/workflows/publicar.yml` testa o servidor, confere a página montada, monta um pacote com `web/app` e `servidor` por `git archive` e o envia pela conta `prancheta` com `publicar <commit>`. O comando forçado:

- aceita só `verificar`, `publicar <commit>`, `versoes` e `voltar <commit>`;
- recusa pacotes com mais de 80 MB, com atalhos, com caminhos absolutos, com `..` ou fora de `web/app` e `servidor`, e pacotes sem os arquivos do servidor e da página;
- guarda a versão em `/home/prancheta/publicado/versoes/<commit>`, grava `web/app/versao.txt` com o commit e troca o atalho `atual`, mantendo as cinco versões mais recentes.

O servidor, no contêiner, percebe em até 5 segundos que o atalho mudou e termina; o Docker o reinicia com a versão nova. A conta `prancheta` nunca usa o Docker nem o administrador.

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
