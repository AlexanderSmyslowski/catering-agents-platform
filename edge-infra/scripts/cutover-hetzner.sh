#!/usr/bin/env bash

set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:?Set DEPLOY_HOST}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_PATH="${DEPLOY_PATH:?Set DEPLOY_PATH}"
EDGE_DEPLOY_PATH="${EDGE_DEPLOY_PATH:?Set EDGE_DEPLOY_PATH}"
EDGE_ROLLBACK_ROOT="${EDGE_ROLLBACK_ROOT:-${EDGE_DEPLOY_PATH}-rollbacks}"
EDGE_DEPLOY_COMMIT_SHA="${EDGE_DEPLOY_COMMIT_SHA:?Set EDGE_DEPLOY_COMMIT_SHA}"
DEPLOY_RSYNC_PATH="${DEPLOY_RSYNC_PATH:-rsync}"
CADDY_EMAIL="${CADDY_EMAIL:?Set CADDY_EMAIL}"
CATERING_SMOKE_URL="${CATERING_SMOKE_URL:?Set CATERING_SMOKE_URL}"
ZEITERFASSUNG_SMOKE_URL="${ZEITERFASSUNG_SMOKE_URL:?Set ZEITERFASSUNG_SMOKE_URL}"
EVENTOS_SMOKE_URL="${EVENTOS_SMOKE_URL:?Set EVENTOS_SMOKE_URL}"
CATERING_SMOKE_BASIC_AUTH_USER="${CATERING_SMOKE_BASIC_AUTH_USER:?Set CATERING_SMOKE_BASIC_AUTH_USER}"
CATERING_SMOKE_BASIC_AUTH_PASSWORD="${CATERING_SMOKE_BASIC_AUTH_PASSWORD:?Set CATERING_SMOKE_BASIC_AUTH_PASSWORD}"

if [[ ! "${EDGE_DEPLOY_COMMIT_SHA}" =~ ^[0-9a-fA-F]{40}$ ]]; then
  echo "EDGE_DEPLOY_COMMIT_SHA must be an exact 40-character Git commit SHA." >&2
  exit 1
fi
case "${CADDY_EMAIL}" in
  *@example.com|*@example.org|*@example.net) echo "CADDY_EMAIL must be a real production contact." >&2; exit 1 ;;
esac

for command_name in ssh scp curl; do
  command -v "${command_name}" >/dev/null 2>&1 || {
    echo "${command_name} is required for the shared-edge cutover." >&2
    exit 1
  }
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"
validate_remote_path() {
  local value="$1"
  [[ "${value}" == /opt/catering-agents-platform || "${value}" == /opt/shared-edge || "${value}" == /opt/shared-edge-rollbacks || "${value}" == /opt/catering-agents-platform-rollbacks ]] || {
    echo "Remote cutover path is outside the fixed allowlist." >&2
    exit 1
  }
  [[ "${value}" != *..* && "${value}" != *$'\n'* && "${value}" != *$'\r'* ]] || exit 1
}
validate_remote_path "${DEPLOY_PATH}"
validate_remote_path "${EDGE_DEPLOY_PATH}"
validate_remote_path "${EDGE_ROLLBACK_ROOT}"
WEB_PORTS_RELEASED=false
CUTOVER_COMPLETE=false
phase3_owner_id() {
  local pid="${BASHPID-}"
  [[ -n "${pid}" ]] || pid="$$"
  printf 'normal-caller-%s-%s-%s' "${GITHUB_RUN_ID:-local}" "${GITHUB_RUN_ATTEMPT:-1}" "${pid}"
}
PHASE3_LOCK_OWNER="${PHASE3_LOCK_OWNER:-$(phase3_owner_id)}"
PHASE3_LOCK_HELD=false
PHASE3_PLATFORM_LOCK_MODE=absent
PHASE3_EDGE_LOCK_MODE=absent

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
command -v docker >/dev/null 2>&1 || exit 1
for container_id in $(docker ps -q); do
  container_name="$(docker inspect --format '{{.Name}}' "${container_id}")"
  [[ "${container_name}" == "/shared-edge-edge-1" ]] || continue
  public_ports="$(docker inspect --format '{{json .HostConfig.PortBindings}}' "${container_id}")"
  [[ "${public_ports}" == *'80/tcp'* && "${public_ports}" == *'443/tcp'* ]] || continue
  printf '%s\n' 'historical shared-edge cutover already owns 80/443; refusing a second handoff.' >&2
  exit 1
