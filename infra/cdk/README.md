# JANUS AWS CDK (`ap-south-1`)

Two independent stages: **staging** and **prod** (separate accounts via `CDK_STAGING_ACCOUNT` / `CDK_PROD_ACCOUNT`). Edge (CloudFront + WAF) is in **`us-east-1`** because CLOUDFRONT web ACLs cannot be created elsewhere.

| Stack | Region | What |
| --- | --- | --- |
| Waf | us-east-1 | CloudFront WAF (common + bad inputs + IP rate) |
| Network | ap-south-1 | VPC, 2 AZs, NAT (1 staging / 2 prod), SGs |
| Data | ap-south-1 | Aurora PostgreSQL 16 Serverless v2, Redis 7, 3 S3 buckets, vault CMK, SQS, MediaConvert queue, Cognito, HLS CloudFront (OAC) |
| Compute | ap-south-1 | ECS Fargate API + worker, ALB `/ready`, API CloudFront, ECR, p95 / 5XX / Aurora CPU / Redis eviction alarms |

API tasks set `WORKERS_ENABLED=false`. Workers use the same image with `WORKERS_ENABLED=true` so the outbox is not double-polled. Prod `AUTH_MODE=cognito` only.

k6 at 2k RPS must hit the **ALB DNS**, not CloudFront (WAF is per-IP).

## Commands

```bash
pnpm infra:synth
CDK_STAGING_ACCOUNT=123 pnpm --filter @janus/infra deploy:staging
```

1. `cdk synth` (CI)
2. Build/push `apps/api/Dockerfile` (linux/arm64) to the ECR URI from Compute outputs (`IMAGE_TAG`)
3. `prisma migrate deploy` against Aurora **before** a prod task rollout (GitHub `migrate.yml`; prod requires typing `migrate-prod`)
4. Deploy Compute (new task definition)
5. `SLO_STRICT=1 FEED_RPS=2000 pnpm k6:slo` against the staging ALB

HTTPS/ACM and Route 53 are attached after the first ALB exists. `MEDIA_PUBLIC_BASE` is wired to the HLS CloudFront domain. Do not put secrets in git.

Prod promote is **manual** (`deploy:prod`). Do not run `cdk deploy` in this repo without credentials.
