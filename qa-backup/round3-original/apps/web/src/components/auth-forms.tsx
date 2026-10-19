"use client";

import { useActionState } from "react";
import { completeOnboarding, signInLocal } from "@/lib/actions";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signInLocal, {});
  return (
    <form action={action} className="grid gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field label="Work email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@company.com" />
      </Field>
      <Field label="Name" htmlFor="name">
        <Input id="name" name="name" autoComplete="name" placeholder="Priya Sharma" />
      </Field>
      {state?.error ? <Alert>{state.error}</Alert> : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Signing in…" : "Continue"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Local development issues an HS256 session cookie. Production uses Cognito Hosted UI; the JWT never
        touches <code>localStorage</code>.
      </p>
    </form>
  );
}

export function OnboardingForm({
  defaults,
}: {
  defaults: { handle: string; displayName: string };
}) {
  const [state, action, pending] = useActionState(completeOnboarding, {});
  return (
    <form action={action} className="grid gap-4">
      <Field label="Handle" htmlFor="handle">
        <Input id="handle" name="handle" required minLength={3} defaultValue={defaults.handle} />
      </Field>
      <Field label="Your name" htmlFor="displayName">
        <Input id="displayName" name="displayName" required defaultValue={defaults.displayName} />
      </Field>
      <Field label="Title" htmlFor="title">
        <Input id="title" name="title" placeholder="University recruiter" />
      </Field>
      <Field label="Organization" htmlFor="orgName">
        <Input id="orgName" name="orgName" required placeholder="Acme Talent" />
      </Field>
      <Field label="Org slug" htmlFor="orgSlug">
        <Input id="orgSlug" name="orgSlug" placeholder="acmetalent" />
      </Field>
      {state?.error ? <Alert>{state.error}</Alert> : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Saving…" : "Enter portal"}
      </Button>
    </form>
  );
}
