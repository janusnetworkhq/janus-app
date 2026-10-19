export type AuthMode = "local" | "cognito" | "otp";
export type MediaDriver = "s3" | "noop" | "cloudinary";
export type TranscodeDriver = "mock" | "ffmpeg";
export type ModerationDriver = "noop" | "rekognition" | "manual";
export type QueueMode = "inline" | "sqs";
export type PushDriver = "log" | "expo";

function buildDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const host = process.env.PGHOST;
  if (!host) return "";
  const user = process.env.PGUSER ?? "janus";
  const password = encodeURIComponent(process.env.PGPASSWORD ?? "");
  const port = process.env.PGPORT ?? "5432";
  const db = process.env.PGDATABASE ?? "janus";
  return `postgresql://${user}:${password}@${host}:${port}/${db}?schema=public`;
}

function cloudinaryUrlPart(part: "name" | "key" | "secret"): string {
  const raw = process.env.CLOUDINARY_URL ?? "";
  const m = raw.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  if (!m) return "";
  return (part === "key" ? m[1] : part === "secret" ? m[2] : m[3]) ?? "";
}

function buildRedisUrl(): string {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  const host = process.env.REDIS_HOST;
  if (!host) return "";
  return `redis://${host}:6379/0`;
}

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

export const appConfig = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProd: process.env.NODE_ENV === "production",
  port: num("PORT", 3000),
  databaseUrl: buildDatabaseUrl(),
  redisUrl: buildRedisUrl(),
  authMode: (process.env.AUTH_MODE ?? "local") as AuthMode,
  localJwtSecret: process.env.LOCAL_JWT_SECRET ?? "janus-local-dev-only-change-me",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  resendFromEmail: process.env.RESEND_FROM_EMAIL ?? "Janus <onboarding@resend.dev>",
  cognitoRegion: process.env.COGNITO_REGION ?? process.env.AWS_REGION ?? "ap-south-1",
  cognitoUserPoolId: process.env.COGNITO_USER_POOL_ID ?? "",
  cognitoClientId: process.env.COGNITO_CLIENT_ID ?? "",
  awsRegion: process.env.AWS_REGION ?? "ap-south-1",
  awsEndpoint: process.env.AWS_ENDPOINT_URL || undefined,
  s3UploadsBucket: process.env.S3_UPLOADS_BUCKET ?? "janus-uploads",
  s3PublicBucket: process.env.S3_PUBLIC_MEDIA_BUCKET ?? "janus-public-media",
  s3VaultBucket: process.env.S3_VAULT_BUCKET ?? "janus-vault",
  sqsTranscodeUrl: process.env.SQS_MEDIA_TRANSCODE_URL ?? "",
  sqsNdaUrl: process.env.SQS_NDA_LIFECYCLE_URL ?? "",
  sqsNotifyUrl: process.env.SQS_NOTIFY_SEND_URL ?? "",
  mediaPublicBase:
    process.env.MEDIA_PUBLIC_BASE ?? "http://localhost:4566/janus-public-media",
  mediaDriver: (process.env.MEDIA_DRIVER ?? "s3") as MediaDriver,
  transcodeDriver: (process.env.TRANSCODE_DRIVER ?? "mock") as TranscodeDriver,
  moderationDriver: (process.env.MODERATION_DRIVER ?? "noop") as ModerationDriver,
  workersEnabled: process.env.WORKERS_ENABLED !== "false",
  /**
   * inline: run job handlers in-process (local dev / LocalStack, nothing else consumes SQS).
   * sqs: publish to SQS; `pnpm --filter @janus/api worker` consumes every queue.
   */
  queueMode: (process.env.QUEUE_MODE ??
    (process.env.AWS_ENDPOINT_URL || !process.env.SQS_MEDIA_TRANSCODE_URL ? "inline" : "sqs")) as QueueMode,
  pushDriver: (process.env.PUSH_DRIVER ?? "log") as PushDriver,
  expoPushUrl: process.env.EXPO_PUSH_URL ?? "https://exp.host/--/api/v2/push/send",
  expoAccessToken: process.env.EXPO_ACCESS_TOKEN ?? "",
  ndaSweepIntervalSec: num("NDA_SWEEP_INTERVAL_SEC", 300),
  ffmpegPath: process.env.FFMPEG_PATH ?? "ffmpeg",
  ffprobePath: process.env.FFPROBE_PATH ?? "ffprobe",
  avatarCopyHosts: (process.env.AVATAR_COPY_ALLOWED_HOSTS ?? "googleusercontent.com,graph.facebook.com,fbcdn.net")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  sessionTokenTtl: process.env.SESSION_TOKEN_TTL ?? "24h",
  /**
   * TEST ONLY: explicit allowlist for the fixed OTP (see TEST_OTP_FIXED_CODE).
   * Effective only for @janus.test addresses - see isTestOtpAccount().
   */
  testOtpEmails: (process.env.TEST_OTP_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME ?? cloudinaryUrlPart("name"),
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY ?? cloudinaryUrlPart("key"),
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET ?? cloudinaryUrlPart("secret"),
  cloudinaryStreamingProfile: process.env.CLOUDINARY_STREAMING_PROFILE ?? "full_hd",
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:3000,http://localhost:8081,http://localhost:3001")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  limits: {
    jsonBytes: 1_000_000,
    feedVideoBytes: 200 * 1024 * 1024,
    vaultBytes: 500 * 1024 * 1024,
    feedDurationMs: 90_000,
    presignTtlSec: 900,
    vaultUrlTtlSec: 600,
    grantTtlDays: 7,
    ndaExpiryHours: 72,
    globalPerMin: 120,
    ndaPerDay: 10,
    vaultPerHour: 30,
    uploadPerHour: 20,
    likePerMin: 60,
  },
};

