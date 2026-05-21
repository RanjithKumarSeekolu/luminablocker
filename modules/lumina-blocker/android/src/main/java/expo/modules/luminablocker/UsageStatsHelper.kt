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

  fun getTodayUsageForApp(
    ctx: Context,
    packageName: String
  ): Long {

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

      val appStats =
          stats.firstOrNull {
              it.packageName == packageName
          }

      return appStats?.totalTimeInForeground ?: 0L
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

      if (!hasUsagePermission(ctx)) {
          return emptyMap()
      }

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

      val events =
          usageStatsManager.queryEvents(
              startTime,
              endTime
          )

      var currentForegroundStart = 0L

      var morningMs = 0L
      var afternoonMs = 0L
      var eveningMs = 0L
      var nightMs = 0L

      val event =
          android.app.usage.UsageEvents.Event()

      while (events.hasNextEvent()) {

          events.getNextEvent(event)

          if (event.packageName != packageName) {
              continue
          }

          when (event.eventType) {

              android.app.usage.UsageEvents.Event
                  .MOVE_TO_FOREGROUND -> {

                  currentForegroundStart =
                      event.timeStamp
              }

              android.app.usage.UsageEvents.Event
                  .MOVE_TO_BACKGROUND -> {

                  if (currentForegroundStart == 0L) {
                      continue
                  }

                  val sessionDuration =
                      event.timeStamp -
                          currentForegroundStart

                  val sessionHour =
                      Calendar.getInstance()
                          .apply {
                              timeInMillis =
                                  currentForegroundStart
                          }
                          .get(Calendar.HOUR_OF_DAY)

                  when {

                      sessionHour >=
                          LuminaConfig
                              .UsageBuckets
                              .MORNING_START &&

                      sessionHour <
                          LuminaConfig
                              .UsageBuckets
                              .MORNING_END -> {

                          morningMs +=
                              sessionDuration
                      }

                      sessionHour >=
                          LuminaConfig
                              .UsageBuckets
                              .AFTERNOON_START &&

                      sessionHour <
                          LuminaConfig
                              .UsageBuckets
                              .AFTERNOON_END -> {

                          afternoonMs +=
                              sessionDuration
                      }

                      sessionHour >=
                          LuminaConfig
                              .UsageBuckets
                              .EVENING_START &&

                      sessionHour <
                          LuminaConfig
                              .UsageBuckets
                              .EVENING_END -> {

                          eveningMs +=
                              sessionDuration
                      }

                      else -> {

                          nightMs +=
                              sessionDuration
                      }
                  }

                  currentForegroundStart = 0L
              }
          }
      }

      return mapOf(

          "morning" to morningMs,

          "afternoon" to afternoonMs,

          "evening" to eveningMs,

          "night" to nightMs
      )
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