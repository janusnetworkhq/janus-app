import { Redirect, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiConfig } from "@/api/config";
import { useSessionStore } from "@/auth/session-store";
import { useMe } from "@/auth/use-me";
import { useTranslation } from "@/i18n";
import { color, font, radius, space } from "@/theme";
import { AppIcon } from "@/ui/AppIcon";
import { Button } from "@/ui/Button";

export default function WelcomeScreen() {
  const router = useRouter();
  const token = useSessionStore((s) => s.accessToken);
  const me = useMe();
  const { t, locale } = useTranslation();

  if (token && me.data && !me.data.profileComplete) return <Redirect href="/(auth)/onboarding" />;
  if (token && me.data?.profileComplete) return <Redirect href="/(app)" />;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {/* Top Header with Language & Settings Access */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Text style={styles.mark}>{t("welcome_brand")}</Text>
        </View>
        <Pressable
          style={styles.settingsBtn}
          onPress={() => router.push("/settings")}
          hitSlop={10}
          accessibilityLabel={t("btn_settings")}
        >
          <Text style={styles.localePill}>{locale.toUpperCase()}</Text>
          <AppIcon ios="gearshape.fill" android="settings" size={20} color={color.text} />
        </Pressable>
      </View>

      {/* Hero Content */}
      <View style={styles.hero}>
        <Text style={styles.title}>{t("welcome_tagline")}</Text>
        <Text style={styles.body}>{t("welcome_description")}</Text>
      </View>

      {/* Action Buttons & Trust Badge */}
      <View style={styles.actions}>
        <Button
          label={apiConfig.authMode === "cognito" ? t("welcome_cta_oauth") : t("welcome_cta_default")}
          onPress={() => router.push("/(auth)/sign-in")}
        />

        <View style={styles.trustBadge}>
          <AppIcon ios="lock.shield.fill" android="shield-checkmark" size={16} color={color.accent} />
          <Text style={styles.hint}>{t("welcome_trust_badge")}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: color.bg,
    paddingHorizontal: space[5],
    paddingVertical: space[4],
    justifyContent: "space-between",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: space[2],
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  mark: {
    color: color.accent,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 4,
    fontFamily: font.semibold,
  },
  settingsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: color.surface,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
  },
  localePill: {
    color: color.accent,
    fontSize: 12,
    fontWeight: "700",
    fontFamily: font.semibold,
  },
  hero: {
    gap: space[4],
    marginVertical: "auto",
  },
  title: {
    color: color.text,
    fontSize: 34,
    fontFamily: font.semibold,
    fontWeight: "700",
    lineHeight: 42,
    letterSpacing: -0.5,
  },
  body: {
    color: color.textMuted,
    fontSize: 16,
    lineHeight: 25,
    maxWidth: 340,
  },
  actions: {
    gap: space[4],
    marginBottom: space[3],
  },
  trustBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: space[3],
  },
  hint: {
    color: color.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    flex: 1,
  },
});
