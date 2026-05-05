package expo.modules.luminablocker

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ValueAnimator
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.os.CountDownTimer
import android.view.Gravity
import android.view.WindowManager
import android.view.animation.AccelerateDecelerateInterpolator
import android.widget.*

class BreathOverlayActivity : Activity() {

    private var countdownTimer: CountDownTimer? = null
    private var breathAnimator: ValueAnimator? = null
    private var secondsLeft = 5
    private var blockedPackage = ""
    private var breathCycleRunning = false

    private lateinit var breathBlobView: FrameLayout
    private lateinit var phaseLabelView: TextView
    private lateinit var countdownView: TextView
    private lateinit var proceedBtnView: TextView
    private lateinit var cancelBtnView: TextView

    companion object {
        fun start(context: Context, blockedPackage: String) {
            val intent = Intent(context, BreathOverlayActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP
                putExtra("BLOCKED_PACKAGE", blockedPackage)
            }
            context.startActivity(intent)
        }
    }

    private fun prefs() = getSharedPreferences("LuminaPrefs", Context.MODE_PRIVATE)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        blockedPackage = intent.getStringExtra("BLOCKED_PACKAGE") ?: ""
        val appLabel = getAppLabel(blockedPackage)

        window.apply {
            setFlags(
                WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN
            )
            statusBarColor = Color.parseColor("#0e1412")
            navigationBarColor = Color.parseColor("#0e1412")
        }

