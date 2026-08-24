#!/usr/bin/env bash

set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:?Set DEPLOY_HOST}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_PATH="${DEPLOY_PATH:?Set DEPLOY_PATH}"
DEPLOY_BASE_URL="${DEPLOY_BASE_URL:?Set DEPLOY_BASE_URL}"
DEPLOY_RSYNC_PATH="${DEPLOY_RSYNC_PATH:-rsync}"
DEPLOY_COMMIT_SHA="${DEPLOY_COMMIT_SHA:?Set DEPLOY_COMMIT_SHA}"
SMOKE_BASIC_AUTH_USER="${SMOKE_BASIC_AUTH_USER:?Set SMOKE_BASIC_AUTH_USER}"
SMOKE_BASIC_AUTH_PASSWORD="${SMOKE_BASIC_AUTH_PASSWORD:?Set SMOKE_BASIC_AUTH_PASSWORD}"
DEPLOY_ROLLBACK_ROOT="${DEPLOY_ROLLBACK_ROOT:-${DEPLOY_PATH}-rollbacks}"

validate_remote_path() {
  local value="$1"
  [[ "${value}" == /opt/catering-agents-platform || "${value}" == /opt/catering-agents-platform-rollbacks ]] || {
    echo "Remote path is outside the fixed platform allowlist." >&2
    exit 1
  }
  [[ "${value}" != *..* && "${value}" != *$'\n'* && "${value}" != *$'\r'* ]] || exit 1
}
validate_remote_path "${DEPLOY_PATH}"
validate_remote_path "${DEPLOY_ROLLBACK_ROOT}"

if [[ ! "${DEPLOY_COMMIT_SHA}" =~ ^[0-9a-fA-F]{40}$ ]]; then
  echo "DEPLOY_COMMIT_SHA must be an exact 40-character Git commit SHA." >&2
  exit 1
fi

for command_name in ssh rsync curl python3; do
  command -v "${command_name}" >/dev/null 2>&1 || {
    echo "${command_name} is required for the web-listener deployment." >&2
    exit 1
  }
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"
previous_web_image_id=""
previous_web_image_ref="platform-infra-web:latest"
WEB_CHANGED=false
phase3_owner_id() {
  local pid="${BASHPID-}"
  [[ -n "${pid}" ]] || pid="$$"
  printf 'normal-caller-%s-%s-%s' "${GITHUB_RUN_ID:-local}" "${GITHUB_RUN_ATTEMPT:-1}" "${pid}"
}
PHASE3_LOCK_OWNER="${PHASE3_LOCK_OWNER:-$(phase3_owner_id)}"
PHASE3_LOCK_HELD=false
PHASE3_PLATFORM_LOCK_MODE=absent
PHASE3_EDGE_LOCK_MODE=absent
PHASE3_RECOVERY_REQUIRED=false
PHASE3_MUTATION_STARTED=false
PHASE3_PORT_STATE=""

