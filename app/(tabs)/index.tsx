import {
  addBlockedAppListener,
  canDrawOverlays,
  getAllAppScores,
  getBlockedApps,
  getInstalledApps,
  isAccessibilityEnabled,
  openAccessibilitySettings,
  openOverlaySettings,
  saveBlockedApps,
  type InstalledApp,
} from "@/modules/lumina-blocker";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  AppState,
  AppStateStatus,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// ── Level helpers ──────────────────────────────────────────────

const LEVEL_COLORS = ["#4a9a6a", "#6a9a3a", "#9a8a2a", "#9a5a2a"] as const;

const LEVEL_LABELS = ["GENTLE", "MODERATE", "FOCUSED", "DEEP PAUSE"] as const;

function levelColor(level: number) {
  return LEVEL_COLORS[Math.max(0, Math.min(level - 1, 3))] ?? "#5a7a68";
}

function levelLabel(level: number) {
  return level > 0 ? LEVEL_LABELS[level - 1] : null;
}

function formatUsage(ms: number) {
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

// ── Types ─────────────────────────────────────────────────────

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

// ── Per-app intensity section ─────────────────────────────────

function AppScoresSection({ appScores }: { appScores: AppScore[] }) {
  console.log("appScores = ", appScores);
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

// ── Screen ────────────────────────────────────────────────────

export default function AppPickerScreen() {
  const [allApps, setAllApps] = useState<InstalledApp[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [accessibilityOn, setAccessibilityOn] = useState(false);

  const [overlayPermission, setOverlayPermission] = useState(false);

  const [appScores, setAppScores] = useState<AppScore[]>([]);

  const [savedFeedback, setSavedFeedback] = useState(false);

  const feedbackOpacity = useRef(new Animated.Value(0)).current;

  // ── Initial load ────────────────────────────────────────────

  useEffect(() => {
    const installed = getInstalledApps();

    setAllApps(installed);

    const saved = getBlockedApps();

    setSelected(new Set(saved));
  }, []);

  // ── Refresh on screen focus ─────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      setAccessibilityOn(isAccessibilityEnabled());

      setOverlayPermission(canDrawOverlays());

      setAppScores(getAllAppScores());
    }, []),
  );

  // ── Refresh on app foreground ───────────────────────────────

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        setAccessibilityOn(isAccessibilityEnabled());

        setOverlayPermission(canDrawOverlays());

        setAppScores(getAllAppScores());
      }
    });

    return () => sub.remove();
  }, []);

  // ── Live updates from service ───────────────────────────────

  useEffect(() => {
    const sub = addBlockedAppListener(() => {
      setAppScores(getAllAppScores());
    });

    return () => sub.remove();
  }, []);

  // ── Search filter ───────────────────────────────────────────

  const filteredApps =
    query.trim().length === 0
      ? allApps
      : allApps.filter(
          (a) =>
            a.label.toLowerCase().includes(query.toLowerCase()) ||
            a.packageName.toLowerCase().includes(query.toLowerCase()),
        );

  // ── Toggle selection ───────────────────────────────────────

  const toggle = (pkg: string) => {
    setSelected((prev) => {
      const next = new Set(prev);

      next.has(pkg) ? next.delete(pkg) : next.add(pkg);

      return next;
    });
  };

  // ── Save ───────────────────────────────────────────────────

  const save = () => {
    if (!accessibilityOn) {
      openAccessibilitySettings();
      return;
    }

    if (!overlayPermission) {
      openOverlaySettings();
      return;
    }

    saveBlockedApps([...selected]);

    showSavedFeedback();
  };

  const allPermissionsGranted = accessibilityOn && overlayPermission;

  // ── Save toast ──────────────────────────────────────────────

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

  // ── Render ──────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header */}

      <Text style={styles.title}>Choose apps to pause</Text>

      <Text style={styles.subtitle}>
        A breathing exercise will appear before these apps open
      </Text>

      {/* Per-app intensity */}

      <AppScoresSection appScores={appScores} />

      {/* Accessibility */}

      {!accessibilityOn && (
        <TouchableOpacity
          style={styles.banner}
          onPress={openAccessibilitySettings}
        >
          <Text style={styles.bannerText}>
            ⚠️ Tap to enable Accessibility Service
          </Text>

          <Text style={styles.bannerSub}>Required to detect blocked apps</Text>
        </TouchableOpacity>
      )}

      {/* Overlay permission */}

      {accessibilityOn && !overlayPermission && (
        <TouchableOpacity
          style={styles.bannerOverlay}
          onPress={openOverlaySettings}
        >
          <Text style={styles.bannerText}>⚠️ Enable overlay permission</Text>

          <Text style={styles.bannerSub}>
            Required to show the pause overlay
          </Text>
        </TouchableOpacity>
      )}

      {/* Search */}

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search apps…"
          placeholderTextColor="#3a5a48"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />

        {selected.size > 0 && (
          <Text style={styles.selectedCount}>{selected.size} selected</Text>
        )}
      </View>

      {/* App list */}

      <FlatList
        data={filteredApps}
        keyExtractor={(item, index) => `${item.packageName}-${index}`}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isSelected = selected.has(item.packageName);

          return (
            <TouchableOpacity
              style={[styles.row, isSelected && styles.rowSelected]}
              onPress={() => toggle(item.packageName)}
              activeOpacity={0.7}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowLabel} numberOfLines={1}>
                  {item.label}
                </Text>

                <Text style={styles.rowPkg} numberOfLines={1}>
                  {item.packageName}
                </Text>
              </View>

              <View
                style={[styles.checkbox, isSelected && styles.checkboxSelected]}
              >
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Save toast */}

      {savedFeedback && (
        <Animated.View
          style={[
            styles.toast,
            {
              opacity: feedbackOpacity,
            },
          ]}
        >
          <Text style={styles.toastText}>
            ✓ {selected.size} app
            {selected.size !== 1 ? "s" : ""} saved
          </Text>
        </Animated.View>
      )}

      {/* Save button */}

      <TouchableOpacity
        style={[
          styles.saveBtn,
          !allPermissionsGranted && styles.saveBtnDisabled,
        ]}
        onPress={save}
        activeOpacity={0.8}
      >
        <Text style={styles.saveBtnText}>
          {!accessibilityOn
            ? "⚠️ Enable Accessibility"
            : !overlayPermission
              ? "⚠️ Enable Overlay Permission"
              : `Save (${selected.size} app${selected.size !== 1 ? "s" : ""})`}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────

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

  // Scores

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

  // Banners

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

  // Search

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

  // App rows

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

  // Toast

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

  // Save

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

  // History

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
});
