import { NextResponse, type NextRequest } from "next/server";
import { cognitoConfig, newPkce, PKCE_COOKIE } from "@/lib/cognito";
import { sessionCookieOptions } from "@/lib/session-cookies";

/** Starts the Cognito Hosted UI authorization-code + PKCE flow. */
export function GET(req: NextRequest) {
  const cfg = cognitoConfig();
  if (!cfg.enabled) return NextResponse.redirect(new URL("/login?error=cognito_not_configured", req.url));
  const { verifier, challenge, state } = newPkce();
  const next = req.nextUrl.searchParams.get("next") ?? "/feed";
  const url = new URL(`https://${cfg.domain}/oauth2/authorize`);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    scope: "openid email profile",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  }).toString();
  const res = NextResponse.redirect(url);
  res.cookies.set(PKCE_COOKIE, JSON.stringify({ verifier, state, next }), {
    ...sessionCookieOptions(),
    maxAge: 600,
  });
  return res;
}
