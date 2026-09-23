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

runtime_schema_migration_hash() {
  python3 -c 'import hashlib,sys
source=sys.stdin.read()
start=source.find("const BUSINESS_RECORDS_SCHEMA_MIGRATION")
end=source.find("\nfunction getCachedPool", start)
if start < 0 or end < 0:
    raise SystemExit("runtime schema migration region missing")
print(hashlib.sha256(source[start:end].encode("utf-8")).hexdigest())'
}

verify_runtime_schema_migration_unchanged() {
  local local_path="${REPO_ROOT}/shared-core/src/persistence.ts"
  [[ -f "${local_path}" && ! -L "${local_path}" ]] || fail "candidate persistence source missing"

  local candidate_hash installed_source installed_hash
  candidate_hash="$(runtime_schema_migration_hash < "${local_path}")"
  [[ "${candidate_hash}" =~ ^[0-9a-f]{64}$ ]] || fail "candidate runtime schema migration hash invalid"

  if ! installed_source="$(ssh_target bash -s -- "${DEPLOY_PATH}/shared-core/src/persistence.ts" <<'REMOTE_SCHEMA_SOURCE'
set -euo pipefail
schema_fail() {
  printf 'TARGET_PREFLIGHT_FAIL gate=%s\n' "$1" >&2
  exit 1
}
source_path="$1"
[[ "$source_path" == "/opt/catering-agents-platform/shared-core/src/persistence.ts" ]] || schema_fail runtime_schema_source_path
sudo -n test -f "$source_path" || schema_fail runtime_schema_source_file
sudo -n test ! -L "$source_path" || schema_fail runtime_schema_source_symlink
sudo -n cat "$source_path" || schema_fail runtime_schema_source_read
REMOTE_SCHEMA_SOURCE
)"; then
    fail "TARGET_PREFLIGHT_FAIL gate=runtime_schema_source"
  fi
  installed_hash="$(printf '%s' "${installed_source}" | runtime_schema_migration_hash)"
  [[ "${installed_hash}" =~ ^[0-9a-f]{64}$ ]] || fail "installed runtime schema migration hash invalid"
  [[ "${installed_hash}" == "${candidate_hash}" ]] || fail "runtime schema migration drift: explicit migration approval required"
}

runtime_ddl_manifest_hash() {
  local root="$1"
  python3 - "$root" <<'PY'
import hashlib
import json
import pathlib
import re
import sys

root = pathlib.Path(sys.argv[1])
runtime_roots = [
    "shared-core/src",
    "intake-service/src",
    "offer-service/src",
    "production-service/src",
    "print-export/src",
]
ddl = re.compile(r"\b(?:CREATE|ALTER|DROP)\s+TABLE\b|\bCREATE\s+(?:UNIQUE\s+)?INDEX\b", re.I)

def literals(source: str):
    found = []
    i = 0
    while i < len(source):
        quote = source[i]
        if quote not in "'\"\`":
            i += 1
            continue
        i += 1
        body = []
        while i < len(source):
            char = source[i]
            if char == "\\" and i + 1 < len(source):
                body.extend([char, source[i + 1]])
                i += 2
                continue
            if char == quote:
                i += 1
                break
            body.append(char)
            i += 1
        value = "".join(body).strip()
        if ddl.search(value):
            found.append(hashlib.sha256(value.encode("utf-8")).hexdigest())
    return sorted(found)

manifest = {}
for relative_root in runtime_roots:
    directory = root / relative_root
    if not directory.is_dir():
        raise SystemExit(f"runtime DDL root missing: {relative_root}")
    for path in sorted(directory.rglob("*")):
        if path.is_file() and path.suffix in {".ts", ".tsx", ".js", ".mjs"}:
            fragments = literals(path.read_text(encoding="utf-8"))
            if fragments:
                manifest[str(path.relative_to(root))] = fragments

canonical = json.dumps(manifest, sort_keys=True, separators=(",", ":"))
print(hashlib.sha256(canonical.encode("utf-8")).hexdigest())
PY
}

