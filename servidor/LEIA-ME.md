# Servidor de sincronização

Guarda a cópia central dos quadros da Prancheta e troca mudanças com cada aparelho, no formato do banco local de `web/app/compat/banco-local.js`, sem converter os dados. Na VPS, entrega também a página, numa porta separada. É Node puro, sem dependências: basta o Node 18 ou mais novo. A implantação na VPS está em `servidor/implantacao/LEIA-ME.md`.

## Rodar

```sh
PRANCHETA_CHAVE='uma chave longa e aleatória' PRANCHETA_DADOS=/caminho/dos/dados node servidor/servidor.cjs
```

| Variável | Para quê | Padrão |
|---|---|---|
| `PRANCHETA_CHAVES_ARQUIVO` | arquivo com o resumo SHA-256 da chave de cada aparelho, uma linha `<nome> <resumo>` por aparelho, relido quando muda; é o modo da VPS | nenhum |
| `PRANCHETA_CHAVE` | chave única, com pelo menos 32 caracteres, para rodar localmente; sem ela nem o arquivo, o servidor não inicia | nenhum |
| `PRANCHETA_DADOS` | pasta dos dados | `./dados` |
| `PRANCHETA_PORTA` e `PRANCHETA_ENDERECO` | onde ouvir a sincronização; na VPS, atrás do Tailscale | `8787` e `127.0.0.1` |
| `PRANCHETA_ORIGENS` | origens de navegador aceitas, separadas por vírgula | `https://appassets.androidplatform.net`, a da casca Android |
| `PRANCHETA_WEB` e `PRANCHETA_PORTA_DA_PAGINA` | pasta da página e porta em que ela é entregue, sem a chave | nenhuma e `8788` |
| `PRANCHETA_VERSAO` | atalho da versão publicada; quando ele muda, o servidor termina para recomeçar com a versão nova | nenhum |
| `PRANCHETA_HISTORICO_DIAS` | por quantos dias as versões antigas dos documentos ficam guardadas | `30` |
| `PRANCHETA_BIBLIOTECA` | pasta dos livros, só lida, entregue em `/sync/biblioteca`; na VPS, a subpasta de livros do WebDAV | nenhuma |

A chave nunca fica no repositório. Uma forma de gerar: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. Na VPS, as chaves são criadas por `prancheta-chave`, uma por aparelho, e o servidor só guarda os resumos.

## Acesso

Todo pedido leva `Authorization: Bearer <chave>`. Sem ela, ou com outra, o servidor responde 401 com `{"erro":"nao_autorizado"}`, em qualquer rota, sem revelar dados nem quais rotas existem.

A única exceção é a consulta prévia que o navegador faz antes de um pedido com a chave vindo de outra origem, como a página da casca Android: ela não traz a chave nem recebe dados, e só é respondida, com 204 e o corpo vazio, para as origens de `PRANCHETA_ORIGENS`; para as demais, também é 401.

A página, entregue por `servidor/pagina.cjs` na outra porta, responde sem a chave, porque é o mesmo código do repositório público e não guarda segredo. Ela vai com `nosniff`, sem referência a outros endereços, com HSTS e com uma política que limita as conexões dela ao próprio endereço, para que um script injetado não envie a chave para fora. Os arquivos enviados voltam com o tipo normalizado e, fora o PDF, isolados por `Content-Security-Policy: sandbox`; só imagens e PDF abrem no navegador, e o resto é baixado.

## Aparelhos

Em cada aparelho, a Prancheta recebe o endereço do servidor e a chave uma única vez, pelo botão "Sincronizar", ao lado do indicador "Salvo", e os guarda no banco local, fora do código. A partir daí, ela sincroniza sozinha sempre que há rede, pelo módulo `web/app/compat/sincronizacao.js`, e o botão mostra a situação: "Sincronizado", "Sincronizando…", "Sem rede" ou "Erro ao sincronizar". O endereço é a raiz do servidor, sem `/sync`.

## Cifra ponta a ponta

Desde a etapa 02 do plano 005, os quadros saem cifrados dos aparelhos, e o servidor guarda e entrega só dados que ele não consegue ler. A cifra é AES-GCM, numa chave aleatória de 256 bits, feita por `web/app/compat/cifra.js`:

