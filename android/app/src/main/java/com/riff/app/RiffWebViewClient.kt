package com.riff.app

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.browser.customtabs.CustomTabsIntent
import androidx.core.graphics.toColorInt

/** What went wrong, so the user sees a sentence rather than a Chromium error code. */
enum class LoadFailure { OFFLINE, SERVER, GENERIC }

class RiffWebViewClient(
    private val context: Context,
    private val onPageStarted: (String) -> Unit,
    private val onPageDone: (String) -> Unit,
    private val onFailure: (LoadFailure) -> Unit,
) : WebViewClient() {

    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
        val uri = request.url
        val scheme = uri.scheme?.lowercase()

        // mailto:, tel:, sms:, intent: and friends belong to other apps.
        if (scheme != null && scheme != "http" && scheme != "https") {
            return openExternally(uri)
        }

        // Our own pages, and the payment/OAuth hosts whose redirect chain ends
        // back on our origin, stay in the WebView so the session cookie applies.
        if (AppConfig.isInternal(uri) || AppConfig.keepInApp(uri)) return false

        // A server-driven redirect is part of a flow already in progress —
        // following it in place keeps that flow intact.
        if (request.isRedirect) return false

        // Anything else is a genuine outbound link the user tapped (a Skool
        // link, a social profile, a shared URL). Hand it to a Custom Tab so the
        // user keeps their browser session and can return with the back button.
        return if (request.hasGesture()) openExternally(uri) else false
    }

    private fun openExternally(uri: Uri): Boolean {
        val scheme = uri.scheme?.lowercase()
        return try {
            if (scheme == "http" || scheme == "https") {
                CustomTabsIntent.Builder()
                    .setShowTitle(true)
                    .setDefaultColorSchemeParams(
                        androidx.browser.customtabs.CustomTabColorSchemeParams.Builder()
                            .setToolbarColor("#0a0a0f".toColorInt())
                            .build(),
                    )
                    .build()
                    .launchUrl(context, uri)
            } else {
                context.startActivity(Intent(Intent.ACTION_VIEW, uri))
            }
            true
        } catch (_: ActivityNotFoundException) {
            // No app can handle it — swallow rather than crash.
            true
        }
    }

    override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
        onPageStarted(url)
    }

    override fun onPageFinished(view: WebView, url: String) {
        // Persist the session cookie at every page boundary so it survives the
        // process being killed in the background.
        SessionStore.flush()
        onPageDone(url)
    }

    override fun onReceivedError(
        view: WebView,
        request: WebResourceRequest,
        error: WebResourceError,
    ) {
        // Sub-resource failures (an image, a font) must not blank the whole app.
        if (!request.isForMainFrame) return

        val failure = when (error.errorCode) {
            ERROR_HOST_LOOKUP, ERROR_CONNECT, ERROR_IO, ERROR_PROXY_AUTHENTICATION ->
                LoadFailure.OFFLINE
            ERROR_TIMEOUT -> LoadFailure.SERVER
            else -> LoadFailure.GENERIC
        }
        onFailure(failure)
    }

    override fun onReceivedHttpError(
        view: WebView,
        request: WebResourceRequest,
        errorResponse: WebResourceResponse,
    ) {
        if (!request.isForMainFrame) return
        // 4xx pages are rendered by the app itself (its own not-found / denied
        // screens), so only surface a native error for genuine server faults.
        if (errorResponse.statusCode >= 500) onFailure(LoadFailure.SERVER)
    }
}
