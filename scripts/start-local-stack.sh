#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="${ROOT_DIR}/.runtime/local-stack"
LOG_DIR="${RUNTIME_DIR}/logs"
DATA_ROOT="${CATERING_DATA_ROOT:-${ROOT_DIR}/data}"

mkdir -p "${LOG_DIR}"

if ! command -v screen >/dev/null 2>&1; then
  echo "GNU screen wird für den stabilen lokalen Stack benötigt." >&2
  exit 1
fi

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
  curl -sf -X POST http://127.0.0.1:3101/v1/intake/seed-demo >/dev/null
  curl -sf -X POST http://127.0.0.1:3102/v1/offers/seed-demo >/dev/null
  curl -sf -X POST http://127.0.0.1:3103/v1/production/seed-demo >/dev/null
  echo "Demo-Daten geladen."
}

screen_session_exists() {
  local session_name="$1"
  (screen -ls 2>/dev/null || true) | grep -q "\\.${session_name}[[:space:]]"
}

start_service() {
  local name="$1"
  local command="$2"
  local session_name="catering-${name}"
  local log_file="${LOG_DIR}/${name}.log"

  if screen_session_exists "${session_name}"; then
    echo "${name} läuft bereits in screen (${session_name})."
    return 0
  fi

  local loop_command
  loop_command=$(cat <<EOF
cd "${ROOT_DIR}"
export CATERING_DATA_ROOT="${DATA_ROOT}"
while true; do
  ${command} >>"${log_file}" 2>&1
  code=\$?
  printf '%s %s beendet sich mit Code %s, Neustart in 1 Sekunde.\\n' "\$(date -Iseconds)" "${name}" "\${code}" >>"${log_file}"
  sleep 1
done
EOF
)

  : >"${log_file}"
  screen -dmS "${session_name}" /bin/bash -lc "${loop_command}"
  echo "${name} in screen gestartet (${session_name})."
}

start_service "intake" "PORT=3101 npm run dev:intake"
start_service "offer" "PORT=3102 npm run dev:offer"
start_service "production" "PORT=3103 npm run dev:production"
start_service "exports" "PORT=3104 npm run dev:exports"
start_service "ui" "npm --workspace @catering/backoffice-ui run dev -- --host 0.0.0.0 --port 3200"

wait_for_url "http://127.0.0.1:3101/health" "Intake"
wait_for_url "http://127.0.0.1:3102/health" "Angebot"
wait_for_url "http://127.0.0.1:3103/health" "Produktion"
wait_for_url "http://127.0.0.1:3104/health" "Export"
wait_for_url "http://127.0.0.1:3200" "Backoffice-UI"

if [[ "${1:-}" == "--seed-demo" ]]; then
  seed_demo_data
fi

echo
echo "Lokaler Stack läuft stabil in screen-Sitzungen:"
echo "  UI: http://127.0.0.1:3200"
echo "  Intake: http://127.0.0.1:3101/health"
echo "  Angebot: http://127.0.0.1:3102/health"
echo "  Produktion: http://127.0.0.1:3103/health"
echo "  Export: http://127.0.0.1:3104/health"
