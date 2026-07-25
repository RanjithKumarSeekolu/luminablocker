package expo.modules.luminablocker

import android.content.Context
import java.util.Calendar

import org.json.JSONArray
import org.json.JSONObject
import android.content.pm.ApplicationInfo

/**
 * Tracks per-app usage: session timing, open frequency, reopen gaps, and score.
 *
 * Key design decisions:
 *  - Session start is reset to 0 when the app leaves foreground (onAppLeft).
 *  - LAST session duration (not current) feeds ScoreEngine, because at open-time
 *    the current session duration is always 0 (just started).
 *  - Open count uses a rolling 1-hour window, not a daily counter, so morning
 *    usage doesn't penalise evening usage.
 *  - Score decays after 30 min of no use and is soft-capped at midnight.
 */
object SessionTracker {

    private const val PREFS = "LuminaSession"

    // ── SharedPreferences keys ───────────────────────────────────
    private const val KEY_SESSION_START          = "sessionStart"
    private const val KEY_LAST_SESSION_DURATION  = "lastSessionDurationMs"
    private const val KEY_LAST_LEAVE_TIME        = "lastLeaveTime"
    private const val KEY_OPEN_COUNT             = "openCount"
    private const val KEY_OPEN_WINDOW_START      = "openWindowStart"
    private const val KEY_CURRENT_SCORE          = "currentScore"
    private const val KEY_LAST_RESET_DAY         = "lastResetDay"
    private const val KEY_LAST_ACTIVE_PACKAGE    = "lastActivePackage"
    
    private const val KEY_DAILY_SNAPSHOTS = "daily_snapshots"
    private const val KEY_LAST_SNAPSHOT_DATE = "last_snapshot_date"
    private const val KEY_APP_DAILY_SNAPSHOTS = "app_daily_snapshots"
    private const val KEY_USAGE_DATE = "usage_date"

    private fun prefs(ctx: Context) =
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /**
     * Apps selected by the user must be included even before their first
     * blocked open. A newly selected app has no score_* preference yet, but
     * UsageStats can still provide its usage from earlier today.
     */
    private fun trackedPackageNames(ctx: Context): Set<String> {
        val sessionPrefs = prefs(ctx)
        val scoredApps = sessionPrefs.all.keys
            .filter { it.startsWith("score_") }
            .map { it.removePrefix("score_") }
        val blockedApps = ctx.getSharedPreferences("LuminaPrefs", Context.MODE_PRIVATE)
            .getStringSet("blockedApps", emptySet())
            ?.toList()
            ?: emptyList()

        return (scoredApps + blockedApps).toSet()
    }

    private fun scoreKey(packageName: String) =
    "score_$packageName"

    private fun usageKey(packageName: String) =
    "usage_$packageName"

    private fun bucketUsageKey( packageName: String, bucket: String) =
    "usage_${packageName}_$bucket"

    private fun lastOpenKey( packageName: String) =
    "last_open_$packageName"

    private fun allowUntilKey(packageName: String) =
    "allow_until_$packageName"

    private fun frequencyKey(packageName: String) =
    "frequency_$packageName"
    
    private fun resetDayKey(packageName: String) = "reset_day_$packageName"


    // --store daily snapshot of all scores for historical graphing in the future (not yet implemented)--

    fun clearAppData(
        ctx: Context,
        packageName: String
    ) {

        val prefs = prefs(ctx)

        val keysToRemove = listOf(

            scoreKey(packageName),

            usageKey(packageName),

            bucketUsageKey(
                packageName,
                LuminaConfig
                    .UsageBuckets
                    .EARLY
            ),

            bucketUsageKey(
                packageName,
                LuminaConfig
                    .UsageBuckets
                    .WORK
            ),

            bucketUsageKey(
                packageName,
                LuminaConfig
                    .UsageBuckets
                    .EVENING
            ),

            bucketUsageKey(
                packageName,
                LuminaConfig
                    .UsageBuckets
                    .NIGHT
            ),

            frequencyKey(packageName),

            lastOpenKey(packageName),

            allowUntilKey(packageName),

            hourlyOpenKey(packageName),
            hourlyWindowKey(packageName),
            resetDayKey(packageName),

            "app_intensity_$packageName",
            "app_mindful_$packageName",
            "app_night_lock_$packageName",

        )

        val editor =
            prefs.edit()

        keysToRemove.forEach {
            editor.remove(it)
        }

        editor.apply()
        clearAppSnapshots(
            ctx,
            packageName
        )

        HistoryTracker.clearAppHistory(
            ctx,
            packageName
        )
    }

