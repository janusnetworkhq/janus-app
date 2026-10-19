import { Injectable } from "@nestjs/common";
import { UploadKind, UserRole, VaultAssetKind } from "@prisma/client";
import { ApiError } from "../common/api-error";
import { appConfig } from "../common/config";
import { OutboxService } from "../common/outbox.service";
import { PrismaService } from "../common/prisma.service";
import { RateLimitService } from "../common/rate-limit.service";
import { RedisService } from "../common/redis.service";
import { StorageService } from "../common/storage.service";
import { MediaPipelineService } from "./media-pipeline.service";
import type { AuthedUser } from "../auth/auth.types";

const FEED_TYPES = new Set(["video/mp4", "video/quicktime"]);
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly outbox: OutboxService,
    private readonly pipeline: MediaPipelineService,
    private readonly rateLimit: RateLimitService,
    private readonly redis: RedisService,
  ) {}

  async createUpload(
    user: AuthedUser,
    input: {
      kind: UploadKind;
      contentType: string;
      byteSize: number;
      sha256?: string;
      durationMs?: number;
      caption?: string;
      vaultKind?: VaultAssetKind;
      originalName?: string;
    },
  ) {
    await this.rateLimit.hitUpload(user.id);
    this.assertLimits(user, input);

    const ext = extFor(input.contentType);
    const upload = await this.prisma.upload.create({
      data: {
        userId: user.id,
        kind: input.kind,
        contentType: input.contentType,
        byteSize: input.byteSize,
        sha256: input.sha256,
        s3Bucket: bucketFor(input.kind),
        s3Key: `uploads/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`,
        expiresAt: new Date(Date.now() + appConfig.limits.presignTtlSec * 1000),
      },
    });

    if (input.kind === UploadKind.FEED_VIDEO || input.kind === UploadKind.VAULT_VIDEO) {
      await this.prisma.video.create({
        data: {
          authorId: user.id,
          uploadId: upload.id,
          caption: input.caption,
          durationMs: input.durationMs,
          watermarkText: `JANUS · @${user.handle}`,
          visibility: input.kind === UploadKind.VAULT_VIDEO ? "UNLISTED" : "PUBLIC_FEED",
        },
      });
    }

    const uploadUrl = await this.storage.presignPut(
      upload.s3Bucket,
      upload.s3Key,
      input.contentType,
      input.byteSize,
    );

    return {
      uploadId: upload.id,
      uploadUrl,
      method: "PUT" as const,
      expiresAt: upload.expiresAt,
      headers: { "Content-Type": input.contentType },
      kind: upload.kind,
      vaultKind: input.vaultKind,
      originalName: input.originalName,
    };
  }

  async complete(
    user: AuthedUser,
    uploadId: string,
    extra?: { vaultKind?: VaultAssetKind; originalName?: string; videoId?: string },
  ) {
    const upload = await this.prisma.upload.findFirst({
      where: { id: uploadId, userId: user.id },
      include: { video: true },
    });
    if (!upload) throw ApiError.notFound("Upload not found");
    if (upload.status !== "CREATED") {
      throw ApiError.conflict("UPLOAD_STATE", "Upload already completed");
    }

    const head = await this.storage.head(upload.s3Bucket, upload.s3Key);
    if (appConfig.mediaDriver === "s3" && head.contentLength === 0) {
      throw ApiError.badRequest("UPLOAD_MISSING", "Object not found in storage");
    }
    if (appConfig.mediaDriver === "s3" && head.contentLength > upload.byteSize * 1.05) {
      throw ApiError.badRequest("UPLOAD_SIZE", "Object larger than declared size");
    }

    if (upload.kind === UploadKind.AVATAR || upload.kind === UploadKind.BANNER) {
      const field = upload.kind === UploadKind.AVATAR ? "avatarKey" : "bannerKey";
      await this.prisma.user.update({
        where: { id: user.id },
        data: { [field]: upload.s3Key },
      });
      await this.prisma.upload.update({
        where: { id: upload.id },
        data: { status: "CONSUMED", etag: head.etag },
      });
      await this.redis.del(`user:sub:${user.cognitoSub}`);
      return { status: "CONSUMED", kind: upload.kind };
    }

    if (upload.kind === UploadKind.VAULT_FILE || upload.kind === UploadKind.VAULT_VIDEO) {
      const asset = await this.prisma.vaultAsset.create({
        data: {
          ownerId: user.id,
          kind: extra?.vaultKind ?? (upload.kind === UploadKind.VAULT_VIDEO ? "HIGH_RES_VIDEO" : "DOCUMENT"),
          originalName: extra?.originalName ?? "vault-file",
          contentType: upload.contentType,
          byteSize: upload.byteSize,
          s3Key: upload.s3Key,
          kmsKeyArn: "alias/janus-vault",
          checksumSha256: upload.sha256 ?? "0".repeat(64),
        },
      });
      if (extra?.videoId || upload.video?.id) {
        const videoId = extra?.videoId ?? upload.video!.id;
        await this.prisma.videoVaultLink.create({
          data: { videoId, vaultAssetId: asset.id },
        });
        await this.prisma.video.update({
          where: { id: videoId },
          data: { hasVault: true },
        });
      }
      await this.prisma.auditEvent.create({
        data: {
          actorId: user.id,
          action: "VAULT_UPLOADED",
          resourceType: "vault",
          resourceId: asset.id,
        },
      });
    }

    await this.prisma.upload.update({
      where: { id: upload.id },
      data: { status: "UPLOADED", etag: head.etag },
    });

    if (upload.kind === UploadKind.FEED_VIDEO || upload.kind === UploadKind.VAULT_VIDEO) {
      const useInline = !appConfig.sqsTranscodeUrl || appConfig.mediaDriver === "noop";
      if (useInline) {
        await this.pipeline.processUpload(upload.id);
      } else {
        await this.prisma.$transaction(async (tx) => {
          await this.outbox.enqueue(tx, "media.transcode", { uploadId: upload.id });
        });
      }
      return { status: "PROCESSING", videoId: upload.video?.id };
    }

    await this.prisma.upload.update({ where: { id: upload.id }, data: { status: "CONSUMED" } });
    return { status: "CONSUMED" };
  }

  async getVideo(id: string) {
    const cached = await this.redis.get(`video:${id}`);
    if (cached) return JSON.parse(cached);
    const video = await this.prisma.video.findFirst({
      where: { id, deletedAt: null },
      include: {
        author: {
          select: {
            id: true,
            handle: true,
            displayName: true,
            avatarKey: true,
            studentProfile: { select: { headline: true, university: true } },
          },
        },
        renditions: true,
      },
    });
    if (!video) throw ApiError.notFound();
    const dto = this.serializeVideo(video);
    await this.redis.set(`video:${id}`, JSON.stringify(dto), 30);
    return dto;
  }

  async deleteVideo(user: AuthedUser, id: string) {
    const video = await this.prisma.video.findFirst({ where: { id, authorId: user.id, deletedAt: null } });
    if (!video) throw ApiError.notFound();
    await this.prisma.video.update({
      where: { id },
      data: { deletedAt: new Date(), status: "HIDDEN" },
    });
    await this.redis.del(`video:${id}`);
    return { ok: true };
  }

  serializeVideo(video: {
    id: string;
    caption: string | null;
    durationMs: number | null;
    status: string;
    hasVault: boolean;
    likeCount: number;
    commentCount: number;
    bookmarkCount: number;
    hlsMasterKey: string | null;
    posterKey: string | null;
    createdAt: Date;
    author: {
      id: string;
      handle: string;
      displayName: string | null;
      avatarKey: string | null;
      studentProfile: { headline: string | null; university: string | null } | null;
    };
  }, liked: boolean = false) {
    return {
      id: video.id,
      caption: video.caption,
      durationMs: video.durationMs,
      status: video.status,
      hasVault: video.hasVault,
      likeCount: video.likeCount,
      commentCount: video.commentCount,
      bookmarkCount: video.bookmarkCount,
      liked,
      hlsUrl: video.hlsMasterKey ? this.storage.publicUrl(video.hlsMasterKey) : null,
      posterUrl: video.posterKey ? this.storage.publicUrl(video.posterKey) : null,
      createdAt: video.createdAt,
      author: {
        id: video.author.id,
        handle: video.author.handle,
        displayName: video.author.displayName,
        avatarUrl: video.author.avatarKey ? this.storage.publicUrl(video.author.avatarKey) : null,
        headline: video.author.studentProfile?.headline ?? null,
        university: video.author.studentProfile?.university ?? null,
      },
    };
  }

  private assertLimits(
    user: AuthedUser,
    input: { kind: UploadKind; contentType: string; byteSize: number; durationMs?: number },
  ) {
    if (input.kind === UploadKind.FEED_VIDEO || input.kind === UploadKind.VAULT_VIDEO) {
      if (user.role !== UserRole.STUDENT && user.role !== UserRole.PLATFORM_ADMIN) {
        throw ApiError.forbidden("FORBIDDEN", "Only students can upload videos");
      }
      if (!FEED_TYPES.has(input.contentType)) {
        throw ApiError.badRequest("CONTENT_TYPE", "Use video/mp4");
      }
      if (input.byteSize > appConfig.limits.feedVideoBytes) {
        throw ApiError.badRequest("FILE_TOO_LARGE", "Feed video max 200MB");
      }
      if (input.kind === UploadKind.FEED_VIDEO && input.durationMs && input.durationMs > appConfig.limits.feedDurationMs) {
        throw ApiError.badRequest("DURATION", "Max 90 seconds");
      }
    }
    if (input.kind === UploadKind.VAULT_FILE && input.byteSize > appConfig.limits.vaultBytes) {
      throw ApiError.badRequest("FILE_TOO_LARGE", "Vault file max 500MB");
    }
    if ((input.kind === UploadKind.AVATAR || input.kind === UploadKind.BANNER) && !IMAGE_TYPES.has(input.contentType)) {
      throw ApiError.badRequest("CONTENT_TYPE", "Use jpeg, png, or webp");
    }
  }
}

function bucketFor(kind: UploadKind): string {
  if (kind === UploadKind.VAULT_FILE || kind === UploadKind.VAULT_VIDEO) return appConfig.s3VaultBucket;
  if (kind === UploadKind.AVATAR || kind === UploadKind.BANNER) return appConfig.s3PublicBucket;
  return appConfig.s3UploadsBucket;
}

function extFor(contentType: string): string {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("jpeg")) return "jpg";
  if (contentType.includes("quicktime")) return "mov";
  if (contentType.includes("pdf")) return "pdf";
  if (contentType.includes("zip")) return "zip";
  return "mp4";
}
