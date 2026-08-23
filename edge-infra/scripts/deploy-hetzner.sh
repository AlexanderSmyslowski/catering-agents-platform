#!/usr/bin/env bash

set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:?Set DEPLOY_HOST}"
DEPLOY_USER="${DEPLOY_USER:-root}"
EDGE_DEPLOY_PATH="${EDGE_DEPLOY_PATH:?Set EDGE_DEPLOY_PATH}"
EDGE_ROLLBACK_ROOT="${EDGE_ROLLBACK_ROOT:-${EDGE_DEPLOY_PATH}-rollbacks}"
PHASE3_EDGE_LOCK="/opt/shared-edge.deploy-lock"
EDGE_DEPLOY_COMMIT_SHA="${EDGE_DEPLOY_COMMIT_SHA:?Set EDGE_DEPLOY_COMMIT_SHA}"
EDGE_MODE="${EDGE_MODE:-rehearsal}"
CATERING_SMOKE_URL="${CATERING_SMOKE_URL:?Set CATERING_SMOKE_URL}"
ZEITERFASSUNG_SMOKE_URL="${ZEITERFASSUNG_SMOKE_URL:?Set ZEITERFASSUNG_SMOKE_URL}"
EVENTOS_SMOKE_URL="${EVENTOS_SMOKE_URL:?Set EVENTOS_SMOKE_URL}"
DEPLOY_RSYNC_PATH="${DEPLOY_RSYNC_PATH:-rsync}"
CATERING_SMOKE_BASIC_AUTH_USER="${CATERING_SMOKE_BASIC_AUTH_USER:-}"
CATERING_SMOKE_BASIC_AUTH_PASSWORD="${CATERING_SMOKE_BASIC_AUTH_PASSWORD:-}"

write_rollback_outcome() {
  local outcome="$1"
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    printf 'rollback_outcome=%s\n' "${outcome}" >>"${GITHUB_OUTPUT}"
  fi
}

write_rollback_outcome not_attempted

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

for command_name in ssh scp rsync docker; do
  command -v "${command_name}" >/dev/null 2>&1 || {
    echo "${command_name} is required for edge deployment." >&2
    exit 1
  }
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EDGE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"
validate_remote_path() {
  local value="$1"
  [[ "${value}" == /opt/shared-edge || "${value}" == /opt/shared-edge-rollbacks ]] || {
    echo "Remote edge path is outside the fixed allowlist." >&2
    exit 1
  }
  [[ "${value}" != *..* && "${value}" != *$'\n'* && "${value}" != *$'\r'* ]] || exit 1
}
validate_remote_path "${EDGE_DEPLOY_PATH}"
validate_remote_path "${EDGE_ROLLBACK_ROOT}"
EDGE_LOCK_HELD=false
EDGE_LOCK_REENTRANT=false
EDGE_RECOVERY_REQUIRED=false
EDGE_LOCK_MODE=absent
PLATFORM_LOCK_MODE=absent
phase3_owner_id() {
  local pid="${BASHPID-}"
  [[ -n "${pid}" ]] || pid="$$"
  printf 'normal-caller-%s-%s-%s' "${GITHUB_RUN_ID:-local}" "${GITHUB_RUN_ATTEMPT:-1}" "${pid}"
}
PHASE3_LOCK_OWNER="${PHASE3_LOCK_OWNER:-$(phase3_owner_id)}"
PHASE3_LOCK_HELD=false

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
  PLATFORM_LOCK_MODE="$(sed -n 's/^platform_mode=//p' "${guard_result_file}" | tail -n 1)"
  EDGE_LOCK_MODE="$(sed -n 's/^edge_mode=//p' "${guard_result_file}" | tail -n 1)"
  unlink "${guard_result_file}"
  [[ "${PLATFORM_LOCK_MODE}" == acquired || "${PLATFORM_LOCK_MODE}" == reentered ]] || return 1
  [[ "${EDGE_LOCK_MODE}" == acquired || "${EDGE_LOCK_MODE}" == reentered ]] || return 1
  PHASE3_LOCK_HELD=true
}

