package com.iagoleal.prancheta

/**
 * Decide quando trocar o traço provisório da Onyx pelo definitivo da página.
 *
 * A troca desliga a camada por um instante e atualiza a região escrita; um
 * traço começado nesse intervalo não aparece na hora, só depois da troca. Por
 * isso, ela só acontece com a caneta afastada, depois de [silencioMs] sem
 * nenhum sinal dela, tocando ou pairando sobre a tela. Enquanto se escreve uma
 * palavra ou uma linha, a caneta paira entre um traço e outro, e a troca
 * espera. Se a caneta pairar por mais de [esperaMaximaMs] desde o pedido, a
 * troca acontece mesmo assim, desde que ela não esteja tocando a tela.
 *
 * Os tempos são em milissegundos, na base de [android.view.MotionEvent.getEventTime].
 * Os sinais chegam pela thread da interface, e as consultas, pela da camada.
 */
class AgendaDaTroca(
    private val silencioMs: Long = SILENCIO_MS,
    private val esperaMaximaMs: Long = ESPERA_MAXIMA_MS,
) {
    private var ultimoSinal = SEM_SINAL
    private var pedidaEm: Long? = null

    /** Registra um sinal da caneta, tocando ou pairando; um tempo mais antigo que o último não conta. */
    @Synchronized
    fun sinalDaCaneta(tempo: Long) {
        if (tempo > ultimoSinal) ultimoSinal = tempo
    }

    /** Pede a troca; pedidos seguidos antes dela valem como um só. */
    @Synchronized
    fun pedir(tempo: Long) {
        if (pedidaEm == null) pedidaEm = tempo
    }

    /**
     * Quanto esperar, em milissegundos, antes de trocar: 0 para trocar agora,
     * ou `null` se nenhuma troca foi pedida. Com a caneta tocando a tela, a
     * troca espera o fim do traço.
     */
    @Synchronized
    fun espera(agora: Long, emTraco: Boolean): Long? {
        val pedida = pedidaEm ?: return null
        if (emTraco) return silencioMs
        val semSinal = agora - ultimoSinal
        if (semSinal >= silencioMs || agora - pedida >= esperaMaximaMs) return 0L
        return silencioMs - semSinal
    }

    /** Marca a troca pedida como feita. */
    @Synchronized
    fun trocou() {
        pedidaEm = null
    }

    companion object {
        /** Tempo sem sinal da caneta para considerá-la afastada da tela. */
        const val SILENCIO_MS = 700L

        /** Tempo máximo de espera com a caneta pairando, sem tocar a tela. */
        const val ESPERA_MAXIMA_MS = 20_000L

        private const val SEM_SINAL = Long.MIN_VALUE / 2
    }
}
