package com.shabiki.messages;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

public class MainActivity extends AppCompatActivity {
    /** Public so AlertCenter can fall back to it (overridable via server_url intent). */
    public static final String DEFAULT_TARGET_URL = "https://shabikimarket.com/messages";
    private static final String PREFS_NAME = "messages_app_prefs";
    private static final String KEY_SERVER_URL = "server_url";
    private static final String KEY_LAST_URL = "last_url";
    private static final int PERMISSION_REQUEST_CODE = 101;

    private WebView webView;
    private SwipeRefreshLayout swipeRefresh;
    private final Handler pollHandler = new Handler(Looper.getMainLooper());

    private String getTargetUrl() {
        return getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                .getString(KEY_SERVER_URL, DEFAULT_TARGET_URL);
    }

    public class WebAppInterface {
        private final android.content.Context context;

        public WebAppInterface(android.content.Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public void setAppUser(String userIdentifier) {
            if (userIdentifier != null && !userIdentifier.trim().isEmpty()) {
                getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                        .edit()
                        .putString("app_user_identifier", userIdentifier.trim())
                        .apply();
                // The user changed (fresh login) — make sure the background
                // poller is alive to serve their feed immediately.
                startAlertService();
            }
        }

        @JavascriptInterface
        public void showNativeNotification(String title, String body) {
            AlertCenter.directAlert(context, title, body);
        }

        @JavascriptInterface
        public void onMessagesReceived(String jsonString) {
            AlertCenter.ingestFeed(context, jsonString);
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        AlertCenter.createChannels(this);

        webView = findViewById(R.id.webView);
        swipeRefresh = findViewById(R.id.swipeRefresh);

        requestNotificationPermission();

        // Persistent Cookie Management across App Lifecycles & Swipes
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);
        cookieManager.flush();

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setSaveFormData(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        // Native JavaScript Bridge for Web Notifications + identity pinning
        webView.addJavascriptInterface(new WebAppInterface(this), "AndroidMessagesBridge");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                CookieManager.getInstance().flush();
                if (url != null && !url.contains("/login") && !url.contains("/register")) {
                    getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                            .edit()
                            .putString(KEY_LAST_URL, url)
                            .apply();
                }
                if (swipeRefresh != null) {
                    swipeRefresh.setRefreshing(false);
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                request.grant(request.getResources());
            }
        });

        swipeRefresh.setOnRefreshListener(() -> webView.reload());

        // Support custom URL passed via intent
        String intentServerUrl = getIntent().getStringExtra("server_url");
        if (intentServerUrl == null || intentServerUrl.isEmpty()) {
            intentServerUrl = getIntent().getStringExtra("target_url");
        }
        if (intentServerUrl != null && !intentServerUrl.isEmpty()) {
            getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                    .edit()
                    .putString(KEY_SERVER_URL, intentServerUrl)
                    .apply();
        }

        // Restore state if returning from background/tab switch, otherwise load initial URL
        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            String initialUrl = getIntent().getStringExtra("open_url");
            if (initialUrl != null && !initialUrl.isEmpty()) {
                webView.loadUrl(initialUrl);
            } else {
                String lastUrl = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                        .getString(KEY_LAST_URL, getTargetUrl());
                webView.loadUrl(lastUrl);
            }
        }

        startBackgroundMessageListener();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) {
            webView.saveState(outState);
        }
        CookieManager.getInstance().flush();
    }

    @Override
    protected void onRestoreInstanceState(Bundle savedInstanceState) {
        super.onRestoreInstanceState(savedInstanceState);
        if (webView != null) {
            webView.restoreState(savedInstanceState);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
        }
        CookieManager.getInstance().flush();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (webView != null) {
            webView.onPause();
        }
        CookieManager.getInstance().flush();
    }

    @Override
    protected void onStop() {
        super.onStop();
        CookieManager.getInstance().flush();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String openUrl = intent.getStringExtra("open_url");
        if (openUrl != null && !openUrl.isEmpty() && webView != null) {
            webView.loadUrl(openUrl);
        }
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, PERMISSION_REQUEST_CODE);
            }
        }
    }

    private void startAlertService() {
        Intent service = new Intent(this, MessagesPollService.class);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ContextCompat.startForegroundService(this, service);
            } else {
                startService(service);
            }
        } catch (Exception ignored) {
            /* the WebView poller still alerts while the app is open */
        }
    }

    private void startBackgroundMessageListener() {
        // 1) Keep the WebView poller (fast, uses the logged-in session).
        pollHandler.postDelayed(new Runnable() {
            @Override
            public void run() {
                checkLatestMessages();
                pollHandler.postDelayed(this, 3000);
            }
        }, 3000);

        // 2) The foreground-service poller survives app close/screen-off, so
        //    auto-payout receipts reach the phone the second they are written.
        startAlertService();
    }

    private void checkLatestMessages() {
        if (webView == null) return;

        final String savedUser = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                .getString("app_user_identifier", "");

        // Check messages via authenticated session in WebView or fallback user identifier, and bridge directly to Java
        String script = "(function() { " +
                "  try { " +
                "    var localUser = ''; " +
                "    try { " +
                "      localUser = localStorage.getItem('messagesAppUsername') || " +
                "                  localStorage.getItem('zentriUser') || " +
                "                  localStorage.getItem('userEmail') || " +
                "                  localStorage.getItem('userPhone') || ''; " +
                "    } catch(e){} " +
                "    var targetUser = localUser || '" + savedUser.replace("'", "\\'") + "'; " +
                "    var url = '/api/messages' + (targetUser ? ('?username=' + encodeURIComponent(targetUser)) : ''); " +
                "    fetch(url, { credentials: 'include' })" +
                "      .then(function(r) { return r.json(); })" +
                "      .then(function(d) { " +
                "        if (d && d.messages && window.AndroidMessagesBridge) { " +
                "          window.AndroidMessagesBridge.onMessagesReceived(JSON.stringify(d.messages)); " +
                "        } " +
                "      }).catch(function(e){}); " +
                "  } catch(e){} " +
                "})();";

        webView.evaluateJavascript(script, null);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        CookieManager.getInstance().flush();
        pollHandler.removeCallbacksAndMessages(null);
        // MessagesPollService deliberately stays alive (foreground service) so
        // payout alerts keep flowing while the app is closed.
    }
}
