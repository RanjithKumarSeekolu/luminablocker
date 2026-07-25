package expo.modules.luminablocker

import android.app.*
import android.content.*
import android.graphics.*
import android.graphics.drawable.GradientDrawable
import android.os.*
import android.view.*
import android.widget.*
import androidx.core.app.NotificationCompat
import expo.modules.luminablocker.LuminaFocusConfig
import android.util.Log

class LuminaFocusService : Service() {

    // ── Window & layout ───────────────────────────────────────────
    private var windowManager: WindowManager? = null
    private var overlayView: View? = null

    // ── Timer state ───────────────────────────────────────────────
    @Volatile private var totalMs: Long = LuminaFocusConfig.DEFAULT_FOCUS_DURATION_MS
    @Volatile private var remainingMs: Long = totalMs
    private var isRunning = false
    private var timerHandler = Handler(Looper.getMainLooper())
    private var timerRunnable: Runnable? = null

    // ── Volume hold state ─────────────────────────────────────────
    private var volumeHoldHandler = Handler(Looper.getMainLooper())
    private var volumeHoldRunnable: Runnable? = null
    private var isVolumeHolding = false
    private var volumeHeldSeconds = 0

    // ── Phrase cycling ────────────────────────────────────────────
    private var phraseIndex = 0
    private var phraseHandler = Handler(Looper.getMainLooper())
    private var phraseRunnable: Runnable? = null

    // ── Session tracking ──────────────────────────────────────────
    private var sessionNumber = 1
    private var todayTotalMinutes = 0

