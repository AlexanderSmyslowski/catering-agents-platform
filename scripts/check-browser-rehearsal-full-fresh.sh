#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STACK_LIFECYCLE_ACTIVE=0
REHEARSAL_CHILD_PID=""
REHEARSAL_CHILD_PGID=""
FRESH_RUN_ACTIVE=0
FRESH_PARENT=""
FRESH_PARENT_REAL=""
FRESH_ROOT=""
FRESH_OWNER_MARKER=""
FRESH_RUN_TOKEN=""
FRESH_QUARANTINE_ROOT=""

terminate_descendants() {
  local parent_pid="$1"
  local child_pid
  for child_pid in $(pgrep -P "${parent_pid}" 2>/dev/null || true); do
    terminate_descendants "${child_pid}"
    kill -TERM "${child_pid}" 2>/dev/null || true
  done
}

wait_for_owned_group_exit() {
  local group_id="$1"
  for _ in {1..100}; do
    if ! kill -0 -- "-${group_id}" 2>/dev/null; then
      return 0
    fi
    sleep 0.02
  done
  kill -KILL -- "-${group_id}" 2>/dev/null || true
}

wait_for_owned_pid_exit() {
  local process_id="$1"
  for _ in {1..100}; do
    if ! kill -0 "${process_id}" 2>/dev/null; then
      return 0
    fi
    sleep 0.02
  done
  kill -KILL "${process_id}" 2>/dev/null || true
}

stop_rehearsal_child() {
  if [[ -z "${REHEARSAL_CHILD_PID}" ]]; then
    return 0
  fi
  if [[ -n "${REHEARSAL_CHILD_PGID}" ]]; then
    kill -TERM -- "-${REHEARSAL_CHILD_PGID}" 2>/dev/null || true
    wait_for_owned_group_exit "${REHEARSAL_CHILD_PGID}"
  else
    terminate_descendants "${REHEARSAL_CHILD_PID}"
    kill -TERM "${REHEARSAL_CHILD_PID}" 2>/dev/null || true
    wait_for_owned_pid_exit "${REHEARSAL_CHILD_PID}"
  fi
  wait "${REHEARSAL_CHILD_PID}" 2>/dev/null || true
  REHEARSAL_CHILD_PGID=""
  REHEARSAL_CHILD_PID=""
}

run_owned_command() {
  local command_status=0
  if command -v setsid >/dev/null 2>&1; then
    setsid "$@" &
    REHEARSAL_CHILD_PGID="$!"
  elif command -v perl >/dev/null 2>&1; then
    perl -e 'setpgrp(0, 0); exec @ARGV or die $!' -- "$@" &
    REHEARSAL_CHILD_PGID="$!"
  else
    "$@" &
    REHEARSAL_CHILD_PGID=""
  fi
  REHEARSAL_CHILD_PID="$!"
  wait "${REHEARSAL_CHILD_PID}" || command_status=$?
  # Keep the ownership handles until every descendant is stopped. Otherwise an
  # exited launcher could leave its still-running process group unowned.
  stop_rehearsal_child
  return "${command_status}"
}

