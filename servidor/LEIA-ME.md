# Servidor de sincronização

Guarda a cópia central dos quadros da Prancheta e troca mudanças com cada aparelho, no formato do banco local de `web/app/compat/banco-local.js`, sem converter os dados. É Node puro, sem dependências: basta o Node 18 ou mais novo.

## Rodar

```sh
PRANCHETA_CHAVE='uma chave longa e aleatória' PRANCHETA_DADOS=/caminho/dos/dados node servidor/servidor.cjs
```

| Variável | Para quê | Padrão |
|---|---|---|
| `PRANCHETA_CHAVE` | chave de acesso, com pelo menos 32 caracteres; sem ela, o servidor não inicia | nenhum |
| `PRANCHETA_DADOS` | pasta dos dados | `./dados` |
| `PRANCHETA_PORTA` e `PRANCHETA_ENDERECO` | onde ouvir; na VPS, atrás do servidor web com HTTPS | `8787` e `127.0.0.1` |
| `PRANCHETA_ORIGENS` | origens de navegador aceitas, separadas por vírgula | `https://appassets.androidplatform.net`, a da casca Android |

A chave nunca fica no repositório. Uma forma de gerar: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.

## Acesso

Todo pedido leva `Authorization: Bearer <chave>`. Sem ela, ou com outra, o servidor responde 401 com `{"erro":"nao_autorizado"}`, em qualquer rota, sem revelar dados nem quais rotas existem.

A única exceção é a consulta prévia que o navegador faz antes de um pedido com a chave vindo de outra origem, como a página da casca Android: ela não traz a chave nem recebe dados, e só é respondida, com 204 e o corpo vazio, para as origens de `PRANCHETA_ORIGENS`; para as demais, também é 401.

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
{ "posicao": 9, "mais": false, "documentos": [{ "pos": 7, "registro": {...} }], "arquivos": [{ "pos": 9, "id": "...", "tipo": "image/png", "bytes": 1234, "sha256": "...", "criadoEm": 1762600000000, "dispositivo": "..." }] }
```

O aparelho guarda `posicao` e pede de novo a partir dela; com `mais`, há outra página.

### `PUT /sync/arquivos/<id>` e `GET /sync/arquivos/<id>`

O corpo é o arquivo, com `Content-Type`, `X-Prancheta-Dispositivo` e, se houver, `X-Prancheta-Criado-Em`. O id é o do banco local, de 8 a 64 caracteres entre letras, números, `_` e `-`. O mesmo arquivo reenviado é `repetido`; outro conteúdo com um id já usado é recusado com 409. O limite é de 25 MB.

## Dados em disco

- `registro.jsonl`: uma linha por mudança aceita, com a posição, o caminho, o aparelho e o número da mudança.
- `documentos/<sha256 do caminho>.json`: a versão atual de cada documento.
- `arquivos/<id>.bin` e `arquivos/<id>.json`: cada arquivo e os dados dele.

Cada gravação vai para um arquivo temporário e é renomeada, e só depois entra a linha do registro. Ao abrir, uma linha cortada no fim do registro é descartada, e um documento gravado sem a sua linha, por uma queda entre as duas gravações, ganha a linha que faltava.

## Testes

A partir da raiz do repositório: `node --test servidor/testes/*.test.cjs`. O fluxo `.github/workflows/servidor.yml` os roda a cada mudança em `servidor/`.
