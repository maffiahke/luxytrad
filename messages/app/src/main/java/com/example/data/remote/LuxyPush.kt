package com.example.data.remote

import android.content.Context
import android.util.Log
import com.example.data.local.LuxyLink
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Device registration for instant push delivery: binds the phone's FCM token
 * to the linked Luxytrades account via POST {base}/api/messages/devices
 * (messagesRouter is mounted at /api/messages, so the full path includes it).
 * The trading site then sends every payout receipt straight to this device,
 * so alerts arrive the moment a withdrawal settles — with the app closed,
 * screen off, or the process killed by an OEM battery optimizer.
 *
 * Everything no-ops when Firebase isn't configured yet (missing
 * google-services.json) or no account is linked — polling remains the
 * fallback.
 */
object LuxyPush {
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /** Non-suspend, fire-and-forget registration (safe from any thread). */
    fun registerAsync(context: Context) {
        GlobalScope.launch { register(context) }
    }

    /**
     * Registers (or refreshes) this device's FCM token for the linked
     * account. Idempotent — the server upserts by token.
     */
    suspend fun register(context: Context) {
        try {
            val identifier = LuxyLink.identifier(context) ?: return
            val token = suspendCancellableCoroutine { continuation ->
                FirebaseMessaging.getInstance().token
                    .addOnSuccessListener { continuation.resume(it) }
                    .addOnFailureListener { continuation.resumeWithException(it) }
            }

            val payload = JSONObject()
                .put("identifier", identifier)
                .put("token", token)
            val request = Request.Builder()
                .url(LuxyLink.baseUrl(context).trimEnd('/') + "/api/messages/devices")
                .post(payload.toString().toRequestBody("application/json".toMediaType()))
                .build()

            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    val body = response.body?.string()
                    Log.w(
                        TAG,
                        "Device registration rejected: HTTP ${response.code} identifier=$identifier url=${request.url} body=$body"
                    )
                } else {
                    Log.i(TAG, "Device registered: identifier=$identifier url=${request.url}")
                }
            }
        } catch (t: Throwable) {
            // Firebase not configured / offline / nothing linked — the poller
            // fallback still delivers while the app runs.
            Log.w(TAG, "Device registration failed: ${t.message}")
        }
    }

    private const val TAG = "LuxyPush"
}
