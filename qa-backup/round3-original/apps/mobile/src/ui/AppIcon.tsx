import { Platform } from "react-native";
import { SymbolView, type SFSymbol } from "expo-symbols";
import Ionicons from "@expo/vector-icons/Ionicons";

type Props = {
  ios: SFSymbol;
  android: keyof typeof Ionicons.glyphMap;
  size?: number;
  color: string;
};

export function AppIcon({ ios, android, size = 22, color }: Props) {
  if (Platform.OS === "ios") {
    return <SymbolView name={ios} size={size} tintColor={color} weight="medium" />;
  }
  return <Ionicons name={android} size={size} color={color} />;
}
