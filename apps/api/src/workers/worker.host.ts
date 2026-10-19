import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { appConfig } from "../common/config";
import { OutboxService } from "../common/outbox.service";
import { QueueService } from "../common/queue.service";
import { MediaPipelineService } from "../media/media-pipeline.service";
import { NotificationService } from "../notifications/notification.service";
import { AvatarCopyService } from "./avatar-copy.service";
import { NdaLifecycleEvent, NdaLifecycleService } from "./nda-lifecycle.service";

/**
 * Registers the handler for every queue topic. The same handlers run in-process
 * (QUEUE_MODE=inline) or inside the SQS consumer process (src/workers/main.ts).
 */
@Injectable()
export class WorkerHost implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerHost.name);
  private sweepTimer?: NodeJS.Timeout;

  constructor(
    private readonly outbox: OutboxService,
    private readonly queue: QueueService,
    private readonly pipeline: MediaPipelineService,
    private readonly lifecycle: NdaLifecycleService,
    private readonly avatar: AvatarCopyService,
    private readonly notifications: NotificationService,
  ) {}

  onModuleInit(): void {
    this.queue.localHandlers.set("media.transcode", async (payload) => {
      const uploadId = (payload as { uploadId?: string }).uploadId;
      if (uploadId) await this.pipeline.processUpload(uploadId);
    });
    this.queue.localHandlers.set("nda.lifecycle", async (payload) => {
      await this.lifecycle.handle(payload as NdaLifecycleEvent);
    });
    this.queue.localHandlers.set("notify.send", async (payload) => {
      await this.handleNotify(payload as NotifyPayload);
    });
    this.queue.localHandlers.set("media.avatar_copy", async (payload) => {
      await this.avatar.copy(payload as { userId: string; pictureUrl: string });
    });

    if (appConfig.workersEnabled) {
      this.outbox.start();
      this.logger.log(`Outbox poller started (queue mode: ${appConfig.queueMode})`);
      if (appConfig.ndaSweepIntervalSec > 0) {
        this.sweepTimer = setInterval(() => {
          void this.lifecycle.sweep().catch((err: Error) => this.logger.warn(`NDA sweep failed: ${err.message}`));
        }, appConfig.ndaSweepIntervalSec * 1000);
        this.sweepTimer.unref();
      }
    }
  }

  onModuleDestroy(): void {
    this.outbox.stop();
    if (this.sweepTimer) clearInterval(this.sweepTimer);
  }

  private async handleNotify(p: NotifyPayload): Promise<void> {
    if (!p?.userId) return;
    switch (p.type) {
      case "VIDEO_READY":
        await this.notifications.notify(p.userId, {
          type: "VIDEO_READY",
          title: p.pendingReview ? "Video submitted for review" : "Your video is live",
          body: p.pendingReview
            ? "Your video finished processing and is waiting for moderation before it appears in the feed."
            : "Your video finished processing and is now in the feed.",
          data: { videoId: p.videoId },
          email: false,
        });
        break;
      case "VIDEO_FAILED":
        await this.notifications.notify(p.userId, {
          type: "VIDEO_FAILED",
          title: "Video processing failed",
          body: "We couldn't process your video. Try uploading it again.",
          data: { videoId: p.videoId },
          email: false,
        });
        break;
      case "VIDEO_APPROVED":
      case "VIDEO_REJECTED":
        await this.notifications.notify(p.userId, {
          type: p.type,
          title: p.type === "VIDEO_APPROVED" ? "Your video was approved" : "Your video was not approved",
          body:
            p.type === "VIDEO_APPROVED"
              ? "A moderator approved your video. It is now in the feed."
              : "A moderator reviewed your video and it won't be shown in the feed.",
          data: { videoId: p.videoId },
        });
        break;
      default:
        this.logger.debug(`notify.send: unknown type ${String(p.type)}`);
    }
  }
}

type NotifyPayload = { type: string; userId: string; videoId?: string; pendingReview?: boolean };
