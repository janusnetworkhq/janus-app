import http from "k6/http";

const BASE = (__ENV.BASE_URL || "http://localhost:3000").replace(/\/$/, "");

export function baseUrl() {
  return BASE;
}

export function jsonHeaders(token) {
  const headers = { "content-type": "application/json", accept: "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

export function mintLocalToken(sub) {
  const res = http.post(
    `${baseUrl()}/v1/dev/tokens`,
    JSON.stringify({
      sub: sub || `k6:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      email: `k6-${(sub || Math.random().toString(36)).replace(/[^a-z0-9]/gi, "").slice(0, 24)}@load.janus.test`,
      name: "k6 load",
      provider: "Google",
    }),
    { headers: jsonHeaders() },
  );
  if (res.status !== 200) {
    return __ENV.TOKEN || "";
  }
  return res.json("accessToken");
}

export function authToken() {
  if (__ENV.TOKEN) return __ENV.TOKEN;
  return mintLocalToken();
}

/**
 * Staging passes TOKEN (Cognito, already onboarded).
 * Local AUTH_MODE=local mints a JWT and completes /v1/me/profile so feed/vault guards pass.
 */
export function onboard(role) {
  if (__ENV.TOKEN) return __ENV.TOKEN;
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const token = mintLocalToken(`k6:${role}:${stamp}`);
  const handle = `k6${stamp}`.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30);
  const body =
    role === "RECRUITER"
      ? {
          role: "RECRUITER",
          displayName: "k6 recruiter",
          orgName: "k6 load",
          orgSlug: handle,
        }
      : {
          role: "STUDENT",
          handle,
          displayName: "k6 student",
          university: "k6",
        };
  const res = http.post(`${baseUrl()}/v1/me/profile`, JSON.stringify(body), {
    headers: jsonHeaders(token),
  });
  if (res.status !== 200 && res.status !== 201) {
    console.warn(`onboard ${role} ${res.status}: ${res.body}`);
  }
  return token;
}

export function tokenPool(role, count) {
  if (__ENV.TOKEN) return [__ENV.TOKEN];
  const n = Math.max(1, Number(__ENV.TOKEN_POOL || count));
  const tokens = [];
  for (let i = 0; i < n; i++) tokens.push(onboard(role));
  return tokens;
}

export function pick(tokens, iter) {
  if (!tokens || tokens.length === 0) return "";
  return tokens[(iter ?? Math.floor(Math.random() * tokens.length)) % tokens.length];
}

export function firstFeedVideoId(token) {
  const res = http.get(`${baseUrl()}/v1/feed?limit=1`, { headers: jsonHeaders(token) });
  if (res.status !== 200) return "";
  try {
    return res.json("items.0.id") || "";
  } catch {
    return "";
  }
}
