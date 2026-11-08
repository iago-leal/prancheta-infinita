package com.iagoleal.prancheta

import android.app.Activity
import android.app.AlertDialog
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageInstaller
import android.net.Uri
import android.os.Build
import android.os.SystemClock
import android.provider.Settings
import android.util.Log
import android.widget.Toast
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * Atualiza a casca por dentro do próprio aplicativo. Ao abrir, com internet,
 * consulta a última versão publicada no GitHub e, se ela for mais nova,
 * oferece atualizar; o APK é baixado e instalado pelo instalador do Android,
 * que pede a confirmação do autor. Como as versões são assinadas com a mesma
 * chave, a instalação substitui a anterior e mantém os quadros do aparelho.
 *
 * Sem internet, a consulta falha em silêncio, numa thread própria, sem
 * atrasar a Prancheta.
 */
class Atualizador(private val atividade: Activity) {

    private val executor = Executors.newSingleThreadExecutor { tarefa ->
        Thread(tarefa, "Atualizador").apply { isDaemon = true }
    }
    private var ultimaConsulta = Long.MIN_VALUE / 2
    private var aguardandoPermissao: Atualizacao? = null
    @Volatile private var baixando = false

    /** Avisa, uma vez, quando a casca abre numa versão diferente da última que abriu. */
    fun avisarVersaoNova() {
        val preferencias = atividade.getSharedPreferences(PREFERENCIAS, Activity.MODE_PRIVATE)
        val atual = codigoInstalado()
        val anterior = if (preferencias.contains(CHAVE_DA_VERSAO)) preferencias.getLong(CHAVE_DA_VERSAO, 0L) else null
        val nome = atividade.packageManager.getPackageInfo(atividade.packageName, 0).versionName ?: atual.toString()
        Atualizacao.mensagemDeVersao(anterior, atual, nome)?.let { avisar(it) }
        preferencias.edit().putLong(CHAVE_DA_VERSAO, atual).apply()
    }

    /** Consulta a última versão, no máximo uma vez a cada [INTERVALO_MS]. */
    fun verificar() {
        val agora = SystemClock.elapsedRealtime()
        if (baixando || agora - ultimaConsulta < INTERVALO_MS) return
        ultimaConsulta = agora
        executor.execute {
            val versao = try {
                consultar()
            } catch (erro: Exception) {
                Log.i(TAG, "sem consulta de atualização: ${erro.message}")
                null
            }
            if (versao != null && versao.maisNovaQue(codigoInstalado())) atividade.runOnUiThread { oferecer(versao) }
        }
    }

    /** Retoma a instalação depois que o autor permitiu instalar atualizações nos ajustes. */
    fun aoVoltar() {
        val versao = aguardandoPermissao ?: return
        if (podeInstalar()) {
            aguardandoPermissao = null
            instalar(versao)
        }
    }