remote_runtime_ddl_manifest_hash() {
  ssh_target /usr/bin/python3 - "${DEPLOY_PATH}" <<'PY'
# TARGET_RUNTIME_DDL_MANIFEST
import hashlib
import json
import pathlib
import re
import sys

root = pathlib.Path(sys.argv[1])
if str(root) != "/opt/catering-agents-platform" or not root.is_dir() or root.is_symlink():
    raise SystemExit("unexpected installed source root")
runtime_roots = [
    "shared-core/src",
    "intake-service/src",
    "offer-service/src",
    "production-service/src",
    "print-export/src",
]
ddl = re.compile(r"\b(?:CREATE|ALTER|DROP)\s+TABLE\b|\bCREATE\s+(?:UNIQUE\s+)?INDEX\b", re.I)

def literals(source: str):
    found = []
    i = 0
    while i < len(source):
        quote = source[i]
        if quote not in "'\"\`":
            i += 1
            continue
        i += 1
        body = []
        while i < len(source):
            char = source[i]
            if char == "\\" and i + 1 < len(source):
                body.extend([char, source[i + 1]])
                i += 2
                continue
            if char == quote:
                i += 1
                break
            body.append(char)
            i += 1
        value = "".join(body).strip()
        if ddl.search(value):
            found.append(hashlib.sha256(value.encode("utf-8")).hexdigest())
    return sorted(found)

manifest = {}
for relative_root in runtime_roots:
    directory = root / relative_root
    if not directory.is_dir():
        raise SystemExit(f"runtime DDL root missing: {relative_root}")
    for path in sorted(directory.rglob("*")):
        if path.is_file() and path.suffix in {".ts", ".tsx", ".js", ".mjs"}:
            fragments = literals(path.read_text(encoding="utf-8"))
            if fragments:
                manifest[str(path.relative_to(root))] = fragments

canonical = json.dumps(manifest, sort_keys=True, separators=(",", ":"))
print(hashlib.sha256(canonical.encode("utf-8")).hexdigest())
PY
}

