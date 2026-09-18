import { openAccessibilitySettings } from "@/modules/lumina-blocker";
import { Colors, Layout, Radius, Spacing, Typography } from "@/constants/theme";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function AccessibilityDisclosure({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();

  const agree = () => {
    onClose();
    openAccessibilitySettings();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.root, { paddingTop: insets.top + Spacing.lg }]}>
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.kicker}>REQUIRED PERMISSION</Text>
          <Text style={styles.title}>Accessibility permission</Text>
          <Text style={styles.lead}>
            Lumina needs Android Accessibility to notice when an app you
            selected comes to the foreground.
          </Text>

          <Text style={styles.heading}>How we use it</Text>
          <Text style={styles.item}>
            • Pause distracting apps with a mindful overlay
          </Text>
          <Text style={styles.item}>
            • Keep Focus Mode locked until you choose to exit
          </Text>

          <Text style={styles.heading}>What we see</Text>
          <Text style={styles.item}>
            • Only the name of the app on screen
          </Text>
          <Text style={styles.item}>
            • We do not read your messages, passwords, photos, or anything on
            the screen
          </Text>
          <Text style={styles.item}>
            • We do not use Accessibility for ads, analytics, or accounts
          </Text>
          <Text style={styles.item}>
            • This information stays on your phone. You can turn Accessibility
            off anytime in Android Settings.
          </Text>
        </ScrollView>

        <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity style={styles.secondary} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.secondaryText}>Not now</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primary} onPress={agree} activeOpacity={0.85}>
            <Text style={styles.primaryText}>Agree and continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  body: {
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: Spacing.xl,
  },
  kicker: {
    ...Typography.sectionTitle,
    color: Colors.primary,
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.heading,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  lead: {
    ...Typography.body,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  heading: {
    ...Typography.cardTitle,
    color: Colors.text,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  item: {
    ...Typography.body,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },
  actions: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  secondary: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
  secondaryText: {
    ...Typography.captionStrong,
    color: Colors.textMuted,
  },
  primary: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    alignItems: "center",
  },
  primaryText: {
    ...Typography.captionStrong,
    color: Colors.text,
    fontSize: 16,
  },
});
