package com.riff.app

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.MediaStore
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import androidx.activity.result.ActivityResultLauncher
import androidx.core.content.FileProvider
import java.io.File
import androidx.core.net.toUri

/**
 * Wires <input type="file"> to Android's document picker and camera.
 *
 * The web app uploads through POST /api/uploads (multipart), which is the same
 * endpoint the desktop site uses — nothing about the upload path is mobile-only.
 */
class FileChooserBridge(
    private val activity: Activity,
    private val launcher: ActivityResultLauncher<Intent>,
) {

    private var callback: ValueCallback<Array<Uri>>? = null
    private var cameraOutput: Uri? = null

    fun onChooseFile(
        cb: ValueCallback<Array<Uri>>,
        params: WebChromeClient.FileChooserParams,
    ): Boolean {
        // A second picker while one is open would strand the first callback and
        // hang the page's file input forever.
        callback?.onReceiveValue(null)
        callback = cb
        cameraOutput = null

        val content = Intent(Intent.ACTION_GET_CONTENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = resolveMimeType(params)
            putExtra(
                Intent.EXTRA_ALLOW_MULTIPLE,
                params.mode == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE,
            )
            val accept = params.acceptTypes?.filter { it.isNotBlank() }?.toTypedArray()
            if (!accept.isNullOrEmpty()) putExtra(Intent.EXTRA_MIME_TYPES, accept)
        }

        val chooser = Intent.createChooser(content, null).apply {
            buildCameraIntent()?.let { putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(it)) }
        }

        return try {
            launcher.launch(chooser)
            true
        } catch (_: Exception) {
            // No picker on the device: release the page so the input is reusable.
            callback?.onReceiveValue(null)
            callback = null
            // Deliberately still true. Returning false hands the request back to
            // the framework, which calls onReceiveValue on the same callback a
            // second time — and a duplicate result throws inside WebView.
            true
        }
    }

    /**
     * Offer the camera alongside the file list when the input accepts images.
     *
     * Two Android 11+ details make or break this:
     *  - `resolveActivity` returns null unless the camera action is declared in
     *    the manifest <queries> block, so without it the camera option silently
     *    never appears.
     *  - the camera app is a *different* process writing to our FileProvider
     *    URI, so it needs an explicit write grant or the capture fails.
     */
    private fun buildCameraIntent(): Intent? = try {
        val dir = File(activity.cacheDir, "captures").apply { mkdirs() }
        val file = File(dir, "capture_${System.currentTimeMillis()}.jpg")
        val uri = FileProvider.getUriForFile(
            activity,
            "${activity.packageName}.fileprovider",
            file,
        )

        val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
            .putExtra(MediaStore.EXTRA_OUTPUT, uri)
            .addFlags(
                Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
                    Intent.FLAG_GRANT_READ_URI_PERMISSION,
            )

        // Only claim a pending capture once we know a camera can actually run;
        // a stale cameraOutput would otherwise be returned for a picked file.
        if (intent.resolveActivity(activity.packageManager) != null) {
            cameraOutput = uri
            intent
        } else {
            null
        }
    } catch (_: Exception) {
        cameraOutput = null
        null
    }

    private fun resolveMimeType(params: WebChromeClient.FileChooserParams): String {
        val types = params.acceptTypes?.filter { it.isNotBlank() }.orEmpty()
        // A single concrete type can narrow the picker; mixed lists fall back to
        // */* with EXTRA_MIME_TYPES doing the filtering.
        return if (types.size == 1 && types[0].contains('/')) types[0] else "*/*"
    }

    /** Must be called for every launcher result, success or cancel. */
    fun onResult(resultCode: Int, data: Intent?) {
        val cb = callback ?: return
        callback = null

        if (resultCode != Activity.RESULT_OK) {
            cb.onReceiveValue(null)
            return
        }

        // Bound to locals so each branch smart-casts instead of re-reading a
        // nullable property the compiler cannot prove stable.
        val clip = data?.clipData
        val single = data?.dataString
        val captured = cameraOutput

        val uris = when {
            clip != null ->
                (0 until clip.itemCount).map { clip.getItemAt(it).uri }.toTypedArray()
            single != null -> arrayOf(single.toUri())
            // Camera capture returns no data — the image went to EXTRA_OUTPUT.
            captured != null -> arrayOf(captured)
            else -> null
        }

        cb.onReceiveValue(uris)
        cameraOutput = null
    }

    /** Release a pending callback when the activity goes away mid-pick. */
    fun cancel() {
        callback?.onReceiveValue(null)
        callback = null
    }
}
