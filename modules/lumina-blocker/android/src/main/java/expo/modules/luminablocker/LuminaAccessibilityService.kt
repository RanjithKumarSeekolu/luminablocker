package expo.modules.luminablocker

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.util.Log
import android.view.accessibility.AccessibilityEvent

class LuminaAccessibilityService : AccessibilityService() {

    // In-memory foreground tracking (not persisted — resets if service restarts)
    private var lastForegroundPackage = ""
    private var lastForegroundTime    = 0L

    companion object {
        const val TAG = "LuminaService"
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.d(TAG, "✅ Service connected")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return

        val packageName = event.packageName?.toString() ?: return

        // Ignore our own app
        if (packageName == applicationContext.packageName) return

        val ctx   = applicationContext
        val prefs = ctx.getSharedPreferences("LuminaPrefs", Context.MODE_PRIVATE)
        val now   = System.currentTimeMillis()

        val blockedApps = prefs.getStringSet("blockedApps", emptySet())?.toSet() ?: emptySet()

        // ── Detect when a blocked app leaves foreground ───────────
        // Fires whenever ANY different package comes to foreground after a blocked app.
        // This covers: home screen, another app, notification shade, etc.
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

        // ── Always update foreground tracking ─────────────────────
        // Must happen for ALL packages (including non-blocked) so the close
        // detection above works correctly next time a blocked app opens.
        val prevForeground = lastForegroundPackage
        val prevForegroundTime = lastForegroundTime

        lastForegroundPackage = packageName
        lastForegroundTime = now

        // ── Not a monitored app — nothing else to do ──────────────
        if (packageName !in blockedApps) return

        // ── Deduplicate rapid events for the same package ─────────
        if (
            packageName == prevForeground &&
            now - prevForegroundTime < LuminaConfig.Windows.DUPLICATE_MS
        ) {
            Log.d(
                TAG,
                "⏭ Duplicate event ${now - prevForegroundTime}ms, skipping"
            )
            return
        }

        // ── Breath screen already showing ─────────────────────────
        // val breathActive = prefs.getBoolean("breathScreenActive", false)
        // if (breathActive) {
        //     Log.d(TAG, "🫁 Breath screen already active, skipping")
        //     return
        // }

        // ── Allow window — active session pass-through ────────────
        // Set when user taps "Open". Refreshed on every in-app navigation event
        // so the overlay never fires during an active session.
        val allowedPackage = prefs.getString("allowedPackage", "") ?: ""
        val allowedTime    = prefs.getLong("allowedTime", 0L)
        val allowedAge     = now - allowedTime

        if (allowedPackage == packageName && allowedAge < LuminaConfig.Windows.ALLOW_WINDOW_MS) {
            // Refresh the window — user is still actively inside the app
            // prefs.edit().putLong("allowedTime", now).apply()
            Log.d(TAG, "🟢 Session active — refreshed allow window (was ${allowedAge}ms old)")
            return
        }

        // Allow window expired — clear it
        if (allowedPackage.isNotEmpty() && allowedAge >= LuminaConfig.Windows.ALLOW_WINDOW_MS) {
            Log.d(TAG, "⌛ Allow window expired (${allowedAge}ms) — clearing")
            prefs.edit().remove("allowedPackage").remove("allowedTime").apply()
        }

        // ── Track open + compute score ────────────────────────────
        SessionTracker.onAppOpened(ctx, packageName)

        val level = ScoreEngine.evaluate(ctx, packageName)
        val score = SessionTracker.getStoredScore(ctx, packageName)

        Log.d(TAG, "📊 Score: $score → Level: $level")

        // ── Score 0 → no intervention needed ─────────────────────
        if (level == 0) {
            Log.d(TAG, "✅ Score too low for overlay — passing through")
            // Still set a short allow window so in-app events don't re-evaluate
            prefs.edit()
                .putString("allowedPackage", packageName)
                .putLong("allowedTime", now)
                .apply()
            return
        }

        // ── Show overlay ──────────────────────────────────────────
        val countdownMs = ScoreEngine.levelToCountdownMs(level)
        val appLabel    = getAppLabel(packageName)

        Log.d(TAG, "🫁 Showing overlay for $packageName — level $level, countdown ${countdownMs}ms")

        prefs.edit().putBoolean("breathScreenActive", true).apply()

        // Draw system window overlay on top of the blocked app.
        // The blocked app stays in the foreground underneath — no app switching.
        BreathOverlayService.start(ctx, packageName, level, countdownMs)

        // Also emit to JS so the React side can update stats/UI if needed
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