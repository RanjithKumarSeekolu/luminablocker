package expo.modules.luminablocker

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.app.usage.UsageEvents
import android.content.Context
import android.os.Process
import java.util.Calendar
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object UsageStatsHelper {

  fun getTodayUsageForBlockedApps(
    ctx: Context,
    blockedApps: Set<String>
  ): Long {

      val usageStats =
          getTodayUsageForAllApps(ctx)

      return blockedApps.sumOf { pkg ->
          usageStats[pkg] ?: 0L
      }
  }

  fun hasUsagePermission(
    ctx: Context
  ): Boolean {

      val appOps =
          ctx.getSystemService(
              Context.APP_OPS_SERVICE
          ) as AppOpsManager

      val mode =
          appOps.checkOpNoThrow(
              "android:get_usage_stats",
              Process.myUid(),
              ctx.packageName
          )

      return mode ==
          AppOpsManager.MODE_ALLOWED
  }

  fun getTodayUsageForApp(ctx: Context, packageName: String): Long {
      val breakdown = getTodayUsageBreakdown(ctx, packageName)
      return breakdown["total"] ?: 0L
  }

  fun getTodayUsageForAllApps(
    ctx: Context
  ): Map<String, Long> {

    val usageStatsManager =
        ctx.getSystemService(
            Context.USAGE_STATS_SERVICE
        ) as UsageStatsManager

    val calendar =
        Calendar.getInstance()

    calendar.set(
        Calendar.HOUR_OF_DAY,
        0
    )

    calendar.set(
        Calendar.MINUTE,
        0
    )

    calendar.set(
        Calendar.SECOND,
        0
    )

    calendar.set(
        Calendar.MILLISECOND,
        0
    )

    val startTime =
        calendar.timeInMillis

    val endTime =
        System.currentTimeMillis()

    val stats =
        usageStatsManager.queryUsageStats(
            UsageStatsManager.INTERVAL_DAILY,
            startTime,
            endTime
        )

    return stats.associate {
        it.packageName to
            it.totalTimeInForeground
    }
  }

fun getTodayUsageBreakdown(
    ctx: Context,
    packageName: String
): Map<String, Long> {

    if (!hasUsagePermission(ctx)) return emptyMap()

    val usageStatsManager =
        ctx.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager

    val calendar = Calendar.getInstance().apply {
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
    }

    val startTime = calendar.timeInMillis
    val endTime = System.currentTimeMillis()

    val events = usageStatsManager.queryEvents(startTime, endTime)
    val event = android.app.usage.UsageEvents.Event()

    var currentForegroundStart = 0L
    var totalMs = 0L
    var morningMs = 0L
    var afternoonMs = 0L
    var eveningMs = 0L
    var nightMs = 0L

    while (events.hasNextEvent()) {
        events.getNextEvent(event)
        if (event.packageName != packageName) continue

        when (event.eventType) {
            android.app.usage.UsageEvents.Event.MOVE_TO_FOREGROUND -> {
                currentForegroundStart = event.timeStamp
            }

            android.app.usage.UsageEvents.Event.MOVE_TO_BACKGROUND -> {
                if (currentForegroundStart == 0L) continue

                val sessionDuration = event.timeStamp - currentForegroundStart
                totalMs += sessionDuration
                bucketSession(currentForegroundStart, sessionDuration).let { (m, a, e, n) ->
                    morningMs += m
                    afternoonMs += a
                    eveningMs += e
                    nightMs += n
                }
                currentForegroundStart = 0L
            }
        }
    }

    // ── Handle currently open session ──────────────────────────
    if (currentForegroundStart > 0L) {
        val sessionDuration = endTime - currentForegroundStart
        totalMs += sessionDuration
        bucketSession(currentForegroundStart, sessionDuration).let { (m, a, e, n) ->
            morningMs += m
            afternoonMs += a
            eveningMs += e
            nightMs += n
        }
    }

    return mapOf(
        "total"     to totalMs,
        "morning"   to morningMs,
        "afternoon" to afternoonMs,
        "evening"   to eveningMs,
        "night"     to nightMs
    )
}

private fun bucketSession(
    startTime: Long,
    durationMs: Long
): List<Long> {
    val hour = Calendar.getInstance()
        .apply { timeInMillis = startTime }
        .get(Calendar.HOUR_OF_DAY)

    var m = 0L; var a = 0L; var e = 0L; var n = 0L

    when {
        hour >= LuminaConfig.UsageBuckets.MORNING_START &&
        hour <  LuminaConfig.UsageBuckets.MORNING_END   -> m = durationMs

        hour >= LuminaConfig.UsageBuckets.AFTERNOON_START &&
        hour <  LuminaConfig.UsageBuckets.AFTERNOON_END  -> a = durationMs

        hour >= LuminaConfig.UsageBuckets.EVENING_START &&
        hour <  LuminaConfig.UsageBuckets.EVENING_END   -> e = durationMs

        else -> n = durationMs
    }

    return listOf(m, a, e, n)
}

fun getDailyUsageForApp(
    ctx: Context,
    packageName: String,
    dayOffset: Int // 0 = today, 1 = yesterday, 2 = two days ago etc.
): Map<String, Any> {

    if (!hasUsagePermission(ctx)) return emptyMap()

    val usageStatsManager =
        ctx.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager

    val calendar = Calendar.getInstance().apply {
        add(Calendar.DAY_OF_YEAR, -dayOffset)
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
    }

    val startTime = calendar.timeInMillis
    val endTime = if (dayOffset == 0) {
        System.currentTimeMillis()
    } else {
        calendar.apply { add(Calendar.DAY_OF_YEAR, 1) }.timeInMillis
    }

    val events = usageStatsManager.queryEvents(startTime, endTime)
    val event = android.app.usage.UsageEvents.Event()

    var currentForegroundStart = 0L
    var totalMs = 0L
    var morningMs = 0L
    var afternoonMs = 0L
    var eveningMs = 0L
    var nightMs = 0L

    while (events.hasNextEvent()) {
        events.getNextEvent(event)
        if (event.packageName != packageName) continue

        when (event.eventType) {
            android.app.usage.UsageEvents.Event.MOVE_TO_FOREGROUND -> {
                currentForegroundStart = event.timeStamp
            }
            android.app.usage.UsageEvents.Event.MOVE_TO_BACKGROUND -> {
                if (currentForegroundStart == 0L) continue
                val duration = event.timeStamp - currentForegroundStart
                totalMs += duration
                bucketSession(currentForegroundStart, duration).let { (m, a, e, n) ->
                    morningMs += m; afternoonMs += a; eveningMs += e; nightMs += n
                }
                currentForegroundStart = 0L
            }
        }
    }

    // Handle currently open session (only relevant for today)
    if (currentForegroundStart > 0L) {
        val duration = endTime - currentForegroundStart
        totalMs += duration
        bucketSession(currentForegroundStart, duration).let { (m, a, e, n) ->
            morningMs += m; afternoonMs += a; eveningMs += e; nightMs += n
        }
    }

    val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
    val date = dateFormat.format(Date(startTime))

    return mapOf(
        "date"        to date,
        "total"       to totalMs,
        "morning"     to morningMs,
        "afternoon"   to afternoonMs,
        "evening"     to eveningMs,
        "night"       to nightMs
    )
}

fun getHistoricalDailyUsage(
    ctx: Context,
    packageNames: List<String>,
    days: Int = 7 // how many days back to fetch
): List<Map<String, Any>> {

    if (!hasUsagePermission(ctx)) return emptyList()

    val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
    val result = mutableListOf<Map<String, Any>>()

    for (dayOffset in 0 until days) {

        val calendar = Calendar.getInstance().apply {
            add(Calendar.DAY_OF_YEAR, -dayOffset)
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }

        val startTime = calendar.timeInMillis
        val endTime = if (dayOffset == 0) {
            System.currentTimeMillis()
        } else {
            Calendar.getInstance().apply {
                add(Calendar.DAY_OF_YEAR, -dayOffset)
                set(Calendar.HOUR_OF_DAY, 23)
                set(Calendar.MINUTE, 59)
                set(Calendar.SECOND, 59)
                set(Calendar.MILLISECOND, 999)
            }.timeInMillis
        }

        var totalMs = 0L
        var morningMs = 0L
        var afternoonMs = 0L
        var eveningMs = 0L
        var nightMs = 0L

        // Query all packages in one pass per day
        for (packageName in packageNames) {
            val breakdown = getDailyUsageForApp(ctx, packageName, dayOffset)
            totalMs     += (breakdown["total"]     as? Long) ?: 0L
            morningMs   += (breakdown["morning"]   as? Long) ?: 0L
            afternoonMs += (breakdown["afternoon"] as? Long) ?: 0L
            eveningMs   += (breakdown["evening"]   as? Long) ?: 0L
            nightMs     += (breakdown["night"]     as? Long) ?: 0L
        }

        result.add(mapOf(
            "date"          to dateFormat.format(Date(startTime)),
            "totalUsageMs"     to totalMs,
            "morningUsageMs"   to morningMs,
            "afternoonUsageMs" to afternoonMs,
            "eveningUsageMs"   to eveningMs,
            "nightUsageMs"     to nightMs
        ))
    }

    return result
}

    fun getWeeklyUsageForApp(
        ctx: Context,
        packageName: String
    ): List<Map<String, Any>> {

        val usageStatsManager =
            ctx.getSystemService(
                Context.USAGE_STATS_SERVICE
            ) as UsageStatsManager

        val labelFormat =
            SimpleDateFormat(
                "EEE",
                Locale.getDefault()
            )

        val result =
            mutableListOf<Map<String, Any>>()

        // Last 7 days
        for (i in 0..6) {

            val calendar =
                Calendar.getInstance()

            // oldest -> newest
            calendar.add(
                Calendar.DAY_OF_YEAR,
                i - 6
            )

            calendar.set(
                Calendar.HOUR_OF_DAY,
                0
            )

            calendar.set(
                Calendar.MINUTE,
                0
            )

            calendar.set(
                Calendar.SECOND,
                0
            )

            calendar.set(
                Calendar.MILLISECOND,
                0
            )

            val startTime =
                calendar.timeInMillis

            calendar.add(
                Calendar.DAY_OF_YEAR,
                1
            )

            val endTime =
                calendar.timeInMillis

            val events =
                usageStatsManager.queryEvents(
                    startTime,
                    endTime
                )

            val event =
                UsageEvents.Event()

            var totalUsage = 0L

            var lastForegroundTime = 0L

            while (events.hasNextEvent()) {

                events.getNextEvent(event)

                if (
                    event.packageName != packageName
                ) {
                    continue
                }

                when (event.eventType) {

                    UsageEvents.Event.MOVE_TO_FOREGROUND -> {

                        lastForegroundTime =
                            event.timeStamp
                    }

                    UsageEvents.Event.MOVE_TO_BACKGROUND -> {

                        if (lastForegroundTime > 0L) {

                            totalUsage +=
                                (
                                    event.timeStamp -
                                        lastForegroundTime
                                    )

                            lastForegroundTime = 0L
                        }
                    }
                }
            }

            // Handle app still open
            if (lastForegroundTime > 0L) {

                totalUsage +=
                    (
                        endTime -
                            lastForegroundTime
                        )
            }

            result.add(
                mapOf(
                    "day" to
                        labelFormat.format(
                            Date(startTime)
                        ),

                    "usageMs" to totalUsage
                )
            )
        }

        return result
    }
}