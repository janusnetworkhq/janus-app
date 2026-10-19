import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { RedisService } from "../src/common/redis.service";
import { isTestOtpAccount } from "../src/common/config";
import { createApp } from "../src/main";

/**
 * Fixed test OTP (123456) scope tests. Stored codes are planted directly in Redis so the
 * real code is known deterministically ("654321") and never equals the fixed code.
 */
describe("Test OTP allowlist (TEST_OTP_EMAILS)", () => {
  let app: NestFastifyApplication;
  let redis: RedisService;

  const QA = "qa.recruiter@janus.test";
  const NOT_LISTED = "someone.else@janus.test"; // @janus.test but NOT allowlisted
  const OUTSIDER = "outsider@example.com"; // in env list but NOT @janus.test

  async function plant(email: string, code = "654321") {
    await redis.set(`auth:otp:${email}`, JSON.stringify({ code, createdAt: Date.now() }), 600);
    await redis.del(`auth:otp:attempts:${email}`);
  }
  const verify = (email: string, code: string) =>
    app.inject({ method: "POST", url: "/v1/auth/otp/verify", payload: { email, code } });

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    redis = app.get(RedisService);
  });

  afterAll(async () => {
    await app.close();
  });

  it("guard: allowlist + @janus.test are both required", () => {
    expect(isTestOtpAccount(QA)).toBe(true);
    expect(isTestOtpAccount("QA.Recruiter@JANUS.TEST")).toBe(true);
    expect(isTestOtpAccount(NOT_LISTED)).toBe(false);
    expect(isTestOtpAccount(OUTSIDER)).toBe(false);
    expect(isTestOtpAccount("qa.recruiter@example.com")).toBe(false);
  });

  it("fixed code 123456 works for an allowlisted account (real code also still works)", async () => {
    await plant(QA);
    const fixed = await verify(QA, "123456");
    expect(fixed.statusCode).toBe(200);
    expect(JSON.parse(fixed.body).accessToken).toBeDefined();

    await plant(QA); // successful verify consumed the stored code; plant again
    const real = await verify(QA, "654321");
    expect(real.statusCode).toBe(200);
    expect(JSON.parse(real.body).accessToken).toBeDefined();
  });

  it("123456 fails for a non-allowlisted @janus.test user, and for a listed non-@janus.test email", async () => {
    await plant(NOT_LISTED);
    const denied = await verify(NOT_LISTED, "123456");
    expect(denied.statusCode).toBe(400);
    expect(JSON.parse(denied.body).error.code).toBe("INVALID_OTP");

    await plant(OUTSIDER);
    const outsider = await verify(OUTSIDER, "123456");
    expect(outsider.statusCode).toBe(400);
    expect(JSON.parse(outsider.body).error.code).toBe("INVALID_OTP");
  });

  it("wrong codes still count toward the attempt limit for test accounts", async () => {
    await plant(QA);
    const wrong = await verify(QA, "000000");
    expect(wrong.statusCode).toBe(400);
    expect(JSON.parse(wrong.body).error.code).toBe("INVALID_OTP");
    const attempts = await redis.get(`auth:otp:attempts:${QA}`);
    expect(Number(attempts)).toBe(1);

    // The fixed code is not a lockout bypass reset button on its own: after 5 wrong
    // attempts the stored code is burned, so even 123456 then reports expired.
    for (let i = 0; i < 4; i++) await verify(QA, "000000");
    const burned = await verify(QA, "123456");
    expect(burned.statusCode).toBe(400);
    expect(JSON.parse(burned.body).error.code).toBe("OTP_EXPIRED");
  });

  it("end-to-end: send then verify with 123456 for an allowlisted account", async () => {
    await redis.del(`auth:otp:cooldown:${QA}`, `auth:otp:sends:${QA}`, `auth:otp:attempts:${QA}`);
    const send = await app.inject({ method: "POST", url: "/v1/auth/otp/send", payload: { email: QA } });
    expect(send.statusCode).toBe(200);
    expect(send.body).not.toContain("123456");
    const res = await verify(QA, "123456");
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).accessToken).toBeDefined();
  });
});
