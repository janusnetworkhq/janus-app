import { EmailService } from "../src/common/email.service";

describe("OTP email fallback (no RESEND_API_KEY)", () => {
  it("succeeds via log fallback and never exposes the code in the return value", async () => {
    const svc = new EmailService();
    const res = await svc.sendOtp({ to: "fallback@janus.test", code: "654321" });
    expect(res.success).toBe(true);
    expect(JSON.stringify(res)).not.toContain("654321");
  });
});
