import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const LOTUS = require("../assets/images/splash-lotus.png");

interface LuminaSplashScreenProps {
  showOnboardingDots?: boolean;
}

export default function LuminaSplashScreen({
  showOnboardingDots = false,
}: LuminaSplashScreenProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const enter = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe, enter]);

  const glowSize = Math.min(width * 0.92, 380);

  return (
    <View style={styles.container}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      <LinearGradient
        colors={["#14122A", "#080810", "#05050A"]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            width: glowSize,
            height: glowSize,
            borderRadius: glowSize / 2,
            top: height * 0.22,
            left: (width - glowSize) / 2,
          },
        ]}
      />

      <Animated.View
        style={[
          styles.content,
          {
            opacity: enter,
            transform: [
              {
                translateY: enter.interpolate({
                  inputRange: [0, 1],
                  outputRange: [18, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Animated.View
          style={{
            transform: [
              {
                scale: breathe.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.045],
                }),
              },
            ],
            opacity: breathe.interpolate({
              inputRange: [0, 1],
              outputRange: [0.88, 1],
            }),
          }}
        >
          <Image source={LOTUS} style={styles.lotus} resizeMode="contain" />
        </Animated.View>

        <Animated.Text style={styles.title}>Lumina</Animated.Text>
        <Animated.Text style={styles.subtitle}>
          YOUR SANCTUARY FOR FOCUS
        </Animated.Text>
      </Animated.View>

      {showOnboardingDots ? (
        <View style={[styles.dots, { bottom: Math.max(insets.bottom, 16) + 28 }]}>
          <View style={[styles.dot, styles.activeDot]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#080810",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  glow: {
    position: "absolute",
    backgroundColor: "rgba(109,106,248,0.22)",
  },
  content: {
    alignItems: "center",
    zIndex: 2,
    marginTop: -24,
  },
  lotus: {
    width: 196,
    height: 196,
    marginBottom: 8,
  },
  title: {
    fontFamily: "DMSerifDisplay_400Regular",
    fontSize: 54,
    color: "#E4DEFF",
    letterSpacing: -0.8,
  },
  subtitle: {
    marginTop: 14,
    fontFamily: "DMSans_600SemiBold",
    fontSize: 11,
    letterSpacing: 3.6,
    color: "rgba(196,184,255,0.55)",
  },
  dots: {
    position: "absolute",
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(160,140,255,0.25)",
  },
  activeDot: {
    width: 18,
    borderRadius: 100,
    backgroundColor: "rgba(160,140,255,0.85)",
  },
});
