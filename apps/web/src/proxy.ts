import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { CLAIMS_COOKIE, SESSION_MAX_AGE, TOKEN_COOKIE, sessionCookieOptions, type LocalClaims } from "./lib/session-cookies";
import { isLocalAuth, issueLocalToken } from "./lib/local-token";

const PUBLIC_PREFIXES = ["/login", "/restricted", "/auth/cognito"];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function cookieHeaderWithSession(request: NextRequest, token: string): Headers {
  const headers = new Headers(request.headers);
  const existing = request.headers.get("cookie") ?? "";
  const rest = existing
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part && !part.startsWith(`${TOKEN_COOKIE}=`));
  rest.push(`${TOKEN_COOKIE}=${token}`);
  headers.set("cookie", rest.join("; "));
  return headers;
}

function applySessionCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set(TOKEN_COOKIE, token, {
    ...sessionCookieOptions(),
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  const claimsRaw = request.cookies.get(CLAIMS_COOKIE)?.value;
  const publicPath = isPublicPath(pathname);

  if (publicPath) {
    if (token && pathname === "/login") {
      return NextResponse.redirect(new URL("/feed", request.url));
    }
    return NextResponse.next();
  }

  if (token) return NextResponse.next();

  if (isLocalAuth() && claimsRaw) {
    try {
      const claims = JSON.parse(claimsRaw) as LocalClaims;
      const accessToken = await issueLocalToken(claims);
      if (accessToken) {
        const response = NextResponse.next({
          request: { headers: cookieHeaderWithSession(request, accessToken) },
        });
        return applySessionCookie(response, accessToken);
      }
    } catch {
      /* fall through to login */
    }
  }

  const login = new URL("/login", request.url);
  if (pathname !== "/feed") login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export default proxy;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
