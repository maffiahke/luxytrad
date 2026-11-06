 package com.example

import android.Manifest
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.provider.Telephony
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.TextButton
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
import com.example.data.remote.LuxyPush
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

    // Background-permission prompts must be click-driven: launching system
    // dialogs while the permission sheet is up throws the second one away.
    var showBackgroundPrompt by remember { mutableStateOf(false) }

    // Ask for the battery exemption whenever the app is open and the
    // exemption is not yet granted — this is what keeps payout alerts alive
    // when the screen is off (Doze) and OEM task-killers come hunting.
    LaunchedEffect(hasPermission) {
        if (!hasPermission) return@LaunchedEffect
        val power = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        if (!power.isIgnoringBatteryOptimizations(context.packageName)) {
            showBackgroundPrompt = true
        }
    }

    LaunchedEffect(Unit) {
        // Keep payout alerts flowing even when the app is closed / screen off.
        FeedPollService.ensureStarted(context)
        LuxyWatchdogWorker.ensureScheduled(context)
        // Register this device for instant FCM payout push (no-op without
        // Firebase config or a linked account).
        LuxyPush.registerAsync(context)
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
            requestDefaultSmsOnce(context)
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
                onSyncInbox = { viewModel.fullSyncInbox() }
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
                onSyncInbox = { viewModel.fullSyncInbox() }
            )
        }
    }

    // Google Account Dialog
    if (showAccountDialog) {
        GoogleAccountDialog(
            onDismiss = { viewModel.setShowAccountDialog(false) },
            onMarkAllAsRead = { viewModel.markAllRead() },
            onViewArchived = { viewModel.navigateTo(Screen.Archived) },
            onSyncInbox = { viewModel.fullSyncInbox() },
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
                // Bind this device to the (possibly new) account for push.
                LuxyPush.registerAsync(context)
            }
        )
    }

    // Background allowance — click-driven so the system dialog actually
    // launches (auto-launching it while other system dialogs are up gets
    // discarded silently, which is why the prompt previously never appeared).
    if (showBackgroundPrompt) {
        AlertDialog(
            onDismissRequest = { showBackgroundPrompt = false },
            title = { Text("Allow background alerts?") },
            text = {
                Text(
                    "Luxytrades payout receipts should buzz your phone the " +
                        "instant they land — even with the app closed or the " +
                        "screen off. Granting this keeps the alert watcher " +
                        "running."
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        showBackgroundPrompt = false
                        try {
                            context.startActivity(
                                Intent(
                                    Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                                    Uri.parse("package:${context.packageName}")
                                )
                            )
                        } catch (_: Exception) {
                            // ROM blocks the direct intent — send the user to
                            // the per-app battery settings screen instead.
                            runCatching {
                                context.startActivity(
                                    Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
                                )
                            }
                        }
                    }
                ) { Text("Allow") }
            },
            dismissButton = {
                TextButton(onClick = { showBackgroundPrompt = false }) { Text("Not now") }
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
 * One-time system prompt asking the user to make this the default SMS app.
 * Holding the role both lets the app own real-sms intake (SMS_DELIVER) and
 * silences double notifications from the previous default app.
 */
private fun requestDefaultSmsOnce(context: Context) {
    try {
        val prefs = context.getSharedPreferences("luxy_power", Context.MODE_PRIVATE)
        if (prefs.getBoolean("default_sms_requested", false)) return

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val roleManager = context.getSystemService(android.app.role.RoleManager::class.java)
                ?: return
            if (!roleManager.isRoleAvailable(android.app.role.RoleManager.ROLE_SMS)) return
            if (roleManager.isRoleHeld(android.app.role.RoleManager.ROLE_SMS)) return

            prefs.edit().putBoolean("default_sms_requested", true).apply()
            context.startActivity(roleManager.createRequestRoleIntent(
                android.app.role.RoleManager.ROLE_SMS
            ))
        } else {
            val current = Telephony.Sms.getDefaultSmsPackage(context)
            if (current == context.packageName) return

            prefs.edit().putBoolean("default_sms_requested", true).apply()
            context.startActivity(
                Intent(Telephony.Sms.Intents.ACTION_CHANGE_DEFAULT)
                    .putExtra(Telephony.Sms.Intents.EXTRA_PACKAGE_NAME, context.packageName)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            )
        }
    } catch (_: Exception) {
        // Role prompt unavailable on this ROM — the user can still set the
        // default manually from Settings → Apps → Default apps → SMS.
    }
}
