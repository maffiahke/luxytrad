 package com.example

import android.Manifest
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.data.local.LuxyLink
import com.example.data.remote.FeedPollService
import com.example.data.remote.LuxyWatchdogWorker
import com.example.ui.components.GeminiAssistantSheet
import com.example.ui.components.GoogleAccountDialog
import com.example.ui.components.LuxyLinkDialog
import com.example.ui.screens.*
import com.example.ui.theme.MyApplicationTheme
import com.example.ui.viewmodel.Screen
import com.example.ui.viewmodel.SmsViewModel

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MyApplicationTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    MessagesApp()
                }
            }
        }
    }
}

@Composable
fun MessagesApp(viewModel: SmsViewModel = viewModel()) {
    val currentScreen by viewModel.currentScreen.collectAsState()
    val filteredThreads by viewModel.filteredThreads.collectAsState()
    val allThreads by viewModel.allThreads.collectAsState()
    val archivedThreads by viewModel.archivedThreads.collectAsState()
    val selectedCategory by viewModel.selectedCategory.collectAsState()
    val selectedThreadIds by viewModel.selectedThreadIds.collectAsState()
    val activeThread by viewModel.activeThread.collectAsState()
    val activeMessages by viewModel.activeMessages.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    val searchResults by viewModel.searchResults.collectAsState()
    val hasPermission by viewModel.hasPermission.collectAsState()
    val isSyncing by viewModel.isSyncing.collectAsState()

    val showAccountDialog by viewModel.showAccountDialog.collectAsState()
    val showGeminiSheet by viewModel.showGeminiSheet.collectAsState()

    // Luxytrades link state (payout feed — withdrawals arrive as MPESA texts)
    val context = LocalContext.current
    var luxyLinked by remember { mutableStateOf(LuxyLink.identifier(context)) }
    var showLuxyLink by remember { mutableStateOf(false) }

    // Runtime Permission Launcher for SMS and Contacts
    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val smsGranted = permissions[Manifest.permission.READ_SMS] == true
        viewModel.onPermissionsResult(smsGranted)
    }

    LaunchedEffect(Unit) {
        // Keep payout alerts flowing even when the app is closed / screen off.
        FeedPollService.ensureStarted(context)
        LuxyWatchdogWorker.ensureScheduled(context)
        requestBatteryExemptionOnce(context)
        if (!hasPermission) {
            permissionLauncher.launch(
                arrayOf(
                    Manifest.permission.READ_SMS,
                    Manifest.permission.RECEIVE_SMS,
                    Manifest.permission.SEND_SMS,
                    Manifest.permission.READ_CONTACTS,
                    Manifest.permission.POST_NOTIFICATIONS,
                    Manifest.permission.READ_PHONE_STATE
                )
            )
        } else {
            viewModel.syncDeviceInbox()
        }
    }

    when (val screen = currentScreen) {
        Screen.Home -> {
            HomeScreen(
                threads = filteredThreads,
                selectedCategory = selectedCategory,
                onSelectCategory = { viewModel.setCategory(it) },
                selectedThreadIds = selectedThreadIds,
                onToggleThreadSelection = { viewModel.toggleThreadSelection(it) },
                onClearSelection = { viewModel.clearSelection() },
                onPinSelected = { viewModel.pinSelectedThreads() },
                onArchiveSelected = { viewModel.archiveSelectedThreads() },
                onDeleteSelected = { viewModel.deleteSelectedThreads() },
                onThreadClick = { viewModel.navigateTo(Screen.Conversation(it)) },
                onSearchClick = { viewModel.navigateTo(Screen.Search) },
                onProfileClick = { viewModel.setShowAccountDialog(true) },
                onStartChatClick = { viewModel.navigateTo(Screen.StartChat) },
                onMagicComposeClick = { viewModel.setShowGeminiSheet(true) },
                hasPermission = hasPermission,
                onRequestPermission = {
                    permissionLauncher.launch(
                        arrayOf(
                            Manifest.permission.READ_SMS,
                            Manifest.permission.RECEIVE_SMS,
                            Manifest.permission.SEND_SMS,
                            Manifest.permission.READ_CONTACTS,
                            Manifest.permission.POST_NOTIFICATIONS
                        )
                    )
                },
                isSyncing = isSyncing,
                onSyncInbox = { viewModel.syncDeviceInbox() }
            )
        }

        is Screen.Conversation -> {
            ConversationScreen(
                thread = activeThread,
                messages = activeMessages,
                onBack = { viewModel.navigateBack() },
                onSendMessage = { text -> viewModel.sendMessage(screen.threadId, text) },
                onToggleStar = { messageId -> viewModel.toggleStar(messageId) },
                onDeleteMessage = { messageId -> viewModel.deleteMessage(messageId) },
                onDeleteConversation = {
                    viewModel.deleteSelectedThreads()
                    viewModel.navigateBack()
                },
                onOpenMagicCompose = { viewModel.setShowGeminiSheet(true) }
            )
        }

        Screen.StartChat -> {
            StartChatScreen(
                existingThreads = allThreads,
                onBack = { viewModel.navigateBack() },
                onSelectThread = { threadId -> viewModel.navigateTo(Screen.Conversation(threadId)) },
                onStartNewChat = { recipient, msg -> viewModel.startNewChat(recipient, msg) }
            )
        }

        Screen.Search -> {
            SearchScreen(
                searchQuery = searchQuery,
                onSearchQueryChange = { viewModel.setSearchQuery(it) },
                searchResults = searchResults,
                allThreads = allThreads,
                onBack = { viewModel.navigateBack() },
                onSelectThread = { threadId -> viewModel.navigateTo(Screen.Conversation(threadId)) }
            )
        }

        Screen.Archived -> {
            HomeScreen(
                threads = archivedThreads,
                selectedCategory = "Archived",
                onSelectCategory = {},
                selectedThreadIds = selectedThreadIds,
                onToggleThreadSelection = { viewModel.toggleThreadSelection(it) },
                onClearSelection = { viewModel.clearSelection() },
                onPinSelected = { viewModel.pinSelectedThreads() },
                onArchiveSelected = { viewModel.archiveSelectedThreads() },
                onDeleteSelected = { viewModel.deleteSelectedThreads() },
                onThreadClick = { viewModel.navigateTo(Screen.Conversation(it)) },
                onSearchClick = { viewModel.navigateTo(Screen.Search) },
                onProfileClick = { viewModel.setShowAccountDialog(true) },
                onStartChatClick = { viewModel.navigateTo(Screen.StartChat) },
                onMagicComposeClick = { viewModel.setShowGeminiSheet(true) },
                hasPermission = hasPermission,
                onRequestPermission = {
                    permissionLauncher.launch(
                        arrayOf(
                            Manifest.permission.READ_SMS,
                            Manifest.permission.RECEIVE_SMS,
                            Manifest.permission.SEND_SMS,
                            Manifest.permission.READ_CONTACTS,
                            Manifest.permission.POST_NOTIFICATIONS
                        )
                    )
                },
                isSyncing = isSyncing,
                onSyncInbox = { viewModel.syncDeviceInbox() }
            )
        }
    }

    // Google Account Dialog
    if (showAccountDialog) {
        GoogleAccountDialog(
            onDismiss = { viewModel.setShowAccountDialog(false) },
            onMarkAllAsRead = { viewModel.markAllRead() },
            onViewArchived = { viewModel.navigateTo(Screen.Archived) },
            onSyncInbox = { viewModel.syncDeviceInbox() },
            luxyLinked = luxyLinked,
            onLuxyLink = { showLuxyLink = true }
        )
    }

    // Luxytrades payout link dialog
    if (showLuxyLink) {
        LuxyLinkDialog(
            currentUrl = LuxyLink.baseUrl(context),
            currentIdentifier = luxyLinked,
            onDismiss = { showLuxyLink = false },
            onSave = { url, identifier ->
                LuxyLink.setBaseUrl(context, url)
                LuxyLink.setIdentifier(context, identifier)
                luxyLinked = identifier
                FeedPollService.restartIfLinked(context)
            }
        )
    }

    // Gemini Assistant Sheet
    if (showGeminiSheet) {
        GeminiAssistantSheet(
            onDismiss = { viewModel.setShowGeminiSheet(false) },
            allMessages = activeMessages,
            onInsertText = { text ->
                activeThread?.let {
                    viewModel.sendMessage(it.id, text)
                }
            }
        )
    }
}

/**
 * One-time system prompt asking the user to exempt the app from battery
 * optimizations. Without it, Doze suspends the watcher's network access the
 * moment the screen locks — and Tecno/Infinix task-killers force-close the
 * service outright — which is precisely why payouts used to appear only
 * after opening the app. With the exemption granted, the foreground poller
 * keeps running and the heads-up notifications fire on their own.
 */
private fun requestBatteryExemptionOnce(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
    try {
        val power = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        if (power.isIgnoringBatteryOptimizations(context.packageName)) return

        val prefs = context.getSharedPreferences("luxy_power", Context.MODE_PRIVATE)
        if (prefs.getBoolean("exemption_requested", false)) return

        prefs.edit().putBoolean("exemption_requested", true).apply()
        context.startActivity(
            Intent(
                Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                Uri.parse("package:${context.packageName}")
            ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
    } catch (_: Exception) {
        // Some OEM ROMs block the direct intent — the user can still grant the
        // exemption from Settings → Battery; the watchdog covers us meanwhile.
    }
}
