#!/usr/bin/env bash
# JANUS local control plane: API + iOS only (no Next.js).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE="$ROOT/.make"
IPHONE="${IPHONE:-iPhone 17}"
API_PORT="${API_PORT:-3000}"
DEBUG="${DEBUG:-0}"
CLEAR="${CLEAR:-0}"
INSTALL="${INSTALL:-0}"
NATIVE="${NATIVE:-0}"
BOOT_TIMEOUT="${BOOT_TIMEOUT:-120}"
API_URL="http://127.0.0.1:${API_PORT}"
IOS_PY="$ROOT/scripts/dev/ios_sim.py"

mkdir -p "$STATE"

log() { printf '\033[1;36m[janus]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[janus]\033[0m %s\n' "$*" >&2; }
die() { printf '\033[1;31m[janus]\033[0m %s\n' "$*" >&2; exit 1; }

port_busy() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

# Metro with --localhost often binds ::1 only on macOS; Expo Go uses 127.0.0.1.
metro_ready() {
  curl -sf "http://127.0.0.1:8081/status" >/dev/null 2>&1 \
    || curl -g -sf "http://[::1]:8081/status" >/dev/null 2>&1
}

metro_url() {
  # Prefer IPv4 — that is what Expo Go / simctl openurl use.
  if curl -sf "http://127.0.0.1:8081/status" >/dev/null 2>&1; then
    echo "exp://127.0.0.1:8081"
    return 0
  fi
  local ip
  ip="$(ipconfig getifaddr en0 2>/dev/null || true)"
  if [[ -z "$ip" ]]; then
    ip="$(ipconfig getifaddr en1 2>/dev/null || true)"
  fi
  if [[ -n "$ip" ]] && curl -sf "http://${ip}:8081/status" >/dev/null 2>&1; then
    echo "exp://${ip}:8081"
    return 0
  fi
  echo "exp://127.0.0.1:8081"
}

wait_tcp() {
  local host="$1" port="$2" tries="${3:-60}"
  local i=0
  while (( i < tries )); do
    if nc -z "$host" "$port" >/dev/null 2>&1; then return 0; fi
    sleep 1
    i=$((i + 1))
  done
  return 1
}

wait_http() {
  local url="$1" tries="${2:-60}"
  local i=0
  while (( i < tries )); do
    if curl -sf "$url" >/dev/null 2>&1; then return 0; fi
    sleep 1
    i=$((i + 1))
  done
  return 1
}

need() {
  command -v "$1" >/dev/null 2>&1 || die "Missing '$1'. $2"
}

cmd_doctor() {
  log "Doctor (API + iOS — Next.js is not part of this loop)"
  need node "Install Node 22+: https://nodejs.org"
  need pnpm "corepack enable && corepack prepare pnpm@9.15.0 --activate"
  need docker "Install Docker Desktop"
  need curl ""
  need python3 ""
  docker info >/dev/null 2>&1 || die "Docker daemon is not running"
  local major
  major="$(node -p 'process.versions.node.split(".")[0]')"
  (( major >= 22 )) || die "Node $(node -v) is too old (need >= 22)"
  if ! xcode-select -p >/dev/null 2>&1; then
    die "Xcode CLI tools missing. xcode-select --install"
  fi
  xcrun simctl help >/dev/null 2>&1 || die "simctl unavailable. Open Xcode once and accept the license."
  if ! xcrun simctl list runtimes | grep -q 'iOS'; then
    die "No iOS Simulator runtime. Xcode → Settings → Platforms → iOS"
  fi
  if ! xcrun simctl list devicetypes | grep -qF 'com.apple.CoreSimulator.SimDeviceType.iPhone-17)'; then
    die "iPhone 17 simulator type missing. Install the latest Xcode / iOS runtime."
  fi
  if port_busy 5432; then
    log "Postgres already on :5432 (Homebrew) — will not start Docker Postgres"
  else
    log "No Postgres on :5432 — make infra will start Docker Postgres"
  fi
  if port_busy "$API_PORT"; then
    if curl -sf "$API_URL/ready" >/dev/null 2>&1; then
      log "API already healthy at $API_URL/ready"
    else
      warn "Port $API_PORT is busy but /ready failed — make stop, then retry"
    fi
  fi
  log "OK"
}

