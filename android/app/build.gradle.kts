plugins {
    id("com.android.application")
}

android {
    namespace = "com.saucyfinn.crabattack"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.saucyfinn.crabattack"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

// Bundle the web game straight from the repo root so the app never runs a stale copy.
abstract class CopyWebGame : DefaultTask() {
    @get:InputFile
    abstract val page: RegularFileProperty

    @get:OutputDirectory
    abstract val outputDir: DirectoryProperty

    @TaskAction
    fun copy() {
        page.get().asFile.copyTo(outputDir.get().file("index.html").asFile, overwrite = true)
    }
}

val copyWebGame = tasks.register<CopyWebGame>("copyWebGame") {
    page.set(rootProject.layout.projectDirectory.file("../index.html"))
}

androidComponents {
    onVariants { variant ->
        variant.sources.assets?.addGeneratedSourceDirectory(copyWebGame, CopyWebGame::outputDir)
    }
}
