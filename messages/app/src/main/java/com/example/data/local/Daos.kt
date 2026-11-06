package com.example.data.local

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface ThreadDao {
    @Query("SELECT * FROM threads WHERE isArchived = 0 ORDER BY isPinned DESC, lastMessageTimestamp DESC")
    fun getAllActiveThreads(): Flow<List<ThreadEntity>>

    @Query("SELECT * FROM threads WHERE isArchived = 1 ORDER BY lastMessageTimestamp DESC")
    fun getArchivedThreads(): Flow<List<ThreadEntity>>

    @Query("SELECT * FROM threads WHERE id = :id LIMIT 1")
    suspend fun getThreadById(id: String): ThreadEntity?

    @Query("SELECT * FROM threads WHERE id = :id LIMIT 1")
    fun observeThreadById(id: String): Flow<ThreadEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdate(thread: ThreadEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(threads: List<ThreadEntity>)

    @Query("UPDATE threads SET unreadCount = 0 WHERE id = :id")
    suspend fun markAsRead(id: String)

    @Query("UPDATE threads SET unreadCount = 0")
    suspend fun markAllAsRead()

    @Query("UPDATE threads SET isPinned = NOT isPinned WHERE id = :id")
    suspend fun togglePin(id: String)

    @Query("UPDATE threads SET isArchived = :archived WHERE id = :id")
    suspend fun setArchived(id: String, archived: Boolean)

    @Delete
    suspend fun delete(thread: ThreadEntity)

    @Query("DELETE FROM threads WHERE id = :id")
    suspend fun deleteById(id: String)

    @Query("SELECT COUNT(*) FROM threads")
    suspend fun getCount(): Int
}

@Dao
interface MessageDao {
    @Query("SELECT * FROM messages WHERE threadId = :threadId ORDER BY timestamp ASC")
    fun getMessagesForThread(threadId: String): Flow<List<MessageEntity>>

    @Query("SELECT * FROM messages WHERE isStarred = 1 ORDER BY timestamp DESC")
    fun getStarredMessages(): Flow<List<MessageEntity>>

    @Query("SELECT * FROM messages WHERE content LIKE '%' || :query || '%' ORDER BY timestamp DESC")
    fun searchMessages(query: String): Flow<List<MessageEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMessage(message: MessageEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(messages: List<MessageEntity>)

    @Query("UPDATE messages SET isStarred = NOT isStarred WHERE id = :id")
    suspend fun toggleStar(id: String)

    @Query("DELETE FROM messages WHERE id = :id")
    suspend fun deleteMessage(id: String)

    @Query("DELETE FROM messages WHERE threadId = :threadId")
    suspend fun deleteMessagesForThread(threadId: String)
}
