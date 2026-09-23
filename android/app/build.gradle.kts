import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.riff.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.riff.app"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"

        // The one place the backend lives. Both platforms talk to this host, so
        // accounts, data and sessions are shared with the website by construction.
        buildConfigField("String", "BASE_URL", "\"https://riff-app.onrender.com\"")
        // Appended to the WebView User-Agent so the server can tell it is us.
        buildConfigField("String", "UA_TAG", "\"RiffAndroid/1.0.0\"")
    }

    signingConfigs {
        create("release") {
            // Falls back to the debug keystore when no release keystore is
            // supplied, so `assembleRelease` always produces an installable APK.
            val props = rootProject.file("keystore.properties")
            if (props.exists()) {
                val p = Properties().apply { props.inputStream().use { load(it) } }
                storeFile = rootProject.file(p.getProperty("storeFile"))
                storePassword = p.getProperty("storePassword")
                keyAlias = p.getProperty("keyAlias")
                keyPassword = p.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            val props = rootProject.file("keystore.properties")
            signingConfig = if (props.exists()) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        viewBinding = true
        buildConfig = true
    }
}

// Versions are pinned to the newest releases compatible with AGP 8.10.1 and
// compileSdk 36. Android lint will suggest newer ones (core-ktx 1.19.0,
// appcompat 1.8.0, material 1.14.0, ...) — those require AGP 9.1+ and
// compileSdk 37, which this toolchain does not have. Bump AGP first, not these.
dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.constraintlayout:constraintlayout:2.2.0")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
    implementation("androidx.core:core-splashscreen:1.0.1")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.browser:browser:1.8.0")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.work:work-runtime-ktx:2.10.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
}
