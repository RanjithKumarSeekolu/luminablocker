import { formatUsage } from "@/constants/utils";
import {
  clearAppData,
  getAppSettings,
  getBlockedApps,
  saveBlockedApps,
  setAppIntensity,
  setMindfulReminder,
  setNightLock,
} from "@/modules/lumina-blocker";
import {
  getStore,
  refreshLuminaStore,
  removeAppFromStore,
  subscribe,
} from "@/store/luminaStore";
import { Feather, Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { AppIcon } from "./app-picker";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// ─── THEME ───────────────────────────────────────────────────────────────────
const C = {
  bg: "#0A0A0F",
  surface: "#13131A",
  surfaceHigh: "#1C1C28",
  border: "#252535",
  accent: "#c0c1ff",
  accentSoft: "#c0c1ff18",
  green: "#3cddc7",
  greenSoft: "#3cddc720",
  red: "#FF4D6A",
  textPrimary: "#F0EFF8",
  textSecondary: "#7B7A9A",
  textMuted: "#44445A",
};

// ─── TYPES ────────────────────────────────────────────────────────────────────
type AppTarget = {
  packageName: string;
  appName: string;
  icon?: string;
  category: string;
  score: number;
  level: number;
  usageMs: number;
  usageBreakdown: {
    early: number;
    work: number;
    evening: number;
    night: number;
  };
};

type WeeklyUsageDay = { day: string; usageMs: number };

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES: Record<string, string> = {
  Sun: "Sunday",
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
};

type ChartInsight = {
  prefix: string;
  highlight?: string;
  suffix?: string;
};

function weeklyTotal(
  packageName: string,
  weeklyUsageMap: Record<string, WeeklyUsageDay[]>,
): number {
  return (weeklyUsageMap[packageName] ?? []).reduce(
    (sum, day) => sum + day.usageMs,
    0,
  );
}

function buildChartInsight(
  weeklyData: WeeklyUsageDay[],
  options: {
    filteredApp?: string;
    leadingApp?: string | null;
    todaySlot?: string;
  },
): ChartInsight | null {
  const peakDay = weeklyData.reduce<WeeklyUsageDay | null>((best, day) => {
    if (!best || day.usageMs > best.usageMs) return day;
    return best;
  }, null);

  if (peakDay && peakDay.usageMs > 0) {
    const dayName = DAY_NAMES[peakDay.day] ?? peakDay.day;
    const amount = formatUsage(peakDay.usageMs);
    if (options.filteredApp) {
      return {
        prefix: "You used ",
        highlight: options.filteredApp,
        suffix: ` most on ${dayName} · ${amount}.`,
      };
    }
    if (options.leadingApp) {
      return {
        prefix: "",
        highlight: options.leadingApp,
        suffix: ` led this week. ${dayName} was the heaviest day · ${amount}.`,
      };
    }
    return {
      prefix: `${dayName} was your heaviest day this week · ${amount}.`,
    };
  }

  if (options.todaySlot && options.todaySlot !== "—") {
    const name = options.filteredApp ?? options.leadingApp;
    if (!name) return null;
    return {
      prefix: "Today, ",
      highlight: name,
      suffix: ` peaked during the ${options.todaySlot.toLowerCase()}.`,
    };
  }

  return null;
}

function getPeakTime(breakdown: AppTarget["usageBreakdown"]): string {
  const slots = [
    { label: "Early", val: breakdown.early },
    { label: "Work", val: breakdown.work },
    { label: "Evening", val: breakdown.evening },
    { label: "Night", val: breakdown.night },
  ];
  const peak = slots.reduce((a, b) => (b.val > a.val ? b : a));
  return peak.val > 0 ? peak.label : "—";
}

function getLevelBadge(
  level: number,
): { text: string; color: string } | undefined {
  if (level >= 2) return { text: "High Intensity", color: "#ff8a8a" };
  if (level === 1) return { text: "Moderate", color: "#c0c1ff" };
  return undefined;
}

// ─── WEEKLY BAR CHART ─────────────────────────────────────────────────────────
const CHART_H = 100;

function WeeklyChart({ weeklyData }: { weeklyData: WeeklyUsageDay[] }) {
  const todayIndex = new Date().getDay();
  const orderedDays = [
    ...WEEK_DAYS.slice(todayIndex + 1),
    ...WEEK_DAYS.slice(0, todayIndex + 1),
  ];
  const ordered = orderedDays.map((day) => {
    const found = weeklyData.find((d) => d.day === day);
    return found ?? { day, usageMs: 0 };
  });

  const maxVal = Math.max(...ordered.map((d) => d.usageMs), 1);
  const todayIdx = 6;
  const anims = useRef(ordered.map(() => new Animated.Value(0))).current;
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  useEffect(() => {
    anims.forEach((a) => a.setValue(0));
    Animated.stagger(
      55,
      anims.map((a) =>
        Animated.spring(a, {
          toValue: 1,
          useNativeDriver: false,
          tension: 55,
          friction: 9,
        }),
      ),
    ).start();
  }, [weeklyData]);

  const peakMs = Math.max(...ordered.map((d) => d.usageMs));

  return (
    <View style={styles.chartWrap}>
      <View style={styles.peakLabel}>
        <Text style={styles.peakText}>{formatUsage(peakMs)}</Text>
      </View>
      <View style={styles.barsRow}>
        {ordered.map((d, i) => {
          const isToday = i === todayIdx;
          const isSelected = selectedIdx === i;
          const targetH =
            d.usageMs > 0 ? Math.max((d.usageMs / maxVal) * CHART_H, 6) : 0;
          const animH = anims[i].interpolate({
            inputRange: [0, 1],
            outputRange: [0, targetH],
          });
          const fillColor = isToday
            ? "#6C63FF"
            : isSelected
              ? "#6C63FF99"
              : "#3D3D5C";

          return (
            <TouchableOpacity
              key={i}
              activeOpacity={0.7}
              onPress={() => setSelectedIdx(isSelected ? null : i)}
              style={styles.barCol}
            >
              {isSelected && d.usageMs > 0 && (
                <View style={styles.tooltip}>
                  <Text style={styles.tooltipText}>
                    {formatUsage(d.usageMs)}
                  </Text>
                  <View style={styles.tooltipArrow} />
                </View>
              )}
              <View style={[styles.barTrack, { height: CHART_H }]}>
                <Animated.View
                  style={[
                    styles.barFill,
                    { height: animH, backgroundColor: fillColor },
                  ]}
                />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.dayLabels}>
        {ordered.map((d, i) => (
          <Text
            key={i}
            style={[
              styles.dayLabel,
              i === todayIdx && styles.dayLabelActive,
              selectedIdx === i && styles.dayLabelSelected,
            ]}
          >
            {d.day.slice(0, 1)}
          </Text>
        ))}
      </View>
    </View>
  );
}

// ─── MINI BARS ────────────────────────────────────────────────────────────────
function MiniBars({
  data,
  selectedDay,
  onSelectDay,
}: {
  data: { totalMs: number; sessionCount: number }[];
  selectedDay: number | null;
  onSelectDay: (i: number) => void;
}) {
  const maxMs = Math.max(...data.map((d) => d.totalMs), 1);
  const todayIdx = data.length - 1;

  return (
    <>
      <View style={styles.miniBars}>
        {data.map((d, i) => {
          const isToday = i === todayIdx;
          const isSelected = selectedDay === i;
          const ratio = d.totalMs > 0 ? Math.max(d.totalMs / maxMs, 0.08) : 0;
          const barH = d.totalMs > 0 ? ratio * 36 + 4 : 4;
          return (
            <TouchableOpacity
              key={i}
              style={[styles.miniBarTrack, { height: barH }]}
              activeOpacity={0.7}
              onPress={() => onSelectDay(i)}
            >
              <View
                style={[
                  styles.miniBar,
                  {
                    height: barH,
                    backgroundColor:
                      d.totalMs === 0
                        ? "#1C1C28"
                        : isSelected
                          ? "#c0c1ff"
                          : isToday
                            ? "#6C63FF"
                            : "#252535",
                  },
                ]}
              />
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.focusDayLabels}>
        {["M", "T", "W", "T", "F", "S", "S"].map((label, i) => (
          <Text
            key={i}
            style={[
              styles.focusDayLabel,
              selectedDay === i && { color: C.accent },
            ]}
          >
            {label}
          </Text>
        ))}
      </View>
    </>
  );
}

// ─── FILTER CHIPS ─────────────────────────────────────────────────────────────
function FilterChips({
  filters,
  active,
  onChange,
}: {
  filters: string[];
  active: string;
  onChange: (f: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginTop: 12 }}
      contentContainerStyle={{ gap: 8, paddingRight: 4 }}
    >
      {filters.map((f) => {
        const isActive = f === active;
        return (
          <TouchableOpacity
            key={f}
            onPress={() => onChange(f)}
            activeOpacity={0.7}
            style={[styles.filterChip, isActive && styles.filterChipActive]}
          >
            <Text
              style={[
                styles.filterChipText,
                isActive && styles.filterChipTextActive,
              ]}
            >
              {f}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ─── STAT CHIP ────────────────────────────────────────────────────────────────
function StatChip({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.statChip}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, valueColor ? { color: valueColor } : {}]}>
        {value}
      </Text>
    </View>
  );
}

// ─── INTENSITY SLIDER ─────────────────────────────────────────────────────────
const INTENSITY_LABELS = ["Subtle", "Moderate", "Deep"] as const;
type Intensity = 0 | 1 | 2;
const INTENSITY_COLORS: Record<Intensity, string> = {
  0: "#3cddc7",
  1: "#c0c1ff",
  2: "#ff8a8a",
};

function IntensitySlider({
  value,
  onChange,
}: {
  value: Intensity;
  onChange: (v: Intensity) => void;
}) {
  return (
    <View style={styles.sliderWrap}>
      <View style={styles.sliderRow}>
        <Text style={styles.sliderLabel}>Intervention Intensity</Text>
        <View
          style={[
            styles.intensityPill,
            { backgroundColor: INTENSITY_COLORS[value] + "20" },
          ]}
        >
          <Text
            style={[
              styles.intensityPillText,
              { color: INTENSITY_COLORS[value] },
            ]}
          >
            {INTENSITY_LABELS[value]}
          </Text>
        </View>
      </View>
      <View style={styles.sliderSteps}>
        {([0, 1, 2] as Intensity[]).map((step) => (
          <TouchableOpacity
            key={step}
            onPress={() => onChange(step)}
            style={styles.sliderStepBtn}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.sliderDot,
                value >= step && { backgroundColor: INTENSITY_COLORS[value] },
              ]}
            />
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.sliderTrack}>
        <View
          style={[
            styles.sliderFill,
            {
              width: `${(value / 2) * 100}%`,
              backgroundColor: INTENSITY_COLORS[value],
            },
          ]}
        />
      </View>
      <View style={styles.sliderStepLabels}>
        {INTENSITY_LABELS.map((l) => (
          <Text key={l} style={styles.sliderStepLabel}>
            {l}
          </Text>
        ))}
      </View>
    </View>
  );
}

// ─── TOGGLE ROW ───────────────────────────────────────────────────────────────
function ToggleRow({
  icon,
  iconColor,
  label,
  sublabel,
  on,
  onChange,
  danger = false,
}: {
  icon: string;
  iconColor: string;
  label: string;
  sublabel?: string;
  on: boolean;
  onChange: (value: boolean) => void;
  danger?: boolean;
}) {
  return (
    <View
      style={[
        styles.toggleRow,
        danger && { backgroundColor: "#FF4D6A08", borderColor: "#FF4D6A18" },
      ]}
    >
      <View style={styles.toggleRowLeft}>
        <Ionicons name={icon as any} size={16} color={iconColor} />
        <View>
          <Text style={styles.toggleRowLabel}>{label}</Text>
          {sublabel ? (
            <Text style={styles.toggleRowSub}>{sublabel}</Text>
          ) : null}
        </View>
      </View>
      <Switch
        value={on}
        onValueChange={onChange}
        trackColor={{
          false: C.border,
          true: danger ? "#FF4D6A60" : C.accent + "60",
        }}
        thumbColor={on ? (danger ? "#FF4D6A" : C.accent) : C.textMuted}
        ios_backgroundColor={C.border}
        style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
      />
    </View>
  );
}

// ─── USAGE BAR ────────────────────────────────────────────────────────────────
function UsageBar({ pct, color }: { pct: number; color: string }) {
  return (
    <View style={styles.usageBarTrack}>
      <View
        style={[
          styles.usageBarFill,
          { width: `${Math.min(pct, 100)}%`, backgroundColor: color },
        ]}
      />
    </View>
  );
}

// ─── APP CARD ─────────────────────────────────────────────────────────────────
function AppCard({
  target,
  weeklyData,
  onRemove,
}: {
  target: AppTarget;
  weeklyData: WeeklyUsageDay[];
  onRemove: (packageName: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [intensity, setIntensity] = useState<Intensity>(
    target.level >= 2 ? 2 : target.level === 1 ? 1 : 0,
  );
  const [mindfulReminder, setMindfulReminderState] = useState(true);
  const [nightLock, setNightLockState] = useState(false);
  const animOpacity = useRef(new Animated.Value(0)).current;
  const chevronAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    try {
      const settings = getAppSettings(target.packageName);
      if (settings.intensity >= 0 && settings.intensity <= 2) {
        setIntensity(settings.intensity as Intensity);
      } else {
        // Seed the native setting from the current score level so the visible
        // default and the enforcement behavior start in agreement.
        const initialIntensity: Intensity =
          target.level >= 2 ? 2 : target.level === 1 ? 1 : 0;
        setAppIntensity(target.packageName, initialIntensity);
      }
      setMindfulReminderState(settings.mindfulReminder);
      setNightLockState(settings.nightLock);
    } catch {
      // Older native builds do not expose per-app settings yet; retain the
      // score-derived defaults until the app is rebuilt.
    }
  }, [target.packageName]);

  const updateIntensity = (value: Intensity) => {
    setIntensity(value);
    try {
      setAppIntensity(target.packageName, value);
    } catch {
      // Keep the UI responsive if an older native module is still installed.
    }
  };

  const updateMindfulReminder = (value: boolean) => {
    setMindfulReminderState(value);
    try {
      setMindfulReminder(target.packageName, value);
    } catch {
      // See the compatibility note above.
    }
  };

  const updateNightLock = (value: boolean) => {
    setNightLockState(value);
    try {
      setNightLock(target.packageName, value);
    } catch {
      // See the compatibility note above.
    }
  };

  const toggle = () => {
    const toOpen = !open;
    setOpen(toOpen);
    Animated.parallel([
      Animated.timing(animOpacity, {
        toValue: toOpen ? 1 : 0,
        duration: 250,
        useNativeDriver: false,
      }),
      Animated.spring(chevronAnim, {
        toValue: toOpen ? 1 : 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }),
    ]).start();
  };

  const chevronRotate = chevronAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });
  const badge = getLevelBadge(target.level);

  const dedupedWeeklyData = WEEK_DAYS.map((day) => {
    const found = weeklyData.find((d) => d.day === day);
    return found ?? { day, usageMs: 0 };
  });

  const weeklyTotal = dedupedWeeklyData.reduce((s, d) => s + d.usageMs, 0);
  const todayDayName = WEEK_DAYS[new Date().getDay()];
  const todayFromWeekly = dedupedWeeklyData.find((d) => d.day === todayDayName);
  const todayUsageMs = todayFromWeekly?.usageMs ?? target.usageMs;
  const weeklyMax = Math.max(...dedupedWeeklyData.map((d) => d.usageMs), 1);
  const usagePct = (todayUsageMs / weeklyMax) * 100;

  return (
    <View style={[styles.appCard, open && styles.appCardOpen]}>
      <TouchableOpacity
        onPress={toggle}
        activeOpacity={0.75}
        style={styles.appCardHeader}
      >
        <View style={styles.appIcon}>
          <AppIcon
            app={{
              packageName: target.packageName,
              label: target.appName,
              category: target.category,
              icon: target.icon,
            }}
            size={48}
          />
        </View>
        <View style={styles.appInfo}>
          <Text style={styles.appName}>{target.appName}</Text>
          <View style={styles.appSubRow}>
            <Text style={styles.appSub}>
              {todayUsageMs > 0
                ? formatUsage(todayUsageMs) + " today"
                : "No usage today"}
            </Text>
            {badge && (
              <View
                style={[
                  styles.appBadge,
                  { backgroundColor: badge.color + "18" },
                ]}
              >
                <Text style={[styles.appBadgeText, { color: badge.color }]}>
                  {badge.text}
                </Text>
              </View>
            )}
          </View>
          <UsageBar pct={usagePct} color={C.accent} />
        </View>
        <View style={styles.appControls}>
          <TouchableOpacity
            onPress={() => onRemove(target.packageName)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.removeBtn}
          >
            <Feather name="trash-2" size={14} color={C.red} />
          </TouchableOpacity>
          <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
            <Feather name="chevron-down" size={16} color={C.textMuted} />
          </Animated.View>
        </View>
      </TouchableOpacity>

      <Animated.View style={{ opacity: animOpacity, overflow: "hidden" }}>
        {open && (
          <View style={styles.expandPanel}>
            <View style={styles.expandDivider} />
            <View style={styles.statsRow}>
              <StatChip label="THIS WEEK" value={formatUsage(weeklyTotal)} />
              <StatChip
                label="SCORE"
                value={target.score > 0 ? `${target.score}` : "—"}
                valueColor={target.score > 0 ? C.accent : undefined}
              />
              <StatChip
                label="LEVEL"
                value={target.level > 0 ? `${target.level}` : "—"}
                valueColor={target.level > 0 ? C.accent : undefined}
              />
              <StatChip
                label="PEAK"
                value={getPeakTime(target.usageBreakdown)}
                valueColor={C.accent}
              />
            </View>
            <IntensitySlider value={intensity} onChange={updateIntensity} />
            <View style={styles.togglesWrap}>
              <ToggleRow
                icon="sparkles"
                iconColor={C.accent}
                label="Mindful Reminder"
                on={mindfulReminder}
                onChange={updateMindfulReminder}
              />
              <ToggleRow
                icon="moon"
                iconColor={C.green}
                label="Night Lock"
                sublabel="after 11 PM"
                on={nightLock}
                onChange={updateNightLock}
              />
            </View>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

// ─── INTERVENTION CARD ────────────────────────────────────────────────────────
function InterventionCard({
  icon,
  title,
  desc,
  iconColor,
}: {
  icon: string;
  title: string;
  desc: string;
  iconColor: string;
}) {
  return (
    <View style={styles.interventionCard}>
      <View
        style={[styles.interventionIcon, { backgroundColor: iconColor + "20" }]}
      >
        <Ionicons name={icon as any} size={18} color={iconColor} />
      </View>
      <Text style={styles.interventionTitle}>{title}</Text>
      <Text style={styles.interventionDesc}>{desc}</Text>
    </View>
  );
}

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────
export default function UsageTimingsScreen() {
  const [data, setData] = useState(getStore());
  const [activeFilter, setActiveFilter] = useState("All Apps");
  const [selectedFocusDay, setSelectedFocusDay] = useState<number | null>(null);

  // Keep in sync when store updates
  useEffect(() => {
    return subscribe(() => setData({ ...getStore() }));
  }, []);

  // Lightweight refresh on focus
  useFocusEffect(
    useCallback(() => {
      refreshLuminaStore().then(() => setData({ ...getStore() }));
    }, []),
  );

  // Reset filter if the selected app was removed
  useEffect(() => {
    if (
      activeFilter !== "All Apps" &&
      !data.focusTargets.find((t) => t.appName === activeFilter)
    ) {
      setActiveFilter("All Apps");
    }
  }, [data.focusTargets]);

  const handleRemove = useCallback((packageName: string) => {
    const current = getBlockedApps().filter((p) => p !== packageName);
    saveBlockedApps(current);
    clearAppData(packageName);
    removeAppFromStore(packageName);
    setData({ ...getStore() });
  }, []);

  const targets = data.focusTargets as AppTarget[];
  const weeklyUsageMap = data.weeklyUsageMap;
  const focusData = data.weeklyFocusData ?? [];

  const filters = ["All Apps", ...targets.map((t) => t.appName)];
  const activeTarget = targets.find((t) => t.appName === activeFilter);

  const chartWeeklyData: WeeklyUsageDay[] = activeTarget
    ? WEEK_DAYS.map((day) => {
        const raw = weeklyUsageMap[activeTarget.packageName] ?? [];
        const found = raw.find((d) => d.day === day);
        return found ?? { day, usageMs: 0 };
      })
    : WEEK_DAYS.map((day) => {
        const total = Object.values(weeklyUsageMap).reduce((sum, days) => {
          const found = days.find((d) => d.day === day);
          return sum + (found?.usageMs ?? 0);
        }, 0);
        return { day, usageMs: total };
      });

  const leadingTarget =
    targets.length > 0
      ? targets.reduce((best, target) => {
          const bestTotal =
            weeklyTotal(best.packageName, weeklyUsageMap) || best.usageMs;
          const targetTotal =
            weeklyTotal(target.packageName, weeklyUsageMap) || target.usageMs;
          return targetTotal > bestTotal ? target : best;
        })
      : null;

  const chartInsight = buildChartInsight(chartWeeklyData, {
    filteredApp: activeTarget?.appName,
    leadingApp: leadingTarget?.appName ?? null,
    todaySlot: (activeTarget ?? leadingTarget)
      ? getPeakTime((activeTarget ?? leadingTarget)!.usageBreakdown)
      : undefined,
  });

  const focusWeeklyTotalMs = focusData.reduce((s, d) => s + d.totalMs, 0);
  const focusDaysWithData = focusData.filter((d) => d.totalMs > 0).length;
  const focusDailyAvgMs =
    focusDaysWithData > 0 ? focusWeeklyTotalMs / focusDaysWithData : 0;

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Usage section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Usage</Text>
          <Text style={styles.sectionBadge}>WEEKLY TRENDS</Text>
        </View>

        <FilterChips
          filters={filters}
          active={activeFilter}
          onChange={setActiveFilter}
        />

        <View style={[styles.card, { marginTop: 12 }]}>
          <WeeklyChart weeklyData={chartWeeklyData} />
        </View>

        {chartInsight && (
          <View style={styles.insightPill}>
            <Ionicons
              name="stats-chart-outline"
              size={16}
              color={C.green}
              style={{ marginTop: 1 }}
            />
            <Text style={styles.insightText}>
              {chartInsight.prefix}
              {chartInsight.highlight ? (
                <Text style={{ color: C.green }}>{chartInsight.highlight}</Text>
              ) : null}
              {chartInsight.suffix}
            </Text>
          </View>
        )}

        {/* Weekly Focus Overview */}
        <Text
          style={[styles.sectionTitle, { marginTop: 28, marginBottom: 16 }]}
        >
          Weekly Focus Overview
        </Text>
        <View style={styles.card}>
          <View style={styles.focusRow}>
            <View>
              <Text style={styles.focusBig}>
                {formatUsage(focusWeeklyTotalMs)}
              </Text>
            </View>
            <View style={styles.focusDailyWrap}>
              <Text style={styles.focusDailyLabel}>DAILY AVERAGE</Text>
              <Text style={styles.focusDailyVal}>
                {focusDailyAvgMs > 0 ? formatUsage(focusDailyAvgMs) : "—"}
              </Text>
            </View>
          </View>

          {selectedFocusDay !== null && focusData[selectedFocusDay] && (
            <View style={{ marginBottom: 16 }}>
              <Text
                style={{
                  color: C.textPrimary,
                  fontSize: 20,
                  fontWeight: "700",
                }}
              >
                {formatUsage(focusData[selectedFocusDay].totalMs)}
              </Text>
              <Text
                style={{ color: C.textSecondary, fontSize: 12, marginTop: 4 }}
              >
                {focusData[selectedFocusDay].sessionCount} sessions
              </Text>
            </View>
          )}

          <MiniBars
            data={
              focusData.length > 0
                ? focusData
                : Array(7).fill({ totalMs: 0, sessionCount: 0 })
            }
            selectedDay={selectedFocusDay}
            onSelectDay={setSelectedFocusDay}
          />
        </View>

        {/* Distracting Apps */}
        <View
          style={[styles.sectionHeader, { marginTop: 28, marginBottom: 16 }]}
        >
          <Text style={styles.sectionTitle}>Distracting Apps</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push("/apps/app-picker")}
          >
            <Feather name="plus" size={18} color={C.accent} />
          </TouchableOpacity>
        </View>

        {targets.length === 0 ? (
          <View style={[styles.card, { padding: 24, alignItems: "center" }]}>
            <Text style={{ color: C.textMuted, fontSize: 13 }}>
              No blocked apps yet
            </Text>
          </View>
        ) : (
          <View style={styles.appsList}>
            {targets.map((target) => (
              <AppCard
                key={target.packageName}
                target={target}
                weeklyData={weeklyUsageMap[target.packageName] ?? []}
                onRemove={handleRemove}
              />
            ))}
          </View>
        )}

        {/* Recommended Interventions */}
        <Text
          style={[styles.sectionTitle, { marginTop: 28, marginBottom: 16 }]}
        >
          Recommended Interventions
        </Text>
        <View style={styles.interventionRow}>
          <InterventionCard
            icon="moon"
            title="Sleep Shield"
            desc="Block entertainment apps after 11:00 PM."
            iconColor={C.green}
          />
          <InterventionCard
            icon="timer-outline"
            title="5-Min Pause"
            desc="Mandatory breathing exercise after 20 mins."
            iconColor={C.accent}
          />
        </View>

        <View style={{ height: 120 }} />
      </Animated.ScrollView>
    </View>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: C.textPrimary,
    letterSpacing: -0.3,
  },
  sectionBadge: {
    fontSize: 10,
    fontWeight: "700",
    color: C.textMuted,
    letterSpacing: 1.2,
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  chartWrap: { paddingTop: 0 },
  peakLabel: { alignSelf: "center", marginBottom: 40 },
  peakText: {
    fontSize: 12,
    fontWeight: "700",
    color: C.accent,
    letterSpacing: 0.5,
  },
  barsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: CHART_H,
  },
  barCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    position: "relative",
  },
  barTrack: {
    width: 6,
    borderRadius: 3,
    backgroundColor: "#1C1C28",
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  barFill: { width: "100%" },
  tooltip: {
    position: "absolute",
    bottom: CHART_H + 6,
    backgroundColor: "#2A2A3F",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#6C63FF40",
    zIndex: 10,
    alignItems: "center",
  },
  tooltipText: { fontSize: 11, fontWeight: "700", color: C.accent },
  tooltipArrow: {
    position: "absolute",
    bottom: -5,
    width: 8,
    height: 8,
    backgroundColor: "#2A2A3F",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#6C63FF40",
    transform: [{ rotate: "45deg" }],
  },
  dayLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  dayLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    color: C.textMuted,
    fontWeight: "600",
  },
  dayLabelActive: { color: C.accent },
  dayLabelSelected: { color: C.textSecondary },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  filterChipActive: { backgroundColor: C.accent, borderColor: C.accent },
  filterChipText: { fontSize: 13, fontWeight: "600", color: C.textSecondary },
  filterChipTextActive: { color: C.bg },
  insightPill: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: C.greenSoft,
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: C.green + "30",
  },
  insightText: {
    flex: 1,
    fontSize: 13,
    color: C.textSecondary,
    lineHeight: 19,
  },
  focusRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  focusBig: {
    fontSize: 36,
    fontWeight: "800",
    color: C.textPrimary,
    letterSpacing: -1,
  },
  focusDelta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  focusDeltaText: { fontSize: 12, color: C.red, fontWeight: "600" },
  focusDailyWrap: { alignItems: "flex-end" },
  focusDailyLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: C.textMuted,
    letterSpacing: 1.2,
  },
  focusDailyVal: {
    fontSize: 22,
    fontWeight: "700",
    color: C.textPrimary,
    marginTop: 2,
  },
  miniBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    height: 44,
  },
  miniBarTrack: { flex: 1, justifyContent: "flex-end" },
  miniBar: { borderRadius: 0, width: "100%" },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  appsList: { gap: 10 },
  appCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  appCardOpen: { borderColor: C.accent + "30" },
  appCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
  },
  appIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    flexShrink: 0,
  },
  appInfo: { flex: 1 },
  appName: { fontSize: 15, fontWeight: "700", color: C.textPrimary },
  appSubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  appSub: { fontSize: 12, color: C.textSecondary },
  appBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99 },
  appBadgeText: { fontSize: 10, fontWeight: "700" },
  usageBarTrack: {
    height: 3,
    backgroundColor: "#ffffff0d",
    borderRadius: 2,
    marginTop: 7,
    width: 120,
  },
  usageBarFill: { height: "100%", borderRadius: 2 },
  appControls: { flexDirection: "row", alignItems: "center", gap: 4 },
  expandPanel: { paddingHorizontal: 16, paddingBottom: 16 },
  expandDivider: { height: 1, backgroundColor: C.border, marginBottom: 16 },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  statChip: {
    flex: 1,
    backgroundColor: "#ffffff06",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#ffffff08",
  },
  statLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: C.textMuted,
    letterSpacing: 1,
    marginBottom: 4,
  },
  statValue: { fontSize: 15, fontWeight: "700", color: C.textPrimary },
  sliderWrap: { marginBottom: 16 },
  sliderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sliderLabel: { fontSize: 12, color: C.textSecondary, fontWeight: "500" },
  intensityPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 99,
  },
  intensityPillText: { fontSize: 11, fontWeight: "700" },
  sliderSteps: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    position: "relative",
    zIndex: 1,
  },
  sliderStepBtn: { flex: 1, alignItems: "center", paddingVertical: 6 },
  sliderDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: C.border,
    borderWidth: 2,
    borderColor: C.surface,
  },
  sliderTrack: {
    height: 3,
    backgroundColor: C.border,
    borderRadius: 2,
    marginTop: -10,
    marginHorizontal: 7,
    zIndex: 0,
  },
  sliderFill: { height: "100%", borderRadius: 2 },
  sliderStepLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  sliderStepLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 10,
    color: C.textMuted,
    fontWeight: "500",
  },
  togglesWrap: { gap: 8 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff05",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#ffffff08",
  },
  toggleRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  toggleRowLabel: { fontSize: 13, fontWeight: "600", color: C.textPrimary },
  toggleRowSub: { fontSize: 11, color: C.textMuted, marginTop: 1 },
  interventionRow: { flexDirection: "row", gap: 12 },
  interventionCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  interventionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  interventionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: C.textPrimary,
    marginBottom: 4,
  },
  interventionDesc: { fontSize: 12, color: C.textSecondary, lineHeight: 17 },
  focusDayLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  focusDayLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    color: C.textMuted,
    fontWeight: "600",
  },
  removeBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#FF4D6A12",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
});
