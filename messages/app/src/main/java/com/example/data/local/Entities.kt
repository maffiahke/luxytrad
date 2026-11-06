package com.example.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "threads")
data class ThreadEntity(
    @PrimaryKey val id: String,
    val senderName: String,
    val phoneNumber: String,
    val avatarColorHex: String,
    val unreadCount: Int,
    val isPinned: Boolean = false,
    val isArchived: Boolean = false,
    val isServiceSender: Boolean = false,
    val category: String = "All",
    val lastMessageTimestamp: Long,
    val lastMessageSnippet: String,
    val formattedTime: String
)

@Entity(tableName = "messages")
data class MessageEntity(
    @PrimaryKey val id: String,
    val threadId: String,
    val content: String,
    val timestamp: Long,
    val formattedTime: String,
    val isIncoming: Boolean,
    val status: String = "READ",
    val isStarred: Boolean = false
)
