import type { Metadata } from "next";
import Link from "next/link";
import { nestGet } from "@/lib/api";
import type { ModerationItem } from "@/lib/types";
import { formatWhen } from "@/lib/utils";
import { Badge, EmptyState, PageHeader } from "@/components/ui/feedback";
import { Table, Td, Th } from "@/components/ui/table";
import { ModerationDecisionButtons } from "@/components/admin-actions";
import { AdminsOnly } from "@/components/admins-only";
import { getAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Moderation queue" };

export default async function ModerationPage() {
  const admin = await getAdmin();
  if (!admin) return <AdminsOnly />;
  const items = await nestGet<ModerationItem[]>("/v1/admin/moderation");

  return (
    <div>
      <PageHeader
        kicker="Moderation"
        title="Review queue"
        description="Videos waiting for a human decision or flagged by automated checks. Approved videos enter the feed; rejected ones stay hidden and the author is notified."
      />
      {items.length === 0 ? (
        <EmptyState title="Queue is empty" body="Nothing is waiting for review." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Caption</Th>
              <Th>Author</Th>
              <Th>Review</Th>
              <Th>Submitted</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {items.map((v) => (
              <tr key={v.id}>
                <Td className="max-w-xs truncate">{v.caption || "—"}</Td>
                <Td>
                  <Link href={`/talent/${v.author.id}`} className="hover:text-primary">
                    @{v.author.handle}
                  </Link>
                </Td>
                <Td>
                  <Badge tone={v.moderationStatus === "FLAGGED" ? "danger" : "warning"}>{v.moderationStatus}</Badge>
                </Td>
                <Td className="text-muted-foreground">{formatWhen(v.createdAt)}</Td>
                <Td>
                  <ModerationDecisionButtons id={v.id} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
