import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { apiConfig } from "../api/config";
import { post } from "../api/client";
import { queryClient } from "../api/query";
import { useSessionStore, type LocalClaims } from "./session-store";

WebBrowser.maybeCompleteAuthSession();

export async function lookupEmail(email: string): Promise<{
  exists: boolean;
  profileComplete: boolean;
  displayName: string | null;
}> {
  return post("/v1/auth/lookup", { email: email.trim().toLowerCase() }, { auth: false });
}

export async function sendOtp(
  email: string,
  name?: string,
): Promise<{ success: boolean; exists: boolean; message: string }> {
  return post(
    "/v1/auth/otp/send",
    { email: email.trim().toLowerCase(), name: name?.trim() },
    { auth: false }
  );
}

export async function verifyOtp(
  email: string,
  code: string,
  name?: string,
): Promise<{
  accessToken: string;
  isNewUser: boolean;
  profileComplete: boolean;
}> {
  const cleanEmail = email.trim().toLowerCase();
  const res = await post<{
    accessToken: string;
    isNewUser: boolean;
    profileComplete: boolean;
  }>(
    "/v1/auth/otp/verify",
    { email: cleanEmail, code: code.trim(), name: name?.trim() },
    { auth: false }
  );

  const claims: LocalClaims = {
    sub: `local:email:${cleanEmail}`,
    email: cleanEmail,
    name: name?.trim(),
  };

  await useSessionStore.getState().setSession(res.accessToken, claims);
  await queryClient.invalidateQueries({ queryKey: ["me"] });
  return res;
}

export async function signInLocal(input: {
  email?: string;
  phone?: string;
  name?: string;
  provider?: string;
}): Promise<void> {
  const identity = (input.email ?? input.phone ?? "").trim().toLowerCase();
  if (!identity) throw new Error("Email or phone is required");
  const sub = `local:${identity}`;
  const claims: LocalClaims = {
    sub,
    email: input.email?.trim().toLowerCase(),
    phone_number: input.phone,
    name: input.name,
    provider: input.provider ?? (input.phone && !input.email ? "phone" : "Google"),
  };
  const res = await post<{ accessToken: string }>("/v1/dev/tokens", claims, { auth: false });
  await useSessionStore.getState().setSession(res.accessToken, claims);
  await queryClient.invalidateQueries({ queryKey: ["me"] });
}

export async function signOut(): Promise<void> {
  await useSessionStore.getState().clearSession();
  queryClient.clear();
}

export function newIdempotencyKey(): string {
  return Crypto.randomUUID();
}

export async function signInCognito(): Promise<void> {
  if (!apiConfig.cognitoDomain || !apiConfig.cognitoClientId) {
    throw new Error("Cognito is not configured on this build.");
  }
  const redirectUri = "janus://auth";
  const authUrl =
    `https://${apiConfig.cognitoDomain}/oauth2/authorize` +
    `?client_id=${encodeURIComponent(apiConfig.cognitoClientId)}` +
    `&response_type=token` +
    `&scope=${encodeURIComponent("openid email phone profile")}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}`;
  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
  if (result.type !== "success" || !result.url) {
    throw new Error("Sign in was cancelled");
  }
  const hash = result.url.split("#")[1] ?? result.url.split("?")[1] ?? "";
  const params = new URLSearchParams(hash);
  const token = params.get("access_token");
  if (!token) throw new Error("Cognito did not return an access token");
  await useSessionStore.getState().setSession(token, null);
  await queryClient.invalidateQueries({ queryKey: ["me"] });
}
