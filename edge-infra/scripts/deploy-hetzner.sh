#!/usr/bin/env bash

set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:?Set DEPLOY_HOST}"
DEPLOY_USER="${DEPLOY_USER:-root}"
EDGE_DEPLOY_PATH="${EDGE_DEPLOY_PATH:?Set EDGE_DEPLOY_PATH}"
EDGE_ROLLBACK_ROOT="${EDGE_ROLLBACK_ROOT:-${EDGE_DEPLOY_PATH}-rollbacks}"
EDGE_DEPLOY_COMMIT_SHA="${EDGE_DEPLOY_COMMIT_SHA:?Set EDGE_DEPLOY_COMMIT_SHA}"
EDGE_MODE="${EDGE_MODE:-rehearsal}"
CATERING_SMOKE_URL="${CATERING_SMOKE_URL:?Set CATERING_SMOKE_URL}"
ZEITERFASSUNG_SMOKE_URL="${ZEITERFASSUNG_SMOKE_URL:?Set ZEITERFASSUNG_SMOKE_URL}"
EVENTOS_SMOKE_URL="${EVENTOS_SMOKE_URL:?Set EVENTOS_SMOKE_URL}"
DEPLOY_RSYNC_PATH="${DEPLOY_RSYNC_PATH:-rsync}"

if [[ "${EDGE_MODE}" != "rehearsal" && "${EDGE_MODE}" != "cutover" ]]; then
  echo "EDGE_MODE must be rehearsal or cutover." >&2
  exit 1
fi

if [[ ! "${EDGE_DEPLOY_COMMIT_SHA}" =~ ^[0-9a-fA-F]{40}$ ]]; then
  echo "EDGE_DEPLOY_COMMIT_SHA must be an exact 40-character Git commit SHA." >&2
  exit 1
fi

for command_name in ssh rsync docker; do
  command -v "${command_name}" >/dev/null 2>&1 || {
    echo "${command_name} is required for edge deployment." >&2
    exit 1
  }
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EDGE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"

url_host() {
  local value="${1#*://}"
  printf '%s' "${value%%/*}"
}

CATERING_SMOKE_HOST="$(url_host "${CATERING_SMOKE_URL}")"
ZEITERFASSUNG_SMOKE_HOST="$(url_host "${ZEITERFASSUNG_SMOKE_URL}")"
EVENTOS_SMOKE_HOST="$(url_host "${EVENTOS_SMOKE_URL}")"

LOCAL_COMPOSE_ARGS=(-p shared-edge -f docker-compose.yml)
CADDY_CONFIG_FILE="Caddyfile"
if [[ "${EDGE_MODE}" == "rehearsal" ]]; then
  LOCAL_COMPOSE_ARGS+=(-f docker-compose.rehearsal.yml)
  CADDY_CONFIG_FILE="Caddyfile.rehearsal"
fi

# Validate repository source before any remote write. The example environment is
# intentionally non-secret; the protected production environment is validated
# again on the host before the edge container is started.
(
  cd "${EDGE_DIR}"
  docker compose "${LOCAL_COMPOSE_ARGS[@]}" --env-file .env.example config >/dev/null
  docker run --rm \
    --env-file .env.example \
    -v "${EDGE_DIR}/${CADDY_CONFIG_FILE}:/etc/caddy/Caddyfile:ro" \
    caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile
)

# Fail closed before touching remote files.
ssh "${REMOTE}" "
  set -euo pipefail
  command -v curl >/dev/null 2>&1 || {
    echo 'curl is required for local edge rehearsal probes.' >&2
    exit 1
  }
  docker network inspect platform-infra_default >/dev/null 2>&1 || {
    echo 'Missing required external Docker network: platform-infra_default' >&2
    exit 1
  }
  docker network inspect zeiterfassung_default >/dev/null 2>&1 || {
    echo 'Missing required external Docker network: zeiterfassung_default' >&2
    exit 1
  }
  test -f '${EDGE_DEPLOY_PATH}/.env' || {
    echo 'Missing protected edge .env on server.' >&2
    exit 1
  }
"

echo "Creating edge rollback snapshot..."
ssh "${REMOTE}" "
  set -euo pipefail
  sudo mkdir -p '${EDGE_ROLLBACK_ROOT}'
  if test -d '${EDGE_DEPLOY_PATH}'; then
    timestamp=\$(date -u +%Y%m%dT%H%M%SZ)
    archive='${EDGE_ROLLBACK_ROOT}/shared-edge-'\"\${timestamp}\"'.tar.gz'
    sudo tar -czf \"\${archive}\" \
      --exclude=./.env \
      --exclude=./.deploy-manifest \
      -C '${EDGE_DEPLOY_PATH}' .
    printf '%s\n' \"\${archive}\" | sudo tee '${EDGE_ROLLBACK_ROOT}/latest' >/dev/null
  fi