export function assertProdConfig(): void {
  const testOtp = effectiveTestOtpEmails();
  if (testOtp.length > 0) {
    console.warn(
      `[config] TEST OTP ENABLED for ${testOtp.join(", ")}: fixed code accepted for these @janus.test test accounts only. Remove TEST_OTP_EMAILS to disable.`,
    );
  }
  const ignored = appConfig.testOtpEmails.filter((e) => !e.endsWith("@janus.test"));
  if (ignored.length > 0) {
    console.warn(`[config] TEST_OTP_EMAILS entries ignored (not @janus.test): ${ignored.join(", ")}`);
  }
  if (!appConfig.isProd) return;
  if (!process.env.LOCAL_JWT_SECRET || appConfig.localJwtSecret === "janus-local-dev-only-change-me" || appConfig.localJwtSecret.length < 32) {
    throw new Error("LOCAL_JWT_SECRET must be set to a strong (>=32 char) non-default value in production");
  }
  if (appConfig.authMode !== "cognito" && appConfig.authMode !== "otp") {
    throw new Error("AUTH_MODE must be cognito or otp in production (local enables dev tokens)");
  }
  if (appConfig.authMode === "cognito" && (!appConfig.cognitoUserPoolId || !appConfig.cognitoClientId)) {
    throw new Error("Cognito pool/client required in production");
  }
  if (appConfig.authMode === "otp" && !appConfig.resendApiKey) {
    // Degraded but intentional (2026-10-19): OTP codes fall back to the server log only
    // (EmailService), never to an API response. Real email needs RESEND_API_KEY.
    console.warn("[config] AUTH_MODE=otp without RESEND_API_KEY: OTP codes will be LOGGED ONLY, not emailed. Set RESEND_API_KEY for production email delivery.");
  }
  if (!appConfig.databaseUrl) {
    throw new Error("DATABASE_URL required");
  }
  if (!appConfig.redisUrl) {
    throw new Error("REDIS_URL or REDIS_HOST required in production");
  }
  if (appConfig.mediaDriver === "cloudinary") {
    if (!appConfig.cloudinaryCloudName || !appConfig.cloudinaryApiKey || !appConfig.cloudinaryApiSecret) {
      throw new Error("CLOUDINARY_CLOUD_NAME/CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET (or CLOUDINARY_URL) required when MEDIA_DRIVER=cloudinary");
    }
  } else {
    if (appConfig.awsRegion !== "ap-south-1") {
      throw new Error("Production region must be ap-south-1");
    }
    if (appConfig.awsEndpoint) {
      throw new Error("AWS_ENDPOINT_URL must not be set in production");
    }
    if (appConfig.transcodeDriver === "mock") {
      throw new Error("TRANSCODE_DRIVER=mock produces unplayable media; use ffmpeg in production");
    }
  }
}

/** Fixed code accepted ONLY for allowlisted @janus.test test accounts. Never a secret. */
export const TEST_OTP_FIXED_CODE = "123456";

/**
 * A test account must satisfy BOTH conditions:
 *  1. its email is listed in TEST_OTP_EMAILS, and
 *  2. it ends with @janus.test (hard guard - a stray env entry for a real domain does nothing).
 */
export function isTestOtpAccount(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized.endsWith("@janus.test")) return false;
  return appConfig.testOtpEmails.includes(normalized);
}

export function effectiveTestOtpEmails(): string[] {
  return appConfig.testOtpEmails.filter((e) => e.endsWith("@janus.test"));
}
