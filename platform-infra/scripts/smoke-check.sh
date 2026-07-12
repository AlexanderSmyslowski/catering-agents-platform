#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${1:-${DEPLOY_BASE_URL:-http://localhost:8080}}"
BASE_URL="${BASE_URL%/}"

check() {
  local label="$1"
  local url="$2"
  echo "Checking ${label}: ${url}"
  curl -fsS "${url}" >/dev/null
}

check_health() {
  local label="$1"
  local url="$2"
  local body
  echo "Checking ${label}: ${url}"
  body="$(curl -fsS "${url}")"
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
