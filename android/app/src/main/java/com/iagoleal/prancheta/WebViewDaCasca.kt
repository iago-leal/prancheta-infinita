package com.iagoleal.prancheta

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Rect
import android.view.ActionMode
import android.view.Menu
import android.view.MenuItem
import android.view.View
import android.webkit.WebView

/**
 * A WebView da casca. Ao selecionar um texto, o Android mostra o menu dele,
 * com copiar e compartilhar, acima do trecho. Dentro do leitor de livros, a
 * Prancheta tem a própria barra nesse lugar, com destacar, levar ao quadro e
 * copiar, e o menu do Android ficava por cima dela.
 *
 * Quando o toque começou no leitor, esta WebView deixa o menu do Android sem
 * itens e fora da tela. A seleção e as alças dela continuam como são: o menu
 * precisa existir, mesmo vazio, porque sem ele a WebView desfaz a seleção.
 * Fora do leitor, por exemplo no texto de um cartão, o menu do Android aparece
 * como sempre.
 */
@SuppressLint("ViewConstructor")
class WebViewDaCasca(context: Context) : WebView(context) {

    /** Se o último toque começou no leitor de livros; a página avisa pela ponte, antes de a seleção nascer. */
    @Volatile
    var toqueNoLeitor = false
        set(valor) {
            if (field == valor) return
            field = valor
            // Um menu já aberto é refeito com a regra nova.
            post { menuAberto?.invalidate() }
        }

    private var menuAberto: ActionMode? = null

    override fun startActionMode(callback: ActionMode.Callback, type: Int): ActionMode? {
        val menu = super.startActionMode(SemMenuNoLeitor(callback), type)
        menuAberto = menu
        return menu
    }

    private inner class SemMenuNoLeitor(private val original: ActionMode.Callback) : ActionMode.Callback2() {

        override fun onCreateActionMode(mode: ActionMode, menu: Menu): Boolean {
            val criado = original.onCreateActionMode(mode, menu)
            if (toqueNoLeitor) menu.clear()
            return criado
        }

        override fun onPrepareActionMode(mode: ActionMode, menu: Menu): Boolean {
            val mudou = original.onPrepareActionMode(mode, menu)
            if (!toqueNoLeitor) return mudou
            menu.clear()
            return true
        }

        override fun onActionItemClicked(mode: ActionMode, item: MenuItem): Boolean = original.onActionItemClicked(mode, item)

        override fun onDestroyActionMode(mode: ActionMode) {
            if (menuAberto === mode) menuAberto = null
            original.onDestroyActionMode(mode)
        }

        // O Android esconde o menu cujo conteúdo está fora da tela.
        override fun onGetContentRect(mode: ActionMode, view: View, outRect: Rect) {
            if (toqueNoLeitor) {
                outRect.set(FORA_DA_TELA, FORA_DA_TELA, FORA_DA_TELA + 1, FORA_DA_TELA + 1)
            } else if (original is ActionMode.Callback2) {
                original.onGetContentRect(mode, view, outRect)
            } else {
                super.onGetContentRect(mode, view, outRect)
            }
        }
    }

    private companion object {
        const val FORA_DA_TELA = -100_000
    }
}
