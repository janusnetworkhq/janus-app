import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { RedisService } from "../common/redis.service";
import { NotificationService } from "../notifications/notification.service";

export type NdaLifecycleEvent =
  | { type: "REQUESTED" | "ACCEPTED" | "REJECTED" | "SIGNED"; requestId: string }
  | { type: "SWEEP" };

function who(u: { displayName: string | null; handle: string }): string {
  return u.displayName || `@${u.handle}`;
}

/**
 * NDA lifecycle: notifies the counter-party on every transition and runs the periodic
 * sweep that expires stale requests (72 h) and announces expired access grants.
 */
@Injectable()
export class NdaLifecycleService {
  private readonly logger = new Logger(NdaLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly notifications: NotificationService,
  ) {}

  async handle(event: NdaLifecycleEvent): Promise<void> {
    if (event.type === "SWEEP") {
      await this.sweep();
      return;
    }
    const row = await this.prisma.ndaRequest.findUnique({
      where: { id: event.requestId },
      include: {
        recruiter: { select: { id: true, handle: true, displayName: true } },
        student: { select: { id: true, handle: true, displayName: true } },
      },
    });
    if (!row) return;
    const data = { requestId: row.id, studentId: row.studentId, recruiterId: row.recruiterId };
    switch (event.type) {
      case "REQUESTED":
        await this.notifications.notify(row.studentId, {
          type: "NDA_REQUESTED",
          title: "New request for your project files",
          body: `${who(row.recruiter)} asked to see your vault under NDA. Review it in your inbox.`,
          data,
        });
        break;
      case "ACCEPTED":
        await this.notifications.notify(row.recruiterId, {
          type: "NDA_ACCEPTED",
          title: "Your NDA request was approved",
          body: `${who(row.student)} approved your request. Sign the NDA to unlock the vault.`,
          data,
        });
        break;
      case "REJECTED":
        await this.notifications.notify(row.recruiterId, {
          type: "NDA_REJECTED",
          title: "Your NDA request was declined",
          body: `${who(row.student)} declined your request for project files.`,
          data,
        });
        break;
      case "SIGNED":
        await this.notifications.notify(row.studentId, {
          type: "NDA_SIGNED",
          title: "NDA signed",
          body: `${who(row.recruiter)} signed the NDA and can now view your vault.`,
          data,
        });
        break;
    }
  }

  /** Idempotent; safe to run from several instances (guarded by a short Redis lock). */
  async sweep(now = new Date()): Promise<{ expiredRequests: number; expiredGrants: number }> {
    const locked = await this.redis.setNx("lock:nda:sweep", "1", 60).catch(() => true);
    if (!locked) return { expiredRequests: 0, expiredGrants: 0 };
    try {
      const stale = await this.prisma.ndaRequest.findMany({
        where: {
          expiresAt: { lte: now },
          OR: [{ status: "PENDING" }, { status: "ACCEPTED", agreement: null }],
        },
        select: { id: true, recruiterId: true, studentId: true, status: true },
        take: 500,
      });
      let expiredRequests = 0;
      for (const r of stale) {
        // Conditional update so a concurrent decide/sign wins over the sweep.
        const res = await this.prisma.ndaRequest.updateMany({
          where: { id: r.id, status: r.status, ...(r.status === "ACCEPTED" ? { agreement: null } : {}) },
          data: { status: "EXPIRED" },
        });
        if (res.count === 0) continue;
        expiredRequests++;
        const data = { requestId: r.id, studentId: r.studentId };
        await this.notifications.notify(r.recruiterId, {
          type: "NDA_EXPIRED",
          title: "NDA request expired",
          body: "Your request for project files expired before it was completed. You can send a new one.",
          data,
        });
      }

      const grants = await this.prisma.accessGrant.findMany({
        where: { expiresAt: { lte: now }, revokedAt: null, expiryNotifiedAt: null },
        select: { id: true, recruiterId: true, studentId: true },
        take: 500,
      });
      let expiredGrants = 0;
      for (const g of grants) {
        const res = await this.prisma.accessGrant.updateMany({
          where: { id: g.id, expiryNotifiedAt: null },
          data: { expiryNotifiedAt: now },
        });
        if (res.count === 0) continue;
        expiredGrants++;
        await this.notifications.notify(g.recruiterId, {
          type: "GRANT_EXPIRED",
          title: "Vault access expired",
          body: "Your NDA access window for a student's vault has ended. Request access again if you still need it.",
          data: { grantId: g.id, studentId: g.studentId },
        });
      }
      if (expiredRequests || expiredGrants) {
        this.logger.log(`NDA sweep: ${expiredRequests} request(s), ${expiredGrants} grant(s) expired`);
      }
      return { expiredRequests, expiredGrants };
    } finally {
      await this.redis.del("lock:nda:sweep").catch(() => undefined);
    }
  }
}
