#!/usr/bin/env bash

set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:?Set DEPLOY_HOST}"
DEPLOY_USER="${DEPLOY_USER:-root}"
EDGE_DEPLOY_PATH="${EDGE_DEPLOY_PATH:?Set EDGE_DEPLOY_PATH}"
EDGE_ROLLBACK_ROOT="${EDGE_ROLLBACK_ROOT:-${EDGE_DEPLOY_PATH}-rollbacks}"
EDGE_LOCK_PATH="${EDGE_DEPLOY_PATH}.deploy-lock"
EDGE_DEPLOY_COMMIT_SHA="${EDGE_DEPLOY_COMMIT_SHA:?Set EDGE_DEPLOY_COMMIT_SHA}"
EDGE_MODE="${EDGE_MODE:-rehearsal}"
CATERING_SMOKE_URL="${CATERING_SMOKE_URL:?Set CATERING_SMOKE_URL}"
ZEITERFASSUNG_SMOKE_URL="${ZEITERFASSUNG_SMOKE_URL:?Set ZEITERFASSUNG_SMOKE_URL}"
EVENTOS_SMOKE_URL="${EVENTOS_SMOKE_URL:?Set EVENTOS_SMOKE_URL}"
DEPLOY_RSYNC_PATH="${DEPLOY_RSYNC_PATH:-rsync}"
CATERING_SMOKE_BASIC_AUTH_USER="${CATERING_SMOKE_BASIC_AUTH_USER:-}"
CATERING_SMOKE_BASIC_AUTH_PASSWORD="${CATERING_SMOKE_BASIC_AUTH_PASSWORD:-}"

if [[ "${EDGE_MODE}" != "rehearsal" && "${EDGE_MODE}" != "cutover" ]]; then
  echo "EDGE_MODE must be rehearsal or cutover." >&2
  exit 1
fi

if [[ ! "${EDGE_DEPLOY_COMMIT_SHA}" =~ ^[0-9a-fA-F]{40}$ ]]; then
  echo "EDGE_DEPLOY_COMMIT_SHA must be an exact 40-character Git commit SHA." >&2
  exit 1
fi

if [[ "${EDGE_MODE}" == "rehearsal" && ( -z "${CATERING_SMOKE_BASIC_AUTH_USER}" || -z "${CATERING_SMOKE_BASIC_AUTH_PASSWORD}" ) ]]; then
  echo "CATERING_SMOKE_BASIC_AUTH_USER and CATERING_SMOKE_BASIC_AUTH_PASSWORD are required for rehearsal." >&2
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
EDGE_LOCK_HELD=false
EDGE_RECOVERY_REQUIRED=false

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

(
  cd "${EDGE_DIR}"
  docker compose "${LOCAL_COMPOSE_ARGS[@]}" --env-file .env.example config >/dev/null
  docker run --rm \
    --env-file .env.example \
    -v "${EDGE_DIR}/${CADDY_CONFIG_FILE}:/etc/caddy/Caddyfile:ro" \
    caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile
)

ssh "${REMOTE}" "
  set -euo pipefail
  command -v curl >/dev/null 2>&1 || { echo 'curl is required for local edge rehearsal probes.' >&2; exit 1; }
  command -v python3 >/dev/null 2>&1 || { echo 'python3 is required for semantic edge rehearsal probes.' >&2; exit 1; }
  docker network inspect platform-infra_default >/dev/null 2>&1 || { echo 'Missing required external Docker network: platform-infra_default' >&2; exit 1; }
  docker network inspect zeiterfassung_default >/dev/null 2>&1 || { echo 'Missing required external Docker network: zeiterfassung_default' >&2; exit 1; }
  test -f '${EDGE_DEPLOY_PATH}/.env' || { echo 'Missing protected edge .env on server.' >&2; exit 1; }
"

acquire_edge_lock() {
  ssh "${REMOTE}" bash -s -- "${EDGE_LOCK_PATH}" "${EDGE_DEPLOY_COMMIT_SHA}" "${EDGE_MODE}" <<'REMOTE_SCRIPT'
set -euo pipefail
lock_path="$1"
commit_sha="$2"
mode="$3"
if ! sudo mkdir "${lock_path}" 2>/dev/null; then
  echo "Another shared-edge deployment holds ${lock_path}. Inspect and clear it only after confirming no deploy is running." >&2
  if sudo test -f "${lock_path}/owner"; then sudo cat "${lock_path}/owner" >&2 || true; fi
  exit 1
fi
printf '%s\n' "commit=${commit_sha}" "mode=${mode}" "acquired_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)" | sudo tee "${lock_path}/owner" >/dev/null
REMOTE_SCRIPT
  EDGE_LOCK_HELD=true
}

