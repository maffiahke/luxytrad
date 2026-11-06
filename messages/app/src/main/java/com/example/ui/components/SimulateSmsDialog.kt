package com.example.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog

@Composable
fun SimulateSmsDialog(
    onDismiss: () -> Unit,
    onSimulate: (sender: String, phone: String, message: String, category: String) -> Unit
) {
    var sender by remember { mutableStateOf("MPESA") }
    var phone by remember { mutableStateOf("MPESA") }
    var message by remember {
        mutableStateOf("UK998822AA Confirmed. You have received Ksh 1,500.00 from DANIEL NJOROGE on 06/11/2026 at 10:45 AM. New balance is Ksh 1,500.00.")
    }
    var category by remember { mutableStateOf("Transactions") }

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(24.dp))
                .testTag("simulate_sms_dialog"),
            color = MaterialTheme.colorScheme.surface,
            tonalElevation = 6.dp
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Simulate Incoming SMS",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Spacer(modifier = Modifier.weight(1f))
                    IconButton(onClick = onDismiss, modifier = Modifier.size(32.dp)) {
                        Icon(Icons.Default.Close, contentDescription = "Close")
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                Text(
                    text = "Quick Presets:",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.primary
                )

                Spacer(modifier = Modifier.height(6.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    SuggestionChip(
                        onClick = {
                            sender = "MPESA"
                            phone = "MPESA"
                            category = "Transactions"
                            message = "UK998822AA Confirmed. You have received Ksh 2,000.00 from JOHN MWANGI on 06/11/26 at 11:00 AM."
                        },
                        label = { Text("M-PESA", fontSize = 11.sp) }
                    )
                    SuggestionChip(
                        onClick = {
                            sender = "KENYA POWER"
                            phone = "KENYA POWER"
                            category = "Transactions"
                            message = "Mtr:37228818060 Token:9823-1029-4458-1290 Units:20.5 Amount:Ksh 500.00 Date:06/11/2026."
                        },
                        label = { Text("Power Token", fontSize = 11.sp) }
                    )
                    SuggestionChip(
                        onClick = {
                            sender = "Alice"
                            phone = "+254 722 987 654"
                            category = "Personal"
                            message = "Hey! Let me know when you are free to discuss the launch."
                        },
                        label = { Text("Friend", fontSize = 11.sp) }
                    )
                }

                Spacer(modifier = Modifier.height(14.dp))

                OutlinedTextField(
                    value = sender,
                    onValueChange = { sender = it },
                    label = { Text("Sender Name / Shortcode") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(10.dp))

                OutlinedTextField(
                    value = phone,
                    onValueChange = { phone = it },
                    label = { Text("Phone Number / ID") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(10.dp))

                OutlinedTextField(
                    value = message,
                    onValueChange = { message = it },
                    label = { Text("SMS Message Text") },
                    minLines = 3,
                    maxLines = 5,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(18.dp))

                Button(
                    onClick = {
                        onSimulate(sender, phone, message, category)
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("submit_simulate_sms_button"),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("Receive SMS Now")
                }
            }
        }
    }
}
