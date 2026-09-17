import {
  addBlockedAppListener,
  canDrawOverlays,
  clearAppData,
  getBlockedApps,
  getInstalledApps,
  hasUsagePermission,
  isAccessibilityEnabled,
  openAccessibilitySettings,
  openOverlaySettings,
  openUsageAccessSettings,
  saveBlockedApps,
  type InstalledApp,
} from "@/modules/lumina-blocker";
import { getStore, refreshLuminaStore, subscribe } from "@/store/luminaStore";
import { router } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  AppState,
  AppStateStatus,
  FlatList,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path, Rect } from "react-native-svg";

// ─── Category config ───────────────────────────────────────────────────────────

const CATEGORIES = [
  "All",
  "Social",
  "Video",
  "Music",
  "Browsing",
  "Productivity",
  "Gaming",
  "App",
];

const CATEGORY_DISPLAY: Record<string, string> = {
  APP: "App",
  SOCIAL: "Social",
  VIDEO: "Video",
  MUSIC: "Music",
  BROWSING: "Browsing",
  PRODUCTIVITY: "Productivity",
  GAMING: "Gaming",
};

const PKG_COLOR: Record<string, string> = {
  "com.android.chrome": "#4285F4",
  "com.google.android.youtube": "#FF0000",
  "com.google.android.apps.youtube.music": "#FF0000",
  "com.google.android.gm": "#EA4335",
  "com.google.android.apps.docs": "#4285F4",
  "com.google.android.apps.maps": "#34A853",
  "com.google.android.apps.photos": "#FBBC05",
  "com.google.android.googlequicksearchbox": "#4285F4",
  "com.google.android.calendar": "#1A73E8",
  "com.google.android.contacts": "#34A853",
  "com.google.android.apps.messaging": "#34A853",
  "com.google.android.dialer": "#34A853",
  "com.google.android.deskclock": "#1A73E8",
  "com.android.vending": "#01875F",
  "com.android.settings": "#555",
  "com.android.camera2": "#222",
  "com.google.android.documentsui": "#5C6BC0",
  "com.google.android.apps.safetyhub": "#1A73E8",
  "io.appium.settings": "#9E9E9E",
  "host.exp.exponent": "#000",
  "com.luminablocker": "#4caf7d",
  "com.wavemaker.assettrackingprism": "#FF6D00",
  "com.android.stk": "#757575",
};

// ─── App Icons ────────────────────────────────────────────────────────────────

function ChromeIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 52 52">
      <Rect width={52} height={52} rx={13} fill="#fff" />
      <Path
        d="M26 8 A18 18 0 0 1 44 26"
        stroke="#EA4335"
        strokeWidth={9}
        fill="none"
      />
      <Path
        d="M44 26 A18 18 0 0 1 17.4 40.1"
        stroke="#FBBC05"
        strokeWidth={9}
        fill="none"
      />
      <Path
        d="M17.4 40.1 A18 18 0 0 1 8 26"
        stroke="#34A853"
        strokeWidth={9}
        fill="none"
      />
      <Path
        d="M8 26 A18 18 0 0 1 26 8"
        stroke="#4285F4"
        strokeWidth={9}
        fill="none"
      />
      <Circle cx={26} cy={26} r={9} fill="#fff" />
      <Circle cx={26} cy={26} r={6} fill="#1A73E8" />
    </Svg>
  );
}

function YoutubeIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 52 52">
      <Rect width={size} height={size} rx={13} fill="#FF0000" />
      <Rect x={9} y={17} width={34} height={18} rx={5} fill="#fff" />
      <Path d="M22 21 L34 26 L22 31Z" fill="#FF0000" />
    </Svg>
  );
}

function YTMusicIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 52 52">
      <Rect width={52} height={52} rx={13} fill="#212121" />
      <Circle cx={26} cy={26} r={14} fill="#FF0000" />
      <Circle cx={26} cy={26} r={5} fill="#212121" />
      <Path d="M22 18 L22 34 L34 26Z" fill="#fff" />
    </Svg>
  );
}

function GmailIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 52 52">
      <Rect width={52} height={52} rx={13} fill="#fff" />
      <Path
        d="M10 16 L10 38 Q10 40 12 40 L14 40 L14 24 L26 32 L38 24 L38 40 L40 40 Q42 40 42 38 L42 16 L26 27Z"
        fill="#EA4335"
      />
      <Path
        d="M10 16 L26 27 L42 16 Q42 14 40 14 L12 14 Q10 14 10 16Z"
        fill="#C5221F"
      />
    </Svg>
  );
}

function DriveIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 52 52">
      <Rect width={52} height={52} rx={13} fill="#fff" />
      <Path d="M26 10 L40 34 L34 34 L20 10Z" fill="#FBBC05" />
      <Path d="M12 34 L20 20 L26 30 L18 44Z" fill="#34A853" />
      <Path d="M18 44 L34 44 L40 34 L24 34Z" fill="#4285F4" />
    </Svg>
  );
}

function MapsIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 52 52">
      <Rect width={52} height={52} rx={13} fill="#fff" />
      <Path
        d="M26 8 C18 8 12 14 12 22 C12 32 26 44 26 44 C26 44 40 32 40 22 C40 14 34 8 26 8Z"
        fill="#34A853"
      />
      <Path
        d="M26 8 C22 8 18 10 15 13 L26 44 C26 44 40 32 40 22 C40 14 34 8 26 8Z"
        fill="#4285F4"
      />
      <Circle cx={26} cy={22} r={7} fill="#fff" />
      <Circle cx={26} cy={22} r={4} fill="#EA4335" />
    </Svg>
  );
}

function PhotosIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 52 52">
      <Rect width={52} height={52} rx={13} fill="#fff" />
      <Path
        d="M26 10 C26 10 34 16 34 22 C34 26.4 30.4 30 26 30 C21.6 30 18 26.4 18 22 C18 17.6 21.6 14 26 14"
        fill="#EA4335"
      />
      <Path
        d="M42 26 C42 26 36 34 30 34 C25.6 34 22 30.4 22 26 C22 21.6 25.6 18 30 18 C34.4 18 38 21.6 38 26"
        fill="#FBBC05"
      />
      <Path
        d="M26 42 C26 42 18 36 18 30 C18 25.6 21.6 22 26 22 C30.4 22 34 25.6 34 30 C34 34.4 30.4 38 26 38"
        fill="#34A853"
      />
      <Path
        d="M10 26 C10 26 16 18 22 18 C26.4 18 30 21.6 30 26 C30 30.4 26.4 34 22 34 C17.6 34 14 30.4 14 26"
        fill="#4285F4"
      />
    </Svg>
  );
}

function PlayStoreIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 52 52">
      <Rect width={52} height={52} rx={13} fill="#fff" />
      <Path d="M12 10 L38 26 L12 42Z" fill="#EA4335" />
      <Path d="M12 10 L25 23 L12 42Z" fill="#FBBC05" />
      <Path d="M38 26 L25 23 L12 42Z" fill="#34A853" />
      <Path d="M12 10 L25 23 L38 26Z" fill="#4285F4" />
    </Svg>
  );
}

export function AppIcon({ app, size = 52 }: { app: InstalledApp; size?: number }) {
  if (app.icon) {
    return (
      <Image
        source={{ uri: app.icon }}
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.24,
        }}
        resizeMode="contain"
      />
    );
  }
  if (app.packageName === "com.android.chrome")
    return <ChromeIcon size={size} />;
  if (app.packageName === "com.google.android.youtube")
    return <YoutubeIcon size={size} />;
  if (app.packageName === "com.google.android.apps.youtube.music")
    return <YTMusicIcon size={size} />;
  if (app.packageName === "com.google.android.gm")
    return <GmailIcon size={size} />;
  if (app.packageName === "com.google.android.apps.docs")
    return <DriveIcon size={size} />;
  if (app.packageName === "com.google.android.apps.maps")
    return <MapsIcon size={size} />;
  if (app.packageName === "com.google.android.apps.photos")
    return <PhotosIcon size={size} />;
  if (app.packageName === "com.android.vending")
    return <PlayStoreIcon size={size} />;

  const bg = PKG_COLOR[app.packageName] ?? "#2a3e32";
  const letter = (app.label?.[0] ?? "?").toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 13,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#fff", fontSize: size * 0.38, fontWeight: "700" }}>
        {letter}
      </Text>
    </View>
  );
}

