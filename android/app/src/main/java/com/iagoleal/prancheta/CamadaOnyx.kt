package com.iagoleal.prancheta

import android.graphics.Color
import android.graphics.Rect
import android.graphics.RectF
import android.os.Build
import android.util.Log
import android.view.MotionEvent
import android.view.View
import com.onyx.android.sdk.api.device.epd.EpdController
import com.onyx.android.sdk.api.device.epd.UpdateMode
import com.onyx.android.sdk.data.note.TouchPoint
import com.onyx.android.sdk.pen.RawInputCallback
import com.onyx.android.sdk.pen.TouchHelper
import com.onyx.android.sdk.pen.data.TouchPointList
import java.util.concurrent.Executors

/**
 * Camada de tinta da Onyx sobre a WebView. Enquanto a caneta escreve, o
 * controlador da tela desenha um traço provisório com latência baixa; quando
 * a caneta sobe, os pontos seguem para a Prancheta, que grava e desenha o
 * traço definitivo.
 *
 * As operações no `TouchHelper` rodam numa thread própria. Os eventos da
 * caneta chegam por [onTouchEvent], encaminhados pela Activity conforme o
 * [RoteadorDeToques].
 */
class CamadaOnyx private constructor(
    private val alvo: View,
    private val aoTerminarTraco: (List<PontoTela>) -> Unit,
    private val aoFalhar: (Throwable) -> Unit,
) {
    private val executor = Executors.newSingleThreadExecutor { tarefa ->
        Thread(tarefa, "CamadaOnyx").apply { isDaemon = true }
    }
    private val pressaoMaxima: Float = runCatching { EpdController.getMaxTouchPressure() }
        .getOrNull()
        ?.takeIf { it > 0f }
        ?: PRESSAO_MAXIMA_PADRAO
    private val retorno = Retorno()
    private val helper: TouchHelper = TouchHelper.create(alvo, TouchHelper.FEATURE_ALL_TOUCH_RENDER, retorno, false)

    @Volatile private var suspensa = false
    @Volatile private var pausada = false
    @Volatile private var desligadaPelaPagina = false
    @Volatile private var falhou = false
    @Volatile private var areasExcluidas: List<Rect> = emptyList()
    @Volatile private var larguraTraco = LARGURA_PADRAO

    /** Encaminha ao SDK um evento de caneta destinado à camada. */
    fun onTouchEvent(evento: MotionEvent): Boolean =
        if (falhou) false else runCatching { helper.onTouchEvent(evento) }.getOrDefault(false)

    /** Reaplica toda a configuração; chamar quando o tamanho da WebView muda. */
    fun reconfigurar() = naThread { configurar() }

    /** Áreas da tela, em pixels físicos, onde a caneta não desenha pela camada. */
    fun definirAreasReservadas(areas: List<Retangulo>) {
        areasExcluidas = areas.map { Rect(it.esquerda.toInt(), it.topo.toInt(), it.direita.toInt(), it.base.toInt()) }
        reconfigurar()
    }

    /** Ajusta a largura do traço provisório ao zoom da página. */
    fun definirEscala(k: Double, densidade: Float) {
        larguraTraco = (DIAMETRO_CSS * k * densidade).toFloat().coerceIn(1f, 60f)
        naThread { helper.setStrokeWidth(larguraTraco) }
    }

    /** Suspende a camada durante gestos de dois dedos. */
    fun suspender(valor: Boolean) {
        suspensa = valor
        aplicarHabilitacao()
    }

    /** Liga ou desliga a escrita pela camada, conforme a ferramenta ativa na Prancheta. */
    fun definirAtiva(ativa: Boolean) {
        desligadaPelaPagina = !ativa
        aplicarHabilitacao()
    }

    fun pausar() {
        pausada = true
        aplicarHabilitacao()
    }

    fun retomar() {
        pausada = false
        aplicarHabilitacao()
    }

    /** Pede ao controlador que redesenhe a WebView, apagando o traço provisório. */
    fun atualizarTela() {
        alvo.post {
            alvo.invalidate()
            runCatching { EpdController.invalidate(alvo, UpdateMode.HAND_WRITING_REPAINT_MODE) }
        }
    }

    /**
     * Apaga da tela tudo o que a camada desenhou, como depois de limpar o
     * quadro. A camada fica desligada enquanto a WebView se redesenha e volta
     * logo depois: é o mesmo ciclo que o gesto de dois dedos provoca, e que no
     * teste do autor limpou a tela.
     */
    fun redesenharTudo() {
        naThread {
            helper.setRawDrawingEnabled(false)
            alvo.post {
                alvo.invalidate()
                runCatching { EpdController.invalidate(alvo, UpdateMode.GC) }
                alvo.postDelayed({ aplicarHabilitacao() }, ATRASO_PARA_RELIGAR_MS)
            }
        }
    }

    fun encerrar() {
        naThread {
            runCatching {
                helper.setRawDrawingEnabled(false)
                helper.closeRawDrawing()
            }
        }
        executor.shutdown()
    }

    private fun habilitada() = !suspensa && !pausada && !desligadaPelaPagina

    private fun aplicarHabilitacao() = naThread { helper.setRawDrawingEnabled(habilitada()) }

    // A ordem segue a que o SDK exige: largura, cor e limites antes de abrir;
    // estilo depois de abrir; por fim, a habilitação.
    private fun configurar() {
        val largura = alvo.width
        val altura = alvo.height
        if (largura <= 0 || altura <= 0) return
        helper.setStrokeWidth(larguraTraco)
        helper.enableFingerTouch(false)
        helper.onlyEnableFingerTouch(false)
        helper.setStrokeColor(Color.BLACK)
        helper.setLimitRect(Rect(0, 0, largura, altura), areasExcluidas)
        helper.openRawDrawing()
        helper.setStrokeStyle(TouchHelper.STROKE_STYLE_PENCIL)
        helper.setStrokeWidth(larguraTraco)
        helper.setStrokeColor(Color.BLACK)
        helper.setRawDrawingRenderEnabled(false)
        helper.setRawDrawingEnabled(habilitada())
    }

    private fun naThread(bloco: () -> Unit) {
        if (falhou || executor.isShutdown) return
        executor.execute {
            try {
                bloco()
            } catch (erro: Throwable) {
                falhou = true
                Log.e(TAG, "a camada da Onyx falhou; a página volta à tinta web", erro)
                alvo.post { aoFalhar(erro) }
            }
        }
    }

    private fun converter(p: TouchPoint) = PontoTela(p.x, p.y, (p.pressure / pressaoMaxima).coerceIn(0f, 1f), p.timestamp)

    /**
     * Junta os pontos de cada traço. A lista completa, quando chega, substitui
     * os pontos recebidos um a um.
     */
    private inner class Retorno : RawInputCallback() {
        private val pontos = ArrayList<PontoTela>()
        private var listaRecebida = false

        @Synchronized
        override fun onBeginRawDrawing(sucesso: Boolean, ponto: TouchPoint?) {
            pontos.clear()
            listaRecebida = false
            ponto?.let { pontos.add(converter(it)) }
        }

        @Synchronized
        override fun onRawDrawingTouchPointMoveReceived(ponto: TouchPoint?) {
            if (!listaRecebida) ponto?.let { pontos.add(converter(it)) }
        }

        @Synchronized
        override fun onRawDrawingTouchPointListReceived(lista: TouchPointList?) {
            val todos = lista?.points ?: return
            if (todos.isEmpty()) return
            pontos.clear()
            todos.mapTo(pontos) { converter(it) }
            listaRecebida = true
        }

        @Synchronized
        override fun onEndRawDrawing(sucesso: Boolean, ponto: TouchPoint?) {
            if (!listaRecebida) ponto?.let { pontos.add(converter(it)) }
            if (pontos.size >= 2) aoTerminarTraco(ArrayList(pontos))
            pontos.clear()
            listaRecebida = false
        }

        override fun onPenUpRefresh(area: RectF?) = atualizarTela()

        // A Pen Plus do Air4 C não tem borracha; apagar fica para depois.
        override fun onBeginRawErasing(sucesso: Boolean, ponto: TouchPoint?) = Unit
        override fun onEndRawErasing(sucesso: Boolean, ponto: TouchPoint?) = Unit
        override fun onRawErasingTouchPointMoveReceived(ponto: TouchPoint?) = Unit
        override fun onRawErasingTouchPointListReceived(lista: TouchPointList?) = Unit
    }

    companion object {
        private const val TAG = "CamadaOnyx"

        /** Diâmetro, em pixels CSS, do traço da página com pressão média e zoom 1. */
        private const val DIAMETRO_CSS = 4.0
        private const val LARGURA_PADRAO = 8f
        private const val PRESSAO_MAXIMA_PADRAO = 4096f

        /** Tempo para a WebView se redesenhar antes de a camada voltar. */
        private const val ATRASO_PARA_RELIGAR_MS = 150L

        fun ehAparelhoOnyx(): Boolean =
            listOf(Build.MANUFACTURER, Build.BRAND).any { it.equals("ONYX", ignoreCase = true) || it.equals("BOOX", ignoreCase = true) }

        /**
         * Cria a camada sobre [alvo]. Devolve `null` fora dos aparelhos Onyx ou
         * quando o SDK não carrega; nesses casos, a página usa a tinta web.
         */
        fun criar(alvo: View, aoTerminarTraco: (List<PontoTela>) -> Unit, aoFalhar: (Throwable) -> Unit): CamadaOnyx? {
            if (!ehAparelhoOnyx()) return null
            return try {
                CamadaOnyx(alvo, aoTerminarTraco, aoFalhar)
            } catch (erro: Throwable) {
                Log.w(TAG, "SDK da Onyx indisponível; a página usa a tinta web", erro)
                null
            }
        }
    }
}
