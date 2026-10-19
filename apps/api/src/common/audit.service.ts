import { Injectable } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { PrismaService } from "./prisma.service";

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async write(input: {
    actorId?: string | null;
    action: AuditAction;
    resourceType: string;
    resourceId: string;
    ip?: string | null;
    userAgent?: string | null;
    metadata?: Prisma.InputJsonValue;
  }): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        metadata: input.metadata,
      },
    });
  }
}
