import {
  getAllFocusSessions,
  type FocusSession,
} from "@/modules/lumina-blocker";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString();
}

export default function FocusHistoryScreen() {
  const [sessions, setSessions] = useState<FocusSession[]>([]);

  useFocusEffect(
    useCallback(() => {
      const data = getAllFocusSessions();
      // newest first
      setSessions([...data].sort((a, b) => b.timestamp - a.timestamp));
    }, []),
  );

  const totalMs = sessions.reduce((sum, s) => sum + s.durationMs, 0);
  const completed = sessions.filter((s) => s.completed).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Focus History</Text>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryPill}>
          <Text style={styles.summaryValue}>{sessions.length}</Text>
          <Text style={styles.summaryLabel}>sessions</Text>
        </View>
        <View style={styles.summaryPill}>
          <Text style={styles.summaryValue}>{completed}</Text>
          <Text style={styles.summaryLabel}>completed</Text>
        </View>
        <View style={styles.summaryPill}>
          <Text style={styles.summaryValue}>{formatDuration(totalMs)}</Text>
          <Text style={styles.summaryLabel}>total</Text>
        </View>
      </View>

      {sessions.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No focus sessions yet</Text>
        </View>
      ) : (
        sessions.map((session, i) => (
          <View key={i} style={styles.card}>
            <View style={styles.cardLeft}>
              <Text style={styles.duration}>
                {formatDuration(session.durationMs)}
              </Text>
              <Text style={styles.timestamp}>
                {formatTimestamp(session.timestamp)}
              </Text>
            </View>
            <View
              style={[
                styles.badge,
                { borderColor: session.completed ? "#4caf7d" : "#9a5a2a" },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  { color: session.completed ? "#4caf7d" : "#9a5a2a" },
                ]}
              >
                {session.completed ? "✓ Done" : "⏹ Early"}
              </Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0e1412",
  },
  content: {
    padding: 20,
    paddingBottom: 60,
  },
  title: {
    fontSize: 24,
    color: "#e8f0eb",
    fontFamily: "DMSerifDisplay_400Regular",
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  summaryPill: {
    flex: 1,
    backgroundColor: "#17201c",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  summaryValue: {
    color: "#4caf7d",
    fontSize: 18,
    fontFamily: "DMSans_600SemiBold",
  },
  summaryLabel: {
    color: "#5a7a68",
    fontSize: 11,
    fontFamily: "DMSans_400Regular",
    marginTop: 2,
  },
  empty: {
    alignItems: "center",
    marginTop: 60,
  },
  emptyText: {
    color: "#5a7a68",
    fontSize: 14,
    fontFamily: "DMSans_400Regular",
  },
  card: {
    backgroundColor: "#17201c",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardLeft: {
    flex: 1,
  },
  duration: {
    color: "#e8f0eb",
    fontSize: 18,
    fontFamily: "DMSans_600SemiBold",
  },
  timestamp: {
    color: "#5a7a68",
    fontSize: 12,
    fontFamily: "DMSans_400Regular",
    marginTop: 4,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: "DMSans_600SemiBold",
  },
});
