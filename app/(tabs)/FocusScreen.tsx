// app/focus/FocusScreen.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  Animated,
  Dimensions,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { PanGestureHandler } from "react-native-gesture-handler";

import { SafeAreaView } from "react-native-safe-area-context";

import { Ionicons } from "@expo/vector-icons";

import { LinearGradient } from "expo-linear-gradient";

import AmbienceSheet from "@/components/AmbienceSheet";
import DurationSheet from "@/components/DurationSheet";
import LuminaStatusBar from "@/components/LuminaStatusBar";

const { width, height } = Dimensions.get("window");

const TIMER_SIZE = width < 380 ? 240 : 280;

const SLIDER_WIDTH = width - 48;

const KNOB_SIZE = 68;

const AMBIENCE_THEMES = {
  "Forest Rain": {
    gradient: ["#DCE7E0", "#B8C8BE", "#738579"],

    accent: "#486556",

    button: "#486556",

    overlay: "rgba(30,40,34,0.18)",

    subtitle: "Nature restores focus.",

    bgImage: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",

    icon: "rainy-outline",
  },

  "Midnight Waves": {
    gradient: ["#1F2B48", "#34466E", "#7183B7"],

    accent: "#DCE6FF",

    button: "#34466E",

    overlay: "rgba(10,14,24,0.32)",

    subtitle: "Flow deeply into calm clarity.",

    bgImage: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e",

    icon: "moon-outline",
  },

  "Zen Garden": {
    gradient: ["#ECE9E1", "#D3C9B9", "#8D8478"],

    accent: "#445046",

    button: "#4F6256",

    overlay: "rgba(40,38,32,0.12)",

    subtitle: "Stillness sharpens intention.",

    bgImage: "https://images.unsplash.com/photo-1494526585095-c41746248156",

    icon: "leaf-outline",
  },

  "Arctic Wind": {
    gradient: ["#EEF6FF", "#C5D7E8", "#7E9CB6"],

    accent: "#2D4B60",

    button: "#43627A",

    overlay: "rgba(20,28,36,0.14)",

    subtitle: "Cold air. Clear thoughts.",

    bgImage: "https://images.unsplash.com/photo-1517783999520-f068d7431a60",

    icon: "snow-outline",
  },
} as const;

const DURATIONS = [15, 25, 45, 60];