verify_runtime_ddl_unchanged() {
  local candidate_hash installed_hash
  candidate_hash="$(runtime_ddl_manifest_hash "${REPO_ROOT}")"
  if ! installed_hash="$(remote_runtime_ddl_manifest_hash)"; then
    fail "TARGET_PREFLIGHT_FAIL gate=runtime_ddl_manifest"
  fi
  [[ "${candidate_hash}" =~ ^[0-9a-f]{64}$ ]] || fail "candidate runtime DDL manifest hash invalid"
  [[ "${installed_hash}" =~ ^[0-9a-f]{64}$ ]] || fail "installed runtime DDL manifest hash invalid"
  [[ "${installed_hash}" == "${candidate_hash}" ]] || fail "runtime DDL drift: explicit migration approval required"
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
preflight_fail() {
  printf 'TARGET_PREFLIGHT_FAIL gate=%s\n' "$1" >&2
  exit 1
}
target_id="$1"; deploy_path="$2"; edge_path="$3"; runtime_env="$4"; update_lock="$5"; observer="$6"; expected_owner="$7"
platform_base_hash="$8"; platform_ops_hash="$9"; edge_base_hash="${10}"; edge_ops_hash="${11}"; edge_caddy_hash="${12}"; target_site_hash="${13}"

[[ "$(hostname -s)" == "$target_id" ]] || preflight_fail target_hostname
[[ -d "$deploy_path" && ! -L "$deploy_path" && "$(realpath -e "$deploy_path")" == "$deploy_path" ]] || preflight_fail deploy_path
[[ -d "$edge_path" && ! -L "$edge_path" && "$(realpath -e "$edge_path")" == "$edge_path" ]] || preflight_fail edge_path
[[ -f "$runtime_env" && ! -L "$runtime_env" ]] || preflight_fail runtime_env_file
[[ "$(stat -c '%u:%g:%a' "$runtime_env")" == "0:0:600" ]] || preflight_fail runtime_env_mode

platform_base="$deploy_path/platform-infra/docker-compose.catering-target.json"
platform_ops="$deploy_path/platform-infra/docker-compose.catering-target.operations.json"
edge_base="$deploy_path/edge-infra/docker-compose.catering-target.json"
edge_ops="$deploy_path/edge-infra/docker-compose.catering-target.operations.json"
edge_caddy="$edge_path/Caddyfile"
target_site="$deploy_path/platform-infra/sites/catering-target.caddy"

check_regular_hash() {
  local path="$1" expected="$2"
  sudo -n test -f "$path" || return 1
  sudo -n test ! -L "$path" || return 1
  [[ "$(sudo -n sha256sum "$path" | awk '{print $1}')" == "$expected" ]]
}
check_regular_hash "$platform_base" "$platform_base_hash" || preflight_fail platform_base_hash
check_regular_hash "$platform_ops" "$platform_ops_hash" || preflight_fail platform_ops_hash
check_regular_hash "$edge_base" "$edge_base_hash" || preflight_fail edge_base_hash
check_regular_hash "$edge_ops" "$edge_ops_hash" || preflight_fail edge_ops_hash
check_regular_hash "$edge_caddy" "$edge_caddy_hash" || preflight_fail edge_caddy_hash
check_regular_hash "$target_site" "$target_site_hash" || preflight_fail target_site_hash

if [[ -z "$expected_owner" ]]; then
  [[ ! -e "$update_lock" && ! -L "$update_lock" ]] || preflight_fail target_update_lock_absent
else
  sudo -n test -d "$update_lock" || preflight_fail target_update_lock_dir
  sudo -n test ! -L "$update_lock" || preflight_fail target_update_lock_symlink
  [[ "$(sudo -n stat -c '%a' "$update_lock")" == "700" ]] || preflight_fail target_update_lock_mode
  sudo -n test -f "$update_lock/owner" || preflight_fail target_update_lock_owner_file
  sudo -n test ! -L "$update_lock/owner" || preflight_fail target_update_lock_owner_symlink
  [[ "$(sudo -n stat -c '%a' "$update_lock/owner")" == "600" ]] || preflight_fail target_update_lock_owner_mode
  sudo -n grep -Fxq "owner_token=$expected_owner" "$update_lock/owner" || preflight_fail target_update_lock_owner
fi

command -v docker >/dev/null || preflight_fail docker_command
[[ -f "$observer" && ! -L "$observer" ]] || preflight_fail backup_observer_file
if ! observer_json="$(sudo -n /usr/bin/python3 -I "$observer" --check)"; then
  preflight_fail backup_observer_command
fi
python3 - "$observer_json" <<'PY' || preflight_fail backup_observer_health
import json, sys
value = json.loads(sys.argv[1])
if value.get("observer_run") != "completed" or value.get("backup_health") != "healthy":
    raise SystemExit(1)
PY

sudo -n docker compose --env-file "$runtime_env" -f "$platform_base" -f "$platform_ops" config --format json >/dev/null || preflight_fail platform_compose_render
sudo -n docker compose --env-file "$runtime_env" -f "$edge_base" -f "$edge_ops" config --format json >/dev/null || preflight_fail edge_compose_render

if ! network_names="$(sudo -n docker network ls --format '{{.Name}}' | sort)"; then
  preflight_fail docker_network_list
fi
python3 - "$network_names" <<'PY' || preflight_fail docker_network_set
import sys
actual = set(filter(None, sys.argv[1].splitlines()))
expected = {"bridge", "host", "none", "catering_private", "catering_ingress", "catering_public"}
if actual != expected:
    raise SystemExit(1)
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
  require_running "platform-infra-${service}-1" || preflight_fail "container_running_${service}"
done
require_running "catering-edge-edge-1" || preflight_fail container_running_edge

if ! writer_mode="$(sudo -n docker inspect catering-edge-edge-1 | python3 -c 'import json,sys; d=json.load(sys.stdin)[0]; hits=[v.split("=",1)[1] for v in d.get("Config",{}).get("Env",[]) if v.startswith("CATERING_WRITER_MODE=")]; print(hits[0] if len(hits)==1 else "")')"; then
  preflight_fail writer_mode_read
fi
[[ "$writer_mode" == "enabled" ]] || preflight_fail writer_mode

if ! schema_version="$(sudo -n docker exec platform-infra-postgres-1 psql --no-psqlrc --no-password --username=catering --dbname=catering_agents --tuples-only --no-align --command="SELECT version_number FROM catering_schema_migrations WHERE unit_name = 'catering_business_records'" | tr -d '[:space:]')"; then
  preflight_fail schema_version_read
fi
[[ "$schema_version" == "3" ]] || preflight_fail schema_version
[[ "$(networks_of platform-infra-postgres-1)" == "catering_private" ]] || preflight_fail postgres_network
for service in intake offer production exports; do
  [[ "$(networks_of "platform-infra-${service}-1")" == "catering_private" ]] || preflight_fail "app_network_${service}"
done
[[ "$(networks_of platform-infra-web-1)" == "catering_ingress,catering_private" ]] || preflight_fail web_network
[[ "$(networks_of catering-edge-edge-1)" == "catering_ingress,catering_public" ]] || preflight_fail edge_network

for service in postgres intake offer production exports web; do
  [[ -z "$(ports_of "platform-infra-${service}-1")" ]] || preflight_fail "app_ports_${service}"
done
[[ "$(ports_of catering-edge-edge-1)" == "443/tcp=443,80/tcp=80" ]] || preflight_fail edge_ports

if ! postgres_volume="$(sudo -n docker inspect platform-infra-postgres-1 | python3 -c 'import json,sys; d=json.load(sys.stdin)[0]; hits=[m.get("Name","") for m in d.get("Mounts",[]) if m.get("Type")=="volume" and m.get("Destination")=="/var/lib/postgresql/data"]; print(hits[0] if len(hits)==1 else "")')"; then
  preflight_fail postgres_volume_read
fi
[[ -n "$postgres_volume" ]] || preflight_fail postgres_volume
if ! edge_image="$(image_of catering-edge-edge-1)"; then
  preflight_fail edge_image_read
fi
[[ "$edge_image" =~ ^sha256:[0-9a-f]{64}$ ]] || preflight_fail edge_image

printf 'TARGET_PREFLIGHT_OK target=%s backup=healthy writer=enabled schema_version=3 postgres_volume=%s edge_image=%s\n' "$target_id" "$postgres_volume" "$edge_image"
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
  verify_runtime_schema_migration_unchanged
  verify_runtime_ddl_unchanged
  local output
  if ! output="$(remote_preflight "")"; then
    fail "TARGET_PREFLIGHT_FAIL gate=remote_target_invariants"
  fi
  parse_preflight_binding "${output}"
  printf '%s\n' "${output}"
}


