import { StyleSheet, Text, View } from "react-native";

export type DailySnapshot = {
  date: string;

  totalUsageMs: number;

  morningUsageMs: number;

  afternoonUsageMs: number;

  eveningUsageMs: number;

  nightUsageMs: number;

  reopenEvents: number;

  intentionalExits: number;

  focusResets: number;

  overlaysTriggered: number;
};

function formatUsage(ms: number) {
  if (!ms || Number.isNaN(ms)) return "0s";

  const totalSeconds = Math.floor(ms / 1000);

  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m ${seconds}s`;
}

export default function DailyStatsCard({
  snapshot,
}: {
  snapshot: DailySnapshot;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.date}>{snapshot.date}</Text>

        <Text style={styles.totalUsage}>
          {formatUsage(snapshot.totalUsageMs)}
        </Text>
      </View>

      {/* Usage buckets */}

      <View style={styles.bucketRow}>
        <View style={styles.bucket}>
          <Text style={styles.bucketEmoji}>🌅</Text>

          <Text style={styles.bucketValue}>
            {formatUsage(snapshot.morningUsageMs)}
          </Text>

          <Text style={styles.bucketLabel}>Morning</Text>
        </View>

        <View style={styles.bucket}>
          <Text style={styles.bucketEmoji}>☀️</Text>

          <Text style={styles.bucketValue}>
            {formatUsage(snapshot.afternoonUsageMs)}
          </Text>

          <Text style={styles.bucketLabel}>Afternoon</Text>
        </View>

        <View style={styles.bucket}>
          <Text style={styles.bucketEmoji}>🌆</Text>

          <Text style={styles.bucketValue}>
            {formatUsage(snapshot.eveningUsageMs)}
          </Text>

          <Text style={styles.bucketLabel}>Evening</Text>
        </View>

        <View style={styles.bucket}>
          <Text style={styles.bucketEmoji}>🌙</Text>

          <Text style={styles.bucketValue}>
            {formatUsage(snapshot.nightUsageMs)}
          </Text>

          <Text style={styles.bucketLabel}>Night</Text>
        </View>
      </View>

      {/* Behavioral stats */}

      <View style={styles.statsRow}>
        <View style={styles.statPill}>
          <Text style={styles.statText}>Reopens · {snapshot.reopenEvents}</Text>
        </View>

        <View style={styles.statPill}>
          <Text style={styles.statText}>Focus · {snapshot.focusResets}</Text>
        </View>

        <View style={styles.statPill}>
          <Text style={styles.statText}>
            Exits · {snapshot.intentionalExits}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#17201c",
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  date: {
    color: "#e8f0eb",
    fontSize: 16,
    fontFamily: "DMSans_600SemiBold",
  },

  totalUsage: {
    color: "#7ab89a",
    fontSize: 14,
    fontFamily: "DMSans_600SemiBold",
  },

  bucketRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  bucket: {
    alignItems: "center",
    flex: 1,
  },

  bucketEmoji: {
    fontSize: 18,
    marginBottom: 6,
  },

  bucketValue: {
    color: "#dce8e1",
    fontSize: 12,
    fontFamily: "DMSans_600SemiBold",
  },

  bucketLabel: {
    color: "#5f7c6a",
    fontSize: 10,
    marginTop: 4,
    fontFamily: "DMSans_400Regular",
  },

  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  statPill: {
    backgroundColor: "#0f1713",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  statText: {
    color: "#7fa18d",
    fontSize: 11,
    fontFamily: "DMSans_500Medium",
  },
});
