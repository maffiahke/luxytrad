package com.example.data.remote

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

/**
 * Doze-friendly safety net for the payout watcher.
 *
 * Some OEM battery savers (Tecno/Infinix "HiOS", Samsung "Sleeping apps", …)
 * force-close foreground services once the app is closed, and on Android 15+
 * the `dataSync` foreground-service type itself is time-capped. This periodic
 * worker (minimum allowed interval: 15 minutes) runs even in Doze and simply
 * [FeedPollService.ensureStarted]s the watcher back to life, so payout
 * alerts resume automatically after any force-close.
 */
class LuxyWatchdogWorker(context: Context, params: WorkerParameters) :
    CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        FeedPollService.ensureStarted(applicationContext)
        return Result.success()
    }

    companion object {
        private const val WORK_NAME = "luxy_payout_watchdog"

        /** Idempotent: schedules the 15-minute revive pass (KEEP — no restart churn). */
        fun ensureScheduled(context: Context) {
            try {
                val request = PeriodicWorkRequestBuilder<LuxyWatchdogWorker>(15, TimeUnit.MINUTES)
                    .build()
                WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                    WORK_NAME,
                    ExistingPeriodicWorkPolicy.KEEP,
                    request
                )
            } catch (_: Exception) {
                // WorkManager unavailable — the foreground service alone still works.
            }
        }
    }
}
