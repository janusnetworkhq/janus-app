import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { Injectable, Logger } from "@nestjs/common";
import { appConfig } from "./config";

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private readonly sqs: SQSClient | null;
  readonly localHandlers = new Map<string, (payload: unknown) => Promise<void>>();

  constructor() {
    if (appConfig.sqsTranscodeUrl && appConfig.mediaDriver === "s3") {
      this.sqs = new SQSClient({
        region: appConfig.awsRegion,
        endpoint: appConfig.awsEndpoint,
        credentials: appConfig.awsEndpoint
          ? {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "test",
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "test",
            }
          : undefined,
      });
    } else {
      this.sqs = null;
    }
  }

  get client(): SQSClient | null {
    return this.sqs;
  }

  async dispatch(topic: string, payload: unknown): Promise<void> {
    const handler = this.localHandlers.get(topic);
    if (!handler) throw new Error(`No handler for topic ${topic}`);
    await handler(payload);
  }

  async publish(url: string, topic: string, payload: unknown): Promise<void> {
    // inline mode (local dev): run the in-process handler. sqs mode: the worker process
    // (src/workers/main.ts) consumes every queue with the same handlers.
    const runLocally = !url || !this.sqs || appConfig.queueMode === "inline";
    if (runLocally) {
      const handler = this.localHandlers.get(topic);
      if (handler) await handler(payload);
      else this.logger.debug(`No SQS and no local handler for ${topic}`);
      return;
    }
    await this.sqs.send(
      new SendMessageCommand({
        QueueUrl: url,
        MessageBody: JSON.stringify({ topic, payload }),
      }),
    );
  }
}
