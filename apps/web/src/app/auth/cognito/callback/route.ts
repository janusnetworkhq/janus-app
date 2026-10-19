import { NextResponse, type NextRequest } from "next/server";
import { cognitoConfig, PKCE_COOKIE } from "@/lib/cognito";
import { SESSION_MAX_AGE, TOKEN_COOKIE, sessionCookieOptions } from "@/lib/session-cookies";

function safeNext(raw: unknown): string {
  return typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/feed";
}

/** Exchanges the authorization code (with the PKCE verifier) server-side and sets the session cookie. */
export async function GET(req: NextRequest) {
  const cfg = cognitoConfig();
  const fail = (code: string) => {
    const res = NextResponse.redirect(new URL(`/login?error=${code}`, req.url));
    res.cookies.delete(PKCE_COOKIE);
    return res;
  };
  if (!cfg.enabled) return fail("cognito_not_configured");

  let saved: { verifier?: string; state?: string; next?: string } = {};
  try {
    saved = JSON.parse(req.cookies.get(PKCE_COOKIE)?.value ?? "{}");
  } catch {
    return fail("bad_state");
  }
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (!code || !state || !saved.verifier || state !== saved.state) return fail("bad_state");

  const tokenRes = await fetch(`https://${cfg.domain}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: cfg.clientId,
      code,
      redirect_uri: cfg.redirectUri,
      code_verifier: saved.verifier,
    }),
    cache: "no-store",
  });
  if (!tokenRes.ok) return fail("token_exchange");
  const tokens = (await tokenRes.json()) as { id_token?: string; access_token?: string; expires_in?: number };
  const token = tokens.id_token ?? tokens.access_token;
  if (!token) return fail("token_exchange");

  const res = NextResponse.redirect(new URL(safeNext(saved.next), req.url));
  res.cookies.delete(PKCE_COOKIE);
  res.cookies.set(TOKEN_COOKIE, token, {
    ...sessionCookieOptions(),
    maxAge: Math.min(tokens.expires_in ?? SESSION_MAX_AGE, 3600),
  });
  return res;
}
