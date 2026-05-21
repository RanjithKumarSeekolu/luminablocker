    package expo.modules.luminablocker

    data class ScoreEvent(
        val timestamp: Long,
        val packageName: String,
        val appName: String,
        val reason: String,
        val details: String,
        val delta: Int,
        val previousScore: Int,
        val newScore: Int
    )