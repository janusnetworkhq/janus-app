import { DeleteMessageCommand, ReceiveMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { Logger } from "@nestjs/common";

export type Dispatch = (topic: string, payload: unknown) => Promise<void>;

/**
 * Long-polls one SQS queue and dispatches `{ topic, payload }` envelopes. A message is
 * deleted only after its handler succeeds; failures become visible again after the
 * visibility timeout and land in the queue's DLQ after maxReceiveCount (set in infra).
 */
export class SqsConsumer {
  private readonly logger: Logger;
  private running = false;
  private loop?: Promise<void>;

  constructor(
    private readonly sqs: SQSClient,
    private readonly queueUrl: string,
    private readonly dispatch: Dispatch,
    private readonly opts: { waitTimeSec?: number; batch?: number; visibilitySec?: number } = {},
  ) {
    this.logger = new Logger(`SqsConsumer:${queueUrl.split("/").pop()}`);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.loop = this.run();
  }

  async stop(): Promise<void> {
    this.running = false;
    await this.loop;
  }

  /** Receive and process at most one batch. Returns the number of messages handled. */
  async pollOnce(): Promise<number> {
    const res = await this.sqs.send(
      new ReceiveMessageCommand({
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: this.opts.batch ?? 10,
        WaitTimeSeconds: this.opts.waitTimeSec ?? 20,
        VisibilityTimeout: this.opts.visibilitySec ?? 300,
      }),
    );
    const messages = res.Messages ?? [];
    let ok = 0;
    for (const m of messages) {
      try {
        const env = JSON.parse(m.Body ?? "{}") as { topic?: string; payload?: unknown };
        if (!env.topic) throw new Error("Message has no topic");
        await this.dispatch(env.topic, env.payload);
        await this.sqs.send(new DeleteMessageCommand({ QueueUrl: this.queueUrl, ReceiptHandle: m.ReceiptHandle }));
        ok++;
      } catch (err) {
        this.logger.warn(`Message ${m.MessageId} failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return ok;
  }

  private async run(): Promise<void> {
    this.logger.log("Consuming");
    while (this.running) {
      try {
        await this.pollOnce();
      } catch (err) {
        this.logger.warn(`Receive failed: ${err instanceof Error ? err.message : String(err)}`);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }
}
