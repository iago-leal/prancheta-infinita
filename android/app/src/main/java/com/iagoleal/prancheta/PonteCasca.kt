package com.iagoleal.prancheta

import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.onyx.android.sdk.api.device.epd.EpdController
import com.onyx.android.sdk.device.Device
import org.json.JSONArray
import org.json.JSONObject

/**
 * Ponte entre a casca e a Prancheta. A página chama os métodos marcados com
 * [JavascriptInterface] pelo objeto `Casca`; a casca chama as funções do
 * objeto `prancheta` da página, definido em `web/app/compat/casca.js`.
 *
 * A página trabalha em pixels CSS relativos ao canto superior esquerdo da
 * WebView, e a vista segue `tela = quadro * k + (x, y)`. Como a página usa
 * `width=device-width` e escala inicial 1, um pixel CSS equivale a
 * `densidade` pixels físicos.
 *
 * Os métodos com [JavascriptInterface] rodam na thread da ponte; os avisos ao
 * [ouvinte] são repassados à thread principal.
 */
class PonteCasca(private val webView: WebView) {

    interface Ouvinte {
        fun aoMudarTransformacao(transformacao: Transformacao) {}
        fun aoMudarAreasReservadas(areas: List<Retangulo>) {}
        fun aoDesenharTraco() {}
        fun aoPedirRedesenho() {}
        fun aoMudarCaneta(escreve: Boolean) {}
        fun aoMudarTinta(tinta: Tinta) {}
    }

    var ouvinte: Ouvinte? = null

    @Volatile
    var ultimaTransformacao = Transformacao(0.0, 0.0, 1.0)
        private set

    @Volatile
    var paginaPronta = false
        private set

    @Volatile
    private var modoTinta: String? = null

    private val densidade: Float get() = webView.resources.displayMetrics.density

    @JavascriptInterface
    fun pronta() {
        paginaPronta = true
        modoTinta?.let { modo -> webView.post { aplicarModoTinta(modo) } }
    }

    @JavascriptInterface
    fun transformacao(json: String) {
        val o = JSONObject(json)
        val t = Transformacao(o.getDouble("x"), o.getDouble("y"), o.getDouble("k"))
        ultimaTransformacao = t
        webView.post { ouvinte?.aoMudarTransformacao(t) }
    }

    /** Recebe da página as áreas, em pixels CSS, em que a caneta não deve desenhar pela camada. */
    @JavascriptInterface
    fun areasReservadas(json: String) {
        val d = densidade
        val lista = JSONArray(json)
        val areas = (0 until lista.length()).map { i ->
            val o = lista.getJSONObject(i)
            val x = (o.getDouble("x") * d).toFloat()
            val y = (o.getDouble("y") * d).toFloat()
            Retangulo(x, y, x + (o.getDouble("largura") * d).toFloat(), y + (o.getDouble("altura") * d).toFloat())
        }
        webView.post { ouvinte?.aoMudarAreasReservadas(areas) }
    }

    /**
     * Informa se a caneta escreve pela camada da Onyx, conforme a ferramenta
     * ativa na Prancheta; com a borracha ou as formas, ela age sobre a página.
     */
    @JavascriptInterface
    fun canetaEscreve(escreve: Boolean) {
        webView.post { ouvinte?.aoMudarCaneta(escreve) }
    }

    /**
     * Recebe a tinta ativa na Prancheta: `ferramenta`, "pen" ou "hl", `cor`,
     * como no CSS, `largura`, a espessura escolhida, em pixels CSS do quadro,
     * e `sensibilidade`, a sensibilidade da caneta à pressão, de 0 a 100.
     */
    @JavascriptInterface
    fun tinta(json: String) {
        val o = JSONObject(json)
        val tinta = Tinta(
            marcaTexto = o.optString("ferramenta") == "hl",
            cor = Tinta.lerCor(o.optString("cor")) ?: Tinta.PRETO,
            larguraCss = o.optDouble("largura", Tinta.PADRAO.larguraCss.toDouble()).toFloat(),
            sensibilidade = o.optInt("sensibilidade", Tinta.SENSIBILIDADE_PADRAO).coerceIn(0, 100),
        )
        webView.post { ouvinte?.aoMudarTinta(tinta) }
    }

    /**
     * Devolve, para o diagnóstico da página, os parâmetros de traço que o
     * sistema da Onyx guarda para cada estilo e a pressão máxima da caneta. A
     * chamada que os lê não é documentada; o objetivo é descobrir se algum
     * deles regula a resposta à pressão do traço provisório.
     */
    @JavascriptInterface
    fun parametrosDoTraco(): String {
        if (!CamadaOnyx.ehAparelhoOnyx()) return "fora de um aparelho Onyx"
        return runCatching {
            val aparelho = Device.currentDevice()
            val estilos = (0..ULTIMO_ESTILO).joinToString("; ") { estilo ->
                "$estilo: " + aparelho.getStrokeParameters(estilo).joinToString(", ", "[", "]")
            }
            "pressão máxima ${EpdController.getMaxTouchPressure()}; $estilos"
        }.getOrElse { "falhou: ${it.javaClass.simpleName}" }
    }

    /** A página pede que a tela inteira seja redesenhada, por exemplo depois de apagar traços. */
    @JavascriptInterface
    fun redesenharTela() {
        webView.post { ouvinte?.aoPedirRedesenho() }
    }

    /** Informa à página se a tinta vem da camada da Onyx, "nativa", ou dela mesma, "web". */
    fun definirTinta(modo: String) {
        modoTinta = modo
        if (paginaPronta) webView.post { aplicarModoTinta(modo) }
    }

    /**
     * Entrega à página um traço cujos pontos estão em pixels físicos da WebView,
     * com o contorno calculado pela Onyx, quando há, convertidos para pixels CSS.
     */
    fun enviarTraco(pontos: List<PontoTela>, contorno: List<PontoContorno> = emptyList()) {
        if (!paginaPronta || pontos.isEmpty()) return
        val d = densidade
        val lista = JSONArray()
        for (p in pontos) {
            lista.put(
                JSONObject()
                    .put("x", (p.x / d).toDouble())
                    .put("y", (p.y / d).toDouble())
                    .put("p", p.pressao.toDouble())
                    .put("t", p.tempo),
            )
        }
        val listaDoContorno = JSONArray()
        for (c in contorno) {
            listaDoContorno.put(
                JSONObject()
                    .put("x", (c.x / d).toDouble())
                    .put("y", (c.y / d).toDouble())
                    .put("l", (c.largura / d).toDouble()),
            )
        }
        webView.post {
            webView.evaluateJavascript("prancheta.receberTraco($lista, $listaDoContorno)") { ouvinte?.aoDesenharTraco() }
        }
    }

    private fun aplicarModoTinta(modo: String) {
        webView.evaluateJavascript("prancheta.definirTinta(${JSONObject.quote(modo)})", null)
    }

    private companion object {
        /** Último estilo de traço da Onyx consultado no diagnóstico; o SDK define estilos de 0 a 7. */
        const val ULTIMO_ESTILO = 7
    }
}

/** Transformação da vista da página: `tela = quadro * k + (x, y)`, em pixels CSS. */
data class Transformacao(val x: Double, val y: Double, val k: Double)

/** Ponto de um traço em pixels físicos da WebView, com pressão de 0 a 1 e tempo em milissegundos. */
data class PontoTela(val x: Float, val y: Float, val pressao: Float, val tempo: Long)

/** Ponto do contorno calculado pela Onyx, em pixels físicos, com o diâmetro do traço naquele ponto. */
data class PontoContorno(val x: Float, val y: Float, val largura: Float)
