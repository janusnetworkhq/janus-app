import { memo, useMemo } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { color, font, radius, space } from "../theme";

type Variant = "primary" | "ghost" | "danger" | "surface";

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export const Button = memo(function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
  style,
}: Props) {
  const palette = useMemo(() => stylesFor(variant), [variant]);
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.base,
        palette.wrap,
        pressed && { opacity: 0.86, transform: [{ scale: 0.98 }] },
        (disabled || loading) && { opacity: 0.45 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.ink} />
      ) : (
        <Text style={[styles.label, { color: palette.ink }]}>{label}</Text>
      )}
    </Pressable>
  );
});

function stylesFor(variant: Variant) {
  switch (variant) {
    case "ghost":
      return { wrap: { backgroundColor: "transparent", borderWidth: 1, borderColor: color.border }, ink: color.text };
    case "danger":
      return { wrap: { backgroundColor: color.danger }, ink: "#1A0605" };
    case "surface":
      return { wrap: { backgroundColor: color.surfaceRaised }, ink: color.text };
    default:
      return { wrap: { backgroundColor: color.accent }, ink: color.accentInk };
  }
}

const styles = StyleSheet.create({
  base: {
    minHeight: Platform.OS === "ios" ? 50 : 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space[5],
  },
  label: {
    fontFamily: font.semibold,
    fontSize: 16,
    fontWeight: "600",
  },
});
