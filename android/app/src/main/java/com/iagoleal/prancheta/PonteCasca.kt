package com.iagoleal.prancheta

import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONArray
import org.json.JSONObject

/**
 * Ponte entre a casca e a página. A página chama os métodos marcados com
 * [JavascriptInterface] pelo objeto `Casca`; a casca entrega traços à
 * página com [enviarTraco], que chama `prancheta.receberTraco`.
 *
 * A página trabalha em pixels CSS relativos ao canto superior esquerdo da
 * WebView, e a vista segue `tela = quadro * k + (x, y)`. Como a página usa
 * `width=device-width` e escala inicial 1, um pixel CSS equivale a
 * `densidade` pixels físicos.
 */
class PonteCasca(private val webView: WebView) {

    @Volatile
    var ultimaTransformacao = Transformacao(0.0, 0.0, 1.0)
        private set

    @Volatile
    var paginaPronta = false
        private set

    @JavascriptInterface
    fun pronta() {
        paginaPronta = true
        Log.d(TAG, "página pronta")
    }

    @JavascriptInterface
    fun transformacao(json: String) {
        val o = JSONObject(json)
        ultimaTransformacao = Transformacao(o.getDouble("x"), o.getDouble("y"), o.getDouble("k"))
    }

    /** Entrega à página um traço cujos pontos estão em pixels físicos da WebView. */
    fun enviarTraco(pontos: List<PontoTela>) {
        if (!paginaPronta || pontos.isEmpty()) return
        val densidade = webView.resources.displayMetrics.density
        val lista = JSONArray()
        for (p in pontos) {
            lista.put(
                JSONObject()
                    .put("x", (p.x / densidade).toDouble())
                    .put("y", (p.y / densidade).toDouble())
                    .put("p", p.pressao.toDouble())
                    .put("t", p.tempo),
            )
        }
        webView.post { webView.evaluateJavascript("prancheta.receberTraco($lista)", null) }
    }

    private companion object {
        const val TAG = "PonteCasca"
    }
}

/** Transformação da vista da página: `tela = quadro * k + (x, y)`, em pixels CSS. */
data class Transformacao(val x: Double, val y: Double, val k: Double)

/** Ponto de um traço em pixels físicos da WebView, com pressão de 0 a 1 e tempo em milissegundos. */
data class PontoTela(val x: Float, val y: Float, val pressao: Float, val tempo: Long)
