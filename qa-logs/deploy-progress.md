# Deploy Phase 1 progress (2026-10-19 IST)
- Inventory: git main == origin/main (janusnetworkhq/janus-app); only submodule pointer apps/mobile dirty (user uncommitted work, backed up note; not touched). gh logged in as janusnetworkhq. vercel CLI logged in (account janusnetworkhq-9903); render CLI NOT installed. df: 9.0Gi free.
- BLOCKER: Aiven + Cloudinary credentials/cloud name not present in delegated conversation context nor local .env -> cannot test Aiven, run migrate deploy, or call Cloudinary API this run. No secrets printed/committed.
- Backups: qa-backup/deploy-phase1/ (Dockerfile, api package.json, prisma/)
- TODO: Dockerfile ffmpeg+migrations, render.yaml, inline worker mode, clean prod seed gate, tests, commit/push
- render.yaml created: janus-api starter SG health /v1/health WORKERS_ENABLED=false; janus-worker standard SG WORKERS_ENABLED=true; QUEUE_MODE=inline (no SQS needed; worker flushes DB outbox). Storage driver still env-selected (s3 today; cloudinary pending creds/design)
- tests: API typecheck PASS, e2e 32/32 PASS (local Postgres+Redis+MinIO restarted headless). Prod seed gate verified locally (template+admin only)
- Cloudinary: NOT implemented this run. Blockers: (1) cloud name + creds absent in delegated context/local env, cannot verify API; (2) existing upload contract is presigned PUT (media.service presignPut) used by mobile/web - Cloudinary direct upload is signed multipart POST, requiring client protocol changes; (3) ffmpeg HLS outputs are relative-segment playlists, not directly hostable as Cloudinary raw files - proper path is Cloudinary video upload + streaming profiles, a pipeline redesign. S3 driver intact and tests green; storage remains MEDIA_DRIVER=s3 in render.yaml (sync:false).
- Queues: QUEUE_MODE=inline chosen for Render (no AWS SQS needed). Worker now stays alive in inline mode and flushes DB outbox + runs handlers/transcode in-process. SQS mode unchanged.
- Docker build not tested: Docker daemon unavailable on this Mac.