cmd_setup() {
  cd "$ROOT"
  if [[ ! -f .env ]]; then
    cp .env.example .env
    log "Wrote .env from .env.example"
  fi
  if [[ ! -f apps/mobile/.env.local ]]; then
    cp apps/mobile/.env.example apps/mobile/.env.local
    log "Wrote apps/mobile/.env.local"
  fi
  python3 - "$ROOT" "$API_PORT" <<'PY'
import pathlib, sys
root = pathlib.Path(sys.argv[1])
port = sys.argv[2]
path = root / "apps/mobile/.env.local"
text = path.read_text() if path.exists() else ""
wanted = f"EXPO_PUBLIC_API_URL=http://127.0.0.1:{port}"
lines = [ln for ln in text.splitlines() if not ln.startswith("EXPO_PUBLIC_API_URL=")]
if "EXPO_PUBLIC_AUTH_MODE=" not in "\n".join(lines):
    lines.append("EXPO_PUBLIC_AUTH_MODE=local")
lines = [wanted] + [ln for ln in lines if ln]
path.write_text("\n".join(lines) + "\n")
PY
  if [[ ! -d node_modules ]] || [[ "$INSTALL" == "1" ]]; then
    log "pnpm install"
    pnpm install
  else
    log "node_modules present — skip install (INSTALL=1 make setup to force)"
  fi
  log "prisma generate"
  pnpm db:generate
}

cmd_infra() {
  cd "$ROOT"
  docker info >/dev/null 2>&1 || die "Docker daemon is not running"
  local services=(redis localstack)
  if port_busy 5432; then
    log "Leaving Homebrew Postgres on :5432"
  else
    services+=(postgres)
    log "Starting Docker Postgres on :5432"
  fi
  log "docker compose up -d ${services[*]}"
  docker compose up -d "${services[@]}"
  wait_tcp 127.0.0.1 6379 40 || die "Redis did not become ready on :6379"
  wait_http http://127.0.0.1:4566/_localstack/health 40 || die "LocalStack did not become ready on :4566"
  wait_tcp 127.0.0.1 5432 40 || die "Postgres did not become ready on :5432"
  log "Infra ready (redis, localstack, postgres)"
}

cmd_db() {
  cd "$ROOT"
  wait_tcp 127.0.0.1 5432 20 || die "Postgres is not listening on :5432"
  log "prisma migrate deploy"
  pnpm db:deploy
  log "prisma db seed"
  pnpm db:seed
}

api_owned() {
  [[ -f "$STATE/api.pid" ]] && kill -0 "$(cat "$STATE/api.pid")" 2>/dev/null
}

cmd_api() {
  cd "$ROOT"
  if curl -sf "$API_URL/ready" >/dev/null 2>&1; then
    log "API already ready at $API_URL — reusing"
    return 0
  fi
  if port_busy "$API_PORT"; then
    die "Port $API_PORT is in use but /ready failed. make stop  (or kill the process on $API_PORT)"
  fi
  local extra=""
  if [[ "$DEBUG" == "1" ]]; then extra=", inspect :9229"; fi
  log "Starting Nest API (watch${extra})"
  # Drop legacy incremental caches outside dist/ (pre-fix). Nest deleteOutDir
  # only clears dist/, so a root *.tsbuildinfo can skip emit and break boot.
  rm -f "$ROOT/apps/api/tsconfig.tsbuildinfo" "$ROOT/apps/api/tsconfig.build.tsbuildinfo"
  local nest_args=(start --watch)
  if [[ "$DEBUG" == "1" ]]; then
    nest_args+=(--debug 9229)
  fi
  # nohup + disown: `make ios` execs Expo and must not SIGHUP the API.
  nohup pnpm --filter @janus/api exec nest "${nest_args[@]}" >"$STATE/api.log" 2>&1 &
  echo $! >"$STATE/api.pid"
  echo 1 >"$STATE/api.owned"
  disown $! 2>/dev/null || true
  # Fail fast if compile reported OK but never wrote the entrypoint.
  local i=0
  while (( i < 45 )); do
    if [[ -f "$ROOT/apps/api/dist/main.js" ]]; then
      break
    fi
    if ! kill -0 "$(cat "$STATE/api.pid")" 2>/dev/null; then
      tail -n 80 "$STATE/api.log" >&2 || true
      die "API process exited before emitting dist/main.js. See .make/api.log"
    fi
    sleep 1
    i=$((i + 1))
  done
  if [[ ! -f "$ROOT/apps/api/dist/main.js" ]]; then
    tail -n 80 "$STATE/api.log" >&2 || true
    die "API compile did not emit dist/main.js. See .make/api.log"
  fi
  if ! wait_http "$API_URL/ready" 90; then
    tail -n 80 "$STATE/api.log" >&2 || true
    die "API did not become ready. See .make/api.log"
  fi
  log "API ready  $API_URL/ready   docs $API_URL/docs"
  if [[ "$DEBUG" == "1" ]]; then
    log "Chrome inspect: chrome://inspect  → 127.0.0.1:9229"
  fi
}

