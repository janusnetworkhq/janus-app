import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewToken,
} from "react-native";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { del, post } from "../api/client";
import { keys } from "../api/query";
import type { FeedItem, FeedPage } from "../api/types";
import { useMe } from "../auth/use-me";
import { color } from "../theme";
import { EmptyState } from "../ui/EmptyState";
import { ErrorView } from "../ui/ErrorView";
import { usePlayerStore } from "../player/player-store";
import { CommentsModal } from "./CommentsModal";
import { FeedCard } from "./FeedCard";
import { fetchFeedPage, recordImpression } from "./impressions";
import { RequestFilesModal } from "../nda/RequestFilesModal";
import { useTranslation } from "../i18n";
import { useTabBarStore } from "../ui/tab-bar-store";

type Props = {
  university?: string;
  isRecruiter: boolean;
  onNda?: (item: FeedItem) => void;
};

export function FeedList({ university, isRecruiter, onNda }: Props) {
  const { height: windowHeight } = useWindowDimensions();
  // Size pages to the list's own container (Discover has a search header above it),
  // otherwise each card is taller than the viewport and its caption/actions are cut off.
  const [layoutHeight, setLayoutHeight] = useState(0);
  const height = layoutHeight || windowHeight;
  const listRef = useRef<FlashListRef<FeedItem>>(null);
  const [likedOverrides, setLikedOverrides] = useState<Record<string, boolean>>({});
  const [commentItem, setCommentItem] = useState<FeedItem | null>(null);
  const [requestItem, setRequestItem] = useState<FeedItem | null>(null);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const me = useMe();
  const queryClient = useQueryClient();
  const setActiveId = usePlayerStore((s) => s.setActiveId);
  const activeId = usePlayerStore((s) => s.activeId);
  const setMinimized = useTabBarStore((s) => s.setMinimized);
  const { t } = useTranslation();

  const onScrollStart = useCallback(() => {
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    setMinimized(true);
  }, [setMinimized]);

  const onScrollFinish = useCallback(() => {
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      setMinimized(false);
    }, 1600);
  }, [setMinimized]);

  const feed = useInfiniteQuery({
    queryKey: keys.feed(university),
    queryFn: ({ pageParam }) => fetchFeedPage({ pageParam, university }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });

  const items = useMemo(() => feed.data?.pages.flatMap((p) => p.items) ?? [], [feed.data]);

  const isItemLiked = useCallback(
    (item: FeedItem) => {
      if (item.id in likedOverrides) return likedOverrides[item.id];
      return Boolean(item.liked);
    },
    [likedOverrides]
  );

  const likeMut = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: boolean }) => {
      if (next) await post(`/v1/videos/${id}/like`);
      else await del(`/v1/videos/${id}/like`);
    },
    onMutate: async ({ id, next }) => {
      setLikedOverrides((prev) => ({ ...prev, [id]: next }));
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      queryClient.setQueryData<{ pages: FeedPage[]; pageParams: unknown[] }>(
        keys.feed(university),
        (curr) => {
          if (!curr) return curr;
          return {
            ...curr,
            pages: curr.pages.map((page) => ({
              ...page,
              items: page.items.map((item) =>
                item.id === id
                  ? {
                      ...item,
                      liked: next,
                      likeCount: Math.max(0, item.likeCount + (next ? 1 : -1)),
                    }
                  : item
              ),
            })),
          };
        }
      );
    },
    onError: (_err, { id, next }) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setLikedOverrides((prev) => ({ ...prev, [id]: !next }));
      void queryClient.invalidateQueries({ queryKey: keys.feed(university) });
    },
  });

  const handleCommentPress = useCallback((item: FeedItem) => {
    setCommentItem(item);
  }, []);

  const handleCommentAdded = useCallback(
    (videoId: string) => {
      queryClient.setQueryData<{ pages: FeedPage[]; pageParams: unknown[] }>(
        keys.feed(university),
        (curr) => {
          if (!curr) return curr;
          return {
            ...curr,
            pages: curr.pages.map((page) => ({
              ...page,
              items: page.items.map((it) =>
                it.id === videoId ? { ...it, commentCount: it.commentCount + 1 } : it
              ),
            })),
          };
        }
      );
    },
    [queryClient, university]
  );

  const myId = me.data?.id;
  const handleFilesPress = useCallback(
    (item: FeedItem) => {
      if (onNda) {
        onNda(item);
        return;
      }
      if (myId && item.author.id === myId) {
        Alert.alert(
          "Your Project Vault",
          "You are the creator of this innovation. These are your confidential project files."
        );
        return;
      }
      setRequestItem(item);
    },
    [onNda, myId]
  );

  const onViewable = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems.find((v) => v.isViewable && v.item);
      const id = (first?.item as FeedItem | undefined)?.id;
      if (id) {
        setActiveId(id);
        recordImpression(id);
      }
    },
    [setActiveId]
  );

  const renderItem = useCallback(
    ({ item }: { item: FeedItem }) => (
      <FeedCard
        item={item}
        height={height}
        active={item.id === activeId}
        liked={isItemLiked(item)}
        isRecruiter={isRecruiter}
        onLike={() => likeMut.mutate({ id: item.id, next: !isItemLiked(item) })}
        onComment={() => handleCommentPress(item)}
        onNda={() => handleFilesPress(item)}
      />
    ),
    [height, activeId, isRecruiter, isItemLiked, likeMut, handleCommentPress, handleFilesPress]
  );

  if (feed.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={color.accent} />
      </View>
    );
  }
  if (feed.isError) return <ErrorView error={feed.error} onRetry={() => void feed.refetch()} />;
  if (items.length === 0) {
    return (
      <EmptyState
        title={t("feed_empty_title")}
        body={t("feed_empty_body")}
        action={{
          label: t("btn_retry"),
          onPress: () => void feed.refetch(),
        }}
      />
    );
  }

  return (
    <View
      style={styles.root}
      onLayout={(e) => {
        const h = Math.round(e.nativeEvent.layout.height);
        if (h > 0 && h !== layoutHeight) setLayoutHeight(h);
      }}
    >
      <FlashList
        ref={listRef}
        data={items}
        extraData={`${activeId}:${Object.keys(likedOverrides).length}`}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        pagingEnabled
        disableIntervalMomentum
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={viewConfig}
        onScrollBeginDrag={onScrollStart}
        onMomentumScrollBegin={onScrollStart}
        onMomentumScrollEnd={onScrollFinish}
        refreshing={feed.isRefetching}
        onRefresh={() => void feed.refetch()}
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
        }}
        onEndReachedThreshold={0.6}
        drawDistance={height}
      />

      <CommentsModal
        visible={!!commentItem}
        item={commentItem}
        onClose={() => setCommentItem(null)}
        onCommentAdded={handleCommentAdded}
      />

      <RequestFilesModal
        visible={!!requestItem}
        item={requestItem}
        onClose={() => setRequestItem(null)}
      />
    </View>
  );
}

const viewConfig = { itemVisiblePercentThreshold: 80 };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000" },
});
