package com.example.ui.components

import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.ClickableText
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.local.MessageEntity
import com.example.ui.theme.BubbleIncomingDark
import com.example.ui.theme.BubbleIncomingLight
import com.example.ui.theme.BubbleOutgoingDark
import com.example.ui.theme.BubbleOutgoingLight
import java.util.regex.Pattern

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun MessageBubble(
    message: MessageEntity,
    onToggleStar: (String) -> Unit = {},
    onDeleteMessage: (String) -> Unit = {},
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val clipboardManager = LocalClipboardManager.current
    var showMenu by remember { mutableStateOf(false) }

    val isIncoming = message.isIncoming
    val isDark = MaterialTheme.colorScheme.background == Color(0xFF111318)

    val bubbleBg = if (isIncoming) {
        if (isDark) BubbleIncomingDark else BubbleIncomingLight
    } else {
        if (isDark) BubbleOutgoingDark else BubbleOutgoingLight
    }

    val textColor = if (isIncoming) {
        MaterialTheme.colorScheme.onSurface
    } else {
        if (isDark) Color(0xFF042F73) else Color.White
    }

    val bubbleShape = if (isIncoming) {
        RoundedCornerShape(
            topStart = 6.dp,
            topEnd = 18.dp,
            bottomEnd = 18.dp,
            bottomStart = 18.dp
        )
    } else {
        RoundedCornerShape(
            topStart = 18.dp,
            topEnd = 6.dp,
            bottomEnd = 18.dp,
            bottomStart = 18.dp
        )
    }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        contentAlignment = if (isIncoming) Alignment.CenterStart else Alignment.CenterEnd
    ) {
        Column(
            horizontalAlignment = if (isIncoming) Alignment.Start else Alignment.End
        ) {
            Box(
                modifier = Modifier
                    .widthIn(max = 310.dp)
                    .clip(bubbleShape)
                    .background(bubbleBg)
                    .combinedClickable(
                        onClick = {},
                        onLongClick = { showMenu = true }
                    )
                    .padding(horizontal = 16.dp, vertical = 12.dp)
                    .testTag("message_bubble_${message.id}")
            ) {
                Column {
                    val annotatedText = buildHighlightedAnnotatedString(
                        text = message.content,
                        baseColor = textColor,
                        linkColor = if (isIncoming) MaterialTheme.colorScheme.primary else Color.White
                    )

                    ClickableText(
                        text = annotatedText,
                        style = MaterialTheme.typography.bodyLarge.copy(
                            fontSize = 15.sp,
                            lineHeight = 22.sp,
                            color = textColor
                        ),
                        onClick = { offset ->
                            annotatedText.getStringAnnotations(tag = "URL", start = offset, end = offset)
                                .firstOrNull()?.let { annotation ->
                                    try {
                                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(annotation.item))
                                        context.startActivity(intent)
                                    } catch (e: Exception) {
                                        Toast.makeText(context, "Cannot open: ${annotation.item}", Toast.LENGTH_SHORT).show()
                                    }
                                }
                            annotatedText.getStringAnnotations(tag = "PHONE", start = offset, end = offset)
                                .firstOrNull()?.let { annotation ->
                                    try {
                                        val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:${Uri.encode(annotation.item)}"))
                                        context.startActivity(intent)
                                    } catch (e: Exception) {
                                        Toast.makeText(context, "Cannot dial: ${annotation.item}", Toast.LENGTH_SHORT).show()
                                    }
                                }
                        }
                    )

                    Spacer(modifier = Modifier.height(4.dp))

                    Row(
                        modifier = Modifier.align(Alignment.End),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        if (message.isStarred) {
                            Icon(
                                imageVector = Icons.Default.Star,
                                contentDescription = "Starred",
                                tint = Color(0xFFFBBC04),
                                modifier = Modifier
                                    .size(12.dp)
                                    .padding(end = 4.dp)
                            )
                        }

                        Text(
                            text = message.formattedTime,
                            fontSize = 11.sp,
                            color = textColor.copy(alpha = 0.65f)
                        )

                        if (!isIncoming) {
                            Spacer(modifier = Modifier.width(4.dp))
                            Icon(
                                imageVector = Icons.Default.DoneAll,
                                contentDescription = "Delivered",
                                tint = textColor.copy(alpha = 0.8f),
                                modifier = Modifier.size(13.dp)
                            )
                        }
                    }
                }
            }

            // Dropdown context menu on long click
            DropdownMenu(
                expanded = showMenu,
                onDismissRequest = { showMenu = false }
            ) {
                DropdownMenuItem(
                    text = { Text("Copy text") },
                    onClick = {
                        showMenu = false
                        clipboardManager.setText(AnnotatedString(message.content))
                        Toast.makeText(context, "Message copied to clipboard", Toast.LENGTH_SHORT).show()
                    }
                )
                DropdownMenuItem(
                    text = { Text(if (message.isStarred) "Unstar" else "Star message") },
                    onClick = {
                        showMenu = false
                        onToggleStar(message.id)
                    }
                )
                DropdownMenuItem(
                    text = { Text("Delete message", color = MaterialTheme.colorScheme.error) },
                    onClick = {
                        showMenu = false
                        onDeleteMessage(message.id)
                    }
                )
            }
        }
    }
}

/**
 * Highlights dates, URLs, USSD codes like *334#, and token codes with underline styling matching Screenshot 2.
 */
private fun buildHighlightedAnnotatedString(
    text: String,
    baseColor: Color,
    linkColor: Color
): AnnotatedString {
    val builder = AnnotatedString.Builder(text)

    // Regex for URLs
    val urlPattern = Pattern.compile("https?://[a-zA-Z0-9.-]+(?:/[a-zA-Z0-9._~:/?#\\[\\]@!$&'()*+,;=]*)?")
    val urlMatcher = urlPattern.matcher(text)
    while (urlMatcher.find()) {
        val start = urlMatcher.start()
        val end = urlMatcher.end()
        val url = urlMatcher.group()
        builder.addStyle(
            SpanStyle(
                color = linkColor,
                textDecoration = TextDecoration.Underline,
                fontWeight = FontWeight.Medium
            ),
            start,
            end
        )
        builder.addStringAnnotation("URL", url, start, end)
    }

    // Regex for dates (e.g. 6/11/26 at 8:20 AM, 05/12/26)
    val datePattern = Pattern.compile("\\b(\\d{1,2}/\\d{1,2}/\\d{2,4}(?:\\s+at\\s+\\d{1,2}:\\d{2}(?:\\s*[AP]M)?)?)\\b")
    val dateMatcher = datePattern.matcher(text)
    while (dateMatcher.find()) {
        val start = dateMatcher.start()
        val end = dateMatcher.end()
        builder.addStyle(
            SpanStyle(
                textDecoration = TextDecoration.Underline,
                fontWeight = FontWeight.Medium
            ),
            start,
            end
        )
    }

    // Regex for USSD codes (e.g. *334#)
    val ussdPattern = Pattern.compile("\\*[0-9]+#")
    val ussdMatcher = ussdPattern.matcher(text)
    while (ussdMatcher.find()) {
        val start = ussdMatcher.start()
        val end = ussdMatcher.end()
        val ussd = ussdMatcher.group()
        builder.addStyle(
            SpanStyle(
                textDecoration = TextDecoration.Underline,
                fontWeight = FontWeight.SemiBold
            ),
            start,
            end
        )
        builder.addStringAnnotation("PHONE", ussd, start, end)
    }

    return builder.toAnnotatedString()
}
