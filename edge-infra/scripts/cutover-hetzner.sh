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
WEB_PORTS_RELEASED=false
CUTOVER_COMPLETE=false

ensure_production_caddy_email() {
  {
    printf 'CADDY_EMAIL=%q\n' "${CADDY_EMAIL}"
    cat <<'REMOTE_SCRIPT'
set -euo pipefail
edge_path="$1"
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
cleanup() { rm -f "$local_tmp"; sudo rm -f "$pending"; }
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
  trap - ERR
  set +e
  if [[ "${WEB_PORTS_RELEASED}" == "true" && "${CUTOVER_COMPLETE}" != "true" ]]; then
    restore_catering_web_ports
  fi
  exit "${failure_status}"
}
trap 'rollback_cutover' ERR

ssh "${REMOTE}" bash -s -- "${DEPLOY_PATH}" <<'REMOTE_SCRIPT'
set -euo pipefail
deploy_path="$1"
test -f "${deploy_path}/platform-infra/.env"
test -f "${deploy_path}/platform-infra/docker-compose.yml"
test -f "${deploy_path}/platform-infra/docker-compose.production.yml"
docker network inspect platform-infra_default >/dev/null
docker network inspect zeiterfassung_default >/dev/null
REMOTE_SCRIPT

ensure_production_caddy_email
IDENTITIES_BEFORE="$(capture_container_identities)"
echo "Captured pre-cutover application container identities."

echo "Re-running the proven candidate rehearsal before public handoff..."
EDGE_MODE=rehearsal \
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
scp "${REPO_ROOT}/platform-infra/docker-compose.edge-cutover.yml" "${REMOTE}:${remote_override}"
ssh "${REMOTE}" bash -s -- "${DEPLOY_PATH}" "${remote_override}" <<'REMOTE_SCRIPT'
set -euo pipefail
deploy_path="$1"
remote_override="$2"
sudo install -m 0644 "$remote_override" "${deploy_path}/platform-infra/docker-compose.edge-cutover.yml"
rm -f "$remote_override"
cd "${deploy_path}/platform-infra"
docker compose -p platform-infra -f docker-compose.yml -f docker-compose.production.yml -f docker-compose.edge-cutover.yml config >/dev/null
REMOTE_SCRIPT

echo "Releasing public 80/443 only from Catering web..."
ssh "${REMOTE}" bash -s -- "${DEPLOY_PATH}" <<'REMOTE_SCRIPT'
set -euo pipefail
deploy_path="$1"
cd "${deploy_path}/platform-infra"
docker compose -p platform-infra -f docker-compose.yml -f docker-compose.production.yml -f docker-compose.edge-cutover.yml up -d --no-deps --force-recreate --no-build web
REMOTE_SCRIPT
WEB_PORTS_RELEASED=true

echo "Starting shared edge on public 80/443..."
EDGE_MODE=cutover \
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
echo "Shared-edge public cutover completed; public 80/443 ownership is isolated from application containers."
