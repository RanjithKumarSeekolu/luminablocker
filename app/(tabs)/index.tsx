import { StyleSheet } from "react-native";

import AppPickerScreen from "@/components/AppPickerScreen";

export default function TabOneScreen() {
  return <AppPickerScreen />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  separator: {
    marginVertical: 30,
    height: 1,
    width: "80%",
  },
});
