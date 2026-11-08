pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        // Repositório da Boox, usado só para o SDK da Onyx e para duas
        // dependências dele que não estão no Google nem no Maven Central.
        maven {
            url = uri("https://repo.boox.com/repository/maven-public/")
            content {
                includeGroup("com.onyx.android.sdk")
                includeGroup("pub.devrel")
                includeGroup("com.tencent")
            }
        }
    }
}

rootProject.name = "prancheta-casca"
include(":app")
