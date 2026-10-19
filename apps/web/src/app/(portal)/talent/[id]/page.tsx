import type { Metadata } from "next";
import Link from "next/link";
import { nestGet } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import type { PublicCard } from "@/lib/types";
import { RequestNdaButton } from "@/components/request-nda-button";
import { Badge, Card, PageHeader } from "@/components/ui/feedback";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Talent" };

export default async function TalentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let card: PublicCard;
  try {
    card = await nestGet<PublicCard>(`/v1/users/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader kicker="Talent" title={card.displayName ?? `@${card.handle}`} />
      <Card>
        <p className="text-sm text-muted-foreground">@{card.handle}</p>
        {card.student?.headline ? <p className="mt-2">{card.student.headline}</p> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {card.student?.university ? <Badge>{card.student.university}</Badge> : null}
          {card.student?.city ? <Badge>{card.student.city}</Badge> : null}
          <Badge tone="muted">{card.videoCount} public videos</Badge>
          {card.hasVault ? <Badge tone="warning">Vault attached</Badge> : null}
        </div>
        {card.student?.bio ? <p className="mt-4 text-sm leading-6 text-muted-foreground">{card.student.bio}</p> : null}
        <div className="mt-6 flex flex-wrap gap-3">
          {card.hasVault ? <RequestNdaButton studentId={card.id} /> : null}
          <Link href={`/vault/${card.id}`} className={cn(buttonVariants({ variant: "ghost" }))}>
            Open vault
          </Link>
        </div>
      </Card>
    </div>
  );
}
