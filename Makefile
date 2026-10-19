# JANUS — API + iOS local loop (Next.js is not started).
#
#   Local loop:   make dev
#   Debugger:     make debug          (Nest inspect :9229)
#   Prod gate:    make prod-check     (typecheck + e2e + cdk synth, never deploys)
#   Container:    make image-api
#   Recruiter UI: make web            (opt-in; not part of make dev)
#
# Deploy (cdk deploy / EAS submit) is still manual — see infra/cdk/README.md

SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help

IPHONE       ?= iPhone 17
API_PORT     ?= 3000
DEBUG        ?= 0
CLEAR        ?= 0
INSTALL      ?= 0
NATIVE       ?= 0
BOOT_TIMEOUT ?= 120

DEV = IPHONE="$(IPHONE)" API_PORT="$(API_PORT)" DEBUG="$(DEBUG)" CLEAR="$(CLEAR)" INSTALL="$(INSTALL)" NATIVE="$(NATIVE)" BOOT_TIMEOUT="$(BOOT_TIMEOUT)" bash scripts/dev.sh

.PHONY: help dev debug setup infra db api ios stop down logs doctor \
	reset-ios test k6 synth prod-check image-api web

help:
	@echo "JANUS  (API + iOS only — web is opt-in via make web)"
	@echo ""
	@echo "  make dev          infra, DB, API :$(API_PORT), $(IPHONE) + Expo Go"
	@echo "  make debug        make dev + Nest --inspect :9229"
	@echo "  make ios          Expo → booted $(IPHONE) (API must be up)"
	@echo "  make stop         stop API we started + Metro"
	@echo "  make down         stop + docker compose stop redis/localstack"
	@echo "  make logs         follow .make/api.log"
	@echo "  make doctor       check Node, pnpm, Docker, Xcode, ports"
	@echo "  make reset-ios    erase the $(IPHONE) simulator if boot is wedged"
	@echo ""
	@echo "  make setup        .env + pnpm + prisma generate"
	@echo "  make infra        Docker Redis + LocalStack; Postgres only if :5432 free"
	@echo "  make db           prisma migrate deploy + seed"
	@echo "  make api          Nest watch on :$(API_PORT)"
	@echo ""
	@echo "  make test         API e2e"
	@echo "  make k6           local k6 smoke (API must be up)"
	@echo "  make synth        CDK synth staging+prod"
	@echo "  make prod-check   typecheck + e2e + synth  (no AWS deploy)"
	@echo "  make image-api    docker build linux/arm64 API image"
	@echo "  make web          Next.js :3001 (not part of make dev)"
	@echo ""
	@echo "  IPHONE='iPhone 17 Pro' make dev"
	@echo "  NATIVE=1 make ios          # Xcode / native build (if Expo Go SDK mismatches)"
	@echo "  CLEAR=1 make ios           # reset Metro cache (use after Expo upgrades)"
	@echo "  INSTALL=1 make setup       # force pnpm install"

dev:
	@$(DEV) dev

debug:
	@$(MAKE) dev DEBUG=1

setup:
	@$(DEV) setup

infra:
	@$(DEV) infra

db:
	@$(DEV) db

api:
	@$(DEV) api

ios:
	@$(DEV) ios

stop:
	@$(DEV) stop

down:
	@$(DEV) down

logs:
	@$(DEV) logs

doctor:
	@$(DEV) doctor

reset-ios:
	@$(DEV) reset-ios

test:
	pnpm test:api

k6:
	pnpm k6:smoke

synth:
	pnpm infra:synth

prod-check:
	@$(DEV) prod-check

image-api:
	docker build --platform linux/arm64 -f apps/api/Dockerfile -t janus-api:local .

web:
	pnpm dev:web
