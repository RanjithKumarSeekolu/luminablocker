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
        name="app-permissions"
        options={{
          headerShown: false,
          headerTitle: "App Permissions",
          presentation: "modal",
          headerTransparent: true,
        }}
      />
      <Stack.Screen
        name="data-privacy"
        options={{
          headerShown: false,
          headerTitle: "Privacy Vault",
          presentation: "modal",
          headerTransparent: true,
        }}
      />
    </Stack>
  );
}
