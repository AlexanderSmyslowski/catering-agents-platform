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
echo "Exportpruefung:"
export_url="http://127.0.0.1:3200/api/exports/v1/exports/production-plans/plan-spec-demo-production-coffee/html"
export_anchor="Produktionsplan plan-spec-demo-production-coffee"
export_body="$(curl -fsS "${export_url}")"
if [[ "${export_body}" != *"${export_anchor}"* ]]; then
  echo "  Export-Check: unerwarteter Inhalt (${export_url})" >&2
  exit 1
fi
printf '  Export-Check: erreichbar (%s, enthält %s)\n' "${export_url}" "${export_anchor}"

echo ""
echo "Bootstrapp-/Auditpruefung:"
audit_url="http://127.0.0.1:3103/v1/production/audit/events?limit=5"
audit_body="$(curl -fsS -H "x-actor-name: Betriebs-/Audit-Operator" "${audit_url}")"
if [[ "${audit_body}" != *"production.seed_demo"* ]] || [[ "${audit_body}" != *"Betriebs-/Audit-Operator"* ]]; then
  echo "  Audit-Check: erwarteter Seed-Demo-Eintrag fehlt (${audit_url})" >&2
  exit 1
fi
printf '  Audit-Check: erreichbar (%s, enthält production.seed_demo und Betriebs-/Audit-Operator)\n' "${audit_url}"

echo ""
echo "Lokaler Betriebsweg reproduzierbar bestaetigt: Start -> Status -> Health -> Export -> Bootstrap/Audit."