cleanup_local_candidate() {
  if [[ -n "${LOCAL_RELEASE_DIR}" && -d "${LOCAL_RELEASE_DIR}" ]]; then
    rm -rf -- "${LOCAL_RELEASE_DIR}"
  fi
}

migration_declaration_present() {
  [[ -e "${REPO_ROOT}/platform-infra/catering-target-migration.json" || "${CATERING_TARGET_MIGRATION_REQUIRED:-0}" == "1" ]]
}

prepare_local_candidate() {
  command -v docker >/dev/null || fail "docker is required on the workflow runner"
  command -v rsync >/dev/null || fail "rsync is required on the workflow runner"
  command -v gzip >/dev/null || fail "gzip is required on the workflow runner"
  if migration_declaration_present; then
    fail "manual_migration_approval_required"
  fi

  LOCAL_RELEASE_DIR="$(mktemp -d "${RUNNER_TEMP:-/tmp}/catering-target-release.XXXXXX")"
  local runtime_tag="catering-target-runtime:${DEPLOY_COMMIT_SHA}"
  local web_tag="catering-target-web:${DEPLOY_COMMIT_SHA}"

  docker build     --iidfile "${LOCAL_RELEASE_DIR}/runtime.iid"     --tag "${runtime_tag}"     --file "${REPO_ROOT}/platform-infra/docker/Dockerfile.runtime"     "${REPO_ROOT}"
  docker build     --iidfile "${LOCAL_RELEASE_DIR}/web.iid"     --tag "${web_tag}"     --file "${REPO_ROOT}/platform-infra/docker/Dockerfile.web"     "${REPO_ROOT}"

  RUNTIME_IMAGE="$(cat "${LOCAL_RELEASE_DIR}/runtime.iid")"
  WEB_IMAGE="$(cat "${LOCAL_RELEASE_DIR}/web.iid")"
  [[ "${RUNTIME_IMAGE}" =~ ^sha256:[0-9a-f]{64}$ ]] || fail "runtime candidate is not immutable"
  [[ "${WEB_IMAGE}" =~ ^sha256:[0-9a-f]{64}$ ]] || fail "web candidate is not immutable"

  python3 - "${LOCAL_RELEASE_DIR}/candidate-images.json" "${RUNTIME_IMAGE}" "${WEB_IMAGE}" <<'PY'
import json, sys
path, runtime_image, web_image = sys.argv[1:]
value = {
    "services": {
        "intake": {"image": runtime_image},
        "offer": {"image": runtime_image},
        "production": {"image": runtime_image},
        "exports": {"image": runtime_image},
        "web": {"image": web_image},
    }
}
with open(path, "w", encoding="utf-8") as handle:
    json.dump(value, handle, indent=2, sort_keys=True)
    handle.write("\n")
PY

  docker save "${RUNTIME_IMAGE}" | gzip -1 > "${LOCAL_RELEASE_DIR}/runtime-image.tar.gz"
  docker save "${WEB_IMAGE}" | gzip -1 > "${LOCAL_RELEASE_DIR}/web-image.tar.gz"
}

