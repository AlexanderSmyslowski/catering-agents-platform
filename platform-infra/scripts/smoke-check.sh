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

check "UI" "${BASE_URL}/"
check "Angebot-UI" "${BASE_URL}/angebot"
check "Produktion-UI" "${BASE_URL}/produktion"
check "Intake-Health" "${BASE_URL}/api/intake/health"
check "Offers-Health" "${BASE_URL}/api/offers/health"
check "Production-Health" "${BASE_URL}/api/production/health"
check "Exports-Health" "${BASE_URL}/api/exports/health"

echo "Smoke checks passed for ${BASE_URL}."
