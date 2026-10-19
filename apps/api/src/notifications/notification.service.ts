import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { appConfig } from "../common/config";
import { EmailService } from "../common/email.service";
import { PrismaService } from "../common/prisma.service";

export type NotificationInput = {
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** Also send an email (default true). */
  email?: boolean;
};

export type PushMessage = { to: string; title: string; body: string; data?: Record<string, unknown>; sound?: "default" };

const EXPO_TOKEN = /^(Exponent|Expo)PushToken\[[A-Za-z0-9_-]+\]$/;

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  /** Last push batch, exposed for tests and the dev log driver. */
  readonly sentPushes: PushMessage[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  static isExpoToken(token: string): boolean {
    return EXPO_TOKEN.test(token);
  }

  async notify(userId: string, input: NotificationInput) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, status: true },
    });
    if (!user || user.status !== "ACTIVE") return null;

    const row = await this.prisma.notification.create({
      data: {
        userId,
        type: input.type,
        title: input.title.slice(0, 160),
        body: input.body.slice(0, 500),
        data: (input.data ?? {}) as Prisma.InputJsonValue,
      },
    });

    // Fan-out failures must never fail the business event that triggered them.
    await Promise.allSettled([
      this.push(userId, { title: row.title, body: row.body, data: { ...input.data, type: input.type, notificationId: row.id } }),
      input.email !== false && user.email
        ? this.email.sendNotification({ to: user.email, subject: row.title, text: row.body })
        : Promise.resolve(),
    ]);
    return row;
  }

  async push(userId: string, msg: { title: string; body: string; data?: Record<string, unknown> }): Promise<void> {
    const tokens = await this.prisma.pushToken.findMany({ where: { userId }, select: { token: true } });
    if (tokens.length === 0) return;
    const messages: PushMessage[] = tokens.map((t) => ({ to: t.token, sound: "default", ...msg }));

    if (appConfig.pushDriver !== "expo") {
      this.sentPushes.push(...messages);
      if (this.sentPushes.length > 200) this.sentPushes.splice(0, this.sentPushes.length - 200);
      this.logger.log(`[push:log] ${messages.length} message(s) to user ${userId}: ${msg.title}`);
      return;
    }

    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      const res = await fetch(appConfig.expoPushUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(appConfig.expoAccessToken ? { Authorization: `Bearer ${appConfig.expoAccessToken}` } : {}),
        },
        body: JSON.stringify(chunk),
      });
      if (!res.ok) {
        this.logger.warn(`Expo push failed (${res.status})`);
        continue;
      }
      const json = (await res.json()) as { data?: Array<{ status: string; details?: { error?: string } }> };
      const dead = (json.data ?? [])
        .map((ticket, idx) => (ticket.details?.error === "DeviceNotRegistered" ? chunk[idx]?.to : null))
        .filter((t): t is string => Boolean(t));
      if (dead.length) await this.prisma.pushToken.deleteMany({ where: { token: { in: dead } } });
    }
  }

  async registerToken(userId: string, token: string, platform: string) {
    return this.prisma.pushToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform, lastSeenAt: new Date() },
      select: { id: true, token: true, platform: true },
    });
  }

  async unregisterToken(userId: string, token: string) {
    const res = await this.prisma.pushToken.deleteMany({ where: { userId, token } });
    return { removed: res.count };
  }

  async list(userId: string, cursor?: string) {
    const items = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 31,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, type: true, title: true, body: true, data: true, readAt: true, createdAt: true },
    });
    const unread = await this.prisma.notification.count({ where: { userId, readAt: null } });
    return {
      items: items.slice(0, 30),
      nextCursor: items.length > 30 ? (items[29]?.id ?? null) : null,
      unread,
    };
  }

  async markRead(userId: string, id?: string) {
    const res = await this.prisma.notification.updateMany({
      where: { userId, readAt: null, ...(id ? { id } : {}) },
      data: { readAt: new Date() },
    });
    return { updated: res.count };
  }
}