export default function FocusScreen() {
  const [selectedDuration, setSelectedDuration] = useState(25);

  const [selectedAmbience, setSelectedAmbience] = useState("Forest Rain");

  const [sessionActive, setSessionActive] = useState(false);

  const [paused, setPaused] = useState(false);

  const [showDurationSheet, setShowDurationSheet] = useState(false);

  const [showAmbienceSheet, setShowAmbienceSheet] = useState(false);

  const [remainingSeconds, setRemainingSeconds] = useState(
    selectedDuration * 60,
  );

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const slideAnim = useRef(new Animated.Value(0)).current;

  const theme =
    AMBIENCE_THEMES[selectedAmbience as keyof typeof AMBIENCE_THEMES];

  // ─────────────────────────────────────
  // Reset timer
  // ─────────────────────────────────────

  useEffect(() => {
    if (!sessionActive) {
      setRemainingSeconds(selectedDuration * 60);
    }
  }, [selectedDuration]);

  // ─────────────────────────────────────
  // Timer logic
  // ─────────────────────────────────────

  useEffect(() => {
    if (!sessionActive || paused) {
      return;
    }

    intervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          endSession();

          return selectedDuration * 60;
        }

        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [sessionActive, paused, selectedDuration]);

  // ─────────────────────────────────────
  // Formatted time
  // ─────────────────────────────────────

  const formattedTime = useMemo(() => {
    const mins = Math.floor(remainingSeconds / 60);

    const secs = remainingSeconds % 60;

    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }, [remainingSeconds]);

  // ─────────────────────────────────────
  // Slider reset
  // ─────────────────────────────────────

  const resetSlider = () => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: false,
    }).start();
  };

  // ─────────────────────────────────────
  // Start
  // ─────────────────────────────────────

  const startSession = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    setRemainingSeconds(selectedDuration * 60);

    setSessionActive(true);

    setPaused(false);
  };

  // ─────────────────────────────────────
  // Pause
  // ─────────────────────────────────────

  const pauseSession = () => {
    setPaused((prev) => !prev);
  };

  // ─────────────────────────────────────
  // End
  // ─────────────────────────────────────

  const endSession = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = null;

    setSessionActive(false);

    setPaused(false);

    setRemainingSeconds(selectedDuration * 60);

    resetSlider();
  };

  return (
    <>
      <LuminaStatusBar
        translucent
        backgroundColor="transparent"
        barStyle="dark-content"
      />

      <ImageBackground
        source={{
          uri: theme.bgImage,
        }}
        resizeMode="cover"
        style={styles.flex}
      >
        <View
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: theme.overlay,
            },
          ]}
        />

        <LinearGradient colors={theme.gradient} style={styles.flex}>
          <SafeAreaView style={styles.flex}>
            <View style={styles.content}>
              {/* Hero */}

              <View style={styles.hero}>
                <Text
                  style={[
                    styles.journeyLabel,
                    {
                      color: theme.accent,
                    },
                  ]}
                >
                  CURRENT JOURNEY
                </Text>

                <Text
                  style={[
                    styles.ambienceTitle,
                    {
                      color: theme.accent,
                    },
                  ]}
                >
                  {selectedAmbience}
                </Text>

                <Text
                  style={[
                    styles.subtitle,
                    {
                      color: theme.accent,
                    },
                  ]}
                >
                  {theme.subtitle}
                </Text>
              </View>

              {/* Timer */}

              <View
                style={[
                  styles.timerCircle,
                  {
                    width: TIMER_SIZE,
                    height: TIMER_SIZE,
                    borderRadius: TIMER_SIZE / 2,

                    borderColor: `${theme.accent}40`,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.timerText,
                    {
                      color: theme.accent,
                    },
                  ]}
                >
                  {formattedTime}
                </Text>

                <Ionicons
                  name={theme.icon as keyof typeof Ionicons.glyphMap}
                  size={42}
                  color={theme.accent}
                />
              </View>

              {/* Controls */}

              {!sessionActive ? (
                <>
                  <PanGestureHandler
                    onGestureEvent={(event: any) => {
                      const x = event.nativeEvent.translationX;

                      if (x >= 0 && x <= SLIDER_WIDTH - KNOB_SIZE) {
                        slideAnim.setValue(x);
                      }
                    }}
                    onEnded={(event) => {
                      const x = event.nativeEvent.translationX as any;

                      if (x > 180) {
                        Animated.timing(slideAnim, {
                          toValue: SLIDER_WIDTH - KNOB_SIZE - 14,

                          duration: 180,

                          useNativeDriver: false,
                        }).start(() => {
                          startSession();
                        });
                      } else {
                        resetSlider();
                      }
                    }}
                  >
                    <View style={styles.sliderContainer}>
                      <Text style={styles.sliderText}>Slide to Focus</Text>

                      <Animated.View
                        style={[
                          styles.sliderKnob,
                          {
                            backgroundColor: theme.button,

                            transform: [
                              {
                                translateX: slideAnim,
                              },
                            ],
                          },
                        ]}
                      >
                        <Ionicons name="flash-outline" size={28} color="#fff" />
                      </Animated.View>
                    </View>
                  </PanGestureHandler>

                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.secondaryBtn}
                      onPress={() => setShowDurationSheet(true)}
                    >
                      <Text style={styles.secondaryBtnText}>Duration</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.secondaryBtn}
                      onPress={() => setShowAmbienceSheet(true)}
                    >
                      <Text style={styles.secondaryBtnText}>Ambience</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={[
                      styles.pauseButton,
                      {
                        backgroundColor: theme.button,
                      },
                    ]}
                    onPress={pauseSession}
                  >
                    <Ionicons
                      name={paused ? "play" : "pause"}
                      size={22}
                      color="#fff"
                    />

                    <Text style={styles.pauseButtonText}>
                      {paused ? "Resume Focus" : "Pause Focus"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={endSession}>
                    <Text style={styles.endSession}>End Session</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Music Card */}

              <View style={styles.activeCard}>
                <View style={styles.activeLeft}>
                  <Ionicons
                    name={theme.icon as keyof typeof Ionicons.glyphMap}
                    size={30}
                    color={theme.accent}
                  />

                  <View>
                    <Text
                      style={[
                        styles.activeText,
                        {
                          color: theme.accent,
                        },
                      ]}
                    >
                      {selectedAmbience}
                    </Text>

                    <Text style={styles.activeSubtext}>
                      {sessionActive
                        ? "Soundscape active"
                        : "Ready for your session"}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity style={styles.soundBtn}>
                  <Ionicons
                    name={sessionActive ? "volume-high" : "volume-medium"}
                    size={22}
                    color={theme.accent}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </ImageBackground>

      <DurationSheet
        visible={showDurationSheet}
        selectedDuration={selectedDuration}
        durations={DURATIONS}
        onClose={() => setShowDurationSheet(false)}
        onSelect={(duration) => {
          setSelectedDuration(duration);

          // setShowDurationSheet(false);
        }}
      />

      <AmbienceSheet
        visible={showAmbienceSheet}
        selectedAmbience={selectedAmbience}
        onClose={() => setShowAmbienceSheet(false)}
        onSelect={(ambience) => {
          setSelectedAmbience(ambience);

          setShowAmbienceSheet(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  content: {
    flex: 1,

    paddingHorizontal: 24,

    paddingTop: 16,

    paddingBottom: 24,

    justifyContent: "space-between",
  },

  hero: {
    alignItems: "center",

    marginTop: height < 700 ? 10 : 28,
  },

  journeyLabel: {
    fontSize: 13,

    letterSpacing: 4,

    opacity: 0.75,
  },

  ambienceTitle: {
    marginTop: 12,

    fontSize: width < 380 ? 38 : 48,

    fontWeight: "300",
  },

  subtitle: {
    marginTop: 10,

    fontSize: 15,

    opacity: 0.8,
  },

  timerCircle: {
    alignSelf: "center",

    justifyContent: "center",

    alignItems: "center",

    backgroundColor: "rgba(255,255,255,0.08)",

    borderWidth: 1.5,
  },

  timerText: {
    fontSize: width < 380 ? 58 : 72,

    fontWeight: "200",

    marginBottom: 12,
  },

  sliderContainer: {
    height: 82,

    borderRadius: 41,

    justifyContent: "center",

    overflow: "hidden",

    backgroundColor: "rgba(255,255,255,0.26)",
  },

  sliderText: {
    alignSelf: "center",

    fontSize: 22,

    fontWeight: "700",

    color: "rgba(20,30,25,0.45)",
  },

  sliderKnob: {
    position: "absolute",

    left: 7,

    width: 68,

    height: 68,

    borderRadius: 34,

    justifyContent: "center",

    alignItems: "center",
  },

  actionRow: {
    flexDirection: "row",

    marginTop: 16,

    gap: 16,
  },

  secondaryBtn: {
    flex: 1,

    height: 56,

    borderRadius: 28,

    justifyContent: "center",

    alignItems: "center",

    backgroundColor: "rgba(255,255,255,0.28)",
  },

  secondaryBtnText: {
    fontSize: 16,

    fontWeight: "600",

    color: "#23352D",
  },

  pauseButton: {
    height: 82,

    borderRadius: 41,

    marginTop: 12,

    flexDirection: "row",

    justifyContent: "center",

    alignItems: "center",

    gap: 10,
  },

  pauseButtonText: {
    color: "#fff",

    fontSize: 22,

    fontWeight: "700",
  },

  endSession: {
    marginTop: 18,

    textAlign: "center",

    fontSize: 18,

    fontWeight: "500",

    color: "rgba(20,30,25,0.6)",
  },

  activeCard: {
    height: 90,

    borderRadius: 30,

    backgroundColor: "rgba(255,255,255,0.22)",

    borderWidth: 1,

    borderColor: "rgba(255,255,255,0.16)",

    paddingHorizontal: 20,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",
  },

  activeLeft: {
    flexDirection: "row",

    alignItems: "center",

    gap: 14,
  },

  activeText: {
    fontSize: 18,

    fontWeight: "700",
  },

  activeSubtext: {
    marginTop: 4,

    fontSize: 13,

    color: "rgba(20,30,25,0.55)",
  },

  soundBtn: {
    width: 48,

    height: 48,

    borderRadius: 24,

    justifyContent: "center",

    alignItems: "center",

    backgroundColor: "rgba(255,255,255,0.18)",
  },
});
