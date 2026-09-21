#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CONTRACT_PATH="${REPO_ROOT}/platform-infra/catering-target-update-contract.json"
EXPECTED_TARGET_ID="catering-prod-1"
TARGET_RUNTIME_ENV="/etc/catering-target/runtime.env"
TARGET_UPDATE_LOCK="/opt/catering-target-update.lock"
BACKUP_OBSERVER="/usr/local/libexec/catering-backup-observer.py"
DEPLOY_COMMIT_SHA="${DEPLOY_COMMIT_SHA:-}"
REMOTE=""
SSH_OPTIONS=()
TARGET_ID=""
DEPLOY_PATH=""
EDGE_PATH=""
RELEASE_ROOT=""
LOCK_OWNER=""
LOCK_HELD=false
LOCAL_RELEASE_DIR=""
RUNTIME_IMAGE=""
WEB_IMAGE=""
POSTGRES_VOLUME=""
EDGE_IMAGE=""

fail() {
  printf '%s\n' "$*" >&2
  exit 1
}

contract_value() {
  python3 - "${CONTRACT_PATH}" "$1" <<'PY'
import json, sys
value = json.load(open(sys.argv[1], encoding="utf-8"))
item = value.get(sys.argv[2])
if not isinstance(item, str) or not item:
    raise SystemExit(1)
print(item)
PY
}

load_production_contract() {
  [[ -f "${CONTRACT_PATH}" && ! -L "${CONTRACT_PATH}" ]] || fail "target update contract missing"
  python3 - "${CONTRACT_PATH}" <<'PY'
import json, sys
value = json.load(open(sys.argv[1], encoding="utf-8"))
if value.get("schemaVersion") != 1:
    raise SystemExit("unsupported target update contract")
if value.get("targetId") != "catering-prod-1":
    raise SystemExit("unexpected target id")
if value.get("migrationPolicy") != {"mode": "explicit-only", "supportedCommand": None}:
    raise SystemExit("unsupported migration policy")
PY
  TARGET_ID="$(contract_value targetId)"
  DEPLOY_PATH="$(contract_value deployPath)"
  EDGE_PATH="$(contract_value edgePath)"
  RELEASE_ROOT="$(contract_value releaseRoot)"
  [[ "${TARGET_ID}" == "${EXPECTED_TARGET_ID}" ]] || fail "target identity contract mismatch"
  [[ "${DEPLOY_PATH}" == "/opt/catering-agents-platform" ]] || fail "unexpected deploy path"
  [[ "${EDGE_PATH}" == "/opt/catering-edge" ]] || fail "unexpected edge path"
  [[ "${RELEASE_ROOT}" == "/opt/catering-releases" ]] || fail "unexpected release root"
}