    // ── Volume broadcast receiver ─────────────────────────────────
    private val volumeReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action != ACTION_VOLUME_DOWN) return
            val pressed = intent.getBooleanExtra(EXTRA_PRESSED, false)
            onVolumeDown(pressed)
        }
    }

    private var enforcementHandler = Handler(Looper.getMainLooper())
    private var enforcementRunnable: Runnable? = null

    companion object {
        const val CHANNEL_ID      = "lumina_focus"
        const val NOTIF_ID        = 42
        const val EXTRA_DURATION  = "durationMs"
        const val EXTRA_HEADLESS  = "headless"
        const val ACTION_VOLUME_DOWN = "lumina.VOLUME_DOWN_PRESSED"
        const val EXTRA_PRESSED   = "pressed"

        @Volatile
        var isActive = false
            set(value) {
                android.util.Log.d(
                    "LUMINA",
                    "isActive -> $value"
                )
                field = value
            }

        private val PHRASES = listOf(
            "Your phone cannot reach you here.\nStay present.",
            "One task. One moment.\nYou've got this.",
            "Deep work is the superpower\nof our distracted age.",
            "Every minute here\nis reclaimed from noise.",
            "The best ideas arrive\nin silence."
        )


        fun start(
            ctx: Context,
            durationMs: Long = LuminaFocusConfig.DEFAULT_FOCUS_DURATION_MS,
            headless: Boolean = false
        ) {
            val intent = Intent(ctx, LuminaFocusService::class.java).apply {
                putExtra(EXTRA_DURATION, durationMs)
                putExtra(EXTRA_HEADLESS, headless)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(intent)
            } else {
                ctx.startService(intent)
            }
        }

        fun stop(ctx: Context) {
            ctx.stopService(Intent(ctx, LuminaFocusService::class.java))
        }
    }

    // ── Lifecycle ─────────────────────────────────────────────────

    override fun onCreate() {
        super.onCreate()
        android.util.Log.d(
            "LUMINA",
            "SERVICE CREATED hash=${System.identityHashCode(this)}"
        )
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        isActive = true
        getSharedPreferences(
            "LuminaPrefs",
            MODE_PRIVATE
        ).edit()
            .putBoolean("focus_active", true)
            .apply()
        createNotificationChannel()
        startForeground(NOTIF_ID, buildNotification("Focus mode active"))
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(volumeReceiver, IntentFilter(ACTION_VOLUME_DOWN), RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(volumeReceiver, IntentFilter(ACTION_VOLUME_DOWN))
        }
    }

    private fun startEnforcementLoop() {
        stopEnforcementLoop()
        enforcementRunnable = object : Runnable {
            override fun run() {
                if (!isActive) return
                if (FocusLockActivity.isVisible || !FocusLockActivity.allowRelaunch()) {
                    enforcementHandler.postDelayed(this, 800)
                    return
                }
                val intent = Intent(
                    applicationContext,
                    FocusLockActivity::class.java
                ).apply {
                    addFlags(
                        Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP or
                        Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
                    )
                }
                try {
                    applicationContext.startActivity(intent)
                } catch (_: Exception) {}
                enforcementHandler.postDelayed(this, 800) // every 800ms
            }
        }
        // Give startFocusLock's direct activity launch time to settle before
        // the watchdog performs its first recovery check.
        enforcementHandler.postDelayed(enforcementRunnable!!, 800)
    }

    private fun stopEnforcementLoop() {
        enforcementRunnable?.let { enforcementHandler.removeCallbacks(it) }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        totalMs    = intent?.getLongExtra(EXTRA_DURATION, LuminaFocusConfig.DEFAULT_FOCUS_DURATION_MS) ?: (LuminaFocusConfig.DEFAULT_FOCUS_DURATION_MS)
        remainingMs = totalMs
        if (intent?.getBooleanExtra(EXTRA_HEADLESS, false) == true) {
            // FocusLockActivity owns the visible UI for the lock flow. The
            // service remains foreground/headless so it can enforce the lock.
            removeOverlay()
        } else {
            showOverlay()
        }
        startEnforcementLoop()
        return START_STICKY
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)

        android.util.Log.d(
            "LUMINA",
            "onTaskRemoved"
        )
    }

    override fun onDestroy() {
        android.util.Log.d(
            "LUMINA",
            "SERVICE onDestroy START"
        )
        super.onDestroy()
        android.util.Log.d(
            "LUMINA",
            "LuminaFocusService destroyed"
        )
        isActive = false
        stopEnforcementLoop()
        stopTimer()
        stopPhraseLoop()
        removeOverlay()
        try { unregisterReceiver(volumeReceiver) } catch (e: Exception) {}
        android.util.Log.d(
            "LUMINA",
            "SERVICE onDestroy END"
        )
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // ── Overlay ───────────────────────────────────────────────────

    private fun showOverlay() {
        removeOverlay()

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            else
                WindowManager.LayoutParams.TYPE_SYSTEM_ALERT,

            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
            WindowManager.LayoutParams.FLAG_FULLSCREEN or
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,

            PixelFormat.OPAQUE
        ).apply {
            gravity = Gravity.TOP or Gravity.START
        }

        val view = buildOverlayView()

        view.isFocusable = true

        view.isFocusableInTouchMode = true

        view.requestFocus()
        overlayView = view
        view.systemUiVisibility =
        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
        View.SYSTEM_UI_FLAG_FULLSCREEN or
        View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
        View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
        View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        windowManager?.addView(view, params)
    }

    private fun removeOverlay() {
         android.util.Log.d(
            "LUMINA",
            "Removing overlay"
        )
        overlayView?.let {
            try { windowManager?.removeView(it) } catch (e: Exception) {}
        }
        overlayView = null
    }

    // ── UI builder ────────────────────────────────────────────────

    private fun buildOverlayView(): View {
        val ctx = this

        // ── Root scroll + container ───────────────────────────────
        val scroll = object : ScrollView(ctx) {

            override fun dispatchKeyEvent(
                event: KeyEvent
            ): Boolean {

                if (
                    event.keyCode ==
                    KeyEvent.KEYCODE_VOLUME_DOWN
                ) {

                    onVolumeDown(
                        event.action ==
                        KeyEvent.ACTION_DOWN
                    )

                    return true
                }

                return super.dispatchKeyEvent(event)
            }
        }.apply {

            setBackgroundColor(
                Color.parseColor("#0e1412")
            )

            isVerticalScrollBarEnabled = false
        }

        scroll.isClickable = true
        scroll.isFocusable = true
        scroll.isFocusableInTouchMode = true

        val root = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(24), dp(56), dp(24), dp(40))
        }
        scroll.addView(root)

        // ── Status bar row ────────────────────────────────────────
        val statusRow = LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dp(32) }
        }
        val clockView = TextView(ctx).apply {
            text = currentTimeString()
            textSize = 13f
            setTextColor(Color.parseColor("#e8f0eb"))
            typeface = Typeface.DEFAULT_BOLD
        }
        val spacer = View(ctx).apply {
            layoutParams = LinearLayout.LayoutParams(0, 1, 1f)
        }
        val batteryIcon = TextView(ctx).apply {
            text = "● ● ○"
            textSize = 10f
            setTextColor(Color.parseColor("#2a4a38"))
        }
        statusRow.addView(clockView)
        statusRow.addView(spacer)
        statusRow.addView(batteryIcon)
        root.addView(statusRow)

        // ── FOCUS MODE chip ───────────────────────────────────────
        val chip = TextView(ctx).apply {
            text = "FOCUS MODE"
            textSize = 11f
            setTextColor(Color.parseColor("#4caf7d"))
            typeface = Typeface.DEFAULT_BOLD
            setPadding(dp(14), dp(6), dp(14), dp(6))
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#1c2b24"))
                cornerRadius = dp(20).toFloat()
                setStroke(1, Color.parseColor("#2a4a38"))
            }
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dp(36) }
        }
        root.addView(chip)

        // ── Ring + timer ──────────────────────────────────────────
        val ringSize = dp(220)
        val ringView = RingTimerView(ctx, totalMs).apply {
            layoutParams = LinearLayout.LayoutParams(ringSize, ringSize).apply {
                bottomMargin = dp(36)
            }
        }
        ringView.tag = "ring"
        root.addView(ringView)

        // ── Phrase ────────────────────────────────────────────────
        val phraseView = TextView(ctx).apply {
            tag = "phrase"
            text = PHRASES[0]
            textSize = 14f
            setTextColor(Color.parseColor("#5a7a68"))
            gravity = Gravity.CENTER
            setLineSpacing(0f, 1.6f)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dp(36) }
        }
        root.addView(phraseView)

        // ── Volume hold hint ──────────────────────────────────────
        val volCard = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(10), dp(16), dp(10))
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#111c17"))
                cornerRadius = dp(14).toFloat()
                setStroke(1, Color.parseColor("#1c2b24"))
            }
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dp(24) }
        }
        val volRow = LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val volIcon = TextView(ctx).apply {
            text = "▼"
            textSize = 14f
            setTextColor(Color.parseColor("#2a4a38"))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { rightMargin = dp(10) }
        }
        val volText = TextView(ctx).apply {
            text =
                "Hold volume down ${
                    LuminaFocusConfig
                        .VOLUME_HOLD_EXIT_DURATION_MS / 1000
                }s to exit early"
            textSize = 12f
            setTextColor(Color.parseColor("#2a4a38"))
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        volRow.addView(volIcon)
        volRow.addView(volText)
        volCard.addView(volRow)

        // Volume progress bar
        val volProgressBg = FrameLayout(ctx).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(2)
            ).apply { topMargin = dp(8) }
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#1c2b24"))
                cornerRadius = dp(2).toFloat()
            }
        }
        val volProgressFill = View(ctx).apply {
            tag = "volFill"
            layoutParams = FrameLayout.LayoutParams(0, dp(2))
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#4caf7d"))
                cornerRadius = dp(2).toFloat()
            }
        }
        volProgressBg.addView(volProgressFill)
        volCard.addView(volProgressBg)
        root.addView(volCard)
        Log.d("LUMINA", "Volume exit allowed: ${LuminaFocusConfig.ALLOW_VOLUME_EXIT}")
        volCard.visibility = if (LuminaFocusConfig.ALLOW_VOLUME_EXIT) View.VISIBLE else View.GONE

        // ── Session stats row ─────────────────────────────────────
        val statsRow = LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dp(16) }
        }
        statsRow.addView(statPill(ctx, "session", ordinal(sessionNumber), "session"))
        statsRow.addView(statPill(ctx, "today", "${todayTotalMinutes}m", "todayTotal"))
        statsRow.addView(statPill(ctx, "streak", "3 days", null))
        root.addView(statsRow)

        // ── Duration selector ─────────────────────────────────────
        val durRow = LinearLayout(ctx).apply {
            tag = "durRow"
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dp(24) }
        }
        LuminaFocusConfig.FOCUS_DURATION_LABELS.forEachIndexed { i, label ->
            val isSelected = LuminaFocusConfig.FOCUS_DURATIONS[i] == totalMs
            val btn = TextView(ctx).apply {
                text = label
                textSize = 13f
                gravity = Gravity.CENTER
                setTextColor(if (isSelected) Color.parseColor("#4caf7d") else Color.parseColor("#5a7a68"))
                background = GradientDrawable().apply {
                    setColor(if (isSelected) Color.parseColor("#1c2b24") else Color.parseColor("#111c17"))
                    cornerRadius = dp(12).toFloat()
                    setStroke(1, if (isSelected) Color.parseColor("#4caf7d") else Color.parseColor("#1c2b24"))
                }
                setPadding(0, dp(10), 0, dp(10))
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                    if (i < LuminaFocusConfig.FOCUS_DURATION_LABELS.size - 1) rightMargin = dp(8)
                }
            }
            btn.setOnClickListener {
                if (isRunning) return@setOnClickListener
                totalMs = LuminaFocusConfig.FOCUS_DURATIONS[i]
                remainingMs = totalMs
                // Update all buttons
                for (j in 0 until durRow.childCount) {
                    val b = durRow.getChildAt(j) as TextView
                    val sel = j == i
                    b.setTextColor(if (sel) Color.parseColor("#4caf7d") else Color.parseColor("#5a7a68"))
                    (b.background as GradientDrawable).apply {
                        setColor(if (sel) Color.parseColor("#1c2b24") else Color.parseColor("#111c17"))
                        setStroke(1, if (sel) Color.parseColor("#4caf7d") else Color.parseColor("#1c2b24"))
                    }
                }
                ringView.updateProgress(totalMs, remainingMs)
            }
            durRow.addView(btn)
        }
        root.addView(durRow)

        // ── Start button ──────────────────────────────────────────
        val startBtn = TextView(ctx).apply {
            tag = "startBtn"
            text = "▶  Start focus session"
            textSize = 15f
            setTextColor(Color.parseColor("#e8f0eb"))
            gravity = Gravity.CENTER
            typeface = Typeface.DEFAULT_BOLD
            setPadding(0, dp(18), 0, dp(18))
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#1a5c3a"))
                cornerRadius = dp(24).toFloat()
            }
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }
        startBtn.setOnClickListener {
            if (!isRunning) {
                startTimer(ringView, phraseView, startBtn, durRow, volProgressFill)
            } else {
                pauseTimer(startBtn)
            }
        }
        root.addView(startBtn)

        return scroll
    }

    // ── Stat pill helper ──────────────────────────────────────────

    private fun statPill(ctx: Context, label: String, value: String, tag: String?): LinearLayout {
        return LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(14), dp(12), dp(14), dp(12))
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#111c17"))
                cornerRadius = dp(14).toFloat()
                setStroke(1, Color.parseColor("#1c2b24"))
            }
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                rightMargin = dp(10)
            }
            addView(TextView(ctx).apply {
                text = label
                textSize = 11f
                setTextColor(Color.parseColor("#2a4a38"))
            })
            addView(TextView(ctx).apply {
                this.tag = tag
                text = value
                textSize = 16f
                setTextColor(Color.parseColor("#7ab89a"))
                typeface = Typeface.DEFAULT_BOLD
            })
        }
    }

    // ── Timer logic ───────────────────────────────────────────────

    private fun startTimer(
        ringView: RingTimerView,
        phraseView: TextView,
        startBtn: TextView,
        durRow: LinearLayout,
        volFill: View
    ) {
        isRunning = true
        FocusSessionStore.beginSession(applicationContext, totalMs)
        startBtn.text = "⏸  Pause"
        durRow.alpha = 0.3f

        timerRunnable = object : Runnable {
            override fun run() {
                if (remainingMs <= 0) {
                    onComplete(ringView, phraseView, startBtn, durRow)
                    return
                }
                remainingMs -= 1000
                ringView.updateProgress(totalMs, remainingMs)
                updateNotification(formatTime(remainingMs))
                timerHandler.postDelayed(this, 1000)
            }
        }
        timerHandler.postDelayed(timerRunnable!!, 1000)

        // Phrase cycling every 2 minutes
        startPhraseLoop(phraseView)
    }

    private fun pauseTimer(startBtn: TextView) {
        isRunning = false
        timerRunnable?.let { timerHandler.removeCallbacks(it) }
        stopPhraseLoop()
        startBtn.text = "▶  Resume"
    }

    private fun stopTimer() {
        isRunning = false
        timerRunnable?.let { timerHandler.removeCallbacks(it) }
    }

    private fun onComplete(
        ringView: RingTimerView,
        phraseView: TextView,
        startBtn: TextView,
        durRow: LinearLayout
    ) {
        isRunning = false
        stopPhraseLoop()

        // ← Save FIRST
        FocusSessionStore.saveSession(
            applicationContext,
            totalMs,  // completed = always full duration
            totalMs,  // target = also full duration
            true
        )
        FocusSessionStore.clearActiveSession(applicationContext)

        todayTotalMinutes += (totalMs / 60000).toInt()
        sessionNumber++
        overlayView?.findViewWithTag<TextView>("session")?.text = ordinal(sessionNumber)
        overlayView?.findViewWithTag<TextView>("todayTotal")?.text = "${todayTotalMinutes}m"
        phraseView.text = "Session complete.\nWell done — take a short break."
        startBtn.text = "▶  Start focus session"
        durRow.alpha = 1f
        remainingMs = totalMs  // ← reset AFTER save
        ringView.updateProgress(totalMs, remainingMs)

        LuminaBlockerModule.emitEvent("onFocusComplete", mapOf("completed" to true))
        updateNotification("Session complete!")
    }

    // ── Phrase loop ───────────────────────────────────────────────

    private fun startPhraseLoop(phraseView: TextView) {
        phraseRunnable = object : Runnable {
            override fun run() {
                phraseIndex = (phraseIndex + 1) % PHRASES.size
                phraseView.post { phraseView.text = PHRASES[phraseIndex] }
                phraseHandler.postDelayed(this,LuminaFocusConfig.PHRASE_ROTATION_INTERVAL_MS)
            }
        }
        phraseHandler.postDelayed(phraseRunnable!!, LuminaFocusConfig.PHRASE_ROTATION_INTERVAL_MS)
    }

    private fun stopPhraseLoop() {
        phraseRunnable?.let { phraseHandler.removeCallbacks(it) }
    }

    // ── Volume hold ───────────────────────────────────────────────

    fun onVolumeDown(pressed: Boolean) {
        if (!LuminaFocusConfig.ALLOW_VOLUME_EXIT) return
        if (pressed && !isVolumeHolding) {
            isVolumeHolding = true
            volumeHeldSeconds = 0
            volumeHoldRunnable = object : Runnable {
                override fun run() {
                    volumeHeldSeconds++
                    // Update progress bar
                    val fillPct =
                                (
                                    volumeHeldSeconds.toFloat() /
                                    (
                                        LuminaFocusConfig
                                            .VOLUME_HOLD_EXIT_DURATION_MS / 1000f
                                    )
                                )
                    overlayView?.findViewWithTag<View>("volFill")?.let { fill ->
                        val parent = fill.parent as? FrameLayout ?: return@let
                        fill.post {
                            val newWidth = (parent.width * fillPct).toInt()
                            fill.layoutParams = FrameLayout.LayoutParams(newWidth, dp(2))
                            fill.requestLayout()
                        }
                    }
                    if (volumeHeldSeconds >=     (
                        LuminaFocusConfig
                            .VOLUME_HOLD_EXIT_DURATION_MS / 1000
                    )) {
                        exitEarly()
                    } else {
                        volumeHoldHandler.postDelayed(this, LuminaFocusConfig.VOLUME_HOLD_TICK_INTERVAL_MS)
                    }
                }
            }
            volumeHoldHandler.postDelayed(volumeHoldRunnable!!, LuminaFocusConfig.VOLUME_HOLD_TICK_INTERVAL_MS)

        } else if (!pressed) {
            cancelVolumeHold()
        }
    }

    private fun cancelVolumeHold() {
        isVolumeHolding = false
        volumeHeldSeconds = 0
        volumeHoldRunnable?.let { volumeHoldHandler.removeCallbacks(it) }
        // Reset progress bar
        overlayView?.findViewWithTag<View>("volFill")?.let { fill ->
            fill.post {
                fill.layoutParams = FrameLayout.LayoutParams(0, dp(2))
                fill.requestLayout()
            }
        }
    }

    private fun exitEarly() {
        cancelVolumeHold()
        LuminaBlockerModule.emitEvent(
            "onFocusComplete",
            mapOf("completed" to false)
        )
        getSharedPreferences(
            "LuminaPrefs",
            MODE_PRIVATE
        ).edit()
            .putBoolean("focus_active", false)
            .apply()

        FocusSessionStore.saveSession(
            applicationContext,
            totalMs - remainingMs,  // actual time spent
            totalMs,
            false
        )
        FocusSessionStore.clearActiveSession(applicationContext)
        stopSelf()
    }

    // ── Notification ──────────────────────────────────────────────

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Focus Mode",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Lumina focus mode is active"
                setShowBadge(false)
            }
            getSystemService(NotificationManager::class.java)
                .createNotificationChannel(channel)
        }
    }

    private fun buildNotification(text: String): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Focus Mode Active")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setOngoing(true)
            .setSilent(true)
            .build()
    }

    private fun updateNotification(text: String) {
        val notification = buildNotification(text)
        getSystemService(NotificationManager::class.java).notify(NOTIF_ID, notification)
    }

    // ── Helpers ───────────────────────────────────────────────────

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt()

    private fun formatTime(ms: Long): String {
        val total = ms / 1000
        val m = total / 60
        val s = total % 60
        return "%02d:%02d".format(m, s)
    }

    private fun currentTimeString(): String {
        val cal = java.util.Calendar.getInstance()
        val h = cal.get(java.util.Calendar.HOUR_OF_DAY)
        val m = cal.get(java.util.Calendar.MINUTE)
        return "%02d:%02d".format(h, m)
    }

    private fun ordinal(n: Int): String {
        val suffix = when {
            n % 100 in 11..13 -> "th"
            n % 10 == 1       -> "st"
            n % 10 == 2       -> "nd"
            n % 10 == 3       -> "rd"
            else              -> "th"
        }
        return "$n$suffix"
    }
}

