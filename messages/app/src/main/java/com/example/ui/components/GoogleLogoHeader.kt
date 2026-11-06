package com.example.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.*

@Composable
fun GoogleLogoHeader(
    modifier: Modifier = Modifier,
    selectedCount: Int = 0,
    onClearSelection: () -> Unit = {},
    onPinSelected: () -> Unit = {},
    onArchiveSelected: () -> Unit = {},
    /** When true (Archived screen), the archive action un-archives instead. */
    showingArchived: Boolean = false,
    onDeleteSelected: () -> Unit = {},
    onSearchClick: () -> Unit = {},
    onProfileClick: () -> Unit = {}
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.background,
        tonalElevation = 0.dp
    ) {
        if (selectedCount > 0) {
            // Contextual Action Bar when threads are selected
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(
                    onClick = onClearSelection,
                    modifier = Modifier.testTag("clear_selection_button")
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Clear selection",
                        tint = MaterialTheme.colorScheme.onSurface
                    )
                }

                Text(
                    text = "$selectedCount",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.padding(start = 12.dp)
                )

                Spacer(modifier = Modifier.weight(1f))

                IconButton(
                    onClick = onPinSelected,
                    modifier = Modifier.testTag("pin_threads_button")
                ) {
                    Icon(
                        imageVector = Icons.Default.PushPin,
                        contentDescription = "Pin conversation",
                        tint = MaterialTheme.colorScheme.onSurface
                    )
                }

                IconButton(
                    onClick = onArchiveSelected,
                    modifier = Modifier.testTag("archive_threads_button")
                ) {
                    Icon(
                        imageVector = if (showingArchived) Icons.Default.Unarchive else Icons.Default.Archive,
                        contentDescription = if (showingArchived) "Unarchive conversation" else "Archive conversation",
                        tint = MaterialTheme.colorScheme.onSurface
                    )
                }

                IconButton(
                    onClick = onDeleteSelected,
                    modifier = Modifier.testTag("delete_threads_button")
                ) {
                    Icon(
                        imageVector = Icons.Default.Delete,
                        contentDescription = "Delete conversation",
                        tint = MaterialTheme.colorScheme.onSurface
                    )
                }
            }
        } else {
            // Standard Google Messages Top Bar matching Screenshot 1
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Colored "Google Messages" Logo
                val annotatedString = buildAnnotatedString {
                    withStyle(SpanStyle(color = Color(0xFF4285F4), fontWeight = FontWeight.Normal)) {
                        append("G")
                    }
                    withStyle(SpanStyle(color = Color(0xFFEA4335), fontWeight = FontWeight.Normal)) {
                        append("o")
                    }
                    withStyle(SpanStyle(color = Color(0xFFFBBC04), fontWeight = FontWeight.Normal)) {
                        append("o")
                    }
                    withStyle(SpanStyle(color = Color(0xFF4285F4), fontWeight = FontWeight.Normal)) {
                        append("g")
                    }
                    withStyle(SpanStyle(color = Color(0xFF34A853), fontWeight = FontWeight.Normal)) {
                        append("l")
                    }
                    withStyle(SpanStyle(color = Color(0xFFEA4335), fontWeight = FontWeight.Normal)) {
                        append("e")
                    }
                    withStyle(
                        SpanStyle(
                            color = MaterialTheme.colorScheme.onSurface,
                            fontWeight = FontWeight.Medium
                        )
                    ) {
                        append(" Messages")
                    }
                }

                Text(
                    text = annotatedString,
                    fontSize = 22.sp,
                    letterSpacing = (-0.3).sp,
                    modifier = Modifier.weight(1f)
                )

                // Search Icon
                IconButton(
                    onClick = onSearchClick,
                    modifier = Modifier
                        .testTag("search_icon_button")
                        .size(44.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Search,
                        contentDescription = "Search messages",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(24.dp)
                    )
                }

                Spacer(modifier = Modifier.width(8.dp))

                // Profile Avatar with circular badge styling matching Google Account in Screenshot 1
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(Color(0xFFE8F0FE))
                        .border(1.5.dp, Color(0xFF1A73E8).copy(alpha = 0.5f), CircleShape)
                        .clickable { onProfileClick() }
                        .testTag("profile_avatar_button"),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "J",
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF1A73E8)
                    )
                }
            }
        }
    }
}
