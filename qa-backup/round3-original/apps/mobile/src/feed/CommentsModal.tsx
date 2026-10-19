import { memo, useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { get, post } from "../api/client";
import { keys } from "../api/query";
import type { CommentItem, CommentsPage, FeedItem } from "../api/types";
import { useMe } from "../auth/use-me";
import { color, font, radius, space } from "../theme";
import { AppIcon } from "../ui/AppIcon";
import { Avatar } from "../ui/Avatar";

type Props = {
  visible: boolean;
  item: FeedItem | null;
  onClose: () => void;
  onCommentAdded: (videoId: string) => void;
};

export const CommentsModal = memo(function CommentsModal({
  visible,
  item,
  onClose,
  onCommentAdded,
}: Props) {
  const me = useMe();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList<CommentItem>>(null);

  const videoId = item?.id ?? "";

  const query = useQuery({
    queryKey: keys.comments(videoId),
    queryFn: () => get<CommentsPage>(`/v1/videos/${videoId}/comments`),
    enabled: visible && !!videoId,
  });

  const comments = query.data?.items ?? [];

  const addComment = useMutation({
    mutationFn: (body: string) =>
      post<CommentItem>(`/v1/videos/${videoId}/comments`, { body }),
    onSuccess: (newComment) => {
      setText("");
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      qc.setQueryData<CommentsPage>(keys.comments(videoId), (curr) => ({
        items: [newComment, ...(curr?.items ?? [])],
        nextCursor: curr?.nextCursor ?? null,
      }));
      onCommentAdded(videoId);
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    },
  });

  const onSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || addComment.isPending) return;
    addComment.mutate(trimmed);
  };

  const renderComment = useCallback(({ item: c }: { item: CommentItem }) => {
    return (
      <View style={styles.commentRow}>
        <Avatar
          uri={c.user.avatarUrl}
          name={c.user.displayName ?? c.user.handle}
          size={36}
        />
        <View style={styles.commentContent}>
          <View style={styles.commentHeader}>
            <Text style={styles.commentHandle}>@{c.user.handle}</Text>
            {c.user.displayName ? (
              <Text style={styles.commentName} numberOfLines={1}>
                {c.user.displayName}
              </Text>
            ) : null}
            <Text style={styles.commentDot}>·</Text>
            <Text style={styles.commentTime}>{formatTime(c.createdAt)}</Text>
          </View>
          <Text style={styles.commentBody}>{c.body}</Text>
        </View>
      </View>
    );
  }, []);

  if (!item) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.dismissOverlay} onPress={onClose} />
        <View style={styles.sheet}>
          {/* Grab handle indicator */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.title}>Comments</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{comments.length}</Text>
              </View>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={styles.closeBtn}
              accessibilityLabel="Close comments"
            >
              <AppIcon ios="xmark" android="close" size={20} color="#fff" />
            </Pressable>
          </View>

          {/* Comments List */}
          {query.isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={color.accent} size="small" />
            </View>
          ) : query.isError ? (
            <View style={styles.center}>
              <Text style={styles.errorText}>Could not load comments</Text>
              <Pressable
                onPress={() => void query.refetch()}
                style={styles.retryBtn}
              >
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          ) : comments.length === 0 ? (
            <View style={styles.empty}>
              <AppIcon
                ios="bubble.left.and.bubble.right"
                android="chatbubbles-outline"
                size={38}
                color={color.textMuted}
              />
              <Text style={styles.emptyTitle}>No comments yet</Text>
              <Text style={styles.emptySubtitle}>
                Be the first to share constructive feedback or ask a technical question!
              </Text>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={comments}
              keyExtractor={(c) => c.id}
              renderItem={renderComment}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          )}

          {/* Comment Input Bar */}
          <View style={styles.inputBar}>
            <Avatar
              uri={null}
              name={me.data?.displayName ?? me.data?.handle ?? "Me"}
              size={32}
            />
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Add a constructive comment..."
              placeholderTextColor={color.textMuted}
              value={text}
              onChangeText={setText}
              maxLength={500}
              multiline
              returnKeyType="send"
              onSubmitEditing={onSubmit}
            />
            <Pressable
              onPress={onSubmit}
              disabled={!text.trim() || addComment.isPending}
              style={[
                styles.sendBtn,
                !text.trim() && styles.sendBtnDisabled,
              ]}
              hitSlop={8}
            >
              {addComment.isPending ? (
                <ActivityIndicator size="small" color={color.accent} />
              ) : (
                <AppIcon
                  ios="arrow.up.circle.fill"
                  android="arrow-up-circle"
                  size={30}
                  color={text.trim() ? color.accent : color.textMuted}
                />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
});

function formatTime(iso: string): string {
  try {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return "";
  }
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  dismissOverlay: {
    flex: 1,
  },
  sheet: {
    height: "65%",
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingBottom: Platform.OS === "ios" ? 24 : 12,
  },
  handleBar: {
    width: 36,
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 8,
    marginBottom: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
  },
  title: {
    color: "#fff",
    fontSize: 17,
    fontFamily: font.semibold,
    fontWeight: "700",
  },
  countBadge: {
    backgroundColor: color.surfaceRaised,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    color: color.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  closeBtn: {
    padding: 4,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space[3],
  },
  errorText: {
    color: color.danger,
    fontSize: 14,
  },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: color.surfaceRaised,
    borderRadius: radius.md,
  },
  retryText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space[6],
    gap: space[2],
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 16,
    fontFamily: font.semibold,
    fontWeight: "600",
    marginTop: space[2],
  },
  emptySubtitle: {
    color: color.textMuted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  listContent: {
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    gap: space[4],
  },
  commentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space[3],
  },
  commentContent: {
    flex: 1,
    gap: 3,
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  commentHandle: {
    color: "#fff",
    fontSize: 14,
    fontFamily: font.semibold,
    fontWeight: "700",
  },
  commentName: {
    color: color.textMuted,
    fontSize: 13,
    maxWidth: 110,
  },
  commentDot: {
    color: color.textMuted,
    fontSize: 12,
  },
  commentTime: {
    color: color.textMuted,
    fontSize: 12,
  },
  commentBody: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 14,
    lineHeight: 20,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space[4],
    paddingTop: space[3],
    gap: space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
    backgroundColor: color.surface,
  },
  input: {
    flex: 1,
    minHeight: 38,
    maxHeight: 90,
    backgroundColor: color.surfaceRaised,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    paddingVertical: 8,
    color: "#fff",
    fontSize: 14,
  },
  sendBtn: {
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
});
