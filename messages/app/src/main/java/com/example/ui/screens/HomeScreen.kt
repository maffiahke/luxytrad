package com.example.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.ChatBubble
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Sms
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.local.ThreadEntity
import com.example.ui.components.GoogleLogoHeader
import com.example.ui.components.ThreadItem
import com.example.ui.theme.GoogleBlueContainer
import com.example.ui.theme.GoogleOnBlueContainer

@Composable
fun HomeScreen(
    threads: List<ThreadEntity>,
    selectedCategory: String,
    onSelectCategory: (String) -> Unit,
    selectedThreadIds: Set<String>,
    onToggleThreadSelection: (String) -> Unit,
    onClearSelection: () -> Unit,
    onPinSelected: () -> Unit,
    onArchiveSelected: () -> Unit,
    onDeleteSelected: () -> Unit,
    onThreadClick: (String) -> Unit,
    onSearchClick: () -> Unit,
    onProfileClick: () -> Unit,
    onStartChatClick: () -> Unit,
    onMagicComposeClick: () -> Unit,
    hasPermission: Boolean,
    onRequestPermission: () -> Unit,
    isSyncing: Boolean,
    onSyncInbox: () -> Unit,
    modifier: Modifier = Modifier
) {
    Scaffold(
        modifier = modifier.fillMaxSize(),
        topBar = {
            // statusBarsPadding pushes the header below the clock/battery row
            // instead of rendering squeezed behind the system status bar.
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
            ) {
                GoogleLogoHeader(
                    selectedCount = selectedThreadIds.size,
                    onClearSelection = onClearSelection,
                    onPinSelected = onPinSelected,
                    onArchiveSelected = onArchiveSelected,
                    onDeleteSelected = onDeleteSelected,
                    onSearchClick = onSearchClick,
                    onProfileClick = onProfileClick
                )

                if (isSyncing) {
                    LinearProgressIndicator(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(2.dp),
                        color = MaterialTheme.colorScheme.primary
                    )
                }
            }
        },
        floatingActionButton = {
            Column(
                horizontalAlignment = Alignment.End,
                verticalArrangement = Arrangement.spacedBy(16.dp),
                modifier = Modifier
                    .navigationBarsPadding()
                    .padding(end = 4.dp, bottom = 4.dp)
            ) {
                // Circular Gemini / Magic Compose FAB matching Screenshot 1
                SmallFloatingActionButton(
                    onClick = onMagicComposeClick,
                    containerColor = MaterialTheme.colorScheme.surfaceVariant,
                    contentColor = MaterialTheme.colorScheme.primary,
                    shape = CircleShape,
                    modifier = Modifier
                        .size(48.dp)
                        .testTag("gemini_fab")
                ) {
                    Icon(
                        imageVector = Icons.Default.AutoAwesome,
                        contentDescription = "Gemini AI Assistant",
                        modifier = Modifier.size(24.dp)
                    )
                }

                // "Start chat" Pill FAB matching Screenshot 1
                ExtendedFloatingActionButton(
                    onClick = onStartChatClick,
                    containerColor = GoogleBlueContainer,
                    contentColor = GoogleOnBlueContainer,
                    shape = RoundedCornerShape(26.dp),
                    elevation = FloatingActionButtonDefaults.elevation(defaultElevation = 3.dp),
                    modifier = Modifier.testTag("start_chat_fab")
                ) {
                    Icon(
                        imageVector = Icons.Default.ChatBubble,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(
                        text = "Start chat",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            // Permission request banner if SMS permission is not yet granted
            if (!hasPermission) {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp)
                        .testTag("permission_banner_card"),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f)
                    ),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Sms,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(32.dp)
                        )
                        Spacer(modifier = Modifier.width(16.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Access device SMS inbox",
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 15.sp,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = "Allow Messages to fetch and display conversations directly from your device inbox.",
                                fontSize = 13.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Button(
                                onClick = onRequestPermission,
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.testTag("grant_permission_button")
                            ) {
                                Text("Allow access")
                            }
                        }
                    }
                }
            }

            // Category filter chips were removed — the inbox simply lists all
            // conversations; the thread's Transactions/Promotions tags stay in
            // the data model for future use.

            Spacer(modifier = Modifier.height(4.dp))

            // Thread List or Empty State
            if (threads.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Box(
                            modifier = Modifier
                                .size(72.dp)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.surfaceVariant),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.ChatBubble,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(36.dp)
                            )
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        Text(
                            text = if (hasPermission) "No messages in device inbox" else "Device messages waiting",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.onSurface
                        )

                        Spacer(modifier = Modifier.height(6.dp))

                        Text(
                            text = if (hasPermission) {
                                "Your device's SMS inbox is currently empty. Tap 'Start chat' to send a new message or tap refresh to rescan."
                            } else {
                                "Grant SMS permission to view all messages stored on this device."
                            },
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontSize = 14.sp,
                            lineHeight = 20.sp,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                            modifier = Modifier.padding(horizontal = 16.dp)
                        )

                        Spacer(modifier = Modifier.height(16.dp))

                        if (hasPermission) {
                            OutlinedButton(
                                onClick = onSyncInbox,
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.testTag("refresh_inbox_button")
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Refresh,
                                    contentDescription = null,
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Sync Inbox")
                            }
                        }
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(bottom = 96.dp)
                ) {
                    items(threads, key = { it.id }) { thread ->
                        ThreadItem(
                            thread = thread,
                            isSelected = selectedThreadIds.contains(thread.id),
                            isSelectionActive = selectedThreadIds.isNotEmpty(),
                            onClick = { onThreadClick(thread.id) },
                            onLongClick = { onToggleThreadSelection(thread.id) }
                        )
                    }
                }
            }
        }
    }
}