validate_production_inputs() {
  [[ "${DEPLOY_COMMIT_SHA}" =~ ^[0-9a-fA-F]{40}$ ]] || fail "DEPLOY_COMMIT_SHA must be an exact 40-character Git commit SHA"
  local checked_out
  checked_out="$(git -C "${REPO_ROOT}" rev-parse HEAD)"
  [[ "${checked_out}" == "${DEPLOY_COMMIT_SHA}" ]] || fail "checked out commit does not match DEPLOY_COMMIT_SHA"

  : "${CATERING_TARGET_DEPLOY_HOST:?CATERING_TARGET_DEPLOY_HOST is required}"
  : "${CATERING_TARGET_DEPLOY_USER:?CATERING_TARGET_DEPLOY_USER is required}"
  : "${CATERING_TARGET_SSH_KEY_FILE:?CATERING_TARGET_SSH_KEY_FILE is required}"
  : "${CATERING_TARGET_SSH_KNOWN_HOSTS_FILE:?CATERING_TARGET_SSH_KNOWN_HOSTS_FILE is required}"

  [[ "${CATERING_TARGET_DEPLOY_HOST}" =~ ^[A-Za-z0-9][A-Za-z0-9.:-]*$ ]] || fail "invalid target host"
  [[ "${CATERING_TARGET_DEPLOY_USER}" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || fail "invalid target user"
  [[ -f "${CATERING_TARGET_SSH_KEY_FILE}" && ! -L "${CATERING_TARGET_SSH_KEY_FILE}" ]] || fail "target SSH key file invalid"
  [[ -f "${CATERING_TARGET_SSH_KNOWN_HOSTS_FILE}" && ! -L "${CATERING_TARGET_SSH_KNOWN_HOSTS_FILE}" ]] || fail "target known-hosts file invalid"

  REMOTE="${CATERING_TARGET_DEPLOY_USER}@${CATERING_TARGET_DEPLOY_HOST}"
  SSH_OPTIONS=(
    -i "${CATERING_TARGET_SSH_KEY_FILE}"
    -o BatchMode=yes
    -o IdentitiesOnly=yes
    -o StrictHostKeyChecking=yes
    -o "UserKnownHostsFile=${CATERING_TARGET_SSH_KNOWN_HOSTS_FILE}"
    -o ConnectTimeout=10
    -p 22
  )
}

ssh_target() {
  ssh "${SSH_OPTIONS[@]}" -- "${REMOTE}" "$@"
}

local_sha256() {
  sha256sum "$1" | awk '{print $1}'
}

remote_preflight() {
  local expected_lock_owner="${1:-}"
  local platform_base_hash platform_ops_hash edge_base_hash edge_ops_hash edge_caddy_hash target_site_hash
  platform_base_hash="$(local_sha256 "${REPO_ROOT}/platform-infra/docker-compose.catering-target.json")"
  platform_ops_hash="$(local_sha256 "${REPO_ROOT}/platform-infra/docker-compose.catering-target.operations.json")"
  edge_base_hash="$(local_sha256 "${REPO_ROOT}/edge-infra/docker-compose.catering-target.json")"
  edge_ops_hash="$(local_sha256 "${REPO_ROOT}/edge-infra/docker-compose.catering-target.operations.json")"
  edge_caddy_hash="$(local_sha256 "${REPO_ROOT}/edge-infra/Caddyfile.catering-target.operations")"
  target_site_hash="$(local_sha256 "${REPO_ROOT}/platform-infra/target-sites/catering-target.caddy")"

  ssh_target bash -s --     "${TARGET_ID}" "${DEPLOY_PATH}" "${EDGE_PATH}" "${TARGET_RUNTIME_ENV}"     "${TARGET_UPDATE_LOCK}" "${BACKUP_OBSERVER}" "${expected_lock_owner}"     "${platform_base_hash}" "${platform_ops_hash}" "${edge_base_hash}" "${edge_ops_hash}"     "${edge_caddy_hash}" "${target_site_hash}" <<'REMOTE_PREFLIGHT'
set -euo pipefail
target_id="$1"; deploy_path="$2"; edge_path="$3"; runtime_env="$4"; update_lock="$5"; observer="$6"; expected_owner="$7"
platform_base_hash="$8"; platform_ops_hash="$9"; edge_base_hash="${10}"; edge_ops_hash="${11}"; edge_caddy_hash="${12}"; target_site_hash="${13}"

[[ "$(hostname -s)" == "$target_id" ]] || { echo "target hostname mismatch" >&2; exit 1; }
[[ -d "$deploy_path" && ! -L "$deploy_path" && "$(realpath -e "$deploy_path")" == "$deploy_path" ]] || exit 1
[[ -d "$edge_path" && ! -L "$edge_path" && "$(realpath -e "$edge_path")" == "$edge_path" ]] || exit 1
[[ -f "$runtime_env" && ! -L "$runtime_env" ]] || exit 1
[[ "$(stat -c '%u:%g:%a' "$runtime_env")" == "0:0:600" ]] || exit 1

platform_base="$deploy_path/platform-infra/docker-compose.catering-target.json"
platform_ops="$deploy_path/platform-infra/docker-compose.catering-target.operations.json"
edge_base="$deploy_path/edge-infra/docker-compose.catering-target.json"
edge_ops="$deploy_path/edge-infra/docker-compose.catering-target.operations.json"
edge_caddy="$edge_path/Caddyfile"
target_site="$deploy_path/platform-infra/sites/catering-target.caddy"

check_regular_hash() {
  local path="$1" expected="$2"
  [[ -f "$path" && ! -L "$path" ]] || return 1
  [[ "$(sha256sum "$path" | awk '{print $1}')" == "$expected" ]]
}
check_regular_hash "$platform_base" "$platform_base_hash"
check_regular_hash "$platform_ops" "$platform_ops_hash"
check_regular_hash "$edge_base" "$edge_base_hash"
check_regular_hash "$edge_ops" "$edge_ops_hash"
check_regular_hash "$edge_caddy" "$edge_caddy_hash"
check_regular_hash "$target_site" "$target_site_hash"

if [[ -z "$expected_owner" ]]; then
  [[ ! -e "$update_lock && ! -L "$update_lock" ]] || exit 1
else
  [[ -d "$update_lock" && ! -L "$update_lock" && "$(stat -c '%a' "$update_lock")" == "700" ]] || exit 1
  [[ -f "$update_lock/owner" && ! -L "$update_lock/owner" && "$(stat -c '%a' "$update_lock/owner")" == "600" ]] || exit 1
  grep -Fxq "owner_token=$expected_owner" "$update_lock/owner"
fi

command -v docker >/dev/null
[[ -f "$observer" && ! -L "$observer" ]] || exit 1
observer_json="$(sudo -n /usr/bin/python3 -I "$observer" --check)"
python3 - "$observer_json" <<'PY'
import json, sys
value = json.loads(sys.argv[1])
if value.get("observer_run") != "completed" or value.get("backup_health") != "healthy":
    raise SystemExit("backup observer is not healthy")
PY

sudo -n docker compose --env-file "$runtime_env" -f "$platform_base" -f "$platform_ops" config --format json >/dev/null
sudo -n docker compose --env-file "$runtime_env" -f "$edge_base" -f "$edge_ops" config --format json >/dev/null

network_names="$(sudo -n docker network ls --format '{{.Name}}' | sort)"
python3 - "$network_names" <<'PY'
import sys
actual = set(filter(None, sys.argv[1].splitlines()))
expected = {"bridge", "host", "none", "catering_private", "catering_ingress", "catering_public"}
if actual != expected:
    raise SystemExit("unexpected Docker network set")
PY

networks_of() {
  sudo -n docker inspect "$1" | python3 -c 'import json,sys; d=json.load(sys.stdin)[0]; print(",".join(sorted(d["NetworkSettings"]["Networks"].keys())))'
}
ports_of() {
  sudo -n docker inspect "$1" | python3 -c 'import json,sys; d=json.load(sys.stdin)[0]; p=d["HostConfig"].get("PortBindings") or {}; print(",".join(sorted(k+"="+",".join(str(x.get("HostPort","")) for x in (v or [])) for k,v in p.items())))'
}
image_of() {
  sudo -n docker inspect --format '{{.Image}}' "$1"
}
require_running() {
  [[ "$(sudo -n docker inspect --format '{{.State.Running}}' "$1")" == true ]]
}

for service in postgres intake offer production exports web; do
  require_running "platform-infra-${service}-1"
done
require_running "catering-edge-edge-1"

[[ "$(networks_of platform-infra-postgres-1)" == "catering_private" ]]
for service in intake offer production exports; do
  [[ "$(networks_of "platform-infra-${service}-1")" == "catering_private" ]]
done
[[ "$(networks_of platform-infra-web-1)" == "catering_ingress,catering_private" ]]
[[ "$(networks_of catering-edge-edge-1)" == "catering_ingress,catering_public" ]]

for service in postgres intake offer production exports web; do
  [[ -z "$(ports_of "platform-infra-${service}-1")" ]]
done
[[ "$(ports_of catering-edge-edge-1)" == "443/tcp=443,80/tcp=80" ]]

postgres_volume="$(sudo -n docker inspect platform-infra-postgres-1 | python3 -c 'import json,sys; d=json.load(sys.stdin)[0]; hits=[m.get("Name","") for m in d.get("Mounts",[]) if m.get("Type")=="volume" and m.get("Destination")=="/var/lib/postgresql/data"]; print(hits[0] if len(hits)==1 else "")')"
[[ -n "$postgres_volume" ]]
edge_image="$(image_of catering-edge-edge-1)"
[[ "$edge_image" =~ ^sha256:[0-9a-f]{64}$ ]]

printf 'TARGET_PREFLIGHT_OK target=%s backup=healthy postgres_volume=%s edge_image=%s\n' "$target_id" "$postgres_volume" "$edge_image"
REMOTE_PREFLIGHT
}

parse_preflight_binding() {
  local output="$1"
  POSTGRES_VOLUME="$(printf '%s\n' "$output" | sed -n 's/.* postgres_volume=\([^ ]*\).*/\1/p' | tail -n 1)"
  EDGE_IMAGE="$(printf '%s\n' "$output" | sed -n 's/.* edge_image=\([^ ]*\).*/\1/p' | tail -n 1)"
  [[ -n "${POSTGRES_VOLUME}" && "${EDGE_IMAGE}" =~ ^sha256:[0-9a-f]{64}$ ]] || fail "preflight binding output invalid"
}

run_production_preflight() {
  load_production_contract
  validate_production_inputs
  local output
  output="$(remote_preflight "")"
  parse_preflight_binding "${output}"
  printf '%s\n' "${output}"
}
