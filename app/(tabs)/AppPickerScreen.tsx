import DailyStatsCard, { DailySnapshot } from "@/components/DailyStatsCard";

import {
  addBlockedAppListener,
  canDrawOverlays,
  clearAppData,
  getAllAppScores,
  getBlockedApps,
  getDailySnapshots,
  getHistoricalDailyUsage,
  getInstalledApps,
  getWeeklyUsageForApp,
  hasUsagePermission,
  isAccessibilityEnabled,
  openAccessibilitySettings,
  openOverlaySettings,
  openUsageAccessSettings,
  saveBlockedApps,
  type InstalledApp,
} from "@/modules/lumina-blocker";

import { router, useFocusEffect } from "expo-router";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  Animated,
  AppState,
  AppStateStatus,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const LEVEL_COLORS = ["#4a9a6a", "#6a9a3a", "#9a8a2a", "#9a5a2a"] as const;

const LEVEL_LABELS = ["GENTLE", "MODERATE", "FOCUSED", "DEEP PAUSE"] as const;

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function levelColor(level: number) {
  return LEVEL_COLORS[Math.max(0, Math.min(level - 1, 3))] ?? "#5a7a68";
}

function levelLabel(level: number) {
  return level > 0 ? LEVEL_LABELS[level - 1] : null;
}

