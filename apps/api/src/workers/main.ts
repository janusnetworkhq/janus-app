import "../load-env";
import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { appConfig, assertProdConfig } from "../common/config";
import { QueueService } from "../common/queue.service";
import { SqsConsumer } from "./sqs-consumer";

/** Worker process: consumes media-transcode, nda-lifecycle and notify-send. */
async function bootstrap() {
  assertProdConfig();
  const ctx = await NestFactory.createApplicationContext(AppModule, { logger: ["error", "warn", "log"] });
  ctx.enableShutdownHooks();
  const queue = ctx.get(QueueService);
  if (!queue.client) {
    if (appConfig.queueMode === "inline") {
      // No-AWS prod path: WorkerHost (WORKERS_ENABLED=true) already started the DB outbox
      // poller in this process; it flushes outbox rows and runs handlers inline (incl.
      // ffmpeg transcode). Keep the process alive without an SQS consumer.
      Logger.log("Inline queue mode: outbox poller running in worker process (no SQS)", "Worker");
      await new Promise<never>(() => undefined);
      return;
    }
    Logger.warn("SQS is not configured (MEDIA_DRIVER=s3 and SQS_* URLs required); nothing to consume", "Worker");
    await ctx.close();
    return;
  }
  const urls = [appConfig.sqsTranscodeUrl, appConfig.sqsNdaUrl, appConfig.sqsNotifyUrl].filter(Boolean);
  const consumers = urls.map((url) => new SqsConsumer(queue.client!, url, (topic, payload) => queue.dispatch(topic, payload)));
  consumers.forEach((c) => c.start());
  Logger.log(`Worker consuming ${consumers.length} queue(s)`, "Worker");

  const shutdown = async () => {
    await Promise.all(consumers.map((c) => c.stop()));
    await ctx.close();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());
}

void bootstrap();
