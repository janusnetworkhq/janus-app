import { z } from "zod";

export const userRoleSchema = z.enum(["STUDENT", "RECRUITER", "PLATFORM_ADMIN"]);
export const userStatusSchema = z.enum(["ACTIVE", "SUSPENDED", "DELETED"]);
export const authProviderSchema = z.enum(["GOOGLE", "APPLE", "PHONE"]);
export const videoStatusSchema = z.enum(["PROCESSING", "READY", "FAILED", "HIDDEN"]);
export const uploadKindSchema = z.enum([
  "FEED_VIDEO",
  "VAULT_FILE",
  "VAULT_VIDEO",
  "AVATAR",
  "BANNER",
]);

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
  }),
});

export const cursorPageSchema = z.object({
  cursor: z.string().nullable(),
  limit: z.number().int().min(1).max(20).default(10),
});

export const feedCardSchema = z.object({
  id: z.string(),
  caption: z.string().nullable(),
  durationMs: z.number().int().nullable(),
  hlsUrl: z.string().url(),
  posterUrl: z.string().url().nullable(),
  hasVault: z.boolean(),
  likeCount: z.number().int().nonnegative(),
  commentCount: z.number().int().nonnegative(),
  author: z.object({
    id: z.string(),
    handle: z.string(),
    displayName: z.string().nullable(),
    avatarUrl: z.string().url().nullable(),
    headline: z.string().nullable(),
  }),
});

export type UserRole = z.infer<typeof userRoleSchema>;
export type VideoStatus = z.infer<typeof videoStatusSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export type FeedCard = z.infer<typeof feedCardSchema>;
