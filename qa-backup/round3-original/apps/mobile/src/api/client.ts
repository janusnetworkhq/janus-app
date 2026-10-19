import { apiConfig } from "./config";
import { ApiClientError } from "./errors";
import { useSessionStore } from "../auth/session-store";

type Method = "GET" | "POST" | "PATCH" | "DELETE";

type RequestOpts = {
  method?: Method;
  body?: unknown;
  headers?: Record<string, string>;
  idempotencyKey?: string;
  auth?: boolean;
};

async function mintLocalToken(): Promise<string | null> {
  const claims = useSessionStore.getState().localClaims;
  if (!claims || apiConfig.authMode !== "local") return null;
  const res = await fetch(`${apiConfig.baseUrl}/v1/dev/tokens`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(claims),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { accessToken: string };
  await useSessionStore.getState().setSession(json.accessToken, claims);
  return json.accessToken;
}

export async function api<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const run = async (token: string | null): Promise<Response> => {
    const headers: Record<string, string> = {
      accept: "application/json",
      ...(opts.body ? { "content-type": "application/json" } : {}),
      ...(opts.headers ?? {}),
    };
    if (opts.auth !== false && token) headers.authorization = `Bearer ${token}`;
    if (opts.idempotencyKey) headers["idempotency-key"] = opts.idempotencyKey;
    return fetch(`${apiConfig.baseUrl}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  };

  let token = opts.auth === false ? null : useSessionStore.getState().accessToken;
  let res = await run(token);
  if (res.status === 401 && opts.auth !== false) {
    const next = await mintLocalToken();
    if (next && next !== token) res = await run(next);
  }

  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => null)) as
    | T
    | { error?: { code: string; message: string; requestId: string } }
    | null;

  if (!res.ok) {
    const err = json && typeof json === "object" && "error" in json ? json.error : null;
    throw new ApiClientError({
      code: err?.code ?? "HTTP_ERROR",
      message: err?.message ?? `Request failed (${res.status})`,
      status: res.status,
      requestId: err?.requestId ?? "unknown",
    });
  }
  return json as T;
}

export const get = <T>(path: string) => api<T>(path);
export const post = <T>(path: string, body?: unknown, extra?: Omit<RequestOpts, "method" | "body">) =>
  api<T>(path, { method: "POST", body, ...extra });
export const patch = <T>(path: string, body?: unknown) => api<T>(path, { method: "PATCH", body });
export const del = <T>(path: string) => api<T>(path, { method: "DELETE" });
