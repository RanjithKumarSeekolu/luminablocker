import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

export type DailySnapshot = {
  date: string;
  totalUsageMs: number;
};

type Props = {
  snapshots: DailySnapshot[];
};

function formatUsage(ms: number) {
  const totalMinutes = Math.floor(ms / 60000);

  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

function getDayLabel(date: string) {
  return new Date(date)
    .toLocaleDateString("en-US", {
      weekday: "short",
    })
    .charAt(0);
}

export default function WeeklyUsageChart({ snapshots }: Props) {
  const chartData = useMemo(() => {
    return [...snapshots].reverse().map((snapshot) => ({
      label: getDayLabel(snapshot.date),
      usageMs: snapshot.totalUsageMs,
    }));
  }, [snapshots]);

  const totalWeeklyUsage = useMemo(() => {
    return chartData.reduce((sum, day) => sum + day.usageMs, 0);
  }, [chartData]);

  const maxUsage = Math.max(...chartData.map((d) => d.usageMs), 1);

  return (
    <View style={styles.container}>
      <Text style={styles.metric}>{formatUsage(totalWeeklyUsage)}</Text>

      <Text style={styles.label}>WEEKLY TRENDS</Text>

      <View style={styles.chart}>
        {chartData.map((day) => {
          const height = Math.max(12, (day.usageMs / maxUsage) * 120);

          return (
            <View key={`${day.label}-${day.usageMs}`} style={styles.column}>
              <View
                style={[
                  styles.bar,
                  {
                    height,
                  },
                ]}
              />

              <Text style={styles.day}>{day.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#111111",
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    marginBottom: 20,
  },

  metric: {
    color: "#FFFFFF",
    fontSize: 36,
    textAlign: "center",
    fontFamily: "DMSans_700Bold",
  },

  label: {
    color: "#8A8A94",
    fontSize: 11,
    letterSpacing: 2,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 32,
    fontFamily: "DMSans_500Medium",
  },

  chart: {
    height: 160,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },

  column: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },

  bar: {
    width: 18,
    backgroundColor: "#6D6AF8",
    borderRadius: 999,
  },

  day: {
    marginTop: 12,
    color: "#8A8A94",
    fontSize: 12,
    fontFamily: "DMSans_500Medium",
  },
});
