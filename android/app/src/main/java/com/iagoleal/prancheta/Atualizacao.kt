package com.iagoleal.prancheta

import org.json.JSONException
import org.json.JSONObject

/**
 * Versão da casca publicada no GitHub, lida da última versão do repositório.
 * O fluxo `.github/workflows/casca.yml` publica cada versão com a etiqueta
 * `casca-<versionCode>` e o APK como anexo.
 *
 * @param codigo o `versionCode` da versão publicada.
 * @param nome o nome da versão, para mostrar ao autor.
 * @param endereco de onde baixar o APK.
 */
data class Atualizacao(val codigo: Long, val nome: String, val endereco: String) {

    fun maisNovaQue(codigoInstalado: Long): Boolean = codigo > codigoInstalado

    companion object {
        const val REPOSITORIO = "iago-leal/prancheta-infinita"
        const val ENDERECO_DA_ULTIMA = "https://api.github.com/repos/$REPOSITORIO/releases/latest"

        private val ETIQUETA = Regex("""casca-(\d+)""")
        private const val PREFIXO_DOS_ANEXOS = "https://github.com/$REPOSITORIO/releases/download/"

        /**
         * Lê a resposta da API do GitHub. Devolve `null` se não for uma versão
         * da casca com APK anexado neste repositório, para nunca baixar de
         * outro lugar.
         */
        fun ler(json: String): Atualizacao? = try {
            val versao = JSONObject(json)
            val codigo = ETIQUETA.matchEntire(versao.optString("tag_name"))?.groupValues?.get(1)?.toLongOrNull()
            val anexos = versao.optJSONArray("assets")
            val apk = anexos?.let { lista ->
                (0 until lista.length()).map { lista.getJSONObject(it) }.firstOrNull { it.optString("name").endsWith(".apk") }
            }
            val endereco = apk?.optString("browser_download_url").orEmpty()
            if (codigo == null || !endereco.startsWith(PREFIXO_DOS_ANEXOS)) {
                null
            } else {
                Atualizacao(codigo, versao.optString("name").ifBlank { "casca-$codigo" }, endereco)
            }
        } catch (erro: JSONException) {
            null
        }
    }
}
