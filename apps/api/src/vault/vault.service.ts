import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { OrgStatus, UserRole } from "@prisma/client";
import { ApiError } from "../common/api-error";
import { appConfig } from "../common/config";
import { AuditService } from "../common/audit.service";
import { PrismaService } from "../common/prisma.service";
import { RateLimitService } from "../common/rate-limit.service";
import { RedisService } from "../common/redis.service";
import { StorageService } from "../common/storage.service";
import type { AuthedUser } from "../auth/auth.types";

@Injectable()
export class VaultService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly rateLimit: RateLimitService,
    private readonly redis: RedisService,
  ) {}

  async listStudentVault(recruiter: AuthedUser, studentId: string) {
    await this.assertGrant(recruiter, studentId);
    const assets = await this.prisma.vaultAsset.findMany({
      where: { ownerId: studentId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        kind: true,
        originalName: true,
        contentType: true,
        byteSize: true,
        createdAt: true,
      },
    });
    return { items: assets };
  }

  async playback(
    recruiter: AuthedUser,
    assetId: string,
    req: { ip?: string; userAgent?: string },
  ) {
    await this.rateLimit.hitVault(recruiter.id);
    const asset = await this.prisma.vaultAsset.findFirst({
      where: { id: assetId, deletedAt: null },
    });
    if (!asset) {
      await this.denied(recruiter, assetId, req, "not_found");
      throw ApiError.forbidden("VAULT_DENIED", "No active NDA grant for this asset");
    }

    const grant = await this.assertGrant(recruiter, asset.ownerId, asset.id);
    const cacheKey = `grant:${recruiter.id}:${asset.id}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const url = await this.storage.signedGet(
      appConfig.s3VaultBucket,
      asset.s3Key,
      appConfig.limits.vaultUrlTtlSec,
    );
    const expiresAt = new Date(Date.now() + appConfig.limits.vaultUrlTtlSec * 1000);
    const watermarkToken = createHash("sha256")
      .update(`${grant.id}:${recruiter.id}:${asset.id}`)
      .digest("hex")
      .slice(0, 16);

    // Visible watermark: who is looking, for which org, and a token that traces back to the grant.
    const org = recruiter.recruiterProfile?.org?.name;
    const viewer = recruiter.email ?? `@${recruiter.handle}`;
    const watermarkText = [viewer, org, `NDA ${watermarkToken}`].filter(Boolean).join(" · ");
    const body = {
      url,
      expiresAt,
      watermarkToken,
      watermarkText,
      contentType: asset.contentType,
      originalName: asset.originalName,
    };
    await this.redis.set(cacheKey, JSON.stringify(body), appConfig.limits.vaultUrlTtlSec);
    await this.audit.write({
      actorId: recruiter.id,
      action: "ACCESS_GRANTED",
      resourceType: "vault_asset",
      resourceId: asset.id,
      ip: req.ip,
      userAgent: req.userAgent,
      metadata: { grantId: grant.id },
    });
    return body;
  }

  private async assertGrant(recruiter: AuthedUser, studentId: string, assetId?: string) {
    if (recruiter.role !== UserRole.RECRUITER && recruiter.role !== UserRole.PLATFORM_ADMIN) {
      await this.denied(recruiter, assetId ?? studentId, {}, "role");
      throw ApiError.forbidden("VAULT_DENIED", "No active NDA grant for this asset");
    }

    const orgStatus = recruiter.recruiterProfile?.org?.status;
    if (orgStatus && orgStatus !== OrgStatus.ACTIVE) {
      throw ApiError.forbidden("VAULT_DENIED", "Organization is suspended");
    }

    const grant = await this.prisma.accessGrant.findFirst({
      where: {
        recruiterId: recruiter.id,
        studentId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        agreement: { status: "SIGNED", revokedAt: null },
        OR: [{ vaultAssetId: null }, ...(assetId ? [{ vaultAssetId: assetId }] : [])],
      },
      include: { agreement: true },
      orderBy: { createdAt: "desc" },
    });

    if (!grant || grant.recruiterId !== recruiter.id) {
      await this.denied(recruiter, assetId ?? studentId, {}, "no_grant");
      throw ApiError.forbidden("VAULT_DENIED", "No active NDA grant for this asset");
    }
    return grant;
  }

  private async denied(
    recruiter: AuthedUser,
    resourceId: string,
    req: { ip?: string; userAgent?: string },
    reason: string,
  ) {
    await this.audit.write({
      actorId: recruiter.id,
      action: "ACCESS_DENIED",
      resourceType: "vault_asset",
      resourceId,
      ip: req.ip,
      userAgent: req.userAgent,
      metadata: { reason },
    });
  }
}
