# JANUS Data Model

PostgreSQL (Aurora) is the system of record. Prisma schema: [`prisma/schema.prisma`](../prisma/schema.prisma).

Redis holds derived data only. S3 holds bytes. Legal truth (who signed what) lives in Postgres.

---

## 1. ER overview

```mermaid
erDiagram
  User ||--o| StudentProfile : has
  User ||--o| RecruiterProfile : has
  Organization ||--o{ RecruiterProfile : employs
  User ||--o{ Video : publishes
  User ||--o{ VaultAsset : owns
  Video ||--o{ VideoRendition : has
  Video }o--o{ VaultAsset : references
  User ||--o{ NdaRequest : asRecruiter
  User ||--o{ NdaRequest : asStudent
  NdaRequest ||--o| NdaAgreement : becomes
  NdaAgreement ||--o{ AccessGrant : issues
  AccessGrant }o--|| VaultAsset : scopes
  User ||--o{ Follow : from
  User ||--o{ Follow : to
  Video ||--o{ VideoLike : receives
  Video ||--o{ Comment : receives
  User ||--o{ AuditEvent : actor
```

---

## 2. Identity

**User** — one row per Cognito subject.

| Column | Notes |
| --- | --- |
| `id` | cuid |
| `cognitoSub` | unique |
| `email` | unique, lowercased |
| `role` | STUDENT / RECRUITER / PLATFORM_ADMIN |
| `status` | ACTIVE / SUSPENDED / DELETED |
| `handle` | unique, public |

**StudentProfile** — university, grad year, headline, city.  
**Organization** — company, plan (`FREE_PILOT` until billing).  
**RecruiterProfile** — `orgId` required, title.

---

## 3. Media

**Upload** — short-lived ticket (`CREATED` → `UPLOADED` → `CONSUMED` / `EXPIRED`).

**Video**

| Column | Notes |
| --- | --- |
| `status` | PROCESSING / READY / FAILED / HIDDEN |
| `visibility` | PUBLIC_FEED / UNLISTED |
| `durationMs`, `width`, `height` | From probe |
| `hlsMasterKey` | S3 key of `master.m3u8` |
| `watermarkText` | Frozen at transcode |
| `hasVault` | Denormalized for feed cards |

**VideoRendition** — one row per ladder rung (`540`, `720`, `1080`) + `POSTER` + `PREVIEW`.

Soft delete: `deletedAt`. CloudFront invalidation on hide.

---

## 4. Vault

**VaultAsset**

| Column | Notes |
| --- | --- |
| `kind` | SCHEMATIC / CODE_ARCHIVE / DOCUMENT / HIGH_RES_VIDEO |
| `s3Key` | `vault/{studentId}/{assetId}` |
| `kmsKeyArn` | CMK |
| `encryptedDek` | Envelope data key ciphertext |
| `checksumSha256` | Integrity |
| `byteSize`, `contentType`, `originalName` | |

Bytes on S3 are encrypted with the DEK (AES-256-GCM). S3 also has SSE-KMS as defense in depth (double wrap is acceptable at this volume).

**VideoVaultLink** — which feed videos advertise “IP available under NDA”.

---

## 5. NDA and grants

**NdaTemplate** — versioned legal text. `contentSha256` is what the signer must accept. Never update a row in place; insert `vN+1`.

**NdaRequest** — recruiter → student, `PENDING` / `ACCEPTED` / `REJECTED` / `EXPIRED` (72h).

**NdaAgreement** — immutable after sign.

| Evidence | Stored |
| --- | --- |
| Typed legal name | `signerName` |
| Template hash | `templateSha256` |
| Snapshot PDF S3 key | `artifactS3Key` |
| IP, UA, signed-at | columns |
| Optional eSign envelope id | Phase 2 |

**AccessGrant** — `agreementId` + optional `assetId` (null = all current student vault items). `expiresAt` default +7 days. `revokedAt` for student kill-switch.

One active grant per `(recruiterId, studentId)` — unique partial index `WHERE revokedAt IS NULL`.

---

## 6. Social / feed

- `Follow` — unique `(followerId, followeeId)`
- `VideoLike` — unique `(userId, videoId)`
- `Comment` — body ≤ 500 chars, soft delete
- `FeedImpression` — `(userId, videoId, seenAt)` for de-dupe; TTL job deletes > 14 days
- `Bookmark` — recruiter shortlist

---

## 7. Audit

**AuditEvent** is append-only. Application role has `INSERT` only (no `UPDATE`/`DELETE`). Columns: `actorId`, `action`, `resourceType`, `resourceId`, `ip`, `userAgent`, `metadata jsonb`, `createdAt`.

Hot path: vault playback. Ship to S3/Glacier monthly via worker (optional).

---

## 8. Outbox

**OutboxEvent** — `id`, `topic`, `payload`, `createdAt`, `publishedAt`. Poller every 1s, `FOR UPDATE SKIP LOCKED`.

---

## 9. Indexing (query-driven)

| Query | Index |
| --- | --- |
| Feed: recent READY videos | `(status, createdAt DESC)` WHERE deletedAt IS NULL |
| Profile videos | `(authorId, createdAt DESC)` |
| NDA inbox | `(studentId, status)` |
| Active grant lookup | `(recruiterId, studentId)` WHERE revokedAt IS NULL |
| Vault list | `(ownerId)` |
| Audit by actor | `(actorId, createdAt)` |
| Upload by student | `(userId, createdAt)` |

Avoid unbounded `jsonb` filters in hot paths.

---

## 10. Multi-tenant note

Recruiters are tenanted by `Organization`. Students are not tenanted. Vault grants are always person-to-person (recruiter user ↔ student), so a recruiter leaving an org should revoke grants (`revokedAt` on org membership end). Plan this in Identity even if MVP has one recruiter per org.

---

## 11. Growth (not MVP)

| Table | When |
| --- | --- |
| `Subscription`, `Seat` | B2B SaaS |
| `Deal`, `LedgerEntry` | 5% marketplace fee |
| `ModerationCase` | Trust & safety |
| `RankFeatureSnapshot` | ML ranker |
