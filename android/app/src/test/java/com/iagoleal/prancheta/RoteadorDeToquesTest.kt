package com.iagoleal.prancheta

import android.view.MotionEvent.ACTION_CANCEL
import android.view.MotionEvent.ACTION_DOWN
import android.view.MotionEvent.ACTION_MOVE
import android.view.MotionEvent.ACTION_POINTER_DOWN
import android.view.MotionEvent.ACTION_POINTER_UP
import android.view.MotionEvent.ACTION_UP
import android.view.MotionEvent.TOOL_TYPE_FINGER
import android.view.MotionEvent.TOOL_TYPE_STYLUS
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class RoteadorDeToquesTest {

    private val suspensoes = mutableListOf<Boolean>()
    private lateinit var roteador: RoteadorDeToques

    private val caneta = intArrayOf(TOOL_TYPE_STYLUS)
    private val umDedo = intArrayOf(TOOL_TYPE_FINGER)
    private val doisDedos = intArrayOf(TOOL_TYPE_FINGER, TOOL_TYPE_FINGER)

    @Before
    fun preparar() {
        suspensoes.clear()
        roteador = RoteadorDeToques { suspensoes.add(it) }
        // Barra de 52 px CSS numa tela de densidade 2, com 1600 px de largura.
        roteador.areasReservadas = listOf(Retangulo(0f, 0f, 1600f, 104f))
    }

    @Test
    fun `a caneta fora da barra vai para a camada durante todo o traço`() {
        assertEquals(Destino.CAMADA_ONYX, roteador.rotear(ACTION_DOWN, caneta, 400f, 600f))
        assertEquals(Destino.CAMADA_ONYX, roteador.rotear(ACTION_MOVE, caneta, 420f, 50f))
        assertEquals(Destino.CAMADA_ONYX, roteador.rotear(ACTION_UP, caneta, 420f, 50f))
    }

    @Test
    fun `a caneta que começa na barra vai para a WebView durante todo o traço`() {
        assertEquals(Destino.WEBVIEW, roteador.rotear(ACTION_DOWN, caneta, 100f, 50f))
        assertEquals(Destino.WEBVIEW, roteador.rotear(ACTION_MOVE, caneta, 100f, 700f))
        assertEquals(Destino.WEBVIEW, roteador.rotear(ACTION_UP, caneta, 100f, 700f))
        // O traço seguinte, fora da barra, volta para a camada.
        assertEquals(Destino.CAMADA_ONYX, roteador.rotear(ACTION_DOWN, caneta, 100f, 700f))
    }

    @Test
    fun `um dedo vai para a WebView sem suspender a camada`() {
        assertEquals(Destino.WEBVIEW, roteador.rotear(ACTION_DOWN, umDedo, 300f, 300f))
        assertEquals(Destino.WEBVIEW, roteador.rotear(ACTION_MOVE, umDedo, 320f, 320f))
        assertEquals(Destino.WEBVIEW, roteador.rotear(ACTION_UP, umDedo, 320f, 320f))
        assertTrue(suspensoes.isEmpty())
        assertFalse(roteador.suspensa)
    }

    @Test
    fun `dois dedos vão para a WebView e suspendem a camada até o último sair`() {
        assertEquals(Destino.WEBVIEW, roteador.rotear(ACTION_DOWN, umDedo, 300f, 300f))
        assertEquals(Destino.WEBVIEW, roteador.rotear(ACTION_POINTER_DOWN, doisDedos, 500f, 300f))
        assertEquals(listOf(true), suspensoes)
        assertEquals(Destino.WEBVIEW, roteador.rotear(ACTION_MOVE, doisDedos, 520f, 320f))
        assertEquals(Destino.WEBVIEW, roteador.rotear(ACTION_POINTER_UP, doisDedos, 520f, 320f))
        assertTrue(roteador.suspensa)
        assertEquals(Destino.WEBVIEW, roteador.rotear(ACTION_UP, umDedo, 300f, 300f))
        assertEquals(listOf(true, false), suspensoes)
        assertFalse(roteador.suspensa)
    }

    @Test
    fun `a caneta que começa durante o gesto de dois dedos é descartada`() {
        roteador.rotear(ACTION_DOWN, umDedo, 300f, 300f)
        roteador.rotear(ACTION_POINTER_DOWN, doisDedos, 500f, 300f)
        assertEquals(Destino.DESCARTAR, roteador.rotear(ACTION_DOWN, caneta, 400f, 600f))
        assertEquals(Destino.DESCARTAR, roteador.rotear(ACTION_UP, caneta, 400f, 600f))
    }

    @Test
    fun `com uma ferramenta que não escreve, a caneta vai para a WebView`() {
        roteador.canetaEscreve = false
        assertEquals(Destino.WEBVIEW, roteador.rotear(ACTION_DOWN, caneta, 400f, 600f, 1_000))
        assertEquals(Destino.WEBVIEW, roteador.rotear(ACTION_MOVE, caneta, 420f, 620f, 1_010))
        // Mudar a ferramenta no meio do traço não muda o destino dele.
        roteador.canetaEscreve = true
        assertEquals(Destino.WEBVIEW, roteador.rotear(ACTION_UP, caneta, 420f, 620f, 1_020))
        assertEquals(Destino.CAMADA_ONYX, roteador.rotear(ACTION_DOWN, caneta, 400f, 600f, 1_100))
    }

    @Test
    fun `um dedo que toca com a caneta na tela é descartado até sair`() {
        assertEquals(Destino.CAMADA_ONYX, roteador.rotear(ACTION_DOWN, caneta, 400f, 600f, 1_000))
        // A caneta continua encostada e parada, sem eventos, além da janela da palma.
        assertEquals(Destino.DESCARTAR, roteador.rotear(ACTION_DOWN, umDedo, 300f, 900f, 1_500))
        assertEquals(Destino.CAMADA_ONYX, roteador.rotear(ACTION_UP, caneta, 420f, 620f, 1_600))
        // O gesto inteiro do dedo continua descartado, mesmo depois da janela da palma.
        assertEquals(Destino.DESCARTAR, roteador.rotear(ACTION_MOVE, umDedo, 310f, 910f, 3_000))
        assertEquals(Destino.DESCARTAR, roteador.rotear(ACTION_POINTER_DOWN, doisDedos, 500f, 900f, 3_010))
        assertEquals(Destino.DESCARTAR, roteador.rotear(ACTION_UP, umDedo, 310f, 910f, 3_020))
        assertTrue("a palma não suspende a camada", suspensoes.isEmpty())
        // O próximo toque, longe da caneta, volta para a WebView.
        assertEquals(Destino.WEBVIEW, roteador.rotear(ACTION_DOWN, umDedo, 300f, 900f, 4_000))
    }

    @Test
    fun `um dedo que toca logo depois da caneta é descartado, e depois da janela não`() {
        roteador.rotear(ACTION_DOWN, caneta, 400f, 600f, 1_000)
        roteador.rotear(ACTION_UP, caneta, 420f, 620f, 1_200)
        val janela = RoteadorDeToques.JANELA_DA_PALMA_MS
        assertEquals(Destino.DESCARTAR, roteador.rotear(ACTION_DOWN, umDedo, 300f, 900f, 1_200 + janela - 1))
        assertEquals(Destino.DESCARTAR, roteador.rotear(ACTION_UP, umDedo, 300f, 900f, 1_200 + janela + 50))
        assertEquals(Destino.WEBVIEW, roteador.rotear(ACTION_DOWN, umDedo, 300f, 900f, 1_200 + janela))
        assertEquals(Destino.WEBVIEW, roteador.rotear(ACTION_UP, umDedo, 300f, 900f, 1_200 + janela + 10))
    }

    @Test
    fun `um dedo que toca com a caneta pairando é descartado`() {
        roteador.registrarCanetaPerto(5_000)
        assertEquals(Destino.DESCARTAR, roteador.rotear(ACTION_DOWN, umDedo, 300f, 900f, 5_100))
        assertEquals(Destino.DESCARTAR, roteador.rotear(ACTION_UP, umDedo, 300f, 900f, 5_150))
        assertEquals(Destino.WEBVIEW, roteador.rotear(ACTION_DOWN, umDedo, 300f, 900f, 6_000))
    }

    @Test
    fun `um cancelamento encerra o gesto e reativa a camada`() {
        roteador.rotear(ACTION_DOWN, umDedo, 300f, 300f)
        roteador.rotear(ACTION_POINTER_DOWN, doisDedos, 500f, 300f)
        roteador.rotear(ACTION_CANCEL, doisDedos, 500f, 300f)
        assertFalse(roteador.suspensa)
        assertEquals(Destino.CAMADA_ONYX, roteador.rotear(ACTION_DOWN, caneta, 400f, 600f))
    }
}
