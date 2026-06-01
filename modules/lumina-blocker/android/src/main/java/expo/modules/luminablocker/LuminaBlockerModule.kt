package expo.modules.luminablocker

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class LuminaBlockerModule : Module() {

    private val ctx get() = appContext.reactContext
        ?: throw IllegalStateException("React context unavailable")

    private fun prefs() = ctx.getSharedPreferences("LuminaPrefs", Context.MODE_PRIVATE)

    // ── Static emitter — called from AccessibilityService ────────
    companion object {
        private var instance: LuminaBlockerModule? = null

        fun emitEvent(name: String, payload: Map<String, Any>) {
            instance?.sendEvent(name, payload)
        }
    }

    override fun definition() = ModuleDefinition {
        Name("LuminaBlocker")

        OnCreate { instance = this@LuminaBlockerModule }
        OnDestroy { instance = null }

        // ── Blocked apps ──────────────────────────────────────────

        Function("saveBlockedApps") { apps: List<String> ->
            prefs().edit()
                .putStringSet("blockedApps", apps.toSet())
                .apply()
            null
        }

        Function("getBlockedApps") {
            prefs().getStringSet("blockedApps", emptySet())
                ?.toList() ?: emptyList<String>()
        }

        // --─ Daily snapshots ────────────────────────────────────────
        Function("getDailySnapshots") {

            SessionTracker.getDailySnapshots(
                appContext.reactContext!!
            )
        }

        Function("hasUsagePermission") {
            UsageStatsHelper.hasUsagePermission(ctx)
        }

        Function("hasUsagePermission") {

            UsageStatsHelper.hasUsagePermission(
                appContext.reactContext!!
            )
        }

        Function("getAppDailySnapshots") {

            SessionTracker.getAppDailySnapshots(
                appContext.reactContext!!
            )
        }

        Function("getWeeklyUsageForApp") { packageName: String ->

            UsageStatsHelper
                .getWeeklyUsageForApp(
                    appContext.reactContext!!,
                    packageName
                )
        }

        Function("getTodayUsageBreakdown") { packageName: String ->
            UsageStatsHelper.getTodayUsageBreakdown(
                appContext.reactContext!!,
                packageName
            )
        }

        Function("getHistoricalDailyUsage") { packageNames: List<String>, days: Int ->
            UsageStatsHelper.getHistoricalDailyUsage(
                appContext.reactContext!!,
                packageNames,
                days
            )
        }
        
        Function("clearAppData") {
            packageName: String ->

            SessionTracker
                .clearAppData(
                    appContext.reactContext!!,
                    packageName
                )
        }

        Function("openUsageAccessSettings") {

            val intent =
                Intent(
                    Settings.ACTION_USAGE_ACCESS_SETTINGS
                ).apply {

                    flags =
                        Intent.FLAG_ACTIVITY_NEW_TASK
                }

            appContext.reactContext
                ?.startActivity(intent)

            null
        }

        // ── Score + level ─────────────────────────────────────────

        Function("getCurrentScore") { packageName: String ->
            SessionTracker.getStoredScore(ctx, packageName)
        }

        Function("getCurrentLevel") { packageName: String ->
            val score = SessionTracker.getStoredScore(ctx, packageName)
            ScoreEngine.scoreToLevel(score)
        }

        Function("getAllAppScores") {
            SessionTracker.getAllAppScores(appContext.reactContext!!)
        }

        Function("resetScore") { packageName: String ->
            SessionTracker.setStoredScore(ctx, packageName, 0)
            null
        }

        Function("applyFocusReset") { packageName: String ->
            val current = SessionTracker.getStoredScore(ctx, packageName)
            val reduced = (current - LuminaConfig.Reset.FOCUS_RESET_SCORE).coerceAtLeast(0)
            SessionTracker.setStoredScore(ctx, packageName ,reduced)
            HistoryTracker.addEvent(
                ctx,
                "",
                "Lumina",
                "Mindful pause",
                "You chose to pause and reduce your intensity score.",
                -LuminaConfig.Reset.FOCUS_RESET_SCORE,
                current,
                reduced
            )
            reduced
        }

        // ── Session notify ────────────────────────────────────────

        Function("notifyAppOpened") { packageName: String ->
            SessionTracker.onAppOpened(ctx, packageName)
            null
        }

        Function("notifyAppLeft") {
            SessionTracker.onAppLeft(ctx)
            null
        }

        // ── Allow / cancel ────────────────────────────────────────

        Function("allowApp") { packageName: String ->
            prefs().edit()
                .putString("allowedPackage", packageName)
                .putLong("allowedTime", System.currentTimeMillis())
                .putBoolean("breathScreenActive", false)
                .remove("cancelledPackage")
                .apply()
            null
        }

        Function("cancelApp") { _: String ->
            prefs().edit()
                .putBoolean("breathScreenActive", false)
                .remove("allowedPackage")
                .remove("cancelledPackage")
                .apply()
            null
        }

        // ── Overlay service control ───────────────────────────────

        Function("stopOverlay") {
            // Allows JS to programmatically dismiss the overlay if needed
            BreathOverlayService.stop(ctx)
            null
        }

        // ── Overlay permission (SYSTEM_ALERT_WINDOW) ──────────────

        Function("canDrawOverlays") {
            // Returns true if the app has permission to draw over other apps.
            // Required before BreathOverlayService can show anything.
            android.provider.Settings.canDrawOverlays(ctx)
        }

        Function("openOverlaySettings") {
            // Opens the system "Display over other apps" settings page for this app.
            // User must toggle it on manually — Android does not allow auto-granting.
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:${ctx.packageName}")
            ).apply { flags = Intent.FLAG_ACTIVITY_NEW_TASK }
            ctx.startActivity(intent)
            null
        }

        // ── Installed apps ────────────────────────────────────────

        Function("getInstalledApps") {
            val pm     = ctx.packageManager
            val intent = Intent(Intent.ACTION_MAIN, null).apply {
                addCategory(Intent.CATEGORY_LAUNCHER)
            }
            pm.queryIntentActivities(intent, 0)
                .map {
                    mapOf(
                        "packageName" to it.activityInfo.packageName,
                        "label"       to it.loadLabel(pm).toString()
                    )
                }
                .sortedBy { it["label"] }
        }

        // ── Accessibility ─────────────────────────────────────────

        Function("isAccessibilityEnabled") {
            val expected = "${ctx.packageName}/" +
                           LuminaAccessibilityService::class.java.name
            val enabled  = Settings.Secure.getString(
                ctx.contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            ) ?: ""
            enabled.split(":").any { it.equals(expected, ignoreCase = true) }
        }

        Function("getHistory") {
            HistoryTracker.getEvents(ctx)
        }

        Function("clearHistory") {
            HistoryTracker.clear(ctx)
            null
        }

        Function("openAccessibilitySettings") {
            ctx.startActivity(
                Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
            )
            null
        }

        // ── Events ────────────────────────────────────────────────

        Events("onBlockedAppDetected")


        //focus
        Events("onBlockedAppDetected", "onFocusComplete")

        Function("startFocusMode") { durationMs: Double ->
            LuminaFocusService.start(
                appContext.reactContext!!,
                durationMs.toLong()
            )
            null
        }

        Function("stopFocusMode") {
            LuminaFocusService.stop(appContext.reactContext!!)
            null
        }

        Function("isFocusModeActive") {
            LuminaFocusService.isActive
        }

        //-- focus lock -----

        Function("isVolumeExitAllowed") {
            LuminaFocusConfig.ALLOW_VOLUME_EXIT
        }
        
        Function(
            "startFocusLock"
        ) { durationMs: Long ->

            val activity =
                appContext.currentActivity
                    ?: return@Function null

            val intent =
                Intent(
                    activity,
                    FocusLockActivity::class.java
                ).apply {

                    putExtra(
                        "durationMs",
                        durationMs
                    )
                }

            activity.startActivity(
                intent
            )

            null
        }
    }
}