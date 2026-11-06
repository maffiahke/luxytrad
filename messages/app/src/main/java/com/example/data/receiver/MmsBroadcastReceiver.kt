package com.example.data.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * MMS delivery surface required for holding the default-SMS-app role
 * (Android only assigns ROLE_SMS to an app that can accept WAP pushes).
 *
 * Deliberately minimal: MMS payloads are acknowledged and ignored — real-SMS
 * (the product focus) flows through [SmsBroadcastReceiver]. If MMS reading is
 * ever needed, parse the PDU via android.provider.Telephony.Mms.Intents and
 * mirror it the same way.
 */
class MmsBroadcastReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        // Accept the push; nothing cached or surfaced for now.
    }
}