"

echo "Syncing edge source..."
rsync -az --delete \
  --rsync-path="${DEPLOY_RSYNC_PATH}" \
  --exclude ".env" \
  --exclude ".deploy-manifest" \
  "${EDGE_DIR}/" "${REMOTE}:${EDGE_DEPLOY_PATH}/"

if [[ "${EDGE_MODE}" == "rehearsal" ]]; then
  REMOTE_COMPOSE_FILES="-f docker-compose.yml -f docker-compose.rehearsal.yml"
else
  REMOTE_COMPOSE_FILES="-f docker-compose.yml"
fi

# Validate the protected production environment before runtime mutation.
ssh "${REMOTE}" "
  set -euo pipefail
  cd '${EDGE_DEPLOY_PATH}'
  docker compose -p shared-edge ${REMOTE_COMPOSE_FILES} --env-file .env config >/dev/null
  docker run --rm \
    --env-file .env \
    -v '${EDGE_DEPLOY_PATH}/${CADDY_CONFIG_FILE}:/etc/caddy/Caddyfile:ro' \
    caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile
  docker compose -p shared-edge ${REMOTE_COMPOSE_FILES} --env-file .env up -d
"

probe_rehearsal_listener() {
  ssh "${REMOTE}" bash -s -- \
    "${ZEITERFASSUNG_SMOKE_HOST}" \
    "${EVENTOS_SMOKE_HOST}" \
    "${CATERING_SMOKE_HOST}" <<'REMOTE_SCRIPT'
set -euo pipefail
ZEITERFASSUNG_SMOKE_HOST="$1"
EVENTOS_SMOKE_HOST="$2"
CATERING_SMOKE_HOST="$3"

probe() {
  local label="$1"
  local host="$2"
  local path="$3"
  local expected_status="$4"
  local status=""
  local attempt
  for attempt in $(seq 1 15); do
    status="$(curl --silent --show-error --max-time 5 --output /dev/null --write-out '%{http_code}' \
      --header "Host: ${host}" "http://127.0.0.1:18080${path}" || true)"
    if [[ "${status}" == "${expected_status}" ]]; then
      echo "${label}: ok (${status})"
      return 0
    fi
    sleep 1
  done
  echo "${label}: expected ${expected_status}, got ${status:-no response}" >&2
  return 1
}

probe "Rehearsal Zeiterfassung" "${ZEITERFASSUNG_SMOKE_HOST}" "/healthz" "200"
probe "Rehearsal EventOS" "${EVENTOS_SMOKE_HOST}" "/" "200"
# Catering's application-owned Caddy keeps Basic Auth. Receiving its 401 without
# credentials proves that the candidate edge reached the Catering upstream.
probe "Rehearsal Catering" "${CATERING_SMOKE_HOST}" "/" "401"
REMOTE_SCRIPT
}

if [[ "${EDGE_MODE}" == "rehearsal" ]]; then
  probe_rehearsal_listener
fi

CATERING_SMOKE_URL="${CATERING_SMOKE_URL}" \
ZEITERFASSUNG_SMOKE_URL="${ZEITERFASSUNG_SMOKE_URL}" \
EVENTOS_SMOKE_URL="${EVENTOS_SMOKE_URL}" \
CATERING_SMOKE_BASIC_AUTH_USER="${CATERING_SMOKE_BASIC_AUTH_USER:-}" \
CATERING_SMOKE_BASIC_AUTH_PASSWORD="${CATERING_SMOKE_BASIC_AUTH_PASSWORD:-}" \
bash "${SCRIPT_DIR}/smoke-all.sh"

echo "Recording edge deployment manifest..."
ssh "${REMOTE}" "
  set -euo pipefail
  manifest='${EDGE_DEPLOY_PATH}/.deploy-manifest'
  temporary=\"\${manifest}.tmp.\$$\"
  printf '%s\n' \
    'commit=${EDGE_DEPLOY_COMMIT_SHA}' \
    'mode=${EDGE_MODE}' \
    \"deployed_at=\$(date -u +%Y-%m-%dT%H:%M:%SZ)\" \
    'rollback_root=${EDGE_ROLLBACK_ROOT}' \
    | sudo tee \"\${temporary}\" >/dev/null
  sudo mv \"\${temporary}\" \"\${manifest}\"
"

echo "Edge deployment completed in ${EDGE_MODE} mode."
