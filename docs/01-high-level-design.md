# JANUS High-Level Design

**Status:** Draft v1 — MVP architecture, scale path to 1M users  
**Region:** `ap-south-1`  
**Style:** Modular monolith (NestJS) behind CloudFront / ALB

---

## 1. Problem

Recruiters cannot judge student builders from a PDF resume. Students will not put real prototypes, CAD, or code on a public TikTok-style feed. JANUS splits the product into two planes:

| Plane | Audience | Content | Protection |
| --- | --- | --- | --- |
| **Public feed** | Anyone signed in | 9:16 watermarked HLS clips, profile, university | Visible watermark, no source files |
| **Vault** | Recruiter after NDA | Schematics, repos, high-res, CAD | KMS envelope encryption + signed URLs + forensic watermark + audit |

MVP utility is exactly those two planes: students upload, recruiters scroll, NDA unlocks the vault.

---

## 2. Users and jobs

```mermaid
flowchart LR
  S[Student innovator] -->|Publish 15–60s clips| F[Public feed]
  S -->|Store IP| V[Encrypted vault]
  R[Enterprise recruiter] -->|Scroll and shortlist| F
  R -->|Sign digital NDA| N[NDA service]
  N -->|Grant| V
  O[Org admin] -->|Seats, billing later| B[B2B SaaS]
```

| Actor | Job to be done |
| --- | --- |
| Student | Record/upload vertical video, attach vault files, control who can request NDA |
| Recruiter | Consume feed, request NDA, view vault, shortlist |
| Org admin | Manage seats (post-MVP), billing |
| Platform admin | Moderation, abuse, key rotation |

---

## 3. C4 — System context

```mermaid
C4Context
  title JANUS system context
  Person(student, "Student", "Publishes video + vault IP")
  Person(recruiter, "Recruiter", "Feed + NDA + vault")
  Person(admin, "Org admin", "Seats and billing")
  System(janus, "JANUS", "Feed, identity, NDA, vault, media")
  System_Ext(cognito, "Amazon Cognito")
  System_Ext(s3, "Amazon S3")
  System_Ext(mc, "MediaConvert")
  System_Ext(ses, "Amazon SES / SNS")
  System_Ext(esign, "eSign provider", "Phase 2 — Dropbox Sign")
  Rel(student, janus, "HTTPS / HLS")
  Rel(recruiter, janus, "HTTPS / HLS")
  Rel(admin, janus, "HTTPS")
  Rel(janus, cognito, "JWT")
  Rel(janus, s3, "Put/Get")
  Rel(janus, mc, "Jobs")
  Rel(janus, ses, "Email / push")
  Rel(janus, esign, "Envelope")
```

---

## 4. C4 — Containers

```mermaid
flowchart TB
  subgraph clients [Clients]
    RN[React Native Expo<br/>iOS + Android]
    WEB[Next.js<br/>Recruiter portal]
  end

  subgraph edge [Edge]
    CF[CloudFront + WAF]
    ALB[ALB]
  end

  subgraph compute [Compute — ECS Fargate]
    API[NestJS API]
    WKR[Workers<br/>media, NDA, notify]
  end

  subgraph data [Data]
    PG[(Aurora PostgreSQL)]
    RD[(ElastiCache Redis)]
    UP[S3 uploads]
    PUB[S3 public-media]
    VLT[S3 vault KMS]
  end

  subgraph aws [AWS platform]
    COG[Cognito]
    KMS[KMS]
    MC[MediaConvert]
    SQS[SQS / EventBridge]
  end

  RN --> CF
  WEB --> CF
  CF -->|API / web| ALB
  CF -->|HLS| PUB
  ALB --> API
  API --> PG
  API --> RD
  API --> COG
  API --> UP
  API --> VLT
  API --> KMS
  API --> SQS
  SQS --> WKR
  WKR --> MC
  MC --> PUB
  WKR --> PG
```

The API never streams video. Clients play HLS from CloudFront. The API only mints grants and signed URLs.

---

## 5. Bounded contexts (NestJS modules)

Keep one deployable. Boundaries are modules + database schemas (or table prefixes), not separate repos.

| Context | Owns | Does not own |
| --- | --- | --- |
| **Identity** | Cognito mapping, profiles, orgs, roles | Feed ranking |
| **Media** | Upload tickets, transcode jobs, playback URLs | NDA legal state |
| **Feed** | Timeline, follows, likes, comments | Vault bytes |
| **Vault** | Encrypted objects, envelope keys, grants | User passwords |
| **NDA** | Templates, requests, signatures, legal hash | Transcoding |
| **Notify** | In-app, push, email | Business rules |
| **Billing** | Plans, seats, 5% deal fee (post-MVP) | Feed |
| **Audit** | Append-only access log | Mutations of content |

