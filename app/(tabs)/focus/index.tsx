// app/(tabs)/focus.tsx
import { Colors, Layout, Radius, Spacing, Typography } from "@/constants/theme";
import { formatRelativeDate, formatUsage } from "@/constants/utils";
import {
  getAllFocusSessions,
  isFocusModeActive,
  startFocusLock,
  type FocusSession,
} from "@/modules/lumina-blocker";
import { getStore, refreshLuminaStore, subscribe } from "@/store/luminaStore";
import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  AppState,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const PRESETS = [25, 45, 60, 90];
const DAILY_FOCUS_GOAL_MS = 4 * 60 * 60 * 1000;

function getTodaySessions(): FocusSession[] {
  const today = new Date();
  return getAllFocusSessions()
    .filter((s) => {
      const d = new Date(s.timestamp);
      return (
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate()
      );
    })
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 3);
}

export default function FocusScreen() {
  const [duration, setDuration] = useState(45);
  const [recentSessions, setRecentSessions] = useState<FocusSession[]>([]);
  // Read todayFocusMs from store — already loaded at startup
  const [todayFocusMs, setTodayFocusMs] = useState(getStore().todayFocusMs);
  const [focusActive, setFocusActive] = useState(isFocusModeActive());

  const loadData = useCallback(() => {
    setRecentSessions(getTodaySessions());
  }, []);

  const refreshData = useCallback(async () => {
    loadData();
    try {
      await refreshLuminaStore();
    } finally {
      setTodayFocusMs(getStore().todayFocusMs);
      setFocusActive(isFocusModeActive());
    }
  }, [loadData]);

  // Keep todayFocusMs in sync when store updates
  useEffect(() => {
    return subscribe(() => setTodayFocusMs(getStore().todayFocusMs));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshData();
    }, [refreshData]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refreshData();
      }
    });
    return () => sub.remove();
  }, [refreshData]);

  const progressPercentage = Math.min(
    100,
    (todayFocusMs / DAILY_FOCUS_GOAL_MS) * 100,
  );

  const getSessionColor = (completed: boolean) =>
    completed ? Colors.primary : Colors.textMuted;

  const handleStart = () => {
    if (focusActive || isFocusModeActive()) return;
    setFocusActive(true);
    startFocusLock(duration * 60 * 1000);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Ready to focus?</Text>
      <Text style={styles.subtitle}>
        Small steps. Deep focus. Big progress.
      </Text>

      {/* Today Focus */}
      <View style={styles.focusCard}>
        <View style={styles.focusHeader}>
          <Text style={styles.focusLabel}>TODAY'S FOCUS</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {progressPercentage.toFixed(2)}%
            </Text>
          </View>
        </View>
        <View style={styles.focusRow}>
          <Text style={styles.focusTime}>{formatUsage(todayFocusMs)}</Text>
          <Text style={styles.focusGoal}>
            of {formatUsage(DAILY_FOCUS_GOAL_MS)} daily goal
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(progressPercentage, 100)}%` },
            ]}
          />
        </View>
      </View>

      {/* Session Setup */}
      <Text style={styles.sectionTitle}>SESSION SETUP</Text>
      <View style={styles.sessionCard}>
        <View style={styles.durationRow}>
          <TouchableOpacity
            style={styles.circleButton}
            onPress={() => setDuration((prev) => Math.max(5, prev - 5))}
          >
            <Feather name="minus" size={24} color={Colors.text} />
          </TouchableOpacity>
          <View style={styles.durationCenter}>
            <Text style={styles.durationValue}>{duration}</Text>
            <Text style={styles.durationUnit}>min</Text>
          </View>
          <TouchableOpacity
            style={styles.circleButton}
            onPress={() => setDuration((prev) => prev + 5)}
          >
            <Feather name="plus" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presetsContainer}
        >
          {PRESETS.map((item) => {
            const selected = item === duration;
            return (
              <TouchableOpacity
                key={item}
                onPress={() => setDuration(item)}
                style={[styles.presetChip, selected && styles.presetChipActive]}
              >
                <Text
                  style={[
                    styles.presetText,
                    selected && styles.presetTextActive,
                  ]}
                >
                  {item} min
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity
          style={[styles.startButton, focusActive && styles.startButtonDisabled]}
          onPress={handleStart}
          disabled={focusActive}
        >
          <Text style={styles.startButtonText}>
            {focusActive ? "Session Active" : "Start Session"}
          </Text>
          <Feather name="arrow-right" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Recent Sessions */}
      <View style={styles.recentHeader}>
        <Text style={styles.sectionTitle}>RECENT SESSIONS</Text>
        <TouchableOpacity onPress={() => router.push("/focus/focus-history")}>
          <Text style={styles.viewAll}>View all</Text>
        </TouchableOpacity>
      </View>

      {recentSessions.length === 0 ? (
        <View style={styles.recentCard}>
          <Text style={styles.sessionMeta}>No focus sessions today</Text>
        </View>
      ) : (
        recentSessions.map((session, index) => (
          <View
            key={`${session.timestamp}-${index}`}
            style={[styles.recentCard, index > 0 && { marginTop: 10 }]}
          >
            <View style={styles.sessionIcon}>
              <View
                style={[
                  styles.sessionDot,
                  { backgroundColor: getSessionColor(session.completed) },
                ]}
              />
            </View>
            <View style={styles.sessionInfo}>
              <Text style={styles.sessionTitle}>
                {formatUsage(session.durationMs)}
              </Text>
              <Text style={styles.sessionMeta}>
                {formatRelativeDate(session.timestamp)}
              </Text>
            </View>
            <View style={styles.completedWrap}>
              <Text
                style={[
                  styles.completedText,
                  { color: getSessionColor(session.completed) },
                ]}
              >
                {session.completed ? "Done" : "Early"}
              </Text>
              <Feather
                name={session.completed ? "check-circle" : "x-circle"}
                size={18}
                color={getSessionColor(session.completed)}
              />
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Layout.screenPadding,
    paddingBottom: Spacing.xxl,
  },
  title: {
    ...Typography.title,
    color: Colors.text,
    lineHeight: 44,
    letterSpacing: -0.5,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textMuted,
    marginTop: 2,
    marginBottom: Spacing.xxl,
  },
  focusCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Layout.cardPadding,
    marginBottom: Spacing.xxl,
  },
  focusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  focusLabel: {
    color: Colors.primary,
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 1.5,
  },
  badge: {
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
  },
  badgeText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  focusRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: Spacing.sm,
  },
  focusTime: {
    color: Colors.text,
    fontSize: 30,
    fontWeight: "800",
  },
  focusGoal: {
    color: Colors.textMuted,
    fontSize: 14,
    marginLeft: 10,
    marginBottom: 6,
  },
  progressTrack: {
    height: 8,
    borderRadius: Radius.pill,
    backgroundColor: Colors.border,
    overflow: "hidden",
    marginTop: Spacing.md,
  },
  progressFill: {
    height: "100%",
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
  },
  sectionTitle: {
    ...Typography.sectionTitle,
    color: Colors.textMuted,
    marginBottom: Spacing.sm + 2,
  },
  sessionCard: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Layout.cardPadding,
    marginBottom: Spacing.xxl,
  },
  durationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  circleButton: {
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    backgroundColor: "#26262A",
    justifyContent: "center",
    alignItems: "center",
  },
  durationCenter: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  durationValue: {
    ...Typography.durationValue,
    color: Colors.text,
    fontSize: 58,
    lineHeight: 72,
  },
  durationUnit: {
    color: Colors.textSecondary,
    fontSize: 24,
    marginBottom: 16,
    marginLeft: 6,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 10,
  },
  presetsContainer: {
    paddingBottom: Spacing.xs,
  },
  presetChip: {
    height: 45,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
    backgroundColor: Colors.background,
  },
  presetChipActive: {
    backgroundColor: Colors.surfaceSecondary,
    borderColor: Colors.primary,
    borderWidth: 1,
  },
  presetText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  presetTextActive: {
    color: Colors.text,
  },
  startButton: {
    height: 56,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    marginTop: Spacing.xl,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  startButtonDisabled: {
    opacity: 0.55,
  },
  startButtonText: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: "700",
    marginRight: Spacing.sm + 2,
  },
  recentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  viewAll: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: "600",
  },
  recentCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
  },
  sessionIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  sessionDot: {
    width: 12,
    height: 12,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
  },
  sessionInfo: {
    flex: 1,
    marginLeft: Spacing.lg,
  },
  sessionTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  sessionMeta: {
    color: Colors.textMuted,
    marginTop: Spacing.xs,
    fontSize: 14,
  },
  completedWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  completedText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: "600",
    marginRight: 6,
  },
});
