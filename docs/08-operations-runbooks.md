# JANUS operations (Phase 4)

Staging and production are **separate AWS accounts** in `ap-south-1`. The CloudFront WAF ACL is synthesized in `us-east-1` (required by AWS). HLS CloudFront lives in the Data stack next to the public-media bucket; API CloudFront lives in Compute next to the ALB.

Numeric SLO contract: [`ops/slo/slo.yaml`](../ops/slo/slo.yaml). CDK: [`infra/cdk/README.md`](../infra/cdk/README.md). k6: [`ops/k6/README.md`](../ops/k6/README.md).

## Environments

| | Staging | Prod |
| --- | --- | --- |
| Account | `CDK_STAGING_ACCOUNT` | `CDK_PROD_ACCOUNT` |
| AUTH_MODE | `cognito` | `cognito` |
| API tasks | 1 (scale 1–3) | 2 (scale 2–8) |
| Aurora Serverless v2 | 0.5–2 ACU | 0.5–4 ACU |
| Redis | 1× t4g.micro | 2× t4g.small + failover |
| Prisma | CI `migrate deploy` | **gated** workflow + `production` environment |
| Promote | `main` → staging | **manual** `deploy:prod` |

API Fargate tasks set `WORKERS_ENABLED=false`. The worker service uses the same image with `WORKERS_ENABLED=true` so the outbox is not double-polled.

`GET /ready` requires Postgres always, and Redis when `NODE_ENV=production`. Helmet HSTS and Swagger `/docs` are production-gated.

## Deploy order (do not skip)

1. `pnpm infra:synth` (CI already does this)
2. Build/push `apps/api/Dockerfile` to the Compute ECR URI (`IMAGE_TAG`)
3. `prisma migrate deploy` against that stage’s Aurora secret **before** a prod task rollout
4. `cdk deploy 'Janus-<stage>/*'`
5. Staging: `SLO_STRICT=1 FEED_RPS=2000` k6 against the **ALB DNS** (not CloudFront)
6. Only then promote the same image tag to prod

HTTPS/ACM on the ALB and Route 53 are attached after the first ALB exists. `MEDIA_PUBLIC_BASE` is the HLS CloudFront domain from the Data stack.

## Runbook — transcode stuck

Symptoms: upload `complete` returns, video stays `PROCESSING` / never `READY`; MediaConvert jobs `ERROR` or queued.

1. Confirm the object exists in the uploads bucket (`S3_UPLOADS_BUCKET`) at the upload key.
2. Worker logs (`/aws/ecs/janus-<stage>` stream `worker`): look for `media-transcode` SQS receive errors or MediaConvert `CreateJob` failures.
3. MediaConvert console → queue `janus-<stage>`: job error code (often IAM PassRole, missing overlay image, or duration cap).
4. If SQS `ApproximateAgeOfOldestMessage` > 5 minutes, scale the worker to 1 (never 2 — outbox poller) and replay: visibility timeout is 5 minutes; do not purge unless you can rebuild from `Upload` rows still `UPLOADED`.
5. After a successful job, `READY` is written by the worker; feed cache may lag one TTL. Hide the clip from admin if a bad encode reached CloudFront.

Do not re-run MediaConvert on vault originals unless the student re-uploads.

## Runbook — revoke NDA / vault access

Symptoms: student (or admin) revokes; recruiter can still play for up to URL TTL (default 600s).

1. `POST /v1/nda/grants/:id/revoke` (or student revoke path) sets `AccessGrant.revokedAt` and agreement revoke fields — append-only; do not DELETE rows.
2. Redis key `grant:{recruiterId}:{assetId}` is TTL’d to the signed URL lifetime. If you need immediate deny, `DEL` that key (worker/API task role) or wait TTL.
3. Confirm `POST /v1/vault/assets/:id/playback` returns `403 VAULT_DENIED` for that recruiter.
4. CloudFront signed URLs already issued remain valid until expiry. Rotation of the signing key (below) invalidates outstanding vault URLs.

Audit: `ACCESS_DENIED` / revoke events must exist for the grant id.

## Runbook — rotate CloudFront signing keys

Vault playback uses short-lived signed URLs. Dual-key rotation:

1. Create a second CloudFront public key + key group; add it alongside the current group on the vault behavior.
2. Deploy API/worker with `CF_SIGNING_KEY_PAIR_ID` pointing at the **new** key; keep the old key in the key group for `vaultUrlTtlSec` (10 minutes) plus one hour margin.
3. Remove the old key from the key group; disable the old public key.
4. Never commit PEM material. Store the private key in Secrets Manager (`janus/<stage>/cf-signing`) and inject it as a task secret.

Public HLS (watermarked feed) uses OAC, not signed URLs. Rotating vault keys does not require invalidating public cache.

## Error budget

Freeze non-SLO features if 30-day API availability burns below 99.5%. Weekly review once production has traffic.
