export type UserRole = "STUDENT" | "RECRUITER" | "PLATFORM_ADMIN";

export type Me = {
  id: string;
  email: string | null;
  handle: string;
  displayName: string | null;
  avatarKey: string | null;
  bannerKey: string | null;
  role: UserRole | null;
  status: string;
  profileComplete: boolean;
  studentProfile: {
    university: string | null;
    headline: string | null;
    city: string | null;
    bio: string | null;
  } | null;
  recruiterProfile: {
    orgId: string;
    title: string | null;
    org: { id: string; name: string; slug: string; status: string } | null;
  } | null;
};

export type FeedItem = {
  id: string;
  caption: string | null;
  durationMs: number | null;
  status: string;
  hasVault: boolean;
  likeCount: number;
  commentCount: number;
  bookmarkCount?: number;
  hlsUrl: string | null;
  posterUrl: string | null;
  createdAt: string;
  author: {
    id: string;
    handle: string;
    displayName: string | null;
    avatarUrl: string | null;
    headline: string | null;
    university: string | null;
  };
};

export type FeedPage = { items: FeedItem[]; nextCursor: string | null };

export type NdaTemplate = {
  id: string;
  version: number;
  title: string;
  body: string;
  contentSha256: string;
};

export type NdaRequest = {
  id: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED";
  reason: string | null;
  createdAt: string | Date;
  expiresAt: string | Date;
  studentId: string;
  recruiterId: string;
  videoId: string | null;
  student?: { id: string; handle: string; displayName: string | null };
};

export type VaultAsset = {
  id: string;
  kind: string;
  originalName: string | null;
  contentType: string;
  byteSize: number;
  createdAt: string;
};

export type Playback = {
  url: string;
  expiresAt: string | Date;
  watermarkToken: string;
  watermarkText?: string;
  originalName?: string;
  contentType: string;
};

export type PublicCard = {
  id: string;
  handle: string;
  displayName: string | null;
  avatarKey: string | null;
  bannerKey: string | null;
  role: UserRole | null;
  student: Me["studentProfile"];
  recruiter: { title: string | null; org: { name: string; slug: string } | null } | null;
  hasVault: boolean;
  videoCount: number;
};

export type AdminVideo = {
  id: string;
  status: string;
  moderationStatus: string;
  caption: string | null;
  createdAt: string;
  authorId: string;
  likeCount: number;
  deletedAt?: string | null;
  hiddenByAdminAt?: string | null;
  author?: { handle: string; displayName: string | null };
};

export type ModerationItem = {
  id: string;
  status: string;
  moderationStatus: string;
  moderationLabels: unknown;
  caption: string | null;
  createdAt: string;
  hlsMasterKey: string | null;
  posterKey: string | null;
  author: { id: string; handle: string; displayName: string | null };
};

export type AdminUser = {
  id: string;
  handle: string;
  email: string | null;
  role: UserRole | null;
  status: string;
  createdAt: string;
};

export type AuditEvent = {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  actorId: string | null;
  createdAt: string;
  metadata: unknown;
};
