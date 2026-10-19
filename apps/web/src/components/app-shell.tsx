import type { ReactNode } from "react";
import Link from "next/link";
import { signOut } from "@/lib/actions";
import type { Me } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { SideNav } from "@/components/side-nav";

export function AppShell({ me, children }: { me: Me; children: ReactNode }) {
  const org = me.recruiterProfile?.org?.name;
  return (
    <div className="flex min-h-full">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-card px-4 py-5 md:flex">
        <Link href="/feed" className="px-3 text-lg font-semibold tracking-tight">
          JANUS
        </Link>
        <p className="mt-1 px-3 text-xs text-muted-foreground">Recruiter portal</p>
        <div className="mt-8 flex-1">
          <SideNav isAdmin={me.role === "PLATFORM_ADMIN"} />
        </div>
        <div className="border-t border-border pt-4">
          <p className="truncate px-3 text-sm font-medium">{me.displayName ?? me.handle}</p>
          <p className="truncate px-3 text-xs text-muted-foreground">{org ?? me.email}</p>
          <form action={signOut} className="mt-3 px-1">
            <Button type="submit" variant="ghost" size="sm" className="w-full">
              Sign out
            </Button>
          </form>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-4 py-3 md:hidden">
          <Link href="/feed" className="font-semibold">
            JANUS
          </Link>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </header>
        <div className="border-b border-border px-4 py-2 md:hidden">
          <SideNav isAdmin={me.role === "PLATFORM_ADMIN"} />
        </div>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
