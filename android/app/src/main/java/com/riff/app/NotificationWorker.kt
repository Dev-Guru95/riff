package com.riff.app

import android.Manifest
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import androidx.core.content.edit
import androidx.core.net.toUri

/**
 * Polls the website's own /api/notifications endpoint using the session cookie
 * already held by the WebView. No separate mobile auth, no duplicated data — the
 * unread count shown on the phone is the exact number the web UI shows.
 */
class NotificationWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val cookie = SessionStore.cookieHeader() ?: return@withContext Result.success()
        if (!SessionStore.hasSession()) return@withContext Result.success()

        val unread = try {
            fetchUnreadCount(cookie)
        } catch (_: Exception) {
            // Transient network/server trouble — retry on the next cycle.
            return@withContext Result.retry()
        }

        // Only a genuine increase is worth interrupting someone for. Comparing
        // with != instead fired a fresh notification when the count went *down*
        // — i.e. every time the user read something on the website.
        if (unread > lastSeen()) notify(unread)
        rememberSeen(unread)

        Result.success()
    }

    private fun fetchUnreadCount(cookie: String): Int {
        val conn = (URL(AppConfig.url("/api/notifications")).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            setRequestProperty("Cookie", cookie)
            setRequestProperty("Accept", "application/json")
            setRequestProperty("User-Agent", BuildConfig.UA_TAG)
            connectTimeout = 20_000
            // Render's free tier cold-starts; give the server room to wake up.
            readTimeout = 60_000
        }
        return try {
            // 401 means the session expired. That is not an error worth retrying:
            // the user will be sent to /login by the server on next interaction.
            if (conn.responseCode == 401) return 0
            if (conn.responseCode !in 200..299) throw IllegalStateException("HTTP ${conn.responseCode}")
            JSONObject(conn.inputStream.bufferedReader().use { it.readText() }).optInt("unread", 0)
        } finally {
            conn.disconnect()
        }
    }

    private fun notify(unread: Int) {
        val ctx = applicationContext
        if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED
        ) return

        val intent = Intent(ctx, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            data = AppConfig.url(AppConfig.PATH_DASHBOARD).toUri()
        }
        val pending = PendingIntent.getActivity(
            ctx, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val text = if (unread == 1) "You have 1 unread notification"
        else "You have $unread unread notifications"

        val notification = NotificationCompat.Builder(ctx, RiffApplication.NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(ctx.getString(R.string.app_name))
            .setContentText(text)
            .setColor(ContextCompat.getColor(ctx, R.color.brand))
            .setContentIntent(pending)
            .setAutoCancel(true)
            .build()

        NotificationManagerCompat.from(ctx).notify(NOTIFICATION_ID, notification)
    }

    private fun prefs() =
        applicationContext.getSharedPreferences("riff_notifications", Context.MODE_PRIVATE)

    private fun lastSeen() = prefs().getInt("last_unread", 0)
    private fun rememberSeen(n: Int) = prefs().edit { putInt("last_unread", n) }

    private companion object {
        const val NOTIFICATION_ID = 1001
    }
}
