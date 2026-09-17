import { Colors } from "@/constants/theme";
import { formatRelativeDate, formatUsage } from "@/constants/utils";
import {
  getAllFocusSessions,
  type FocusSession,
} from "@/modules/lumina-blocker";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BG = "#0B0B0D";
const CARD = "#171719";
const BORDER = "#232326";
const ACCENT = "#6D6AF8";
const MUTED = "#8A8A94";

type FilterType = "week" | "month" | "all";

function getSectionLabel(date: Date) {
  const today = new Date();

  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  if (isToday) {
    return "TODAY";
  }

  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return "YESTERDAY";
  }

  return date
    .toLocaleDateString([], {
      month: "long",
      day: "numeric",
    })
    .toUpperCase();
}

export default function FocusHistoryScreen() {
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [filter, setFilter] = useState<FilterType>("week");

  useFocusEffect(
    useCallback(() => {
      const data = getAllFocusSessions();

      setSessions([...data].sort((a, b) => b.timestamp - a.timestamp));
    }, []),
  );

  const filteredSessions = useMemo(() => {
    const now = new Date();

    return sessions.filter((session) => {
      const sessionDate = new Date(session.timestamp);

      switch (filter) {
        case "week": {
          // Include today plus the previous six calendar days. Using a
          // rolling 168-hour window makes the filter change during the day.
          const weekAgo = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - 6,
          );

          return sessionDate >= weekAgo;
        }

        case "month":
          return (
            sessionDate.getMonth() === now.getMonth() &&
            sessionDate.getFullYear() === now.getFullYear()
          );

        case "all":
        default:
          return true;
      }
    });
  }, [sessions, filter]);

  const groupedSessions = useMemo(() => {
    return filteredSessions.reduce(
      (acc, session) => {
        const date = new Date(session.timestamp);

        const key = new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
        ).getTime();

        if (!acc[key]) {
          acc[key] = [];
        }

        acc[key].push(session);

        return acc;
      },
      {} as Record<number, FocusSession[]>,
    );
  }, [filteredSessions]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 40,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Recent Sessions</Text>

      <View style={styles.filters}>
        <TouchableOpacity
          onPress={() => setFilter("week")}
          style={[
            styles.filterChip,
            filter === "week" && styles.filterChipActive,
          ]}
        >
          <Text
            style={[
              styles.filterText,
              filter === "week" && styles.filterTextActive,
            ]}
          >
            This Week
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setFilter("month")}
          style={[
            styles.filterChip,
            filter === "month" && styles.filterChipActive,
          ]}
        >
          <Text
            style={[
              styles.filterText,
              filter === "month" && styles.filterTextActive,
            ]}
          >
            This Month
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setFilter("all")}
          style={[
            styles.filterChip,
            filter === "all" && styles.filterChipActive,
          ]}
        >
          <Text
            style={[
              styles.filterText,
              filter === "all" && styles.filterTextActive,
            ]}
          >
            All Time
          </Text>
        </TouchableOpacity>
      </View>

      {filteredSessions.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No focus sessions found</Text>
        </View>
      ) : (
        Object.entries(groupedSessions)
          .sort(([a], [b]) => Number(b) - Number(a))
          .map(([dateKey, items]) => (
          <View key={dateKey}>
            <Text style={styles.sectionHeader}>
              {getSectionLabel(new Date(Number(dateKey)))}
            </Text>

            {items.map((session, index) => (
              <View key={`${session.timestamp}-${index}`} style={styles.card}>
                <View style={styles.cardContent}>
                  <View style={styles.cardLeft}>
                    <View style={styles.sessionTitleRow}>
                      <Text style={styles.sessionTitle}>
                        {formatUsage(session.durationMs)}
                      </Text>

                      {session.targetDurationMs && !session.completed && (
                        <Text style={styles.sessionTarget}>
                          of{" "}
                          {formatUsage(
                            session.targetDurationMs ?? session.durationMs,
                          )}
                        </Text>
                      )}
                    </View>

                    <Text style={styles.sessionMeta}>
                      ◷ {formatRelativeDate(session.timestamp)} •{" "}
                      {formatUsage(session.durationMs)}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusPill,
                      session.completed
                        ? styles.completedPill
                        : styles.earlyPill,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        session.completed
                          ? styles.completedText
                          : styles.earlyText,
                      ]}
                    >
                      {session.completed ? "Completed" : "Early Exit"}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },

  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "700",
    marginBottom: 24,
  },

  filters: {
    flexDirection: "row",
    marginBottom: 28,
  },

  filterChip: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 22,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },

  filterChipActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },

  filterText: {
    color: MUTED,
    fontSize: 14,
    fontWeight: "600",
  },

  filterTextActive: {
    color: "#FFFFFF",
  },

  sectionHeader: {
    color: MUTED,
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: "700",
    marginBottom: 12,
    marginTop: 8,
  },

  card: {
    backgroundColor: CARD,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 20,
    marginBottom: 14,
  },

  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  cardLeft: {
    flex: 1,
    paddingRight: 12,
  },

  sessionTitleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },

  sessionTitle: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: "700",
  },

  sessionTarget: {
    color: Colors.textMuted,
    fontSize: 13,
    marginLeft: 6,
    marginBottom: 2,
  },

  sessionMeta: {
    color: MUTED,
    fontSize: 14,
  },

  statusPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },

  completedPill: {
    backgroundColor: "rgba(109,106,248,0.15)",
  },

  earlyPill: {
    backgroundColor: "rgba(138,138,148,0.15)",
  },

  statusText: {
    fontSize: 13,
    fontWeight: "600",
  },

  completedText: {
    color: ACCENT,
  },

  earlyText: {
    color: MUTED,
  },

  emptyState: {
    marginTop: 80,
    alignItems: "center",
  },

  emptyText: {
    color: MUTED,
    fontSize: 15,
  },
});
