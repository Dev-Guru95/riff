package com.riff.app

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment
import android.webkit.CookieManager
import android.webkit.MimeTypeMap
import android.webkit.URLUtil
import android.widget.Toast
import androidx.core.net.toUri

/**
 * Handles certificate PDFs, exported reports and card attachments.
 *
 * The session cookie is attached explicitly: DownloadManager runs outside the
 * WebView and would otherwise fetch the URL anonymously and silently save the
 * login page instead of the file.
 */
object DownloadHandler {

    fun enqueue(
        context: Context,
        url: String,
        userAgent: String?,
        contentDisposition: String?,
        mimeType: String?,
    ) {
        // Only ever download over http(s); a blob:/data: URL has no server fetch.
        val uri = runCatching { url.toUri() }.getOrNull()
        if (uri?.scheme?.lowercase() !in setOf("http", "https")) {
            Toast.makeText(context, R.string.download_failed, Toast.LENGTH_SHORT).show()
            return
        }

        val fileName = URLUtil.guessFileName(url, contentDisposition, mimeType)
        val resolvedMime = mimeType
            ?: MimeTypeMap.getSingleton()
                .getMimeTypeFromExtension(MimeTypeMap.getFileExtensionFromUrl(url))

        try {
            val request = DownloadManager.Request(uri).apply {
                setTitle(fileName)
                setDescription(context.getString(R.string.app_name))
                setMimeType(resolvedMime)
                setNotificationVisibility(
                    DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED,
                )
                setDestinationInExternalFilesDir(
                    context,
                    Environment.DIRECTORY_DOWNLOADS,
                    fileName,
                )
                userAgent?.let { addRequestHeader("User-Agent", it) }
                // Authenticate the download as the signed-in user.
                CookieManager.getInstance().getCookie(url)?.let {
                    addRequestHeader("Cookie", it)
                }
            }

            context.getSystemService(DownloadManager::class.java).enqueue(request)
            Toast.makeText(context, R.string.download_started, Toast.LENGTH_SHORT).show()
        } catch (_: Exception) {
            Toast.makeText(context, R.string.download_failed, Toast.LENGTH_SHORT).show()
        }
    }
}
