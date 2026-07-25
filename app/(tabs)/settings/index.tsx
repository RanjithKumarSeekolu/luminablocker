import { Colors, Layout, Radius, Spacing, Typography } from "@/constants/theme";
import {
  isMindfulRemindersEnabled,
  isOverlayEnabled,
  isVolumeExitAllowed,
  setMindfulRemindersEnabled,
  setIsVolumeExitAllowed,
  setOverlayEnabled,
} from "@/modules/lumina-blocker";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const APP_VERSION = Constants.expoConfig?.version ?? "1.0.0";

// ─── Section Label ────────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// ─── Toggle Row ───────────────────────────────────────────────────────────────

function ToggleRow({
  title,
  subtitle,
  value,
  onValueChange,
  topContent,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  topContent?: React.ReactNode;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleTextBlock}>
        {topContent}
        <Text style={styles.toggleTitle}>{title}</Text>
        {subtitle ? (
          <Text style={styles.toggleSubtitle}>{subtitle}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: Colors.border, true: Colors.primary }}
        thumbColor={Colors.text}
        ios_backgroundColor={Colors.border}
      />
    </View>
  );
}

// ─── Nav Row ──────────────────────────────────────────────────────────────────

function NavRow({
  icon,
  label,
  onPress,
  showDivider = true,
}: {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
  showDivider?: boolean;
}) {
  return (
    <>
      <TouchableOpacity
        style={styles.navRow}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.navRowLeft}>
          {icon}
          <Text style={styles.navRowLabel}>{label}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      </TouchableOpacity>
      {showDivider && <View style={styles.divider} />}
    </>
  );
}

function readMindfulReminders(): boolean {
  try {
    return isMindfulRemindersEnabled();
  } catch {
    return true;
  }
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  // Notifications
  const [mindfulReminders, setMindfulReminders] = useState(readMindfulReminders);

  // Appearance
  const [focusModeExitButton, setFocusModeExitButton] = useState(() =>
    isVolumeExitAllowed(),
  );
  const [blockerOverlay, setBlockerOverlay] = useState(() =>
    isOverlayEnabled(),
  );

  // Re-read native preferences after returning from Privacy Vault or another
  // screen that may have changed the settings.
  useFocusEffect(
    useCallback(() => {
      setMindfulReminders(readMindfulReminders());
      setFocusModeExitButton(isVolumeExitAllowed());
      setBlockerOverlay(isOverlayEnabled());
    }, []),
  );

  const handleMindfulRemindersToggle = (value: boolean) => {
    setMindfulReminders(value);
    try {
      setMindfulRemindersEnabled(value);
    } catch {
      // Older native builds do not expose the global reminder setting.
    }
  };

  const handleFocusModeExitToggle = (value: boolean) => {
    setFocusModeExitButton(value);
    setIsVolumeExitAllowed(value);
  };

  const handleBlockerOverlayToggle = (value: boolean) => {
    setBlockerOverlay(value);
    setOverlayEnabled(value);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* ── NOTIFICATIONS ── */}
      <SectionLabel label="NOTIFICATIONS" />
      <Card>
        <ToggleRow
          title="Mindful Reminders"
          subtitle="Gentle nudges to breathe and step away from the screen."
          value={mindfulReminders}
          onValueChange={handleMindfulRemindersToggle}
        />
      </Card>

      <View style={styles.sectionGap} />

      {/* ── APPEARANCE ── */}
      <SectionLabel label="APPEARANCE" />
      <Card>
        <ToggleRow
          title="Focus Mode Exit Button"
          subtitle="Enable or disable the exit button during active focus sessions."
          value={focusModeExitButton}
          onValueChange={handleFocusModeExitToggle}
          topContent={
            <Text style={styles.quoteText}>
              "Darkness is the soul's sanctuary."
            </Text>
          }
        />
        <View style={styles.cardDivider} />
        <ToggleRow
          title="Blocker Overlay"
          subtitle="Show a full-screen overlay when a blocked app is opened."
          value={blockerOverlay}
          onValueChange={handleBlockerOverlayToggle}
        />
      </Card>

      <View style={styles.sectionGap} />

      {/* ── PRIVACY ── */}
      <SectionLabel label="PRIVACY" />
      <Card style={styles.navCard}>
        <NavRow
          icon={
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={Colors.text}
              style={styles.navIcon}
            />
          }
          label="App Permissions"
          onPress={() => {
            router.push("/settings/app-permissions");
          }}
        />
        <NavRow
          icon={
            <Ionicons
              name="eye-off-outline"
              size={20}
              color={Colors.text}
              style={styles.navIcon}
            />
          }
          label="Data & Privacy Vault"
          onPress={() => {
            router.push("/settings/data-privacy");
          }}
          showDivider={false}
        />
      </Card>

      <View style={styles.sectionGap} />

      {/* ── ABOUT ── */}
      <View style={styles.aboutSection}>
        {/* Lumina star icon */}
        <View style={styles.aboutIconWrapper}>
          <MaterialCommunityIcons
            name="asterisk"
            size={22}
            color={Colors.primary}
          />
        </View>

        <Text style={styles.aboutTitle}>About Lumina</Text>
        <Text style={styles.aboutBody}>
          A digital sanctuary designed to foster focus{"\n"}and mindful living.
          Crafted for the intentional{"\n"}soul.
        </Text>

        <TouchableOpacity
          onPress={() => Linking.openURL("https://lumina.app/terms")}
        >
          <Text style={styles.aboutLink}>Terms of Service</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => Linking.openURL("https://lumina.app/privacy")}
        >
          <Text style={styles.aboutLink}>Privacy Policy</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>VERSION {APP_VERSION} (QUIET)</Text>
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contentContainer: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing.xl,
    paddingBottom: 48,
  },

  // Section label
  sectionLabel: {
    ...Typography.sectionTitle,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },

  sectionGap: {
    height: Layout.sectionGap,
  },

  // Card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    overflow: "hidden",
  },
  navCard: {
    paddingVertical: Spacing.xs,
  },

  // Toggle row
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Layout.cardPadding,
    gap: Spacing.md,
  },
  toggleTextBlock: {
    flex: 1,
    gap: 2,
  },
  toggleTitle: {
    ...Typography.captionStrong,
    color: Colors.text,
  },
  toggleSubtitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    lineHeight: 17,
    marginTop: 2,
  },
  quoteText: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontStyle: "italic",
    marginBottom: 4,
  },

  // Nav row
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Layout.cardPadding,
    paddingVertical: Spacing.lg,
  },
  navRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  navIcon: {
    width: 22,
  },
  navRowLabel: {
    ...Typography.captionStrong,
    color: Colors.text,
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginHorizontal: Layout.cardPadding,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginHorizontal: Layout.cardPadding,
  },

  // About
  aboutSection: {
    alignItems: "center",
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  aboutIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  aboutTitle: {
    ...Typography.heading,
    color: Colors.text,
    fontSize: 20,
  },
  aboutBody: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  aboutLink: {
    ...Typography.body,
    color: Colors.text,
    textDecorationLine: "underline",
    marginTop: 2,
  },
  versionText: {
    ...Typography.caption,
    color: Colors.textMuted,
    letterSpacing: 1.5,
    marginTop: Spacing.sm,
  },
});
