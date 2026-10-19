# syntax=docker/dockerfile:1
# Build from the monorepo root:
#   docker build -f apps/api/Dockerfile -t janus-api .

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY prisma ./prisma
COPY packages ./packages
COPY apps/api/package.json ./apps/api/package.json
RUN pnpm install --frozen-lockfile --filter @janus/api...
COPY apps/api ./apps/api
RUN pnpm exec prisma generate && pnpm --filter @janus/api build \
  && test -f apps/api/dist/main.js \
  && pnpm --filter @janus/api deploy --prod --legacy /out \
  && mkdir -p /out/dist && cp -R apps/api/dist/. /out/dist/

FROM node:22-alpine AS runtime
RUN apk add --no-cache wget \
  && addgroup -S janus && adduser -S janus -G janus
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=janus:janus /out ./
USER janus
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ready >/dev/null || exit 1
CMD ["node", "dist/main.js"]