        setContentView(buildUI(appLabel))
        startBreathCycle()
        startCountdown()
    }

    override fun onPause() {
        super.onPause()
        // If we're leaving without a button tap, clear the flag
        prefs().edit().putBoolean("breathScreenActive", false).apply()
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)

        countdownTimer?.cancel()
        breathAnimator?.cancel()
        breathCycleRunning = false

        blockedPackage = intent?.getStringExtra("BLOCKED_PACKAGE") ?: blockedPackage
        secondsLeft = 5

        runOnUiThread {
            countdownView.text = "$secondsLeft"
            proceedBtnView.visibility = android.view.View.GONE
            proceedBtnView.setTextColor(Color.parseColor("#5a7a68"))
            cancelBtnView.text = "✕  CANCEL JOURNEY"
        }

        startBreathCycle()
        startCountdown()
    }

    private fun buildUI(appLabel: String): LinearLayout {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setBackgroundColor(Color.parseColor("#0e1412"))
            setPadding(48, 120, 48, 80)
        }

        // Icon circle
        val iconCircle = FrameLayout(this).apply {
            val size = dpToPx(56)
            layoutParams = LinearLayout.LayoutParams(size, size).apply {
                bottomMargin = dpToPx(20)
                gravity = Gravity.CENTER_HORIZONTAL
            }
            background = circleDrawable("#1c2b24")
        }
        iconCircle.addView(TextView(this).apply {
            text = "🌿"
            textSize = 22f
            gravity = Gravity.CENTER
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        })
        root.addView(iconCircle)

        // Title
        root.addView(TextView(this).apply {
            text = "Breath Delay"
            textSize = 28f
            setTextColor(Color.parseColor("#e8f0eb"))
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dpToPx(32) }
        })

        // Circle container
        val circleContainer = FrameLayout(this).apply {
            val size = dpToPx(260)
            layoutParams = LinearLayout.LayoutParams(size, size).apply {
                bottomMargin = dpToPx(36)
                gravity = Gravity.CENTER_HORIZONTAL
            }
        }
        circleContainer.addView(FrameLayout(this).apply {
            val size = dpToPx(260)
            layoutParams = FrameLayout.LayoutParams(size, size, Gravity.CENTER)
            background = ringDrawable("#4a7a5a")
            alpha = 0.15f
        })
        circleContainer.addView(FrameLayout(this).apply {
            val size = dpToPx(220)
            layoutParams = FrameLayout.LayoutParams(size, size, Gravity.CENTER)
            background = ringDrawable("#4a7a5a")
            alpha = 0.1f
        })

        breathBlobView = FrameLayout(this).apply {
            val size = dpToPx(180)
            layoutParams = FrameLayout.LayoutParams(size, size, Gravity.CENTER)
            background = circleDrawable("#1e3328")
        }
        val innerCircle = FrameLayout(this).apply {
            val size = dpToPx(120)
            layoutParams = FrameLayout.LayoutParams(size, size, Gravity.CENTER)
            background = circleDrawable("#2a4a38")
        }
        phaseLabelView = TextView(this).apply {
            text = "INHALE"
            textSize = 14f
            letterSpacing = 0.2f
            setTextColor(Color.parseColor("#a8d5b5"))
            gravity = Gravity.CENTER
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }
        innerCircle.addView(phaseLabelView)
        breathBlobView.addView(innerCircle)
        circleContainer.addView(breathBlobView)
        root.addView(circleContainer)

        // Subtitle
        root.addView(TextView(this).apply {
            text = "Take a breath before we open\n$appLabel"
            textSize = 16f
            setTextColor(Color.parseColor("#c0d4c8"))
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dpToPx(28) }
        })

        // Countdown circle
        val countdownCircle = FrameLayout(this).apply {
            val size = dpToPx(64)
            layoutParams = LinearLayout.LayoutParams(size, size).apply {
                bottomMargin = dpToPx(28)
                gravity = Gravity.CENTER_HORIZONTAL
            }
            background = ringDrawable("#4a7a5a")
        }
        countdownView = TextView(this).apply {
            text = "$secondsLeft"
            textSize = 22f
            setTextColor(Color.parseColor("#e8f0eb"))
            gravity = Gravity.CENTER
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }
        countdownCircle.addView(countdownView)
        root.addView(countdownCircle)

        // Cancel button
        cancelBtnView = TextView(this).apply {
            text = "✕  CANCEL JOURNEY"
            textSize = 11f
            letterSpacing = 0.25f
            setTextColor(Color.parseColor("#5a7a68"))
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            setOnClickListener { cancelJourney() }
        }
        root.addView(cancelBtnView)

        // Proceed button
        proceedBtnView = TextView(this).apply {
            text = "→  OPEN ${appLabel.uppercase()}"
            textSize = 11f
            letterSpacing = 0.25f
            setTextColor(Color.parseColor("#5a7a68"))
            gravity = Gravity.CENTER
            visibility = android.view.View.GONE
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { topMargin = dpToPx(12) }
            setOnClickListener { openBlockedApp() }
        }
        root.addView(proceedBtnView)

        return root
    }

    private fun openBlockedApp() {
        prefs().edit()
            .putString("allowedPackage", blockedPackage)
            .putLong("allowedTime", System.currentTimeMillis())
            .putBoolean("breathScreenActive", false)
            .remove("cancelledPackage")
            .remove("cancelledTime")
            .apply()

        finish() // finish FIRST, then launch
        
        try {
            val launchIntent = packageManager.getLaunchIntentForPackage(blockedPackage)
            if (launchIntent != null) {
                launchIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                startActivity(launchIntent)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun cancelJourney() {
        // Save cancelled state — suppresses re-trigger for 30 seconds
        prefs().edit()
            .putString("cancelledPackage", blockedPackage)
            .putLong("cancelledTime", System.currentTimeMillis())
            .putBoolean("breathScreenActive", false)
            .remove("allowedPackage")
            .remove("allowedTime")
            .apply()
        finish()
    }

    private fun startBreathCycle() {
        breathCycleRunning = true
        inhale()
    }

    private fun inhale() {
        if (!breathCycleRunning) return
        setPhase("INHALE", "#a8d5b5")
        breathAnimator = ValueAnimator.ofFloat(0.72f, 1f).apply {
            duration = 4000
            interpolator = AccelerateDecelerateInterpolator()
            addUpdateListener {
                val scale = it.animatedValue as Float
                breathBlobView.scaleX = scale
                breathBlobView.scaleY = scale
            }
            addListener(object : AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: Animator) {
                    if (breathCycleRunning) hold()
                }
            })
            start()
        }
    }

    private fun hold() {
        if (!breathCycleRunning) return
        setPhase("HOLD", "#c8e6d0")
        window.decorView.postDelayed({ if (breathCycleRunning) exhale() }, 2000)
    }

    private fun exhale() {
        if (!breathCycleRunning) return
        setPhase("EXHALE", "#7ab89a")
        breathAnimator = ValueAnimator.ofFloat(1f, 0.72f).apply {
            duration = 4000
            interpolator = AccelerateDecelerateInterpolator()
            addUpdateListener {
                val scale = it.animatedValue as Float
                breathBlobView.scaleX = scale
                breathBlobView.scaleY = scale
            }
            addListener(object : AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: Animator) {
                    if (breathCycleRunning) inhale()
                }
            })
            start()
        }
    }

    private fun setPhase(label: String, color: String) {
        runOnUiThread {
            phaseLabelView.text = label
            phaseLabelView.setTextColor(Color.parseColor(color))
        }
    }

    private fun startCountdown() {
        countdownTimer = object : CountDownTimer(5000, 1000) {
            override fun onTick(millisUntilFinished: Long) {
                secondsLeft = (millisUntilFinished / 1000).toInt() + 1
                runOnUiThread { countdownView.text = "$secondsLeft" }
            }

            override fun onFinish() {
                runOnUiThread {
                    countdownView.text = "✓"
                    proceedBtnView.visibility = android.view.View.VISIBLE
                    proceedBtnView.setTextColor(Color.parseColor("#4caf7d"))
                    cancelBtnView.text = "✕  CLOSE"
                }
            }
        }.start()
    }

    // Block back button — user must use Cancel or Proceed
    override fun onBackPressed() {}

    override fun onDestroy() {
        super.onDestroy()
        breathCycleRunning = false
        breathAnimator?.cancel()
        countdownTimer?.cancel()
        // Safety reset in case activity dies unexpectedly
        prefs().edit().putBoolean("breathScreenActive", false).apply()
    }

    private fun getAppLabel(packageName: String): String {
        return try {
            val info = packageManager.getApplicationInfo(packageName, 0)
            packageManager.getApplicationLabel(info).toString()
        } catch (e: Exception) {
            packageName
        }
    }

    private fun dpToPx(dp: Int): Int =
        (dp * resources.displayMetrics.density).toInt()

    private fun circleDrawable(colorHex: String): GradientDrawable =
        GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(Color.parseColor(colorHex))
        }

    private fun ringDrawable(colorHex: String): GradientDrawable =
        GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setStroke(dpToPx(1), Color.parseColor(colorHex))
            setColor(Color.TRANSPARENT)
        }
}