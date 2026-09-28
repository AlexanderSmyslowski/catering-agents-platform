#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPERATIONS_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
REPO_ROOT="${CATERING_TARGET_SOURCE_ROOT:-${OPERATIONS_ROOT}}"
CONTRACT_PATH="${REPO_ROOT}/platform-infra/catering-target-update-contract.json"
RUNTIME_INVENTORY_PATH="${REPO_ROOT}/platform-infra/catering-target-runtime-inventory.json"
EXPECTED_TARGET_ID="catering-prod-1"
TARGET_RUNTIME_ENV="/etc/catering-target/runtime.env"
TARGET_UPDATE_LOCK="/opt/catering-target-update.lock"
BACKUP_OBSERVER="/usr/local/libexec/catering-backup-observer.py"
DEPLOY_COMMIT_SHA="${DEPLOY_COMMIT_SHA:-}"
CATERING_TARGET_OPERATIONS_COMMIT="${CATERING_TARGET_OPERATIONS_COMMIT:-}"
CATERING_TARGET_BUNDLE_DIR="${CATERING_TARGET_BUNDLE_DIR:-}"
CATERING_TARGET_MANIFEST_SHA256="${CATERING_TARGET_MANIFEST_SHA256:-}"
CATERING_TARGET_SOURCE_SYNC_ROOT="${CATERING_TARGET_SOURCE_SYNC_ROOT:-}"
REMOTE=""
SSH_OPTIONS=()
TARGET_ID=""
DEPLOY_PATH=""
EDGE_PATH=""
RELEASE_ROOT=""
SOURCE_PLATFORM_BASE=""
SOURCE_PLATFORM_OPS=""
SOURCE_EDGE_BASE=""
SOURCE_EDGE_OPS=""
SOURCE_EDGE_CADDY=""
SOURCE_TARGET_SITE=""
PLATFORM_COMPOSE_PROJECT=""
PLATFORM_WORKING_DIR=""
RUNTIME_PLATFORM_BASE=""
RUNTIME_PLATFORM_OPS=""
RUNTIME_TARGET_SITE=""
EDGE_COMPOSE_PROJECT=""
EDGE_WORKING_DIR=""
RUNTIME_EDGE_BASE=""
RUNTIME_EDGE_OPS=""
RUNTIME_EDGE_CADDY=""
LOCK_OWNER=""
LOCK_HELD=false
LOCAL_RELEASE_DIR=""
RUNTIME_IMAGE=""
WEB_IMAGE=""
POSTGRES_VOLUME=""
EDGE_IMAGE=""
ACTIVE_RELEASE_SHA=""
PREVIOUS_RELEASE_SHA=""

fail() {
  printf '%s\n' "$*" >&2
  exit 1
}

operator_guard() {
  [[ -n "${CATERING_TARGET_OPERATIONS_COMMIT}" ]] || return 0
  [[ -f "${OPERATIONS_ROOT}/platform-infra/scripts/catering-target-operator.py" && ! -L "${OPERATIONS_ROOT}/platform-infra/scripts/catering-target-operator.py" ]] || fail "versioned Catering target operator is missing"
  local command=(python3 "${OPERATIONS_ROOT}/platform-infra/scripts/catering-target-operator.py" _gate
    --product-commit "${DEPLOY_COMMIT_SHA}"
    --operations-commit "${CATERING_TARGET_OPERATIONS_COMMIT}"
    --product-source "${REPO_ROOT}")
  if [[ -n "${CATERING_TARGET_BUNDLE_DIR}" || -n "${CATERING_TARGET_MANIFEST_SHA256}" ]]; then
    [[ -n "${CATERING_TARGET_BUNDLE_DIR}" && "${CATERING_TARGET_MANIFEST_SHA256}" =~ ^[0-9a-f]{64}$ ]] || fail "bound bundle inputs are incomplete"
    command+=(--bundle-dir "${CATERING_TARGET_BUNDLE_DIR}" --manifest-sha256 "${CATERING_TARGET_MANIFEST_SHA256}")
  fi
  "${command[@]}" >/dev/null
}

legacy_github_update_allowed() {
  [[ "${GITHUB_ACTIONS:-}" == "true" \
    && "${GITHUB_REPOSITORY:-}" == "AlexanderSmyslowski/catering-agents-platform" \
    && "${GITHUB_WORKFLOW:-}" == "Update Catering target" \
    && "${GITHUB_EVENT_NAME:-}" == "workflow_dispatch" \
    && "${GITHUB_REF:-}" == "refs/heads/main" \
    && "${GITHUB_WORKFLOW_REF:-}" == "AlexanderSmyslowski/catering-agents-platform/.github/workflows/update-catering-target.yml@refs/heads/main" \
    && "${GITHUB_WORKFLOW_SHA:-}" == "${DEPLOY_COMMIT_SHA}" ]] || return 1
  [[ -n "${GITHUB_EVENT_PATH:-}" && -f "${GITHUB_EVENT_PATH}" && ! -L "${GITHUB_EVENT_PATH}" ]] || return 1
  python3 - "${GITHUB_EVENT_PATH}" "${DEPLOY_COMMIT_SHA}" <<'PY'
import json, sys
try:
    event = json.load(open(sys.argv[1], encoding="utf-8"))
except (OSError, ValueError):
    raise SystemExit(1)
inputs = event.get("inputs")
if not isinstance(inputs, dict) or inputs.get("confirmation") != "UPDATE_CATERING_TARGET" or inputs.get("commit_sha") != sys.argv[2]:
    raise SystemExit(1)
PY
}

contract_value() {
  python3 - "${CONTRACT_PATH}" "$1" <<'PY'
import json, sys
item = json.load(open(sys.argv[1], encoding="utf-8"))
for part in sys.argv[2].split("."):
    if not isinstance(item, dict) or part not in item:
        raise SystemExit(1)
    item = item[part]
if not isinstance(item, str) or not item:
    raise SystemExit(1)
print(item)
PY
}

