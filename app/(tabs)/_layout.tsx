import { Tabs } from "expo-router";
import { Grid3X3, Settings, Target, Zap } from "lucide-react-native";

const TabIcons = {
  reflect: ({ color, size }: { color: string; size: number }) => (
    <Zap color={color} size={size} strokeWidth={2} />
  ),

  focus: ({ color, size }: { color: string; size: number }) => (
    <Target color={color} size={size} strokeWidth={2} />
  ),

  apps: ({ color, size }: { color: string; size: number }) => (
    <Grid3X3 color={color} size={size} strokeWidth={2} />
  ),

  settings: ({ color, size }: { color: string; size: number }) => (
    <Settings color={color} size={size} strokeWidth={2} />
  ),
};

export default function TabLayout() {
  return (
    <Tabs
      backBehavior="order"
      screenOptions={{
        headerStatusBarHeight: 0,

        headerStyle: {
          backgroundColor: "#111",
        },

        headerTintColor: "#fff",
        headerTitleAlign: "center",
        headerTitle: "Lumina",

        tabBarStyle: {
          backgroundColor: "#111",
          borderTopColor: "#222",
          height: 70,
          paddingTop: 8,
          // paddingBottom: 12,
        },

        tabBarActiveTintColor: "#fff",
        tabBarInactiveTintColor: "#555",

        tabBarLabelStyle: {
          fontSize: 10,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Reflect",
          tabBarIcon: TabIcons.reflect,
        }}
      />

      <Tabs.Screen
        name="focus"
        options={{
          title: "Focus",
          headerTitle: "Focus",
          tabBarIcon: TabIcons.focus,
        }}
      />

      <Tabs.Screen
        name="apps"
        options={{
          title: "Apps",
          headerTitle: "Apps",
          tabBarIcon: TabIcons.apps,
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          headerTitle: "Settings",
          tabBarIcon: TabIcons.settings,
        }}
      />
    </Tabs>
  );
}
