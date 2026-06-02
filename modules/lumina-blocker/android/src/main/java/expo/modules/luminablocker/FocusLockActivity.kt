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

class FocusLockActivity : Activity() {

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

                val mins =
                    remainingSeconds / 60

                val secs =
                    remainingSeconds % 60

                timerView.text =
                    String.format(
                        "%02d:%02d",
                        mins,
                        secs
                    )

                if (
                    remainingSeconds <= 0
                ) {
                    FocusSessionStore.saveSession(
                        applicationContext,
                        intent.getLongExtra("durationMs", 0L),
                        true
                    )

                    exitFocusMode()

                    return
                }

                remainingSeconds--

                timerHandler.postDelayed(
                    this,
                    1000
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
            try { startLockTask() } catch (e: Exception) { e.printStackTrace() }
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
                    Color.parseColor("#0e1412")
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
                    16f

                gravity =
                    Gravity.CENTER

                setTextColor(
                    Color.parseColor(
                        "#6f8a7b"
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
                        "#4f6a5d"
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
                        "#4caf7d"
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
                        "#355245"
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

        val durationMs =
            intent.getLongExtra(
                "durationMs",
                LuminaFocusConfig
                    .DEFAULT_FOCUS_DURATION_MS
            )

        remainingSeconds =
            (
                durationMs / 1000
            ).toInt()

        timerView.text =
            formatSeconds(
                remainingSeconds
            )
        timerHandler.post(
            timerRunnable
        )
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

                                        exitFocusMode()

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

    override fun onPause() {
        super.onPause()
        android.util.Log.d("LUMINA", "FocusLockActivity onPause")
    }

    override fun onResume() {
        super.onResume()
        enforceLock()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) enforceLock()
    }


    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        // Fire relaunch immediately before the transition happens
        relaunchSelf()
    }

    override fun onStop() {
        super.onStop()
        if (LuminaFocusService.isActive && !isFinishing) {
            relaunchSelf()
        }
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
            try { startLockTask() } catch (_: Exception) {}
        }
    }


    private fun relaunchSelf() {
        val intent = Intent(this, FocusLockActivity::class.java).apply {
            addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_SINGLE_TOP or
                Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                Intent.FLAG_ACTIVITY_NO_HISTORY
            )
        }
        startActivity(intent)
    }

    override fun onDestroy() {

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