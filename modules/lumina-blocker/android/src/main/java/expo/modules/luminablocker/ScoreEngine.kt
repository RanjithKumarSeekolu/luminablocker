package expo.modules.luminablocker

import android.content.Context
import android.util.Log

/**
 * Computes an intervention score from four signals, maps it to a level (1–4),
 * and derives the countdown duration for that level.
 *
 * Score is CUMULATIVE — it persists across opens and decays via SessionTracker resets.
 * This means a user who opens an app 10 times today will see progressively longer
 * countdowns, then the score decays after 30 min away or at midnight.
 *
 * Signals:
 *   usageTime   — how long the LAST session was (not current — current is always 0 at open)
 *   frequency   — opens per rolling 1-hour window
 *   reopenGap   — how quickly the user came back (short gap = compulsive)
 *   timeContext — late-night use scores higher
 */
object ScoreEngine {

    // ── Main entry point ─────────────────────────────────────────

    /**
     * Call once per open attempt (after SessionTracker.onAppOpened).
     * Applies resets, computes score delta, persists, returns level.
     */
    fun evaluate(ctx: Context): Int {
        // 1. Apply resets before scoring so today's first open benefits from overnight recovery
        SessionTracker.applyDailyResetIfNeeded(ctx)
        SessionTracker.applyNoUseResetIfNeeded(ctx)

        // 2. Compute fresh score
        val delta    = usageTimeScore(ctx) + frequencyScore(ctx) +
                       reopenGapScore(ctx) + timeContextScore()
        val newScore = (SessionTracker.getStoredScore(ctx) + delta).coerceAtLeast(0)

        // 3. Persist
        SessionTracker.setStoredScore(ctx, newScore)

        return scoreToLevel(newScore)
    }

    // ── Signal: last session duration ────────────────────────────
    // Uses LAST session (stored on close), NOT current (which is always 0 at open time)

    private fun usageTimeScore(ctx: Context): Int {
        val mins = SessionTracker.getLastSessionDurationMs(ctx) / 60_000L
        return when {
            mins >= LuminaConfig.UsageTime.TIER_3_MIN -> LuminaConfig.UsageTime.SCORE_TIER_3
            mins >= LuminaConfig.UsageTime.TIER_2_MIN -> LuminaConfig.UsageTime.SCORE_TIER_2
            mins >= LuminaConfig.UsageTime.TIER_1_MIN -> LuminaConfig.UsageTime.SCORE_TIER_1
            else -> 0
        }
    }

    // ── Signal: open frequency (rolling 1-hour window) ───────────

    private fun frequencyScore(ctx: Context): Int {
        val opens = SessionTracker.getOpenCountThisHour(ctx)

        val score = when {
            opens >= LuminaConfig.Frequency.TIER_3_OPENS ->
                LuminaConfig.Frequency.SCORE_TIER_3

            opens >= LuminaConfig.Frequency.TIER_2_OPENS ->
                LuminaConfig.Frequency.SCORE_TIER_2

            opens >= LuminaConfig.Frequency.TIER_1_OPENS ->
                LuminaConfig.Frequency.SCORE_TIER_1

            else -> 0
        }

        Log.d(
            "LuminaBlocker",
            "frequencyScore() -> opens=$opens score=$score"
        )

        return score
    }

    // ── Signal: reopen gap ───────────────────────────────────────
    // Shorter gap = came back more quickly = more compulsive = higher score

    private fun reopenGapScore(ctx: Context): Int {
        val gap = SessionTracker.getReopenGapMs(ctx)
        return when {
            gap <= LuminaConfig.ReopenGap.TIER_3_MAX_MS -> LuminaConfig.ReopenGap.SCORE_TIER_3
            gap <= LuminaConfig.ReopenGap.TIER_2_MAX_MS -> LuminaConfig.ReopenGap.SCORE_TIER_2
            gap <= LuminaConfig.ReopenGap.TIER_1_MAX_MS -> LuminaConfig.ReopenGap.SCORE_TIER_1
            else -> 0
        }
    }

    // ── Signal: time of day ──────────────────────────────────────

    private fun timeContextScore(): Int {
        val hour = SessionTracker.getCurrentHour()
        return when {
            hour >= LuminaConfig.TimeContext.TIER_3_HOUR_START &&
            hour <  LuminaConfig.TimeContext.TIER_3_HOUR_END   -> LuminaConfig.TimeContext.SCORE_TIER_3

            hour >= LuminaConfig.TimeContext.TIER_2_HOUR_START  -> LuminaConfig.TimeContext.SCORE_TIER_2

            hour >= LuminaConfig.TimeContext.TIER_1_HOUR_START  -> LuminaConfig.TimeContext.SCORE_TIER_1

            else -> 0
        }
    }

    // ── Score → Level ────────────────────────────────────────────

    fun scoreToLevel(score: Int): Int = when {
        score >= LuminaConfig.Levels.LEVEL_4_MIN -> 4
        score >= LuminaConfig.Levels.LEVEL_3_MIN -> 3
        score >= LuminaConfig.Levels.LEVEL_2_MIN -> 2
        score >= LuminaConfig.Levels.LEVEL_1_MIN -> 1
        else                                     -> 0
    }

    // ── Level → countdown duration ───────────────────────────────

    fun levelToCountdownMs(level: Int): Long = when (level) {
        1    -> LuminaConfig.Levels.LEVEL_1_COUNTDOWN_MS
        2    -> LuminaConfig.Levels.LEVEL_2_COUNTDOWN_MS
        3    -> LuminaConfig.Levels.LEVEL_3_COUNTDOWN_MS
        4    -> LuminaConfig.Levels.LEVEL_4_COUNTDOWN_MS
        else -> LuminaConfig.Levels.LEVEL_1_COUNTDOWN_MS
    }
}