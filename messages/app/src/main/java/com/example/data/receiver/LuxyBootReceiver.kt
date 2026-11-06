package com.example.data.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.example.data.remote.FeedPollService

/** Restarts the Luxytrades payout poller after a reboot. */
class LuxyBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            FeedPollService.ensureStarted(context)
        }
    }
}
