import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { nestGet } from "@/lib/api";
import type { NdaRequest, NdaTemplate } from "@/lib/types";
import { formatWhen } from "@/lib/utils";
import { Badge, Card } from "@/components/ui/feedback";
import { NdaSignForm } from "@/components/nda-sign-form";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Sign NDA" };

function Steps({ current }: { current: 1 | 2 | 3 }) {
  const steps = ["Student accepts", "You sign", "Vault opens (7 days)"];
  return (
    <ol className="mb-6 flex flex-wrap gap-2" aria-label="NDA progress">
      {steps.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const done = n < current;
        const active = n === current;
        return (
          <li
            key={label}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold",
              done && "bg-primary/15 text-primary",
              active && "bg-primary text-primary-foreground",
              !done && !active && "bg-muted text-muted-foreground",
            )}
          >
            {n}. {label}{done ? " ✓" : ""}
          </li>
        );
      })}
    </ol>
  );
}

export default async function NdaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const outbound = await nestGet<NdaRequest[]>("/v1/nda/outbound");
  const request = outbound.find((row) => row.id === id);
  if (!request) notFound();
  const name = request.student?.displayName ?? (request.student ? `@${request.student.handle}` : "the student");

  // Signed already: never show the sign form again — go straight to the vault.
  if (request.agreement) {
    return (
      <div>
        <Steps current={3} />
        <Card className="page-enter mx-auto max-w-lg text-center">
          <ShieldCheck className="mx-auto size-10 text-primary" aria-hidden />
          <h1 className="mt-3 text-2xl font-semibold">NDA signed — vault open</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You signed the agreement with {name} on {formatWhen(request.agreement.signedAt)}. Re-signing is not
            possible or needed.
          </p>
          {request.agreement.signatureSha256 ? (
            <p className="mt-3 font-mono text-[11px] break-all text-muted-foreground">
              Signature SHA-256 {request.agreement.signatureSha256}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href={`/vault/${request.studentId}`} className={cn(buttonVariants(), "inline-flex")}>
              Open vault
            </Link>
            <Link href="/requests" className={cn(buttonVariants({ variant: "secondary" }), "inline-flex")}>
              All requests
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (request.status === "PENDING") {
    return (
      <div>
        <Steps current={1} />
        <Card className="page-enter mx-auto max-w-lg">
          <Badge tone="warning">Waiting on student</Badge>
          <h1 className="mt-3 text-2xl font-semibold">NDA requested</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {name} must accept in their inbox before you can sign. Nothing is needed from you right now — this page
            will move to signing once they accept.
          </p>
          <Link href="/requests" className={cn(buttonVariants({ variant: "secondary" }), "mt-6 inline-flex")}>
            Back to requests
          </Link>
        </Card>
      </div>
    );
  }

  if (request.status === "REJECTED" || request.status === "EXPIRED") {
    return (
      <div>
        <Steps current={1} />
        <Card className="page-enter mx-auto max-w-lg">
          <Badge tone="danger">{request.status}</Badge>
          <h1 className="mt-3 text-2xl font-semibold">This request is closed</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Start a new request from the talent profile if you still need vault access.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href={`/talent/${request.studentId}`} className={cn(buttonVariants(), "inline-flex")}>
              Open profile
            </Link>
            <Link href="/requests" className={cn(buttonVariants({ variant: "secondary" }), "inline-flex")}>
              All requests
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const template = await nestGet<NdaTemplate>("/v1/nda/templates/default");
  return (
    <div>
      <Steps current={2} />
      <NdaSignForm requestId={request.id} studentId={request.studentId} template={template} />
    </div>
  );
}
