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
START_ATTEMPTS="${CATERING_LOCAL_START_ATTEMPTS:-30}"
PRODUCTION_LOCK_PROTOCOL="canonical-v2"
SEED_DEMO=0
if [[ "$#" -gt 0 ]]; then
  if [[ "$#" -ne 1 || "${1}" != "--seed-demo" ]]; then
    echo "Unbekannte Startoption(en): $*" >&2
    exit 2
  fi
  SEED_DEMO=1
fi

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
if ! MIGRATION_NODE_BIN="$(command -v node)"; then
  echo "Node.js wurde für die Business-Scope-Migration nicht gefunden." >&2
  exit 1
fi

mkdir -p "${LOG_DIR}"
mkdir -p "${DATA_ROOT}"
DATA_ROOT="$(cd "${DATA_ROOT}" && pwd -P)"
PRODUCTION_START_MUTEX="${CATERING_LOCAL_START_LOCK_FILE:-/tmp/catering-production-startup-3103-$(id -u).lock}"
PRODUCTION_MIGRATION_MUTEX="${PRODUCTION_START_MUTEX}.migration"
PRODUCTION_START_TOKEN="$$-${RANDOM}-$(date +%s)"
START_MUTEX_HELD=0
START_MUTEX_BACKEND=""
MIGRATION_CHILD_PID=""

if ! command -v screen >/dev/null 2>&1; then
  echo "GNU screen wird für den stabilen lokalen Stack benötigt." >&2
  exit 1
fi

release_startup_mutex() {
  if [[ "${START_MUTEX_HELD}" != "1" ]]; then
    return 0
  fi
  if [[ "${START_MUTEX_BACKEND}" == "shlock" ]]; then
    if [[ "$(cat "${PRODUCTION_START_MUTEX}" 2>/dev/null || true)" == "$$" ]]; then
      unlink "${PRODUCTION_START_MUTEX}" 2>/dev/null || true
    fi
  elif [[ "${START_MUTEX_BACKEND}" == "flock" ]]; then
    flock -u 9 2>/dev/null || true
    exec 9>&-
  fi
  START_MUTEX_HELD=0
}

handle_startup_signal() {
  local exit_code="$1"
  if [[ -n "${MIGRATION_CHILD_PID}" ]]; then
    kill -TERM "${MIGRATION_CHILD_PID}" 2>/dev/null || true
    wait "${MIGRATION_CHILD_PID}" 2>/dev/null || true
    if [[ "$(cat "${PRODUCTION_MIGRATION_MUTEX}" 2>/dev/null || true)" == "${MIGRATION_CHILD_PID}" ]]; then
      unlink "${PRODUCTION_MIGRATION_MUTEX}" 2>/dev/null || true
    fi
    MIGRATION_CHILD_PID=""
  fi
  release_startup_mutex
  exit "${exit_code}"
}

acquire_startup_mutex() {
  mkdir -p "$(dirname "${PRODUCTION_START_MUTEX}")"
  if command -v shlock >/dev/null 2>&1; then
    if ! shlock -f "${PRODUCTION_START_MUTEX}" -p "$$"; then
      echo "Eine andere Instanz hält bereits die portweite Production-Start-Sperre." >&2
      return 1
    fi
    START_MUTEX_BACKEND="shlock"
    START_MUTEX_HELD=1
    # A migration child deliberately outlives a launcher killed with SIGKILL. Its own PID lock
    # prevents the next launcher from overlapping that still-running migration.
    if ! shlock -f "${PRODUCTION_MIGRATION_MUTEX}" -p "$$"; then
      echo "Eine vorherige Business-Scope-Migration läuft noch." >&2
      release_startup_mutex
      return 1
    fi
    if [[ "$(cat "${PRODUCTION_MIGRATION_MUTEX}" 2>/dev/null || true)" == "$$" ]]; then
      unlink "${PRODUCTION_MIGRATION_MUTEX}" 2>/dev/null || true
    fi
  elif command -v flock >/dev/null 2>&1; then
    exec 9>"${PRODUCTION_START_MUTEX}"
    if ! flock -n 9; then
      echo "Eine andere Instanz hält bereits die portweite Production-Start-Sperre." >&2
      exec 9>&-
      return 1
    fi
    START_MUTEX_BACKEND="flock"
    START_MUTEX_HELD=1
  else
    echo "Weder shlock noch flock ist verfügbar; der lokale Stack bleibt sicher gestoppt." >&2
    return 1
  fi
}

