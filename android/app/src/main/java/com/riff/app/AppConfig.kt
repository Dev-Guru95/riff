package com.riff.app

import android.net.Uri
import androidx.core.net.toUri

/**
 * Single source of truth for where the app points. The website and the APK talk
 * to this one host, which is what makes accounts, roles and data shared rather
 * than merely "synchronised" — there is only ever one backend and one database.
 */
object AppConfig {

    val BASE: String = BuildConfig.BASE_URL.trimEnd('/')
    val HOST: String = BASE.toUri().host ?: "riff-app.onrender.com"

    const val PATH_LOGIN = "/login"
    const val PATH_DASHBOARD = "/dashboard"

    fun url(path: String): String = BASE + if (path.startsWith("/")) path else "/$path"

    /** True for pages served by our own origin. */
    fun isInternal(uri: Uri?): Boolean =
        uri?.host?.equals(HOST, ignoreCase = true) == true

    /**
     * Third-party hosts that must stay inside the WebView rather than being
     * handed to Chrome. Stripe Checkout and every social OAuth provider finish
     * by redirecting back to our origin, where the callback route reads the
     * `riff_session` cookie. That cookie lives in the WebView's jar, so bouncing
     * the user out to a Custom Tab would land the callback un-authenticated and
     * silently fail to attach the payment or the social account.
     */
    private val KEEP_IN_APP = setOf(
        "checkout.stripe.com", "billing.stripe.com", "js.stripe.com", "hooks.stripe.com",
        "accounts.spotify.com", "accounts.google.com",
        "www.facebook.com", "m.facebook.com", "facebook.com",
        "api.instagram.com", "www.instagram.com", "instagram.com",
        "www.tiktok.com", "tiktok.com",
        "twitter.com", "api.twitter.com", "x.com", "api.x.com",
    )

    fun keepInApp(uri: Uri?): Boolean {
        val host = uri?.host?.lowercase() ?: return false
        return host in KEEP_IN_APP
    }

    /**
     * Build the first URL to load. Requirement: the app always opens on Login,
     * never the marketing landing page. When a deep link brought us here we pass
     * the destination through `?next=` so the user lands on the page they tapped
     * once authenticated — the same mechanism the Skool links already use
     * (see src/lib/nextPath.ts on the server, which re-validates it).
     */
    fun launchUrl(deepLink: Uri?, hasSession: Boolean): String {
        val target = deepLink
            ?.takeIf { isInternal(it) }
            ?.let { it.encodedPath.orEmpty() + (it.encodedQuery?.let { q -> "?$q" } ?: "") }
            ?.takeIf { it.isNotBlank() && it != "/" }

        return when {
            target != null && hasSession -> url(target)
            target != null -> url(PATH_LOGIN) + "?next=" + Uri.encode(target)
            hasSession -> url(PATH_DASHBOARD)
            else -> url(PATH_LOGIN)
        }
    }
}
