"""Monta o pacote de exportação dos dados do artefato da Prancheta.

A coleta é feita pelas ferramentas de artefato do Claude, só com leituras:
cada documento do banco vira um JSON em `documentos/<caminho>.json`, e cada
arquivo enviado vira `arquivos/<id>.<extensão>`. Este script lê essa pasta,
gera o `manifesto.json` descrito em `web/exportacao/formato.md`, confere as
contagens e compacta tudo num .zip.

Uso:
    python3 web/exportacao/montar_exportacao.py PASTA URL_DO_ARTEFATO VERSAO SAIDA.zip
"""

from __future__ import annotations

import hashlib
import json
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

FORMATO = "prancheta-exportacao"
VERSAO_DO_FORMATO = 1
TIPOS = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
         ".webp": "image/webp", ".pdf": "application/pdf", ".txt": "text/plain", ".json": "application/json"}


def sha256(dados: bytes) -> str:
    return hashlib.sha256(dados).hexdigest()


def caminho_do_documento(pasta_documentos: Path, arquivo: Path) -> str:
    return arquivo.relative_to(pasta_documentos).with_suffix("").as_posix()


def itens_do_fragmento(dados: dict) -> list[dict]:
    """Os itens podem vir como objetos ou, no modo local, como strings JSON."""
    itens = []
    for item in dados.get("items", []) or []:
        if isinstance(item, str):
            try:
                item = json.loads(item)
            except json.JSONDecodeError:
                continue
        if isinstance(item, dict):
            itens.append(item)
    return itens


def referencias(id_arquivo: str, documentos: dict[str, dict]) -> list[str]:
    """Lista onde um arquivo é citado: `caminho#id_do_item` nos fragmentos, ou só o caminho."""
    achados = []
    for caminho, dados in sorted(documentos.items()):
        if id_arquivo not in json.dumps(dados, ensure_ascii=False):
            continue
        itens = [it for it in itens_do_fragmento(dados) if id_arquivo in json.dumps(it, ensure_ascii=False)]
        if itens:
            achados.extend(f"{caminho}#{it.get('id', '?')}" for it in itens)
        else:
            achados.append(caminho)
    return achados


def montar(pasta: Path, url: str, versao_publicada: str, exportado_em: str | None = None) -> dict:
    pasta_documentos = pasta / "documentos"
    pasta_arquivos = pasta / "arquivos"
    documentos: dict[str, dict] = {}
    lista_documentos = []
    for arquivo in sorted(pasta_documentos.rglob("*.json")):
        bruto = arquivo.read_bytes()
        caminho = caminho_do_documento(pasta_documentos, arquivo)
        documentos[caminho] = json.loads(bruto)
        lista_documentos.append({"caminho": caminho, "arquivo": arquivo.relative_to(pasta).as_posix(),
                                 "bytes": len(bruto), "sha256": sha256(bruto)})

    lista_arquivos = []
    for arquivo in sorted(pasta_arquivos.glob("*")) if pasta_arquivos.exists() else []:
        bruto = arquivo.read_bytes()
        id_arquivo = arquivo.stem
        lista_arquivos.append({"id": id_arquivo, "tipo": TIPOS.get(arquivo.suffix.lower(), "application/octet-stream"),
                               "arquivo": arquivo.relative_to(pasta).as_posix(), "bytes": len(bruto),
                               "sha256": sha256(bruto), "referencias": referencias(id_arquivo, documentos)})

    biblioteca = documentos.get("library/index", {})
    quadros_na_biblioteca = sorted(q["id"] for q in biblioteca.get("boards", []) if isinstance(q, dict) and "id" in q)
    quadros_exportados = sorted((["main"] if "canvas-meta/main" in documentos else [])
                                + [c.split("/")[1] for c in documentos if c.startswith("boards/") and c.endswith("/meta/main")])
    fragmentos = [c for c in documentos if c.startswith("canvas-shards/") or ("/shards/" in c and c.startswith("boards/"))]
    existentes = {a["id"] for a in lista_arquivos}
    # Os itens citam arquivos pelo campo `asset`, nas imagens, e `dc`, no texto de arquivos.
    citacoes_sem_arquivo = sorted({it[campo] for c in fragmentos for it in itens_do_fragmento(documentos[c])
                                   for campo in ("asset", "dc")
                                   if isinstance(it.get(campo), str) and it[campo] not in existentes})

    return {
        "formato": FORMATO,
        "versao": VERSAO_DO_FORMATO,
        "origem": {"artefato": url, "versao_publicada": versao_publicada},
        "exportado_em": exportado_em or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "documentos": lista_documentos,
        "arquivos": lista_arquivos,
        "contagens": {
            "documentos": len(lista_documentos),
            "arquivos": len(lista_arquivos),
            "fragmentos": len(fragmentos),
            "itens": sum(len(itens_do_fragmento(documentos[c])) for c in fragmentos),
            "quadros_na_biblioteca": len(quadros_na_biblioteca),
            "quadros_exportados": len(quadros_exportados),
        },
        "verificacoes": {
            "quadros_conferem": quadros_na_biblioteca == quadros_exportados,
            "quadros_sem_metadados": sorted(set(quadros_na_biblioteca) - set(quadros_exportados)),
            "arquivos_sem_referencia": sorted(a["id"] for a in lista_arquivos if not a["referencias"]),
            "citacoes_sem_arquivo": citacoes_sem_arquivo,
        },
    }


def compactar(pasta: Path, manifesto: dict, saida: Path) -> None:
    with zipfile.ZipFile(saida, "w", zipfile.ZIP_DEFLATED) as zipado:
        zipado.writestr("manifesto.json", json.dumps(manifesto, ensure_ascii=False, indent=2) + "\n")
        for entrada in manifesto["documentos"] + manifesto["arquivos"]:
            zipado.write(pasta / entrada["arquivo"], entrada["arquivo"])


def main(argumentos: list[str]) -> int:
    if len(argumentos) != 4:
        print(__doc__)
        return 2
    pasta, url, versao, saida = Path(argumentos[0]), argumentos[1], argumentos[2], Path(argumentos[3])
    manifesto = montar(pasta, url, versao)
    compactar(pasta, manifesto, saida)
    print(json.dumps({"contagens": manifesto["contagens"], "verificacoes": manifesto["verificacoes"]},
                     ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