phase3_recovery_gate() {
  local failure_status=$?
  if [[ $# -gt 0 ]]; then failure_status="$1"; fi
  trap - ERR
  trap '' TERM INT HUP
  if [[ "${PHASE3_MUTATION_STARTED}" != true ]]; then
    PHASE3_RECOVERY_REQUIRED=true
    echo "Failure occurred before the first web mutation; retaining phase-3 lock state." >&2
    exit "${failure_status}"
  fi
  if declare -F rollback_web >/dev/null 2>&1; then
    rollback_web "${failure_status}"
  fi
  PHASE3_RECOVERY_REQUIRED=true
  echo "Recovery handler is not yet available; retaining phase-3 lock and pending state." >&2
  exit "${failure_status}"
}

phase3_guard() {
  local guard_result_file
  guard_result_file="$(mktemp "${TMPDIR:-/tmp}/catering-phase3-guard.XXXXXX")"
  if ! ssh "${REMOTE}" bash -s -- "/opt/catering-agents-platform.deploy-lock" "/opt/shared-edge.deploy-lock" "/opt/catering-phase3/phase3.activation" "/opt/catering-phase3/phase3.transaction-baseline.manifest" "${PHASE3_LOCK_OWNER}" >"${guard_result_file}" <<'REMOTE_PHASE3_GUARD'
set -euo pipefail
platform_lock="$1"; edge_lock="$2"; marker="$3"; manifest="$4"; owner_token="$5"
platform_mode=absent; edge_mode=absent
verify_lock_owned() {
  local lock="$1" expected_owner="$2" owner_file="${lock}/owner"
  local lock_real lock_expected_real lock_mode owner_mode
  lock_real="$(sudo realpath -e -- "${lock}" 2>/dev/null || sudo realpath "${lock}")" || return 1
  lock_expected_real="$(sudo realpath -e -- "$(dirname "${lock}")" 2>/dev/null || sudo realpath "$(dirname "${lock}")")/$(basename "${lock}")"
  lock_mode="$(sudo stat -c '%a' "${lock}" 2>/dev/null || sudo stat -f '%Lp' "${lock}")"
  owner_mode="$(sudo stat -c '%a' "${owner_file}" 2>/dev/null || sudo stat -f '%Lp' "${owner_file}")"
  [[ -d "${lock}" && ! -L "${lock}" && "${lock_real}" == "${lock_expected_real}" && "${lock_mode}" == 700 ]] || return 1
  [[ -f "${owner_file}" && ! -L "${owner_file}" && "${owner_mode}" == 600 ]] || return 1
  sudo grep -Fxq "owner_token=${expected_owner}" "${owner_file}"
}
release_on_guard_failure() { local status=$?; set +e; if [[ "${edge_mode}" == acquired ]] && verify_lock_owned "${edge_lock}" "${owner_token}"; then sudo unlink "${edge_lock}/owner"; sudo rmdir "${edge_lock}" 2>/dev/null || true; fi; if [[ "${platform_mode}" == acquired ]] && verify_lock_owned "${platform_lock}" "${owner_token}"; then sudo unlink "${platform_lock}/owner"; sudo rmdir "${platform_lock}" 2>/dev/null || true; fi; exit "${status}"; }
trap release_on_guard_failure EXIT
phase3_lock_acquire() {
  local lock="$1" mode_var="$2"
  local owner_file owner_tmp lock_real lock_mode owner_mode
  if sudo mkdir -m 0700 -- "${lock}" 2>/dev/null; then
    printf -v "${mode_var}" '%s' acquired
    lock_real="$(sudo realpath -e -- "${lock}" 2>/dev/null || sudo realpath "${lock}")"
    lock_mode="$(sudo stat -c '%a' "${lock}" 2>/dev/null || sudo stat -f '%Lp' "${lock}")"
    [[ "${lock_real}" == "${lock}" && "${lock_mode}" == 700 ]] || return 1
    owner_file="${lock}/owner"; owner_tmp="${owner_file}.pending.$$"
    printf '%s\n' "owner_token=${owner_token}" "owner=normal-caller-phase3-guard" | sudo tee "${owner_tmp}" >/dev/null
    sudo chmod 0600 "${owner_tmp}"; sudo mv -f "${owner_tmp}" "${owner_file}"
    owner_mode="$(sudo stat -c '%a' "${owner_file}" 2>/dev/null || sudo stat -f '%Lp' "${owner_file}")"
    [[ -f "${owner_file}" && ! -L "${owner_file}" && "${owner_mode}" == 600 ]] || return 1
    sudo grep -Fxq "owner_token=${owner_token}" "${owner_file}" || return 1
    return 0
  fi
  owner_file="${lock}/owner"
  lock_real="$(sudo realpath -e -- "${lock}" 2>/dev/null || sudo realpath "${lock}")"
  lock_mode="$(sudo stat -c '%a' "${lock}" 2>/dev/null || sudo stat -f '%Lp' "${lock}")"
  owner_mode="$(sudo stat -c '%a' "${owner_file}" 2>/dev/null || sudo stat -f '%Lp' "${owner_file}")"
  [[ -d "${lock}" && ! -L "${lock}" && "${lock_real}" == "${lock}" && "${lock_mode}" == 700 ]] || return 1
  [[ -f "${owner_file}" && ! -L "${owner_file}" && "${owner_mode}" == 600 ]] || return 1
  sudo grep -Fxq "owner_token=${owner_token}" "${owner_file}" || return 1
  printf -v "${mode_var}" '%s' reentered
}
phase3_lock_acquire "${platform_lock}" platform_mode
phase3_lock_acquire "${edge_lock}" edge_mode
state=absent
[[ ! -e "${marker}" ]] || { [[ -f "${marker}" && ! -L "${marker}" ]] || exit 1; state="$(sed -n 's/^state=//p' "${marker}")"; }
validate_phase3_artifacts() {
  case "${state}" in
    absent|inactive) [[ ! -e "${manifest}" && ! -e "/opt/catering-phase3/phase3.rollback-restore-proof.archive" && ! -e "/opt/catering-phase3/phase3.rollback-completion.receipt" ]] || exit 1 ;;
    candidate|active|rolling_back) printf '%s\n' NOT_APPLICABLE_PHASE3 >&2; exit 1 ;;
    *) exit 1 ;;
  esac
}
validate_phase3_artifacts
trap - EXIT
printf '%s\n' "platform_mode=${platform_mode}" "edge_mode=${edge_mode}"
REMOTE_PHASE3_GUARD
  then
    unlink "${guard_result_file}"
    return 1
  fi
  if ! cat "${guard_result_file}" >/dev/null; then
    unlink "${guard_result_file}"
    return 1
  fi
  PHASE3_PLATFORM_LOCK_MODE="$(sed -n 's/^platform_mode=//p' "${guard_result_file}" | tail -n 1)"
  PHASE3_EDGE_LOCK_MODE="$(sed -n 's/^edge_mode=//p' "${guard_result_file}" | tail -n 1)"
  unlink "${guard_result_file}"
  [[ "${PHASE3_PLATFORM_LOCK_MODE}" == acquired || "${PHASE3_PLATFORM_LOCK_MODE}" == reentered ]] || return 1
  [[ "${PHASE3_EDGE_LOCK_MODE}" == acquired || "${PHASE3_EDGE_LOCK_MODE}" == reentered ]] || return 1
  PHASE3_LOCK_HELD=true
}

