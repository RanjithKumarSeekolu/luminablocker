import {
  addBlockedAppListener,
  applyFocusReset,
  canDrawOverlays,
  getBlockedApps,
  getCurrentLevel,
  getCurrentScore,
  getInstalledApps,
  isAccessibilityEnabled,
  openAccessibilitySettings,
  openOverlaySettings,
  saveBlockedApps,
  type InstalledApp,
} from "@/modules/lumina-blocker";
import { useFocusEffect } from "expo-router";
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

// ── Level display helpers ──────────────────────────────────────

const LEVEL_COLORS = ["#4a9a6a", "#6a9a3a", "#9a8a2a", "#9a5a2a"] as const;
const LEVEL_LABELS = ["GENTLE", "MODERATE", "FOCUSED", "DEEP PAUSE"] as const;

// Must mirror LuminaConfig.Levels thresholds exactly
const LEVEL_THRESHOLDS = [1, 5, 8, 11] as const;
const LEVEL_COUNTDOWN = ["instant", "5s", "10s", "15s"] as const;

function levelColor(level: number) {
  return LEVEL_COLORS[Math.max(0, Math.min(level - 1, 3))] ?? "#5a7a68";
}

function levelLabel(level: number) {
  return level > 0 ? LEVEL_LABELS[level - 1] : null;
}

/**
 * Returns info about the next level threshold.
 * Used to show "X points to next level" in the score strip.
 */
function nextLevelInfo(
  score: number,
  currentLevel: number,
): {
  pointsNeeded: number;
  nextLevel: number;
  nextCountdown: string;
} | null {
  // Already at max level
  if (currentLevel >= 4) return null;
  const nextThreshold = LEVEL_THRESHOLDS[currentLevel]; // e.g. if level=1, next is index 1 = 5
  return {
    pointsNeeded: nextThreshold - score,
    nextLevel: currentLevel + 1,
    nextCountdown: LEVEL_COUNTDOWN[currentLevel],
  };
}

// ── ScoreStrip component ──────────────────────────────────────

type ScoreStripProps = {
  score: number;
  level: number;
  onFocusReset: () => void;
};

