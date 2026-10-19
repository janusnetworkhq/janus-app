import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { signOut } from "@/auth/actions";
import { useMe } from "@/auth/use-me";
import {
  SUPPORTED_LANGUAGES,
  useTranslation,
  type LanguageInfo,
  type SupportedLanguage,
} from "@/i18n";
import { color, font, radius, space } from "@/theme";
import { AppIcon } from "@/ui/AppIcon";
import { Button } from "@/ui/Button";

export default function SettingsScreen() {
  const router = useRouter();
  const { t, locale, setLanguage } = useTranslation();
  const me = useMe();
  const user = me.data;

  const onSelectLanguage = (code: SupportedLanguage) => {
    void Haptics.selectionAsync();
    void setLanguage(code);
  };

  const usUkLanguages = SUPPORTED_LANGUAGES.filter((l) => l.region === "us_uk");
  const indianLanguages = SUPPORTED_LANGUAGES.filter((l) => l.region === "india");

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {/* Top Navigation Bar */}
      <View style={styles.navBar}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={12}
          accessibilityLabel={t("btn_back")}
        >
          <AppIcon ios="chevron.left" android="chevron-back" size={24} color={color.text} />
          <Text style={styles.backText}>{t("btn_back")}</Text>
        </Pressable>
        <Text style={styles.navTitle}>{t("settings_title")}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Language Selection Header */}
        <View style={styles.sectionHeader}>
          <AppIcon ios="globe" android="globe-outline" size={20} color={color.accent} />
          <Text style={styles.sectionTitle}>{t("settings_section_language")}</Text>
        </View>

        {/* US & UK Languages */}
        <Text style={styles.regionTitle}>{t("settings_region_us_uk")}</Text>
        <View style={styles.cardGroup}>
          {usUkLanguages.map((lang, idx) => (
            <LanguageRow
              key={lang.code}
              lang={lang}
              active={locale === lang.code}
              isLast={idx === usUkLanguages.length - 1}
              onSelect={() => onSelectLanguage(lang.code)}
            />
          ))}
        </View>

        {/* Indian Languages */}
        <Text style={[styles.regionTitle, { marginTop: space[4] }]}>{t("settings_region_india")}</Text>
        <View style={styles.cardGroup}>
          {indianLanguages.map((lang, idx) => (
            <LanguageRow
              key={lang.code}
              lang={lang}
              active={locale === lang.code}
              isLast={idx === indianLanguages.length - 1}
              onSelect={() => onSelectLanguage(lang.code)}
            />
          ))}
        </View>

        {/* Security & IP Protection Info */}
        <View style={[styles.sectionHeader, { marginTop: space[6] }]}>
          <AppIcon ios="lock.shield" android="shield-checkmark-outline" size={20} color={color.accent} />
          <Text style={styles.sectionTitle}>{t("settings_section_security")}</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoBody}>{t("settings_security_desc")}</Text>
        </View>

        {/* About & Trust */}
        <View style={[styles.sectionHeader, { marginTop: space[5] }]}>
          <AppIcon ios="info.circle" android="information-circle-outline" size={20} color={color.textMuted} />
          <Text style={styles.sectionTitle}>{t("settings_section_about")}</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoBody}>{t("settings_about_desc")}</Text>
          <View style={styles.divider} />
          <Text style={styles.versionText}>{t("settings_app_version")}</Text>
        </View>

        {/* Account / Sign Out Section */}
        {user ? (
          <View style={{ marginTop: space[6], gap: space[3] }}>
            <View style={styles.userCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{user.displayName ?? user.handle}</Text>
                <Text style={styles.userMeta}>
                  @{user.handle} · {user.role === "STUDENT" ? t("onboard_student_role") : t("onboard_recruiter_role")}
                </Text>
              </View>
            </View>
            <Button
              label={t("btn_sign_out")}
              variant="danger"
              onPress={() => {
                void signOut().then(() => router.replace("/(auth)"));
              }}
            />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function LanguageRow({
  lang,
  active,
  isLast,
  onSelect,
}: {
  lang: LanguageInfo;
  active: boolean;
  isLast: boolean;
  onSelect: () => void;
}) {
  return (
    <Pressable
      onPress={onSelect}
      style={({ pressed }) => [
        styles.langRow,
        !isLast && styles.langRowBorder,
        active && styles.langRowActive,
        pressed && { opacity: 0.8 },
      ]}
    >
      <View style={styles.langLeft}>
        <Text style={styles.flag}>{lang.flag}</Text>
        <View style={{ gap: 2 }}>
          <Text style={[styles.nativeName, active && { color: color.accent }]}>{lang.nativeName}</Text>
          <Text style={styles.englishName}>{lang.name}</Text>
        </View>
      </View>
      {active ? (
        <View style={styles.checkBadge}>
          <AppIcon ios="checkmark" android="checkmark" size={18} color={color.accentInk} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, width: 60 },
  backText: { color: color.text, fontSize: 16, fontFamily: font.medium },
  navTitle: {
    color: color.text,
    fontSize: 17,
    fontFamily: font.semibold,
    fontWeight: "600",
    textAlign: "center",
  },
  scroll: { padding: space[4], paddingBottom: space[7] },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    marginBottom: space[2],
  },
  sectionTitle: {
    color: color.text,
    fontSize: 16,
    fontFamily: font.semibold,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  regionTitle: {
    color: color.textMuted,
    fontSize: 13,
    fontFamily: font.medium,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: space[2],
    marginTop: space[2],
  },
  cardGroup: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    overflow: "hidden",
  },
  langRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: space[3],
    paddingHorizontal: space[4],
  },
  langRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  langRowActive: {
    backgroundColor: "rgba(200, 245, 66, 0.08)",
  },
  langLeft: { flexDirection: "row", alignItems: "center", gap: space[3] },
  flag: { fontSize: 22 },
  nativeName: { color: color.text, fontSize: 16, fontFamily: font.semibold, fontWeight: "600" },
  englishName: { color: color.textMuted, fontSize: 13 },
  checkBadge: {
    backgroundColor: color.accent,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  infoCard: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    padding: space[4],
    borderWidth: 1,
    borderColor: color.border,
    gap: space[2],
  },
  infoBody: { color: color.textMuted, fontSize: 14, lineHeight: 21 },
  divider: { height: 1, backgroundColor: color.border, marginVertical: space[2] },
  versionText: { color: color.textMuted, fontSize: 12 },
  userCard: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    padding: space[4],
    borderWidth: 1,
    borderColor: color.border,
    flexDirection: "row",
    alignItems: "center",
  },
  userName: { color: color.text, fontSize: 16, fontWeight: "700" },
  userMeta: { color: color.textMuted, fontSize: 13, marginTop: 2 },
});
