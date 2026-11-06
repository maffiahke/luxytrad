package com.shabiki.messages;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.core.content.ContextCompat;

/** Restarts the background alert poller after a reboot. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
        Intent service = new Intent(context, MessagesPollService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                ContextCompat.startForegroundService(context, service);
            } catch (Exception ignored) {
            }
        } else {
            try {
                context.startService(service);
            } catch (Exception ignored) {
            }
        }
    }
}
