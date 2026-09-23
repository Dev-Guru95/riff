package com.riff.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.riff.app.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var fileChooser: FileChooserBridge

    private var failed = false
    private var fullScreenView: View? = null
    private var fullScreenCallback: WebChromeClient.CustomViewCallback? = null
    private var lastBackPress = 0L

    private val filePicker = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) { result -> fileChooser.onResult(result.resultCode, result.data) }

    private val notificationPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { /* Declining simply means no unread alerts; nothing else changes. */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        fileChooser = FileChooserBridge(this, filePicker)

        configureCookies()
        configureWebView()
        configureRefresh()
        configureBackNavigation()
        binding.retryButton.setOnClickListener { retry() }

        // Ask once, not on every cold start: re-launching an already-granted
        // request is wasted work, and on a denied one Android silently drops it.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }

        // A rotation must not reload the page and lose in-progress form input.
        if (savedInstanceState != null) {
            binding.webView.restoreState(savedInstanceState)
        } else {
            loadInitialUrl(intent)
        }
    }

    /**
     * Requirement: the app always opens on Login, never the landing page.
     * A returning user with a live session skips straight to their dashboard;
     * the server decides what that means for their role, so an admin lands on
     * the same shell the website gives them.
     */
    private fun loadInitialUrl(source: Intent?) {
        val target = AppConfig.launchUrl(
            deepLink = source?.data,
            hasSession = SessionStore.hasSession(),
        )
        load(target)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        // launchMode=singleTask: a deep link tapped while we are already running
        // arrives here rather than in a fresh activity.
        if (intent.data != null) loadInitialUrl(intent)
    }

    private fun configureCookies() {
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(binding.webView, true)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() = with(binding.webView) {
        settings.apply {
            javaScriptEnabled = true          // The app is a React client; non-negotiable.
            domStorageEnabled = true          // React Query cache, drafts, UI state.
            databaseEnabled = true
            loadsImagesAutomatically = true
            useWideViewPort = true
            loadWithOverviewMode = true
            // Tailwind responsive breakpoints do the layout work; the on-screen
            // zoom buttons would overlap content, so only pinch-zoom remains.
            setSupportZoom(true)
            builtInZoomControls = true
            displayZoomControls = false
            mediaPlaybackRequiresUserGesture = true
            javaScriptCanOpenWindowsAutomatically = false

            // --- Security hardening ---------------------------------------
            // The app never loads file:// content, so every file-origin bridge
            // stays shut. This is what stops a downloaded HTML file from being
            // able to read app-private storage or reach the session cookie.
            allowFileAccess = false
            allowContentAccess = false
            allowFileAccessFromFileURLs = false
            allowUniversalAccessFromFileURLs = false
            // Refuse to mix http into an https page, so the session cookie can
            // never be downgraded onto a cleartext connection.
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW

            userAgentString = userAgentString + " " + BuildConfig.UA_TAG
            cacheMode = WebSettings.LOAD_DEFAULT
        }

        webViewClient = RiffWebViewClient(
            context = this@MainActivity,
            onPageStarted = { showLoading() },
            onPageDone = { hideLoading() },
            onFailure = { showError(it) },
        )

        webChromeClient = RiffWebChromeClient(
            onProgress = { updateProgress(it) },
            onChooseFile = { cb, params -> fileChooser.onChooseFile(cb, params) },
            onFullScreen = { view, cb -> toggleFullScreen(view, cb) },
        )

        setDownloadListener { url, userAgent, disposition, mime, _ ->
            DownloadHandler.enqueue(this@MainActivity, url, userAgent, disposition, mime)
        }
    }

    private fun configureRefresh() {
        binding.swipeRefresh.apply {
            setColorSchemeResources(R.color.brand, R.color.brand_2, R.color.accent)
            setProgressBackgroundColorSchemeResource(R.color.surface)
            setOnRefreshListener { retry() }
        }

        // Pull-to-refresh must only arm at the very top of the page, otherwise
        // it hijacks ordinary scrolling inside long lessons and Kanban boards.
        binding.webView.viewTreeObserver.addOnScrollChangedListener {
            binding.swipeRefresh.isEnabled = binding.webView.scrollY == 0
        }
    }

    private fun configureBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                when {
                    fullScreenView != null -> toggleFullScreen(null, null)
                    binding.webView.canGoBack() -> binding.webView.goBack()
                    else -> confirmExit()
                }
            }
        })
    }

    /** Accidental exits are costly mid-form, so require a deliberate double tap. */
    private fun confirmExit() {
        val now = System.currentTimeMillis()
        if (now - lastBackPress < 2000) {
            finish()
        } else {
            lastBackPress = now
            Toast.makeText(this, R.string.exit_confirm, Toast.LENGTH_SHORT).show()
        }
    }

    private fun load(url: String) {
        failed = false
        binding.errorView.visibility = View.GONE
        binding.webView.visibility = View.VISIBLE

        if (!isOnline()) {
            showError(LoadFailure.OFFLINE)
            return
        }
        binding.webView.loadUrl(url)
    }

    private fun retry() {
        if (!isOnline()) {
            showError(LoadFailure.OFFLINE)
            binding.swipeRefresh.isRefreshing = false
            return
        }
        failed = false
        binding.errorView.visibility = View.GONE
        binding.webView.visibility = View.VISIBLE

        // After a hard failure there may be no usable history entry to reload,
        // so fall back to the normal entry point.
        val current = binding.webView.url
        if (current.isNullOrBlank() || current == "about:blank") {
            loadInitialUrl(intent)
        } else {
            binding.webView.reload()
        }
    }

    private fun showLoading() {
        binding.progress.visibility = View.VISIBLE
    }

    private fun hideLoading() {
        binding.progress.visibility = View.GONE
        binding.swipeRefresh.isRefreshing = false
        if (!failed) {
            binding.errorView.visibility = View.GONE
            binding.webView.visibility = View.VISIBLE
        }
    }

    private fun updateProgress(value: Int) {
        binding.progress.progress = value
        binding.progress.visibility = if (value in 1..99) View.VISIBLE else View.GONE
    }

    private fun showError(failure: LoadFailure) {
        failed = true
        binding.swipeRefresh.isRefreshing = false
        binding.progress.visibility = View.GONE

        val offline = failure == LoadFailure.OFFLINE || !isOnline()
        binding.errorTitle.setText(if (offline) R.string.offline_title else R.string.error_title)
        binding.errorBody.setText(
            when {
                offline -> R.string.offline_body
                failure == LoadFailure.SERVER -> R.string.server_error_body
                else -> R.string.error_body
            },
        )

        // Hide the broken page rather than showing the Chromium error document,
        // which would leak raw net:: codes to the user.
        binding.webView.visibility = View.GONE
        binding.errorView.visibility = View.VISIBLE
    }

    private fun toggleFullScreen(view: View?, callback: WebChromeClient.CustomViewCallback?) {
        val decor = window.decorView as ViewGroup

        if (view == null) {
            fullScreenView?.let { decor.removeView(it) }
            fullScreenView = null
            fullScreenCallback?.onCustomViewHidden()
            fullScreenCallback = null
            binding.root.visibility = View.VISIBLE
            return
        }

        fullScreenView = view
        fullScreenCallback = callback
        binding.root.visibility = View.GONE
        decor.addView(
            view,
            ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            ),
        )
    }

    private fun isOnline(): Boolean {
        val cm = getSystemService(ConnectivityManager::class.java) ?: return true
        val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        binding.webView.saveState(outState)
    }

    override fun onPause() {
        super.onPause()
        binding.webView.onPause()
        // Flush now: the process may be killed while backgrounded, and an
        // unflushed jar would sign the user out for no reason.
        SessionStore.flush()
    }

    override fun onResume() {
        super.onResume()
        binding.webView.onResume()
    }

    override fun onDestroy() {
        fileChooser.cancel()
        binding.webView.apply {
            stopLoading()
            (parent as? ViewGroup)?.removeView(this)
            destroy()
        }
        super.onDestroy()
    }
}
