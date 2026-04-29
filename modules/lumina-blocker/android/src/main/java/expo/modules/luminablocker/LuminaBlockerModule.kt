package expo.modules.luminablocker

import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.content.pm.PackageManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class LuminaBlockerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LuminaBlocker")

    // Save list of blocked app package names
    Function("saveBlockedApps") { apps: List<String> ->
      val prefs = appContext.reactContext
        ?.getSharedPreferences("LuminaPrefs", Context.MODE_PRIVATE)

      prefs?.edit()?.putStringSet("blockedApps", apps.toSet())?.apply()

      null // ✅ REQUIRED
    }

    // Get saved blocked apps
    Function("getBlockedApps") {
      val prefs = appContext.reactContext
        ?.getSharedPreferences("LuminaPrefs", Context.MODE_PRIVATE)

      prefs?.getStringSet("blockedApps", emptySet())?.toList()
        ?: emptyList<String>()
    }

    // Check if Accessibility Service is enabled
    Function("isAccessibilityEnabled") {
      val ctx = appContext.reactContext ?: return@Function false

      val enabled = Settings.Secure.getString(
        ctx.contentResolver,
        Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
      ) ?: ""

      enabled.contains(ctx.packageName, ignoreCase = true)
    }

    // Open Android Accessibility Settings
    Function("openAccessibilitySettings") {
      val ctx = appContext.reactContext ?: return@Function null // ✅ FIXED

      val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK
      }

      ctx.startActivity(intent)

      null // ✅ REQUIRED
    }

    // Get list of installed launchable apps
    Function("getInstalledApps") {
      val ctx = appContext.reactContext
        ?: return@Function emptyList<Map<String, String>>()

      val pm = ctx.packageManager

      val intent = Intent(Intent.ACTION_MAIN, null).apply {
        addCategory(Intent.CATEGORY_LAUNCHER)
      }

      val apps = pm.queryIntentActivities(intent, 0)

      apps.map {
        mapOf(
          "packageName" to it.activityInfo.packageName,
          "label" to it.loadLabel(pm).toString()
        )
      }
    }

    // Emit event when a blocked app is detected
    Events("onBlockedAppOpened")
  }
}