migrate_legacy_zeiterfassung_upstream() {
  ssh "${REMOTE}" bash -s -- "${EDGE_DEPLOY_PATH}" <<'REMOTE_SCRIPT'
set -euo pipefail
edge_path="$1"
env_file="${edge_path}/.env"
legacy_zt="ZEITERFASSUNG_UPSTREAM=app:3040"
canonical_zt="ZEITERFASSUNG_UPSTREAM=zeiterfassung-app-1:3040"
pending="${edge_path}/.env.pending.$$"
local_tmp="$(mktemp)"
cleanup() {
  rm -f "$local_tmp"
  sudo rm -f "$pending"
}
trap cleanup EXIT

test -f "$env_file"
zt_count="$(grep -c '^ZEITERFASSUNG_UPSTREAM=' "$env_file" || true)"
if [[ "$zt_count" -gt 1 ]]; then
  echo "Protected edge .env contains duplicate Zeiterfassung upstream definitions; refusing migration." >&2
  exit 1
fi
if [[ "$zt_count" = "0" ]]; then
  echo "Protected edge .env omits Zeiterfassung upstream; Compose default remains canonical."
  exit 0
fi

if grep -Fxq "$canonical_zt" "$env_file"; then
  echo "Protected edge .env already uses canonical Zeiterfassung upstream."
  exit 0
fi

if ! grep -Fxq "$legacy_zt" "$env_file"; then
  echo "Protected edge .env contains an operator-defined Zeiterfassung upstream; leaving it unchanged."
  exit 0
fi

awk -v legacy="$legacy_zt" -v canonical="$canonical_zt" '
  $0 == legacy { print canonical; next }
  { print }
' "$env_file" > "$local_tmp"

deploy_uid="$(id -u)"
deploy_gid="$(id -g)"
sudo install -o "$deploy_uid" -g "$deploy_gid" -m 0600 "$local_tmp" "$pending"
grep -Fxq "$canonical_zt" "$pending"
! grep -Fxq "$legacy_zt" "$pending"
test "$(stat -c '%a %u %g' "$pending")" = "600 ${deploy_uid} ${deploy_gid}"
sudo mv -f "$pending" "${edge_path}/.env"
pending=""
test "$(stat -c '%a %u %g' "$env_file")" = "600 ${deploy_uid} ${deploy_gid}"
grep -Fxq "$canonical_zt" "$env_file"
echo "Protected edge .env Zeiterfassung upstream migrated atomically."
REMOTE_SCRIPT
}

release_edge_lock() {
  if [[ "${EDGE_LOCK_HELD}" != "true" ]]; then return 0; fi
  if [[ "${EDGE_RECOVERY_REQUIRED}" == "true" ]]; then
    echo "Recovery is still required; retaining edge deploy lock ${EDGE_LOCK_PATH}." >&2
    return 0
  fi
  ssh "${REMOTE}" bash -s -- "${EDGE_LOCK_PATH}" <<'REMOTE_SCRIPT'
set -euo pipefail
lock_path="$1"
sudo rm -f "${lock_path}/owner"
sudo rmdir "${lock_path}"
REMOTE_SCRIPT
  EDGE_LOCK_HELD=false
}

trap 'release_edge_lock' EXIT
acquire_edge_lock
migrate_legacy_zeiterfassung_upstream

echo "Creating edge rollback snapshot..."
ROLLBACK_INFO="$(ssh "${REMOTE}" bash -s -- "${EDGE_DEPLOY_PATH}" "${EDGE_ROLLBACK_ROOT}" <<'REMOTE_SCRIPT'
set -euo pipefail
edge_path="$1"
rollback_root="$2"
sudo mkdir -p "${rollback_root}"
if [[ ! -f "${edge_path}/docker-compose.yml" || ! -f "${edge_path}/.deploy-manifest" ]]; then
  printf 'NONE\trehearsal\n'
  exit 0
fi
previous_mode="rehearsal"
manifest_mode="$(sed -n 's/^mode=//p' "${edge_path}/.deploy-manifest" | tail -n 1)"
if [[ "${manifest_mode}" == "rehearsal" || "${manifest_mode}" == "cutover" ]]; then previous_mode="${manifest_mode}"; fi
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
archive="${rollback_root}/shared-edge-${timestamp}.tar.gz"
manifest_archive="${archive}.manifest"
sudo tar -czf "${archive}" --exclude=./.env --exclude=./.deploy-manifest -C "${edge_path}" .
sudo cp "${edge_path}/.deploy-manifest" "${manifest_archive}"
printf '%s\n' "${archive}" | sudo tee "${rollback_root}/latest" >/dev/null
printf '%s\t%s\n' "${archive}" "${previous_mode}"
REMOTE_SCRIPT
)"
IFS=$'\t' read -r ROLLBACK_ARCHIVE ROLLBACK_MODE <<<"${ROLLBACK_INFO}"

