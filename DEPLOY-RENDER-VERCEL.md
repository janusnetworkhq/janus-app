# Janus production deploy — Render (API+worker) + Vercel (web)

Repo: `janusnetworkhq/janus-app` · Blueprint: `render.yaml` (Singapore) · API image: `apps/api/Dockerfile`
**Never commit secrets.** The one generated secret lives only in `deploy-secrets.local.txt` (gitignored, chmod 600) in the repo root on this Mac.

## 0. What will block boot in production (checklist)

`apps/api/src/common/config.ts` `assertProdConfig()` runs at startup when `NODE_ENV=production`. Both services **fail to boot** unless ALL of these hold:

| Var | Required value / source |
|---|---|
| `LOCAL_JWT_SECRET` | ≥32 chars, non-default — copy from `deploy-secrets.local.txt` on this Mac |
| `AUTH_MODE` | `cognito` (already set in `render.yaml`) |
| `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID` | From AWS Cognito console (ap-south-1 user pool + app client). **If you don't have a pool yet:** create one first (email sign-in, hosted UI domain) — there is no placeholder that passes; leaving them blank = boot crash-loop. This is the #1 likely blocker. |
| `DATABASE_URL` | Aiven Postgres connection string (use the `sslmode=require` form) |
| `REDIS_URL` | Redis Cloud `rediss://...` URL (step 1) |
| `AWS_REGION` | `ap-south-1` (already set; do not change) |
| `AWS_ENDPOINT_URL` | Must be **absent** (do not set it on Render) |
| `TRANSCODE_DRIVER` | `ffmpeg` (already set; `mock` is rejected) |

Functionally required (boot passes without them, features break): `MEDIA_DRIVER=s3` is set, so you need real AWS `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` plus the three buckets (`janus-uploads`, `janus-public-media`, `janus-vault`) in ap-south-1, and `MEDIA_PUBLIC_BASE` = public/CDN base URL of `janus-public-media`. **SQS is NOT needed** — `QUEUE_MODE=inline` uses the database outbox drained by the worker. Cloudinary is *not* wired into the code yet (no `MEDIA_DRIVER=cloudinary` exists); creating a Cloudinary account now just gives you the cloud name for that future switch.
Optional: `RESEND_API_KEY` (email falls back to logs without it), `EXPO_ACCESS_TOKEN` + `PUSH_DRIVER=expo` (push defaults to log driver), `CORS_ORIGINS` (set to your real web origin(s), e.g. the Vercel domain — fill after Vercel deploy, then redeploy API).

Every `sync: false` var in `render.yaml` (both services): `DATABASE_URL` (Aiven), `REDIS_URL` (Redis Cloud), `LOCAL_JWT_SECRET` (local file above), `COGNITO_USER_POOL_ID` / `COGNITO_CLIENT_ID` (Cognito console), `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (IAM user scoped to the 3 buckets), `MEDIA_PUBLIC_BASE` (public media bucket/CDN URL), `CORS_ORIGINS` (Vercel origin), `RESEND_API_KEY` (optional, Resend dashboard), `EXPO_ACCESS_TOKEN` (optional, Expo account).

## 1. Redis Cloud

1. Go to https://cloud.redis.io → sign up → Create subscription (free tier) → New database (Redis, ~30 MB free).
2. In the database's Configuration/Security, copy the **public endpoint + password** and build: `rediss://default:<password>@<endpoint>:<port>` (note `rediss://`, TLS).
3. Paste as `REDIS_URL` on both Render services when prompted by the blueprint.

## 2. Render Blueprint

1. https://dashboard.render.com → New → **Blueprint** → connect GitHub `janusnetworkhq/janus-app` (authorize the `janusnetworkhq` org if asked).
2. Render reads `render.yaml`: `janus-api` (web, Starter, Singapore, health `/v1/health`) + `janus-worker` (Standard 2 GB, Singapore). Confirm region Singapore for both.
3. Fill every `sync: false` prompt using the table in §0. Same values on both services.
4. Apply. First build compiles the Docker image from the repo root (ffmpeg + Prisma are baked in). Watch for the Docker build succeeding — it has not been build-tested locally (no Docker daemon on this Mac).

## 3. Run migrations against Aiven

