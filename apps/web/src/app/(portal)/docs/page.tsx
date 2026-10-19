import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenText, FileLock2, KeyRound, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { PageHeader } from "@/components/ui/feedback";
import { TextureCard, TextureCardContent, TextureCardHeader } from "@/components/ui/texture-card";

export const metadata: Metadata = { title: "Docs" };

const sections = [
  { id: "getting-started", icon: BookOpenText, title: "Getting started", items: [
    ["Sign in with email OTP", "Enter your work email on the login page, then the 6-digit code we send. New accounts finish a short onboarding (name, role, organisation for recruiters) before the feed opens. Sessions last 24 hours."],
    ["Find talent in the feed", "The feed is a public, watermarked showcase of student demos. Filter by university, open a profile, and check the project video before spending an NDA."],
    ["Everything sensitive sits behind an NDA", "CAD files, source archives, and decks are never public. They live in each student's Vault and unlock only through the NDA flow below."],
  ]},
  { id: "recruiter", icon: UsersRound, title: "Recruiter guide", items: [
    ["1 · Request", "On a talent profile choose Request NDA and add a short reason. The student sees your name and organisation. Requests expire after 72 hours if undecided."],
    ["2 · Student accepts", "The student accepts or declines in their inbox. You get a notification either way; nothing is shared before acceptance."],
    ["3 · Sign", "Open the request, read the agreement to the end, draw your signature on the signing pad, and add your printed legal name. Your signature image is hashed (SHA-256), stored privately, and embedded in the sealed PDF."],
    ["4 · Review the vault", "Signing opens watermarked, view-only vault access for 7 days. No downloads, no share links — every view is audited and watermarked with your identity."],
    ["Track everything in NDA requests", "Cards are grouped by next step: Needs your signature, Waiting on student, Signed · vault open, and Closed, with search and filters."],
  ]},
  { id: "student", icon: UserRound, title: "Student guide", items: [
    ["Publish a demo", "Post a short public video of your build from the mobile app. Keep secrets out of the public cut — that is what the Vault is for."],
    ["Stock the Vault", "Upload CAD, code archives, or decks as vault files. They stay invisible until you accept a specific recruiter's NDA."],
    ["You control access", "Accept or decline every request. After a signature you can revoke a grant at any time, which closes the vault to that recruiter immediately."],
  ]},
  { id: "nda-vault", icon: FileLock2, title: "How the NDA & vault work", items: [
    ["Mutual, versioned template", "Both sides are bound by the same versioned JANUS mutual NDA. The exact template hash (SHA-256) is printed on the signing page and sealed into the PDF, so the signed text can never be swapped later."],
    ["Evidence pack per signature", "We store the sealed PDF, your drawn signature PNG (private, authenticated storage), its SHA-256, signer name, IP, and user agent — enough to prove who signed what, and when."],
    ["Short-lived grants", "A signature creates a 7-day access grant. Vault files are served as short-lived, per-recruiter watermarked views; when the grant ends or is revoked, access ends."],
  ]},
  { id: "security", icon: KeyRound, title: "Security", items: [
    ["Encryption wall, not a custom cipher", "Vault objects live in private storage and are only reachable through the API after grant checks. The control plane (NDA + grants + audit) is separated from the data plane (storage + signed delivery)."],
    ["Watermarking over promises", "Every vault view carries your visible identity watermark, and vault video playback is watermarked per session, so leaks are attributable."],
    ["Audit by default", "Sign-ins, NDA decisions, signatures, vault views, and admin actions are written to an append-only audit trail."],
    ["Honest limits", "No system can stop a camera pointed at a screen. JANUS makes casual forwarding useless and determined misuse attributable and legally actionable."],
  ]},
  { id: "faq", icon: ShieldCheck, title: "FAQ", items: [
    ["Why must I draw a signature?", "A typed name alone is weak evidence. A drawn signature, hashed and embedded in the sealed PDF with the template hash, is far stronger — and it takes five seconds."],
    ["Why is the Sign button disabled?", "It enables only when all three are done: agreement read to the end, signature drawn, printed legal name entered. The checklist under the pad shows exactly what is missing."],
    ["Can I download vault files?", "No. The vault is view-only and watermarked by design. Ask the student for a data room if you need files after hiring discussions progress."],
    ["How long does access last?", "7 days from signing. The student can revoke earlier; you can request a fresh NDA after expiry."],
    ["What happens when a request expires?", "Pending requests expire after 72 hours and signed grants after 7 days. Expiry is automatic and both sides are notified."],
  ]},
];

export default function DocsPage() {
  return (
    <div className="page-enter mx-auto max-w-4xl">
      <PageHeader kicker="Help centre" title="JANUS Docs" description="How discovery, NDAs, and the vault fit together — for recruiters, students, and admins." />
      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Docs sections">
        {sections.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="rounded-full bg-muted px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">{s.title}</a>
        ))}
      </nav>
      <div className="grid gap-5">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <section key={s.id} id={s.id} className="scroll-mt-8">
              <TextureCard>
                <TextureCardHeader>
                  <h2 className="flex items-center gap-2 text-lg font-semibold"><Icon className="size-5 text-primary" aria-hidden /> {s.title}</h2>
                </TextureCardHeader>
                <TextureCardContent>
                  <dl className="grid gap-4">
                    {s.items.map(([term, body]) => (
                      <div key={term}>
                        <dt className="font-medium">{term}</dt>
                        <dd className="mt-0.5 text-sm leading-6 text-muted-foreground">{body}</dd>
                      </div>
                    ))}
                  </dl>
                </TextureCardContent>
              </TextureCard>
            </section>
          );
        })}
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        Still stuck? Start from the <Link href="/feed" className="text-primary hover:underline">feed</Link> or check your{" "}
        <Link href="/requests" className="text-primary hover:underline">NDA requests</Link>.
      </p>
    </div>
  );
}
