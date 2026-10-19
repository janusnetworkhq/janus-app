"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Heart, Lock } from "lucide-react";
import { loadFeedPage, recordImpressions, requestNdaAndGo, toggleLike } from "@/lib/actions";
import type { FeedItem, FeedPage } from "@/lib/types";
import { formatCount } from "@/lib/utils";
import { HlsPlayer } from "@/components/hls-player";
import { Badge } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";

export function FeedTimeline({ initial, university }: { initial: FeedPage; university?: string }) {
  const [items, setItems] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [activeId, setActiveId] = useState(initial.items[0]?.id ?? null);
  const [muted, setMuted] = useState(true);
  const [pending, startTransition] = useTransition();
  const seen = useRef(new Set<string>());
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting && e.intersectionRatio >= 0.6)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const id = (visible.target as HTMLElement).dataset.videoId;
        if (id) setActiveId(id);
      },
      { root, threshold: [0.6, 0.85] },
    );
    root.querySelectorAll<HTMLElement>("[data-video-id]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);

  useEffect(() => {
    if (!activeId || seen.current.has(activeId)) return;
    seen.current.add(activeId);
    void recordImpressions([activeId]);
  }, [activeId]);

  const loadMore = useCallback(() => {
    if (!cursor || pending) return;
    startTransition(async () => {
      const page = await loadFeedPage(cursor, university);
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    });
  }, [cursor, pending, university]);

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-dashed border-border bg-card/40 px-6 py-16 text-center">
        <h2 className="text-lg font-semibold">Feed is empty</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Ready student videos appear here. Upload from the mobile app, then refresh.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-col gap-4">
      <div
        ref={rootRef}
        className="h-[min(82dvh,760px)] snap-y snap-mandatory overflow-y-auto rounded-xl border border-border bg-black"
      >
        {items.map((item) => (
          <FeedCard
            key={item.id}
            item={item}
            active={item.id === activeId}
            muted={muted}
            onToggleMute={() => setMuted((m) => !m)}
          />
        ))}
      </div>
      {cursor ? (
        <Button variant="secondary" disabled={pending} onClick={loadMore}>
          {pending ? "Loading…" : "Load more"}
        </Button>
      ) : (
        <p className="text-center text-xs text-muted-foreground">End of feed</p>
      )}
    </div>
  );
}

function FeedCard({
  item,
  active,
  muted,
  onToggleMute,
}: {
  item: FeedItem;
  active: boolean;
  muted: boolean;
  onToggleMute: () => void;
}) {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(item.likeCount);
  const [ndaError, setNdaError] = useState<string | null>(null);
  const [ndaPending, startNda] = useTransition();

  return (
    <article
      data-video-id={item.id}
      className="relative flex h-full min-h-[min(82dvh,760px)] w-full snap-start snap-always flex-col bg-black"
    >
      <div className="relative min-h-0 flex-1">
        {item.hlsUrl ? (
          <HlsPlayer src={item.hlsUrl} poster={item.posterUrl} active={active} muted={muted} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Video is still processing
          </div>
        )}
        <button
          type="button"
          onClick={onToggleMute}
          className="absolute right-3 top-3 rounded-full bg-black/50 px-3 py-1 text-xs font-semibold text-white"
        >
          {muted ? "Muted" : "Sound"}
        </button>
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent p-4 pt-16">
        <Link href={`/talent/${item.author.id}`} className="text-sm font-semibold text-white hover:underline">
          @{item.author.handle}
        </Link>
        {item.author.university ? (
          <p className="text-xs text-white/70">{item.author.university}</p>
        ) : null}
        {item.caption ? <p className="mt-2 line-clamp-3 text-sm text-white/90">{item.caption}</p> : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {item.hasVault ? (
            <Badge tone="warning">
              <Lock className="mr-1 inline size-3" aria-hidden />
              IP locked
            </Badge>
          ) : null}
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white"
            onClick={() => {
              const next = !liked;
              setLiked(next);
              setLikes((n) => n + (next ? 1 : -1));
              void toggleLike(item.id, liked);
            }}
          >
            <Heart className={`size-3.5 ${liked ? "fill-destructive text-destructive" : ""}`} />
            {formatCount(likes)}
          </button>
          <Link
            href={`/talent/${item.author.id}`}
            className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white"
          >
            Profile
          </Link>
          {item.hasVault ? (
            <Button
              size="sm"
              disabled={ndaPending}
              onClick={() => {
                setNdaError(null);
                startNda(async () => {
                  const result = await requestNdaAndGo(item.author.id, item.id);
                  if (result?.error) setNdaError(result.error);
                });
              }}
            >
              Request NDA
            </Button>
          ) : null}
        </div>
        {ndaError ? <p className="mt-2 text-xs text-destructive">{ndaError}</p> : null}
      </div>
    </article>
  );
}
