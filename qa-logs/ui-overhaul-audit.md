# UI overhaul audit — 19 Oct 2026 (before: qa-screenshots/ui-overhaul/before/, after: .../after/)

| Page | Before (issue) | Fix |
| --- | --- | --- |
| / (anon) | Redirects to /login, OK | kept |
| /login | OTP form OK; hourly send cap gives RATE_LIMITED (by design) | kept; friendly rate-limit copy already present |
| /feed | Plain bordered card, giant letterboxed 9:16 player, no motion/skeleton | TextureCard tokens, page-enter/stagger motion, route skeleton (feed/loading.tsx), reduced-motion safe |
| /requests | Bare table; SIGNED requests still labelled ACCEPTED with generic "Open" -> /nda/[id] re-opened the sign form and signing failed NDA_SIGNED; no name/search/filters/summary; expiry shown even after signing; poor mobile behaviour | Rebuilt as TextureCard cards with effective status (Needs signature / Waiting / Signed·vault open / Closed), counts, search, filters, initials avatar, requested vs signed dates, next-step CTAs (Sign NDA / Open vault / View status / Request again), lifecycle explainer + docs link |
| /talent/[id] | Plain profile | Texture tokens via shared Card |
| /vault/[studentId] | Plain list | Texture tokens via shared Card |
| /vault/[studentId]/[assetId] | PDF viewer OK, watermark tiles present | kept (verified in after screenshots) |
| /nda/[id] pending | Plain card | Progress steps (accept -> sign -> vault), clearer copy |
| /nda/[id] sign | Typed-name-only "signature"; disabled button explained only by "Scroll to the end first."; no progress | Professional drawn-signature canvas (pointer/touch, high-DPI, undo/clear, baseline, ink preview), scroll progress %, 3-item requirement checklist, explicit remaining-steps text, signature stored privately + SHA-256 + embedded in sealed PDF |
| /nda/[id] signed | Fell through to sign form again; submit -> API NDA_SIGNED conflict | Signed state card with signed date + signature hash + Open vault CTA |
| API sign (found by E2E) | Re-signing same recruiter/student pair always failed: partial unique index one-active-grant-per-pair vs unconditional grant insert -> P2002 "Resource already exists" (hit after signature+PDF already uploaded) | sign() refreshes the existing active grant (agreement + 7-day expiry); regression test added; API 41/41 |
| /notifications | Plain list | Texture tokens; bell badge kept |
| /onboarding | Redirects to /feed when complete (correct) | kept |
| /settings/profile | 404 — route did not exist | New /settings profile page (identity, role, org/university, edit link, docs link); nav entry added |
| /docs | 404 — did not exist | New /docs help centre (getting started, recruiter, student, NDA & vault, security, FAQ) summarized from repo docs/; nav entry added |
| /admin/* | Dense plain tables, very long audit page | Shared texture tokens; functional flows re-verified live |
| 404 | Minimal | kept, branded |
| /restricted | Audit goto timed out on networkidle (test artefact) | no app error observed |

Performance: Cult TextureCard pattern implemented with pure CSS (no motion/framer-motion dep added);
signature pad dynamically imported (ssr:false) only on the sign page; route-level loading.tsx skeletons
(portal, feed, requests); Next/Image remote patterns already allow Cloudinary; build output checked
(next build, NODE_ENV=production): all routes dynamic ƒ, no new heavy deps.