acquire_remote_lock() {
  LOCK_OWNER="target-update-${GITHUB_RUN_ID:-manual}-${DEPLOY_COMMIT_SHA}"
  [[ "${LOCK_OWNER}" =~ ^[A-Za-z0-9._:-]+$ ]] || fail "invalid target lock owner"
  ssh_target bash -s -- "${TARGET_UPDATE_LOCK}" "${LOCK_OWNER}" <<'REMOTE_LOCK'
set -euo pipefail
lock="$1"; owner="$2"
[[ "$lock" == "/opt/catering-target-update.lock" ]] || exit 1
if ! sudo -n mkdir -m 0700 -- "$lock"; then
  echo "target update lock already exists" >&2
  exit 75
fi
owner_tmp="$lock/owner.pending.$$"
printf '%s\n' "owner_token=$owner" | sudo -n tee "$owner_tmp" >/dev/null
sudo -n chmod 0600 "$owner_tmp"
sudo -n mv -f -- "$owner_tmp" "$lock/owner"
sudo -n test -f "$lock/owner"
sudo -n test ! -L "$lock/owner"
[[ "$(sudo -n stat -c '%a' "$lock/owner")" == "600" ]]
sudo -n grep -Fxq "owner_token=$owner" "$lock/owner"
REMOTE_LOCK
  LOCK_HELD=true
}

release_remote_lock() {
  [[ "${LOCK_HELD}" == true ]] || return 0
  ssh_target bash -s -- "${TARGET_UPDATE_LOCK}" "${LOCK_OWNER}" <<'REMOTE_UNLOCK'
set -euo pipefail
lock="$1"; owner="$2"
sudo -n test -d "$lock" || exit 1
sudo -n test ! -L "$lock" || exit 1
[[ "$(sudo -n stat -c '%a' "$lock")" == "700" ]] || exit 1
sudo -n test -f "$lock/owner" || exit 1
sudo -n test ! -L "$lock/owner" || exit 1
[[ "$(sudo -n stat -c '%a' "$lock/owner")" == "600" ]] || exit 1
sudo -n grep -Fxq "owner_token=$owner" "$lock/owner"
sudo -n unlink "$lock/owner"
sudo -n rmdir "$lock"
REMOTE_UNLOCK
  LOCK_HELD=false
}

prepare_remote_release() {
  local release_dir="${RELEASE_ROOT}/${DEPLOY_COMMIT_SHA}"
  ssh_target bash -s -- "${RELEASE_ROOT}" "${release_dir}" <<'REMOTE_RELEASE'
set -euo pipefail
release_root="$1"; release_dir="$2"
[[ "$release_root" == "/opt/catering-releases" ]] || exit 1
[[ "$release_dir" =~ ^/opt/catering-releases/[0-9a-fA-F]{40}$ ]] || exit 1
if [[ ! -e "$release_root" ]]; then
  sudo -n mkdir -m 0755 -- "$release_root"
fi
[[ -d "$release_root" && ! -L "$release_root" && "$(realpath -e "$release_root")" == "$release_root" ]] || exit 1
[[ ! -e "$release_dir" && ! -L "$release_dir" ]] || { echo "release directory already exists" >&2; exit 1; }
sudo -n mkdir -m 0755 -- "$release_dir" "$release_dir/source"
REMOTE_RELEASE

  local rsync_rsh
  rsync_rsh="ssh -i ${CATERING_TARGET_SSH_KEY_FILE} -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=${CATERING_TARGET_SSH_KNOWN_HOSTS_FILE} -o ConnectTimeout=10 -p 22"

  rsync -az --delete     --rsync-path="sudo -n rsync"     -e "${rsync_rsh}"     --exclude=.git     --exclude=node_modules     --exclude=backoffice-ui/dist     --exclude=platform-infra/.env     --exclude=platform-infra/sites     --exclude=data     "${REPO_ROOT}/" "${REMOTE}:${release_dir}/source/"

  rsync -az     --rsync-path="sudo -n rsync"     -e "${rsync_rsh}"     "${LOCAL_RELEASE_DIR}/candidate-images.json"     "${LOCAL_RELEASE_DIR}/runtime-image.tar.gz"     "${LOCAL_RELEASE_DIR}/web-image.tar.gz"     "${REMOTE}:${release_dir}/"

  ssh_target sudo -n chmod 0644     "${release_dir}/candidate-images.json"     "${release_dir}/runtime-image.tar.gz"     "${release_dir}/web-image.tar.gz"
}

