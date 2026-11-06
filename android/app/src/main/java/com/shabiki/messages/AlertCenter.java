package com.shabiki.messages;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.media.RingtoneManager;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.HashSet;
import java.util.Set;

/**
 * Shared alert plumbing: every message from the /api/messages feed becomes a
 * native push. Used by BOTH the WebView poller (MainActivity — the 3s poll
 * while the app is open) and MessagesPollService (the foreground-service poller
 * that keeps running after the app is closed). Message ids are tracked in
 * SharedPreferences, so no matter which poller sees a message first — and no
 * matter how the process was killed — the user is buzzed exactly once, and
 * anything that landed while the app was shut buzzes the moment either poller
 * next runs (i.e. immediately on app open, or instantly from the service).
 */
final class AlertCenter {
    /** Alert channel (high importance — heads-up + lock screen). */
    static final String CHANNEL_ID = "messages_mpesa_channel";
    static final String CHANNEL_NAME = "Messages";
    /** Silent channel for the background poller's own persistent notification. */
    static final String SERVICE_CHANNEL_ID = "payout_watcher_channel";

    private static final String PREFS = "messages_app_prefs";
    private static final String KEY_SERVER_URL = "server_url";
    private static final String KEY_USER_IDENTIFIER = "app_user_identifier";
    private static final String KEY_SEEN_IDS = "seen_message_ids";
    /** false only after a fresh install/clear-data: swallow existing messages. */
    private static final String KEY_SEEDED = "seen_ids_seeded";
    private static final Object LOCK = new Object();

    private AlertCenter() {
    }

    /** The site the app points at (editable via the server_url intent extra). */
    static String targetUrl(Context context) {
        String saved = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getString(KEY_SERVER_URL, null);
        return saved == null || saved.isEmpty() ? MainActivity.DEFAULT_TARGET_URL : saved;
    }

    /** The user identifier the site pinned through AndroidMessagesBridge. */
    static String userIdentifier(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getString(KEY_USER_IDENTIFIER, "");
    }

    static void createChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm == null) return;

        NotificationChannel alerts = new NotificationChannel(
                CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH);
        alerts.setDescription("MPESA payout and transaction alerts");
        alerts.enableLights(true);
        alerts.setLightColor(Color.BLUE);
        alerts.enableVibration(true);
        alerts.setVibrationPattern(new long[]{0, 250, 150, 250});
        alerts.setShowBadge(true);
        nm.createNotificationChannel(alerts);

        NotificationChannel watcher = new NotificationChannel(
                SERVICE_CHANNEL_ID, "Alert watcher", NotificationManager.IMPORTANCE_MIN);
        watcher.setDescription("Keeps payout alerts flowing when the app is closed");
        watcher.setShowBadge(false);
        nm.createNotificationChannel(watcher);
    }

    /**
     * Consume a /api/messages JSON body: notify once per newly seen, unread
     * message. Called from both pollers; the shared seen-id store in
     * SharedPreferences makes double notification impossible.
     */
    static void ingestFeed(Context context, String jsonString) {
        if (jsonString == null || jsonString.isEmpty()) return;
        try {
            // The WebView poller forwards the bare messages array; the service
            // poller receives the full { messages: [...] } envelope.
            String trimmed = jsonString.trim();
            JSONArray array = trimmed.startsWith("[")
                    ? new JSONArray(trimmed)
                    : new JSONObject(trimmed).optJSONArray("messages");
            if (array == null) return;

            SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            synchronized (LOCK) {
                Set<String> seen = new HashSet<>(prefs.getStringSet(KEY_SEEN_IDS, new HashSet<>()));
                boolean firstRun = !prefs.getBoolean(KEY_SEEDED, false);
                boolean changed = false;

                for (int i = 0; i < array.length(); i++) {
                    JSONObject msg = array.optJSONObject(i);
                    if (msg == null) continue;
                    String id = msg.optString("id");
                    boolean read = msg.optBoolean("read", false);
                    String title = msg.optString("title", "MPESA");
                    String body = msg.optString("body", "");
                    if (id.isEmpty() || seen.contains(id)) continue;

                    seen.add(id);
                    changed = true;
                    if (!firstRun && !read && !body.isEmpty()) {
                        pushMessage(context, title, body);
                    }
                }
                if (changed) {
                    prefs.edit().putStringSet(KEY_SEEN_IDS, seen).apply();
                }
                // After the very first poll the same fetch results never buzz;
                // from here on any NEW message alerts instantly.
                if (firstRun) {
                    prefs.edit().putBoolean(KEY_SEEDED, true).apply();
                }
            }
        } catch (Exception ignored) {
            /* the feed is best-effort; the next poll retries */
        }
    }

    /** Bridge call from the web page: alert right now (id-less, page-decided). */
    static void directAlert(Context context, String title, String body) {
        try {
            pushMessage(context, title != null ? title : "MPESA", body != null ? body : "");
        } catch (Exception ignored) {
            /* notifications are best-effort */
        }
    }

    private static void pushMessage(Context context, String title, String body) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            return;
        }

        Intent click = new Intent(context, MainActivity.class);
        click.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        click.putExtra("open_url", targetUrl(context));
        PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                (int) System.currentTimeMillis(),
                click,
                PendingIntent.FLAG_UPDATE_CURRENT
                        | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setDefaults(Notification.DEFAULT_ALL)
                .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION))
                .setVibrate(new long[]{0, 250, 150, 250})
                .setAutoCancel(true)
                .setContentIntent(pendingIntent);

        int notificationId = (int) (System.currentTimeMillis() % Integer.MAX_VALUE);
        NotificationManagerCompat.from(context).notify(notificationId, builder.build());
    }
}
