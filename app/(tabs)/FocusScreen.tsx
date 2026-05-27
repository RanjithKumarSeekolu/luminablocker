import {
  addFocusCompleteListener,
  isFocusModeActive,
  startFocusMode,
  stopFocusMode,
} from "@/modules/lumina-blocker";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const DURATIONS = [
  { label: "15m", ms: 15 * 60 * 1000 },
  { label: "25m", ms: 25 * 60 * 1000 },
  { label: "45m", ms: 45 * 60 * 1000 },
  { label: "60m", ms: 60 * 60 * 1000 },
];

const PHRASES = [
  "Your phone cannot reach you here.\nStay present.",
  "One task. One moment.\nYou've got this.",
  "Deep work is the superpower\nof our distracted age.",
  "Every minute here\nis reclaimed from noise.",
  "The best ideas arrive\nin silence.",
];

const RING_RADIUS = 90;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

function ringColor(pct: number): string {
  if (pct < 0.25) return "#9a5a2a";
  if (pct < 0.5) return "#9a8a2a";
  return "#4caf7d";
}

// ─────────────────────────────────────────────────────────────
// Ring component
// ─────────────────────────────────────────────────────────────

function TimerRing({
  totalMs,
  remainingMs,
}: {
  totalMs: number;
  remainingMs: number;
}) {
  const pct = totalMs > 0 ? remainingMs / totalMs : 0;
  const strokeDashoffset = RING_CIRCUMFERENCE * (1 - pct);
  const color = ringColor(pct);

  return (
    <View style={styles.ringWrap}>
      <Svg width={220} height={220} style={styles.ringSvg}>
        {/* Track */}
        <Circle
          cx={110}
          cy={110}
          r={RING_RADIUS}
          stroke="#1c2b24"
          strokeWidth={8}
          fill="none"
        />
        {/* Progress */}
        <Circle
          cx={110}
          cy={110}
          r={RING_RADIUS}
          stroke={color}
          strokeWidth={8}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={strokeDashoffset}
          rotation={-90}
          origin="110, 110"
        />
      </Svg>

      <View style={styles.ringCenter}>
        <Text style={styles.ringLabel}>remaining</Text>
        <Text style={[styles.ringTimer, { color }]}>
          {formatTime(remainingMs)}
        </Text>
        <Text style={styles.ringSub}>deep work</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────

export default function FocusScreen() {
  const [selectedDuration, setSelectedDuration] = useState(DURATIONS[1]);
  const [isRunning, setIsRunning] = useState(isFocusModeActive());
  const [remainingMs, setRemainingMs] = useState(DURATIONS[1].ms);
  const [totalMs, setTotalMs] = useState(DURATIONS[1].ms);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [sessionNumber, setSessionNumber] = useState(1);
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [completed, setCompleted] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phraseRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const phraseOpacity = useRef(new Animated.Value(1)).current;

  // ── Listen for native completion ──────────────────────────
  useEffect(() => {
    const sub = addFocusCompleteListener(({ completed: done }) => {
      clearInterval(intervalRef.current!);
      clearInterval(phraseRef.current!);
      setIsRunning(false);
      setCompleted(done);
      if (done) {
        setTodayMinutes((prev) => prev + Math.round(totalMs / 60000));
        setSessionNumber((prev) => prev + 1);
        setRemainingMs(totalMs);
      }
    });
    return () => sub.remove();
  }, [totalMs]);

  // ── JS-side countdown (mirrors native timer for UI) ───────
  const startCountdown = (duration: number) => {
    startTimeRef.current = Date.now();
    setRemainingMs(duration);

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const left = Math.max(0, duration - elapsed);
      setRemainingMs(left);
      if (left <= 0) clearInterval(intervalRef.current!);
    }, 500);
  };

  const stopCountdown = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  // ── Phrase cycling ────────────────────────────────────────
  const startPhrases = () => {
    phraseRef.current = setInterval(
      () => {
        Animated.sequence([
          Animated.timing(phraseOpacity, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
            easing: Easing.out(Easing.ease),
          }),
          Animated.timing(phraseOpacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
            easing: Easing.in(Easing.ease),
          }),
        ]).start();
        setPhraseIndex((prev) => (prev + 1) % PHRASES.length);
      },
      2 * 60 * 1000,
    );
  };

  const stopPhrases = () => {
    if (phraseRef.current) clearInterval(phraseRef.current);
  };

  // ── Start / pause ─────────────────────────────────────────
  const handleStart = () => {
    if (isRunning) {
      // Pause — stop native + JS timer
      stopFocusMode();
      stopCountdown();
      stopPhrases();
      setIsRunning(false);
      return;
    }

    setCompleted(false);
    const duration = remainingMs < 1000 ? selectedDuration.ms : remainingMs;
    startFocusMode(duration);
    startCountdown(duration);
    startPhrases();
    setIsRunning(true);
  };

  // ── Duration select ───────────────────────────────────────
  const handleDuration = (dur: (typeof DURATIONS)[0]) => {
    if (isRunning) return;
    setSelectedDuration(dur);
    setTotalMs(dur.ms);
    setRemainingMs(dur.ms);
    setCompleted(false);
  };

  // ── Cleanup on unmount ────────────────────────────────────
  useEffect(() => {
    return () => {
      stopCountdown();
      stopPhrases();
    };
  }, []);

  const pct = totalMs > 0 ? remainingMs / totalMs : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Chip ── */}
      <View style={styles.chipWrap}>
        <View style={styles.chip}>
          <Text style={styles.chipText}>FOCUS MODE</Text>
        </View>
      </View>

      {/* ── Ring ── */}
      <TimerRing totalMs={totalMs} remainingMs={remainingMs} />

      {/* ── Phrase ── */}
      <Animated.Text style={[styles.phrase, { opacity: phraseOpacity }]}>
        {completed
          ? "Session complete.\nWell done — take a short break."
          : PHRASES[phraseIndex]}
      </Animated.Text>

      {/* ── Volume hint ── */}
      <View style={styles.volCard}>
        <Text style={styles.volIcon}>▼</Text>
        <Text style={styles.volText}>Hold volume down 10s to exit early</Text>
      </View>

      {/* ── Stats ── */}
      <View style={styles.statsRow}>
        <View style={styles.statPill}>
          <Text style={styles.statLabel}>session</Text>
          <Text style={styles.statValue}>{ordinal(sessionNumber)}</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statLabel}>today</Text>
          <Text style={styles.statValue}>{todayMinutes}m</Text>
        </View>
        <View style={[styles.statPill, { marginRight: 0 }]}>
          <Text style={styles.statLabel}>streak</Text>
          <Text style={styles.statValue}>3 days</Text>
        </View>
      </View>

      {/* ── Duration selector ── */}
      <View style={[styles.durRow, isRunning && styles.durRowDisabled]}>
        {DURATIONS.map((dur) => {
          const active = dur.ms === selectedDuration.ms;
          return (
            <TouchableOpacity
              key={dur.label}
              style={[styles.durBtn, active && styles.durBtnActive]}
              onPress={() => handleDuration(dur)}
              disabled={isRunning}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.durBtnText, active && styles.durBtnTextActive]}
              >
                {dur.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Start button ── */}
      <TouchableOpacity
        style={[styles.startBtn, isRunning && styles.startBtnRunning]}
        onPress={handleStart}
        activeOpacity={0.85}
      >
        <Text
          style={[styles.startBtnText, isRunning && styles.startBtnTextRunning]}
        >
          {isRunning
            ? "⏸  Pause"
            : completed
              ? "▶  Start again"
              : "▶  Start focus session"}
        </Text>
      </TouchableOpacity>

      {/* ── Progress bar (when running) ── */}
      {isRunning && (
        <View style={styles.progressBg}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.round(pct * 100)}%` as any,
                backgroundColor: ringColor(pct),
              },
            ]}
          />
        </View>
      )}
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
  },

  scrollContent: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 60,
  },

  chipWrap: {
    marginBottom: 36,
  },

  chip: {
    backgroundColor: "#1c2b24",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#2a4a38",
    paddingHorizontal: 14,
    paddingVertical: 6,
  },

  chipText: {
    color: "#4caf7d",
    fontSize: 11,
    fontFamily: "DMSans_600SemiBold",
    letterSpacing: 1,
  },

  ringWrap: {
    width: 220,
    height: 220,
    marginBottom: 36,
    position: "relative",
  },

  ringSvg: {
    position: "absolute",
    top: 0,
    left: 0,
  },

  ringCenter: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },

  ringLabel: {
    color: "#5a7a68",
    fontSize: 12,
    fontFamily: "DMSans_400Regular",
  },

  ringTimer: {
    fontSize: 44,
    fontFamily: "DMSans_600SemiBold",
    letterSpacing: -1,
    lineHeight: 52,
  },

  ringSub: {
    color: "#4caf7d",
    fontSize: 11,
    fontFamily: "DMSans_400Regular",
  },

  phrase: {
    color: "#5a7a68",
    fontSize: 14,
    fontFamily: "DMSans_400Regular",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
    minHeight: 44,
  },

  volCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#111c17",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1c2b24",
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: "100%",
    marginBottom: 24,
  },

  volIcon: {
    color: "#2a4a38",
    fontSize: 14,
  },

  volText: {
    color: "#2a4a38",
    fontSize: 12,
    fontFamily: "DMSans_400Regular",
    flex: 1,
  },

  statsRow: {
    flexDirection: "row",
    width: "100%",
    marginBottom: 16,
  },

  statPill: {
    flex: 1,
    backgroundColor: "#111c17",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1c2b24",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginRight: 10,
    gap: 4,
  },

  statLabel: {
    color: "#2a4a38",
    fontSize: 11,
    fontFamily: "DMSans_400Regular",
  },

  statValue: {
    color: "#7ab89a",
    fontSize: 16,
    fontFamily: "DMSans_600SemiBold",
  },

  durRow: {
    flexDirection: "row",
    width: "100%",
    marginBottom: 24,
    gap: 8,
  },

  durRowDisabled: {
    opacity: 0.3,
  },

  durBtn: {
    flex: 1,
    backgroundColor: "#111c17",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1c2b24",
    paddingVertical: 10,
    alignItems: "center",
  },

  durBtnActive: {
    backgroundColor: "#1c2b24",
    borderColor: "#4caf7d",
  },

  durBtnText: {
    color: "#5a7a68",
    fontSize: 13,
    fontFamily: "DMSans_400Regular",
  },

  durBtnTextActive: {
    color: "#4caf7d",
    fontFamily: "DMSans_600SemiBold",
  },

  startBtn: {
    width: "100%",
    backgroundColor: "#1a5c3a",
    borderRadius: 24,
    paddingVertical: 18,
    alignItems: "center",
    marginBottom: 16,
  },

  startBtnRunning: {
    backgroundColor: "#0e1412",
    borderWidth: 1,
    borderColor: "#2a4a38",
  },

  startBtnText: {
    color: "#e8f0eb",
    fontSize: 15,
    fontFamily: "DMSans_600SemiBold",
  },

  startBtnTextRunning: {
    color: "#5a7a68",
  },

  progressBg: {
    width: "100%",
    height: 2,
    backgroundColor: "#1c2b24",
    borderRadius: 2,
    overflow: "hidden",
  },

  progressFill: {
    height: 2,
    borderRadius: 2,
  },
});
