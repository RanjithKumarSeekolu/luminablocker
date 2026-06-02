package expo.modules.luminablocker

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar
import kotlin.collections.asReversed

object FocusSessionStore {

    private const val PREFS = "LuminaFocus"
    private const val KEY_SESSIONS = "focus_sessions"

    private fun prefs(ctx: Context) =
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun todayKey(): String {
        val c = Calendar.getInstance()
        return "${c.get(Calendar.YEAR)}-${c.get(Calendar.MONTH) + 1}-${c.get(Calendar.DAY_OF_MONTH)}"
    }

    // Called when focus session ends (completed or early exit)
    fun saveSession(ctx: Context, durationMs: Long, completed: Boolean) {
        val prefs = prefs(ctx)
        val existing = prefs.getString(KEY_SESSIONS, "[]") ?: "[]"
        val array = JSONArray(existing)

        val obj = JSONObject().apply {
            put("date", todayKey())
            put("durationMs", durationMs)
            put("completed", completed)
            put("timestamp", System.currentTimeMillis())
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