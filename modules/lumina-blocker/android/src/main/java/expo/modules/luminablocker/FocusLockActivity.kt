package expo.modules.luminablocker

import android.app.Activity
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import android.content.Intent
import android.app.ActivityManager

class FocusLockActivity : Activity() {

    companion object {
        @Volatile
        var isVisible = false

        private var lastRelaunchAt = 0L

        @Synchronized
        fun allowRelaunch(): Boolean {
            val now = System.currentTimeMillis()
            if (now - lastRelaunchAt < 1_500L) return false
            lastRelaunchAt = now
            return true
        }
    }

    // ─────────────────────────────────────────────
    // Handlers
    // ─────────────────────────────────────────────

    private val timerHandler =
        Handler(Looper.getMainLooper())

    private val volumeHandler =
        Handler(Looper.getMainLooper())

    // ─────────────────────────────────────────────
    // UI
    // ─────────────────────────────────────────────

    private lateinit var timerView: TextView

    private lateinit var subtitleView: TextView

    private lateinit var holdProgressText: TextView

    private lateinit var holdProgressBar: View

    // ─────────────────────────────────────────────
    // Timer State
    // ─────────────────────────────────────────────

    private var remainingSeconds =0

    private var totalSessionDurationMs = 0L

    private var sessionStartMs = 0L
    private var sessionFinalized = false

    // ─────────────────────────────────────────────
    // Volume Hold State
    // ─────────────────────────────────────────────

    private var isHoldingVolume =
        false

    private var holdSeconds =
        0

    private var holdRunnable:
        Runnable? = null

    // ─────────────────────────────────────────────
    // Timer Runnable
    // ─────────────────────────────────────────────

    private val timerRunnable =
        object : Runnable {

            override fun run() {

                val remainingMs = (totalSessionDurationMs - elapsedSessionMs())
                    .coerceAtLeast(0L)
                remainingSeconds = ((remainingMs + 999L) / 1000L).toInt()

                val mins = remainingSeconds / 60
                val secs = remainingSeconds % 60

                timerView.text =
                    String.format(
                        "%02d:%02d",
                        mins,
                        secs
                    )

                if (remainingMs <= 0L) {
                    finalizeSession(true)
                    return
                }
                timerHandler.postDelayed(
                    this,
                    minOf(1000L, remainingMs)
                )
            }
        }

    // ─────────────────────────────────────────────
    // Lifecycle
    // ─────────────────────────────────────────────

    override fun onCreate(
        savedInstanceState: Bundle?
    ) {
        super.onCreate(savedInstanceState)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }

