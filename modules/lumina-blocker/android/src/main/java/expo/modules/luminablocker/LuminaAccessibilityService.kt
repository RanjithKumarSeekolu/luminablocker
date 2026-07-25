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

    private fun relaunchFocusActivity(ctx: Context) {
        val intent = Intent(ctx, FocusLockActivity::class.java).apply {
            addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_SINGLE_TOP or
                Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
            )
        }
        ctx.startActivity(intent)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        val ctx = applicationContext

        if (LuminaFocusService.isActive) {
        val pkg = event?.packageName?.toString() ?: return

        // Allow only our own package
        if (pkg == ctx.packageName) return

            // Block and relaunch for every other package including
            // systemui, keyguard, launcher, lock screen — everything
            android.util.Log.d(TAG, "Focus active, blocking pkg=$pkg — relaunching")
            if (pkg == "com.android.systemui") {
                // Dismiss notification shade / quick settings when Android
                // reports System UI becoming the foreground window.
                performGlobalAction(GLOBAL_ACTION_BACK)
            }
            handler.postDelayed({
                if (
                    LuminaFocusService.isActive &&
                    !FocusLockActivity.isVisible &&
                    FocusLockActivity.allowRelaunch()
                ) {
                    relaunchFocusActivity(ctx)
                }
            }, 100L)
            return
        }

        // ── Normal flow below ─────────────────────────────────────
        if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return

        val packageName = event.packageName?.toString() ?: return
        val className = event.className?.toString() ?: ""

        val prefs = ctx.getSharedPreferences("LuminaPrefs", Context.MODE_PRIVATE)
        val now   = System.currentTimeMillis()
        val blockedApps = prefs.getStringSet("blockedApps", emptySet())?.toSet() ?: emptySet()

        // System UI (notification shade / Quick Settings) is always above an
        // application overlay. Close it immediately while an intervention is
        // active so it cannot remain as a bypass surface.
        if (packageName == "com.android.systemui" && BreathOverlayService.isActive()) {
            performGlobalAction(GLOBAL_ACTION_BACK)
            return
        }

        // Opening the notification shade or Quick Settings temporarily puts
        // System UI above the app; it is not a real app-to-app transition.
        // Keep the current app session alive so returning to it cannot trigger
        // a new overlay in the middle of use.
        if (packageName == "com.android.systemui") {
            return
        }

        // A visible overlay owns the blocked-app flow. Accessibility can still
        // emit window events from the target app while the overlay is present;
        // never treat those events as a new open attempt.
        if (packageName in blockedApps && BreathOverlayService.isActive()) {
            return
        }

        // The outgoing app can be replaced by another Activity directly (for
        // example Instagram -> Chrome). Do not rely on the class name to infer
        // whether the previous app actually left the foreground.
        if (lastForegroundPackage.isNotEmpty() &&
            lastForegroundPackage != packageName &&
            lastForegroundPackage in blockedApps &&
            !BreathOverlayService.isActiveFor(lastForegroundPackage)
        ) {
            val previousPackage = lastForegroundPackage
            Log.d(TAG, "📴 Foreground changed: clearing session for $previousPackage")
            SessionTracker.onAppLeft(ctx)
            prefs.edit()
                .remove("allowedPackage")
                .remove("allowedTime")
                .putBoolean("session_active_$previousPackage", false)
                .apply()
            lastForegroundPackage = ""
        }

        if (!className.contains("Activity")) return
        if (packageName == applicationContext.packageName) return

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

        val isSessionActive = prefs.getBoolean("session_active_$packageName", false)
        if (isSessionActive) {
            Log.d(TAG, "🟢 Session active for $packageName — skip overlay")
            return
        }

        // If the same package is still the foreground surface but its legacy
        // session flag was lost, recover the session instead of interrupting
        // active use with a new intervention.
        if (packageName == prevForeground && prevForeground.isNotEmpty()) {
            Log.d(TAG, "🟢 Same foreground package — restoring session for $packageName")
            SessionTracker.startSession(ctx, packageName)
            prefs.edit()
                .putBoolean("session_active_$packageName", true)
                .apply()
            return
        }

        // Record the open/frequency signal now. The actual usage timer starts
        // only after the user passes the intervention overlay.
        SessionTracker.onAppOpened(ctx, packageName, startUsageSession = false)

        val scoredLevel = ScoreEngine.evaluate(ctx, packageName)
        val score = SessionTracker.getStoredScore(ctx, packageName)

        // Per-app settings are intentionally applied after scoring so score
        // history remains consistent even when the user changes intervention
        // intensity or disables reminders.
        val intensity = prefs.getInt("app_intensity_$packageName", -1)
        val mindfulReminder =
            prefs.getBoolean("mindfulReminders", true) &&
            prefs.getBoolean("app_mindful_$packageName", true)
        val nightLock = prefs.getBoolean("app_night_lock_$packageName", false)
        val hour = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY)
        val nightLockActive = nightLock && (hour >= 23 || hour < 6)
        val requestedLevel = if (mindfulReminder || nightLockActive) {
            if (nightLockActive) maxOf(scoredLevel, 1) else scoredLevel
        } else {
            0
        }
        val level = when (intensity) {
            0 -> minOf(requestedLevel, 1) // Subtle: gentle reminder only
            1 -> minOf(requestedLevel, 2) // Moderate: cap countdown level
            else -> requestedLevel       // Deep or unset: use scored level
        }

        if (level == 0) {
            Log.d(TAG, "✅ Score too low for overlay — passing through")
            SessionTracker.startSession(ctx, packageName)
            prefs.edit()
                .putString("allowedPackage", packageName)
                .putLong("allowedTime", now)
                .putBoolean("session_active_$packageName", true)
                .apply()
            return
        }

        val countdownMs = ScoreEngine.levelToCountdownMs(level)
        val appLabel    = getAppLabel(packageName)

        val openCount = SessionTracker.getOpenCountThisHour(ctx, packageName)
        val usageMs = SessionTracker.getTotalUsageMs(ctx, packageName)

        val overlayEnabled = prefs.getBoolean("overlayEnabled", true)

        if (!overlayEnabled) {
            // The target app is allowed through when the setting is off. Keep
            // the state consistent and start measuring real usage immediately.
            SessionTracker.startSession(ctx, packageName)
            prefs.edit()
                .putString("allowedPackage", packageName)
                .putLong("allowedTime", now)
                .putBoolean("session_active_$packageName", true)
                .putBoolean("breathScreenActive", false)
                .apply()
            return
        }

        // Ensure a stale timer from an interrupted previous attempt cannot
        // include the overlay delay in the next real session.
        SessionTracker.cancelPendingSession(ctx)
        prefs.edit().putBoolean("breathScreenActive", true).apply()

        BreathOverlayService.start(ctx, packageName, level, countdownMs, openCount, usageMs)


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
