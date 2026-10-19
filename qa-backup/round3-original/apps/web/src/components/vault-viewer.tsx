"use client";

import { HlsPlayer } from "@/components/hls-player";

export function VaultViewer({
  url,
  contentType,
  watermark,
  originalName,
}: {
  url: string;
  contentType: string;
  watermark: string;
  originalName?: string | null;
}) {
  const isVideo = contentType.startsWith("video/") || url.includes(".m3u8");
  const isPdf = contentType.includes("pdf") || url.toLowerCase().includes(".pdf");

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-black">
      {isVideo ? (
        <div className="aspect-[9/16] max-h-[80dvh] w-full">
          <HlsPlayer src={url} active muted={false} className="h-full w-full bg-black object-contain" />
        </div>
      ) : isPdf ? (
        <iframe title={originalName ?? "Vault document"} src={url} className="h-[80dvh] w-full bg-white" />
      ) : (
        <div className="flex h-64 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm text-muted-foreground">This file type opens in a new tab with a short-lived URL.</p>
          <a href={url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-primary underline">
            Open {originalName ?? "file"}
          </a>
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-6 text-center text-sm font-semibold tracking-wide text-white/50">
        JANUS · {watermark}
      </div>
    </div>
  );
}
