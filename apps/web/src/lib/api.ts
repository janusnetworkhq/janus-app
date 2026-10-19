import { ApiError } from "./errors";
import { apiBaseUrl, isLocalAuth, issueLocalToken } from "./local-token";
import { getAccessToken, getLocalClaims, setSession } from "./session";

type Method = "GET" | "POST" | "PATCH" | "DELETE";

async function remint(): Promise<string | null> {
  // OTP/Cognito sessions cannot be re-minted from claims; only dev tokens can.
  if (!isLocalAuth()) return null;
  const claims = await getLocalClaims();
  if (!claims) return null;
  const token = await issueLocalToken(claims);
  if (!token) return null;
  try {
    await setSession(token, claims);
  } catch {
    // Cookie writes are illegal in Server Components; proxy.ts covers the next navigation.
  }
  return token;
}

export async function nestFetch<T>(
  path: string,
  opts: { method?: Method; body?: unknown; idempotencyKey?: string; auth?: boolean } = {},
): Promise<T> {
  const run = async (token: string | null) => {
    const headers: Record<string, string> = { accept: "application/json" };
    if (opts.body !== undefined) headers["content-type"] = "application/json";
    if (opts.auth !== false && token) headers.authorization = `Bearer ${token}`;
    if (opts.idempotencyKey) headers["idempotency-key"] = opts.idempotencyKey;
    return fetch(`${apiBaseUrl()}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
    });
  };

  const token = opts.auth === false ? null : await getAccessToken();
  let res = await run(token);
  if (res.status === 401 && opts.auth !== false) {
    const next = await remint();
    if (next && next !== token) res = await run(next);
  }

  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (!res.ok) {
    const err =
      json && typeof json === "object" && "error" in json
        ? (json as { error?: { code: string; message: string; requestId: string } }).error
        : null;
    throw new ApiError({
      code: err?.code ?? "HTTP_ERROR",
      message: err?.message ?? `Request failed (${res.status})`,
      status: res.status,
      requestId: err?.requestId ?? "unknown",
    });
  }
  return json as T;
}

export const nestGet = <T>(path: string) => nestFetch<T>(path);
export const nestPost = <T>(path: string, body?: unknown, idempotencyKey?: string) =>
  nestFetch<T>(path, { method: "POST", body, idempotencyKey });
export const nestPatch = <T>(path: string, body?: unknown) => nestFetch<T>(path, { method: "PATCH", body });
export const nestDel = <T>(path: string) => nestFetch<T>(path, { method: "DELETE" });