phase3_release() {
  if [[ "${PHASE3_RECOVERY_REQUIRED}" == true ]]; then
    echo "Phase 3 recovery is unproven; retaining platform and shared-edge locks." >&2
    return 0
  fi
  [[ "${PHASE3_LOCK_HELD}" == true ]] || return 0
  ssh "${REMOTE}" bash -s -- "/opt/catering-agents-platform.deploy-lock" "/opt/shared-edge.deploy-lock" "${PHASE3_LOCK_OWNER}" "${PHASE3_PLATFORM_LOCK_MODE}" "${PHASE3_EDGE_LOCK_MODE}" <<'REMOTE_PHASE3_RELEASE'
set -euo pipefail
platform_lock="$1"; edge_lock="$2"; owner_token="$3"; platform_mode="$4"; edge_mode="$5"
verify_lock_owned() {
  local lock="$1" expected_owner="$2" owner_file="${lock}/owner"
  local lock_real expected_real lock_mode owner_mode
  lock_real="$(sudo realpath -e -- "${lock}" 2>/dev/null || sudo realpath "${lock}")" || exit 1
  expected_real="$(sudo realpath -e -- "$(dirname "${lock}")" 2>/dev/null || sudo realpath "$(dirname "${lock}")")/$(basename "${lock}")"
  lock_mode="$(sudo stat -c '%a' "${lock}" 2>/dev/null || sudo stat -f '%Lp' "${lock}")"
  owner_mode="$(sudo stat -c '%a' "${owner_file}" 2>/dev/null || sudo stat -f '%Lp' "${owner_file}")"
  [[ -d "${lock}" && ! -L "${lock}" && "${lock_real}" == "${expected_real}" && "${lock_mode}" == 700 ]] || exit 1
  [[ -f "${owner_file}" && ! -L "${owner_file}" && "${owner_mode}" == 600 ]] || exit 1
  sudo grep -Fxq "owner_token=${expected_owner}" "${owner_file}" || exit 1
}
if [[ "${edge_mode}" == acquired ]]; then
  verify_lock_owned "${edge_lock}" "${owner_token}" || exit 1
  sudo unlink "${edge_lock}/owner"; sudo rmdir "${edge_lock}"
fi
if [[ "${platform_mode}" == acquired ]]; then
  verify_lock_owned "${platform_lock}" "${owner_token}" || exit 1
  sudo unlink "${platform_lock}/owner"; sudo rmdir "${platform_lock}"
fi
REMOTE_PHASE3_RELEASE
  PHASE3_LOCK_HELD=false
}

