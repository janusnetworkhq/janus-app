import { useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { sendOtp, verifyOtp } from "@/auth/actions";
import { useTranslation } from "@/i18n";
import { color, font, radius, space } from "@/theme";
import { AppIcon } from "@/ui/AppIcon";
import { Button } from "@/ui/Button";

export default function OtpVerificationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    email?: string;
    name?: string;
    isNew?: string;
  }>();

  const { t } = useTranslation();
  const email = (params.email ?? "").trim().toLowerCase();
  const name = params.name ? decodeURIComponent(params.name) : undefined;
  const isNew = params.isNew === "true";

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [resending, setResending] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Focus input automatically on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  // 30-second countdown for resending code
  useEffect(() => {
    if (countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown]);

  const handleVerify = async (enteredCode?: string) => {
    const codeToVerify = (enteredCode ?? code).trim();
    if (codeToVerify.length !== 6 || busy) return;

    setBusy(true);
    try {
      const res = await verifyOtp(email, codeToVerify, name);

      // If user profile is already complete, navigate straight to main feed
      if (res.profileComplete && !isNew) {
        router.replace("/(app)");
      } else {
        // First-time or incomplete profile -> complete onboarding
        router.replace("/(auth)/onboarding");
      }
    } catch (error) {
      Alert.alert(
        t("signin_error_title"),
        error instanceof Error ? error.message : t("otp_error_invalid")
      );
      setCode("");
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const handleCodeChange = (text: string) => {
    const numeric = text.replace(/[^0-9]/g, "").slice(0, 6);
    setCode(numeric);
    if (numeric.length === 6) {
      void handleVerify(numeric);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || resending) return;
    setResending(true);
    try {
      await sendOtp(email, name);
      setCountdown(30);
      Alert.alert(t("app_name"), t("otp_resend_success"));
    } catch (error) {
      Alert.alert(
        t("signin_error_title"),
        error instanceof Error ? error.message : t("signin_error_message")
      );
    } finally {
      setResending(false);
    }
  };

  const digits = code.split("");

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
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>{t("otp_title")}</Text>
            <Text style={styles.body}>
              {t("otp_subtitle")}{" "}
              <Text style={styles.emailHighlight}>{email}</Text>
            </Text>
            <Pressable
              onPress={() => router.back()}
              hitSlop={8}
              style={styles.changeEmailBtn}
            >
              <Text style={styles.changeEmailText}>{t("otp_change_email")}</Text>
            </Pressable>
          </View>

          {/* Hidden input for keyboard handling */}
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={handleCodeChange}
            keyboardType="number-pad"
            maxLength={6}
            textContentType="oneTimeCode"
            autoFocus={true}
            style={styles.hiddenInput}
            editable={!busy}
          />

          {/* 6 Digit Display Boxes */}
          <Pressable
            style={styles.digitsContainer}
            onPress={() => inputRef.current?.focus()}
          >
            {[0, 1, 2, 3, 4, 5].map((index) => {
              const char = digits[index] ?? "";
              const isCurrent = index === digits.length && !char;
              return (
                <View
                  key={index}
                  style={[
                    styles.digitBox,
                    char ? styles.digitBoxFilled : null,
                    isCurrent ? styles.digitBoxActive : null,
                  ]}
                >
                  <Text style={styles.digitText}>{char}</Text>
                </View>
              );
            })}
          </Pressable>

          {/* Verification CTA */}
          <Button
            label={t("otp_btn_verify")}
            onPress={() => void handleVerify()}
            loading={busy}
            disabled={code.length !== 6}
          />

          {/* Resend Countdown / Button */}
          <View style={styles.resendRow}>
            {countdown > 0 ? (
              <Text style={styles.countdownText}>
                {t("otp_resend_countdown").replace("{seconds}", countdown.toString())}
              </Text>
            ) : (
              <Pressable
                onPress={() => void handleResend()}
                disabled={resending}
                hitSlop={8}
              >
                <Text style={styles.resendBtnText}>{t("otp_resend_btn")}</Text>
              </Pressable>
            )}
          </View>
        </View>
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
  flex: { flex: 1, justifyContent: "center", paddingHorizontal: space[5] },
  content: { gap: space[5] },
  header: { gap: space[2] },
  title: {
    color: color.text,
    fontSize: 28,
    fontFamily: font.semibold,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  body: {
    color: color.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  emailHighlight: {
    color: color.accent,
    fontWeight: "600",
  },
  changeEmailBtn: {
    alignSelf: "flex-start",
    marginTop: 2,
  },
  changeEmailText: {
    color: color.accent,
    fontSize: 14,
    fontFamily: font.medium,
    textDecorationLine: "underline",
  },
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    width: 1,
    height: 1,
  },
  digitsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: space[2],
  },
  digitBox: {
    width: 48,
    height: 58,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    borderColor: color.border,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  digitBoxFilled: {
    borderColor: color.accent,
    backgroundColor: "rgba(200, 245, 66, 0.05)",
  },
  digitBoxActive: {
    borderColor: color.accent,
    backgroundColor: "rgba(200, 245, 66, 0.12)",
  },
  digitText: {
    color: color.text,
    fontSize: 24,
    fontFamily: font.semibold,
    fontWeight: "700",
  },
  resendRow: {
    alignItems: "center",
    marginTop: space[2],
  },
  countdownText: {
    color: color.textMuted,
    fontSize: 14,
    fontFamily: font.regular,
  },
  resendBtnText: {
    color: color.accent,
    fontSize: 15,
    fontFamily: font.semibold,
    fontWeight: "600",
  },
});
