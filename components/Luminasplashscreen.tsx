import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";

const { width, height } = Dimensions.get("window");

interface LuminaSplashScreenProps {
  showOnboardingDots?: boolean;
}

function useFadeUp(delay: number) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 700,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 700,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return {
    opacity,
    transform: [{ translateY }],
  };
}

function FloatingOrb({
  style,
  duration,
  range = 12,
}: {
  style: any;
  duration: number;
  range?: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();

    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={[
        style,
        {
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -range],
              }),
            },
          ],
        },
      ]}
    />
  );
}

function Particle({
  x,
  size,
  delay,
  duration,
  startY,
}: {
  x: number;
  size: number;
  delay: number;
  duration: number;
  startY: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();

    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: x,
        top: startY,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "rgba(160,140,255,0.6)",
        opacity: anim.interpolate({
          inputRange: [0, 0.1, 0.85, 1],
          outputRange: [0, 0.8, 0.4, 0],
        }),
        transform: [
          {
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -220],
            }),
          },
          {
            scale: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0.3],
            }),
          },
        ],
      }}
    />
  );
}

export default function LuminaSplashScreen({
  showOnboardingDots = false,
}: LuminaSplashScreenProps) {
  const logoAnim = useFadeUp(100);
  const titleAnim = useFadeUp(250);
  const subtitleAnim = useFadeUp(400);
  const dotsAnim = useFadeUp(700);

  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();

    return () => loop.stop();
  }, []);

  const particles = useRef(
    Array.from({ length: 16 }, (_, i) => ({
      id: i,
      x: Math.random() * width,
      size: Math.random() * 3 + 1,
      delay: Math.random() * 7000,
      duration: (Math.random() * 8 + 5) * 1000,
      startY: height * 0.55 + Math.random() * 200,
    })),
  ).current;

  return (
    <View style={styles.container}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      <FloatingOrb style={styles.mainOrb} duration={6000} range={15} />

      <FloatingOrb style={styles.leftOrb} duration={9000} range={18} />

      <FloatingOrb style={styles.rightOrb} duration={11000} range={12} />

      {particles.map((particle) => (
        <Particle key={particle.id} {...particle} />
      ))}

      <View style={styles.content}>
        <Animated.View style={logoAnim}>
          <Animated.View
            style={[
              styles.logoOuter,
              {
                opacity: breathe.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.75, 1],
                }),
              },
            ]}
          >
            <View style={styles.logoMiddle}>
              <View style={styles.logoInner}>
                <Animated.View
                  style={[
                    styles.logoCore,
                    {
                      transform: [
                        {
                          scale: breathe.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 1.12],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              </View>
            </View>
          </Animated.View>
        </Animated.View>

        <Animated.Text style={[styles.title, titleAnim]}>Lumina</Animated.Text>

        <Animated.Text style={[styles.subtitle, subtitleAnim]}>
          YOUR SANCTUARY FOR FOCUS
        </Animated.Text>
      </View>

      {false && (
        <Animated.View style={[styles.dotsContainer, dotsAnim]}>
          <View style={[styles.dot, styles.activeDot]} />
          <View style={styles.dot} />
        </Animated.View>
      )}
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

  content: {
    alignItems: "center",
    zIndex: 2,
  },

  mainOrb: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(140,120,255,0.10)",
    top: height * 0.28,
    left: width / 2 - 140,
  },

  leftOrb: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(160,140,255,0.07)",
    top: height * 0.22,
    left: width * 0.08,
  },

  rightOrb: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(90,180,255,0.06)",
    top: height * 0.48,
    right: width * 0.08,
  },

  logoOuter: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 1,
    borderColor: "rgba(160,140,255,0.10)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 28,
  },

  logoMiddle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    borderColor: "rgba(160,140,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
  },

  logoInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(160,140,255,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },

  logoCore: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#9b8df0",
  },

  title: {
    fontSize: 52,
    fontWeight: "700",
    color: "#c4b8ff",
    letterSpacing: -2,
  },

  subtitle: {
    marginTop: 12,
    fontSize: 10,
    letterSpacing: 4,
    color: "rgba(180,170,210,0.5)",
  },

  dotsContainer: {
    position: "absolute",
    bottom: 48,
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