phase3_release() {
  if [[ "${EDGE_RECOVERY_REQUIRED}" == "true" ]]; then
    echo "Recovery is still required; retaining phase-3 locks." >&2
    return 0
  fi
  [[ "${PHASE3_LOCK_HELD}" == true ]] || return 0
  ssh "${REMOTE}" bash -s -- "/opt/catering-agents-platform.deploy-lock" "/opt/shared-edge.deploy-lock" "${PHASE3_LOCK_OWNER}" "${PLATFORM_LOCK_MODE}" "${EDGE_LOCK_MODE}" <<'REMOTE_PHASE3_RELEASE'
set -euo pipefail
platform_lock="$1"; edge_lock="$2"; owner_token="$3"; platform_mode="$4"; edge_mode="$5"
verify_lock_owned() {
  local lock="$1" expected_token="$2" owner_file="${lock}/owner" lock_real expected_real lock_mode owner_mode
  lock_real="$(sudo realpath -e -- "${lock}" 2>/dev/null || sudo realpath "${lock}")"
  expected_real="$(sudo realpath -e -- "$(dirname "${lock}")" 2>/dev/null || sudo realpath "$(dirname "${lock}")")/$(basename "${lock}")"
  lock_mode="$(sudo stat -c '%a' "${lock}" 2>/dev/null || sudo stat -f '%Lp' "${lock}")"
  owner_mode="$(sudo stat -c '%a' "${owner_file}" 2>/dev/null || sudo stat -f '%Lp' "${owner_file}")"
  [[ -d "${lock}" && ! -L "${lock}" && "${lock_real}" == "${expected_real}" && "${lock_mode}" == 700 ]] || return 1
  [[ -f "${owner_file}" && ! -L "${owner_file}" && "${owner_mode}" == 600 ]] || return 1
  sudo grep -Fxq "owner_token=${expected_token}" "${owner_file}"
}
if [[ "${edge_mode}" == acquired ]]; then verify_lock_owned "${edge_lock}" "${owner_token}"; sudo unlink "${edge_lock}/owner"; sudo rmdir "${edge_lock}"; fi
if [[ "${platform_mode}" == acquired ]]; then verify_lock_owned "${platform_lock}" "${owner_token}"; sudo unlink "${platform_lock}/owner"; sudo rmdir "${platform_lock}"; fi
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

ssh "${REMOTE}" bash -s -- "${EDGE_DEPLOY_PATH}" <<'REMOTE_PREFLIGHT'
set -euo pipefail
edge_path="$1"
[[ "${edge_path}" == /opt/shared-edge ]] || exit 1
[[ -d "${edge_path}" && ! -L "${edge_path}" ]] || exit 1
[[ "$(realpath -e -- "${edge_path}")" == "${edge_path}" ]] || exit 1
[[ "$(stat -c '%a' "${edge_path}")" == 755 ]] || exit 1
command -v curl >/dev/null 2>&1 || { echo 'curl is required for local edge rehearsal probes.' >&2; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo 'python3 is required for semantic edge rehearsal probes.' >&2; exit 1; }
docker network inspect platform-infra_default >/dev/null 2>&1 || { echo 'Missing required external Docker network: platform-infra_default' >&2; exit 1; }
docker network inspect zeiterfassung_default >/dev/null 2>&1 || { echo 'Missing required external Docker network: zeiterfassung_default' >&2; exit 1; }
test -f "${edge_path}/.env" || { echo 'Missing protected edge .env on server.' >&2; exit 1; }
REMOTE_PREFLIGHT

phase3_guard
# The trap is installed immediately after the guard so every subsequent
# mutation is covered, including signal/ERR paths.
trap 'release_edge_lock; phase3_release' EXIT

acquire_edge_lock() {
  # phase3_guard already acquired or safely re-entered the shared lock. Keep
  # that exact mode; a newly acquired lock must not be mislabeled reentrant.
  EDGE_LOCK_REENTRANT="${EDGE_LOCK_MODE}"
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
  unlink "$local_tmp" 2>/dev/null || true
  sudo unlink "$pending" 2>/dev/null || true
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
    echo "Recovery is still required; retaining edge deploy lock ${PHASE3_EDGE_LOCK}." >&2
    return 0
  fi
  [[ "${EDGE_LOCK_REENTRANT}" == reentered ]] || return 0
  EDGE_LOCK_HELD=false
}

acquire_edge_lock
phase3_recheck
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
  sudo unlink "${edge_path}/.deploy-manifest"
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
# Remove only the allowlisted deployment entries while preserving protected
# state; depth-first unlink/rmdir avoids a recursive shell delete.
sudo find "${edge_path}" -mindepth 1 -maxdepth 1 \
  ! -name .env ! -name .deploy-manifest ! -name .deploy-manifest.manifest \
  ! -name 'rollbacks' -depth -delete
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
    write_rollback_outcome recovery_required
    echo "Edge rollback failed; live deployment remains untrusted because no manifest is present." >&2
  else
    EDGE_RECOVERY_REQUIRED=false
    write_rollback_outcome successful
  fi
  exit "${failure_status}"
}

