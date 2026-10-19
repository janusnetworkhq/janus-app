import { createHash } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { appConfig } from "../common/config";
import { PrismaService } from "../common/prisma.service";
import { RedisService } from "../common/redis.service";
import { StorageService } from "../common/storage.service";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Copies an IdP profile picture into our public bucket so clients never hot-link the IdP. */
@Injectable()
export class AvatarCopyService {
  private readonly logger = new Logger(AvatarCopyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly redis: RedisService,
  ) {}

  static hostAllowed(url: URL): boolean {
    if (url.protocol !== "https:" && !(url.protocol === "http:" && !appConfig.isProd)) return false;
    const host = url.hostname.toLowerCase();
    return appConfig.avatarCopyHosts.some((h) => host === h || host.endsWith(`.${h}`));
  }

  async copy(payload: { userId: string; pictureUrl: string }): Promise<{ copied: boolean; reason?: string; key?: string }> {
    let url: URL;
    try {
      url = new URL(payload.pictureUrl);
    } catch {
      return { copied: false, reason: "bad_url" };
    }
    if (!AvatarCopyService.hostAllowed(url)) {
      this.logger.warn(`Avatar host not allowed: ${url.hostname}`);
      return { copied: false, reason: "host_not_allowed" };
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, avatarKey: true, cognitoSub: true },
    });
    if (!user) return { copied: false, reason: "no_user" };
    if (user.avatarKey) return { copied: false, reason: "already_set" };

    const res = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`Avatar fetch failed (${res.status})`);
    const type = (res.headers.get("content-type") ?? "").split(";")[0]?.trim() ?? "".toLowerCase();
    const ext = TYPES[type];
    if (!ext) return { copied: false, reason: "bad_type" };
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > MAX_AVATAR_BYTES) return { copied: false, reason: "too_large" };
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_AVATAR_BYTES) return { copied: false, reason: "too_large" };

    const key = `avatars/${user.id}/${createHash("sha256").update(bytes).digest("hex").slice(0, 16)}.${ext}`;
    await this.storage.put(appConfig.s3PublicBucket, key, bytes, type);
    // Never overwrite an avatar the user uploaded meanwhile.
    const updated = await this.prisma.user.updateMany({ where: { id: user.id, avatarKey: null }, data: { avatarKey: key } });
    await this.redis.del(`user:sub:${user.cognitoSub}`);
    return updated.count ? { copied: true, key } : { copied: false, reason: "already_set" };
  }
}
