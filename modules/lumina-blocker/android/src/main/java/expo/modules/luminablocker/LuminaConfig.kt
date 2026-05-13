package expo.modules.luminablocker

object LuminaConfig {

    // ── Usage time thresholds (minutes of last session) ──────────
    object UsageTime {
        const val TIER_1_MIN   = 5L    // 5+ min last session  → +1
        const val TIER_2_MIN   = 15L   // 15+ min              → +2
        const val TIER_3_MIN   = 30L   // 30+ min              → +3
        const val SCORE_TIER_1 = 1
        const val SCORE_TIER_2 = 2
        const val SCORE_TIER_3 = 3
    }

    // ── Frequency thresholds (opens within rolling 1-hour window) ─
    object Frequency {
        const val TIER_1_OPENS = 10   // 3+ opens/hr → +1
        const val TIER_2_OPENS = 25    // 5+ opens/hr → +2
        const val TIER_3_OPENS = 40     // 7+ opens/hr → +3
        const val SCORE_TIER_1 = 1
        const val SCORE_TIER_2 = 2
        const val SCORE_TIER_3 = 3
    }

    // ── Reopen gap thresholds (time away since last close) ────────
    // Short gap = compulsive checking = higher score
    object ReopenGap {

        const val TIER_1_MAX_MS = 9 * 1000L        // 9 sec → +1
        const val TIER_2_MAX_MS = 7 * 1000L       // 7 sec → +2
        const val TIER_3_MAX_MS = 4 * 1000L       // 4 sec → +3
        const val SCORE_TIER_1  = 1
        const val SCORE_TIER_2  = 2
        const val SCORE_TIER_3  = 3
    }

    // ── Time-of-day context ───────────────────────────────────────
    object TimeContext {
        const val TIER_1_HOUR_START = 21   // 9 pm – 11 pm  → +1
        const val TIER_2_HOUR_START = 23   // 11 pm – 2 am  → +2
        const val TIER_3_HOUR_START = 2    // 2 am – 6 am   → +3
        const val TIER_3_HOUR_END   = 6
        const val SCORE_TIER_1      = 1
        const val SCORE_TIER_2      = 2
        const val SCORE_TIER_3      = 3
    }

    // ── Score → Level thresholds ──────────────────────────────────
    // Score 0     → no overlay
    // Score 1–4   → Level 1 (gentle,  0 s countdown — open immediately)
    // Score 5–7   → Level 2 (moderate, 5 s countdown)
    // Score 8–10  → Level 3 (focused, 10 s countdown)
    // Score 11+   → Level 4 (deep,    15 s countdown)
    object Levels {

        const val LEVEL_1_MIN = 7
        const val LEVEL_2_MIN = 14
        const val LEVEL_3_MIN = 21
        const val LEVEL_4_MIN = 28

        const val LEVEL_1_COUNTDOWN_MS = 0L
        const val LEVEL_2_COUNTDOWN_MS = 5_000L
        const val LEVEL_3_COUNTDOWN_MS = 10_000L
        const val LEVEL_4_COUNTDOWN_MS = 15_000L
    }

    // ── Reset & decay ─────────────────────────────────────────────
    object Reset {
        // Subtract this much from score when user has been away ≥ NO_USE_WINDOW_MS
        const val NO_USE_WINDOW_MS    = 30 * 60 * 1000L   // 30 min of no use
        const val PARTIAL_RESET_SCORE = 5                  // −5 after 30 min away

        // Each new calendar day subtract this (soft reset — opens still matter)
        const val NEW_DAY_SCORE_CAP   = 4                  // score clamped to ≤4 at midnight

        // "I'll focus now" manual reset from JS
        const val FOCUS_RESET_SCORE   = 4                  // −4 on focus tap
    }

    // ── Allow / cancel / dedup windows ───────────────────────────
    object Windows {
        // After "Open app" is tapped, refresh this window on every in-app event
        // so the overlay never re-fires during an active session.
        const val ALLOW_WINDOW_MS  = 60_000L   // 1 min; refreshed continuously in-session
        const val DUPLICATE_MS     = 2_000L    // dedupe rapid accessibility events
        // No cancel cooldown — cancel = go back, next open gets a fresh overlay
    }
}