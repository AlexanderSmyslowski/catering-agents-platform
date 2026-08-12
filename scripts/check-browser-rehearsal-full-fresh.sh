#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STACK_LIFECYCLE_ACTIVE=0
REHEARSAL_CHILD_PID=""
REHEARSAL_CHILD_PGID=""

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
  REHEARSAL_CHILD_PGID=""
  REHEARSAL_CHILD_PID=""
  return "${command_status}"
}

cleanup_stack() {
  local exit_code="$?"
  trap - EXIT INT TERM HUP
  stop_rehearsal_child
  if [[ "${STACK_LIFECYCLE_ACTIVE}" == "1" ]]; then
    bash "${ROOT_DIR}/scripts/stop-local-stack.sh" >/dev/null 2>&1 || true
    STACK_LIFECYCLE_ACTIVE=0
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

  echo
  echo "== ${label} =="
  STACK_LIFECYCLE_ACTIVE=1
  run_owned_command bash "${ROOT_DIR}/scripts/start-fresh-local-stack.sh"
  run_owned_command "$@"
  bash "${ROOT_DIR}/scripts/stop-local-stack.sh"
  STACK_LIFECYCLE_ACTIVE=0
}

echo "Vollstaendiger Fresh-Browser-Rehearsal fuer den synthetischen Produktionskern."
echo "Grenze: lokaler synthetischer Browser-Beleg; keine Produktionsfreigabe, keine echten Daten, keine Compliance-Aussage."

run_fresh_rehearsal \
  "Normaler Kernpfad" \
  env -u CATERING_BROWSER_REHEARSAL_SUBMIT_ANSWERS -u CATERING_BROWSER_REHEARSAL_ARCHIVE_INTAKE -u CATERING_BROWSER_REHEARSAL_FAILED_UPLOAD \
    bash "${ROOT_DIR}/scripts/check-browser-rehearsal.sh"

run_fresh_rehearsal \
  "Answer-Submit-Pfad" \
  env -u CATERING_BROWSER_REHEARSAL_ARCHIVE_INTAKE -u CATERING_BROWSER_REHEARSAL_FAILED_UPLOAD CATERING_BROWSER_REHEARSAL_SUBMIT_ANSWERS=1 \
    bash "${ROOT_DIR}/scripts/check-browser-rehearsal.sh"

run_fresh_rehearsal \
  "Archiv-Pfad" \
  env -u CATERING_BROWSER_REHEARSAL_SUBMIT_ANSWERS -u CATERING_BROWSER_REHEARSAL_FAILED_UPLOAD CATERING_BROWSER_REHEARSAL_ARCHIVE_INTAKE=1 \
    bash "${ROOT_DIR}/scripts/check-browser-rehearsal.sh"

run_fresh_rehearsal \
  "Failed-Upload-Pfad" \
  env -u CATERING_BROWSER_REHEARSAL_SUBMIT_ANSWERS -u CATERING_BROWSER_REHEARSAL_ARCHIVE_INTAKE CATERING_BROWSER_REHEARSAL_FAILED_UPLOAD=1 \
    bash "${ROOT_DIR}/scripts/check-browser-rehearsal.sh"

echo
echo "Vollstaendiger Fresh-Browser-Rehearsal abgeschlossen."
echo "Geprueft: normaler Kernpfad, Answer-Submit-Pfad, Soft-Archiv-Pfad und Failed-Upload-Pfad auf temporaeren synthetischen Datenwurzeln."