    /**
     * Trata o retorno do instalador do Android. Devolve `true` se o intent era
     * dele; quando o Android pede a confirmação do autor, abre a tela dela.
     */
    fun tratarRetorno(intent: Intent?): Boolean {
        if (intent?.action != ACAO_DE_RETORNO) return false
        when (intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)) {
            PackageInstaller.STATUS_PENDING_USER_ACTION -> confirmacao(intent)?.let { atividade.startActivity(it) }
            PackageInstaller.STATUS_SUCCESS -> Unit
            else -> avisar("A atualização não foi instalada: ${intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE) ?: "erro desconhecido"}.")
        }
        return true
    }

    private fun consultar(): Atualizacao? {
        val conexao = URL(Atualizacao.ENDERECO_DA_ULTIMA).openConnection() as HttpURLConnection
        conexao.connectTimeout = TEMPO_DE_CONEXAO_MS
        conexao.readTimeout = TEMPO_DE_LEITURA_MS
        conexao.setRequestProperty("Accept", "application/vnd.github+json")
        conexao.setRequestProperty("User-Agent", "prancheta-casca")
        return try {
            if (conexao.responseCode != HttpURLConnection.HTTP_OK) null
            else Atualizacao.ler(conexao.inputStream.bufferedReader().use { it.readText() })
        } finally {
            conexao.disconnect()
        }
    }

    private fun oferecer(versao: Atualizacao) {
        if (atividade.isFinishing || atividade.isDestroyed) return
        AlertDialog.Builder(atividade)
            .setTitle("Nova versão da Prancheta")
            .setMessage("A versão ${versao.nome} está disponível. Atualizar agora? Os quadros continuam no aparelho.")
            .setPositiveButton("Atualizar") { _, _ -> instalar(versao) }
            .setNegativeButton("Depois", null)
            .show()
    }

    private fun podeInstalar(): Boolean = atividade.packageManager.canRequestPackageInstalls()

    private fun instalar(versao: Atualizacao) {
        if (!podeInstalar()) {
            aguardandoPermissao = versao
            avisar("Permita que a Prancheta instale atualizações e volte para ela.")
            atividade.startActivity(
                Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${atividade.packageName}")),
            )
            return
        }
        if (baixando) return
        baixando = true
        avisar("Baixando a versão ${versao.nome}…")
        executor.execute {
            try {
                baixarEInstalar(versao)
            } catch (erro: Exception) {
                Log.w(TAG, "a atualização falhou", erro)
                atividade.runOnUiThread { avisar("Não foi possível baixar a atualização. Tente de novo com internet.") }
            } finally {
                baixando = false
            }
        }
    }

    private fun baixarEInstalar(versao: Atualizacao) {
        val instalador = atividade.packageManager.packageInstaller
        val parametros = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
        parametros.setAppPackageName(atividade.packageName)
        val id = instalador.createSession(parametros)
        try {
            instalador.openSession(id).use { sessao ->
                val conexao = URL(versao.endereco).openConnection() as HttpURLConnection
                conexao.connectTimeout = TEMPO_DE_CONEXAO_MS
                conexao.readTimeout = TEMPO_DE_LEITURA_MS
                conexao.instanceFollowRedirects = true
                conexao.setRequestProperty("User-Agent", "prancheta-casca")
                try {
                    if (conexao.responseCode != HttpURLConnection.HTTP_OK) error("resposta ${conexao.responseCode}")
                    val tamanho = conexao.contentLengthLong
                    conexao.inputStream.use { entrada ->
                        sessao.openWrite("prancheta.apk", 0, tamanho).use { saida ->
                            entrada.copyTo(saida)
                            sessao.fsync(saida)
                        }
                    }
                } finally {
                    conexao.disconnect()
                }
                val retorno = Intent(atividade, atividade.javaClass).setAction(ACAO_DE_RETORNO)
                val pendente = PendingIntent.getActivity(atividade, id, retorno, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE)
                sessao.commit(pendente.intentSender)
            }
        } catch (erro: Exception) {
            runCatching { instalador.abandonSession(id) }
            throw erro
        }
    }

    private fun confirmacao(intent: Intent): Intent? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra(Intent.EXTRA_INTENT)
        }

    private fun codigoInstalado(): Long {
        val info = atividade.packageManager.getPackageInfo(atividade.packageName, 0)
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            info.longVersionCode
        } else {
            @Suppress("DEPRECATION")
            info.versionCode.toLong()
        }
    }

    private fun avisar(texto: String) = Toast.makeText(atividade, texto, Toast.LENGTH_LONG).show()

    companion object {
        private const val TAG = "Atualizador"
        private const val PREFERENCIAS = "casca"
        private const val CHAVE_DA_VERSAO = "versao_aberta"
        const val ACAO_DE_RETORNO = "com.iagoleal.prancheta.RETORNO_DA_ATUALIZACAO"
        private const val INTERVALO_MS = 6 * 60 * 60 * 1000L
        private const val TEMPO_DE_CONEXAO_MS = 5_000
        private const val TEMPO_DE_LEITURA_MS = 20_000
    }
}
