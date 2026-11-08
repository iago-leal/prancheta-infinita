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
 *   área reservada, como a barra de ferramentas; nesse caso, o traço inteiro
 *   vai para a WebView, e os botões funcionam com a caneta.
 * - Os dedos vão sempre para a WebView. Quando dois ou mais dedos tocam a
 *   tela, a camada fica suspensa, para não desenhar durante o gesto, e volta
 *   quando o último dedo sai.
 * - Um traço de caneta que começa durante o gesto de dois dedos é descartado.
 */
class RoteadorDeToques(private val aoSuspender: (Boolean) -> Unit) {

    var areasReservadas: List<Retangulo> = emptyList()

    var suspensa = false
        private set

    private var destinoDaCaneta: Destino? = null

    fun rotear(evento: MotionEvent): Destino {
        val indice = evento.actionIndex
        val ferramentas = IntArray(evento.pointerCount) { evento.getToolType(it) }
        return rotear(evento.actionMasked, ferramentas, evento.getX(indice), evento.getY(indice))
    }

    /**
     * @param acao ação mascarada do evento, como [MotionEvent.ACTION_DOWN].
     * @param ferramentas tipo de ferramenta de cada ponteiro do evento.
     * @param x posição horizontal do ponteiro da ação, em pixels físicos.
     * @param y posição vertical do ponteiro da ação, em pixels físicos.
     */
    fun rotear(acao: Int, ferramentas: IntArray, x: Float, y: Float): Destino {
        val temCaneta = ferramentas.any { it == MotionEvent.TOOL_TYPE_STYLUS || it == MotionEvent.TOOL_TYPE_ERASER }
        return if (temCaneta) rotearCaneta(acao, x, y) else rotearDedos(acao, ferramentas.size)
    }

    private fun rotearCaneta(acao: Int, x: Float, y: Float): Destino {
        val destino = destinoDaCaneta ?: when {
            suspensa -> Destino.DESCARTAR
            areasReservadas.any { it.contem(x, y) } -> Destino.WEBVIEW
            else -> Destino.CAMADA_ONYX
        }
        val terminou = acao == MotionEvent.ACTION_UP || acao == MotionEvent.ACTION_CANCEL
        destinoDaCaneta = if (terminou) null else destino
        return destino
    }

    private fun rotearDedos(acao: Int, ponteiros: Int): Destino {
        when (acao) {
            MotionEvent.ACTION_POINTER_DOWN -> if (ponteiros >= 2) suspender(true)
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> suspender(false)
        }
        return Destino.WEBVIEW
    }

    private fun suspender(valor: Boolean) {
        if (suspensa == valor) return
        suspensa = valor
        aoSuspender(valor)
    }
}