capture_previous_and_load_candidates() {
  local release_dir="${RELEASE_ROOT}/${DEPLOY_COMMIT_SHA}"
  ssh_target bash -s -- "${release_dir}" "${TARGET_RUNTIME_ENV}" "${RUNTIME_IMAGE}" "${WEB_IMAGE}" <<'REMOTE_LOAD'
set -euo pipefail
release_dir="$1"; runtime_env="$2"; runtime_image="$3"; web_image="$4"
[[ "$release_dir" =~ ^/opt/catering-releases/[0-9a-fA-F]{40}$ ]] || exit 1
for value in "$runtime_image" "$web_image"; do [[ "$value" =~ ^sha256:[0-9a-f]{64}$ ]] || exit 1; done

image_of() { sudo -n docker inspect --format '{{.Image}}' "$1"; }
intake_image="$(image_of platform-infra-intake-1)"
offer_image="$(image_of platform-infra-offer-1)"
production_image="$(image_of platform-infra-production-1)"
exports_image="$(image_of platform-infra-exports-1)"
old_web_image="$(image_of platform-infra-web-1)"
for value in "$intake_image" "$offer_image" "$production_image" "$exports_image" "$old_web_image"; do
  [[ "$value" =~ ^sha256:[0-9a-f]{64}$ ]] || exit 1
done

sudo -n python3 - "$release_dir/previous-images.json" "$intake_image" "$offer_image" "$production_image" "$exports_image" "$old_web_image" <<'PY'
import json, os, sys, tempfile
path, intake, offer, production, exports, web = sys.argv[1:]
value = {"services": {
    "intake": {"image": intake},
    "offer": {"image": offer},
    "production": {"image": production},
    "exports": {"image": exports},
    "web": {"image": web},
}}
directory = os.path.dirname(path)
fd, temporary = tempfile.mkstemp(prefix=".previous-images.", dir=directory)
try:
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        json.dump(value, handle, indent=2, sort_keys=True)
        handle.write("\n")
        handle.flush()
        os.fsync(handle.fileno())
    os.chmod(temporary, 0o600)
    os.replace(temporary, path)
finally:
    if os.path.exists(temporary):
        os.unlink(temporary)
PY

sudo -n gzip -dc "$release_dir/runtime-image.tar.gz" | sudo -n docker load >/dev/null
sudo -n gzip -dc "$release_dir/web-image.tar.gz" | sudo -n docker load >/dev/null
sudo -n docker image inspect "$runtime_image" >/dev/null
sudo -n docker image inspect "$web_image" >/dev/null

platform_base="$release_dir/source/platform-infra/docker-compose.catering-target.json"
platform_ops="$release_dir/source/platform-infra/docker-compose.catering-target.operations.json"
sudo -n docker compose --env-file "$runtime_env"   -f "$platform_base" -f "$platform_ops" -f "$release_dir/candidate-images.json"   config --format json >/dev/null
REMOTE_LOAD
}


activate_remote_override() {
  local override_path="$1"
  local release_dir="${RELEASE_ROOT}/${DEPLOY_COMMIT_SHA}"
  ssh_target bash -s -- "${release_dir}" "${TARGET_RUNTIME_ENV}" "${override_path}" <<'REMOTE_ACTIVATE'
set -euo pipefail
release_dir="$1"; runtime_env="$2"; override="$3"
[[ "$release_dir" =~ ^/opt/catering-releases/[0-9a-fA-F]{40}$ ]] || exit 1
[[ "$override" == "$release_dir/candidate-images.json" || "$override" == "$release_dir/previous-images.json" ]] || exit 1
[[ -f "$override" && ! -L "$override" ]] || exit 1
platform_base="$release_dir/source/platform-infra/docker-compose.catering-target.json"
platform_ops="$release_dir/source/platform-infra/docker-compose.catering-target.operations.json"
sudo -n docker compose --env-file "$runtime_env"   -f "$platform_base" -f "$platform_ops" -f "$override"   up -d --no-deps intake offer production exports web
REMOTE_ACTIVATE
}

