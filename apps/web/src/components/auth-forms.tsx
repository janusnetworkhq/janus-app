"use client";

import { useActionState, useEffect, useState } from "react";
import { completeOnboarding, otpLogin, signInLocal, type OtpState } from "@/lib/actions";
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

export function OtpLoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<OtpState, FormData>(otpLogin, {});
  const [now, setNow] = useState(() => Date.now());
  const cooldownSec = state.resendAt ? Math.max(0, Math.ceil((state.resendAt - now) / 1000)) : 0;
  useEffect(() => {
    if (!state.resendAt || state.resendAt <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [state.resendAt]);

  if (state.stage !== "code") {
    return (
      <form action={action} className="grid gap-4">
        <input type="hidden" name="intent" value="send" />
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <Field label="Email" htmlFor="otp-email">
          <Input id="otp-email" name="email" type="email" autoComplete="email" required placeholder="you@company.com" defaultValue={state.email ?? ""} />
        </Field>
        <Field label="Name (new accounts)" htmlFor="otp-name">
          <Input id="otp-name" name="name" autoComplete="name" placeholder="Priya Sharma" defaultValue={state.name ?? ""} />
        </Field>
        {state.error ? <Alert>{state.error}</Alert> : null}
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Sending code…" : "Email me a sign-in code"}
        </Button>
        <p className="text-xs text-muted-foreground">
          We email a 6-digit code — no password needed. Your session is stored in a secure httpOnly cookie,
          never in browser storage.
        </p>
      </form>
    );
  }

  return (
    <form action={action} className="grid gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <input type="hidden" name="email" value={state.email ?? ""} />
      <input type="hidden" name="name" value={state.name ?? ""} />
      <input type="hidden" name="resendAt" value={state.resendAt ?? ""} />
      <p className="text-sm text-muted-foreground">
        Code sent to <span className="font-medium text-foreground">{state.email}</span>
      </p>
      <Field label="6-digit code" htmlFor="otp-code">
        <Input
          id="otp-code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          required
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="123456"
        />
      </Field>
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.notice ? <p className="text-sm text-muted-foreground">{state.notice}</p> : null}
      <Button type="submit" name="intent" value="verify" size="lg" disabled={pending}>
        {pending ? "Verifying…" : "Verify and sign in"}
      </Button>
      <div className="flex items-center justify-between text-sm">
        <a href="/login" className="text-muted-foreground underline-offset-4 hover:underline">
          Use a different email
        </a>
        <button
          type="submit"
          name="intent"
          value="resend"
          disabled={pending || cooldownSec > 0}
          className="font-medium text-primary underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cooldownSec > 0 ? `Resend code in ${cooldownSec}s` : "Resend code"}
        </button>
      </div>
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