phase3_recheck() {
  ssh "${REMOTE}" bash -s -- "/opt/catering-agents-platform.deploy-lock" "/opt/shared-edge.deploy-lock" "/opt/catering-phase3/phase3.activation" "/opt/catering-phase3/phase3.transaction-baseline.manifest" "${PHASE3_LOCK_OWNER}" <<'REMOTE_PHASE3_RECHECK'
set -euo pipefail
platform_lock="$1"; edge_lock="$2"; marker="$3"; manifest="$4"; owner_token="$5"
verify_lock_owned() {
  local lock="$1" expected_owner="$2" owner_file="${lock}/owner"
  local lock_real lock_expected_real lock_mode owner_mode
  lock_real="$(sudo realpath -e -- "${lock}" 2>/dev/null || sudo realpath "${lock}")" || exit 1
  lock_expected_real="$(sudo realpath -e -- "$(dirname "${lock}")" 2>/dev/null || sudo realpath "$(dirname "${lock}")")/$(basename "${lock}")"
  lock_mode="$(sudo stat -c '%a' "${lock}" 2>/dev/null || sudo stat -f '%Lp' "${lock}")"
  owner_mode="$(sudo stat -c '%a' "${owner_file}" 2>/dev/null || sudo stat -f '%Lp' "${owner_file}")"
  [[ -d "${lock}" && ! -L "${lock}" && "${lock_real}" == "${lock_expected_real}" && "${lock_mode}" == 700 ]] || exit 1
  [[ -f "${owner_file}" && ! -L "${owner_file}" && "${owner_mode}" == 600 ]] || exit 1
  sudo grep -Fxq "owner_token=${expected_owner}" "${owner_file}" || exit 1
}
verify_lock_owned "${platform_lock}" "${owner_token}"
verify_lock_owned "${edge_lock}" "${owner_token}"
state=absent
if [[ -e "${marker}" ]]; then
  [[ -f "${marker}" && ! -L "${marker}" ]] || exit 1
  state="$(sed -n 's/^state=//p' "${marker}")"
fi
validate_phase3_artifacts() {
  case "${state}" in
    absent|inactive) [[ ! -e "${manifest}" && ! -e "/opt/catering-phase3/phase3.rollback-restore-proof.archive" && ! -e "/opt/catering-phase3/phase3.rollback-completion.receipt" ]] || exit 1 ;;
    candidate|active|rolling_back) printf '%s\n' NOT_APPLICABLE_PHASE3 >&2; exit 1 ;;
    *) exit 1 ;;
  esac
}
validate_phase3_artifacts
REMOTE_PHASE3_RECHECK
}

