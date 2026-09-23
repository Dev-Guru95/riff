package com.riff.app

import android.webkit.CookieManager

/**
 * Thin read-only view over the WebView cookie jar.
 *
 * The app deliberately does NOT store credentials or mint its own tokens: the
 * session is the very same httpOnly `riff_session` JWT the website issues from
 * /api/auth/login. Because it is httpOnly it is unreadable from page JavaScript,
 * and we never copy it into SharedPreferences — so there is no second, weaker
 * copy of the session sitting in app-private storage for malware to lift.
 */
object SessionStore {

    private const val COOKIE_NAME = "riff_session"

    /** Whether a session cookie is present. Validity is still the server's call. */
    fun hasSession(): Boolean {
        val raw = CookieManager.getInstance().getCookie(AppConfig.BASE) ?: return false
        return raw.split(';').any {
            val c = it.trim()
            c.startsWith("$COOKIE_NAME=") && c.length > COOKIE_NAME.length + 1
        }
    }

    /** Cookie header for native requests (downloads, notification polling). */
    fun cookieHeader(): String? =
        CookieManager.getInstance().getCookie(AppConfig.BASE)?.takeIf { it.isNotBlank() }

    /** Persist the jar to disk so the session survives a process death. */
    fun flush() = CookieManager.getInstance().flush()
}
