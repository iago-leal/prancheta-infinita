# Formato da exportação dos dados do artefato

A exportação copia, só com leituras, o banco e os arquivos enviados do artefato da Prancheta, para que o servidor de compatibilidade os importe. Ela não fica no repositório: por decisão do autor, o pacote é entregue a ele pelo aplicativo do Claude, e cada um guarda onde preferir, porque contém dados pessoais.

## Como refazer a exportação

1. Com a ferramenta `ArtifactData`, ler cada coleção listada em `web/inventario-claude.md` com a ação `list`, gravando os documentos em `PASTA/documentos/` pelo parâmetro `out_dir`. Os quadros que não são o principal estão em `boards/<id>/meta` e `boards/<id>/shards`, com os ids tirados de `library/index`.
2. Com a ferramenta `Artifact`, listar os arquivos enviados, com a ação `list` e o escopo `assets`, e baixar cada um com a ação `read` e o parâmetro `path` igual ao id. Copiar os arquivos para `PASTA/arquivos/<id>.<extensão>` e conferir os hashes com os da listagem.
3. Montar o pacote, a partir da raiz do repositório:

   ```
   python3 web/exportacao/montar_exportacao.py PASTA URL_DO_ARTEFATO VERSAO SAIDA.zip
   ```

   O script imprime as contagens e as verificações, que precisam mostrar `quadros_conferem` verdadeiro e nenhuma citação sem arquivo.

Nenhuma etapa usa ações de escrita: o artefato original fica intacto.

## Conteúdo do pacote

```
manifesto.json
documentos/<caminho do documento no banco>.json
arquivos/<id do arquivo>.<extensão>
```

Cada `documentos/….json` guarda só os dados do documento, sem metadados do banco. O caminho do arquivo repete o caminho do documento: `documentos/boards/q1/shards/f2.json` é o documento `f2` da coleção `boards/q1/shards`.

## O manifesto

| Campo | Conteúdo |
|---|---|
| `formato` | sempre `prancheta-exportacao` |
| `versao` | versão do formato, hoje `1` |
| `origem` | endereço do artefato e versão publicada no momento da exportação |
| `exportado_em` | data e hora da montagem, em UTC |
| `documentos` | um item por documento: `caminho`, `arquivo` dentro do pacote, `bytes` e `sha256` |
| `arquivos` | um item por arquivo enviado: `id`, `tipo`, `arquivo`, `bytes`, `sha256` e `referencias`, a lista de lugares que citam o arquivo, no formato `caminho#id_do_item` |
| `contagens` | documentos, arquivos, fragmentos, itens nos fragmentos, quadros na biblioteca e quadros exportados |
| `verificacoes` | `quadros_conferem`, `quadros_sem_metadados`, `arquivos_sem_referencia` e `citacoes_sem_arquivo` |

Os itens de um fragmento citam arquivos pelo campo `asset`, nas imagens, e `dc`, no texto de arquivos. Um arquivo sem referência continua no pacote: em geral, é uma imagem apagada de um quadro que ficou no armazenamento.

## Exemplo

Manifesto de uma exportação fictícia, com um quadro principal e outro quadro:

```json
{
  "formato": "prancheta-exportacao",
  "versao": 1,
  "origem": { "artefato": "https://claude.ai/artifact/exemplo", "versao_publicada": "v1" },
  "exportado_em": "2026-01-01T00:00:00Z",
  "documentos": [
    { "caminho": "boards/q1/meta/main", "arquivo": "documentos/boards/q1/meta/main.json", "bytes": 19, "sha256": "…" },
    { "caminho": "boards/q1/shards/f2", "arquivo": "documentos/boards/q1/shards/f2.json", "bytes": 62, "sha256": "…" },
    { "caminho": "canvas-meta/main", "arquivo": "documentos/canvas-meta/main.json", "bytes": 22, "sha256": "…" },
    { "caminho": "canvas-shards/f1", "arquivo": "documentos/canvas-shards/f1.json", "bytes": 83, "sha256": "…" },
    { "caminho": "library/index", "arquivo": "documentos/library/index.json", "bytes": 52, "sha256": "…" }
  ],
  "arquivos": [
    { "id": "imagem01", "tipo": "image/png", "arquivo": "arquivos/imagem01.png", "bytes": 9, "sha256": "…",
      "referencias": ["canvas-shards/f1#i1"] },
    { "id": "texto001", "tipo": "text/plain", "arquivo": "arquivos/texto001.txt", "bytes": 5, "sha256": "…",
      "referencias": ["boards/q1/shards/f2#i3"] }
  ],
  "contagens": { "documentos": 5, "arquivos": 2, "fragmentos": 2, "itens": 3,
                 "quadros_na_biblioteca": 2, "quadros_exportados": 2 },
  "verificacoes": { "quadros_conferem": true, "quadros_sem_metadados": [],
                    "arquivos_sem_referencia": [], "citacoes_sem_arquivo": [] }
}
```

O teste `web/exportacao/test_montar_exportacao.py` monta uma exportação parecida com essa e confere as contagens, as referências e o conteúdo do `.zip`.
