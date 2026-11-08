package com.iagoleal.prancheta

import android.annotation.SuppressLint
import android.app.Activity
import android.content.pm.ApplicationInfo
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.MotionEvent
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader

/**
 * Activity da casca Android. Exibe em tela cheia uma WebView com a página
 * de teste, servida dos assets do APK pelo [WebViewAssetLoader] num
 * endereço HTTPS interno, sem acesso à rede nem a arquivos.
 *
 * Em aparelhos Onyx, a [CamadaOnyx] desenha os traços da caneta com
 * latência baixa, e o [RoteadorDeToques] decide quais eventos vão para ela
 * e quais vão para a WebView. Nos demais aparelhos, ou se o SDK falhar,
 * todos os eventos vão para a WebView, e a página desenha com a tinta web.
 */
class MainActivity : Activity() {

    private lateinit var webView: WebView
    lateinit var ponte: PonteCasca
        private set
    private var camada: CamadaOnyx? = null
    private val roteador = RoteadorDeToques { suspensa -> camada?.suspender(suspensa) }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0) {
            WebView.setWebContentsDebuggingEnabled(true)
        }

        val carregador = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                    carregador.shouldInterceptRequest(request.url)
            }
        }
        ponte = PonteCasca(webView)
        webView.addJavascriptInterface(ponte, "Casca")
        setContentView(webView)

        camada = CamadaOnyx.criar(
            alvo = webView,
            aoTerminarTraco = { pontos -> ponte.enviarTraco(pontos) },
            aoFalhar = { usarTintaWeb() },
        )
        ponte.ouvinte = object : PonteCasca.Ouvinte {
            override fun aoMudarTransformacao(transformacao: Transformacao) {
                camada?.definirEscala(transformacao.k, resources.displayMetrics.density)
            }

            override fun aoMudarAreasReservadas(areas: List<Retangulo>) {
                roteador.areasReservadas = areas
                camada?.definirAreasReservadas(areas)
            }

            override fun aoDesenharTraco() {
                camada?.atualizarTela()
            }
        }
        webView.addOnLayoutChangeListener { _, esquerda, topo, direita, base, esquerdaAntes, topoAntes, direitaAntes, baseAntes ->
            val mudou = direita - esquerda != direitaAntes - esquerdaAntes || base - topo != baseAntes - topoAntes
            if (mudou) camada?.reconfigurar()
        }
        ponte.definirTinta(if (camada != null) "nativa" else "web")
        Log.i(TAG, if (camada != null) "camada da Onyx ativa" else "sem camada da Onyx; tinta web")

        webView.loadUrl(PAGINA_TESTE)
    }

    override fun dispatchTouchEvent(evento: MotionEvent): Boolean {
        val camadaAtiva = camada ?: return super.dispatchTouchEvent(evento)
        return when (roteador.rotear(evento)) {
            Destino.CAMADA_ONYX -> {
                camadaAtiva.onTouchEvent(evento)
                true
            }
            Destino.DESCARTAR -> true
            Destino.WEBVIEW -> super.dispatchTouchEvent(evento)
        }
    }

    override fun onResume() {
        super.onResume()
        camada?.retomar()
    }

    override fun onPause() {
        camada?.pausar()
        super.onPause()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) esconderBarrasDoSistema()
    }

    override fun onDestroy() {
        camada?.encerrar()
        camada = null
        webView.destroy()
        super.onDestroy()
    }

    private fun usarTintaWeb() {
        camada?.encerrar()
        camada = null
        ponte.definirTinta("web")
    }

    private fun esconderBarrasDoSistema() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.insetsController?.let {
                it.hide(WindowInsets.Type.systemBars())
                it.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_FULLSCREEN or
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        }
    }

    private companion object {
        const val TAG = "MainActivity"
        const val PAGINA_TESTE = "https://appassets.androidplatform.net/assets/pagina-teste.html"
    }
}