    private fun clearAppSnapshots(
        ctx: Context,
        packageName: String
    ) {

        val prefs = prefs(ctx)

        val existing =
            prefs.getString(
                KEY_APP_DAILY_SNAPSHOTS,
                "[]"
            ) ?: "[]"

        val array =
            JSONArray(existing)

        val filtered =
            JSONArray()

        for (i in 0 until array.length()) {

            val obj =
                array.getJSONObject(i)

            if (
                obj.getString("packageName")
                != packageName
            ) {

                filtered.put(obj)
            }
        }

        prefs.edit()
            .putString(
                KEY_APP_DAILY_SNAPSHOTS,
                filtered.toString()
            )
            .apply()
    }

    private fun todayKey(): String {
        val calendar = java.util.Calendar.getInstance()

        val year =
            calendar.get(java.util.Calendar.YEAR)

        val month =
            calendar.get(java.util.Calendar.MONTH) + 1

        val day =
            calendar.get(java.util.Calendar.DAY_OF_MONTH)

        return "$year-$month-$day"
    }

    private fun getTotalUsageForBucket(
        ctx: Context,
        bucket: String
    ): Long {

        val prefs = prefs(ctx)

        return prefs.all
            .filterKeys {
                it.startsWith("usage_") &&
                it.endsWith("_$bucket")
            }
            .values
            .sumOf {
                (it as? Long) ?: 0L
            }
    }

    private fun countHistoryReason(
        ctx: Context,
        reason: String
    ): Int {

        return HistoryTracker
            .getHistory(ctx)
            .count {
                it.reason == reason
            }
    }

    private fun saveSnapshot(
        ctx: Context,
        snapshot: DailyBalanceSnapshot
    ) {

        val prefs = prefs(ctx)

        val existing =
            prefs.getString(
                KEY_DAILY_SNAPSHOTS,
                "[]"
            ) ?: "[]"

        val array =
            JSONArray(existing)

        val obj =
            JSONObject().apply {

                put(
                    "date",
                    snapshot.date
                )

                put(
                    "totalUsageMs",
                    snapshot.totalUsageMs
                )

                put(
                    "earlyUsageMs",
                    snapshot.earlyUsageMs
                )

                put(
                    "workUsageMs",
                    snapshot.workUsageMs
                )

                put(
                    "eveningUsageMs",
                    snapshot.eveningUsageMs
                )

                put(
                    "nightUsageMs",
                    snapshot.nightUsageMs
                )

                put(
                    "reopenEvents",
                    snapshot.reopenEvents
                )

                put(
                    "intentionalExits",
                    snapshot.intentionalExits
                )

                put(
                    "focusResets",
                    snapshot.focusResets
                )

                put(
                    "overlaysTriggered",
                    snapshot.overlaysTriggered
                )
            }

        array.put(obj)

        prefs.edit()
            .putString(
                KEY_DAILY_SNAPSHOTS,
                array.toString()
            )
            .apply()
    }

