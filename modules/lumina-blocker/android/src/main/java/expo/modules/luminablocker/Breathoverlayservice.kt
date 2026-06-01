package expo.modules.luminablocker

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ValueAnimator
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.CountDownTimer
import android.os.IBinder
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.view.animation.AccelerateDecelerateInterpolator
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.os.Build
import android.app.NotificationChannel
import android.app.NotificationManager
import androidx.core.app.NotificationCompat

/**
 * Fullscreen mindful breathing overlay shown above blocked apps.
 *
 * Uses TYPE_APPLICATION_OVERLAY so the blocked app remains underneath.
 * User never leaves the target app context.
 */
class BreathOverlayService : Service() {

    private var windowManager: WindowManager? = null
    private var overlayRoot: FrameLayout? = null

    private var countdownTimer: CountDownTimer? = null
    private var breathAnimator: ValueAnimator? = null
    private var breathCycleRunning = false

    private var blockedPackage = ""
    private var level = 1
    private var countdownMs = 0L

    // Views
    private var breathBlobView: FrameLayout? = null
    private var phaseLabelView: TextView? = null
    private var countdownView: TextView? = null
    private var proceedBtnView: TextView? = null
    private var cancelBtnView: TextView? = null

    private var openCount = 0
    private var usageMs = 0L

    companion object {
        const val TAG = "BreathOverlayService"

        const val EXTRA_PACKAGE = "BLOCKED_PACKAGE"
        const val EXTRA_LEVEL = "LEVEL"
        const val EXTRA_COUNTDOWN = "COUNTDOWN_MS"

        fun start(
            context: Context,
            blockedPackage: String,
            level: Int,
            countdownMs: Long,
            openCount: Int,
            usageMs: Long
        ) {
            val intent = Intent(context, BreathOverlayService::class.java).apply {
                putExtra(EXTRA_PACKAGE, blockedPackage)
                putExtra(EXTRA_LEVEL, level)
                putExtra(EXTRA_COUNTDOWN, countdownMs)
                putExtra("openCount", openCount)
                putExtra("usageMs", usageMs)
            }

            context.startService(intent)
        }

        fun stop(context: Context) {
            context.stopService(
                Intent(context, BreathOverlayService::class.java)
            )
        }
    }

    private fun prefs() =
        getSharedPreferences("LuminaPrefs", Context.MODE_PRIVATE)

    // ─────────────────────────────────────────────────────────────
    // Lifecycle
    // ─────────────────────────────────────────────────────────────

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(
        intent: Intent?,
        flags: Int,
        startId: Int
    ): Int {


        blockedPackage =
            intent?.getStringExtra(EXTRA_PACKAGE) ?: ""

        level =
            intent?.getIntExtra(EXTRA_LEVEL, 1) ?: 1

        countdownMs =
            intent?.getLongExtra(EXTRA_COUNTDOWN, 0L) ?: 0L

        openCount = intent?.getIntExtra("openCount", 0) ?: 0
        usageMs = intent?.getLongExtra("usageMs", 0L) ?: 0L

        Log.d(
            TAG,
            "🫁 Starting overlay pkg=$blockedPackage level=$level countdown=$countdownMs"
        )

        teardown()
        showOverlay()

        return START_NOT_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()

        Log.d(TAG, "🗑 Overlay destroyed")

        teardown()

        prefs().edit()
            .putBoolean("breathScreenActive", false)
            .remove("activeOverlayPackage")
            .apply()
    }

    // ─────────────────────────────────────────────────────────────
    // Overlay
    // ─────────────────────────────────────────────────────────────

    private fun showOverlay() {

        if (!android.provider.Settings.canDrawOverlays(this)) {
            Log.e(TAG, "❌ Overlay permission missing")

            prefs().edit()
                .putBoolean("breathScreenActive", false)
                .remove("activeOverlayPackage")
                .apply()

            stopSelf()
            return
        }

        windowManager =
            getSystemService(WINDOW_SERVICE) as WindowManager

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
        }

        val appLabel = getAppLabel(blockedPackage)

        overlayRoot = buildOverlayView(appLabel)

        windowManager?.addView(overlayRoot, params)

        overlayRoot?.isClickable = true
        overlayRoot?.isFocusable = true

        prefs().edit()
            .putBoolean("breathScreenActive", true)
            .putString("activeOverlayPackage", blockedPackage)
            .apply()

