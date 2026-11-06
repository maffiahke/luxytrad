package com.example.data.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.telephony.SmsMessage
import com.example.data.repository.SmsRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Real-SMS intake.
 *
 *  • `SMS_RECEIVED` — normal broadcast every SMS app gets; messages are
 *    already in the system provider, so we just refresh the local mirror
 *    (incremental — reads only the new rows, effectively instant).
 *  • `SMS_DELIVER` — broadcast the DEFAULT SMS app exclusively gets; the
 *    message is NOT in the system provider yet, so as the inbox owner we
 *    must store it there (otherwise it would be lost to the mirror and to
 *    other apps once this app holds the role), then refresh + buzz.
 */
class SmsBroadcastReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val isDeliver = intent.action == Telephony.Sms.Intents.SMS_DELIVER_ACTION
        if (intent.action != Telephony.Sms.Intents.SMS_DELIVER_ACTION &&
            intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION
        ) return

        val messages: Array<SmsMessage> =
            Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
        if (messages.isEmpty()) return

        val appContext = context.applicationContext
        val body = messages.joinToString("") { it.displayMessageBody ?: "" }
        val address = messages.firstOrNull()?.originatingAddress ?: return
        val timestamp = messages.firstOrNull()?.timestampMillis ?: System.currentTimeMillis()

        CoroutineScope(Dispatchers.IO).launch {
            if (isDeliver) {
                // Default app: persist into the system inbox first. The
                // ContentObserver on Telephony.Sms mirrors it into Room, and
                // the explicit sync below guarantees freshness regardless.
                try {
                    val values = android.content.ContentValues().apply {
                        put(Telephony.Sms.ADDRESS, address)
                        put(Telephony.Sms.BODY, body)
                        put(Telephony.Sms.DATE, timestamp)
                        put(Telephony.Sms.READ, 0)
                        put(Telephony.Sms.SEEN, 0)
                        put(Telephony.Sms.TYPE, Telephony.Sms.MESSAGE_TYPE_INBOX)
                    }
                    appContext.contentResolver.insert(Telephony.Sms.CONTENT_URI, values)
                } catch (_: Exception) {
                    // Provider write failed — still refresh the local mirror.
                }
            }
            runCatching {
                SmsRepository(appContext).syncDeviceSmsInbox(full = isDeliver)
            }
        }
    }
}
