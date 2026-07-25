import {
  addFocusCompleteListener,
  isVolumeExitAllowed,
  startFocusLock,
} from "@/modules/lumina-blocker";

import React, { useEffect, useRef, useState } from "react";

import { useFocusEffect } from "@react-navigation/native";

import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import Svg, { Circle } from "react-native-svg";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const PHRASES = [
  "Your phone cannot reach you here.\nStay present.",
  "One task. One moment.\nYou've got this.",
  "Deep work is the superpower\nof our distracted age.",
  "Every minute here\nis reclaimed from noise.",
  "The best ideas arrive\nin silence.",
];

const RING_RADIUS = 90;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatDuration(mins: number): string {
  const hrs = Math.floor(mins / 60);

  const m = mins % 60;

  return `${String(hrs).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];

  const v = n % 100;

  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

// ─────────────────────────────────────────────
// Ring Component
// ─────────────────────────────────────────────

function TimerRing({ minutes }: { minutes: number }) {
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

        {/* Static Ring */}

        <Circle
          cx={110}
          cy={110}
          r={RING_RADIUS}
          stroke="#4caf7d"
          strokeWidth={8}
          fill="none"
          strokeLinecap="round"
        />
      </Svg>

      <View style={styles.ringCenter}>
        <Text style={styles.ringLabel}>focus duration</Text>

        <Text style={styles.ringTimer}>{formatDuration(minutes)}</Text>

        <Text style={styles.ringSub}>deep work</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────

export default function FocusScreen() {
  // ─────────────────────────────────────────
  // Duration
  // ─────────────────────────────────────────

  const [minutes, setMinutes] = useState(25);

  const [durationInput, setDurationInput] = useState(formatDuration(25));

  // ─────────────────────────────────────────
  // Session
  // ─────────────────────────────────────────

  const [isRunning, setIsRunning] = useState(false);

  const [phraseIndex, setPhraseIndex] = useState(0);

  const [sessionNumber, setSessionNumber] = useState(1);

  const [todayMinutes, setTodayMinutes] = useState(0);

  const [completed, setCompleted] = useState(false);

  // ─────────────────────────────────────────
  // Animation
  // ─────────────────────────────────────────

  const phraseOpacity = useRef(new Animated.Value(1)).current;

  // ─────────────────────────────────────────
  // Reset state when screen regains focus
  // ─────────────────────────────────────────

  useFocusEffect(
    React.useCallback(() => {
      setIsRunning(false);

      return () => {};
    }, []),
  );

  // ─────────────────────────────────────────
  // Sync input
  // ─────────────────────────────────────────

  useEffect(() => {
    setDurationInput(formatDuration(minutes));
  }, [minutes]);

  // ─────────────────────────────────────────
  // Native completion
  // ─────────────────────────────────────────

  useEffect(() => {
    const sub = addFocusCompleteListener(({ completed: done }) => {
      setIsRunning(false);

      setCompleted(done);

      if (done) {
        setTodayMinutes((prev) => prev + minutes);

        setSessionNumber((prev) => prev + 1);
      }
    });

    return () => {
      sub.remove();
    };
  }, [minutes]);

  // ─────────────────────────────────────────
  // Phrase rotation
  // ─────────────────────────────────────────

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.sequence([
        Animated.timing(phraseOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),

        Animated.timing(phraseOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      setPhraseIndex((prev) => (prev + 1) % PHRASES.length);
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  // ─────────────────────────────────────────
  // Start
  // ─────────────────────────────────────────

  const handleStart = () => {
    const totalMinutes = Math.max(0, minutes);

    setCompleted(false);

    setIsRunning(true);

    startFocusLock(totalMinutes * 60 * 1000);
  };

  // ─────────────────────────────────────────
  // Input
  // ─────────────────────────────────────────

  const handleDurationInput = (text: string) => {
    setDurationInput(text);

    const digits = text.replace(/\D/g, "");

    if (!digits.length) {
      return;
    }

    let hrs = 0;
    let mins = 0;

    if (digits.length <= 2) {
      mins = parseInt(digits);
    } else {
      hrs = parseInt(digits.slice(0, -2));

      mins = parseInt(digits.slice(-2));
    }

    mins = Math.min(mins, 59);

    const totalMinutes = Math.max(1, hrs * 60 + mins);

    setMinutes(totalMinutes);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Chip */}

      <View style={styles.chipWrap}>
        <View style={styles.chip}>
          <Text style={styles.chipText}>FOCUS MODE</Text>
        </View>
      </View>

      {/* Ring */}

      <TimerRing minutes={minutes} />

      {/* Phrase */}

      <Animated.Text
        style={[
          styles.phrase,
          {
            opacity: phraseOpacity,
          },
        ]}
      >
        {completed
          ? "Session complete.\nWell done — take a short break."
          : PHRASES[phraseIndex]}
      </Animated.Text>

      {/* Volume Hint */}

      {isVolumeExitAllowed() && (
        <View style={styles.volCard}>
          <Text style={styles.volIcon}>▼</Text>

          <Text style={styles.volText}>Hold volume down 10s to exit early</Text>
        </View>
      )}

      {/* Stats */}

      <View style={styles.statsRow}>
        <View style={styles.statPill}>
          <Text style={styles.statLabel}>session</Text>

          <Text style={styles.statValue}>{ordinal(sessionNumber)}</Text>
        </View>

        <View style={styles.statPill}>
          <Text style={styles.statLabel}>today</Text>

          <Text style={styles.statValue}>{todayMinutes}m</Text>
        </View>

        <View
          style={[
            styles.statPill,
            {
              marginRight: 0,
            },
          ]}
        >
          <Text style={styles.statLabel}>streak</Text>

          <Text style={styles.statValue}>3 days</Text>
        </View>
      </View>

      {/* Duration */}

      <View style={styles.singleTimeWrap}>
        <Text style={styles.timeLabel}>Focus Duration</Text>

        <View style={styles.durationRow}>
          {/* Minus */}

          <TouchableOpacity
            style={styles.adjustBtn}
            disabled={isRunning}
            onPress={() => {
              const next = Math.max(0, minutes - 5);

              setMinutes(next);
            }}
          >
            <Text style={styles.adjustBtnText}>−</Text>
          </TouchableOpacity>

          {/* Input */}

          <TextInput
            value={durationInput}
            editable={!isRunning}
            keyboardType="number-pad"
            maxLength={5}
            style={styles.durationInput}
            onChangeText={handleDurationInput}
            onBlur={() => {
              setDurationInput(formatDuration(minutes));
            }}
          />

          {/* Plus */}

          <TouchableOpacity
            style={styles.adjustBtn}
            disabled={isRunning}
            onPress={() => {
              const next = minutes + 5;

              setMinutes(next);
            }}
          >
            <Text style={styles.adjustBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Start */}

      <TouchableOpacity
        style={[styles.startBtn, isRunning && styles.startBtnRunning]}
        onPress={handleStart}
        activeOpacity={0.85}
      >
        <Text
          style={[styles.startBtnText, isRunning && styles.startBtnTextRunning]}
        >
          {completed ? "▶ Start again" : "▶ Start focus session"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────

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
  },

  ringTimer: {
    color: "#4caf7d",
    fontSize: 44,
    letterSpacing: -1,
    lineHeight: 52,
  },

  ringSub: {
    color: "#4caf7d",
    fontSize: 11,
  },

  phrase: {
    color: "#5a7a68",
    fontSize: 14,
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
    flex: 1,
  },

  statsRow: {
    flexDirection: "row",
    width: "100%",
    marginBottom: 24,
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
  },

  statValue: {
    color: "#7ab89a",
    fontSize: 16,
  },

  singleTimeWrap: {
    width: "100%",
    marginBottom: 28,
  },

  timeLabel: {
    color: "#5a7a68",
    fontSize: 13,
    marginBottom: 12,
  },

  durationRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
  },

  durationInput: {
    flex: 1,
    height: 72,
    marginHorizontal: 14,
    borderRadius: 22,
    backgroundColor: "#111c17",
    borderWidth: 1,
    borderColor: "#1c2b24",
    color: "#e8f0eb",
    fontSize: 36,
    letterSpacing: -1,
    textAlign: "center",
  },

  adjustBtn: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: "#111c17",
    borderWidth: 1,
    borderColor: "#1c2b24",
    alignItems: "center",
    justifyContent: "center",
  },

  adjustBtnText: {
    color: "#4caf7d",
    fontSize: 32,
    lineHeight: 36,
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
  },

  startBtnTextRunning: {
    color: "#5a7a68",
  },
});
