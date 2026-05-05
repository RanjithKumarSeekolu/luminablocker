import { registerRootComponent } from "expo";
import { AppRegistry } from "react-native";

import App from "./App"; // Expo Router entry
import BreathOverlay from "./BreathOverlay";

// Register normal app
registerRootComponent(App);

// Register overlay (THIS is the key)
AppRegistry.registerComponent("BreathOverlay", () => BreathOverlay);
