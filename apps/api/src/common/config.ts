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
      `[config] TEST OTP ENABLED for ${testOtp.join(", ")}: fixed code accepted for matching @janus.test accounts only. Unset TEST_OTP_EMAILS to disable.`,
    );
  }
  const ignored = appConfig.testOtpEmails.filter((e) => compileTestOtpEntry(e) === null);
  if (ignored.length > 0) {
    console.warn(`[config] TEST_OTP_EMAILS entries ignored (not a valid @janus.test address/pattern): ${ignored.join(", ")}`);
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

/** Fixed code accepted ONLY for test-OTP @janus.test accounts. Never a secret. */
export const TEST_OTP_FIXED_CODE = "123456";

/** Hard guard: the fixed code can only ever apply to this domain, whatever the env says. */
export const TEST_OTP_DOMAIN = "@janus.test";

/**
 * Built-in patterns, active ONLY while test OTP is enabled (TEST_OTP_EMAILS non-empty).
 * Covers qa.student / qa.recruiter / qa.admin and the seeded qa.student01..10 accounts
 * without growing the env list. Still subject to the @janus.test guard.
 */
export const DEFAULT_TEST_OTP_PATTERNS: readonly string[] = ["qa.*@janus.test"];

const LOCAL_PART = /^[a-z0-9._+-]+$/;
const PATTERN_LOCAL_PART = /^[a-z0-9._+*-]+$/;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Compiles one allowlist entry: an exact address ("qa.admin@janus.test") or a glob whose
 * "*" may appear only in the local part ("qa.*@janus.test"); "*" never matches "@".
 * Returns null for anything outside @janus.test or with an invalid local part.
 */
export function compileTestOtpEntry(entry: string): RegExp | null {
  const e = entry.trim().toLowerCase();
  if (!e.endsWith(TEST_OTP_DOMAIN)) return null;
  const local = e.slice(0, -TEST_OTP_DOMAIN.length);
  if (!local || !PATTERN_LOCAL_PART.test(local)) return null;
  const body = local.split("*").map(escapeRe).join("[a-z0-9._+-]*");
  return new RegExp(`^${body}${escapeRe(TEST_OTP_DOMAIN)}$`);
}

let matcherCache: { key: string; matchers: RegExp[] } | null = null;
function testOtpMatchers(): RegExp[] {
  const entries = appConfig.testOtpEmails.length > 0 ? [...appConfig.testOtpEmails, ...DEFAULT_TEST_OTP_PATTERNS] : [];
  const key = entries.join(",");
  if (matcherCache?.key !== key) {
    matcherCache = { key, matchers: entries.map(compileTestOtpEntry).filter((r): r is RegExp => r !== null) };
  }
  return matcherCache.matchers;
}

/**
 * The fixed code applies only when ALL hold:
 *  1. test OTP is enabled: TEST_OTP_EMAILS is non-empty (unset/empty disables it entirely);
 *  2. the address is a well-formed @janus.test address (hard guard - real domains never match);
 *  3. it matches an exact entry or glob in TEST_OTP_EMAILS, or a built-in DEFAULT_TEST_OTP_PATTERNS.
 * Request-first and the attempt lockout are enforced by the verify endpoint, not here.
 */
export function isTestOtpAccount(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized.endsWith(TEST_OTP_DOMAIN)) return false;
  const parts = normalized.split("@");
  const [local, domain] = parts;
  if (parts.length !== 2 || local === undefined || domain === undefined || !LOCAL_PART.test(local)) return false;
  return testOtpMatchers().some((re) => re.test(normalized));
}

/** Effective (domain-valid) entries, for the boot log. */
export function effectiveTestOtpEmails(): string[] {
  if (appConfig.testOtpEmails.length === 0) return [];
  return [...appConfig.testOtpEmails, ...DEFAULT_TEST_OTP_PATTERNS].filter((e) => compileTestOtpEntry(e) !== null);
}
