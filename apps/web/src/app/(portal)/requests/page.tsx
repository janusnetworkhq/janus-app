import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock3, FileCheck2, Hourglass, ShieldCheck, XCircle } from "lucide-react";
import { nestGet } from "@/lib/api";
import type { NdaRequest } from "@/lib/types";
import { formatWhen } from "@/lib/utils";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import {
  TextureCard,
  TextureCardContent,
  TextureCardFooter,
  TextureCardHeader,
} from "@/components/ui/texture-card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "NDA requests" };

type Effective = "ACTION" | "PENDING" | "SIGNED" | "CLOSED";
const FILTERS: { key: Effective | "ALL"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "ACTION", label: "Needs your signature" },
  { key: "PENDING", label: "Waiting on student" },
  { key: "SIGNED", label: "Signed · vault open" },
  { key: "CLOSED", label: "Closed" },
];

function effective(row: NdaRequest): Effective {
  if (row.agreement) return "SIGNED";
  if (row.status === "ACCEPTED") return "ACTION";
  if (row.status === "PENDING") return "PENDING";
  return "CLOSED";
}

const pill: Record<Effective, { label: string; className: string; icon: typeof Clock3 }> = {
  ACTION: { label: "Accepted — sign now", className: "bg-primary text-primary-foreground", icon: FileCheck2 },
  PENDING: { label: "Waiting on student", className: "bg-warning/15 text-warning", icon: Hourglass },
  SIGNED: { label: "Signed · vault open", className: "bg-primary/15 text-primary", icon: ShieldCheck },
  CLOSED: { label: "Closed", className: "bg-muted text-muted-foreground", icon: XCircle },
};

