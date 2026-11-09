#!/bin/bash
# Roteiro do administrador para a Prancheta na VPS, executado uma vez pelo
# autor e seguro para repetir. Não mexe nos outros serviços: cria só o que é
# da Prancheta. Com a rede privada, a Prancheta não responde mais pelo
# endereço público, e o roteiro desliga o Traefik da rede dela, sem reiniciá-lo.
#
# Uso, a partir da raiz do repositório, no computador do autor; a pasta é
# apagada antes da cópia porque, se já existe, o scp -r cria uma subpasta
# dentro dela, e o roteiro executado seria o antigo:
#
#   ssh <vps> 'rm -rf /root/prancheta-implantacao'
#   scp -r servidor/implantacao <vps>:/root/prancheta-implantacao
#   ssh <vps> 'bash /root/prancheta-implantacao/preparar-vps.sh'
#
# Para montar a biblioteca de livros, a subpasta de livros do WebDAV, só para
# leitura, informe o caminho dela uma vez; ele fica em /etc/prancheta/ambiente
# e vale nas execuções seguintes, sem precisar repeti-lo. O caminho nunca entra
# no repositório:
#
#   ssh <vps> 'bash /root/prancheta-implantacao/preparar-vps.sh --biblioteca <subpasta>'
#
# Os livros do WebDAV só são legíveis pelo usuário dele. O roteiro instala o
# pacote acl e põe na subpasta uma permissão extra, só de leitura, para a conta
# prancheta, que vale também para os livros novos; o dono e as permissões
# normais dos arquivos não mudam. Para tirar a permissão extra e desmontar a
# biblioteca:
#
#   ssh <vps> 'bash /root/prancheta-implantacao/preparar-vps.sh --sem-biblioteca'
#
# O roteiro:
#
#  1. confere a conta prancheta, criada junto com o canal de publicação, que
#     ela não está no grupo docker e que nenhum arquivo do administrador, em
#     /root e /etc, tem o mesmo dono numérico que ela;
#  2. instala o comando da publicação, prancheta-publicar, e o das chaves,
#     prancheta-chave;
#  3. cria as pastas: o código publicado, em /home/prancheta/publicado; os
#     dados, em /var/lib/prancheta; os resumos das chaves, em /etc/prancheta/acesso;
#     e o login do Tailscale, em /var/lib/prancheta-tailscale;
#  4. grava /etc/prancheta/ambiente, com o número da conta prancheta e, se
#     houver, a subpasta de livros, com a permissão extra de leitura para a
#     conta prancheta; /opt/prancheta/compose.yml e
#     /opt/prancheta/tailscale-serve.json, o que o Tailscale entrega pela rede privada;
#  5. cria a rede prancheta_borda, sem saída para a internet, só da Prancheta
#     e do Tailscale; se o Traefik ainda está ligado a ela, do tempo do
#     endereço público, desliga-o sem reiniciá-lo e, se o arquivo dele ainda a
#     declara, mostra o trecho a tirar;
#  6. liga os contêineres: o da Prancheta, que espera a primeira publicação se
#     o código ainda não chegou, e o do Tailscale; com a biblioteca, confere de
#     dentro do contêiner quantos livros a Prancheta consegue ler;
#  7. se o Tailscale ainda não tem login, faz o login num contêiner provisório,
#     sem prazo, e mostra o endereço para o autor aprovar a máquina; o
#     contêiner do serviço daria só 60 segundos ao login e geraria outro
#     endereço a cada tentativa. Rodado de novo depois da aprovação, o roteiro
#     desliga o provisório, religa o serviço com o login salvo e mostra o
#     endereço da Prancheta na rede privada.
#
# Variáveis opcionais: TRAEFIK, o nome do contêiner do Traefik, por padrão
# root-traefik-1; COMPOSE_DO_TRAEFIK, o arquivo dele, por padrão /root/docker-compose.yml.

set -euo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TRAEFIK="${TRAEFIK:-root-traefik-1}"
COMPOSE_DO_TRAEFIK="${COMPOSE_DO_TRAEFIK:-/root/docker-compose.yml}"
REDE=prancheta_borda
CASA=/home/prancheta

passo() { printf '\n== %s\n' "$1"; }
falhar() { echo "ERRO: $1" >&2; exit 1; }

