export type AuthMode = "local" | "cognito";
export type MediaDriver = "s3" | "noop";
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
  if (!appConfig.isProd) return;
  if (!process.env.LOCAL_JWT_SECRET || appConfig.localJwtSecret === "janus-local-dev-only-change-me" || appConfig.localJwtSecret.length < 32) {
    throw new Error("LOCAL_JWT_SECRET must be set to a strong (>=32 char) non-default value in production");
  }
  if (appConfig.authMode !== "cognito") {
    throw new Error("AUTH_MODE must be cognito in production");
  }
  if (!appConfig.cognitoUserPoolId || !appConfig.cognitoClientId) {
    throw new Error("Cognito pool/client required in production");
  }
  if (!appConfig.databaseUrl) {
    throw new Error("DATABASE_URL required");
  }
  if (!appConfig.redisUrl) {
    throw new Error("REDIS_URL or REDIS_HOST required in production");
  }
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
