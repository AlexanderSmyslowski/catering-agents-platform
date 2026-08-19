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
# intentionally non-secret. Protected production values are never wholesale
# injected into the validator below.
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
ROLLBACK_INFO="$(ssh "${REMOTE}" bash -s -- "${EDGE_DEPLOY_PATH}" "${EDGE_ROLLBACK_ROOT}" <<'REMOTE_SCRIPT'
set -euo pipefail
edge_path="$1"
rollback_root="$2"
sudo mkdir -p "${rollback_root}"
if [[ ! -f "${edge_path}/docker-compose.yml" ]]; then
  printf 'NONE\trehearsal\n'
  exit 0
fi

previous_mode="rehearsal"
if [[ -f "${edge_path}/.deploy-manifest" ]]; then
  manifest_mode="$(sed -n 's/^mode=//p' "${edge_path}/.deploy-manifest" | tail -n 1)"
  if [[ "${manifest_mode}" == "rehearsal" || "${manifest_mode}" == "cutover" ]]; then
    previous_mode="${manifest_mode}"
  fi
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
archive="${rollback_root}/shared-edge-${timestamp}.tar.gz"
sudo tar -czf "${archive}" \
  --exclude=./.env \
  --exclude=./.deploy-manifest \
  -C "${edge_path}" .
printf '%s\n' "${archive}" | sudo tee "${rollback_root}/latest" >/dev/null
printf '%s\t%s\n' "${archive}" "${previous_mode}"
REMOTE_SCRIPT
)"
IFS=$'\t' read -r ROLLBACK_ARCHIVE ROLLBACK_MODE <<<"${ROLLBACK_INFO}"

rollback_edge_candidate() {
  local failure_status=$?
  trap - ERR
  set +e
  echo "Edge candidate failed; restoring only shared-edge." >&2

  if [[ "${ROLLBACK_ARCHIVE}" == "NONE" ]]; then
    ssh "${REMOTE}" bash -s -- "${EDGE_DEPLOY_PATH}" "${EDGE_MODE}" <<'REMOTE_SCRIPT'
set -euo pipefail
edge_path="$1"
mode="$2"
cd "${edge_path}"
compose_files=(-f docker-compose.yml)
if [[ "${mode}" == "rehearsal" ]]; then
  compose_files+=(-f docker-compose.rehearsal.yml)
fi
docker compose -p shared-edge "${compose_files[@]}" --env-file .env stop edge
REMOTE_SCRIPT
  else
    ssh "${REMOTE}" bash -s -- \
      "${EDGE_DEPLOY_PATH}" "${ROLLBACK_ARCHIVE}" "${ROLLBACK_MODE}" <<'REMOTE_SCRIPT'
set -euo pipefail
edge_path="$1"
archive="$2"
mode="$3"

sudo find "${edge_path}" -mindepth 1 -maxdepth 1 \
  ! -name .env ! -name .deploy-manifest -exec rm -rf -- {} +
sudo tar -xzf "${archive}" -C "${edge_path}"
cd "${edge_path}"
compose_files=(-f docker-compose.yml)
if [[ "${mode}" == "rehearsal" ]]; then
  compose_files+=(-f docker-compose.rehearsal.yml)
fi
docker compose -p shared-edge "${compose_files[@]}" --env-file .env config >/dev/null
docker compose -p shared-edge "${compose_files[@]}" --env-file .env up -d
REMOTE_SCRIPT
  fi

  exit "${failure_status}"
}

trap 'rollback_edge_candidate' ERR

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

# Compose config interpolates the protected file, but the Caddy validator is run
# as the edge service itself. Only the service's explicit environment whitelist
# reaches that container; unrelated entries in .env cannot leak into it.
ssh "${REMOTE}" "
  set -euo pipefail
  cd '${EDGE_DEPLOY_PATH}'
  docker compose -p shared-edge ${REMOTE_COMPOSE_FILES} --env-file .env config >/dev/null
  docker compose -p shared-edge ${REMOTE_COMPOSE_FILES} --env-file .env \
    run --rm --no-deps --entrypoint caddy edge validate --config /etc/caddy/Caddyfile
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

probe_ok_json() {
  local label="$1"
  local host="$2"
  local path="$3"
  local status=""
  local body_file
  local attempt
  body_file="$(mktemp)"
  for attempt in $(seq 1 15); do
    : >"${body_file}"
    status="$(curl --silent --show-error --max-time 5 --output "${body_file}" --write-out '%{http_code}' \
      --header "Host: ${host}" "http://127.0.0.1:18080${path}" || true)"
    if [[ "${status}" == "200" ]] && grep -Eq '"ok"[[:space:]]*:[[:space:]]*true' "${body_file}"; then
      rm -f "${body_file}"
      echo "${label}: ok (${status}, semantic identity confirmed)"
      return 0
    fi
    sleep 1
  done
  rm -f "${body_file}"
  echo "${label}: expected 200 with ok=true, got ${status:-no response}" >&2
  return 1
}

probe_ok_json "Rehearsal Zeiterfassung" "${ZEITERFASSUNG_SMOKE_HOST}" "/healthz"
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

trap - ERR
echo "Edge deployment completed in ${EDGE_MODE} mode."
