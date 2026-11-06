package com.example.data.local

import android.content.Context

/**
 * Local persistence for the Luxytrades link: which trader account this SMS app
 * belongs to (username / phone digits / email, matching exactly what the
 * trading site's login accepts) and which site to poll.
 *
 * Private to this app so no other app can tamper with the link.
 */
object LuxyLink {
    private const val PREFS = "luxy_link_prefs"
    private const val KEY_IDENTIFIER = "luxy_identifier"
    private const val KEY_BASE_URL = "luxy_base_url"
    private const val KEY_SEEDED = "luxy_seeded"
    private const val KEY_SEEN_IDS = "luxy_seen_ids"

    /** The linked trader identity, or null when no account is linked yet. */
    fun identifier(context: Context): String? {
        val value = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_IDENTIFIER, null)
        return value?.takeIf { it.isNotBlank() }
    }

    fun setIdentifier(context: Context, value: String?) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_IDENTIFIER, value?.trim()?.takeIf { it.isNotBlank() })
            .apply()
    }

    /** The trading site origin the feed is polled from. */
    fun baseUrl(context: Context): String {
        val saved = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_BASE_URL, null)?.takeIf { it.isNotBlank() }
        return saved ?: com.example.data.remote.LuxyFeedClient.DEFAULT_BASE_URL
    }

    fun setBaseUrl(context: Context, value: String?) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_BASE_URL, value?.trim()?.takeIf { it.isNotBlank() })
            .apply()
    }

    /**
     * False only after a fresh install / clear-data: the very first fetch
     * populates the MPESA history silently (no buzz for old payouts).
     */
    fun isSeeded(context: Context): Boolean =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_SEEDED, false)

    fun setSeeded(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean(KEY_SEEDED, true).apply()
    }

    /** Message ids the app has already stored from the feed (dedupe). */
    fun seenIds(context: Context): Set<String> =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getStringSet(KEY_SEEN_IDS, emptySet()) ?: emptySet()

    fun saveSeenIds(context: Context, ids: Set<String>) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putStringSet(KEY_SEEN_IDS, ids).apply()
    }

    fun wipe(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().clear().apply()
    }
}
