package com.riff.app

import android.net.Uri
import android.view.View
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView

/**
 * Bridges the browser-side capabilities the web app already uses — <input
 * type="file"> for uploads and avatar/brand-asset pickers, getUserMedia for
 * camera capture, and load progress.
 */
class RiffWebChromeClient(
    private val onProgress: (Int) -> Unit,
    private val onChooseFile: (ValueCallback<Array<Uri>>, FileChooserParams) -> Boolean,
    private val onFullScreen: (View?, CustomViewCallback?) -> Unit,
) : WebChromeClient() {

    override fun onProgressChanged(view: WebView, newProgress: Int) = onProgress(newProgress)

    override fun onShowFileChooser(
        webView: WebView,
        filePathCallback: ValueCallback<Array<Uri>>,
        fileChooserParams: FileChooserParams,
    ): Boolean = onChooseFile(filePathCallback, fileChooserParams)

    /** Video lessons played full-screen need the view hoisted out of the page. */
    override fun onShowCustomView(view: View, callback: CustomViewCallback) =
        onFullScreen(view, callback)

    override fun onHideCustomView() = onFullScreen(null, null)

    /**
     * Only camera/microphone are ever granted, and only to our own origin —
     * a compromised third-party frame cannot reach the hardware.
     */
    override fun onPermissionRequest(request: PermissionRequest) {
        val allowed = request.resources.filter {
            it == PermissionRequest.RESOURCE_VIDEO_CAPTURE ||
                it == PermissionRequest.RESOURCE_AUDIO_CAPTURE
        }.toTypedArray()

        if (allowed.isEmpty() || !AppConfig.isInternal(request.origin)) {
            request.deny()
        } else {
            request.grant(allowed)
        }
    }
}
