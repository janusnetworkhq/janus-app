import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { UserRole } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createApp } from "../src/main";

const prisma = new PrismaClient();

describe("JANUS API contracts", () => {
  let app: NestFastifyApplication;
  let studentToken: string;
  let recruiterToken: string;
  let adminToken: string;
  let studentId: string;
  let recruiterId: string;
  let videoId: string;
  let templateHash: string;
  let ndaId: string;
  let assetId: string;

  const stamp = Date.now().toString(36);

  beforeAll(async () => {
    process.env.AUTH_MODE = "local";
    process.env.MEDIA_DRIVER = "noop";
    process.env.TRANSCODE_DRIVER = "mock";
    process.env.MODERATION_DRIVER = "noop";
    process.env.WORKERS_ENABLED = "false";
    app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  async function inject(opts: {
    method: "GET" | "POST" | "PATCH" | "DELETE";
    url: string;
    token?: string;
    payload?: unknown;
    headers?: Record<string, string>;
  }) {
    return app.inject({
      method: opts.method,
      url: opts.url,
      payload: opts.payload as object,
      headers: {
        ...(opts.payload ? { "content-type": "application/json" } : {}),
        ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
        ...(opts.headers ?? {}),
      },
    });
  }

  async function token(sub: string, extra: Record<string, string> = {}) {
    const res = await inject({
      method: "POST",
      url: "/v1/dev/tokens",
      payload: { sub, ...extra },
    });
    expect(res.statusCode).toBe(200);
    return (res.json() as { accessToken: string }).accessToken;
  }

  it("health is public", async () => {
    const res = await inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });
  });

  it("ready reports postgres", async () => {
    const res = await inject({ method: "GET", url: "/ready" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, postgres: true });
  });

  it("rejects missing bearer", async () => {
    const res = await inject({ method: "GET", url: "/v1/me" });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("UNAUTHORIZED");
    expect(res.json().error.requestId).toBeTruthy();
  });

  it("onboards student and recruiter via Google/phone claims", async () => {
    studentToken = await token(`stu-${stamp}`, {
      email: `stu-${stamp}@janus.test`,
      name: "Student One",
      provider: "Google",
    });
    recruiterToken = await token(`rec-${stamp}`, {
      email: `rec-${stamp}@janus.test`,
      name: "Recruiter One",
      provider: "Google",
    });

    const s1 = await inject({ method: "POST", url: "/v1/me/profile", token: studentToken, payload: {
      role: "STUDENT",
      handle: `stu${stamp}`,
      displayName: "Student One",
      university: "NITK",
      headline: "Builder",
      city: "Bengaluru",
    }});
    if (s1.statusCode >= 400) throw new Error(s1.body);
    expect([200, 201]).toContain(s1.statusCode);
    studentId = s1.json().id;

    const r1 = await inject({ method: "POST", url: "/v1/me/profile", token: recruiterToken, payload: {
      role: "RECRUITER",
      handle: `rec${stamp}`,
      displayName: "Recruiter One",
      orgName: "Acme Talent",
      orgSlug: `acme${stamp}`,
      title: "Talent",
    }});
    expect([200, 201]).toContain(r1.statusCode);
    recruiterId = r1.json().id;
    expect(recruiterId).toBeTruthy();
    expect(r1.json().profileComplete).toBe(true);

    const plan = await inject({ method: "GET", url: "/v1/billing/plan", token: recruiterToken });
    expect(plan.statusCode).toBe(200);
    expect(plan.json().plan).toBe("FREE_PILOT");
    expect(plan.json().organization?.id).toBeTruthy();
  });

  it("uploads a feed video and processes to READY", async () => {
    const created = await inject({
      method: "POST",
      url: "/v1/uploads",
      token: studentToken,
      payload: {
        kind: "FEED_VIDEO",
        contentType: "video/mp4",
        byteSize: 1024,
        durationMs: 15000,
        caption: "My prototype",
      },
    });
    if (created.statusCode >= 400) throw new Error(created.body);
    expect([200, 201]).toContain(created.statusCode);
    const uploadId = created.json().uploadId as string;

    const done = await inject({
      method: "POST",
      url: `/v1/uploads/${uploadId}/complete`,
      token: studentToken,
      payload: {},
    });
    if (done.statusCode >= 400) throw new Error(done.body);
    expect([200, 201]).toContain(done.statusCode);
    videoId = done.json().videoId as string;
    expect(videoId).toBeTruthy();

    const video = await inject({ method: "GET", url: `/v1/videos/${videoId}`, token: studentToken });
    expect(video.statusCode).toBe(200);
    expect(video.json().status).toBe("READY");
    expect(video.json().hlsUrl).toBeTruthy();
  });

  it("attaches a vault file", async () => {
    const created = await inject({
      method: "POST",
      url: "/v1/uploads",
      token: studentToken,
      payload: {
        kind: "VAULT_FILE",
        contentType: "application/pdf",
        byteSize: 2048,
        originalName: "schematic.pdf",
        vaultKind: "SCHEMATIC",
      },
    });
    const complete = await inject({
      method: "POST",
      url: `/v1/uploads/${created.json().uploadId}/complete`,
      token: studentToken,
      payload: { vaultKind: "SCHEMATIC", originalName: "schematic.pdf", videoId },
    });
    if (complete.statusCode >= 400) throw new Error(`${created.statusCode} ${created.body} | ${complete.body}`);
    expect([200, 201]).toContain(complete.statusCode);
  });

  it("serves a ranked feed page", async () => {
    const res = await inject({ method: "GET", url: "/v1/feed?limit=10", token: recruiterToken });
    if (res.statusCode >= 400) throw new Error(res.body);
    expect(res.statusCode).toBe(200);
    const items = res.json().items as Array<{ id: string }>;
    expect(items.some((i) => i.id === videoId)).toBe(true);
  });

  it("likes and records impressions without extra round trips failing", async () => {
    const like = await inject({ method: "POST", url: `/v1/videos/${videoId}/like`, token: recruiterToken });
    if (like.statusCode >= 400) throw new Error(like.body);
    expect([200, 201]).toContain(like.statusCode);
    const again = await inject({ method: "POST", url: `/v1/videos/${videoId}/like`, token: recruiterToken });
    expect([200, 201]).toContain(again.statusCode);
    const imp = await inject({
      method: "POST",
      url: "/v1/impressions",
      token: recruiterToken,
      payload: { videoIds: [videoId] },
    });
    expect([200, 201]).toContain(imp.statusCode);
  });

  it("denies vault before NDA, then grants after sign", async () => {
    const denied = await inject({
      method: "GET",
      url: `/v1/vault/students/${studentId}`,
      token: recruiterToken,
    });
    expect(denied.statusCode).toBe(403);
    expect(denied.json().error.code).toBe("VAULT_DENIED");

    const tpl = await inject({ method: "GET", url: "/v1/nda/templates/default", token: recruiterToken });
    expect(tpl.statusCode).toBe(200);
    templateHash = tpl.json().contentSha256;

    const reqNda = await inject({
      method: "POST",
      url: "/v1/nda/requests",
      token: recruiterToken,
      payload: { studentId, videoId, reason: "hiring" },
      headers: { "idempotency-key": `nda-${stamp}` },
    });
    expect([200, 201]).toContain(reqNda.statusCode);
    ndaId = reqNda.json().id;

    const decide = await inject({
      method: "POST",
      url: `/v1/nda/requests/${ndaId}/decide`,
      token: studentToken,
      payload: { accept: true },
    });
    expect([200, 201]).toContain(decide.statusCode);

    const signed = await inject({
      method: "POST",
      url: `/v1/nda/requests/${ndaId}/sign`,
      token: recruiterToken,
      payload: { typedName: "Recruiter One", acceptedHash: templateHash },
      headers: { "idempotency-key": `sign-${stamp}` },
    });
    if (signed.statusCode >= 400) throw new Error(signed.body);
    expect([200, 201]).toContain(signed.statusCode);

    const list = await inject({
      method: "GET",
      url: `/v1/vault/students/${studentId}`,
      token: recruiterToken,
    });
    expect(list.statusCode).toBe(200);
    assetId = list.json().items[0].id;

    const play = await inject({
      method: "POST",
      url: `/v1/vault/assets/${assetId}/playback`,
      token: recruiterToken,
    });
    expect([200, 201]).toContain(play.statusCode);
    expect(play.json().url).toBeTruthy();
    expect(play.json().watermarkToken).toBeTruthy();
  });

  it("platform admin can hide a video", async () => {
    adminToken = await token(`adm-${stamp}`, {
      email: `adm-${stamp}@janus.test`,
      name: "Admin",
      provider: "Google",
    });
    const me = await inject({ method: "GET", url: "/v1/me", token: adminToken });
    await prisma.user.update({
      where: { id: me.json().id },
      data: { role: UserRole.PLATFORM_ADMIN, profileComplete: true, displayName: "Admin" },
    });
    const { RedisService } = await import("../src/common/redis.service");
    await app.get(RedisService).del(`user:sub:adm-${stamp}`);

    const hide = await inject({
      method: "PATCH",
      url: `/v1/admin/videos/${videoId}`,
      token: adminToken,
      payload: { status: "HIDDEN" },
    });
    expect(hide.statusCode).toBe(200);
  });

  it("exports OpenAPI contract", () => {
    const { swaggerDocument } = require("../src/main") as {
      swaggerDocument: { paths?: Record<string, unknown> } | null;
    };
    expect(swaggerDocument?.paths?.["/v1/feed"]).toBeTruthy();
    expect(swaggerDocument?.paths?.["/v1/nda/requests"]).toBeTruthy();
    expect(swaggerDocument?.paths?.["/v1/vault/assets/{id}/playback"]).toBeTruthy();
    expect(swaggerDocument?.paths?.["/v1/billing/plan"]).toBeTruthy();
    const out = resolve(__dirname, "../../../packages/api-types/openapi.json");
    writeFileSync(out, JSON.stringify(swaggerDocument, null, 2));
  });
});