```mermaid
flowchart LR
  ID[Identity] --> FD[Feed]
  ID --> MD[Media]
  ID --> NDA[NDA]
  MD --> FD
  NDA --> VT[Vault]
  MD --> VT
  VT --> AU[Audit]
  NDA --> AU
  ID --> NT[Notify]
  NDA --> NT
  ID --> BL[Billing]
```

---

## 6. AWS reference topology

| Resource | Purpose | MVP size |
| --- | --- | --- |
| Route 53 | `api.janus.app`, `app.janus.app`, `cdn.janus.app` | 1 hosted zone |
| CloudFront | Web, API cache (GET only), HLS | 2 distributions |
| AWS WAF | Rate limit, bot, geo if needed | API + CDN |
| ALB | ECS target groups: api, workers | 1 ALB, 2 TGs |
| ECS Fargate | NestJS API (min 2 tasks, multi-AZ) | 0.5–1 vCPU |
| ECS Fargate | Workers (scale on SQS depth) | 0.25–1 vCPU |
| Aurora PostgreSQL | Source of truth | Serverless v2, 0.5–2 ACU |
| RDS Proxy | Connection pooling for bursty RN clients | Required before 10k DAU |
| ElastiCache Redis | Feed cache, rate limit, locks | cache.t4g.small |
| S3 `janus-uploads` | Presigned PUT, private | Versioning on |
| S3 `janus-public-media` | HLS + thumbs, CF OAC only | Lifecycle to IA |
| S3 `janus-vault` | KMS-CMK, no public, no CF except signed | Object Lock later |
| MediaConvert | HLS 540/720/1080 + watermark | On-demand queue |
| KMS | Platform CMK + per-asset data keys | Automatic rotation |
| Cognito | User pools, groups | Email + Google later |
| SES + Pinpoint/SNS | Transactional mail, push | Sandbox → production |
| Secrets Manager | DB, JWT, eSign keys | — |
| CloudWatch + X-Ray | Logs, traces, alarms | — |

All stateful stores stay in `ap-south-1`. CloudFront is global.

---

## 7. Trust boundaries

```mermaid
flowchart TB
  subgraph public [Public internet]
    APP[Apps]
  end
  subgraph edge [Edge]
    WAF[WAF]
    CF[CloudFront]
  end
  subgraph private [VPC]
    API[API / Workers]
    PG[(Postgres)]
    RD[(Redis)]
  end
  subgraph isolated [No public principal]
    VLT[Vault bucket + KMS]
  end

  APP --> WAF --> CF
  CF --> API
  CF -->|public HLS only| PUB[public-media]
  API --> PG
  API --> RD
  API -->|IAM role, short URL| VLT
```

- Apps authenticate with Cognito JWTs.
- Vault bucket policy: only the API task role and a break-glass admin role.
- Public media: CloudFront OAC; S3 blocks public ACLs.
- Workers have no inbound load balancer.

---

## 8. Content classes

| Class | Examples | Storage | CDN | Watermark |
| --- | --- | --- | --- | --- |
| A — Public video | Feed clips | `public-media` | Yes, unsigned or cookie | Visible overlay |
| B — Public stills | Avatars, thumbs | `public-media` | Yes | Optional |
| C — Vault media | High-res, walkthrough | `vault` + KMS | Signed, 5–15 min | Visible + forensic per viewer |
| D — Vault files | PDF, STEP, zip | `vault` + KMS | Presigned GET, 5 min | Download filename + audit |
| E — NDA artifacts | Signed PDF, hash | `vault` or legal bucket | Never public | Checksum in Postgres |

Class A is what the TikTok-style feed plays. Classes C–E never appear in the feed player.

---

## 9. High-level request paths

**Feed play:** Client → CloudFront (HLS) → S3 public-media. API used only to fetch video ids and captions.

**Upload:** Client asks API for presigned PUT → S3 uploads → S3 event → SQS → worker → MediaConvert → public-media → Postgres `READY`.

**NDA unlock:** Recruiter signs → NDA module writes agreement + grant → Vault module mints CloudFront signed URL / cookie → client streams C/D → Audit row.

---

## 10. What we explicitly do not do in MVP

- Microservices, Kubernetes, Kafka
- On-device E2E encryption that the server cannot grant (breaks recruiter web + watermarking)
- Full DRM (FairPlay / Widevine) — Phase 2 if leakage is proven
- TikTok-grade ranking ML — recency + engagement + university affinity
- Marketplace payments / 5% fee — schema ready, product later
- Flutter — React Native is the single mobile stack

---

## 11. Success metrics for the architecture

| Signal | MVP target | 1M-user target |
| --- | --- | --- |
| API p95 (non-video) | < 200 ms | < 150 ms |
| Feed start (time-to-first-frame) | < 1.5 s on 4G | < 1.0 s |
| Upload to playable HLS | < 8 min for 60s 1080p | < 4 min |
| Vault grant mint | < 300 ms | < 200 ms |
| RPO / RTO | Daily snapshot / 4 h | PITR 5 min / 30 min |
