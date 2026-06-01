data class FocusSession(
    val id: String,
    val startTime: Long,
    val endTime: Long,
    val plannedDurationMs: Long,
    val actualDurationMs: Long,
    val completed: Boolean,
    val exitReason: String
)