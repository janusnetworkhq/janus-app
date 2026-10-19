import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { post } from "@/api/client";
import { queryClient } from "@/api/query";
import type { Me, UserRole } from "@/api/types";
import { useSessionStore } from "@/auth/session-store";
import { useMe } from "@/auth/use-me";
import { useTranslation } from "@/i18n";
import { color, font, radius, space } from "@/theme";
import { AppIcon } from "@/ui/AppIcon";
import { Button } from "@/ui/Button";
import { TextField } from "@/ui/TextField";

export default function OnboardingScreen() {
  const router = useRouter();
  const me = useMe();
  const { t } = useTranslation();
  const sessionName = useSessionStore((s) => s.localClaims?.name);
  const [role, setRole] = useState<UserRole | null>(me.data?.role ?? null);
  // null = user hasn't typed yet, so fall back to the name from the account/session
  // (derived at render instead of copied into state by an effect).
  const [nameInput, setDisplayName] = useState<string | null>(null);
  const displayName = nameInput ?? me.data?.displayName ?? sessionName ?? "";
  const [university, setUniversity] = useState("");
  const [headline, setHeadline] = useState("");
  const [city, setCity] = useState("Bengaluru");
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!role) return;
    setBusy(true);
    try {
      await post<Me>("/v1/me/profile", {
        role,
        displayName: displayName.trim(),
        university: role === "STUDENT" ? university.trim() : undefined,
        headline: role === "STUDENT" ? headline.trim() : undefined,
        city: role === "STUDENT" ? city.trim() : undefined,
        orgName: role === "RECRUITER" ? orgName.trim() : undefined,
        orgSlug: role === "RECRUITER" ? orgSlug.trim() : undefined,
        title: role === "RECRUITER" ? title.trim() : undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      router.replace("/(app)");
    } catch (error) {
      Alert.alert(
        t("onboard_error_title"),
        error instanceof Error ? error.message : t("btn_retry")
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>{t("onboard_title")}</Text>
            <Text style={styles.subtitle}>{t("onboard_subtitle")}</Text>
          </View>

          {/* Role Selection Cards */}
          <View style={styles.roles}>
            <RoleCard
              selected={role === "STUDENT"}
              title={t("onboard_student_role")}
              body={t("onboard_student_desc")}
              iconIos="graduationcap.fill"
              iconAndroid="school"
              onPress={() => setRole("STUDENT")}
            />
            <RoleCard
              selected={role === "RECRUITER"}
              title={t("onboard_recruiter_role")}
              body={t("onboard_recruiter_desc")}
              iconIos="briefcase.fill"
              iconAndroid="briefcase"
              onPress={() => setRole("RECRUITER")}
            />
          </View>

          {/* Profile Details Form */}
          <View style={styles.formSection}>
            <TextField
              label={t("onboard_name_label")}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder={t("onboard_name_placeholder")}
            />

            {role === "STUDENT" ? (
              <>
                <TextField
                  label={t("onboard_university_label")}
                  value={university}
                  onChangeText={setUniversity}
                  placeholder={t("onboard_university_placeholder")}
                />
                <TextField
                  label={t("onboard_headline_label")}
                  value={headline}
                  onChangeText={setHeadline}
                  placeholder={t("onboard_headline_placeholder")}
                />
                <TextField
                  label={t("onboard_city_label")}
                  value={city}
                  onChangeText={setCity}
                  placeholder={t("onboard_city_placeholder")}
                />
              </>
            ) : null}

            {role === "RECRUITER" ? (
              <>
                <TextField
                  label={t("onboard_org_label")}
                  value={orgName}
                  onChangeText={setOrgName}
                  placeholder={t("onboard_org_placeholder")}
                />
                <TextField
                  label={t("onboard_orgslug_label")}
                  autoCapitalize="none"
                  value={orgSlug}
                  onChangeText={setOrgSlug}
                  placeholder={t("onboard_orgslug_placeholder")}
                />
                <TextField
                  label={t("onboard_jobtitle_label")}
                  value={title}
                  onChangeText={setTitle}
                  placeholder={t("onboard_jobtitle_placeholder")}
                />
              </>
            ) : null}
          </View>

          <Button
            label={t("onboard_submit_btn")}
            onPress={() => void submit()}
            loading={busy}
            disabled={
              !role ||
              displayName.trim().length < 2 ||
              (role === "RECRUITER" && !orgName.trim())
            }
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function RoleCard({
  selected,
  title,
  body,
  iconIos,
  iconAndroid,
  onPress,
}: {
  selected: boolean;
  title: string;
  body: string;
  iconIos: Parameters<typeof AppIcon>[0]["ios"];
  iconAndroid: Parameters<typeof AppIcon>[0]["android"];
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardOn,
        pressed && { opacity: 0.9 },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.iconBox, selected && styles.iconBoxActive]}>
          <AppIcon
            ios={iconIos}
            android={iconAndroid}
            size={22}
            color={selected ? color.accent : color.textMuted}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, selected && { color: color.accent }]}>{title}</Text>
        </View>
        <View style={[styles.radio, selected && styles.radioActive]}>
          {selected ? <View style={styles.radioDot} /> : null}
        </View>
      </View>
      <Text style={styles.cardBody}>{body}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  scroll: { padding: space[5], gap: space[4], paddingBottom: space[7] },
  header: { gap: space[2], marginBottom: space[2] },
  title: { color: color.text, fontSize: 30, fontFamily: font.semibold, fontWeight: "700" },
  subtitle: { color: color.textMuted, fontSize: 15, lineHeight: 22 },
  roles: { gap: space[3] },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    padding: space[4],
    borderWidth: 1.5,
    borderColor: color.border,
    gap: space[2],
  },
  cardOn: {
    borderColor: color.accent,
    backgroundColor: "rgba(200, 245, 66, 0.05)",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: color.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBoxActive: {
    backgroundColor: "rgba(200, 245, 66, 0.15)",
  },
  cardTitle: { color: color.text, fontSize: 17, fontWeight: "700" },
  cardBody: { color: color.textMuted, fontSize: 14, lineHeight: 20, paddingLeft: 52 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: color.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: {
    borderColor: color.accent,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: color.accent,
  },
  formSection: {
    gap: space[4],
    marginVertical: space[2],
  },
});
