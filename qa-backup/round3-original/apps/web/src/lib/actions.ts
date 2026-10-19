"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { nestDel, nestGet, nestPatch, nestPost } from "./api";
import { ApiError } from "./errors";
import { issueLocalToken } from "./local-token";
import { clearSession, setSession, type LocalClaims } from "./session";
import type { FeedPage, Me, NdaRequest } from "./types";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/feed";
  return raw;
}

export async function signInLocal(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const next = safeNextPath(String(formData.get("next") ?? "/feed"));
  if (!email.includes("@")) return { error: "Enter a valid work email." };

  const claims: LocalClaims = {
    sub: `local:${email}`,
    email,
    name: name || email.split("@")[0],
    provider: "Google",
  };

  const accessToken = await issueLocalToken(claims);
  if (!accessToken) return { error: "Could not issue a local session. Is the API running on :3000?" };
  await setSession(accessToken, claims);
  redirect(next);
}

export async function signOut(): Promise<void> {
  await clearSession();
  redirect("/login");
}

export async function completeOnboarding(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const orgName = String(formData.get("orgName") ?? "").trim();
  const handle = String(formData.get("handle") ?? "")
    .trim()
    .toLowerCase();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const orgSlugRaw = String(formData.get("orgSlug") ?? "")
    .trim()
    .toLowerCase();
  if (handle.length < 3 || !displayName || !orgName) {
    return { error: "Handle, name, and organization are required." };
  }
  const orgSlug =
    orgSlugRaw.replace(/[^a-z0-9]+/g, "").slice(0, 40) ||
    orgName.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 40);
  try {
    await nestPost<Me>("/v1/me/profile", {
      role: "RECRUITER",
      handle,
      displayName,
      orgName,
      orgSlug,
      title: title || undefined,
    });
  } catch (error) {
    return { error: error instanceof ApiError ? error.userMessage : "Could not save profile." };
  }
  redirect("/feed");
}

export async function loadFeedPage(cursor: string | null, university?: string): Promise<FeedPage> {
  const params = new URLSearchParams({ limit: "8" });
  if (cursor) params.set("cursor", cursor);
  if (university) params.set("university", university);
  return nestGet<FeedPage>(`/v1/feed?${params.toString()}`);
}

export async function recordImpressions(videoIds: string[]): Promise<void> {
  if (videoIds.length === 0) return;
  try {
    await nestPost("/v1/impressions", { videoIds: videoIds.slice(0, 20) });
  } catch {
    /* impressions are best-effort */
  }
}

export async function toggleLike(videoId: string, liked: boolean): Promise<{ error?: string }> {
  try {
    if (liked) await nestDel(`/v1/videos/${videoId}/like`);
    else await nestPost(`/v1/videos/${videoId}/like`);
    return {};
  } catch (error) {
    return { error: error instanceof ApiError ? error.userMessage : "Could not update like." };
  }
}

export async function requestNda(
  studentId: string,
  videoId?: string,
): Promise<{ error?: string; id?: string }> {
  try {
    const row = await nestPost<NdaRequest>(
      "/v1/nda/requests",
      { studentId, videoId: videoId || undefined },
      crypto.randomUUID(),
    );
    revalidatePath("/requests");
    return { id: row.id };
  } catch (error) {
    return { error: error instanceof ApiError ? error.userMessage : "Could not request NDA." };
  }
}

export async function requestNdaAndGo(studentId: string, videoId?: string): Promise<{ error?: string }> {
  const result = await requestNda(studentId, videoId);
  if (result.error) return result;
  redirect(result.id ? `/nda/${result.id}` : "/requests");
}

export async function signNda(
  requestId: string,
  studentId: string,
  typedName: string,
  acceptedHash: string,
): Promise<{ error?: string }> {
  try {
    await nestPost(
      `/v1/nda/requests/${requestId}/sign`,
      { typedName, acceptedHash },
      crypto.randomUUID(),
    );
  } catch (error) {
    return { error: error instanceof ApiError ? error.userMessage : "Could not sign NDA." };
  }
  revalidatePath("/requests");
  revalidatePath(`/vault/${studentId}`);
  redirect(`/vault/${studentId}`);
}

export async function hideVideo(id: string, status: "HIDDEN" | "READY"): Promise<{ error?: string }> {
  try {
    await nestPatch(`/v1/admin/videos/${id}`, { status });
    revalidatePath("/admin/videos");
    return {};
  } catch (error) {
    return { error: error instanceof ApiError ? error.userMessage : "Could not update video." };
  }
}

export async function setUserStatus(
  id: string,
  status: "ACTIVE" | "SUSPENDED",
): Promise<{ error?: string }> {
  try {
    await nestPatch(`/v1/admin/users/${id}`, { status });
    revalidatePath("/admin/users");
    return {};
  } catch (error) {
    return { error: error instanceof ApiError ? error.userMessage : "Could not update user." };
  }
}