function initials(row: NdaRequest) {
  const src = row.student?.displayName ?? row.student?.handle ?? "?";
  return src.replace("@", "").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status = "ALL", q = "" } = await searchParams;
  const items = await nestGet<NdaRequest[]>("/v1/nda/outbound");
  const counts = items.reduce<Record<Effective, number>>(
    (acc, row) => ({ ...acc, [effective(row)]: acc[effective(row)] + 1 }),
    { ACTION: 0, PENDING: 0, SIGNED: 0, CLOSED: 0 },
  );
  const query = q.trim().toLowerCase();
  const visible = items.filter((row) => {
    if (status !== "ALL" && effective(row) !== status) return false;
    if (!query) return true;
    const hay = `${row.student?.displayName ?? ""} ${row.student?.handle ?? ""} ${row.reason ?? ""}`.toLowerCase();
    return hay.includes(query);
  });

  return (
    <div className="page-enter">
      <PageHeader
        kicker="Legal"
        title="NDA requests"
        description="Each card is one vault relationship: ask → the student accepts → you sign → the vault opens for 7 days."
        actions={
          <form action="/requests" className="flex gap-2">
            <input type="hidden" name="status" value={status} />
            <input
              name="q"
              defaultValue={q}
              placeholder="Search name, @handle, reason…"
              className="h-10 w-64 rounded-md border border-border bg-card px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/60"
              aria-label="Search requests"
            />
            <button type="submit" className="h-10 rounded-md bg-muted px-4 text-sm font-semibold hover:bg-muted/70">
              Search
            </button>
          </form>
        }
      />

      {/* Summary */}
      <div className="stagger mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {([
          ["Needs your signature", counts.ACTION, "text-primary"],
          ["Waiting on student", counts.PENDING, "text-warning"],
          ["Signed · vault open", counts.SIGNED, "text-primary"],
          ["Closed", counts.CLOSED, "text-muted-foreground"],
        ] as const).map(([label, value, cls]) => (
          <div key={label} className="texture-card rounded-2xl px-4 py-3">
            <p className={cn("text-2xl font-semibold", cls)}>{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap gap-2" role="navigation" aria-label="Filter requests">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "ALL" ? "/requests" : `/requests?status=${f.key}`}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              status === f.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="No NDA requests yet"
          body="Find a student in the feed, open their profile, and request an NDA. Their private vault unlocks only after they accept and you sign."
        >
          <Link href="/feed" className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">
            Browse the feed <ArrowRight className="ml-1 size-4" aria-hidden />
          </Link>
        </EmptyState>
      ) : visible.length === 0 ? (
        <EmptyState title="Nothing matches this view" body="Try a different filter or clear your search.">
          <Link href="/requests" className="inline-flex h-10 items-center rounded-md bg-muted px-4 text-sm font-semibold">
            Show all requests
          </Link>
        </EmptyState>
      ) : (
        <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((row) => {
            const eff = effective(row);
            const P = pill[eff];
            const Icon = P.icon;
            const name = row.student?.displayName ?? (row.student ? `@${row.student.handle}` : "Student");
            return (
              <TextureCard key={row.id} hover>
                <TextureCardHeader>
                  <div className="flex items-center gap-3">
                    <span className="flex size-11 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary" aria-hidden>
                      {initials(row)}
                    </span>
                    <div>
                      <Link href={`/talent/${row.studentId}`} className="font-semibold hover:text-primary">
                        {name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {row.student ? `@${row.student.handle}` : row.studentId.slice(0, 8)}
                      </p>
                    </div>
                  </div>
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold", P.className)}>
                    <Icon className="size-3.5" aria-hidden /> {P.label}
                  </span>
                </TextureCardHeader>
                <TextureCardContent>
                  {row.reason ? <p className="line-clamp-2 text-sm text-muted-foreground">“{row.reason}”</p> : null}
                  <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Requested</dt>
                      <dd className="mt-0.5 font-medium">{formatWhen(row.createdAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{row.agreement ? "Signed" : "Request expires"}</dt>
                      <dd className="mt-0.5 font-medium">
                        {row.agreement ? formatWhen(row.agreement.signedAt) : formatWhen(row.expiresAt)}
                      </dd>
                    </div>
                  </dl>
                  {eff === "ACTION" ? (
                    <p className="mt-3 rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
                      The student accepted. Your signature is the only step left before the vault opens.
                    </p>
                  ) : null}
                  {eff === "PENDING" ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Nothing needed from you — the student decides in their inbox. Requests expire after 72 hours.
                    </p>
                  ) : null}
                </TextureCardContent>
                <TextureCardFooter>
                  {eff === "ACTION" ? (
                    <Link href={`/nda/${row.id}`} className="inline-flex h-9 items-center rounded-md bg-primary px-3.5 text-sm font-semibold text-primary-foreground">
                      Sign NDA <ArrowRight className="ml-1 size-4" aria-hidden />
                    </Link>
                  ) : null}
                  {eff === "SIGNED" ? (
                    <Link href={`/vault/${row.studentId}`} className="inline-flex h-9 items-center rounded-md bg-primary px-3.5 text-sm font-semibold text-primary-foreground">
                      Open vault <ArrowRight className="ml-1 size-4" aria-hidden />
                    </Link>
                  ) : null}
                  {eff === "PENDING" ? (
                    <Link href={`/nda/${row.id}`} className="inline-flex h-9 items-center rounded-md bg-muted px-3.5 text-sm font-semibold">
                      View status
                    </Link>
                  ) : null}
                  {eff === "CLOSED" ? (
                    <Link href={`/talent/${row.studentId}`} className="inline-flex h-9 items-center rounded-md bg-muted px-3.5 text-sm font-semibold">
                      Request again from profile
                    </Link>
                  ) : null}
                  <Link href={`/talent/${row.studentId}`} className="ml-auto text-sm font-medium text-muted-foreground hover:text-primary">
                    Profile
                  </Link>
                </TextureCardFooter>
              </TextureCard>
            );
          })}
        </div>
      )}

      <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Clock3 className="size-4" aria-hidden /> Signing stores a sealed PDF plus your drawn signature (hashed), and
        grants watermarked, view-only vault access for 7 days. See <Link href="/docs" className="text-primary hover:underline">Docs → NDA &amp; vault</Link>.
      </p>
    </div>
  );
}
