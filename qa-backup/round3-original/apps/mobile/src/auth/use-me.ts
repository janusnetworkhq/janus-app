import { useQuery } from "@tanstack/react-query";
import { get } from "../api/client";
import { keys } from "../api/query";
import type { Me } from "../api/types";
import { useSessionStore } from "./session-store";

export function useMe() {
  const token = useSessionStore((s) => s.accessToken);
  const hydrated = useSessionStore((s) => s.hydrated);
  return useQuery({
    queryKey: keys.me,
    queryFn: () => get<Me>("/v1/me"),
    enabled: hydrated && Boolean(token),
  });
}
