import {
  DMSans_400Regular,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import { DMSerifDisplay_400Regular } from "@expo-google-fonts/dm-serif-display";
import { useFonts } from "expo-font";
import { LinearGradient } from "expo-linear-gradient";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

SplashScreen.preventAutoHideAsync();

export default function LuminaBreathScreen() {
  // ✅ ALL hooks at the top — before any conditional return
  const [fontsLoaded] = useFonts({
    DMSerifDisplay_400Regular,
    DMSans_400Regular,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });

  const blob1X = useRef(new Animated.Value(0)).current;
  const blob1Y = useRef(new Animated.Value(0)).current;
  const blob2X = useRef(new Animated.Value(0)).current;
  const blob2Y = useRef(new Animated.Value(0)).current;
  const [seconds, setSeconds] = useState(5);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  useEffect(() => {
    const animate = (val: Animated.Value, range: number, duration: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(val, {
            toValue: range,
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: -range,
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(val, { toValue: 0, duration, useNativeDriver: true }),
        ]),
      );

    animate(blob1X, 40, 3000).start();
    animate(blob1Y, 30, 3500).start();
    animate(blob2X, -50, 4000).start();
    animate(blob2Y, 40, 2800).start();

    const timer = setInterval(() => {
      setSeconds((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ✅ Conditional return AFTER all hooks
  if (!fontsLoaded) return null;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#d4e8d4", "#c8dfd0", "#b8d4c0"]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        style={[
          styles.blob,
          {
            top: "10%",
            left: "20%",
            transform: [{ translateX: blob1X }, { translateY: blob1Y }],
          },
        ]}
      >
        <LinearGradient
          colors={["rgba(120,200,150,0.5)", "rgba(180,230,190,0.2)"]}
          style={styles.blobInner}
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.blob2,
          {
            bottom: "20%",
            right: "10%",
            transform: [{ translateX: blob2X }, { translateY: blob2Y }],
          },
        ]}
      >
        <LinearGradient
          colors={["rgba(160,210,180,0.45)", "rgba(200,240,210,0.15)"]}
          style={styles.blobInner}
        />
      </Animated.View>

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.logo}>Lumina</Text>
          <View style={styles.headerIcons}>
            <View style={styles.avatarIcon}>
              <Text>👤</Text>
            </View>
            <Text style={styles.settingsIcon}>⚙️</Text>
          </View>
        </View>

        <View style={styles.circleWrap}>
          <View style={styles.outerRing} />
          <View style={styles.innerCircle}>
            <Text style={styles.countdownNum}>{seconds}</Text>
            <Text style={styles.countdownLabel}>SECONDS</Text>
          </View>
        </View>

        <Text style={styles.headline}>
          Taking a breath before{"\n"}we open Instagram?
        </Text>
        <Text style={styles.subtitle}>
          A brief pause can help you decide if this is how{"\n"}you want to
          spend your time.
        </Text>

        <View style={{ flex: 1 }} />

        <View style={styles.card}>
          <View style={styles.cardIcon}>
            <Text style={{ fontSize: 20 }}>⏱</Text>
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Smart Nudge</Text>
              <Text style={styles.cardTime}>JUST NOW</Text>
            </View>
            <Text style={styles.cardBody}>
              You've been scrolling for 20 mins.{"\n"}Time for a break?
            </Text>
            <View style={styles.cardActions}>
              <TouchableOpacity style={styles.breakBtn}>
                <Text style={styles.breakBtnText}>Take a Break</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.continueBtn}>
                <Text style={styles.continueBtnText}>Continue anyway</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.bottomBar}>
          <Text style={styles.leaf}>🌿</Text>
          <TouchableOpacity style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// styles unchanged — paste your existing StyleSheet here

const styles = StyleSheet.create({
  // Key fix: flex:1 instead of absoluteFill so content can stack inside
  container: { flex: 1 },
  content: { flex: 1, paddingTop: 52 },

  // Background blobs (unchanged)
  blob: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    overflow: "hidden",
    opacity: 0.85,
  },
  blob2: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    overflow: "hidden",
    opacity: 0.75,
  },
  blobInner: { flex: 1 },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  logo: {
    fontSize: 24,
    color: "#1a5c3a",
    fontFamily: "DMSerifDisplay_400Regular",
  },
  headerIcons: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatarIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#4caf7d",
    alignItems: "center",
    justifyContent: "center",
  },
  settingsIcon: { fontSize: 22 },

  // Circle
  circleWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 32,
    marginBottom: 28,
    height: 180,
  },
  outerRing: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(120,180,140,0.35)",
  },
  innerCircle: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
  },
  countdownNum: {
    fontFamily: "DMSerifDisplay_400Regular",
    fontSize: 52,
    color: "#1a3a2a",
  },
  countdownLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6a8a72",
    letterSpacing: 2,
  },

  // Text
  headline: {
    fontSize: 26,
    color: "#1a2e22",
    textAlign: "center",
    lineHeight: 34,
    paddingHorizontal: 20,
    fontFamily: "DMSerifDisplay_400Regular",
  },
  subtitle: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: "#5a7060",
    textAlign: "center",
    lineHeight: 22,
    marginTop: 12,
    paddingHorizontal: 20,
  },

  // Card
  card: {
    flexDirection: "row",
    backgroundColor: "rgba(232,236,238,0.88)",
    borderRadius: 20,
    padding: 18,
    marginHorizontal: 16,
    gap: 14,
    elevation: 4,
  },
  cardIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#1a5c3a",
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between" },
  cardTitle: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 15,
    fontWeight: "700",
    color: "#1a2e22",
  },
  cardTime: { fontSize: 11, fontWeight: "600", color: "#8aaa90" },
  cardBody: { fontSize: 14, color: "#2e4a36", lineHeight: 20 },
  cardActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  breakBtn: {
    backgroundColor: "#1a5c3a",
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  breakBtnText: {
    fontFamily: "DMSans_700Bold",
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  continueBtn: {
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  continueBtnText: { color: "#2e4a36", fontSize: 14, fontWeight: "600" },

  // Bottom
  bottomBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  leaf: { fontSize: 24, opacity: 0.5 },
  closeBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(220,214,232,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: { fontSize: 18, color: "#3a3a4a" },
});