- No diálogo "Sincronizar", o primeiro aparelho cria a chave, mostrada uma única vez em 13 grupos de 4 letras e algarismos, para ser guardada no Bitwarden; depois de "Já guardei no Bitwarden", ele reenvia todos os documentos e arquivos, já cifrados. Nos outros aparelhos, a mesma chave é informada no mesmo diálogo. A chave nunca vai ao servidor: o banco local guarda só a chave derivada dela, que o navegador usa sem deixar ler de volta, e um identificador curto, que não permite reconstruí-la.
- O documento vai com `dados` no formato `{"cifra": 1, "chave": "<identificador>", "iv": "...", "conteudo": "..."}`, com o caminho, a versão, o horário e o aparelho como dados associados da cifra; o arquivo vai como `PRCIFRA1`, o identificador da chave, o vetor inicial e o tipo e o conteúdo cifrados.
- A primeira gravação cifrada liga a cifra no servidor, com o identificador da chave dela, anotado em `cifra.json`. A partir daí, ele recusa com 409 as gravações legíveis, `cifra_exigida`, e as de outra chave, `cifra_diferente`; um arquivo legível pode dar lugar ao mesmo arquivo cifrado, com o mesmo id, uma vez.
- A lista de mudanças traz `"cifra": {"chave": "<identificador>", "desde": P}`, ou `null` antes da primeira gravação cifrada. Um aparelho sem a chave, ou com outra, para de sincronizar e pede a chave, sem aplicar nem enviar nada; um aparelho com a chave recusa um conteúdo alterado ou trocado de documento e o que chegar legível depois da posição `P`.
- Continuam visíveis para o servidor o caminho de cada documento, com identificadores aleatórios, a versão, os horários, o aparelho e o tamanho de cada item. O banco local de cada aparelho continua legível.
- Sem a chave, os dados do servidor e das cópias de segurança não podem ser lidos: a recuperação depende do Bitwarden ou de um aparelho que ainda tenha os quadros.

A página da Prancheta precisa ter a origem aceita pelo servidor: a da casca Android já vem no padrão; no navegador do computador, a Prancheta servida pelo mesmo endereço do servidor não precisa de nada, e servida de outro endereço precisa entrar em `PRANCHETA_ORIGENS`.

## Rotas

### `GET /sync/estado`

Devolve `{"posicao": N}`, a posição da última mudança aceita.

### `POST /sync/mudancas`

```json
{
  "dispositivo": "abcd1234abcd1234",
  "mudancas": [
    { "seq": 12, "base": 5, "registro": { "caminho": "canvas-shards/s1", "colecao": "canvas-shards", "id": "s1", "dados": { "items": [] }, "apagado": false, "versao": 3, "atualizadoEm": 1762600000000, "dispositivo": "abcd1234abcd1234" } }
  ]
}
```

- `dispositivo` é o identificador do aparelho no banco local; `seq` é o número da mudança no registro de mudanças dele.
- `registro` é o documento exatamente como o banco local o guarda; o servidor confere só a forma, e não examina nem converte `dados`.
- `base` é a posição da versão do documento que o aparelho tinha recebido do servidor quando o mudou, ou `null` se nunca o recebeu.

A resposta traz a posição atual e um resultado por mudança, na ordem enviada:

- `{"seq": 12, "estado": "aplicada", "pos": 7}`: aceita, com a posição que ganhou;
- `{"seq": 12, "estado": "repetida", "pos": 7}`: o mesmo aparelho já tinha enviado essa mudança, que não muda nada;
- `{"seq": 13, "estado": "conflito", "atual": {"pos": 6, "registro": {...}}}`: outro aparelho mudou o documento depois da `base`; o servidor não o sobrescreve, e o aparelho combina as versões e reenvia uma mudança nova sobre `atual.pos`.

Uma mudança cuja versão atual no servidor veio de uma mudança anterior do mesmo aparelho não entra em conflito, porque o aparelho já a conhecia.

### `GET /sync/mudancas?desde=P&limite=L`

