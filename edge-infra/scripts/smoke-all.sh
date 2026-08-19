#!/usr/bin/env bash

set -euo pipefail

: "${CATERING_SMOKE_URL:?Set CATERING_SMOKE_URL}"
: "${ZEITERFASSUNG_SMOKE_URL:?Set ZEITERFASSUNG_SMOKE_URL}"
: "${EVENTOS_SMOKE_URL:?Set EVENTOS_SMOKE_URL}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

CATERING_SMOKE_URL="${CATERING_SMOKE_URL%/}"
ZEITERFASSUNG_SMOKE_URL="${ZEITERFASSUNG_SMOKE_URL%/}"
EVENTOS_SMOKE_URL="${EVENTOS_SMOKE_URL%/}"

COMMON_CURL_ARGS=(--fail --silent --show-error --max-time 15)

assert_ok_json() {
  local label="$1"
  local url="$2"
  local body
  echo "Checking ${label}"
  body="$(curl "${COMMON_CURL_ARGS[@]}" "${url}")"
  if ! printf '%s' "${body}" | grep -Eq '"ok"[[:space:]]*:[[:space:]]*true'; then
    echo "${label}: response did not identify a healthy Zeiterfassung endpoint." >&2
    return 1
  fi
  echo "${label}: ok"
}

check_http() {
  local label="$1"
  local url="$2"
  echo "Checking ${label}"
  curl "${COMMON_CURL_ARGS[@]}" --output /dev/null "${url}"
  echo "${label}: ok"
}

assert_ok_json "Zeiterfassung healthz" "${ZEITERFASSUNG_SMOKE_URL}/healthz"
assert_ok_json "Zeiterfassung readyz" "${ZEITERFASSUNG_SMOKE_URL}/readyz"
assert_ok_json "Zeiterfassung public config" "${ZEITERFASSUNG_SMOKE_URL}/api/public/config"
check_http "EventOS" "${EVENTOS_SMOKE_URL}/"

SMOKE_BASIC_AUTH_USER="${CATERING_SMOKE_BASIC_AUTH_USER:-}" \
SMOKE_BASIC_AUTH_PASSWORD="${CATERING_SMOKE_BASIC_AUTH_PASSWORD:-}" \
bash "${REPO_ROOT}/platform-infra/scripts/smoke-check.sh" "${CATERING_SMOKE_URL}"

echo "All managed public-host smoke checks passed."
