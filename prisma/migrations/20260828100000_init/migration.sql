-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('STUDENT', 'RECRUITER', 'PLATFORM_ADMIN');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "auth_provider" AS ENUM ('GOOGLE', 'APPLE', 'PHONE');

-- CreateEnum
CREATE TYPE "org_plan" AS ENUM ('FREE_PILOT', 'SAAS');

-- CreateEnum
CREATE TYPE "org_status" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "upload_kind" AS ENUM ('FEED_VIDEO', 'VAULT_FILE', 'VAULT_VIDEO', 'AVATAR', 'BANNER');

-- CreateEnum
CREATE TYPE "upload_status" AS ENUM ('CREATED', 'UPLOADED', 'CONSUMED', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "video_status" AS ENUM ('PROCESSING', 'READY', 'FAILED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "video_visibility" AS ENUM ('PUBLIC_FEED', 'UNLISTED');

-- CreateEnum
CREATE TYPE "moderation_status" AS ENUM ('PENDING', 'CLEAR', 'FLAGGED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "rendition_kind" AS ENUM ('HLS_540', 'HLS_720', 'HLS_1080', 'POSTER', 'PREVIEW');

-- CreateEnum
CREATE TYPE "vault_asset_kind" AS ENUM ('SCHEMATIC', 'CODE_ARCHIVE', 'DOCUMENT', 'HIGH_RES_VIDEO');

-- CreateEnum
CREATE TYPE "nda_request_status" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "agreement_status" AS ENUM ('SIGNED', 'REVOKED');

-- CreateEnum
CREATE TYPE "outbox_status" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "audit_action" AS ENUM ('ACCESS_GRANTED', 'ACCESS_DENIED', 'NDA_REQUESTED', 'NDA_DECIDED', 'NDA_SIGNED', 'NDA_REVOKED', 'VIDEO_HIDDEN', 'USER_SUSPENDED', 'USER_RESTORED', 'GRANT_REVOKED', 'VAULT_UPLOADED', 'PROFILE_UPDATED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "cognito_sub" VARCHAR(128) NOT NULL,
    "email" CITEXT,
    "phone_e164" VARCHAR(16),
    "handle" CITEXT NOT NULL,
    "display_name" VARCHAR(80),
    "avatar_key" VARCHAR(1024),
    "banner_key" VARCHAR(1024),
    "role" "user_role",
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "profile_complete" BOOLEAN NOT NULL DEFAULT false,
    "last_auth_provider" "auth_provider",
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "university" VARCHAR(160),
    "university_normalized" VARCHAR(160),
    "graduation_year" INTEGER,
    "headline" VARCHAR(160),
    "bio" VARCHAR(2000),
    "city" VARCHAR(80),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "slug" CITEXT NOT NULL,
    "plan" "org_plan" NOT NULL DEFAULT 'FREE_PILOT',
    "status" "org_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruiter_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "title" VARCHAR(120),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recruiter_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_id" VARCHAR(128) NOT NULL,
    "user_agent" VARCHAR(512),
    "ip_address" VARCHAR(45),
    "refresh_token_hash" CHAR(64),
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uploads" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" "upload_kind" NOT NULL,
    "status" "upload_status" NOT NULL DEFAULT 'CREATED',
    "s3_bucket" VARCHAR(63) NOT NULL,
    "s3_key" VARCHAR(1024) NOT NULL,
    "content_type" VARCHAR(128) NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "sha256" CHAR(64),
    "etag" VARCHAR(64),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "videos" (
    "id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "upload_id" TEXT,
    "status" "video_status" NOT NULL DEFAULT 'PROCESSING',
    "visibility" "video_visibility" NOT NULL DEFAULT 'PUBLIC_FEED',
    "moderation_status" "moderation_status" NOT NULL DEFAULT 'PENDING',
    "moderation_labels" JSONB,
    "caption" VARCHAR(2200),
    "duration_ms" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "hls_master_key" VARCHAR(1024),
    "poster_key" VARCHAR(1024),
    "preview_key" VARCHAR(1024),
    "watermark_text" VARCHAR(80),
    "transcode_job_id" VARCHAR(128),
    "failure_reason" VARCHAR(500),
    "has_vault" BOOLEAN NOT NULL DEFAULT false,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "bookmark_count" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_renditions" (
    "id" TEXT NOT NULL,
    "video_id" TEXT NOT NULL,
    "kind" "rendition_kind" NOT NULL,
    "s3_key" VARCHAR(1024) NOT NULL,
    "bitrate" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_renditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_assets" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "kind" "vault_asset_kind" NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "content_type" VARCHAR(128) NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "s3_key" VARCHAR(1024) NOT NULL,
    "kms_key_arn" VARCHAR(2048) NOT NULL,
    "encrypted_dek" BYTEA,
    "encryption_iv" BYTEA,
    "encryption_auth_tag" BYTEA,
    "checksum_sha256" CHAR(64) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vault_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_vault_links" (
    "video_id" TEXT NOT NULL,
    "vault_asset_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_vault_links_pkey" PRIMARY KEY ("video_id","vault_asset_id")
);

-- CreateTable
CREATE TABLE "follows" (
    "follower_id" TEXT NOT NULL,
    "followee_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("follower_id","followee_id")
);

-- CreateTable
CREATE TABLE "video_likes" (
    "user_id" TEXT NOT NULL,
    "video_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_likes_pkey" PRIMARY KEY ("user_id","video_id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "video_id" TEXT NOT NULL,
    "body" VARCHAR(500) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookmarks" (
    "user_id" TEXT NOT NULL,
    "video_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("user_id","video_id")
);

-- CreateTable
CREATE TABLE "feed_impressions" (
    "user_id" TEXT NOT NULL,
    "video_id" TEXT NOT NULL,
    "seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feed_impressions_pkey" PRIMARY KEY ("user_id","video_id")
);

-- CreateTable
CREATE TABLE "nda_templates" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "content_sha256" CHAR(64) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nda_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nda_requests" (
    "id" TEXT NOT NULL,
    "recruiter_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "video_id" TEXT,
    "template_id" TEXT NOT NULL,
    "reason" VARCHAR(500),
    "status" "nda_request_status" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nda_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nda_agreements" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "signer_id" TEXT NOT NULL,
    "signer_name" VARCHAR(120) NOT NULL,
    "template_sha256" CHAR(64) NOT NULL,
    "artifact_s3_key" VARCHAR(1024) NOT NULL,
    "ip_address" VARCHAR(45) NOT NULL,
    "user_agent" VARCHAR(512) NOT NULL,
    "provider_envelope_id" VARCHAR(128),
    "status" "agreement_status" NOT NULL DEFAULT 'SIGNED',
    "signed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nda_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_grants" (
    "id" TEXT NOT NULL,
    "agreement_id" TEXT NOT NULL,
    "recruiter_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "vault_asset_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" "audit_action" NOT NULL,
    "resource_type" VARCHAR(64) NOT NULL,
    "resource_id" VARCHAR(64) NOT NULL,
    "ip" VARCHAR(45),
    "user_agent" VARCHAR(512),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "topic" VARCHAR(128) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "outbox_status" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" VARCHAR(1000),
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "route" VARCHAR(128) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "response_status" INTEGER,
    "response_body" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_cognito_sub_key" ON "users"("cognito_sub");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_e164_key" ON "users"("phone_e164");

-- CreateIndex
CREATE UNIQUE INDEX "users_handle_key" ON "users"("handle");

-- CreateIndex
CREATE INDEX "users_role_status_idx" ON "users"("role", "status");

-- CreateIndex
CREATE INDEX "users_status_created_at_idx" ON "users"("status", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_user_id_key" ON "student_profiles"("user_id");

-- CreateIndex
CREATE INDEX "student_profiles_university_normalized_idx" ON "student_profiles"("university_normalized");

-- CreateIndex
CREATE INDEX "student_profiles_city_idx" ON "student_profiles"("city");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organizations_plan_status_idx" ON "organizations"("plan", "status");

-- CreateIndex
CREATE UNIQUE INDEX "recruiter_profiles_user_id_key" ON "recruiter_profiles"("user_id");

-- CreateIndex
CREATE INDEX "recruiter_profiles_org_id_idx" ON "recruiter_profiles"("org_id");

-- CreateIndex
CREATE INDEX "device_sessions_user_id_revoked_at_idx" ON "device_sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "device_sessions_user_id_device_id_key" ON "device_sessions"("user_id", "device_id");

-- CreateIndex
CREATE UNIQUE INDEX "uploads_s3_key_key" ON "uploads"("s3_key");

-- CreateIndex
CREATE INDEX "uploads_user_id_created_at_idx" ON "uploads"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "uploads_status_expires_at_idx" ON "uploads"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "videos_upload_id_key" ON "videos"("upload_id");

-- CreateIndex
CREATE INDEX "videos_author_id_created_at_idx" ON "videos"("author_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "videos_visibility_status_created_at_idx" ON "videos"("visibility", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "videos_status_created_at_idx" ON "videos"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "video_renditions_video_id_idx" ON "video_renditions"("video_id");

-- CreateIndex
CREATE UNIQUE INDEX "video_renditions_video_id_kind_key" ON "video_renditions"("video_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "vault_assets_s3_key_key" ON "vault_assets"("s3_key");

-- CreateIndex
CREATE INDEX "vault_assets_owner_id_created_at_idx" ON "vault_assets"("owner_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "video_vault_links_vault_asset_id_idx" ON "video_vault_links"("vault_asset_id");

-- CreateIndex
CREATE INDEX "follows_followee_id_created_at_idx" ON "follows"("followee_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "video_likes_video_id_created_at_idx" ON "video_likes"("video_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "comments_video_id_created_at_idx" ON "comments"("video_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "comments_user_id_created_at_idx" ON "comments"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "bookmarks_user_id_created_at_idx" ON "bookmarks"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "bookmarks_video_id_idx" ON "bookmarks"("video_id");

-- CreateIndex
CREATE INDEX "feed_impressions_user_id_seen_at_idx" ON "feed_impressions"("user_id", "seen_at");

-- CreateIndex
CREATE UNIQUE INDEX "nda_templates_version_key" ON "nda_templates"("version");

-- CreateIndex
CREATE INDEX "nda_requests_student_id_status_created_at_idx" ON "nda_requests"("student_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "nda_requests_recruiter_id_status_created_at_idx" ON "nda_requests"("recruiter_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "nda_requests_expires_at_status_idx" ON "nda_requests"("expires_at", "status");

-- CreateIndex
CREATE UNIQUE INDEX "nda_agreements_request_id_key" ON "nda_agreements"("request_id");

-- CreateIndex
CREATE INDEX "nda_agreements_signer_id_signed_at_idx" ON "nda_agreements"("signer_id", "signed_at" DESC);

-- CreateIndex
CREATE INDEX "access_grants_recruiter_id_student_id_idx" ON "access_grants"("recruiter_id", "student_id");

-- CreateIndex
CREATE INDEX "access_grants_agreement_id_idx" ON "access_grants"("agreement_id");

-- CreateIndex
CREATE INDEX "access_grants_expires_at_idx" ON "access_grants"("expires_at");

-- CreateIndex
CREATE INDEX "audit_events_actor_id_created_at_idx" ON "audit_events"("actor_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_events_resource_type_resource_id_created_at_idx" ON "audit_events"("resource_type", "resource_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_events_action_created_at_idx" ON "audit_events"("action", "created_at" DESC);

-- CreateIndex
CREATE INDEX "outbox_events_status_available_at_idx" ON "outbox_events"("status", "available_at");

-- CreateIndex
CREATE INDEX "outbox_events_topic_created_at_idx" ON "outbox_events"("topic", "created_at");

-- CreateIndex
CREATE INDEX "idempotency_records_expires_at_idx" ON "idempotency_records"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_user_id_key_route_key" ON "idempotency_records"("user_id", "key", "route");

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruiter_profiles" ADD CONSTRAINT "recruiter_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruiter_profiles" ADD CONSTRAINT "recruiter_profiles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_sessions" ADD CONSTRAINT "device_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_renditions" ADD CONSTRAINT "video_renditions_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_assets" ADD CONSTRAINT "vault_assets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_vault_links" ADD CONSTRAINT "video_vault_links_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_vault_links" ADD CONSTRAINT "video_vault_links_vault_asset_id_fkey" FOREIGN KEY ("vault_asset_id") REFERENCES "vault_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_followee_id_fkey" FOREIGN KEY ("followee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_likes" ADD CONSTRAINT "video_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_likes" ADD CONSTRAINT "video_likes_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_impressions" ADD CONSTRAINT "feed_impressions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_impressions" ADD CONSTRAINT "feed_impressions_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nda_requests" ADD CONSTRAINT "nda_requests_recruiter_id_fkey" FOREIGN KEY ("recruiter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nda_requests" ADD CONSTRAINT "nda_requests_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nda_requests" ADD CONSTRAINT "nda_requests_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nda_requests" ADD CONSTRAINT "nda_requests_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "nda_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nda_agreements" ADD CONSTRAINT "nda_agreements_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "nda_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nda_agreements" ADD CONSTRAINT "nda_agreements_signer_id_fkey" FOREIGN KEY ("signer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_agreement_id_fkey" FOREIGN KEY ("agreement_id") REFERENCES "nda_agreements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_recruiter_id_fkey" FOREIGN KEY ("recruiter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_vault_asset_id_fkey" FOREIGN KEY ("vault_asset_id") REFERENCES "vault_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Integrity constraints (not expressible in Prisma)
-- ---------------------------------------------------------------------------

ALTER TABLE "users"
  ADD CONSTRAINT "users_email_or_phone_chk"
  CHECK ("email" IS NOT NULL OR "phone_e164" IS NOT NULL);

ALTER TABLE "users"
  ADD CONSTRAINT "users_handle_format_chk"
  CHECK ("handle" ~ '^[a-z0-9._]{3,30}$');

ALTER TABLE "users"
  ADD CONSTRAINT "users_phone_e164_chk"
  CHECK ("phone_e164" IS NULL OR "phone_e164" ~ '^\+[1-9][0-9]{7,14}$');

ALTER TABLE "student_profiles"
  ADD CONSTRAINT "student_profiles_grad_year_chk"
  CHECK ("graduation_year" IS NULL OR ("graduation_year" BETWEEN 1980 AND 2040));

ALTER TABLE "uploads"
  ADD CONSTRAINT "uploads_byte_size_chk"
  CHECK ("byte_size" > 0 AND "byte_size" <= 524288000);

ALTER TABLE "videos"
  ADD CONSTRAINT "videos_counts_chk"
  CHECK ("like_count" >= 0 AND "comment_count" >= 0 AND "bookmark_count" >= 0);

ALTER TABLE "videos"
  ADD CONSTRAINT "videos_duration_chk"
  CHECK ("duration_ms" IS NULL OR ("duration_ms" > 0 AND "duration_ms" <= 90000));

ALTER TABLE "videos"
  ADD CONSTRAINT "videos_ready_requires_hls_chk"
  CHECK ("status" <> 'READY' OR "hls_master_key" IS NOT NULL);

ALTER TABLE "vault_assets"
  ADD CONSTRAINT "vault_assets_byte_size_chk"
  CHECK ("byte_size" > 0 AND "byte_size" <= 524288000);

ALTER TABLE "follows"
  ADD CONSTRAINT "follows_no_self_chk"
  CHECK ("follower_id" <> "followee_id");

ALTER TABLE "nda_requests"
  ADD CONSTRAINT "nda_requests_not_self_chk"
  CHECK ("recruiter_id" <> "student_id");

ALTER TABLE "access_grants"
  ADD CONSTRAINT "access_grants_not_self_chk"
  CHECK ("recruiter_id" <> "student_id");

ALTER TABLE "access_grants"
  ADD CONSTRAINT "access_grants_ttl_chk"
  CHECK ("expires_at" > "created_at");

ALTER TABLE "outbox_events"
  ADD CONSTRAINT "outbox_events_attempts_chk"
  CHECK ("attempts" >= 0);

-- ---------------------------------------------------------------------------
-- Partial / covering indexes for hot paths
-- Prisma cannot express WHERE on indexes. Do not drop these in later diffs.
-- ---------------------------------------------------------------------------

CREATE INDEX "videos_feed_ready_idx"
  ON "videos" ("created_at" DESC, "id" DESC)
  WHERE "status" = 'READY'
    AND "visibility" = 'PUBLIC_FEED'
    AND "deleted_at" IS NULL
    AND "moderation_status" = 'CLEAR';

CREATE INDEX "videos_author_ready_idx"
  ON "videos" ("author_id", "created_at" DESC)
  WHERE "deleted_at" IS NULL AND "status" IN ('READY', 'HIDDEN', 'PROCESSING');

CREATE INDEX "comments_visible_idx"
  ON "comments" ("video_id", "created_at" DESC)
  WHERE "deleted_at" IS NULL;

CREATE INDEX "access_grants_active_idx"
  ON "access_grants" ("recruiter_id", "student_id", "expires_at")
  WHERE "revoked_at" IS NULL;

CREATE UNIQUE INDEX "access_grants_one_active_per_pair_idx"
  ON "access_grants" ("recruiter_id", "student_id")
  WHERE "revoked_at" IS NULL AND "vault_asset_id" IS NULL;

CREATE INDEX "nda_requests_student_pending_idx"
  ON "nda_requests" ("student_id", "created_at" DESC)
  WHERE "status" = 'PENDING';

CREATE UNIQUE INDEX "nda_requests_one_pending_pair_idx"
  ON "nda_requests" ("recruiter_id", "student_id")
  WHERE "status" = 'PENDING';

CREATE UNIQUE INDEX "nda_templates_one_active_idx"
  ON "nda_templates" ("is_active")
  WHERE "is_active" = TRUE;

CREATE INDEX "outbox_events_poll_idx"
  ON "outbox_events" ("available_at", "created_at")
  WHERE "status" = 'PENDING';

CREATE INDEX "uploads_expire_idx"
  ON "uploads" ("expires_at")
  WHERE "status" = 'CREATED';

CREATE INDEX "device_sessions_active_idx"
  ON "device_sessions" ("user_id", "last_seen_at" DESC)
  WHERE "revoked_at" IS NULL;

CREATE INDEX "vault_assets_owner_live_idx"
  ON "vault_assets" ("owner_id", "created_at" DESC)
  WHERE "deleted_at" IS NULL;

CREATE INDEX "users_active_handle_idx"
  ON "users" ("handle")
  WHERE "status" = 'ACTIVE';

CREATE INDEX "feed_impressions_seen_at_idx"
  ON "feed_impressions" ("seen_at");

-- ---------------------------------------------------------------------------
-- Production notes (applied by ops, not this migration):
--   REVOKE UPDATE, DELETE ON audit_events FROM janus_app;
--   GRANT INSERT, SELECT ON audit_events TO janus_app;
--   REVOKE DELETE ON nda_agreements, access_grants FROM janus_app;
-- ---------------------------------------------------------------------------

