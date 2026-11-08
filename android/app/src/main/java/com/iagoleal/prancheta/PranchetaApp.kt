package com.iagoleal.prancheta

import android.app.Application
import android.os.Build
import android.util.Log
import com.onyx.android.sdk.rx.RxManager
import org.lsposed.hiddenapibypass.HiddenApiBypass

/**
 * Inicialização que o SDK da Onyx exige: o contexto do aplicativo para o
 * `RxManager` e a liberação das APIs ocultas do Android que o SDK usa. Só
 * acontece em aparelhos Onyx, e uma falha aqui não impede o aplicativo de
 * abrir com a tinta web.
 */
class PranchetaApp : Application() {
    override fun onCreate() {
        super.onCreate()
        if (!CamadaOnyx.ehAparelhoOnyx()) return
        runCatching { RxManager.Builder.initAppContext(this) }
            .onFailure { Log.w(TAG, "RxManager não inicializou", it) }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            runCatching { HiddenApiBypass.addHiddenApiExemptions("") }
                .onFailure { Log.w(TAG, "APIs ocultas não liberadas", it) }
        }
    }

    private companion object {
        const val TAG = "PranchetaApp"
    }
}
