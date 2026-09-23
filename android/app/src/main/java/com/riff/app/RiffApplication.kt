package com.riff.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

class RiffApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        scheduleNotificationPolling()
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            NOTIFICATION_CHANNEL_ID,
            getString(R.string.notif_channel_name),
            NotificationManager.IMPORTANCE_DEFAULT,
        ).apply { description = getString(R.string.notif_channel_desc) }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    /**
     * The backend has no push infrastructure (no FCM keys, no web-push VAPID),
     * so unread counts are polled instead. 15 minutes is WorkManager's floor for
     * periodic work and is deliberately battery-cheap; the poll is additionally
     * gated on a live network and skips entirely when signed out.
     */
    private fun scheduleNotificationPolling() {
        val work = PeriodicWorkRequestBuilder<NotificationWorker>(15, TimeUnit.MINUTES)
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build(),
            )
            .build()

        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "riff-notifications",
            ExistingPeriodicWorkPolicy.KEEP,
            work,
        )
    }

    companion object {
        const val NOTIFICATION_CHANNEL_ID = "riff_activity"
    }
}
