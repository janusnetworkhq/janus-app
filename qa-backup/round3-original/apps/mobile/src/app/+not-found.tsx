import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "@/i18n";
import { color, font, space } from "@/theme";

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <View style={styles.wrap}>
      <Stack.Screen
        options={{
          title: "",
          headerStyle: { backgroundColor: color.bg },
          headerTintColor: color.text,
        }}
      />
      <Text style={styles.title}>{t("notfound_title")}</Text>
      <Link href="/(app)" style={styles.link}>
        {t("notfound_back_home")}
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: color.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: space[4],
    padding: space[5],
  },
  title: {
    color: color.text,
    fontSize: 18,
    fontFamily: font.semibold,
    fontWeight: "600",
    textAlign: "center",
  },
  link: {
    color: color.accent,
    fontSize: 16,
    fontFamily: font.semibold,
    fontWeight: "600",
  },
});
