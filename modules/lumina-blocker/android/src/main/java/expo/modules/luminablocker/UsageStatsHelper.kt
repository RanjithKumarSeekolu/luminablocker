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
      val usageStats = getTodayUsageForAllApps(ctx)
      return blockedApps.sumOf { pkg -> usageStats[pkg] ?: 0L }
  }

  fun hasUsagePermission(ctx: Context): Boolean {
      val appOps = ctx.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
      val mode = appOps.checkOpNoThrow(
          "android:get_usage_stats",
          Process.myUid(),
          ctx.packageName
      )
      return mode == AppOpsManager.MODE_ALLOWED
  }

  fun getTodayUsageForApp(ctx: Context, packageName: String): Long {
      val breakdown = getTodayUsageBreakdown(ctx, packageName)
      return breakdown["total"] ?: 0L
  }

  fun getTodayUsageForAllApps(ctx: Context): Map<String, Long> {
      val usageStatsManager = ctx.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val calendar = Calendar.getInstance().apply {
          set(Calendar.HOUR_OF_DAY, 0)
          set(Calendar.MINUTE, 0)
          set(Calendar.SECOND, 0)
          set(Calendar.MILLISECOND, 0)
      }
      val startTime = calendar.timeInMillis
      val endTime = System.currentTimeMillis()
      val stats = usageStatsManager.queryUsageStats(
          UsageStatsManager.INTERVAL_DAILY,
          startTime,
          endTime
      )
      return stats.associate { it.packageName to it.totalTimeInForeground }
  }

  fun getTodayUsageBreakdown(ctx: Context, packageName: String): Map<String, Long> {
      if (!hasUsagePermission(ctx)) return emptyMap()

      val usageStatsManager = ctx.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager

      val calendar = Calendar.getInstance().apply {
          set(Calendar.HOUR_OF_DAY, 0)
          set(Calendar.MINUTE, 0)
          set(Calendar.SECOND, 0)
          set(Calendar.MILLISECOND, 0)
      }
      val startTime = calendar.timeInMillis
      val endTime = System.currentTimeMillis()

      val events = usageStatsManager.queryEvents(startTime, endTime)
      val event = UsageEvents.Event()

      var currentForegroundStart = 0L
      var totalMs = 0L
      var earlyMs = 0L
      var workMs = 0L
      var eveningMs = 0L
      var nightMs = 0L

      while (events.hasNextEvent()) {
          events.getNextEvent(event)
          if (event.packageName != packageName) continue

          when (event.eventType) {
              UsageEvents.Event.MOVE_TO_FOREGROUND -> {
                  currentForegroundStart = event.timeStamp
              }
              UsageEvents.Event.MOVE_TO_BACKGROUND -> {
                  if (currentForegroundStart == 0L) continue
                  val sessionDuration = event.timeStamp - currentForegroundStart
                  totalMs += sessionDuration
                  bucketSession(currentForegroundStart, sessionDuration).let { (early, work, evening, night) ->
                      earlyMs += early; workMs += work; eveningMs += evening; nightMs += night
                  }
                  currentForegroundStart = 0L
              }
          }
      }

      // Handle currently open session
      if (currentForegroundStart > 0L) {
          val sessionDuration = endTime - currentForegroundStart
          totalMs += sessionDuration
          bucketSession(currentForegroundStart, sessionDuration).let { (early, work, evening, night) ->
              earlyMs += early; workMs += work; eveningMs += evening; nightMs += night
          }
      }

      return mapOf(
          "total"   to totalMs,
          "early"   to earlyMs,
          "work"    to workMs,
          "evening" to eveningMs,
          "night"   to nightMs
      )
  }

  private fun bucketSession(startTime: Long, durationMs: Long): List<Long> {
      if (durationMs <= 0L) return listOf(0L, 0L, 0L, 0L)

      var cursor = startTime
      val endTime = startTime + durationMs
      var early = 0L
      var work = 0L
      var evening = 0L
      var night = 0L

      // Split a session at each 09:00, 17:00, 21:00, and midnight boundary
      // instead of attributing the whole session to its start bucket.
      while (cursor < endTime) {
          val current = Calendar.getInstance().apply { timeInMillis = cursor }
          val hour = current.get(Calendar.HOUR_OF_DAY)
          val nextBoundary = Calendar.getInstance().apply {
              timeInMillis = cursor
              set(Calendar.MINUTE, 0)
              set(Calendar.SECOND, 0)
              set(Calendar.MILLISECOND, 0)
              when {
                  hour < LuminaConfig.UsageBuckets.WORK_START ->
                      set(Calendar.HOUR_OF_DAY, LuminaConfig.UsageBuckets.WORK_START)
                  hour < LuminaConfig.UsageBuckets.EVENING_START ->
                      set(Calendar.HOUR_OF_DAY, LuminaConfig.UsageBuckets.EVENING_START)
                  hour < LuminaConfig.UsageBuckets.EVENING_END ->
                      set(Calendar.HOUR_OF_DAY, LuminaConfig.UsageBuckets.EVENING_END)
                  else -> {
                      add(Calendar.DAY_OF_YEAR, 1)
                      set(Calendar.HOUR_OF_DAY, 0)
                  }
              }
          }.timeInMillis

          val chunkEnd = minOf(endTime, nextBoundary)
          val chunk = chunkEnd - cursor
          when {
              hour >= LuminaConfig.UsageBuckets.EVENING_END -> night += chunk
              hour >= LuminaConfig.UsageBuckets.EVENING_START -> evening += chunk
              hour >= LuminaConfig.UsageBuckets.WORK_START -> work += chunk
              else -> early += chunk
          }
          cursor = chunkEnd
      }

      return listOf(early, work, evening, night)
  }

  fun getDailyUsageForApp(ctx: Context, packageName: String, dayOffset: Int): Map<String, Any> {
      if (!hasUsagePermission(ctx)) return emptyMap()

      val usageStatsManager = ctx.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager

      val startCal = Calendar.getInstance().apply {
          add(Calendar.DAY_OF_YEAR, -dayOffset)
          set(Calendar.HOUR_OF_DAY, 0)
          set(Calendar.MINUTE, 0)
          set(Calendar.SECOND, 0)
          set(Calendar.MILLISECOND, 0)
      }
      val startTime = startCal.timeInMillis

      val endTime = if (dayOffset == 0) {
          System.currentTimeMillis()
      } else {
          Calendar.getInstance().apply {
              timeInMillis = startTime
              add(Calendar.DAY_OF_YEAR, 1)
          }.timeInMillis
      }

      val events = usageStatsManager.queryEvents(startTime, endTime)
      val event = UsageEvents.Event()

      var currentForegroundStart = 0L
      var totalMs = 0L
      var earlyMs = 0L
      var workMs = 0L
      var eveningMs = 0L
      var nightMs = 0L

      while (events.hasNextEvent()) {
          events.getNextEvent(event)
          if (event.packageName != packageName) continue

          when (event.eventType) {
              UsageEvents.Event.MOVE_TO_FOREGROUND -> {
                  currentForegroundStart = event.timeStamp
              }
              UsageEvents.Event.MOVE_TO_BACKGROUND -> {
                  if (currentForegroundStart == 0L) continue
                  val duration = event.timeStamp - currentForegroundStart
                  totalMs += duration
                  bucketSession(currentForegroundStart, duration).let { (early, work, evening, night) ->
                      earlyMs += early; workMs += work; eveningMs += evening; nightMs += night
                  }
                  currentForegroundStart = 0L
              }
          }
      }

      // For today: add live session; for past days: cap at endTime (reboot/crash guard)
      if (currentForegroundStart > 0L) {
          val duration = endTime - currentForegroundStart
          totalMs += duration
          bucketSession(currentForegroundStart, duration).let { (early, work, evening, night) ->
              earlyMs += early; workMs += work; eveningMs += evening; nightMs += night
          }
      }

      val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.ENGLISH)

      return mapOf(
          "date"    to dateFormat.format(Date(startTime)),
          "total"   to totalMs,
          "early"   to earlyMs,
          "work"    to workMs,
          "evening" to eveningMs,
          "night"   to nightMs
      )
  }

  fun getHistoricalDailyUsage(
      ctx: Context,
      packageNames: List<String>,
      days: Int = 7
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

          var totalMs = 0L; var earlyMs = 0L; var workMs = 0L
          var eveningMs = 0L; var nightMs = 0L

          for (packageName in packageNames) {
              val breakdown = getDailyUsageForApp(ctx, packageName, dayOffset)
              totalMs   += (breakdown["total"]   as? Number)?.toLong() ?: 0L
              earlyMs   += (breakdown["early"]   as? Number)?.toLong() ?: 0L
              workMs    += (breakdown["work"]    as? Number)?.toLong() ?: 0L
              eveningMs += (breakdown["evening"] as? Number)?.toLong() ?: 0L
              nightMs   += (breakdown["night"]   as? Number)?.toLong() ?: 0L
          }

          result.add(mapOf(
              "date"           to dateFormat.format(Date(startTime)),
              "totalUsageMs"   to totalMs,
              "earlyUsageMs"   to earlyMs,
              "workUsageMs"    to workMs,
              "eveningUsageMs" to eveningMs,
              "nightUsageMs"   to nightMs
          ))
      }

      return result
  }

