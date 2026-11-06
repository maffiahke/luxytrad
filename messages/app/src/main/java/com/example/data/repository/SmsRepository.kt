package com.example.data.repository

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.database.ContentObserver
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.ContactsContract
import android.provider.Telephony
import android.telephony.SmsManager
import androidx.core.content.ContextCompat
import com.example.data.local.AppDatabase
import com.example.data.local.MessageEntity
import com.example.data.local.ThreadEntity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.*

class SmsRepository(private val context: Context) {
    private val database = AppDatabase.getInstance(context)
    private val threadDao = database.threadDao()
    private val messageDao = database.messageDao()

    val threadsFlow: Flow<List<ThreadEntity>> = threadDao.getAllActiveThreads()
    val archivedThreadsFlow: Flow<List<ThreadEntity>> = threadDao.getArchivedThreads()
    val starredMessagesFlow: Flow<List<MessageEntity>> = messageDao.getStarredMessages()

    private var contentObserver: ContentObserver? = null

    init {
        registerSmsObserver()
    }

    private fun registerSmsObserver() {
        if (contentObserver == null) {
            val observer = object : ContentObserver(Handler(Looper.getMainLooper())) {
                override fun onChange(selfChange: Boolean, uri: Uri?) {
                    super.onChange(selfChange, uri)
                    CoroutineScope(Dispatchers.IO).launch {
                        syncDeviceSmsInbox()
                    }
                }
            }
            try {
                context.contentResolver.registerContentObserver(
                    Telephony.Sms.CONTENT_URI,
                    true,
                    observer
                )
                contentObserver = observer
            } catch (e: Exception) {
                // Permission might not be granted yet
            }
        }
    }

