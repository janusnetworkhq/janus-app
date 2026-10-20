# UI overhaul progress

- 19 Oct: BEFORE audit (19 routes) -> qa-screenshots/ui-overhaul/before/
- c951d9b: drawn-signature pad + API (private Cloudinary PNG, SHA-256, PDF embed, migration), /requests cards, /nda signed state, TextureCard tokens, skeletons, /docs, /settings
- d5a5f87: API fix — re-sign refreshes the pair's single active grant (was P2002 "Resource already exists"); API 41/41
- 19 Oct: AFTER screenshots (20) -> qa-screenshots/ui-overhaul/after/; first sign click hit the grant bug, retest then hit OTP 5/hour cap
- 20 Oct 08:15 IST: ui-sign-retest.cjs PASS live — mouse-drawn signature, Sign enabled, redirect to /vault/<student>, agreement.signatureSha256 present; 07–10 screenshots refreshed
- 20 Oct: signature export now renders offscreen at max(devicePixelRatio, 2) (headless DPR1 produced 316x208)
- Audit table: qa-logs/ui-overhaul-audit.md