fun getTodayUsageBreakdownForApps(
    ctx: Context,
    packageNames: List<String>
): Map<String, Map<String, Long>> {
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
    val event = UsageEvents.Event()

    val foregroundStart = mutableMapOf<String, Long>()
    val totals = packageNames.associateWith {
        mutableMapOf("total" to 0L, "early" to 0L, "work" to 0L, "evening" to 0L, "night" to 0L)
    }.toMutableMap()

    // Track last MOVE_TO_FOREGROUND timestamp per app for phantom session detection
    val lastUserActivity = mutableMapOf<String, Long>()

    while (events.hasNextEvent()) {
        events.getNextEvent(event)
        val pkg = event.packageName
        if (pkg !in totals) continue

        when (event.eventType) {
            UsageEvents.Event.MOVE_TO_FOREGROUND -> {
                foregroundStart[pkg] = event.timeStamp
                lastUserActivity[pkg] = event.timeStamp
            }
            UsageEvents.Event.MOVE_TO_BACKGROUND -> {
                val start = foregroundStart[pkg] ?: continue
                val duration = event.timeStamp - start

                // Cap individual sessions at 2 hours — anything longer
                // is a phantom background process, not real usage
                val cappedDuration = minOf(duration, 2 * 60 * 60 * 1000L)

                totals[pkg]!!["total"] = totals[pkg]!!["total"]!! + cappedDuration
                bucketSession(start, cappedDuration).let { (early, work, evening, night) ->
                    totals[pkg]!!["early"]   = totals[pkg]!!["early"]!!   + early
                    totals[pkg]!!["work"]    = totals[pkg]!!["work"]!!    + work
                    totals[pkg]!!["evening"] = totals[pkg]!!["evening"]!! + evening
                    totals[pkg]!!["night"]   = totals[pkg]!!["night"]!!   + night
                }
                foregroundStart.remove(pkg)
            }
        }
    }

    // Live session — only count if this is genuinely the active package
    val activePackage = SessionTracker.getLastActivePackage(ctx)
    val start = foregroundStart[activePackage]
    if (activePackage.isNotBlank() && start != null) {
        val duration = minOf(endTime - start, 2 * 60 * 60 * 1000L)
        totals[activePackage]!!["total"] = totals[activePackage]!!["total"]!! + duration
        bucketSession(start, duration).let { (early, work, evening, night) ->
            totals[activePackage]!!["early"]   = totals[activePackage]!!["early"]!!   + early
            totals[activePackage]!!["work"]    = totals[activePackage]!!["work"]!!    + work
            totals[activePackage]!!["evening"] = totals[activePackage]!!["evening"]!! + evening
            totals[activePackage]!!["night"]   = totals[activePackage]!!["night"]!!   + night
        }
    }
    // All other unresolved foregroundStart entries are phantom — drop them

    android.util.Log.d("UsageDebug", "=== Usage Debug ===")
    android.util.Log.d("UsageDebug", "activePackage=$activePackage")
    android.util.Log.d("UsageDebug", "foregroundStart after loop=${foregroundStart.keys.toList()}")
    foregroundStart.forEach { (pkg, start) ->
        android.util.Log.d("UsageDebug", "  unresolved: pkg=$pkg startTime=$start sinceStart=${System.currentTimeMillis() - start}ms")
    }
    android.util.Log.d("UsageDebug", "totals=${totals}")

    return totals
}

  fun getWeeklyUsageForApp(ctx: Context, packageName: String): List<Map<String, Any>> {
      val usageStatsManager = ctx.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val labelFormat = SimpleDateFormat("EEE", Locale.ENGLISH)
      val result = mutableListOf<Map<String, Any>>()

      // Last 7 days, oldest → newest
      for (i in 0..6) {
          val calendar = Calendar.getInstance().apply {
              add(Calendar.DAY_OF_YEAR, i - 6)
              set(Calendar.HOUR_OF_DAY, 0)
              set(Calendar.MINUTE, 0)
              set(Calendar.SECOND, 0)
              set(Calendar.MILLISECOND, 0)
          }
          val startTime = calendar.timeInMillis
          calendar.add(Calendar.DAY_OF_YEAR, 1)
          val endTime = calendar.timeInMillis

          val events = usageStatsManager.queryEvents(startTime, endTime)
          val event = UsageEvents.Event()
          var totalUsage = 0L
          var lastForegroundTime = 0L

          while (events.hasNextEvent()) {
              events.getNextEvent(event)
              if (event.packageName != packageName) continue
              when (event.eventType) {
                  UsageEvents.Event.MOVE_TO_FOREGROUND -> lastForegroundTime = event.timeStamp
                  UsageEvents.Event.MOVE_TO_BACKGROUND -> {
                      if (lastForegroundTime > 0L) {
                          totalUsage += event.timeStamp - lastForegroundTime
                          lastForegroundTime = 0L
                      }
                  }
              }
          }

          if (lastForegroundTime > 0L) {
              totalUsage += endTime - lastForegroundTime
          }

          result.add(mapOf(
              "day"     to labelFormat.format(Date(startTime)),
              "usageMs" to totalUsage
          ))
      }

      return result
  }
}
