import { cookies } from "next/headers";
import {
  CLAIMS_COOKIE,
  SESSION_MAX_AGE,
  TOKEN_COOKIE,
  sessionCookieOptions,
  type LocalClaims,
} from "./session-cookies";

export {
  CLAIMS_COOKIE,
  SESSION_MAX_AGE,
  TOKEN_COOKIE,
  sessionCookieOptions,
  type LocalClaims,
};

export async function getAccessToken(): Promise<string | null> {
  return (await cookies()).get(TOKEN_COOKIE)?.value ?? null;
}

export async function getLocalClaims(): Promise<LocalClaims | null> {
  const raw = (await cookies()).get(CLAIMS_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LocalClaims;
  } catch {
    return null;
  }
}

export async function setSession(token: string, claims: LocalClaims | null): Promise<void> {
  const jar = await cookies();
  jar.set(TOKEN_COOKIE, token, { ...sessionCookieOptions(), maxAge: SESSION_MAX_AGE });
  if (claims) {
    jar.set(CLAIMS_COOKIE, JSON.stringify(claims), {
      ...sessionCookieOptions(),
      maxAge: 60 * 60 * 24 * 30,
    });
  }
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(TOKEN_COOKIE);
  jar.delete(CLAIMS_COOKIE);
}