run_business_scope_migration() {
  if [[ "${START_MUTEX_BACKEND}" != "shlock" ]]; then
    # flock's open descriptor is inherited by the migration child. If the launcher dies, the
    # kernel keeps the port-wide lock until that child exits.
    CATERING_DATA_ROOT="${DATA_ROOT}" "${MIGRATION_NODE_BIN}" --import tsx \
      "${ROOT_DIR}/scripts/migrate-local-business-scope.ts" \
      --business-id "${DEFAULT_BUSINESS_ID}" --confirm-legacy-file-writers-quiesced
    return
  fi

  local parent_pid="$$"
  local gate_path="${PRODUCTION_MIGRATION_MUTEX}.go.${PRODUCTION_START_TOKEN}"
  bash -c '
    set -euo pipefail
    migration_mutex="$1"
    gate_path="$2"
    parent_pid="$3"
    data_root="$4"
    business_id="$5"
    node_runtime="$6"
    root_dir="$7"
    migration_child_pid="$$"
    cleanup_migration_worker() {
      if [[ "$(cat "${migration_mutex}" 2>/dev/null || true)" == "${migration_child_pid}" ]]; then
        unlink "${migration_mutex}" 2>/dev/null || true
      fi
      unlink "${gate_path}" 2>/dev/null || true
    }
    trap cleanup_migration_worker EXIT
    trap "exit 130" INT
    trap "exit 143" TERM
    while [[ ! -f "${gate_path}" ]]; do
      if ! kill -0 "${parent_pid}" 2>/dev/null; then
        exit 143
      fi
      sleep 0.01
    done
    trap - EXIT INT TERM
    exec env CATERING_DATA_ROOT="${data_root}" "${node_runtime}" --import tsx \
      "${root_dir}/scripts/migrate-local-business-scope.ts" \
      --business-id "${business_id}" --confirm-legacy-file-writers-quiesced
  ' _ "${PRODUCTION_MIGRATION_MUTEX}" "${gate_path}" "${parent_pid}" "${DATA_ROOT}" \
    "${DEFAULT_BUSINESS_ID}" "${MIGRATION_NODE_BIN}" "${ROOT_DIR}" &
  MIGRATION_CHILD_PID="$!"
  local migration_child_pid="${MIGRATION_CHILD_PID}"
  if ! shlock -f "${PRODUCTION_MIGRATION_MUTEX}" -p "${migration_child_pid}"; then
    kill -TERM "${migration_child_pid}" 2>/dev/null || true
    wait "${migration_child_pid}" 2>/dev/null || true
    MIGRATION_CHILD_PID=""
    echo "Die Business-Scope-Migration konnte ihre Aktivitätssperre nicht übernehmen." >&2
    return 1
  fi
  : >"${gate_path}"
  local migration_status=0
  wait "${migration_child_pid}" || migration_status=$?
  MIGRATION_CHILD_PID=""
  unlink "${gate_path}" 2>/dev/null || true
  if [[ "$(cat "${PRODUCTION_MIGRATION_MUTEX}" 2>/dev/null || true)" == "${migration_child_pid}" ]]; then
    unlink "${PRODUCTION_MIGRATION_MUTEX}" 2>/dev/null || true
  fi
  if [[ "${migration_status}" != "0" ]]; then
    return "${migration_status}"
  fi
}

trap release_startup_mutex EXIT
trap 'handle_startup_signal 130' INT
trap 'handle_startup_signal 143' TERM
acquire_startup_mutex

