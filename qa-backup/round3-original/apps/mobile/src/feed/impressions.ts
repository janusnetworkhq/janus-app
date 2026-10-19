import { get, post } from "../api/client";
import type { FeedPage } from "../api/types";

const FLUSH_MS = 1500;
const MAX_BATCH = 8;

const pending = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

function flush(): void {
  timer = null;
  if (pending.size === 0) return;
  const videoIds = [...pending];
  pending.clear();
  void post("/v1/impressions", { videoIds }).catch(() => undefined);
}

export function recordImpression(videoId: string): void {
  pending.add(videoId);
  if (pending.size >= MAX_BATCH) {
    if (timer) clearTimeout(timer);
    flush();
    return;
  }
  timer ??= setTimeout(flush, FLUSH_MS);
}

export async function fetchFeedPage({
  pageParam,
  university,
}: {
  pageParam: string | null;
  university?: string;
}): Promise<FeedPage> {
  const params = new URLSearchParams({ limit: "8" });
  if (pageParam) params.set("cursor", pageParam);
  if (university) params.set("university", university);
  return get<FeedPage>(`/v1/feed?${params.toString()}`);
}
