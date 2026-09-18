import { AccessibilityDisclosure } from "@/components/AccessibilityDisclosure";
import {
  canDrawOverlays,
  hasUsagePermission,
  isAccessibilityEnabled,
  openOverlaySettings,
  openUsageAccessSettings,
} from "@/modules/lumina-blocker";
import { useEffect, useState } from "react";
import {
  AppState,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Colors,
  Layout,
  Radius,
  Spacing,
  Typography,
} from "../constants/theme";

// ── Config ────────────────────────────────────────────────────────────────────

const permissions = [
  {
    id: "accessibility",
    title: "Accessibility",
    desc: "Senses when distracting apps are opened, allowing for mindful pauses.",
    check: isAccessibilityEnabled,
  },
  {
    id: "overlay",
    title: "Overlay Screen",
    desc: "Places a gentle, calming shield over distracting apps to help you stay present.",
    open: openOverlaySettings,
    check: canDrawOverlays,
  },
  {
    id: "usage",
    title: "Usage Insights",
    desc: "Provides insights into your digital habits so you can reflect on your daily progress.",
    open: openUsageAccessSettings,
    check: hasUsagePermission,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getGranted(): Set<string> {
  const g = new Set<string>();
  permissions.forEach((p) => {
    if (p.check()) g.add(p.id);
  });
  return g;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function FoundationOfFocusScreen({
  onAllGranted,
}: {
  onAllGranted?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [granted, setGranted] = useState<Set<string>>(getGranted);
  const [showAccessibilityDisclosure, setShowAccessibilityDisclosure] =
    useState(false);

  // Re-check whenever user returns from system settings
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        const updated = getGranted();
        setGranted(updated);
      }
    });
    return () => sub.remove();
  }, [onAllGranted]);

  const allGranted = granted.size === permissions.length;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Layout.screenPadding },
        ]}
      >
        <Text style={styles.logo}>Lumina</Text>
        <Text style={styles.heading}>Foundation of Focus</Text>
        <Text style={styles.subtext}>
          Lumina requires these core permissions to protect your attention and
          foster intentionality.
        </Text>

        {permissions.map((p) => {
          const isGranted = granted.has(p.id);
          return (
            <TouchableOpacity
              key={p.id}
              style={[styles.card, isGranted && styles.cardGranted]}
              onPress={() => {
                if (isGranted) return;
                if (p.id === "accessibility") {
                  setShowAccessibilityDisclosure(true);
                  return;
                }
                if ("open" in p) p.open();
              }}
              activeOpacity={isGranted ? 1 : 0.75}
            >
              <View
                style={[styles.iconBox, isGranted && styles.iconBoxGranted]}
              >
                <Text style={styles.iconText}>{isGranted ? "✓" : "·"}</Text>
              </View>
              <View style={styles.cardContent}>
                <View style={styles.titleRow}>
                  <Text style={styles.cardTitle}>{p.title}</Text>
                  <Text
                    style={[styles.badge, isGranted && styles.badgeGranted]}
                  >
                    {isGranted ? "GRANTED" : "TAP TO GRANT"}
                  </Text>
                </View>
                <Text style={styles.cardDesc}>{p.desc}</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        <View style={styles.divider} />
        <Text style={styles.privacyLabel}>PRIVACY FIRST · LOCAL DATA</Text>
      </ScrollView>

      <TouchableOpacity
        style={[
          styles.btn,
          allGranted && styles.btnActive,
          { marginBottom: Math.max(insets.bottom, 16) },
        ]}
        disabled={!allGranted}
        onPress={() => allGranted && onAllGranted?.()}
      >
        <Text style={[styles.btnText, allGranted && styles.btnTextActive]}>
          BEGIN JOURNEY
        </Text>
      </TouchableOpacity>
      <AccessibilityDisclosure
        visible={showAccessibilityDisclosure}
        onClose={() => setShowAccessibilityDisclosure(false)}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Layout.screenPadding, paddingBottom: Spacing.xxl },

  logo: {
    ...Typography.title,
    color: Colors.primary,
    textAlign: "center",
    marginBottom: Spacing.xxl,
  },
  heading: {
    ...Typography.heading,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  subtext: {
    ...Typography.body,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.xxl,
  },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Layout.cardPadding,
    flexDirection: "row",
    gap: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardGranted: {
    borderColor: Colors.success + "50",
    backgroundColor: Colors.surface,
  },

  iconBox: {
    width: 48,
    height: 48,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  iconBoxGranted: {
    backgroundColor: Colors.success + "20",
  },
  iconText: {
    fontSize: 20,
    color: Colors.success,
  },

  cardContent: { flex: 1 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
    flexWrap: "wrap",
  },
  cardTitle: { ...Typography.cardTitle, color: Colors.text },
  badge: {
    ...Typography.caption,
    color: Colors.textMuted,
    letterSpacing: 1.2,
    fontWeight: "700",
  },
  badgeGranted: { color: Colors.success },
  cardDesc: { ...Typography.body, color: Colors.textSecondary, lineHeight: 20 },

  divider: {
    width: 40,
    height: 2,
    backgroundColor: Colors.primary,
    borderRadius: 2,
    alignSelf: "center",
    marginVertical: Spacing.xl,
    opacity: 0.5,
  },
  privacyLabel: {
    ...Typography.sectionTitle,
    color: Colors.textMuted,
    textAlign: "center",
  },

  btn: {
    margin: Layout.screenPadding,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: "center",
  },
  btnActive: { backgroundColor: Colors.primary },
  btnText: {
    ...Typography.button,
    fontSize: 15,
    color: Colors.textMuted,
    letterSpacing: 2.5,
  },
  btnTextActive: { color: Colors.text },
});
