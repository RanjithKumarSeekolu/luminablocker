// components/DurationSheet.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";

import { BlurView } from "expo-blur";

import { Ionicons } from "@expo/vector-icons";

type Props = {
  visible: boolean;

  selectedDuration: number;

  durations: number[];

  onClose: () => void;

  onSelect: (duration: number) => void;
};

export default function DurationSheet({
  visible,
  selectedDuration,
  durations,
  onClose,
  onSelect,
}: Props) {
  const translateY = useRef(new Animated.Value(500)).current;

  const [previewDuration, setPreviewDuration] = useState(selectedDuration);

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible ? 0 : 500,
      useNativeDriver: true,
      damping: 18,
      stiffness: 120,
      mass: 0.8,
    }).start();
  }, [visible]);

  useEffect(() => {
    setPreviewDuration(selectedDuration);
  }, [selectedDuration]);

  const getEndingTime = (mins: number) => {
    const date = new Date();

    date.setMinutes(date.getMinutes() + mins);

    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const endingTime = useMemo(() => {
    return getEndingTime(previewDuration);
  }, [previewDuration]);

  return (
    <Modal transparent visible={visible} animationType="none">
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <BlurView
            intensity={35}
            tint="light"
            style={StyleSheet.absoluteFill}
          />
        </View>
      </TouchableWithoutFeedback>

      <Animated.View
        style={[
          styles.sheet,
          {
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={styles.handle} />

        <Text style={styles.title}>Set Intention</Text>

        <Text style={styles.subtitle}>
          How long do you need to find your flow?
        </Text>

        <View style={styles.durationRow}>
          {durations.map((mins) => {
            const active = mins === selectedDuration;

            const scale = useRef(new Animated.Value(active ? 1.03 : 1)).current;

            return (
              <Pressable
                key={mins}
                onPress={() => {
                  setPreviewDuration(mins);

                  onSelect(mins);
                }}
                onPressIn={() => {
                  setPreviewDuration(mins);

                  Animated.spring(scale, {
                    toValue: 1.08,
                    useNativeDriver: true,
                    damping: 12,
                    stiffness: 180,
                  }).start();
                }}
                onPressOut={() => {
                  Animated.spring(scale, {
                    toValue: active ? 1.03 : 1,
                    useNativeDriver: true,
                    damping: 12,
                    stiffness: 180,
                  }).start();
                }}
              >
                <Animated.View
                  style={[
                    styles.durationCard,
                    active && styles.durationCardActive,
                    {
                      transform: [{ scale }],
                    },
                  ]}
                >
                  {active && (
                    <View style={styles.activeDot}>
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color="#FFFFFF"
                      />
                    </View>
                  )}

                  <Text
                    style={[
                      styles.durationNumber,
                      active && styles.durationNumberActive,
                    ]}
                  >
                    {mins}
                  </Text>

                  <Text
                    style={[
                      styles.durationLabel,
                      active && styles.durationLabelActive,
                    ]}
                  >
                    MINS
                  </Text>
                </Animated.View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.infoCard}>
          <Ionicons name="time-outline" size={28} color="#5D7B6F" />

          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Ending at {endingTime}</Text>

            <Text style={styles.infoSubtitle}>
              Focus session + short break included
            </Text>
          </View>
        </View>

        <Pressable style={styles.confirmBtn} onPress={onClose}>
          <Text style={styles.confirmText}>Confirm Duration</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.15)",
  },

  sheet: {
    position: "absolute",

    bottom: 0,
    left: 0,
    right: 0,

    backgroundColor: "#F5F7FA",

    borderTopLeftRadius: 42,
    borderTopRightRadius: 42,

    paddingHorizontal: 26,
    paddingTop: 18,
    paddingBottom: 42,
  },

  handle: {
    width: 70,
    height: 8,

    borderRadius: 99,

    backgroundColor: "#D7DCE4",

    alignSelf: "center",

    marginBottom: 26,
  },

  title: {
    fontSize: 42,

    fontWeight: "700",

    color: "#486556",

    textAlign: "center",
  },

  subtitle: {
    marginTop: 12,

    fontSize: 20,

    color: "#7A8596",

    textAlign: "center",

    marginBottom: 34,
  },

  durationRow: {
    flexDirection: "row",

    justifyContent: "space-between",
  },

  durationCard: {
    width: 74,
    height: 160,

    borderRadius: 38,

    backgroundColor: "#FFFFFF",

    justifyContent: "center",
    alignItems: "center",

    borderWidth: 1,

    borderColor: "#E6EBF1",

    shadowColor: "#000",

    shadowOpacity: 0.05,

    shadowRadius: 10,

    shadowOffset: {
      width: 0,
      height: 4,
    },

    elevation: 4,
  },

  durationCardActive: {
    backgroundColor: "#D9F0E5",

    borderColor: "#C8E9D9",

    shadowOpacity: 0.12,

    elevation: 8,
  },

  activeDot: {
    position: "absolute",

    top: -10,
    right: 18,

    width: 28,
    height: 28,

    borderRadius: 14,

    backgroundColor: "#4D6C5D",

    alignItems: "center",
    justifyContent: "center",
  },

  durationNumber: {
    fontSize: 28,

    fontWeight: "700",

    color: "#1D2A40",
  },

  durationNumberActive: {
    color: "#486556",
  },

  durationLabel: {
    marginTop: 6,

    fontSize: 14,

    fontWeight: "700",

    color: "#6F7888",
  },

  durationLabelActive: {
    color: "#486556",
  },

  infoCard: {
    marginTop: 42,

    flexDirection: "row",

    alignItems: "center",

    backgroundColor: "#FFFFFF",

    borderRadius: 30,

    padding: 22,

    borderWidth: 1,

    borderColor: "#EBEEF3",
  },

  infoContent: {
    marginLeft: 16,
  },

  infoTitle: {
    fontSize: 18,

    fontWeight: "700",

    color: "#1E2A40",
  },

  infoSubtitle: {
    marginTop: 4,

    fontSize: 15,

    color: "#7D8796",
  },

  confirmBtn: {
    marginTop: 32,

    height: 74,

    borderRadius: 37,

    backgroundColor: "#486556",

    alignItems: "center",
    justifyContent: "center",
  },

  confirmText: {
    fontSize: 22,

    fontWeight: "700",

    color: "#FFFFFF",
  },
});
