import { spawn } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appConfig } from "../common/config";

export type Probe = { width: number; height: number; durationMs: number; hasAudio: boolean };
export type Rendition = { name: "540" | "720"; width: number; height: number; bitrate: number };
export type TranscodeResult = {
  probe: Probe;
  renditions: Rendition[];
  /** Every output file, relative name -> bytes + content type. */
  files: { name: string; bytes: Buffer; contentType: string }[];
};

function run(bin: string, args: string[], timeoutMs = 10 * 60_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr.on("data", (d: Buffer) => (err = (err + d.toString()).slice(-4000)));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(`${bin} exited ${code}: ${err.trim().split("\n").slice(-3).join(" | ")}`));
    });
  });
}

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

export async function probe(file: string): Promise<Probe> {
  const out = await run(appConfig.ffprobePath, [
    "-v", "error", "-print_format", "json", "-show_streams", "-show_format", file,
  ]);
  const json = JSON.parse(out) as {
    streams?: { codec_type?: string; width?: number; height?: number; tags?: { rotate?: string }; side_data_list?: { rotation?: number }[] }[];
    format?: { duration?: string };
  };
  const video = json.streams?.find((s) => s.codec_type === "video");
  if (!video?.width || !video.height) throw new Error("No video stream");
  const rotation = Math.abs(Number(video.tags?.rotate ?? video.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? 0));
  const swap = rotation === 90 || rotation === 270;
  return {
    width: swap ? video.height : video.width,
    height: swap ? video.width : video.height,
    durationMs: Math.round(Number(json.format?.duration ?? 0) * 1000),
    hasAudio: Boolean(json.streams?.some((s) => s.codec_type === "audio")),
  };
}

/** Plan renditions by the short side (540p / 720p), never upscaling. */
export function planRenditions(p: Probe): Rendition[] {
  const short = Math.min(p.width, p.height);
  const portrait = p.height >= p.width;
  const plan: Rendition[] = [];
  for (const [name, target, bitrate] of [["540", 540, 1_500_000], ["720", 720, 3_000_000]] as const) {
    if (plan.length > 0 && target > short) break;
    const s = Math.min(target, short);
    const long = even((Math.max(p.width, p.height) * s) / short);
    plan.push({ name, width: portrait ? even(s) : long, height: portrait ? long : even(s), bitrate });
  }
  return plan;
}

export function masterPlaylist(renditions: Rendition[], hasAudio = true): string {
  const lines = ["#EXTM3U", "#EXT-X-VERSION:3"];
  for (const r of renditions) {
    lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${r.bitrate + 128_000},RESOLUTION=${r.width}x${r.height}${hasAudio ? ',CODECS="avc1.4d401f,mp4a.40.2"' : ',CODECS="avc1.4d401f"'}`);
    lines.push(`${r.name}.m3u8`);
  }
  return `${lines.join("\n")}\n`;
}

const TYPES: Record<string, string> = {
  m3u8: "application/vnd.apple.mpegurl",
  ts: "video/mp2t",
  jpg: "image/jpeg",
  mp4: "video/mp4",
};

/** Transcode a source video to HLS (540p + 720p), a poster frame and a 3 s muted preview. */
export async function transcodeToHls(source: Buffer): Promise<TranscodeResult> {
  const dir = await mkdtemp(join(tmpdir(), "janus-transcode-"));
  try {
    const input = join(dir, "source");
    await writeFile(input, source);
    const info = await probe(input);
    const renditions = planRenditions(info);

    for (const r of renditions) {
      const args = [
        "-hide_banner", "-y", "-i", input,
        "-map", "0:v:0", ...(info.hasAudio ? ["-map", "0:a:0", "-c:a", "aac", "-b:a", "128k", "-ac", "2"] : []),
        "-vf", `scale=${r.width}:${r.height}`,
        "-c:v", "libx264", "-preset", "veryfast", "-profile:v", "main", "-pix_fmt", "yuv420p",
        "-b:v", String(r.bitrate), "-maxrate", String(Math.round(r.bitrate * 1.2)), "-bufsize", String(r.bitrate * 2),
        "-g", "48", "-keyint_min", "48", "-sc_threshold", "0",
        "-f", "hls", "-hls_time", "4", "-hls_playlist_type", "vod",
        "-hls_segment_filename", join(dir, `${r.name}_%03d.ts`),
        join(dir, `${r.name}.m3u8`),
      ];
      await run(appConfig.ffmpegPath, args);
    }
    const at = info.durationMs > 1500 ? "1" : "0";
    await run(appConfig.ffmpegPath, ["-hide_banner", "-y", "-ss", at, "-i", input, "-frames:v", "1", "-vf", "scale=-2:960", "-q:v", "3", join(dir, "poster.jpg")]);
    await run(appConfig.ffmpegPath, [
      "-hide_banner", "-y", "-t", "3", "-i", input, "-an", "-vf", "scale=-2:640",
      "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-movflags", "+faststart", join(dir, "preview.mp4"),
    ]);
    await writeFile(join(dir, "master.m3u8"), masterPlaylist(renditions, info.hasAudio));

    const files: TranscodeResult["files"] = [];
    for (const name of await readdir(dir)) {
      if (name === "source") continue;
      const ext = name.split(".").pop() ?? "";
      const contentType = TYPES[ext];
      if (!contentType) continue;
      files.push({ name, bytes: await readFile(join(dir, name)), contentType });
    }
    return { probe: info, renditions, files };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
