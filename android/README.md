# Riff for Android

The Riff Android app. It is a native Kotlin application that hosts the Riff
product UI and talks to the **same backend, the same database and the same
accounts** as the website at `riff-app.onrender.com`.

There is no mobile backend, no mobile database and no mobile-only user table.
An account created on the website logs in here, and an account created here logs
in on the website, because both are the same `User` row reached through the same
`/api/auth/login`.

---

## Requirements

| Tool | Version used | Notes |
|---|---|---|
| JDK | 21 | Android Studio ships one at `<studio>/jbr` |
| Android SDK | platform 36, build-tools 36.1.0 | `compileSdk`/`targetSdk` = 36 |
| Gradle | 8.14 | via the committed wrapper — no global install needed |
| Android Gradle Plugin | 8.10.1 | |
| Kotlin | 2.1.0 | |

Minimum supported device: **Android 8.0 (API 26)**.

---

## First-time setup

`local.properties` points Gradle at your SDK. It is git-ignored, so create it if
it is missing:

```properties
sdk.dir=C:/Users/<you>/AppData/Local/Android/Sdk
```

Then point Gradle at a JDK 21:

```bash
# Windows (Git Bash)
export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"
export PATH="$JAVA_HOME/bin:$PATH"
```

---

## Build

```bash
cd android

# Debug build — installs alongside release as com.riff.app.debug
./gradlew assembleDebug

# Signed release build
./gradlew assembleRelease
```

Output:

```
app/build/outputs/apk/debug/app-debug.apk       (~6.9 MB)
app/build/outputs/apk/release/app-release.apk   (~1.9 MB, ~1.2 MB download)
```

### Install on a phone

Enable *Developer options → USB debugging*, plug the phone in, then:

```bash
adb install -r app/build/outputs/apk/release/app-release.apk
adb shell am start -n com.riff.app/.MainActivity
```

Or copy the `.apk` to the device and tap it (allow "install unknown apps").

---

## Signing

`keystore.properties` and `riff-release.keystore` live in `android/` and are
**git-ignored**. The build reads them automatically:

```properties
storeFile=riff-release.keystore
storePassword=<...>
keyAlias=riff
keyPassword=<...>
```

If `keystore.properties` is absent the release build falls back to the debug key
so `assembleRelease` still produces an installable APK — convenient for testing,
but such a build **cannot** be uploaded to Play, and cannot update an APK signed
with the real key.

> **Back up `riff-release.keystore` and its password.** Google Play ties an app
> listing to its signing key permanently. Lose the key and you cannot ship an
> update to an existing listing, ever.

For a Play Store upload, build an App Bundle instead:

```bash
./gradlew bundleRelease   # app/build/outputs/bundle/release/app-release.aab
```

---

## Pointing at a different backend

The backend URL is a single `buildConfigField` in `app/build.gradle.kts`:

```kotlin
buildConfigField("String", "BASE_URL", "\"https://riff-app.onrender.com\"")
```

Change it, rebuild, done. Two things must move together with it:

1. the `<data android:host="...">` deep-link entry in `AndroidManifest.xml`, and
2. for a **cleartext** host (a `http://10.0.2.2:3000` dev server), an exemption
   in `res/xml/network_security_config.xml` — the config currently forbids
   cleartext outright so the session cookie can never travel unencrypted.

---

## Project layout

```
app/src/main/java/com/riff/app/
  AppConfig.kt           Base URL, which hosts stay in-app, launch-URL policy
  SessionStore.kt        Read-only view of the riff_session cookie
  MainActivity.kt        WebView host, back nav, refresh, errors, full-screen
  RiffWebViewClient.kt   Navigation policy + native error mapping
  RiffWebChromeClient.kt File chooser, progress, camera/mic permissions
  FileChooserBridge.kt   <input type="file"> -> documents picker + camera
  DownloadHandler.kt     Authenticated downloads via DownloadManager
  NotificationWorker.kt  15-min unread poll against /api/notifications
  RiffApplication.kt     Notification channel + WorkManager scheduling
```

---

## Notes on behaviour

**Opens on Login.** `AppConfig.launchUrl()` decides the first screen: no session
→ `/login`; live session → `/dashboard`; deep link without a session → `/login`
with `?next=` so the user lands where they tapped after authenticating. The
marketing landing page at `/` is never the entry point.

**The session is the website's session.** The app stores no credentials and
mints no token of its own. It holds the same httpOnly `riff_session` JWT cookie
the website issues, in the WebView cookie jar, flushed to disk on every page
finish and on pause.

**Stripe and social OAuth stay in the WebView.** Their redirect chains end back
on our origin, where the callback route reads the session cookie. Sending them
to a Custom Tab would land the callback un-authenticated. Ordinary outbound
links the user taps still open in a Custom Tab.

**Authorization is the server's job.** The app renders whatever the backend
serves it. A non-admin who reaches `/admin` is redirected by the server, and
admin API calls return 403 — the app is not trusted to enforce roles.