cmd_ios() {
  need xcrun "Install Xcode"
  if ! curl -sf "$API_URL/ready" >/dev/null 2>&1; then
    die "API is not ready at $API_URL/ready. Run make api (or make dev)."
  fi
  local udid
  udid="$(python3 "$IOS_PY" find "$IPHONE")"
  echo "$udid" >"$STATE/ios.udid"
  log "Simulator $IPHONE  $udid"
  BOOT_TIMEOUT="$BOOT_TIMEOUT" python3 "$IOS_PY" wait "$udid" --timeout "$BOOT_TIMEOUT"
  cd "$ROOT/apps/mobile"
  export EXPO_NO_TELEMETRY=1
  export EXPO_PUBLIC_API_URL="http://127.0.0.1:${API_PORT}"
  export EXPO_PUBLIC_AUTH_MODE=local
  if [[ "$NATIVE" == "1" ]]; then
    log "Native debug build → $IPHONE (first compile is slow; closer to production)"
    exec pnpm exec expo run:ios --device "$udid"
  fi
  install_expo_go "$udid"
  # Always --go: managed workflow (no ios/android dirs).
  # Use --lan (not --localhost): on macOS/Node, --localhost often binds ::1 only,
  # while Expo Go opens exp://127.0.0.1 and fails with "Could not connect to the server."
  # Do not pass --ios: Expo CLI treats a single simctl openurl timeout as fatal
  # after installing Expo Go. We open the URL ourselves with retries instead.
  local expo_args=(start --lan --go)
  if [[ "$CLEAR" == "1" ]]; then
    expo_args+=(--clear)
    log "Metro cache clear requested (CLEAR=1)"
  fi
  log "Expo Go → $IPHONE  (Ctrl+C stops Metro; API keeps running)"
  log "If Expo Go rejects SDK 57:  NATIVE=1 make ios"
  open_expo_go "$udid" &
  disown $! 2>/dev/null || true
  exec pnpm exec expo "${expo_args[@]}"
}

expo_go_installed() {
  xcrun simctl get_app_container "$1" host.exp.Exponent >/dev/null 2>&1
}

install_expo_go() {
  local udid="$1"
  if expo_go_installed "$udid"; then
    log "Expo Go already on $IPHONE"
    return 0
  fi
  local cache=""
  cache="$(ls -d "${HOME}/.expo/ios-simulator-app-cache"/Expo-Go-*.app 2>/dev/null | tail -1 || true)"
  if [[ -z "$cache" ]]; then
    warn "Expo Go not cached yet — Metro will start; press i if the simulator stays blank"
    return 0
  fi
  log "Installing Expo Go onto $IPHONE"
  xcrun simctl install "$udid" "$cache"
}

open_expo_go() {
  local udid="$1"
  local url=""
  local i=0
  while (( i < 60 )); do
    if metro_ready; then
      break
    fi
    sleep 1
    i=$((i + 1))
  done
  if ! metro_ready; then
    warn "Metro did not become ready on :8081 — open Expo Go manually (press i)"
    return 1
  fi
  # Wait until IPv4 answers when possible (Expo Go / simctl use 127.0.0.1).
  i=0
  while (( i < 20 )); do
    if curl -sf "http://127.0.0.1:8081/status" >/dev/null 2>&1; then
      break
    fi
    sleep 1
    i=$((i + 1))
  done
  url="$(metro_url)"
  i=0
  while (( i < 12 )); do
    if ! expo_go_installed "$udid"; then
      install_expo_go "$udid" || true
    fi
    if xcrun simctl openurl "$udid" "$url" >/dev/null 2>&1; then
      log "Opened $url on $IPHONE"
      return 0
    fi
    i=$((i + 1))
    sleep 4
  done
  warn "Could not open Expo Go automatically — press i in the Metro terminal"
}

