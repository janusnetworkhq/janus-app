import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Redirect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { get } from "@/api/client";
import { queryClient } from "@/api/query";
import type { FeedItem } from "@/api/types";
import { useMe } from "@/auth/use-me";
import { useTranslation } from "@/i18n";
import { color, font, space } from "@/theme";
import { AppIcon } from "@/ui/AppIcon";
import { Button } from "@/ui/Button";
import { TextField } from "@/ui/TextField";
import { uploadFile } from "@/upload/uploader";

type Step = "pick" | "caption" | "vault" | "uploading";

const MAX_MS = 90_000;

export default function CreateScreen() {
  const me = useMe();
  const router = useRouter();
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("pick");
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [caption, setCaption] = useState("");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState(t("create_status_uploading"));

  if (me.data?.role === "RECRUITER") return <Redirect href="/(app)/discover" />;

  const pick = async (camera: boolean) => {
    const fn = camera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    let res: ImagePicker.ImagePickerResult;
    try {
      if (camera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Camera access needed", "Allow camera access in Settings, or choose a video from your library.");
          return;
        }
      }
      res = await fn({
        mediaTypes: ["videos"],
        videoMaxDuration: 90,
        allowsEditing: false,
        quality: 1,
      });
    } catch (err) {
      // e.g. no camera on the simulator, or permission revoked mid-flow
      Alert.alert("Couldn't open video picker", err instanceof Error ? err.message : String(err));
      return;
    }
    if (res.canceled || !res.assets[0]) return;
    const next = res.assets[0];
    const durationMs = Math.round((next.duration ?? 0) * (next.duration && next.duration < 1000 ? 1000 : 1));
    if (durationMs > MAX_MS) {
      Alert.alert(t("create_error_too_long_title"), t("create_error_too_long_body"));
      return;
    }
    setAsset(next);
    setStep("caption");
  };

  const publish = async (vault?: { uri: string; mime: string; name: string; size: number }) => {
    if (!asset?.uri) return;
    setStep("uploading");
    try {
      const byteSize = asset.fileSize ?? 1;
      const durationMs = Math.round((asset.duration ?? 15) * ((asset.duration ?? 0) < 1000 ? 1000 : 1));
      const { videoId } = await uploadFile({
        uri: asset.uri,
        kind: "FEED_VIDEO",
        contentType: asset.mimeType ?? "video/mp4",
        byteSize,
        durationMs,
        caption,
        onProgress: setProgress,
      });
      if (vault && videoId) {
        setStatus(t("create_status_attaching"));
        await uploadFile({
          uri: vault.uri,
          kind: "VAULT_FILE",
          contentType: vault.mime,
          byteSize: vault.size,
          originalName: vault.name,
          vaultKind: "OTHER",
          videoId,
          onProgress: setProgress,
        });
      }
      if (videoId) {
        setStatus(t("create_status_processing"));
        await waitForReady(videoId, t("create_error_transcode"));
      }
      await queryClient.invalidateQueries({ queryKey: ["feed"] });
      router.replace("/(app)");
    } catch (error) {
      Alert.alert(
        t("create_error_upload_failed"),
        error instanceof Error ? error.message : t("btn_retry")
      );
      setStep("vault");
    }
  };

  const attachVault = async () => {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    if (res.canceled || !res.assets[0]) return;
    const file = res.assets[0];
    await publish({
      uri: file.uri,
      mime: file.mimeType ?? "application/octet-stream",
      name: file.name,
      size: file.size ?? 1,
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {/* Top Header */}
      <View style={styles.topBar}>
        {step !== "pick" && step !== "uploading" ? (
          <Pressable
            onPress={() => setStep(step === "vault" ? "caption" : "pick")}
            style={styles.backBtn}
            hitSlop={10}
          >
            <AppIcon ios="chevron.left" android="chevron-back" size={20} color={color.text} />
            <Text style={styles.backText}>{t("btn_back")}</Text>
          </Pressable>
        ) : (
          <Text style={styles.kicker}>{t("create_kicker")}</Text>
        )}
      </View>

      <Text style={styles.title}>
        {step === "pick" && t("create_step_pick_title")}
        {step === "caption" && t("create_step_caption_title")}
        {step === "vault" && t("create_step_vault_title")}
        {step === "uploading" && status}
      </Text>

      {step === "pick" ? (
        <View style={styles.col}>
          <Text style={styles.body}>{t("create_step_pick_desc")}</Text>
          <Button label={t("create_btn_record")} onPress={() => void pick(true)} />
          <Button label={t("create_btn_library")} variant="surface" onPress={() => void pick(false)} />
        </View>
      ) : null}

      {step === "caption" ? (
        <View style={styles.col}>
          <TextField
            value={caption}
            onChangeText={setCaption}
            placeholder={t("create_caption_placeholder")}
            multiline
            style={{ minHeight: 110, textAlignVertical: "top" }}
          />
          <Button
            label={t("btn_continue")}
            onPress={() => setStep("vault")}
            disabled={!caption.trim()}
          />
        </View>
      ) : null}

      {step === "vault" ? (
        <View style={styles.col}>
          <Text style={styles.body}>{t("create_step_vault_desc")}</Text>
          <Button label={t("create_btn_attach_vault")} onPress={() => void attachVault()} />
          <Button
            label={t("create_btn_publish_direct")}
            variant="ghost"
            onPress={() => void publish()}
          />
        </View>
      ) : null}

      {step === "uploading" ? (
        <View style={styles.col}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

async function waitForReady(id: string, transcodeErrorMsg: string): Promise<void> {
  for (let i = 0; i < 20; i++) {
    const video = await get<FeedItem>(`/v1/videos/${id}`);
    if (video.status === "READY") return;
    if (video.status === "FAILED") throw new Error(transcodeErrorMsg);
    await new Promise((r) => setTimeout(r, 1500));
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg, padding: space[5], gap: space[4] },
  topBar: { minHeight: 32, justifyContent: "center" },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  backText: { color: color.text, fontSize: 16, fontFamily: font.medium },
  kicker: { color: color.accent, letterSpacing: 3, fontWeight: "700", fontSize: 12 },
  title: { color: color.text, fontSize: 28, fontFamily: font.semibold, fontWeight: "700", lineHeight: 36 },
  body: { color: color.textMuted, fontSize: 16, lineHeight: 24 },
  col: { gap: space[3], marginTop: space[3] },
  track: { height: 8, borderRadius: 999, backgroundColor: color.surface, overflow: "hidden" },
  fill: { height: 8, backgroundColor: color.accent },
  progressText: { color: color.accent, fontSize: 18, fontWeight: "700", textAlign: "center", marginTop: space[2] },
});
