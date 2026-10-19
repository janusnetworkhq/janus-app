import Link from "next/link";
import { Card } from "@/components/ui/feedback";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AdminsOnly() {
  return (
    <Card className="mx-auto max-w-lg">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Restricted</p>
      <h1 className="mt-2 text-2xl font-semibold">Platform admins only</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Video hide, user suspend, and the audit log are limited to operators. Recruiter sessions stay on
        the hiring desk.
      </p>
      <Link href="/feed" className={cn(buttonVariants(), "mt-6 inline-flex")}>
        Back to feed
      </Link>
    </Card>
  );
}