wait_for_url() {
  local url="$1"
  local label="$2"
  local attempts="${START_ATTEMPTS}"

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

wait_for_production_protocol() {
  local url="http://127.0.0.1:3103/health"
  local response
  for _ in $(seq 1 "${START_ATTEMPTS}"); do
    response="$(curl --max-time "${CURL_MAX_TIME_SECONDS}" -sf "${url}" 2>/dev/null || true)"
    if [[ "${response}" == *'"targetLockProtocol":"canonical-v2"'* ]] &&
       [[ "${response}" == *'"startupToken":"'"${PRODUCTION_START_TOKEN}"'"'* ]]; then
      echo "Produktion bereit: ${url}"
      return 0
    fi
    sleep 1
  done
  echo "Produktion meldet nicht das erwartete Sperrprotokoll ${PRODUCTION_LOCK_PROTOCOL}." >&2
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

production_port_is_bound() {
  local probe_status=0
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:3103 -sTCP:LISTEN >/dev/null 2>&1 || probe_status=$?
    if [[ "${probe_status}" == "1" ]]; then
      return 1
    fi
    # A listener (0) and an indeterminate lsof failure (>1) both keep the transition closed.
    return 0
  fi
  probe_status=0
  node -e '
    const server = require("node:net").createServer();
    server.once("error", (error) => process.exit(error.code === "EADDRINUSE" ? 0 : 2));
    server.listen(3103, "127.0.0.1", () => server.close(() => process.exit(1)));
  ' || probe_status=$?
  if [[ "${probe_status}" == "1" ]]; then
    return 1
  fi
  # Bound (0) and indeterminate (2) are both unsafe for a protocol transition.
  return 0
}

production_writer_is_quiescent() {
  if screen_session_exists "catering-production"; then
    echo "Eine bestehende Production-screen-Sitzung verhindert den sicheren Protokollwechsel." >&2
    return 1
  fi
  if pgrep -f "${ROOT_DIR}/node_modules/.*production-service/src/server.ts" >/dev/null 2>&1; then
    echo "Ein bestehender Production-Prozess verhindert den sicheren Protokollwechsel." >&2
    return 1
  fi
  if [[ "$(uname -s)" == "Darwin" ]] &&
     launchctl print "gui/$(id -u)/com.cateringagents.production" >/dev/null 2>&1; then
    echo "Ein geladener Production-Supervisor verhindert den sicheren Protokollwechsel." >&2
    return 1
  fi
  if production_port_is_bound; then
    echo "Port 3103 ist bereits belegt; der Production-Protokollstand ist nicht verifizierbar." >&2
    return 1
  fi
}

# Scoped migrations snapshot legacy collections; an older live service could otherwise publish after completion.
if stack_session_exists || ! production_writer_is_quiescent; then
  echo "Lokaler Stack laeuft bereits; Business-Scope-Migration erfordert ruhende Schreibprozesse." >&2
  echo "Bitte npm run local:stop ausfuehren und den Stack danach erneut starten." >&2
  exit 1
fi

printf '%s\n' "${DATA_ROOT}" >"${DATA_ROOT_FILE}"
echo "Lokale Datenwurzel: ${DATA_ROOT}"
run_business_scope_migration

start_service() {
  local name="$1"
  local command="$2"
  local session_name="catering-${name}"
  local log_file="${LOG_DIR}/${name}.log"

  if screen_session_exists "${session_name}"; then
    if [[ "${name}" == "production" ]]; then
      echo "Während des Startvorgangs ist eine fremde Production-Sitzung erschienen." >&2
      return 1
    fi
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
export CATERING_INTAKE_SERVICE_URL="${CATERING_INTAKE_SERVICE_URL:-http://127.0.0.1:3101}"
export CATERING_LLM_PROVIDER="${LLM_PROVIDER}"
export CATERING_SYNTHETIC_LLM_SLICE="${LLM_OPT_IN}"
export CATERING_PRODUCTION_DRAFT_DATA_MODE="${PRODUCTION_DRAFT_DATA_MODE}"
export CATERING_LLM_CLI_BIN="${LLM_CLI_BIN}"
export CATERING_LLM_MODEL="${LLM_MODEL}"
export CATERING_LLM_CLI_TIMEOUT_MS="${LLM_CLI_TIMEOUT_MS}"
export CATERING_PRODUCTION_START_TOKEN="${PRODUCTION_START_TOKEN}"
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
production_writer_is_quiescent
start_service "production" "PORT=3103 npm run dev:production"
start_service "exports" "PORT=3104 npm run dev:exports"
start_service "ui" "npm --workspace @catering/backoffice-ui run dev -- --host 0.0.0.0 --port 3200"

wait_for_url "http://127.0.0.1:3101/health" "Intake"
wait_for_url "http://127.0.0.1:3102/health" "Angebot"
wait_for_production_protocol
release_startup_mutex
wait_for_url "http://127.0.0.1:3104/health" "Export"
wait_for_url "http://127.0.0.1:3200" "Backoffice-UI"

if [[ "${SEED_DEMO}" == "1" ]]; then
  seed_demo_data
fi

echo
echo "Lokaler Stack läuft stabil in screen-Sitzungen:"
echo "  UI: http://127.0.0.1:3200"
echo "  Intake: http://127.0.0.1:3101/health"
echo "  Angebot: http://127.0.0.1:3102/health"
echo "  Produktion: http://127.0.0.1:3103/health"
echo "  Export: http://127.0.0.1:3104/health"
