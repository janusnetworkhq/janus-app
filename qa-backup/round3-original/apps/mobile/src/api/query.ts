import { QueryClient } from "@tanstack/react-query";
import { ApiClientError } from "./errors";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 45_000,
      gcTime: 10 * 60_000,
      retry: (count, error) => {
        if (error instanceof ApiClientError && (error.status === 401 || error.status === 403)) {
          return false;
        }
        return count < 1;
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: { retry: 0 },
  },
});

export const keys = {
  me: ["me"] as const,
  feed: (university?: string) => ["feed", university ?? ""] as const,
  video: (id: string) => ["video", id] as const,
  comments: (videoId: string) => ["comments", videoId] as const,
  user: (id: string) => ["user", id] as const,
  userVideos: (id: string) => ["user-videos", id] as const,
  ndaInbox: ["nda-inbox"] as const,
  ndaOutbound: ["nda-outbound"] as const,
  ndaTemplate: ["nda-template"] as const,
  vault: (studentId: string) => ["vault", studentId] as const,
  bookmarks: ["bookmarks"] as const,
};
