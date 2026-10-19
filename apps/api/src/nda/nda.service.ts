import { Injectable } from "@nestjs/common";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { UserRole } from "@prisma/client";
import { ApiError } from "../common/api-error";
import { appConfig } from "../common/config";
import { AuditService } from "../common/audit.service";
import { hashBody, withIdempotency } from "../common/idempotency";
import { OutboxService } from "../common/outbox.service";
import { PrismaService } from "../common/prisma.service";
import { RateLimitService } from "../common/rate-limit.service";
import { StorageService } from "../common/storage.service";
import { monthStartUtc, PLANS } from "../billing/plans";
import type { AuthedUser } from "../auth/auth.types";

@Injectable()
export class NdaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rateLimit: RateLimitService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  async defaultTemplate() {
    const template = await this.prisma.ndaTemplate.findFirst({ where: { isActive: true } });
    if (!template) throw ApiError.notFound("No active NDA template");
    return {
      id: template.id,
      version: template.version,
      title: template.title,
      body: template.body,
      contentSha256: template.contentSha256,
    };
  }

  async request(
    recruiter: AuthedUser,
    input: { studentId: string; videoId?: string; reason?: string },
    idempotencyKey?: string,
  ) {
    if (recruiter.id === input.studentId) {
      throw ApiError.badRequest("SELF_REQUEST", "You cannot request access to your own project files");
    }
    await this.rateLimit.hitNda(recruiter.id);
    const student = await this.prisma.user.findFirst({
      where: { id: input.studentId, status: "ACTIVE" },
    });
    if (!student) throw ApiError.notFound("Student not found");

    const template = await this.prisma.ndaTemplate.findFirst({ where: { isActive: true } });
    if (!template) throw ApiError.notFound("No active NDA template");

    const profile = await this.prisma.recruiterProfile.findUnique({
      where: { userId: recruiter.id },
      select: { orgId: true, org: { select: { plan: true } } },
    });
    if (profile) {
      const quota = PLANS[profile.org.plan].ndaRequestsPerMonth;
      const used = await this.prisma.ndaRequest.count({
        where: { createdAt: { gte: monthStartUtc() }, recruiter: { recruiterProfile: { orgId: profile.orgId } } },
      });
      if (used >= quota) {
        throw ApiError.forbidden("PLAN_LIMIT", `Your organization's plan allows ${quota} NDA requests per month`);
      }
    }

    return withIdempotency(this.prisma, {
      userId: recruiter.id,
      key: idempotencyKey,
      route: "POST /v1/nda/requests",
      requestHash: hashBody(input),
      run: async () => {
        try {
          const row = await this.prisma.ndaRequest.create({
            data: {
              recruiterId: recruiter.id,
              studentId: student.id,
              videoId: input.videoId,
              templateId: template.id,
              reason: input.reason,
              expiresAt: new Date(Date.now() + appConfig.limits.ndaExpiryHours * 3600 * 1000),
            },
          });
          await this.audit.write({
            actorId: recruiter.id,
            action: "NDA_REQUESTED",
            resourceType: "nda_request",
            resourceId: row.id,
          });
          await this.outbox.enqueue(this.prisma, "nda.lifecycle", {
            type: "REQUESTED",
            requestId: row.id,
          });
          return { status: 201, body: row };
        } catch {
          const pending = await this.prisma.ndaRequest.findFirst({
            where: { recruiterId: recruiter.id, studentId: student.id, status: "PENDING" },
          });
          if (pending) return { status: 200, body: pending };
          throw ApiError.conflict("NDA_EXISTS", "Could not create NDA request");
        }
      },
    });
  }

  async inbox(user: AuthedUser) {
    return this.prisma.ndaRequest.findMany({
      where: { studentId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        recruiter: { select: { id: true, handle: true, displayName: true, recruiterProfile: { select: { title: true, org: { select: { name: true } } } } } },
        template: { select: { title: true, version: true, contentSha256: true } },
      },
    });
  }

  async outbound(user: AuthedUser) {
    return this.prisma.ndaRequest.findMany({
      where: { recruiterId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        student: { select: { id: true, handle: true, displayName: true } },
        agreement: { select: { id: true, signedAt: true } },
      },
    });
  }

  async decide(user: AuthedUser, id: string, accept: boolean) {
    const row = await this.prisma.ndaRequest.findFirst({ where: { id, studentId: user.id } });
    if (!row) throw ApiError.notFound();
    if (row.status !== "PENDING") throw ApiError.conflict("NDA_STATE", "Request is not pending");
    if (row.expiresAt < new Date()) {
      await this.prisma.ndaRequest.update({ where: { id }, data: { status: "EXPIRED" } });
      throw ApiError.conflict("NDA_EXPIRED", "Request expired");
    }
    const updated = await this.prisma.ndaRequest.update({
      where: { id },
      data: { status: accept ? "ACCEPTED" : "REJECTED", decidedAt: new Date() },
    });
    await this.audit.write({
      actorId: user.id,
      action: "NDA_DECIDED",
      resourceType: "nda_request",
      resourceId: id,
      metadata: { accept },
    });
    await this.outbox.enqueue(this.prisma, "nda.lifecycle", {
      type: accept ? "ACCEPTED" : "REJECTED",
      requestId: id,
    });
    return updated;
  }

  async sign(
    recruiter: AuthedUser,
    id: string,
    input: { typedName: string; acceptedHash: string },
    req: { ip?: string; userAgent?: string },
    idempotencyKey?: string,
  ) {
    return withIdempotency(this.prisma, {
      userId: recruiter.id,
      key: idempotencyKey,
      route: `POST /v1/nda/requests/${id}/sign`,
      requestHash: hashBody(input),
      run: async () => {
        const row = await this.prisma.ndaRequest.findFirst({
          where: { id, recruiterId: recruiter.id },
          include: { template: true, agreement: true },
        });
        if (!row) throw ApiError.notFound();
        if (row.status !== "ACCEPTED") throw ApiError.forbidden("NDA_NOT_ACCEPTED", "Student has not accepted");
        if (row.agreement) throw ApiError.conflict("NDA_SIGNED", "Already signed");
        if (row.expiresAt < new Date()) {
          throw ApiError.conflict("NDA_EXPIRED", "This request expired. Send a new request to the student.");
        }
        if (input.acceptedHash !== row.template.contentSha256) {
          throw ApiError.badRequest("HASH_MISMATCH", "Template hash does not match");
        }
        if (!input.typedName.trim() || input.typedName.trim().length < 2) {
          throw ApiError.badRequest("NAME_REQUIRED", "Type your legal name");
        }

        const pdfBytes = await this.renderPdf(row.template.body, input.typedName, row.template.contentSha256);
        const artifactKey = `legal/${row.id}.pdf`;
        await this.storage.put(appConfig.s3VaultBucket, artifactKey, Buffer.from(pdfBytes), "application/pdf");

        const expiresAt = new Date(Date.now() + appConfig.limits.grantTtlDays * 86400 * 1000);
        const agreement = await this.prisma.$transaction(async (tx) => {
          const created = await tx.ndaAgreement.create({
            data: {
              requestId: row.id,
              signerId: recruiter.id,
              signerName: input.typedName.trim(),
              templateSha256: row.template.contentSha256,
              artifactS3Key: artifactKey,
              ipAddress: req.ip || "0.0.0.0",
              userAgent: (req.userAgent || "unknown").slice(0, 512),
            },
          });
          await tx.accessGrant.create({
            data: {
              agreementId: created.id,
              recruiterId: recruiter.id,
              studentId: row.studentId,
              expiresAt,
            },
          });
          return created;
        });

        await this.audit.write({
          actorId: recruiter.id,
          action: "NDA_SIGNED",
          resourceType: "nda_agreement",
          resourceId: agreement.id,
          ip: req.ip,
          userAgent: req.userAgent,
        });
        await this.outbox.enqueue(this.prisma, "nda.lifecycle", { type: "SIGNED", requestId: row.id });
        return { status: 201, body: { agreementId: agreement.id, grantExpiresAt: expiresAt } };
      },
    });
  }

  async revoke(student: AuthedUser, grantId: string) {
    const grant = await this.prisma.accessGrant.findFirst({
      where: { id: grantId, studentId: student.id },
    });
    if (!grant) throw ApiError.notFound();
    await this.prisma.accessGrant.update({
      where: { id: grantId },
      data: { revokedAt: new Date() },
    });
    await this.prisma.ndaAgreement.update({
      where: { id: grant.agreementId },
      data: { status: "REVOKED", revokedAt: new Date() },
    });
    await this.audit.write({
      actorId: student.id,
      action: "GRANT_REVOKED",
      resourceType: "access_grant",
      resourceId: grantId,
    });
    return { revoked: true };
  }

  private async renderPdf(body: string, signerName: string, hash: string): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const text = `${body}\n\nSigned by: ${signerName}\nSHA-256: ${hash}\n`;
    page.drawText(text.slice(0, 1800), { x: 40, y: 780, size: 9, font, maxWidth: 515, lineHeight: 11 });
    return pdf.save();
  }
}
