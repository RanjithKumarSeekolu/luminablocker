import { Stack } from "expo-router";

export default function FocusLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: "#111",
        },
        headerTintColor: "#fff",
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="app-picker"
        options={{
          headerShown: false,
          headerTitle: "Add Distracting App",
          presentation: "modal",
          headerTransparent: true,
        }}
      />
    </Stack>
  );
}
