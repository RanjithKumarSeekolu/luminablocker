import {
  clearAllData,
  getAllFocusSessions,
  getDailySnapshots,
  getHistory,
} from "@/modules/lumina-blocker";
import { initLuminaStore } from "@/store/luminaStore";
import { router } from "expo-router";
import React, { useRef } from "react";
import {
  Alert,
  Animated,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
// ─── Theme ────────────────────────────────────────────────────────────────────

const Colors = {
  background: "#0B0B0D",
  surface: "#171719",
  surfaceSecondary: "#19192C",
  border: "#232326",
  primary: "#6D6AF8",
  text: "#FFFFFF",
  textSecondary: "#A4A4AD",
  textMuted: "#8A8A94",
  success: "#10D39B",
  danger: "#FF6B6B",
};

const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
const Radius = { sm: 12, md: 16, lg: 24, xl: 28, pill: 999 };
const Typography = {
  heading: { fontSize: 24, fontWeight: "700" as const },
  cardTitle: { fontSize: 18, fontWeight: "700" as const },
  body: { fontSize: 14 },
  caption: { fontSize: 12 },
  captionStrong: { fontSize: 14, fontWeight: "600" as const },
};
const Layout = { screenPadding: 24, cardPadding: 22, sectionGap: 36 };

function csvCell(value: unknown): string {
  return '"' + String(value ?? "").replace(/"/g, '""') + '"';
}

async function exportJson() {
  const payload = {
    exportedAt: new Date().toISOString(),
    focusSessions: getAllFocusSessions(),
    dailySnapshots: getDailySnapshots(30),
    history: getHistory(),
  };
  await Share.share({
    title: "Lumina JSON export",
    message: JSON.stringify(payload, null, 2),
  });
}

async function exportCsv() {
  const snapshots = getDailySnapshots(30) as Array<Record<string, unknown>>;
  const columns = [
    "date",
    "totalUsageMs",
    "earlyUsageMs",
    "workUsageMs",
    "eveningUsageMs",
    "nightUsageMs",
    "reopenEvents",
    "intentionalExits",
    "focusResets",
    "overlaysTriggered",
  ];
  const csv = [
    columns.join(","),
    ...snapshots.map((row) =>
      columns.map((column) => csvCell(row[column])).join(","),
    ),
  ].join("\n");
  await Share.share({ title: "Lumina CSV export", message: csv });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Orb hero image replacement — pure RN, no SVG dependency */
const OrbHero = () => (
  <View style={orbStyles.wrapper} pointerEvents="none">
    <View style={orbStyles.glow} />
    <View style={orbStyles.outer}>
      <View style={orbStyles.mid}>
        <View style={orbStyles.inner} />
      </View>
    </View>
  </View>
);

const orbStyles = StyleSheet.create({
  wrapper: { alignItems: "center", marginBottom: Spacing.xl },
  glow: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(109,106,248,0.10)",
    top: 10,
  },
  outer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "#141418",
    borderWidth: 1,
    borderColor: "rgba(109,106,248,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  mid: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#1A1A22",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  inner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#222230",
    borderWidth: 1,
    borderColor: "rgba(109,106,248,0.35)",
  },
});

/** Section header with icon character */
const SectionHeader = ({
  icon,
  label,
  color = Colors.success,
}: {
  icon: string;
  label: string;
  color?: string;
}) => (
  <View style={sh.row}>
    <Text style={[sh.icon, { color }]}>{icon}</Text>
    <Text style={[sh.label, { color }]}>{label}</Text>
  </View>
);

const sh = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.lg },
  icon: { fontSize: 18, marginRight: Spacing.sm },
  label: { ...Typography.heading },
});

/** Feature row inside the Local-First card */
const FeatureRow = ({
  icon,
  title,
  subtitle,
  color,
}: {
  icon: string;
  title: string;
  subtitle: string;
  color: string;
}) => (
  <View style={fr.row}>
    <Text style={[fr.icon, { color }]}>{icon}</Text>
    <View style={fr.text}>
      <Text style={fr.title}>{title}</Text>
      <Text style={fr.subtitle}>{subtitle}</Text>
    </View>
  </View>
);

const fr = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: Spacing.lg,
  },
  icon: { fontSize: 18, marginRight: Spacing.md, marginTop: 2 },
  text: { flex: 1 },
  title: {
    ...Typography.captionStrong,
    color: Colors.text,
    marginBottom: 2,
  },
  subtitle: { ...Typography.body, color: Colors.textSecondary, lineHeight: 20 },
});

/** Export button row */
const ExportRow = ({
  label,
  sub,
  icon,
  onPress,
}: {
  label: string;
  sub: string;
  icon: string;
  onPress: () => void;
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();

  const onPressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={er.row}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
      >
        <View style={er.text}>
          <Text style={er.label}>{label}</Text>
          <Text style={er.sub}>{sub}</Text>
        </View>
        <Text style={er.icon}>{icon}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const er = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  text: { flex: 1 },
  label: { ...Typography.captionStrong, color: Colors.text, marginBottom: 2 },
  sub: { ...Typography.caption, color: Colors.textMuted },
  icon: { fontSize: 20, color: Colors.textMuted },
});

/** Bottom nav tab */
const NavTab = ({
  icon,
  label,
  active,
}: {
  icon: string;
  label: string;
  active?: boolean;
}) => (
  <TouchableOpacity style={nt.tab} activeOpacity={0.7}>
    <View style={active ? nt.activeIconWrap : null}>
      <Text style={[nt.icon, active && nt.activeIcon]}>{icon}</Text>
    </View>
    <Text style={[nt.label, active && nt.activeLabel]}>{label}</Text>
  </TouchableOpacity>
);

