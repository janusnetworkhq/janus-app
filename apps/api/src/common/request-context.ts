import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

type Store = { requestId: string };

export const requestContext = new AsyncLocalStorage<Store>();

export function getRequestId(): string {
  return requestContext.getStore()?.requestId ?? "unknown";
}

export function newRequestId(incoming?: string): string {
  return incoming && incoming.length < 80 ? incoming : randomUUID();
}
