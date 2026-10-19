import { StyleSheet, Text, View } from "react-native";
import { ApiClientError } from "../api/errors";
import { useTranslation } from "../i18n";
import { color, font, space } from "../theme";
import { Button } from "./Button";

export function ErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation();
  const message =
    error instanceof ApiClientError ? error.userMessage : t("status_error_body");

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("status_error_title")}</Text>
      <Text style={styles.body}>{message}</Text>
      {onRetry ? <Button label={t("btn_retry")} onPress={onRetry} variant="surface" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: space[6], gap: space[3] },
  title: { color: color.text, fontSize: 20, fontFamily: font.semibold, fontWeight: "600" },
  body: { color: color.textMuted, textAlign: "center", lineHeight: 22 },
});
