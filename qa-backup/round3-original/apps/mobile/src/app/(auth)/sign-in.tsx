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
import { apiConfig } from "@/api/config";
import { lookupEmail, sendOtp, signInCognito } from "@/auth/actions";
import { useTranslation } from "@/i18n";
import { color, font, radius, space } from "@/theme";
import { AppIcon } from "@/ui/AppIcon";
import { Button } from "@/ui/Button";
import { TextField } from "@/ui/TextField";

export default function SignInScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [checkedEmail, setCheckedEmail] = useState("");
  const [name, setName] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);
  const [busy, setBusy] = useState(false);

  const cleanEmail = email.trim().toLowerCase();
  const isEmailValid = cleanEmail.length >= 5 && cleanEmail.includes("@");

  const handleEmailChange = (text: string) => {
    setEmail(text);
    // If user changes email after we detected new user, reset state
    if (isNewUser && text.trim().toLowerCase() !== checkedEmail) {
      setIsNewUser(false);
    }
  };

  const onContinue = async () => {
    if (!isEmailValid) return;
    setBusy(true);

    try {
      if (apiConfig.authMode === "cognito") {
        await signInCognito();
        router.replace("/(auth)/onboarding");
        return;
      }

      if (!isNewUser) {
        // Step 1: Check if user exists in the database
        const lookup = await lookupEmail(cleanEmail);
        setCheckedEmail(cleanEmail);

        if (lookup.exists) {
          // Existing user -> Send OTP directly and go to OTP verification screen
          await sendOtp(cleanEmail);
          router.push({
            pathname: "/(auth)/otp",
            params: { email: cleanEmail, isNew: "false" },
          });
        } else {
          // First-time registered user -> Reveal Full Name input
          setIsNewUser(true);
          if (lookup.displayName) {
            setName(lookup.displayName);
          }
        }
      } else {
        // Step 2: New user entered full name -> Send OTP and proceed to OTP screen
        const trimmedName = name.trim();
        if (trimmedName.length < 2) {
          Alert.alert(t("signin_error_title"), t("signin_name_label"));
          return;
        }

        await sendOtp(cleanEmail, trimmedName);
        router.push({
          pathname: "/(auth)/otp",
          params: { email: cleanEmail, name: trimmedName, isNew: "true" },
        });
      }
    } catch (error) {
      Alert.alert(
        t("signin_error_title"),
        error instanceof Error ? error.message : t("signin_error_message")
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {/* Top Back Navigation */}
      <View style={styles.topNav}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={12}
          accessibilityLabel={t("btn_back")}
        >
          <AppIcon ios="chevron.left" android="chevron-back" size={24} color={color.text} />
          <Text style={styles.backLabel}>{t("btn_back")}</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>{t("signin_title")}</Text>
              <Text style={styles.body}>{t("signin_subtitle")}</Text>
            </View>

            <View style={styles.form}>
              <TextField
                label={t("signin_email_label")}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={email}
                onChangeText={handleEmailChange}
                placeholder={t("signin_email_placeholder")}
                editable={!busy}
              />

              {/* Dynamic New User Prompt & Full Name Input */}
              {isNewUser ? (
                <View style={styles.newUserBox}>
                  <View style={styles.noticeBanner}>
                    <AppIcon
                      ios="sparkles"
                      android="star"
                      size={18}
                      color={color.accent}
                    />
                    <Text style={styles.noticeText}>
                      {t("signin_new_user_notice")}
                    </Text>
                  </View>

                  <TextField
                    label={t("signin_name_label")}
                    autoCapitalize="words"
                    autoFocus={true}
                    value={name}
                    onChangeText={setName}
                    placeholder={t("signin_name_placeholder")}
                    editable={!busy}
                  />
                </View>
              ) : null}
            </View>

            <Button
              label={
                isNewUser
                  ? t("signin_btn_send_code")
                  : t("signin_btn_continue")
              }
              onPress={() => void onContinue()}
              loading={busy}
              disabled={!isEmailValid || (isNewUser && name.trim().length < 2)}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  topNav: {
    paddingHorizontal: space[5],
    paddingVertical: space[3],
    flexDirection: "row",
    alignItems: "center",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  backLabel: {
    color: color.text,
    fontSize: 16,
    fontFamily: font.medium,
  },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: space[5],
    paddingBottom: space[6],
  },
  content: { gap: space[5] },
  header: { gap: space[2] },
  title: {
    color: color.text,
    fontSize: 32,
    fontFamily: font.semibold,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  body: {
    color: color.textMuted,
    fontSize: 16,
    lineHeight: 24,
  },
  form: { gap: space[4] },
  newUserBox: {
    gap: space[4],
  },
  noticeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    backgroundColor: "rgba(200, 245, 66, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(200, 245, 66, 0.25)",
    borderRadius: radius.md,
    padding: space[3],
  },
  noticeText: {
    flex: 1,
    color: color.text,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: font.medium,
  },
});
