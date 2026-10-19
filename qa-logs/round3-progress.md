# Round 3 progress log

## Done before interruption #1 (16:21–17:10 IST)
- Backups: qa-backup/round3-original/ (api src/test/package.json, web src, mobile src/package/app.json, prisma, .env, .env.example, lockfile)
- Migration 20261016120000_notifications_moderation_lifecycle applied (notifications, push_tokens, videos.hidden_by_admin_at, access_grants.expiry_notified_at, comment_count backfill); seed fixed
- API: notifications module, NDA lifecycle worker+sweep, avatar copy, SQS consumer + worker process, ffmpeg HLS transcoder, manual moderation + admin queue/decision, admin un-hide fix, OTP session tokens in Cognito mode, vault watermarkText, billing plans + quota, error-filter logging
- Tests: test/features.e2e-spec.ts -> pnpm test 31/31 pass
- SQS worker verified live against LocalStack (dist/workers/main.js consumed notify-send)
- Mobile: protected WebView viewer + watermark, push registration, notifications screen + bell, sign-out confirm, request-access on vault denied, file size fix, PKCE; tsc+lint clean
- Web: moderation page, protected vault viewer, Cognito PKCE routes; next build OK; tsc OK after build (LayoutProps)
- idb shots 01-13 in qa-screenshots/round3
- 13-bug-upload-failed: caused by Docker Desktop crashing (disk hit ~141 MB free) -> Redis/LocalStack down

## After interruption #1
- 17:2x Docker Desktop won't start (exit 150). Fallback: brew redis (6379, pw janus) + MinIO on :4566 (creds janusminio); buckets created; QA vault PDF re-put; .env creds switched; API restarted
- live ffmpeg transcode via MinIO OK: video cmvawk6sw0003sseb2g3snfhb READY/PENDING 720x1280, HLS served
- web: next start :3001 (prod build); playwright-core in qa-logs/pw using system Chrome
- web Playwright pass: 15/15 pages PASS + no-download + watermark + approve checks (qa-logs/pw/web.cjs)
- web viewer re-run with real PDF (QA fixture was a 45-byte fake): renders with tiled recruiter watermark. 2nd-run 'row not found' expected (already approved in run 1)
- mobile 14: publish retry OK (Round three video READY/PENDING); 15 feed shows approved ffmpeg HLS video
- BUG found+fixed: outbox double-delivery (duplicate notifications / repeated transcodes). outbox.service.ts now leases rows in the claiming UPDATE + re-entrancy guard; regression test added. Tests 32/32
- flaky/real: OTP fixture 429 (test resets rate-limit keys); handle allocation fallback collided after 8 same-name users -> 409 (identity.service random suffix). Tests 32/32 x2
- mobile 16 student notifications (revealed outbox duplicate bug, fixed); 17 recruiter vault denied+Request Access; 18 confirm; 19 sent (DB PENDING, expires +72h); 20 protected PDF viewer w/ tiled watermark email·org·NDA token
- mobile 21 recruiter notifications empty state
- checks: api/web/mobile typecheck+lint PASS, nest build PASS; live: NDA_REQUESTED to vikram delivered once (dup fix verified)