function ScoreStrip({ score, level, onFocusReset }: ScoreStripProps) {
  const next = nextLevelInfo(score, level);
  const color = levelColor(level);
  const label = levelLabel(level);

  // Progress toward next level — 0.0 to 1.0
  const prevThreshold = level > 0 ? LEVEL_THRESHOLDS[level - 1] : 0;
  const nextThreshold = next ? LEVEL_THRESHOLDS[level] : LEVEL_THRESHOLDS[3];
  const progress =
    level === 0
      ? 0
      : Math.min((score - prevThreshold) / (nextThreshold - prevThreshold), 1);

  return (
    <View style={styles.scoreStrip}>
      {/* Top row: label + focus reset button */}
      <View style={styles.scoreStripHeader}>
        <Text style={styles.scoreLabel}>Intensity score</Text>
        {score > 0 && (
          <TouchableOpacity style={styles.focusResetBtn} onPress={onFocusReset}>
            <Text style={styles.focusResetText}>I'll focus now −4</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Score + level badge row */}
      <View style={styles.scoreRow}>
        <Text style={[styles.scoreValue, { color }]}>{score}</Text>
        {label ? (
          <View style={[styles.levelPill, { borderColor: color }]}>
            <Text style={[styles.levelPillText, { color }]}>
              {level > 0 ? `LVL ${level}` : ""} · {label}
            </Text>
          </View>
        ) : (
          <View style={[styles.levelPill, { borderColor: "#2a4a38" }]}>
            <Text style={[styles.levelPillText, { color: "#5a7a68" }]}>
              No overlay yet
            </Text>
          </View>
        )}
      </View>

      {/* Progress bar toward next level */}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${Math.round(progress * 100)}%` as any,
              backgroundColor: color,
            },
          ]}
        />
      </View>

      {/* Threshold info below bar */}
      {next ? (
        <Text style={styles.thresholdText}>
          {next.pointsNeeded} point{next.pointsNeeded !== 1 ? "s" : ""} to Level{" "}
          {next.nextLevel} · {next.nextCountdown} countdown
        </Text>
      ) : (
        <Text style={styles.thresholdText}>
          Level 4 · Maximum intensity (15s countdown)
        </Text>
      )}
    </View>
  );
}

// ── Component ─────────────────────────────────────────────────

export default function AppPickerScreen() {
  const [allApps, setAllApps] = useState<InstalledApp[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [accessibilityOn, setAccessibilityOn] = useState(false);
  const [overlayPermission, setOverlayPermission] = useState(false);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(0);
  const [savedFeedback, setSavedFeedback] = useState(false);

  const feedbackOpacity = useRef(new Animated.Value(0)).current;

  // ── Load apps once ───────────────────────────────────────────
  useEffect(() => {
    // Full installed app list — no hardcoded filter
    const installed = getInstalledApps();
    setAllApps(installed);

    // Restore previously saved selection
    const saved = getBlockedApps();
    setSelected(new Set(saved));
  }, []);

  // ── Re-check permissions + refresh score on every screen focus ─
  useFocusEffect(
    useCallback(() => {
      setAccessibilityOn(isAccessibilityEnabled());
      setOverlayPermission(canDrawOverlays());
      setScore(getCurrentScore());
      setLevel(getCurrentLevel());
    }, []),
  );

  // ── Re-check permissions when app comes back to foreground ────
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        setAccessibilityOn(isAccessibilityEnabled());
        setOverlayPermission(canDrawOverlays());
        setScore(getCurrentScore());
        setLevel(getCurrentLevel());
      }
    });
    return () => sub.remove();
  }, []);

  // ── Live score updates from the accessibility service ─────────
  // When the service detects a blocked app, it emits onBlockedAppDetected.
  // We listen here so score/level display stays current without screen refresh.
  useEffect(() => {
    const sub = addBlockedAppListener((event) => {
      setScore(event.score);
      setLevel(event.level);
    });
    return () => sub.remove();
  }, []);

  // ── Search / filter ───────────────────────────────────────────
  const filteredApps =
    query.trim().length === 0
      ? allApps
      : allApps.filter(
          (a) =>
            a.label.toLowerCase().includes(query.toLowerCase()) ||
            a.packageName.toLowerCase().includes(query.toLowerCase()),
        );

  // ── Toggle selection ──────────────────────────────────────────
  const toggle = (pkg: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(pkg) ? next.delete(pkg) : next.add(pkg);
      return next;
    });
  };

  // ── Save ──────────────────────────────────────────────────────
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

  // Both permissions required for the overlay to work
  const allPermissionsGranted = accessibilityOn && overlayPermission;

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
    ]).start(() => setSavedFeedback(false));
  };

  // ── Focus reset shortcut ──────────────────────────────────────
  const handleFocusReset = () => {
    const newScore = applyFocusReset();
    setScore(newScore);
    setLevel(getCurrentLevel());
  };

  // ── Render ────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header */}
      <Text style={styles.title}>Choose apps to pause</Text>
      <Text style={styles.subtitle}>
        A breathing exercise will appear before these open
      </Text>

      {/* Score strip — always visible so user understands the system */}
      <ScoreStrip score={score} level={level} onFocusReset={handleFocusReset} />

      {/* Accessibility banner */}
      {!accessibilityOn && (
        <TouchableOpacity
          style={styles.banner}
          onPress={openAccessibilitySettings}
        >
          <Text style={styles.bannerText}>
            ⚠️ Tap to enable Accessibility Service
          </Text>
          <Text style={styles.bannerSub}>
            Required to detect when blocked apps open
          </Text>
        </TouchableOpacity>
      )}

      {/* Overlay permission banner */}
      {accessibilityOn && !overlayPermission && (
        <TouchableOpacity
          style={styles.bannerOverlay}
          onPress={openOverlaySettings}
        >
          <Text style={styles.bannerText}>
            ⚠️ Tap to enable "Display over other apps"
          </Text>
          <Text style={styles.bannerSub}>
            Required to show the breath overlay on top of blocked apps
          </Text>
        </TouchableOpacity>
      )}

      {/* Search bar */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search apps…"
          placeholderTextColor="#3a5a48"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
        {selected.size > 0 && (
          <Text style={styles.selectedCount}>{selected.size} selected</Text>
        )}
      </View>

      {/* App list */}
      <FlatList
        data={filteredApps}
        keyExtractor={(item, index) => `${item.packageName}-${index}`}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {query.length > 0 ? `No apps match "${query}"` : "No apps found"}
            </Text>
          </View>
        }
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

      {/* Saved feedback toast */}
      {savedFeedback && (
        <Animated.View style={[styles.toast, { opacity: feedbackOpacity }]}>
          <Text style={styles.toastText}>
            ✓ {selected.size} app{selected.size !== 1 ? "s" : ""} saved
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
            ? "⚠️  Enable Accessibility First"
            : !overlayPermission
              ? "⚠️  Enable Overlay Permission"
              : `Save  (${selected.size} app${selected.size !== 1 ? "s" : ""})`}
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

  // Header
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
    marginBottom: 20,
  },

  // Score strip
  scoreStrip: {
    backgroundColor: "#1c2b24",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 14,
    gap: 8,
  },
  scoreStripHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  scoreLabel: {
    fontSize: 11,
    color: "#5a7a68",
    fontFamily: "DMSans_400Regular",
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  scoreValue: {
    fontSize: 28,
    fontFamily: "DMSerifDisplay_400Regular",
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
  progressTrack: {
    height: 4,
    backgroundColor: "#0e1412",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  thresholdText: {
    fontSize: 11,
    color: "#5a7a68",
    fontFamily: "DMSans_400Regular",
  },
  focusResetBtn: {
    backgroundColor: "#0e1412",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#2a4a38",
  },
  focusResetText: {
    fontSize: 11,
    color: "#4a9a6a",
    fontFamily: "DMSans_600SemiBold",
  },

  // Accessibility banner
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

  // List
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
  rowText: { flex: 1, marginRight: 12 },
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

  // Empty state
  emptyState: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#3a5a48",
    fontFamily: "DMSans_400Regular",
  },

  // Toast feedback
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

  // Save button
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
});
