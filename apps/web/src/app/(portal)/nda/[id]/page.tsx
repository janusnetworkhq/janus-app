import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { nestGet } from "@/lib/api";
import type { NdaRequest, NdaTemplate } from "@/lib/types";
import { Badge, Card } from "@/components/ui/feedback";
import { NdaSignForm } from "@/components/nda-sign-form";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Sign NDA" };

export default async function NdaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [outbound, template] = await Promise.all([
    nestGet<NdaRequest[]>("/v1/nda/outbound"),
    nestGet<NdaTemplate>("/v1/nda/templates/default"),
  ]);
  const request = outbound.find((row) => row.id === id);
  if (!request) notFound();

  if (request.status === "PENDING") {
    return (
      <Card className="mx-auto max-w-lg">
        <Badge tone="warning">Waiting on student</Badge>
        <h1 className="mt-3 text-2xl font-semibold">NDA requested</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          @{request.student?.handle ?? "student"} must accept in the mobile inbox before you can sign.
        </p>
        <Link href="/requests" className={cn(buttonVariants({ variant: "secondary" }), "mt-6 inline-flex")}>
          Back to requests
        </Link>
      </Card>
    );
  }

  if (request.status === "REJECTED" || request.status === "EXPIRED") {
    return (
      <Card className="mx-auto max-w-lg">
        <Badge tone="danger">{request.status}</Badge>
        <h1 className="mt-3 text-2xl font-semibold">This request is closed</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Start a new request from the talent card if you still need vault access.
        </p>
        <Link
          href={`/talent/${request.studentId}`}
          className={cn(buttonVariants(), "mt-6 inline-flex")}
        >
          Open profile
        </Link>
      </Card>
    );
  }

  return <NdaSignForm requestId={request.id} studentId={request.studentId} template={template} />;
}