done
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
  verify_lock_owned "${edge_lock}" "${owner_token}"
  sudo unlink "${edge_lock}/owner"; sudo rmdir "${edge_lock}"
fi
if [[ "${platform_mode}" == acquired ]]; then
  verify_lock_owned "${platform_lock}" "${owner_token}"
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

ensure_production_caddy_email() {
  {
    printf 'CADDY_EMAIL=%q\n' "${CADDY_EMAIL}"
    cat <<'REMOTE_SCRIPT'
set -euo pipefail
edge_path="$1"
[[ "${edge_path}" == /opt/shared-edge ]] || exit 1
[[ -d "${edge_path}" && ! -L "${edge_path}" ]] || exit 1
[[ "$(realpath -e -- "${edge_path}")" == "${edge_path}" ]] || exit 1
[[ "$(stat -c '%a' "${edge_path}")" == 755 ]] || exit 1
env_file="${edge_path}/.env"
test -f "$env_file"
current_count="$(grep -c '^CADDY_EMAIL=' "$env_file" || true)"
if [[ "$current_count" -gt 1 ]]; then
  echo "Protected edge .env contains duplicate CADDY_EMAIL definitions; refusing migration." >&2
  exit 1
fi
current="$(sed -n 's/^CADDY_EMAIL=//p' "$env_file" | tail -n 1)"
if [[ "$current" == "$CADDY_EMAIL" ]]; then
  echo "Protected edge .env already uses the approved production Caddy contact."
  exit 0
fi
if [[ -n "$current" && "$current" != "ops@example.com" ]]; then
  echo "Protected edge .env contains an operator-defined CADDY_EMAIL; refusing to overwrite it." >&2
  exit 1
fi
pending="${edge_path}/.env.pending.$$"
local_tmp="$(mktemp)"
cleanup() { unlink "$local_tmp" 2>/dev/null || true; sudo unlink "$pending" 2>/dev/null || true; }
trap cleanup EXIT
if [[ "$current_count" == "0" ]]; then
  cat "$env_file" >"$local_tmp"
  printf 'CADDY_EMAIL=%s\n' "$CADDY_EMAIL" >>"$local_tmp"
else
  awk -v replacement="CADDY_EMAIL=${CADDY_EMAIL}" '$0 == "CADDY_EMAIL=ops@example.com" { print replacement; next } { print }' "$env_file" >"$local_tmp"
fi
deploy_uid="$(id -u)"
deploy_gid="$(id -g)"
sudo install -o "$deploy_uid" -g "$deploy_gid" -m 0600 "$local_tmp" "$pending"
grep -Fxq "CADDY_EMAIL=${CADDY_EMAIL}" "$pending"
! grep -Fxq 'CADDY_EMAIL=ops@example.com' "$pending"
sudo mv -f "$pending" "$env_file"
pending=""
test "$(stat -c '%a %u %g' "$env_file")" = "600 ${deploy_uid} ${deploy_gid}"
echo "Protected edge .env Caddy contact migrated atomically from bootstrap placeholder."
REMOTE_SCRIPT
  } | ssh "${REMOTE}" bash -s -- "${EDGE_DEPLOY_PATH}"
}

capture_container_identities() {
  ssh "${REMOTE}" bash -s -- "${DEPLOY_PATH}" <<'REMOTE_SCRIPT'
set -euo pipefail
deploy_path="$1"
cd "${deploy_path}/platform-infra"
for service in postgres intake offer production exports; do
  cid="$(docker compose -p platform-infra -f docker-compose.yml -f docker-compose.production.yml ps -q "$service")"
  test -n "$cid"
  printf '%s=%s\n' "$service" "$(docker inspect --format '{{.Id}}' "$cid")"
done
for container in zeiterfassung-app-1 commcats-eventos-app; do
  printf '%s=%s\n' "$container" "$(docker inspect --format '{{.Id}}' "$container")"
done
REMOTE_SCRIPT
}

