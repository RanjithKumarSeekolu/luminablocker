package expo.modules.luminablocker

object AppCategoryResolver {

    fun getCategory(packageName: String): String {
        return when {
            packageName.contains("instagram") -> "SOCIAL"
            packageName.contains("facebook") -> "SOCIAL"
            packageName.contains("snapchat") -> "SOCIAL"

            packageName.contains("whatsapp") -> "MESSAGING"
            packageName.contains("telegram") -> "MESSAGING"

            packageName.contains("youtube.music") -> "MUSIC"

            packageName.contains("youtube") -> "VIDEO"
            packageName.contains("netflix") -> "VIDEO"

            packageName.contains("chrome") -> "BROWSING"
            packageName.contains("firefox") -> "BROWSING"

            packageName.contains("gmail") -> "PRODUCTIVITY"
            packageName.contains("docs") -> "PRODUCTIVITY"

            else -> "APP"
        }
    }
}