#!/usr/bin/env bash

set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:?Set DEPLOY_HOST to the server hostname or IP.}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/catering-agents-platform}"
DEPLOY_BASE_URL="${DEPLOY_BASE_URL:-http://${DEPLOY_HOST}}"
DEPLOY_RSYNC_PATH="${DEPLOY_RSYNC_PATH:-rsync}"
DEPLOY_ROLLBACK_ROOT="${DEPLOY_ROLLBACK_ROOT:-${DEPLOY_PATH}-rollbacks}"
# Unset means the reviewed full edge-cutover chain; only an explicit false is
# rejected, so callers cannot silently fall back to base+production-only.
EDGE_EXTERNAL="${EDGE_EXTERNAL:-true}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"
DEPLOY_COMMIT_SHA="${DEPLOY_COMMIT_SHA:-$(git -C "${REPO_ROOT}" rev-parse HEAD 2>/dev/null || true)}"
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
PHASE3_RESTORE_VERIFIED=false
PHASE3_PORT_STATE=""
PHASE3_ROLLBACK_ARCHIVE=""

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

# The production platform caller is never allowed to mutate through a
# base+production-only path. Validate this before any remote guard/lock call so
# an unsafe switch cannot even trigger SSH.
if [[ "${EDGE_EXTERNAL}" != "true" && "${EDGE_EXTERNAL}" != "false" ]]; then
  echo "EDGE_EXTERNAL must be true or false."
  exit 1
fi
if [[ "${EDGE_EXTERNAL}" == "false" ]]; then
  echo "EDGE_EXTERNAL=false is not allowed for the production platform chain; use the reviewed edge cutover contract." >&2
  exit 1