phase3_restore_web() {
  [[ "${ROLLBACK_ARCHIVE:-NONE}" != NONE ]] || return 1
  ssh "${REMOTE}" bash -s -- "${DEPLOY_PATH}" "${ROLLBACK_ARCHIVE}" "${ROLLBACK_MODE}" "${previous_web_image_id}" "${PHASE3_PORT_STATE}" <<'REMOTE_WEB_RESTORE'
set -euo pipefail
deploy_path="$1"
archive="$2"
mode="$3"
previous_image="$4"
expected_ports="$5"
[[ -f "${archive}" && ! -L "${archive}" ]] || exit 1
sudo tar -tzf "${archive}" >/dev/null
sudo tar -tzf "${archive}" | grep -Fx './.deploy-manifest' >/dev/null || exit 1
# Remove filled deployment directories depth-first while preserving protected
# state and the complete rollback tree, including all of its descendants.
sudo find "${deploy_path}" -mindepth 1 \
  ! -path "${deploy_path}/.env" \
  ! -path "${deploy_path}/.deploy-manifest" \
  ! -path "${deploy_path}/.deploy-manifest.manifest" \
  ! -path "${deploy_path}/rollbacks" \
  ! -path "${deploy_path}/rollbacks/*" \
  ! -path "${deploy_path}/data" \
  ! -path "${deploy_path}/data/*" \
  ! -path "${deploy_path}/platform-infra" \
  ! -path "${deploy_path}/platform-infra/.env" \
  ! -path "${deploy_path}/platform-infra/sites" \
  ! -path "${deploy_path}/platform-infra/sites/*" \
  -depth -delete
sudo tar -xzf "${archive}" -C "${deploy_path}"
[[ -f "${deploy_path}/.deploy-manifest" && ! -L "${deploy_path}/.deploy-manifest" ]] || exit 1
expected_manifest_hash="$(sudo tar -xOf "${archive}" ./.deploy-manifest | sha256sum | awk '{print $1}')"
actual_manifest_hash="$(sudo sha256sum "${deploy_path}/.deploy-manifest" | awk '{print $1}')"
[[ "${actual_manifest_hash}" == "${expected_manifest_hash}" ]] || exit 1
cd "${deploy_path}/platform-infra"
compose_files=(-f docker-compose.yml -f docker-compose.production.yml -f docker-compose.edge-cutover.yml)
docker compose -p platform-infra "${compose_files[@]}" config >/dev/null
docker image inspect "${previous_image}" >/dev/null
docker image tag "${previous_image}" platform-infra-web:latest
docker compose -p platform-infra "${compose_files[@]}" up -d --no-deps --force-recreate --no-build web
actual_ports="$(docker inspect --format '{{json .HostConfig.PortBindings}}' platform-infra-web-1)"
[[ -n "${expected_ports}" && "${actual_ports}" == "${expected_ports}" ]] || exit 1
REMOTE_WEB_RESTORE
}

