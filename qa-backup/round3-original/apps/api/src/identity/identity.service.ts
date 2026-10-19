import { AuthProvider, UserRole, type User } from "@prisma/client";
import { Injectable } from "@nestjs/common";
import { ApiError } from "../common/api-error";
import { PrismaService } from "../common/prisma.service";
import { RedisService } from "../common/redis.service";
import type { AccessClaims } from "../auth/jwt.verifier";
import type { AuthedUser } from "../auth/auth.types";

const userSelect = {
  id: true,
  cognitoSub: true,
  email: true,
  phoneE164: true,
  handle: true,
  displayName: true,
  avatarKey: true,
  bannerKey: true,
  role: true,
  status: true,
  profileComplete: true,
  lastAuthProvider: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  studentProfile: { select: { university: true, headline: true, city: true, graduationYear: true, bio: true } },
  recruiterProfile: {
    select: { orgId: true, title: true, org: { select: { id: true, name: true, slug: true, status: true } } },
  },
} as const;

@Injectable()
export class IdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async upsertFromClaims(
    claims: AccessClaims,
    meta: { ip?: string; userAgent?: string },
  ): Promise<AuthedUser> {
    const provider = detectProvider(claims);
    const email = claims.email?.toLowerCase() || null;
    const phone = claims.phone_number || null;
    if (!email && !phone) {
      throw ApiError.badRequest("IDENTITY_MISSING", "Token must include email or phone");
    }

    let existing = await this.prisma.user.findUnique({
      where: { cognitoSub: claims.sub },
      select: userSelect,
    });
    if (!existing && email) {
      existing = await this.prisma.user.findUnique({
        where: { email },
        select: userSelect,
      });
    }

    if (existing) {
      const updated = await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          cognitoSub: claims.sub,
          lastLoginAt: new Date(),
          lastAuthProvider: provider,
          displayName: claims.name?.slice(0, 80) || existing.displayName,
        },
        select: userSelect,
      });
      return updated as AuthedUser;
    }

    const handle = await this.allocateHandle(claims);
    const created = await this.prisma.user.create({
      data: {
        cognitoSub: claims.sub,
        email,
        phoneE164: phone,
        handle,
        displayName: claims.name?.slice(0, 80) || null,
        lastAuthProvider: provider,
        lastLoginAt: new Date(),
      },
      select: userSelect,
    });

    if (claims.picture && provider !== AuthProvider.PHONE) {
      await this.prisma.outboxEvent.create({
        data: {
          topic: "media.avatar_copy",
          payload: { userId: created.id, pictureUrl: claims.picture },
        },
      });
    }

    void meta;
    return created as AuthedUser;
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: userSelect });
    if (!user) throw ApiError.notFound();
    return this.serializeMe(user);
  }

  async upsertProfile(
    user: User,
    input: {
      role?: UserRole;
      handle?: string;
      displayName?: string;
      university?: string;
      graduationYear?: number;
      headline?: string;
      bio?: string;
      city?: string;
      orgName?: string;
      orgSlug?: string;
      title?: string;
    },
  ) {
    if (input.role === UserRole.PLATFORM_ADMIN && user.role !== UserRole.PLATFORM_ADMIN) {
      throw ApiError.forbidden("FORBIDDEN", "Cannot self-assign admin");
    }
    if (input.role && user.role && user.role !== input.role && user.role !== UserRole.PLATFORM_ADMIN) {
      throw ApiError.conflict("ROLE_LOCKED", "Role cannot be changed after onboarding");
    }
    if (input.handle && !/^[a-z0-9._]{3,30}$/.test(input.handle)) {
      throw ApiError.badRequest("HANDLE_INVALID", "Handle must be 3-30 chars: a-z, 0-9, . _");
    }

    const role = input.role ?? user.role;
    const updated = await this.prisma.$transaction(async (tx) => {
      if (role === UserRole.STUDENT) {
        await tx.studentProfile.upsert({
          where: { userId: user.id },
          update: {
            university: input.university,
            universityNormalized: input.university?.trim().toLowerCase() || null,
            graduationYear: input.graduationYear,
            headline: input.headline,
            bio: input.bio,
            city: input.city,
          },
          create: {
            userId: user.id,
            university: input.university,
            universityNormalized: input.university?.trim().toLowerCase() || null,
            graduationYear: input.graduationYear,
            headline: input.headline,
            bio: input.bio,
            city: input.city,
          },
        });
      }
      if (role === UserRole.RECRUITER) {
        if (!input.orgName && !user.role) {
          throw ApiError.badRequest("ORG_REQUIRED", "Recruiters must provide an organization");
        }
        let orgId = (await tx.recruiterProfile.findUnique({ where: { userId: user.id } }))?.orgId;
        if (!orgId) {
          const slug = (input.orgSlug || slugify(input.orgName || "org")).slice(0, 40);
          const org = await tx.organization.upsert({
            where: { slug },
            update: { name: input.orgName || slug },
            create: { name: input.orgName || slug, slug },
          });
          orgId = org.id;
        }
        await tx.recruiterProfile.upsert({
          where: { userId: user.id },
          update: { title: input.title },
          create: { userId: user.id, orgId, title: input.title },
        });
      }

      const displayName = input.displayName ?? user.displayName;
      const handle = input.handle ?? user.handle;
      const nextRole = role ?? user.role;
      const profileComplete = Boolean(
        nextRole && displayName && handle && (nextRole === UserRole.PLATFORM_ADMIN || nextRole === UserRole.STUDENT || nextRole === UserRole.RECRUITER),
      );

      return tx.user.update({
        where: { id: user.id },
        data: {
          role: nextRole,
          handle,
          displayName,
          profileComplete,
        },
        select: userSelect,
      });
    });

    await this.redis.del(`user:sub:${user.cognitoSub}`, `user:${user.id}`);
    return this.serializeMe(updated);
  }

  async publicCard(id: string, viewerId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        handle: true,
        displayName: true,
        avatarKey: true,
        bannerKey: true,
        role: true,
        status: true,
        studentProfile: { select: { university: true, headline: true, city: true, graduationYear: true, bio: true } },
        recruiterProfile: { select: { title: true, org: { select: { name: true, slug: true } } } },
        _count: { select: { videos: { where: { status: "READY", deletedAt: null } }, vaultAssets: true } },
      },
    });
    if (!user || user.status !== "ACTIVE") throw ApiError.notFound();
    const isFollowing =
      viewerId && viewerId !== id
        ? Boolean(
            await this.prisma.follow.findUnique({
              where: { followerId_followeeId: { followerId: viewerId, followeeId: id } },
              select: { followerId: true },
            }),
          )
        : false;
    return {
      id: user.id,
      isFollowing,
      handle: user.handle,
      displayName: user.displayName,
      avatarKey: user.avatarKey,
      bannerKey: user.bannerKey,
      role: user.role,
      student: user.studentProfile,
      recruiter: user.recruiterProfile
        ? { title: user.recruiterProfile.title, org: user.recruiterProfile.org }
        : null,
      hasVault: user._count.vaultAssets > 0,
      videoCount: user._count.videos,
    };
  }

  async getOrg(id: string) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw ApiError.notFound();
    return org;
  }

  serializeMe(user: AuthedUser | Awaited<ReturnType<PrismaService["user"]["findUnique"]>>) {
    return user;
  }

  private async allocateHandle(claims: AccessClaims): Promise<string> {
    const base = slugify(claims.name || claims.email?.split("@")[0] || `u${claims.sub.slice(-8)}`);
    for (let i = 0; i < 8; i++) {
      const candidate = (i === 0 ? base : `${base}${i}`).slice(0, 30);
      const taken = await this.prisma.user.findUnique({ where: { handle: candidate }, select: { id: true } });
      if (!taken) return candidate;
    }
    return `u${claims.sub.replace(/[^a-z0-9]/gi, "").slice(-12).toLowerCase()}`.slice(0, 30);
  }
}

function detectProvider(claims: AccessClaims): AuthProvider {
  const name = claims.identities?.[0]?.providerName?.toLowerCase() ?? "";
  if (name.includes("google")) return AuthProvider.GOOGLE;
  if (name.includes("apple")) return AuthProvider.APPLE;
  if (claims.phone_number && !claims.email) return AuthProvider.PHONE;
  if (name.includes("phone") || claims.phone_number) return AuthProvider.PHONE;
  return AuthProvider.GOOGLE;
}

function slugify(value: string): string {
  const s = value
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, "")
    .replace(/^\.+/, "")
    .slice(0, 24);
  return s.length >= 3 ? s : `user${s}`.padEnd(3, "x");
}
