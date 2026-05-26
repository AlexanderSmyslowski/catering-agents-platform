#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_ROOT_FILE="${ROOT_DIR}/.runtime/local-stack/data-root.txt"

stop_screen_session() {
  local session_name="$1"
  if (screen -ls 2>/dev/null || true) | grep -q "\\.${session_name}[[:space:]]"; then
    echo "Stoppe ${session_name}..."
    screen -S "${session_name}" -X quit || true
  fi
}

stop_repo_processes() {
  local label="$1"
  local pattern="$2"
  local pids

  pids="$(pgrep -f "${pattern}" 2>/dev/null || true)"
  if [[ -z "${pids}" ]]; then
    return 0
  fi

  echo "Stoppe verbliebene ${label}-Prozesse..."
  while IFS= read -r pid; do
    [[ -n "${pid}" ]] || continue
    kill "${pid}" 2>/dev/null || true
  done <<<"${pids}"
}

if [[ "$(uname -s)" == "Darwin" ]]; then
  launchctl bootout "gui/$(id -u)/com.cateringagents.ui" >/dev/null 2>&1 || true
  launchctl bootout "gui/$(id -u)/com.cateringagents.exports" >/dev/null 2>&1 || true
  launchctl bootout "gui/$(id -u)/com.cateringagents.production" >/dev/null 2>&1 || true
  launchctl bootout "gui/$(id -u)/com.cateringagents.offer" >/dev/null 2>&1 || true
  launchctl bootout "gui/$(id -u)/com.cateringagents.intake" >/dev/null 2>&1 || true
  rm -f \
    "${HOME}/Library/LaunchAgents/com.cateringagents.intake.plist" \
    "${HOME}/Library/LaunchAgents/com.cateringagents.offer.plist" \
    "${HOME}/Library/LaunchAgents/com.cateringagents.production.plist" \
    "${HOME}/Library/LaunchAgents/com.cateringagents.exports.plist" \
    "${HOME}/Library/LaunchAgents/com.cateringagents.ui.plist"
fi

stop_screen_session "catering-ui"
stop_screen_session "catering-exports"
stop_screen_session "catering-production"
stop_screen_session "catering-offer"
stop_screen_session "catering-intake"

sleep 1

stop_repo_processes "UI" "${ROOT_DIR}/node_modules/.*(vite|@vitejs).*--port 3200"
stop_repo_processes "Intake" "${ROOT_DIR}/node_modules/.*intake-service/src/server.ts"
stop_repo_processes "Angebot" "${ROOT_DIR}/node_modules/.*offer-service/src/server.ts"
stop_repo_processes "Produktion" "${ROOT_DIR}/node_modules/.*production-service/src/server.ts"
stop_repo_processes "Export" "${ROOT_DIR}/node_modules/.*print-export/src/server.ts"

rm -f "${DATA_ROOT_FILE}"

echo "Lokaler Stack gestoppt."
