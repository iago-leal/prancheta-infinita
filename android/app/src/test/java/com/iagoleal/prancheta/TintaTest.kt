package com.iagoleal.prancheta

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class TintaTest {

    @Test
    fun `lê as cores no formato do CSS`() {
        assertEquals(0xFFD9920F.toInt(), Tinta.lerCor("#D9920F"))
        assertEquals(0xFFD9920F.toInt(), Tinta.lerCor("  #d9920f "))
        assertEquals(0xFFAABBCC.toInt(), Tinta.lerCor("#abc"))
        assertEquals(0xFFD2453B.toInt(), Tinta.lerCor("rgb(210, 69, 59)"))
        assertEquals(0xFFD2453B.toInt(), Tinta.lerCor("rgba(210,69,59,0.5)"))
    }

    @Test
    fun `recusa cores que não reconhece`() {
        assertNull(Tinta.lerCor(null))
        assertNull(Tinta.lerCor(""))
        assertNull(Tinta.lerCor("laranja"))
        assertNull(Tinta.lerCor("#12345"))
        assertNull(Tinta.lerCor("#zzzzzz"))
        assertNull(Tinta.lerCor("rgb(300, 0, 0)"))
    }

    @Test
    fun `a espessura da caneta acompanha o zoom e a densidade`() {
        val caneta = Tinta(marcaTexto = false, cor = Tinta.PRETO, larguraCss = 3f)
        assertEquals((3 * Tinta.FATOR_DA_CANETA).toFloat(), caneta.larguraNaTela(1.0, 1f), 0.001f)
        assertEquals((3 * Tinta.FATOR_DA_CANETA * 2 * 1.5).toFloat(), caneta.larguraNaTela(2.0, 1.5f), 0.001f)
    }

    @Test
    fun `o marca-texto usa a espessura escolhida, sem o fator da caneta`() {
        val marca = Tinta(marcaTexto = true, cor = Tinta.PRETO, larguraCss = 20f)
        assertEquals(40f, marca.larguraNaTela(1.0, 2f), 0.001f)
    }

    @Test
    fun `o contorno definitivo é engrossado pelo ajuste medido no Boox`() {
        // Até a pressão média, cerca de 62% da espessura máxima, o fator é 1,2.
        assertEquals(12f, Tinta.larguraDefinitiva(10f, 30f), 0.001f)
        assertEquals(18f * Tinta.AJUSTE_DO_CONTORNO, Tinta.larguraDefinitiva(18f, 30f), 0.001f)
        // Na pressão máxima, o fator chega a 1,4, porque o traço forte afinava na troca.
        assertEquals(30f * Tinta.AJUSTE_DO_CONTORNO_FORTE, Tinta.larguraDefinitiva(30f, 30f), 0.001f)
        // Entre as duas, cresce sem saltos.
        val intermediaria = Tinta.larguraDefinitiva(24.3f, 30f) / 24.3f
        assertEquals(1.3f, intermediaria, 0.01f)
        var anterior = 0f
        for (tamanho in 1..30) {
            val fator = Tinta.larguraDefinitiva(tamanho.toFloat(), 30f) / tamanho
            assertTrue("o fator diminuiu em $tamanho", fator >= anterior - 0.0001f)
            anterior = fator
        }
        // Sem a espessura do traço, vale o fator da pressão média.
        assertEquals(12f, Tinta.larguraDefinitiva(10f, 0f), 0.001f)
    }

    @Test
    fun `a camada usa a cor da página, sem escurecer`() {
        // Escurecido, o verde saía preto no modo rápido da tela colorida, na casca 0.3.2.
        val verde = Tinta.lerCor("#2E8B57")!!
        val caneta = Tinta(marcaTexto = false, cor = verde, larguraCss = 3f)
        val marca = Tinta(marcaTexto = true, cor = verde, larguraCss = 20f)
        assertEquals(verde, caneta.corDaCamada())
        assertEquals(verde, marca.corDaCamada())
    }

    @Test
    fun `a espessura fica entre os limites aceitos pela camada`() {
        val fina = Tinta(marcaTexto = false, cor = Tinta.PRETO, larguraCss = 1f)
        val grossa = Tinta(marcaTexto = true, cor = Tinta.PRETO, larguraCss = 40f)
        assertEquals(Tinta.LARGURA_MINIMA, fina.larguraNaTela(0.05, 1f), 0.001f)
        assertEquals(Tinta.LARGURA_MAXIMA, grossa.larguraNaTela(4.0, 2f), 0.001f)
    }

    private fun caneta(sensibilidade: Int) =
        Tinta(marcaTexto = false, cor = Tinta.PRETO, larguraCss = 3f, sensibilidade = sensibilidade)

    // A pressão na escala da Prancheta, a mesma de receberTraco em casca.js.
    private fun naPrancheta(bruta: Float) = Math.pow(bruta.toDouble(), Tinta.EXPOENTE_DA_PRESSAO).coerceIn(0.04, 1.0)

    @Test
    fun `em 90 por cento de sensibilidade a pressão segue sem mudança`() {
        val padrao = caneta(Tinta.SENSIBILIDADE_PADRAO)
        assertEquals(Tinta.SENSIBILIDADE_PADRAO, Tinta.PADRAO.sensibilidade)
        for (bruta in listOf(0.01f, 0.2f, 0.3437f, 0.5f, 0.8f, 1f)) assertEquals(bruta, padrao.ajustarPressao(bruta), 0f)
    }

    @Test
    fun `a zero por cento toda pressão vale a do meio`() {
        val constante = caneta(0)
        for (bruta in listOf(0.01f, 0.2f, 0.5f, 0.8f, 1f)) {
            assertEquals(0.5, naPrancheta(constante.ajustarPressao(bruta)), 0.0001)
        }
    }

    @Test
    fun `abaixo de 90 a diferença entre a pressão leve e a forte diminui, e acima aumenta`() {
        fun amplitude(sensibilidade: Int): Double {
            val t = caneta(sensibilidade)
            return naPrancheta(t.ajustarPressao(0.9f)) - naPrancheta(t.ajustarPressao(0.1f))
        }
        val hoje = amplitude(90)
        assertEquals(hoje / 2, amplitude(45), 0.0001)
        assertTrue(amplitude(70) < hoje)
        assertTrue(amplitude(100) > hoje)
        // Na escala da Prancheta, a pressão ajustada se aproxima do meio na proporção da sensibilidade.
        val metade = caneta(45)
        assertEquals(0.5 + (naPrancheta(0.9f) - 0.5) / 2, naPrancheta(metade.ajustarPressao(0.9f)), 0.0001)
        assertEquals(0.5 + (naPrancheta(0.1f) - 0.5) / 2, naPrancheta(metade.ajustarPressao(0.1f)), 0.0001)
    }

    @Test
    fun `o ajuste mantém a ordem das pressões e os limites da escala`() {
        for (sensibilidade in listOf(0, 30, 60, 100)) {
            val t = caneta(sensibilidade)
            var anterior = -1f
            for (i in 1..100) {
                val ajustada = t.ajustarPressao(i / 100f)
                assertTrue("a pressão ajustada saiu da escala em $sensibilidade%", ajustada in 0f..1f)
                assertTrue("a ordem mudou em $sensibilidade%, pressão ${i / 100f}", ajustada >= anterior)
                anterior = ajustada
            }
        }
    }

    @Test
    fun `o marca-texto e a pressão nula não mudam`() {
        val marca = Tinta(marcaTexto = true, cor = Tinta.PRETO, larguraCss = 20f, sensibilidade = 30)
        assertEquals(0.8f, marca.ajustarPressao(0.8f), 0f)
        assertEquals(0f, caneta(30).ajustarPressao(0f), 0f)
    }
}
