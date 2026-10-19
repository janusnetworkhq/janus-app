"use client";

import { useRef, useState, useTransition } from "react";
import { signNda } from "@/lib/actions";
import type { NdaTemplate } from "@/lib/types";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function NdaSignForm({
  requestId,
  studentId,
  template,
}: {
  requestId: string;
  studentId: string;
  template: NdaTemplate;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const scroller = useRef<HTMLDivElement>(null);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Version {template.version}</p>
        <h1 className="mt-2 text-2xl font-semibold">{template.title}</h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">SHA-256 {template.contentSha256}</p>
        <div
          ref={scroller}
          onScroll={() => {
            const el = scroller.current;
            if (!el) return;
            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setScrolled(true);
          }}
          className="mt-4 h-[min(60dvh,560px)] overflow-y-auto rounded-lg border border-border bg-card p-5 text-sm leading-7 whitespace-pre-wrap"
        >
          {template.body}
        </div>
      </div>
      <aside className="h-fit rounded-lg border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">
          Scroll to the end of the agreement, then type your legal name. This hash is stored with the signed
          artifact.
        </p>
        <form
          className="mt-4 grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start(async () => {
              const result = await signNda(requestId, studentId, typedName.trim(), template.contentSha256);
              if (result?.error) setError(result.error);
            });
          }}
        >
          <Field label="Legal name" htmlFor="typedName">
            <Input
              id="typedName"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              autoComplete="name"
              required
              minLength={2}
            />
          </Field>
          {error ? <Alert>{error}</Alert> : null}
          {!scrolled ? (
            <p className="text-xs text-warning">Scroll to the end of the agreement first.</p>
          ) : null}
          <Button type="submit" disabled={!scrolled || typedName.trim().length < 2 || pending}>
            {pending ? "Signing…" : "Sign and open vault"}
          </Button>
        </form>
      </aside>
    </div>
  );
}
