package com.example.data.remote

import okhttp3.OkHttpClient
import org.json.JSONObject
import java.net.URLEncoder
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.TimeUnit

/** One message row of the Luxytrades withdrawal-alert feed. */
data class LuxyFeedMessage(
    val id: String,
    val title: String,
    val body: String,
    val read: Boolean,
    val atMs: Long
)

/**
 * Client for the trading site's message feed: GET {base}/api/messages?username=
 * <identifier>. Identity resolves server-side exactly like the site's own login
 * (username -> phone digits -> email), so the linked account can be any of
 * those. No auth header needed for this shell — the username query is the
 * contract the site publishes for native shells.
 */
object LuxyFeedClient {
    const val DEFAULT_BASE_URL = "https://luxytrades.vercel.app"

    private val client = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS)
        .readTimeout(8, TimeUnit.SECONDS)
        .build()

    /** ISO-8601 with millis + Z (what Date#toISOString produces) — plus a lenient fallback. */
    private val isoMillis = run {
        val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        fmt.timeZone = TimeZone.getTimeZone("UTC")
        fmt
    }
    private val isoSeconds = run {
        val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
        fmt.timeZone = TimeZone.getTimeZone("UTC")
        fmt
    }

    private fun parseAt(value: String): Long {
        for (fmt in arrayOf(isoMillis, isoSeconds)) {
            try {
                val parsed = fmt.parse(value)
                if (parsed != null) return parsed.time
            } catch (_: Exception) {
            }
        }
        return System.currentTimeMillis()
    }

    /**
     * Fetches the feed. Throws on transient network/HTTP failure so the poller
     * simply retries next tick; returns null when the server could not resolve
     * the identity (401/403/404 — e.g. an unknown account during auto-link
     * probing), and an empty list when the account simply has no messages yet.
     */
    fun fetch(baseUrl: String, identifier: String): List<LuxyFeedMessage>? {
        val url = baseUrl.trimEnd('/') + "/api/messages?username=" +
            URLEncoder.encode(identifier, "UTF-8")

        val request = okhttp3.Request.Builder().url(url).get().build()

        client.newCall(request).execute().use { response ->
            if (response.code == 401 || response.code == 403 || response.code == 404) {
                return null
            }
            if (!response.isSuccessful) {
                throw IllegalStateException("Feed HTTP ${response.code}")
            }
            val payload = response.body?.string().orEmpty()
            if (!payload.trimStart().startsWith("{")) return emptyList()

            val array = JSONObject(payload).optJSONArray("messages") ?: return emptyList()
            val result = ArrayList<LuxyFeedMessage>(array.length())
            for (i in 0 until array.length()) {
                val item = array.optJSONObject(i) ?: continue
                val id = item.optString("id")
                if (id.isEmpty()) continue
                result.add(
                    LuxyFeedMessage(
                        id = id,
                        title = item.optString("title").ifBlank { "MPESA" },
                        body = item.optString("body"),
                        read = item.optBoolean("read", false),
                        atMs = parseAt(item.optString("at"))
                    )
                )
            }
            return result
        }
    }
}