Lista o que mudou depois da posição `P`: a versão atual de cada documento e os dados de cada arquivo enviado, uma vez cada, na ordem da última mudança, no máximo `L` itens, até 500.

```json
{ "posicao": 9, "mais": false, "documentos": [{ "pos": 7, "registro": {...} }], "arquivos": [{ "pos": 9, "id": "...", "tipo": "image/png", "bytes": 1234, "sha256": "...", "criadoEm": 1762600000000, "dispositivo": "..." }], "cifra": null }
```

O aparelho guarda `posicao` e pede de novo a partir dela; com `mais`, há outra página.

### `PUT /sync/arquivos/<id>` e `GET /sync/arquivos/<id>`

O corpo é o arquivo, com `Content-Type`, `X-Prancheta-Dispositivo` e, se houver, `X-Prancheta-Criado-Em`. O id é o do banco local, de 8 a 64 caracteres entre letras, números, `_` e `-`. O mesmo arquivo reenviado é `repetido`; outro conteúdo com um id já usado é recusado com 409 e `conflito`, exceto o mesmo arquivo cifrado no lugar do legível. Com a cifra, o `Content-Type` é `application/octet-stream`, e o tipo vai dentro da cifra. O limite é de 25 MB.

### `GET /sync/biblioteca` e `GET /sync/biblioteca/<id>`

A biblioteca de livros, da etapa 03 do plano 005, por `servidor/biblioteca.cjs`. A lista traz os PDFs e EPUBs da pasta de `PRANCHETA_BIBLIOTECA`, contando as subpastas:

```json
{ "livros": [{ "id": "<32 algarismos hexadecimais>", "nome": "dc-1899.epub", "pasta": "Machado de Assis", "tipo": "application/epub+zip", "bytes": 401234, "modificadoEm": 1762600000000, "titulo": "Dom Casmurro", "autor": "Machado de Assis" }] }
```

- `id` é o mesmo resumo parcial MD5 que o KOReader calcula, sobre trechos de 1 KB do começo do arquivo e das posições 1 KB, 4 KB, 16 KB e assim por diante, até 1 GB. Ele não muda quando o livro é renomeado ou trocado de pasta.
- `pasta` é relativa à biblioteca; o caminho na VPS nunca aparece.
- `titulo` e `autor`, da etapa 01 do plano 008: os de um EPUB são lidos de dentro do arquivo, por `servidor/epub.cjs`, que abre só o índice do ZIP e os dois arquivos que dizem o título e os autores, até três, com limites de tamanho e sem bibliotecas de terceiros. Um PDF, e um EPUB sem esses dados, estragado, cifrado ou grande demais, ficam com o nome do arquivo, sem a extensão, como título, e com a primeira pasta do caminho como autor; fora de pasta, o autor fica vazio. Eles são lidos junto com o resumo, só quando o arquivo muda.
- A pasta é percorrida sem seguir atalhos, e as pastas ocultas e as `.sdr` do KOReader ficam de fora. A lista é refeita no máximo a cada 30 segundos.

`GET /sync/biblioteca/<id>` entrega o livro, só se ele estiver na lista, com o tipo dele, `nosniff` e, para o EPUB, isolado e como anexo, como os arquivos enviados. Um livro cuja pasta, ou ele mesmo, virou atalho depois de listado não é entregue. Sem a biblioteca configurada, a lista é vazia.

Nos aparelhos, a tela da biblioteca, de `web/app/compat/tela-da-biblioteca.js`, mostra a lista, agrupada pela primeira pasta, que na biblioteca do autor é a do autor de cada obra, com busca, ordenação e filtro; a seção "Biblioteca" do painel lateral, de `web/app/compat/biblioteca.js`, tem o botão que abre a tela e os livros lidos por último. Cada livro aberto fica guardado num banco próprio, `prancheta-biblioteca`, separado do banco dos quadros: os livros não sobem ao servidor nem passam pela cifra. A última lista recebida fica guardada para o uso sem rede.

### Progresso do KOReader, em `/sync/kosync/`

