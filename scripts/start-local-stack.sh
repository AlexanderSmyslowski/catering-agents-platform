#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="${ROOT_DIR}/.runtime/local-stack"
LOG_DIR="${RUNTIME_DIR}/logs"
DATA_ROOT="${CATERING_DATA_ROOT:-${ROOT_DIR}/data}"

mkdir -p "${LOG_DIR}"

start_service() {
  local name="$1"
  local port="$2"
  local command="$3"
  local pid_file="${RUNTIME_DIR}/${name}.pid"
  local log_file="${LOG_DIR}/${name}.log"

  if lsof -iTCP:"${port}" -sTCP:LISTEN -nP >/dev/null 2>&1; then
    echo "${name} laeuft bereits auf Port ${port}."
    return 0
  fi

  echo "Starte ${name} auf Port ${port}..."
  nohup bash -lc "cd \"${ROOT_DIR}\" && export CATERING_DATA_ROOT=\"${DATA_ROOT}\" && ${command}" >"${log_file}" 2>&1 &
  echo $! >"${pid_file}"
}

wait_for_url() {
  local url="$1"
  local label="$2"
  local attempts=30

  for _ in $(seq 1 "${attempts}"); do
    if curl -sf "${url}" >/dev/null 2>&1; then
      echo "${label} bereit: ${url}"
      return 0
    fi
    sleep 1
  done

  echo "${label} wurde nicht rechtzeitig erreichbar: ${url}" >&2
  return 1
}

seed_demo_data() {
  curl -sf -X POST http://localhost:3101/v1/intake/seed-demo >/dev/null
  curl -sf -X POST http://localhost:3102/v1/offers/seed-demo >/dev/null
  curl -sf -X POST http://localhost:3103/v1/production/seed-demo >/dev/null
  echo "Demo-Daten geladen."
}

start_service "intake" 3101 "PORT=3101 npm run dev:intake"
start_service "offer" 3102 "PORT=3102 npm run dev:offer"
start_service "production" 3103 "PORT=3103 npm run dev:production"
start_service "exports" 3104 "PORT=3104 npm run dev:exports"
start_service "ui" 3200 "cd backoffice-ui && npx vite --host 0.0.0.0 --port 3200"

wait_for_url "http://localhost:3101/health" "Intake"
wait_for_url "http://localhost:3102/health" "Angebot"
wait_for_url "http://localhost:3103/health" "Produktion"
wait_for_url "http://localhost:3104/health" "Export"
wait_for_url "http://localhost:3200" "Backoffice-UI"

if [[ "${1:-}" == "--seed-demo" ]]; then
  seed_demo_data
fi

echo
echo "Lokaler Stack laeuft:"
echo "  UI: http://localhost:3200"
echo "  Intake: http://localhost:3101/health"
echo "  Angebot: http://localhost:3102/health"
echo "  Produktion: http://localhost:3103/health"
echo "  Export: http://localhost:3104/health"
