import { memo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { post } from "../api/client";
import { keys } from "../api/query";
import type { FeedItem } from "../api/types";
import { newIdempotencyKey } from "../auth/actions";
import { color, font, radius, space } from "../theme";
import { AppIcon } from "../ui/AppIcon";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";

type Props = {
  visible: boolean;
  item: FeedItem | null;
  onClose: () => void;
};

export const RequestFilesModal = memo(function RequestFilesModal({
  visible,
  item,
  onClose,
}: Props) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");

  const requestMut = useMutation({
    mutationFn: async () => {
      if (!item) return;
      return post(
        "/v1/nda/requests",
        {
          studentId: item.author.id,
          videoId: item.id,
          reason: reason.trim() || undefined,
        },
        { idempotencyKey: newIdempotencyKey() }
      );
    },
    onSuccess: () => {
      setReason("");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: keys.ndaOutbound });
      onClose();
      Alert.alert(
        "Request Sent",
        `Your request to access confidential project files has been sent to @${item?.author.handle}. You'll be notified when they approve!`
      );
    },
    onError: (err: Error) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Request Failed", err.message);
    },
  });

  if (!item) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <AppIcon ios="lock.shield.fill" android="shield-checkmark" size={32} color={color.accent} />
          </View>

          <Text style={styles.title}>Confidential Project Files</Text>
          <Text style={styles.subtitle}>
            Proprietary CAD files, schematics, and source code are protected under a mutual Non-Disclosure Agreement.
          </Text>

          <View style={styles.authorBadge}>
            <Avatar
              uri={item.author.avatarUrl}
              name={item.author.displayName ?? item.author.handle}
              size={36}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.authorName}>
                {item.author.displayName ?? `@${item.author.handle}`}
              </Text>
              {item.author.university ? (
                <Text style={styles.authorMeta} numberOfLines={1}>
                  {item.author.university}
                </Text>
              ) : null}
            </View>
          </View>

          <Text style={styles.inputLabel}>Reason for access (optional):</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Technical evaluation, recruitment, collaboration..."
            placeholderTextColor={color.textMuted}
            value={reason}
            onChangeText={setReason}
            maxLength={300}
            multiline
          />

          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              disabled={requestMut.isPending}
              style={styles.cancelBtn}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>

            <View style={{ flex: 1 }}>
              <Button
                label={requestMut.isPending ? "Sending..." : "Request Access"}
                onPress={() => requestMut.mutate()}
                disabled={requestMut.isPending}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: space[4],
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    padding: space[5],
    alignItems: "center",
    gap: space[3],
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: color.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space[1],
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontFamily: font.semibold,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    color: color.textMuted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  authorBadge: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    backgroundColor: color.surfaceRaised,
    padding: space[3],
    borderRadius: radius.md,
    marginTop: space[1],
  },
  authorName: {
    color: "#fff",
    fontSize: 14,
    fontFamily: font.semibold,
    fontWeight: "600",
  },
  authorMeta: {
    color: color.textMuted,
    fontSize: 12,
  },
  inputLabel: {
    alignSelf: "flex-start",
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    marginTop: space[1],
  },
  input: {
    width: "100%",
    minHeight: 64,
    maxHeight: 100,
    backgroundColor: color.surfaceRaised,
    borderRadius: radius.md,
    padding: space[3],
    color: "#fff",
    fontSize: 13,
    textAlignVertical: "top",
  },
  actions: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    marginTop: space[2],
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: space[3],
  },
  cancelText: {
    color: color.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
});
