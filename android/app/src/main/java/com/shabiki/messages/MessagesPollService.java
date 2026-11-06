package com.shabiki.messages;

import android.app.Notification;
import android.app.NotificationCompat;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * Foreground-service poller so auto-payout alerts arrive IMMEDIATELY — even
 * when the trading app is closed or the screen is off. It fetches
 * {site}/api/messages?username=<pinned identifier> every few seconds directly
 * over HTTP (no WebView needed) and routes results through AlertCenter, which
 * de-duplicates against the same seen-id store the WebView poller uses.
 *
 * The persistent "Alert watcher" notification keeps the service alive; the
 * per-poll WakeLock keeps Android from deferring the fetch into Doze.
 */
public class MessagesPollService extends Service {
    private static final long POLL_INTERVAL_MS = 5000;
    private static final int SERVICE_NOTIFICATION_ID = 2001;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private PowerManager.WakeLock wakeLock;
    private boolean running;

    @Override
    public void onCreate() {
        super.onCreate();
        AlertCenter.createChannels(this);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground(SERVICE_NOTIFICATION_ID, watcherNotification());
        startLoop();
        return START_STICKY;
    }

    private void startLoop() {
        if (running) return;
        running = true;
        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                poll();
                handler.postDelayed(this, POLL_INTERVAL_MS);
            }
        }, 1500);
    }

    private void poll() {
        // Work off the main thread; a short WakeLock per tick keeps the fetch
        // from being deferred by Doze/battery savers.
        handler.post(new Runnable() {
            @Override
            public void run() {
                new Thread(new Runnable() {
                    @Override
                    public void run() {
                        acquireWakeLock();
                        try {
                            fetchOnce();
                        } catch (Exception ignored) {
                            /* transient network/API error — the next poll retries */
                        } finally {
                            releaseWakeLock();
                        }
                    }
                }).start();
            }
        });
    }

    private void acquireWakeLock() {
        try {
            if (wakeLock == null) {
                PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
                if (pm != null) {
                    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "shabiki:messages_poll");
                }
            }
            if (wakeLock != null && !wakeLock.isHeld()) {
                wakeLock.acquire(10_000);
            }
        } catch (Exception ignored) {
            /* without the lock the fetch may just be delayed */
        }
    }

    private void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        } catch (Exception ignored) {
        }
    }

    private void fetchOnce() throws Exception {
        String identifier = AlertCenter.userIdentifier(this);
        if (identifier.isEmpty()) return; // not pinned yet — the WebView poller handles this case

        String base = AlertCenter.targetUrl(this);
        Uri parsed = Uri.parse(base);
        String origin = parsed.getScheme() + "://" + parsed.getHost()
                + (parsed.getPort() > 0 ? ":" + parsed.getPort() : "");
        String url = origin + "/api/messages?username="
                + URLEncoder.encode(identifier, "UTF-8");

        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setConnectTimeout(8000);
        conn.setReadTimeout(8000);
        conn.setRequestMethod("GET");
        if (conn.getResponseCode() != 200) {
            conn.disconnect();
            return;
        }
        StringBuilder sb = new StringBuilder();
        BufferedReader reader = new BufferedReader(
                new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
        String line;
        while ((line = reader.readLine()) != null) sb.append(line).append('\n');
        reader.close();
        conn.disconnect();

        String body = sb.toString().trim();
        if (body.startsWith("{")) {
            AlertCenter.ingestFeed(this, body);
        }
    }

    private Notification watcherNotification() {
        Intent click = new Intent(this, MainActivity.class);
        click.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        click.putExtra("open_url", AlertCenter.targetUrl(this));
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 2002, click,
                PendingIntent.FLAG_UPDATE_CURRENT
                        | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0));

        return new NotificationCompat.Builder(this, AlertCenter.SERVICE_CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("Alerts active")
                .setContentText("Payout and message alerts are on.")
                .setPriority(NotificationCompat.PRIORITY_MIN)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setOngoing(true)
                .setShowWhen(false)
                .setContentIntent(pendingIntent)
                .build();
    }

    @Override
    public void onDestroy() {
        running = false;
        handler.removeCallbacksAndMessages(null);
        releaseWakeLock();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
