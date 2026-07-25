import { Colors, Radius, Spacing, Typography } from "@/constants/theme";
import { formatUsage, getCurrentTimeSlot, getGreeting } from "@/constants/utils";
import { DailySnapshot } from "@/modules/lumina-blocker";
import { fetchAiInsights, type AiInsight } from "@/services/aiInsights";
import { getStore, refreshLuminaStore, subscribe } from "@/store/luminaStore";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  AppState,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
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

const AI_TONE_COLORS = {
  primary: Colors.primary,
  success: Colors.success,
  warning: Colors.danger,
} as const;

function GrowthInsightCard({
  insight,
  loading,
  onPress,
}: {
  insight?: AiInsight;
  loading: boolean;
  onPress: () => void;
}) {
  if (!insight && !loading) return null;

  return (
    <TouchableOpacity
      style={styles.growthInsightCard}
      activeOpacity={0.82}
      onPress={onPress}
      disabled={!insight}
    >
      <View style={styles.growthInsightAccent} />
      <View style={styles.growthInsightContent}>
        <View style={styles.growthInsightHeader}>
          <View style={styles.growthInsightLabelRow}>
            <Ionicons name="sparkles" size={17} color={Colors.success} />
            <Text style={styles.growthInsightLabel}>GROWTH INSIGHT</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
        </View>
        <Text style={styles.growthInsightText}>
          {loading
            ? "Analyzing your recent usage pattern..."
            : insight?.body}
        </Text>
        {insight && (
          <Text style={styles.growthInsightAction}>See more  →</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function InsightsModal({
  visible,
  insights,
  targets,
  weeklyFocusData,
  onClose,
}: {
  visible: boolean;
  insights: AiInsight[];
  targets: AppFocusData[];
  weeklyFocusData: { date: string; totalMs: number; sessionCount: number }[];
  onClose: () => void;
}) {
  const weeklyTotal = weeklyFocusData.reduce((sum, day) => sum + day.totalMs, 0);
  const weeklySessions = weeklyFocusData.reduce(
    (sum, day) => sum + day.sessionCount,
    0,
  );
  const topTargets = [...targets]
    .filter((target) => target.usageMs > 0)
    .sort((a, b) => b.usageMs - a.usageMs)
    .slice(0, 3);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.insightsModal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
              <Ionicons name="arrow-back" size={22} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Insights</Text>
            <Ionicons name="share-outline" size={20} color={Colors.textSecondary} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalContent}
          >
            {insights[0] && (
              <View style={styles.featuredCard}>
                <View style={styles.featuredTopRow}>
                  <Text style={styles.featuredLabel}>FEATURED ANALYSIS</Text>
                  <Ionicons
                    name={insights[0].icon as any}
                    size={27}
                    color={Colors.success}
                  />
                </View>
                <Text style={styles.featuredTitle}>{insights[0].title}</Text>
                <Text style={styles.featuredBody}>{insights[0].body}</Text>
                <Text style={styles.featuredRecommendation}>
                  →  {insights[0].recommendation}
                </Text>
              </View>
            )}

            <View style={styles.modalSectionHeader}>
              <Text style={styles.modalSectionTitle}>WEEKLY FOCUS VOLUME</Text>
              <Text style={styles.modalSectionMeta}>Last 7 days</Text>
            </View>
            <View style={styles.volumeCard}>
              <Text style={styles.volumeValue}>
                {formatUsage(weeklyTotal)}
              </Text>
              <Text style={styles.volumeCaption}>{weeklySessions} focus sessions</Text>
              <View style={styles.volumeBars}>
                {weeklyFocusData.map((day) => {
                  const max = Math.max(...weeklyFocusData.map((item) => item.totalMs), 1);
                  return (
                    <View key={day.date} style={styles.volumeBarTrack}>
                      <View
                        style={[
                          styles.volumeBar,
                          { height: Math.max((day.totalMs / max) * 52, day.totalMs > 0 ? 5 : 2) },
                        ]}
                      />
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={styles.modalSectionHeader}>
              <Text style={styles.modalSectionTitle}>DISTRACTION PATTERNS</Text>
              <Text style={styles.modalSectionMeta}>Focus targets</Text>
            </View>
            <View style={styles.patternCard}>
              {topTargets.length === 0 ? (
                <Text style={styles.emptyModalText}>Use a focus target to reveal your strongest patterns.</Text>
              ) : (
                topTargets.map((target) => (
                  <View key={target.packageName} style={styles.patternRow}>
                    <View style={styles.patternIcon}>
                      {target.icon ? (
                        <Image source={{ uri: target.icon }} style={styles.patternAppIcon} />
                      ) : (
                        <Ionicons name="apps" size={16} color={Colors.textSecondary} />
                      )}
                    </View>
                    <View style={styles.patternMeta}>
                      <Text style={styles.patternName}>{target.appName}</Text>
                      <Text style={styles.patternUsage}>{formatUsage(target.usageMs)} today</Text>
                    </View>
                    <Text style={styles.patternLevel}>{target.level > 0 ? `L${target.level}` : "—"}</Text>
                  </View>
                ))
              )}
            </View>

            <View style={styles.modalSectionHeader}>
              <Text style={styles.modalSectionTitle}>MINDFUL PATHS</Text>
              <Text style={styles.modalSectionMeta}>Try next</Text>
            </View>
            {insights.slice(1).map((insight) => {
              const tone = AI_TONE_COLORS[insight.tone];
              return (
                <View key={insight.id} style={[styles.pathCard, { borderLeftColor: tone }]}>
                  <Ionicons name={insight.icon as any} size={20} color={tone} />
                  <View style={styles.pathContent}>
                    <Text style={styles.pathTitle}>{insight.title}</Text>
                    <Text style={styles.pathBody}>{insight.recommendation}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
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
  const [aiInsights, setAiInsights] = useState<AiInsight[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(false);
  const [showInsightsModal, setShowInsightsModal] = useState(false);

  const refresh = useCallback(async () => {
    try {
      await refreshLuminaStore();
      const next = { ...getStore() };
      setData(next);

      if (next.focusTargets.length === 0) {
        setAiInsights([]);
        setAiError(false);
        return;
      }

      setAiLoading(true);
      setAiError(false);
      try {
        const insights = await fetchAiInsights(
          next.focusTargets,
          next.weeklyUsageMap,
        );
        setAiInsights(insights);
      } catch {
        setAiError(true);
      } finally {
        setAiLoading(false);
      }
    } catch {
      // Native permission/state changes should not break the Reflect screen.
    }
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

        <GrowthInsightCard
          insight={aiInsights[0]}
          loading={aiLoading}
          onPress={() => setShowInsightsModal(true)}
        />
        <TimeDistribution snapshot={data.snapshot} />
        <FocusTargets targets={data.focusTargets} />
        <View style={styles.bottomSpacer} />
      </ScrollView>
      <InsightsModal
        visible={showInsightsModal}
        insights={aiInsights}
        targets={data.focusTargets}
        weeklyFocusData={data.weeklyFocusData}
        onClose={() => setShowInsightsModal(false)}
      />
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
  growthInsightCard: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    marginBottom: Spacing.xxl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  growthInsightAccent: {
    width: 4,
    backgroundColor: Colors.success,
  },
  growthInsightContent: {
    flex: 1,
    padding: Spacing.lg,
  },
  growthInsightHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  growthInsightLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  growthInsightLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.success,
    letterSpacing: 1.5,
  },
  growthInsightText: {
    ...Typography.body,
    color: Colors.text,
    lineHeight: 24,
  },
  growthInsightAction: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.primary,
    marginTop: Spacing.lg,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  insightsModal: {
    flex: 1,
    marginTop: 44,
    backgroundColor: Colors.background,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  modalTitle: {
    ...Typography.heading,
    color: Colors.text,
  },
  modalContent: {
    padding: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  featuredCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.xxl,
  },
  featuredTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  featuredLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.3,
    color: Colors.success,
  },
  featuredTitle: {
    ...Typography.heading,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  featuredBody: {
    ...Typography.body,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  featuredRecommendation: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.success,
    marginTop: Spacing.lg,
  },
  modalSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  modalSectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: Colors.textSecondary,
  },
  modalSectionMeta: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  volumeCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.xxl,
  },
  volumeValue: {
    fontSize: 30,
    fontWeight: "700",
    color: Colors.primary,
  },
  volumeCaption: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  volumeBars: {
    height: 66,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  volumeBarTrack: {
    flex: 1,
    height: 58,
    justifyContent: "flex-end",
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.sm,
    overflow: "hidden",
  },
  volumeBar: {
    width: "100%",
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm,
  },
  patternCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  patternRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  patternIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
    overflow: "hidden",
  },
  patternAppIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
  },
  patternMeta: {
    flex: 1,
  },
  patternName: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
  },
  patternUsage: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  patternLevel: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primary,
  },
  emptyModalText: {
    ...Typography.body,
    color: Colors.textMuted,
    lineHeight: 21,
    paddingVertical: Spacing.sm,
  },
  pathCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 3,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  pathContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  pathTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  pathBody: {
    ...Typography.body,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  insightCard: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
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
  aiInsightsSection: {
    marginBottom: Spacing.xxl,
  },
  insightLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  insightLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.success,
    letterSpacing: 1.5,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  insightText: {
    ...Typography.body,
    color: Colors.text,
    lineHeight: 21,
  },
  recommendationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  recommendationText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
    lineHeight: 18,
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
