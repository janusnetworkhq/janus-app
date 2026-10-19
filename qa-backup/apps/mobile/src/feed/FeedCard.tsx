import { memo, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions, type GestureResponderEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import type { FeedItem } from "../api/types";
import { useTranslation } from "../i18n";
import { usePlayerStore } from "../player/player-store";
import { color, font, space } from "../theme";
import { AppIcon } from "../ui/AppIcon";
import { Avatar } from "../ui/Avatar";

type Props = {
  item: FeedItem;
  height: number;
  active: boolean;
  liked: boolean;
  onLike: () => void;
  onComment?: () => void;
  onNda?: () => void;
  isRecruiter: boolean;
};

export const FeedCard = memo(function FeedCard({
  item,
  height,
  active,
  liked,
  onLike,
  onComment,
  onNda,
  isRecruiter: _isRecruiter,
}: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isLandscape = width > height;
  const lastTap = useRef(0);
  const [fitMode, setFitMode] = useState<"cover" | "contain">("cover");

  const onTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      lastTap.current = 0;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onLike();
      return;
    }
    lastTap.current = now;
    setTimeout(() => {
      if (Date.now() - lastTap.current >= 260) usePlayerStore.getState().toggleMute();
    }, 280);
  };

  const railStyle = [
    styles.rail,
    isLandscape
      ? { right: Math.max(insets.right + 12, 16), bottom: Math.max(insets.bottom + 8, 16) }
      : { right: 12, bottom: Math.max(insets.bottom + 62, 86) },
  ];

  const metaStyle = [
    styles.meta,
    isLandscape
      ? {
          left: Math.max(insets.left + 16, 24),
          right: Math.max(insets.right + 76, 90),
          bottom: Math.max(insets.bottom + 8, 16),
        }
      : {
          left: 16,
          right: 72,
          bottom: Math.max(insets.bottom + 52, 76),
        },
  ];

  return (
    <View style={{ height, backgroundColor: "#000" }}>
      {item.posterUrl ? (
        <Image
          source={{ uri: item.posterUrl }}
          style={StyleSheet.absoluteFill}
          contentFit={fitMode}
          recyclingKey={item.id}
        />
      ) : null}
      {item.hlsUrl && active ? <ActivePlayer uri={item.hlsUrl} fitMode={fitMode} /> : null}
      <Pressable style={StyleSheet.absoluteFill} onPress={onTap} accessibilityLabel={t("feed_sound_tap")} />
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.85)"]}
        style={[styles.bottomFade, { height: isLandscape ? 170 : 280 }]}
      />
      <View style={railStyle} pointerEvents="box-none">
        <RailButton
          ios={liked ? "heart.fill" : "heart"}
          android={liked ? "heart" : "heart-outline"}
          label={formatCount(item.likeCount)}
          active={liked}
          onPress={onLike}
        />
        <RailButton
          ios="bubble.right"
          android="chatbubble-outline"
          label={formatCount(item.commentCount)}
          onPress={onComment ?? (() => undefined)}
        />
        <RailButton
          ios={fitMode === "cover" ? "arrow.down.right.and.arrow.up.left" : "arrow.up.left.and.arrow.down.right"}
          android={fitMode === "cover" ? "contract" : "expand"}
          label={fitMode === "cover" ? "Full" : "Fit"}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setFitMode((m: "cover" | "contain") => (m === "cover" ? "contain" : "cover"));
          }}
        />
        {item.hasVault ? (
          <RailButton
            ios="lock.fill"
            android="lock-closed"
            label="Files"
            onPress={() => onNda?.()}
          />
        ) : null}
      </View>
      <View style={metaStyle} pointerEvents="box-none">
        <Pressable style={styles.author} onPress={() => router.push(`/user/${item.author.id}`)}>
          <Avatar uri={item.author.avatarUrl} name={item.author.displayName ?? item.author.handle} size={36} />
          <View style={{ flex: 1 }}>
            <Text style={styles.handle}>@{item.author.handle}</Text>
            {item.author.headline ? <Text style={styles.headline} numberOfLines={1}>{item.author.headline}</Text> : null}
          </View>
        </Pressable>
        {item.caption ? (
          <Text style={styles.caption} numberOfLines={isLandscape ? 2 : 3}>
            {item.caption}
          </Text>
        ) : null}
        <MuteHint />
      </View>
    </View>
  );
});

const ActivePlayer = memo(function ActivePlayer({
  uri,
  fitMode,
}: {
  uri: string;
  fitMode: "cover" | "contain";
}) {
  const muted = usePlayerStore((s) => s.muted);
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit={fitMode}
      nativeControls={false}
      allowsPictureInPicture={false}
      fullscreenOptions={{ enable: false }}
    />
  );
});

function MuteHint() {
  const muted = usePlayerStore((s) => s.muted);
  const { t } = useTranslation();
  return (
    <Text style={styles.mute}>{muted ? t("feed_sound_tap") : t("feed_sound_active")}</Text>
  );
}

function RailButton({
  ios,
  android,
  label,
  onPress,
  active,
}: {
  ios: Parameters<typeof AppIcon>[0]["ios"];
  android: Parameters<typeof AppIcon>[0]["android"];
  label: string;
  onPress: (e: GestureResponderEvent) => void;
  active?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={styles.railBtn} hitSlop={8}>
      <AppIcon ios={ios} android={android} size={26} color={active ? color.danger : "#fff"} />
      <Text style={styles.railLabel}>{label}</Text>
    </Pressable>
  );
}

function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n / 1000)}k`;
}

const styles = StyleSheet.create({
  bottomFade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 280 },
  rail: { position: "absolute", right: 12, bottom: 94, gap: space[4], alignItems: "center" },
  railBtn: { alignItems: "center", gap: 3 },
  railLabel: { color: "#fff", fontSize: 11, fontWeight: "600" },
  meta: { position: "absolute", left: 16, right: 72, bottom: 82, gap: 8 },
  author: { flexDirection: "row", alignItems: "center", gap: 10 },
  handle: { color: "#fff", fontSize: 16, fontFamily: font.semibold, fontWeight: "700" },
  headline: { color: "rgba(255,255,255,0.78)", fontSize: 13 },
  caption: { color: "#fff", fontSize: 15, lineHeight: 20 },
  mute: { color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 4 },
});
