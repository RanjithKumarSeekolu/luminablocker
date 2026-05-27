// LuminaFocusConfig.kt

package expo.modules.luminablocker

object LuminaFocusConfig {

    // ─────────────────────────────────────────────
    // Focus Session
    // ─────────────────────────────────────────────

    const val DEFAULT_FOCUS_DURATION_MINUTES =
        25

    const val DEFAULT_FOCUS_DURATION_MS =
        DEFAULT_FOCUS_DURATION_MINUTES *
        60 * 1000L

    val FOCUS_DURATIONS = listOf(
        15 * 60 * 1000L,
        25 * 60 * 1000L,
        45 * 60 * 1000L,
        60 * 60 * 1000L
    )

    val FOCUS_DURATION_LABELS = listOf(
        "15m",
        "25m",
        "45m",
        "60m"
    )

    // ─────────────────────────────────────────────
    // Exit Behavior
    // ─────────────────────────────────────────────

    const val ENABLE_VOLUME_HOLD_EXIT =
        true

    const val VOLUME_HOLD_EXIT_DURATION_MS =
        10_000L

    const val VOLUME_HOLD_TICK_INTERVAL_MS =
        1000L
    // ─────────────────────────────────────────────
    // Overlay
    // ─────────────────────────────────────────────

    const val ENABLE_IMMERSIVE_MODE =
        true

    const val KEEP_SCREEN_AWAKE =
        true

    const val BLOCK_TOUCH_OUTSIDE =
        true

    // ─────────────────────────────────────────────
    // Accessibility
    // ─────────────────────────────────────────────

    const val ENABLE_APP_RESTORE =
        true

    const val RESTORE_DELAY_MS =
        300L

    // ─────────────────────────────────────────────
    // Focus Lock
    // ─────────────────────────────────────────────

    const val ENABLE_SCREEN_PINNING =
        true

    const val ENABLE_KIOSK_BEHAVIOR =
        true

    // ─────────────────────────────────────────────
    // Phrase Rotation
    // ─────────────────────────────────────────────

    const val PHRASE_ROTATION_INTERVAL_MS =
        2 * 60 * 1000L
}