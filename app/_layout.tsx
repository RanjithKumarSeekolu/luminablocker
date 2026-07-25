import FoundationOfFocusScreen from "@/components/FoundationOfFocusScreen";
import LuminaSplashScreen from "@/components/Luminasplashscreen";
import {
  canDrawOverlays,
  hasUsagePermission,
  isAccessibilityEnabled,
} from "@/modules/lumina-blocker";
import { initLuminaStore } from "@/store/luminaStore";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState } from "react";
import { Animated, AppState } from "react-native";
import "react-native-reanimated";

export { ErrorBoundary } from "expo-router";

SplashScreen.preventAutoHideAsync();

type Stage = "splash" | "permissions" | "app";

function allPermissionsGranted() {
  return isAccessibilityEnabled() && canDrawOverlays() && hasUsagePermission();
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  useEffect(() => {
    void initLuminaStore();
  }, []);

  if (!loaded) return null;

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const [stage, setStage] = useState<Stage>("splash");

  const hasPermissions = useRef(allPermissionsGranted()).current;

  const opacity = useRef(new Animated.Value(1)).current;

  const transitionTo = (next: Stage) => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start(() => {
      setStage(next);

      opacity.setValue(0);

      Animated.timing(opacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }).start();
    });
  };

  useEffect(() => {
    if (stage !== "splash") return;

    const timer = setTimeout(() => {
      transitionTo(hasPermissions ? "app" : "permissions");
    }, 2200);

    return () => clearTimeout(timer);
  }, [stage]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && stage === "app") {
        if (!allPermissionsGranted()) {
          transitionTo("permissions");
        }
      }
    });

    return () => sub.remove();
  }, [stage]);

  let content = null;

  switch (stage) {
    case "splash":
      content = <LuminaSplashScreen showOnboardingDots={!hasPermissions} />;
      break;

    case "permissions":
      content = (
        <FoundationOfFocusScreen onAllGranted={() => transitionTo("app")} />
      );
      break;

    case "app":
      content = (
        <Stack>
          <Stack.Screen
            name="(tabs)"
            options={{
              headerShown: false,
            }}
          />

          <Stack.Screen
            name="modal"
            options={{
              presentation: "modal",
            }}
          />
        </Stack>
      );
      break;
  }

  return (
    <Animated.View
      style={{
        flex: 1,
        opacity,
      }}
    >
      {content}
    </Animated.View>
  );
}
