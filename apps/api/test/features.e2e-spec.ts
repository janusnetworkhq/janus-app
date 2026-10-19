import { execFileSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import { readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { PrismaClient, UserRole } from "@prisma/client";
import type { SQSClient } from "@aws-sdk/client-sqs";
import { createApp } from "../src/main";
import { appConfig } from "../src/common/config";
import { OutboxService } from "../src/common/outbox.service";
import { RedisService } from "../src/common/redis.service";
import { StorageService } from "../src/common/storage.service";
import { NotificationService } from "../src/notifications/notification.service";
import { NdaLifecycleService } from "../src/workers/nda-lifecycle.service";
import { AvatarCopyService } from "../src/workers/avatar-copy.service";
import { SqsConsumer } from "../src/workers/sqs-consumer";
import { planRenditions } from "../src/media/ffmpeg-transcoder";

const prisma = new PrismaClient();
const ffmpegAvailable = (() => {
  try {
    execFileSync(appConfig.ffmpegPath, ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

describe("Round 3 features", () => {
  let app: NestFastifyApplication;
  const stamp = `f${Date.now().toString(36)}`;
  let studentToken: string;
  let recruiterToken: string;
  let adminToken: string;
  let studentId: string;
  let recruiterId: string;
  let videoId: string;
  let templateHash: string;
  const saved = { ...appConfig };

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(() => {
    appConfig.moderationDriver = saved.moderationDriver;
    appConfig.transcodeDriver = saved.transcodeDriver;
    appConfig.authMode = saved.authMode;
    appConfig.avatarCopyHosts = saved.avatarCopyHosts;
  });

  afterAll(async () => {
    // Test videos live in the in-memory storage driver, so they would be unplayable in the
    // shared dev database's feed. Hide (not delete) everything this suite's student made.
    await prisma.video.updateMany({
      where: { author: { cognitoSub: `stu-${stamp}` } },
      data: { status: "HIDDEN", hiddenByAdminAt: new Date() },
    });
    await app.close();
    await prisma.$disconnect();
  });

  const inject = (o: { method: "GET" | "POST" | "PATCH" | "DELETE"; url: string; token?: string; payload?: unknown; headers?: Record<string, string> }) =>
    app.inject({
      method: o.method,
      url: o.url,
      payload: o.payload as object,
      headers: {
        ...(o.payload ? { "content-type": "application/json" } : {}),
        ...(o.token ? { authorization: `Bearer ${o.token}` } : {}),
        ...(o.headers ?? {}),
      },
    });

  const devToken = async (sub: string, extra: Record<string, string>) => {
    const res = await inject({ method: "POST", url: "/v1/dev/tokens", payload: { sub, ...extra } });
    expect(res.statusCode).toBe(200);
    return res.json().accessToken as string;
  };

  /** Drain the outbox through the in-process handlers (workers are disabled in tests). */
  const flush = async () => {
    const outbox = app.get(OutboxService);
    for (let i = 0; i < 5; i++) await outbox.flush();
  };

  const notificationsFor = async (token: string) => {
    const res = await inject({ method: "GET", url: "/v1/notifications", token });
    expect(res.statusCode).toBe(200);
    return res.json() as { items: { id: string; type: string; readAt: string | null }[]; unread: number };
  };

  async function uploadVideo(token: string, opts: { source?: Buffer; caption?: string } = {}) {
    const created = await inject({
      method: "POST",
      url: "/v1/uploads",
      token,
      payload: { kind: "FEED_VIDEO", contentType: "video/mp4", byteSize: opts.source?.length ?? 1024, durationMs: 4000, caption: opts.caption ?? "feature test" },
    });
    expect([200, 201]).toContain(created.statusCode);
    const uploadId = created.json().uploadId as string;
    const row = await prisma.upload.findUniqueOrThrow({ where: { id: uploadId } });
    if (opts.source) await app.get(StorageService).put(row.s3Bucket, row.s3Key, opts.source, "video/mp4");
    const done = await inject({ method: "POST", url: `/v1/uploads/${uploadId}/complete`, token, payload: {} });
    if (done.statusCode >= 400) throw new Error(done.body);
    return done.json().videoId as string;
  }

  it("onboards a student, recruiter and admin", async () => {
    studentToken = await devToken(`stu-${stamp}`, { email: `stu-${stamp}@janus.test`, name: "Feature Student", provider: "Google" });
    recruiterToken = await devToken(`rec-${stamp}`, { email: `rec-${stamp}@janus.test`, name: "Feature Recruiter", provider: "Google" });
    adminToken = await devToken(`adm-${stamp}`, { email: `adm-${stamp}@janus.test`, name: "Feature Admin", provider: "Google" });
    const s = await inject({ method: "POST", url: "/v1/me/profile", token: studentToken, payload: { role: "STUDENT", handle: `fs${stamp}`, displayName: "Feature Student", university: "NITK" } });
    expect([200, 201]).toContain(s.statusCode);
    studentId = s.json().id;
    const r = await inject({ method: "POST", url: "/v1/me/profile", token: recruiterToken, payload: { role: "RECRUITER", handle: `fr${stamp}`, displayName: "Feature Recruiter", orgName: "Feature Org", orgSlug: `forg${stamp}` } });
    expect([200, 201]).toContain(r.statusCode);
    recruiterId = r.json().id;
    const a = await inject({ method: "GET", url: "/v1/me", token: adminToken });
    await prisma.user.update({ where: { id: a.json().id }, data: { role: UserRole.PLATFORM_ADMIN, profileComplete: true } });
    await app.get(RedisService).del(`user:sub:adm-${stamp}`);
    templateHash = (await inject({ method: "GET", url: "/v1/nda/templates/default", token: recruiterToken })).json().contentSha256;
  });

  it("registers Expo push tokens and rejects junk", async () => {
    const bad = await inject({ method: "POST", url: "/v1/notifications/push-tokens", token: studentToken, payload: { token: "not-a-token", platform: "ios" } });
    expect(bad.statusCode).toBe(400);
    const ok = await inject({ method: "POST", url: "/v1/notifications/push-tokens", token: studentToken, payload: { token: `ExponentPushToken[${stamp}stu]`, platform: "ios" } });
    expect(ok.statusCode).toBe(200);
    const again = await inject({ method: "POST", url: "/v1/notifications/push-tokens", token: studentToken, payload: { token: `ExponentPushToken[${stamp}stu]`, platform: "ios" } });
    expect(again.json().id).toBe(ok.json().id);
    await inject({ method: "POST", url: "/v1/notifications/push-tokens", token: recruiterToken, payload: { token: `ExponentPushToken[${stamp}rec]`, platform: "ios" } });
  });

  it("notifies both sides through the NDA lifecycle and pushes to devices", async () => {
    videoId = await uploadVideo(studentToken);
    await flush();
    const ready = await notificationsFor(studentToken);
    expect(ready.items.some((n) => n.type === "VIDEO_READY")).toBe(true);

    const req = await inject({ method: "POST", url: "/v1/nda/requests", token: recruiterToken, payload: { studentId, videoId, reason: "hiring" } });
    expect([200, 201]).toContain(req.statusCode);
    const ndaId = req.json().id as string;
    await flush();
    const stu = await notificationsFor(studentToken);
    expect(stu.items.some((n) => n.type === "NDA_REQUESTED")).toBe(true);
    const pushes = app.get(NotificationService).sentPushes;
    expect(pushes.some((p) => p.to === `ExponentPushToken[${stamp}stu]` && p.data?.type === "NDA_REQUESTED")).toBe(true);

    await inject({ method: "POST", url: `/v1/nda/requests/${ndaId}/decide`, token: studentToken, payload: { accept: true } });
    await flush();
    expect((await notificationsFor(recruiterToken)).items.some((n) => n.type === "NDA_ACCEPTED")).toBe(true);

    const PNG_1PX = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAwMCAO+ip1sAAAAASUVORK5CYII=";
    const signed = await inject({ method: "POST", url: `/v1/nda/requests/${ndaId}/sign`, token: recruiterToken, payload: { typedName: "Feature Recruiter", acceptedHash: templateHash, signaturePngBase64: PNG_1PX } });
    expect(signed.statusCode).toBe(201);
    // Re-signing for the same pair must refresh the single active grant, not duplicate it.
    const req2 = await inject({ method: "POST", url: "/v1/nda/requests", token: recruiterToken, payload: { studentId, videoId, reason: "second look" } });
    const ndaId2 = req2.json().id as string;
    await inject({ method: "POST", url: `/v1/nda/requests/${ndaId2}/decide`, token: studentToken, payload: { accept: true } });
    const signed2 = await inject({ method: "POST", url: `/v1/nda/requests/${ndaId2}/sign`, token: recruiterToken, payload: { typedName: "Feature Recruiter", acceptedHash: templateHash } });
    expect(signed2.statusCode).toBe(201);
    expect(await prisma.accessGrant.count({ where: { recruiterId, studentId, vaultAssetId: null, revokedAt: null } })).toBe(1);

    const agreement = await prisma.ndaAgreement.findFirstOrThrow({ where: { requestId: ndaId } });
    const { createHash } = await import("node:crypto");
    expect(agreement.signatureS3Key).toBe(`legal/signatures/${ndaId}.png`);
    expect(agreement.signatureSha256).toBe(createHash("sha256").update(Buffer.from(PNG_1PX, "base64")).digest("hex"));
    await flush();
    expect((await notificationsFor(studentToken)).items.some((n) => n.type === "NDA_SIGNED")).toBe(true);
  });

  it("marks notifications read", async () => {
    const before = await notificationsFor(studentToken);
    expect(before.unread).toBeGreaterThan(0);
    const first = before.items[0]!;
    expect((await inject({ method: "POST", url: `/v1/notifications/${first.id}/read`, token: studentToken })).json().updated).toBe(1);
    await inject({ method: "POST", url: "/v1/notifications/read-all", token: studentToken });
    expect((await notificationsFor(studentToken)).unread).toBe(0);
  });

  it("vault playback carries a recruiter-identifying watermark", async () => {
    const up = await inject({ method: "POST", url: "/v1/uploads", token: studentToken, payload: { kind: "VAULT_FILE", contentType: "application/pdf", byteSize: 100, originalName: "w.pdf", vaultKind: "DOCUMENT" } });
    await inject({ method: "POST", url: `/v1/uploads/${up.json().uploadId}/complete`, token: studentToken, payload: { originalName: "w.pdf", vaultKind: "DOCUMENT" } });
    const list = await inject({ method: "GET", url: `/v1/vault/students/${studentId}`, token: recruiterToken });
    const play = await inject({ method: "POST", url: `/v1/vault/assets/${list.json().items[0].id}/playback`, token: recruiterToken });
    expect(play.json().watermarkText).toContain(`rec-${stamp}@janus.test`);
    expect(play.json().watermarkText).toContain("Feature Org");
  });

  it("lifecycle sweep expires stale requests and announces expired grants", async () => {
    const tpl = await prisma.ndaTemplate.findFirstOrThrow({ where: { isActive: true } });
    const stale = await prisma.ndaRequest.create({
      data: { recruiterId, studentId, templateId: tpl.id, expiresAt: new Date(Date.now() - 1000) },
    });
    const grant = await prisma.accessGrant.findFirstOrThrow({ where: { recruiterId, studentId } });
    await prisma.accessGrant.update({ where: { id: grant.id }, data: { createdAt: new Date(Date.now() - 9 * 86400_000), expiresAt: new Date(Date.now() - 1000) } });

    const res = await app.get(NdaLifecycleService).sweep();
    expect(res.expiredRequests).toBeGreaterThanOrEqual(1);
    expect(res.expiredGrants).toBeGreaterThanOrEqual(1);
    expect((await prisma.ndaRequest.findUniqueOrThrow({ where: { id: stale.id } })).status).toBe("EXPIRED");
    expect((await prisma.accessGrant.findUniqueOrThrow({ where: { id: grant.id } })).expiryNotifiedAt).not.toBeNull();
    const rec = await notificationsFor(recruiterToken);
    expect(rec.items.map((n) => n.type)).toEqual(expect.arrayContaining(["NDA_EXPIRED", "GRANT_EXPIRED"]));
    // Idempotent: a second sweep does nothing new.
    const second = await app.get(NdaLifecycleService).sweep();
    expect(second).toEqual({ expiredRequests: 0, expiredGrants: 0 });

    const denied = await inject({ method: "GET", url: `/v1/vault/students/${studentId}`, token: recruiterToken });
    expect(denied.statusCode).toBe(403);
  });

  it("refuses to sign an expired request", async () => {
    const tpl = await prisma.ndaTemplate.findFirstOrThrow({ where: { isActive: true } });
    const row = await prisma.ndaRequest.create({
      data: { recruiterId, studentId, templateId: tpl.id, status: "ACCEPTED", expiresAt: new Date(Date.now() - 1000) },
    });
    const res = await inject({ method: "POST", url: `/v1/nda/requests/${row.id}/sign`, token: recruiterToken, payload: { typedName: "Feature Recruiter", acceptedHash: templateHash } });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("NDA_EXPIRED");
  });

  it("rejects a non-PNG signature image", async () => {
    const tpl = await prisma.ndaTemplate.findFirstOrThrow({ where: { isActive: true } });
    const row = await prisma.ndaRequest.create({
      data: { recruiterId, studentId, templateId: tpl.id, status: "ACCEPTED", expiresAt: new Date(Date.now() + 86400_000) },
    });
    const res = await inject({ method: "POST", url: `/v1/nda/requests/${row.id}/sign`, token: recruiterToken, payload: { typedName: "Feature Recruiter", acceptedHash: templateHash, signaturePngBase64: "bm90LWEtcG5n" } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("SIGNATURE_INVALID");
  });

  it("admin un-hide does not restore a video the author deleted", async () => {
    const hide = await inject({ method: "PATCH", url: `/v1/admin/videos/${videoId}`, token: adminToken, payload: { status: "HIDDEN" } });
    expect(hide.statusCode).toBe(200);
    const hidden = await prisma.video.findUniqueOrThrow({ where: { id: videoId } });
    expect(hidden.hiddenByAdminAt).not.toBeNull();
    expect(hidden.deletedAt).toBeNull();
    const unhide = await inject({ method: "PATCH", url: `/v1/admin/videos/${videoId}`, token: adminToken, payload: { status: "READY" } });
    expect(unhide.statusCode).toBe(200);
    expect(unhide.json().status).toBe("READY");

    const del = await inject({ method: "DELETE", url: `/v1/videos/${videoId}`, token: studentToken });
    expect(del.statusCode).toBeLessThan(300);
    const restore = await inject({ method: "PATCH", url: `/v1/admin/videos/${videoId}`, token: adminToken, payload: { status: "READY" } });
    expect(restore.statusCode).toBe(409);
    expect(restore.json().error.code).toBe("VIDEO_DELETED");
    const after = await prisma.video.findUniqueOrThrow({ where: { id: videoId } });
    expect(after.deletedAt).not.toBeNull();
    expect(after.status).toBe("HIDDEN");
  });

  it("manual moderation holds videos out of the feed until approved", async () => {
    appConfig.moderationDriver = "manual";
    const pendingId = await uploadVideo(studentToken, { caption: `pending ${stamp}` });
    const rejectId = await uploadVideo(studentToken, { caption: `reject ${stamp}` });
    const v = await prisma.video.findUniqueOrThrow({ where: { id: pendingId } });
    expect(v.status).toBe("READY");
    expect(v.moderationStatus).toBe("PENDING");

    const queue = await inject({ method: "GET", url: "/v1/admin/moderation", token: adminToken });
    expect(queue.statusCode).toBe(200);
    expect(queue.json().map((x: { id: string }) => x.id)).toEqual(expect.arrayContaining([pendingId, rejectId]));
    const forbidden = await inject({ method: "GET", url: "/v1/admin/moderation", token: studentToken });
    expect(forbidden.statusCode).toBe(403);

    const feedBefore = await inject({ method: "GET", url: "/v1/feed?limit=50", token: recruiterToken });
    expect(feedBefore.json().items.some((i: { id: string }) => i.id === pendingId)).toBe(false);

    const approve = await inject({ method: "POST", url: `/v1/admin/videos/${pendingId}/moderation`, token: adminToken, payload: { decision: "APPROVE" } });
    expect(approve.statusCode).toBe(200);
    expect(approve.json().moderationStatus).toBe("CLEAR");
    const reject = await inject({ method: "POST", url: `/v1/admin/videos/${rejectId}/moderation`, token: adminToken, payload: { decision: "REJECT", note: "test" } });
    expect(reject.json()).toMatchObject({ moderationStatus: "BLOCKED", status: "HIDDEN" });
    const unblock = await inject({ method: "PATCH", url: `/v1/admin/videos/${rejectId}`, token: adminToken, payload: { status: "READY" } });
    expect(unblock.statusCode).toBe(409);

    await flush();
    const types = (await notificationsFor(studentToken)).items.map((n) => n.type);
    expect(types).toEqual(expect.arrayContaining(["VIDEO_APPROVED", "VIDEO_REJECTED"]));
  });

  (ffmpegAvailable ? it : it.skip)("transcodes a real video to playable HLS with ffmpeg", async () => {
    const file = join(tmpdir(), `janus-${stamp}.mp4`);
    execFileSync(appConfig.ffmpegPath, [
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "lavfi", "-i", "testsrc=size=720x1280:rate=30:duration=3",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=3",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", file,
    ]);
    const source = readFileSync(file);
    rmSync(file, { force: true });
    appConfig.transcodeDriver = "ffmpeg";
    const id = await uploadVideo(studentToken, { source, caption: `ffmpeg ${stamp}` });
    const v = await prisma.video.findUniqueOrThrow({ where: { id }, include: { renditions: true } });
    expect(v.status).toBe("READY");
    expect(v.width).toBe(720);
    expect(v.height).toBe(1280);
    expect(v.durationMs).toBeGreaterThan(2500);
    expect(v.renditions.map((r) => r.kind)).toEqual(expect.arrayContaining(["HLS_540", "HLS_720", "POSTER", "PREVIEW"]));
    const storage = app.get(StorageService);
    const master = (await storage.getObject(appConfig.s3PublicBucket, v.hlsMasterKey!)).toString();
    expect(master).toContain("#EXT-X-STREAM-INF");
    expect(master).toContain("540.m3u8");
    const variant = (await storage.getObject(appConfig.s3PublicBucket, `hls/${id}/720.m3u8`)).toString();
    expect(variant).toMatch(/720_000\.ts/);
    expect((await storage.getObject(appConfig.s3PublicBucket, `hls/${id}/720_000.ts`)).length).toBeGreaterThan(1000);
    expect((await storage.getObject(appConfig.s3PublicBucket, v.posterKey!)).subarray(0, 2).toString("hex")).toBe("ffd8");
  }, 120_000);

  it("plans renditions without upscaling", () => {
    expect(planRenditions({ width: 1080, height: 1920, durationMs: 1, hasAudio: true }).map((r) => `${r.width}x${r.height}`)).toEqual(["540x960", "720x1280"]);
    expect(planRenditions({ width: 640, height: 360, durationMs: 1, hasAudio: false }).map((r) => `${r.width}x${r.height}`)).toEqual(["640x360"]);
  });

  it("marks a broken upload FAILED and tells the author", async () => {
    appConfig.transcodeDriver = "ffmpeg";
    if (!ffmpegAvailable) return;
    const id = await uploadVideo(studentToken, { source: Buffer.from("not a video at all"), caption: "broken" });
    const v = await prisma.video.findUniqueOrThrow({ where: { id } });
    expect(v.status).toBe("FAILED");
    await flush();
    expect((await notificationsFor(studentToken)).items.some((n) => n.type === "VIDEO_FAILED")).toBe(true);
  }, 60_000);

  describe("avatar copy", () => {
    let server: Server;
    let port = 0;
    const png = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000" + "1f15c4890000000d49444154789c6300010000050001" + "0d0a2db40000000049454e44ae426082", "hex");
    beforeAll(async () => {
      server = createServer((req, res) => {
        if (req.url === "/a.png") {
          res.writeHead(200, { "content-type": "image/png", "content-length": png.length });
          res.end(png);
        } else {
          res.writeHead(200, { "content-type": "text/html" });
          res.end("<html/>");
        }
      });
      await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
      port = (server.address() as { port: number }).port;
    });
    afterAll(() => new Promise<void>((r) => server.close(() => r())));

    it("copies an allowed IdP picture once and ignores other hosts", async () => {
      const user = await prisma.user.create({ data: { cognitoSub: `av-${stamp}`, handle: `av${stamp}`, email: `av-${stamp}@janus.test` } });
      const svc = app.get(AvatarCopyService);
      expect(await svc.copy({ userId: user.id, pictureUrl: `http://127.0.0.1:${port}/a.png` })).toMatchObject({ copied: false, reason: "host_not_allowed" });
      appConfig.avatarCopyHosts = ["127.0.0.1"];
      expect(await svc.copy({ userId: user.id, pictureUrl: `http://127.0.0.1:${port}/x.html` })).toMatchObject({ copied: false, reason: "bad_type" });
      const ok = await svc.copy({ userId: user.id, pictureUrl: `http://127.0.0.1:${port}/a.png` });
      expect(ok.copied).toBe(true);
      const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(row.avatarKey).toBe(ok.key);
      expect((await app.get(StorageService).getObject(appConfig.s3PublicBucket, ok.key!)).equals(png)).toBe(true);
      expect(await svc.copy({ userId: user.id, pictureUrl: `http://127.0.0.1:${port}/a.png` })).toMatchObject({ copied: false, reason: "already_set" });
    });
  });

  it("OTP sign-in issues a working session in Cognito mode", async () => {
    appConfig.authMode = "cognito";
    const email = `otp-${stamp}@janus.test`;
    const dev = await inject({ method: "POST", url: "/v1/dev/tokens", payload: { sub: "x", email } });
    expect(dev.statusCode).toBe(403);
    const send = await inject({ method: "POST", url: "/v1/auth/otp/send", payload: { email, name: "Otp User" } });
    expect(send.statusCode).toBe(200);
    const stored = JSON.parse((await app.get(RedisService).get(`auth:otp:${email}`))!) as { code: string };
    const verify = await inject({ method: "POST", url: "/v1/auth/otp/verify", payload: { email, code: stored.code } });
    expect(verify.statusCode).toBe(200);
    const token = verify.json().accessToken as string;
    const me = await inject({ method: "GET", url: "/v1/me", token });
    expect(me.statusCode).toBe(200);
    expect(me.json().email).toBe(email);
    const row = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(row.cognitoSub).toBe(`otp:email:${email}`);
    // A dev-issued local token is not accepted in Cognito mode.
    appConfig.authMode = "local";
    const local = await devToken(`loc-${stamp}`, { email: `loc-${stamp}@janus.test` });
    appConfig.authMode = "cognito";
    expect((await inject({ method: "GET", url: "/v1/me", token: local })).statusCode).toBe(401);
  });

  it("exposes the plan catalogue and enforces the monthly NDA quota", async () => {
    const plans = await inject({ method: "GET", url: "/v1/billing/plans", token: recruiterToken });
    expect(plans.json().items.map((p: { id: string }) => p.id)).toEqual(["FREE_PILOT", "SAAS"]);
    const plan = await inject({ method: "GET", url: "/v1/billing/plan", token: recruiterToken });
    expect(plan.json().details.ndaRequestsPerMonth).toBe(20);
    expect(plan.json().usage.ndaRequestsThisMonth).toBeGreaterThanOrEqual(1);
    const profile = await prisma.recruiterProfile.findUniqueOrThrow({ where: { userId: recruiterId } });
    const tpl = await prisma.ndaTemplate.findFirstOrThrow({ where: { isActive: true } });
    const filler = Array.from({ length: 20 }, () => ({ recruiterId, studentId, templateId: tpl.id, status: "REJECTED" as const, expiresAt: new Date() }));
    await prisma.ndaRequest.createMany({ data: filler });
    await app.get(RedisService).del(`rl:nda:${recruiterId}`);
    const res = await inject({ method: "POST", url: "/v1/nda/requests", token: recruiterToken, payload: { studentId } });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("PLAN_LIMIT");
    expect(profile.orgId).toBeTruthy();
  });

  it("outbox delivers each event exactly once under concurrent flushes", async () => {
    const marker = `dup-${stamp}`;
    await prisma.outboxEvent.create({ data: { topic: "notify.send", payload: { type: "VIDEO_READY", userId: studentId, videoId: marker } } });
    const outbox = app.get(OutboxService);
    await Promise.all([outbox.flush(), outbox.flush(), outbox.flush()]);
    await outbox.flush();
    const n = await prisma.notification.count({ where: { userId: studentId, data: { path: ["videoId"], equals: marker } } });
    expect(n).toBe(1);
  });

  it("SQS consumer dispatches envelopes and only deletes successes", async () => {
    const sent: string[] = [];
    const fake = {
      send: async (cmd: { constructor: { name: string }; input: { ReceiptHandle?: string } }) => {
        if (cmd.constructor.name === "ReceiveMessageCommand") {
          return {
            Messages: [
              { MessageId: "1", ReceiptHandle: "ok", Body: JSON.stringify({ topic: "t.ok", payload: { a: 1 } }) },
              { MessageId: "2", ReceiptHandle: "bad", Body: JSON.stringify({ topic: "t.fail", payload: {} }) },
              { MessageId: "3", ReceiptHandle: "junk", Body: "{not json" },
            ],
          };
        }
        sent.push(cmd.input.ReceiptHandle!);
        return {};
      },
    } as unknown as SQSClient;
    const seen: unknown[] = [];
    const consumer = new SqsConsumer(fake, "http://q/000/test", async (topic, payload) => {
      if (topic === "t.fail") throw new Error("boom");
      seen.push(payload);
    });
    expect(await consumer.pollOnce()).toBe(1);
    expect(seen).toEqual([{ a: 1 }]);
    expect(sent).toEqual(["ok"]);
  });
});