is_safe_fresh_parent() {
  local parent="$1"
  local temp_root="${TMPDIR:-/tmp}"
  local canonical_parent
  [[ -n "${parent}" && -d "${parent}" && ! -L "${parent}" ]] || return 1
  canonical_parent="$(cd "${parent}" && pwd -P)" || return 1
  [[ -n "${canonical_parent}" ]] || return 1
  [[ "$(basename "${parent}")" =~ ^catering-agents-rehearsal-parent-[[:alnum:]]{6}$ ]] || return 1
  [[ "${temp_root%/}" != "/" ]] || return 1
  if [[ "${parent}" == "${ROOT_DIR}" || "${parent}" == "${ROOT_DIR}"/* ]]; then
    return 1
  fi
  if [[ "${canonical_parent}" == "${ROOT_DIR}" || "${canonical_parent}" == "${ROOT_DIR}"/* ]]; then
    return 1
  fi
  if [[ -n "${HOME:-}" && ( "${parent}" == "${HOME}" || "${parent}" == "${HOME}"/* ) ]]; then
    return 1
  fi
  if [[ -n "${HOME:-}" && ( "${canonical_parent}" == "${HOME}" || "${canonical_parent}" == "${HOME}"/* ) ]]; then
    return 1
  fi
  [[ "${parent}" == "${temp_root%/}/catering-agents-rehearsal-parent-"* ]] || return 1
}

has_foreign_owner_marker() {
  local root_path="$1"
  local marker_path
  for marker_path in "${root_path}"/.catering-rehearsal-owner-*; do
    if [[ -e "${marker_path}" || -L "${marker_path}" ]]; then
      if [[ "${marker_path}" != "${FRESH_OWNER_MARKER}" ]]; then
        return 0
      fi
    fi
  done
  return 1
}

record_fresh_root() {
  local data_root_file="${ROOT_DIR}/.runtime/local-stack/data-root.txt"
  local root_path
  local root_parent
  local root_parent_real
  if [[ ! -f "${data_root_file}" || -L "${data_root_file}" ]]; then
    return 0
  fi
  root_path="$(<"${data_root_file}")"
  if [[ -z "${root_path}" || "${root_path}" == *$'\n'* ]]; then
    echo "Fresh-Datenwurzel ist leer oder mehrzeilig." >&2
    return 1
  fi
  if ! is_safe_fresh_parent "${FRESH_PARENT}"; then
    echo "Fresh-Datenwurzel-Elternpfad ist nicht sicher abgegrenzt." >&2
    return 1
  fi
  root_parent="$(dirname "${root_path}")"
  root_parent_real="$(cd "${root_parent}" && pwd -P)" || {
    echo "Fresh-Datenwurzel-Elternpfad ist nicht erreichbar." >&2
    return 1
  }
  if [[ "${root_parent_real}" != "${FRESH_PARENT_REAL}" ]]; then
    echo "Fresh-Datenwurzel gehört nicht zum aktuellen Lauf." >&2
    return 1
  fi
  if ! [[ "$(basename "${root_path}")" =~ ^catering-agents-rehearsal-[[:alnum:]]{6}$ ]]; then
    echo "Fresh-Datenwurzel gehört nicht zum aktuellen Lauf." >&2
    return 1
  fi
  if [[ ! -d "${root_path}" || -L "${root_path}" || -e "${root_path}/.catering-rehearsal-owner-${FRESH_RUN_TOKEN}" ]]; then
    echo "Fresh-Datenwurzel ist kein neues, unverändertes Verzeichnis." >&2
    return 1
  fi
  if has_foreign_owner_marker "${root_path}"; then
    echo "Fresh-Datenwurzel enthält einen fremden Eigentümermarker." >&2
    return 1
  fi
  FRESH_ROOT="${root_path}"
  FRESH_OWNER_MARKER="${FRESH_ROOT}/.catering-rehearsal-owner-${FRESH_RUN_TOKEN}"
  printf '%s\n' "${FRESH_RUN_TOKEN}" > "${FRESH_OWNER_MARKER}"
  if [[ ! -f "${FRESH_OWNER_MARKER}" || -L "${FRESH_OWNER_MARKER}" || "$(<"${FRESH_OWNER_MARKER}")" != "${FRESH_RUN_TOKEN}" ]]; then
    echo "Eigentümermarker der Fresh-Datenwurzel konnte nicht bestätigt werden." >&2
    return 1
  fi
}

quarantine_fresh_root() {
  if [[ -n "${FRESH_QUARANTINE_ROOT}" && ! -e "${FRESH_ROOT}" && -d "${FRESH_QUARANTINE_ROOT}" ]]; then
    echo "Fresh-Root bereits quarantiniert: ${FRESH_QUARANTINE_ROOT}" >&2
    return 0
  fi
  if [[ -z "${FRESH_ROOT}" ]]; then
    echo "Quarantäne abgelehnt: keine zuordenbare Fresh-Datenwurzel." >&2
    return 1
  fi
  if ! is_safe_fresh_parent "${FRESH_PARENT}"; then
    echo "Quarantäne abgelehnt: Fresh-Datenwurzel-Elternpfad ist nicht sicher." >&2
    return 1
  fi
  local root_parent
  local root_parent_real
  if [[ ! -d "${FRESH_ROOT}" || -L "${FRESH_ROOT}" ]]; then
    echo "Quarantäne abgelehnt: Fresh-Datenwurzel gehört nicht mehr sicher zum Lauf." >&2
    return 1
  fi
  root_parent="$(dirname "${FRESH_ROOT}")"
  root_parent_real="$(cd "${root_parent}" && pwd -P)" || {
    echo "Quarantäne abgelehnt: Fresh-Datenwurzel-Elternpfad ist nicht erreichbar." >&2
    return 1
  }
  if [[ "${root_parent_real}" != "${FRESH_PARENT_REAL}" ]]; then
    echo "Quarantäne abgelehnt: Fresh-Datenwurzel gehört nicht mehr sicher zum Lauf." >&2
    return 1
  fi
  if ! [[ "$(basename "${FRESH_ROOT}")" =~ ^catering-agents-rehearsal-[[:alnum:]]{6}$ ]]; then
    echo "Quarantäne abgelehnt: Fresh-Datenwurzel trägt kein exaktes Namensmuster." >&2
    return 1
  fi
  if [[ ! -f "${FRESH_OWNER_MARKER}" || -L "${FRESH_OWNER_MARKER}" || "$(<"${FRESH_OWNER_MARKER}")" != "${FRESH_RUN_TOKEN}" ]]; then
    echo "Quarantäne abgelehnt: Eigentümermarker der Fresh-Datenwurzel ist ungültig." >&2
    return 1
  fi
  if has_foreign_owner_marker "${FRESH_ROOT}"; then
    echo "Quarantäne abgelehnt: fremder Eigentümermarker in der Fresh-Datenwurzel." >&2
    return 1
  fi
  local quarantine_root="${FRESH_PARENT_REAL}/catering-agents-rehearsal-quarantine-${FRESH_RUN_TOKEN}"
  if [[ -e "${quarantine_root}" || -L "${quarantine_root}" ]]; then
    echo "Quarantäne abgelehnt: Zielpfad existiert bereits." >&2
    return 1
  fi
  if ! mv "${FRESH_ROOT}" "${quarantine_root}"; then
    echo "Quarantäne konnte nicht atomar verschoben werden." >&2
    return 1
  fi
  FRESH_QUARANTINE_ROOT="${quarantine_root}"
  echo "Fresh-Root quarantiniert: ${FRESH_QUARANTINE_ROOT}" >&2
}

cleanup_stack() {
  local exit_code="$?"
  trap - EXIT INT TERM HUP
  stop_rehearsal_child
  if [[ "${STACK_LIFECYCLE_ACTIVE}" == "1" ]]; then
    bash "${ROOT_DIR}/scripts/stop-local-stack.sh" >/dev/null 2>&1 || true
    STACK_LIFECYCLE_ACTIVE=0
  fi
  if (( exit_code != 0 && FRESH_RUN_ACTIVE == 1 )); then
    if quarantine_fresh_root; then
      echo "Ursprungsfehler bleibt Exit ${exit_code}; Fresh-Root liegt im Quarantänepfad." >&2
    else
      echo "Ursprungsfehler bleibt Exit ${exit_code}; Quarantänefehler zusätzlich gemeldet." >&2
    fi
  fi
  exit "${exit_code}"
}

trap cleanup_stack EXIT
trap 'stop_rehearsal_child; exit 130' INT
trap 'stop_rehearsal_child; exit 143' TERM
trap 'stop_rehearsal_child; exit 129' HUP

run_fresh_rehearsal() {
  local label="$1"
  shift

  local temp_root="${TMPDIR:-/tmp}"
  FRESH_PARENT="$(mktemp -d "${temp_root%/}/catering-agents-rehearsal-parent-XXXXXX")"
  FRESH_PARENT_REAL="$(cd "${FRESH_PARENT}" && pwd -P)"
  FRESH_RUN_TOKEN="$(printf '%s:%s:%s' "$$" "${RANDOM}" "$(date +%s)" | shasum -a 256 | cut -c1-24)"
  FRESH_ROOT=""
  FRESH_OWNER_MARKER=""
  FRESH_QUARANTINE_ROOT=""
  FRESH_RUN_ACTIVE=1
  export CATERING_FRESH_DATA_PARENT="${FRESH_PARENT}"

  echo
  echo "== ${label} =="
  STACK_LIFECYCLE_ACTIVE=1
  local start_status=0
  if run_owned_command bash "${ROOT_DIR}/scripts/start-fresh-local-stack.sh"; then
    :
  else
    start_status=$?
    record_fresh_root || true
    return "${start_status}"
  fi
  record_fresh_root
  export CATERING_FRESH_OWNER_MARKER CATERING_FRESH_RUN_TOKEN
  run_owned_command "$@"
  bash "${ROOT_DIR}/scripts/stop-local-stack.sh"
  STACK_LIFECYCLE_ACTIVE=0
  FRESH_RUN_ACTIVE=0
  unset CATERING_FRESH_DATA_PARENT
}

echo "Vollstaendiger Fresh-Browser-Rehearsal fuer den synthetischen Produktionskern."
echo "Grenze: lokaler synthetischer Browser-Beleg; keine Produktionsfreigabe, keine echten Daten, keine Compliance-Aussage."

run_fresh_rehearsal \
  "Normaler Kernpfad" \
  env -u CATERING_BROWSER_REHEARSAL_SUBMIT_ANSWERS -u CATERING_BROWSER_REHEARSAL_ARCHIVE_INTAKE -u CATERING_BROWSER_REHEARSAL_FAILED_UPLOAD CATERING_BROWSER_REHEARSAL_CREATE_OFFER_CASE=1 \
    bash "${ROOT_DIR}/scripts/check-browser-rehearsal.sh"

run_fresh_rehearsal \
  "Answer-Submit-Pfad" \
  env -u CATERING_BROWSER_REHEARSAL_ARCHIVE_INTAKE -u CATERING_BROWSER_REHEARSAL_FAILED_UPLOAD CATERING_BROWSER_REHEARSAL_SUBMIT_ANSWERS=1 CATERING_BROWSER_REHEARSAL_CREATE_OFFER_CASE=1 \
    bash "${ROOT_DIR}/scripts/check-browser-rehearsal.sh"

run_fresh_rehearsal \
  "Archiv-Pfad" \
  env -u CATERING_BROWSER_REHEARSAL_SUBMIT_ANSWERS -u CATERING_BROWSER_REHEARSAL_FAILED_UPLOAD CATERING_BROWSER_REHEARSAL_ARCHIVE_INTAKE=1 CATERING_BROWSER_REHEARSAL_CREATE_OFFER_CASE=1 \
    bash "${ROOT_DIR}/scripts/check-browser-rehearsal.sh"

run_fresh_rehearsal \
  "Failed-Upload-Pfad" \
  env -u CATERING_BROWSER_REHEARSAL_SUBMIT_ANSWERS -u CATERING_BROWSER_REHEARSAL_ARCHIVE_INTAKE CATERING_BROWSER_REHEARSAL_FAILED_UPLOAD=1 CATERING_BROWSER_REHEARSAL_CREATE_OFFER_CASE=1 \
    bash "${ROOT_DIR}/scripts/check-browser-rehearsal.sh"

echo
echo "Vollstaendiger Fresh-Browser-Rehearsal abgeschlossen."
echo "Geprueft: normaler Kernpfad, Answer-Submit-Pfad, Soft-Archiv-Pfad und Failed-Upload-Pfad auf temporaeren synthetischen Datenwurzeln."
