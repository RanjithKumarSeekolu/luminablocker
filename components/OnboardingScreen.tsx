import { AppIcon } from "@/app/(tabs)/apps/app-picker";
import {
  getBlockedApps,
  getInstalledApps,
  saveBlockedApps,
  type InstalledApp,
} from "@/modules/lumina-blocker";
import {
  getStore,
  refreshLuminaStore,
  setPreferredFocusMinutes,
  subscribe,
} from "@/store/luminaStore";
import { LinearGradient } from "expo-linear-gradient";
import { Sparkles, Target } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type OnboardingScreenProps = {
  onComplete: () => void;
};

const STEPS = ["welcome", "apps", "focus"] as const;
const FOCUS_PRESETS = [25, 45, 60, 90];
const LIKELY_DISTRACTING = new Set([
  "SOCIAL",
  "VIDEO",
  "BROWSING",
  "GAMING",
  "MUSIC",
]);
const SELF_PACKAGE = "com.luminablocker";

function dedup(apps: InstalledApp[]): InstalledApp[] {
  const seen = new Set<string>();
  return apps.filter((app) => {
    if (!app.packageName || seen.has(app.packageName)) return false;
    if (app.packageName === SELF_PACKAGE) return false;
    seen.add(app.packageName);
    return true;
  });
}

function loadInstalledApps(): InstalledApp[] {
  try {
    const nativeApps = getInstalledApps();
    if (nativeApps.length > 0) return dedup(nativeApps);
  } catch {
    // Native module can be unavailable during web/SSR.
  }
  return dedup(getStore().installedApps);
}

function OrbField() {
  return (
    <>
      <View style={styles.mainOrb} />
      <View style={styles.leftOrb} />
      <View style={styles.rightOrb} />
    </>
  );
}

