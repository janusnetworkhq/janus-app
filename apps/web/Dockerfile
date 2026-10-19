# syntax=docker/dockerfile:1
# Build from the monorepo root:
#   docker build -f apps/web/Dockerfile -t janus-web .

FROM node:26-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/web/package.json ./apps/web/package.json
RUN pnpm install --frozen-lockfile --filter @janus/web...
COPY apps/web ./apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @janus/web build

FROM node:26-alpine AS runtime
RUN addgroup -S janus && adduser -S janus -G janus
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3001
COPY --from=build --chown=janus:janus /repo/apps/web/.next/standalone ./
COPY --from=build --chown=janus:janus /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=janus:janus /repo/apps/web/public ./apps/web/public
USER janus
EXPOSE 3001
CMD ["node", "apps/web/server.js"]
