# JANUS MVP Roadmap

Product stage: **pre-revenue, pre-seed**. Goal: a testable vertical feed + NDA-gated vault, not a full marketplace.

---

## 1. In scope (MVP)

- Cognito auth: student vs recruiter
- Student: record/upload 9:16, caption, attach vault files
- Public HLS feed with visible watermark
- Recruiter: feed, request NDA, sign (Phase 1 eSign), view vault
- Student: accept/reject NDA inbox
- Audit log for vault opens
- React Native iOS + Android (TestFlight / Internal track)
- Recruiter web for NDA + PDF/HLS vault
- Admin hide video

## 2. Out of scope (MVP)

- 5% deal fee, escrow, contracts
- Paid SaaS seats (keep `Organization.plan = FREE_PILOT`)
- Search ML, ads, live, DMs beyond NDA thread
- FairPlay/Widevine DRM
- Flutter
- Multi-region active-active

---

## 3. Workstreams (12 weeks, 1 tech partner)

| Week | Platform | Mobile / web | Security |
| --- | --- | --- | --- |
| 1–2 | Repo, Cognito, Aurora, Nest skeleton, Prisma | Expo app shells, auth | IAM, buckets, CMK |
| 3–4 | Uploads, MediaConvert, READY webhook | Camera, upload progress | Watermark burn-in |
| 5–6 | Feed API + Redis | Vertical player, likes | WAF, rate limits |
| 7–8 | NDA request/accept/sign, PDF snapshot | Inbox, sign screen | Evidence fields, audit |
| 9–10 | Vault list + signed playback | Vault viewer, FLAG_SECURE | GrantGuard, CF sign |
| 11 | Recruiter Next.js portal | Parity feed + NDA | Pentest lite |
| 12 | Staging load, store metadata, bug bash | TestFlight | Access review |

If one engineer: slip DRM, search, comments, and org admin. Keep **upload → feed → NDA → vault**.

---

## 4. Definition of done (MVP)

1. Student in Bengaluru uploads a 30s clip; it plays on another phone within 10 minutes.
2. Recruiter cannot open vault without a signed agreement row.
3. After sign, recruiter plays vault video with visible watermark; audit row exists.
4. Student revokes; playback fails within 10 minutes (URL TTL).
5. API p95 < 300 ms on staging feed with 10k video rows.
6. No secrets in git; prod only in `ap-south-1`.

---

## 5. Suggested monorepo

```
InnovaX/
  apps/
    api/          NestJS
    mobile/       Expo RN
    web/          Next.js
  packages/
    api-types/
    eslint-config/
  docs/
  prisma/
    schema.prisma
    migrations/
  infra/          CDK or Terraform
```

pnpm + Turborepo. One CI.

---

## 6. Enhancement order after MVP

1. **Comments + bookmarks** — cheap engagement  
2. **MFA + device revoke** — enterprise checkbox  
3. **Envelope encryption 1.5** — stronger than SSE-KMS alone  
4. **Dropbox Sign** — procurement  
5. **University pages + search** — growth  
6. **Per-viewer watermark encode** — leakage response  
7. **Billing + 5% ledger** — when first paid deal exists  
8. **Feed ranker worker** — when SQL feed is slow  
9. **DRM** — if a design leak hits press  

Do not build 7 before 1–4; monetization without trust kills the marketplace.

---

## 7. Engineering standards

- TypeScript strict on all apps
- Prisma migrations only (no `db push` in prod)
- OpenAPI generated from Nest
- Runbooks: transcode stuck, revoke NDA, rotate CF keys
- Weekly error-budget review once in production

---

## 8. Risks

| Risk | Mitigation |
| --- | --- |
| MediaConvert cost | Duration cap, client compress |
| NDA not “legal enough” for corps | Phase 2 eSign + lawyer-reviewed template |
| App Store UGC delay | Moderation + CSAM scan before READY |
| One-engineer bus factor | Docs + modular monolith + this repo |
| Scope creep (LinkedIn clone) | Protect the two planes only |
