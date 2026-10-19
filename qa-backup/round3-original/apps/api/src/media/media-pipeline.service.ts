import { Injectable, Logger } from "@nestjs/common";
import { ModerationStatus, Prisma, RenditionKind, UploadKind, VideoStatus } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";
import { RedisService } from "../common/redis.service";
import { appConfig } from "../common/config";
import { StorageService } from "../common/storage.service";
import { RekognitionClient, DetectModerationLabelsCommand } from "@aws-sdk/client-rekognition";

@Injectable()
export class MediaPipelineService {
  private readonly logger = new Logger(MediaPipelineService.name);
  private readonly rekognition: RekognitionClient | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
  ) {
    this.rekognition =
      appConfig.moderationDriver === "rekognition"
        ? new RekognitionClient({ region: appConfig.awsRegion })
        : null;
  }

  async processUpload(uploadId: string): Promise<void> {
    const upload = await this.prisma.upload.findUnique({
      where: { id: uploadId },
      include: { user: { select: { handle: true } }, video: true },
    });
    if (!upload) return;

    if (upload.kind === UploadKind.FEED_VIDEO || upload.kind === UploadKind.VAULT_VIDEO) {
      await this.finishVideo(upload);
      return;
    }
    if (upload.kind === UploadKind.VAULT_FILE) {
      await this.prisma.upload.update({
        where: { id: upload.id },
        data: { status: "CONSUMED" },
      });
    }
  }

  private async finishVideo(
    upload: Prisma.UploadGetPayload<{ include: { user: { select: { handle: true } }; video: true } }>,
  ): Promise<void> {
    const video =
      upload.video ??
      (await this.prisma.video.findUnique({ where: { uploadId: upload.id } }));
    if (!video) return;

    const watermark = `JANUS · @${upload.user.handle}`;
    const prefix = `hls/${video.id}`;
    const hlsMasterKey = `${prefix}/master.m3u8`;
    const posterKey = `${prefix}/poster.jpg`;
    const previewKey = `${prefix}/preview.mp4`;

    const moderation = await this.moderate(upload.s3Bucket, upload.s3Key);
    if (moderation.status === ModerationStatus.BLOCKED) {
      await this.prisma.video.update({
        where: { id: video.id },
        data: {
          status: VideoStatus.HIDDEN,
          moderationStatus: ModerationStatus.BLOCKED,
          moderationLabels: moderation.labels as Prisma.InputJsonValue,
          failureReason: "Blocked by moderation",
        },
      });
      return;
    }

    if (appConfig.transcodeDriver === "mock") {
      await this.storage.put(
        appConfig.s3PublicBucket,
        hlsMasterKey,
        Buffer.from("#EXTM3U\n#EXT-X-VERSION:3\n"),
        "application/vnd.apple.mpegurl",
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.video.update({
        where: { id: video.id },
        data: {
          status: VideoStatus.READY,
          moderationStatus: moderation.status,
          moderationLabels: moderation.labels as Prisma.InputJsonValue,
          hlsMasterKey,
          posterKey,
          previewKey,
          watermarkText: watermark,
          publishedAt: new Date(),
          width: 1080,
          height: 1920,
        },
      });
      await tx.videoRendition.createMany({
        data: [
          { videoId: video.id, kind: RenditionKind.HLS_540, s3Key: `${prefix}/540.m3u8`, bitrate: 1_500_000, width: 540, height: 960 },
          { videoId: video.id, kind: RenditionKind.HLS_720, s3Key: `${prefix}/720.m3u8`, bitrate: 3_000_000, width: 720, height: 1280 },
          { videoId: video.id, kind: RenditionKind.HLS_1080, s3Key: `${prefix}/1080.m3u8`, bitrate: 5_000_000, width: 1080, height: 1920 },
          { videoId: video.id, kind: RenditionKind.POSTER, s3Key: posterKey, width: 1080, height: 1920 },
          { videoId: video.id, kind: RenditionKind.PREVIEW, s3Key: previewKey, width: 1080, height: 1920 },
        ],
        skipDuplicates: true,
      });
      await tx.upload.update({ where: { id: upload.id }, data: { status: "CONSUMED" } });
      await tx.outboxEvent.create({
        data: { topic: "notify.send", payload: { type: "VIDEO_READY", userId: upload.userId, videoId: video.id } },
      });
    });

    await this.redis.del(`video:${video.id}`);
    this.logger.log(`Video ${video.id} READY`);
  }

  private async moderate(bucket: string, key: string): Promise<{ status: ModerationStatus; labels: unknown }> {
    if (key.toLowerCase().includes("nsfw") || key.toLowerCase().includes("blocked")) {
      return { status: ModerationStatus.BLOCKED, labels: [{ name: "local-block" }] };
    }
    if (!this.rekognition) {
      return { status: ModerationStatus.CLEAR, labels: [] };
    }
    try {
      const res = await this.rekognition.send(
        new DetectModerationLabelsCommand({
          Image: { S3Object: { Bucket: bucket, Name: key } },
          MinConfidence: 80,
        }),
      );
      const labels = res.ModerationLabels ?? [];
      const blocked = labels.some((l) => (l.Confidence ?? 0) >= 90);
      return {
        status: blocked ? ModerationStatus.BLOCKED : ModerationStatus.CLEAR,
        labels,
      };
    } catch (err) {
      this.logger.warn(`Rekognition failed, failing closed to FLAGGED: ${String(err)}`);
      return { status: ModerationStatus.FLAGGED, labels: [{ error: true }] };
    }
  }
}
