plugins {
    id("com.android.application")
}

android {
    namespace = "com.iagoleal.prancheta"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.iagoleal.prancheta"
        minSdk = 26
        targetSdk = 36
        versionCode = 2
        versionName = "0.1.1"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    packaging {
        jniLibs {
            // Várias bibliotecas do SDK da Onyx trazem a própria cópia.
            pickFirsts += "lib/*/libc++_shared.so"
        }
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.18.0")
    // SDK da Onyx: as três versões ficam fixadas, mesmo a do base, que o pen já traz.
    implementation("com.onyx.android.sdk:onyxsdk-pen:1.5.9")
    implementation("com.onyx.android.sdk:onyxsdk-base:1.8.10")
    implementation("com.onyx.android.sdk:onyxsdk-device:1.3.7")
    // A versão 6.2 exige compileSdk 37.
    implementation("org.lsposed.hiddenapibypass:hiddenapibypass:6.1")

    testImplementation("junit:junit:4.13.2")

    constraints {
        // O Jetifier converte bibliotecas antigas do SDK da Onyx para o
        // androidx.vectordrawable 1.0.0, cujas duas partes repetem o mesmo
        // namespace, o que o plugin Android recusa.
        implementation("androidx.vectordrawable:vectordrawable:1.2.0")
        implementation("androidx.vectordrawable:vectordrawable-animated:1.2.0")
    }
}
