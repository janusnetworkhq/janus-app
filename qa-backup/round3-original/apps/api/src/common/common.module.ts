import { Module } from "@nestjs/common";
import { AuditService } from "./audit.service";
import { EmailService } from "./email.service";
import { OutboxService } from "./outbox.service";
import { PrismaService } from "./prisma.service";
import { QueueService } from "./queue.service";
import { RateLimitService } from "./rate-limit.service";
import { RedisService } from "./redis.service";
import { StorageService } from "./storage.service";

@Module({
  providers: [
    PrismaService,
    RedisService,
    RateLimitService,
    StorageService,
    QueueService,
    OutboxService,
    AuditService,
    EmailService,
  ],
  exports: [
    PrismaService,
    RedisService,
    RateLimitService,
    StorageService,
    QueueService,
    OutboxService,
    AuditService,
    EmailService,
  ],
})
export class CommonModule {}
