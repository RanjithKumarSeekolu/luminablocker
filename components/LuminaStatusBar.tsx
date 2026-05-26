// components/LuminaStatusBar.tsx

import React from "react";

import { StatusBar } from "react-native";

type Props = {
  backgroundColor?: string;

  barStyle?: "light-content" | "dark-content";

  translucent?: boolean;
};

export default function LuminaStatusBar({
  backgroundColor = "#F3F4F6",
  barStyle = "dark-content",
  translucent = true,
}: Props) {
  return (
    <StatusBar
      translucent={translucent}
      backgroundColor="transparent"
      barStyle={barStyle}
    />
  );
}
