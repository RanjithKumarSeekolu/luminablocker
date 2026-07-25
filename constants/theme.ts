// constants/theme.ts

export const Colors = {
  background: "#0B0B0D",

  surface: "#171719",
  surfaceSecondary: "#19192C",

  border: "#232326",

  primary: "#6D6AF8",

  text: "#FFFFFF",
  textSecondary: "#A4A4AD",
  textMuted: "#8A8A94",

  success: "#10D39B",
  danger: "#FF6B6B",
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const Radius = {
  sm: 12,
  md: 16,
  lg: 24,
  xl: 28,
  pill: 999,
};

export const Typography = {
  title: {
    fontSize: 36,
    fontWeight: "700" as const,
  },

  heading: {
    fontSize: 24,
    fontWeight: "700" as const,
  },

  sectionTitle: {
    fontSize: 13,
    fontWeight: "700" as const,
    letterSpacing: 2,
  },

  body: {
    fontSize: 14,
  },

  caption: {
    fontSize: 12,
  },

  button: {
    fontSize: 26,
    fontWeight: "700" as const,
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
  },

  focusTime: {
    fontSize: 30,
    fontWeight: "800" as const,
  },

  durationValue: {
    fontSize: 65,
    fontWeight: "800" as const,
  },

  captionStrong: {
    fontSize: 14,
    fontWeight: "600" as const,
  },
};

export const Layout = {
  screenPadding: 24,
  cardPadding: 22,
  sectionGap: 36,
};
