import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { RedisService } from "../src/common/redis.service";
import { createApp } from "../src/main";

describe("Authentication & Onboarding Flow", () => {
  let app: NestFastifyApplication;
  let redisService: RedisService;

  beforeAll(async () => {
    process.env.AUTH_MODE = "local";
    process.env.MEDIA_DRIVER = "noop";
    process.env.TRANSCODE_DRIVER = "mock";
    process.env.MODERATION_DRIVER = "noop";
    process.env.WORKERS_ENABLED = "false";
    if (!process.env.REDIS_URL) {
      process.env.REDIS_URL = "redis://:janus@localhost:6379/0";
    }

    app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    redisService = app.get(RedisService);
  });

  afterAll(async () => {
    await app.close();
  });

  it("identifies existing users and reports profileComplete: true", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/lookup",
      payload: { email: "arjun@iitm.ac.in" },
    });

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.exists).toBe(true);
    expect(data.profileComplete).toBe(true);
    expect(data.displayName).toBe("Arjun Mehta");
  });

  it("identifies new users and reports exists: false", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/lookup",
      payload: { email: "fresh.innovator.test@berkeley.edu" },
    });

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.exists).toBe(false);
    expect(data.profileComplete).toBe(false);
  });

  it("sends OTP and verifies existing user directly to app", async () => {
    // 1. Send OTP
    // Fixed fixture email: clear the per-email OTP rate limit so back-to-back runs don't 429.
    await redisService.del("auth:otp:cooldown:arjun@iitm.ac.in", "auth:otp:sends:arjun@iitm.ac.in");
    const sendRes = await app.inject({
      method: "POST",
      url: "/v1/auth/otp/send",
      payload: { email: "arjun@iitm.ac.in" },
    });
    expect(sendRes.statusCode).toBe(200);

    // Retrieve OTP via RedisService
    const raw = await redisService.get("auth:otp:arjun@iitm.ac.in");
    expect(raw).toBeDefined();
    const { code } = JSON.parse(raw!);
    expect(code).toBeDefined();
    expect(code.length).toBe(6);

    // 2. Verify OTP
    const verifyRes = await app.inject({
      method: "POST",
      url: "/v1/auth/otp/verify",
      payload: { email: "arjun@iitm.ac.in", code },
    });
    expect(verifyRes.statusCode).toBe(200);
    const verifyData = JSON.parse(verifyRes.body);
    expect(verifyData.accessToken).toBeDefined();
    expect(verifyData.isNewUser).toBe(false);
    expect(verifyData.profileComplete).toBe(true);
  });

  it("sends OTP for new user with Full Name, verifies OTP, and completes onboarding without username", async () => {
    const email = `innovator.${Date.now()}@stanford.edu`;
    const name = "Samantha Chen";

    // 1. Send OTP with name
    const sendRes = await app.inject({
      method: "POST",
      url: "/v1/auth/otp/send",
      payload: { email, name },
    });
    expect(sendRes.statusCode).toBe(200);

    const raw = await redisService.get(`auth:otp:${email}`);
    expect(raw).toBeDefined();
    const { code } = JSON.parse(raw!);
    expect(code).toBeDefined();
    expect(code.length).toBe(6);

    // 2. Verify OTP
    const verifyRes = await app.inject({
      method: "POST",
      url: "/v1/auth/otp/verify",
      payload: { email, code, name },
    });
    expect(verifyRes.statusCode).toBe(200);
    const verifyData = JSON.parse(verifyRes.body);
    expect(verifyData.accessToken).toBeDefined();
    expect(verifyData.isNewUser).toBe(true);
    expect(verifyData.profileComplete).toBe(false);

    // 3. Complete Onboarding profile WITHOUT providing a username (handle)
    const profileRes = await app.inject({
      method: "POST",
      url: "/v1/me/profile",
      headers: {
        authorization: `Bearer ${verifyData.accessToken}`,
      },
      payload: {
        role: "STUDENT",
        displayName: name,
        university: "Stanford University",
        headline: "Autonomous Aerial Robotics Lead",
        city: "Stanford, CA",
      },
    });

    expect(profileRes.statusCode).toBe(201);
    const profile = JSON.parse(profileRes.body);
    expect(profile.profileComplete).toBe(true);
    expect(profile.role).toBe("STUDENT");
    expect(profile.displayName).toBe("Samantha Chen");
    expect(profile.handle).toBeDefined(); // Auto-allocated handle!
    expect(profile.handle.length).toBeGreaterThanOrEqual(3);
  });
});