revoke_live_manifest() {
  ssh "${REMOTE}" bash -s -- "${EDGE_DEPLOY_PATH}" <<'REMOTE_SCRIPT'
set -euo pipefail
edge_path="$1"
sudo rm -f "${edge_path}/.deploy-manifest"
REMOTE_SCRIPT
}

rollback_edge_candidate() {
  local failure_status=$?
  if [[ $# -gt 0 ]]; then failure_status="$1"; fi
  local rollback_status=0
  EDGE_RECOVERY_REQUIRED=true
  trap - ERR
  trap '' TERM INT HUP
  set +e
  echo "Edge candidate failed; restoring only shared-edge." >&2

  if [[ "${ROLLBACK_ARCHIVE}" == "NONE" ]]; then
    ssh "${REMOTE}" bash -s -- "${EDGE_DEPLOY_PATH}" "${EDGE_MODE}" <<'REMOTE_SCRIPT'
set -euo pipefail
edge_path="$1"
mode="$2"
if [[ ! -f "${edge_path}/docker-compose.yml" ]]; then
  exit 0
fi
cd "${edge_path}"
compose_files=(-f docker-compose.yml)
if [[ "${mode}" == "rehearsal" ]]; then compose_files+=(-f docker-compose.rehearsal.yml); fi
docker compose -p shared-edge "${compose_files[@]}" --env-file .env stop edge
REMOTE_SCRIPT
    rollback_status=$?
  else
    ssh "${REMOTE}" bash -s -- "${EDGE_DEPLOY_PATH}" "${ROLLBACK_ARCHIVE}" "${ROLLBACK_MODE}" <<'REMOTE_SCRIPT'
set -euo pipefail
edge_path="$1"
archive="$2"
mode="$3"
manifest_archive="${archive}.manifest"
sudo find "${edge_path}" -mindepth 1 -maxdepth 1 ! -name .env ! -name .deploy-manifest -exec rm -rf -- {} +
sudo tar -xzf "${archive}" -C "${edge_path}"
cd "${edge_path}"
compose_files=(-f docker-compose.yml)
if [[ "${mode}" == "rehearsal" ]]; then compose_files+=(-f docker-compose.rehearsal.yml); fi
docker compose -p shared-edge "${compose_files[@]}" --env-file .env config >/dev/null
docker compose -p shared-edge "${compose_files[@]}" --env-file .env up -d
sudo cp "${manifest_archive}" "${edge_path}/.deploy-manifest"
REMOTE_SCRIPT
    rollback_status=$?
  fi

  if [[ "${rollback_status}" -ne 0 ]]; then
    echo "Edge rollback failed; live deployment remains untrusted because no manifest is present." >&2
  else
    EDGE_RECOVERY_REQUIRED=false
  fi
  exit "${failure_status}"
}

trap 'rollback_edge_candidate' ERR
trap 'rollback_edge_candidate 143' TERM
trap 'rollback_edge_candidate 130' INT
trap 'rollback_edge_candidate 129' HUP
revoke_live_manifest

echo "Syncing edge source..."
rsync -az --delete --rsync-path="${DEPLOY_RSYNC_PATH}" --exclude ".env" --exclude ".deploy-manifest" "${EDGE_DIR}/" "${REMOTE}:${EDGE_DEPLOY_PATH}/"

if [[ "${EDGE_MODE}" == "rehearsal" ]]; then REMOTE_COMPOSE_FILES="-f docker-compose.yml -f docker-compose.rehearsal.yml"; else REMOTE_COMPOSE_FILES="-f docker-compose.yml"; fi

ssh "${REMOTE}" "
  set -euo pipefail
  cd '${EDGE_DEPLOY_PATH}'
  docker compose -p shared-edge ${REMOTE_COMPOSE_FILES} --env-file .env config >/dev/null
  docker compose -p shared-edge ${REMOTE_COMPOSE_FILES} --env-file .env run --rm --no-deps --entrypoint caddy edge validate --config /etc/caddy/Caddyfile
  docker compose -p shared-edge ${REMOTE_COMPOSE_FILES} --env-file .env up -d
"

probe_rehearsal_listener() {
  {
    printf 'CATERING_SMOKE_BASIC_AUTH_USER=%q\n' "${CATERING_SMOKE_BASIC_AUTH_USER}"
    printf 'CATERING_SMOKE_BASIC_AUTH_PASSWORD=%q\n' "${CATERING_SMOKE_BASIC_AUTH_PASSWORD}"
    cat <<'REMOTE_SCRIPT'
set -euo pipefail
ZEITERFASSUNG_SMOKE_HOST="$1"
EVENTOS_SMOKE_HOST="$2"
CATERING_SMOKE_HOST="$3"
probe() {
  local label="$1" host="$2" path="$3" expected_status="$4" status="" attempt
  for attempt in $(seq 1 15); do
    status="$(curl --silent --show-error --max-time 5 --output /dev/null --write-out '%{http_code}' --header "Host: ${host}" "http://127.0.0.1:18080${path}" || true)"
    if [[ "${status}" == "${expected_status}" ]]; then echo "${label}: ok (${status})"; return 0; fi
    sleep 1
  done
  echo "${label}: expected ${expected_status}, got ${status:-no response}" >&2
  return 1
}
probe_ok_json() {
  local label="$1" host="$2" path="$3" status="" body_file attempt
  body_file="$(mktemp)"
  for attempt in $(seq 1 15); do
    : >"${body_file}"
    status="$(curl --silent --show-error --max-time 5 --output "${body_file}" --write-out '%{http_code}' --header "Host: ${host}" "http://127.0.0.1:18080${path}" || true)"
    if [[ "${status}" == "200" ]] && grep -Eq '"ok"[[:space:]]*:[[:space:]]*true' "${body_file}"; then rm -f "${body_file}"; echo "${label}: ok (${status}, semantic identity confirmed)"; return 0; fi
    sleep 1
  done
  rm -f "${body_file}"
  echo "${label}: expected 200 with ok=true, got ${status:-no response}" >&2
  return 1
}
probe_catering_json() {
  local label="$1" host="$2" path="$3" status="" body_file attempt
  body_file="$(mktemp)"
  for attempt in $(seq 1 15); do
    : >"${body_file}"
    status="$(curl --silent --show-error --max-time 5 --basic --user "${CATERING_SMOKE_BASIC_AUTH_USER}:${CATERING_SMOKE_BASIC_AUTH_PASSWORD}" --output "${body_file}" --write-out '%{http_code}' --header "Host: ${host}" "http://127.0.0.1:18080${path}" || true)"
    if [[ "${status}" == "200" ]]; then
      if python3 - "${body_file}" <<'PYTHON'
import json
import sys

try:
    with open(sys.argv[1], encoding="utf-8") as response:
        payload = json.load(response)
except (OSError, UnicodeError, json.JSONDecodeError):
    raise SystemExit(1)

if not isinstance(payload, dict):
    raise SystemExit(1)
if payload.get("status") != "ok":
    raise SystemExit(1)
if payload.get("service") != "intake-service":
    raise SystemExit(1)
PYTHON
      then
        rm -f "${body_file}"
        echo "${label}: ok (${status}, exact service identity confirmed)"
        return 0
      fi
    fi
    sleep 1
  done
  rm -f "${body_file}"
  echo "${label}: expected authenticated 200 from intake-service with status=ok, got ${status:-no response}" >&2
  return 1
}
probe_ok_json "Rehearsal Zeiterfassung" "${ZEITERFASSUNG_SMOKE_HOST}" "/healthz"
probe "Rehearsal EventOS" "${EVENTOS_SMOKE_HOST}" "/" "200"
probe_catering_json "Rehearsal Catering" "${CATERING_SMOKE_HOST}" "/api/intake/health"
REMOTE_SCRIPT
  } | ssh "${REMOTE}" bash -s -- "${ZEITERFASSUNG_SMOKE_HOST}" "${EVENTOS_SMOKE_HOST}" "${CATERING_SMOKE_HOST}"
}

if [[ "${EDGE_MODE}" == "rehearsal" ]]; then probe_rehearsal_listener; fi

CATERING_SMOKE_URL="${CATERING_SMOKE_URL}" ZEITERFASSUNG_SMOKE_URL="${ZEITERFASSUNG_SMOKE_URL}" EVENTOS_SMOKE_URL="${EVENTOS_SMOKE_URL}" CATERING_SMOKE_BASIC_AUTH_USER="${CATERING_SMOKE_BASIC_AUTH_USER:-}" CATERING_SMOKE_BASIC_AUTH_PASSWORD="${CATERING_SMOKE_BASIC_AUTH_PASSWORD:-}" bash "${SCRIPT_DIR}/smoke-all.sh"

echo "Recording edge deployment manifest..."
ssh "${REMOTE}" "
  set -euo pipefail
  manifest='${EDGE_DEPLOY_PATH}/.deploy-manifest'
  temporary=\"\${manifest}.tmp.\$$\"
  printf '%s\n' 'commit=${EDGE_DEPLOY_COMMIT_SHA}' 'mode=${EDGE_MODE}' \"deployed_at=\$(date -u +%Y-%m-%dT%H:%M:%SZ)\" 'rollback_root=${EDGE_ROLLBACK_ROOT}' | sudo tee \"\${temporary}\" >/dev/null
  sudo mv \"\${temporary}\" \"\${manifest}\"
"

trap - ERR TERM INT HUP
release_edge_lock
trap - EXIT
echo "Edge deployment completed in ${EDGE_MODE} mode."
