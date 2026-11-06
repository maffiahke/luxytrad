package com.example.data.model

data class ThreadItemData(
    val id: String,
    val senderName: String,
    val phoneNumber: String,
    val avatarColorHex: String,
    val unreadCount: Int,
    val isPinned: Boolean,
    val isArchived: Boolean,
    val isServiceSender: Boolean,
    val category: String, // "All", "Transactions", "Personal", "Promotions", "OTPs"
    val lastMessageTimestamp: Long,
    val lastMessageSnippet: String,
    val formattedTime: String
)

data class MessageItemData(
    val id: String,
    val threadId: String,
    val content: String,
    val timestamp: Long,
    val formattedTime: String,
    val isIncoming: Boolean,
    val status: String, // "SENT", "DELIVERED", "READ"
    val isStarred: Boolean
)