rollback_web() {
  local failure_status=$?
  if [[ $# -gt 0 ]]; then failure_status="$1"; fi
  trap - ERR
  trap '' TERM INT HUP
  PHASE3_RECOVERY_REQUIRED=true
  set +e
  local rollback_status=1

  if [[ "${ROLLBACK_ARCHIVE:-NONE}" != NONE ]]; then
    echo "Catering web listener deployment failed; restoring the authenticated source snapshot and port state." >&2
    if phase3_restore_web; then rollback_status=0; fi
  elif [[ "${WEB_CHANGED}" == "true" && -n "${previous_web_image_id}" ]]; then
    echo "Catering web listener deployment failed before a source snapshot; restoring the prior web image and port state." >&2
    ssh "${REMOTE}" bash -s -- "${DEPLOY_PATH}" "${previous_web_image_id}" "${previous_web_image_ref}" "${PHASE3_PORT_STATE}" <<'REMOTE_SCRIPT'
set -euo pipefail
deploy_path="$1"
previous_web_image_id="$2"
previous_web_image_ref="$3"
expected_ports="$4"
cd "${deploy_path}/platform-infra"
docker image inspect "${previous_web_image_id}" >/dev/null
docker image tag "${previous_web_image_id}" "${previous_web_image_ref}"
docker compose -p platform-infra -f docker-compose.yml -f docker-compose.production.yml -f docker-compose.edge-cutover.yml \
  up -d --no-deps --force-recreate --no-build web
actual_ports="$(docker inspect --format '{{json .HostConfig.PortBindings}}' platform-infra-web-1)"
[[ -n "${expected_ports}" && "${actual_ports}" == "${expected_ports}" ]] || exit 1
REMOTE_SCRIPT
    rollback_status=$?
  fi

  if [[ "${rollback_status}" -eq 0 ]]; then
    PHASE3_RECOVERY_REQUIRED=false
  else
    echo "Catering web rollback failed or had no authenticated snapshot; retaining locks, pending files, and manifest for recovery." >&2
  fi
  exit "${failure_status}"
}
ssh "${REMOTE}" bash -s -- "${DEPLOY_PATH}" <<'REMOTE_SCRIPT'
set -euo pipefail
deploy_path="$1"
[[ "${deploy_path}" == /opt/catering-agents-platform ]] || exit 1
[[ -d "${deploy_path}" && ! -L "${deploy_path}" ]] || exit 1
[[ "$(realpath -e -- "${deploy_path}")" == "${deploy_path}" ]] || exit 1
[[ "$(stat -c '%a' "${deploy_path}")" == 755 ]] || exit 1
test -f "${deploy_path}/platform-infra/.env"
test -f "${deploy_path}/platform-infra/docker-compose.yml"
test -f "${deploy_path}/platform-infra/docker-compose.production.yml"
docker network inspect platform-infra_default >/dev/null
REMOTE_SCRIPT

phase3_guard
trap phase3_release EXIT
trap phase3_recovery_gate ERR
trap 'phase3_recovery_gate 143' TERM
trap 'phase3_recovery_gate 130' INT
trap 'phase3_recovery_gate 129' HUP
phase3_recheck
previous_web_image_id="$(ssh "${REMOTE}" bash -s -- "${DEPLOY_PATH}" <<'REMOTE_SCRIPT'
set -euo pipefail
deploy_path="$1"
cd "${deploy_path}/platform-infra"
docker compose -p platform-infra -f docker-compose.yml -f docker-compose.production.yml -f docker-compose.edge-cutover.yml ps -q web | \
  xargs -r docker inspect --format '{{.Image}}' | head -n 1
REMOTE_SCRIPT
)"
if [[ -z "${previous_web_image_id}" ]]; then
  echo "Could not determine the currently running Catering web image; refusing targeted deployment." >&2
  exit 1
fi
PHASE3_PORT_STATE="$(ssh "${REMOTE}" bash -s -- "${DEPLOY_PATH}" <<'REMOTE_PORT_STATE'
set -euo pipefail
deploy_path="$1"
cd "${deploy_path}/platform-infra"
docker inspect --format '{{json .HostConfig.PortBindings}}' platform-infra-web-1
REMOTE_PORT_STATE
)"
[[ -n "${PHASE3_PORT_STATE}" ]] || exit 1

echo "Creating source rollback snapshot before the web-only update..."
PHASE3_MUTATION_STARTED=true
phase3_recheck
ROLLBACK_INFO="$(ssh "${REMOTE}" bash -s -- "${DEPLOY_PATH}" "${DEPLOY_ROLLBACK_ROOT}" "${DEPLOY_COMMIT_SHA}" <<'REMOTE_SCRIPT'
set -euo pipefail
deploy_path="$1"
rollback_root="$2"
commit_sha="$3"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
sudo mkdir -p "${rollback_root}"
archive="${rollback_root}/catering-web-listener-${timestamp}-${commit_sha:0:12}.tar.gz"
sudo tar -czf "${archive}" \
  --exclude=./data \
  --exclude=./platform-infra/.env \
  --exclude=./platform-infra/sites \
  -C "${deploy_path}" .
