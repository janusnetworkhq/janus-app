import type { Metadata } from "next";
import Link from "next/link";
import { nestGet } from "@/lib/api";
import type { NdaRequest } from "@/lib/types";
import { formatWhen } from "@/lib/utils";
import { Badge, EmptyState, PageHeader } from "@/components/ui/feedback";
import { Table, Td, Th } from "@/components/ui/table";

export const metadata: Metadata = { title: "NDA requests" };

const tone: Record<NdaRequest["status"], "muted" | "accent" | "danger" | "warning"> = {
  PENDING: "warning",
  ACCEPTED: "accent",
  REJECTED: "danger",
  EXPIRED: "muted",
};

export default async function RequestsPage() {
  const items = await nestGet<NdaRequest[]>("/v1/nda/outbound");

  return (
    <div>
      <PageHeader
        kicker="Legal"
        title="Outbound NDAs"
        description="Request from a talent card, wait for the student to accept, then sign here."
      />
      {items.length === 0 ? (
        <EmptyState
          title="No requests yet"
          body="Open a student from the feed and request an NDA to review their vault."
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Student</Th>
              <Th>Status</Th>
              <Th>Requested</Th>
              <Th>Expires</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id}>
                <Td>
                  <Link href={`/talent/${row.studentId}`} className="font-medium hover:text-primary">
                    @{row.student?.handle ?? row.studentId.slice(0, 8)}
                  </Link>
                </Td>
                <Td>
                  <Badge tone={tone[row.status]}>{row.status}</Badge>
                </Td>
                <Td className="text-muted-foreground">{formatWhen(row.createdAt)}</Td>
                <Td className="text-muted-foreground">{formatWhen(row.expiresAt)}</Td>
                <Td>
                  <Link href={`/nda/${row.id}`} className="text-sm font-semibold text-primary">
                    Open
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
