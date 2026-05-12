package expo.modules.luminablocker

import android.content.Context
import java.util.Calendar

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

    private fun prefs(ctx: Context) =
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    // ── App opened ───────────────────────────────────────────────

    /**
     * Call when the user opens a blocked app (before ScoreEngine.evaluate).
     * Starts the session timer if not already running.
     * Increments the rolling-hour open counter.
     */
    fun onAppOpened(ctx: Context, packageName: String) {
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
        val now   = System.currentTimeMillis()
        val start = prefs.getLong(KEY_SESSION_START, 0L)

        // Only save if a session was actually running
        val sessionDuration = if (start > 0L) now - start else 0L

        prefs.edit()
            .putLong(KEY_LAST_SESSION_DURATION, sessionDuration)
            .putLong(KEY_LAST_LEAVE_TIME, now)
            .putLong(KEY_SESSION_START, 0L)           // reset session timer
            .apply()
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

    fun getStoredScore(ctx: Context): Int =
        prefs(ctx).getInt(KEY_CURRENT_SCORE, 0)

    fun setStoredScore(ctx: Context, score: Int) {
        prefs(ctx).edit().putInt(KEY_CURRENT_SCORE, score).apply()
    }

    // ── Daily soft-reset ─────────────────────────────────────────

    /**
     * At midnight, clamp score to NEW_DAY_SCORE_CAP instead of zeroing it.
     * Yesterday's heavy usage still slightly elevates today's first open,
     * but doesn't carry full penalty into a new day.
     */
    fun applyDailyResetIfNeeded(ctx: Context) {
        val prefs   = prefs(ctx)
        val today   = Calendar.getInstance().get(Calendar.DAY_OF_YEAR)
        val lastDay = prefs.getInt(KEY_LAST_RESET_DAY, -1)

        if (today != lastDay) {
            val current = getStoredScore(ctx)
            val capped  = minOf(current, LuminaConfig.Reset.NEW_DAY_SCORE_CAP)
            prefs.edit()
                .putInt(KEY_CURRENT_SCORE, capped)
                .putInt(KEY_LAST_RESET_DAY, today)
                .apply()
        }
    }

    // ── No-use partial reset ─────────────────────────────────────

    /**
     * If the user has been away for ≥ 30 min, subtract PARTIAL_RESET_SCORE.
     * Only applied once per away period (lastLeaveTime is cleared after applying).
     */
    fun applyNoUseResetIfNeeded(ctx: Context) {
        val prefs     = prefs(ctx)
        val lastLeave = prefs.getLong(KEY_LAST_LEAVE_TIME, 0L)

        if (lastLeave == 0L) return   // no recorded leave time yet

        val awayMs = System.currentTimeMillis() - lastLeave

        if (awayMs >= LuminaConfig.Reset.NO_USE_WINDOW_MS) {
            val current = getStoredScore(ctx)
            val reduced = (current - LuminaConfig.Reset.PARTIAL_RESET_SCORE).coerceAtLeast(0)
            setStoredScore(ctx, reduced)
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