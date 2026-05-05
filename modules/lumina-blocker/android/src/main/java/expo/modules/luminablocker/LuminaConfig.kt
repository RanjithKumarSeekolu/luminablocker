package expo.modules.luminablocker

object LuminaConfig {

    // -----------------------------
    // ⏱ Time Intervals
    // -----------------------------
    const val RESET_INTERVAL_MS = 30 * 60 * 1000L      // 30 min
    const val DUPLICATE_WINDOW_MS = 2000L              // 2 sec
    const val ALLOW_WINDOW_MS = 8000L                  // 8 sec
    const val CANCEL_COOLDOWN_MS = 30000L              // 30 sec

    // -----------------------------
    // 🎯 Score Thresholds
    // -----------------------------
    const val TRIGGER_SCORE = 5

    // -----------------------------
    // 📊 Frequency Weights
    // -----------------------------
    const val LOW_FREQUENCY_THRESHOLD = 5
    const val HIGH_FREQUENCY_THRESHOLD = 10

    const val LOW_FREQUENCY_SCORE = 2
    const val HIGH_FREQUENCY_SCORE = 4

    // -----------------------------
    // ⚡ Impulse (Gap) Weights
    // -----------------------------
    const val SHORT_GAP_MS = 30_000L
    const val MEDIUM_GAP_MS = 60_000L

    const val SHORT_GAP_SCORE = 4
    const val MEDIUM_GAP_SCORE = 2

    // -----------------------------
    // 🔁 Penalty System
    // -----------------------------
    const val PENALTY_INCREMENT = 2
    const val PENALTY_DECREMENT = 1

    // -----------------------------
    // 🧘 Breath Settings
    // -----------------------------
    const val BREATH_DURATION_MS = 5000L
}