Pelo plano 007, o servidor fala o protocolo KOSync, com que o KOReader sincroniza até onde o leitor chegou em cada livro, por `servidor/kosync.cjs`. Só o protocolo foi aproveitado; o servidor de referência é AGPL, e nenhum código dele entra aqui. O livro é identificado pelo mesmo resumo parcial MD5 da biblioteca.

Estas rotas não usam a chave de um aparelho. Cada pedido traz o usuário em `X-Auth-User` e, em `X-Auth-Key`, o resumo MD5 da senha, que é o que o KOReader envia. Essa credencial só vale aqui: não abre os quadros, os arquivos nem a biblioteca, e a chave de um aparelho não vale nestas rotas.

| Rota | Resposta |
|---|---|
| `GET /sync/kosync/users/auth` | `200 { "authorized": "OK" }` |
| `PUT /sync/kosync/syncs/progress` | grava `{ document, progress, percentage, device, device_id }` e devolve `200 { document, timestamp }` |
| `GET /sync/kosync/syncs/progress/<documento>` | o último progresso gravado, com `timestamp` em segundos, ou `{}` |
| `POST /sync/kosync/users/create` | `402`, código 2005: o cadastro é fechado |

- `progress` é a posição como o KOReader a descreve: nos EPUBs, um caminho dentro do livro; nos PDFs, o número da página. `percentage` vai de 0 a 1.
- Sem a credencial certa, a resposta é `401 { "code": 2001, "message": "Unauthorized" }`. Um pedido fora do formato recebe `403`, com o código 2003, ou 2004 quando falta o documento; acima de 16 KB, `413`.
- Os usuários ficam no arquivo de `PRANCHETA_KOSYNC_ARQUIVO`, uma linha por usuário, com o nome e o resumo SHA-256 do MD5 da senha; ele é relido quando muda. Sem a variável, ou sem o arquivo, todos os pedidos são recusados. Na VPS, o comando `prancheta-kosync` cria e revoga os usuários.
- Exceção à cifra ponta a ponta, aceita pelo autor: o KOReader não conhece a chave da cifra, e o progresso fica legível no servidor, só com o identificador do livro, a posição, a porcentagem, o nome do aparelho e o horário. Cada usuário guarda até 5.000 livros; passado isso, saem os gravados há mais tempo.

### `GET /sync/progresso/<id>` e `PUT /sync/progresso/<id>`

O progresso de leitura para o leitor da Prancheta, pelas etapas 02 e 03 do plano 007, com a chave de um aparelho, como as outras rotas da sincronização. A credencial do KOSync não vale aqui, e os aparelhos da Prancheta não a guardam. Um identificador de livro fora do formato recebe `400`.

`GET` devolve `{ "progresso": … }`: o progresso mais recente do livro, entre o que o KOReader gravou e o que os aparelhos da Prancheta gravaram, com os campos do protocolo e o `timestamp` em segundos, ou `null` quando não há nenhum. O que veio de um aparelho da Prancheta traz também `posicao`, a posição exata do leitor.

`PUT` grava a posição do leitor de um aparelho:

```json
{ "posicao": { "cfi": "epubcfi(/6/8!/4/82/1:0)" }, "porcentagem": 0.4, "aparelho": "Boox", "dispositivo": "<identificador do aparelho>" }
```

- `posicao` é `{ "cfi": … }` num EPUB ou `{ "pagina": N }` num PDF; `porcentagem` vai de 0 a 1; `dispositivo` é o identificador do aparelho na sincronização. Fora do formato, `400`; acima de 16 KB, `413`.
- Num EPUB, o pedido pode levar `caminho`, a posição como o KOReader a descreve, até o parágrafo em que a página do leitor começa, por exemplo `/body/DocFragment[3]/body/p[12]/text().0`; o leitor da Prancheta o envia sempre que consegue montá-lo.
- A resposta é `200 { "timestamp": … }`.

Pela etapa 04, o KOReader recebe o que a Prancheta grava: `GET /sync/kosync/syncs/progress/<documento>` devolve o mais recente entre o que o KOReader gravou e o que um aparelho da Prancheta gravou no formato dele, que é o número da página, num PDF, ou o `caminho`, num EPUB, com o aparelho identificado como "Prancheta (Boox)" ou "Prancheta (computador)" e sem a posição exata. Uma posição da Prancheta sem `caminho` não é entregue ao KOReader, e, no mesmo segundo, vale a dele.