load_production_contract() {
  [[ -f "${CONTRACT_PATH}" && ! -L "${CONTRACT_PATH}" ]] || fail "target update contract missing"
  [[ -f "${RUNTIME_INVENTORY_PATH}" && ! -L "${RUNTIME_INVENTORY_PATH}" ]] || fail "target runtime inventory missing"
  [[ -f "${OPERATIONS_ROOT}/platform-infra/scripts/catering-target-contract.py" && ! -L "${OPERATIONS_ROOT}/platform-infra/scripts/catering-target-contract.py" ]] || fail "target contract validator missing"
  python3 "${OPERATIONS_ROOT}/platform-infra/scripts/catering-target-contract.py" "${CONTRACT_PATH}" "${RUNTIME_INVENTORY_PATH}" >/dev/null \
    || fail "target contract or inventory has invalid control values"
  TARGET_ID="$(contract_value targetId)"
  DEPLOY_PATH="$(contract_value deployPath)"
  EDGE_PATH="$(contract_value edgePath)"
  RELEASE_ROOT="$(contract_value releaseRoot)"
  SOURCE_PLATFORM_BASE="$(contract_value repositorySourcePaths.platformBase)"
  SOURCE_PLATFORM_OPS="$(contract_value repositorySourcePaths.platformOperations)"
  SOURCE_EDGE_BASE="$(contract_value repositorySourcePaths.edgeBase)"
  SOURCE_EDGE_OPS="$(contract_value repositorySourcePaths.edgeOperations)"
  SOURCE_EDGE_CADDY="$(contract_value repositorySourcePaths.edgeCaddy)"
  SOURCE_TARGET_SITE="$(contract_value repositorySourcePaths.targetSite)"
  PLATFORM_COMPOSE_PROJECT="$(contract_value installedRuntime.platform.composeProject)"
  PLATFORM_WORKING_DIR="$(contract_value installedRuntime.platform.workingDirectory)"
  RUNTIME_PLATFORM_BASE="$(contract_value installedRuntime.platform.baseCompose)"
  RUNTIME_PLATFORM_OPS="$(contract_value installedRuntime.platform.operationsCompose)"
  RUNTIME_TARGET_SITE="$(contract_value installedRuntime.platform.targetSite)"
  EDGE_COMPOSE_PROJECT="$(contract_value installedRuntime.edge.composeProject)"
  EDGE_WORKING_DIR="$(contract_value installedRuntime.edge.workingDirectory)"
  RUNTIME_EDGE_BASE="$(contract_value installedRuntime.edge.baseCompose)"
  RUNTIME_EDGE_OPS="$(contract_value installedRuntime.edge.operationsCompose)"
  RUNTIME_EDGE_CADDY="$(contract_value installedRuntime.edge.caddyfile)"
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
  if [[ "${MODE}" == "--update" || "${MODE}" == "--apply" ]]; then
    [[ -n "${CATERING_TARGET_SMOKE_BASIC_AUTH_USER:-}" ]] || fail "CATERING_TARGET_SMOKE_BASIC_AUTH_USER is required"
    [[ -n "${CATERING_TARGET_SMOKE_BASIC_AUTH_PASSWORD:-}" ]] || fail "CATERING_TARGET_SMOKE_BASIC_AUTH_PASSWORD is required"
    [[ -n "${CATERING_TARGET_SMOKE_LOGIN_CODE:-}" ]] || fail "CATERING_TARGET_SMOKE_LOGIN_CODE is required"
    [[ -n "${CATERING_TARGET_SMOKE_PIN:-}" ]] || fail "CATERING_TARGET_SMOKE_PIN is required"
  fi
  if [[ "${MODE}" == "--update" ]]; then
    if [[ -n "${CATERING_TARGET_OPERATIONS_COMMIT}" ]] || ! legacy_github_update_allowed; then
      fail "direct target mutation requires an approved operator binding"
    fi
  fi
  if [[ "${MODE}" == "--stage" || "${MODE}" == "--apply" || "${MODE}" == "--verify" ]]; then
    [[ -n "${CATERING_TARGET_OPERATIONS_COMMIT}" ]] || fail "operator commit binding is required for this phase"
    [[ -n "${CATERING_TARGET_BUNDLE_DIR}" && "${CATERING_TARGET_MANIFEST_SHA256}" =~ ^[0-9a-f]{64}$ ]] || fail "an explicitly bound bundle is required for this phase"
    if [[ "${MODE}" == "--stage" ]]; then
      [[ -n "${CATERING_TARGET_SOURCE_SYNC_ROOT}" && -d "${CATERING_TARGET_SOURCE_SYNC_ROOT}" && ! -L "${CATERING_TARGET_SOURCE_SYNC_ROOT}" ]] || fail "tracked product source export is required for staging"
    fi
  fi
  if [[ -n "${CATERING_TARGET_OPERATIONS_COMMIT}" ]]; then
    [[ "${CATERING_TARGET_OPERATIONS_COMMIT}" =~ ^[0-9a-f]{40}$ ]] || fail "operations commit must be an exact lowercase 40-character Git commit SHA"
    local operations_checkout
    operations_checkout="$(git -C "${OPERATIONS_ROOT}" rev-parse HEAD)"
    [[ "${operations_checkout}" == "${CATERING_TARGET_OPERATIONS_COMMIT}" ]] || fail "checked out operations commit does not match its binding"
    if [[ "${MODE}" != "--verify" ]]; then
      operator_guard
    fi
    if [[ "${MODE}" == "--stage" ]]; then
      python3 "${OPERATIONS_ROOT}/platform-infra/scripts/catering-target-stage-binding.py" verify-source \
        "${CATERING_TARGET_SOURCE_SYNC_ROOT}" "${CATERING_TARGET_BUNDLE_DIR}/manifest.json" "${CATERING_TARGET_MANIFEST_SHA256}" >/dev/null \
        || fail "staged product Compose bindings are invalid"
    fi
  fi
  if [[ "${MODE}" == "--apply" || "${MODE}" == "--verify" ]]; then
    CATERING_TARGET_STAGE_REQUIRED=1
    export CATERING_TARGET_STAGE_REQUIRED
  fi

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
    -o ServerAliveInterval=15
    -o ServerAliveCountMax=4
    -p 22
  )
}

ssh_target() {
  local remote_command
  remote_command="$(python3 - "$@" <<'PY'
import shlex
import sys
print(" ".join(shlex.quote(value) for value in sys.argv[1:]))
PY
)" || fail "could not safely encode the remote command"
  ssh "${SSH_OPTIONS[@]}" -- "${REMOTE}" "${remote_command}"
}

local_sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    fail "a SHA-256 utility is required"
  fi
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

remote_runtime_schema_migration_hashes() {
  ssh_target bash -s <<'REMOTE_SCHEMA_SOURCE'
set -euo pipefail
# TARGET_RUNTIME_SCHEMA_HASHES
schema_fail() {
  printf 'TARGET_PREFLIGHT_FAIL gate=%s\n' "$1" >&2
  exit 1
}
for service in intake offer production exports; do
  container="platform-infra-${service}-1"
  if ! hash="$(
    sudo -n docker exec "$container" sh -eu -c '
      source_path=/app/shared-core/src/persistence.ts
      [ -f "$source_path" ] && [ ! -L "$source_path" ]
      cat "$source_path"
    ' | python3 -c 'import hashlib,sys
source=sys.stdin.read()
start=source.find("const BUSINESS_RECORDS_SCHEMA_MIGRATION")
end=source.find("\nfunction getCachedPool", start)
if start < 0 or end < 0:
    raise SystemExit(1)
print(hashlib.sha256(source[start:end].encode("utf-8")).hexdigest())'
  )"; then
    schema_fail "runtime_schema_source_${service}"
  fi
  [[ "$hash" =~ ^[0-9a-f]{64}$ ]] || schema_fail "runtime_schema_hash_${service}"
  printf '%s=%s\n' "$service" "$hash"
done
REMOTE_SCHEMA_SOURCE
}

verify_runtime_schema_migration_unchanged() {
  local local_path="${REPO_ROOT}/shared-core/src/persistence.ts"
  [[ -f "${local_path}" && ! -L "${local_path}" ]] || fail "candidate persistence source missing"

  local candidate_hash installed_hashes expected
  candidate_hash="$(runtime_schema_migration_hash < "${local_path}")"
  [[ "${candidate_hash}" =~ ^[0-9a-f]{64}$ ]] || fail "candidate runtime schema migration hash invalid"

  if ! installed_hashes="$(remote_runtime_schema_migration_hashes)"; then
    fail "TARGET_PREFLIGHT_FAIL gate=runtime_schema_source"
  fi
  expected="$(printf 'intake=%s\noffer=%s\nproduction=%s\nexports=%s'     "${candidate_hash}" "${candidate_hash}" "${candidate_hash}" "${candidate_hash}")"
  [[ "${installed_hashes}" == "${expected}" ]] || fail "runtime schema migration drift: explicit migration approval required"
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
        if quote not in ("'", '"', "`"):
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

remote_runtime_ddl_manifest_hashes() {
  ssh_target bash -s <<'REMOTE_DDL_MANIFEST'
set -euo pipefail
# TARGET_RUNTIME_DDL_HASHES
ddl_fail() {
  printf 'TARGET_PREFLIGHT_FAIL gate=%s\n' "$1" >&2
  exit 1
}
for service in intake offer production exports; do
  container="platform-infra-${service}-1"
  if ! digest="$(
    sudo -n docker exec "$container" sh -eu -c '
      cd /app
      for root in shared-core/src intake-service/src offer-service/src production-service/src print-export/src; do
        [ -d "$root" ] && [ ! -L "$root" ]
      done
      tar -cf - shared-core/src intake-service/src offer-service/src production-service/src print-export/src
    ' | python3 -c 'import hashlib
import json
import pathlib
import re
import sys
import tarfile

ddl = re.compile(r"\b(?:CREATE|ALTER|DROP)\s+TABLE\b|\bCREATE\s+(?:UNIQUE\s+)?INDEX\b", re.I)

def literals(source):
    found = []
    i = 0
    while i < len(source):
        quote = source[i]
        if quote not in (chr(39), chr(34), chr(96)):
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
with tarfile.open(fileobj=sys.stdin.buffer, mode="r|*") as archive:
    for member in archive:
        if not member.isfile():
            continue
        name = member.name[2:] if member.name.startswith("./") else member.name
        if pathlib.PurePosixPath(name).suffix not in {".ts", ".tsx", ".js", ".mjs"}:
            continue
        handle = archive.extractfile(member)
        if handle is None:
            raise SystemExit(1)
        fragments = literals(handle.read().decode("utf-8"))
        if fragments:
            manifest[name] = fragments

canonical = json.dumps(manifest, sort_keys=True, separators=(",", ":"))
print(hashlib.sha256(canonical.encode("utf-8")).hexdigest())'
  )"; then
    ddl_fail "runtime_ddl_manifest_${service}"
  fi
  [[ "$digest" =~ ^[0-9a-f]{64}$ ]] || ddl_fail "runtime_ddl_hash_${service}"
  printf '%s=%s\n' "$service" "$digest"
done
REMOTE_DDL_MANIFEST
}

