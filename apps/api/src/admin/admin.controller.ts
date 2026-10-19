import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ModerationStatus, UserRole, UserStatus, VideoStatus } from "@prisma/client";
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { CurrentUser, Roles } from "../auth/auth.decorators";
import type { AuthedUser } from "../auth/auth.types";
import { AuditService } from "../common/audit.service";
import { PrismaService } from "../common/prisma.service";
import { OutboxService } from "../common/outbox.service";
import { RedisService } from "../common/redis.service";
import { ApiError } from "../common/api-error";

class HideVideoDto {
  @IsEnum(VideoStatus)
  status!: VideoStatus;
}

class ModerationDecisionDto {
  @IsIn(["APPROVE", "REJECT"])
  decision!: "APPROVE" | "REJECT";

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

class UserStatusDto {
  @IsEnum(UserStatus)
  status!: UserStatus;
}

@ApiTags("admin")
@ApiBearerAuth()
@Roles(UserRole.PLATFORM_ADMIN)
@Controller("v1/admin")
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly redis: RedisService,
    private readonly outbox: OutboxService,
  ) {}

  @Get("videos")
  videos(@Query("status") status?: VideoStatus, @Query("moderation") moderation?: ModerationStatus) {
    return this.prisma.video.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(moderation ? { moderationStatus: moderation } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        status: true,
        moderationStatus: true,
        caption: true,
        createdAt: true,
        authorId: true,
        likeCount: true,
        deletedAt: true,
        hiddenByAdminAt: true,
        author: { select: { handle: true, displayName: true } },
      },
    });
  }

  @Patch("videos/:id")
  async hide(
    @CurrentUser() actor: AuthedUser,
    @Param("id") id: string,
    @Body() body: HideVideoDto,
  ) {
    if (body.status !== "HIDDEN" && body.status !== "READY") {
      throw ApiError.badRequest("STATUS", "Admin can set HIDDEN or READY");
    }
    const current = await this.prisma.video.findUnique({
      where: { id },
      select: { id: true, deletedAt: true, moderationStatus: true },
    });
    if (!current) throw ApiError.notFound("Video not found");
    if (body.status === "READY") {
      // An admin un-hide must never resurrect a video its author deleted.
      if (current.deletedAt) {
        throw ApiError.conflict("VIDEO_DELETED", "The author deleted this video; it cannot be restored");
      }
      if (current.moderationStatus === "BLOCKED") {
        throw ApiError.conflict("VIDEO_BLOCKED", "Blocked by moderation; approve it from the moderation queue instead");
      }
    }
    const video = await this.prisma.video.update({
      where: { id },
      data:
        body.status === "HIDDEN"
          ? { status: "HIDDEN", hiddenByAdminAt: new Date() }
          : { status: "READY", hiddenByAdminAt: null },
    });
    await this.redis.del(`video:${id}`);
    await this.audit.write({
      actorId: actor.id,
      action: "VIDEO_HIDDEN",
      resourceType: "video",
      resourceId: id,
      metadata: { status: body.status },
    });
    return video;
  }

  /** Moderation queue: READY-but-unreviewed (manual driver) and Rekognition FLAGGED videos. */
  @Get("moderation")
  moderationQueue() {
    return this.prisma.video.findMany({
      where: { deletedAt: null, moderationStatus: { in: ["PENDING", "FLAGGED"] }, status: { in: ["READY", "HIDDEN"] } },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: {
        id: true,
        status: true,
        moderationStatus: true,
        moderationLabels: true,
        caption: true,
        createdAt: true,
        hlsMasterKey: true,
        posterKey: true,
        author: { select: { id: true, handle: true, displayName: true } },
      },
    });
  }

  @Post("videos/:id/moderation")
  @HttpCode(200)
  async moderate(
    @CurrentUser() actor: AuthedUser,
    @Param("id") id: string,
    @Body() body: ModerationDecisionDto,
  ) {
    const current = await this.prisma.video.findUnique({ where: { id }, select: { id: true, authorId: true, deletedAt: true, moderationStatus: true } });
    if (!current) throw ApiError.notFound("Video not found");
    if (current.deletedAt) throw ApiError.conflict("VIDEO_DELETED", "The author deleted this video");
    const approve = body.decision === "APPROVE";
    const video = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.video.update({
        where: { id },
        data: approve
          ? { moderationStatus: "CLEAR", status: "READY", hiddenByAdminAt: null }
          : { moderationStatus: "BLOCKED", status: "HIDDEN", hiddenByAdminAt: new Date() },
        select: { id: true, status: true, moderationStatus: true },
      });
      await this.outbox.enqueue(tx, "notify.send", {
        type: approve ? "VIDEO_APPROVED" : "VIDEO_REJECTED",
        userId: current.authorId,
        videoId: id,
      });
      return updated;
    });
    await this.redis.del(`video:${id}`);
    await this.audit.write({
      actorId: actor.id,
      action: "VIDEO_HIDDEN",
      resourceType: "video",
      resourceId: id,
      metadata: { moderation: body.decision, previous: current.moderationStatus, note: body.note ?? null },
    });
    return video;
  }

  @Get("users")
  users(@Query("q") q?: string) {
    return this.prisma.user.findMany({
      where: q
        ? {
            OR: [
              { handle: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        handle: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });
  }

  @Patch("users/:id")
  async userStatus(
    @CurrentUser() actor: AuthedUser,
    @Param("id") id: string,
    @Body() body: UserStatusDto,
  ) {
    if (body.status === UserStatus.DELETED) {
      throw ApiError.badRequest("STATUS", "Use SUSPENDED; hard delete is not allowed");
    }
    const user = await this.prisma.user.update({
      where: { id },
      data: { status: body.status },
    });
    await this.redis.del(`user:sub:${user.cognitoSub}`);
    await this.audit.write({
      actorId: actor.id,
      action: body.status === "SUSPENDED" ? "USER_SUSPENDED" : "USER_RESTORED",
      resourceType: "user",
      resourceId: id,
    });
    return { id: user.id, status: user.status };
  }

  @Get("audit")
  auditLog(
    @Query("resourceType") resourceType?: string,
    @Query("resourceId") resourceId?: string,
  ) {
    return this.prisma.auditEvent.findMany({
      where: {
        ...(resourceType ? { resourceType } : {}),
        ...(resourceId ? { resourceId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
}
