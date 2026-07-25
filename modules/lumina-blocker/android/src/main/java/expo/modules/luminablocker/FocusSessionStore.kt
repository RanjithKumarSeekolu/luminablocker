package expo.modules.luminablocker

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar
import kotlin.collections.asReversed

object FocusSessionStore {

    private const val PREFS = "LuminaFocus"
    private const val KEY_SESSIONS = "focus_sessions"
    private const val KEY_ACTIVE_START = "active_start_ms"
    private const val KEY_ACTIVE_TARGET = "active_target_ms"
    private const val MAX_STORED_SESSIONS = 500

    private fun prefs(ctx: Context) =
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /** Starts a persisted session, or returns the existing session start. */
    fun beginSession(ctx: Context, targetDurationMs: Long): Long {
        val prefs = prefs(ctx)
        val existingStart = prefs.getLong(KEY_ACTIVE_START, 0L)
        if (existingStart > 0L) return existingStart

        val start = System.currentTimeMillis()
        prefs.edit()
            .putLong(KEY_ACTIVE_START, start)
            .putLong(KEY_ACTIVE_TARGET, targetDurationMs)
            .apply()
        return start
    }

    fun getActiveSession(ctx: Context): Pair<Long, Long>? {
        val prefs = prefs(ctx)
        val start = prefs.getLong(KEY_ACTIVE_START, 0L)
        val target = prefs.getLong(KEY_ACTIVE_TARGET, 0L)
        return if (start > 0L && target > 0L) Pair(start, target) else null
    }

    fun clearActiveSession(ctx: Context) {
        prefs(ctx).edit()
            .remove(KEY_ACTIVE_START)
            .remove(KEY_ACTIVE_TARGET)
            .apply()
    }

    private fun todayKey(): String {
        val c = Calendar.getInstance()
        return "${c.get(Calendar.YEAR)}-${c.get(Calendar.MONTH) + 1}-${c.get(Calendar.DAY_OF_MONTH)}"
    }

    // Called when focus session ends (completed or early exit)
    fun saveSession(ctx: Context, durationMs: Long, targetDurationMs: Long, completed: Boolean) {
        val prefs = prefs(ctx)
        val existing = prefs.getString(KEY_SESSIONS, "[]") ?: "[]"
        val array = JSONArray(existing)

        val obj = JSONObject().apply {
            put("date", todayKey())
            put("durationMs", durationMs)
            put("targetDurationMs", targetDurationMs)
            put("completed", completed)
            put("timestamp", System.currentTimeMillis())
        }

        while (array.length() >= MAX_STORED_SESSIONS) {
            array.remove(0)
        }
        array.put(obj)
        prefs.edit().putString(KEY_SESSIONS, array.toString()).apply()
    }

    // Today's total focus time in ms
    fun getTodayTotalMs(ctx: Context): Long {
        val today = todayKey()
        val array = JSONArray(prefs(ctx).getString(KEY_SESSIONS, "[]") ?: "[]")
        var total = 0L
        for (i in 0 until array.length()) {
            val obj = array.getJSONObject(i)
            if (obj.getString("date") == today) {
                total += obj.getLong("durationMs")
            }
        }
        return total
    }

    // Last 7 days — returns list of {date, totalMs, sessionCount}
    fun getWeeklyData(ctx: Context): List<Map<String, Any>> {
        val array = JSONArray(prefs(ctx).getString(KEY_SESSIONS, "[]") ?: "[]")

        // Build last 7 day keys
        val days = (0..6).map { offset ->
            val c = Calendar.getInstance()
            c.add(Calendar.DAY_OF_MONTH, -offset)
            "${c.get(Calendar.YEAR)}-${c.get(Calendar.MONTH) + 1}-${c.get(Calendar.DAY_OF_MONTH)}"
        }

        val map = days.associateWith { mutableMapOf("date" to it, "totalMs" to 0L, "sessionCount" to 0) }
            .toMutableMap()

        for (i in 0 until array.length()) {
            val obj = array.getJSONObject(i)
            val date = obj.getString("date")
            if (date in map) {
                val entry = map[date]!!
                entry["totalMs"] = (entry["totalMs"] as Long) + obj.getLong("durationMs")
                entry["sessionCount"] = (entry["sessionCount"] as Int) + 1
            }
        }

        return days.reversed().map { map[it]!! as Map<String, Any> }
    }

    fun getAllSessions(ctx: Context): String {
        return prefs(ctx).getString(KEY_SESSIONS, "[]") ?: "[]"
    }
}
