package expo.modules.luminablocker

data class AppDailySnapshot(

    val date: String,

    val packageName: String,

    val appName: String,

    val usageMs: Long,

    val morningUsageMs: Long,

    val afternoonUsageMs: Long,

    val eveningUsageMs: Long,

    val nightUsageMs: Long,

    val score: Int,

    val level: Int
)