        startBreathCycle()
        startCountdown()
    }

    private fun teardown() {

        breathCycleRunning = false

        breathAnimator?.cancel()
        countdownTimer?.cancel()

        breathAnimator = null
        countdownTimer = null

        try {
            overlayRoot?.let {
                windowManager?.removeView(it)
            }
        } catch (e: Exception) {
            Log.w(TAG, "removeView safe ignore: ${e.message}")
        }

        overlayRoot = null
        windowManager = null

        breathBlobView = null
        phaseLabelView = null
        countdownView = null
        proceedBtnView = null
        cancelBtnView = null
    }

    // ─────────────────────────────────────────────────────────────
    // UI
    // ─────────────────────────────────────────────────────────────

    private fun buildUsageString(openCount: Int, usageMs: Long): String {
        val mins = usageMs / 60000
        val usageStr = when {
            mins >= 60 -> "${mins / 60}h ${mins % 60}m"
            mins > 0   -> "${mins}m"
            else       -> "< 1m"
        }
        return "Opened ${openCount}x today  ·  ${usageStr} today"
    }

    private fun buildOverlayView(appLabel: String): FrameLayout {

        val root = FrameLayout(this).apply {
            setBackgroundColor(
                Color.argb(250, 14, 20, 18)
            )

            isClickable = true
            isFocusable = true
            fitsSystemWindows = true
        }

        val scrollView = ScrollView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )

            isFillViewport = true
        }

        val content = LinearLayout(this).apply {

            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL

            setPadding(
                dpToPx(32),
                dpToPx(48),
                dpToPx(32),
                dpToPx(32)
            )

            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
            )
        }

        // ─────────────────────────────────────────────────────────
        // Level Badge
        // ─────────────────────────────────────────────────────────

        content.addView(
            TextView(this).apply {

                text = levelLabel(level)

                textSize = 10f
                letterSpacing = 0.2f

                setTextColor(
                    levelBadgeTextColor(level)
                )

                setPadding(
                    dpToPx(12),
                    dpToPx(5),
                    dpToPx(12),
                    dpToPx(5)
                )

                background =
                    levelBadgeBackground(level)

                layoutParams =
                    LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    ).apply {
                        bottomMargin = dpToPx(16)
                        gravity = Gravity.CENTER_HORIZONTAL
                    }
            }
        )

        // ─────────────────────────────────────────────────────────
        // Icon
        // ─────────────────────────────────────────────────────────

        val iconCircle = FrameLayout(this).apply {

            val size = dpToPx(56)

            layoutParams =
                LinearLayout.LayoutParams(size, size).apply {
                    bottomMargin = dpToPx(16)
                    gravity = Gravity.CENTER_HORIZONTAL
                }

            background = circleDrawable("#1c2b24")
        }

        iconCircle.addView(
            TextView(this).apply {

                text = "🌿"
                textSize = 22f
                gravity = Gravity.CENTER

                layoutParams =
                    FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT
                    )
            }
        )

        content.addView(iconCircle)

        // ─────────────────────────────────────────────────────────
        // Title
        // ─────────────────────────────────────────────────────────

        content.addView(
            TextView(this).apply {

                text = "Breath Delay"

                textSize = 28f

                setTextColor(
                    Color.parseColor("#e8f0eb")
                )

                gravity = Gravity.CENTER

                layoutParams =
                    LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    ).apply {
                        bottomMargin = dpToPx(28)
                    }
            }
        )

        // ─────────────────────────────────────────────────────────
        // Breathing Circle
        // ─────────────────────────────────────────────────────────

        val circleContainer = FrameLayout(this).apply {

            val size = dpToPx(220)

            layoutParams =
                LinearLayout.LayoutParams(size, size).apply {
                    bottomMargin = dpToPx(28)
                    gravity = Gravity.CENTER_HORIZONTAL
                }
        }

        // Outer ring
        circleContainer.addView(
            FrameLayout(this).apply {

                val size = dpToPx(220)

                layoutParams =
                    FrameLayout.LayoutParams(
                        size,
                        size,
                        Gravity.CENTER
                    )

                background = ringDrawable("#4a7a5a")

                alpha = 0.15f
            }
        )

        // Mid ring
        circleContainer.addView(
            FrameLayout(this).apply {

                val size = dpToPx(180)

                layoutParams =
                    FrameLayout.LayoutParams(
                        size,
                        size,
                        Gravity.CENTER
                    )

                background = ringDrawable("#4a7a5a")

                alpha = 0.10f
            }
        )

        // Breath blob
        breathBlobView = FrameLayout(this).apply {

            val size = dpToPx(150)

            layoutParams =
                FrameLayout.LayoutParams(
                    size,
                    size,
                    Gravity.CENTER
                )

            background = circleDrawable("#1e3328")
        }

        val innerCircle = FrameLayout(this).apply {

            val size = dpToPx(100)

            layoutParams =
                FrameLayout.LayoutParams(
                    size,
                    size,
                    Gravity.CENTER
                )

            background = circleDrawable("#2a4a38")
        }

        phaseLabelView = TextView(this).apply {

            text = "INHALE"

            textSize = 14f
            letterSpacing = 0.2f

            setTextColor(
                Color.parseColor("#a8d5b5")
            )

            gravity = Gravity.CENTER

            layoutParams =
                FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT
                )
        }

        innerCircle.addView(phaseLabelView)

        breathBlobView!!.addView(innerCircle)

        circleContainer.addView(breathBlobView)

        content.addView(circleContainer)

        // ─────────────────────────────────────────────────────────
        // Subtitle
        // ─────────────────────────────────────────────────────────

        content.addView(
            TextView(this).apply {

                text =
                    "Take a breath before opening\n$appLabel"

                textSize = 16f

                setTextColor(
                    Color.parseColor("#c0d4c8")
                )

                gravity = Gravity.CENTER

                layoutParams =
                    LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    ).apply {
                        bottomMargin = dpToPx(24)
                    }
            }
        )

        // ─────────────────────────────────────────────────────────
        // Usage message dynamic
        // ─────────────────────────────────────────────────────────

        content.addView(
            TextView(this).apply {
                text = buildUsageString(openCount, usageMs)
                textSize = 13f
                setTextColor(Color.parseColor("#8a4a2a"))
                gravity = Gravity.CENTER
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply { bottomMargin = dpToPx(16) }
            }
        )

        // ─────────────────────────────────────────────────────────
        // Countdown Circle
        // ─────────────────────────────────────────────────────────

        val countdownCircle = FrameLayout(this).apply {

            val size = dpToPx(64)

            layoutParams =
                LinearLayout.LayoutParams(size, size).apply {
                    bottomMargin = dpToPx(20)
                    gravity = Gravity.CENTER_HORIZONTAL
                }

            background = ringDrawable("#4a7a5a")
        }

        val initialSeconds =
            (countdownMs / 1000L).toInt()

        countdownView = TextView(this).apply {

            text =
                if (initialSeconds == 0) "✓"
                else "$initialSeconds"

            textSize = 22f

            setTextColor(
                Color.parseColor("#e8f0eb")
            )

            gravity = Gravity.CENTER

            layoutParams =
                FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT
                )
        }

        countdownCircle.addView(countdownView)

        content.addView(countdownCircle)

        // ─────────────────────────────────────────────────────────
        // Proceed Button
        // ─────────────────────────────────────────────────────────

        proceedBtnView = TextView(this).apply {

            text = "→  OPEN ${appLabel.uppercase()}"

            textSize = 11f
            letterSpacing = 0.25f

            gravity = Gravity.CENTER

            visibility =
                if (level == 1) View.VISIBLE
                else View.GONE

            setTextColor(
                Color.parseColor(
                    if (level == 1) "#4caf7d"
                    else "#5a7a68"
                )
            )

            layoutParams =
                LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    bottomMargin = dpToPx(12)
                }

            setOnClickListener {
                openApp()
            }
        }

        content.addView(proceedBtnView)

        // ─────────────────────────────────────────────────────────
        // Cancel Button
        // ─────────────────────────────────────────────────────────

        cancelBtnView = TextView(this).apply {

            text = "✕  GO BACK"

            textSize = 11f
            letterSpacing = 0.25f

            gravity = Gravity.CENTER

            setTextColor(
                Color.parseColor("#5a7a68")
            )

            layoutParams =
                LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                )

            setOnClickListener {
                cancelJourney()
            }
        }

        content.addView(cancelBtnView)

        scrollView.addView(content)
        root.addView(scrollView)

        return root
    }

    // ─────────────────────────────────────────────────────────────
    // Actions
    // ─────────────────────────────────────────────────────────────

    private fun openApp() {

        Log.d(TAG, "✅ User opened app")

        prefs().edit()
            .putString("allowedPackage", blockedPackage)
            .putLong("allowedTime", System.currentTimeMillis())
            .putBoolean("breathScreenActive", false)
            .remove("cancelledPackage")
            .apply()

        stopSelf()
    }

    private fun cancelJourney() {

        Log.d(TAG, "❌ User cancelled")

        val currentScore =
            SessionTracker.getStoredScore(this, blockedPackage)

        val appName = try {

            val info =
                packageManager.getApplicationInfo(
                    blockedPackage,
                    0
                )

            packageManager
                .getApplicationLabel(info)
                .toString()

        } catch (e: Exception) {
            blockedPackage
        }

        HistoryTracker.addEvent(
            this,
            blockedPackage,
            appName,
            "Intentional exit",
            "You chose not to open $appName.",
            0,
            currentScore,
            currentScore
        )

        prefs().edit()
            .putBoolean("breathScreenActive", false)
            .remove("allowedPackage")
            .remove("cancelledPackage")
            .apply()

        stopSelf()

        val homeIntent =
            Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_HOME)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }

        startActivity(homeIntent)
    }
    // ─────────────────────────────────────────────────────────────
    // Breathing Animation
    // ─────────────────────────────────────────────────────────────

    private fun startBreathCycle() {
        breathCycleRunning = true
        inhale()
    }

    private fun inhale() {

        if (!breathCycleRunning) return

        setPhase("INHALE", "#a8d5b5")

        breathAnimator =
            ValueAnimator.ofFloat(0.72f, 1f).apply {

                duration = 4000

                interpolator =
                    AccelerateDecelerateInterpolator()

                addUpdateListener {

                    val s = it.animatedValue as Float

                    breathBlobView?.scaleX = s
                    breathBlobView?.scaleY = s
                }

                addListener(
                    object : AnimatorListenerAdapter() {

                        override fun onAnimationEnd(
                            animation: Animator
                        ) {
                            if (breathCycleRunning) {
                                hold()
                            }
                        }
                    }
                )

                start()
            }
    }

    private fun hold() {

        if (!breathCycleRunning) return

        setPhase("HOLD", "#c8e6d0")

        overlayRoot?.postDelayed(
            {
                if (breathCycleRunning) {
                    exhale()
                }
            },
            2000
        )
    }

    private fun exhale() {

        if (!breathCycleRunning) return

        setPhase("EXHALE", "#7ab89a")

        breathAnimator =
            ValueAnimator.ofFloat(1f, 0.72f).apply {

                duration = 4000

                interpolator =
                    AccelerateDecelerateInterpolator()

                addUpdateListener {

                    val s = it.animatedValue as Float

                    breathBlobView?.scaleX = s
                    breathBlobView?.scaleY = s
                }

                addListener(
                    object : AnimatorListenerAdapter() {

                        override fun onAnimationEnd(
                            animation: Animator
                        ) {
                            if (breathCycleRunning) {
                                inhale()
                            }
                        }
                    }
                )

                start()
            }
    }

    private fun setPhase(
        label: String,
        color: String
    ) {

        overlayRoot?.post {

            phaseLabelView?.text = label

            phaseLabelView?.setTextColor(
                Color.parseColor(color)
            )
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Countdown
    // ─────────────────────────────────────────────────────────────

    private fun startCountdown() {

        if (countdownMs == 0L) return

        countdownTimer =
            object : CountDownTimer(countdownMs, 1000) {

                override fun onTick(
                    millisUntilFinished: Long
                ) {

                    val s =
                        (millisUntilFinished / 1000L).toInt() + 1

                    overlayRoot?.post {
                        countdownView?.text = "$s"
                    }
                }

                override fun onFinish() {

                    overlayRoot?.post {

                        countdownView?.text = "✓"

                        proceedBtnView?.visibility =
                            View.VISIBLE

                        proceedBtnView?.setTextColor(
                            Color.parseColor("#4caf7d")
                        )

                        cancelBtnView?.text = "✕  CLOSE"
                    }
                }
            }.start()
    }

    // ─────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────

    private fun getAppLabel(packageName: String): String =
        try {

            val info =
                packageManager.getApplicationInfo(
                    packageName,
                    0
                )

            packageManager
                .getApplicationLabel(info)
                .toString()

        } catch (e: Exception) {
            packageName
        }

    private fun levelLabel(level: Int) =
        when (level) {
            1 -> "LEVEL 1  ·  GENTLE"
            2 -> "LEVEL 2  ·  MODERATE"
            3 -> "LEVEL 3  ·  FOCUSED"
            4 -> "LEVEL 4  ·  DEEP PAUSE"
            else -> "LEVEL 1  ·  GENTLE"
        }

    private fun levelBadgeTextColor(level: Int) =
        when (level) {
            1 -> Color.parseColor("#4a7a5a")
            2 -> Color.parseColor("#6a8a3a")
            3 -> Color.parseColor("#8a7a2a")
            4 -> Color.parseColor("#8a4a2a")
            else -> Color.parseColor("#4a7a5a")
        }

    private fun levelBadgeBackground(level: Int) =
        GradientDrawable().apply {

            shape = GradientDrawable.RECTANGLE

            cornerRadius =
                dpToPx(12).toFloat()

            setColor(
                Color.parseColor(
                    when (level) {
                        1 -> "#1a3a2a"
                        2 -> "#2a3a1a"
                        3 -> "#3a3a1a"
                        4 -> "#3a2a1a"
                        else -> "#1a3a2a"
                    }
                )
            )
        }

    private fun dpToPx(dp: Int): Int =
        (dp * resources.displayMetrics.density).toInt()

    private fun circleDrawable(colorHex: String) =
        GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(Color.parseColor(colorHex))
        }

    private fun ringDrawable(colorHex: String) =
        GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setStroke(
                dpToPx(1),
                Color.parseColor(colorHex)
            )
            setColor(Color.TRANSPARENT)
        }
}