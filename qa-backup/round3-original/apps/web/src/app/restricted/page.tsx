import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Use the mobile app" };

export default function RestrictedPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center">
        <h1 className="text-2xl font-semibold">This portal is for recruiters</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Student accounts publish from the JANUS iOS and Android app. Vault files stay encrypted until a
          recruiter signs an NDA.
        </p>
        <Link href="/login" className={cn(buttonVariants(), "mt-6 inline-flex")}>
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
