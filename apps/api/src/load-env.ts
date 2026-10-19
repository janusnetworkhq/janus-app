import { existsSync } from "node:fs";
import { resolve } from "node:path";

const candidates = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../../.env"),
  resolve(__dirname, "../../../.env"),
  resolve(__dirname, "../../../../.env"),
];
for (const file of candidates) {
  if (existsSync(file)) {
    process.loadEnvFile(file);
    break;
  }
}
