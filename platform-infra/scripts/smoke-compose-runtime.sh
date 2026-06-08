#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/platform-infra/docker-compose.yml"
PROJECT_NAME="${COMPOSE_PROJECT_NAME:-catering-compose-smoke}"
HTTP_PORT="${HTTP_PORT:-18080}"
HTTPS_PORT="${HTTPS_PORT:-18443}"
BASE_URL="http://127.0.0.1:${HTTP_PORT}"

compose() {
  HTTP_PORT="${HTTP_PORT}" HTTPS_PORT="${HTTPS_PORT}" \
    docker compose -f "${COMPOSE_FILE}" -p "${PROJECT_NAME}" "$@"
}

cleanup() {
  compose down -v --remove-orphans >/dev/null 2>&1 || true
}

require_docker() {
  command -v docker >/dev/null 2>&1
  docker compose version >/dev/null
}

verify_compose_config() {
  compose config --format json | HTTP_PORT="${HTTP_PORT}" node -e '
const fs = require("node:fs");
const cfg = JSON.parse(fs.readFileSync(0, "utf8"));
const services = cfg.services ?? {};
const checks = [
  ["intake", "INTAKE_HOST", "0.0.0.0"],
  ["offer", "OFFER_HOST", "0.0.0.0"],
  ["production", "PRODUCTION_HOST", "0.0.0.0"],
  ["exports", "PRINT_EXPORT_HOST", "0.0.0.0"]
];

for (const [service, key, expected] of checks) {
  const actual = services[service]?.environment?.[key];
  if (actual !== expected) {
    throw new Error(`${service} ${key}=${actual} expected ${expected}`);
  }
}

for (const service of ["intake", "offer", "production", "exports"]) {
  if (services[service]?.ports) {
    throw new Error(`${service} unexpectedly publishes host ports`);
  }
}

const webPorts = services.web?.ports ?? [];
if (!webPorts.some((port) => String(port.published) === process.env.HTTP_PORT)) {
  throw new Error(`web does not publish expected HTTP_PORT ${process.env.HTTP_PORT}`);
}

console.log("Compose config keeps runtime services internal and publishes only web ports.");
'
}

verify_local_defaults() {
  grep -q 'process.env.INTAKE_HOST ?? "127.0.0.1"' "${ROOT_DIR}/intake-service/src/server.ts"
  grep -q 'process.env.OFFER_HOST ?? "127.0.0.1"' "${ROOT_DIR}/offer-service/src/server.ts"
  grep -q 'process.env.PRODUCTION_HOST ?? "127.0.0.1"' "${ROOT_DIR}/production-service/src/server.ts"
  grep -q 'process.env.PRINT_EXPORT_HOST ?? "127.0.0.1"' "${ROOT_DIR}/print-export/src/server.ts"
  echo "Local non-Docker service defaults remain 127.0.0.1."
}

verify_internal_reachability() {
  local target

  for target in intake:3101 offer:3102 production:3103 exports:3104; do
    echo "Checking Docker-internal ${target}/health"
    compose exec -T web wget -qO- "http://${target}/health" >/dev/null
  done
}

verify_proxy_reachability() {
  local attempts=30
  local output=""

  for attempt in $(seq 1 "${attempts}"); do
    if output="$(bash "${ROOT_DIR}/platform-infra/scripts/smoke-check.sh" "${BASE_URL}" 2>&1)"; then
      printf '%s\n' "${output}"
      return 0
    fi

    if [[ "${attempt}" == "${attempts}" ]]; then
      printf '%s\n' "${output}" >&2
      return 1
    fi

    echo "Caddy proxy smoke not ready yet (${attempt}/${attempts}); retrying..."
    sleep 1
  done
}

main() {
  require_docker
  verify_compose_config
  verify_local_defaults

  trap cleanup EXIT
  compose up --build -d

  verify_proxy_reachability
  verify_internal_reachability

  echo "Docker Compose runtime smoke passed: ${BASE_URL}."
}

main "$@"
