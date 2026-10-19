import { redirect } from "next/navigation";
import { nestGet } from "./api";
import { getAccessToken } from "./session";
import type { Me } from "./types";

export async function getMe(): Promise<Me | null> {
  const token = await getAccessToken();
  if (!token) return null;
  try {
    return await nestGet<Me>("/v1/me");
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<Me> {
  const me = await getMe();
  if (!me) redirect("/login");
  return me;
}

export async function requireRecruiter(): Promise<Me> {
  const me = await requireSession();
  if (!me.profileComplete) redirect("/onboarding");
  if (me.role === "STUDENT") redirect("/restricted");
  return me;
}

export async function getAdmin(): Promise<Me | null> {
  const me = await requireRecruiter();
  if (me.role !== "PLATFORM_ADMIN") return null;
  return me;
}
