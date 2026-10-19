import type { Metadata } from "next";
import { LoginForm } from "@/components/auth-forms";
import { isLocalAuth } from "@/lib/local-token";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const local = isLocalAuth();
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
          ) : (
            <p className="text-sm text-muted-foreground">
              Cognito Hosted UI is not wired in this environment. Set <code>JANUS_AUTH_MODE=local</code> for
              development.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