verify_remote_override_and_health() {
  local override_path="$1"
  local release_dir="${RELEASE_ROOT}/${DEPLOY_COMMIT_SHA}"
  ssh_target bash -s -- "${release_dir}" "${override_path}" "${POSTGRES_VOLUME}" "${EDGE_IMAGE}" <<'REMOTE_VERIFY'
set -euo pipefail
release_dir="$1"; override="$2"; expected_postgres_volume="$3"; expected_edge_image="$4"
[[ "$release_dir" =~ ^/opt/catering-releases/[0-9a-fA-F]{40}$ ]] || exit 1
[[ "$override" == "$release_dir/candidate-images.json" || "$override" == "$release_dir/previous-images.json" ]] || exit 1
[[ -f "$override" && ! -L "$override" ]] || exit 1

expected_images="$(sudo -n cat "$override")"
python3 - "$expected_images" <<'PY'
import json, re, sys
value = json.loads(sys.argv[1])
if set(value) != {"services"}:
    raise SystemExit(1)
if set(value["services"]) != {"intake", "offer", "production", "exports", "web"}:
    raise SystemExit(1)
for item in value["services"].values():
    if set(item) != {"image"} or not re.fullmatch(r"sha256:[0-9a-f]{64}", item["image"]):
        raise SystemExit(1)
PY

for service in intake offer production exports web; do
  expected="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["services"][sys.argv[2]]["image"])' "$expected_images" "$service")"
  actual="$(sudo -n docker inspect --format '{{.Image}}' "platform-infra-${service}-1")"
  [[ "$actual" == "$expected" ]] || exit 1
  [[ "$(sudo -n docker inspect --format '{{.State.Running}}' "platform-infra-${service}-1")" == true ]] || exit 1
done

actual_postgres_volume="$(sudo -n docker inspect platform-infra-postgres-1 | python3 -c 'import json,sys; d=json.load(sys.stdin)[0]; hits=[m.get("Name","") for m in d.get("Mounts",[]) if m.get("Type")=="volume" and m.get("Destination")=="/var/lib/postgresql/data"]; print(hits[0] if len(hits)==1 else "")')"
[[ "$actual_postgres_volume" == "$expected_postgres_volume" ]]
[[ "$(sudo -n docker inspect --format '{{.Image}}' catering-edge-edge-1)" == "$expected_edge_image" ]]

check_health() {
  local container="$1" url="$2" attempt
  for attempt in $(seq 1 20); do
    if sudo -n docker exec "$container" node -e 'const u=process.argv[1]; fetch(u).then(async r=>{const t=await r.text(); if(!r.ok || !/"status"\s*:\s*"ok"/.test(t)) process.exit(1)}).catch(()=>process.exit(1))' "$url"; then
      return 0
    fi
    sleep 2
  done
  return 1
}
check_health platform-infra-intake-1 http://127.0.0.1:3101/health
check_health platform-infra-offer-1 http://127.0.0.1:3102/health
check_health platform-infra-production-1 http://127.0.0.1:3103/health
check_health platform-infra-exports-1 http://127.0.0.1:3104/health
REMOTE_VERIFY
}

authenticated_read_smoke() {
  : "${CATERING_TARGET_SMOKE_BASIC_AUTH_USER:?CATERING_TARGET_SMOKE_BASIC_AUTH_USER is required}"
  : "${CATERING_TARGET_SMOKE_BASIC_AUTH_PASSWORD:?CATERING_TARGET_SMOKE_BASIC_AUTH_PASSWORD is required}"
  : "${CATERING_TARGET_SMOKE_LOGIN_CODE:?CATERING_TARGET_SMOKE_LOGIN_CODE is required}"
  : "${CATERING_TARGET_SMOKE_PIN:?CATERING_TARGET_SMOKE_PIN is required}"

  local payload output
  payload="$(python3 - <<'PY'
import json, os
print(json.dumps({
    "basicUser": os.environ["CATERING_TARGET_SMOKE_BASIC_AUTH_USER"],
    "basicPassword": os.environ["CATERING_TARGET_SMOKE_BASIC_AUTH_PASSWORD"],
    "loginCode": os.environ["CATERING_TARGET_SMOKE_LOGIN_CODE"],
    "pin": os.environ["CATERING_TARGET_SMOKE_PIN"],
}, separators=(",", ":")))
PY
)"
  output="$(printf '%s' "${payload}" | ssh_target sudo -n docker exec -i     platform-infra-intake-1 node /app/platform-infra/scripts/catering-target-authenticated-smoke.mjs)"
  [[ "${output}" == "authenticated_read_smoke_ok" ]] || return 1
}

