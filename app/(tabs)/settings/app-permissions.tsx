import {
  canDrawOverlays,
  hasUsagePermission,
  isAccessibilityEnabled,
  openAccessibilitySettings,
  openOverlaySettings,
  openUsageAccessSettings,
} from "@/modules/lumina-blocker";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  AppState,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ── Theme ─────────────────────────────────────────────────────────────────────

const Colors = {
  background: "#0D0D0F",
  surface: "#161619",
  surfaceSecondary: "#1E1E24",
  border: "#2A2A32",
  primary: "#7B6EF6",
  primaryMuted: "#7B6EF620",
  success: "#4ADE80",
  text: "#F0EFF5",
  textSecondary: "#9A9AAF",
  textMuted: "#52525E",
  danger: "#F87171",
};

// ── Types ─────────────────────────────────────────────────────────────────────

type Permission = {
  id: string;
  icon: string;
  title: string;
  tag?: { label: string; color: string };
  desc: string;
  /** Check whether the OS reports this permission as granted */
  check: () => boolean;
  /** Open the relevant OS settings page to grant the permission */
  openGrant: () => void;
  /** Open the relevant OS settings page to revoke the permission */
  openRevoke: () => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Opens the app's main settings page (works on both platforms) */
function openAppSettings() {
  Linking.openSettings().catch(() => {
    Alert.alert(
      "Open Settings",
      "Please open your device Settings and manage app permissions manually.",
    );
  });
}

/**
 * On Android, revoking special permissions (accessibility, overlay, usage
 * access) can only be done by the user inside the specific system settings
 * panel — the same panel used to grant them.  We navigate there and show a
 * brief instructional alert so the user knows what to do.
 */
function openRevokeWithHint(settingsFn: () => void, permissionName: string) {
  Alert.alert(
    `Revoke ${permissionName}`,
    `To remove this permission, disable "${permissionName}" in the system settings page that is about to open.`,
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Open Settings",
        onPress: () => settingsFn(),
      },
    ],
  );
}

// ── Permission Config ─────────────────────────────────────────────────────────

