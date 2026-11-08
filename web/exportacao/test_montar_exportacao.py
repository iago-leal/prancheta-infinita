"""Testes do montador da exportação, com dados fictícios.

Executar a partir da raiz do repositório:
    python3 -m unittest discover -s web/exportacao
"""

import json
import tempfile
import unittest
import zipfile
from pathlib import Path

from montar_exportacao import compactar, montar


def gravar(pasta: Path, caminho: str, dados) -> None:
    arquivo = pasta / "documentos" / f"{caminho}.json"
    arquivo.parent.mkdir(parents=True, exist_ok=True)
    arquivo.write_text(json.dumps(dados), encoding="utf-8")


class MontarExportacaoTest(unittest.TestCase):
    def setUp(self):
        self.temporaria = tempfile.TemporaryDirectory()
        self.pasta = Path(self.temporaria.name)
        gravar(self.pasta, "library/index", {"boards": [{"id": "main"}, {"id": "q1"}], "folders": []})
        gravar(self.pasta, "canvas-meta/main", {"title": "Principal"})
        gravar(self.pasta, "canvas-shards/f1", {"items": [{"id": "i1", "type": "image", "asset": "imagem01"},
                                                          {"id": "i2", "type": "card"}]})
        gravar(self.pasta, "boards/q1/meta/main", {"title": "Outro"})
        # No modo local, os itens chegam como strings JSON.
        gravar(self.pasta, "boards/q1/shards/f2", {"items": [json.dumps({"id": "i3", "type": "file", "dc": "texto001"})]})
        arquivos = self.pasta / "arquivos"
        arquivos.mkdir()
        (arquivos / "imagem01.png").write_bytes(b"png falso")
        (arquivos / "texto001.txt").write_bytes(b"texto")
        (arquivos / "orfao001.png").write_bytes(b"sem referencia")

    def tearDown(self):
        self.temporaria.cleanup()

    def test_contagens_e_referencias(self):
        m = montar(self.pasta, "https://claude.ai/artifact/exemplo", "v1", exportado_em="2026-01-01T00:00:00Z")
        self.assertEqual(m["formato"], "prancheta-exportacao")
        self.assertEqual(m["contagens"], {"documentos": 5, "arquivos": 3, "fragmentos": 2, "itens": 3,
                                          "quadros_na_biblioteca": 2, "quadros_exportados": 2})
        referencias = {a["id"]: a["referencias"] for a in m["arquivos"]}
        self.assertEqual(referencias["imagem01"], ["canvas-shards/f1#i1"])
        self.assertEqual(referencias["texto001"], ["boards/q1/shards/f2#i3"])
        self.assertTrue(m["verificacoes"]["quadros_conferem"])
        self.assertEqual(m["verificacoes"]["arquivos_sem_referencia"], ["orfao001"])
        self.assertEqual(m["verificacoes"]["citacoes_sem_arquivo"], [])

    def test_aponta_quadro_sem_metadados_e_arquivo_ausente(self):
        gravar(self.pasta, "library/index", {"boards": [{"id": "main"}, {"id": "q1"}, {"id": "q2"}]})
        (self.pasta / "arquivos" / "imagem01.png").unlink()
        (self.pasta / "arquivos" / "texto001.txt").unlink()
        m = montar(self.pasta, "https://claude.ai/artifact/exemplo", "v1")
        self.assertFalse(m["verificacoes"]["quadros_conferem"])
        self.assertEqual(m["verificacoes"]["quadros_sem_metadados"], ["q2"])
        self.assertEqual(m["verificacoes"]["citacoes_sem_arquivo"], ["imagem01", "texto001"])

    def test_zip_tem_manifesto_documentos_e_arquivos(self):
        m = montar(self.pasta, "https://claude.ai/artifact/exemplo", "v1")
        saida = self.pasta / "exportacao.zip"
        compactar(self.pasta, m, saida)
        with zipfile.ZipFile(saida) as zipado:
            nomes = set(zipado.namelist())
            self.assertIn("manifesto.json", nomes)
            self.assertIn("documentos/boards/q1/shards/f2.json", nomes)
            self.assertIn("arquivos/texto001.txt", nomes)
            self.assertEqual(json.loads(zipado.read("manifesto.json"))["contagens"], m["contagens"])


if __name__ == "__main__":
    unittest.main()