cmd_dev() {
  log "JANUS local  API $API_URL  iOS $IPHONE  debug=$DEBUG  native=$NATIVE"
  cmd_doctor
  cmd_setup
  cmd_infra
  cmd_db
  cmd_api
  cmd_ios
}

cmd_stop() {
  if api_owned; then
    local pid
    pid="$(cat "$STATE/api.pid")"
    log "Stopping API pid $pid"
    kill "$pid" 2>/dev/null || true
    pkill -P "$pid" 2>/dev/null || true
    rm -f "$STATE/api.pid" "$STATE/api.owned"
  else
    log "No Makefile-owned API process"
  fi
  pkill -f "expo start --localhost" 2>/dev/null || true
  pkill -f "expo start --lan" 2>/dev/null || true
  pkill -f "expo start --ios" 2>/dev/null || true
  pkill -f "expo start --go" 2>/dev/null || true
  pkill -f "expo run:ios" 2>/dev/null || true
  # Metro may outlive the Expo CLI parent on Ctrl+C / mode switches.
  if port_busy 8081; then
    local metro_pids
    metro_pids="$(lsof -tiTCP:8081 -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "$metro_pids" ]]; then
      log "Stopping Metro on :8081"
      # shellcheck disable=SC2086
      kill $metro_pids 2>/dev/null || true
    fi
  fi
}

cmd_down() {
  cmd_stop
  cd "$ROOT"
  log "docker compose stop redis localstack"
  docker compose stop redis localstack >/dev/null || true
}

cmd_logs() {
  if [[ ! -f "$STATE/api.log" ]]; then
    die "No .make/api.log yet — start the API with make api / make dev"
  fi
  tail -n 100 -f "$STATE/api.log"
}

cmd_reset_ios() {
  log "Erase simulator $IPHONE (next make ios will boot a clean device)"
  python3 "$IOS_PY" reset "$IPHONE" >/dev/null
}

cmd_prod_check() {
  cd "$ROOT"
  log "Production gate (no deploy): typecheck + API tests + CDK synth"
  pnpm --filter @janus/api typecheck
  pnpm --filter @janus/mobile typecheck
  pnpm test:api
  pnpm infra:synth
  log "Prod check passed. Deploy stays manual — see infra/cdk/README.md"
}

usage() {
  cat <<EOF
usage: $0 <command>

  doctor      toolchain + ports
  setup       .env files, pnpm, prisma generate
  infra       Docker Redis + LocalStack (Postgres only if :5432 is free)
  db          migrate deploy + seed
  api         Nest watch on :$API_PORT (reuse if /ready)
  ios         boot $IPHONE + Expo Go
  dev         doctor → setup → infra → db → api → ios
  stop        stop Makefile-owned API + Expo
  down        stop + docker compose stop
  logs        follow .make/api.log
  reset-ios   erase $IPHONE simulator
  prod-check  typecheck, e2e, cdk synth (does not deploy)

env: IPHONE='$IPHONE' API_PORT=$API_PORT DEBUG=$DEBUG CLEAR=$CLEAR INSTALL=$INSTALL NATIVE=$NATIVE BOOT_TIMEOUT=$BOOT_TIMEOUT
EOF
}

cmd="${1:-}"
shift || true
case "$cmd" in
  doctor) cmd_doctor ;;
  setup) cmd_setup ;;
  infra) cmd_infra ;;
  db) cmd_db ;;
  api) cmd_api ;;
  ios) cmd_ios ;;
  dev) cmd_dev ;;
  stop) cmd_stop ;;
  down) cmd_down ;;
  logs) cmd_logs ;;
  reset-ios) cmd_reset_ios ;;
  prod-check) cmd_prod_check ;;
  ""|-h|--help|help) usage ;;
  *) die "Unknown command '$cmd'"; usage ;;
esac
