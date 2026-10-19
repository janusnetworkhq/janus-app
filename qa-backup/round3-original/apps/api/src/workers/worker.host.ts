import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { appConfig } from "../common/config";
import { OutboxService } from "../common/outbox.service";
import { QueueService } from "../common/queue.service";
import { MediaPipelineService } from "../media/media-pipeline.service";

@Injectable()
export class WorkerHost implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerHost.name);

  constructor(
    private readonly outbox: OutboxService,
    private readonly queue: QueueService,
    private readonly pipeline: MediaPipelineService,
  ) {}

  onModuleInit(): void {
    this.queue.localHandlers.set("media.transcode", async (payload) => {
      const uploadId = (payload as { uploadId?: string }).uploadId;
      if (uploadId) await this.pipeline.processUpload(uploadId);
    });
    this.queue.localHandlers.set("nda.lifecycle", async () => undefined);
    this.queue.localHandlers.set("notify.send", async () => undefined);
    this.queue.localHandlers.set("media.avatar_copy", async () => undefined);

    if (appConfig.workersEnabled) {
      this.outbox.start();
      this.logger.log("Outbox poller started");
    }
  }

  onModuleDestroy(): void {
    this.outbox.stop();
  }
}
