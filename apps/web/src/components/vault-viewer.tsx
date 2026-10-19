"use client";

import { HlsPlayer } from "@/components/hls-player";

/**
 * Protected vault viewer: tiled watermark naming the viewer, no download links, no
 * selection or context menu. Browser screenshots cannot be blocked on the web; the
 * watermark makes any capture traceable to the recruiter and grant.
 */
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
  const isPdf = contentType.includes("pdf");
  const isImage = contentType.startsWith("image/");

  return (
    <div
      className="relative select-none overflow-hidden rounded-xl border border-border bg-black"
      onContextMenu={(e) => e.preventDefault()}
      data-testid="vault-viewer"
    >
      {isVideo ? (
        <div className="aspect-[9/16] max-h-[80dvh] w-full">
          <HlsPlayer src={url} active muted={false} className="h-full w-full bg-black object-contain" />
        </div>
      ) : isPdf ? (
        <iframe
          title={originalName ?? "Vault document"}
          // Hide the built-in PDF toolbar (download/print) where the browser supports it.
          src={`${url}#toolbar=0&navpanes=0`}
          className="h-[80dvh] w-full bg-white"
          referrerPolicy="no-referrer"
        />
      ) : isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={originalName ?? "Vault image"} draggable={false} className="max-h-[80dvh] w-full object-contain" />
      ) : (
        <div className="flex h-64 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {originalName ?? "This file"} can&rsquo;t be previewed in the protected viewer, and downloads are disabled.
          </p>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 grid grid-cols-2 place-items-center gap-y-16 overflow-hidden" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className="-rotate-[28deg] whitespace-nowrap text-sm font-bold text-primary/25">
            {watermark}
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/70 py-1.5 text-center text-xs text-muted-foreground">
        Viewing is logged and watermarked · Downloading and sharing are disabled
      </div>
    </div>
  );
}
