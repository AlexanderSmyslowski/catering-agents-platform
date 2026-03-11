#!/usr/bin/env bash

set -euo pipefail

check_port() {
  local name="$1"
  local port="$2"
  if lsof -iTCP:"${port}" -sTCP:LISTEN -nP >/dev/null 2>&1; then
    echo "${name}: laeuft auf Port ${port}"
  else
    echo "${name}: gestoppt"
  fi
}

check_port "UI" 3200
check_port "Intake" 3101
check_port "Angebot" 3102
check_port "Produktion" 3103
check_port "Export" 3104