trap 'rollback_edge_candidate' ERR
trap 'rollback_edge_candidate 143' TERM
trap 'rollback_edge_candidate 130' INT
trap 'rollback_edge_candidate 129' HUP
revoke_live_manifest
phase3_recheck

echo "Syncing edge source..."
rsync -az --delete --rsync-path="${DEPLOY_RSYNC_PATH}" --exclude ".env" --exclude ".deploy-manifest" "${EDGE_DIR}/" "${REMOTE}:${EDGE_DEPLOY_PATH}/"

phase3_recheck
ssh "${REMOTE}" bash -s -- "${EDGE_DEPLOY_PATH}" "${EDGE_MODE}" <<'REMOTE_COMPOSE'
set -euo pipefail
edge_path="$1"; mode="$2"
cd "${edge_path}"
compose_files=(-f docker-compose.yml)
if [[ "${mode}" == rehearsal ]]; then compose_files+=(-f docker-compose.rehearsal.yml); fi
docker compose -p shared-edge "${compose_files[@]}" --env-file .env config >/dev/null
docker compose -p shared-edge "${compose_files[@]}" --env-file .env run --rm --no-deps --entrypoint caddy edge validate --config /etc/caddy/Caddyfile
docker compose -p shared-edge "${compose_files[@]}" --env-file .env up -d
REMOTE_COMPOSE

probe_rehearsal_listener() {
  local auth_file="" remote_auth_file="" remote_auth_pending=""
  cleanup_rehearsal_auth() {
    [[ -z "${auth_file}" ]] || unlink "${auth_file}" 2>/dev/null || true
    if [[ -n "${remote_auth_file}" || -n "${remote_auth_pending}" ]]; then
      ssh "${REMOTE}" bash -s -- "${remote_auth_file}" "${remote_auth_pending}" <<'REMOTE_CLEANUP' >/dev/null 2>&1 || true
set +e
for path in "$1" "$2"; do
  [[ -n "${path}" && -f "${path}" && ! -L "${path}" ]] && unlink "${path}" 2>/dev/null || true
done
REMOTE_CLEANUP
    fi
  }
  trap cleanup_rehearsal_auth EXIT
  trap 'cleanup_rehearsal_auth; exit 143' TERM INT HUP
  auth_file="$(mktemp)"
  chmod 600 "${auth_file}"
  printf 'user = "%s:%s"\n' "${CATERING_SMOKE_BASIC_AUTH_USER}" "${CATERING_SMOKE_BASIC_AUTH_PASSWORD}" >"${auth_file}"
  remote_auth_file="$(ssh "${REMOTE}" bash -s <<'REMOTE_MKTEMP'
set -euo pipefail
umask 077
mktemp /tmp/.catering-edge-probe-auth.XXXXXX
REMOTE_MKTEMP
)"
  [[ "${remote_auth_file}" == /tmp/.catering-edge-probe-auth.?????? ]] || return 1
  remote_auth_pending="${remote_auth_file}.pending.${EDGE_DEPLOY_COMMIT_SHA:0:12}"
  scp "${auth_file}" "${REMOTE}:${remote_auth_pending}"
  ssh "${REMOTE}" bash -s -- "${remote_auth_file}" "${remote_auth_pending}" <<'REMOTE_AUTH_INSTALL'
