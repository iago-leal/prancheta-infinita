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

    /**
     * Cor usada no traço provisório da camada da Onyx. O modo rápido da tela
     * colorida mostra as cores mais pálidas do que a atualização normal, em que
     * aparece o traço definitivo; por isso, a cor da caneta vai mais escura para
     * a camada. O marca-texto, que já é claro e translúcido, segue igual.
     */
    fun corDaCamada(): Int = if (marcaTexto) cor else escurecer(cor, AJUSTE_DE_COR)

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

        /**
         * O traço provisório da Onyx aparece cerca de 20% mais grosso na tela
         * e-ink do que o contorno calculado pelo mesmo motor e desenhado pela
         * Prancheta, conforme a medição do vídeo do autor de 2026-11-08; o
         * contorno é engrossado na mesma proporção para que a troca não se note.
         */
        const val AJUSTE_DO_CONTORNO = 1.2f

        /**
         * Fator aplicado à cor da caneta na camada da Onyx. No vídeo do autor de
         * 2026-11-08 com a caneta verde, o traço definitivo tinha contraste com
         * o fundo cerca de 1,5 vez maior que o provisório; 0,65 escurece a cor
         * na proporção inversa.
         */
        const val AJUSTE_DE_COR = 0.65f

        /** Escurece uma cor ARGB multiplicando os canais de cor pelo fator, sem mudar a opacidade. */
        fun escurecer(cor: Int, fator: Float): Int {
            val a = (cor ushr 24) and 0xFF
            val r = (((cor shr 16) and 0xFF) * fator).toInt().coerceIn(0, 255)
            val g = (((cor shr 8) and 0xFF) * fator).toInt().coerceIn(0, 255)
            val b = ((cor and 0xFF) * fator).toInt().coerceIn(0, 255)
            return (a shl 24) or (r shl 16) or (g shl 8) or b
        }

        /** Diâmetro do traço definitivo para um ponto do contorno calculado pela Onyx. */
        fun larguraDefinitiva(tamanhoDaOnyx: Float): Float = tamanhoDaOnyx * AJUSTE_DO_CONTORNO

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
