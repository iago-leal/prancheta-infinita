package com.iagoleal.prancheta

import android.view.MotionEvent

/** Para onde vai um evento de toque enquanto a camada da Onyx está ativa. */
enum class Destino { CAMADA_ONYX, WEBVIEW, DESCARTAR }

/** Retângulo em pixels físicos da tela, com as bordas incluídas. */
data class Retangulo(val esquerda: Float, val topo: Float, val direita: Float, val base: Float) {
    fun contem(x: Float, y: Float): Boolean = x in esquerda..direita && y in topo..base
}

/**
 * Decide o destino de cada evento de toque quando a camada da Onyx existe.
 *
 * - A caneta vai para a camada da Onyx, exceto quando o traço começa numa
 *   área reservada, como a barra de ferramentas, ou quando a ferramenta ativa
 *   na Prancheta não é de escrita, como a borracha; nesses casos, o traço
 *   inteiro vai para a WebView, e a caneta age sobre a página.
 * - Os dedos vão para a WebView. Quando dois ou mais dedos tocam a tela, a
 *   camada fica suspensa, para não desenhar durante o gesto, e volta quando o
 *   último dedo sai.
 * - Rejeição da palma: um toque de dedo que começa com a caneta na tela, ou
 *   menos de [JANELA_DA_PALMA_MS] depois do último sinal dela, tocando ou
 *   pairando, é descartado por inteiro, porque costuma ser a mão apoiada.
 * - Se a caneta se aproxima ou toca durante um gesto de dedos que já foi para
 *   a WebView, o gesto é cancelado, por [aoCancelarDedos], e o resto dele é
 *   descartado: a mão apoiada antes de a caneta chegar não move o quadro.
 * - Um contato maior que [LIMITE_DO_CONTATO_MM] é tido como palma: descarta o
 *   gesto que começa com ele e cancela o gesto em que ele aparece.
 */
class RoteadorDeToques(private val aoSuspender: (Boolean) -> Unit) {

    var areasReservadas: List<Retangulo> = emptyList()

    /** Se a caneta escreve pela camada; a Prancheta informa conforme a ferramenta ativa. */
    var canetaEscreve = true

    /** Chamado para cancelar, na WebView, o gesto de dedos em andamento. */
    var aoCancelarDedos: () -> Unit = {}

    /** Pixels físicos por milímetro, para medir os contatos; zero desliga a medida. */
    var pixelsPorMm = 0f

    var suspensa = false
        private set

    private var destinoDaCaneta: Destino? = null
    private var ultimoSinalDaCaneta = SEM_SINAL
    private var dedosDescartados = false
    private var dedosNaWebView = false

    fun rotear(evento: MotionEvent): Destino {
        val indice = evento.actionIndex
        val ferramentas = IntArray(evento.pointerCount) { evento.getToolType(it) }
        var contato = 0f
        if (pixelsPorMm > 0f) {
            for (i in ferramentas.indices) {
                if (ferramentas[i] == MotionEvent.TOOL_TYPE_FINGER) contato = maxOf(contato, evento.getTouchMajor(i) / pixelsPorMm)
            }
        }
        return rotear(evento.actionMasked, ferramentas, evento.getX(indice), evento.getY(indice), evento.eventTime, contato)
    }

    /** Registra a caneta pairando sobre a tela, que chega fora dos eventos de toque. */
    fun registrarCanetaPerto(tempo: Long) {
        sinalDaCaneta(tempo)
    }

    /**
     * @param acao ação mascarada do evento, como [MotionEvent.ACTION_DOWN].
     * @param ferramentas tipo de ferramenta de cada ponteiro do evento.
     * @param x posição horizontal do ponteiro da ação, em pixels físicos.
     * @param y posição vertical do ponteiro da ação, em pixels físicos.
     * @param tempo instante do evento, em milissegundos, como [MotionEvent.getEventTime].
     * @param contato maior eixo do maior contato de dedo do evento, em milímetros; zero se desconhecido.
     */
    fun rotear(acao: Int, ferramentas: IntArray, x: Float, y: Float, tempo: Long = 0L, contato: Float = 0f): Destino {
        val temCaneta = ferramentas.any { it == MotionEvent.TOOL_TYPE_STYLUS || it == MotionEvent.TOOL_TYPE_ERASER }
        return if (temCaneta) {
            sinalDaCaneta(tempo)
            rotearCaneta(acao, x, y)
        } else {
            rotearDedos(acao, ferramentas.size, tempo, contato)
        }
    }

    private fun sinalDaCaneta(tempo: Long) {
        ultimoSinalDaCaneta = tempo
        if (dedosNaWebView) cancelarDedos()
    }

    // Cancela na WebView o gesto de dedos em andamento e descarta o resto dele.
    private fun cancelarDedos() {
        dedosNaWebView = false
        dedosDescartados = true
        suspender(false)
        aoCancelarDedos()
    }

    private fun rotearCaneta(acao: Int, x: Float, y: Float): Destino {
        val destino = destinoDaCaneta ?: when {
            !canetaEscreve -> Destino.WEBVIEW
            areasReservadas.any { it.contem(x, y) } -> Destino.WEBVIEW
            else -> Destino.CAMADA_ONYX
        }
        val terminou = acao == MotionEvent.ACTION_UP || acao == MotionEvent.ACTION_CANCEL
        destinoDaCaneta = if (terminou) null else destino
        return destino
    }

    private fun rotearDedos(acao: Int, ponteiros: Int, tempo: Long, contato: Float): Destino {
        val terminou = acao == MotionEvent.ACTION_UP || acao == MotionEvent.ACTION_CANCEL
        val palma = contato > LIMITE_DO_CONTATO_MM
        if (acao == MotionEvent.ACTION_DOWN) {
            dedosDescartados = palma || destinoDaCaneta != null || tempo - ultimoSinalDaCaneta < JANELA_DA_PALMA_MS
            dedosNaWebView = !dedosDescartados
        } else if (palma && dedosNaWebView) {
            cancelarDedos()
        }
        if (dedosDescartados) {
            if (terminou) dedosDescartados = false
            return Destino.DESCARTAR
        }
        when {
            acao == MotionEvent.ACTION_POINTER_DOWN -> if (ponteiros >= 2) suspender(true)
            terminou -> {
                dedosNaWebView = false
                suspender(false)
            }
        }
        return Destino.WEBVIEW
    }

    private fun suspender(valor: Boolean) {
        if (suspensa == valor) return
        suspensa = valor
        aoSuspender(valor)
    }

    companion object {
        /** Tempo, depois do último sinal da caneta, em que um toque de dedo é tido como palma. */
        const val JANELA_DA_PALMA_MS = 1_000L

        /**
         * Maior eixo, em milímetros, a partir do qual um contato é tido como palma:
         * a ponta de um dedo, mesmo apoiada, fica abaixo dele, e o lado da mão, acima.
         */
        const val LIMITE_DO_CONTATO_MM = 25f

        private const val SEM_SINAL = Long.MIN_VALUE / 2
    }
}
