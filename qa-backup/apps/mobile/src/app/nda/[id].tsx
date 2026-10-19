import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import {
  Alert,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { get, post } from "@/api/client";
import { keys } from "@/api/query";
import type { NdaTemplate } from "@/api/types";
import { newIdempotencyKey } from "@/auth/actions";
import { useTranslation } from "@/i18n";
import { color, font, radius, space } from "@/theme";
import { AppIcon } from "@/ui/AppIcon";
import { Button } from "@/ui/Button";
import { TextField } from "@/ui/TextField";
import { ErrorView } from "@/ui/ErrorView";

export default function NdaSignScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const template = useQuery({
    queryKey: keys.ndaTemplate,
    queryFn: () => get<NdaTemplate>("/v1/nda/templates/default"),
  });
  const [typedName, setTypedName] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [busy, setBusy] = useState(false);
  const maxY = useRef(0);

  const hashPreview = useMemo(
    () => template.data?.contentSha256.slice(0, 12).toUpperCase() ?? "",
    [template.data]
  );

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    maxY.current = Math.max(maxY.current, contentOffset.y);
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 30) setScrolled(true);
  };

  const sign = async () => {
    if (!template.data) return;
    setBusy(true);
    try {
      const res = await post<{ agreementId?: string; body?: { agreementId: string } }>(
        `/v1/nda/requests/${id}/sign`,
        { typedName, acceptedHash: template.data.contentSha256 },
        { idempotencyKey: newIdempotencyKey() },
      );
      Alert.alert(t("nda_signed_title"), t("nda_signed_body"));
      router.back();
      void res;
    } catch (error) {
      Alert.alert(
        t("status_error_title"),
        error instanceof Error ? error.message : t("nda_sign_error")
      );
    } finally {
      setBusy(false);
    }
  };

  if (template.isError) return <ErrorView error={template.error} />;
  if (!template.data) return null;

  return (
    <View style={styles.root}>
      <ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={styles.scroll}>
        <View style={styles.badgeRow}>
          <Text style={styles.kicker}>
            {t("nda_kicker")} · V{template.data.version}
          </Text>
        </View>

        <Text style={styles.title}>{template.data.title}</Text>

        <View style={styles.sealCard}>
          <AppIcon ios="checkmark.seal.fill" android="shield-checkmark" size={18} color={color.accent} />
          <Text style={styles.sealText}>
            {t("nda_seal_label")} (ID: {hashPreview})
          </Text>
        </View>

        <Text style={styles.body}>{template.data.body}</Text>
      </ScrollView>

      <View style={styles.footer}>
        <TextField
          label={t("nda_field_legal_name")}
          value={typedName}
          onChangeText={setTypedName}
          placeholder={t("nda_field_placeholder")}
          autoCapitalize="words"
        />
        <Button
          label={t("nda_btn_sign")}
          loading={busy}
          disabled={!scrolled || typedName.trim().length < 2}
          onPress={() => void sign()}
        />
        {!scrolled ? <Text style={styles.hint}>{t("nda_scroll_hint")}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  scroll: { padding: space[5], paddingBottom: 240, gap: space[3] },
  badgeRow: { flexDirection: "row", alignItems: "center" },
  kicker: { color: color.accent, letterSpacing: 2, fontSize: 11, fontWeight: "700" },
  title: { color: color.text, fontSize: 24, fontFamily: font.semibold, fontWeight: "700" },
  sealCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: color.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.border,
  },
  sealText: { color: color.textMuted, fontSize: 12, fontFamily: font.regular },
  body: { color: color.text, fontSize: 15, lineHeight: 24 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: space[4],
    paddingBottom: space[6],
    backgroundColor: color.bg,
    gap: space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
  },
  hint: { color: color.warning, fontSize: 12, textAlign: "center" },
});