Do this **before/while** services first boot (API crashes until the DB is reachable *and* schema exists):

Option A (local, recommended): from this Mac, with the Aiven URL (external/`sslmode=require`):
```bash
cd /Users/gokul/Documents/personal/InnovaX
DATABASE_URL='<AIVEN_URL>' npx prisma migrate deploy
SEED_MODE=prod ADMIN_BOOTSTRAP_EMAIL='<your-admin-email>' DATABASE_URL='<AIVEN_URL>' npx tsx prisma/seed.ts
```
(3 migrations; prod seed creates only the NDA template + your admin user — no demo data.)

Option B (in-image): open a Render Shell/one-off job on `janus-api` and run:
```bash
prisma migrate deploy --schema ./prisma/schema.prisma
```

## 4. Verify API

- `curl https://janus-api.onrender.com/v1/health` → `{"ok":true}` (actual URL may differ — copy it from the Render service page; use it below).
- `curl https://<api-url>/ready` → `{"ok":true,"redis":true,"postgres":true}`.
- Worker logs should show it consuming/inline-polling without crash loops.

## 5. Cloudinary (future storage switch — account only for now)

Create an account at cloudinary.com and note the **cloud name** (Dashboard → Settings). No code reads Cloudinary today; the switch (upload protocol + video streaming pipeline) is a separate change. Until then, S3 vars in §0 are mandatory.

## 6. Web on Vercel

Team question: the CLI on this Mac is logged in as `janusnetworkhq-9903`; you mentioned team **janus21**. In Vercel, pick/create the intended team *before* importing so the project lands in the right scope.
1. Import `janusnetworkhq/janus-app`, root directory `apps/web`.
2. Env vars — the web code uses **no `NEXT_PUBLIC_*` vars**; it reads server-side: `JANUS_API_URL=https://janus-api.onrender.com` (or the actual Render URL from §4), `JANUS_AUTH_MODE=cognito`, `JANUS_COGNITO_DOMAIN=<pool hosted-UI domain>`, `JANUS_COGNITO_CLIENT_ID=<same client id as API>`, `JANUS_PUBLIC_URL=https://<your-vercel-domain>`.
3. Deploy, then put that Vercel origin into `CORS_ORIGINS` on both Render services and redeploy them.

## 7. Final smoke tests

1. Open the Vercel site → sign in with Cognito (OTP/hosted UI) → complete onboarding.
2. Admin bootstrap account (from §3) can sign in and sees the admin/moderation pages.
3. Student uploads a short (<90 s) video → it leaves PROCESSING and appears in the feed (worker transcode via ffmpeg → S3). Check worker logs if stuck.
4. Recruiter requests vault access → student approves → NDA signed PDF is generated → protected viewer opens with watermark.
5. `/ready` stays green for 10+ minutes (no crash loops in Render events/logs for either service).

## FREE tier stack ($0) — current default

`render.yaml` is now a **single free web service**: `janus-api` (plan `free`) runs the API **and** the background work in-process (`WORKERS_ENABLED=true`, `QUEUE_MODE=inline`, DB outbox). There is no free Render Background Worker, so the paid two-service split lives in `render-paid.yaml` as the upgrade path.

| Layer | Free service | Limit to know |
|---|---|---|
| API + workers | Render Free web service | Spins down after ~15 min idle (~1 min cold start; outbox/NDA-sweep timers pause while asleep), 750 instance-hours/month, 512 MB RAM |
| Database | Aiven Postgres (yours) | Per your Aiven plan |
| Redis | Redis Cloud free | 30 MB, enough for OTP/cache/locks |
| Media | Cloudinary free (`MEDIA_DRIVER=cloudinary`) | Free credits/transformations cap; video HLS is generated by Cloudinary, no ffmpeg CPU on Render |
| Web | Vercel Hobby | Hobby terms (personal use), free |
| Email OTP | Resend free (`AUTH_MODE=otp`) | ~100 emails/day free; **required** — prod OTP boot fails without `RESEND_API_KEY` |

Total: **$0/month** within those caps. Expect cold-start latency and delayed notifications after idle — acceptable for launch validation, not for SLA traffic. Upgrade path: switch to `render-paid.yaml` (Starter API + Standard worker) when billing is added.
