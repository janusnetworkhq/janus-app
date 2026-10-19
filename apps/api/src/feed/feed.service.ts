import { Injectable } from "@nestjs/common";
import { ApiError } from "../common/api-error";
import { PrismaService } from "../common/prisma.service";
import { RateLimitService } from "../common/rate-limit.service";
import { RedisService } from "../common/redis.service";
import { StorageService } from "../common/storage.service";
import type { AuthedUser } from "../auth/auth.types";
import { MediaService } from "../media/media.service";

const HALF_LIFE_MS = 18 * 3600 * 1000;

@Injectable()
export class FeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly media: MediaService,
    private readonly rateLimit: RateLimitService,
    private readonly storage: StorageService,
  ) {}

  async timeline(user: AuthedUser, cursor?: string, limit = 10, university?: string) {
    const take = Math.min(Math.max(limit, 1), 20);
    const ids = await this.rankedIds(user, university);
    let start = 0;
    if (cursor) {
      const idx = ids.indexOf(cursor);
      start = idx === -1 ? 0 : idx + 1;
    }
    const page = ids.slice(start, start + take);
    if (page.length === 0) return { items: [], nextCursor: null };

    const videos = await this.prisma.video.findMany({
      where: { id: { in: page }, deletedAt: null, status: "READY" },
      include: {
        author: {
          select: {
            id: true,
            handle: true,
            displayName: true,
            avatarKey: true,
            studentProfile: { select: { headline: true, university: true } },
          },
        },
      },
    });
    const order = new Map(page.map((id, i) => [id, i]));
    videos.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    const userLikes = await this.prisma.videoLike.findMany({
      where: { userId: user.id, videoId: { in: page } },
      select: { videoId: true },
    });
    const likedSet = new Set(userLikes.map((l) => l.videoId));
    const items = videos.map((v) => this.media.serializeVideo(v, likedSet.has(v.id)));
    const nextCursor = page.length === take ? page[page.length - 1] : null;
    return { items, nextCursor };
  }

  async like(user: AuthedUser, videoId: string) {
    await this.rateLimit.hitLike(user.id);
    const created = await this.prisma.videoLike.createMany({
      data: { userId: user.id, videoId },
      skipDuplicates: true,
    });
    if (created.count > 0) {
      await this.prisma.video.update({ where: { id: videoId }, data: { likeCount: { increment: 1 } } });
      await this.redis.del(`video:${videoId}`);
    }
    return { liked: true };
  }

  async unlike(user: AuthedUser, videoId: string) {
    const deleted = await this.prisma.videoLike.deleteMany({ where: { userId: user.id, videoId } });
    if (deleted.count > 0) {
      await this.prisma.video.update({ where: { id: videoId }, data: { likeCount: { decrement: 1 } } });
      await this.redis.del(`video:${videoId}`);
    }
    return { liked: false };
  }

  async comment(user: AuthedUser, videoId: string, body: string) {
    const trimmed = body?.trim();
    if (!trimmed || trimmed.length === 0) throw ApiError.badRequest("COMMENT_EMPTY", "Comment cannot be empty");
    if (trimmed.length > 500) throw ApiError.badRequest("COMMENT_LENGTH", "Max 500 characters");
    const comment = await this.prisma.$transaction(async (tx) => {
      const row = await tx.comment.create({
        data: { userId: user.id, videoId, body: trimmed },
        include: {
          user: {
            select: { id: true, handle: true, displayName: true, avatarKey: true },
          },
        },
      });
      await tx.video.update({ where: { id: videoId }, data: { commentCount: { increment: 1 } } });
      return row;
    });
    await this.redis.del(`video:${videoId}`);
    return {
      id: comment.id,
      videoId: comment.videoId,
      body: comment.body,
      createdAt: comment.createdAt,
      user: {
        id: comment.user.id,
        handle: comment.user.handle,
        displayName: comment.user.displayName,
        avatarUrl: comment.user.avatarKey ? this.storage.publicUrl(comment.user.avatarKey) : null,
      },
    };
  }

  async listComments(videoId: string, cursor?: string, limit = 20) {
    const take = Math.min(limit, 50);
    const items = await this.prisma.comment.findMany({
      where: {
        videoId,
        deletedAt: null,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
      include: { user: { select: { id: true, handle: true, displayName: true, avatarKey: true } } },
    });
    return {
      items: items.map((c) => ({
        id: c.id,
        videoId: c.videoId,
        body: c.body,
        createdAt: c.createdAt,
        user: {
          id: c.user.id,
          handle: c.user.handle,
          displayName: c.user.displayName,
          avatarUrl: c.user.avatarKey ? this.storage.publicUrl(c.user.avatarKey) : null,
        },
      })),
      nextCursor: items.length === take ? items[items.length - 1]?.createdAt.toISOString() : null,
    };
  }

  async follow(user: AuthedUser, followeeId: string) {
    if (user.id === followeeId) throw ApiError.badRequest("SELF_FOLLOW", "Cannot follow yourself");
    await this.prisma.follow.upsert({
      where: { followerId_followeeId: { followerId: user.id, followeeId } },
      update: {},
      create: { followerId: user.id, followeeId },
    });
    await this.redis.del(`feed:${user.id}`);
    return { following: true };
  }

  async unfollow(user: AuthedUser, followeeId: string) {
    await this.prisma.follow.deleteMany({ where: { followerId: user.id, followeeId } });
    await this.redis.del(`feed:${user.id}`);
    return { following: false };
  }

  async bookmark(user: AuthedUser, videoId: string) {
    const created = await this.prisma.bookmark.createMany({
      data: { userId: user.id, videoId },
      skipDuplicates: true,
    });
    if (created.count > 0) {
      await this.prisma.video.update({ where: { id: videoId }, data: { bookmarkCount: { increment: 1 } } });
    }
    return { saved: true };
  }

  async unbookmark(user: AuthedUser, videoId: string) {
    const deleted = await this.prisma.bookmark.deleteMany({ where: { userId: user.id, videoId } });
    if (deleted.count > 0) {
      await this.prisma.video.update({
        where: { id: videoId },
        data: { bookmarkCount: { decrement: 1 } },
      });
    }
    return { saved: false };
  }

  async myBookmarks(user: AuthedUser) {
    const rows = await this.prisma.bookmark.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        video: {
          include: {
            author: {
              select: {
                id: true,
                handle: true,
                displayName: true,
                avatarKey: true,
                studentProfile: { select: { headline: true, university: true } },
              },
            },
          },
        },
      },
    });
    return { items: rows.filter((r) => !r.video.deletedAt).map((r) => this.media.serializeVideo(r.video)) };
  }

  async impressions(user: AuthedUser, videoIds: string[]) {
    const ids = [...new Set(videoIds)].slice(0, 20);
    if (ids.length === 0) return { ok: true };
    await this.prisma.$transaction(
      ids.map((videoId) =>
        this.prisma.feedImpression.upsert({
          where: { userId_videoId: { userId: user.id, videoId } },
          update: { seenAt: new Date() },
          create: { userId: user.id, videoId },
        }),
      ),
    );
    return { ok: true };
  }

  async userVideos(authorId: string, cursor?: string, limit = 12) {
    const take = Math.min(limit, 24);
    const items = await this.prisma.video.findMany({
      where: {
        authorId,
        deletedAt: null,
        status: "READY",
        visibility: "PUBLIC_FEED",
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        author: {
          select: {
            id: true,
            handle: true,
            displayName: true,
            avatarKey: true,
            studentProfile: { select: { headline: true, university: true } },
          },
        },
      },
    });
    return {
      items: items.map((v) => this.media.serializeVideo(v)),
      nextCursor: items.length === take ? items[items.length - 1]?.createdAt.toISOString() : null,
    };
  }

  private async rankedIds(user: AuthedUser, university?: string): Promise<string[]> {
    const uni = university?.trim().toLowerCase();
    const cacheKey = `feed:${user.id}:${uni ?? "all"}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as string[];

    const lockKey = `lock:feed:${user.id}`;
    const gotLock = await this.redis.setNx(lockKey, "1", 2);
    if (!gotLock) {
      const retry = await this.redis.get(cacheKey);
      if (retry) return JSON.parse(retry) as string[];
    }

    const seenSince = new Date(Date.now() - 48 * 3600 * 1000);

    const candidateSelect = {
      id: true,
      createdAt: true,
      likeCount: true,
      commentCount: true,
      bookmarkCount: true,
      hasVault: true,
      authorId: true,
      author: { select: { studentProfile: { select: { universityNormalized: true } } } },
    } as const;

    // 1. Fetch unseen videos first
    const unseenCandidates = await this.prisma.video.findMany({
      where: {
        status: "READY",
        visibility: "PUBLIC_FEED",
        deletedAt: null,
        moderationStatus: "CLEAR",
        impressions: { none: { userId: user.id, seenAt: { gte: seenSince } } },
        ...(uni
          ? { author: { studentProfile: { universityNormalized: uni } } }
          : {}),
      },
      select: candidateSelect,
      take: 200,
      orderBy: { createdAt: "desc" },
    });

    // 2. If fewer than 20 unseen videos, fill remaining slots with top videos so the feed is always rich!
    let seenCandidates: typeof unseenCandidates = [];
    if (unseenCandidates.length < 20) {
      const unseenIds = new Set(unseenCandidates.map((c) => c.id));
      seenCandidates = await this.prisma.video.findMany({
        where: {
          status: "READY",
          visibility: "PUBLIC_FEED",
          deletedAt: null,
          moderationStatus: "CLEAR",
          ...(unseenIds.size > 0 ? { id: { notIn: Array.from(unseenIds) } } : {}),
          ...(uni
            ? { author: { studentProfile: { universityNormalized: uni } } }
            : {}),
        },
        select: candidateSelect,
        take: 50,
        orderBy: [{ likeCount: "desc" }, { createdAt: "desc" }],
      });
    }

    let candidates = [...unseenCandidates, ...seenCandidates];

    // 3. Fallback: If still empty (e.g. uni had 0 videos), load global discovery videos
    if (candidates.length === 0) {
      candidates = await this.prisma.video.findMany({
        where: {
          status: "READY",
          visibility: "PUBLIC_FEED",
          deletedAt: null,
          moderationStatus: "CLEAR",
        },
        select: candidateSelect,
        take: 50,
        orderBy: [{ likeCount: "desc" }, { createdAt: "desc" }],
      });
    }

    const following = await this.prisma.follow.findMany({
      where: { followerId: user.id },
      select: { followeeId: true },
    });
    const followSet = new Set(following.map((f) => f.followeeId));
    const viewerUni = user.studentProfile?.university?.toLowerCase();

    const scored = candidates
      .map((v) => ({
        id: v.id,
        score: rank({
          createdAt: v.createdAt,
          likes: v.likeCount,
          comments: v.commentCount,
          saves: v.bookmarkCount,
          following: followSet.has(v.authorId),
          universityMatch: Boolean(
            viewerUni && v.author.studentProfile?.universityNormalized === viewerUni,
          ),
          hasVault: v.hasVault,
        }),
      }))
      .sort((a, b) => b.score - a.score)
      .map((s) => s.id);

    if (scored.length > 0) {
      await this.redis.set(cacheKey, JSON.stringify(scored), 90);
    }
    return scored;
  }
}

export function rank(input: {
  createdAt: Date;
  likes: number;
  comments: number;
  saves: number;
  following: boolean;
  universityMatch: boolean;
  hasVault: boolean;
}): number {
  const age = Date.now() - input.createdAt.getTime();
  const recency = Math.pow(0.5, age / HALF_LIFE_MS);
  const engagement = Math.log1p(input.likes + input.comments + input.saves);
  return (
    0.45 * recency +
    0.25 * Math.min(engagement / 8, 1) +
    0.15 * (input.following ? 1 : 0) +
    0.1 * (input.universityMatch ? 1 : 0) +
    0.05 * (input.hasVault ? 1 : 0)
  );
}
