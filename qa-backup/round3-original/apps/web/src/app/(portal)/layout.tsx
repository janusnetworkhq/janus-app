import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requireRecruiter } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const me = await requireRecruiter();
  return <AppShell me={me}>{children}</AppShell>;
}
