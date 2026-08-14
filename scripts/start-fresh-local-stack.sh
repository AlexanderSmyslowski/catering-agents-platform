#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRESH_ROOT_PARENT="${CATERING_FRESH_DATA_PARENT:-${TMPDIR:-/tmp}}"
FRESH_DATA_ROOT="$(mktemp -d "${FRESH_ROOT_PARENT%/}/catering-agents-rehearsal-XXXXXX")"

echo "Kontrollierter lokaler Rehearsal-Frischlauf."
echo "Bestehende Repo-Daten unter ./data werden nicht geloescht."
echo "Temporäre Datenwurzel: ${FRESH_DATA_ROOT}"

bash "${ROOT_DIR}/scripts/stop-local-stack.sh"

if [[ -n "${CATERING_DATABASE_URL:-}" || -n "${DATABASE_URL:-}" ]]; then
  echo "Database-URLs aus der Umgebung werden fuer diesen Fresh-File-Run ignoriert."
fi
unset CATERING_DATABASE_URL
unset DATABASE_URL
export CATERING_DATA_ROOT="${FRESH_DATA_ROOT}"
if [[ "$#" -eq 1 && "${1}" == "--seed-demo" ]]; then
  bash "${ROOT_DIR}/scripts/start-local-stack.sh" --seed-demo
elif [[ "$#" -gt 0 ]]; then
  echo "Unbekannte Fresh-Start-Option(en): $*. Erlaubt ist nur --seed-demo." >&2
  exit 2
else
  bash "${ROOT_DIR}/scripts/start-local-stack.sh"
fi

echo
echo "Frischlauf bereit."
echo "Datenwurzel: ${FRESH_DATA_ROOT}"
echo "Pruefen mit: npm run local:check"
