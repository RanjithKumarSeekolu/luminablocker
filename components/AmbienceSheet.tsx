// components/AmbienceSheet.tsx

import React, { useEffect, useRef } from "react";

import {
  Animated,
  ImageBackground,
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

  selectedAmbience: string;

  onClose: () => void;

  onSelect: (ambience: string) => void;
};

const AMBIENCES = [
  {
    id: "forest",
    title: "Forest Rain",
    icon: "rainy-outline",
    image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
  },
  {
    id: "waves",
    title: "Midnight Waves",
    icon: "water-outline",
    image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e",
  },
  {
    id: "zen",
    title: "Zen Garden",
    icon: "leaf-outline",
    image: "https://images.unsplash.com/photo-1494526585095-c41746248156",
  },
  {
    id: "wind",
    title: "Arctic Wind",
    icon: "snow-outline",
    image: "https://images.unsplash.com/photo-1516117172878-fd2c41f4a759",
  },
];

export default function AmbienceSheet({
  visible,
  selectedAmbience,
  onClose,
  onSelect,
}: Props) {
  const translateY = useRef(new Animated.Value(500)).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible ? 0 : 500,
      useNativeDriver: true,
      damping: 18,
      stiffness: 120,
      mass: 0.8,
    }).start();
  }, [visible]);

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

        <Text style={styles.title}>Select Ambience</Text>

        <Text style={styles.subtitle}>Choose a soundscape for your flow.</Text>

        {AMBIENCES.map((item) => {
          const active = selectedAmbience === item.title;

          return (
            <Pressable key={item.id} onPress={() => onSelect(item.title)}>
              <ImageBackground
                source={{
                  uri: item.image,
                }}
                imageStyle={{
                  borderRadius: 32,
                }}
                style={[styles.card, active && styles.cardActive]}
              >
                <View style={styles.cardOverlay}>
                  <View style={styles.iconWrap}>
                    <Ionicons
                      name={item.icon as any}
                      size={24}
                      color="#486556"
                    />
                  </View>

                  <Text style={styles.cardTitle}>{item.title}</Text>
                </View>
              </ImageBackground>
            </Pressable>
          );
        })}

        <Pressable style={styles.confirmBtn} onPress={onClose}>
          <Text style={styles.confirmText}>Confirm Selection</Text>
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
    fontSize: 38,
    fontWeight: "700",
    color: "#1C2738",
  },

  subtitle: {
    marginTop: 10,
    fontSize: 19,
    color: "#7A8596",
    marginBottom: 28,
  },

  card: {
    height: 140,
    borderRadius: 32,
    overflow: "hidden",
    marginBottom: 18,
    justifyContent: "flex-end",
  },

  cardActive: {
    borderWidth: 3,
    borderColor: "#BFE3D1",
  },

  cardOverlay: {
    flexDirection: "row",
    alignItems: "center",

    backgroundColor: "rgba(255,255,255,0.5)",

    padding: 18,
  },

  iconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,

    backgroundColor: "rgba(255,255,255,0.7)",

    alignItems: "center",
    justifyContent: "center",
  },

  cardTitle: {
    marginLeft: 18,
    fontSize: 20,
    fontWeight: "700",
    color: "#3E4C63",
  },

  confirmBtn: {
    marginTop: 14,

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
