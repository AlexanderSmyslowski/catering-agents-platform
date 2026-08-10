#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="${ROOT_DIR}/.runtime/local-stack"
LOG_DIR="${RUNTIME_DIR}/logs"
DATA_ROOT="${CATERING_DATA_ROOT:-${ROOT_DIR}/data}"
DEFAULT_BUSINESS_ID="${CATERING_DEFAULT_BUSINESS_ID:-local}"
TRUSTED_ACTOR_SECRET="${CATERING_TRUSTED_ACTOR_SECRET:-local-development-service-secret}"
DATA_ROOT_FILE="${RUNTIME_DIR}/data-root.txt"
CURL_MAX_TIME_SECONDS="${CATERING_LOCAL_CURL_MAX_TIME_SECONDS:-5}"

required_sessions=(
  "catering-ui"
  "catering-intake"
  "catering-offer"
  "catering-production"
  "catering-exports"
)

if [[ "${CATERING_LLM_PROVIDER:-fixture}" == "codex_cli" ]]; then
  if ! CATERING_LLM_CLI_BIN="$(command -v "${CATERING_LLM_CLI_BIN:-codex}")"; then
    echo "Codex CLI wurde nicht gefunden. Bitte Codex lokal installieren." >&2
    exit 1
  fi
  export CATERING_LLM_CLI_BIN

  if ! "${CATERING_LLM_CLI_BIN}" login status 2>&1 | grep -q "Logged in using ChatGPT"; then
    echo "Codex CLI ist nicht mit ChatGPT angemeldet. Bitte zuerst 'codex login' ausfuehren." >&2
    exit 1
  fi

  echo "Lokale KI: ChatGPT-Subscription ueber Codex CLI (draft-only)."
fi

LLM_PROVIDER="${CATERING_LLM_PROVIDER:-fixture}"
LLM_OPT_IN="${CATERING_SYNTHETIC_LLM_SLICE:-0}"
PRODUCTION_DRAFT_DATA_MODE="${CATERING_PRODUCTION_DRAFT_DATA_MODE:-synthetic_or_demo_only}"
LLM_CLI_BIN="${CATERING_LLM_CLI_BIN:-codex}"
LLM_MODEL="${CATERING_LLM_MODEL:-}"
LLM_CLI_TIMEOUT_MS="${CATERING_LLM_CLI_TIMEOUT_MS:-120000}"

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
    if curl --max-time "${CURL_MAX_TIME_SECONDS}" -sf "${url}" >/dev/null 2>&1; then
      echo "${label} bereit: ${url}"
      return 0
    fi
    sleep 1
  done

  echo "${label} wurde nicht rechtzeitig erreichbar: ${url}" >&2
  return 1
}

seed_demo_data() {
  local audit_actor_name="Betriebs-/Audit-Operator"
  curl --max-time "${CURL_MAX_TIME_SECONDS}" -sf -X POST http://127.0.0.1:3101/v1/intake/seed-demo \
    -H "x-catering-trusted-secret: ${TRUSTED_ACTOR_SECRET}" \
    -H "x-catering-actor-name: ${audit_actor_name}" \
    -H "x-catering-business-id: ${DEFAULT_BUSINESS_ID}" >/dev/null
  curl --max-time "${CURL_MAX_TIME_SECONDS}" -sf -X POST http://127.0.0.1:3102/v1/offers/seed-demo \
    -H "x-catering-trusted-secret: ${TRUSTED_ACTOR_SECRET}" \
    -H "x-catering-actor-name: ${audit_actor_name}" \
    -H "x-catering-business-id: ${DEFAULT_BUSINESS_ID}" >/dev/null
  curl --max-time "${CURL_MAX_TIME_SECONDS}" -sf -X POST http://127.0.0.1:3103/v1/production/seed-demo \
    -H "x-catering-trusted-secret: ${TRUSTED_ACTOR_SECRET}" \
    -H "x-catering-actor-name: ${audit_actor_name}" \
    -H "x-catering-business-id: ${DEFAULT_BUSINESS_ID}" >/dev/null
  echo "Demo-Daten geladen."
}

screen_session_exists() {
  local session_name="$1"
  (screen -ls 2>/dev/null || true) | grep -q "\\.${session_name}[[:space:]]"
}

stack_session_exists() {
  local session_name
  for session_name in "${required_sessions[@]}"; do
    if screen_session_exists "${session_name}"; then
      return 0
    fi
  done
  return 1
}

recorded_data_root="$(cat "${DATA_ROOT_FILE}" 2>/dev/null || true)"
if stack_session_exists && [[ -n "${recorded_data_root}" && "${recorded_data_root}" != "${DATA_ROOT}" ]]; then
  echo "Lokaler Stack laeuft bereits mit Datenwurzel: ${recorded_data_root}"
  echo "Angefragte Datenwurzel wird fuer diesen laufenden Stack nicht uebernommen: ${DATA_ROOT}"
  echo "Bitte npm run local:stop ausfuehren, bevor die lokale Datenwurzel gewechselt wird."
  DATA_ROOT="${recorded_data_root}"
fi

printf '%s\n' "${DATA_ROOT}" >"${DATA_ROOT_FILE}"
echo "Lokale Datenwurzel: ${DATA_ROOT}"
CATERING_DATA_ROOT="${DATA_ROOT}" npm run migrate:business-scope -- --business-id "${DEFAULT_BUSINESS_ID}"

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
export CATERING_DEV_AUTH=1
export CATERING_DEFAULT_BUSINESS_ID="${DEFAULT_BUSINESS_ID}"
export CATERING_TRUSTED_ACTOR_SECRET="${TRUSTED_ACTOR_SECRET}"
export CATERING_OFFER_SERVICE_URL="${CATERING_OFFER_SERVICE_URL:-http://127.0.0.1:3102}"
export CATERING_LLM_PROVIDER="${LLM_PROVIDER}"
export CATERING_SYNTHETIC_LLM_SLICE="${LLM_OPT_IN}"
export CATERING_PRODUCTION_DRAFT_DATA_MODE="${PRODUCTION_DRAFT_DATA_MODE}"
export CATERING_LLM_CLI_BIN="${LLM_CLI_BIN}"
export CATERING_LLM_MODEL="${LLM_MODEL}"
export CATERING_LLM_CLI_TIMEOUT_MS="${LLM_CLI_TIMEOUT_MS}"
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
