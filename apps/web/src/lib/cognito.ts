import { createHash, randomBytes } from "node:crypto";

export const PKCE_COOKIE = "janus_pkce";

export function cognitoConfig() {
  const domain = process.env.JANUS_COGNITO_DOMAIN ?? "";
  const clientId = process.env.JANUS_COGNITO_CLIENT_ID ?? "";
  const publicUrl = (process.env.JANUS_PUBLIC_URL ?? "http://localhost:3001").replace(/\/$/, "");
  return {
    enabled: Boolean(domain && clientId),
    domain,
    clientId,
    redirectUri: `${publicUrl}/auth/cognito/callback`,
  };
}

const b64url = (buf: Buffer) => buf.toString("base64url");

/** RFC 7636 verifier/challenge pair plus an anti-CSRF state value. */
export function newPkce() {
  const verifier = b64url(randomBytes(48));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  const state = b64url(randomBytes(24));
  return { verifier, challenge, state };
}
