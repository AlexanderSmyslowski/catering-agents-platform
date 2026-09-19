#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
# Screen is user-global; canonical worktree identity keeps local lifecycle operations isolated.
STACK_NAMESPACE="catering-$(printf '%s' "${ROOT_DIR}" | shasum -a 256 | cut -c 1-24)"
DATA_ROOT_FILE="${ROOT_DIR}/.runtime/local-stack/data-root.txt"

stop_screen_session() {
  local session_name="$1"
  local screen_id
  while IFS= read -r screen_id; do
    [[ -n "${screen_id}" ]] || continue
    echo "Stoppe ${session_name}..."
    screen -S "${screen_id}" -X quit || true
  done < <((screen -ls 2>/dev/null || true) | awk -v name="${session_name}" '
    $1 ~ /^[0-9]+\./ && substr($1, index($1, ".") + 1) == name { print $1 }
  ')
}

stop_repo_processes() {
  local label="$1"
  local entrypoint="$2"
  local expected_cwd="$3"
  local pid command process_cwd

  # A literal executable prefix plus exact cwd excludes nested and sibling worktrees,
  # even when their names contain regex metacharacters or node_modules is shared.
  while read -r pid command; do
    [[ "${pid}" =~ ^[0-9]+$ ]] || continue
    [[ "${command}" == *"${ROOT_DIR}/node_modules/"* ]] || continue
    if [[ "${label}" == "UI" ]]; then
      [[ "${command}" == *"/vite"* && " ${command} " == *" --port 3200 "* ]] || continue
    else
      [[ " ${command} " == *" ${entrypoint} "* || " ${command} " == *" ${ROOT_DIR}/${entrypoint} "* ]] || continue
    fi
    process_cwd="$(lsof -a -p "${pid}" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' || true)"
    [[ "${process_cwd}" == "${expected_cwd}" ]] || continue
    echo "Stoppe verbliebenen ${label}-Prozess ${pid}..."
    kill "${pid}" 2>/dev/null || true
  done < <(ps -ax -o pid= -o command=)
}

stop_screen_session "${STACK_NAMESPACE}-ui"
stop_screen_session "${STACK_NAMESPACE}-exports"
stop_screen_session "${STACK_NAMESPACE}-production"
stop_screen_session "${STACK_NAMESPACE}-offer"
stop_screen_session "${STACK_NAMESPACE}-intake"

sleep 1

stop_repo_processes "UI" "" "${ROOT_DIR}/backoffice-ui"
stop_repo_processes "Intake" "intake-service/src/server.ts" "${ROOT_DIR}"
stop_repo_processes "Angebot" "offer-service/src/server.ts" "${ROOT_DIR}"
stop_repo_processes "Produktion" "production-service/src/server.ts" "${ROOT_DIR}"
stop_repo_processes "Export" "print-export/src/server.ts" "${ROOT_DIR}"

# This removes only the runtime pointer; rehearsal data remains available for inspection.
if [[ -f "${DATA_ROOT_FILE}" ]]; then
  if [[ "$(uname -s)" == "Darwin" && -x /usr/bin/trash ]]; then
    /usr/bin/trash "${DATA_ROOT_FILE}"
  else
    echo "Datenwurzel-Marker bleibt erhalten: ${DATA_ROOT_FILE} (kein macOS Trash verfügbar)."
  fi
fi

echo "Lokaler Stack gestoppt."
