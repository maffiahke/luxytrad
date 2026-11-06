package com.example.data.remote

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Firebase Cloud Messaging listener for Luxytrades receipts. The server sends
 * a HIGH-priority DATA message { id, title, body } the moment a payout is
 * confirmed, so Android wakes this process even when the app was swiped away
 * or the phone has been idle — no poller needs to survive for delivery.
 */
class LuxyMessagingService : FirebaseMessagingService() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        val data = remoteMessage.data
        val id = data["id"] ?: return
        val title = data["title"]?.takeIf { it.isNotBlank() } ?: "MPESA"
        val body = data["body"] ?: return

        scope.launch {
            // Store it in the MPESA thread first (same path the poller uses),
            // then buzz. If the phone is unlocked, this fires the heads-up
            // within a second of the payout landing server-side.
            LuxyFeedIngest.ingestPush(this@LuxyMessagingService, id, title, body)?.let { message ->
                LuxyNotifier.notify(this@LuxyMessagingService, message.id, message.title, message.body)
            }
        }
    }

    override fun onNewToken(token: String) {
        // The device token rotated — re-register against the linked account.
        scope.launch { LuxyPush.register(applicationContext) }
    }
}