restore_catering_web_ports() {
  echo "Restoring direct Catering web ownership of public ports..." >&2
  ssh "${REMOTE}" bash -s -- "${EDGE_DEPLOY_PATH}" "${DEPLOY_PATH}" <<'REMOTE_SCRIPT'
set -euo pipefail
edge_path="$1"
deploy_path="$2"
if [[ -f "${edge_path}/docker-compose.yml" && -f "${edge_path}/.env" ]]; then
  cd "${edge_path}"
  docker compose -p shared-edge -f docker-compose.yml --env-file .env stop edge || true
fi
cd "${deploy_path}/platform-infra"
docker compose -p platform-infra -f docker-compose.yml -f docker-compose.production.yml \
  up -d --no-deps --force-recreate --no-build web
REMOTE_SCRIPT
}

rollback_cutover() {
  local failure_status=$?
  if [[ $# -gt 0 ]]; then failure_status="$1"; fi
  trap - ERR
  set +e
  if [[ "${WEB_PORTS_RELEASED}" == "true" && "${CUTOVER_COMPLETE}" != "true" ]]; then
    restore_catering_web_ports
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
docker network inspect zeiterfassung_default >/dev/null
REMOTE_SCRIPT

phase3_guard
trap 'phase3_release' EXIT
trap 'rollback_cutover' ERR
trap 'rollback_cutover 143' TERM
trap 'rollback_cutover 130' INT
trap 'rollback_cutover 129' HUP
phase3_recheck

ensure_production_caddy_email
phase3_recheck
IDENTITIES_BEFORE="$(capture_container_identities)"
echo "Captured pre-cutover application container identities."

echo "Re-running the proven candidate rehearsal before public handoff..."
EDGE_MODE=rehearsal \
  PHASE3_LOCK_OWNER="${PHASE3_LOCK_OWNER}" \
  DEPLOY_HOST="${DEPLOY_HOST}" \
DEPLOY_USER="${DEPLOY_USER}" \
DEPLOY_RSYNC_PATH="${DEPLOY_RSYNC_PATH}" \
EDGE_DEPLOY_PATH="${EDGE_DEPLOY_PATH}" \
EDGE_ROLLBACK_ROOT="${EDGE_ROLLBACK_ROOT}" \
EDGE_DEPLOY_COMMIT_SHA="${EDGE_DEPLOY_COMMIT_SHA}" \
CATERING_SMOKE_URL="${CATERING_SMOKE_URL}" \
CATERING_SMOKE_BASIC_AUTH_USER="${CATERING_SMOKE_BASIC_AUTH_USER}" \
CATERING_SMOKE_BASIC_AUTH_PASSWORD="${CATERING_SMOKE_BASIC_AUTH_PASSWORD}" \
ZEITERFASSUNG_SMOKE_URL="${ZEITERFASSUNG_SMOKE_URL}" \
EVENTOS_SMOKE_URL="${EVENTOS_SMOKE_URL}" \
bash "${SCRIPT_DIR}/deploy-hetzner.sh"

remote_override="/tmp/docker-compose.edge-cutover.${EDGE_DEPLOY_COMMIT_SHA}.yml"
cleanup_remote_override() {
  [[ -n "${remote_override:-}" ]] || return 0
  ssh "${REMOTE}" bash -s -- "${remote_override}" <<'REMOTE_OVERRIDE_CLEANUP' >/dev/null 2>&1 || true
set +e
unlink "$1" 2>/dev/null || true
REMOTE_OVERRIDE_CLEANUP
}
trap 'cleanup_remote_override; phase3_release' EXIT
phase3_recheck
scp "${REPO_ROOT}/platform-infra/docker-compose.edge-cutover.yml" "${REMOTE}:${remote_override}"
ssh "${REMOTE}" bash -s -- "${DEPLOY_PATH}" "${remote_override}" <<'REMOTE_SCRIPT'
set -euo pipefail
deploy_path="$1"
remote_override="$2"
sudo install -m 0644 "$remote_override" "${deploy_path}/platform-infra/docker-compose.edge-cutover.yml"
unlink "$remote_override" 2>/dev/null || true
cd "${deploy_path}/platform-infra"
docker compose -p platform-infra -f docker-compose.yml -f docker-compose.production.yml -f docker-compose.edge-cutover.yml config >/dev/null
REMOTE_SCRIPT

echo "Releasing public 80/443 only from Catering web..."
phase3_recheck
ssh "${REMOTE}" bash -s -- "${DEPLOY_PATH}" <<'REMOTE_SCRIPT'
set -euo pipefail
deploy_path="$1"
cd "${deploy_path}/platform-infra"
docker compose -p platform-infra -f docker-compose.yml -f docker-compose.production.yml -f docker-compose.edge-cutover.yml up -d --no-deps --force-recreate --no-build web
REMOTE_SCRIPT
WEB_PORTS_RELEASED=true

echo "Starting shared edge on public 80/443..."
phase3_recheck
EDGE_MODE=cutover \
  PHASE3_LOCK_OWNER="${PHASE3_LOCK_OWNER}" \
  DEPLOY_HOST="${DEPLOY_HOST}" \
DEPLOY_USER="${DEPLOY_USER}" \
DEPLOY_RSYNC_PATH="${DEPLOY_RSYNC_PATH}" \
EDGE_DEPLOY_PATH="${EDGE_DEPLOY_PATH}" \
EDGE_ROLLBACK_ROOT="${EDGE_ROLLBACK_ROOT}" \
EDGE_DEPLOY_COMMIT_SHA="${EDGE_DEPLOY_COMMIT_SHA}" \
CATERING_SMOKE_URL="${CATERING_SMOKE_URL}" \
CATERING_SMOKE_BASIC_AUTH_USER="${CATERING_SMOKE_BASIC_AUTH_USER}" \
CATERING_SMOKE_BASIC_AUTH_PASSWORD="${CATERING_SMOKE_BASIC_AUTH_PASSWORD}" \
ZEITERFASSUNG_SMOKE_URL="${ZEITERFASSUNG_SMOKE_URL}" \
EVENTOS_SMOKE_URL="${EVENTOS_SMOKE_URL}" \
bash "${SCRIPT_DIR}/deploy-hetzner.sh"

IDENTITIES_AFTER="$(capture_container_identities)"
if [[ "${IDENTITIES_AFTER}" != "${IDENTITIES_BEFORE}" ]]; then
  echo "Unrelated application container identity changed during shared-edge cutover." >&2
  diff -u <(printf '%s\n' "${IDENTITIES_BEFORE}") <(printf '%s\n' "${IDENTITIES_AFTER}") >&2 || true
  false
fi
echo "Unrelated application container identities preserved."

ssh "${REMOTE}" bash -s -- "${DEPLOY_PATH}" "${EDGE_DEPLOY_PATH}" <<'REMOTE_SCRIPT'
set -euo pipefail
deploy_path="$1"
edge_path="$2"
web_id="$(cd "${deploy_path}/platform-infra" && docker compose -p platform-infra -f docker-compose.yml -f docker-compose.production.yml -f docker-compose.edge-cutover.yml ps -q web)"
edge_id="$(cd "${edge_path}" && docker compose -p shared-edge -f docker-compose.yml --env-file .env ps -q edge)"
test -n "$web_id"
test -n "$edge_id"
web_ports="$(docker inspect --format '{{json .HostConfig.PortBindings}}' "$web_id")"
edge_ports="$(docker inspect --format '{{json .HostConfig.PortBindings}}' "$edge_id")"
if [[ "$web_ports" == *'80/tcp'* || "$web_ports" == *'443/tcp'* ]]; then echo "Catering web still owns a public edge port after cutover." >&2; exit 1; fi
if [[ "$edge_ports" != *'80/tcp'* || "$edge_ports" != *'443/tcp'* ]]; then echo "Shared edge does not own both public ports after cutover." >&2; exit 1; fi
REMOTE_SCRIPT

CUTOVER_COMPLETE=true
trap - ERR
cleanup_remote_override
echo "Shared-edge public cutover completed; public 80/443 ownership is isolated from application containers."
