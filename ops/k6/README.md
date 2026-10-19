# k6 load tests

Scenarios match [docs/06](../../docs/06-scalability-and-operations.md) and the MVP definition of done (`ops/slo/slo.yaml`).

Point **staging SLO runs at the ALB DNS**, not CloudFront. WAF IP rate limits will throttle a single k6 IP at 2k RPS.

| Script | Default | Staging (set env) | Pass |
| --- | --- | --- | --- |
| `smoke.js` | 5 VUs, 20s, health/ready | — | errors < 5%, p95 < 800 ms |
| `feed.js` | 20 rps | `FEED_RPS=2000 SLO_STRICT=1` | p95 < 200 ms strict / 300 ms local |
| `likes.js` | 10 rps | `LIKE_RPS=200 VIDEO_ID=...` | p95 < 400 ms |
| `playback.js` | 5 rps | `PLAYBACK_RPS=20 ASSET_ID=...` | 403 `VAULT_DENIED` or 200 grant |
| `upload.js` | 5 rps presign | `UPLOAD_RPS=50` | p95 < 500 ms |
| `slo.js` | combined modest rps | all of the above | checks > 98% |

```bash
pnpm k6:smoke
pnpm k6:slo
BASE_URL=https://<alb-dns> TOKEN=... SLO_STRICT=1 FEED_RPS=2000 LIKE_RPS=200 PLAYBACK_RPS=20 pnpm k6:slo
```

Local `AUTH_MODE=local` mints `/v1/dev/tokens` and onboards a **pool** of students/recruiters so per-user rate limits (120/min) are not the bottleneck. Staging `TOKEN` is a single Cognito user — for `FEED_RPS=2000` pass a newline-separated pool via many VUs or temporarily raise `RATE_LIMIT_GLOBAL_PER_MIN` on the staging task. Never set `AUTH_MODE=local` in AWS.

Also watch Aurora CPU (< 80%) and Redis evictions (= 0) in CloudWatch during the staging run.
