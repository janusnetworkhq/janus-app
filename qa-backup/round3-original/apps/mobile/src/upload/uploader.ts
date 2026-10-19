import { File } from "expo-file-system";
import { post } from "../api/client";
import type { UploadTicket } from "../api/types";

export async function uploadFile(opts: {
  uri: string;
  kind: "FEED_VIDEO" | "VAULT_FILE" | "VAULT_VIDEO" | "AVATAR" | "BANNER";
  contentType: string;
  byteSize: number;
  durationMs?: number;
  caption?: string;
  vaultKind?: "CODE" | "SCHEMATIC" | "CAD" | "OTHER";
  originalName?: string;
  videoId?: string;
  onProgress?: (ratio: number) => void;
}): Promise<{ uploadId: string; videoId?: string }> {
  const ticket = await post<UploadTicket>("/v1/uploads", {
    kind: opts.kind,
    contentType: opts.contentType,
    byteSize: opts.byteSize,
    durationMs: opts.durationMs,
    caption: opts.caption,
    vaultKind: opts.vaultKind,
    originalName: opts.originalName,
  });

  const file = new File(opts.uri);
  const task = file.createUploadTask(ticket.uploadUrl, {
    httpMethod: "PUT",
    headers: ticket.headers,
    onProgress: ({ bytesSent, totalBytes }) => {
      if (totalBytes > 0) opts.onProgress?.(bytesSent / totalBytes);
    },
  });
  const result = await task.uploadAsync();
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Upload failed (${result.status})`);
  }
  opts.onProgress?.(1);

  const done = await post<{ videoId?: string; video?: { id: string } }>(`/v1/uploads/${ticket.uploadId}/complete`, {
    vaultKind: opts.vaultKind,
    originalName: opts.originalName,
    videoId: opts.videoId,
  });
  return { uploadId: ticket.uploadId, videoId: done.videoId ?? done.video?.id };
}
