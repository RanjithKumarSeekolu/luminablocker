import { EventEmitter, requireNativeModule } from "expo-modules-core";

const LuminaBlocker = requireNativeModule("LuminaBlocker");

type LuminaBlockerEvents = {
  onBlockedAppOpened: (payload: { packageName: string }) => void;
};

const emitter = new EventEmitter<LuminaBlockerEvents>(LuminaBlocker);

export type InstalledApp = {
  packageName: string;
  label: string;
};

export function saveBlockedApps(packages: string[]): void {
  return LuminaBlocker.saveBlockedApps(packages);
}

export function getBlockedApps(): string[] {
  return LuminaBlocker.getBlockedApps();
}

export function isAccessibilityEnabled(): boolean {
  return LuminaBlocker.isAccessibilityEnabled();
}

export function openAccessibilitySettings(): void {
  return LuminaBlocker.openAccessibilitySettings();
}

export function getInstalledApps(): InstalledApp[] {
  return LuminaBlocker.getInstalledApps();
}

export function addBlockedAppListener(callback: (packageName: string) => void) {
  return emitter.addListener("onBlockedAppOpened", (e: any) =>
    callback(e.packageName),
  );
}
