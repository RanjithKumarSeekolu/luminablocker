import {
  DMSans_400Regular,
  DMSans_600SemiBold,
} from "@expo-google-fonts/dm-sans";
import { DMSerifDisplay_400Regular } from "@expo-google-fonts/dm-serif-display";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
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

SplashScreen.preventAutoHideAsync();

type BreathPhase = "INHALE" | "HOLD" | "EXHALE";

const INHALE_DURATION = 4000;
const HOLD_DURATION = 2000;
const EXHALE_DURATION = 4000;

export default function BreathDelayScreen({
  appName = "Instagram",
  onCancel,
  countdownFrom = 5,
}: {
  appName?: string;
  onCancel?: () => void;
  countdownFrom?: number;
}) {
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({
    DMSerifDisplay_400Regular,
    DMSans_400Regular,
    DMSans_600SemiBold,
  });

  const [seconds, setSeconds] = useState(countdownFrom);
  const [phase, setPhase] = useState<BreathPhase>("INHALE");

  // Breathing circle scale — expands on inhale, shrinks on exhale
  const breathScale = useRef(new Animated.Value(0.72)).current;

  // Countdown arc rotation
  const arcRotation = useRef(new Animated.Value(0)).current;

  // Outer ring subtle pulse
  const ring1Opacity = useRef(new Animated.Value(0.12)).current;
  const ring2Opacity = useRef(new Animated.Value(0.07)).current;

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  // Breathing animation loop
  useEffect(() => {
    let cancelled = false;

    const runCycle = () => {
      if (cancelled) return;

      // INHALE
      setPhase("INHALE");
      Animated.timing(breathScale, {
        toValue: 1,
        duration: INHALE_DURATION,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished || cancelled) return;

        // HOLD
        setPhase("HOLD");
        setTimeout(() => {
          if (cancelled) return;

          // EXHALE
          setPhase("EXHALE");
          Animated.timing(breathScale, {
            toValue: 0.72,
            duration: EXHALE_DURATION,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }).start(({ finished }) => {
            if (finished && !cancelled) runCycle();
          });
        }, HOLD_DURATION);
      });
    };

    runCycle();
    return () => {
      cancelled = true;
      breathScale.stopAnimation();
    };
  }, []);

  // Countdown arc
  useEffect(() => {
    Animated.timing(arcRotation, {
      toValue: 1,
      duration: countdownFrom * 1000,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  // Outer rings breathe subtly
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

  if (!fontsLoaded) return null;

  const phaseColor =
    phase === "INHALE" ? "#a8d5b5" : phase === "HOLD" ? "#c8e6d0" : "#7ab89a";

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
      {/* Top icon */}
      <View style={styles.topIconWrap}>
        <View style={styles.topIconCircle}>
          <Text style={styles.topIconEmoji}>🌿</Text>
        </View>
      </View>

      {/* Title */}
      <Text style={styles.title}>Breath Delay</Text>

      {/* Breathing Circle */}
      <View style={styles.circleContainer}>
        {/* Outer decorative rings */}
        <Animated.View
          style={[styles.ring, styles.ring2, { opacity: ring2Opacity }]}
        />
        <Animated.View
          style={[styles.ring, styles.ring1, { opacity: ring1Opacity }]}
        />

        {/* Breathing blob */}
        <Animated.View
          style={[styles.breathBlob, { transform: [{ scale: breathScale }] }]}
        >
          {/* Inner glow circle */}
          <View style={styles.breathInner}>
            <Text style={[styles.phaseLabel, { color: phaseColor }]}>
              {phase}
            </Text>
          </View>
        </Animated.View>
      </View>

      {/* Text */}
      <Text style={styles.subtitle}>
        Take a breath before we open{"\n"}
        <Text style={styles.appNameBold}>{appName}</Text>
      </Text>

      {/* Countdown circle */}
      <View style={styles.countdownWrap}>
        <View style={styles.countdownCircle}>
          <Text style={styles.countdownNum}>{seconds}</Text>
        </View>
      </View>

      {/* Cancel */}
      <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
        <Text style={styles.cancelText}>✕ CANCEL JOURNEY</Text>
      </TouchableOpacity>

      <View style={{ height: insets.bottom + 16 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0e1412",
    alignItems: "center",
  },

  // Top icon
  topIconWrap: {
    marginBottom: 20,
  },
  topIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#1c2b24",
    alignItems: "center",
    justifyContent: "center",
  },
  topIconEmoji: {
    fontSize: 22,
  },

  // Title
  title: {
    fontFamily: "DMSerifDisplay_400Regular",
    fontSize: 32,
    color: "#e8f0eb",
    marginBottom: 40,
    letterSpacing: -0.5,
  },

  // Breathing circle area
  circleContainer: {
    width: 300,
    height: 300,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 48,
  },
  ring: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#4a7a5a",
  },
  ring1: {
    width: 280,
    height: 280,
  },
  ring2: {
    width: 300,
    height: 300,
  },
  breathBlob: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#1e3328",
    alignItems: "center",
    justifyContent: "center",
  },
  breathInner: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "#2a4a38",
    alignItems: "center",
    justifyContent: "center",
  },
  phaseLabel: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 16,
    letterSpacing: 3,
  },

  // Subtitle
  subtitle: {
    fontFamily: "DMSans_400Regular",
    fontSize: 18,
    color: "#c0d4c8",
    textAlign: "center",
    lineHeight: 28,
    paddingHorizontal: 32,
    marginBottom: 32,
  },
  appNameBold: {
    fontFamily: "DMSans_600SemiBold",
    color: "#e8f0eb",
  },

  // Countdown
  countdownWrap: {
    marginBottom: 36,
  },
  countdownCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: "#4a7a5a",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  countdownNum: {
    fontFamily: "DMSerifDisplay_400Regular",
    fontSize: 26,
    color: "#e8f0eb",
  },

  // Cancel
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
