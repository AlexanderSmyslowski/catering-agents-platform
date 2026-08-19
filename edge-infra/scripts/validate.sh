#!/usr/bin/env bash

set -euo pipefail

EDGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EDGE_ENV_FILE="${EDGE_ENV_FILE:-${EDGE_DIR}/.env}"

cd "${EDGE_DIR}"

test -f "${EDGE_ENV_FILE}" || {
  echo "Missing edge environment file: ${EDGE_ENV_FILE}" >&2
  exit 1
}

docker compose -p shared-edge --env-file "${EDGE_ENV_FILE}" config >/dev/null

docker compose -p shared-edge --env-file "${EDGE_ENV_FILE}" \
  run --rm --no-deps --entrypoint caddy edge validate --config /etc/caddy/Caddyfile