write_install_receipt() {
  local release_dir="${RELEASE_ROOT}/${DEPLOY_COMMIT_SHA}"
  ssh_target sudo -n python3 - "${release_dir}" "${RELEASE_ROOT}/installed" "${DEPLOY_COMMIT_SHA}" "${RUNTIME_IMAGE}" "${WEB_IMAGE}" <<'PY'
import datetime, os, sys, tempfile
release_dir, installed_path, commit, runtime_image, web_image = sys.argv[1:]
if not release_dir.startswith("/opt/catering-releases/") or len(commit) != 40:
    raise SystemExit(1)
receipt_path = os.path.join(release_dir, "install-receipt")
payload = (
    "status=installed\n"
    f"commit={commit}\n"
    f"runtime_image={runtime_image}\n"
    f"web_image={web_image}\n"
    f"installed_at={datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}\n"
)
def atomic(path, data, mode):
    directory = os.path.dirname(path)
    fd, temp = tempfile.mkstemp(prefix=".target-update.", dir=directory)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temp, mode)
        os.replace(temp, path)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)
atomic(receipt_path, payload, 0o600)
atomic(installed_path, commit + "\n", 0o644)
PY
}

rollback_remote_application() {
  local release_dir="${RELEASE_ROOT}/${DEPLOY_COMMIT_SHA}"
  if ! activate_remote_override "${release_dir}/previous-images.json"; then
    return 1
  fi
  local rebound
  if ! rebound="$(remote_preflight "${LOCK_OWNER}")"; then
    return 1
  fi
  parse_preflight_binding "${rebound}"
  verify_remote_override_and_health "${release_dir}/previous-images.json"
}

handle_production_failure() {
  if rollback_remote_application; then
    printf '%s\n' "TARGET_UPDATE_RESULT rolled_back"
    release_remote_lock
    return 1
  fi
  printf '%s\n' "TARGET_UPDATE_RESULT manual_recovery_required lock_retained=true" >&2
  return 1
}

production_exit_trap() {
  local status=$?
  trap - EXIT
  cleanup_local_candidate
  if [[ "${LOCK_HELD}" == true ]]; then
    printf '%s\n' "TARGET_UPDATE_RESULT manual_recovery_required lock_retained=true" >&2
  fi
  exit "${status}"
}

run_production_update() {
  load_production_contract
  validate_production_inputs
  [[ "${CATERING_TARGET_CONFIRMATION:-}" == "UPDATE_CATERING_TARGET" ]] || fail "explicit target update confirmation required"
  if migration_declaration_present; then
    fail "manual_migration_approval_required"
  fi
  verify_runtime_schema_migration_unchanged
  verify_runtime_ddl_unchanged

  local initial
  if ! initial="$(remote_preflight "")"; then
    fail "TARGET_PREFLIGHT_FAIL gate=remote_target_invariants"
  fi
  parse_preflight_binding "${initial}"
  printf '%s\n' "${initial}"

  prepare_local_candidate
  trap production_exit_trap EXIT

  acquire_remote_lock
  local locked
  locked="$(remote_preflight "${LOCK_OWNER}")"
  parse_preflight_binding "${locked}"

  prepare_remote_release
  if ! capture_previous_and_load_candidates; then
    printf '%s\n' "TARGET_UPDATE_RESULT candidate_rejected" >&2
    release_remote_lock
    return 1
  fi

  local release_dir="${RELEASE_ROOT}/${DEPLOY_COMMIT_SHA}"
  if ! activate_remote_override "${release_dir}/candidate-images.json"; then
    handle_production_failure
    return $?
  fi

  local postflight
  if ! postflight="$(remote_preflight "${LOCK_OWNER}")"; then
    handle_production_failure
    return $?
  fi
  parse_preflight_binding "${postflight}"
  if ! verify_remote_override_and_health "${release_dir}/candidate-images.json"; then
    handle_production_failure
    return $?
  fi
  if ! authenticated_read_smoke; then
    handle_production_failure
    return $?
  fi

  write_install_receipt
  release_remote_lock
  printf 'TARGET_UPDATE_RESULT updated commit=%s runtime_image=%s web_image=%s\n'     "${DEPLOY_COMMIT_SHA}" "${RUNTIME_IMAGE}" "${WEB_IMAGE}"
}

case "${MODE}" in
  --preflight)
    run_production_preflight
    ;;
  --update)
    run_production_update
    ;;
  *)
    fail "usage: catering-target-production-update.sh --preflight | --update"
    ;;
esac
