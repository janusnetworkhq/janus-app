# JANUS schema

PostgreSQL is the system of record. Prisma schema: [`schema.prisma`](./schema.prisma).

## Commands

```bash
pnpm infra:up          # Postgres, Redis, LocalStack (Docker)
pnpm db:deploy         # apply migrations (CI / first boot)
pnpm db:migrate        # generate a new migration from schema changes
pnpm db:seed           # default NDA template
pnpm db:studio
```

Homebrew fallback when Docker Hub is unavailable:

```bash
brew services start postgresql@16
createuser -s janus || true
psql -d postgres -c "ALTER ROLE janus WITH LOGIN PASSWORD 'janus' CREATEDB;"
createdb -O janus janus || true
pnpm db:deploy && pnpm db:seed
```

Never use `prisma db push` toward staging or production.

## What lives where

| Store | Owns |
| --- | --- |
| Postgres | Users, legal NDA state, grants, videos metadata, outbox |
| Redis | Feed lists, rate limits, hot profiles, like counters |
| S3 | Bytes (uploads, public HLS, vault) |

## Partial indexes

Prisma cannot express `WHERE` on indexes. The init migration adds them for:

- Public feed (`READY` + `PUBLIC_FEED` + not deleted)
- Active vault grants (`revoked_at IS NULL`)
- Pending NDA inbox
- Outbox poller
- One active NDA template
- Upload expiry sweeper
- Identity: at least one of email / phone
- No self-follow

If `migrate dev` ever offers to drop these indexes, refuse — they are load-bearing.