    private fun getAppCategory(
        ctx: Context,
        packageName: String
    ): String {

        return try {
            val appInfo =
                ctx.packageManager.getApplicationInfo(
                    packageName,
                    0
                )

            when (appInfo.category) {
                ApplicationInfo.CATEGORY_GAME ->
                    "GAMES"

                ApplicationInfo.CATEGORY_SOCIAL ->
                    "SOCIAL"

                ApplicationInfo.CATEGORY_AUDIO ->
                    "MUSIC"

                ApplicationInfo.CATEGORY_VIDEO ->
                    "VIDEO"

                ApplicationInfo.CATEGORY_NEWS ->
                    "NEWS"

                ApplicationInfo.CATEGORY_PRODUCTIVITY ->
                    "PRODUCTIVITY"

                ApplicationInfo.CATEGORY_IMAGE ->
                    "PHOTOGRAPHY"

                ApplicationInfo.CATEGORY_MAPS ->
                    "NAVIGATION"

                else ->
                    "APP"
            }
        } catch (e: Exception) {
            "APP"
        }
    }

    fun getDailySnapshots(
        ctx: Context,
        days: Int = 7
    ): List<Map<String, Any>> {

        val sdf = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault())

        val trackedApps = trackedPackageNames(ctx)

        val result = mutableListOf<Map<String, Any>>()

        for (dayOffset in 0 until days) {
            val cal = java.util.Calendar.getInstance().apply {
                add(java.util.Calendar.DAY_OF_YEAR, -dayOffset)
                set(java.util.Calendar.HOUR_OF_DAY, 0)
                set(java.util.Calendar.MINUTE, 0)
                set(java.util.Calendar.SECOND, 0)
                set(java.util.Calendar.MILLISECOND, 0)
            }
            val dayDate = sdf.format(cal.time)
            val isToday = dayOffset == 0

            val apps = trackedApps.map { packageName ->
                val score = getStoredScore(ctx, packageName)
                val appName = try {
                    val info = ctx.packageManager.getApplicationInfo(packageName, 0)
                    ctx.packageManager.getApplicationLabel(info).toString()
                } catch (e: Exception) { packageName }

                // ── Use SessionTracker prefs for today, UsageStats for past days ──
                val usageBreakdown: Map<String, Any> = if (isToday) {
                    val raw = UsageStatsHelper.getTodayUsageBreakdown(ctx, packageName)
                    mapOf(
                        "total"   to ((raw["total"]   as? Number)?.toLong() ?: 0L),
                        "early"   to ((raw["early"]   as? Number)?.toLong() ?: 0L),  // ← was "morning"
                        "work"    to ((raw["work"]    as? Number)?.toLong() ?: 0L),  // ← was "afternoon"
                        "evening" to ((raw["evening"] as? Number)?.toLong() ?: 0L),
                        "night"   to ((raw["night"]   as? Number)?.toLong() ?: 0L),
                    )
                } else {
                    val raw = UsageStatsHelper.getDailyUsageForApp(ctx, packageName, dayOffset)
                    mapOf(
                        "total"   to ((raw["total"]   as? Number)?.toLong() ?: 0L),
                        "early"   to ((raw["early"]   as? Number)?.toLong() ?: 0L),
                        "work"    to ((raw["work"]    as? Number)?.toLong() ?: 0L),
                        "evening" to ((raw["evening"] as? Number)?.toLong() ?: 0L),
                        "night"   to ((raw["night"]   as? Number)?.toLong() ?: 0L),
                    )
                }

                mapOf(
                    "packageName"    to packageName,
                    "appName"        to appName,
                    "score"          to score,
                    "level"          to ScoreEngine.scoreToLevel(score),
                    "usageMs"        to ((usageBreakdown["total"] as? Number)?.toLong() ?: 0L),
                    "usageBreakdown" to usageBreakdown,
                    "events"         to getEventsForAppOnDate(ctx, packageName, dayDate)
                )
            }

            // ── Day-level totals from app entries (no extra UsageStats call) ──
            val totalMs   = apps.sumOf { (it["usageMs"] as? Long) ?: 0L }
            val earlyMs   = apps.sumOf { ((it["usageBreakdown"] as? Map<*, *>)?.get("early")   as? Long) ?: 0L }
            val workMs    = apps.sumOf { ((it["usageBreakdown"] as? Map<*, *>)?.get("work")    as? Long) ?: 0L }
            val eveningMs = apps.sumOf { ((it["usageBreakdown"] as? Map<*, *>)?.get("evening") as? Long) ?: 0L }
            val nightMs   = apps.sumOf { ((it["usageBreakdown"] as? Map<*, *>)?.get("night")   as? Long) ?: 0L }

            result.add(mapOf(
                "date"          to dayDate,
                "totalUsageMs"  to totalMs,
                "earlyUsageMs"  to earlyMs,    // ← was morningUsageMs
                "workUsageMs"   to workMs,     // ← was afternoonUsageMs
                "eveningUsageMs" to eveningMs,
                "nightUsageMs"  to nightMs,
                "apps"          to apps
            ))
        }

