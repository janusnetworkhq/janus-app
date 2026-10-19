# Apps

- `api` — NestJS modular monolith (Phase 1). Image: `apps/api/Dockerfile`
- `mobile` — Expo iOS/Android (Phase 2). Store tracks: `apps/mobile/eas.json` + `EAS.md`
- `web` — Next.js recruiter + moderation portal (Phase 3)

```bash
make dev          # API + iPhone 17 (no web) — prefer this
make debug        # same + Nest inspect :9229
make web          # Next.js :3001 when you need the recruiter portal
pnpm k6:smoke     # requires API up
```
