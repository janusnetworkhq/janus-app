import { Body, Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole, UserStatus, VideoStatus } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { CurrentUser, Roles } from "../auth/auth.decorators";
import type { AuthedUser } from "../auth/auth.types";
import { AuditService } from "../common/audit.service";
import { PrismaService } from "../common/prisma.service";
import { RedisService } from "../common/redis.service";
import { ApiError } from "../common/api-error";

class HideVideoDto {
  @IsEnum(VideoStatus)
  status!: VideoStatus;
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
  ) {}

  @Get("videos")
  videos(@Query("status") status?: VideoStatus) {
    return this.prisma.video.findMany({
      where: status ? { status } : undefined,
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
    const video = await this.prisma.video.update({
      where: { id },
      data: { status: body.status, deletedAt: body.status === "HIDDEN" ? new Date() : null },
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
