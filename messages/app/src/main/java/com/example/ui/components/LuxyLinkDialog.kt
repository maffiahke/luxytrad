package com.example.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialogDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog

/**
 * Links this SMS app to a Luxytrades account: withdrawals paid to that account
 * arrive here as MPESA texts (with notifications) instead of only living in the
 * trading site's wallet screen.
 */
@Composable
fun LuxyLinkDialog(
    currentUrl: String,
    currentIdentifier: String?,
    onDismiss: () -> Unit,
    onSave: (baseUrl: String, identifier: String?) -> Unit
) {
    var url by remember { mutableStateOf(currentUrl) }
    var identifier by remember { mutableStateOf(currentIdentifier.orEmpty()) }

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(24.dp),
            color = AlertDialogDefaults.containerColor,
            tonalElevation = 6.dp
        ) {
            Column(modifier = Modifier.padding(22.dp)) {
                Text(
                    text = "Luxytrades payouts",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Withdrawal receipts paid to the account below arrive here as MPESA texts — even with the app closed.",
                    fontSize = 12.5.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(14.dp))

                OutlinedTextField(
                    value = identifier,
                    onValueChange = { identifier = it },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    label = { Text("Account (username or phone)") },
                    placeholder = { Text("e.g. jay254 or 0759740294") }
                )
                Spacer(modifier = Modifier.height(10.dp))
                OutlinedTextField(
                    value = url,
                    onValueChange = { url = it },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    label = { Text("Site URL") }
                )

                Spacer(modifier = Modifier.height(18.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    if (currentIdentifier != null) {
                        TextButton(onClick = {
                            onSave(url.trim().ifBlank { currentUrl }, null)
                            onDismiss()
                        }) {
                            Text("Unlink")
                        }
                    }
                    TextButton(onClick = onDismiss) {
                        Text("Cancel")
                    }
                    Button(onClick = {
                        val id = identifier.trim().takeIf { it.isNotEmpty() }
                        onSave(url.trim().ifBlank { currentUrl }, id)
                        onDismiss()
                    }) {
                        Text("Save")
                    }
                }

                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Tip: use the phone number exactly as you sign in on $currentUrl.",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}
