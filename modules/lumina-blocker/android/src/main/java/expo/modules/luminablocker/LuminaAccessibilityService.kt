package expo.modules.luminablocker

import android.accessibilityservice.AccessibilityService
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.util.Log
import android.view.KeyEvent
import android.view.accessibility.AccessibilityEvent
import android.os.Handler
import android.os.Looper

class LuminaAccessibilityService : AccessibilityService() {

    private var lastForegroundPackage = ""
    private var lastForegroundTime    = 0L

    private var volumeHeld = false

    private var holdStartTime = 0L

    private val handler =
        Handler(Looper.getMainLooper())

    private var holdRunnable: Runnable? = null

    companion object {
        const val TAG = "LuminaService"
    }

    // ── Volume key detection ──────────────────────────────────────

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.d(TAG, "✅ Service connected")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        val ctx = applicationContext

        // ── Focus mode guard ──────────────────────────────────────
        // If focus mode is active, intercept any escape attempt
        if (LuminaFocusService.isActive) {
            val pkg = event?.packageName?.toString() ?: return

            val isLauncher = pkg.contains("launcher") ||
                             pkg == "com.android.launcher" ||
                             pkg == "com.google.android.apps.nexuslauncher"
            val isRecents  = pkg == "com.android.systemui"

            if (isLauncher || isRecents) {
                val launchIntent = ctx.packageManager
                    .getLaunchIntentForPackage(ctx.packageName)
                    ?.apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                                Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
                    }
                if (launchIntent != null) ctx.startActivity(launchIntent)
                return
            }

            // Block all other apps too during focus mode
            if (pkg != ctx.packageName) return
        }

        // ── Normal flow below ─────────────────────────────────────
        if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return

        val packageName = event.packageName?.toString() ?: return

        if (packageName == applicationContext.packageName) return

        val prefs = ctx.getSharedPreferences("LuminaPrefs", Context.MODE_PRIVATE)
        val now   = System.currentTimeMillis()

        val blockedApps = prefs.getStringSet("blockedApps", emptySet())?.toSet() ?: emptySet()

        if (lastForegroundPackage.isNotEmpty() &&
            lastForegroundPackage != packageName &&
            lastForegroundPackage in blockedApps
        ) {
            Log.d(TAG, "📴 Left foreground: $lastForegroundPackage → $packageName")
            SessionTracker.onAppLeft(ctx)
            prefs.edit()
                .remove("allowedPackage")
                .remove("allowedTime")
                .apply()
        }

        val prevForeground     = lastForegroundPackage
        val prevForegroundTime = lastForegroundTime

        lastForegroundPackage = packageName
        lastForegroundTime    = now

        if (packageName !in blockedApps) return

        if (packageName == prevForeground &&
            now - prevForegroundTime < LuminaConfig.Windows.DUPLICATE_MS
        ) {
            Log.d(TAG, "⏭ Duplicate event ${now - prevForegroundTime}ms, skipping")
            return
        }

        val allowedPackage = prefs.getString("allowedPackage", "") ?: ""
        val allowedTime    = prefs.getLong("allowedTime", 0L)
        val allowedAge     = now - allowedTime

        if (allowedPackage == packageName && allowedAge < LuminaConfig.Windows.ALLOW_WINDOW_MS) {
            Log.d(TAG, "🟢 Session active — refreshed allow window (was ${allowedAge}ms old)")
            return
        }

        if (allowedPackage.isNotEmpty() && allowedAge >= LuminaConfig.Windows.ALLOW_WINDOW_MS) {
            Log.d(TAG, "⌛ Allow window expired (${allowedAge}ms) — clearing")
            prefs.edit().remove("allowedPackage").remove("allowedTime").apply()
        }

        SessionTracker.onAppOpened(ctx, packageName)

        val level = ScoreEngine.evaluate(ctx, packageName)
        val score = SessionTracker.getStoredScore(ctx, packageName)

        Log.d(TAG, "📊 Score: $score → Level: $level")

        if (level == 0) {
            Log.d(TAG, "✅ Score too low for overlay — passing through")
            prefs.edit()
                .putString("allowedPackage", packageName)
                .putLong("allowedTime", now)
                .apply()
            return
        }

        val countdownMs = ScoreEngine.levelToCountdownMs(level)
        val appLabel    = getAppLabel(packageName)

        Log.d(TAG, "🫁 Showing overlay for $packageName — level $level, countdown ${countdownMs}ms")

        prefs.edit().putBoolean("breathScreenActive", true).apply()

        BreathOverlayService.start(ctx, packageName, level, countdownMs)

        LuminaBlockerModule.emitEvent(
            "onBlockedAppDetected",
            mapOf(
                "packageName" to packageName,
                "appName"     to appLabel,
                "level"       to level,
                "score"       to score
            )
        )
    }

    override fun onInterrupt() {
        Log.d(TAG, "⚠️ Service interrupted")
    }

    private fun getAppLabel(packageName: String): String = try {
        val info = packageManager.getApplicationInfo(packageName, 0)
        packageManager.getApplicationLabel(info).toString()
    } catch (e: Exception) {
        packageName
    }
}