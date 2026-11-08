package com.iagoleal.prancheta

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AgendaDaTrocaTest {

    private val agenda = AgendaDaTroca(silencioMs = 700L, esperaMaximaMs = 20_000L)

    @Test
    fun `sem pedido, não há troca`() {
        agenda.sinalDaCaneta(1_000L)
        assertNull(agenda.espera(5_000L, emTraco = false))
    }

    @Test
    fun `com a caneta afastada, troca logo`() {
        agenda.sinalDaCaneta(1_000L)
        agenda.pedir(1_600L)
        assertEquals(0L, agenda.espera(1_700L, emTraco = false))
    }

    @Test
    fun `com a caneta pairando, espera ela se afastar`() {
        agenda.sinalDaCaneta(1_000L)
        agenda.pedir(1_600L)
        // A caneta paira sobre a tela, entre uma letra e outra.
        agenda.sinalDaCaneta(1_650L)
        assertEquals(700L - 50L, agenda.espera(1_700L, emTraco = false))
        agenda.sinalDaCaneta(2_100L)
        assertEquals(700L - 200L, agenda.espera(2_300L, emTraco = false))
        // Sem sinal por 700 ms, a caneta foi afastada.
        assertEquals(0L, agenda.espera(2_800L, emTraco = false))
    }

    @Test
    fun `com a caneta na tela, espera o fim do traço`() {
        agenda.pedir(1_000L)
        agenda.sinalDaCaneta(900L)
        assertEquals(700L, agenda.espera(3_000L, emTraco = true))
        assertEquals(0L, agenda.espera(3_000L, emTraco = false))
    }

    @Test
    fun `com a caneta pairando por muito tempo, troca na espera máxima`() {
        agenda.pedir(1_000L)
        // Antes da espera máxima, a caneta pairando adia a troca.
        agenda.sinalDaCaneta(20_000L)
        assertEquals(700L - 500L, agenda.espera(20_500L, emTraco = false))
        // Na espera máxima, 20 s depois do pedido, a troca acontece mesmo com a caneta pairando.
        agenda.sinalDaCaneta(20_950L)
        assertEquals(0L, agenda.espera(21_000L, emTraco = false))
        // Mesmo na espera máxima, a troca não acontece com a caneta tocando a tela.
        assertEquals(700L, agenda.espera(21_000L, emTraco = true))
    }

    @Test
    fun `pedidos seguidos valem como um, e a troca feita encerra o pedido`() {
        agenda.pedir(1_000L)
        agenda.pedir(15_000L)
        agenda.sinalDaCaneta(20_999L)
        // A espera máxima conta desde o primeiro pedido.
        assertEquals(0L, agenda.espera(21_000L, emTraco = false))
        agenda.trocou()
        assertNull(agenda.espera(21_000L, emTraco = false))
    }

    @Test
    fun `um sinal mais antigo que o último não conta`() {
        agenda.sinalDaCaneta(2_000L)
        agenda.sinalDaCaneta(1_000L)
        agenda.pedir(2_100L)
        assertEquals(700L - 200L, agenda.espera(2_200L, emTraco = false))
    }
}
