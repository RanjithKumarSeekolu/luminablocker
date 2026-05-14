import React, { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";

import { getHistory } from "@/modules/lumina-blocker";

type HistoryEvent = {
  timestamp: number;
  packageName: string;
  appName: string;
  reason: string;
  delta: number;
  previousScore: number;
  newScore: number;
  details?: string;
};

export default function HistoryScreen() {
  const [events, setEvents] = useState<HistoryEvent[]>([]);

  useEffect(() => {
    load();
  }, []);

  const load = () => {
    const data = getHistory();
    setEvents(data);
  };

  const renderItem = ({ item }: any) => {
    const positive = item.delta > 0;

    return (
      <View style={styles.card}>
        <Text style={styles.app}>{item.appName}</Text>

        <Text style={styles.reason}>
          {positive ? "+" : ""}
          {item.delta} • {item.reason}
        </Text>

        <Text style={styles.details}>{item.details}</Text>

        <Text style={styles.score}>
          Score: {item.previousScore}
          {" → "}
          {item.newScore}
        </Text>

        <Text style={styles.time}>
          {new Date(item.timestamp).toLocaleString()}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {events.length > 0 ? (
        <FlatList
          data={events}
          keyExtractor={(_, i) => i.toString()}
          renderItem={renderItem}
          contentContainerStyle={{
            padding: 16,
          }}
        />
      ) : (
        <Text style={styles.emptyText}>No history available.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0e1412",
  },

  card: {
    backgroundColor: "#17201c",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },

  app: {
    color: "#e8f0eb",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },

  reason: {
    color: "#a8d5b5",
    fontSize: 15,
    marginBottom: 6,
  },

  score: {
    color: "#c0d4c8",
    fontSize: 14,
    marginBottom: 6,
  },

  time: {
    color: "#6f8b78",
    fontSize: 12,
  },

  emptyText: {
    color: "#6f8b78",
    fontSize: 16,
    textAlign: "center",
    marginTop: 32,
  },

  details: {
    color: "#8fa79a",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
});
