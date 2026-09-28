#!/bin/sh
set -eu

if [ "${1##*/}" = "catering-target-operator.py" ]; then
  case "${2:-}" in
    _gate)
      printf '%s\n' operator_gate >> "${CATERING_TARGET_FAKE_STATE}/commands.log"
      exit 0
      ;;
    _bundle-bindings)
      printf '%s\n' operator_bundle_bindings >> "${CATERING_TARGET_FAKE_STATE}/commands.log"
      printf 'sha256:%064d\tsha256:%064d\n' 1 2
      exit 0
      ;;
    _bundle-bindings-local)
      printf '%s\n' local_bundle_bindings >> "${CATERING_TARGET_FAKE_STATE}/commands.log"
      printf 'sha256:%064d\tsha256:%064d\n' 1 2
      exit 0
      ;;
  esac
fi

exec "${CATERING_TARGET_REAL_PYTHON3:?}" "$@"