verify_runtime_ddl_unchanged() {
  local candidate_hash installed_hashes expected
  candidate_hash="$(runtime_ddl_manifest_hash "${REPO_ROOT}")"
  if ! installed_hashes="$(remote_runtime_ddl_manifest_hashes)"; then
    fail "TARGET_PREFLIGHT_FAIL gate=runtime_ddl_manifest"
  fi
  [[ "${candidate_hash}" =~ ^[0-9a-f]{64}$ ]] || fail "candidate runtime DDL manifest hash invalid"
  expected="$(printf 'intake=%s\noffer=%s\nproduction=%s\nexports=%s'     "${candidate_hash}" "${candidate_hash}" "${candidate_hash}" "${candidate_hash}")"
  [[ "${installed_hashes}" == "${expected}" ]] || fail "runtime DDL drift: explicit migration approval required"
}

remote_preflight() {
  local expected_lock_owner="${1:-}"
  local expected_release_sha="${2:-}"
  local expected_lock_owner_arg
  local operator_mode_arg="__CATERING_LEGACY__"
  local layout_release_arg="__CATERING_DISCOVER_INSTALLED__"
  local operations_commit_arg="__CATERING_LEGACY__"
  local manifest_sha_arg="__CATERING_LEGACY__"
  if [[ -z "${expected_lock_owner}" ]]; then
    expected_lock_owner_arg="__CATERING_NO_LOCK_OWNER__"
  else
    [[ "${expected_lock_owner}" != "__CATERING_NO_LOCK_OWNER__" ]] || fail "reserved target lock owner token"
    expected_lock_owner_arg="${expected_lock_owner}"
  fi
  if [[ -n "${CATERING_TARGET_OPERATIONS_COMMIT}" ]]; then
    operator_mode_arg="__CATERING_OPERATOR__"
    operations_commit_arg="${CATERING_TARGET_OPERATIONS_COMMIT}"
    manifest_sha_arg="${CATERING_TARGET_MANIFEST_SHA256:-__CATERING_LEGACY__}"
    if [[ -n "${expected_release_sha}" ]]; then
      [[ "${expected_release_sha}" =~ ^[0-9a-f]{40}$ ]] || fail "expected release binding is invalid"
      layout_release_arg="${expected_release_sha}"
    fi
  fi
  local platform_base_hash platform_ops_hash edge_base_hash edge_ops_hash edge_caddy_hash target_site_hash
  platform_base_hash="$(local_sha256 "${REPO_ROOT}/${SOURCE_PLATFORM_BASE}")"
  platform_ops_hash="$(local_sha256 "${REPO_ROOT}/${SOURCE_PLATFORM_OPS}")"
  edge_base_hash="$(local_sha256 "${REPO_ROOT}/${SOURCE_EDGE_BASE}")"
  edge_ops_hash="$(local_sha256 "${REPO_ROOT}/${SOURCE_EDGE_OPS}")"
  edge_caddy_hash="$(local_sha256 "${REPO_ROOT}/${SOURCE_EDGE_CADDY}")"
  target_site_hash="$(local_sha256 "${REPO_ROOT}/${SOURCE_TARGET_SITE}")"

  local remote_args=(
    "${TARGET_ID}" "${DEPLOY_PATH}" "${EDGE_PATH}" "${TARGET_RUNTIME_ENV}" \
    "${TARGET_UPDATE_LOCK}" "${BACKUP_OBSERVER}" "${expected_lock_owner_arg}" \
    "${PLATFORM_COMPOSE_PROJECT}" "${PLATFORM_WORKING_DIR}" "${RUNTIME_PLATFORM_BASE}" "${RUNTIME_PLATFORM_OPS}" \
    "${EDGE_COMPOSE_PROJECT}" "${EDGE_WORKING_DIR}" "${RUNTIME_EDGE_BASE}" "${RUNTIME_EDGE_OPS}" \
    "${RUNTIME_EDGE_CADDY}" "${RUNTIME_TARGET_SITE}" \
    "${platform_base_hash}" "${platform_ops_hash}" "${edge_base_hash}" "${edge_ops_hash}" \
    "${edge_caddy_hash}" "${target_site_hash}" \
    "${operator_mode_arg}" "${layout_release_arg}" "${operations_commit_arg}" "${manifest_sha_arg}" \
    "${SOURCE_PLATFORM_BASE}" "${SOURCE_PLATFORM_OPS}" "${DEPLOY_COMMIT_SHA}"
  )
  python3 -c 'from pathlib import Path; import sys
template = sys.stdin.read()
marker = "__RELEASE_STATE_PYTHON__"
helper = Path(sys.argv[1]).read_text(encoding="utf-8")
if template.count(marker) != 1:
    raise SystemExit(1)
sys.stdout.write(template.replace(marker, helper))' \
    "${OPERATIONS_ROOT}/platform-infra/scripts/catering-target-release-state.py" <<'REMOTE_PREFLIGHT' | ssh_target bash -s -- "${remote_args[@]}"
set -euo pipefail
preflight_fail() {
  printf 'TARGET_PREFLIGHT_FAIL gate=%s\n' "$1" >&2
  exit 1
}
[[ "$#" -eq 30 ]] || preflight_fail remote_argument_count
target_id="$1"; deploy_path="$2"; edge_path="$3"; runtime_env="$4"; update_lock="$5"; observer="$6"; expected_owner_arg="$7"
platform_project="$8"; platform_working_dir="$9"; platform_base="${10}"; platform_ops="${11}"
edge_project="${12}"; edge_working_dir="${13}"; edge_base="${14}"; edge_ops="${15}"; edge_caddy="${16}"; target_site="${17}"
platform_base_hash="${18}"; platform_ops_hash="${19}"; edge_base_hash="${20}"; edge_ops_hash="${21}"; edge_caddy_hash="${22}"; target_site_hash="${23}"
operator_mode="${24}"; requested_release_sha="${25}"; operations_commit="${26}"; manifest_sha="${27}"
source_platform_base="${28}"; source_platform_ops="${29}"; bound_product_sha="${30}"
release_root="/opt/catering-releases"
[[ "$operator_mode" == "__CATERING_LEGACY__" || "$operator_mode" == "__CATERING_OPERATOR__" ]] || preflight_fail operator_mode
if [[ "$expected_owner_arg" == "__CATERING_NO_LOCK_OWNER__" ]]; then
  expected_owner=""
else
  expected_owner="$expected_owner_arg"
fi

[[ "$(hostname -s)" == "$target_id" ]] || preflight_fail target_hostname
[[ -d "$deploy_path" && ! -L "$deploy_path" && "$(realpath -e "$deploy_path")" == "$deploy_path" ]] || preflight_fail deploy_path
[[ -d "$edge_path" && ! -L "$edge_path" && "$(realpath -e "$edge_path")" == "$edge_path" ]] || preflight_fail edge_path
sudo -n test -f "$runtime_env" || preflight_fail runtime_env_file
sudo -n test ! -L "$runtime_env" || preflight_fail runtime_env_symlink
[[ "$(sudo -n stat -c '%u:%g:%a' "$runtime_env")" == "0:0:600" ]] || preflight_fail runtime_env_mode

[[ "$platform_working_dir" == "$deploy_path/platform-infra" ]] || preflight_fail platform_working_dir
[[ "$edge_working_dir" == "$edge_path" ]] || preflight_fail edge_working_dir
case "$platform_base" in "$platform_working_dir/"*) ;; *) preflight_fail platform_base_path ;; esac
case "$platform_ops" in "$platform_working_dir/"*) ;; *) preflight_fail platform_ops_path ;; esac
case "$target_site" in "$platform_working_dir/sites/"*) ;; *) preflight_fail target_site_path ;; esac
case "$edge_base" in "$edge_working_dir/"*) ;; *) preflight_fail edge_base_path ;; esac
case "$edge_ops" in "$edge_working_dir/"*) ;; *) preflight_fail edge_ops_path ;; esac
case "$edge_caddy" in "$edge_working_dir/"*) ;; *) preflight_fail edge_caddy_path ;; esac

