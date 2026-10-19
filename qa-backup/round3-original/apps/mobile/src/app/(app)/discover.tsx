import { Redirect } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMe } from "@/auth/use-me";
import { FeedList } from "@/feed/FeedList";
import { useTranslation } from "@/i18n";
import { usePlayerStore } from "@/player/player-store";
import { color, font, space } from "@/theme";
import { TextField } from "@/ui/TextField";

export default function DiscoverScreen() {
  const me = useMe();
  const { t } = useTranslation();
  const university = usePlayerStore((s) => s.university);
  const setUniversity = usePlayerStore((s) => s.setUniversity);

  if (me.data?.role === "STUDENT") return <Redirect href="/(app)" />;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]}>
        <View style={styles.search}>
          <Text style={styles.title}>{t("discover_title")}</Text>
          <TextField
            placeholder={t("discover_search_placeholder")}
            value={university}
            onChangeText={setUniversity}
            autoCapitalize="words"
            returnKeyType="search"
          />
        </View>
      </SafeAreaView>
      <FeedList
        university={university || undefined}
        isRecruiter
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  search: {
    paddingHorizontal: space[4],
    paddingTop: space[2],
    paddingBottom: space[3],
    gap: space[2],
    backgroundColor: color.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  title: {
    color: color.text,
    fontSize: 24,
    fontFamily: font.semibold,
    fontWeight: "700",
  },
});
