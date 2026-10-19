import type { Metadata } from "next";
import { nestGet } from "@/lib/api";
import type { AuditEvent } from "@/lib/types";
import { formatWhen } from "@/lib/utils";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { AdminsOnly } from "@/components/admins-only";
import { getAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Audit log" };

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ resourceType?: string; resourceId?: string }>;
}) {
  const admin = await getAdmin();
  if (!admin) return <AdminsOnly />;
  const { resourceType, resourceId } = await searchParams;
  const params = new URLSearchParams();
  if (resourceType) params.set("resourceType", resourceType);
  if (resourceId) params.set("resourceId", resourceId);
  const qs = params.toString() ? `?${params.toString()}` : "";
  const events = await nestGet<AuditEvent[]>(`/v1/admin/audit${qs}`);

  return (
    <div>
      <PageHeader
        kicker="Moderation"
        title="Audit"
        description="Vault opens, NDA lifecycle, and moderation actions. Filter by resource when investigating an incident."
        actions={
          <form className="flex flex-wrap gap-2" action="/admin/audit">
            <Input name="resourceType" placeholder="resource type" defaultValue={resourceType} className="w-40" />
            <Input name="resourceId" placeholder="resource id" defaultValue={resourceId} className="w-48" />
            <Button type="submit" variant="secondary">
              Filter
            </Button>
          </form>
        }
      />
      {events.length === 0 ? (
        <EmptyState title="No events" body="Audit rows appear when recruiters open vault files or admins moderate." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Action</Th>
              <Th>Resource</Th>
              <Th>Actor</Th>
              <Th>Metadata</Th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <Td className="whitespace-nowrap text-muted-foreground">{formatWhen(event.createdAt)}</Td>
                <Td className="font-medium">{event.action}</Td>
                <Td className="font-mono text-xs">
                  {event.resourceType}:{event.resourceId.slice(0, 12)}
                </Td>
                <Td className="font-mono text-xs text-muted-foreground">{event.actorId?.slice(0, 12) ?? "—"}</Td>
                <Td className="max-w-xs truncate font-mono text-xs text-muted-foreground">
                  {event.metadata ? JSON.stringify(event.metadata) : "—"}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
