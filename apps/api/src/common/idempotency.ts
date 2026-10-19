import { createHash } from "node:crypto";
import { PrismaService } from "./prisma.service";

export async function withIdempotency<T>(
  prisma: PrismaService,
  input: {
    userId: string;
    key: string | undefined;
    route: string;
    requestHash: string;
    run: () => Promise<{ status: number; body: T }>;
  },
): Promise<T> {
  if (!input.key) {
    const { body } = await input.run();
    return body;
  }

  const existing = await prisma.idempotencyRecord.findUnique({
    where: {
      userId_key_route: { userId: input.userId, key: input.key, route: input.route },
    },
  });
  if (existing?.responseBody) {
    if (existing.requestHash !== input.requestHash) {
      throw Object.assign(new Error("Idempotency-Key reused with a different body"), {
        status: 409,
      });
    }
    return existing.responseBody as T;
  }

  const result = await input.run();
  await prisma.idempotencyRecord.create({
    data: {
      userId: input.userId,
      key: input.key,
      route: input.route,
      requestHash: input.requestHash,
      responseStatus: result.status,
      responseBody: result.body as object,
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
    },
  });
  return result.body;
}

export function hashBody(body: unknown): string {
  return createHash("sha256").update(JSON.stringify(body ?? {})).digest("hex");
}
