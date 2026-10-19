import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Building2, GraduationCap, Mail, UserRound } from "lucide-react";
import { getMe } from "@/lib/auth";
import { Badge, Card, PageHeader } from "@/components/ui/feedback";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Settings" };

function Row({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="w-36 text-sm text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{value}</span>
    </div>
  );
}

export default async function SettingsPage() {
  const me = await getMe();
  if (!me) return null;
  const org = me.recruiterProfile?.org?.name;
  return (
    <div className="page-enter mx-auto max-w-2xl">
      <PageHeader kicker="Account" title="Settings" description="Your profile as recruiters and students see it, and how your account is set up." />
      <Card>
        <div className="flex items-center gap-4">
          <span className="flex size-14 items-center justify-center rounded-full bg-primary/15 text-lg font-bold text-primary" aria-hidden>
            {(me.displayName ?? me.handle).replace("@", "").slice(0, 2).toUpperCase()}
          </span>
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              {me.displayName ?? `@${me.handle}`}
              {me.profileComplete ? <BadgeCheck className="size-4 text-primary" aria-label="Profile complete" /> : null}
            </h2>
            <p className="text-sm text-muted-foreground">@{me.handle}</p>
          </div>
          <Badge tone="accent">{me.role ?? "—"}</Badge>
        </div>
        <div className="mt-4 divide-y divide-border/70 border-t border-border/70">
          <Row icon={Mail} label="Email" value={me.email ?? "—"} />
          <Row icon={UserRound} label="Display name" value={me.displayName ?? "—"} />
          {org ? <Row icon={Building2} label="Organisation" value={org} /> : null}
          {me.recruiterProfile?.title ? <Row icon={UserRound} label="Title" value={me.recruiterProfile.title} /> : null}
          {me.studentProfile?.university ? <Row icon={GraduationCap} label="University" value={me.studentProfile.university} /> : null}
          {me.studentProfile?.headline ? <Row icon={UserRound} label="Headline" value={me.studentProfile.headline} /> : null}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/onboarding" className={cn(buttonVariants(), "inline-flex")}>Edit profile</Link>
          <Link href="/docs" className={cn(buttonVariants({ variant: "secondary" }), "inline-flex")}>Read the docs</Link>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Sign-in is email OTP only — there is no password to rotate. Use Sign out in the sidebar on shared machines.
        </p>
      </Card>
    </div>
  );
}