function CheckCircle({ checked }: { checked: boolean }) {
  if (checked) {
    return (
      <Svg width={26} height={26} viewBox="0 0 26 26">
        <Circle cx={13} cy={13} r={13} fill="#5B6AF0" />
        <Path
          d="M7.5 13 L11.5 17 L18.5 9"
          stroke="#fff"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    );
  }
  return (
    <Svg width={26} height={26} viewBox="0 0 26 26">
      <Circle
        cx={13}
        cy={13}
        r={12}
        stroke="#333"
        strokeWidth={1.5}
        fill="none"
      />
    </Svg>
  );
}

const AppRow = React.memo(function AppRow({
  app,
  selected,
  onToggle,
}: {
  app: InstalledApp;
  selected: boolean;
  onToggle: (pkg: string) => void;
}) {
  const displayCategory =
    CATEGORY_DISPLAY[(app.category ?? "APP").toUpperCase()] ?? "App";
  return (
    <TouchableOpacity
      style={[styles.appRow, selected && styles.appRowSelected]}
      onPress={() => onToggle(app.packageName)}
      activeOpacity={0.75}
    >
      <AppIcon app={app} size={48} />
      <View style={styles.appInfo}>
        <Text style={styles.appName}>{app.label}</Text>
        <Text style={styles.appCat}>{displayCategory}</Text>
      </View>
      <CheckCircle checked={selected} />
    </TouchableOpacity>
  );
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AddDistractingAppScreen({
  onBack,
  onDone,
}: {
  onBack?: () => void;
  onDone?: (selected: string[]) => void;
}) {
  // Use cached installed apps from store for instant render
  const [allApps, setAllApps] = useState<InstalledApp[]>(
    dedup(getStore().installedApps),
  );
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(getBlockedApps()),
  );
  const [accessibilityOn, setAccessibilityOn] = useState(
    isAccessibilityEnabled,
  );
  const [overlayOk, setOverlayOk] = useState(canDrawOverlays);
  const [usageOk, setUsageOk] = useState(hasUsagePermission);
  const [saving, setSaving] = useState(false);
  const toastAnim = useRef(new Animated.Value(0)).current;

  // Deduplicate helper
  function dedup(apps: InstalledApp[]): InstalledApp[] {
    const seen = new Set<string>();
    return apps.filter((app) => {
      if (seen.has(app.packageName)) return false;
      seen.add(app.packageName);
      return true;
    });
  }

  // Keep the picker in sync if the store finishes loading after this screen
  // mounts (for example, when the user opens it immediately after launch).
  useEffect(() => {
    const syncInstalledApps = () => {
      setAllApps(dedup(getStore().installedApps));
    };
    syncInstalledApps();
    try {
      // Reload icons when this screen is opened so a store initialized by an
      // older build cannot leave the picker stuck with letter fallbacks.
      const installed = getInstalledApps();
      if (installed.length > 0) setAllApps(dedup(installed));
    } catch {
      // Keep the cached list if the native query is temporarily unavailable.
    }
    return subscribe(syncInstalledApps);
  }, []);

  // AppState refresh — only re-check permissions, not apps
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s: AppStateStatus) => {
      if (s === "active") {
        setAccessibilityOn(isAccessibilityEnabled());
        setOverlayOk(canDrawOverlays());
        setUsageOk(hasUsagePermission());
      }
    });
    return () => sub.remove();
  }, []);

  // Live blocked app updates
  useEffect(() => {
    const sub = addBlockedAppListener(() => {
      setSelectedIds(new Set(getBlockedApps()));
    });
    return () => sub.remove();
  }, []);

  const toggle = useCallback((pkg: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(pkg) ? next.delete(pkg) : next.add(pkg);
      return next;
    });
  }, []);

  const showToast = () => {
    Animated.sequence([
      Animated.timing(toastAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(1400),
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleDone = async () => {
    if (saving) return;
    if (!accessibilityOn) {
      openAccessibilitySettings();
      return;
    }
    if (!overlayOk) {
      openOverlaySettings();
      return;
    }
    if (!usageOk) {
      openUsageAccessSettings();
      return;
    }
    setSaving(true);
    try {
      const previous = getBlockedApps();
      previous
        .filter((p) => !selectedIds.has(p))
        .forEach((p) => clearAppData(p));
      saveBlockedApps([...selectedIds]);
      // Refresh while the new blocked-app selection is already persisted so
      // historical UsageStats are available as soon as Reflect is shown.
      try {
        await refreshLuminaStore();
      } catch {
        // Saving the selection should not be blocked by a transient stats
        // refresh failure; the next screen-focus refresh will retry it.
      }
      showToast();
      onDone?.([...selectedIds]);
      if (router.canGoBack()) router.back();
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    return allApps
      .filter((app) => {
        const cat =
          CATEGORY_DISPLAY[(app.category ?? "APP").toUpperCase()] ?? "App";
        const matchCat =
          activeCategory === "All" ||
          cat.toLowerCase() === activeCategory.toLowerCase();
        const q = query.trim().toLowerCase();
        const matchQ =
          !q ||
          app.label.toLowerCase().includes(q) ||
          app.packageName.toLowerCase().includes(q);
        return matchCat && matchQ;
      })
      .sort((a, b) => {
        const aSelected = selectedIds.has(a.packageName) ? 0 : 1;
        const bSelected = selectedIds.has(b.packageName) ? 0 : 1;
        return aSelected - bSelected;
      });
  }, [allApps, query, activeCategory, selectedIds]);

  const allOk = accessibilityOn && overlayOk && usageOk;
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0F" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) router.back();
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path
              d="M19 12H5M5 12L12 19M5 12L12 5"
              stroke="#fff"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Distracting App</Text>
        <TouchableOpacity
          onPress={handleDone}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text
            style={[styles.doneBtn, (!allOk || saving) && { opacity: 0.4 }]}
          >
            {saving ? "SAVING…" : "DONE"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Circle cx={11} cy={11} r={7} stroke="#555" strokeWidth={2} />
            <Path
              d="M16.5 16.5 L21 21"
              stroke="#555"
              strokeWidth={2}
              strokeLinecap="round"
            />
          </Svg>
          <TextInput
            style={styles.searchInput}
            placeholder="Search installed apps..."
            placeholderTextColor="#555"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
            autoCorrect={false}
          />
        </View>
      </View>

      {/* Permission banners */}
      {!accessibilityOn && (
        <TouchableOpacity
          style={[styles.banner, { borderColor: "#FF950055" }]}
          onPress={openAccessibilitySettings}
        >
          <Text style={[styles.bannerTitle, { color: "#FF9500" }]}>
            Accessibility permission required
          </Text>
          <Text style={[styles.bannerSub, { color: "#FF950099" }]}>
            Tap to enable Lumina accessibility
          </Text>
        </TouchableOpacity>
      )}
      {!overlayOk && (
        <TouchableOpacity
          style={[styles.banner, { borderColor: "#BF5AF255" }]}
          onPress={openOverlaySettings}
        >
          <Text style={[styles.bannerTitle, { color: "#BF5AF2" }]}>
            Overlay permission required
          </Text>
          <Text style={[styles.bannerSub, { color: "#BF5AF299" }]}>
            Tap to allow overlays
          </Text>
        </TouchableOpacity>
      )}
      {!usageOk && (
        <TouchableOpacity
          style={[styles.banner, { borderColor: "#30D15855" }]}
          onPress={openUsageAccessSettings}
        >
          <Text style={[styles.bannerTitle, { color: "#30D158" }]}>
            Usage access required
          </Text>
          <Text style={[styles.bannerSub, { color: "#30D15899" }]}>
            Tap to grant usage access
          </Text>
        </TouchableOpacity>
      )}

      {/* Categories */}
      <View style={styles.catContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catRow}
        >
          {CATEGORIES.map((cat, index) => (
            <TouchableOpacity
              key={`${cat}-${index}`}
              style={[
                styles.catPill,
                cat === activeCategory && styles.catPillOn,
              ]}
              onPress={() => setActiveCategory(cat)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.catText,
                  cat === activeCategory && styles.catTextOn,
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item, index) => item.packageName + "-" + index}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: 60 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <Text style={styles.listHeader}>INSTALLED APPS</Text>
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No apps match "{query}"</Text>
          </View>
        }
        ListFooterComponent={
          filtered.length > 0 ? (
            <Text style={styles.listFooter}>
              Don't see your app? Try searching above.
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <AppRow
            app={item}
            selected={selectedIds.has(item.packageName)}
            onToggle={toggle}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        // Performance tweaks for large lists
        removeClippedSubviews
        maxToRenderPerBatch={15}
        windowSize={10}
        initialNumToRender={15}
      />

      {/* Toast */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.toast,
          {
            opacity: toastAnim,
            transform: [
              {
                translateY: toastAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [10, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={styles.toastText}>
          {selectedIds.size} app{selectedIds.size !== 1 ? "s" : ""} saved ✓
        </Text>
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0A0A0F" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: -0.2,
  },
  doneBtn: {
    fontSize: 15,
    fontWeight: "700",
    color: "#5B6AF0",
    letterSpacing: 0.4,
  },
  searchWrap: { paddingHorizontal: 20, paddingBottom: 10 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#13131A",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: "#fff", padding: 0, margin: 0 },
  banner: {
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "#13131A",
  },
  bannerTitle: { fontSize: 13, fontWeight: "600", textAlign: "center" },
  bannerSub: { fontSize: 11, textAlign: "center", marginTop: 3 },
  catContainer: { height: 48, marginVertical: 10, justifyContent: "center" },
  catRow: {
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  catPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#13131A",
    borderWidth: 1,
    borderColor: "#252535",
    alignItems: "center",
    justifyContent: "center",
  },
  catPillOn: { backgroundColor: "#1E2060", borderColor: "#5B6AF0" },
  catText: {
    fontSize: 14,
    color: "#777",
    includeFontPadding: false,
    textAlignVertical: "center",
    textAlign: "center",
  },
  catTextOn: { color: "#fff", fontWeight: "600" },
  list: { paddingHorizontal: 20, paddingBottom: 60 },
  listHeader: {
    fontSize: 11,
    fontWeight: "600",
    color: "#444",
    letterSpacing: 1.2,
    marginBottom: 12,
    marginTop: 6,
  },
  listFooter: {
    textAlign: "center",
    color: "#444",
    fontSize: 13,
    marginTop: 24,
    marginBottom: 16,
  },
  appRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#13131A",
    borderRadius: 18,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: "#252535",
  },
  appRowSelected: { backgroundColor: "#1C1C38", borderColor: "#5B6AF0" },
  appInfo: { flex: 1 },
  appName: { fontSize: 15, fontWeight: "700", color: "#F0EFF8", marginBottom: 3 },
  appCat: { fontSize: 12, color: "#7B7A9A" },
  emptyBox: { alignItems: "center", paddingVertical: 48 },
  emptyText: { color: "#444", fontSize: 14 },
  toast: {
    position: "absolute",
    bottom: 36,
    alignSelf: "center",
    backgroundColor: "#1a5c3a",
    borderWidth: 1,
    borderColor: "#4caf7d",
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 24,
  },
  toastText: { color: "#e8f0eb", fontSize: 14, fontWeight: "600" },
});
