import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { get, post } from "@/api/client";
import { keys, queryClient } from "@/api/query";
import type { FeedPage } from "@/api/types";
import { signOut } from "@/auth/actions";
import { useMe } from "@/auth/use-me";
import { useTranslation } from "@/i18n";
import { ProfileHeader } from "@/profile/ProfileHeader";
import { color, font, radius, space } from "@/theme";
import { AppIcon } from "@/ui/AppIcon";
import { Button } from "@/ui/Button";
import { TextField } from "@/ui/TextField";

export default function ProfileScreen() {
  const router = useRouter();
  const me = useMe();
  const { t, locale } = useTranslation();
  const user = me.data;
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [headline, setHeadline] = useState(user?.studentProfile?.headline ?? "");

  const videos = useQuery({
    queryKey: keys.userVideos(user?.id ?? ""),
    queryFn: () => get<FeedPage>(`/v1/users/${user!.id}/videos`),
    enabled: Boolean(user?.id),
  });

  if (!user) return null;

  const save = async () => {
    try {
      await post("/v1/me/profile", { displayName, headline });
      await queryClient.invalidateQueries({ queryKey: keys.me });
      setEditing(false);
    } catch (error) {
      Alert.alert(
        t("status_error_title"),
        error instanceof Error ? error.message : t("profile_save_error")
      );
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ProfileHeader
          displayName={user.displayName}
          handle={user.handle}
          headline={user.studentProfile?.headline}
          university={user.studentProfile?.university}
          city={user.studentProfile?.city}
          orgName={user.recruiterProfile?.org?.name}
          title={user.recruiterProfile?.title}
          hasVault={user.role === "STUDENT"}
          videoCount={videos.data?.items.length}
          onEdit={() => setEditing((v) => !v)}
        />

        {editing ? (
          <View style={styles.edit}>
            <TextField
              label={t("onboard_name_label")}
              value={displayName}
              onChangeText={setDisplayName}
            />
            {user.role === "STUDENT" ? (
              <TextField
                label={t("onboard_headline_label")}
                value={headline}
                onChangeText={setHeadline}
              />
            ) : null}
            <View style={{ flexDirection: "row", gap: space[3], marginTop: space[2] }}>
              <Button
                label={t("btn_cancel")}
                variant="ghost"
                onPress={() => setEditing(false)}
                style={{ flex: 1 }}
              />
              <Button
                label={t("btn_save")}
                onPress={() => void save()}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        ) : null}

        {/* Quick Settings & Language Row */}
        <View style={styles.settingsSection}>
          <Pressable
            onPress={() => router.push("/settings")}
            style={({ pressed }) => [styles.settingsTile, pressed && { opacity: 0.85 }]}
          >
            <View style={styles.settingsTileLeft}>
              <View style={styles.settingsIconBg}>
                <AppIcon ios="globe" android="globe-outline" size={20} color={color.accent} />
              </View>
              <View>
                <Text style={styles.settingsTileTitle}>{t("profile_settings_language")}</Text>
                <Text style={styles.settingsTileSubtitle}>
                  {t("settings_active_language")}: {locale.toUpperCase()}
                </Text>
              </View>
            </View>
            <AppIcon ios="chevron.right" android="chevron-forward" size={18} color={color.textMuted} />
          </Pressable>
        </View>

        {/* User Showcase Demos Grid */}
        <View style={styles.gridHeader}>
          <Text style={styles.sectionHeading}>{t("profile_videos_stat")}</Text>
        </View>

        <View style={styles.grid}>
          {(videos.data?.items ?? []).length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>{t("profile_empty_demos")}</Text>
            </View>
          ) : (
            (videos.data?.items ?? []).map((item) => (
              <Pressable key={item.id} style={styles.tile}>
                <Text style={styles.tileText} numberOfLines={3}>
                  {item.caption ?? "Project Demo"}
                </Text>
              </Pressable>
            ))
          )}
        </View>

        <View style={styles.out}>
          <Button label={t("btn_sign_out")} variant="ghost" onPress={() => void signOut()} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  edit: {
    padding: space[4],
    gap: space[3],
    backgroundColor: color.surface,
    marginHorizontal: space[4],
    borderRadius: radius.md,
    marginBottom: space[3],
    borderWidth: 1,
    borderColor: color.border,
  },
  settingsSection: {
    paddingHorizontal: space[4],
    marginVertical: space[3],
  },
  settingsTile: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    padding: space[4],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: color.border,
  },
  settingsTileLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
  },
  settingsIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(200, 245, 66, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  settingsTileTitle: {
    color: color.text,
    fontSize: 15,
    fontFamily: font.semibold,
    fontWeight: "600",
  },
  settingsTileSubtitle: {
    color: color.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  gridHeader: {
    paddingHorizontal: space[4],
    paddingTop: space[3],
    paddingBottom: space[2],
  },
  sectionHeading: {
    color: color.text,
    fontSize: 18,
    fontFamily: font.semibold,
    fontWeight: "700",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", padding: space[4], gap: space[3] },
  emptyWrap: {
    width: "100%",
    paddingVertical: space[6],
    alignItems: "center",
  },
  emptyText: {
    color: color.textMuted,
    fontSize: 14,
  },
  tile: {
    width: "30.5%",
    aspectRatio: 9 / 16,
    backgroundColor: color.surface,
    borderRadius: radius.sm,
    padding: 8,
    justifyContent: "flex-end",
    borderWidth: 1,
    borderColor: color.border,
  },
  tileText: { color: color.text, fontSize: 12, fontFamily: font.medium },
  out: { padding: space[5], paddingBottom: 120 },
});
