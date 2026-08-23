#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${1:-${DEPLOY_BASE_URL:-http://localhost:8080}}"
BASE_URL="${BASE_URL%/}"
SMOKE_MAX_ATTEMPTS="${SMOKE_MAX_ATTEMPTS:-15}"
SMOKE_RETRY_DELAY_SECONDS="${SMOKE_RETRY_DELAY_SECONDS:-2}"
SMOKE_BASIC_AUTH_USER="${SMOKE_BASIC_AUTH_USER:-}"
SMOKE_BASIC_AUTH_PASSWORD="${SMOKE_BASIC_AUTH_PASSWORD:-}"
CURL_ARGS=(-fsS)

if [[ -n "${SMOKE_BASIC_AUTH_USER}" || -n "${SMOKE_BASIC_AUTH_PASSWORD}" ]]; then
  if [[ -z "${SMOKE_BASIC_AUTH_USER}" || -z "${SMOKE_BASIC_AUTH_PASSWORD}" ]]; then
    echo "SMOKE_BASIC_AUTH_USER and SMOKE_BASIC_AUTH_PASSWORD must be set together." >&2
    exit 1
  fi
  # curl reads credentials from a protected process-substitution FD; they do
  # not appear in argv, container environment, or the retry log.
  CURL_ARGS+=(--config <(printf 'user = "%s:%s"\n' "${SMOKE_BASIC_AUTH_USER}" "${SMOKE_BASIC_AUTH_PASSWORD}"))
fi

fetch_with_retry() {
  local label="$1"
  local url="$2"
  local attempt
  local body
  for ((attempt = 1; attempt <= SMOKE_MAX_ATTEMPTS; attempt += 1)); do
    if body="$(curl "${CURL_ARGS[@]}" "${url}")"; then
      printf '%s' "${body}"
      return 0
    fi
    if ((attempt < SMOKE_MAX_ATTEMPTS)); then
      echo "${label} is not ready; retrying (${attempt}/${SMOKE_MAX_ATTEMPTS})." >&2
      sleep "${SMOKE_RETRY_DELAY_SECONDS}"
    fi
  done
  echo "${label} did not become reachable after ${SMOKE_MAX_ATTEMPTS} attempts." >&2
  return 1
}

check() {
  local label="$1"
  local url="$2"
  echo "Checking ${label}: ${url}"
  fetch_with_retry "${label}" "${url}" >/dev/null
}

check_health() {
  local label="$1"
  local url="$2"
  local body
  echo "Checking ${label}: ${url}"
  body="$(fetch_with_retry "${label}" "${url}")"
  if ! printf '%s' "${body}" | grep -Eq '"status"[[:space:]]*:[[:space:]]*"ok"'; then
    echo "${label} did not return service status ok."
    return 1
  fi
}

check "UI" "${BASE_URL}/"
check "Angebot-UI" "${BASE_URL}/angebot"
check "Produktion-UI" "${BASE_URL}/produktion"
check_health "Intake-Health" "${BASE_URL}/api/intake/health"
check_health "Offers-Health" "${BASE_URL}/api/offers/health"
check_health "Production-Health" "${BASE_URL}/api/production/health"
check_health "Exports-Health" "${BASE_URL}/api/exports/health"

echo "Smoke checks passed for ${BASE_URL}."
