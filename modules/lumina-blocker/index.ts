import { EventEmitter, requireNativeModule } from "expo-modules-core";

const LuminaBlocker = requireNativeModule("LuminaBlocker");

// ── Types ─────────────────────────────────────────────────────

export type InstalledApp = {
  packageName: string;
  label: string;
};

export type BlockedAppEvent = {
  packageName: string;
  appName: string;
  level: number; // 1–4
  score: number;
};

type LuminaBlockerEvents = {
  onBlockedAppDetected: (payload: BlockedAppEvent) => void;
};

const emitter = new EventEmitter<LuminaBlockerEvents>(LuminaBlocker);

export type ScoreHistoryEvent = {
  timestamp: number;
  packageName: string;
  appName: string;
  reason: string;
  delta: number;
  previousScore: number;
  newScore: number;
};

// ── Blocked apps ──────────────────────────────────────────────

/** Persist the list of package names to block. */
export function saveBlockedApps(packages: string[]): void {
  return LuminaBlocker.saveBlockedApps(packages);
}

/** Retrieve the persisted blocked package list. */
export function getBlockedApps(): string[] {
  return LuminaBlocker.getBlockedApps();
}

// ── Score + level ─────────────────────────────────────────────

/** Raw cumulative score — useful for debugging or displaying progress. */
export function getCurrentScore(): number {
  return LuminaBlocker.getCurrentScore();
}

/** Derived level (0 = no overlay, 1–4 = increasing intervention). */
export function getCurrentLevel(): number {
  return LuminaBlocker.getCurrentLevel();
}

/** Hard-reset score to 0 (e.g. from a settings screen). */
export function resetScore(): void {
  return LuminaBlocker.resetScore();
}

/**
 * Soft-reset — subtracts FOCUS_RESET_SCORE from current score.
 * Call when user taps "I'll focus now" or similar.
 * Returns the new score.
 */
export function applyFocusReset(): number {
  return LuminaBlocker.applyFocusReset();
}

// ── Session notify ────────────────────────────────────────────
// These are called automatically by the AccessibilityService,
// but exposed here in case JS needs to notify manually
// (e.g. for apps detected via a different mechanism).

export function notifyAppOpened(packageName: string): void {
  return LuminaBlocker.notifyAppOpened(packageName);
}

export function notifyAppLeft(): void {
  return LuminaBlocker.notifyAppLeft();
}

// ── Allow / cancel ────────────────────────────────────────────
// Call these after the user makes a choice on the overlay.
// The native overlay (BreathOverlayActivity) handles this itself,
// but these are exposed so a JS overlay can do the same if needed.

/** Mark package as allowed — sets the allow window so in-app events pass through. */
export function allowApp(packageName: string): void {
  return LuminaBlocker.allowApp(packageName);
}

/** Mark as cancelled — clears breathScreenActive, no cooldown penalty. */
export function cancelApp(packageName: string): void {
  return LuminaBlocker.cancelApp(packageName);
}

// ── Installed apps ────────────────────────────────────────────

/** Returns all launchable apps installed on the device, sorted by label. */
export function getInstalledApps(): InstalledApp[] {
  return LuminaBlocker.getInstalledApps();
}

// ── Overlay permission (SYSTEM_ALERT_WINDOW) ──────────────────
// Must be granted before the breath overlay can draw over other apps.
// Android does not allow auto-granting — user must toggle it manually.

/**
 * Returns true if the app has "Display over other apps" permission.
 * Check this on first launch and before saving blocked apps.
 */
export function canDrawOverlays(): boolean {
  return LuminaBlocker.canDrawOverlays();
}

/**
 * Opens the system "Display over other apps" settings page for this app.
 * Call this when canDrawOverlays() returns false.
 */
export function openOverlaySettings(): void {
  return LuminaBlocker.openOverlaySettings();
}

/**
 * Programmatically stop the overlay service (e.g. if JS detects a stale overlay).
 * Normally the overlay stops itself when the user taps Open or Go Back.
 */
export function stopOverlay(): void {
  return LuminaBlocker.stopOverlay();
}

// ── Accessibility ─────────────────────────────────────────────

/** Returns true if the Lumina accessibility service is currently enabled. */
export function isAccessibilityEnabled(): boolean {
  return LuminaBlocker.isAccessibilityEnabled();
}

/** Opens the Android accessibility settings screen. */
export function openAccessibilitySettings(): void {
  return LuminaBlocker.openAccessibilitySettings();
}

// ── Events ────────────────────────────────────────────────────

/**
 * Subscribe to blocked app detection events.
 * Fires every time the native overlay is shown.
 * Use this to update React state (stats, level badge, etc.)
 *
 * @example
 * useEffect(() => {
 *   const sub = addBlockedAppListener((e) => {
 *     console.log(`${e.appName} blocked at level ${e.level}`);
 *   });
 *   return () => sub.remove();
 * }, []);
 */
export function addBlockedAppListener(
  callback: (event: BlockedAppEvent) => void,
) {
  return emitter.addListener("onBlockedAppDetected", callback);
}

export function getHistory(): ScoreHistoryEvent[] {
  return LuminaBlocker.getHistory();
}

export function clearHistory(): void {
  return LuminaBlocker.clearHistory();
}