sudo tar -tzf "${archive}" | grep -Fx './.deploy-manifest' >/dev/null
printf '%s\n' "${archive}" | sudo tee "${rollback_root}/latest-web-listener" >/dev/null
printf '%s\t%s\n' "${archive}" web-listener
REMOTE_SCRIPT
)"
IFS=$'\t' read -r ROLLBACK_ARCHIVE ROLLBACK_MODE <<<"${ROLLBACK_INFO}"
[[ -n "${ROLLBACK_ARCHIVE}" && "${ROLLBACK_MODE}" == web-listener ]] || {
  echo "Web-listener rollback snapshot readback is incomplete; retaining recovery state." >&2
  exit 1
}

echo "Syncing exact repository source without protected state..."
phase3_recheck
rsync -az --delete \
  --rsync-path="${DEPLOY_RSYNC_PATH}" \
  --exclude ".git" \
  --exclude ".deploy-manifest" \
  --exclude ".web-listener-deploy-manifest" \
  --exclude "node_modules" \
  --exclude "data" \
  --exclude "backoffice-ui/dist" \
  --exclude "Kochbücher" \
  --exclude "platform-infra/.env" \
  --exclude "platform-infra/sites" \
  "${REPO_ROOT}/" "${REMOTE}:${DEPLOY_PATH}/"

ssh "${REMOTE}" bash -s -- "${DEPLOY_PATH}" <<'REMOTE_SCRIPT'
set -euo pipefail
deploy_path="$1"
cd "${deploy_path}/platform-infra"
docker compose -p platform-infra -f docker-compose.yml -f docker-compose.production.yml -f docker-compose.edge-cutover.yml config >/dev/null
docker compose -p platform-infra -f docker-compose.yml -f docker-compose.production.yml -f docker-compose.edge-cutover.yml build web
REMOTE_SCRIPT

phase3_recheck
WEB_CHANGED=true
ssh "${REMOTE}" bash -s -- "${DEPLOY_PATH}" <<'REMOTE_SCRIPT'
set -euo pipefail
deploy_path="$1"
cd "${deploy_path}/platform-infra"
docker compose -p platform-infra -f docker-compose.yml -f docker-compose.production.yml -f docker-compose.edge-cutover.yml \
  up -d --no-deps --force-recreate --no-build web
REMOTE_SCRIPT

probe_auth_file=""
remote_auth_file=""
remote_auth_pending=""
cleanup_probe_auth() {
  [[ -z "${probe_auth_file}" ]] || unlink "${probe_auth_file}" 2>/dev/null || true
  if [[ -n "${remote_auth_file}" || -n "${remote_auth_pending}" ]]; then
    ssh "${REMOTE}" bash -s -- "${remote_auth_file}" "${remote_auth_pending}" <<'REMOTE_CLEANUP' >/dev/null 2>&1 || true
set +e
for path in "$1" "$2"; do
  [[ -n "${path}" && -f "${path}" && ! -L "${path}" ]] && unlink "${path}" 2>/dev/null || true
done
REMOTE_CLEANUP
  fi
}
trap cleanup_probe_auth EXIT
trap 'cleanup_probe_auth; exit 143' TERM INT HUP
probe_auth_file="$(mktemp)"
chmod 600 "${probe_auth_file}"
printf 'user = "%s:%s"\n' "${SMOKE_BASIC_AUTH_USER}" "${SMOKE_BASIC_AUTH_PASSWORD}" >"${probe_auth_file}"
remote_auth_file="$(ssh "${REMOTE}" bash -s <<'REMOTE_MKTEMP'
set -euo pipefail
umask 077
mktemp /tmp/.catering-probe-auth.XXXXXX
REMOTE_MKTEMP
)"
[[ "${remote_auth_file}" == /tmp/.catering-probe-auth.?????? ]] || exit 1
remote_auth_pending="${remote_auth_file}.pending.${DEPLOY_COMMIT_SHA:0:12}"
scp "${probe_auth_file}" "${REMOTE}:${remote_auth_pending}"
ssh "${REMOTE}" bash -s -- "${DEPLOY_PATH}" "${remote_auth_file}" "${remote_auth_pending}" <<'REMOTE_SCRIPT'
set -euo pipefail
deploy_path="$1"
remote_auth_file="$2"
remote_auth_pending="$3"
cd "${deploy_path}/platform-infra"
body_file="$(mktemp)"
[[ -f "${remote_auth_file}" && ! -L "${remote_auth_file}" ]] || exit 1
[[ -f "${remote_auth_pending}" && ! -L "${remote_auth_pending}" ]] || exit 1
auth_mode="$(stat -c '%a' "${remote_auth_pending}" 2>/dev/null || stat -f '%Lp' "${remote_auth_pending}")"
auth_owner="$(stat -c '%u' "${remote_auth_pending}" 2>/dev/null || stat -f '%u' "${remote_auth_pending}")"
[[ "${auth_mode}" == 600 && "${auth_owner}" == "$(id -u)" ]] || exit 1
mv -f "${remote_auth_pending}" "${remote_auth_file}"
cleanup() { unlink "${body_file}" 2>/dev/null || true; [[ -f "${remote_auth_file}" && ! -L "${remote_auth_file}" ]] && unlink "${remote_auth_file}" 2>/dev/null || true; }
trap cleanup EXIT

