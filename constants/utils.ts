import { TimeSlot } from "./types";

export function formatUsage(ms?: number) {
  if (!ms || Number.isNaN(ms)) {
    return "0s";
  }

  const totalSeconds = Math.round(ms / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    if (minutes === 0) {
      return `${hours}h`;
    }
    if (seconds === 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    if (seconds === 0) {
      return `${minutes}m`;
    }
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

export function formatRelativeDate(timestamp: number) {
  const date = new Date(timestamp);

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function getCurrentTimeSlot(): TimeSlot {
  const hour = new Date().getHours();

  if (hour >= 0 && hour < 9) return "early";
  if (hour >= 9 && hour < 17) return "work";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

/** Human-friendly greeting; usage buckets intentionally keep their data labels. */
export function getGreeting(): string {
  const hour = new Date().getHours();

  if (hour < 5) return "late night";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}