function PageMark({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.markWrap}>
      <View style={styles.markOuter}>
        <View style={styles.markMiddle}>
          <LinearGradient
            colors={["rgba(155,141,240,0.35)", "rgba(109,106,248,0.12)"]}
            style={styles.markInner}
          >
            {children}
          </LinearGradient>
        </View>
      </View>
    </View>
  );
}

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [query, setQuery] = useState("");
  const [apps, setApps] = useState<InstalledApp[]>(loadInstalledApps);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(safeBlockedApps()),
  );
  const [focusMinutes, setFocusMinutes] = useState(45);
  const lastStep = step === STEPS.length - 1;

  useEffect(() => {
    const sync = () => setApps(loadInstalledApps());
    sync();
    return subscribe(sync);
  }, []);

  const visibleApps = useMemo(() => {
    const q = query.trim().toLowerCase();
    return apps
      .filter((app) => {
        if (!q) return true;
        return (
          app.label.toLowerCase().includes(q) ||
          app.packageName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const aSelected = selectedIds.has(a.packageName) ? 0 : 1;
        const bSelected = selectedIds.has(b.packageName) ? 0 : 1;
        if (aSelected !== bSelected) return aSelected - bSelected;
        const aHot = LIKELY_DISTRACTING.has((a.category ?? "").toUpperCase())
          ? 0
          : 1;
        const bHot = LIKELY_DISTRACTING.has((b.category ?? "").toUpperCase())
          ? 0
          : 1;
        if (aHot !== bHot) return aHot - bHot;
        return a.label.localeCompare(b.label);
      });
  }, [apps, query, selectedIds]);

  const toggleApp = useCallback((packageName: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(packageName)) next.delete(packageName);
      else next.add(packageName);
      return next;
    });
  }, []);

  const persistApps = () => {
    try {
      saveBlockedApps([...selectedIds]);
      void refreshLuminaStore();
    } catch {
      // Permissions come next; the picker can save again later.
    }
  };

  const goNext = () => {
    if (STEPS[step] === "apps") persistApps();
    if (STEPS[step] === "focus") {
      setPreferredFocusMinutes(focusMinutes);
      onComplete();
      return;
    }
    if (lastStep) {
      onComplete();
      return;
    }
    setStep((current) => current + 1);
  };

  const ctaLabel =
    STEPS[step] === "apps"
      ? selectedIds.size > 0
        ? `CONTINUE · ${selectedIds.size}`
        : "SKIP FOR NOW"
      : STEPS[step] === "focus"
        ? "BEGIN JOURNEY"
        : "CONTINUE";

  return (
    <View style={styles.container}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />
      <OrbField />

      <TouchableOpacity
        onPress={onComplete}
        style={[styles.skip, { top: insets.top + 12 }]}
        hitSlop={12}
      >
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <View style={[styles.bodyWrap, { paddingTop: insets.top + 44 }]}>
        {step === 0 ? <WelcomeStep /> : null}
        {step === 1 ? (
          <AppsStep
            apps={visibleApps}
            query={query}
            selectedIds={selectedIds}
            onQueryChange={setQuery}
            onToggle={toggleApp}
          />
        ) : null}
        {step === 2 ? (
          <FocusStep minutes={focusMinutes} onSelect={setFocusMinutes} />
        ) : null}
      </View>

      <View
        style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}
      >
        <View style={styles.dots}>
          {STEPS.map((id, pageIndex) => (
            <View
              key={id}
              style={[styles.dot, pageIndex === step && styles.activeDot]}
            />
          ))}
        </View>

        <TouchableOpacity onPress={goNext} activeOpacity={0.85}>
          <LinearGradient
            colors={["#7B78FF", "#6D6AF8"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cta}
          >
            <Text style={styles.ctaText}>{ctaLabel}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function safeBlockedApps(): string[] {
  try {
    return getBlockedApps();
  } catch {
    return [];
  }
}

function WelcomeStep() {
  return (
    <View style={styles.centeredStep}>
      <PageMark>
        <Sparkles color="#c4b8ff" size={36} strokeWidth={1.6} />
      </PageMark>
      <Text style={styles.kicker}>WELCOME TO LUMINA</Text>
      <Text style={styles.title}>Reclaim your{"\n"}attention</Text>
      <Text style={styles.body}>
        A quiet space between you and the apps that pull you away — so focus
        becomes a choice again.
      </Text>
    </View>
  );
}

function AppsStep({
  apps,
  query,
  selectedIds,
  onQueryChange,
  onToggle,
}: {
  apps: InstalledApp[];
  query: string;
  selectedIds: Set<string>;
  onQueryChange: (value: string) => void;
  onToggle: (packageName: string) => void;
}) {
  return (
    <View style={styles.appsStep}>
      <Text style={styles.kicker}>DISTRACTING APPS</Text>
      <Text style={styles.stepTitle}>Which apps pull{"\n"}you away?</Text>
      <Text style={styles.stepBody}>
        Pick the ones you open without meaning to. Lumina will pause you there
        — you can change this anytime.
      </Text>

      <View style={styles.searchBox}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search installed apps"
          placeholderTextColor="rgba(180,170,210,0.35)"
          value={query}
          onChangeText={onQueryChange}
          returnKeyType="search"
          autoCorrect={false}
        />
      </View>

      <FlatList
        data={apps}
        keyExtractor={(item) => item.packageName}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.appList}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {query
              ? `No apps match “${query}”`
              : "Installed apps will appear here once Lumina can read them."}
          </Text>
        }
        renderItem={({ item }) => {
          const selected = selectedIds.has(item.packageName);
          return (
            <TouchableOpacity
              style={[styles.appRow, selected && styles.appRowSelected]}
              onPress={() => onToggle(item.packageName)}
              activeOpacity={0.75}
            >
              <AppIcon app={item} size={44} />
              <View style={styles.appInfo}>
                <Text style={styles.appName} numberOfLines={1}>
                  {item.label}
                </Text>
                <Text style={styles.appCat}>
                  {(item.category ?? "App").toLowerCase()}
                </Text>
              </View>
              <View style={[styles.check, selected && styles.checkOn]}>
                {selected ? <Text style={styles.checkMark}>✓</Text> : null}
              </View>
            </TouchableOpacity>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        windowSize={8}
      />
    </View>
  );
}

function FocusStep({
  minutes,
  onSelect,
}: {
  minutes: number;
  onSelect: (value: number) => void;
}) {
  return (
    <View style={styles.centeredStep}>
      <PageMark>
        <Target color="#c4b8ff" size={36} strokeWidth={1.6} />
      </PageMark>
      <Text style={styles.kicker}>FOCUS MODE</Text>
      <Text style={styles.title}>Lock in when{"\n"}it matters</Text>
      <Text style={styles.body}>
        Start a session and Lumina holds the lock. Distracting apps stay out
        until the timer ends — no bargaining mid-flow.
      </Text>

      <Text style={styles.durationLabel}>USUAL SESSION</Text>
      <View style={styles.durationRow}>
        {FOCUS_PRESETS.map((preset) => {
          const active = preset === minutes;
          return (
            <TouchableOpacity
              key={preset}
              onPress={() => onSelect(preset)}
              style={[styles.durationChip, active && styles.durationChipOn]}
              activeOpacity={0.8}
            >
              <Text
                style={[styles.durationValue, active && styles.durationValueOn]}
              >
                {preset}
              </Text>
              <Text style={[styles.durationUnit, active && styles.durationUnitOn]}>
                min
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.focusHint}>
        You can start a session anytime from the Focus tab.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#080810",
    overflow: "hidden",
  },
  mainOrb: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(140,120,255,0.10)",
    top: 90,
    left: 50,
  },
  leftOrb: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(160,140,255,0.07)",
    top: 40,
    left: -20,
  },
  rightOrb: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(90,180,255,0.06)",
    top: 280,
    right: -10,
  },
  skip: {
    position: "absolute",
    right: 24,
    zIndex: 4,
  },
  skipText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 14,
    color: "rgba(180,170,210,0.55)",
    letterSpacing: 0.4,
  },
  bodyWrap: {
    flex: 1,
  },
  centeredStep: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: "center",
    paddingBottom: 12,
  },
  appsStep: {
    flex: 1,
    paddingHorizontal: 24,
  },
  markWrap: {
    alignItems: "center",
    marginBottom: 36,
  },
  markOuter: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 1,
    borderColor: "rgba(160,140,255,0.10)",
    justifyContent: "center",
    alignItems: "center",
  },
  markMiddle: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 1,
    borderColor: "rgba(160,140,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
  },
  markInner: {
    width: 86,
    height: 86,
    borderRadius: 43,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(160,140,255,0.35)",
  },
  kicker: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 11,
    letterSpacing: 3.2,
    color: "rgba(180,170,210,0.55)",
    textAlign: "center",
    marginBottom: 14,
  },
  title: {
    fontFamily: "DMSerifDisplay_400Regular",
    fontSize: 40,
    lineHeight: 46,
    color: "#c4b8ff",
    textAlign: "center",
    marginBottom: 16,
  },
  body: {
    fontFamily: "DMSans_400Regular",
    fontSize: 16,
    lineHeight: 24,
    color: "rgba(196,184,255,0.62)",
    textAlign: "center",
    paddingHorizontal: 8,
  },
  stepTitle: {
    fontFamily: "DMSerifDisplay_400Regular",
    fontSize: 32,
    lineHeight: 38,
    color: "#c4b8ff",
    textAlign: "center",
    marginBottom: 10,
  },
  stepBody: {
    fontFamily: "DMSans_400Regular",
    fontSize: 15,
    lineHeight: 22,
    color: "rgba(196,184,255,0.62)",
    textAlign: "center",
    marginBottom: 18,
  },
  searchBox: {
    backgroundColor: "rgba(19,19,26,0.92)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(160,140,255,0.16)",
    paddingHorizontal: 14,
    paddingVertical: 2,
    marginBottom: 12,
  },
  searchInput: {
    fontFamily: "DMSans_400Regular",
    fontSize: 15,
    color: "#F0EFF8",
    paddingVertical: 12,
  },
  appList: {
    paddingBottom: 12,
  },
  emptyText: {
    fontFamily: "DMSans_400Regular",
    color: "rgba(180,170,210,0.4)",
    textAlign: "center",
    marginTop: 32,
    fontSize: 14,
  },
  appRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(19,19,26,0.92)",
    borderRadius: 16,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(37,37,53,0.9)",
  },
  appRowSelected: {
    backgroundColor: "rgba(28,28,56,0.95)",
    borderColor: "#5B6AF0",
  },
  appInfo: { flex: 1 },
  appName: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 15,
    color: "#F0EFF8",
    marginBottom: 2,
  },
  appCat: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: "#7B7A9A",
    textTransform: "capitalize",
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "rgba(160,140,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: {
    backgroundColor: "#5B6AF0",
    borderColor: "#5B6AF0",
  },
  checkMark: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  durationLabel: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 11,
    letterSpacing: 2.4,
    color: "rgba(180,170,210,0.5)",
    textAlign: "center",
    marginTop: 28,
    marginBottom: 12,
  },
  durationRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
  },
  durationChip: {
    minWidth: 68,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: "rgba(19,19,26,0.92)",
    borderWidth: 1,
    borderColor: "rgba(160,140,255,0.16)",
    alignItems: "center",
  },
  durationChipOn: {
    backgroundColor: "rgba(28,28,56,0.95)",
    borderColor: "#6D6AF8",
  },
  durationValue: {
    fontFamily: "DMSans_700Bold",
    fontSize: 20,
    color: "rgba(196,184,255,0.7)",
  },
  durationValueOn: {
    color: "#FFFFFF",
  },
  durationUnit: {
    fontFamily: "DMSans_500Medium",
    fontSize: 11,
    color: "rgba(180,170,210,0.45)",
    marginTop: 2,
  },
  durationUnitOn: {
    color: "rgba(196,184,255,0.8)",
  },
  focusHint: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(180,170,210,0.42)",
    textAlign: "center",
    marginTop: 16,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 8,
    gap: 22,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
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
  cta: {
    borderRadius: 24,
    paddingVertical: 18,
    alignItems: "center",
  },
  ctaText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 14,
    letterSpacing: 2.4,
    color: "#FFFFFF",
  },
});
