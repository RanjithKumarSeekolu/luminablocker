package expo.modules.luminablocker

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.net.Uri
import android.provider.Settings
import android.util.Base64
import java.io.ByteArrayOutputStream
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import android.util.Log

class LuminaBlockerModule : Module() {

    private val ctx get() = appContext.reactContext
        ?: throw IllegalStateException("React context unavailable")

    private fun prefs() = ctx.getSharedPreferences("LuminaPrefs", Context.MODE_PRIVATE)

    /** Encode the launcher icon so React Native can render the real icon for
     * every installed app instead of relying on a small hardcoded icon map. */
    private fun launcherIconDataUri(pm: PackageManager, packageName: String): String {
        return try {
            val drawable = pm.getApplicationIcon(packageName)
            val size = 96
            val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bitmap)
            drawable.setBounds(0, 0, size, size)
            drawable.draw(canvas)

            val output = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)
            bitmap.recycle()
            "data:image/png;base64," +
                Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP)
        } catch (_: Exception) {
            ""
        }
    }

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

        Function("isMindfulRemindersEnabled") {
            prefs().getBoolean("mindfulReminders", true)
        }

        Function("setMindfulRemindersEnabled") { enabled: Boolean ->
            prefs().edit()
                .putBoolean("mindfulReminders", enabled)
                .apply()
            null
        }

        Function("getAppSettings") { packageName: String ->
            mapOf(
                "intensity" to prefs().getInt("app_intensity_$packageName", -1),
                "mindfulReminder" to prefs().getBoolean("app_mindful_$packageName", true),
                "nightLock" to prefs().getBoolean("app_night_lock_$packageName", false)
            )
        }

        Function("setAppIntensity") { packageName: String, intensity: Int ->
            prefs().edit()
                .putInt("app_intensity_$packageName", intensity.coerceIn(0, 2))
                .apply()
            null
        }

        Function("setMindfulReminder") { packageName: String, enabled: Boolean ->
            prefs().edit()
                .putBoolean("app_mindful_$packageName", enabled)
                .apply()
            null
        }

        Function("setNightLock") { packageName: String, enabled: Boolean ->
            prefs().edit()
                .putBoolean("app_night_lock_$packageName", enabled)
                .apply()
            null
        }

        // --─ Daily snapshots ────────────────────────────────────────

        Function("getAppDailySnapshots") {
            SessionTracker.getAppDailySnapshots(appContext.reactContext!!)
        }

        // NEW
        Function("getDailySnapshots") { days: Int ->
            SessionTracker.getDailySnapshots(appContext.reactContext!!, days)
        }

        // ── Usage permission — keep ONE only ─────────────────────────
        Function("hasUsagePermission") {
            UsageStatsHelper.hasUsagePermission(appContext.reactContext!!)
        }

        Function("getAppDailySnapshots") {

            SessionTracker.getAppDailySnapshots(
                appContext.reactContext!!
            )
        }

        Function("getWeeklyUsageForApp") { packageName: String ->

            SessionTracker
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
                    val packageName = it.activityInfo.packageName

                    mapOf(
                        "packageName" to packageName,
                        "label"       to it.loadLabel(pm).toString(),
                        "category" to AppCategoryResolver.getCategory(packageName),
                        "icon"        to launcherIconDataUri(pm, packageName)

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

        Function("setIsVolumeExitAllowed") { allowed: Boolean ->
            LuminaFocusConfig.ALLOW_VOLUME_EXIT = allowed

            Log.d(
                "LuminaFocus",
                "allowVolumeExit -> $allowed"
            )

            null
        }

        Function("isOverlayEnabled") {
            prefs().getBoolean("overlayEnabled", true)
        }

        Function("setOverlayEnabled") { enabled: Boolean ->
            prefs().edit()
                .putBoolean("overlayEnabled", enabled)
                .apply()
            null
        }
        
        Function(
            "startFocusLock"
        ) { durationMs: Long ->

            Log.d("LuminaBlockerFocus", "Starting focus lock for ${durationMs}ms")

            // The activity renders the lock screen, while the foreground
            // service keeps focus mode active when another app/window appears.
            LuminaFocusService.start(ctx, durationMs, headless = true)

            val activity =
                appContext.currentActivity
                    ?: return@Function null

            Log.d("LuminaBlockerFocus", "Current activity: ${activity.localClassName}")


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

            Log.d("LuminaBlockerFocus", "Starting focus lock activity")
            // Count the direct launch so the service watchdog does not launch
            // a second copy during the startup transition.
            FocusLockActivity.allowRelaunch()
            activity.startActivity(
                intent
            )

            null
        }

        Function("getTodayFocusMs") {
            FocusSessionStore.getTodayTotalMs(appContext.reactContext!!)
        }

        Function("getWeeklyFocusData") {
            FocusSessionStore.getWeeklyData(appContext.reactContext!!)
        }

        Function("getAllFocusSessions") {
            FocusSessionStore.getAllSessions(appContext.reactContext!!)
        }

        Function("clearAllData") {
            listOf("LuminaSession", "LuminaHistory", "LuminaPrefs", "LuminaFocus")
                .forEach { name ->
                    ctx.getSharedPreferences(name, Context.MODE_PRIVATE)
                        .edit().clear().apply()
                }
            null
        }
    }
}
