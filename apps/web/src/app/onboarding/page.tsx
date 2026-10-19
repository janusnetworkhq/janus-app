import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/auth-forms";
import { requireSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Organization profile" };

export default async function OnboardingPage() {
  const me = await requireSession();
  if (me.profileComplete) redirect("/feed");
  if (me.role === "STUDENT") redirect("/restricted");
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Onboarding</p>
        <h1 className="mt-2 text-2xl font-semibold">Your hiring desk</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Recruiters need an organization on file before NDAs can be requested.
        </p>
        <div className="mt-6">
          <OnboardingForm
            defaults={{
              handle: me.handle,
              displayName: me.displayName ?? me.handle,
            }}
          />
        </div>
      </div>
    </div>
  );
}
