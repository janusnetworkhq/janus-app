"use client";

import dynamic from "next/dynamic";
import { useRef, useState, useTransition } from "react";
import { CheckCircle2, Circle, FileLock2, PenLine, ScrollText, Type } from "lucide-react";
import { signNda } from "@/lib/actions";
import type { NdaTemplate } from "@/lib/types";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";

const SignaturePad = dynamic(
  () => import("@/components/signature-pad").then((m) => m.SignaturePad),
  {
    ssr: false,
    loading: () => <div className="skeleton h-44 w-full sm:h-52" aria-label="Loading signature pad" />,
  },
);

function Requirement({ done, label, hint }: { done: boolean; label: string; hint: string }) {
  const Icon = done ? CheckCircle2 : Circle;
  return (
    <li className="flex items-start gap-2 text-sm">
      <Icon className={cn("mt-0.5 size-4 shrink-0", done ? "text-primary" : "text-muted-foreground")} aria-hidden />
      <span>
        <span className={done ? "text-foreground" : "text-muted-foreground"}>{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </li>
  );
}

export function NdaSignForm({
  requestId,
  studentId,
  template,
}: {
  requestId: string;
  studentId: string;
  template: NdaTemplate;
}) {
  const [scrollPct, setScrollPct] = useState(0);
  const [typedName, setTypedName] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const scroller = useRef<HTMLDivElement>(null);

  const scrolled = scrollPct >= 98;
  const nameOk = typedName.trim().length >= 2;
  const sigOk = signature !== null;
  const ready = scrolled && nameOk && sigOk;
  const remaining = [
    !scrolled && "read the agreement to the end",
    !sigOk && "draw your signature",
    !nameOk && "enter your printed legal name",
  ].filter(Boolean) as string[];

  return (
    <div className="page-enter grid gap-6 lg:grid-cols-[1fr_360px]">
      <div>
        <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">Version {template.version}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{template.title}</h1>
        <p className="mt-1 font-mono text-xs break-all text-muted-foreground">SHA-256 {template.contentSha256}</p>
        <div className="texture-card mt-4 rounded-2xl p-1.5">
          <div
            ref={scroller}
            onScroll={() => {
              const el = scroller.current;
              if (!el) return;
              const max = el.scrollHeight - el.clientHeight;
              setScrollPct(max <= 0 ? 100 : Math.min(100, Math.round((el.scrollTop / max) * 100)));
            }}
            className="h-[min(58dvh,560px)] overflow-y-auto rounded-xl bg-card p-5 text-sm leading-7 whitespace-pre-wrap"
          >
            {template.body}
          </div>
          <div className="flex items-center gap-3 px-3 py-2" aria-label={`Agreement read ${scrollPct}%`}>
            <ScrollText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${scrollPct}%` }} />
            </div>
            <span className="w-14 text-right text-xs text-muted-foreground">{scrolled ? "Read ✓" : `${scrollPct}% read`}</span>
          </div>
        </div>
      </div>

      <aside className="texture-card h-fit rounded-2xl p-5">
        <div className="flex items-center gap-2">
          <FileLock2 className="size-5 text-primary" aria-hidden />
          <h2 className="font-semibold">Sign to open the vault</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Your drawn signature is stored privately, hashed (SHA-256), and embedded in the signed PDF. Access lasts 7 days.
        </p>

        <form
          className="mt-4 grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start(async () => {
              const result = await signNda(requestId, studentId, typedName.trim(), template.contentSha256, signature);
              if (result?.error) setError(result.error);
            });
          }}
        >
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <PenLine className="size-3.5" aria-hidden /> Draw your signature
            </p>
            <SignaturePad onChange={setSignature} />
          </div>
          <Field label="Printed legal name" htmlFor="typedName">
            <Input
              id="typedName"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              autoComplete="name"
              required
              minLength={2}
              placeholder="As it should appear under your signature"
            />
          </Field>

          <ul className="grid gap-2 rounded-xl border border-border/70 bg-background/40 p-3">
            <Requirement done={scrolled} label="Agreement read to the end" hint={scrolled ? "Complete" : `Currently ${scrollPct}% — keep scrolling`} />
            <Requirement done={sigOk} label="Signature drawn" hint={sigOk ? "Captured — will be embedded in the PDF" : "Use the pad above (mouse, pen, or touch)"} />
            <Requirement done={nameOk} label="Printed legal name entered" hint={nameOk ? "Appears beneath your signature" : "At least 2 characters"} />
          </ul>

          {error ? <Alert>{error}</Alert> : null}
          {!ready && !pending ? (
            <p className="text-xs text-warning" role="status">
              To sign, you still need to: {remaining.join(" · ")}.
            </p>
          ) : null}
          <Button type="submit" disabled={!ready || pending} size="lg" className="w-full">
            {pending ? "Signing & sealing PDF…" : "Sign and open vault"}
          </Button>
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Type className="size-3.5" aria-hidden /> Typing alone is not a signature — that is why drawing is required.
          </p>
        </form>
      </aside>
    </div>
  );
}