const nt = StyleSheet.create({
  tab: { flex: 1, alignItems: "center", paddingVertical: Spacing.sm },
  activeIconWrap: {
    backgroundColor: "rgba(109,106,248,0.15)",
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    marginBottom: 2,
  },
  icon: { fontSize: 20, color: Colors.textMuted },
  activeIcon: { color: Colors.primary },
  label: { ...Typography.caption, color: Colors.textMuted, marginTop: 2 },
  activeLabel: { color: Colors.primary, fontWeight: "600" },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PrivacyVaultScreen() {
  const eraseScale = useRef(new Animated.Value(1)).current;

  const onErasePressIn = () =>
    Animated.spring(eraseScale, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();

  const onErasePressOut = () =>
    Animated.spring(eraseScale, { toValue: 1, useNativeDriver: true }).start();

  const handleErase = () => {
    Alert.alert(
      "Erase All Data",
      "This will permanently delete your focus logs, trends, and personalized settings. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Erase",
          style: "destructive",
          onPress: async () => {
            try {
              await clearAllData();
              await initLuminaStore();
              Alert.alert("Done", "All data has been erased.");
            } catch (e) {
              Alert.alert("Error", "Failed to erase data.");
            }
          },
        },
      ],
    );
  };

  return (
    <View style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* ── Top Bar ── */}
      <View style={s.topBar}>
        <TouchableOpacity
          style={s.backBtn}
          activeOpacity={0.7}
          onPress={() => router.back()}
        >
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={s.topTitle}>Privacy Vault</Text>
        <TouchableOpacity style={s.shieldBtn} activeOpacity={0.7}>
          <Text style={s.shieldIcon}>🛡</Text>
        </TouchableOpacity>
      </View>

      {/* ── Scrollable Body ── */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Orb */}
        <OrbHero />

        {/* ── Local-First Sanctuary ── */}
        <SectionHeader icon="⊞" label="Local-First Sanctuary" />
        <View style={s.card}>
          <Text style={s.bodyText}>
            At Lumina, transparency isn't just a policy—it's built into our
            architecture. Your focus data, reflections, and insights are stored{" "}
            <Text style={{ color: Colors.success }}>
              exclusively on this device
            </Text>
            .
          </Text>
          <FeatureRow
            icon="✓"
            title="Zero Cloud Sync"
            subtitle="We don't maintain servers that store your personal activity."
            color={Colors.success}
          />
          <FeatureRow
            icon="🔒"
            title="Device-Level Encryption"
            subtitle="Data is protected by your system's native biometric and pin security."
            color={Colors.success}
          />
        </View>

        <View style={s.sectionGap} />

        {/* ── Portability ── */}
        <SectionHeader icon="⬇" label="Portability" />
        <View style={s.card}>
          <Text style={s.bodyText}>
            Your data belongs to you. Export your entire history into universal
            formats for your own records or to use with other tools.
          </Text>
          <View style={{ marginTop: Spacing.lg }}>
            <ExportRow
              label="Export JSON"
              sub="Developer friendly"
              icon="{}"
              onPress={() => {
                exportJson().catch(() =>
                  Alert.alert(
                    "Export failed",
                    "Lumina could not create the JSON export.",
                  ),
                );
              }}
            />
            <ExportRow
              label="Export CSV"
              sub="Spreadsheet ready"
              icon="⊞"
              onPress={() => {
                exportCsv().catch(() =>
                  Alert.alert(
                    "Export failed",
                    "Lumina could not create the CSV export.",
                  ),
                );
              }}
            />
          </View>
        </View>

        <View style={s.sectionGap} />

        {/* ── Danger Zone ── */}
        <SectionHeader icon="⊠" label="Danger Zone" color={Colors.danger} />
        <View style={s.card}>
          <Text
            style={[
              s.bodyText,
              {
                color: Colors.text,
                fontWeight: "700",
                marginBottom: Spacing.sm,
              },
            ]}
          >
            Clear All Data
          </Text>
          <Text style={s.bodyText}>
            This will permanently delete your focus logs, trends, and
            personalized settings from this device.{" "}
            <Text style={{ color: Colors.danger, fontWeight: "700" }}>
              This action cannot be undone.
            </Text>
          </Text>
          <Animated.View
            style={{
              transform: [{ scale: eraseScale }],
              marginTop: Spacing.xl,
            }}
          >
            <TouchableOpacity
              style={s.eraseBtn}
              onPressIn={onErasePressIn}
              onPressOut={onErasePressOut}
              onPress={handleErase}
              activeOpacity={1}
            >
              <Text style={s.eraseIcon}>⚠</Text>
              <Text style={s.eraseText}>ERASE ALL DATA</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Layout.screenPadding,
    paddingVertical: Spacing.lg,
  },
  backBtn: { padding: Spacing.xs },
  backIcon: { fontSize: 22, color: Colors.text },
  topTitle: {
    flex: 1,
    textAlign: "center",
    ...Typography.cardTitle,
    color: Colors.text,
  },
  shieldBtn: { padding: Spacing.xs },
  shieldIcon: { fontSize: 20 },

  scroll: { flex: 1 },
  content: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing.xl,
  },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Layout.cardPadding,
  },
  bodyText: {
    ...Typography.body,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  sectionGap: { height: Layout.sectionGap },

  eraseBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: Colors.danger,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  eraseIcon: { fontSize: 18, color: Colors.danger },
  eraseText: {
    ...Typography.captionStrong,
    color: Colors.danger,
    letterSpacing: 1,
  },

  nav: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingBottom: Spacing.sm,
  },
});
