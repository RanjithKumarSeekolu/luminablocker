import { allowApp, cancelApp } from "@/modules/lumina-blocker";
import {
  DMSans_400Regular,
  DMSans_600SemiBold,
} from "@expo-google-fonts/dm-sans";
import { DMSerifDisplay_400Regular } from "@expo-google-fonts/dm-serif-display";
import { useFonts } from "expo-font";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ── Types ─────────────────────────────────────────────────────

type BreathPhase = "INHALE" | "HOLD" | "EXHALE";

type Props = {
  /** Display name shown on screen e.g. "Instagram" */
  appName?: string;
  /**
   * Package name e.g. "com.instagram.android"
   * Required for allowApp() / cancelApp() native calls.
   * If not provided (e.g. preview mode) native calls are skipped.
   */
  packageName?: string;
  /** Intervention level — controls countdown length */
  level?: 1 | 2 | 3 | 4;
  /** Opens per hour today — shown in stats line */
  opensThisHour?: number;
  /** Last session duration in minutes — shown in stats line */
  lastSessionMins?: number;
  /** Called after allowApp() native call completes */
  onProceed?: () => void;
  /** Called after cancelApp() native call completes */
  onCancel?: () => void;
};

// ── Constants ─────────────────────────────────────────────────

const INHALE_MS = 4000;
const HOLD_MS = 2000;
const EXHALE_MS = 4000;

const LEVEL_META = {
  1: { label: "LEVEL 1 · GENTLE", countdownSec: 0 },
  2: { label: "LEVEL 2 · MODERATE", countdownSec: 5 },
  3: { label: "LEVEL 3 · FOCUSED", countdownSec: 10 },
  4: { label: "LEVEL 4 · DEEP PAUSE", countdownSec: 15 },
} as const;

const LEVEL_BADGE_COLORS = {
  1: { bg: "#1a3a2a", text: "#4a9a6a" },
  2: { bg: "#2a3a1a", text: "#6a9a3a" },
  3: { bg: "#3a3a1a", text: "#9a8a2a" },
  4: { bg: "#3a2a1a", text: "#9a5a2a" },
} as const;

// ── Component ─────────────────────────────────────────────────

