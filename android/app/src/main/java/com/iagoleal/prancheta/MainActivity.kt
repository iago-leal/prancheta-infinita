package com.iagoleal.prancheta

import android.annotation.SuppressLint
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.MotionEvent
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.ServiceWorkerClientCompat
import androidx.webkit.ServiceWorkerControllerCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewFeature
import org.json.JSONObject

/**
 * Activity da casca Android. Exibe em tela cheia uma WebView com a Prancheta
 * de `web/app/`, que a compilação copia para os assets do APK e o
 * [WebViewAssetLoader] serve num endereço HTTPS interno, sem acesso à rede
 * nem a arquivos. Os dados ficam no banco local da própria página.
 *
 * Em aparelhos Onyx, a [CamadaOnyx] desenha os traços da caneta com
 * latência baixa, e o [RoteadorDeToques] decide quais eventos vão para ela
 * e quais vão para a WebView. Nos demais aparelhos, ou se o SDK falhar,
 * todos os eventos vão para a WebView, e a Prancheta desenha sozinha.
 */
class MainActivity : Activity() {

    private lateinit var webView: WebView
    lateinit var ponte: PonteCasca
        private set
    private var camada: CamadaOnyx? = null
    private val roteador = RoteadorDeToques { suspensa -> camada?.suspender(suspensa) }
    // Cópia do último evento de dedos entregue à WebView, para cancelar o gesto.
    private var ultimoToqueDosDedos: MotionEvent? = null
    private var escolhaDeArquivos: ValueCallback<Array<Uri>>? = null
    private lateinit var atualizador: Atualizador

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0) {
            WebView.setWebContentsDebuggingEnabled(true)
        }

        val carregador = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
        prepararServiceWorker(carregador)

        roteador.aoCancelarDedos = ::cancelarDedosNaWebView
        // O motivo de cada toque descartado vai para a página, que o mostra
        // quando o diagnóstico está ligado, em "Mais opções".
        roteador.aoDescartar = { motivo ->
            if (::webView.isInitialized) {
                webView.evaluateJavascript("window.prancheta&&prancheta.toqueDescartado&&prancheta.toqueDescartado(${JSONObject.quote(motivo)})", null)
            }
        }
        roteador.pixelsPorMm = resources.displayMetrics.xdpi / 25.4f

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                    carregador.shouldInterceptRequest(request.url)

                // Links para fora da Prancheta abrem no navegador do aparelho.
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    val url = request.url
                    if (url.host == ENDERECO_INTERNO) return false
                    abrirFora(url)
                    return true
                }
            }
            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(
                    view: WebView,
                    retorno: ValueCallback<Array<Uri>>,
                    parametros: FileChooserParams,
                ): Boolean = escolherArquivos(retorno, parametros)
            }
        }
        ponte = PonteCasca(webView)
        webView.addJavascriptInterface(ponte, "Casca")
        setContentView(webView)

        camada = CamadaOnyx.criar(
            alvo = webView,
            aoTerminarTraco = { pontos, contorno -> ponte.enviarTraco(pontos, contorno) },
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

            override fun aoMudarCaneta(escreve: Boolean) {
                roteador.canetaEscreve = escreve
                camada?.definirAtiva(escreve)
            }

            override fun aoMudarTinta(tinta: Tinta) {
                camada?.definirTinta(tinta)
            }

            override fun aoDesenharTraco() {
                camada?.atualizarTela()
            }

            override fun aoPedirRedesenho() {
                camada?.redesenharTudo()
            }
        }
        webView.addOnLayoutChangeListener { _, esquerda, topo, direita, base, esquerdaAntes, topoAntes, direitaAntes, baseAntes ->
            val mudou = direita - esquerda != direitaAntes - esquerdaAntes || base - topo != baseAntes - topoAntes
            if (mudou) camada?.reconfigurar()
        }
        ponte.definirTinta(if (camada != null) "nativa" else "web")
        Log.i(TAG, if (camada != null) "camada da Onyx ativa" else "sem camada da Onyx; tinta web")

        webView.loadUrl(PRANCHETA)

        atualizador = Atualizador(this)
        atualizador.avisarVersaoNova()
        atualizador.tratarRetorno(intent)
    }

    // O instalador do Android devolve o andamento da atualização por um intent.
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        atualizador.tratarRetorno(intent)
    }

    override fun dispatchTouchEvent(evento: MotionEvent): Boolean {
        val camadaAtiva = camada ?: return super.dispatchTouchEvent(evento)
        val caneta = ehCaneta(evento)
        if (caneta) camadaAtiva.sinalDaCaneta(evento.eventTime)
        return when (roteador.rotear(evento)) {
            Destino.CAMADA_ONYX -> {
                camadaAtiva.onTouchEvent(evento)
                true
            }
            Destino.DESCARTAR -> true
            Destino.WEBVIEW -> {
                if (!caneta) guardarToqueDosDedos(evento)
                super.dispatchTouchEvent(evento)
            }
        }
    }

    private fun guardarToqueDosDedos(evento: MotionEvent) {
        ultimoToqueDosDedos?.recycle()
        val acao = evento.actionMasked
        val terminou = acao == MotionEvent.ACTION_UP || acao == MotionEvent.ACTION_CANCEL
        ultimoToqueDosDedos = if (terminou) null else MotionEvent.obtainNoHistory(evento)
    }

    // A caneta chegou durante um gesto de dedos, que costuma ser a mão apoiada:
    // a WebView recebe o cancelamento do gesto, e a página desfaz o efeito dele.
    private fun cancelarDedosNaWebView() {
        val ultimo = ultimoToqueDosDedos ?: return
        ultimoToqueDosDedos = null
        ultimo.action = MotionEvent.ACTION_CANCEL
        super.dispatchTouchEvent(ultimo)
        ultimo.recycle()
    }

    // A caneta pairando chega como evento genérico. O roteador usa esse sinal
    // para reconhecer a palma apoiada enquanto se escreve, e a camada, para
    // trocar o traço provisório só com a caneta afastada.
    override fun dispatchGenericMotionEvent(evento: MotionEvent): Boolean {
        if (ehCaneta(evento)) {
            roteador.registrarCanetaPerto(evento.eventTime)
            camada?.sinalDaCaneta(evento.eventTime)
        }
        return super.dispatchGenericMotionEvent(evento)
    }

    private fun ehCaneta(evento: MotionEvent) = (0 until evento.pointerCount).any {
        val tipo = evento.getToolType(it)
        tipo == MotionEvent.TOOL_TYPE_STYLUS || tipo == MotionEvent.TOOL_TYPE_ERASER
    }

    override fun onResume() {
        super.onResume()
        camada?.retomar()
        atualizador.aoVoltar()
        atualizador.verificar()
    }

    override fun onPause() {
        camada?.pausar()
        super.onPause()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) esconderBarrasDoSistema()
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != PEDIDO_DE_ARQUIVOS) {
            super.onActivityResult(requestCode, resultCode, data)
            return
        }
        val retorno = escolhaDeArquivos ?: return
        escolhaDeArquivos = null
        retorno.onReceiveValue(if (resultCode == RESULT_OK) urisEscolhidos(data) else null)
    }

    override fun onDestroy() {
        escolhaDeArquivos?.onReceiveValue(null)
        escolhaDeArquivos = null
        camada?.encerrar()
        camada = null
        webView.destroy()
        super.onDestroy()
    }

    /**
     * Faz o service worker da Prancheta, que entrega os arquivos enviados em
     * `/_blob/<id>`, também buscar os arquivos da página nos assets.
     */
    private fun prepararServiceWorker(carregador: WebViewAssetLoader) {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_BASIC_USAGE) ||
            !WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_SHOULD_INTERCEPT_REQUEST)
        ) {
            Log.w(TAG, "a WebView não oferece service worker; as imagens ficam embutidas no quadro")
            return
        }
        val controlador = ServiceWorkerControllerCompat.getInstance()
        controlador.setServiceWorkerClient(object : ServiceWorkerClientCompat() {
            override fun shouldInterceptRequest(request: WebResourceRequest): WebResourceResponse? =
                carregador.shouldInterceptRequest(request.url)
        })
        val ajustes = controlador.serviceWorkerWebSettings
        if (WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_FILE_ACCESS)) ajustes.allowFileAccess = false
        if (WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_CONTENT_ACCESS)) ajustes.allowContentAccess = false
    }

    /** Abre o seletor de arquivos do sistema para um `<input type="file">` da Prancheta. */
    private fun escolherArquivos(retorno: ValueCallback<Array<Uri>>, parametros: WebChromeClient.FileChooserParams): Boolean {
        escolhaDeArquivos?.onReceiveValue(null)
        escolhaDeArquivos = retorno
        val pedido = parametros.createIntent().apply {
            if (parametros.mode == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
        }
        return try {
            startActivityForResult(pedido, PEDIDO_DE_ARQUIVOS)
            true
        } catch (erro: ActivityNotFoundException) {
            Log.w(TAG, "nenhum aplicativo escolhe arquivos", erro)
            escolhaDeArquivos = null
            retorno.onReceiveValue(null)
            true
        }
    }

    private fun urisEscolhidos(dados: Intent?): Array<Uri>? {
        if (dados == null) return null
        dados.clipData?.let { lista -> return Array(lista.itemCount) { lista.getItemAt(it).uri } }
        return dados.data?.let { arrayOf(it) }
    }

    private fun abrirFora(url: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, url))
        } catch (erro: ActivityNotFoundException) {
            Log.w(TAG, "nenhum aplicativo abre $url", erro)
        }
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
        const val ENDERECO_INTERNO = "appassets.androidplatform.net"
        const val PRANCHETA = "https://$ENDERECO_INTERNO/assets/app/index.html"
        const val PEDIDO_DE_ARQUIVOS = 1
    }
}
