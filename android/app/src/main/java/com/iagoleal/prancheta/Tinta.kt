package com.iagoleal.prancheta

/**
 * Tinta que a camada da Onyx usa no traço provisório, igual à escolhida na
 * Prancheta: a caneta, sensível à pressão, ou o marca-texto, de espessura
 * constante, com a cor e a espessura da página.
 *
 * @param marcaTexto se a ferramenta de tinta é o marca-texto.
 * @param cor cor em ARGB.
 * @param larguraCss espessura escolhida na Prancheta, em pixels CSS do quadro.
 */
data class Tinta(val marcaTexto: Boolean, val cor: Int, val larguraCss: Float) {

    /** Espessura do traço na tela, em pixels físicos, para o zoom e a densidade dados. */
    fun larguraNaTela(k: Double, densidade: Float): Float {
        val fator = if (marcaTexto) 1.0 else FATOR_DA_CANETA
        return (larguraCss * fator * k * densidade).toFloat().coerceIn(LARGURA_MINIMA, LARGURA_MAXIMA)
    }

    companion object {
        const val PRETO = 0xFF000000.toInt()

        /**
         * Espessura máxima da caneta-tinteiro da Onyx em relação à escolhida na
         * Prancheta: a perfect-freehand do artefato desenha a caneta com
         * diâmetro de 1,7 vez a espessura na pressão média e de cerca de 2,75
         * vezes na pressão forte.
         */
        const val FATOR_DA_CANETA = 2.75

        const val LARGURA_MINIMA = 1f
        const val LARGURA_MAXIMA = 120f

        val PADRAO = Tinta(marcaTexto = false, cor = PRETO, larguraCss = 3f)

        private val RGB = Regex("""rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[\d.]+\s*)?\)""")

        /** Converte uma cor CSS em ARGB opaco: `#rgb`, `#rrggbb` ou `rgb(r, g, b)`. */
        fun lerCor(texto: String?): Int? {
            val t = texto?.trim()?.lowercase() ?: return null
            if (t.startsWith("#")) {
                val hex = t.substring(1)
                val completo = when (hex.length) {
                    3 -> hex.map { "$it$it" }.joinToString("")
                    6 -> hex
                    else -> return null
                }
                val valor = completo.toIntOrNull(16) ?: return null
                return (0xFF shl 24) or valor
            }
            val m = RGB.matchEntire(t) ?: return null
            val (r, g, b) = m.destructured.toList().map { it.toInt() }
            if (r > 255 || g > 255 || b > 255) return null
            return (0xFF shl 24) or (r shl 16) or (g shl 8) or b
        }
    }
}
