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
PUBLIC_SMOKE_ATTEMPTS="${PUBLIC_SMOKE_ATTEMPTS:-15}"

assert_ok_json() {
  local label="$1"
  local url="$2"
  local body="" attempt
  echo "Checking ${label}"
  for attempt in $(seq 1 "${PUBLIC_SMOKE_ATTEMPTS}"); do
    if body="$(curl "${COMMON_CURL_ARGS[@]}" "${url}")"; then
      if printf '%s' "${body}" | grep -Eq '"ok"[[:space:]]*:[[:space:]]*true'; then
        echo "${label}: ok"
        return 0
      fi
      echo "${label}: response did not identify a healthy Zeiterfassung endpoint (attempt ${attempt}/${PUBLIC_SMOKE_ATTEMPTS})." >&2
    else
      echo "${label}: public endpoint not ready (attempt ${attempt}/${PUBLIC_SMOKE_ATTEMPTS})." >&2
    fi
    sleep 2
  done
  echo "${label}: response did not identify a healthy Zeiterfassung endpoint after ${PUBLIC_SMOKE_ATTEMPTS} attempts." >&2
  return 1
}

check_http() {
  local label="$1"
  local url="$2"
  local attempt
  echo "Checking ${label}"
  for attempt in $(seq 1 "${PUBLIC_SMOKE_ATTEMPTS}"); do
    if curl "${COMMON_CURL_ARGS[@]}" --output /dev/null "${url}"; then
      echo "${label}: ok"
      return 0
    fi
    echo "${label}: public endpoint not ready (attempt ${attempt}/${PUBLIC_SMOKE_ATTEMPTS})." >&2
    sleep 2
  done
  echo "${label}: public endpoint did not become ready after ${PUBLIC_SMOKE_ATTEMPTS} attempts." >&2
  return 1
}

assert_ok_json "Zeiterfassung healthz" "${ZEITERFASSUNG_SMOKE_URL}/healthz"
assert_ok_json "Zeiterfassung readyz" "${ZEITERFASSUNG_SMOKE_URL}/readyz"
assert_ok_json "Zeiterfassung public config" "${ZEITERFASSUNG_SMOKE_URL}/api/public/config"
check_http "EventOS" "${EVENTOS_SMOKE_URL}/"

SMOKE_BASIC_AUTH_USER="${CATERING_SMOKE_BASIC_AUTH_USER:-}" \
SMOKE_BASIC_AUTH_PASSWORD="${CATERING_SMOKE_BASIC_AUTH_PASSWORD:-}" \
bash "${REPO_ROOT}/platform-infra/scripts/smoke-check.sh" "${CATERING_SMOKE_URL}"

echo "All managed public-host smoke checks passed."
