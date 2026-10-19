"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { nestDel, nestGet, nestPatch, nestPost } from "./api";
import { ApiError } from "./errors";
import { issueLocalToken } from "./local-token";
import { clearSession, setSession, type LocalClaims } from "./session";
import { OTP_SESSION_MAX_AGE } from "./session-cookies";
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
  if (!accessToken) return { error: "Could not sign you in. Please check your connection and try again." };
  await setSession(accessToken, claims);
  redirect(next);
}

export type OtpState = {
  stage?: "email" | "code";
  email?: string;
  name?: string;
  error?: string;
  notice?: string;
  /** epoch ms when the resend button unlocks (API enforces a 30s cooldown) */
  resendAt?: number;
};

type OtpVerifyResponse = {
  accessToken: string;
  isNewUser: boolean;
  profileComplete: boolean;
  user: { id: string; email: string | null; displayName: string | null };
};

function friendlyOtpError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.code === "RATE_LIMITED" || error.status === 429) return error.message;
    if (error.code === "INVALID_OTP") return "That code is not correct. Check the 6 digits and try again.";
    if (error.code === "OTP_EXPIRED") return "That code has expired. Request a new code and try again.";
    if (error.code === "VALIDATION_ERROR") return "Enter a valid email address and a 6-digit code.";
    return error.userMessage;
  }
  return fallback;
}

/**
 * Email-OTP login (production). One action, three intents:
 * send (lookup + otp/send) -> code screen, resend (cooldown-guarded), verify
 * (exchanges the code for the API session token, stored only in an httpOnly cookie).
 */
export async function otpLogin(_prev: OtpState | undefined, formData: FormData): Promise<OtpState> {
  const intent = String(formData.get("intent") ?? "send");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const next = safeNextPath(String(formData.get("next") ?? "/feed"));
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { stage: "email", email, name, error: "Enter a valid email address." };
  }

  if (intent === "verify") {
    const code = String(formData.get("code") ?? "").trim();
    if (!/^\d{6}$/.test(code)) {
      return { stage: "code", email, name, resendAt: Number(formData.get("resendAt") ?? 0) || undefined, error: "Enter the 6-digit code from your email." };
    }
    let verified: OtpVerifyResponse;
    try {
      verified = await nestPost<OtpVerifyResponse>("/v1/auth/otp/verify", { email, code, name: name || undefined });
    } catch (error) {
      return { stage: "code", email, name, resendAt: Number(formData.get("resendAt") ?? 0) || undefined, error: friendlyOtpError(error, "Could not verify that code. Please try again.") };
    }
    await setSession(verified.accessToken, null, OTP_SESSION_MAX_AGE);
    redirect(verified.profileComplete ? next : "/onboarding");
  }

  // send / resend
  try {
    if (intent === "send") {
      await nestPost("/v1/auth/lookup", { email }).catch(() => null);
    }
    await nestPost("/v1/auth/otp/send", { email, name: name || undefined });
  } catch (error) {
    return {
      stage: intent === "resend" ? "code" : "email",
      email,
      name,
      resendAt: intent === "resend" ? Date.now() + 30_000 : undefined,
      error: friendlyOtpError(error, "Could not send a code right now. Please try again in a moment."),
    };
  }
  return {
    stage: "code",
    email,
    name,
    resendAt: Date.now() + 30_000,
    notice: intent === "resend" ? "A new code is on its way to your email." : "We sent a 6-digit code to your email. It expires in 10 minutes.",
  };
}

export async function markNotificationsRead(): Promise<void> {
  try {
    await nestPost("/v1/notifications/read-all");
  } catch {
    /* best-effort: page reload will show current state */
  }
  revalidatePath("/notifications");
  revalidatePath("/feed");
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

export async function moderateVideo(
  id: string,
  decision: "APPROVE" | "REJECT",
): Promise<{ error?: string }> {
  try {
    await nestPost(`/v1/admin/videos/${id}/moderation`, { decision });
    revalidatePath("/admin/moderation");
    revalidatePath("/admin/videos");
    return {};
  } catch (error) {
    return { error: error instanceof ApiError ? error.userMessage : "Could not record the decision." };
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
