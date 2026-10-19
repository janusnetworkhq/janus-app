import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as ScreenCapture from "expo-screen-capture";
import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { get } from "@/api/client";
import { keys } from "@/api/query";
import { ApiClientError } from "@/api/errors";
import type { VaultAsset } from "@/api/types";
import { useTranslation } from "@/i18n";
import { color, font, radius, space } from "@/theme";
import { AppIcon } from "@/ui/AppIcon";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorView } from "@/ui/ErrorView";

export default function VaultScreen() {
  const { studentId } = useLocalSearchParams<{ studentId: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const vault = useQuery({
    queryKey: keys.vault(studentId),
    queryFn: () => get<{ items: VaultAsset[] }>(`/v1/vault/students/${studentId}`),
  });

  useEffect(() => {
    void ScreenCapture.preventScreenCaptureAsync();
    return () => {
      void ScreenCapture.allowScreenCaptureAsync();
    };
  }, []);

  if (vault.isError) {
    const err = vault.error;
    if (err instanceof ApiClientError && err.isVaultDenied) {
      return (
        <EmptyState
          title={t("vault_denied_title")}
          body={t("vault_denied_body")}
        />
      );
    }
    return <ErrorView error={vault.error} onRetry={() => void vault.refetch()} />;
  }

  const items = vault.data?.items ?? [];

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.list}>
      {items.length === 0 ? (
        <EmptyState
          title={t("vault_empty_title")}
          body={t("vault_empty_body")}
        />
      ) : (
        items.map((asset) => (
          <Pressable
            key={asset.id}
            onPress={() => router.push(`/asset/${asset.id}`)}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
          >
            <View style={styles.fileIconBox}>
              <AppIcon
                ios="doc.text.fill"
                android="document-text"
                size={22}
                color={color.accent}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{asset.originalName ?? asset.kind}</Text>
              <Text style={styles.meta}>
                {asset.contentType} · {formatBytes(asset.byteSize)}
              </Text>
            </View>
            <Text style={styles.open}>{t("vault_btn_open")}</Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  list: { padding: space[4], gap: space[3] },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    padding: space[4],
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: color.border,
    gap: space[3],
  },
  fileIconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: "rgba(200, 245, 66, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  name: { color: color.text, fontSize: 16, fontFamily: font.semibold, fontWeight: "600" },
  meta: { color: color.textMuted, fontSize: 13, marginTop: 4 },
  open: { color: color.accent, fontWeight: "700" },
});
