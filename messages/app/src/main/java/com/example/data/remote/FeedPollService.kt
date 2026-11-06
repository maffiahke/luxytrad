package com.example.data.remote

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.example.MainActivity
import com.example.R
import com.example.data.local.LuxyLink
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Foreground-service poller so Luxytrades withdrawal receipts arrive as real
 * MPESA texts even with the app closed / screen off. Every few seconds it
 * fetches {linked site}/api/messages?username=<linked account> and runs the
 * result through [LuxyFeedIngest], which stores new rows and reports which
 * ones should buzz.
 */
class FeedPollService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var wakeLock: PowerManager.WakeLock? = null
    private val started = AtomicBoolean(false)

    override fun onCreate() {
        super.onCreate()
        LuxyNotifier.ensureChannels(this)
        startForeground(SERVICE_NOTIFICATION_ID, watcherNotification())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startPollingOnce()
        return START_STICKY
    }

    private fun startPollingOnce() {
        if (!started.compareAndSet(false, true)) return
        scope.launch {
            delay(1_500)
            while (true) {
                pollOnce()
                delay(POLL_INTERVAL_MS)
            }
        }
    }

    private suspend fun pollOnce() {
        val identifier = LuxyLink.identifier(this) ?: return // nothing linked yet
        acquireWakeLock()
        try {
            val feed = withContext(Dispatchers.IO) {
                LuxyFeedClient.fetch(LuxyLink.baseUrl(this@FeedPollService), identifier)
            }
            val notifyNow = LuxyFeedIngest.ingest(this, feed)
            for (message in notifyNow) {
                LuxyNotifier.notify(this, message.id, message.title, message.body)
            }
        } catch (_: Exception) {
            // transient network/API failure — the next tick retries
        } finally {
            releaseWakeLock()
        }
    }

    private fun acquireWakeLock() {
        try {
            if (wakeLock == null) {
                val power = getSystemService(POWER_SERVICE) as PowerManager
                wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "example:luxy_poll")
            }
            wakeLock?.takeIf { it.isHeld == false }?.acquire(10_000)
        } catch (_: Exception) {
        }
    }

    private fun releaseWakeLock() {
        try {
            wakeLock?.takeIf { it.isHeld }?.release()
        } catch (_: Exception) {
        }
    }

    /** The persistent, silent "Alert watcher" notification that keeps us alive. */
    private fun watcherNotification(): Notification {
        val click = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pending = PendingIntent.getActivity(
            this, WATCHER_REQUEST_CODE, click,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, "luxy_watcher")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Alerts active")
            .setContentText("Luxytrades payout alerts are on.")
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setOngoing(true)
            .setShowWhen(false)
            .setContentIntent(pending)
            .build()
    }

    override fun onDestroy() {
        scope.cancel()
        releaseWakeLock()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        private const val POLL_INTERVAL_MS = 5_000L
        private const val SERVICE_NOTIFICATION_ID = 2001
        private const val WATCHER_REQUEST_CODE = 2002

        /** Starts (or no-ops while already running) the watcher. */
        fun ensureStarted(context: Context) {
            val intent = Intent(context, FeedPollService::class.java)
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    ContextCompat.startForegroundService(context, intent)
                } else {
                    context.startService(intent)
                }
            } catch (_: Exception) {
                // Notifications disabled / background restriction — the app still
                // shows payouts in the MPESA thread whenever it is open.
            }
        }

        fun restartIfLinked(context: Context) {
            ensureStarted(context)
        }
    }
}