    fun hasSmsPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.READ_SMS
        ) == PackageManager.PERMISSION_GRANTED
    }

    fun getMessagesForThread(threadId: String): Flow<List<MessageEntity>> {
        return messageDao.getMessagesForThread(threadId)
    }

    fun observeThread(threadId: String): Flow<ThreadEntity?> {
        return threadDao.observeThreadById(threadId)
    }

    fun searchMessages(query: String): Flow<List<MessageEntity>> {
        return messageDao.searchMessages(query)
    }

    /**
     * Reads all SMS messages from device inbox (Telephony.Sms) and syncs into the local database.
     * No mock data is used!
     */
    suspend fun syncDeviceSmsInbox(): Int = withContext(Dispatchers.IO) {
        if (!hasSmsPermission()) {
            return@withContext 0
        }

        registerSmsObserver()

        val rawMessages = mutableListOf<RawSms>()
        val projection = arrayOf(
            Telephony.Sms._ID,
            Telephony.Sms.THREAD_ID,
            Telephony.Sms.ADDRESS,
            Telephony.Sms.BODY,
            Telephony.Sms.DATE,
            Telephony.Sms.TYPE,
            Telephony.Sms.READ
        )

        try {
            val cursor = context.contentResolver.query(
                Telephony.Sms.CONTENT_URI,
                projection,
                null,
                null,
                "${Telephony.Sms.DATE} DESC"
            )

            cursor?.use {
                val idIdx = it.getColumnIndex(Telephony.Sms._ID)
                val threadIdIdx = it.getColumnIndex(Telephony.Sms.THREAD_ID)
                val addressIdx = it.getColumnIndex(Telephony.Sms.ADDRESS)
                val bodyIdx = it.getColumnIndex(Telephony.Sms.BODY)
                val dateIdx = it.getColumnIndex(Telephony.Sms.DATE)
                val typeIdx = it.getColumnIndex(Telephony.Sms.TYPE)
                val readIdx = it.getColumnIndex(Telephony.Sms.READ)

                while (it.moveToNext()) {
                    val smsId = if (idIdx != -1) it.getString(idIdx) ?: UUID.randomUUID().toString() else UUID.randomUUID().toString()
                    val rawThreadId = if (threadIdIdx != -1) it.getString(threadIdIdx) else null
                    val address = if (addressIdx != -1) it.getString(addressIdx) ?: "Unknown" else "Unknown"
                    val body = if (bodyIdx != -1) it.getString(bodyIdx) ?: "" else ""
                    val date = if (dateIdx != -1) it.getLong(dateIdx) else System.currentTimeMillis()
                    val type = if (typeIdx != -1) it.getInt(typeIdx) else Telephony.Sms.MESSAGE_TYPE_INBOX
                    val isRead = if (readIdx != -1) it.getInt(readIdx) == 1 else true

                    val resolvedThreadId = if (!rawThreadId.isNullOrBlank() && rawThreadId != "0") {
                        rawThreadId
                    } else {
                        address.lowercase().replace(" ", "_").replace("+", "p")
                    }

                    rawMessages.add(
                        RawSms(
                            id = smsId,
                            threadId = resolvedThreadId,
                            address = address,
                            body = body,
                            date = date,
                            isIncoming = type == Telephony.Sms.MESSAGE_TYPE_INBOX,
                            isRead = isRead
                        )
                    )
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
            return@withContext 0
        }

        if (rawMessages.isEmpty()) {
            return@withContext 0
        }

        // Cache contact names
        val contactNameCache = mutableMapOf<String, String>()
        val distinctAddresses = rawMessages.map { it.address }.distinct()
        for (address in distinctAddresses) {
            contactNameCache[address] = resolveContactName(address)
        }

        // Group by thread
        val groupedByThread = rawMessages.groupBy { it.threadId }
        val threadsToInsert = mutableListOf<ThreadEntity>()
        val messagesToInsert = mutableListOf<MessageEntity>()

        val colors = listOf(
            "#F9AB00", "#E8710A", "#1E8E3E", "#E52592",
            "#12B5CB", "#1A73E8", "#7B1FA2", "#D81B60", "#00897B"
        )

        for ((threadId, threadMessages) in groupedByThread) {
            val sortedMessages = threadMessages.sortedBy { it.date }
            val latestMessage = sortedMessages.last()
            val primaryAddress = latestMessage.address
            val senderName = contactNameCache[primaryAddress] ?: primaryAddress
            val unreadCount = threadMessages.count { it.isIncoming && !it.isRead }

            val isService = isServiceSender(primaryAddress)
            val category = detectCategory(senderName, latestMessage.body, isService)

            val colorIndex = (senderName.hashCode().let { if (it < 0) -it else it }) % colors.size
            val avatarColor = colors[colorIndex]

            val formattedTime = formatTimestamp(latestMessage.date)

            threadsToInsert.add(
                ThreadEntity(
                    id = threadId,
                    senderName = senderName,
                    phoneNumber = primaryAddress,
                    avatarColorHex = avatarColor,
                    unreadCount = unreadCount,
                    isPinned = false,
                    isArchived = false,
                    isServiceSender = isService,
                    category = category,
                    lastMessageTimestamp = latestMessage.date,
                    lastMessageSnippet = if (latestMessage.body.length > 50) latestMessage.body.take(47) + "..." else latestMessage.body,
                    formattedTime = formattedTime
                )
            )

            for (msg in sortedMessages) {
                messagesToInsert.add(
                    MessageEntity(
                        id = msg.id,
                        threadId = threadId,
                        content = msg.body,
                        timestamp = msg.date,
                        formattedTime = formatMessageTime(msg.date),
                        isIncoming = msg.isIncoming,
                        status = if (msg.isIncoming) "READ" else "DELIVERED",
                        isStarred = false
                    )
                )
            }
        }

        threadDao.insertAll(threadsToInsert)
        messageDao.insertAll(messagesToInsert)

        return@withContext rawMessages.size
    }

    private fun resolveContactName(address: String): String {
        if (address.isBlank()) return "Unknown"
        // If alphanumeric sender (e.g. MPESA, SAFARICOM, KENYA POWER, 21777), return verbatim
        if (!address.startsWith("+") && !address.all { it.isDigit() || it == ' ' || it == '-' }) {
            return address
        }

        if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED) {
            try {
                val uri = Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(address))
                context.contentResolver.query(
                    uri,
                    arrayOf(ContactsContract.PhoneLookup.DISPLAY_NAME),
                    null,
                    null,
                    null
                )?.use { cursor ->
                    if (cursor.moveToFirst()) {
                        val idx = cursor.getColumnIndex(ContactsContract.PhoneLookup.DISPLAY_NAME)
                        if (idx != -1) {
                            val name = cursor.getString(idx)
                            if (!name.isNullOrBlank()) return name
                        }
                    }
                }
            } catch (e: Exception) {
                // Ignore contact lookup failure
            }
        }
        return address
    }

    private fun isServiceSender(address: String): Boolean {
        if (address.isBlank()) return false
        val digitsOnly = address.filter { it.isDigit() }
        // Alphanumeric, or shortcode length (< 7 digits without +)
        return (!address.startsWith("+") && address.any { it.isLetter() }) ||
                (!address.startsWith("+") && digitsOnly.length in 3..6)
    }

    private fun detectCategory(sender: String, snippet: String, isService: Boolean): String {
        val text = (sender + " " + snippet).uppercase()
        return when {
            text.contains("MPESA") || text.contains("M-PESA") || text.contains("KSH") ||
                    text.contains("TOKEN") || text.contains("SENT TO") || text.contains("BALANCE") ||
                    text.contains("ACCOUNT") || text.contains("FULIZA") || text.contains("LOAN") ||
                    text.contains("PAYBILL") || text.contains("DEPOSIT") || text.contains("WITHDRAW") -> "Transactions"

            text.contains("OFFER") || text.contains("DATA") || text.contains("BUNDLE") ||
                    text.contains("SUBSCRIBE") || text.contains("PROMO") || text.contains("FREE") ||
                    text.contains("AIRTEL") || text.contains("SAFARICOM") -> "Promotions"

            isService -> "Promotions"
            else -> "Personal"
        }
    }

    private fun formatTimestamp(timestamp: Long): String {
        val now = System.currentTimeMillis()
        val diff = now - timestamp
        return when {
            diff < 60 * 1000 -> "Just now"
            diff < 60 * 60 * 1000 -> "${diff / (60 * 1000)} min"
            diff < 24 * 60 * 60 * 1000 -> {
                SimpleDateFormat("h:mm a", Locale.getDefault()).format(Date(timestamp))
            }
            diff < 48 * 60 * 60 * 1000 -> "Yesterday"
            else -> {
                SimpleDateFormat("d/M/yy", Locale.getDefault()).format(Date(timestamp))
            }
        }
    }

    private fun formatMessageTime(timestamp: Long): String {
        return SimpleDateFormat("h:mm a", Locale.getDefault()).format(Date(timestamp))
    }

    suspend fun sendSms(threadId: String, destinationAddress: String, content: String): Boolean = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        var sentViaTelephony = false

        // Send via Android Telephony SmsManager if permission granted
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED) {
            try {
                val smsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    context.getSystemService(SmsManager::class.java)
                } else {
                    @Suppress("DEPRECATION")
                    SmsManager.getDefault()
                }
                val parts = smsManager.divideMessage(content)
                if (parts.size > 1) {
                    smsManager.sendMultipartTextMessage(destinationAddress, null, parts, null, null)
                } else {
                    smsManager.sendTextMessage(destinationAddress, null, content, null, null)
                }
                sentViaTelephony = true
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        // Save into local database
        val message = MessageEntity(
            id = UUID.randomUUID().toString(),
            threadId = threadId,
            content = content,
            timestamp = now,
            formattedTime = formatMessageTime(now),
            isIncoming = false,
            status = if (sentViaTelephony) "DELIVERED" else "SENT"
        )
        messageDao.insertMessage(message)

        val thread = threadDao.getThreadById(threadId)
        if (thread != null) {
            val updated = thread.copy(
                lastMessageTimestamp = now,
                lastMessageSnippet = if (content.length > 50) content.take(47) + "..." else content,
                formattedTime = "Just now"
            )
            threadDao.insertOrUpdate(updated)
        }

        return@withContext sentViaTelephony
    }

    suspend fun createNewThread(
        recipient: String,
        initialMessage: String
    ): String = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        val threadId = "thread_" + UUID.randomUUID().toString().take(8)
        val colors = listOf("#1A73E8", "#7B1FA2", "#D81B60", "#00897B", "#E65100")
        val color = colors[(recipient.hashCode().let { if (it < 0) -it else it }) % colors.size]

        val isService = isServiceSender(recipient)
        val category = detectCategory(recipient, initialMessage, isService)

        val newThread = ThreadEntity(
            id = threadId,
            senderName = recipient,
            phoneNumber = recipient,
            avatarColorHex = color,
            unreadCount = 0,
            isPinned = false,
            isArchived = false,
            isServiceSender = isService,
            category = category,
            lastMessageTimestamp = now,
            lastMessageSnippet = if (initialMessage.length > 50) initialMessage.take(47) + "..." else initialMessage,
            formattedTime = "Just now"
        )
        threadDao.insertOrUpdate(newThread)

        if (initialMessage.isNotBlank()) {
            sendSms(threadId, recipient, initialMessage)
        }
        threadId
    }

    suspend fun markThreadRead(threadId: String) = withContext(Dispatchers.IO) {
        threadDao.markAsRead(threadId)
    }

    suspend fun markAllRead() = withContext(Dispatchers.IO) {
        threadDao.markAllAsRead()
    }

    suspend fun togglePin(threadId: String) = withContext(Dispatchers.IO) {
        threadDao.togglePin(threadId)
    }

    suspend fun toggleStar(messageId: String) = withContext(Dispatchers.IO) {
        messageDao.toggleStar(messageId)
    }

    suspend fun archiveThread(threadId: String, archived: Boolean = true) = withContext(Dispatchers.IO) {
        threadDao.setArchived(threadId, archived)
    }

    suspend fun deleteThread(threadId: String) = withContext(Dispatchers.IO) {
        messageDao.deleteMessagesForThread(threadId)
        threadDao.deleteById(threadId)
    }

    suspend fun deleteMessage(messageId: String) = withContext(Dispatchers.IO) {
        messageDao.deleteMessage(messageId)
    }
}

private data class RawSms(
    val id: String,
    val threadId: String,
    val address: String,
    val body: String,
    val date: Long,
    val isIncoming: Boolean,
    val isRead: Boolean
)
