import BreathDelayScreen from "@/components/Breathdelayscreen";
import React from "react";
import { NativeModules } from "react-native";

const { LuminaBlocker } = NativeModules;

export default function BreathOverlay() {
  return (
    <BreathDelayScreen
      appName="Blocked App"
      onCancel={() => {
        LuminaBlocker.closeOverlay();
      }}
    />
  );
}
