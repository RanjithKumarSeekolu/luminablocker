import { Colors, Radius, Spacing, Typography } from "@/constants/theme";
import { formatUsage, getCurrentTimeSlot, getGreeting } from "@/constants/utils";
import { DailySnapshot } from "@/modules/lumina-blocker";
import { getStore, refreshLuminaStore, subscribe } from "@/store/luminaStore";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  AppState,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export type AppFocusData = {
  packageName: string;
  appName: string;
  icon?: string;
  score: number;
  level: number;
  category: string;
  usageMs: number;
  usageBreakdown: {
    early: number;
    work: number;
    evening: number;
    night: number;
  };
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function GrowthInsight({ targets }: { targets: AppFocusData[] }) {
  const topTarget = [...targets].sort((a, b) => b.usageMs - a.usageMs)[0];
  const hasUsage = topTarget && topTarget.usageMs > 0;

  return (
    <View style={styles.insightCard}>
      <View style={styles.insightAccent} />
      <View style={styles.insightContent}>
        <Text style={styles.insightLabel}>GROWTH INSIGHT</Text>
        {hasUsage ? (
          <Text style={styles.insightText}>
            Your highest focus-target usage today is{" "}
            <Text style={styles.insightHighlight}>{topTarget.appName}</Text> at{" "}
            {formatUsage(topTarget.usageMs)}. Notice the pattern and choose your
            next pause intentionally.
          </Text>
        ) : (
          <Text style={styles.insightText}>
            Add a focus target and use it today to start building a meaningful
            usage pattern.
          </Text>
        )}
      </View>
    </View>
  );
}

function TimeDistribution({ snapshot }: { snapshot: DailySnapshot | null }) {
  const activeSlot = getCurrentTimeSlot();

  const distribution = [
    {
      label: "EARLY",
      range: "12AM – 9AM",
      value: snapshot ? formatUsage(snapshot.earlyUsageMs) : "--",
    },
    {
      label: "WORK",
      range: "9AM – 5PM",
      value: snapshot ? formatUsage(snapshot.workUsageMs) : "--",
    },
    {
      label: "EVENING",
      range: "5PM – 9PM",
      value: snapshot ? formatUsage(snapshot.eveningUsageMs) : "--",
    },
    {
      label: "NIGHT",
      range: "9PM – 12AM",
      value: snapshot ? formatUsage(snapshot.nightUsageMs) : "--",
    },
  ];

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Time Distribution</Text>
        <Text style={styles.sectionMeta}>Today</Text>
      </View>
      <View style={styles.timeGrid}>
        {distribution.map((slot) => {
          const isActive = slot.label.toLowerCase() === activeSlot;
          return (
            <View
              key={slot.label}
              style={[styles.timeCard, isActive && styles.timeCardActive]}
            >
              <View style={styles.timeCardTop}>
                <Text style={styles.timeCardLabel}>{slot.label}</Text>
                {isActive && <View style={styles.activeDot} />}
              </View>
              <Text style={styles.timeCardRange}>{slot.range}</Text>
              <Text style={styles.timeCardValue}>{slot.value}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

type UsageKey = keyof AppFocusData["usageBreakdown"];

const SLOT_CONFIG: { key: UsageKey; label: string; icon: string }[] = [
  { key: "early", label: "ERL", icon: "moon-outline" },
  { key: "work", label: "WRK", icon: "briefcase-outline" },
  { key: "evening", label: "EVE", icon: "partly-sunny-outline" },
  { key: "night", label: "NGT", icon: "star-outline" },
];

function FocusTargetItem({ item }: { item: AppFocusData }) {
  const activeSlot = getCurrentTimeSlot();

  return (
    <View style={styles.focusItem}>
      <View style={styles.focusItemTop}>
        <View style={styles.appIconWrap}>
          {item.icon ? (
            <Image
              source={{ uri: item.icon }}
              style={styles.focusAppIcon}
              resizeMode="contain"
            />
          ) : (
            <Ionicons name="apps" size={20} color={Colors.textSecondary} />
          )}
        </View>
        <View style={styles.focusItemMeta}>
          <Text style={styles.focusItemName}>{item.appName}</Text>
          <Text style={styles.focusItemCategory}>
            {item.category.toUpperCase()}
          </Text>
        </View>
        <View style={styles.focusItemTotal}>
          <Text style={styles.focusItemTotalTime}>
            {formatUsage(item.usageMs)}
          </Text>
          <Text style={styles.focusItemTotalLabel}>TOTAL USAGE</Text>
        </View>
      </View>

      <View style={styles.focusSlots}>
        {SLOT_CONFIG.map(({ key, label, icon }) => {
          const isActive = key === activeSlot;
          return (
            <View key={key} style={styles.focusSlot}>
              <View style={styles.slotLabelRow}>
                <Ionicons
                  name={icon as any}
                  size={13}
                  color={isActive ? Colors.primary : Colors.textMuted}
                  style={{ marginBottom: 3 }}
                />
                <Text
                  style={[
                    styles.slotLabel,
                    { color: isActive ? Colors.primary : Colors.textMuted },
                  ]}
                >
                  {label}
                </Text>
              </View>
              <Text
                style={[styles.slotValue, isActive && styles.slotValueActive]}
              >
                {item.usageBreakdown[key] > 0
                  ? formatUsage(item.usageBreakdown[key])
                  : "--"}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function FocusTargets({ targets }: { targets: AppFocusData[] }) {
  if (targets.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Focus Targets</Text>
      <View style={styles.focusTargetsContent}>
        {[...targets]
          .sort((a, b) => b.score - a.score)
          .map((item) => (
            <FocusTargetItem key={item.packageName} item={item} />
          ))}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function Reflect() {
  const [data, setData] = useState(getStore());

  const refresh = useCallback(() => {
    return refreshLuminaStore()
      .then(() => setData({ ...getStore() }))
      .catch(() => {
        // Native permission/state changes should not break the Reflect screen.
      });
  }, []);

  // Keep in sync when store updates from background init
  useEffect(() => {
    return subscribe(() => setData({ ...getStore() }));
  }, []);

  // Lightweight refresh on tab focus — no getInstalledApps call
  useFocusEffect(
    useCallback(() => {
      void refresh();
      const interval = setInterval(() => void refresh(), 60_000);
      return () => clearInterval(interval);
    }, [refresh]),
  );

  // Refresh when app comes back to foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refresh();
      }
    });
    return () => sub.remove();
  }, [refresh]);

  const greeting = getGreeting();

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Greeting */}
        <View style={styles.greetingSection}>
          <Text style={styles.greetingText}>
            Good {greeting}.
          </Text>
          <Text style={styles.greetingSubtitle}>
            You've been mindful today.
          </Text>
          <Text style={styles.focusLabel}>TOTAL FOCUS TODAY</Text>
          <Text style={styles.focusTime}>{formatUsage(data.todayFocusMs)}</Text>
        </View>

        <GrowthInsight targets={data.focusTargets} />
        <TimeDistribution snapshot={data.snapshot} />
        <FocusTargets targets={data.focusTargets} />
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  greetingSection: {
    paddingTop: Radius.xl,
    paddingBottom: Spacing.xl,
  },
  greetingText: {
    ...Typography.title,
    color: Colors.text,
    lineHeight: 44,
    letterSpacing: -0.5,
  },
  greetingSubtitle: {
    ...Typography.body,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
  },
  focusLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textMuted,
    letterSpacing: 1.2,
    marginTop: Radius.xl,
  },
  focusTime: {
    fontSize: 48,
    fontWeight: "700",
    color: Colors.primary,
    marginTop: Spacing.xs,
    letterSpacing: -1,
  },
  insightCard: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    marginBottom: Spacing.xxl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  insightAccent: {
    width: 3,
    backgroundColor: Colors.success,
  },
  insightContent: {
    flex: 1,
    padding: Spacing.lg,
  },
  insightLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.success,
    letterSpacing: 1.5,
    marginBottom: Spacing.sm,
  },
  insightText: {
    ...Typography.body,
    color: Colors.text,
    lineHeight: 21,
  },
  insightHighlight: {
    color: Colors.primary,
    fontWeight: "600",
  },
  section: {
    marginBottom: Spacing.xxl,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.text,
  },
  sectionMeta: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  timeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 10,
    justifyContent: "space-between",
  },
  timeCard: {
    width: "48%",
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  timeCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceSecondary,
  },
  timeCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  timeCardLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  timeCardRange: {
    fontSize: 10,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  timeCardValue: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.text,
  },
  appIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  focusAppIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
  },
  focusTargetsContent: {
    marginTop: Spacing.lg,
  },
  focusItem: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  focusItemTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  focusItemMeta: {
    flex: 1,
  },
  focusItemName: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.text,
    paddingBottom: Spacing.xs,
  },
  focusItemCategory: {
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  focusItemTotal: {
    alignItems: "flex-end",
  },
  focusItemTotalTime: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.primary,
  },
  focusItemTotalLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  focusSlots: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
    marginLeft: Spacing.md,
  },
  focusSlot: {
    alignItems: "flex-start",
    flex: 1,
  },
  slotLabelRow: {
    flexDirection: "row",
    gap: 3,
    alignItems: "center",
  },
  slotLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  slotValue: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  slotValueActive: {
    color: Colors.primary,
  },
  bottomSpacer: {
    height: Spacing.xxl,
  },
});