(( EUID == 0 )) || falhar "rode como administrador (root)"
BIBLIOTECA=""
BIBLIOTECA_INFORMADA=0
SEM_BIBLIOTECA=0
while (( $# > 0 )); do
  case "$1" in
    --sem-biblioteca)
      SEM_BIBLIOTECA=1
      shift
      ;;
    --biblioteca)
      (( $# >= 2 )) || falhar "informe a subpasta de livros depois de --biblioteca"
      BIBLIOTECA="$2"
      BIBLIOTECA_INFORMADA=1
      shift 2
      ;;
    *)
      echo "AVISO: o argumento $1 foi ignorado; o endereço público não é mais usado"
      shift
      ;;
  esac
done
for arquivo in prancheta-publicar prancheta-chave compose.yml tailscale-serve.json; do
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
install -d -o root -g root -m 0700 /var/lib/prancheta-tailscale
install -d -o root -g root -m 0755 /var/lib/prancheta-biblioteca-vazia
echo "código em $CASA/publicado, dados em /var/lib/prancheta, chaves em /etc/prancheta/acesso/chaves"
echo "login do Tailscale em /var/lib/prancheta-tailscale"

passo "4. Ambiente e contêiner"
ANTERIOR=""
[[ -f /etc/prancheta/ambiente ]] && ANTERIOR="$(grep -m 1 '^PRANCHETA_BIBLIOTECA_DA_VPS=' /etc/prancheta/ambiente | cut -d= -f2- || true)"
# A permissão extra só sai da subpasta que o roteiro mesmo configurou.
tirar_permissao() {
  [[ -n "$1" && -d "$1" ]] && command -v setfacl > /dev/null || return 0
  setfacl -R -x "u:$PRANCHETA_UID" "$1" 2> /dev/null || true
  find "$1" -type d -exec setfacl -x "d:u:$PRANCHETA_UID" {} + 2> /dev/null || true
  echo "a permissão extra de leitura da conta prancheta saiu da subpasta de livros anterior"
}
if (( SEM_BIBLIOTECA )); then
  tirar_permissao "$ANTERIOR"
  BIBLIOTECA=""
elif (( ! BIBLIOTECA_INFORMADA )); then
  # A subpasta de livros informada antes continua valendo sem repetir o argumento.
  BIBLIOTECA="$ANTERIOR"
fi
if [[ -n "$BIBLIOTECA" ]]; then
  # O caminho vai para o arquivo de ambiente do Docker Compose: só caracteres simples.
  [[ "$BIBLIOTECA" =~ ^/[A-Za-z0-9._/\ -]+$ ]] || falhar "a subpasta de livros precisa de um caminho absoluto, só com letras, algarismos, espaço, ponto, hífen, sublinhado e barra"
  BIBLIOTECA="$(realpath -e "$BIBLIOTECA" 2>/dev/null)" || falhar "a subpasta de livros não existe"
  [[ -d "$BIBLIOTECA" ]] || falhar "a subpasta de livros não é uma pasta"
  case "$BIBLIOTECA" in
    /|/root|/root/*|/etc|/etc/*|/home/prancheta|/home/prancheta/*|/var/lib/prancheta|/var/lib/prancheta/*|/var/lib/prancheta-*)
      falhar "a subpasta de livros não pode ser uma pasta do sistema nem da Prancheta" ;;
  esac
  [[ -z "$ANTERIOR" || "$ANTERIOR" == "$BIBLIOTECA" ]] || tirar_permissao "$ANTERIOR"
  if ! command -v setfacl > /dev/null; then
    command -v apt-get > /dev/null || falhar "instale o pacote acl, que traz o setfacl, e rode de novo"
    DEBIAN_FRONTEND=noninteractive apt-get install -y -q acl > /dev/null \
      || { apt-get update -q > /dev/null && DEBIAN_FRONTEND=noninteractive apt-get install -y -q acl > /dev/null; } \
      || falhar "não foi possível instalar o pacote acl"
    echo "pacote acl instalado"
  fi
  # Permissão extra só de leitura, e de entrada nas pastas, para a conta
  # prancheta; a regra padrão nas pastas a estende aos livros novos. O dono e as
  # permissões normais não mudam, e nada dá à Prancheta o direito de gravar.
  setfacl -R -m "u:$PRANCHETA_UID:rX" "$BIBLIOTECA"
  find "$BIBLIOTECA" -type d -exec setfacl -m "d:u:$PRANCHETA_UID:rX" {} +
  echo "permissão extra de leitura da conta prancheta na subpasta de livros, também para os livros novos"
fi
umask 077
{
  printf 'PRANCHETA_UID=%s\nPRANCHETA_GID=%s\n' "$PRANCHETA_UID" "$PRANCHETA_GID"
  [[ -z "$BIBLIOTECA" ]] || printf 'PRANCHETA_BIBLIOTECA_DA_VPS=%s\n' "$BIBLIOTECA"
} > /etc/prancheta/ambiente.novo
mv -f /etc/prancheta/ambiente.novo /etc/prancheta/ambiente
umask 022
install -o root -g root -m 0644 "$AQUI/compose.yml" /opt/prancheta/compose.yml
install -o root -g root -m 0644 "$AQUI/tailscale-serve.json" /opt/prancheta/tailscale-serve.json
docker compose --env-file /etc/prancheta/ambiente -f /opt/prancheta/compose.yml config --quiet
echo "gravados /etc/prancheta/ambiente, /opt/prancheta/compose.yml e /opt/prancheta/tailscale-serve.json"

passo "5. Rede"
if ! docker network inspect "$REDE" > /dev/null 2>&1; then
  docker network create --internal "$REDE" > /dev/null
  echo "rede $REDE criada"
fi
# Até o plano 005, o Traefik entregava a Prancheta no endereço público, ligado
# a esta rede; agora ela só responde pela rede privada.
if docker inspect "$TRAEFIK" > /dev/null 2>&1 \
  && docker inspect -f '{{json .NetworkSettings.Networks}}' "$TRAEFIK" | grep -q "\"$REDE\""; then
  docker network disconnect "$REDE" "$TRAEFIK"
  echo "Traefik desligado da rede $REDE, sem reiniciar: o endereço público não entrega mais a Prancheta"
else
  echo "o Traefik não está na rede $REDE"
fi
if grep -qs "$REDE" "$COMPOSE_DO_TRAEFIK"; then
  cat <<AVISO
PENDENTE: tire a rede $REDE do arquivo $COMPOSE_DO_TRAEFIK, para que o Traefik
não volte a se ligar a ela quando for recriado. São dois pontos, preservando as
outras redes:

  na lista networks do serviço traefik, a linha:
      - $REDE

  no bloco networks de topo, o trecho:
    $REDE:
      external: true

Não é preciso recriar o Traefik agora: ele já foi desligado da rede.
AVISO
fi

passo "6. Contêineres da Prancheta e do Tailscale"
COMPOSE=(docker compose --env-file /etc/prancheta/ambiente -f /opt/prancheta/compose.yml)
"${COMPOSE[@]}" up -d
echo "contêineres ligados"
if [[ -n "$BIBLIOTECA" ]]; then
  # Conferido de dentro do contêiner, com a conta prancheta, como o servidor lê:
  # os PDFs e EPUBs legíveis e o que ficou fora por falta de permissão.
  CONTAGEM="$("${COMPOSE[@]}" exec -T servidor node - <<'JS' 2> /dev/null || true
const fs = require('fs');
const path = require('path');
let livros = 0;
let ilegiveis = 0;
function ver(caminho, raiz) {
  const nome = path.basename(caminho);
  if (!raiz && (nome.startsWith('.') || nome.endsWith('.sdr'))) return;
  let estado;
  try { estado = fs.lstatSync(caminho); } catch (e) { ilegiveis += 1; return; }
  if (estado.isSymbolicLink()) return;
  const modo = estado.isDirectory() ? fs.constants.R_OK | fs.constants.X_OK : fs.constants.R_OK;
  try { fs.accessSync(caminho, modo); } catch (e) { ilegiveis += 1; return; }
  if (estado.isDirectory()) {
    for (const filho of fs.readdirSync(caminho)) ver(path.join(caminho, filho), false);
  } else if (/\.(pdf|epub)$/i.test(nome)) {
    livros += 1;
  }
}
ver('/biblioteca', true);
console.log(`${livros} ${ilegiveis}`);
JS
)"
  if [[ "$CONTAGEM" =~ ^([0-9]+)\ ([0-9]+)$ ]]; then
    echo "biblioteca: a Prancheta consegue ler ${BASH_REMATCH[1]} PDFs e EPUBs"
    (( BASH_REMATCH[2] == 0 )) || echo "AVISO: ${BASH_REMATCH[2]} itens da subpasta de livros ficaram fora, sem permissão de leitura"
  else
    echo "AVISO: não foi possível conferir a biblioteca de dentro do contêiner; veja com: ${COMPOSE[*]} logs servidor"
  fi
fi

passo "7. Rede privada"
PROVISORIO=prancheta-tailscale-login
SOQUETE=/tmp/tailscaled.sock
# Estado do Tailscale num contêiner, como Running ou NeedsLogin, ou vazio.
estado() { docker exec "$1" tailscale "${@:2}" status --json 2>/dev/null | grep -m 1 -o '"BackendState": *"[A-Za-z]*"' | cut -d '"' -f 4 || true; }
endereco_de_login() { docker exec "$PROVISORIO" tailscale --socket="$SOQUETE" status --json 2>/dev/null | grep -m 1 -o '"AuthURL": *"https://[^"]*"' | cut -d '"' -f 4 || true; }
mostrar_login() {
  echo "- aprove a VPS na rede privada abrindo este endereço, logado na sua conta do Tailscale:"
  echo "    $1"
  echo "  depois, no painel do Tailscale, desative a expiração da chave da máquina ${TAILSCALE_NOME:-prancheta}"
  echo "  (Machines, ${TAILSCALE_NOME:-prancheta}, Disable key expiry) e rode este roteiro de novo"
}

if docker inspect "$PROVISORIO" > /dev/null 2>&1; then
  if [[ "$(estado "$PROVISORIO" --socket="$SOQUETE")" == Running ]]; then
    docker rm -f "$PROVISORIO" > /dev/null
    "${COMPOSE[@]}" up -d tailscale
    echo "login do Tailscale aprovado; o contêiner provisório saiu, e o do serviço voltou com o login salvo"
  else
    LOGIN="$(endereco_de_login)"
    [[ -n "$LOGIN" ]] || falhar "o login do Tailscale ainda não foi aprovado; veja com: docker logs $PROVISORIO"
    mostrar_login "$LOGIN"
    exit 0
  fi
fi

TAILSCALE_CONTEINER="$("${COMPOSE[@]}" ps -q tailscale)"
[[ -n "$TAILSCALE_CONTEINER" ]] || falhar "o contêiner do Tailscale não está de pé; veja com: ${COMPOSE[*]} ps"
for _ in $(seq 1 15); do
  [[ "$(estado "$TAILSCALE_CONTEINER")" == Running ]] && break
  sleep 2
done
if [[ "$(estado "$TAILSCALE_CONTEINER")" == Running ]]; then
  NOME="$(docker exec "$TAILSCALE_CONTEINER" tailscale status --json | grep -m 1 -o '"DNSName": *"[^"]*"' | cut -d '"' -f 4 | sed 's/\.$//')"
  echo "- o Tailscale está na rede privada; endereço da Prancheta nela: https://$NOME"
  echo "  o primeiro acesso pode falhar por alguns minutos, com erro de TLS, enquanto o Tailscale"
  echo "  emite o certificado; se persistir, veja: docker logs $TAILSCALE_CONTEINER | grep -i cert"
  echo "  o endereço vale nos aparelhos ligados ao Tailscale e não entra no repositório"
else
  # Sem login: o serviço sai, e um contêiner provisório, com o mesmo login
  # guardado em /var/lib/prancheta-tailscale, espera a aprovação sem prazo.
  "${COMPOSE[@]}" stop tailscale
  "${COMPOSE[@]}" run -d --no-deps --name "$PROVISORIO" --entrypoint tailscaled tailscale \
    --tun=userspace-networking --statedir=/var/lib/tailscale --socket="$SOQUETE" > /dev/null
  sleep 3
  docker exec -d "$PROVISORIO" tailscale --socket="$SOQUETE" up --hostname="${TAILSCALE_NOME:-prancheta}" --accept-dns=false
  LOGIN=""
  for _ in $(seq 1 15); do
    LOGIN="$(endereco_de_login)"
    [[ -n "$LOGIN" ]] && break
    sleep 2
  done
  [[ -n "$LOGIN" ]] || falhar "o Tailscale não mostrou o endereço de login; veja com: docker logs $PROVISORIO"
  mostrar_login "$LOGIN"
fi

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
echo "- o segredo VPS_PRANCHETA_ANFITRIAO, com o endereço público antigo, faz o GitHub conferir, a cada"
echo "  publicação, que ele não entrega mais a Prancheta"
