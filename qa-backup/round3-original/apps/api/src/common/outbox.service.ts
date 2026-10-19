import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "./prisma.service";
import { QueueService } from "./queue.service";
import { appConfig } from "./config";

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  start(): void {
    if (!appConfig.workersEnabled || this.timer) return;
    this.timer = setInterval(() => {
      void this.flush().catch((err: Error) => this.logger.warn(err.message));
    }, 1000);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async enqueue(tx: Prisma.TransactionClient | PrismaService, topic: string, payload: unknown): Promise<void> {
    await tx.outboxEvent.create({
      data: { topic, payload: payload as Prisma.InputJsonValue },
    });
  }

  async flush(): Promise<void> {
    const rows = await this.prisma.$queryRaw<
      { id: string; topic: string; payload: unknown; attempts: number }[]
    >`
      WITH picked AS (
        SELECT id
        FROM outbox_events
        WHERE status = 'PENDING' AND available_at <= NOW()
        ORDER BY created_at
        LIMIT 25
        FOR UPDATE SKIP LOCKED
      )
      SELECT o.id, o.topic, o.payload, o.attempts
      FROM outbox_events o
      INNER JOIN picked p ON p.id = o.id
    `;
    if (rows.length === 0) return;

    for (const row of rows) {
      try {
        const url = this.urlFor(row.topic);
        await this.queue.publish(url, row.topic, row.payload);
        await this.prisma.outboxEvent.update({
          where: { id: row.id },
          data: { status: "PUBLISHED", publishedAt: new Date() },
        });
      } catch (err) {
        const attempts = row.attempts + 1;
        await this.prisma.outboxEvent.update({
          where: { id: row.id },
          data: {
            attempts,
            lastError: err instanceof Error ? err.message.slice(0, 1000) : "error",
            status: attempts >= 5 ? "FAILED" : "PENDING",
            availableAt: new Date(Date.now() + Math.min(60_000, 2 ** attempts * 500)),
          },
        });
      }
    }
  }

  private urlFor(topic: string): string {
    if (topic.startsWith("media.")) return appConfig.sqsTranscodeUrl;
    if (topic.startsWith("nda.")) return appConfig.sqsNdaUrl;
    return appConfig.sqsNotifyUrl;
  }
}
