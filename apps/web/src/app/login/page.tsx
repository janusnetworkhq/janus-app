import type { Metadata } from "next";
import { LoginForm } from "@/components/auth-forms";
import { isLocalAuth } from "@/lib/local-token";
import { cognitoConfig } from "@/lib/cognito";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const local = isLocalAuth();
  const cognito = cognitoConfig();
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">JANUS</p>
        <h1 className="mt-2 text-2xl font-semibold">Recruiter portal</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign NDAs and review vault files on desktop. Students should use the mobile app.
        </p>
        <div className="mt-6">
          {local ? (
            <LoginForm next={next} />
          ) : cognito.enabled ? (
            <a
              href={`/auth/cognito/start${next ? `?next=${encodeURIComponent(next)}` : ""}`}
              className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Continue with JANUS sign-in
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">
              Set <code>JANUS_COGNITO_DOMAIN</code> and <code>JANUS_COGNITO_CLIENT_ID</code> to enable Cognito sign-in,
              or <code>JANUS_AUTH_MODE=local</code> for development.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