fi
phase3_guard() {
  local guard_result_file
  guard_result_file="$(mktemp "${TMPDIR:-/tmp}/catering-phase3-guard.XXXXXX")"
  if ! ssh "${REMOTE}" bash -s -- \
    "/opt/catering-agents-platform.deploy-lock" \
    "/opt/shared-edge.deploy-lock" \
    "/opt/catering-phase3/phase3.activation" \
    "/opt/catering-phase3/phase3.transaction-baseline.manifest" \
    "${PHASE3_LOCK_OWNER}" >"${guard_result_file}" <<'REMOTE_PHASE3_GUARD'
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
release_on_guard_failure() {
  local status=$?
  set +e
  if [[ "${edge_mode}" == acquired ]] && verify_lock_owned "${edge_lock}" "${owner_token}"; then sudo unlink "${edge_lock}/owner"; sudo rmdir "${edge_lock}" 2>/dev/null || true; fi
  if [[ "${platform_mode}" == acquired ]] && verify_lock_owned "${platform_lock}" "${owner_token}"; then sudo unlink "${platform_lock}/owner"; sudo rmdir "${platform_lock}" 2>/dev/null || true; fi
  exit "${status}"
}
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

phase3_restore_platform() {
  local archive="${PHASE3_ROLLBACK_ARCHIVE}"
  [[ "${archive}" == /opt/catering-agents-platform-rollbacks/catering-agents-platform-*.tar.gz ]] || return 1
  ssh "${REMOTE}" bash -s -- "${DEPLOY_PATH}" "${archive}" "${PHASE3_PORT_STATE}" <<'REMOTE_PLATFORM_RESTORE'
set -euo pipefail
deploy_path="$1"
archive="$2"
expected_ports="$3"
[[ -d "${deploy_path}" && ! -L "${deploy_path}" ]] || exit 1
[[ -f "${archive}" && ! -L "${archive}" ]] || exit 1
sudo tar -tzf "${archive}" >/dev/null
sudo tar -xzf "${archive}" -C "${deploy_path}"
if sudo tar -tzf "${archive}" | grep -Fx './.deploy-manifest' >/dev/null; then
  [[ -f "${deploy_path}/.deploy-manifest" && ! -L "${deploy_path}/.deploy-manifest" ]] || exit 1
  expected_manifest_hash="$(sudo tar -xOf "${archive}" ./.deploy-manifest | sha256sum | awk '{print $1}')"
  actual_manifest_hash="$(sudo sha256sum "${deploy_path}/.deploy-manifest" | awk '{print $1}')"
  [[ "${actual_manifest_hash}" == "${expected_manifest_hash}" ]] || exit 1
else
  [[ ! -e "${deploy_path}/.deploy-manifest" && ! -L "${deploy_path}/.deploy-manifest" ]] || exit 1
fi
cd "${deploy_path}/platform-infra"
docker compose -f docker-compose.yml -f docker-compose.production.yml -f docker-compose.edge-cutover.yml config >/dev/null
docker compose -f docker-compose.yml -f docker-compose.production.yml -f docker-compose.edge-cutover.yml up --build -d
actual_ports="$(docker inspect --format '{{json .HostConfig.PortBindings}}' platform-infra-web-1)"
[[ -n "${expected_ports}" && "${actual_ports}" == "${expected_ports}" ]] || exit 1
REMOTE_PLATFORM_RESTORE
}

phase3_recover_and_exit() {
  local failure_status=$?
  if [[ $# -gt 0 ]]; then failure_status="$1"; fi
  trap - ERR
  trap '' TERM INT HUP
  set +e
  if [[ "${PHASE3_MUTATION_STARTED}" == true ]]; then
    PHASE3_RECOVERY_REQUIRED=true
    if phase3_restore_platform; then
      PHASE3_RESTORE_VERIFIED=true
      PHASE3_RECOVERY_REQUIRED=false
    fi
  fi
  if [[ "${PHASE3_RESTORE_VERIFIED}" == true || "${PHASE3_MUTATION_STARTED}" != true ]]; then
    phase3_release || true
  fi
  exit "${failure_status}"
}

if [[ ! "${DEPLOY_COMMIT_SHA}" =~ ^[0-9a-fA-F]{40}$ ]]; then
  echo "DEPLOY_COMMIT_SHA must be an exact 40-character Git commit SHA."
  exit 1
fi

if ! command -v rsync >/dev/null 2>&1; then
  echo "rsync is required for deployment."
  exit 1
fi

if ! command -v ssh >/dev/null 2>&1; then
  echo "ssh is required for deployment."
  exit 1
fi

echo "Checking remote deployment configuration..."
if ! ssh "${REMOTE}" bash -s -- "${DEPLOY_PATH}" <<'REMOTE_CONFIG_CHECK'
set -euo pipefail
deploy_path="$1"
[[ "$deploy_path" == /opt/catering-agents-platform ]] || exit 1
[[ -d "$deploy_path" && ! -L "$deploy_path" ]] || exit 1
[[ "$(realpath -e -- "$deploy_path")" == "$deploy_path" ]] || exit 1
[[ "$(stat -c '%a' "$deploy_path")" == 755 ]] || exit 1
test -f "${deploy_path}/platform-infra/.env"
REMOTE_CONFIG_CHECK
then
  echo "Missing platform-infra/.env on server."
  exit 1
fi

if ! ssh "${REMOTE}" bash -s -- <<'REMOTE_NETWORK_CHECK'
set -euo pipefail
docker network inspect zeiterfassung_default >/dev/null 2>&1
REMOTE_NETWORK_CHECK
then
  echo "Missing required external Docker network: zeiterfassung_default"
  exit 1
fi

# The read-only host preflight above must not create locks. Acquire the ordered
# Phase-3 locks only after those checks and immediately before the first write.
phase3_guard
trap phase3_release EXIT
trap phase3_recover_and_exit ERR
trap 'phase3_recover_and_exit 143' TERM
trap 'phase3_recover_and_exit 130' INT
trap 'phase3_recover_and_exit 129' HUP
phase3_recheck

PHASE3_PORT_STATE="$(ssh "${REMOTE}" bash -s <<'REMOTE_PORT_STATE'
set -euo pipefail
docker inspect --format '{{json .HostConfig.PortBindings}}' platform-infra-web-1
REMOTE_PORT_STATE
)"
[[ -n "${PHASE3_PORT_STATE}" ]] || exit 1

echo "Creating rollback snapshot on ${REMOTE}..."
PHASE3_MUTATION_STARTED=true
phase3_recheck
PHASE3_ROLLBACK_ARCHIVE="$(ssh "${REMOTE}" bash -s -- "${DEPLOY_PATH}" "${DEPLOY_ROLLBACK_ROOT}" <<'REMOTE_SNAPSHOT'
  set -euo pipefail
  deploy_path="$1"
  rollback_root="$2"
  [[ "$deploy_path" == /opt/catering-agents-platform ]] || exit 1
  [[ "$rollback_root" == /opt/catering-agents-platform-rollbacks ]] || exit 1
  [[ -d "$deploy_path" && ! -L "$deploy_path" ]] || exit 1
  timestamp=$(date -u +%Y%m%dT%H%M%SZ)
  sudo mkdir -p "${rollback_root}"
  archive="${rollback_root}/catering-agents-platform-${timestamp}.tar.gz"
  sudo tar -czf "${archive}" \
    --exclude=./data \
    --exclude=./platform-infra/.env \
    --exclude=./platform-infra/sites \
    -C "${deploy_path}" .
  printf '%s\n' "${archive}" | sudo tee "${rollback_root}/latest" >/dev/null
  printf '%s\n' "${archive}"
REMOTE_SNAPSHOT
)"
[[ "${PHASE3_ROLLBACK_ARCHIVE}" == /opt/catering-agents-platform-rollbacks/catering-agents-platform-*.tar.gz ]] || exit 1

echo "Syncing repository to ${REMOTE}:${DEPLOY_PATH}..."
phase3_recheck
rsync -az --delete \
  --rsync-path="${DEPLOY_RSYNC_PATH}" \
  --exclude ".git" \
  --exclude ".deploy-manifest" \
  --exclude "node_modules" \
  --exclude "data" \
  --exclude "backoffice-ui/dist" \
  --exclude "Kochbücher" \
  --exclude "platform-infra/.env" \
  --exclude "platform-infra/sites" \
  "${REPO_ROOT}/" "${REMOTE}:${DEPLOY_PATH}/"

echo "Ensuring remote deployment directory access..."
ssh "${REMOTE}" bash -s -- "${DEPLOY_PATH}" <<'REMOTE_CHMOD'
set -euo pipefail
deploy_path="$1"
[[ "$deploy_path" == /opt/catering-agents-platform ]] || exit 1
sudo chmod 755 "$deploy_path"
REMOTE_CHMOD

echo "Starting Docker Compose on ${REMOTE}..."
phase3_recheck
ssh "${REMOTE}" bash -s -- "${DEPLOY_PATH}" "${EDGE_EXTERNAL}" <<'REMOTE_COMPOSE'
  set -euo pipefail
  deploy_path="$1"
  edge_external="$2"
  [[ "$deploy_path" == /opt/catering-agents-platform ]] || exit 1
  [[ "$edge_external" == true ]] || { echo 'EDGE_EXTERNAL=false is not allowed.' >&2; exit 1; }
  cd "${deploy_path}/platform-infra"
  test -f .env || { echo 'Missing platform-infra/.env on server.'; exit 1; }
  test -f docker-compose.production.yml || { echo 'Missing platform-infra/docker-compose.production.yml on server.'; exit 1; }
  docker network inspect zeiterfassung_default >/dev/null 2>&1 || {
    echo 'Missing required external Docker network: zeiterfassung_default'
    exit 1
  }
  # Render the base+production pair as a read-only parity check; the mutation
  # below always includes the reviewed edge-cutover overlay.
  docker compose -f docker-compose.yml -f docker-compose.production.yml config >/dev/null
  if [[ "${edge_external}" == 'true' ]]; then
    test -f docker-compose.edge-cutover.yml || { echo 'Missing platform-infra/docker-compose.edge-cutover.yml on server.'; exit 1; }
    docker compose \
      -f docker-compose.yml \
      -f docker-compose.production.yml \
      -f docker-compose.edge-cutover.yml \
      config >/dev/null
    docker compose \
      -f docker-compose.yml \
      -f docker-compose.production.yml \
      -f docker-compose.edge-cutover.yml \
      up --build -d
  fi
REMOTE_COMPOSE

echo "Running smoke checks against ${DEPLOY_BASE_URL}..."
"${SCRIPT_DIR}/smoke-check.sh" "${DEPLOY_BASE_URL}"

echo "Recording deployed commit ${DEPLOY_COMMIT_SHA}..."
ssh "${REMOTE}" bash -s -- "${DEPLOY_PATH}" "${DEPLOY_COMMIT_SHA}" "${DEPLOY_ROLLBACK_ROOT}" <<'REMOTE_MANIFEST'
set -euo pipefail
deploy_path="$1"; commit_sha="$2"; rollback_root="$3"
manifest="${deploy_path}/.deploy-manifest"
temporary="${manifest}.tmp.$$"
printf '%s\n' "commit=${commit_sha}" "deployed_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)" "rollback_root=${rollback_root}" | sudo tee "${temporary}" >/dev/null
sudo mv "${temporary}" "${manifest}"
REMOTE_MANIFEST

echo "Deployment completed."
