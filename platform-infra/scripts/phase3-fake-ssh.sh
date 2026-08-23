#!/usr/bin/env bash
set -euo pipefail

log_file="${CATERING_PHASE3_FAKE_HOST_ROOT:?CATERING_PHASE3_FAKE_HOST_ROOT is required}/fake-ssh.log"
remote="${1:?remote host is required}"
shift
[[ "${1:-}" == bash && "${2:-}" == -s && "${3:-}" == -- ]] || exit 86
shift 3
command_name=run
case "${1:-}" in
  resume|rollback) command_name="$1" ;;
esac
printf 'remote=%s command=%s bash -s -- %s\n' "${remote}" "${command_name}" "$(printf '%q ' "$@")" >>"${log_file}"
exec bash -s -- "$@"
