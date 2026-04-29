const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withLuminaBlocker(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // Add permissions
    manifest["uses-permission"] = manifest["uses-permission"] ?? [];
    const perms = [
      "android.permission.PACKAGE_USAGE_STATS",
      "android.permission.SYSTEM_ALERT_WINDOW",
      "android.permission.FOREGROUND_SERVICE",
    ];
    for (const perm of perms) {
      if (
        !manifest["uses-permission"].some((p) => p.$?.["android:name"] === perm)
      ) {
        manifest["uses-permission"].push({ $: { "android:name": perm } });
      }
    }

    // Add Accessibility Service
    const app = manifest.application?.[0];
    if (app) {
      app.service = app.service ?? [];
      const serviceName =
        "expo.modules.luminablocker.LuminaAccessibilityService";
      if (!app.service.some((s) => s.$?.["android:name"] === serviceName)) {
        app.service.push({
          $: {
            "android:name": serviceName,
            "android:permission":
              "android.permission.BIND_ACCESSIBILITY_SERVICE",
            "android:exported": "true",
          },
          "intent-filter": [
            {
              action: [
                {
                  $: {
                    "android:name":
                      "android.accessibilityservice.AccessibilityService",
                  },
                },
              ],
            },
          ],
          "meta-data": [
            {
              $: {
                "android:name": "android.accessibilityservice",
                "android:resource": "@xml/lumina_accessibility_config",
              },
            },
          ],
        });
      }
    }

    return config;
  });
};
