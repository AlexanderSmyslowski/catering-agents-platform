#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
START_COMMAND="npm run local:start --seed-demo"

required_sessions=(
  "catering-ui"
  "catering-intake"
  "catering-offer"
  "catering-production"
  "catering-exports"
)

required_urls=(
  "UI|http://127.0.0.1:3200/"
  "Intake|http://127.0.0.1:3101/health"
  "Angebot|http://127.0.0.1:3102/health"
  "Produktion|http://127.0.0.1:3103/health"
  "Export|http://127.0.0.1:3104/health"
)

screen_session_exists() {
  local session_name="$1"
  (screen -ls 2>/dev/null || true) | grep -q "\\.${session_name}[[:space:]]"
}

for session_name in "${required_sessions[@]}"; do
  if ! screen_session_exists "${session_name}"; then
    echo "Lokaler Stack nicht vollstaendig gestartet. Bitte zuerst: ${START_COMMAND}" >&2
    exit 1
  fi
done

echo "Startweg vorhanden: ${START_COMMAND}"
echo ""
echo "Statuspruefung:"
bash "${ROOT_DIR}/scripts/status-local-stack.sh"
echo ""
echo "Healthpruefung:"

for entry in "${required_urls[@]}"; do
  label="${entry%%|*}"
  url="${entry#*|}"
  code="$(curl -sS -o /dev/null -w '%{http_code}' "${url}")"
  if [[ "${code}" != "200" ]]; then
    echo "  ${label}: nicht erreichbar (${url}, HTTP ${code})" >&2
    exit 1
  fi
  echo "  ${label}: erreichbar (${url}, HTTP 200)"
done

echo ""
echo "Lokaler Betriebsweg reproduzierbar bestaetigt: Start -> Status -> Health."
