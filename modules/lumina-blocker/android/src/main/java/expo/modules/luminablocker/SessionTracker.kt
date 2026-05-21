package expo.modules.luminablocker

import android.content.Context
import java.util.Calendar

import org.json.JSONArray
import org.json.JSONObject

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

    private fun prefs(ctx: Context) =
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

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
                    .MORNING
            ),

            bucketUsageKey(
                packageName,
                LuminaConfig
                    .UsageBuckets
                    .AFTERNOON
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

            allowUntilKey(packageName)
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
                    "morningUsageMs",
                    snapshot.morningUsageMs
                )

                put(
                    "afternoonUsageMs",
                    snapshot.afternoonUsageMs
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

    fun getDailySnapshots(
        ctx: Context
    ): String {

        return prefs(ctx).getString(
            KEY_DAILY_SNAPSHOTS,
            "[]"
        ) ?: "[]"
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

        val obj =
            JSONObject().apply {

                put(
                    "date",
                    snapshot.date
                )

                put(
                    "packageName",
                    snapshot.packageName
                )

                put(
                    "appName",
                    snapshot.appName
                )

                put(
                    "usageMs",
                    snapshot.usageMs
                )

                put(
                    "morningUsageMs",
                    snapshot.morningUsageMs
                )

                put(
                    "afternoonUsageMs",
                    snapshot.afternoonUsageMs
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
                    "score",
                    snapshot.score
                )

                put(
                    "level",
                    snapshot.level
                )
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

        val blockedApps =
            prefs(ctx)
                .all
                .keys
                .filter {
                    it.startsWith("score_")
                }
                .map {
                    it.removePrefix("score_")
                }

                val totalUsageMs =
                    blockedApps.sumOf { packageName ->

                        getTotalUsageMs(
                            ctx,
                            packageName
                        )
                    }

                // ── Usage buckets ───────────────────────────────────

                val morningUsageMs =
                    getTotalUsageForBucket(
                        ctx,
                        LuminaConfig
                            .UsageBuckets
                            .MORNING
                    )

                val afternoonUsageMs =
                    getTotalUsageForBucket(
                        ctx,
                        LuminaConfig
                            .UsageBuckets
                            .AFTERNOON
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

                        morningUsageMs =
                            morningUsageMs,

                        afternoonUsageMs =
                            afternoonUsageMs,

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

        val trackedApps =
            prefs(ctx)
                .all
                .keys
                .filter {
                    it.startsWith("score_")
                }
                .map {
                    it.removePrefix("score_")
                }

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

                    morningUsageMs =
                        breakdown[
                            LuminaConfig
                                .UsageBuckets
                                .MORNING
                        ] ?: 0L,

                    afternoonUsageMs =
                        breakdown[
                            LuminaConfig
                                .UsageBuckets
                                .AFTERNOON
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
    fun onAppOpened(ctx: Context, packageName: String) {
        generateDailySnapshotIfNeeded(ctx)
        val prefs = prefs(ctx)
        val now   = System.currentTimeMillis()

        // Start session timer only if no session is running
        val sessionStart = prefs.getLong(KEY_SESSION_START, 0L)
        if (sessionStart == 0L) {
            prefs.edit().putLong(KEY_SESSION_START, now).apply()
        }

        // Save which package is active (so onAppLeft knows which session ended)
        prefs.edit().putString(KEY_LAST_ACTIVE_PACKAGE, packageName).apply()

        // Rolling 1-hour open counter
        val windowStart = prefs.getLong(KEY_OPEN_WINDOW_START, now)
        val openCount   = prefs.getInt(KEY_OPEN_COUNT, 0)

        if (now - windowStart > 60 * 60 * 1000L) {
            // Window expired — start fresh
            prefs.edit()
                .putLong(KEY_OPEN_WINDOW_START, now)
                .putInt(KEY_OPEN_COUNT, 1)
                .apply()
        } else {
            prefs.edit().putInt(KEY_OPEN_COUNT, openCount + 1).apply()
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

                // total usage
                .putLong(
                    usageKey(packageName),
                    updatedTotal
                )

                // morning / afternoon / evening / night
                .putLong(
                    bucketKey,
                    updatedBucketUsage
                )

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

    fun getTotalUsageMs(
        ctx: Context,
        packageName: String
    ): Long {

        return prefs(ctx).getLong(
            usageKey(packageName),
            0L
        )
    }

    private fun currentTimeBucket(): String {

        val hour =
            Calendar.getInstance()
                .get(Calendar.HOUR_OF_DAY)

        return when {

            hour >= LuminaConfig
                .UsageBuckets
                .MORNING_START &&

            hour <
                LuminaConfig
                    .UsageBuckets
                    .MORNING_END ->

                LuminaConfig
                    .UsageBuckets
                    .MORNING


            hour >= LuminaConfig
                .UsageBuckets
                .AFTERNOON_START &&

            hour <
                LuminaConfig
                    .UsageBuckets
                    .AFTERNOON_END ->

                LuminaConfig
                    .UsageBuckets
                    .AFTERNOON


            hour >= LuminaConfig
                .UsageBuckets
                .EVENING_START &&

            hour <
                LuminaConfig
                    .UsageBuckets
                    .EVENING_END ->

                LuminaConfig
                    .UsageBuckets
                    .EVENING


            else ->
                LuminaConfig
                    .UsageBuckets
                    .NIGHT
        }
    }
    
    fun getUsageBreakdown( ctx: Context, packageName: String ): Map<String, Long> {

        val prefs = prefs(ctx)

        return mapOf(
            "morning" to prefs.getLong(
                bucketUsageKey(
                    packageName,
                    "morning"
                ),
                0L
            ),

            "afternoon" to prefs.getLong(
                bucketUsageKey(
                    packageName,
                    "afternoon"
                ),
                0L
            ),

            "evening" to prefs.getLong(
                bucketUsageKey(
                    packageName,
                    "evening"
                ),
                0L
            ),

            "night" to prefs.getLong(
                bucketUsageKey(
                    packageName,
                    "night"
                ),
                0L
            )
        )
    }

    fun getAllAppScores(ctx: Context): List<Map<String, Any>> {

        val prefs = prefs(ctx)

        val all = prefs.all

        val result =
            mutableListOf<Map<String, Any>>()

        for ((key, value) in all) {

            if (!key.startsWith("score_")) {
                continue
            }

            val packageName =
                key.removePrefix("score_")

            val score =
                value as? Int ?: 0

            if (score <= 0) {
                continue
            }

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

            result.add(
                mapOf(
                    "packageName" to packageName,
                    "appName" to appName,
                    "score" to score,
                    "level" to ScoreEngine
                        .scoreToLevel(score),
                    "usageMs" to UsageStatsHelper
                    .getTodayUsageForApp(
                        ctx,
                        packageName
                    ),
                    "usageBreakdown" to UsageStatsHelper.getTodayUsageBreakdown(
                        ctx,
                        packageName
                    )
                )
            )
        }

        return result.sortedByDescending {
            it["score"] as Int
        }
    }

    // ── Getters for ScoreEngine ──────────────────────────────────

    /** Duration of the PREVIOUS completed session — used by ScoreEngine at open time. */
    fun getLastSessionDurationMs(ctx: Context): Long =
        prefs(ctx).getLong(KEY_LAST_SESSION_DURATION, 0L)

    /** How many times the app was opened in the rolling 1-hour window. */
    fun getOpenCountThisHour(ctx: Context): Int =
        prefs(ctx).getInt(KEY_OPEN_COUNT, 0)

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
        val lastDay = prefs.getInt(KEY_LAST_RESET_DAY, -1)

        if (today != lastDay) {
            val current = getStoredScore(ctx, packageName)
            val capped  = minOf(current, LuminaConfig.Reset.NEW_DAY_SCORE_CAP)
            prefs.edit()
                .putInt(scoreKey(packageName), capped)
                .putInt(KEY_LAST_RESET_DAY, today)
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