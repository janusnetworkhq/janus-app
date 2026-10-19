import type { LocalClaims } from "./session-cookies";

export function apiBaseUrl(): string {
  return (process.env.JANUS_API_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export type WebAuthMode = "local" | "otp" | "cognito";

export function authMode(): WebAuthMode {
  const raw = (process.env.JANUS_AUTH_MODE ?? "local").toLowerCase();
  return raw === "otp" || raw === "cognito" ? raw : "local";
}

/** Dev-token login is available only in explicit local mode (never in production OTP/Cognito). */
export function isLocalAuth(): boolean {
  return authMode() === "local";
}

export async function issueLocalToken(claims: LocalClaims): Promise<string | null> {
  const res = await fetch(`${apiBaseUrl()}/v1/dev/tokens`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(claims),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { accessToken?: string };
  return json.accessToken ?? null;
}
