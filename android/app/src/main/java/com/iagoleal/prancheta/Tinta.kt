package com.iagoleal.prancheta

import kotlin.math.pow

/**
 * Tinta que a camada da Onyx usa no traço provisório, igual à escolhida na
 * Prancheta: a caneta, sensível à pressão, ou o marca-texto, de espessura
 * constante, com a cor e a espessura da página.
 *
 * @param marcaTexto se a ferramenta de tinta é o marca-texto.
 * @param cor cor em ARGB.
 * @param larguraCss espessura escolhida na Prancheta, em pixels CSS do quadro.
 * @param sensibilidade sensibilidade da caneta à pressão, de 0 a 100, escolhida
 *   na Prancheta; em [SENSIBILIDADE_PADRAO], a pressão segue sem ajuste.
 */
data class Tinta(
    val marcaTexto: Boolean,
    val cor: Int,
    val larguraCss: Float,
    val sensibilidade: Int = SENSIBILIDADE_PADRAO,
) {

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

    /**
     * Ajusta a pressão de um ponto da caneta, de 0 a 1, à sensibilidade
     * escolhida, como a Prancheta faz no navegador: na escala que ela usa, a
     * pressão bruta elevada a [EXPOENTE_DA_PRESSAO], a pressão é elevada a
     * [SENSIBILIDADE_PADRAO] sobre a sensibilidade, limitada à
     * [PRESSAO_MINIMA], e volta à escala bruta. Em 90, nada muda; abaixo
     * disso, a escrita leve fica mais fina e é preciso mais força para
     * engrossar o traço, até que, em 0, toda pressão vale a mínima; acima de
     * 90, o traço engrossa com menos força. O marca-texto não varia com a
     * pressão, e uma pressão nula fica nula.
     */
    fun ajustarPressao(bruta: Float): Float {
        if (marcaTexto || sensibilidade == SENSIBILIDADE_PADRAO || !(bruta > 0f)) return bruta
        val escala = bruta.coerceAtMost(1f).toDouble().pow(EXPOENTE_DA_PRESSAO)
        val ajustada = if (sensibilidade > 0) escala.pow(SENSIBILIDADE_PADRAO.toDouble() / sensibilidade) else 0.0
        return ajustada.coerceIn(PRESSAO_MINIMA, 1.0).pow(1.0 / EXPOENTE_DA_PRESSAO).toFloat()
    }

    /** Espessura do traço na tela, em pixels físicos, para o zoom e a densidade dados. */
    fun larguraNaTela(k: Double, densidade: Float): Float {
        val fator = if (marcaTexto) 1.0 else FATOR_DA_CANETA
        return (larguraCss * fator * k * densidade).toFloat().coerceIn(LARGURA_MINIMA, LARGURA_MAXIMA)
    }

    companion object {
        const val PRETO = 0xFF000000.toInt()

        /**
         * Sensibilidade à pressão em que o traço fica como era antes do
         * controle, conforme a avaliação do autor, em 2026-11-09, de que o
         * traço de então tinha uns 90% de sensibilidade.
         */
        const val SENSIBILIDADE_PADRAO = 90

        /** Expoente da curva de pressão da Prancheta, o mesmo de `receberTraco`, em `casca.js`. */
        const val EXPOENTE_DA_PRESSAO = 0.65

        /** Menor pressão, na escala da Prancheta, que a página aceita. */
        const val PRESSAO_MINIMA = 0.04

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
