import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "../i18n";
import { color, font, space } from "../theme";
import { AppIcon } from "../ui/AppIcon";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";

type Props = {
  displayName: string | null;
  handle: string;
  headline?: string | null;
  university?: string | null;
  city?: string | null;
  orgName?: string | null;
  title?: string | null;
  avatarUri?: string | null;
  bannerUri?: string | null;
  hasVault?: boolean;
  videoCount?: number;
  onEdit?: () => void;
  onFollow?: () => void;
  following?: boolean;
};

export function ProfileHeader({
  displayName,
  handle,
  headline,
  university,
  city,
  orgName,
  title,
  avatarUri,
  bannerUri,
  hasVault,
  videoCount,
  onEdit,
  onFollow,
  following,
}: Props) {
  const { t } = useTranslation();

  return (
    <View>
      <View style={styles.banner}>
        {bannerUri ? (
          <Image source={{ uri: bannerUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <LinearGradient colors={["#1C222C", "#0B0D10"]} style={StyleSheet.absoluteFill} />
        )}
      </View>
      <View style={styles.body}>
        <View style={styles.row}>
          <View style={styles.avatarRing}>
            <Avatar uri={avatarUri} name={displayName ?? handle} size={88} />
          </View>
          {onEdit ? (
            <Button
              label={t("btn_edit")}
              variant="surface"
              onPress={onEdit}
              style={styles.action}
            />
          ) : null}
          {onFollow ? (
            <Button
              label={following ? t("btn_following") : t("btn_follow")}
              variant={following ? "ghost" : "primary"}
              onPress={onFollow}
              style={styles.action}
            />
          ) : null}
        </View>
        <Text style={styles.name}>{displayName || handle}</Text>
        <Text style={styles.handle}>@{handle}</Text>
        {headline ? <Text style={styles.headline}>{headline}</Text> : null}
        {title && orgName ? <Text style={styles.meta}>{title} · {orgName}</Text> : null}
        {university ? (
          <Text style={styles.meta}>
            {university}
            {city ? ` · ${city}` : ""}
          </Text>
        ) : null}
        <View style={styles.stats}>
          {typeof videoCount === "number" ? (
            <Text style={styles.stat}>
              {videoCount} {t("profile_videos_stat")}
            </Text>
          ) : null}
          {hasVault ? (
            <View style={styles.lock}>
              <AppIcon ios="lock.shield.fill" android="shield-checkmark" size={14} color={color.accent} />
              <Text style={styles.lockText}>{t("profile_protected_vault")}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { height: 140, backgroundColor: color.surface },
  body: { paddingHorizontal: space[4], paddingBottom: space[4], marginTop: -44 },
  row: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  avatarRing: {
    borderWidth: 3,
    borderColor: color.bg,
    borderRadius: 48,
    backgroundColor: color.bg,
  },
  action: { minHeight: 40, paddingHorizontal: space[4], marginBottom: 4 },
  name: { color: color.text, fontSize: 24, fontFamily: font.semibold, fontWeight: "700", marginTop: space[3] },
  handle: { color: color.textMuted, fontSize: 15, marginTop: 2 },
  headline: { color: color.text, fontSize: 16, marginTop: space[3], lineHeight: 22 },
  meta: { color: color.textMuted, fontSize: 14, marginTop: 6 },
  stats: { flexDirection: "row", gap: space[3], marginTop: space[4], alignItems: "center" },
  stat: { color: color.textMuted, fontSize: 13 },
  lock: {
    backgroundColor: color.surfaceRaised,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: color.border,
  },
  lockText: { color: color.accent, fontSize: 12, fontWeight: "600" },
});
