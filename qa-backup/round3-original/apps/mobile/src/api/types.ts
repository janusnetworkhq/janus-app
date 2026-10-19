export type UserRole = "STUDENT" | "RECRUITER" | "PLATFORM_ADMIN";

export type ApiErrorBody = {
  error: { code: string; message: string; requestId: string };
};

export type Me = {
  id: string;
  cognitoSub: string;
  email: string | null;
  phoneE164: string | null;
  handle: string;
  displayName: string | null;
  avatarKey: string | null;
  bannerKey: string | null;
  role: UserRole | null;
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
  profileComplete: boolean;
  studentProfile: {
    university: string | null;
    headline: string | null;
    city: string | null;
    graduationYear: number | null;
    bio: string | null;
  } | null;
  recruiterProfile: {
    orgId: string;
    title: string | null;
    org: { id: string; name: string; slug: string; status: string } | null;
  } | null;
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
  isFollowing?: boolean;
};

export type FeedItem = {
  id: string;
  caption: string | null;
  durationMs: number | null;
  status: string;
  hasVault: boolean;
  likeCount: number;
  commentCount: number;
  bookmarkCount: number;
  liked?: boolean;
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

export type CommentItem = {
  id: string;
  videoId: string;
  body: string;
  createdAt: string;
  user: {
    id: string;
    handle: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
};

export type CommentsPage = { items: CommentItem[]; nextCursor: string | null };

export type FeedPage = { items: FeedItem[]; nextCursor: string | null };

export type UploadTicket = {
  uploadId: string;
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  kind: string;
};

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
  createdAt: string;
  expiresAt: string;
  studentId: string;
  recruiterId: string;
  videoId: string | null;
  agreement?: { id: string; signedAt: string } | null;
  recruiter?: {
    id: string;
    handle: string;
    displayName: string | null;
    recruiterProfile?: { title: string | null; org: { name: string } | null } | null;
  };
  student?: { id: string; handle: string; displayName: string | null };
  template?: { title: string; version: number; contentSha256: string };
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
  expiresAt: string;
  watermarkToken: string;
  contentType: string;
};
