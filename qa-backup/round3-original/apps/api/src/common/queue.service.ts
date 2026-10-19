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

  async publish(url: string, topic: string, payload: unknown): Promise<void> {
    // No SQS consumer exists in this codebase yet, so against LocalStack (local dev)
    // run the in-process handler instead of parking messages in an unread queue.
    const runLocally = !url || !this.sqs || (Boolean(appConfig.awsEndpoint) && this.localHandlers.has(topic));
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
