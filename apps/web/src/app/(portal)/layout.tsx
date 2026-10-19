import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requireRecruiter } from "@/lib/auth";
import { nestGet } from "@/lib/api";
import type { NotificationPage } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const me = await requireRecruiter();
  let unread = 0;
  try {
    unread = (await nestGet<NotificationPage>("/v1/notifications")).unread;
  } catch {
    unread = 0;
  }
  return (
    <AppShell me={me} unreadCount={unread}>
      {children}
    </AppShell>
  );
}