// ── Ring timer view ───────────────────────────────────────────────────────────

class RingTimerView(ctx: android.content.Context, private var totalMs: Long) : android.view.View(ctx) {

    private var remainingMs: Long = totalMs

    private val trackPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = dp(8).toFloat()
        color = Color.parseColor("#1c2b24")
        strokeCap = Paint.Cap.ROUND
    }
    private val progressPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = dp(8).toFloat()
        color = Color.parseColor("#4caf7d")
        strokeCap = Paint.Cap.ROUND
    }
    private val timerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#e8f0eb")
        textSize = dp(44).toFloat()
        textAlign = Paint.Align.CENTER
        typeface = Typeface.DEFAULT_BOLD
    }
    private val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#5a7a68")
        textSize = dp(12).toFloat()
        textAlign = Paint.Align.CENTER
    }
    private val subPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#4caf7d")
        textSize = dp(11).toFloat()
        textAlign = Paint.Align.CENTER
    }
    private val oval = android.graphics.RectF()

    fun updateProgress(total: Long, remaining: Long) {
        totalMs = total
        remainingMs = remaining
        // Color shift: green → amber → deep orange
        progressPaint.color = when {
            remaining < totalMs * 0.25f -> Color.parseColor("#9a5a2a")
            remaining < totalMs * 0.50f -> Color.parseColor("#9a8a2a")
            else                        -> Color.parseColor("#4caf7d")
        }
        postInvalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val cx = width / 2f
        val cy = height / 2f
        val radius = (minOf(width, height) / 2f) - dp(12)

        oval.set(cx - radius, cy - radius, cx + radius, cy + radius)

        // Track
        canvas.drawCircle(cx, cy, radius, trackPaint)

        // Progress arc (starts at top = -90°)
        val pct = if (totalMs > 0) remainingMs.toFloat() / totalMs else 0f
        val sweep = 360f * pct
        canvas.drawArc(oval, -90f, sweep, false, progressPaint)

        // Timer text
        val total = remainingMs / 1000
        val m = total / 60
        val s = total % 60
        val timeStr = "%02d:%02d".format(m, s)

        val labelY = cy - dp(20)
        val timerY = cy + dp(16)
        val subY   = cy + dp(32)

        canvas.drawText("remaining", cx, labelY, labelPaint)
        canvas.drawText(timeStr, cx, timerY, timerPaint)
        canvas.drawText("deep work", cx, subY, subPaint)
    }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt()
}
