import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import { color, font } from "../theme";

type Props = { uri?: string | null; name?: string | null; size?: number };

export function Avatar({ uri, name, size = 40 }: Props) {
  const letter = (name?.trim()?.[0] ?? "?").toUpperCase();
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color.surfaceRaised }}
        contentFit="cover"
        recyclingKey={uri}
        transition={120}
      />
    );
  }
  return (
    <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.letter, { fontSize: size * 0.42 }]}>{letter}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { backgroundColor: color.surfaceRaised, alignItems: "center", justifyContent: "center" },
  letter: { color: color.accent, fontFamily: font.semibold, fontWeight: "700" },
});
