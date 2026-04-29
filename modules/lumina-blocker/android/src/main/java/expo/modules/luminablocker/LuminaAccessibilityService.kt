package expo.modules.luminablocker

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.Intent
import android.view.accessibility.AccessibilityEvent

class LuminaAccessibilityService : AccessibilityService() {

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
    val packageName = event.packageName?.toString() ?: return

    // Skip our own app
    if (packageName == applicationContext.packageName) return

    val prefs = getSharedPreferences("LuminaPrefs", Context.MODE_PRIVATE)
    val blockedApps = prefs.getStringSet("blockedApps", emptySet()) ?: return

    if (packageName in blockedApps) {
      // Launch our app with the blocked package info
      val intent = Intent(applicationContext, Class.forName("${applicationContext.packageName}.MainActivity")).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        putExtra("BLOCKED_APP", packageName)
        putExtra("SHOW_BREATH_SCREEN", true)
      }
      startActivity(intent)
    }
  }

  override fun onInterrupt() {}
}