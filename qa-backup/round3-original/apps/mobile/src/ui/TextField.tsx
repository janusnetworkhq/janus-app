import { StyleSheet, TextInput, View, Text, type TextInputProps } from "react-native";
import { color, font, radius, space } from "../theme";

type Props = TextInputProps & { label?: string };

export function TextField({ label, style, ...rest }: Props) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={color.textMuted}
        selectionColor={color.accent}
        style={[styles.input, style]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[2] },
  label: {
    color: color.textMuted,
    fontSize: 13,
    fontFamily: font.medium,
    fontWeight: "500",
    letterSpacing: 0.2,
  },
  input: {
    backgroundColor: color.surface,
    borderColor: color.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: color.text,
    fontSize: 16,
    fontFamily: font.regular,
    paddingHorizontal: space[4],
    paddingVertical: space[4],
  },
});
