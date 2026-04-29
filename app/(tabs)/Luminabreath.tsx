import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function Luminabreath() {
  const blob1X = useRef(new Animated.Value(0)).current;
  const blob1Y = useRef(new Animated.Value(0)).current;
  const blob2X = useRef(new Animated.Value(0)).current;
  const blob2Y = useRef(new Animated.Value(0)).current;
  const [seconds, setSeconds] = useState(10);

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

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={["#C1C4C7", "#E8EBEF", "#D3D3D3"]}
        style={StyleSheet.absoluteFill}
      >
        <Animated.View
          style={[
            styles.blob,
            {
              top: "10%",
              left: "20%",
              transform: [{ translateX: blob1X }, { translateY: blob1Y }],
              overflow: "hidden",
            },
          ]}
        >
          <LinearGradient
            colors={["#BDCAC7", "#E3E6E9"]}
            style={styles.blobInner}
          >
            <BlurView
              intensity={1} // adjust blur strength
              tint="light"
              style={StyleSheet.absoluteFill}
            />
          </LinearGradient>
        </Animated.View>
        <Animated.View
          style={[
            styles.blob,
            {
              bottom: "20%",
              right: "10%",
              transform: [{ translateX: blob1X }, { translateY: blob1Y }],
              overflow: "hidden",
            },
          ]}
        >
          <LinearGradient
            colors={["#E3E6E9", "#BDCAC7"]}
            style={styles.blobInner}
          >
            <BlurView
              intensity={60} // adjust blur strength
              tint="light"
              style={StyleSheet.absoluteFill}
            />
          </LinearGradient>
        </Animated.View>
        <View style={styles.content}>
          {/* <View style={styles.header}>
            <Text style={styles.logo}>Lumina</Text>
            <View style={styles.headerIcons}>
              <View style={styles.avatarIcon}>
                <Text>👤</Text>
              </View>
              <Text style={styles.settingsIcon}>⚙️</Text>
            </View>
          </View> */}

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
              <Text style={{ fontSize: 20, color: "#E5FFF2" }}>⏱</Text>
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
            <View>
              <Text style={styles.leaf}>🌿</Text>
              <Text style={styles.wellbeingText}>
                {"YOUR WELLBEING IS\nA PRIORITY"}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn}>
              <Link href="/breathdelay" asChild>
                <Text style={styles.closeBtnText}>✕</Text>
              </Link>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingTop: 52 },

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

  //circle
  circleWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 32,
    marginBottom: 28,
    height: 180,
  },
  outerRing: {
    position: "absolute",
    backgroundColor: "#BDCAC7",
    opacity: 0.6,
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  innerCircle: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    elevation: 1,
  },
  countdownNum: {
    fontFamily: "DMSerifDisplay_400Regular",
    fontWeight: "700",
    fontSize: 36,
    color: "#4A655A",
  },
  countdownLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6a8a72",
    letterSpacing: 2,
  },

  // Text
  headline: {
    fontSize: 30,
    fontWeight: "700",
    color: "#1a2e22",
    textAlign: "center",
    lineHeight: 37.5,
    paddingHorizontal: 20,
    fontFamily: "DMSerifDisplay_400Regular",
  },
  subtitle: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: "#5a7060",
    textAlign: "center",
    lineHeight: 22.8,
    marginTop: 12,
    paddingHorizontal: 20,
  },

  // Card
  card: {
    flexDirection: "row",
    backgroundColor: "#CFD7E3",
    borderRadius: 20,
    padding: 18,
    marginHorizontal: 20,
    gap: 14,
    elevation: 2,
  },
  cardIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#3E594E",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between" },
  cardTitle: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: "#4A655A",
  },
  cardTime: {
    fontSize: 10,
    fontWeight: "600",
    color: "#717C8A",
    lineHeight: 15,
  },
  cardBody: { fontSize: 14, color: "#293340", lineHeight: 19.3 },
  cardActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  breakBtn: {
    backgroundColor: "#3E594E",
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  breakBtnText: {
    fontFamily: "DMSans_700Bold",
    color: "#E5FFF2",
    fontSize: 12,
    fontWeight: "400",
  },
  continueBtn: {
    backgroundColor: "#E2E8F3",
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  continueBtnText: { color: "#55606E", fontSize: 14, fontWeight: "600" },

  // Bottom
  bottomBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 24,
    paddingVertical: 65,
  },
  leaf: { fontSize: 24, opacity: 0.5 },
  wellbeingText: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 10,
    color: "#A8B3C3",
    lineHeight: 15,
  },
  closeBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#E4DFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: { fontSize: 18, color: "#3a3a4a" },
});
