# JANUS (InnovaX)

Video-first marketplace for student innovators. Public 9:16 feed plus an NDA-gated encryption wall for prototypes, code, and schematics.

## Status

Phases 0–3 are in the repo (schema, Nest API, Expo, recruiter Next.js). Phase 4 adds k6, CDK (staging + prod), EAS store tracks, and CI/security gates. `cdk synth` is the bar until AWS accounts exist — do not `cdk deploy` without credentials.

## Read first

- [Documentation index](./docs/README.md)
- [High-level design](./docs/01-high-level-design.md)
- [Low-level design](./docs/02-low-level-design.md)
- [Data model](./docs/03-data-model.md)
- [Operations runbooks](./docs/08-operations-runbooks.md)
- [Schema operations](./prisma/README.md)

## Stack

React Native (Expo) · Next.js · NestJS · Aurora PostgreSQL · Redis · S3 · MediaConvert · CloudFront · KMS · Cognito · `ap-south-1`

## Local

One command for the loop that matters: **API + iPhone 17**. Next.js is opt-in.

Requires Node 22+, pnpm 9+, Docker (Redis + LocalStack), Xcode, and PostgreSQL 16 (Homebrew on `:5432` **or** Docker if that port is free).

```bash
make doctor            # Node, pnpm, Docker, Xcode, ports
make dev               # infra + migrate + API :3000 + iPhone 17 + Expo Go
make debug             # same, Nest inspector on :9229
make stop              # API (if Makefile started it) + Metro
make logs              # follow API stdout
```

`make dev` creates `JANUS iPhone 17` if needed, boots it, and leaves Metro in the foreground. Ctrl+C stops Expo only; the API keeps running.

Do not bind Docker Postgres to `5432` while Homebrew Postgres already owns that port — `make infra` skips Docker Postgres in that case.

```bash
IPHONE='iPhone 17 Pro' make dev    # other sim
NATIVE=1 make ios                  # Xcode compile (closer to a store build)
make reset-ios                     # erase a wedged simulator
make prod-check                    # typecheck + e2e + cdk synth (does not deploy)
make image-api                     # linux/arm64 API image
make web                           # Next.js :3001 recruiter portal
```

`cdk deploy` / EAS submit stay manual until AWS + store credentials exist.
# janus-app
# janus-app
