package expo.modules.luminablocker

data class DailyBalanceSnapshot(

    val date: String,

    val totalUsageMs: Long,

    val morningUsageMs: Long,

    val afternoonUsageMs: Long,

    val eveningUsageMs: Long,

    val nightUsageMs: Long,

    val reopenEvents: Int,

    val intentionalExits: Int,

    val focusResets: Int,

    val overlaysTriggered: Int
)