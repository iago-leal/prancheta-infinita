package com.iagoleal.prancheta

import android.graphics.Rect
import android.graphics.RectF
import android.os.Build
import android.os.SystemClock
import android.util.Log
import android.view.MotionEvent
import android.view.View
import com.onyx.android.sdk.api.device.epd.EpdController
import com.onyx.android.sdk.api.device.epd.UpdateMode
import com.onyx.android.sdk.data.note.TouchPoint
import com.onyx.android.sdk.pen.NeoFountainPenWrapper
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
 * A camada usa a tinta escolhida na Prancheta: a caneta-tinteiro da Onyx,
 * sensível à pressão, ou o marca-texto, com a cor e a espessura da página.
 * Para a caneta, cada traço segue também com o contorno calculado pelo mesmo
 * motor de canetas da Onyx, com a espessura de cada ponto, para que a
 * Prancheta desenhe o traço definitivo com a mesma forma do provisório.
 *
 * A pressão de cada ponto, antes de seguir para a Prancheta e para o cálculo
 * do contorno, é ajustada à sensibilidade escolhida, por [Tinta.ajustarPressao].
 * O traço provisório é desenhado pelo sistema a partir da leitura direta da
 * caneta, e o SDK não oferece ajuste documentado da pressão dele; fora dos
 * 90% de sensibilidade, ele pode diferir do definitivo.
 *
 * As operações no `TouchHelper` rodam numa thread própria. Os eventos da
 * caneta chegam por [onTouchEvent], encaminhados pela Activity conforme o
 * [RoteadorDeToques].
 */
