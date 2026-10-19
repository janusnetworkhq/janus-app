import { existsSync } from "node:fs";
import { resolve } from "node:path";

const envFile = resolve(__dirname, "../../../.env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

process.env.AUTH_MODE = "local";
process.env.MEDIA_DRIVER = "noop";
process.env.TRANSCODE_DRIVER = "mock";
process.env.MODERATION_DRIVER = "noop";
process.env.WORKERS_ENABLED = "false";

// Fixed-OTP allowlist for test-otp.e2e-spec.ts. Includes one non-@janus.test entry on
// purpose to prove the hard domain guard ignores it. No effect on other suites (their
// fixture emails are never these exact addresses).
process.env.TEST_OTP_EMAILS =
  "qa.recruiter@janus.test,qa.student@janus.test,qa.admin@janus.test,outsider@example.com";
