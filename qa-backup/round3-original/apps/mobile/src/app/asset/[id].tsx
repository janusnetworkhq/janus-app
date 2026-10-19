import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useVideoPlayer, VideoView } from "expo-video";
import * as ScreenCapture from "expo-screen-capture";
import * as WebBrowser from "expo-web-browser";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { post } from "@/api/client";
import { ApiClientError } from "@/api/errors";
import type { Playback } from "@/api/types";
import { useTranslation } from "@/i18n";
import { color, font, space } from "@/theme";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorView } from "@/ui/ErrorView";

export default function AssetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const play = useQuery({
    queryKey: ["playback", id],
    queryFn: () => post<Playback>(`/v1/vault/assets/${id}/playback`),
    staleTime: 30_000,
  });

  useEffect(() => {
    void ScreenCapture.preventScreenCaptureAsync();
    return () => {
      void ScreenCapture.allowScreenCaptureAsync();
    };
  }, []);

  useEffect(() => {
    const data = play.data;
    if (!data) return;
    if (data.contentType.startsWith("video/")) return;
    // Documents open in the system viewer; when it is dismissed, leave this placeholder
    // screen instead of stranding the user on "Preparing protected viewer...".
    void WebBrowser.openBrowserAsync(data.url).then(() => {
      if (router.canGoBack()) router.back();
    });
  }, [play.data, router]);

  if (play.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={color.accent} />
      </View>
    );
  }
  if (play.isError) {
    const err = play.error;
    if (err instanceof ApiClientError && err.isVaultDenied) {
      return (
        <EmptyState
          title={t("vault_denied_title")}
          body={t("vault_denied_body")}
        />
      );
    }
    return <ErrorView error={play.error} />;
  }

  const data = play.data;
  if (!data) return null;

  if (data.contentType.startsWith("video/")) {
    return <VaultPlayer url={data.url} watermark={data.watermarkToken} watermarkLabel={t("asset_watermark_label")} />;
  }

  return (
    <View style={styles.center}>
      <Text style={styles.hint}>{t("asset_preparing_viewer")}</Text>
      <Text style={styles.mark}>{t("app_name")} · {data.watermarkToken}</Text>
    </View>
  );
}

function VaultPlayer({
  url,
  watermark,
  watermarkLabel,
}: {
  url: string;
  watermark: string;
  watermarkLabel: string;
}) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
    p.play();
  });
  return (
    <View style={styles.player}>
      <VideoView player={player} style={StyleSheet.absoluteFill} nativeControls contentFit="contain" />
      <Text style={styles.watermark} pointerEvents="none">
        {watermarkLabel} · {watermark}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center", gap: space[3] },
  player: { flex: 1, backgroundColor: "#000" },
  watermark: {
    position: "absolute",
    bottom: 48,
    alignSelf: "center",
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    fontFamily: font.medium,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  hint: { color: color.textMuted, fontSize: 15 },
  mark: { color: color.accent, fontWeight: "700" },
});
