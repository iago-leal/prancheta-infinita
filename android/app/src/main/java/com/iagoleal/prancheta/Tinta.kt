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
     * Cor usada no traço provisório da camada da Onyx: a mesma da página. O modo
     * rápido da tela colorida mostra as cores mais pálidas que a atualização
     * normal, mas não aceita uma cor mais escura para compensar: na casca 0.3.2,
     * que escurecia a cor da caneta em 0,65, o vermelho continuou vermelho e o
     * verde saiu preto. Ao que parece, o modo rápido só acende ou apaga cada
     * canal de cor, com o limite entre os 90 do verde escurecido e os 136 do
     * vermelho escurecido, numa escala até 255; assim, o tom do traço provisório
     * não pode ser ajustado, e a cor vai sem mudança.
     */
    fun corDaCamada(): Int = cor

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
         * O fator vale até a pressão média.
         */
        const val AJUSTE_DO_CONTORNO = 1.2f

        /**
         * Fator na pressão máxima. No vídeo IMG_5257, de 2026-11-08, o traço
         * provisório forte saiu até 20% mais largo que o definitivo, e o autor
         * confirmou, com a casca 0.3.4, que o traço forte fica mais fino na troca;
         * entre a pressão média e a máxima, o fator cresce de 1,2 até este valor.
         */
        const val AJUSTE_DO_CONTORNO_FORTE = 1.4f

        /**
         * Proporção da espessura máxima a partir da qual o fator começa a crescer:
         * a da pressão média, 1,7 de 2,75 vezes a espessura escolhida, como em [FATOR_DA_CANETA].
         */
        const val INICIO_DO_AJUSTE_FORTE = (1.7 / FATOR_DA_CANETA).toFloat()

        /**
         * Diâmetro do traço definitivo para um ponto do contorno calculado pela
         * Onyx, conforme a pressão do ponto, dada pela proporção entre o tamanho
         * dele e a espessura máxima do traço, [larguraDoTraco].
         */
        fun larguraDefinitiva(tamanhoDaOnyx: Float, larguraDoTraco: Float): Float {
            val proporcao = if (larguraDoTraco > 0f) (tamanhoDaOnyx / larguraDoTraco).coerceIn(0f, 1f) else 0f
            val ajuste = if (proporcao <= INICIO_DO_AJUSTE_FORTE) {
                AJUSTE_DO_CONTORNO
            } else {
                val avanco = (proporcao - INICIO_DO_AJUSTE_FORTE) / (1f - INICIO_DO_AJUSTE_FORTE)
                AJUSTE_DO_CONTORNO + (AJUSTE_DO_CONTORNO_FORTE - AJUSTE_DO_CONTORNO) * avanco
            }
            return tamanhoDaOnyx * ajuste
        }

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
