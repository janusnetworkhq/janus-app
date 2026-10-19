# JANUS recruiter web (`@janus/web`)

Next.js App Router BFF for recruiters (feed, NDA, vault) and platform admins (moderation). The session JWT lives in an **httpOnly cookie**. It is never written to `localStorage`.

## Run

```bash
pnpm dev:api    # Nest on :3000
pnpm dev:web    # portal on :3001
```

Copy `apps/web/.env.example` to `apps/web/.env.local` if needed:

```
JANUS_API_URL=http://localhost:3000
JANUS_AUTH_MODE=local
```

Local sign-in calls `POST /v1/dev/tokens` and stores `janus_session` (15 min) plus `janus_claims` (30 days) so the proxy can remint silently.

## Routes

| Path | Who | What |
| --- | --- | --- |
| `/login` | Public | Recruiter/admin local email |
| `/onboarding` | Authed, incomplete | Org profile (`RECRUITER`) |
| `/feed` | Recruiter / admin | 9:16 scroll-snap HLS |
| `/requests`, `/nda/[id]` | Recruiter / admin | Outbound NDA, scroll-to-end sign |
| `/talent/[id]`, `/vault/...` | Recruiter / admin | Public card + audited vault |
| `/admin/*` | `PLATFORM_ADMIN` | Hide video, suspend user, audit |

Students who sign in are sent to `/restricted`.