check_regular_hash() {
  local path="$1" expected="$2" gate="$3" actual
  sudo -n test -f "$path" || preflight_fail "${gate}_file"
  sudo -n test ! -L "$path" || preflight_fail "${gate}_symlink"
  [[ "$(sudo -n stat -c '%u:%g:%a' "$path")" == "0:0:644" ]] || preflight_fail "${gate}_mode"
  if ! actual="$(sudo -n sha256sum "$path" | awk '{print $1}')"; then
    preflight_fail "${gate}_hash_read"
  fi
  [[ "$actual" =~ ^[0-9a-f]{64}$ ]] || preflight_fail "${gate}_hash_read"
  [[ "$actual" == "$expected" ]] || preflight_fail "${gate}_hash"
}
check_regular_hash "$platform_base" "$platform_base_hash" platform_base
check_regular_hash "$platform_ops" "$platform_ops_hash" platform_ops
check_regular_hash "$edge_base" "$edge_base_hash" edge_base
check_regular_hash "$edge_ops" "$edge_ops_hash" edge_ops
check_regular_hash "$edge_caddy" "$edge_caddy_hash" edge_caddy
check_regular_hash "$target_site" "$target_site_hash" target_site

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
check_compose_labels() {
  local container="$1" expected_project="$2" expected_working_dir="$3" expected_files="$4" expected_service="$5" gate="$6" result
  if ! result="$(sudo -n docker inspect "$container" | python3 -c 'import json,sys
value=json.load(sys.stdin)
if len(value) != 1:
    raise SystemExit(1)
labels=(value[0].get("Config") or {}).get("Labels") or {}
checks=[
    ("project", labels.get("com.docker.compose.project"), sys.argv[1]),
    ("working_dir", labels.get("com.docker.compose.project.working_dir"), sys.argv[2]),
    ("config_files", labels.get("com.docker.compose.project.config_files"), sys.argv[3]),
    ("service", labels.get("com.docker.compose.service"), sys.argv[4]),
]
for name, actual, expected in checks:
    if actual != expected:
        print(name)
        break
else:
    print("ok")
' "$expected_project" "$expected_working_dir" "$expected_files" "$expected_service")"; then
    preflight_fail "${gate}_compose_labels_read"
  fi
  case "$result" in
    ok) ;;
    project|working_dir|config_files|service) preflight_fail "${gate}_compose_${result}" ;;
    *) preflight_fail "${gate}_compose_labels_read" ;;
  esac
}
platform_config_files="$platform_base,$platform_ops"
if [[ "$operator_mode" == "__CATERING_OPERATOR__" ]]; then
  [[ "$source_platform_base" == platform-infra/* && "$source_platform_base" != *".."* ]] || preflight_fail operator_source_path
  [[ "$source_platform_ops" == platform-infra/* && "$source_platform_ops" != *".."* ]] || preflight_fail operator_source_path
  release_binding="$(sudo -n /usr/bin/python3 -I - \
    "$release_root" "$requested_release_sha" "$source_platform_base" "$source_platform_ops" \
    "$platform_base_hash" "$platform_ops_hash" "$bound_product_sha" "$operations_commit" "$manifest_sha" <<'REMOTE_OPERATOR_RELEASE'
__RELEASE_STATE_PYTHON__
REMOTE_OPERATOR_RELEASE
  )" || preflight_fail operator_release_binding
  IFS=$'\t' read -r active_release_sha active_runtime_image active_web_image <<< "$release_binding"
  [[ "$active_release_sha" =~ ^[0-9a-f]{40}$ && "$active_runtime_image" =~ ^sha256:[0-9a-f]{64}$ && "$active_web_image" =~ ^sha256:[0-9a-f]{64}$ ]] || preflight_fail operator_release_binding
  release_dir="$release_root/$active_release_sha"
  app_working_dir="$release_dir/source/platform-infra"
  app_platform_base="$release_dir/source/$source_platform_base"
  app_platform_ops="$release_dir/source/$source_platform_ops"
  app_override="$release_dir/candidate-images.json"
  app_config_files="$app_platform_base,$app_platform_ops,$app_override"
  check_compose_labels "platform-infra-postgres-1" "$platform_project" "$platform_working_dir" "$platform_config_files" postgres "platform_postgres"
  for service in intake offer production exports web; do
    check_compose_labels "platform-infra-${service}-1" "$platform_project" "$app_working_dir" "$app_config_files" "$service" "platform_${service}"
  done
  for service in intake offer production exports; do
    [[ "$(sudo -n docker inspect --format '{{.Image}}' "platform-infra-${service}-1")" == "$active_runtime_image" ]] || preflight_fail "operator_runtime_image_${service}"
  done
  [[ "$(sudo -n docker inspect --format '{{.Image}}' platform-infra-web-1)" == "$active_web_image" ]] || preflight_fail operator_web_image
else
  for service in postgres intake offer production exports web; do
    check_compose_labels "platform-infra-${service}-1" "$platform_project" "$platform_working_dir" "$platform_config_files" "$service" "platform_${service}"
  done
fi
edge_config_files="$edge_base,$edge_ops"
check_compose_labels "catering-edge-edge-1" "$edge_project" "$edge_working_dir" "$edge_config_files" edge edge

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

if [[ "$operator_mode" == "__CATERING_OPERATOR__" ]]; then
  sudo -n docker compose --env-file "$runtime_env" -f "$app_platform_base" -f "$app_platform_ops" -f "$app_override" config --format json >/dev/null || preflight_fail platform_compose_render
else
  sudo -n docker compose --env-file "$runtime_env" -f "$platform_base" -f "$platform_ops" config --format json >/dev/null || preflight_fail platform_compose_render
fi
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

if [[ "$operator_mode" == "__CATERING_OPERATOR__" ]]; then
  printf 'TARGET_PREFLIGHT_OK target=%s backup=healthy writer=enabled schema_version=3 runtime_state=release:%s postgres_volume=%s edge_image=%s\n' "$target_id" "$active_release_sha" "$postgres_volume" "$edge_image"
else
  printf 'TARGET_PREFLIGHT_OK target=%s backup=healthy writer=enabled schema_version=3 postgres_volume=%s edge_image=%s\n' "$target_id" "$postgres_volume" "$edge_image"
fi
REMOTE_PREFLIGHT
}

parse_preflight_binding() {
  local output="$1"
  POSTGRES_VOLUME="$(printf '%s\n' "$output" | sed -n 's/.* postgres_volume=\([^ ]*\).*/\1/p' | tail -n 1)"
  EDGE_IMAGE="$(printf '%s\n' "$output" | sed -n 's/.* edge_image=\([^ ]*\).*/\1/p' | tail -n 1)"
  [[ -n "${POSTGRES_VOLUME}" && "${EDGE_IMAGE}" =~ ^sha256:[0-9a-f]{64}$ ]] || fail "preflight binding output invalid"
  if [[ -n "${CATERING_TARGET_OPERATIONS_COMMIT}" ]]; then
    ACTIVE_RELEASE_SHA="$(printf '%s\n' "${output}" | sed -n 's/.* runtime_state=release:\([0-9a-f]\{40\}\).*/\1/p' | tail -n 1)"
    [[ "${ACTIVE_RELEASE_SHA}" =~ ^[0-9a-f]{40}$ ]] || fail "operator release state output invalid"
  fi
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

verify_remote_bundle() {
  [[ -n "${CATERING_TARGET_OPERATIONS_COMMIT}" ]] || return 0
  local release_dir="${RELEASE_ROOT}/${DEPLOY_COMMIT_SHA}"
  ssh_target python3 - "${release_dir}" "${CATERING_TARGET_MANIFEST_SHA256}" "${DEPLOY_COMMIT_SHA}" "${CATERING_TARGET_OPERATIONS_COMMIT}" "${RUNTIME_IMAGE}" "${WEB_IMAGE}" <<'REMOTE_BUNDLE_VERIFY'
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys

release_dir, manifest_sha, product_commit, operations_commit, runtime_image, web_image = sys.argv[1:]
root = Path(release_dir)
if not re.fullmatch(r"/opt/catering-releases/[0-9a-f]{40}", release_dir):
    raise SystemExit("bundle release path invalid")
if not re.fullmatch(r"[0-9a-f]{64}", manifest_sha):
    raise SystemExit("bundle manifest binding invalid")
def regular(name):
    path = root / name
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or stat.S_ISLNK(info.st_mode):
        raise SystemExit("bundle artifact type invalid")
    return path
def digest(path):
    value = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()
manifest_path = regular("manifest.json")
if digest(manifest_path) != manifest_sha:
    raise SystemExit("bundle manifest digest mismatch")
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
if not isinstance(manifest, dict):
    raise SystemExit("bundle manifest binding invalid")
if (manifest.get("schemaVersion") != 2 or
        manifest.get("repository") != "AlexanderSmyslowski/catering-agents-platform" or
        manifest.get("targetId") != "catering-prod-1" or
        manifest.get("platform") != "linux/amd64" or
        manifest.get("productCommit") != product_commit or
        manifest.get("operationsCommit") != operations_commit):
    raise SystemExit("bundle commit or target binding mismatch")
images = manifest.get("images")
artifacts = manifest.get("artifacts")
if not isinstance(images, dict) or set(images) != {"runtime", "web"}:
    raise SystemExit("bundle image set invalid")
if not isinstance(artifacts, dict) or set(artifacts) != {"candidate-images.json", "runtime-image.tar.gz", "web-image.tar.gz"}:
    raise SystemExit("bundle artifact set invalid")
source_files = manifest.get("sourceFiles")
expected_source_files = {
    "platform-infra/docker-compose.catering-target.json",
    "platform-infra/docker-compose.catering-target.operations.json",
}
if not isinstance(source_files, dict) or set(source_files) != expected_source_files:
    raise SystemExit("bundle source binding invalid")
if any(not isinstance(value, str) or not re.fullmatch(r"[0-9a-f]{64}", value) for value in source_files.values()):
    raise SystemExit("bundle source binding invalid")
expected_images = {"runtime": runtime_image, "web": web_image}
expected_archives = {"runtime": "runtime-image.tar.gz", "web": "web-image.tar.gz"}
expected_services = {"runtime": ["intake", "offer", "production", "exports"], "web": ["web"]}
for name, image_id in expected_images.items():
    if not re.fullmatch(r"sha256:[0-9a-f]{64}", image_id):
        raise SystemExit("bundle image identity invalid")
    item = images[name]
    if item != {"imageId": image_id, "archive": expected_archives[name], "services": expected_services[name]}:
        raise SystemExit("bundle image binding mismatch")
    archive_path = regular(expected_archives[name])
    if artifacts.get(expected_archives[name]) != digest(archive_path):
        raise SystemExit("bundle image archive digest mismatch")
candidate_path = regular("candidate-images.json")
if artifacts.get("candidate-images.json") != digest(candidate_path):
    raise SystemExit("bundle override digest mismatch")
candidate = json.loads(candidate_path.read_text(encoding="utf-8"))
expected_candidate = {"services": {
    "intake": {"image": runtime_image},
    "offer": {"image": runtime_image},
    "production": {"image": runtime_image},
    "exports": {"image": runtime_image},
    "web": {"image": web_image},
}}
if candidate != expected_candidate:
    raise SystemExit("bundle override image mismatch")
REMOTE_BUNDLE_VERIFY
}

stage_binding_tool_sha256() {
  local tool="${OPERATIONS_ROOT}/platform-infra/scripts/catering-target-stage-binding.py"
  [[ -f "${tool}" && ! -L "${tool}" ]] || fail "versioned stage binding tool is missing"
  local digest
  digest="$(local_sha256 "${tool}")"
  [[ "${digest}" =~ ^[0-9a-f]{64}$ ]] || fail "stage binding tool digest is invalid"
  printf '%s' "${digest}"
}

write_remote_stage_receipt() {
  local release_dir="${RELEASE_ROOT}/${DEPLOY_COMMIT_SHA}"
  local tool_sha256
  tool_sha256="$(stage_binding_tool_sha256)"
  ssh_target bash -s -- "${release_dir}" "${tool_sha256}" "${CATERING_TARGET_MANIFEST_SHA256}" \
    "${DEPLOY_COMMIT_SHA}" "${CATERING_TARGET_OPERATIONS_COMMIT}" "${RUNTIME_IMAGE}" "${WEB_IMAGE}" <<'REMOTE_STAGE_RECEIPT'
set -euo pipefail
release="$1"; tool_sha="$2"; manifest_sha="$3"; product="$4"; operations="$5"; runtime="$6"; web="$7"
tool="$release/stage-binding.py"
[[ "$release" =~ ^/opt/catering-releases/[0-9a-f]{40}$ && "${release##*/}" == "$product" ]] || exit 1
[[ "$tool_sha" =~ ^[0-9a-f]{64}$ && "$manifest_sha" =~ ^[0-9a-f]{64}$ ]] || exit 1
[[ -f "$tool" && ! -L "$tool" && "$(stat -c '%u:%g:%a' "$tool")" == "0:0:644" ]] || exit 1
[[ "$(sha256sum "$tool" | awk '{print $1}')" == "$tool_sha" ]] || exit 1
sudo -n python3 "$tool" write "$release" "$manifest_sha" "$product" "$operations" "$runtime" "$web" "$tool_sha"
REMOTE_STAGE_RECEIPT
}

verify_remote_stage_receipt() {
  local release_dir="${RELEASE_ROOT}/${DEPLOY_COMMIT_SHA}"
  local tool_sha256
  tool_sha256="$(stage_binding_tool_sha256)"
  ssh_target bash -s -- "${release_dir}" "${tool_sha256}" "${CATERING_TARGET_MANIFEST_SHA256}" \
    "${DEPLOY_COMMIT_SHA}" "${CATERING_TARGET_OPERATIONS_COMMIT}" "${RUNTIME_IMAGE}" "${WEB_IMAGE}" <<'REMOTE_STAGE_VERIFY'
set -euo pipefail
release="$1"; tool_sha="$2"; manifest_sha="$3"; product="$4"; operations="$5"; runtime="$6"; web="$7"
tool="$release/stage-binding.py"
[[ "$release" =~ ^/opt/catering-releases/[0-9a-f]{40}$ && "${release##*/}" == "$product" ]] || exit 1
[[ "$tool_sha" =~ ^[0-9a-f]{64}$ && "$manifest_sha" =~ ^[0-9a-f]{64}$ ]] || exit 1
[[ -f "$tool" && ! -L "$tool" && "$(stat -c '%u:%g:%a' "$tool")" == "0:0:644" ]] || exit 1
[[ "$(sha256sum "$tool" | awk '{print $1}')" == "$tool_sha" ]] || exit 1
sudo -n python3 "$tool" verify "$release" "$manifest_sha" "$product" "$operations" "$runtime" "$web" "$tool_sha"
REMOTE_STAGE_VERIFY
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
  if [[ -n "${CATERING_TARGET_OPERATIONS_COMMIT}" ]]; then
    command -v rsync >/dev/null || fail "rsync is required for target staging"
  else
    command -v docker >/dev/null || fail "docker is required on the workflow runner"
    command -v rsync >/dev/null || fail "rsync is required on the workflow runner"
    command -v gzip >/dev/null || fail "gzip is required on the workflow runner"
  fi
  if migration_declaration_present; then
    fail "manual_migration_approval_required"
  fi

  LOCAL_RELEASE_DIR="$(mktemp -d "${RUNNER_TEMP:-/tmp}/catering-target-release.XXXXXX")"
  if [[ -n "${CATERING_TARGET_OPERATIONS_COMMIT}" ]]; then
    load_bound_image_ids
    for artifact in candidate-images.json manifest.json runtime-image.tar.gz web-image.tar.gz; do
      [[ -f "${CATERING_TARGET_BUNDLE_DIR}/${artifact}" && ! -L "${CATERING_TARGET_BUNDLE_DIR}/${artifact}" ]] || fail "bound release artifact is missing"
      cp "${CATERING_TARGET_BUNDLE_DIR}/${artifact}" "${LOCAL_RELEASE_DIR}/${artifact}"
    done
    local binding_tool="${OPERATIONS_ROOT}/platform-infra/scripts/catering-target-stage-binding.py"
    [[ -f "${binding_tool}" && ! -L "${binding_tool}" ]] || fail "versioned stage binding tool is missing"
    cp "${binding_tool}" "${LOCAL_RELEASE_DIR}/stage-binding.py"
    return 0
  fi

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

load_bound_image_ids() {
  [[ -n "${CATERING_TARGET_OPERATIONS_COMMIT}" ]] || fail "operations commit binding is required"
  local binding_command="${1:-_bundle-bindings}"
  local image_bindings
  image_bindings="$(python3 "${OPERATIONS_ROOT}/platform-infra/scripts/catering-target-operator.py" "${binding_command}" \
    --product-commit "${DEPLOY_COMMIT_SHA}" \
    --operations-commit "${CATERING_TARGET_OPERATIONS_COMMIT}" \
    --product-source "${REPO_ROOT}" \
    --bundle-dir "${CATERING_TARGET_BUNDLE_DIR}" \
    --manifest-sha256 "${CATERING_TARGET_MANIFEST_SHA256}")" || fail "bound release bundle is invalid"
  IFS=$'\t' read -r RUNTIME_IMAGE WEB_IMAGE <<< "${image_bindings}"
  [[ "${RUNTIME_IMAGE}" =~ ^sha256:[0-9a-f]{64}$ && "${WEB_IMAGE}" =~ ^sha256:[0-9a-f]{64}$ ]] || fail "bound release image identities are invalid"
}

acquire_remote_lock() {
  operator_guard
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
  local source_sync_root="${CATERING_TARGET_SOURCE_SYNC_ROOT:-${REPO_ROOT}}"
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
  rsync_rsh="$(python3 - "${CATERING_TARGET_SSH_KEY_FILE}" "${CATERING_TARGET_SSH_KNOWN_HOSTS_FILE}" <<'PY'
import shlex, sys
key_file, known_hosts_file = sys.argv[1:]
arguments = [
    "ssh", "-i", key_file,
    "-o", "BatchMode=yes",
    "-o", "IdentitiesOnly=yes",
    "-o", "StrictHostKeyChecking=yes",
    "-o", "UserKnownHostsFile=" + known_hosts_file,
    "-o", "ConnectTimeout=10",
    "-p", "22",
]
print(" ".join(shlex.quote(argument) for argument in arguments))
PY
)" || fail "could not prepare the strict rsync SSH transport"

  rsync -az --no-owner --no-group --delete     --rsync-path="sudo -n rsync"     -e "${rsync_rsh}"     --exclude=.git     --exclude=node_modules     --exclude=backoffice-ui/dist     --exclude=platform-infra/.env     --exclude=platform-infra/sites     --exclude=data     "${source_sync_root}/" "${REMOTE}:${release_dir}/source/"

  local bundle_files=("${LOCAL_RELEASE_DIR}/candidate-images.json" "${LOCAL_RELEASE_DIR}/runtime-image.tar.gz" "${LOCAL_RELEASE_DIR}/web-image.tar.gz")
  if [[ -n "${CATERING_TARGET_OPERATIONS_COMMIT}" ]]; then
    bundle_files+=("${LOCAL_RELEASE_DIR}/manifest.json" "${LOCAL_RELEASE_DIR}/stage-binding.py")
  fi
  rsync -az --no-owner --no-group     --rsync-path="sudo -n rsync"     -e "${rsync_rsh}"     "${bundle_files[@]}"     "${REMOTE}:${release_dir}/"

  ssh_target sudo -n chmod 0644     "${release_dir}/candidate-images.json"     "${release_dir}/runtime-image.tar.gz"     "${release_dir}/web-image.tar.gz"
  if [[ -n "${CATERING_TARGET_OPERATIONS_COMMIT}" ]]; then
    ssh_target sudo -n chmod 0644 "${release_dir}/manifest.json" "${release_dir}/stage-binding.py"
  fi
}

capture_previous_and_load_candidates() {
  local release_dir="${RELEASE_ROOT}/${DEPLOY_COMMIT_SHA}"
  local stage_binding_required=false
  local manifest_sha_arg="__CATERING_LEGACY__"
  local operations_commit_arg="__CATERING_LEGACY__"
  local stage_tool_sha="__CATERING_LEGACY__"
  if [[ -n "${CATERING_TARGET_OPERATIONS_COMMIT}" ]]; then
    stage_binding_required=true
    manifest_sha_arg="${CATERING_TARGET_MANIFEST_SHA256}"
    operations_commit_arg="${CATERING_TARGET_OPERATIONS_COMMIT}"
    stage_tool_sha="$(stage_binding_tool_sha256)"
    verify_remote_bundle || return 1
  fi
  ssh_target bash -s -- "${release_dir}" "${TARGET_RUNTIME_ENV}" "${RUNTIME_IMAGE}" "${WEB_IMAGE}" "${SOURCE_PLATFORM_BASE}" "${SOURCE_PLATFORM_OPS}" \
    "${stage_binding_required}" "${manifest_sha_arg}" "${DEPLOY_COMMIT_SHA}" "${operations_commit_arg}" "${stage_tool_sha}" <<'REMOTE_LOAD'
set -euo pipefail
release_dir="$1"; runtime_env="$2"; runtime_image="$3"; web_image="$4"; source_platform_base="$5"; source_platform_ops="$6"
stage_binding_required="$7"; manifest_sha="$8"; product_commit="$9"; operations_commit="${10}"; stage_tool_sha="${11}"
[[ "$release_dir" =~ ^/opt/catering-releases/[0-9a-fA-F]{40}$ ]] || exit 1
for value in "$runtime_image" "$web_image"; do [[ "$value" =~ ^sha256:[0-9a-f]{64}$ ]] || exit 1; done
if [[ "$stage_binding_required" == true ]]; then
  stage_tool="$release_dir/stage-binding.py"
  [[ "$manifest_sha" =~ ^[0-9a-f]{64}$ && "$product_commit" =~ ^[0-9a-f]{40}$ && "$operations_commit" =~ ^[0-9a-f]{40}$ && "$stage_tool_sha" =~ ^[0-9a-f]{64}$ ]] || exit 1
  [[ -f "$stage_tool" && ! -L "$stage_tool" && "$(stat -c '%u:%g:%a' "$stage_tool")" == "0:0:644" ]] || exit 1
  [[ "$(sha256sum "$stage_tool" | awk '{print $1}')" == "$stage_tool_sha" ]] || exit 1
  # TARGET_STAGE_BINDING_CAPTURE
  sudo -n python3 "$stage_tool" verify "$release_dir" "$manifest_sha" "$product_commit" "$operations_commit" "$runtime_image" "$web_image" "$stage_tool_sha"
elif [[ "$stage_binding_required" != false ]]; then
  exit 1
fi

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

[[ "$source_platform_base" == platform-infra/* && "$source_platform_base" != *".."* ]] || exit 1
[[ "$source_platform_ops" == platform-infra/* && "$source_platform_ops" != *".."* ]] || exit 1
platform_base="$release_dir/source/$source_platform_base"
platform_ops="$release_dir/source/$source_platform_ops"
sudo -n docker compose --env-file "$runtime_env" -f "$platform_base" -f "$platform_ops" -f "$release_dir/candidate-images.json" config --format json >/dev/null
REMOTE_LOAD
}


verify_remote_previous_release() {
  local release_sha="$1"
  [[ "${release_sha}" =~ ^[0-9a-f]{40}$ && "${release_sha}" == "${PREVIOUS_RELEASE_SHA}" && "${release_sha}" != "${DEPLOY_COMMIT_SHA}" ]] || return 1
  python3 -c 'from pathlib import Path; import sys
template = sys.stdin.read()
marker = "__RELEASE_STATE_PYTHON__"
helper = Path(sys.argv[1]).read_text(encoding="utf-8")
if template.count(marker) != 1:
    raise SystemExit(1)
sys.stdout.write(template.replace(marker, helper))' \
    "${OPERATIONS_ROOT}/platform-infra/scripts/catering-target-release-state.py" <<'REMOTE_ROLLBACK_RELEASE' | ssh_target sudo -n /usr/bin/python3 -I - \
    "${RELEASE_ROOT}" --rollback "${release_sha}" "${SOURCE_PLATFORM_BASE}" "${SOURCE_PLATFORM_OPS}" \
    "${DEPLOY_COMMIT_SHA}" "${CATERING_TARGET_OPERATIONS_COMMIT}"
__RELEASE_STATE_PYTHON__
REMOTE_ROLLBACK_RELEASE
}

activate_remote_override() {
  local override_path="$1"
  local release_dir="${override_path%/*}"
  local staged_candidate=false
  local stage_tool_sha256=""
  if [[ -n "${CATERING_TARGET_OPERATIONS_COMMIT}" ]]; then
    if [[ "${override_path}" == "${RELEASE_ROOT}/${DEPLOY_COMMIT_SHA}/candidate-images.json" ]]; then
      staged_candidate=true
      stage_tool_sha256="$(stage_binding_tool_sha256)"
      verify_remote_bundle || return 1
      verify_remote_stage_receipt || return 1
    elif [[ "${PREVIOUS_RELEASE_SHA}" =~ ^[0-9a-f]{40}$ && "${override_path}" == "${RELEASE_ROOT}/${PREVIOUS_RELEASE_SHA}/candidate-images.json" ]]; then
      verify_remote_previous_release "${PREVIOUS_RELEASE_SHA}" || return 1
    else
      return 1
    fi
  elif [[ "${override_path}" != "${release_dir}/candidate-images.json" && "${override_path}" != "${release_dir}/previous-images.json" ]]; then
    return 1
  fi
  ssh_target bash -s -- "${release_dir}" "${TARGET_RUNTIME_ENV}" "${override_path}" "${SOURCE_PLATFORM_BASE}" "${SOURCE_PLATFORM_OPS}" \
    "${staged_candidate}" "${CATERING_TARGET_MANIFEST_SHA256}" "${DEPLOY_COMMIT_SHA}" "${CATERING_TARGET_OPERATIONS_COMMIT}" \
    "${RUNTIME_IMAGE}" "${WEB_IMAGE}" "${stage_tool_sha256}" <<'REMOTE_ACTIVATE'
set -euo pipefail
release_dir="$1"; runtime_env="$2"; override="$3"; source_platform_base="$4"; source_platform_ops="$5"
staged_candidate="$6"; manifest_sha="$7"; product_commit="$8"; operations_commit="$9"; runtime_image="${10}"; web_image="${11}"; stage_tool_sha="${12}"
[[ "$release_dir" =~ ^/opt/catering-releases/[0-9a-fA-F]{40}$ ]] || exit 1
[[ "$override" == "$release_dir/candidate-images.json" || "$override" == "$release_dir/previous-images.json" ]] || exit 1
[[ -f "$override" && ! -L "$override" ]] || exit 1
[[ "$source_platform_base" == platform-infra/* && "$source_platform_base" != *".."* ]] || exit 1
[[ "$source_platform_ops" == platform-infra/* && "$source_platform_ops" != *".."* ]] || exit 1
platform_base="$release_dir/source/$source_platform_base"
platform_ops="$release_dir/source/$source_platform_ops"
if [[ "$staged_candidate" == true ]]; then
  stage_tool="$release_dir/stage-binding.py"
  [[ "$stage_tool_sha" =~ ^[0-9a-f]{64}$ ]] || exit 1
  [[ -f "$stage_tool" && ! -L "$stage_tool" && "$(stat -c '%u:%g:%a' "$stage_tool")" == "0:0:644" ]] || exit 1
  [[ "$(sha256sum "$stage_tool" | awk '{print $1}')" == "$stage_tool_sha" ]] || exit 1
  sudo -n python3 "$stage_tool" verify "$release_dir" "$manifest_sha" "$product_commit" "$operations_commit" "$runtime_image" "$web_image" "$stage_tool_sha"
fi
sudo -n docker compose --env-file "$runtime_env" -f "$platform_base" -f "$platform_ops" -f "$override" config --format json >/dev/null
sudo -n docker compose --env-file "$runtime_env" -f "$platform_base" -f "$platform_ops" -f "$override" up -d --no-deps intake offer production exports web
REMOTE_ACTIVATE
}

verify_remote_override_and_health() {
  local override_path="$1"
  local release_dir="${override_path%/*}"
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
  [[ -n "${CATERING_TARGET_SMOKE_BASIC_AUTH_USER:-}" ]] || return 1
  [[ -n "${CATERING_TARGET_SMOKE_BASIC_AUTH_PASSWORD:-}" ]] || return 1
  [[ -n "${CATERING_TARGET_SMOKE_LOGIN_CODE:-}" ]] || return 1
  [[ -n "${CATERING_TARGET_SMOKE_PIN:-}" ]] || return 1

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
  if [[ -n "${CATERING_TARGET_OPERATIONS_COMMIT}" ]]; then
    local smoke_script="${OPERATIONS_ROOT}/platform-infra/scripts/catering-target-operator-smoke.mjs"
    [[ -f "${smoke_script}" && ! -L "${smoke_script}" ]] || return 1
    local smoke_source
    smoke_source="$(python3 - "${smoke_script}" <<'PY'
import pathlib, sys
print(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"), end="")
PY
)" || return 1
    [[ -n "${smoke_source}" ]] || return 1
    output="$(printf '%s' "${payload}" | ssh_target sudo -n docker exec -i platform-infra-intake-1 node -e "${smoke_source}")" || return 1
  else
    output="$(printf '%s' "${payload}" | ssh_target sudo -n docker exec -i platform-infra-intake-1 node /app/platform-infra/scripts/catering-target-authenticated-smoke.mjs)" || return 1
  fi
  [[ "${output}" == "authenticated_read_smoke_ok" ]] || return 1
}

write_install_receipt() {
  local release_dir="${RELEASE_ROOT}/${DEPLOY_COMMIT_SHA}"
  local operations_arg="${CATERING_TARGET_OPERATIONS_COMMIT:-__CATERING_LEGACY__}"
  local manifest_arg="${CATERING_TARGET_MANIFEST_SHA256:-__CATERING_LEGACY__}"
  ssh_target sudo -n python3 - "${release_dir}" "${RELEASE_ROOT}/installed" "${DEPLOY_COMMIT_SHA}" "${RUNTIME_IMAGE}" "${WEB_IMAGE}" "${operations_arg}" "${manifest_arg}" <<'PY'
import datetime, os, sys, tempfile
release_dir, installed_path, commit, runtime_image, web_image, operations_commit, manifest_sha = sys.argv[1:]
if not release_dir.startswith("/opt/catering-releases/") or len(commit) != 40:
    raise SystemExit(1)
legacy_receipt = operations_commit == "__CATERING_LEGACY__" and manifest_sha == "__CATERING_LEGACY__"
if not legacy_receipt and (len(operations_commit) != 40 or len(manifest_sha) != 64):
    raise SystemExit(1)
receipt_path = os.path.join(release_dir, "install-receipt")
payload = (
    "status=installed\n"
    f"commit={commit}\n"
    f"runtime_image={runtime_image}\n"
    f"web_image={web_image}\n"
)
if not legacy_receipt:
    payload += f"operations_commit={operations_commit}\nmanifest_sha256={manifest_sha}\n"
payload += f"installed_at={datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}\n"
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
  local release_sha="${DEPLOY_COMMIT_SHA}"
  local override_path
  if [[ -n "${CATERING_TARGET_OPERATIONS_COMMIT}" ]]; then
    [[ "${PREVIOUS_RELEASE_SHA}" =~ ^[0-9a-f]{40}$ ]] || return 1
    release_sha="${PREVIOUS_RELEASE_SHA}"
    override_path="${RELEASE_ROOT}/${release_sha}/candidate-images.json"
  else
    override_path="${RELEASE_ROOT}/${release_sha}/previous-images.json"
  fi
  if ! activate_remote_override "${override_path}"; then
    return 1
  fi
  local rebound
  if ! rebound="$(remote_preflight "${LOCK_OWNER}" "${release_sha}")"; then
    return 1
  fi
  parse_preflight_binding "${rebound}"
  verify_remote_override_and_health "${override_path}"
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
  if [[ -n "${CATERING_TARGET_OPERATIONS_COMMIT}" ]]; then
    PREVIOUS_RELEASE_SHA="${ACTIVE_RELEASE_SHA}"
  fi

  prepare_remote_release
  if ! capture_previous_and_load_candidates; then
    printf '%s\n' "TARGET_UPDATE_RESULT candidate_rejected" >&2
    release_remote_lock
    return 1
  fi

  local release_dir="${RELEASE_ROOT}/${DEPLOY_COMMIT_SHA}"
  printf '%s\n' "TARGET_UPDATE_STAGE stage=target_provision status=success"
  printf '%s\n' "TARGET_UPDATE_STAGE stage=activate status=start"
  if ! activate_remote_override "${release_dir}/candidate-images.json"; then
    handle_production_failure
    return $?
  fi
  printf '%s\n' "TARGET_UPDATE_STAGE stage=activate status=success"

  local postflight
  printf '%s\n' "TARGET_UPDATE_STAGE stage=verify status=start"
  if ! postflight="$(remote_preflight "${LOCK_OWNER}" "${DEPLOY_COMMIT_SHA}")"; then
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

  if ! write_install_receipt; then
    handle_production_failure
    return $?
  fi
  printf '%s\n' "TARGET_UPDATE_STAGE stage=verify status=success"
  release_remote_lock
  printf 'TARGET_UPDATE_RESULT updated commit=%s runtime_image=%s web_image=%s\n'     "${DEPLOY_COMMIT_SHA}" "${RUNTIME_IMAGE}" "${WEB_IMAGE}"
}

run_production_stage() {
  load_production_contract
  validate_production_inputs
  [[ "${CATERING_TARGET_CONFIRMATION:-}" == "STAGE_CATERING_TARGET" ]] || fail "explicit target staging confirmation required"
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
  prepare_local_candidate
  trap production_exit_trap EXIT
  prepare_remote_release
  verify_remote_bundle
  write_remote_stage_receipt
  printf '%s\n' "TARGET_UPDATE_STAGE stage=stage status=success"
  printf 'TARGET_UPDATE_RESULT staged product=%s manifest_sha256=%s\n' "${DEPLOY_COMMIT_SHA}" "${CATERING_TARGET_MANIFEST_SHA256}"
}

run_production_apply() {
  load_production_contract
  validate_production_inputs
  [[ "${CATERING_TARGET_CONFIRMATION:-}" == "ACTIVATE_CATERING_TARGET" ]] || fail "explicit target activation confirmation required"
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
  load_bound_image_ids
  trap production_exit_trap EXIT
  acquire_remote_lock
  local locked
  locked="$(remote_preflight "${LOCK_OWNER}")"
  parse_preflight_binding "${locked}"
  PREVIOUS_RELEASE_SHA="${ACTIVE_RELEASE_SHA}"
  verify_remote_bundle
  verify_remote_stage_receipt
  if ! capture_previous_and_load_candidates; then
    printf '%s\n' "TARGET_UPDATE_RESULT candidate_rejected" >&2
    release_remote_lock
    return 1
  fi

  local release_dir="${RELEASE_ROOT}/${DEPLOY_COMMIT_SHA}"
  printf '%s\n' "TARGET_UPDATE_STAGE stage=activate status=start"
  if ! activate_remote_override "${release_dir}/candidate-images.json"; then
    handle_production_failure
    return $?
  fi
  printf '%s\n' "TARGET_UPDATE_STAGE stage=activate status=success"

  local postflight
  printf '%s\n' "TARGET_UPDATE_STAGE stage=verify status=start"
  if ! postflight="$(remote_preflight "${LOCK_OWNER}" "${DEPLOY_COMMIT_SHA}")"; then
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
  if ! write_install_receipt; then
    handle_production_failure
    return $?
  fi
  printf '%s\n' "TARGET_UPDATE_STAGE stage=verify status=success"
  release_remote_lock
  printf 'TARGET_UPDATE_RESULT activated commit=%s runtime_image=%s web_image=%s\n' "${DEPLOY_COMMIT_SHA}" "${RUNTIME_IMAGE}" "${WEB_IMAGE}"
}

verify_install_receipt() {
  local release_dir="${RELEASE_ROOT}/${DEPLOY_COMMIT_SHA}"
  ssh_target sudo -n python3 - "${release_dir}" "${RELEASE_ROOT}/installed" "${DEPLOY_COMMIT_SHA}" \
    "${CATERING_TARGET_OPERATIONS_COMMIT}" "${CATERING_TARGET_MANIFEST_SHA256}" "${RUNTIME_IMAGE}" "${WEB_IMAGE}" <<'REMOTE_INSTALL_RECEIPT_VERIFY'
from pathlib import Path
import re, stat, sys
release, installed_path, product, operations, manifest, runtime, web = sys.argv[1:]
root = Path(release)
receipt = root / "install-receipt"
info = receipt.lstat()
if not stat.S_ISREG(info.st_mode) or stat.S_ISLNK(info.st_mode) or stat.S_IMODE(info.st_mode) != 0o600 or info.st_uid != 0 or info.st_gid != 0:
    raise SystemExit("install receipt metadata invalid")
lines = receipt.read_text(encoding="ascii").splitlines()
observed = dict(line.split("=", 1) for line in lines if "=" in line)
if len(observed) != len(lines) or set(observed) != {"status", "commit", "runtime_image", "web_image", "operations_commit", "manifest_sha256", "installed_at"}:
    raise SystemExit("install receipt shape invalid")
if (observed["status"], observed["commit"], observed["runtime_image"], observed["web_image"], observed["operations_commit"], observed["manifest_sha256"]) != ("installed", product, runtime, web, operations, manifest):
    raise SystemExit("install receipt binding mismatch")
if not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", observed["installed_at"]):
    raise SystemExit("install receipt timestamp invalid")
marker = Path(installed_path)
marker_info = marker.lstat()
if not stat.S_ISREG(marker_info.st_mode) or stat.S_ISLNK(marker_info.st_mode) or marker.read_text(encoding="ascii") != product + "\n":
    raise SystemExit("installed commit marker mismatch")
REMOTE_INSTALL_RECEIPT_VERIFY
}

run_production_verify() {
  load_production_contract
  validate_production_inputs
  load_bound_image_ids _bundle-bindings-local
  local output
  if ! output="$(remote_preflight "" "${DEPLOY_COMMIT_SHA}")"; then
    fail "TARGET_PREFLIGHT_FAIL gate=remote_target_invariants"
  fi
  parse_preflight_binding "${output}"
  verify_remote_bundle
  verify_remote_stage_receipt
  verify_remote_override_and_health "${RELEASE_ROOT}/${DEPLOY_COMMIT_SHA}/candidate-images.json"
  verify_install_receipt
  printf '%s\n' "TARGET_UPDATE_VERIFY status=success"
}

case "${MODE}" in
  --preflight)
    run_production_preflight
    ;;
  --update)
    run_production_update
    ;;
  --stage)
    run_production_stage
    ;;
  --apply)
    run_production_apply
    ;;
  --verify)
    run_production_verify
    ;;
  *)
    fail "usage: catering-target-production-update.sh --preflight | --stage | --apply | --verify | --update"
    ;;
esac
