"use client";

import { useEffect, useRef } from "react";
import Hls from "hls.js";

function isHlsUrl(src: string, contentType?: string): boolean {
  if (contentType?.includes("mpegurl")) return true;
  return src.includes(".m3u8");
}

export function HlsPlayer({
  src,
  poster,
  active,
  muted = true,
  className,
}: {
  src: string;
  poster?: string | null;
  active: boolean;
  muted?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video || !active || !src) return;

    const useNative = video.canPlayType("application/vnd.apple.mpegurl") && isHlsUrl(src);
    if (isHlsUrl(src) && Hls.isSupported() && !useNative) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: false, maxBufferLength: 12 });
      hls.loadSource(src);
      hls.attachMedia(video);
      const play = () => {
        void video.play().catch(() => undefined);
      };
      hls.on(Hls.Events.MANIFEST_PARSED, play);
      return () => {
        hls.destroy();
      };
    }

    video.src = src;
    void video.play().catch(() => undefined);
    return () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [src, active]);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.muted = muted;
    if (active) void video.play().catch(() => undefined);
    else video.pause();
  }, [active, muted]);

  return (
    <video
      ref={ref}
      poster={poster ?? undefined}
      muted={muted}
      playsInline
      loop
      controls={false}
      className={className ?? "h-full w-full bg-black object-contain"}
    />
  );
}