const PERMISSIONS: Permission[] = [
  {
    id: "accessibility",
    icon: "⏰",
    title: "Accessibility Access",
    tag: { label: "REQUIRED FOR TRACKING", color: Colors.success },
    desc: "Allows Lumina's accessibility service to identify foreground apps and apply your focus boundaries.",
    check: isAccessibilityEnabled,
    openGrant: openAccessibilitySettings,
    openRevoke: () =>
      openRevokeWithHint(openAccessibilitySettings, "Accessibility Access"),
  },
  {
    id: "overlay",
    icon: "▣",
    title: "Overlay Permission",
    tag: undefined,
    desc: "Allows Lumina to display the full-screen intervention when a blocked app is opened.",
    check: canDrawOverlays,
    openGrant: openOverlaySettings,
    openRevoke: () =>
      openRevokeWithHint(openOverlaySettings, "Overlay Permission"),
  },
  {
    id: "usage_stats",
    icon: "📊",
    title: "Usage Stats",
    tag: undefined,
    desc: "Powers your Trends Dashboard by analyzing weekly patterns. Data is processed locally on your device.",
    check: hasUsagePermission,
    openGrant: openUsageAccessSettings,
    openRevoke: () =>
      openRevokeWithHint(openUsageAccessSettings, "Usage Stats"),
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function Header({ onBack }: { onBack?: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
      <TouchableOpacity style={styles.headerBtn} onPress={onBack}>
        <Text style={styles.headerBtnText}>←</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Permissions</Text>
      <View style={styles.headerBtn}>
        <Text style={styles.headerBtnText}>🛡</Text>
      </View>
    </View>
  );
}

function PermissionIcon({ icon }: { icon: string }) {
  return (
    <View style={styles.iconCircle}>
      <Text style={styles.iconEmoji}>{icon}</Text>
    </View>
  );
}

function PermissionCard({
  permission,
  granted,
}: {
  permission: Permission;
  granted: boolean;
}) {
  return (
    <View style={[styles.card, granted && styles.cardGranted]}>
      <View style={styles.cardTop}>
        <PermissionIcon icon={permission.icon} />

        <View style={styles.cardMeta}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>{permission.title}</Text>

            <View style={styles.cardBadgeCol}>
              {/* Primary badge */}
              <Text
                style={[
                  styles.badge,
                  granted ? styles.badgeGranted : styles.badgePending,
                ]}
              >
                {granted ? "GRANTED" : "TAP TO GRANT"}
              </Text>

              {/* Action button — opens correct settings page */}
              <TouchableOpacity
                onPress={granted ? permission.openRevoke : permission.openGrant}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text
                  style={[
                    styles.actionText,
                    granted ? styles.actionRevoke : styles.actionGrant,
                  ]}
                >
                  {granted ? "TAP TO REVOKE" : "OPEN SETTINGS"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {permission.tag && (
            <Text style={[styles.tag, { color: permission.tag.color }]}>
              {permission.tag.label}
            </Text>
          )}
        </View>
      </View>

      <Text style={styles.cardDesc}>{permission.desc}</Text>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function PermissionsScreen({ onBack }: { onBack?: () => void }) {
  const insets = useSafeAreaInsets();
  // Derive live granted state from OS checks
  const getGrantedSet = useCallback((): Set<string> => {
    const s = new Set<string>();
    PERMISSIONS.forEach((p) => {
      if (p.check()) s.add(p.id);
    });
    return s;
  }, []);

  const [granted, setGranted] = useState<Set<string>>(getGrantedSet);

  // Re-check every time the user returns from a settings page
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setGranted(getGrantedSet());
    });
    return () => sub.remove();
  }, [getGrantedSet]);

  return (
    <View style={styles.safe}>
      <Header onBack={onBack ?? (() => router.back())} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 48 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <Text style={styles.heroHeading}>Your Sanctuary,{"\n"}Your Terms</Text>
        <Text style={styles.heroSubtext}>
          Lumina is built on privacy and intentionality. We only request access
          to what is strictly necessary to enhance your digital well-being.
        </Text>

        {/* Cards */}
        <View style={styles.cardList}>
          {PERMISSIONS.map((p) => (
            <PermissionCard
              key={p.id}
              permission={p}
              granted={granted.has(p.id)}
            />
          ))}
        </View>

        {/* Footer quote */}
        <Text style={styles.quote}>
          {`"Privacy is not an option, and it\nshouldn't be the price we pay for just\ngetting on the internet."`}
        </Text>
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBtnText: {
    fontSize: 17,
    color: Colors.text,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.primary,
    letterSpacing: 0.3,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 48,
  },

  // Hero
  heroHeading: {
    fontSize: 32,
    fontWeight: "800",
    color: Colors.text,
    lineHeight: 40,
    marginTop: 24,
    marginBottom: 14,
    letterSpacing: -0.5,
  },
  heroSubtext: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 23,
    marginBottom: 32,
  },

  // Cards
  cardList: {
    gap: 14,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
  },
  cardGranted: {
    borderColor: Colors.primary + "30",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
    gap: 14,
  },

  // Icon
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primaryMuted,
    borderWidth: 1,
    borderColor: Colors.primary + "40",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  iconEmoji: {
    fontSize: 22,
  },

  // Card meta
  cardMeta: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.text,
    flex: 1,
    lineHeight: 22,
  },
  cardBadgeCol: {
    alignItems: "flex-end",
    gap: 4,
  },
  badge: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  badgeGranted: {
    color: Colors.primary,
  },
  badgePending: {
    color: Colors.textMuted,
  },
  actionText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  actionRevoke: {
    color: Colors.danger,
  },
  actionGrant: {
    color: Colors.success,
  },
  tag: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: 2,
  },
  cardDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 21,
  },

  // Quote
  quote: {
    fontSize: 13,
    fontStyle: "italic",
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 21,
    marginTop: 48,
    paddingHorizontal: 12,
  },
});
