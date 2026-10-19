#!/usr/bin/env bash
set -euo pipefail
SCRIPT="${1:-smoke}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FILE="$ROOT/ops/k6/${SCRIPT}.js"
export BASE_URL="${BASE_URL:-http://localhost:3000}"

if [[ ! -f "$FILE" ]]; then
  echo "unknown scenario: $SCRIPT (smoke|feed|likes|playback|upload|slo)" >&2
  exit 2
fi

use_docker=0
if ! command -v k6 >/dev/null 2>&1; then
  if ! command -v docker >/dev/null 2>&1; then
    echo "Install k6 (brew install k6) or Docker to run load tests." >&2
    exit 1
  fi
  use_docker=1
  if [[ "$BASE_URL" == http://localhost:* ]] || [[ "$BASE_URL" == http://127.0.0.1:* ]]; then
    BASE_URL="${BASE_URL/localhost/host.docker.internal}"
    BASE_URL="${BASE_URL/127.0.0.1/host.docker.internal}"
  fi
fi

ENV_NAMES=(BASE_URL TOKEN SLO_STRICT FEED_RPS LIKE_RPS PLAYBACK_RPS UPLOAD_RPS VIDEO_ID ASSET_ID DURATION MAX_VUS)
FLAGS=()
for name in "${ENV_NAMES[@]}"; do
  if [[ -n "${!name:-}" ]]; then
    FLAGS+=(-e "${name}=${!name}")
  fi
done

if [[ "$use_docker" -eq 0 ]]; then
  exec k6 run "${FLAGS[@]}" "$FILE"
fi

exec docker run --rm -i \
  "${FLAGS[@]}" \
  -v "$ROOT/ops/k6:/scripts:ro" \
  grafana/k6:0.57.0 run "/scripts/${SCRIPT}.js"
