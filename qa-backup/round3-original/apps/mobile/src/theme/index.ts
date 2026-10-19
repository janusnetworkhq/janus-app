import tokens from "@janus/design-tokens/tokens.json";
import { Platform, StyleSheet } from "react-native";

export const color = tokens.color;
export const space = tokens.space;
export const radius = tokens.radius;

export const font = Platform.select({
  ios: {
    regular: "System" as const,
    medium: "System" as const,
    semibold: "System" as const,
  },
  default: {
    regular: "sans-serif" as const,
    medium: "sans-serif-medium" as const,
    semibold: "sans-serif-medium" as const,
  },
});

export const type = {
  display: tokens.type.display,
  title: tokens.type.title,
  body: tokens.type.body,
  caption: tokens.type.caption,
};

export const shadow = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  android: { elevation: 8 },
  default: {},
});

export const hairline = StyleSheet.hairlineWidth;
