# JANUS — Architecture Documentation

JANUS is a video-first marketplace where student innovators publish short vertical portfolios of prototypes, code, and schematics, and enterprises discover talent after signing a digital NDA to unlock protected IP.

These documents describe a production-grade system that ships a small MVP first, then scales toward **1 million users** without a rewrite.

## Document map

| Doc | What it covers |
| --- | --- |
| [01 High-Level Design](./01-high-level-design.md) | Product scope, C4 context, stack, AWS topology, bounded contexts |
| [02 Low-Level Design](./02-low-level-design.md) | NestJS modules, APIs, video pipeline, feed, NDA sequences |
| [03 Data Model](./03-data-model.md) | Entities, indexes, Prisma mapping |
| [04 Security & Encryption Wall](./04-security-encryption-wall.md) | KMS, watermarks, NDA access, audit, DPDP |
| [05 Clients](./05-clients-mobile-and-web.md) | React Native (iOS/Android) and recruiter web portal |
| [06 Scale & Operations](./06-scalability-and-operations.md) | 1M-user capacity, caching, SLOs, cost |
| [07 MVP Roadmap](./07-mvp-roadmap.md) | Phased delivery, team split, definition of done |
| [08 Operations runbooks](./08-operations-runbooks.md) | Staging/prod deploy, SLOs, transcode / NDA revoke / CF keys |

Canonical schema: [`prisma/schema.prisma`](../prisma/schema.prisma)

## Locked stack

| Layer | Choice | Why |
| --- | --- | --- |
| Mobile | React Native + Expo | One TypeScript team, iOS + Android, Expo Router, HLS playback |
| Recruiter web | Next.js (App Router) | NDA signing, vault viewing, B2B admin |
| API | NestJS on AWS ECS Fargate | Modular monolith, typed, easy to split later |
| Database | Aurora PostgreSQL + Prisma | Relational integrity for NDA, grants, billing |
| Cache | ElastiCache Redis | Feed, sessions, rate limits, hot profiles |
| Object storage | S3 (uploads, public HLS, vault) | Cheap, durable, event-driven |
| Transcode | AWS Elemental MediaConvert | HLS ladder, watermark overlays |
| CDN | CloudFront + Origin Access Control | Global video, signed URLs for vault |
| Keys | AWS KMS | Envelope encryption for student IP |
| Identity | Amazon Cognito | Students vs recruiters, MFA later |
| Region | `ap-south-1` (Mumbai) | Latency for India + DPDP data residency |

## Non-negotiables

1. Public feed never contains unencrypted source IP (schematics, source zips, raw high-res).
2. Vault bytes leave S3 only after a signed NDA and a short-lived grant.
3. Every vault open is audited (who, what, when, from where).
4. Video delivery is HLS via CloudFront, never origin-direct from the API.
5. The NestJS app stays a **modular monolith** until a module has an independent scale or failure domain.