export default function BreathDelayScreen({
  appName = "this app",
  packageName,
  level = 2,
  opensThisHour = 0,
  lastSessionMins = 0,
  onProceed,
  onCancel,
}: Props) {
  const insets = useSafeAreaInsets();

  // NOTE: SplashScreen.preventAutoHideAsync() deliberately NOT here.
  // It must only be called from _layout.tsx or the app entry point.
  const [fontsLoaded] = useFonts({
    DMSerifDisplay_400Regular,
    DMSans_400Regular,
    DMSans_600SemiBold,
  });

  const meta = LEVEL_META[level];
  const badgeColors = LEVEL_BADGE_COLORS[level];

  const [phase, setPhase] = useState<BreathPhase>("INHALE");
  const [seconds, setSeconds] = useState<number>(meta.countdownSec);
  const [canProceed, setCanProceed] = useState(level === 1);

  const breathScale = useRef(new Animated.Value(0.72)).current;
  const ring1Opacity = useRef(new Animated.Value(0.12)).current;
  const ring2Opacity = useRef(new Animated.Value(0.07)).current;

  // ── Breathing animation loop ─────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    const runCycle = () => {
      if (cancelled) return;

      setPhase("INHALE");
      Animated.timing(breathScale, {
        toValue: 1,
        duration: INHALE_MS,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished || cancelled) return;

        setPhase("HOLD");
        setTimeout(() => {
          if (cancelled) return;

          setPhase("EXHALE");
          Animated.timing(breathScale, {
            toValue: 0.72,
            duration: EXHALE_MS,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }).start(({ finished }) => {
            if (finished && !cancelled) runCycle();
          });
        }, HOLD_MS);
      });
    };

    runCycle();
    return () => {
      cancelled = true;
      breathScale.stopAnimation();
    };
  }, []);

  // ── Outer ring pulse ─────────────────────────────────────────

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ring1Opacity, {
            toValue: 0.22,
            duration: 3000,
            useNativeDriver: true,
          }),
          Animated.timing(ring2Opacity, {
            toValue: 0.13,
            duration: 3000,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(ring1Opacity, {
            toValue: 0.08,
            duration: 3000,
            useNativeDriver: true,
          }),
          Animated.timing(ring2Opacity, {
            toValue: 0.04,
            duration: 3000,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // ── Countdown ────────────────────────────────────────────────

  useEffect(() => {
    if (seconds <= 0) {
      setCanProceed(true);
      return;
    }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  // ── Actions ──────────────────────────────────────────────────

  const handleProceed = () => {
    // Call native allowApp() so the accessibility service lets the app through.
    // Skip if no packageName (e.g. preview/storybook mode).
    if (packageName) {
      allowApp(packageName);
    }
    onProceed?.();
  };

  const handleCancel = () => {
    // Call native cancelApp() to clear breathScreenActive.
    // Cancel is ALWAYS available — no cooldown punishment.
    if (packageName) {
      cancelApp(packageName);
    }
    onCancel?.();
  };

  // ── Render ───────────────────────────────────────────────────

  if (!fontsLoaded) return null;

  const phaseColor =
    phase === "INHALE" ? "#a8d5b5" : phase === "HOLD" ? "#c8e6d0" : "#7ab89a";

  const statsLine = [
    opensThisHour > 1 ? `Opened ${opensThisHour}x this hour` : null,
    lastSessionMins > 0 ? `Last session ${lastSessionMins} min` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
      {/* Level badge */}
      <View style={[styles.badge, { backgroundColor: badgeColors.bg }]}>
        <Text style={[styles.badgeText, { color: badgeColors.text }]}>
          {meta.label}
        </Text>
      </View>

      {/* Title */}
      <Text style={styles.title}>Breath Delay</Text>

      {/* Stats — only shown when there's something to say */}
      {statsLine.length > 0 && <Text style={styles.stats}>{statsLine}</Text>}

      {/* Breathing circle */}
      <View style={styles.circleContainer}>
        <Animated.View
          style={[styles.ring, styles.ring2, { opacity: ring2Opacity }]}
        />
        <Animated.View
          style={[styles.ring, styles.ring1, { opacity: ring1Opacity }]}
        />
        <Animated.View
          style={[styles.breathBlob, { transform: [{ scale: breathScale }] }]}
        >
          <View style={styles.breathInner}>
            <Text style={[styles.phaseLabel, { color: phaseColor }]}>
              {phase}
            </Text>
          </View>
        </Animated.View>
      </View>

      {/* Subtitle */}
      <Text style={styles.subtitle}>
        Take a breath before opening{"\n"}
        <Text style={styles.appNameBold}>{appName}</Text>
      </Text>

      {/* Countdown */}
      <View style={styles.countdownCircle}>
        <Text style={styles.countdownNum}>{canProceed ? "✓" : seconds}</Text>
      </View>

      {/* Proceed — visible only after countdown */}
      {canProceed && (
        <TouchableOpacity style={styles.proceedBtn} onPress={handleProceed}>
          <Text style={styles.proceedText}>→ OPEN {appName.toUpperCase()}</Text>
        </TouchableOpacity>
      )}

      {/* Cancel — ALWAYS tappable (no cooldown punishment) */}
      <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
        <Text style={styles.cancelText}>
          {canProceed ? "✕  CLOSE" : "✕  GO BACK"}
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
    alignItems: "center",
    paddingHorizontal: 24,
  },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 20,
  },
  badgeText: {
    fontSize: 10,
    letterSpacing: 2,
    fontFamily: "DMSans_600SemiBold",
  },
  title: {
    fontFamily: "DMSerifDisplay_400Regular",
    fontSize: 32,
    color: "#e8f0eb",
    marginBottom: 8,
  },
  stats: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: "#5a7a68",
    marginBottom: 28,
    textAlign: "center",
  },
  circleContainer: {
    width: 300,
    height: 300,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 40,
  },
  ring: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#4a7a5a",
  },
  ring1: { width: 280, height: 280 },
  ring2: { width: 300, height: 300 },
  breathBlob: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#1e3328",
    justifyContent: "center",
    alignItems: "center",
  },
  breathInner: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "#2a4a38",
    justifyContent: "center",
    alignItems: "center",
  },
  phaseLabel: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 16,
    letterSpacing: 3,
  },
  subtitle: {
    fontFamily: "DMSans_400Regular",
    fontSize: 18,
    color: "#c0d4c8",
    textAlign: "center",
    marginBottom: 28,
    lineHeight: 28,
  },
  appNameBold: {
    fontFamily: "DMSans_600SemiBold",
    color: "#e8f0eb",
  },
  countdownCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: "#4a7a5a",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  countdownNum: {
    fontFamily: "DMSerifDisplay_400Regular",
    fontSize: 26,
    color: "#e8f0eb",
  },
  proceedBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  proceedText: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 12,
    color: "#4caf7d",
    letterSpacing: 2.5,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  cancelText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: "#5a7a68",
    letterSpacing: 2.5,
  },
});
