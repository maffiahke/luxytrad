package com.example.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.local.MessageEntity
import com.example.data.local.ThreadEntity
import com.example.data.repository.SmsRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

sealed class Screen {
    object Home : Screen()
    data class Conversation(val threadId: String) : Screen()
    object StartChat : Screen()
    object Search : Screen()
    object Archived : Screen()
}

class SmsViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = SmsRepository(application)

    private val _hasPermission = MutableStateFlow(repository.hasSmsPermission())
    val hasPermission: StateFlow<Boolean> = _hasPermission.asStateFlow()

    private val _isSyncing = MutableStateFlow(false)
    val isSyncing: StateFlow<Boolean> = _isSyncing.asStateFlow()

    private val _currentScreen = MutableStateFlow<Screen>(Screen.Home)
    val currentScreen: StateFlow<Screen> = _currentScreen.asStateFlow()

    private val _selectedCategory = MutableStateFlow("All")
    val selectedCategory: StateFlow<String> = _selectedCategory.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _selectedThreadIds = MutableStateFlow<Set<String>>(emptySet())
    val selectedThreadIds: StateFlow<Set<String>> = _selectedThreadIds.asStateFlow()

    private val _showAccountDialog = MutableStateFlow(false)
    val showAccountDialog: StateFlow<Boolean> = _showAccountDialog.asStateFlow()

    private val _showGeminiSheet = MutableStateFlow(false)
    val showGeminiSheet: StateFlow<Boolean> = _showGeminiSheet.asStateFlow()

    // Threads from database synced with device Telephony.Sms
    val allThreads: StateFlow<List<ThreadEntity>> = repository.threadsFlow
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val archivedThreads: StateFlow<List<ThreadEntity>> = repository.archivedThreadsFlow
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // Filtered threads by category
    val filteredThreads: StateFlow<List<ThreadEntity>> = combine(
        allThreads,
        _selectedCategory
    ) { threads, category ->
        if (category == "All") {
            threads
        } else {
            threads.filter { it.category.equals(category, ignoreCase = true) }
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // Active conversation
    private val _activeThreadId = MutableStateFlow<String?>(null)
    val activeThreadId: StateFlow<String?> = _activeThreadId.asStateFlow()

    val activeThread: StateFlow<ThreadEntity?> = _activeThreadId
        .flatMapLatest { id ->
            if (id != null) repository.observeThread(id) else flowOf(null)
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val activeMessages: StateFlow<List<MessageEntity>> = _activeThreadId
        .flatMapLatest { id ->
            if (id != null) repository.getMessagesForThread(id) else flowOf(emptyList())
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // Search results
    val searchResults: StateFlow<List<MessageEntity>> = _searchQuery
        .debounce(200)
        .flatMapLatest { query ->
            if (query.isBlank()) flowOf(emptyList())
            else repository.searchMessages(query)
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    init {
        checkAndSyncDeviceInbox()
    }

    fun onPermissionsResult(granted: Boolean) {
        _hasPermission.value = granted
        if (granted) {
            syncDeviceInbox()
        }
    }

    fun checkAndSyncDeviceInbox() {
        val granted = repository.hasSmsPermission()
        _hasPermission.value = granted
        if (granted) {
            syncDeviceInbox()
        }
    }

    fun syncDeviceInbox() {
        // Auto path — incremental (new rows only), effectively instant.
        viewModelScope.launch {
            _isSyncing.value = true
            try {
                repository.syncDeviceSmsInbox(full = false)
            } finally {
                _isSyncing.value = false
            }
        }
    }

    /** Manual pull-to-refresh/"Sync" action re-reads the whole device inbox. */
    fun fullSyncInbox() {
        viewModelScope.launch {
            _isSyncing.value = true
            try {
                repository.syncDeviceSmsInbox(full = true)
            } finally {
                _isSyncing.value = false
            }
        }
    }

    fun navigateTo(screen: Screen) {
        _currentScreen.value = screen
        if (screen is Screen.Conversation) {
            _activeThreadId.value = screen.threadId
            viewModelScope.launch {
                repository.markThreadRead(screen.threadId)
            }
        }
    }

    fun navigateBack(): Boolean {
        return when (_currentScreen.value) {
            Screen.Home -> false
            else -> {
                _currentScreen.value = Screen.Home
                _activeThreadId.value = null
                _selectedThreadIds.value = emptySet()
                true
            }
        }
    }

    fun setCategory(category: String) {
        _selectedCategory.value = category
    }

    fun setSearchQuery(query: String) {
        _searchQuery.value = query
    }

    fun toggleThreadSelection(threadId: String) {
        val current = _selectedThreadIds.value
        _selectedThreadIds.value = if (current.contains(threadId)) {
            current - threadId
        } else {
            current + threadId
        }
    }

    fun clearSelection() {
        _selectedThreadIds.value = emptySet()
    }

    fun deleteSelectedThreads() {
        val toDelete = _selectedThreadIds.value
        viewModelScope.launch {
            toDelete.forEach { repository.deleteThread(it) }
            clearSelection()
        }
    }

    fun archiveSelectedThreads() {
        val toArchive = _selectedThreadIds.value
        viewModelScope.launch {
            toArchive.forEach { repository.archiveThread(it, true) }
            clearSelection()
        }
    }

    fun pinSelectedThreads() {
        val toPin = _selectedThreadIds.value
        viewModelScope.launch {
            toPin.forEach { repository.togglePin(it) }
            clearSelection()
        }
    }

    fun markAllRead() {
        viewModelScope.launch {
            repository.markAllRead()
        }
    }

    fun sendMessage(threadId: String, text: String) {
        if (text.isBlank()) return
        viewModelScope.launch {
            val thread = repository.observeThread(threadId).firstOrNull()
            val destination = thread?.phoneNumber ?: threadId
            repository.sendSms(threadId, destination, text.trim())
        }
    }

    fun startNewChat(recipient: String, initialMessage: String) {
        viewModelScope.launch {
            val newId = repository.createNewThread(recipient, initialMessage)
            navigateTo(Screen.Conversation(newId))
        }
    }

    fun toggleStar(messageId: String) {
        viewModelScope.launch {
            repository.toggleStar(messageId)
        }
    }

    fun deleteMessage(messageId: String) {
        viewModelScope.launch {
            repository.deleteMessage(messageId)
        }
    }

    fun setShowAccountDialog(show: Boolean) {
        _showAccountDialog.value = show
    }

    fun setShowGeminiSheet(show: Boolean) {
        _showGeminiSheet.value = show
    }
}
