import type { AppFocusData } from "@/app/(tabs)";
import {
  getAllAppScores,
  getBlockedApps,
  getDailySnapshots,
  getInstalledApps,
  getTodayUsageBreakdown,
  getTodayFocusMs,
  getWeeklyFocusData,
  getWeeklyUsageForApp,
  type WeeklyFocusDay,
} from "@/modules/lumina-blocker";

type WeeklyUsageDay = { day: string; usageMs: number };
type TodayUsageBreakdown = ReturnType<typeof getTodayUsageBreakdown>;

type LuminaStore = {
  focusTargets: AppFocusData[];
  snapshot: any | null;
  todayFocusMs: number;
  weeklyFocusData: WeeklyFocusDay[];
  weeklyUsageMap: Record<string, WeeklyUsageDay[]>;
  installedApps: {
    packageName: string;
    label: string;
    category: string;
    icon?: string;
  }[];
  isReady: boolean;
};

let store: LuminaStore = {
  focusTargets: [],
  snapshot: null,
  todayFocusMs: 0,
  weeklyFocusData: [],
  weeklyUsageMap: {},
  installedApps: [],
  isReady: false,
};

let listeners: (() => void)[] = [];
let refreshRequestId = 0;

export function subscribe(fn: () => void) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

export function getStore() {
  return store;
}

function notify() {
  listeners.forEach((fn) => fn());
}

export async function initLuminaStore() {
  const requestId = ++refreshRequestId;
  const [snapshots, scores, installedApps, blocked, focusMs, weeklyFocus] =
    await Promise.all([
      Promise.resolve(getDailySnapshots()),
      Promise.resolve(getAllAppScores() as AppFocusData[]),
      Promise.resolve(getInstalledApps()),
      Promise.resolve(getBlockedApps()),
      Promise.resolve(getTodayFocusMs()),
      Promise.resolve(getWeeklyFocusData()),
    ]);

  const usageByPackage = await loadTodayUsage(blocked);
  const targets = buildTargets(
    blocked,
    scores,
    installedApps,
    usageByPackage,
  );

  // Load weekly usage per app in parallel
  const weeklyEntries = await Promise.all(
    blocked.map(async (pkg) => {
      try {
        const data = await getWeeklyUsageForApp(pkg);
        return [pkg, data] as const;
      } catch {
        return [pkg, []] as const;
      }
    }),
  );

  // A picker save or tab-focus refresh may have started while initialization
  // was loading. Do not let this older request overwrite the newer selection.
  if (requestId !== refreshRequestId) return;

  store = {
    focusTargets: targets,
    snapshot: snapshots[0] ?? null,
    todayFocusMs: focusMs,
    weeklyFocusData: weeklyFocus,
    weeklyUsageMap: Object.fromEntries(weeklyEntries),
    installedApps,
    isReady: true,
  };

  notify();
}

// Lightweight refresh — skips getInstalledApps, uses cached installedApps
export async function refreshLuminaStore() {
  const requestId = ++refreshRequestId;
  const [snapshots, scores, blocked, focusMs, weeklyFocus] = await Promise.all([
    Promise.resolve(getDailySnapshots()),
    Promise.resolve(getAllAppScores() as AppFocusData[]),
    Promise.resolve(getBlockedApps()),
    Promise.resolve(getTodayFocusMs()),
    Promise.resolve(getWeeklyFocusData()),
  ]);

  const usageByPackage = await loadTodayUsage(blocked);
  const targets = buildTargets(
    blocked,
    scores,
    store.installedApps,
    usageByPackage,
  );

  // Only fetch weekly usage for newly added apps
  const existingPkgs = new Set(Object.keys(store.weeklyUsageMap));
  const newPkgs = blocked.filter((p) => !existingPkgs.has(p));
  const newEntries = await Promise.all(
    newPkgs.map(async (pkg) => {
      try {
        const data = await getWeeklyUsageForApp(pkg);
        return [pkg, data] as const;
      } catch {
        return [pkg, []] as const;
      }
    }),
  );

  // AppState and tab-focus callbacks can refresh concurrently. Only the most
  // recent request is allowed to publish, preventing stale data from winning.
  if (requestId !== refreshRequestId) return;

  // Keep existing weekly data, add new entries, drop removed apps
  const blockedSet = new Set(blocked);
  const filteredExisting = Object.fromEntries(
    Object.entries(store.weeklyUsageMap).filter(([pkg]) => blockedSet.has(pkg)),
  );

  store = {
    ...store,
    focusTargets: targets,
    snapshot: snapshots[0] ?? null,
    todayFocusMs: focusMs,
    weeklyFocusData: weeklyFocus,
    weeklyUsageMap: { ...filteredExisting, ...Object.fromEntries(newEntries) },
  };

  notify();
}

export function removeAppFromStore(packageName: string) {
  // Invalidate any refresh that was reading the old blocked-app set. Without
  // this, a slow UsageStats request could re-add a just-removed app.
  ++refreshRequestId;
  store = {
    ...store,
    focusTargets: store.focusTargets.filter(
      (t) => t.packageName !== packageName,
    ),
    weeklyUsageMap: Object.fromEntries(
      Object.entries(store.weeklyUsageMap).filter(
        ([pkg]) => pkg !== packageName,
      ),
    ),
  };
  notify();
}

function buildTargets(
  blocked: string[],
  scores: AppFocusData[],
  installedApps: {
    packageName: string;
    label: string;
    category: string;
    icon?: string;
  }[],
  usageByPackage: Record<
    string,
    TodayUsageBreakdown | null
  > = {},
): AppFocusData[] {
  return blocked.map((packageName) => {
    const score = scores.find((s) => s.packageName === packageName);
    const installed = installedApps.find((a) => a.packageName === packageName);
    const usage = usageByPackage[packageName];
    const hasUsage = usage !== null && usage !== undefined;
    return {
      packageName,
      appName: score?.appName ?? installed?.label ?? packageName,
      icon: installed?.icon,
      category: score?.category ?? installed?.category ?? "APP",
      score: score?.score ?? 0,
      level: score?.level ?? 0,
      usageMs: hasUsage ? usage.total : (score?.usageMs ?? 0),
      usageBreakdown: hasUsage
        ? {
            early: usage.early,
            work: usage.work,
            evening: usage.evening,
            night: usage.night,
          }
        : (score?.usageBreakdown ?? {
            early: 0,
            work: 0,
            evening: 0,
            night: 0,
          }),
    };
  });
}

/**
 * Query UsageStats directly for selected apps. This is intentionally separate
 * from getAllAppScores because a newly selected app may not have a score key
 * until its first blocked open.
 */
async function loadTodayUsage(
  packages: string[],
): Promise<Record<string, TodayUsageBreakdown | null>> {
  const entries = await Promise.all(
    packages.map(async (packageName) => {
      try {
        const raw = getTodayUsageBreakdown(packageName) as unknown as Record<
          string,
          number | undefined
        >;
        return [
          packageName,
          {
            total: raw.total ?? 0,
            // Accept both names so this remains compatible with older native
            // builds that returned morning/afternoon.
            early: raw.early ?? raw.morning ?? 0,
            work: raw.work ?? raw.afternoon ?? 0,
            evening: raw.evening ?? 0,
            night: raw.night ?? 0,
          },
        ] as const;
      } catch {
        return [packageName, null] as const;
      }
    }),
  );

  return Object.fromEntries(entries);
}
