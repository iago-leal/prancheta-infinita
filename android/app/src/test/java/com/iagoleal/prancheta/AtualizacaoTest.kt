package com.iagoleal.prancheta

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AtualizacaoTest {

    private fun resposta(etiqueta: String, anexo: String = "prancheta-casca-0.3.1.apk", endereco: String? = null) = """
        {
          "tag_name": "$etiqueta",
          "name": "Casca 0.3.1",
          "assets": [
            {"name": "notas.txt", "browser_download_url": "https://github.com/iago-leal/prancheta-infinita/releases/download/$etiqueta/notas.txt"},
            {"name": "$anexo", "browser_download_url": "${endereco ?: "https://github.com/iago-leal/prancheta-infinita/releases/download/$etiqueta/$anexo"}"}
          ]
        }
    """.trimIndent()

    @Test
    fun `lê o código, o nome e o endereço do APK da última versão`() {
        val versao = Atualizacao.ler(resposta("casca-5"))
        assertEquals(
            Atualizacao(5, "Casca 0.3.1", "https://github.com/iago-leal/prancheta-infinita/releases/download/casca-5/prancheta-casca-0.3.1.apk"),
            versao,
        )
    }

    @Test
    fun `ignora versões que não são da casca ou não trazem APK`() {
        assertNull(Atualizacao.ler(resposta("v1.0")))
        assertNull(Atualizacao.ler(resposta("casca-5", anexo = "prancheta.zip")))
        assertNull(Atualizacao.ler("""{"tag_name": "casca-5", "assets": []}"""))
        assertNull(Atualizacao.ler("não é JSON"))
    }

    @Test
    fun `só aceita APK anexado a este repositório`() {
        assertNull(Atualizacao.ler(resposta("casca-5", endereco = "https://exemplo.com/prancheta.apk")))
        assertNull(Atualizacao.ler(resposta("casca-5", endereco = "https://github.com/outra-pessoa/prancheta-infinita/releases/download/casca-5/x.apk")))
    }

    @Test
    fun `só oferece versões mais novas que a instalada`() {
        val versao = Atualizacao(5, "Casca 0.3.1", "https://github.com/iago-leal/prancheta-infinita/releases/download/casca-5/a.apk")
        assertTrue(versao.maisNovaQue(4))
        assertFalse(versao.maisNovaQue(5))
        assertFalse(versao.maisNovaQue(6))
    }
}
