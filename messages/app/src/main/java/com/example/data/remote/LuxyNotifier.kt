package com.example.data.remote

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.example.MainActivity
import com.example.R

/**
 * Notification plumbing for Luxytrades withdrawal alerts: a high-importance
 * channel (heads-up + lock screen, reading like an MPESA text) and a silent
 * channel for the poll service's own persistent notification.
 */
object LuxyNotifier {
    const val ALERT_CHANNEL_ID = "luxy_payout_alerts"
    const val ALERT_CHANNEL_NAME = "Payout alerts"

    fun ensureChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java) ?: return

        val alerts = NotificationChannel(
            ALERT_CHANNEL_ID,
            ALERT_CHANNEL_NAME,
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "MPESA withdrawal and deposit receipts"
            enableLights(true)
            lightColor = Color.BLUE
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 250, 150, 250)
            setShowBadge(true)
        }
        manager.createNotificationChannel(alerts)

        val watcher = NotificationChannel(
            "luxy_watcher",
            "Alert watcher",
            NotificationManager.IMPORTANCE_MIN
        ).apply {
            description = "Keeps payout alerts flowing when the app is closed"
            setShowBadge(false)
        }
        manager.createNotificationChannel(watcher)
    }

    fun canPost(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED

    /** Posts one heads-up notification; tap opens the app's message list. */
    fun notify(context: Context, messageId: String, title: String, body: String) {
        if (!canPost(context) || body.isEmpty()) return

        val click = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pending = PendingIntent.getActivity(
            context,
            (messageId.hashCode()),
            click,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(context, ALERT_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setDefaults(Notification.DEFAULT_ALL)
            .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION))
            .setVibrate(longArrayOf(0, 250, 150, 250))
            .setAutoCancel(true)
            .setContentIntent(pending)

        intNotificationId(messageId).let {
            NotificationManagerCompat.from(context).notify(it, builder.build())
        }
    }

    /** Stable per-message notification id (detached from wall-clock). */
    fun intNotificationId(messageId: String): Int = messageId.hashCode()
}
