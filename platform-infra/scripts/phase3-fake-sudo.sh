#!/usr/bin/env bash
set -euo pipefail

[[ "${CATERING_PHASE3_TEST_MODE:-}" == 1 ]] || exec "$@"
crash_at="${CATERING_PHASE3_FAKE_CRASH_AT:-}"
destination=
if (($#)); then destination="${!#}"; fi
if [[ "${1:-}" == mv && "${crash_at}" == evidence && "${destination}" == *"/phase3.restore-evidence.record" && "${PPID}" != "$$" ]]; then
  "$@"
  kill -KILL "${PPID}" 2>/dev/null || true
  kill -KILL "$$"
fi
if [[ "${1:-}" == mv && "${crash_at}" == archive && "${destination}" == *"/phase3.rollback-restore-proof.archive" && "${PPID}" != "$$" ]]; then
  "$@"
  kill -KILL "${PPID}" 2>/dev/null || true
  kill -KILL "$$"
fi
exec "$@"