set -euo pipefail
auth_file="$1"; auth_pending="$2"
[[ -f "${auth_pending}" && ! -L "${auth_pending}" ]] || exit 1
auth_mode="$(stat -c '%a' "${auth_pending}" 2>/dev/null || stat -f '%Lp' "${auth_pending}")"
auth_owner="$(stat -c '%u' "${auth_pending}" 2>/dev/null || stat -f '%u' "${auth_pending}")"
[[ "${auth_mode}" == 600 && "${auth_owner}" == "$(id -u)" ]] || exit 1
[[ ! -e "${auth_file}" || ( -f "${auth_file}" && ! -L "${auth_file}" ) ]] || exit 1
mv -f "${auth_pending}" "${auth_file}"
REMOTE_AUTH_INSTALL
  {
    cat <<'REMOTE_SCRIPT'
set -euo pipefail
ZEITERFASSUNG_SMOKE_HOST="$1"
EVENTOS_SMOKE_HOST="$2"
CATERING_SMOKE_HOST="$3"
EDGE_DEPLOY_PATH="$4"
REMOTE_AUTH_FILE="$5"
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
    if [[ "${status}" == "200" ]] && grep -Eq '"ok"[[:space:]]*:[[:space:]]*true' "${body_file}"; then unlink "${body_file}" 2>/dev/null || true; echo "${label}: ok (${status}, semantic identity confirmed)"; return 0; fi
    sleep 1
  done
  unlink "${body_file}" 2>/dev/null || true
  echo "${label}: expected 200 with ok=true, got ${status:-no response}" >&2
  return 1
}
probe_catering_json() {
  local label="$1" host="$2" path="$3" auth_file="$4" status="" content_type="" response_meta="" body_file attempt
  body_file="$(mktemp)"
  for attempt in $(seq 1 15); do
    : >"${body_file}"
    response_meta="$(curl --silent --show-error --max-time 5 --config "${auth_file}" --output "${body_file}" --write-out $'%{http_code}\t%{content_type}' --header "Host: ${host}" "http://127.0.0.1:18080${path}" || true)"
    IFS=$'\t' read -r status content_type <<<"${response_meta}"
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
        unlink "${body_file}" 2>/dev/null || true
        echo "${label}: ok (${status}, exact service identity confirmed)"
        return 0
      fi
    fi
    sleep 1
  done
  echo "${label}: expected authenticated 200 from intake-service with status=ok, got ${status:-no response}; collecting safe diagnostics" >&2
  if ! CATERING_DIAGNOSTIC_AUTH_CONFIG_FILE="${REMOTE_AUTH_FILE}" \
    bash "${EDGE_DEPLOY_PATH}/scripts/diagnose-catering-identity.sh" \
      "${host}" \
      "${status:-no response}" \
      "${content_type:-unknown}" \
      "${body_file}"
  then
    echo "${label}: diagnostic collector failed; identity gate remains failed" >&2
  fi
  unlink "${body_file}" 2>/dev/null || true
  return 1
}
probe_ok_json "Rehearsal Zeiterfassung" "${ZEITERFASSUNG_SMOKE_HOST}" "/healthz"
probe "Rehearsal EventOS" "${EVENTOS_SMOKE_HOST}" "/" "200"
probe_catering_json "Rehearsal Catering" "${CATERING_SMOKE_HOST}" "/api/intake/health" "${REMOTE_AUTH_FILE}"
REMOTE_SCRIPT
  } | ssh "${REMOTE}" bash -s -- "${ZEITERFASSUNG_SMOKE_HOST}" "${EVENTOS_SMOKE_HOST}" "${CATERING_SMOKE_HOST}" "${EDGE_DEPLOY_PATH}" "${remote_auth_file}"
  cleanup_rehearsal_auth
  trap - EXIT TERM INT HUP
}

if [[ "${EDGE_MODE}" == "rehearsal" ]]; then probe_rehearsal_listener; fi

if [[ "${EDGE_MODE}" == "cutover" ]]; then
  CATERING_SMOKE_URL="${CATERING_SMOKE_URL}" ZEITERFASSUNG_SMOKE_URL="${ZEITERFASSUNG_SMOKE_URL}" EVENTOS_SMOKE_URL="${EVENTOS_SMOKE_URL}" CATERING_SMOKE_BASIC_AUTH_USER="${CATERING_SMOKE_BASIC_AUTH_USER:-}" CATERING_SMOKE_BASIC_AUTH_PASSWORD="${CATERING_SMOKE_BASIC_AUTH_PASSWORD:-}" bash "${SCRIPT_DIR}/smoke-all.sh"
else
  echo "Skipping managed public-host smoke checks in rehearsal mode; candidate identities are authoritative."
fi

echo "Recording edge deployment manifest..."
ssh "${REMOTE}" bash -s -- "${EDGE_DEPLOY_PATH}" "${EDGE_DEPLOY_COMMIT_SHA}" "${EDGE_MODE}" "${EDGE_ROLLBACK_ROOT}" <<'REMOTE_MANIFEST'
set -euo pipefail
edge_path="$1"; commit_sha="$2"; mode="$3"; rollback_root="$4"
manifest="${edge_path}/.deploy-manifest"
temporary="${manifest}.tmp.$$"
printf '%s\n' "commit=${commit_sha}" "mode=${mode}" "deployed_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)" "rollback_root=${rollback_root}" | sudo tee "${temporary}" >/dev/null
sudo mv "${temporary}" "${manifest}"
REMOTE_MANIFEST

trap - ERR TERM INT HUP
release_edge_lock
phase3_release
trap - EXIT
echo "Edge deployment completed in ${EDGE_MODE} mode."
