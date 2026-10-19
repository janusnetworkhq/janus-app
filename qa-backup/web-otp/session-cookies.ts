export const TOKEN_COOKIE = "janus_session";
export const CLAIMS_COOKIE = "janus_claims";

/** Matches Nest local JWT `expiresIn: 900`. */
export const SESSION_MAX_AGE = 60 * 15;

export type LocalClaims = {
  sub: string;
  email?: string;
  name?: string;
  provider?: string;
};

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}