function formatUsage(ms?: number) {
  if (!ms || Number.isNaN(ms)) {
    return "0s";
  }

  const totalSeconds = Math.floor(ms / 1000);

  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const hours = Math.floor(totalSeconds / 3600);

  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m ${seconds}s`;
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type AppScore = {
  packageName: string;

  appName: string;

  score: number;

  level: number;

  usageMs: number;

  usageBreakdown: {
    morning: number;

    afternoon: number;

    evening: number;

    night: number;
  };
};

type WeeklyUsageDay = {
  day: string;

  usageMs: number;
};

// ─────────────────────────────────────────────────────────────
// App Intensities
// ─────────────────────────────────────────────────────────────

function AppScoresSection({ appScores }: { appScores: AppScore[] }) {
  return (
    <View style={styles.scoreSection}>
      <View style={styles.scoreHeaderRow}>
        <Text style={styles.scoreSectionTitle}>App Intensities</Text>

        <TouchableOpacity
          style={styles.historyBtn}
          onPress={() => router.push("/history")}
        >
          <Text style={styles.historyBtnText}>History</Text>
        </TouchableOpacity>
      </View>

      {appScores.length === 0 ? (
        <Text style={styles.emptyScores}>No active intensity yet</Text>
      ) : (
        appScores.map((app) => {
          const color = levelColor(app.level);

          const label = levelLabel(app.level);

          return (
            <View key={app.packageName} style={styles.appScoreCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.appScoreName}>{app.appName}</Text>

                <View style={styles.metaBlock}>
                  <Text style={styles.appScoreMeta}>
                    Score {app.score}
                    {" · "}
                    {formatUsage(app.usageMs)}
                  </Text>

                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownText}>
                      🌅 {formatUsage(app.usageBreakdown.morning)}
                    </Text>

                    <Text style={styles.breakdownText}>
                      ☀️ {formatUsage(app.usageBreakdown.afternoon)}
                    </Text>

                    <Text style={styles.breakdownText}>
                      🌆 {formatUsage(app.usageBreakdown.evening)}
                    </Text>

                    <Text style={styles.breakdownText}>
                      🌙 {formatUsage(app.usageBreakdown.night)}
                    </Text>
                  </View>
                </View>
              </View>

              <View
                style={[
                  styles.levelPill,
                  {
                    borderColor: app.level > 0 ? color : "#2a4a38",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.levelPillText,
                    {
                      color: app.level > 0 ? color : "#5a7a68",
                    },
                  ]}
                >
                  {app.level > 0 ? `LVL ${app.level} · ${label}` : "No overlay"}
                </Text>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────

export default function AppPickerScreen() {
  const [allApps, setAllApps] = useState<InstalledApp[]>([]);

  const [query, setQuery] = useState("");

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [accessibilityOn, setAccessibilityOn] = useState(false);

  const [overlayPermission, setOverlayPermission] = useState(false);

  const [usagePermission, setUsagePermission] = useState(false);

  const [appScores, setAppScores] = useState<AppScore[]>([]);

  const [snapshots, setSnapshots] = useState<DailySnapshot[]>([]);

  const [dailyHistory, setDailyHistory] = useState<DailySnapshot[]>([]);

  const [weeklyUsageMap, setWeeklyUsageMap] = useState<
    Record<string, WeeklyUsageDay[]>
  >({});

  const [savedFeedback, setSavedFeedback] = useState(false);

  const feedbackOpacity = useRef(new Animated.Value(0)).current;

  // ───────────────────────────────────────────────────────────
  // Weekly usage loader
  // ───────────────────────────────────────────────────────────

  const loadWeeklyUsage = async (packageNames: string[]) => {
    if (packageNames.length === 0) {
      return;
    }
    const result: Record<string, WeeklyUsageDay[]> = {};

    for (const packageName of packageNames) {
      try {
        const weekly = await getWeeklyUsageForApp(packageName);

        result[packageName] = weekly;
      } catch (e) {
        console.log("weekly usage error", e);
      }
    }

    setWeeklyUsageMap(result);
  };

  const loadDailyHistory = useCallback(() => {
    if (selected.size === 0) return;
    const history = getHistoricalDailyUsage([...selected], 7);
    setDailyHistory(history);
  }, [selected]);

  useEffect(() => {
    if (selected.size > 0) {
      loadWeeklyUsage([...selected]);
    }
  }, [selected]);

  // ───────────────────────────────────────────────────────────
  // Initial load
  // ───────────────────────────────────────────────────────────

  useEffect(() => {
    setAllApps(getInstalledApps());

    setSelected(new Set(getBlockedApps()));

    setSnapshots(getDailySnapshots());
  }, []);

  // ───────────────────────────────────────────────────────────
  // Refresh on focus
  // ───────────────────────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      setAccessibilityOn(isAccessibilityEnabled());

      setOverlayPermission(canDrawOverlays());

      setUsagePermission(hasUsagePermission());

      const scores = getAllAppScores();

      setAppScores(scores);
      setSnapshots(getDailySnapshots());
      loadWeeklyUsage([...selected]);
      loadDailyHistory();
    }, []),
  );

  // ───────────────────────────────────────────────────────────
  // Refresh on foreground
  // ───────────────────────────────────────────────────────────

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        setAccessibilityOn(isAccessibilityEnabled());

        setOverlayPermission(canDrawOverlays());

        setUsagePermission(hasUsagePermission());

        const scores = getAllAppScores();

        setAppScores(scores);
        setSnapshots(getDailySnapshots());
        loadWeeklyUsage([...selected]);
        loadDailyHistory();
      }
    });

    return () => sub.remove();
  }, []);

  // ───────────────────────────────────────────────────────────
  // Live updates
  // ───────────────────────────────────────────────────────────

  useEffect(() => {
    const sub = addBlockedAppListener(() => {
      const scores = getAllAppScores();

      setAppScores(scores);
      setSnapshots(getDailySnapshots());

      loadWeeklyUsage([...selected]);
      loadDailyHistory();
    });

    return () => sub.remove();
  }, []);

  // ───────────────────────────────────────────────────────────
  // Search
  // ───────────────────────────────────────────────────────────

  const filteredApps =
    query.trim().length === 0
      ? allApps
      : allApps.filter(
          (a) =>
            a.label.toLowerCase().includes(query.toLowerCase()) ||
            a.packageName.toLowerCase().includes(query.toLowerCase()),
        );

  // ───────────────────────────────────────────────────────────
  // Toggle
  // ───────────────────────────────────────────────────────────

  const toggle = (pkg: string) => {
    setSelected((prev) => {
      const next = new Set(prev);

      next.has(pkg) ? next.delete(pkg) : next.add(pkg);

      return next;
    });
  };

  // ───────────────────────────────────────────────────────────
  // Save
  // ───────────────────────────────────────────────────────────

  const save = () => {
    if (!accessibilityOn) {
      openAccessibilitySettings();
      return;
    }

    if (!overlayPermission) {
      openOverlaySettings();
      return;
    }

    if (!usagePermission) {
      openUsageAccessSettings();
      return;
    }

    const previous = getBlockedApps();

    const removed = previous.filter((pkg) => !selected.has(pkg));

    removed.forEach((pkg) => {
      clearAppData(pkg);
    });

    saveBlockedApps([...selected]);

    showSavedFeedback();
  };

  const allPermissionsGranted =
    accessibilityOn && overlayPermission && usagePermission;

  // ───────────────────────────────────────────────────────────
  // Toast
  // ───────────────────────────────────────────────────────────

  const showSavedFeedback = () => {
    setSavedFeedback(true);

    Animated.sequence([
      Animated.timing(feedbackOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),

      Animated.delay(1500),

      Animated.timing(feedbackOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setSavedFeedback(false);
    });
  };

  // ───────────────────────────────────────────────────────────
  // Merge daily snapshots
  // ───────────────────────────────────────────────────────────

  console.log("raw snapshots", snapshots);
  const liveDailySnapshot: DailySnapshot = {
    date: new Date().toLocaleDateString("en-CA"),
    totalUsageMs: appScores.reduce((sum, a) => sum + (a.usageMs ?? 0), 0),
    morningUsageMs: appScores.reduce(
      (sum, a) => sum + (a.usageBreakdown?.morning ?? 0),
      0,
    ),
    afternoonUsageMs: appScores.reduce(
      (sum, a) => sum + (a.usageBreakdown?.afternoon ?? 0),
      0,
    ),
    eveningUsageMs: appScores.reduce(
      (sum, a) => sum + (a.usageBreakdown?.evening ?? 0),
      0,
    ),
    nightUsageMs: appScores.reduce(
      (sum, a) => sum + (a.usageBreakdown?.night ?? 0),
      0,
    ),
    reopenEvents: 0,
    intentionalExits: 0,
    focusResets: 0,
    overlaysTriggered: 0,
  };

  // ───────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Choose apps to pause</Text>

      <Text style={styles.subtitle}>
        A breathing exercise will appear before these apps open
      </Text>
      <TouchableOpacity
        onPress={() => router.push("/FocusScreen")}
        activeOpacity={0.8}
        style={{
          backgroundColor: "#1a5c3a",
          paddingVertical: 14,
          paddingHorizontal: 20,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
          borderWidth: 1,
          borderColor: "#4caf7d",
        }}
      >
        <Text
          style={{
            color: "#e8f0eb",
            fontSize: 16,
            fontFamily: "DMSans_600SemiBold",
          }}
        >
          Start Focus Mode
        </Text>
      </TouchableOpacity>

      <AppScoresSection appScores={appScores} />

      {!accessibilityOn && (
        <TouchableOpacity
          style={styles.banner}
          onPress={openAccessibilitySettings}
        >
          <Text style={styles.bannerText}>
            Accessibility permission required
          </Text>

          <Text style={styles.bannerSub}>
            Tap to enable Lumina accessibility
          </Text>
        </TouchableOpacity>
      )}

      {!overlayPermission && (
        <TouchableOpacity
          style={styles.bannerOverlay}
          onPress={openOverlaySettings}
        >
          <Text style={styles.bannerText}>Overlay permission required</Text>

          <Text style={styles.bannerSub}>Tap to allow overlays</Text>
        </TouchableOpacity>
      )}

      {!usagePermission && (
        <TouchableOpacity
          style={styles.bannerUsage}
          onPress={openUsageAccessSettings}
        >
          <Text style={styles.bannerText}>Usage access required</Text>

          <Text style={styles.bannerSub}>Tap to grant usage access</Text>
        </TouchableOpacity>
      )}

      {/* Daily Balance */}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Daily Balance</Text>

        <DailyStatsCard snapshot={liveDailySnapshot} />
      </View>

      {/* Weekly Trends */}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Weekly Trends</Text>

        {appScores.length === 0 ? (
          <View style={styles.emptyWeeklyCard}>
            <Text style={styles.emptyWeeklyText}>
              Your weekly app rhythms will appear here
            </Text>
          </View>
        ) : (
          [...selected].map((packageName) => {
            const rawWeekly = weeklyUsageMap[packageName] || [];
            const todayIndex = new Date().getDay();

            const orderedDays = [
              ...WEEK_DAYS.slice(todayIndex + 1),
              ...WEEK_DAYS.slice(0, todayIndex + 1),
            ];

            const weekly = orderedDays.map((day) => {
              const existing = rawWeekly.find((d) => d.day === day);

              return (
                existing || {
                  day,
                  usageMs: 0,
                }
              );
            });

            const total = weekly.reduce((sum, day) => sum + day.usageMs, 0);

            return (
              <View key={packageName} style={styles.weeklyCard}>
                <View style={styles.weeklyHeader}>
                  <Text style={styles.weeklyAppName}>
                    {allApps.find((a) => a.packageName === packageName)
                      ?.label || packageName}
                  </Text>

                  <Text style={styles.weeklyUsage}>{formatUsage(total)}</Text>
                </View>

                <View style={styles.weekBars}>
                  {weekly.map((day, index) => {
                    const maxUsage = Math.max(
                      ...weekly.map((d) => d.usageMs),
                      1,
                    );

                    const height =
                      day.usageMs === 0
                        ? 8
                        : Math.max(
                            12,

                            (day.usageMs / maxUsage) * 72,
                          );

                    return (
                      <View key={index} style={styles.barContainer}>
                        <Text style={styles.barUsage}>
                          {day.usageMs > 0 ? formatUsage(day.usageMs) : ""}
                        </Text>
                        <View
                          style={[
                            styles.weekBar,
                            {
                              height,
                            },
                          ]}
                        />

                        <Text style={styles.barLabel}>{day.day}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* App Picker */}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tracked Apps</Text>

        {filteredApps.map((app, index) => {
          const checked = selected.has(app.packageName);

          return (
            <TouchableOpacity
              key={`${app.packageName}-${index}`}
              style={[styles.row, checked && styles.rowSelected]}
              onPress={() => toggle(app.packageName)}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{app.label}</Text>

                <Text style={styles.rowPkg}>{app.packageName}</Text>
              </View>

              <View
                style={[styles.checkbox, checked && styles.checkboxSelected]}
              >
                {checked && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[
          styles.saveBtn,

          !allPermissionsGranted && styles.saveBtnDisabled,
        ]}
        onPress={save}
      >
        <Text style={styles.saveBtnText}>Save Tracked Apps</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0e1412",
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  title: {
    fontSize: 24,
    color: "#e8f0eb",
    fontFamily: "DMSerifDisplay_400Regular",
    marginBottom: 6,
  },

  subtitle: {
    fontSize: 14,
    color: "#5a7a68",
    fontFamily: "DMSans_400Regular",
    marginBottom: 18,
  },

  scoreSection: {
    backgroundColor: "#1c2b24",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },

  scoreHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  scoreSectionTitle: {
    fontSize: 18,
    color: "#e8f0eb",
    fontFamily: "DMSerifDisplay_400Regular",
  },

  emptyScores: {
    color: "#5a7a68",
    fontSize: 13,
    fontFamily: "DMSans_400Regular",
  },

  appScoreCard: {
    backgroundColor: "#16211c",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  appScoreName: {
    color: "#e8f0eb",
    fontSize: 15,
    fontFamily: "DMSans_600SemiBold",
  },

  appScoreMeta: {
    color: "#5a7a68",
    fontSize: 12,
    marginTop: 4,
    fontFamily: "DMSans_400Regular",
  },

  metaBlock: {
    marginTop: 4,
  },

  breakdownRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },

  breakdownText: {
    color: "#5a7a68",
    fontSize: 11,
    fontFamily: "DMSans_400Regular",
  },

  levelPill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },

  levelPillText: {
    fontSize: 11,
    fontFamily: "DMSans_600SemiBold",
    letterSpacing: 0.5,
  },

  section: {
    marginBottom: 16,
  },

  sectionTitle: {
    fontSize: 18,
    color: "#e8f0eb",
    fontFamily: "DMSerifDisplay_400Regular",
    marginBottom: 12,
  },

  banner: {
    backgroundColor: "#2a1a00",
    padding: 14,
    borderRadius: 12,
    marginBottom: 14,
  },

  bannerOverlay: {
    backgroundColor: "#1a002a",
    padding: 14,
    borderRadius: 12,
    marginBottom: 14,
  },

  bannerUsage: {
    backgroundColor: "#00221a",
    padding: 14,
    borderRadius: 12,
    marginBottom: 14,
  },

  bannerText: {
    color: "#ffaa44",
    fontSize: 13,
    fontFamily: "DMSans_600SemiBold",
    textAlign: "center",
  },

  bannerSub: {
    color: "#aa7722",
    fontSize: 11,
    fontFamily: "DMSans_400Regular",
    textAlign: "center",
    marginTop: 4,
  },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 10,
  },

  searchInput: {
    flex: 1,
    backgroundColor: "#1c2b24",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#e8f0eb",
    fontSize: 14,
    fontFamily: "DMSans_400Regular",
  },

  selectedCount: {
    fontSize: 12,
    color: "#4a9a6a",
    fontFamily: "DMSans_600SemiBold",
  },

  listContent: {
    paddingBottom: 16,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#1c2b24",
    marginBottom: 8,
  },

  rowSelected: {
    backgroundColor: "#1a3a28",
    borderWidth: 1,
    borderColor: "#4caf7d",
  },

  rowText: {
    flex: 1,
    marginRight: 12,
  },

  rowLabel: {
    fontSize: 15,
    color: "#e8f0eb",
    fontFamily: "DMSans_600SemiBold",
  },

  rowPkg: {
    fontSize: 11,
    color: "#5a7a68",
    fontFamily: "DMSans_400Regular",
    marginTop: 2,
  },

  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#2a4a38",
    justifyContent: "center",
    alignItems: "center",
  },

  checkboxSelected: {
    backgroundColor: "#4caf7d",
    borderColor: "#4caf7d",
  },

  checkmark: {
    fontSize: 13,
    color: "#0e1412",
    fontFamily: "DMSans_600SemiBold",
  },

  toast: {
    position: "absolute",
    bottom: 100,
    alignSelf: "center",
    backgroundColor: "#1a5c3a",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },

  toastText: {
    color: "#e8f0eb",
    fontSize: 13,
    fontFamily: "DMSans_600SemiBold",
  },

  saveBtn: {
    backgroundColor: "#1a5c3a",
    padding: 16,
    borderRadius: 24,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 20,
  },

  saveBtnDisabled: {
    backgroundColor: "#2a1a00",
  },

  saveBtnText: {
    color: "#e8f0eb",
    fontSize: 15,
    fontFamily: "DMSans_600SemiBold",
  },

  historyBtn: {
    backgroundColor: "#0e1412",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#2a4a38",
  },

  historyBtnText: {
    fontSize: 11,
    color: "#7ab89a",
    fontFamily: "DMSans_600SemiBold",
  },

  weeklyCard: {
    backgroundColor: "#17201c",
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
  },

  weeklyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  weeklyAppName: {
    color: "#e8f0eb",
    fontSize: 15,
    fontFamily: "DMSans_600SemiBold",
  },

  weeklyUsage: {
    color: "#7ab89a",
    fontSize: 13,
    fontFamily: "DMSans_600SemiBold",
  },

  weekBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 56,
  },

  barContainer: {
    alignItems: "center",
    flex: 1,
  },

  weekBar: {
    width: 16,
    borderRadius: 12,
    backgroundColor: "#2f7a57",
    marginBottom: 6,
  },

  barLabel: {
    color: "#5f7c6a",
    fontSize: 10,
    fontFamily: "DMSans_400Regular",
  },

  emptyWeeklyCard: {
    backgroundColor: "#17201c",
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
  },

  emptyWeeklyText: {
    color: "#5f7c6a",
    fontSize: 13,
    fontFamily: "DMSans_400Regular",
  },

  scrollContent: {
    paddingBottom: 140,
  },

  barUsage: {
    color: "#7ab89a",
    fontSize: 9,
    marginBottom: 4,
    fontFamily: "DMSans_500Medium",
  },
});
