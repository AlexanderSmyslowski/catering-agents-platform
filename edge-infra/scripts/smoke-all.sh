#!/usr/bin/env bash

set -euo pipefail

: "${CATERING_SMOKE_URL:?Set CATERING_SMOKE_URL}"
: "${ZEITERFASSUNG_SMOKE_URL:?Set ZEITERFASSUNG_SMOKE_URL}"
: "${EVENTOS_SMOKE_URL:?Set EVENTOS_SMOKE_URL}"

CATERING_SMOKE_URL="${CATERING_SMOKE_URL%/}"
ZEITERFASSUNG_SMOKE_URL="${ZEITERFASSUNG_SMOKE_URL%/}"
EVENTOS_SMOKE_URL="${EVENTOS_SMOKE_URL%/}"

COMMON_CURL_ARGS=(--fail --silent --show-error --location --max-time 15 --output /dev/null)
CATERING_CURL_ARGS=("${COMMON_CURL_ARGS[@]}")

if [[ -n "${CATERING_SMOKE_BASIC_AUTH_USER:-}" || -n "${CATERING_SMOKE_BASIC_AUTH_PASSWORD:-}" ]]; then
  if [[ -z "${CATERING_SMOKE_BASIC_AUTH_USER:-}" || -z "${CATERING_SMOKE_BASIC_AUTH_PASSWORD:-}" ]]; then
    echo "CATERING_SMOKE_BASIC_AUTH_USER and CATERING_SMOKE_BASIC_AUTH_PASSWORD must be set together." >&2
    exit 1
  fi
  CATERING_CURL_ARGS+=(--user "${CATERING_SMOKE_BASIC_AUTH_USER}:${CATERING_SMOKE_BASIC_AUTH_PASSWORD}")
fi

check() {
  local label="$1"
  local url="$2"
  shift 2
  echo "Checking ${label}"
  curl "$@" "${url}"
  echo "${label}: ok"
}

check "Zeiterfassung healthz" "${ZEITERFASSUNG_SMOKE_URL}/healthz" "${COMMON_CURL_ARGS[@]}"
check "Zeiterfassung readyz" "${ZEITERFASSUNG_SMOKE_URL}/readyz" "${COMMON_CURL_ARGS[@]}"
check "Zeiterfassung public config" "${ZEITERFASSUNG_SMOKE_URL}/api/public/config" "${COMMON_CURL_ARGS[@]}"
check "EventOS" "${EVENTOS_SMOKE_URL}/" "${COMMON_CURL_ARGS[@]}"
check "Catering" "${CATERING_SMOKE_URL}/" "${CATERING_CURL_ARGS[@]}"

echo "All managed public-host smoke checks passed."
