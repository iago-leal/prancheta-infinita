#!/bin/bash
# Roteiro do administrador para a Prancheta na VPS, executado uma vez pelo
# autor e seguro para repetir. Não mexe nos outros serviços: cria só o que é
# da Prancheta e liga o Traefik a uma rede nova, sem reiniciá-lo.
#
# Uso, a partir da raiz do repositório, no computador do autor:
#
#   scp -r servidor/implantacao <vps>:/root/prancheta-implantacao
#   ssh <vps> 'bash /root/prancheta-implantacao/preparar-vps.sh <endereço da Prancheta>'
#
# O endereço vai só para /etc/prancheta/ambiente, legível pelo administrador,
# e nunca para o repositório. O roteiro:
#
#  1. confere a conta prancheta, criada junto com o canal de publicação, que
#     ela não está no grupo docker e que nenhum arquivo do administrador, em
#     /root e /etc, tem o mesmo dono numérico que ela;
#  2. instala o comando da publicação, prancheta-publicar, e o das chaves,
#     prancheta-chave;
#  3. cria as pastas: o código publicado, em /home/prancheta/publicado; os
#     dados, em /var/lib/prancheta; e os resumos das chaves, em /etc/prancheta/acesso;
#  4. grava /etc/prancheta/ambiente e /opt/prancheta/compose.yml;
#  5. cria a rede prancheta_borda, sem saída para a internet, e liga o Traefik
#     a ela sem reiniciá-lo; se o arquivo do Traefik ainda não a declara,
#     mostra o trecho a acrescentar, para que ela continue lá quando ele for recriado;
#  6. liga o contêiner, que espera a primeira publicação se o código ainda não chegou.
#
# Variáveis opcionais: TRAEFIK, o nome do contêiner do Traefik, por padrão
# root-traefik-1; COMPOSE_DO_TRAEFIK, o arquivo dele, por padrão /root/docker-compose.yml.

set -euo pipefail

ANFITRIAO="${1:-}"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TRAEFIK="${TRAEFIK:-root-traefik-1}"
COMPOSE_DO_TRAEFIK="${COMPOSE_DO_TRAEFIK:-/root/docker-compose.yml}"
REDE=prancheta_borda
CASA=/home/prancheta

passo() { printf '\n== %s\n' "$1"; }
falhar() { echo "ERRO: $1" >&2; exit 1; }

(( EUID == 0 )) || falhar "rode como administrador (root)"
[[ "$ANFITRIAO" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]] \
  || falhar "uso: preparar-vps.sh <endereço da Prancheta, como prancheta.exemplo.com>"
for arquivo in prancheta-publicar prancheta-chave compose.yml; do
  [[ -f "$AQUI/$arquivo" ]] || falhar "falta $arquivo ao lado do roteiro; copie a pasta servidor/implantacao inteira"
done
command -v docker > /dev/null || falhar "docker não encontrado"

passo "1. Conta prancheta"
id prancheta > /dev/null 2>&1 || falhar "a conta prancheta não existe; ela é criada junto com o canal de publicação"
[[ "$(getent passwd prancheta | cut -d: -f6)" == "$CASA" ]] || falhar "a pasta da conta prancheta não é $CASA"
if id -nG prancheta | tr ' ' '\n' | grep -qx docker; then
  falhar "a conta prancheta está no grupo docker, o que equivale a administrador; retire-a com: gpasswd -d prancheta docker"
fi
PRANCHETA_UID="$(id -u prancheta)"
PRANCHETA_GID="$(id -g prancheta)"
echo "conta prancheta: uid $PRANCHETA_UID, gid $PRANCHETA_GID, fora do grupo docker"
# O servidor da Prancheta roda com esse número; nenhum arquivo do administrador
# pode tê-lo como dono, ou um erro futuro de montagem o deixaria ao alcance dele.
DO_ADMINISTRADOR="$(find /root /etc -xdev -uid "$PRANCHETA_UID" 2>/dev/null | head -n 5)"
if [[ -n "$DO_ADMINISTRADOR" ]]; then
  echo "$DO_ADMINISTRADOR" >&2
  falhar "esses arquivos do administrador têm o mesmo dono numérico da conta prancheta; passe-os ao administrador, por exemplo com chown root:root <arquivo>, e rode o roteiro de novo"
