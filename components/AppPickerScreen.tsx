// AppPickerScreen.tsx
import {
  addBlockedAppListener,
  getBlockedApps,
  getInstalledApps,
  isAccessibilityEnabled,
  openAccessibilitySettings,
  saveBlockedApps,
  type InstalledApp,
} from "@/modules/lumina-blocker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const POPULAR = [
  "com.instagram.android",
  "com.google.android.youtube",
  "com.zhiliaoapp.musically",
  "com.twitter.android",
  "com.facebook.katana",
  "com.snapchat.android",
  "com.reddit.frontpage",
];

export default function AppPickerScreen() {
  const router = useRouter();
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [accessibilityOn, setAccessibilityOn] = useState(false);

  useEffect(() => {
    // Load installed apps filtered to popular ones
    const installed = getInstalledApps();
    console.log("Installed apps:", installed);
    const filtered = installed.filter((a) => POPULAR.includes(a.packageName));
    setApps(filtered);
    console.log("Filtered apps:", filtered);

    // Load previously saved selections
    const saved = getBlockedApps();
    console.log("Saved blocked apps:", saved);
    setSelected(new Set(saved));

    // Check accessibility
    setAccessibilityOn(isAccessibilityEnabled());

    // Listen for blocked app trigger
    const sub = addBlockedAppListener((pkg) => {
      router.push({ pathname: "/breathdelay", params: { pkg } });
    });
    return () => sub.remove();
  }, []);

  const toggle = (pkg: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(pkg) ? next.delete(pkg) : next.add(pkg);
      return next;
    });
  };

  const save = () => {
    if (!accessibilityOn) {
      Alert.alert(
        "Enable Accessibility",
        "Lumina needs Accessibility permission to detect when blocked apps open.",
        [
          { text: "Open Settings", onPress: openAccessibilitySettings },
          { text: "Cancel", style: "cancel" },
        ],
      );
      return;
    }
    saveBlockedApps([...selected]);
    Alert.alert(
      "Saved!",
      `${selected.size} apps will now show a breath pause.`,
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose apps to pause</Text>
      <Text style={styles.subtitle}>
        We'll show a breathing exercise before these open
      </Text>

      {!accessibilityOn && (
        <TouchableOpacity
          style={styles.banner}
          onPress={openAccessibilitySettings}
        >
          <Text style={styles.bannerText}>
            ⚠️ Enable Accessibility Service to activate
          </Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={apps}
        keyExtractor={(item) => item.packageName}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.row,
              selected.has(item.packageName) && styles.rowSelected,
            ]}
            onPress={() => toggle(item.packageName)}
          >
            <Text style={styles.label}>{item.label}</Text>
            <Text style={styles.pkg}>{item.packageName}</Text>
            {selected.has(item.packageName) && (
              <Text style={styles.check}>✓</Text>
            )}
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.saveBtn} onPress={save}>
        <Text style={styles.saveBtnText}>
          {accessibilityOn
            ? `Save ${selected.size} apps`
            : "Enable Accessibility First"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0e1412", padding: 20 },
  title: {
    fontSize: 24,
    color: "#e8f0eb",
    fontFamily: "DMSerifDisplay_400Regular",
    marginBottom: 8,
  },
  subtitle: { fontSize: 14, color: "#5a7a68", marginBottom: 20 },
  banner: {
    backgroundColor: "#2a1a00",
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  bannerText: { color: "#ffaa44", fontSize: 13, textAlign: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#1c2b24",
    marginBottom: 10,
  },
  rowSelected: {
    backgroundColor: "#1a5c3a",
    borderWidth: 1,
    borderColor: "#4caf7d",
  },
  label: { fontSize: 16, color: "#e8f0eb", flex: 1 },
  pkg: { fontSize: 11, color: "#5a7a68" },
  check: { fontSize: 18, color: "#4caf7d", marginLeft: 8 },
  saveBtn: {
    backgroundColor: "#1a5c3a",
    padding: 16,
    borderRadius: 24,
    alignItems: "center",
    marginTop: 12,
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
