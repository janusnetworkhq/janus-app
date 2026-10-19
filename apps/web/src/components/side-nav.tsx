"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenText, ClipboardList, LayoutGrid, Settings, Shield, ShieldCheck, Users, Video } from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; icon: typeof LayoutGrid; exact?: boolean };

const recruiterNav: Item[] = [
  { href: "/feed", label: "Feed", icon: LayoutGrid, exact: true },
  { href: "/requests", label: "NDA requests", icon: ClipboardList, exact: true },
  { href: "/docs", label: "Docs", icon: BookOpenText },
  { href: "/settings", label: "Settings", icon: Settings },
];

const adminNav: Item[] = [
  { href: "/admin/moderation", label: "Moderation", icon: ShieldCheck },
  { href: "/admin/videos", label: "Videos", icon: Video },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/audit", label: "Audit", icon: Shield },
];

function NavList({ items }: { items: Item[] }) {
  const pathname = usePathname();
  return (
    <ul className="grid gap-1">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function SideNav({ isAdmin }: { isAdmin: boolean }) {
  return (
    <nav className="grid gap-6" aria-label="Portal">
      <NavList items={recruiterNav} />
      {isAdmin ? (
        <div>
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Moderation
          </p>
          <NavList items={adminNav} />
        </div>
      ) : null}
    </nav>
  );
}
