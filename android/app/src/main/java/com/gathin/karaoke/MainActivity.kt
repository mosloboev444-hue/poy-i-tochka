package com.gathin.karaoke

import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.media.MediaPlayer
import android.net.Uri
import android.net.VpnService
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ProgressBar
import android.widget.Spinner
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

class MainActivity : AppCompatActivity() {
    private lateinit var root: FrameLayout
    private lateinit var webView: WebView
    private lateinit var setupPanel: View
    private lateinit var configSpinner: Spinner
    private lateinit var vpnStatus: TextView
    private lateinit var connectButton: Button
    private lateinit var importButton: Button
    private lateinit var openButton: Button
    private lateinit var busy: ProgressBar
    private lateinit var errorText: TextView

    private var pendingConfig: File? = null
    private var webLoaded = false
    private var customView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
    private var localServer: LocalServer? = null
    private var youTubeView: WebView? = null
    private var youTubeContainer: FrameLayout? = null
    private var brandVoice: MediaPlayer? = null
    private var brandVoicePlayed = false
    private var hlsPlayer: ExoPlayer? = null
    private val hlsHandler = Handler(Looper.getMainLooper())
    private var hlsProgress: Runnable? = null
    @Volatile
    private var resultsWindowOpen = false

    private val fileChooserLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val callback = fileChooserCallback
        fileChooserCallback = null
        if (callback == null) return@registerForActivityResult
        val uri = result.data?.data
        callback.onReceiveValue(
            if (result.resultCode == RESULT_OK && uri != null) arrayOf(uri) else null
        )
    }

    private val vpnPermissionLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val config = pendingConfig
        pendingConfig = null
        if (result.resultCode == RESULT_OK && config != null) {
            connectVpn(config, silent = true)
        } else {
            setBusy(false)
            if (packageManager.hasSystemFeature(PackageManager.FEATURE_LEANBACK)) {
                showSetup()
            } else {
                openKaraoke()
            }
            showError(getString(R.string.vpn_permission_denied))
        }
    }
    private val importLauncher = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri == null) return@registerForActivityResult
        lifecycleScope.launch {
            val imported = withContext(Dispatchers.IO) {
                ConfigStore.import(applicationContext, uri)
            }
            if (imported == null) {
                showError("Не удалось прочитать файл конфигурации")
            } else {
                refreshConfigs(imported.name)
                showError(null)
            }
        }
    }

    private val catalogLauncher = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri == null) return@registerForActivityResult
        lifecycleScope.launch {
            val pack = withContext(Dispatchers.IO) {
                CatalogStore.importZip(applicationContext, uri)
            }
            webView.post {
                if (pack == null) {
                    webView.evaluateJavascript(
                        "window.poyCatalogError&&window.poyCatalogError('Не удалось импортировать ZIP-пакет')",
                        null
                    )
                } else {
                    webView.evaluateJavascript(
                        "window.poyCatalogUpdated&&window.poyCatalogUpdated()",
                        null
                    )
                }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        setContentView(R.layout.activity_main)
        bindViews()
        hideSystemUi()
        runCatching { File(filesDir, "deepseek_key.txt").delete() }
        ConfigStore.ensureBundled(this)
        localServer = LocalServer(applicationContext).also { server ->
            try {
                server.start()
            } catch (exc: Exception) {
                showError("Локальный сервер не запустился: ${exc.message}")
            }
        }
        setupWebView()
        refreshConfigs()
        bindActions()
        updateUi()

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                when {
                    youTubeView != null -> closeYouTubePlayer()
                    resultsWindowOpen -> webView.evaluateJavascript(
                        "window.closePoyResults && window.closePoyResults()",
                        null
                    )
                    customView != null -> hideCustomView()
                    webView.visibility == View.VISIBLE -> {
                        webView.evaluateJavascript(
                            "(function(){try{return !!(window.poyHandleBack&&window.poyHandleBack());}catch(e){return false;}})()"
                        ) { result ->
                            val handled = result?.trim()?.trim('"') == "true"
                            if (!handled) {
                                if (webView.canGoBack()) webView.goBack() else finish()
                            }
                        }
                    }
                    else -> finish()
                }
            }
        })

        if (VpnManager.isUp) {
            openKaraoke()
        } else {
            val firstConfig = ConfigStore.list(this).firstOrNull()
            if (firstConfig != null) {
                // Open the karaoke UI immediately; the tunnel connects in the background.
                openKaraoke()
                val prepareIntent = VpnService.prepare(this)
                if (prepareIntent != null) {
                    pendingConfig = firstConfig
                    vpnPermissionLauncher.launch(prepareIntent)
                } else {
                    connectVpn(firstConfig, silent = true)
                }
            }
        }

    }

    private fun playBrandVoice() {
        if (brandVoicePlayed) return
        brandVoicePlayed = true
        try {
            val voiceFile = File(cacheDir, "poy_i_tochka_voice_v4.mp3")
            if (!voiceFile.exists() || voiceFile.length() == 0L) {
                assets.open("start_voice.mp3").use { input ->
                    voiceFile.outputStream().use { output ->
                        input.copyTo(output)
                    }
                }
            }
            val player = MediaPlayer()
            player.setDataSource(voiceFile.absolutePath)
            player.setVolume(1f, 1f)
            player.setOnCompletionListener {
                it.release()
                if (brandVoice === it) brandVoice = null
            }
            player.setOnErrorListener { mp, _, _ ->
                mp.release()
                if (brandVoice === mp) brandVoice = null
                true
            }
            player.prepare()
            player.start()
            brandVoice = player
        } catch (exc: Exception) {
            brandVoice = null
        }
    }

    private fun bindViews() {
        root = findViewById(R.id.root)
        webView = findViewById(R.id.webView)
        setupPanel = findViewById(R.id.setupPanel)
        configSpinner = findViewById(R.id.configSpinner)
        vpnStatus = findViewById(R.id.vpnStatus)
        connectButton = findViewById(R.id.connectButton)
        importButton = findViewById(R.id.importButton)
        openButton = findViewById(R.id.openButton)
        busy = findViewById(R.id.busy)
        errorText = findViewById(R.id.errorText)
    }

    private fun evalJs(script: String) {
        webView.post { webView.evaluateJavascript(script, null) }
    }

    private fun loadHls(url: String) {
        if (!url.startsWith("https://") && !url.startsWith("http://")) return
        stopHls()
        val player = ExoPlayer.Builder(this).build()
        hlsPlayer = player
        player.setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(C.USAGE_MEDIA)
                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                .build(),
            true
        )
        player.trackSelectionParameters = player.trackSelectionParameters
            .buildUpon()
            .setTrackTypeDisabled(C.TRACK_TYPE_VIDEO, true)
            .build()
        player.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(state: Int) {
                if (state == Player.STATE_READY) {
                    val duration = player.duration / 1000.0
                    if (duration > 0) evalJs("window.poyHlsDuration&&window.poyHlsDuration($duration)")
                } else if (state == Player.STATE_ENDED) {
                    evalJs("window.poyHlsState&&window.poyHlsState(false)")
                    evalJs("window.poyHlsEnded&&window.poyHlsEnded()")
                }
            }

            override fun onIsPlayingChanged(isPlaying: Boolean) {
                evalJs("window.poyHlsState&&window.poyHlsState($isPlaying)")
            }

            override fun onPlayerError(error: PlaybackException) {
                evalJs(
                    "window.poyHlsError&&window.poyHlsError(" +
                        JSONObject.quote(error.message ?: "HLS playback error") + ")"
                )
            }
        })
        player.setMediaItem(MediaItem.fromUri(url))
        player.prepare()
        player.playWhenReady = true
        startHlsProgress()
    }

    private fun startHlsProgress() {
        hlsProgress?.let { hlsHandler.removeCallbacks(it) }
        val runnable = object : Runnable {
            override fun run() {
                val player = hlsPlayer ?: return
                evalJs("window.poyHlsTime&&window.poyHlsTime(${player.currentPosition / 1000.0})")
                if (player.duration > 0) {
                    evalJs("window.poyHlsDuration&&window.poyHlsDuration(${player.duration / 1000.0})")
                }
                hlsHandler.postDelayed(this, 500)
            }
        }
        hlsProgress = runnable
        hlsHandler.post(runnable)
    }

    private fun stopHls() {
        hlsProgress?.let { hlsHandler.removeCallbacks(it) }
        hlsProgress = null
        hlsPlayer?.release()
        hlsPlayer = null
    }

    private fun downloadCatalogPack(url: String): File? {
        if (!url.startsWith("https://") && !url.startsWith("http://")) return null
        val target = File(cacheDir, "catalog-download-${System.currentTimeMillis()}.zip")
        var connection: HttpURLConnection? = null
        return try {
            connection = (URL(url).openConnection() as HttpURLConnection).apply {
                connectTimeout = 20_000
                readTimeout = 60_000
                instanceFollowRedirects = true
                setRequestProperty("User-Agent", "PoyITochka/0.3")
            }
            if (connection.responseCode !in 200..299) return null
            val length = connection.contentLengthLong
            if (length > 512L * 1024 * 1024) return null
            connection.inputStream.use { input ->
                target.outputStream().use { output ->
                    val buffer = ByteArray(64 * 1024)
                    var total = 0L
                    while (true) {
                        val read = input.read(buffer)
                        if (read <= 0) break
                        total += read
                        if (total > 512L * 1024 * 1024) return null
                        output.write(buffer, 0, read)
                    }
                }
            }
            target.takeIf { it.length() > 0 }
        } catch (exc: Exception) {
            target.delete()
            null
        } finally {
            connection?.disconnect()
        }
    }

    private fun bindActions() {        connectButton.setOnClickListener {
            if (VpnManager.isUp) {
                VpnManager.disconnect()
                updateUi()
                showSetup()
                return@setOnClickListener
            }
            val config = selectedConfig()
            if (config == null) {
                showError(getString(R.string.no_configs))
                return@setOnClickListener
            }
            val prepareIntent = VpnService.prepare(this)
            if (prepareIntent != null) {
                pendingConfig = config
                setBusy(true)
                vpnPermissionLauncher.launch(prepareIntent)
            } else {
                connectVpn(config)
            }
        }

        importButton.setOnClickListener {
            importLauncher.launch(arrayOf("*/*"))
        }

        openButton.setOnClickListener {
            openKaraoke()
        }
    }

    private fun selectedConfig(): File? {
        val configs = ConfigStore.list(this)
        val index = configSpinner.selectedItemPosition
        return configs.getOrNull(if (index < 0) 0 else index)
    }

    private fun refreshConfigs(selectName: String? = null) {
        val configs = ConfigStore.list(this)
        val adapter = ArrayAdapter(this, R.layout.spinner_item, configs.map { it.name })
        adapter.setDropDownViewResource(R.layout.spinner_dropdown_item)
        configSpinner.adapter = adapter
        if (selectName != null) {
            val index = configs.indexOfFirst { it.name == selectName }
            if (index >= 0) configSpinner.setSelection(index)
        }
        connectButton.isEnabled = configs.isNotEmpty() || VpnManager.isUp
    }

    private fun connectVpn(config: File, silent: Boolean = false) {
        if (!silent) setBusy(true)
        showError(null)
        lifecycleScope.launch {
            try {
                withContext(Dispatchers.IO) {
                    VpnManager.connect(applicationContext, config)
                }
                updateUi()
                openKaraoke()
            } catch (exc: Exception) {
                val message = exc.message ?: exc.javaClass.simpleName
                if (silent) showSetup()
                showError("${getString(R.string.vpn_error)}: $message")
            } finally {
                if (!silent) setBusy(false)
            }
        }
    }

    private fun setBusy(value: Boolean) {
        busy.visibility = if (value) View.VISIBLE else View.GONE
        connectButton.isEnabled = !value && (VpnManager.isUp || ConfigStore.list(this).isNotEmpty())
        importButton.isEnabled = !value
        openButton.isEnabled = !value
        if (value) {
            vpnStatus.text = getString(R.string.vpn_connecting)
            vpnStatus.setTextColor(Color.parseColor("#FFC46B"))
        }
    }

    private fun updateUi() {
        val up = VpnManager.isUp
        vpnStatus.text = if (up) getString(R.string.vpn_on) else getString(R.string.vpn_off)
        vpnStatus.setTextColor(Color.parseColor(if (up) "#4ADE80" else "#FF4D6D"))
        connectButton.text = getString(if (up) R.string.disconnect else R.string.connect)
        connectButton.isEnabled = up || ConfigStore.list(this).isNotEmpty()
    }

    private fun showError(message: String?) {
        if (message.isNullOrBlank()) {
            errorText.visibility = View.GONE
        } else {
            errorText.text = message
            errorText.visibility = View.VISIBLE
        }
    }

    private fun openKaraoke() {
        setupPanel.visibility = View.GONE
        webView.visibility = View.VISIBLE
        if (!webLoaded) {
            webView.loadUrl(BuildConfig.WEB_URL)
            webLoaded = true
        }
        webView.requestFocus()
        hideSystemUi()
    }

    private fun showSetup() {
        webView.visibility = View.GONE
        setupPanel.visibility = View.VISIBLE
        updateUi()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            loadWithOverviewMode = true
            useWideViewPort = true
            allowFileAccess = false
            cacheMode = WebSettings.LOAD_DEFAULT
        }
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)
        webView.addJavascriptInterface(YouTubeBridge(), "PoyTV")
        webView.setBackgroundColor(Color.BLACK)
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        webView.webViewClient = object : WebViewClient() {
            override fun onReceivedError(
                view: WebView?,
                request: android.webkit.WebResourceRequest?,
                error: android.webkit.WebResourceError?
            ) {
                if (request?.isForMainFrame == true) {
                    showError("Не удалось открыть ${BuildConfig.WEB_URL}. Проверь, что сервер караоке запущен.")
                }
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowCustomView(view: View?, callback: CustomViewCallback?) {
                if (customView != null) {
                    callback?.onCustomViewHidden()
                    return
                }
                customView = view
                customViewCallback = callback
                view?.let {
                    root.addView(it, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
                }
                webView.visibility = View.GONE
            }

            override fun onHideCustomView() {
                hideCustomView()
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                fileChooserCallback?.onReceiveValue(null)
                fileChooserCallback = filePathCallback
                return try {
                    val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "audio/*"
                    }
                    fileChooserLauncher.launch(intent)
                    true
                } catch (exc: Exception) {
                    fileChooserCallback = null
                    false
                }
            }
        }
    }

    private fun hideCustomView() {
        customView?.let { root.removeView(it) }
        customView = null
        customViewCallback?.onCustomViewHidden()
        customViewCallback = null
        webView.visibility = View.VISIBLE
    }

    private inner class YouTubeBridge {
        @JavascriptInterface
        fun playYouTube(videoId: String) {
            if (!videoId.matches(Regex("[A-Za-z0-9_-]{11}"))) return
            runOnUiThread { openYouTubePlayer(videoId) }
        }

        @JavascriptInterface
        fun setResultsOpen(open: Boolean) {
            resultsWindowOpen = open
        }

        @JavascriptInterface
        fun onMainMenuReady() {
            if (brandVoicePlayed) return
            runOnUiThread { playBrandVoice() }
        }

        @JavascriptInterface
        fun isTvDevice(): Boolean =
            packageManager.hasSystemFeature(PackageManager.FEATURE_LEANBACK)

        @JavascriptInterface
        fun hlsLoad(url: String) {
            runOnUiThread { loadHls(url) }
        }

        @JavascriptInterface
        fun hlsPlay() {
            runOnUiThread { hlsPlayer?.play() }
        }

        @JavascriptInterface
        fun hlsPause() {
            runOnUiThread { hlsPlayer?.pause() }
        }

        @JavascriptInterface
        fun hlsSeek(seconds: Double) {
            runOnUiThread {
                val player = hlsPlayer ?: return@runOnUiThread
                val max = if (player.duration > 0) player.duration else Long.MAX_VALUE
                player.seekTo((seconds * 1000).toLong().coerceIn(0L, max))
            }
        }

        @JavascriptInterface
        fun hlsSetVolume(value: Float) {
            runOnUiThread { hlsPlayer?.volume = value.coerceIn(0f, 1f) }
        }

        @JavascriptInterface
        fun hlsSetSpeed(value: Float) {
            runOnUiThread {
                val player = hlsPlayer ?: return@runOnUiThread
                player.playbackParameters = PlaybackParameters(
                    value.coerceIn(0.5f, 2f),
                    player.playbackParameters.pitch
                )
            }
        }

        @JavascriptInterface
        fun hlsSetPitch(value: Float) {
            runOnUiThread {
                val player = hlsPlayer ?: return@runOnUiThread
                player.playbackParameters = PlaybackParameters(
                    player.playbackParameters.speed,
                    value.coerceIn(0.5f, 2f)
                )
            }
        }

        @JavascriptInterface
        fun hlsStop() {
            runOnUiThread { stopHls() }
        }

        @JavascriptInterface
        fun importCatalogPack() {
            runOnUiThread {
                catalogLauncher.launch(arrayOf("application/zip", "application/octet-stream"))
            }
        }

        @JavascriptInterface
        fun importCatalogPackUrl(url: String) {
            runOnUiThread {
                if (!url.startsWith("https://") && !url.startsWith("http://")) {
                    webView.evaluateJavascript(
                        "window.poyCatalogError&&window.poyCatalogError('Нужна ссылка http:// или https://')",
                        null
                    )
                    return@runOnUiThread
                }
                lifecycleScope.launch {
                    val pack = withContext(Dispatchers.IO) {
                        val file = downloadCatalogPack(url) ?: return@withContext null
                        try {
                            CatalogStore.importZipFile(applicationContext, file)
                        } finally {
                            file.delete()
                        }
                    }
                    if (pack == null) {
                        webView.evaluateJavascript(
                            "window.poyCatalogError&&window.poyCatalogError('Не удалось скачать или распаковать пакет')",
                            null
                        )
                    } else {
                        webView.evaluateJavascript(
                            "window.poyCatalogUpdated&&window.poyCatalogUpdated()",
                            null
                        )
                    }
                }
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun openYouTubePlayer(videoId: String) {
        closeYouTubePlayer()
        val container = FrameLayout(this).apply { setBackgroundColor(Color.BLACK) }
        val player = WebView(this)
        player.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            loadWithOverviewMode = true
            useWideViewPort = true
            setSupportZoom(false)
            allowFileAccess = false
            userAgentString = TV_USER_AGENT
        }
        CookieManager.getInstance().setAcceptThirdPartyCookies(player, true)
        player.setBackgroundColor(Color.BLACK)
        player.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                if (url?.contains("youtube.com/tv") == true) {
                    val script = """
                        (function() {
                          var tries = 0;
                          var timer = setInterval(function() {
                            tries++;
                            var nodes = Array.prototype.slice.call(document.querySelectorAll('*'));
                            var guest = nodes.find(function(el) {
                              if (!el.offsetParent) return false;
                              if (['SCRIPT', 'STYLE', 'LINK', 'META'].indexOf(el.tagName) >= 0) return false;
                              if (el.tagName !== 'YTLR-BUTTON-RENDERER' &&
                                  el.tagName !== 'YT-BUTTON-RENDERER' &&
                                  el.tagName !== 'BUTTON' &&
                                  el.getAttribute('role') !== 'button') return false;
                              var text = (el.textContent || '').trim();
                              return /^(Войти как гость|Смотреть без входа|Пропустить)$/i.test(text);
                            });
                            if (guest) {
                              guest.click();
                            }
                            if (location.hash.indexOf('watch') === -1 && tries > 2) {
                              location.hash = '#/watch?v=$videoId';
                            }
                            if (tries > 24) clearInterval(timer);
                          }, 650);
                        })();
                    """.trimIndent()
                    view?.evaluateJavascript(script, null)
                    player.postDelayed({ tapYouTubeGuest(player) }, 4500)
                    player.postDelayed({ tapYouTubeGuest(player) }, 9500)
                }
            }
        }
        player.webChromeClient = object : WebChromeClient() {
            override fun onShowCustomView(view: View?, callback: CustomViewCallback?) {
                // YouTube TV usually plays inline; keep the player page full-screen.
                view?.let {
                    container.addView(
                        it,
                        FrameLayout.LayoutParams(
                            FrameLayout.LayoutParams.MATCH_PARENT,
                            FrameLayout.LayoutParams.MATCH_PARENT
                        )
                    )
                }
            }

            override fun onHideCustomView() {
                if (container.childCount > 1) container.removeViewAt(container.childCount - 1)
            }
        }
        container.addView(
            player,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        )
        val close = TextView(this).apply {
            text = "✕"
            setTextColor(Color.WHITE)
            textSize = 22f
            gravity = Gravity.CENTER
            setBackgroundColor(Color.argb(150, 0, 0, 0))
            setOnClickListener { closeYouTubePlayer() }
        }
        container.addView(
            close,
            FrameLayout.LayoutParams(56.dp(), 56.dp(), Gravity.TOP or Gravity.END).apply {
                setMargins(0, 18.dp(), 24.dp(), 0)
            }
        )
        root.addView(
            container,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        )
        youTubeContainer = container
        youTubeView = player
        webView.visibility = View.GONE
        setupPanel.visibility = View.GONE
        player.loadUrl("https://www.youtube.com/tv#/watch?v=$videoId")
        player.requestFocus()
        hideSystemUi()
    }

    private fun closeYouTubePlayer() {
        youTubeView?.let {
            it.stopLoading()
            it.destroy()
        }
        youTubeView = null
        youTubeContainer?.let { root.removeView(it) }
        youTubeContainer = null
        if (webLoaded) {
            webView.visibility = View.VISIBLE
            webView.requestFocus()
        } else {
            showSetup()
        }
        hideSystemUi()
    }

    private fun tapYouTubeGuest(player: WebView) {
        val js = """
            (function() {
              var nodes = Array.prototype.slice.call(document.querySelectorAll('*'));
              var guest = nodes.find(function(el) {
                if (!el.offsetParent) return false;
                if (['SCRIPT', 'STYLE', 'LINK', 'META'].indexOf(el.tagName) >= 0) return false;
                if (el.tagName !== 'YTLR-BUTTON-RENDERER' &&
                    el.tagName !== 'YT-BUTTON-RENDERER' &&
                    el.tagName !== 'BUTTON') return false;
                return /^(Войти как гость|Смотреть без входа)$/i.test((el.textContent || '').trim());
              });
              if (!guest) return '';
              var r = guest.getBoundingClientRect();
              return Math.round(r.left + r.width / 2) + ',' + Math.round(r.top + r.height / 2);
            })();
        """.trimIndent()
        player.evaluateJavascript(js) { raw ->
            val value = raw?.trim()?.trim('"') ?: return@evaluateJavascript
            val parts = value.split(',')
            if (parts.size != 2) return@evaluateJavascript
            val x = parts[0].toFloatOrNull() ?: return@evaluateJavascript
            val y = parts[1].toFloatOrNull() ?: return@evaluateJavascript
            val density = resources.displayMetrics.density
            val px = x * density
            val py = y * density
            val now = SystemClock.uptimeMillis()
            val down = MotionEvent.obtain(now, now, MotionEvent.ACTION_DOWN, px, py, 0)
            val up = MotionEvent.obtain(now, now + 60, MotionEvent.ACTION_UP, px, py, 0)
            player.dispatchTouchEvent(down)
            player.dispatchTouchEvent(up)
            down.recycle()
            up.recycle()
        }
    }

    private fun Int.dp(): Int = (this * resources.displayMetrics.density).toInt()

    companion object {
        private const val TV_USER_AGENT =
            "Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) " +
                "76.0.3809.146/6.0 TV Safari/537.36"
    }

    private fun hideSystemUi() {
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility =
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                View.SYSTEM_UI_FLAG_FULLSCREEN or
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
    }

    override fun onResume() {
        super.onResume()
        hideSystemUi()
        updateUi()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemUi()
    }

    override fun onDestroy() {
        stopHls()
        brandVoice?.release()
        brandVoice = null
        localServer?.stop()
        localServer = null
        if (isFinishing) {
            VpnManager.disconnect()
        }
        webView.destroy()
        super.onDestroy()
    }
}
