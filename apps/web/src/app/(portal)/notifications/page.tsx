import type { Metadata } from "next";
import { nestGet } from "@/lib/api";
import { markNotificationsRead } from "@/lib/actions";
import type { NotificationPage } from "@/lib/types";
import { formatWhen } from "@/lib/utils";
import { Badge, EmptyState, PageHeader } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const data = await nestGet<NotificationPage>("/v1/notifications");
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        kicker="Inbox"
        title="Notifications"
        description={data.unread > 0 ? `${data.unread} unread` : "You're all caught up."}
        actions={
          data.unread > 0 ? (
            <form action={markNotificationsRead}>
              <Button type="submit" variant="secondary" size="sm">
                Mark all read
              </Button>
            </form>
          ) : undefined
        }
      />
      {data.items.length === 0 ? (
        <EmptyState title="No notifications yet" body="NDA updates, video reviews and vault activity will appear here." />
      ) : (
        <ul className="grid gap-3">
          {data.items.map((n) => (
            <li key={n.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">{n.title}</p>
                {n.readAt ? <Badge tone="muted">Read</Badge> : <Badge>New</Badge>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
              <p className="mt-2 text-xs text-muted-foreground">{formatWhen(n.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
