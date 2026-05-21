package expo.modules.luminablocker

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

object HistoryTracker {

    private const val PREFS = "LuminaHistory"
    private const val KEY_EVENTS = "events"
    private const val MAX_EVENTS = 200

    private fun prefs(ctx: Context) =
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun addEvent(
        ctx: Context,
        packageName: String,
        appName: String,
        reason: String,
        details: String,
        delta: Int,
        previousScore: Int,
        newScore: Int
    ) {

        val prefs = prefs(ctx)

        val existing =
            prefs.getString(KEY_EVENTS, "[]") ?: "[]"

        val array = JSONArray(existing)

        val obj = JSONObject().apply {

            put("timestamp", System.currentTimeMillis())
            put("packageName", packageName)
            put("appName", appName)
            put("reason", reason)
            put("details", details)
            put("delta", delta)
            put("previousScore", previousScore)
            put("newScore", newScore)
        }

        array.put(obj)

        // Trim old events
        while (array.length() > MAX_EVENTS) {
            array.remove(0)
        }

        prefs.edit()
            .putString(KEY_EVENTS, array.toString())
            .apply()
    }

    fun clearAppHistory(
        ctx: Context,
        packageName: String
    ) {

        val prefs = prefs(ctx)

        val existing =
            prefs.getString(
                KEY_EVENTS,
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
                KEY_EVENTS,
                filtered.toString()
            )
            .apply()
    }

    fun getHistory(
        ctx: Context
    ): List<HistoryEvent> {

        val json =
            prefs(ctx).getString(
                KEY_EVENTS,
                "[]"
            ) ?: "[]"

        val array =
            JSONArray(json)

        val result =
            mutableListOf<HistoryEvent>()

        for (i in 0 until array.length()) {

            val obj =
                array.getJSONObject(i)

            result.add(
                HistoryEvent(
                    timestamp =
                        obj.getLong("timestamp"),

                    packageName =
                        obj.getString("packageName"),

                    appName =
                        obj.getString("appName"),

                    reason =
                        obj.getString("reason"),

                    details =
                        obj.optString(
                            "details",
                            ""
                        ),

                    delta =
                        obj.getInt("delta"),

                    previousScore =
                        obj.getInt("previousScore"),

                    newScore =
                        obj.getInt("newScore")
                )
            )
        }

        return result
    }

    fun getEvents(ctx: Context): List<Map<String, Any>> {

        val prefs = prefs(ctx)

        val json = prefs.getString(KEY_EVENTS, "[]") ?: "[]"

        val array = JSONArray(json)
        val events = mutableListOf<Map<String, Any>>()

        for (i in 0 until array.length()) {
            val obj = array.getJSONObject(i)
            events.add(
                mapOf(
                    "timestamp" to obj.getLong("timestamp"),
                    "packageName" to obj.getString("packageName"),
                    "appName" to obj.getString("appName"),
                    "reason" to obj.getString("reason"),
                    "details" to obj.getString("details"),
                    "delta" to obj.getInt("delta"),
                    "previousScore" to obj.getInt("previousScore"),
                    "newScore" to obj.getInt("newScore")
                )
            )
        }

        return events
    }

    fun clear(ctx: Context) {
        prefs(ctx).edit()
            .remove(KEY_EVENTS)
            .apply()
    }
}