        return result
    }

    fun getWeeklyUsageForApp(
        ctx: Context,
        packageName: String
    ): List<Map<String, Any>> {

        val snapshots = getDailySnapshots(ctx, 7)

        return snapshots.reversed().map { day ->

            val apps =
                day["apps"] as? List<Map<String, Any>>
                    ?: emptyList()

            val app =
                apps.firstOrNull {
                    it["packageName"] == packageName
                }

            mapOf(
                "day" to java.text.SimpleDateFormat(
                    "EEE",
                    java.util.Locale.getDefault()
                ).format(
                    java.text.SimpleDateFormat(
                        "yyyy-MM-dd",
                        java.util.Locale.getDefault()
                    ).parse(day["date"] as String)!!
                ),

                "usageMs" to (
                    app?.get("usageMs")
                        as? Long ?: 0L
                )
            )
        }
    }

    private fun getEventsForAppOnDate(
        ctx: Context,
        packageName: String,
        date: String
    ): List<Map<String, Any>> {

        val sdf = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault())

        return HistoryTracker.getHistory(ctx)
            .filter { event ->
                event.packageName == packageName &&
                sdf.format(java.util.Date(event.timestamp)) == date
            }
            .map { event ->
                mapOf(
                    "timestamp"     to event.timestamp,
                    "reason"        to event.reason,
                    "details"       to event.details,
                    "delta"         to event.delta,
                    "previousScore" to event.previousScore,
                    "newScore"      to event.newScore
                )
            }
    }

    private fun saveAppDailySnapshot(
        ctx: Context,
        snapshot: AppDailySnapshot
    ) {

        val prefs = prefs(ctx)

        val existing =
            prefs.getString(
                KEY_APP_DAILY_SNAPSHOTS,
                "[]"
            ) ?: "[]"

        val array =
            JSONArray(existing)

        val obj = JSONObject().apply {
            put("date", snapshot.date)
            put("packageName", snapshot.packageName)
            put("appName", snapshot.appName)
            put("usageMs", snapshot.usageMs)
            put("earlyUsageMs", snapshot.earlyUsageMs)      // ← was morningUsageMs
            put("workUsageMs", snapshot.workUsageMs)         // ← was afternoonUsageMs
            put("eveningUsageMs", snapshot.eveningUsageMs)
            put("nightUsageMs", snapshot.nightUsageMs)
            put("score", snapshot.score)
            put("level", snapshot.level)
        }
        var replaced = false

        for (i in 0 until array.length()) {

            val existingObj =
                array.getJSONObject(i)

            val sameDate =
                existingObj.getString("date") ==
                    snapshot.date

            val samePackage =
                existingObj.getString("packageName") ==
                    snapshot.packageName

            if (
                sameDate &&
                samePackage
            ) {

                // Replace existing snapshot
                array.put(i, obj)

                replaced = true

                break
            }
        }

        // Add new snapshot only if not already present
        if (!replaced) {
            array.put(obj)
        }

        prefs.edit()
            .putString(
                KEY_APP_DAILY_SNAPSHOTS,
                array.toString()
            )
            .apply()
    }

    fun getAppDailySnapshots(
        ctx: Context
    ): String {

        return prefs(ctx).getString(
            KEY_APP_DAILY_SNAPSHOTS,
            "[]"
        ) ?: "[]"
    }

    // ── Reset daily usage counters ──────────────────────────────
    private fun resetDailyUsage(ctx: Context) {
        val prefs = prefs(ctx)
        val editor = prefs.edit()
        
        // Remove all usage_ keys (total + bucket) for all tracked apps
        prefs.all.keys
            .filter { key ->
                key.startsWith("usage_") // covers usage_pkg, usage_pkg_morning etc
            }
            .forEach { key -> editor.remove(key) }
        
        editor.apply()
    }

    fun generateDailySnapshotIfNeeded(ctx: Context) {

        val prefs = prefs(ctx)

        val today =
            todayKey()

        val lastSnapshotDate =
            prefs.getString(
                KEY_LAST_SNAPSHOT_DATE,
                null
            )

        // already generated today

        if (today == lastSnapshotDate) {
            return
        }

        // ── Total usage across all apps ─────────────────────

        // ── Total usage ONLY for tracked / blocked apps ─────────────────────

        val blockedApps = trackedPackageNames(ctx).toList()

                val totalUsageMs =
                    blockedApps.sumOf { packageName ->

                        getTotalUsageMs(
                            ctx,
                            packageName
                        )
                    }

                // ── Usage buckets ───────────────────────────────────

                val earlyUsageMs =
                    getTotalUsageForBucket(
                        ctx,
                        LuminaConfig
                            .UsageBuckets
                            .EARLY
                    )

                val workUsageMs =
                    getTotalUsageForBucket(
                        ctx,
                        LuminaConfig
                            .UsageBuckets
                            .WORK
                    )

                val eveningUsageMs =
                    getTotalUsageForBucket(
                        ctx,
                        LuminaConfig
                            .UsageBuckets
                            .EVENING
                    )

                val nightUsageMs =
                    getTotalUsageForBucket(
                        ctx,
                        LuminaConfig
                            .UsageBuckets
                            .NIGHT
                    )

                // ── Behavioral events ───────────────────────────────

                val reopenEvents =
                    countHistoryReason(
                        ctx,
                        "Quick reopen detected"
                    )

                val intentionalExits =
                    countHistoryReason(
                        ctx,
                        "Intentional exit"
                    )

                val focusResets =
                    countHistoryReason(
                        ctx,
                        "Focus reset"
                    )

                val overlaysTriggered =
                    HistoryTracker
                        .getHistory(ctx)
                        .size

                // ── Snapshot model ──────────────────────────────────

                val snapshot =
                    DailyBalanceSnapshot(

                        date = today,

                        totalUsageMs =
                            totalUsageMs,

                        earlyUsageMs =
                            earlyUsageMs,

                        workUsageMs =
                            workUsageMs,

                        eveningUsageMs =
                            eveningUsageMs,

                        nightUsageMs =
                            nightUsageMs,

                        reopenEvents =
                            reopenEvents,

                        intentionalExits =
                            intentionalExits,

                        focusResets =
                            focusResets,

                        overlaysTriggered =
                            overlaysTriggered
                    )

                // ── Persist snapshot ────────────────────────────────

                saveSnapshot(
                    ctx,
                    snapshot
                )

        val trackedApps = trackedPackageNames(ctx)

        trackedApps.forEach { packageName ->

            val usageMs =
                UsageStatsHelper
                    .getTodayUsageForApp(
                        ctx,
                        packageName
                    )

            val breakdown =
                UsageStatsHelper
                    .getTodayUsageBreakdown(
                        ctx,
                        packageName
                    )

            val score =
                getStoredScore(
                    ctx,
                    packageName
                )

            val level =
                ScoreEngine
                    .scoreToLevel(score)

            val appName = try {

                val info =
                    ctx.packageManager
                        .getApplicationInfo(
                            packageName,
                            0
                        )

                ctx.packageManager
                    .getApplicationLabel(info)
                    .toString()

            } catch (e: Exception) {

                packageName
            }

            val snapshot =
                AppDailySnapshot(

                    date = today,

                    packageName =
                        packageName,

                    appName =
                        appName,

                    usageMs =
                        usageMs,

                    earlyUsageMs =
                        breakdown[
                            LuminaConfig
                                .UsageBuckets
                                .EARLY
                        ] ?: 0L,

                    workUsageMs =
                        breakdown[
                            LuminaConfig
                                .UsageBuckets
                                .WORK
                        ] ?: 0L,

                    eveningUsageMs =
                        breakdown[
                            LuminaConfig
                                .UsageBuckets
                                .EVENING
                        ] ?: 0L,

                    nightUsageMs =
                        breakdown[
                            LuminaConfig
                                .UsageBuckets
                                .NIGHT
                        ] ?: 0L,

                    score = score,

                    level = level
                )

            saveAppDailySnapshot(
                ctx,
                snapshot
            )
        }

        resetDailyUsage(ctx) 
        
        prefs.edit()
            .putString(
                KEY_LAST_SNAPSHOT_DATE,
                today
            )
            .apply()
    }
    
    // ── App opened ───────────────────────────────────────────────

    /**
     * Call when the user opens a blocked app (before ScoreEngine.evaluate).
     * Starts the session timer if not already running.
     * Increments the rolling-hour open counter.
     */

     private fun lastIncrementKey(packageName: String) = "last_increment_$packageName"

    fun onAppOpened(ctx: Context, packageName: String) {
        val prefs = prefs(ctx)
        val now   = System.currentTimeMillis()

        // Debounce — ignore if incremented within last 2 seconds
        val lastIncrement = prefs.getLong(lastIncrementKey(packageName), 0L)
        if (now - lastIncrement < 2000L) return   // ← skip duplicate call
        prefs.edit().putLong(lastIncrementKey(packageName), now).apply()

        generateDailySnapshotIfNeeded(ctx)


        // Start session timer only if no session is running
        val sessionStart = prefs.getLong(KEY_SESSION_START, 0L)
        if (sessionStart == 0L) {
            prefs.edit().putLong(KEY_SESSION_START, now).apply()
        }

        // Save which package is active (so onAppLeft knows which session ended)
        prefs.edit().putString(KEY_LAST_ACTIVE_PACKAGE, packageName).apply()

        // Rolling 1-hour open counter
        val windowStart = prefs.getLong(hourlyWindowKey(packageName), now)
        val hourlyCount = prefs.getInt(hourlyOpenKey(packageName), 0)

        if (now - windowStart > 60 * 60 * 1000L) {
            prefs.edit()
                .putLong(hourlyWindowKey(packageName), now)
                .putInt(hourlyOpenKey(packageName), 1)
                .apply()
        } else {
            prefs.edit().putInt(hourlyOpenKey(packageName), hourlyCount + 1).apply()
        }
    }

    fun getLastActivePackage(ctx: Context): String =
    prefs(ctx).getString(KEY_LAST_ACTIVE_PACKAGE, "") ?: ""

    // ── App left foreground ──────────────────────────────────────

    /**
     * Call when the blocked app leaves foreground (user went to home, another app, etc.).
     * Saves the completed session duration so ScoreEngine can use it on the NEXT open.
     */
    fun onAppLeft(ctx: Context) {

        val prefs = prefs(ctx)

        val now =
            System.currentTimeMillis()

        val start =
            prefs.getLong(
                KEY_SESSION_START,
                0L
            )

        // Only save if a session was actually running

        val sessionDuration =
            if (start > 0L)
                now - start
            else
                0L

        val packageName =
            getLastActivePackage(ctx)

        if (
            packageName.isNotBlank() &&
            sessionDuration > 0
        ) {

            // ── Total usage ─────────────────────────

            val currentTotal =
                getTotalUsageMs(
                    ctx,
                    packageName
                )

            val updatedTotal =
                currentTotal +
                    sessionDuration

            // ── Time bucket usage ───────────────────

            val bucket =
                currentTimeBucket()

            val bucketKey =
                bucketUsageKey(
                    packageName,
                    bucket
                )

            val currentBucketUsage =
                prefs.getLong(
                    bucketKey,
                    0L
                )

            val updatedBucketUsage =
                currentBucketUsage +
                    sessionDuration

            // ── Persist usage ───────────────────────

            prefs.edit()
                .putString(KEY_USAGE_DATE, todayKey())  // ← stamp today's date
                .putLong(usageKey(packageName), updatedTotal)
                .putLong(bucketKey, updatedBucketUsage)
                .apply()
        }

        // ── Save session metadata ──────────────────

        prefs.edit()

            .putLong(
                KEY_LAST_SESSION_DURATION,
                sessionDuration
            )

            .putLong(
                KEY_LAST_LEAVE_TIME,
                now
            )

            .putLong(
                KEY_SESSION_START,
                0L
            )

            // reset session timer

            .apply()
    }

    fun getTotalUsageMs(ctx: Context, packageName: String): Long {
        val prefs = prefs(ctx)
        if (prefs.getString(KEY_USAGE_DATE, null) != todayKey()) return 0L
        return prefs.getLong(usageKey(packageName), 0L)
    }

    private fun currentTimeBucket(): String {
        val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        return when {
            hour >= LuminaConfig.UsageBuckets.EVENING_END   -> LuminaConfig.UsageBuckets.NIGHT
            hour >= LuminaConfig.UsageBuckets.EVENING_START -> LuminaConfig.UsageBuckets.EVENING
            hour >= LuminaConfig.UsageBuckets.WORK_START    -> LuminaConfig.UsageBuckets.WORK
            else                                             -> LuminaConfig.UsageBuckets.EARLY
        }
    }
    
    fun getUsageBreakdown(ctx: Context, packageName: String): Map<String, Long> {
        val prefs = prefs(ctx)
        if (prefs.getString(KEY_USAGE_DATE, null) != todayKey()) return mapOf(
            "early" to 0L, "work" to 0L, "evening" to 0L, "night" to 0L
        )
        return mapOf(
            "early"   to prefs.getLong(bucketUsageKey(packageName, "early"),   0L),
            "work"    to prefs.getLong(bucketUsageKey(packageName, "work"),    0L),
            "evening" to prefs.getLong(bucketUsageKey(packageName, "evening"), 0L),
            "night"   to prefs.getLong(bucketUsageKey(packageName, "night"),   0L),
        )
    }

    fun getAllAppScores(ctx: Context): List<Map<String, Any>> {
        val prefs = prefs(ctx)
        val all = prefs.all

        // Include selected apps before they have a score_* preference so their
        // existing UsageStats data appears immediately after selection.
        val packageNames = trackedPackageNames(ctx).toList()

        packageNames.forEach { pkg ->
            applyDailyResetIfNeeded(ctx, pkg)
        }

        // Single queryEvents call for all apps instead of N calls
        val usageMap = UsageStatsHelper.getTodayUsageBreakdownForApps(ctx, packageNames)

        val result = mutableListOf<Map<String, Any>>()

        for (packageName in packageNames) {
            val score = all[scoreKey(packageName)] as? Int ?: 0

            val appName = try {
                val info = ctx.packageManager.getApplicationInfo(packageName, 0)
                ctx.packageManager.getApplicationLabel(info).toString()
            } catch (e: Exception) {
                packageName
            }

            val usageRaw = usageMap[packageName] ?: emptyMap()

            result.add(
                mapOf(
                    "packageName" to packageName,
                    "appName"     to appName,
                    "score"       to score,
                    "level"       to ScoreEngine.scoreToLevel(score),
                    "usageMs"     to ((usageRaw["total"]   as? Number)?.toLong() ?: 0L),
                    "usageBreakdown" to mapOf(
                        "early"   to ((usageRaw["early"]   as? Number)?.toLong() ?: 0L),
                        "work"    to ((usageRaw["work"]    as? Number)?.toLong() ?: 0L),
                        "evening" to ((usageRaw["evening"] as? Number)?.toLong() ?: 0L),
                        "night"   to ((usageRaw["night"]   as? Number)?.toLong() ?: 0L),
                    ),
                    "category" to getAppCategory(ctx, packageName)
                )
            )
        }

        return result.sortedByDescending { it["score"] as Int }
    }

    // ── Getters for ScoreEngine ──────────────────────────────────

    /** Duration of the PREVIOUS completed session — used by ScoreEngine at open time. */
    fun getLastSessionDurationMs(ctx: Context): Long =
        prefs(ctx).getLong(KEY_LAST_SESSION_DURATION, 0L)

    private fun hourlyOpenKey(packageName: String) = "hourly_open_$packageName"
    private fun hourlyWindowKey(packageName: String) = "hourly_window_$packageName"

    fun getOpenCountThisHour(ctx: Context, packageName: String): Int {
        val prefs = prefs(ctx)
        val now = System.currentTimeMillis()
        val windowStart = prefs.getLong(hourlyWindowKey(packageName), now)
        if (now - windowStart > 60 * 60 * 1000L) return 0
        return prefs.getInt(hourlyOpenKey(packageName), 0)
    }

    /**
     * Time since the app was last left.
     * Returns Long.MAX_VALUE if the app has never been closed (first ever open).
     * Short gap = user came back quickly = compulsive check.
     */
    fun getReopenGapMs(ctx: Context): Long {
        val lastLeave = prefs(ctx).getLong(KEY_LAST_LEAVE_TIME, 0L)
        return if (lastLeave == 0L) Long.MAX_VALUE
        else System.currentTimeMillis() - lastLeave
    }

    fun getCurrentHour(): Int =
        Calendar.getInstance().get(Calendar.HOUR_OF_DAY)

    // ── Score persistence ────────────────────────────────────────

    fun getStoredScore(ctx: Context, packageName: String): Int =
        prefs(ctx).getInt(scoreKey(packageName), 0)

    fun setStoredScore(ctx: Context, packageName: String, score: Int) {
        prefs(ctx).edit().putInt(scoreKey(packageName), score).apply()
    }

    // ── Daily soft-reset ─────────────────────────────────────────

    /**
     * At midnight, clamp score to NEW_DAY_SCORE_CAP instead of zeroing it.
     * Yesterday's heavy usage still slightly elevates today's first open,
     * but doesn't carry full penalty into a new day.
     */
    fun applyDailyResetIfNeeded(ctx: Context, packageName: String) {
        val prefs   = prefs(ctx)
        val today   = Calendar.getInstance().get(Calendar.DAY_OF_YEAR)
        val lastDay = prefs.getInt(resetDayKey(packageName), -1)

        if (today != lastDay) {
            prefs.edit()
                .putInt(scoreKey(packageName), 0)
                .putInt(resetDayKey(packageName), today)
                .apply()
        }
    }

    // ── No-use partial reset ─────────────────────────────────────

    /**
     * If the user has been away for ≥ 30 min, subtract PARTIAL_RESET_SCORE.
     * Only applied once per away period (lastLeaveTime is cleared after applying).
     */
    fun applyNoUseResetIfNeeded(ctx: Context, packageName: String) {
        val prefs     = prefs(ctx)
        val lastLeave = prefs.getLong(KEY_LAST_LEAVE_TIME, 0L)

        if (lastLeave == 0L) return   // no recorded leave time yet

        val awayMs = System.currentTimeMillis() - lastLeave

        if (awayMs >= LuminaConfig.Reset.NO_USE_WINDOW_MS) {
            val current = getStoredScore(ctx, packageName)
            val reduced = (current - LuminaConfig.Reset.PARTIAL_RESET_SCORE).coerceAtLeast(0)
            setStoredScore(ctx, packageName ,reduced)
            HistoryTracker.addEvent(
                ctx,
                "",
                "Lumina",
                "Recovery",
                "You stayed away from distracting apps for 30 minutes.",
                -LuminaConfig.Reset.PARTIAL_RESET_SCORE,
                current,
                reduced
            )
            // Clear so we don't double-apply on the next open
            prefs.edit().putLong(KEY_LAST_LEAVE_TIME, 0L).apply()
        }
    }
}
