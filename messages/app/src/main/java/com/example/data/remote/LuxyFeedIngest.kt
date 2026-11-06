package com.example.data.remote

import android.content.Context
import com.example.data.local.AppDatabase
import com.example.data.local.LuxyLink
import com.example.data.local.MessageEntity
import com.example.data.local.ThreadEntity
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Merges Luxytrades feed messages into the local SMS database so withdrawal
 * receipts look like genuine MPESA texts: one conversation per sender title
 * ("MPESA" — service sender, Transactions category), newest message last,
 * unread badge counting only NEW receipts, and the very first fetch after a
 * fresh install arrives silently so stale payouts don't flood the phone.
 */
object LuxyFeedIngest {
    private const val LUXY_COLOR = "#F9AB00"

    /** Deterministic local thread id per feed sender (e.g. "luxy_mpesa"). */
    private fun threadIdFor(title: String): String =
        "luxy_" + title.trim().lowercase().replace(Regex("[^a-z0-9]+"), "_")

    private val messageTime = SimpleDateFormat("h:mm a", Locale.getDefault())
    private val listTime = SimpleDateFormat("d/M/yy", Locale.getDefault())

    private fun formatMessageTime(timestamp: Long): String = messageTime.format(Date(timestamp))

    private fun formatListTime(timestamp: Long, now: Long): String {
        val diff = now - timestamp
        return when {
            diff < 60 * 1000 -> "Just now"
            diff < 60 * 60 * 1000 -> "${diff / (60 * 1000)} min"
            diff < 24 * 60 * 60 * 1000 -> formatMessageTime(timestamp)
            diff < 48 * 60 * 60 * 1000 -> "Yesterday"
            else -> listTime.format(Date(timestamp))
        }
    }

    private fun snippet(body: String): String =
        if (body.length > 50) body.take(47) + "..." else body

    private suspend fun ensureThread(context: Context, title: String): ThreadEntity {
        val threadDao = AppDatabase.getInstance(context).threadDao()
        val threadId = threadIdFor(title)
        val existing = threadDao.getThreadById(threadId)
        if (existing != null) return existing
        val fresh = ThreadEntity(
            id = threadId,
            senderName = title,
            phoneNumber = title,
            avatarColorHex = LUXY_COLOR,
            unreadCount = 0,
            isPinned = false,
            isArchived = false,
            isServiceSender = true,
            category = "Transactions",
            lastMessageTimestamp = System.currentTimeMillis(),
            lastMessageSnippet = "",
            formattedTime = "Just now"
        )
        threadDao.insertOrUpdate(fresh)
        return fresh
    }

    /**
     * Stores new feed rows in Room; returns exactly the messages that should
     * buzz now (new since the last poll AND unread server-side AND not the
     * first-run seed batch). Runs inside the poller's IO coroutine.
     */
    suspend fun ingest(context: Context, feed: List<LuxyFeedMessage>): List<LuxyFeedMessage> {
        if (feed.isEmpty()) return emptyList()

        val database = AppDatabase.getInstance(context)
        val threadDao = database.threadDao()
        val messageDao = database.messageDao()

        val firstRun = !LuxyLink.isSeeded(context)
        val seen = LuxyLink.seenIds(context).toMutableSet()

        val fresh = feed.filter { it.id !in seen }
        if (fresh.isEmpty()) return emptyList()

        val buzz: MutableList<LuxyFeedMessage> = mutableListOf()

        for ((title, messages) in fresh.groupBy { it.title }) {
            val threadId = threadIdFor(title)
            ensureThread(context, title)
            val existingThread = threadDao.getThreadById(threadId)

            val sorted = messages.sortedBy { it.atMs }
            for (msg in sorted) {
                messageDao.insertMessage(
                    MessageEntity(
                        id = msg.id,
                        threadId = threadId,
                        content = msg.body,
                        timestamp = msg.atMs,
                        formattedTime = formatMessageTime(msg.atMs),
                        isIncoming = true,
                        status = "READ",
                        isStarred = false
                    )
                )
            }

            // New unread receipts raise the badge only after seeding (first run silent).
            val newUnread = if (firstRun) 0 else sorted.count { !it.read }
            val latest = sorted.last()
            if (existingThread != null) {
                threadDao.insertOrUpdate(
                    existingThread.copy(
                        unreadCount = existingThread.unreadCount + newUnread,
                        lastMessageTimestamp = latest.atMs,
                        lastMessageSnippet = snippet(latest.body),
                        formattedTime = formatListTime(latest.atMs, System.currentTimeMillis())
                    )
                )
            }
            if (!firstRun) {
                buzz.addAll(sorted.filter { !it.read })
            }
        }

        // Dedupe window: remember everything the feed currently returns.
        val ids = feed.map { it.id }.toMutableSet()
        while (ids.size > 500) {
            ids.remove(ids.first())
        }
        LuxyLink.saveSeenIds(context, ids)
        if (firstRun) LuxyLink.setSeeded(context)

        return buzz
    }
}