class CamadaOnyx private constructor(
    private val alvo: View,
    private val aoTerminarTraco: (List<PontoTela>, List<PontoContorno>) -> Unit,
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
    @Volatile private var emTraco = false
    @Volatile private var ajustePendente = false
    @Volatile private var falhou = false
    @Volatile private var areasExcluidas: List<Rect> = emptyList()
    @Volatile private var tinta = Tinta.PADRAO
    @Volatile private var escala = 1.0
    @Volatile private var densidade = alvo.resources.displayMetrics.density
    @Volatile private var larguraTraco = Tinta.PADRAO.larguraNaTela(1.0, alvo.resources.displayMetrics.density)

    // Troca do traço provisório pelo definitivo; os campos abaixo só mudam na thread da camada.
    private val agenda = AgendaDaTroca()
    private var regiaoPendente: RectF? = null
    private var trocaDaTelaInteira = false
    private var verificacaoAgendada = false

    /**
     * Registra um sinal da caneta, tocando ou pairando sobre a tela, com o
     * tempo do evento; a troca do traço provisório espera a caneta se afastar.
     */
    fun sinalDaCaneta(tempo: Long) = agenda.sinalDaCaneta(tempo)

    /** Encaminha ao SDK um evento de caneta destinado à camada. */
    fun onTouchEvent(evento: MotionEvent): Boolean =
        if (falhou) false else runCatching { helper.onTouchEvent(evento) }.getOrDefault(false)

    /** Reaplica toda a configuração; chamar quando o tamanho da WebView muda. */
    fun reconfigurar() = naThread { configurar() }

    /** Áreas da tela, em pixels físicos, onde a caneta não desenha pela camada. */
    fun definirAreasReservadas(areas: List<Retangulo>) {
        val novas = areas.map { Rect(it.esquerda.toInt(), it.topo.toInt(), it.direita.toInt(), it.base.toInt()) }
        if (novas == areasExcluidas) return
        areasExcluidas = novas
        ajustar()
    }

    /** Ajusta a largura do traço provisório ao zoom da página. */
    fun definirEscala(k: Double, densidade: Float) {
        escala = k
        this.densidade = densidade
        larguraTraco = tinta.larguraNaTela(k, densidade)
        ajustar()
    }

    /** Usa no traço provisório a ferramenta, a cor e a espessura escolhidas na Prancheta. */
    fun definirTinta(nova: Tinta) {
        tinta = nova
        larguraTraco = nova.larguraNaTela(escala, densidade)
        ajustar()
    }

    /**
     * Aplica estilo, espessura, cor e áreas excluídas sem reabrir a camada.
     * Reabrir a camada, ou mudá-la durante um traço, pode fazer a Onyx perder o
     * fim do traço e ligá-lo ao seguinte por uma linha que a Prancheta nunca
     * recebe; por isso, um ajuste que chega durante um traço espera ele terminar.
     */
    private fun ajustar() = naThread {
        if (emTraco) {
            ajustePendente = true
            return@naThread
        }
        ajustePendente = false
        helper.setStrokeStyle(estilo())
        helper.setStrokeWidth(larguraTraco)
        helper.setStrokeColor(tinta.corDaCamada())
        helper.setExcludeRect(areasExcluidas)
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

    /**
     * Pede a troca do traço provisório pelo definitivo, quando a Onyx avisa
     * que a caneta subiu. As regiões escritas se acumulam até a troca, que
     * espera a caneta se afastar, conforme a [AgendaDaTroca].
     */
    private fun pedirTroca(area: RectF?) = naThread {
        if (area == null || area.isEmpty) {
            trocaDaTelaInteira = true
        } else {
            val atual = regiaoPendente
            if (atual == null) regiaoPendente = RectF(area) else atual.union(area)
        }
        agenda.pedir(agora())
        verificarTroca()
    }

    /** Troca agora, se a caneta está afastada, ou volta a verificar quando ela puder estar. */
    private fun verificarTroca() {
        val espera = agenda.espera(agora(), emTraco) ?: return
        if (espera > 0) {
            if (!verificacaoAgendada) {
                verificacaoAgendada = true
                alvo.postDelayed({
                    naThread {
                        verificacaoAgendada = false
                        verificarTroca()
                    }
                }, espera)
            }
            return
        }
        agenda.trocou()
        val area = if (trocaDaTelaInteira) null else regiaoPendente
        regiaoPendente = null
        trocaDaTelaInteira = false
        trocarPeloDefinitivo(area)
    }

    /**
     * Troca o traço provisório pelo definitivo, que a Prancheta já desenhou.
     * Só redesenhar a WebView não apaga a camada da Onyx: ela é desligada por
     * um instante, como no gesto de dois dedos, e a região escrita é
     * atualizada, sem o piscar da tela inteira. Roda na thread da camada.
     */
    private fun trocarPeloDefinitivo(area: RectF?) {
        helper.setRawDrawingEnabled(false)
        alvo.post {
            alvo.invalidate()
            val regiao = Rect()
            area?.roundOut(regiao)
            runCatching {
                if (regiao.isEmpty) {
                    EpdController.invalidate(alvo, UpdateMode.GU)
                } else {
                    regiao.inset(-MARGEM_DA_TROCA, -MARGEM_DA_TROCA)
                    EpdController.invalidate(alvo, regiao.left, regiao.top, regiao.right, regiao.bottom, UpdateMode.GU)
                }
            }
            alvo.postDelayed({ aplicarHabilitacao() }, ATRASO_DA_TROCA_MS)
        }
    }

    private fun agora() = SystemClock.uptimeMillis()

    private fun estilo() = if (tinta.marcaTexto) TouchHelper.STROKE_STYLE_MARKER else TouchHelper.STROKE_STYLE_FOUNTAIN

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
        helper.setStrokeColor(tinta.corDaCamada())
        helper.setLimitRect(Rect(0, 0, largura, altura), areasExcluidas)
        helper.openRawDrawing()
        helper.setStrokeStyle(estilo())
        helper.setStrokeWidth(larguraTraco)
        helper.setStrokeColor(tinta.corDaCamada())
        helper.setRawDrawingRenderEnabled(false)
        // A troca do traço provisório pelo definitivo acontece sempre no mesmo
        // tempo depois de levantar a caneta, e não conforme a configuração do aparelho.
        helper.setPenUpRefreshTimeMs(TEMPO_PARA_ATUALIZAR_MS)
        helper.setPenUpRefreshEnabled(true)
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

    /** Pressão do ponto de 0 a 1, ajustada à sensibilidade da tinta do traço. */
    private fun pressaoAjustada(p: TouchPoint, tintaDoTraco: Tinta) = tintaDoTraco.ajustarPressao(p.pressure / pressaoMaxima)

    private fun converter(p: TouchPoint, tintaDoTraco: Tinta) =
        PontoTela(p.x, p.y, pressaoAjustada(p, tintaDoTraco).coerceIn(0f, 1f), p.timestamp)

    /**
     * Calcula, com o motor da caneta-tinteiro da Onyx, a espessura de cada ponto
     * do traço, como no traço provisório. O tamanho de cada ponto devolvido é o
     * diâmetro do traço ali. Se o cálculo falhar, a Prancheta desenha o traço
     * pela pressão, como no navegador.
     */
    private fun calcularContorno(brutos: List<TouchPoint>, tintaDoTraco: Tinta, largura: Float): List<PontoContorno> {
        if (tintaDoTraco.marcaTexto || brutos.size < 2) return emptyList()
        return try {
            NeoFountainPenWrapper.computeStrokePoints(brutos, largura, pressaoMaxima)
                .filter { it.size > 0f }
                .map { PontoContorno(it.x, it.y, Tinta.larguraDefinitiva(it.size, largura)) }
        } catch (erro: Throwable) {
            Log.w(TAG, "a Onyx não calculou o contorno do traço", erro)
            emptyList()
        }
    }

    /**
     * Junta os pontos de cada traço. A lista completa, quando chega, substitui
     * os pontos recebidos um a um. Os pontos brutos, na escala de pressão da
     * Onyx, com a pressão ajustada à sensibilidade, servem ao cálculo do
     * contorno. A tinta vale a do começo do traço, mesmo que mude durante ele.
     */
    private inner class Retorno : RawInputCallback() {
        private val pontos = ArrayList<PontoTela>()
        private val brutos = ArrayList<TouchPoint>()
        private var listaRecebida = false
        private var tintaDoTraco = Tinta.PADRAO

        private fun guardar(ponto: TouchPoint) {
            pontos.add(converter(ponto, tintaDoTraco))
            // Na sensibilidade padrão, a pressão bruta segue intacta, sem o
            // arredondamento da ida e volta pela escala de 0 a 1.
            brutos.add(
                TouchPoint(ponto).also { copia ->
                    if (tintaDoTraco.sensibilidade != Tinta.SENSIBILIDADE_PADRAO) {
                        copia.pressure = pressaoAjustada(ponto, tintaDoTraco) * pressaoMaxima
                    }
                },
            )
        }

        @Synchronized
        override fun onBeginRawDrawing(sucesso: Boolean, ponto: TouchPoint?) {
            emTraco = true
            agenda.sinalDaCaneta(agora())
            tintaDoTraco = tinta
            pontos.clear()
            brutos.clear()
            listaRecebida = false
            ponto?.let { guardar(it) }
        }

        @Synchronized
        override fun onRawDrawingTouchPointMoveReceived(ponto: TouchPoint?) {
            if (!listaRecebida) ponto?.let { guardar(it) }
        }

        @Synchronized
        override fun onRawDrawingTouchPointListReceived(lista: TouchPointList?) {
            val todos = lista?.points ?: return
            if (todos.isEmpty()) return
            pontos.clear()
            brutos.clear()
            todos.forEach { guardar(it) }
            listaRecebida = true
        }

        @Synchronized
        override fun onEndRawDrawing(sucesso: Boolean, ponto: TouchPoint?) {
            if (!listaRecebida) ponto?.let { guardar(it) }
            if (pontos.size >= 2) aoTerminarTraco(ArrayList(pontos), calcularContorno(brutos, tintaDoTraco, larguraTraco))
            pontos.clear()
            brutos.clear()
            listaRecebida = false
            emTraco = false
            agenda.sinalDaCaneta(agora())
            if (ajustePendente) ajustar()
        }

        override fun onPenUpRefresh(area: RectF?) = pedirTroca(area)

        // A Pen Plus do Air4 C não tem borracha; apagar fica para depois.
        override fun onBeginRawErasing(sucesso: Boolean, ponto: TouchPoint?) = Unit
        override fun onEndRawErasing(sucesso: Boolean, ponto: TouchPoint?) = Unit
        override fun onRawErasingTouchPointMoveReceived(ponto: TouchPoint?) = Unit
        override fun onRawErasingTouchPointListReceived(lista: TouchPointList?) = Unit
    }

    companion object {
        private const val TAG = "CamadaOnyx"

        private const val PRESSAO_MAXIMA_PADRAO = 4096f

        /**
         * Tempo entre levantar a caneta e o aviso da Onyx que pede a troca do
         * traço provisório pelo definitivo; a troca ainda espera a caneta se afastar.
         */
        private const val TEMPO_PARA_ATUALIZAR_MS = 600

        /** Tempo para a WebView se redesenhar antes de a camada voltar. */
        private const val ATRASO_PARA_RELIGAR_MS = 150L

        /** Tempo em que a camada fica desligada na troca do traço provisório pelo definitivo. */
        private const val ATRASO_DA_TROCA_MS = 100L

        /** Margem, em pixels físicos, em volta da região atualizada na troca. */
        private const val MARGEM_DA_TROCA = 8

        fun ehAparelhoOnyx(): Boolean =
            listOf(Build.MANUFACTURER, Build.BRAND).any { it.equals("ONYX", ignoreCase = true) || it.equals("BOOX", ignoreCase = true) }

        /**
         * Cria a camada sobre [alvo]. Devolve `null` fora dos aparelhos Onyx ou
         * quando o SDK não carrega; nesses casos, a página usa a tinta web.
         */
        fun criar(
            alvo: View,
            aoTerminarTraco: (List<PontoTela>, List<PontoContorno>) -> Unit,
            aoFalhar: (Throwable) -> Unit,
        ): CamadaOnyx? {
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