probe_ok=false
for attempt in $(seq 1 15); do
  : >"${body_file}"
  if docker compose -p platform-infra -f docker-compose.yml -f docker-compose.production.yml -f docker-compose.edge-cutover.yml \
    exec -T web sh -c 'exec curl --silent --show-error --fail --config - --max-time 5 http://127.0.0.1:8081/api/intake/health' \
    <"${remote_auth_file}" >"${body_file}" 2>/dev/null; then
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
      probe_ok=true
      break
    fi
  fi
  sleep 1
  done

if [[ "${probe_ok}" != "true" ]]; then
  echo "Dedicated Catering listener failed exact intake-service identity probe on web:8081." >&2
  exit 1
fi

echo "Catering internal listener: ok (web:8081 -> intake-service, exact identity confirmed)"
REMOTE_SCRIPT

cleanup_probe_auth
trap - EXIT TERM INT HUP
public_body="$(mktemp)"
cleanup_public() { unlink "${public_body}" 2>/dev/null || true; }
trap cleanup_public EXIT
public_ok=false
for _ in $(seq 1 10); do
  : >"${public_body}"
  if curl --silent --show-error --fail --max-time 8 \
    --config <(printf 'user = "%s:%s"\n' "${SMOKE_BASIC_AUTH_USER}" "${SMOKE_BASIC_AUTH_PASSWORD}") \
    --output "${public_body}" \
    "${DEPLOY_BASE_URL%/}/api/intake/health"; then
    if python3 - "${public_body}" <<'PYTHON'
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
      public_ok=true
      break
    fi
  fi
  sleep 1
done
if [[ "${public_ok}" != "true" ]]; then
  echo "Existing public Catering path failed exact intake-service identity probe after web recreate." >&2
  false
fi
echo "Public Catering path: ok (exact intake-service identity confirmed)"
unlink "${public_body}" 2>/dev/null || true
trap - EXIT
trap phase3_release EXIT

ssh "${REMOTE}" bash -s -- "${DEPLOY_PATH}" "${DEPLOY_COMMIT_SHA}" <<'REMOTE_SCRIPT'
set -euo pipefail
deploy_path="$1"
commit_sha="$2"
manifest="${deploy_path}/.web-listener-deploy-manifest"
temporary="${manifest}.tmp.$$"
printf '%s\n' \
  "commit=${commit_sha}" \
  "scope=web-listener" \
  "deployed_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  | sudo tee "${temporary}" >/dev/null
sudo mv "${temporary}" "${manifest}"
REMOTE_SCRIPT

WEB_CHANGED=false
trap - ERR
phase3_release
trap - EXIT
echo "Catering web-only listener deployment completed without restarting application services."
