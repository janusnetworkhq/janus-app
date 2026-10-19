import { existsSync } from "node:fs";
import { resolve } from "node:path";

const envFile = resolve(__dirname, "../../../.env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

process.env.AUTH_MODE = "local";
process.env.MEDIA_DRIVER = "noop";
process.env.TRANSCODE_DRIVER = "mock";
process.env.MODERATION_DRIVER = "noop";
process.env.WORKERS_ENABLED = "false";
