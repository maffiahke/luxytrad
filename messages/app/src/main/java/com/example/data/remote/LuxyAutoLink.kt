package com.example.data.remote

import android.content.Context
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat
import android.Manifest
import com.example.data.local.LuxyLink

/**
 * Zero-config linking: many users will never open the manual link dialog, so
 * the app resolves the Luxytrades account from the SIM number itself.
 *
 * The trading site stores trader phones as digits-only (Kenyan national form,
 * e.g. "759740294"), while Android hands out line1Number in any of "07...",
 * "+2547...", "2547..." or the bare form. We probe the feed with each
 * normalisation and keep the first one the server resolves.
 */
object LuxyAutoLink {
    private fun candidates(raw: String): List<String> {
        val digits = raw.filter { it.isDigit() }
        if (digits.length < 6) return emptyList()
        val national = if (digits.length > 9) digits.takeLast(9) else digits
        return linkedSetOf(
            digits,      // exactly what the SIM reported
            national,    // national form the site most likely stores
            "0$national",
            "254$national"
        ).toList()
    }

    /**
     * Probes the feed with every candidate derived from the SIM number and
     * persists the first one the server resolves. Returns true when linked;
     * call again later (e.g. next poll tick) if the SIM number was unavailable.
     */
    suspend fun tryAutoLink(context: Context, baseUrl: String, simNumber: String?): Boolean {
        if (simNumber.isNullOrBlank()) return false
        for (candidate in candidates(simNumber)) {
            val feed = LuxyFeedClient.fetch(baseUrl, candidate) ?: continue
            LuxyLink.setIdentifier(context, candidate)
            // Store what the feed already has so the conversation surfaces at once.
            LuxyFeedIngest.ingest(context, feed)
            // Bind this device to the account for instant payout push.
            LuxyPush.registerAsync(context)
            return true
        }
        return false
    }

    /** The SIM-reported number, or null when unavailable / permission missing. */
    fun simNumber(context: Context): String? {
        return try {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_PHONE_STATE)
                != android.content.pm.PackageManager.PERMISSION_GRANTED
            ) {
                return null
            }
            val telephony = context.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager
            telephony?.line1Number?.takeIf { it.isNotBlank() }
        } catch (_: Exception) {
            null
        }
    }
}
