#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${1:-${DEPLOY_BASE_URL:-http://localhost:8080}}"
BASE_URL="${BASE_URL%/}"

check() {
  local url="$1"
  echo "Checking ${url}"
  curl -fsS "${url}" >/dev/null
}

check "${BASE_URL}/api/intake/health"
check "${BASE_URL}/api/offers/health"
check "${BASE_URL}/api/production/health"
check "${BASE_URL}/api/exports/health"

echo "Smoke checks passed for ${BASE_URL}."