fi

passo "2. Comandos"
install -o root -g root -m 0755 "$AQUI/prancheta-publicar" /usr/local/bin/prancheta-publicar
install -o root -g root -m 0700 "$AQUI/prancheta-chave" /usr/local/sbin/prancheta-chave
echo "instalados /usr/local/bin/prancheta-publicar e /usr/local/sbin/prancheta-chave"
if ! grep -qs 'command="/usr/local/bin/prancheta-publicar"' "$CASA/.ssh/authorized_keys"; then
  echo "AVISO: a chave do GitHub em $CASA/.ssh/authorized_keys não usa o comando /usr/local/bin/prancheta-publicar"
fi

passo "3. Pastas"
install -d -o prancheta -g prancheta -m 0755 "$CASA/publicado" "$CASA/publicado/versoes"
install -d -o prancheta -g prancheta -m 0700 /var/lib/prancheta
install -d -o root -g root -m 0755 /etc/prancheta /opt/prancheta
install -d -o root -g prancheta -m 0750 /etc/prancheta/acesso
[[ -f /etc/prancheta/acesso/chaves ]] || install -o root -g prancheta -m 0640 /dev/null /etc/prancheta/acesso/chaves
echo "código em $CASA/publicado, dados em /var/lib/prancheta, chaves em /etc/prancheta/acesso/chaves"

passo "4. Ambiente e contêiner"
umask 077
printf 'ANFITRIAO=%s\nPRANCHETA_UID=%s\nPRANCHETA_GID=%s\n' "$ANFITRIAO" "$PRANCHETA_UID" "$PRANCHETA_GID" > /etc/prancheta/ambiente.novo
mv -f /etc/prancheta/ambiente.novo /etc/prancheta/ambiente
umask 022
install -o root -g root -m 0644 "$AQUI/compose.yml" /opt/prancheta/compose.yml
docker compose --env-file /etc/prancheta/ambiente -f /opt/prancheta/compose.yml config --quiet
echo "gravados /etc/prancheta/ambiente e /opt/prancheta/compose.yml"

passo "5. Rede"
if ! docker network inspect "$REDE" > /dev/null 2>&1; then
  docker network create --internal "$REDE" > /dev/null
  echo "rede $REDE criada"
fi
if docker inspect -f '{{json .NetworkSettings.Networks}}' "$TRAEFIK" | grep -q "\"$REDE\""; then
  echo "o Traefik já está na rede $REDE"
else
  docker network connect "$REDE" "$TRAEFIK"
  echo "Traefik ligado à rede $REDE, sem reiniciar"
fi
if grep -qs "$REDE" "$COMPOSE_DO_TRAEFIK"; then
  echo "o arquivo do Traefik já declara a rede $REDE"
else
  cat <<AVISO
PENDENTE: acrescente a rede $REDE ao arquivo $COMPOSE_DO_TRAEFIK, para que ela
continue ligada quando o Traefik for recriado. São dois pontos, preservando as
redes que já estão lá:

  na lista networks do serviço traefik:
      - $REDE

  no bloco networks de topo:
    $REDE:
      external: true

Não é preciso recriar o Traefik agora: ele já está ligado à rede.
AVISO
fi

passo "6. Contêiner da Prancheta"
docker compose --env-file /etc/prancheta/ambiente -f /opt/prancheta/compose.yml up -d
echo "contêiner ligado"

passo "Próximos passos"
if [[ ! -s /etc/prancheta/acesso/chaves ]] || ! grep -qv '^#' /etc/prancheta/acesso/chaves; then
  echo "- crie uma chave para cada aparelho, guardando cada uma até digitá-la na Prancheta dele:"
  echo "    prancheta-chave nova boox"
  echo "    prancheta-chave nova computador"
  echo "    prancheta-chave nova copia      (para a cópia de segurança no computador)"
fi
if [[ ! -L "$CASA/publicado/atual" ]]; then
  echo "- faça a primeira publicação: no GitHub, Actions, Publicar na VPS, Run workflow;"
  echo "  o contêiner começa a responder alguns segundos depois de o código chegar"
fi
echo "- para o GitHub conferir cada publicação, cadastre o segredo VPS_PRANCHETA_ANFITRIAO com o endereço"
echo "- endereço da Prancheta: https://$ANFITRIAO"
