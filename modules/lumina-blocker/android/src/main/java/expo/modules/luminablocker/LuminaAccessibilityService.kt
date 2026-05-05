package expo.modules.luminablocker

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.util.Log
import android.view.accessibility.AccessibilityEvent

class LuminaAccessibilityService : AccessibilityService() {

    private var lastForegroundPackage = ""
    private var lastForegroundTime = 0L
    // Only skip duplicate events within 2 seconds
    private val DUPLICATE_WINDOW_MS = 2000L

    companion object {
        const val TAG = "LuminaService"
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.d(TAG, "✅ Service connected")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        val packageName = event.packageName?.toString() ?: return

        if (packageName == applicationContext.packageName) return

        val prefs = getSharedPreferences("LuminaPrefs", Context.MODE_PRIVATE)
        val blockedApps = prefs.getStringSet("blockedApps", emptySet())?.toSet() ?: return
        if (packageName !in blockedApps) return

        val now = System.currentTimeMillis()
        val isActive = prefs.getBoolean("breathScreenActive", false)

        if (!isActive && packageName == lastForegroundPackage) {
            lastForegroundPackage = ""
            lastForegroundTime = 0L
        }

        if (packageName == lastForegroundPackage && now - lastForegroundTime < DUPLICATE_WINDOW_MS) {
            Log.d(TAG, "⏭ Duplicate event within ${now - lastForegroundTime}ms, skipping")
            return
        }

        lastForegroundPackage = packageName
        lastForegroundTime = now

        if (isActive) {
            Log.d(TAG, "🫁 Breath screen already active, skipping")
            return
        }

        // Allow window
        val allowedPackage = prefs.getString("allowedPackage", "")
        val allowedTime = prefs.getLong("allowedTime", 0L)
        val allowedAge = now - allowedTime

        if (!allowedPackage.isNullOrEmpty() && packageName == allowedPackage && allowedAge < 8000L) {
            Log.d(TAG, "🟢 Within allow window (${allowedAge}ms), passing through")
            return
        }

        if (!allowedPackage.isNullOrEmpty() && allowedAge >= 8000L) {
            prefs.edit().remove("allowedPackage").remove("allowedTime").apply()
        }

        // Cancel cooldown
        val cancelledPackage = prefs.getString("cancelledPackage", "")
        val cancelledTime = prefs.getLong("cancelledTime", 0L)
        val cancelledAge = now - cancelledTime

        if (!cancelledPackage.isNullOrEmpty() && packageName == cancelledPackage && cancelledAge < 30000L) {
            Log.d(TAG, "⏳ Within cancel cooldown (${cancelledAge}ms), skipping")
            return
        }

        if (!cancelledPackage.isNullOrEmpty() && cancelledAge >= 30000L) {
            prefs.edit().remove("cancelledPackage").remove("cancelledTime").apply()
        }

        Log.d(TAG, "🫁 Showing breath screen for: $packageName")
        prefs.edit().putBoolean("breathScreenActive", true).apply()
        BreathOverlayActivity.start(applicationContext, packageName)
    }

    override fun onInterrupt() {
        Log.d(TAG, "⚠️ Service interrupted")
    }
}