Ao abrir um livro, e quando a tela volta com o livro aberto, o leitor consulta o progresso sem atrasar a leitura. Se ele é mais novo que a última vez em que o leitor virou a página neste aparelho, vem de outro aparelho e está fora da página à vista, o leitor mostra um aviso com um botão, e não pula sozinho. A posição de outro aparelho da Prancheta é usada como está. A do KOReader é convertida: num PDF, é o número da página; num EPUB, é um caminho como `/body/DocFragment[3]/body/p[12]/text().34`, com o número do capítulo, na ordem de leitura e a partir de 1, e os passos até o parágrafo; o leitor vai até o parágrafo, ou até o último elemento achado no caminho.

O leitor grava a posição dele cerca de dois segundos depois da última virada de página, e ao fechar o livro; abrir um livro sem virar a página não grava nada.

## Dados em disco

- `registro.jsonl`: uma linha por mudança aceita, com a posição, o caminho, o aparelho e o número da mudança.
- `documentos/<sha256 do caminho>.json`: a versão atual de cada documento.
- `arquivos/<id>.bin` e `arquivos/<id>.json`: cada arquivo e os dados dele.
- `cifra.json`: o identificador da chave da cifra e a posição em que ela foi ligada.
- `kosync/<usuário>.json`: o progresso de leitura do KOReader, legível, fora do registro e do histórico dos quadros.
- `kosync/+prancheta.json`: o progresso gravado pelos aparelhos da Prancheta, também legível; o nome não pode ser o de um usuário do KOSync.

Cada gravação vai para um arquivo temporário e é renomeada, e só depois entra a linha do registro. Ao abrir, uma linha cortada no fim do registro é descartada, e um documento gravado sem a sua linha, por uma queda entre as duas gravações, ganha a linha que faltava.

## Testes

A partir da raiz do repositório: `node --test servidor/testes/*.test.cjs`. O fluxo `.github/workflows/servidor.yml` os roda a cada mudança em `servidor/`.

## Histórico e cópia de segurança

Cada versão aceita de um documento fica guardada por `PRANCHETA_HISTORICO_DIAS` dias em `historico/<AAAA-MM-DD>.jsonl`, na pasta dos dados. Para recuperar um documento sobrescrito ou apagado:

```sh
node servidor/historico.cjs <pasta dos dados> listar canvas-shards/<id>
node servidor/historico.cjs <pasta dos dados> mostrar canvas-shards/<id> <posição>
```

Com a cifra, as versões guardadas estão cifradas, e `mostrar` imprime o envelope; para recriar a versão num aparelho, ela precisa ser decifrada lá, com a chave.

Para conferir que nada legível ficou na pasta dos dados e, depois da troca para a cifra, tirar do histórico as versões legíveis:

```sh
node servidor/cifra.cjs <pasta dos dados> conferir
node servidor/cifra.cjs <pasta dos dados> apagar-legiveis
```

`conferir` só lê e termina com erro se algum documento atual, arquivo ou versão do histórico não estiver cifrado com a chave do servidor. `apagar-legiveis` só apaga se a cifra estiver ligada e todos os documentos e arquivos atuais estiverem cifrados ou apagados; pode rodar com o servidor no ar.

A cópia fora da VPS é puxada pelo computador do autor, com uma chave própria:

```sh
PRANCHETA_CHAVE=<chave da cópia> node servidor/copia-de-seguranca.cjs https://<endereço> <pasta>
```

O endereço é o da Prancheta na rede privada, terminado em `.ts.net`, e o computador precisa estar com o Tailscale ligado. Cada execução grava os documentos e os dados dos arquivos numa pasta com a data e a hora, e guarda o conteúdo dos arquivos uma vez só, compartilhado entre as cópias. Com a cifra, a cópia também fica cifrada, e restaurá-la continua sendo devolvê-la ao servidor; as cópias feitas antes da cifra continuam legíveis, no computador. Para rodar todo dia, agende-a no computador, por exemplo com o launchd no Mac.
