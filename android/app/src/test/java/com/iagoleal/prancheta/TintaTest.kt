package com.iagoleal.prancheta

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
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
        assertEquals(12f, Tinta.larguraDefinitiva(10f), 0.001f)
        assertEquals(10f * Tinta.AJUSTE_DO_CONTORNO, Tinta.larguraDefinitiva(10f), 0.001f)
    }

    @Test
    fun `a espessura fica entre os limites aceitos pela camada`() {
        val fina = Tinta(marcaTexto = false, cor = Tinta.PRETO, larguraCss = 1f)
        val grossa = Tinta(marcaTexto = true, cor = Tinta.PRETO, larguraCss = 40f)
        assertEquals(Tinta.LARGURA_MINIMA, fina.larguraNaTela(0.05, 1f), 0.001f)
        assertEquals(Tinta.LARGURA_MAXIMA, grossa.larguraNaTela(4.0, 2f), 0.001f)
    }
}