        window.addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        )

        if (LuminaFocusConfig.ENABLE_IMMERSIVE_MODE) {
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                View.SYSTEM_UI_FLAG_FULLSCREEN or
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            )
        }

        if (LuminaFocusConfig.ENABLE_KIOSK_BEHAVIOR) {
            ensureLockTask()
        }

        // ─────────────────────────────────────────
        // Root Layout
        // ─────────────────────────────────────────

        val root =
            LinearLayout(this).apply {

                orientation =
                    LinearLayout.VERTICAL

                gravity =
                    Gravity.CENTER

                setBackgroundColor(
                    Color.parseColor("#000000")
                )

                setPadding(
                    dp(24),
                    dp(24),
                    dp(24),
                    dp(24)
                )
            }

        // ─────────────────────────────────────────
        // Title
        // ─────────────────────────────────────────

        val title =
            TextView(this).apply {

                text =
                    "Focus Mode"

                textSize =
                    28f

                gravity =
                    Gravity.CENTER

                setTextColor(
                    Color.WHITE
                )
            }

        // ─────────────────────────────────────────
        // Timer
        // ─────────────────────────────────────────

        timerView =
            TextView(this).apply {

                text =
                    formatSeconds(
                        remainingSeconds
                    )

                textSize =
                    72f

                gravity =
                    Gravity.CENTER

                setTextColor(
                    Color.WHITE
                )

                setPadding(
                    0,
                    dp(24),
                    0,
                    dp(12)
                )
            }

        // ─────────────────────────────────────────
        // Subtitle
        // ─────────────────────────────────────────

        subtitleView =
            TextView(this).apply {

                text =
                    "Stay present.\nYour device is locked."

                textSize =
                    14f

                gravity =
                    Gravity.CENTER

                setTextColor(
                    Color.parseColor(
                        "#8A8A94"
                    )
                )
            }

        // ─────────────────────────────────────────
        // Hold Progress Text
        // ─────────────────────────────────────────

        holdProgressText =
            TextView(this).apply {

                text =
                    "Hold volume down to exit"

                textSize =
                    13f

                gravity =
                    Gravity.CENTER

                setTextColor(
                    Color.parseColor(
                        "#8A8A94"
                    )
                )

                setPadding(
                    0,
                    dp(28),
                    0,
                    dp(12)
                )
            }

        // ─────────────────────────────────────────
        // Progress Background
        // ─────────────────────────────────────────

        val progressBg =
            LinearLayout(this).apply {

                layoutParams =
                    LinearLayout.LayoutParams(
                        dp(220),
                        dp(6)
                    )

                setBackgroundColor(
                    Color.parseColor(
                        "#1d2b24"
                    )
                )
            }

        // ─────────────────────────────────────────
        // Progress Fill
        // ─────────────────────────────────────────

        holdProgressBar =
            View(this).apply {

                layoutParams =
                    LinearLayout.LayoutParams(
                        0,
                        dp(6)
                    )

                setBackgroundColor(
                    Color.parseColor(
                        "#8A8A94"
                    )
                )
            }

        progressBg.addView(
            holdProgressBar
        )

        // ─────────────────────────────────────────
        // Exit Hint
        // ─────────────────────────────────────────

        val exitHint =
            TextView(this).apply {

                text =
                    "Hold volume down ${
                        LuminaFocusConfig
                            .VOLUME_HOLD_EXIT_DURATION_MS / 1000
                    }s to exit"

                textSize =
                    12f

                gravity =
                    Gravity.CENTER

                setTextColor(
                    Color.parseColor(
                        "#8A8A94"
                    )
                )

                setPadding(
                    0,
                    dp(14),
                    0,
                    0
                )
            }

        // ─────────────────────────────────────────
        // Assemble UI
        // ─────────────────────────────────────────

        root.addView(title)

        root.addView(timerView)

        root.addView(subtitleView)

        if (LuminaFocusConfig.ALLOW_VOLUME_EXIT) {
            root.addView(holdProgressText)
            root.addView(progressBg)
            root.addView(exitHint)
        }

        setContentView(root)

        // ─────────────────────────────────────────
        // Start Timer
        // ─────────────────────────────────────────

        val requestedDurationMs = intent.getLongExtra(
            "durationMs",
            LuminaFocusConfig.DEFAULT_FOCUS_DURATION_MS
        )
        val activeSession = FocusSessionStore.getActiveSession(applicationContext)
        if (activeSession != null) {
            sessionStartMs = activeSession.first
            totalSessionDurationMs = activeSession.second
        } else {
            sessionStartMs = FocusSessionStore.beginSession(
                applicationContext,
                requestedDurationMs
            )
            totalSessionDurationMs = requestedDurationMs
        }

        remainingSeconds = ((totalSessionDurationMs - elapsedSessionMs())
            .coerceAtLeast(0L) + 999L).div(1000L).toInt()

        timerView.text =
            formatSeconds(
                remainingSeconds
            )
        timerHandler.post(
            timerRunnable
        )
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        if (intent != null) setIntent(intent)
        enforceLock()
    }

    // ─────────────────────────────────────────────
    // Volume Hold Exit
    // ─────────────────────────────────────────────

    override fun dispatchKeyEvent(
        event: KeyEvent
    ): Boolean {

        if (
            event.keyCode ==
            KeyEvent.KEYCODE_VOLUME_DOWN
        ) {

            when (
                event.action
            ) {

                KeyEvent.ACTION_DOWN -> {
                    if (!LuminaFocusConfig.ALLOW_VOLUME_EXIT) return true 

                    if (!isHoldingVolume) {

                        isHoldingVolume =
                            true

                        holdSeconds =
                            0

                        subtitleView.text =
                            "Keep holding volume down..."

                        holdRunnable =
                            object : Runnable {

                                override fun run() {

                                    if (
                                        !isHoldingVolume
                                    ) {
                                        return
                                    }

                                    holdSeconds++

                                    val requiredSeconds =
                                        (
                                            LuminaFocusConfig
                                                .VOLUME_HOLD_EXIT_DURATION_MS / 1000
                                        ).toInt()

                                    holdProgressText.text =
                                        "Holding... ${
                                            holdSeconds
                                        }s / ${
                                            requiredSeconds
                                        }s"

                                    val progress =
                                        holdSeconds.toFloat() /
                                        requiredSeconds.toFloat()

                                    val width =
                                        (
                                            dp(220) * progress
                                        ).toInt()

                                    holdProgressBar.layoutParams =
                                        LinearLayout.LayoutParams(
                                            width,
                                            dp(6)
                                        )

                                    holdProgressBar.requestLayout()

                                    if (
                                        holdSeconds >=
                                        requiredSeconds
                                    ) {

                                        finalizeSession(false)

                                    } else {

                                        volumeHandler.postDelayed(
                                            this,
                                            LuminaFocusConfig
                                                .VOLUME_HOLD_TICK_INTERVAL_MS
                                        )
                                    }
                                }
                            }

                        volumeHandler.postDelayed(
                            holdRunnable!!,
                            LuminaFocusConfig
                                .VOLUME_HOLD_TICK_INTERVAL_MS
                        )
                    }

                    return true
                }

                KeyEvent.ACTION_UP -> {

                    cancelVolumeHold()

                    return true
                }
            }
        }

        return super.dispatchKeyEvent(
            event
        )
    }

    private fun cancelVolumeHold() {

        isHoldingVolume =
            false

        holdSeconds =
            0

        subtitleView.text =
            "Stay present.\nYour device is locked."

        holdProgressText.text =
            "Hold volume down to exit"

        holdProgressBar.layoutParams =
            LinearLayout.LayoutParams(
                0,
                dp(6)
            )

        holdProgressBar.requestLayout()

        holdRunnable?.let {

            volumeHandler.removeCallbacks(it)
        }
    }

    // ─────────────────────────────────────────────
    // Exit Focus Mode
    // ─────────────────────────────────────────────

    private fun elapsedSessionMs(): Long {
        return (System.currentTimeMillis() - sessionStartMs)
            .coerceIn(0L, totalSessionDurationMs)
    }

    private fun finalizeSession(completed: Boolean) {
        if (sessionFinalized) return
        sessionFinalized = true

        val durationMs = if (completed) {
            totalSessionDurationMs
        } else {
            elapsedSessionMs()
        }
        FocusSessionStore.saveSession(
            applicationContext,
            durationMs,
            totalSessionDurationMs,
            completed
        )
        FocusSessionStore.clearActiveSession(applicationContext)
        LuminaBlockerModule.emitEvent(
            "onFocusComplete",
            mapOf("completed" to completed)
        )
        exitFocusMode()
    }

    // private fun exitFocusMode() {

    //     try {
    //         stopLockTask()
    //     } catch (_: Exception) {}

    //     LuminaFocusService.stop(this)

    //     Handler(
    //         Looper.getMainLooper()
    //     ).postDelayed({

    //         finishAffinity()

    //         finishAndRemoveTask()

    //         finish()

    //     }, 300)
    // }

    //redirect to the app

    private fun exitFocusMode() {

        try {
            stopLockTask()
        } catch (_: Exception) {}

        LuminaFocusService.stop(this)

        finish()
    }

    // ─────────────────────────────────────────────
    // Block Back
    // ─────────────────────────────────────────────

    override fun onBackPressed() {

        // Block back button
    }

    // ─────────────────────────────────────────────
    // Cleanup
    // ─────────────────────────────────────────────

    override fun onResume() {
        super.onResume()
        isVisible = true
        enforceLock()
    }

    override fun onPause() {
        isVisible = false
        super.onPause()
        android.util.Log.d("LUMINA", "FocusLockActivity onPause")
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) enforceLock()
    }

    override fun onStop() {
        super.onStop()
        isVisible = false
    }

    private fun enforceLock() {
        if (!LuminaFocusService.isActive || isFinishing) return

        if (LuminaFocusConfig.ENABLE_IMMERSIVE_MODE) {
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                View.SYSTEM_UI_FLAG_FULLSCREEN or
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            )
        }

        if (LuminaFocusConfig.ENABLE_KIOSK_BEHAVIOR) {
            ensureLockTask()
        }
    }

    private fun ensureLockTask() {
        val activityManager = getSystemService(ActivityManager::class.java)
        val lockTaskActive = activityManager?.lockTaskModeState !=
            ActivityManager.LOCK_TASK_MODE_NONE
        if (!lockTaskActive) {
            try { startLockTask() } catch (_: Exception) {}
        }
    }


    private fun relaunchSelf() {
        val intent = Intent(this, FocusLockActivity::class.java).apply {

            putExtra(
                "durationMs",
                totalSessionDurationMs
            )

            addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_SINGLE_TOP or
                Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
            )
        }

        startActivity(intent)
    }

    override fun onDestroy() {

        isVisible = false

        super.onDestroy()

        android.util.Log.d(
            "LUMINA",
            "FocusLockActivity destroyed"
        )

        timerHandler.removeCallbacks(
            timerRunnable
        )

        holdRunnable?.let {

            volumeHandler.removeCallbacks(it)
        }

        window?.decorView?.clearFocus()
    }

    // ─────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────

    private fun formatSeconds(
        totalSeconds: Int
    ): String {

        val mins =
            totalSeconds / 60

        val secs =
            totalSeconds % 60

        return String.format(
            "%02d:%02d",
            mins,
            secs
        )
    }

    private fun dp(
        value: Int
    ): Int {

        return (
            value *
            resources.displayMetrics.density
        ).toInt()
    }
}
