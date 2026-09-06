#!/usr/bin/env bash
set -euo pipefail
umask 077

# RTO covers the complete probe process, including all preflight and trust
# checks.  Capture the clock before any candidate, repository, or restore-root
# work so a slow preflight cannot be omitted from the four-hour budget.
started_epoch="$(date -u +%s)"

readonly BACKUP_SCOPE="postgres,sites,platform-caddy,shared-edge-caddy"
readonly RTO_SECONDS="14400"
readonly RPO_SECONDS="21600"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
# shellcheck source=platform-infra/backup/catering-backup-common.sh
source "$SCRIPT_DIR/catering-backup-common.sh"
readonly DOCKER_CMD="${CATERING_DOCKER_COMMAND:-docker}"
readonly EXPECTED_UID="${CATERING_BACKUP_EXPECTED_UID:-0}"
readonly RESTORE_RUNTIME_ROOT="${CATERING_RESTORE_RUNTIME_ROOT:-/run/catering-backup}"

: "${CATERING_BACKUP_EXPECTED_HOST_SHA256:?CATERING_BACKUP_EXPECTED_HOST_SHA256 is required}"
: "${CATERING_BACKUP_SOURCE_COMMIT:?CATERING_BACKUP_SOURCE_COMMIT is required}"
: "${CATERING_BACKUP_SOURCE_TREE:?CATERING_BACKUP_SOURCE_TREE is required}"
: "${CATERING_BACKUP_REPOSITORY_FILE:?CATERING_BACKUP_REPOSITORY_FILE is required}"
: "${CATERING_BACKUP_PASSWORD_FILE:?CATERING_BACKUP_PASSWORD_FILE is required}"
: "${CATERING_BACKUP_EXPECTED_REPOSITORY_SHA256:?CATERING_BACKUP_EXPECTED_REPOSITORY_SHA256 is required}"
: "${CATERING_BACKUP_PRODUCTION_HOST_SHA256:?CATERING_BACKUP_PRODUCTION_HOST_SHA256 is required}"
: "${CATERING_BACKUP_PRODUCTION_ADDRESSES_SHA256:?CATERING_BACKUP_PRODUCTION_ADDRESSES_SHA256 is required}"
: "${CATERING_OFFHOST_ATTESTATION_FILE:?CATERING_OFFHOST_ATTESTATION_FILE is required}"
: "${CATERING_OFFHOST_ATTESTATION_SHA256:?CATERING_OFFHOST_ATTESTATION_SHA256 is required}"
: "${CATERING_SECRET_RECOVERY_ATTESTATION_FILE:?CATERING_SECRET_RECOVERY_ATTESTATION_FILE is required}"
: "${CATERING_SECRET_RECOVERY_ATTESTATION_SHA256:?CATERING_SECRET_RECOVERY_ATTESTATION_SHA256 is required}"
: "${CATERING_RESTORE_POSTGRES_IMAGE:?CATERING_RESTORE_POSTGRES_IMAGE is required}"
: "${CATERING_SECRET_RECOVERY_REFERENCE_SHA256:?CATERING_SECRET_RECOVERY_REFERENCE_SHA256 is required}"
: "${CATERING_REQUIRED_SECRET_SCHEMA_SHA256:?CATERING_REQUIRED_SECRET_SCHEMA_SHA256 is required}"
: "${CATERING_SECRET_RECOVERY_SOURCE_TYPE:?CATERING_SECRET_RECOVERY_SOURCE_TYPE is required}"
: "${CATERING_SECRET_RECOVERY_SOURCE_REFERENCE:?CATERING_SECRET_RECOVERY_SOURCE_REFERENCE is required}"

if [[ "${CATERING_BACKUP_TEST_MODE:-0}" != 1 ]]; then
  [[ "$(id -u)" == 0 && "$EXPECTED_UID" == 0 ]] || fail_state PRIVILEGE_INVALID
fi

require_digest "$CATERING_BACKUP_EXPECTED_HOST_SHA256" || fail_state HOST_BINDING_INVALID
require_digest "$CATERING_BACKUP_EXPECTED_REPOSITORY_SHA256" || fail_state REPOSITORY_BINDING_INVALID
require_digest "$CATERING_BACKUP_PRODUCTION_HOST_SHA256" || fail_state PRODUCTION_HOST_INVALID
require_digest "$CATERING_BACKUP_PRODUCTION_ADDRESSES_SHA256" || fail_state PRODUCTION_ADDRESSES_INVALID
require_commit "$CATERING_BACKUP_SOURCE_COMMIT" || fail_state SOURCE_COMMIT_INVALID
[[ "$CATERING_BACKUP_SOURCE_TREE" =~ ^[0-9a-f]{40}$ ]] || fail_state SOURCE_TREE_INVALID
require_digest "$CATERING_SECRET_RECOVERY_REFERENCE_SHA256" || fail_state SECRET_REFERENCE_INVALID
require_digest "$CATERING_REQUIRED_SECRET_SCHEMA_SHA256" || fail_state SECRET_SCHEMA_INVALID
[[ "$CATERING_RESTORE_POSTGRES_IMAGE" =~ ^[^[:space:]@]+@sha256:[0-9a-f]{64}$ ]] || fail_state POSTGRES_IMAGE_INVALID

assert_off_host_repository() { validate_offhost_repository "${1-}"; }
repository_value="$(read_secure_single_line "$CATERING_BACKUP_REPOSITORY_FILE")" || fail_state REPOSITORY_READ_FAILED
assert_off_host_repository "$repository_value" || fail_state REPOSITORY_INVALID
repository_locator_digest="$(printf '%s' "$repository_value" | sha256sum | awk '{print $1}')"
[[ "$repository_locator_digest" == "$CATERING_BACKUP_EXPECTED_REPOSITORY_SHA256" ]] || fail_state REPOSITORY_BINDING_MISMATCH
restic_cmd() { secure_restic "$@" 2>/dev/null; }
secure_restic_init_generation "$CATERING_BACKUP_REPOSITORY_FILE" "$CATERING_BACKUP_PASSWORD_FILE" || fail_state REPOSITORY_READ_FAILED

host_name="$(hostname -s)"
host_digest="$(printf '%s' "$host_name" | sha256sum | awk '{print $1}')"
[[ "$host_digest" == "$CATERING_BACKUP_EXPECTED_HOST_SHA256" && "$host_digest" == "$CATERING_BACKUP_PRODUCTION_HOST_SHA256" ]] || fail_state HOST_BINDING_MISMATCH
assert_directory_mode "$BACKUP_ROOT" || fail_state STATE_ROOT_INVALID

validate_restore_attestations() {
  local current_locator current_digest
  current_locator="$(read_secure_single_line "$CATERING_BACKUP_REPOSITORY_FILE")" || { fail_state REPOSITORY_READ_FAILED; return 1; }
  [[ "$current_locator" == "$repository_value" ]] || { fail_state REPOSITORY_PATH_CHANGED; return 1; }
  current_digest="$(printf '%s' "$current_locator" | sha256sum | awk '{print $1}')"
  [[ "$current_digest" == "$CATERING_BACKUP_EXPECTED_REPOSITORY_SHA256" ]] || { fail_state REPOSITORY_BINDING_MISMATCH; return 1; }
  CATERING_BACKUP_REPOSITORY_VALUE="$current_locator" validate_operator_attestations "$repository_identity" "$host_digest" "$current_digest" "" "$CATERING_BACKUP_PRODUCTION_HOST_SHA256" "" "" 18000 || return 1
}

prepare_restore_runtime_root() {
  python3 - "$RESTORE_RUNTIME_ROOT" "$EXPECTED_UID" <<'PY'
import os, stat, sys
root, uid = os.path.abspath(sys.argv[1]), int(sys.argv[2])
if root in ("/", "") or not root.startswith("/"):
    raise SystemExit(1)
parts = root.strip("/").split("/")
cursor = "/"
for part in parts[:-1]:
    cursor = os.path.join(cursor, part)
    info = os.lstat(cursor)
    if stat.S_ISLNK(info.st_mode) or not stat.S_ISDIR(info.st_mode):
        raise SystemExit(1)
try:
    info = os.lstat(root)
except FileNotFoundError:
    os.mkdir(root, 0o700)
    info = os.lstat(root)
if stat.S_ISLNK(info.st_mode) or not stat.S_ISDIR(info.st_mode) or info.st_uid != uid or stat.S_IMODE(info.st_mode) != 0o700:
    raise SystemExit(1)
PY
}
if [[ "$EXPECTED_UID" == 0 && "$RESTORE_RUNTIME_ROOT" != /run/catering-backup ]]; then
  fail_state RESTORE_RUNTIME_ROOT_INVALID
fi
prepare_restore_runtime_root || fail_state RESTORE_RUNTIME_ROOT_INVALID

assert_no_stale_restore_state() {
  local stale_rc stale_probe
  if python3 - "$RESTORE_RUNTIME_ROOT" <<'PY'
import os, sys
root = os.path.abspath(sys.argv[1])
try:
    names = os.listdir(root)
except OSError:
    raise SystemExit(1)
if any(name.startswith('.restore-') for name in names):
    raise SystemExit(2)
PY
  then stale_rc=0; else stale_rc=$?; fi
  case "$stale_rc" in
    0) ;;
    2) fail_state RESTORE_STALE_ARTIFACT; return 1 ;;
    *) fail_state RESTORE_RUNTIME_ROOT_INVALID; return 1 ;;
  esac
  stale_probe="$($DOCKER_CMD ps -a --filter 'name=catering-restore-probe-' --format '{{.Names}}' 2>/dev/null)" || { fail_state RESTORE_CLEANUP_FAILED; return 1; }
  [[ -z "$stale_probe" ]] || { fail_state RESTORE_STALE_PROBE; return 1; }
}
assert_no_stale_restore_state

record_field() {
  local record="${1-}" wanted="${2-}" line key value found="" count=0
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" == *=* ]] || { fail_state RECORD_FIELD_INVALID; return 1; }
    key="${line%%=*}"; value="${line#*=}"
    if [[ "$key" == "$wanted" ]]; then found="$value"; count=$((count + 1)); fi
  done <<< "$record"
  [[ "$count" == 1 && -n "$found" ]] || { fail_state RECORD_FIELD_INVALID; return 1; }
  printf '%s' "$found"
}

validate_record_schema() {
  local kind="${1-}" record="${2-}" line key value allowed seen="|" required
  case "$kind" in
    pointer) allowed='|status|candidate_path|candidate_checksum|created_at|'; required='status candidate_path candidate_checksum created_at' ;;
    candidate) allowed='|status|scope|host_binding|source_commit|source_tree|snapshot_id|repository_identity|artifact_path|artifact_checksum|bundle_path|bundle_checksum|secret_recovery_reference_sha256|restore_postgres_image|created_at|status_timestamp|'; required='status scope host_binding source_commit source_tree snapshot_id repository_identity artifact_path artifact_checksum bundle_path bundle_checksum secret_recovery_reference_sha256 restore_postgres_image created_at status_timestamp' ;;
    artifact) allowed='|status|scope|host_binding|source_commit|source_tree|secret_recovery_reference_sha256|restore_postgres_image|bundle_path|bundle_checksum|manifest_path|manifest_checksum|postgres_dump_path|component_postgres_dump_checksum|component_caddy_stream_checksum|component_sites_checksum|component_platform_caddy_data_checksum|component_platform_caddy_config_checksum|component_shared_edge_caddyfile_checksum|component_shared_edge_caddy_data_checksum|component_shared_edge_caddy_config_checksum|'; required='status scope host_binding source_commit source_tree secret_recovery_reference_sha256 restore_postgres_image bundle_path bundle_checksum manifest_path manifest_checksum postgres_dump_path component_postgres_dump_checksum component_caddy_stream_checksum component_sites_checksum component_platform_caddy_data_checksum component_platform_caddy_config_checksum component_shared_edge_caddyfile_checksum component_shared_edge_caddy_data_checksum component_shared_edge_caddy_config_checksum' ;;
    receipt) allowed='|status|version|scope|host_binding|snapshot_id|repository_identity|artifact_path|artifact_checksum|bundle_path|bundle_checksum|manifest_path|manifest_checksum|secret_recovery_reference_sha256|restore_postgres_image|component_sites_checksum|component_platform_caddy_data_checksum|component_platform_caddy_config_checksum|component_shared_edge_caddyfile_checksum|component_shared_edge_caddy_data_checksum|component_shared_edge_caddy_config_checksum|verified_at|'; required='status version scope host_binding snapshot_id repository_identity artifact_path artifact_checksum bundle_path bundle_checksum manifest_path manifest_checksum secret_recovery_reference_sha256 restore_postgres_image component_sites_checksum component_platform_caddy_data_checksum component_platform_caddy_config_checksum component_shared_edge_caddyfile_checksum component_shared_edge_caddy_data_checksum component_shared_edge_caddy_config_checksum verified_at' ;;
    status) allowed='|status|identity|host_binding|scope|verified_at|'; required='status identity host_binding scope verified_at' ;;
    *) fail_state RECORD_UNKNOWN_KIND; return 1 ;;
  esac
  while IFS= read -r line || [[ -n "$line" ]]; do
    # NUL is rejected by read_bounded_record before this textual parser runs;
    # Bash cannot represent NUL in a variable or pattern.
    [[ "$line" == *=* && "$line" != *$'\r'* ]] || { fail_state RECORD_INVALID; return 1; }
    key="${line%%=*}"; value="${line#*=}"
    [[ "$allowed" == *"|$key|"* && -n "$value" && "$seen" != *"|$key|"* ]] || {
      if [[ "$seen" == *"|$key|"* ]]; then
        fail_state RECORD_DUPLICATE_FIELD
      else
        fail_state RECORD_UNKNOWN_FIELD
      fi
      return 1
    }
    seen+="$key|"
  done <<< "$record"
  for key in $required; do [[ "$seen" == *"|$key|"* ]] || { fail_state RECORD_MISSING_FIELD; return 1; }; done
}

read_record() {
  local path="${1-}" kind="${2-}" expected_checksum="${3-}" value
  safe_record_path "$path" || { fail_state STATE_PATH_INVALID; return 1; }
  assert_root_mode_600 "$path" "$EXPECTED_UID" || return 1
  value="$(read_bounded_record "$path" "$MAX_RECORD_BYTES" "$EXPECTED_UID" "$expected_checksum")" || { fail_state STATE_READ_FAILED; return 1; }
  validate_record_payload "$value" || { fail_state STATE_INVALID; return 1; }
  validate_record_schema "$kind" "$value" || return 1
  printf '%s' "$value"
}

verify_record_checksum() {
  local expected="${1-}" path="${2-}"
  require_digest "$expected" || { fail_state CHECKSUM_INVALID; return 1; }
  verify_checksum "$expected" "$path"
}

assert_versioned_record_path() {
  local path="${1-}" directory="${2-}" name
  name="${path##*/}"
  [[ "$name" =~ ^[A-Za-z0-9_.:-]+$ && "$path" == "$directory/$name" ]] || { fail_state STATE_PATH_INVALID; return 1; }
}

pointer_record="$(read_record "$CANDIDATE_POINTER" pointer)"
[[ "$(record_field "$pointer_record" status)" == pointer ]] || fail_state CANDIDATE_POINTER_INVALID
candidate_path="$(record_field "$pointer_record" candidate_path)"
candidate_checksum="$(record_field "$pointer_record" candidate_checksum)"
assert_versioned_record_path "$candidate_path" "$BACKUP_ROOT/candidates" || fail_state CANDIDATE_PATH_INVALID
candidate_record="$(read_record "$candidate_path" candidate "$candidate_checksum")"
[[ "$(record_field "$candidate_record" status)" == candidate ]] || fail_state CANDIDATE_INVALID
[[ "$(record_field "$candidate_record" scope)" == "$BACKUP_SCOPE" ]] || fail_state SCOPE_INVALID
[[ "$(record_field "$candidate_record" host_binding)" == "$host_digest" ]] || fail_state HOST_BINDING_MISMATCH
[[ "$(record_field "$candidate_record" source_commit)" == "$CATERING_BACKUP_SOURCE_COMMIT" ]] || fail_state SOURCE_COMMIT_MISMATCH
[[ "$(record_field "$candidate_record" source_tree)" == "$CATERING_BACKUP_SOURCE_TREE" ]] || fail_state SOURCE_TREE_MISMATCH
require_timestamp "$(record_field "$candidate_record" created_at)" || fail_state CANDIDATE_INVALID
candidate_created_epoch="$(python3 - "$(record_field "$candidate_record" created_at)" <<'PYTIME'
import datetime, sys
try:
    value = datetime.datetime.strptime(sys.argv[1], '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=datetime.timezone.utc)
    print(int(value.timestamp()))
except (ValueError, OverflowError):
    raise SystemExit(1)
PYTIME
)" || fail_state CANDIDATE_INVALID
require_timestamp "$(record_field "$candidate_record" status_timestamp)" || fail_state CANDIDATE_INVALID
candidate_secret_reference="$(record_field "$candidate_record" secret_recovery_reference_sha256)"
[[ "$candidate_secret_reference" == "$CATERING_SECRET_RECOVERY_REFERENCE_SHA256" ]] || fail_state SECRET_REFERENCE_MISMATCH
snapshot_id="$(record_field "$candidate_record" snapshot_id)"
require_digest "$snapshot_id" || fail_state SNAPSHOT_INVALID
repository_identity="$(record_field "$candidate_record" repository_identity)"
require_digest "$repository_identity" || fail_state REPOSITORY_ID_INVALID
artifact_path="$(record_field "$candidate_record" artifact_path)"
artifact_checksum="$(record_field "$candidate_record" artifact_checksum)"
assert_versioned_record_path "$artifact_path" "$BACKUP_ROOT/snapshots" || fail_state ARTIFACT_PATH_INVALID
artifact_record="$(read_record "$artifact_path" artifact "$artifact_checksum")"
[[ "$(record_field "$artifact_record" status)" == artifact ]] || fail_state ARTIFACT_BINDING
[[ "$(record_field "$artifact_record" scope)" == "$BACKUP_SCOPE" ]] || fail_state ARTIFACT_BINDING
[[ "$(record_field "$artifact_record" host_binding)" == "$host_digest" ]] || fail_state ARTIFACT_BINDING
[[ "$(record_field "$artifact_record" source_commit)" == "$CATERING_BACKUP_SOURCE_COMMIT" && "$(record_field "$artifact_record" source_tree)" == "$CATERING_BACKUP_SOURCE_TREE" ]] || fail_state ARTIFACT_BINDING
artifact_secret_reference="$(record_field "$artifact_record" secret_recovery_reference_sha256)"
[[ "$artifact_secret_reference" == "$candidate_secret_reference" ]] || fail_state SECRET_REFERENCE_MISMATCH
[[ "$(record_field "$artifact_record" restore_postgres_image)" == "$CATERING_RESTORE_POSTGRES_IMAGE" && "$(record_field "$artifact_record" restore_postgres_image)" == "$(record_field "$candidate_record" restore_postgres_image)" ]] || fail_state POSTGRES_IMAGE_MISMATCH
[[ "$(record_field "$artifact_record" bundle_path)" == "$(record_field "$candidate_record" bundle_path)" && "$(record_field "$artifact_record" bundle_checksum)" == "$(record_field "$candidate_record" bundle_checksum)" ]] || fail_state ARTIFACT_BINDING
manifest_path="$(record_field "$artifact_record" manifest_path)"
manifest_checksum="$(record_field "$artifact_record" manifest_checksum)"
postgres_dump_path="$(record_field "$artifact_record" postgres_dump_path)"
bundle_path="$(record_field "$artifact_record" bundle_path)"
[[ "$manifest_path" == manifest && "$postgres_dump_path" == postgres_dump ]] || fail_state ARTIFACT_PATH_INVALID
[[ "$bundle_path" =~ ^[A-Za-z0-9_.:-]+$ ]] || fail_state BUNDLE_PATH_INVALID
bundle_checksum="$(record_field "$candidate_record" bundle_checksum)"
require_digest "$bundle_checksum" || fail_state BUNDLE_CHECKSUM_INVALID
[[ "$(record_field "$artifact_record" component_caddy_stream_checksum)" == "$bundle_checksum" ]] || fail_state ARTIFACT_BINDING
require_digest "$(record_field "$artifact_record" manifest_checksum)" || fail_state ARTIFACT_BINDING
require_digest "$(record_field "$artifact_record" component_postgres_dump_checksum)" || fail_state ARTIFACT_BINDING

# The candidate's repository identity is the first expected value available to
# the restore path.  Validate both operator attestations before any Restic
# query, then repeat the same check at each durable promotion boundary.
validate_restore_attestations || fail_state ATTESTATION_INVALID

# Check repository identity and any previous status before creating a restore
# root or publishing a receipt/status/evidence record.
repository_config="$(restic_cmd cat config --json --no-lock)" || fail_state REPOSITORY_READ_FAILED
live_repository_identity="$(printf '%s' "$repository_config" | python3 -c 'import json,sys; value=json.load(sys.stdin).get("id", ""); print(value if isinstance(value, str) else "")' 2>/dev/null)" || fail_state REPOSITORY_ID_INVALID
[[ "$live_repository_identity" == "$repository_identity" ]] || fail_state REPOSITORY_ID_MISMATCH
if [[ -e "$REPOSITORY_STATUS_PATH" || -L "$REPOSITORY_STATUS_PATH" ]]; then
  existing_status="$(read_record "$REPOSITORY_STATUS_PATH" status)"
  validate_repository_status_binding "$existing_status" "$repository_identity" "$host_digest" "$BACKUP_SCOPE" || fail_state REPOSITORY_STATUS_INVALID
  [[ "$(record_field "$existing_status" status)" == read-only-verified ]] || fail_state REPOSITORY_STATUS_INVALID
  [[ "$(record_field "$existing_status" identity)" == "$repository_identity" ]] || fail_state REPOSITORY_ID_MISMATCH
  [[ "$(record_field "$existing_status" host_binding)" == "$host_digest" ]] || fail_state HOST_BINDING_MISMATCH
  [[ "$(record_field "$existing_status" scope)" == "$BACKUP_SCOPE" ]] || fail_state SCOPE_INVALID
fi
snapshot_listing="$(restic_cmd snapshots --json --no-lock)" || fail_state SNAPSHOT_READ_FAILED
SNAPSHOT_ID="$snapshot_id" python3 -c 'import json,os,sys; expected=os.environ["SNAPSHOT_ID"]; rows=json.load(sys.stdin); raise SystemExit(0 if any(isinstance(row,dict) and row.get("id")==expected for row in rows) else 1)' <<< "$snapshot_listing" || fail_state SNAPSHOT_MISSING

run_id="$(date -u +%Y%m%dT%H%M%SZ)-$$"
restore_root="$RESTORE_RUNTIME_ROOT/.restore-$run_id"
[[ "$(dirname "$restore_root")" == "$RESTORE_RUNTIME_ROOT" ]] || fail_state STATE_ROOT_INVALID
[[ ! -e "$restore_root" && ! -L "$restore_root" ]] || fail_state STATE_ROOT_INVALID
mkdir -m 700 "$restore_root"
assert_directory_mode "$restore_root" || fail_state STATE_ROOT_INVALID
cleanup_verified=false
cleanup_restore_root() {
  python3 - "$restore_root" "$RESTORE_RUNTIME_ROOT" <<'PY'
import os, shutil, sys
work, root = map(os.path.abspath, sys.argv[1:])
if os.path.dirname(work) != root or not os.path.basename(work).startswith('.restore-'): raise SystemExit(1)
shutil.rmtree(work)
if os.path.lexists(work): raise SystemExit(1)
PY
  [[ ! -e "$restore_root" && ! -L "$restore_root" ]] || return 1
  cleanup_verified=true
}
on_exit() { local rc=$?; if [[ "${cleanup_verified:-false}" != true && -e "${restore_root:-}" ]]; then cleanup_restore_root >/dev/null 2>&1 || rc=1; fi; exit "$rc"; }
trap on_exit EXIT

restic_cmd dump "$snapshot_id" "$bundle_path" >"$restore_root/stream.tar" || fail_state RESTORE_FAILED
verify_record_checksum "$bundle_checksum" "$restore_root/stream.tar"
restored_tree="$restore_root/tree"
mkdir -m 700 "$restored_tree"
python3 - "$restore_root/stream.tar" "$restored_tree" <<'PY' || fail_state RESTORE_ARTIFACT_INVALID
import os, posixpath, stat, sys, tarfile

archive_path, root = sys.argv[1], os.path.abspath(sys.argv[2])
directory_roots = {
    "components/sites",
    "components/platform_caddy_data",
    "components/platform_caddy_config",
    "components/shared_edge_caddy_data",
    "components/shared_edge_caddy_config",
}
file_roots = {"manifest", "postgres_dump", "components/shared_edge_caddyfile"}
required = directory_roots | file_roots
seen = set()
members = 0
total_size = 0

def fail():
    raise SystemExit(1)

def allowed(name):
    if not name or "\x00" in name or name.startswith("/"):
        return False
    if name != posixpath.normpath(name) or any(part in ("", ".", "..") for part in name.split("/")):
        return False
    if name in file_roots or name in directory_roots:
        return True
    return any(name.startswith(prefix + "/") for prefix in directory_roots)

def ensure_parent(path):
    relative = os.path.relpath(path, root)
    current = root
    for part in relative.split(os.sep)[:-1]:
        current = os.path.join(current, part)
        if os.path.lexists(current):
            info = os.lstat(current)
            if stat.S_ISLNK(info.st_mode) or not stat.S_ISDIR(info.st_mode):
                fail()
        else:
            os.mkdir(current, 0o700)

try:
    with tarfile.open(archive_path, "r:") as archive:
        for member in archive:
            members += 1
            if members > 10000 or not allowed(member.name) or member.name in seen:
                fail()
            seen.add(member.name)
            if member.issym() or member.islnk() or member.isdev() or member.isfifo() or member.ischr() or member.isblk():
                fail()
            if member.isfile():
                total_size += member.size
                if total_size > 1073741824 or member.name in directory_roots:
                    fail()
                destination = os.path.join(root, *member.name.split("/"))
                ensure_parent(destination)
                if os.path.lexists(destination):
                    fail()
                source = archive.extractfile(member)
                if source is None:
                    fail()
                fd = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0), 0o600)
                try:
                    while True:
                        chunk = source.read(131072)
                        if not chunk:
                            break
                        view = memoryview(chunk)
                        while view:
                            written = os.write(fd, view)
                            if written <= 0:
                                fail()
                            view = view[written:]
                    # The isolated probe runs as the image's postgres UID.  A
                    # root-owned 0644 dump remains inaccessible outside the
                    # root-only runtime directory but is readable through its
                    # explicit read-only bind mount.
                    os.fchmod(fd, 0o644 if member.name == "postgres_dump" else 0o600)
                finally:
                    os.close(fd)
            elif member.isdir():
                if member.name not in directory_roots:
                    if not any(member.name.startswith(prefix + "/") for prefix in directory_roots):
                        fail()
                destination = os.path.join(root, *member.name.split("/"))
                if os.path.lexists(destination):
                    if not os.path.isdir(destination) or os.path.islink(destination):
                        fail()
                else:
                    ensure_parent(destination)
                    os.mkdir(destination, 0o700)
            else:
                fail()
    if not required.issubset(seen) or any(not os.path.exists(os.path.join(root, *name.split("/"))) for name in required):
        fail()
except (OSError, tarfile.TarError, ValueError):
    raise SystemExit(1)
PY
restored_manifest="$restored_tree/manifest"
restored_postgres_dump="$restored_tree/$(basename "$postgres_dump_path")"
[[ -f "$restored_manifest" && -f "$restored_postgres_dump" ]] || fail_state RESTORE_ARTIFACT_MISSING
python3 - "$restored_postgres_dump" "$EXPECTED_UID" <<'PY' || fail_state RESTORE_ARTIFACT_INVALID
import os, stat, sys
path, expected_uid = sys.argv[1], int(sys.argv[2])
info = os.lstat(path)
if not stat.S_ISREG(info.st_mode) or info.st_uid != expected_uid or stat.S_IMODE(info.st_mode) != 0o644:
    raise SystemExit(1)
PY
verify_record_checksum "$manifest_checksum" "$restored_manifest"
verify_record_checksum "$(record_field "$artifact_record" component_postgres_dump_checksum)" "$restored_postgres_dump"
python3 - "$restored_tree" <<'PY' || fail_state RESTORE_ARTIFACT_INVALID
import os, stat, sys
root = os.path.abspath(sys.argv[1])
expected = {
    "components/sites": True,
    "components/platform_caddy_data": True,
    "components/platform_caddy_config": True,
    "components/shared_edge_caddyfile": False,
    "components/shared_edge_caddy_data": True,
    "components/shared_edge_caddy_config": True,
}
def has_content(path):
    for entry in os.scandir(path):
        if entry.is_symlink():
            raise SystemExit(1)
        if entry.is_file(follow_symlinks=False):
            return True
        if entry.is_dir(follow_symlinks=False) and has_content(entry.path):
            return True
    return False
for relative, directory in expected.items():
    path = os.path.join(root, relative)
    if os.path.islink(path):
        raise SystemExit(1)
    info = os.lstat(path)
    if directory:
        if not stat.S_ISDIR(info.st_mode):
            raise SystemExit(1)
        if not has_content(path):
            raise SystemExit(1)
    else:
        if not stat.S_ISREG(info.st_mode):
            raise SystemExit(1)
        fd = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
        try:
            if os.fstat(fd).st_ino != info.st_ino:
                raise SystemExit(1)
            if not os.read(fd, 1):
                raise SystemExit(1)
        finally:
            os.close(fd)
PY
# Caddy material is a Restic stdin stream, never a local archive.  Verify the
# exact encrypted snapshot object without writing its secret-bearing bytes.
component_checksums="$(python3 - "$restored_tree" <<'PY'
import hashlib, os, stat, sys
root = os.path.abspath(sys.argv[1])
spec = {
    "sites": ("components/sites", True),
    "platform_caddy_data": ("components/platform_caddy_data", True),
    "platform_caddy_config": ("components/platform_caddy_config", True),
    "shared_edge_caddyfile": ("components/shared_edge_caddyfile", False),
    "shared_edge_caddy_data": ("components/shared_edge_caddy_data", True),
    "shared_edge_caddy_config": ("components/shared_edge_caddy_config", True),
}
def digest_file(path):
    value = hashlib.sha256()
    fd = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
    try:
        while True:
            chunk = os.read(fd, 131072)
            if not chunk: break
            value.update(chunk)
    finally: os.close(fd)
    return value.hexdigest()
def digest_tree(relative):
    base = os.path.join(root, relative); entries = []
    for current, dirs, names in os.walk(base, topdown=True, followlinks=False):
        dirs[:] = sorted(dirs); names[:] = sorted(names)
        if any(os.path.islink(os.path.join(current, name)) for name in dirs + names): raise SystemExit(1)
        for name in names:
            path = os.path.join(current, name); info = os.lstat(path)
            if not stat.S_ISREG(info.st_mode): raise SystemExit(1)
            entries.append((os.path.relpath(path, root), digest_file(path)))
    if not entries: raise SystemExit(1)
    value = hashlib.sha256()
    for name, digest in sorted(entries):
        value.update(name.encode("utf-8")); value.update(b"\0")
        value.update(digest.encode("ascii")); value.update(b"\n")
    return value.hexdigest()
result = []
for relative, directory in spec.values():
    path = os.path.join(root, relative); info = os.lstat(path)
    if directory:
        if not stat.S_ISDIR(info.st_mode): raise SystemExit(1)
        result.append(digest_tree(relative))
    else:
        if not stat.S_ISREG(info.st_mode) or info.st_size == 0: raise SystemExit(1)
        result.append(digest_file(path))
print("\t".join(result))
PY
)" || fail_state COMPONENT_CHECKSUM_INVALID
IFS=$'\t' read -r actual_sites_checksum actual_platform_caddy_data_checksum actual_platform_caddy_config_checksum actual_shared_edge_caddyfile_checksum actual_shared_edge_caddy_data_checksum actual_shared_edge_caddy_config_checksum <<< "$component_checksums"
[[ "$actual_sites_checksum" == "$(record_field "$artifact_record" component_sites_checksum)" && "$actual_platform_caddy_data_checksum" == "$(record_field "$artifact_record" component_platform_caddy_data_checksum)" && "$actual_platform_caddy_config_checksum" == "$(record_field "$artifact_record" component_platform_caddy_config_checksum)" && "$actual_shared_edge_caddyfile_checksum" == "$(record_field "$artifact_record" component_shared_edge_caddyfile_checksum)" && "$actual_shared_edge_caddy_data_checksum" == "$(record_field "$artifact_record" component_shared_edge_caddy_data_checksum)" && "$actual_shared_edge_caddy_config_checksum" == "$(record_field "$artifact_record" component_shared_edge_caddy_config_checksum)" ]] || fail_state COMPONENT_CHECKSUM_MISMATCH
restic_cmd dump "$snapshot_id" "$bundle_path" | sha256sum | awk '{print $1}' | { read -r caddy_remote_checksum; [[ "$caddy_remote_checksum" == "$bundle_checksum" ]] || fail_state BUNDLE_READBACK_MISMATCH; }

probe_name="catering-restore-probe-$run_id"
# shellcheck disable=SC2016
if ! "$DOCKER_CMD" run --name "$probe_name" --user postgres --rm --network none --pull never \
  --entrypoint /bin/sh --volume "$restored_postgres_dump:/restore/postgres.dump:ro" \
  "$CATERING_RESTORE_POSTGRES_IMAGE" -ceu '
set -eu
export PGDATA=/tmp/pgdata
export PGHOST=/tmp/pgsocket
mkdir -p "$PGHOST"
initdb -D "$PGDATA" >/dev/null
pg_ctl -D "$PGDATA" -o "-k $PGHOST" -w start >/dev/null
trap '\''pg_ctl -D "$PGDATA" -m immediate -w stop >/dev/null 2>&1 || true'\'' EXIT
psql --username=postgres --command="CREATE ROLE catering LOGIN" >/dev/null
createdb --username=postgres --owner=catering catering_agents
pg_restore --exit-on-error --no-owner --no-privileges --username=catering --dbname=catering_agents /restore/postgres.dump
test "$(psql --no-password --username=catering --dbname=catering_agents --tuples-only --command="SELECT count(*) FROM public.catering_business_records")" -ge 0
test "$(psql --no-password --username=catering --dbname=catering_agents --tuples-only --command="SELECT count(*) FROM public.catering_source_documents")" -ge 0
' 2>/dev/null; then
  fail_state RESTORE_PROBE_FAILED
fi
remaining_probe="$($DOCKER_CMD ps -a --filter "name=$probe_name" --format '{{.ID}}')" || fail_state RESTORE_CLEANUP_FAILED
[[ -z "$remaining_probe" ]] || { "$DOCKER_CMD" inspect "$remaining_probe" >/dev/null 2>&1 || true; fail_state RESTORE_CLEANUP_FAILED; }

cleanup_restore_root || fail_state RESTORE_CLEANUP_FAILED
# A pre-promotion elapsed check may fail before any durable promotion.  The
# final gate below is repeated after receipt/status and fresh identity checks.
rto_prepare_elapsed=$(( $(date -u +%s) - started_epoch ))
rto_elapsed_allowed "$rto_prepare_elapsed" || fail_state RESTORE_CLOCK_INVALID
[[ "$rto_prepare_elapsed" -le "$RTO_SECONDS" ]] || fail_state RESTORE_TIMEOUT

refresh_repository_identity() {
  local config identity generation
  config="$(restic_cmd cat config --json --no-lock)" || { fail_state REPOSITORY_READ_FAILED; return 1; }
  identity="$(printf '%s' "$config" | python3 -c 'import json,sys; value=json.load(sys.stdin).get("id", ""); print(value if isinstance(value, str) else "")' 2>/dev/null)" || { fail_state REPOSITORY_ID_INVALID; return 1; }
  require_digest "$identity" || { fail_state REPOSITORY_ID_INVALID; return 1; }
  [[ "$identity" == "$repository_identity" ]] || { fail_state REPOSITORY_ID_MISMATCH; return 1; }
  # Restic holds the admitted descriptors while running; their paths may
  # still be replaced during its query, even with identical contents.
  generation="$(secure_file_generation "$CATERING_BACKUP_REPOSITORY_FILE")" || { fail_state REPOSITORY_READ_FAILED; return 1; }
  [[ "$generation" == "$CATERING_RESTIC_REPOSITORY_GENERATION" ]] || { fail_state REPOSITORY_GENERATION_CHANGED; return 1; }
  generation="$(secure_file_generation "$CATERING_BACKUP_PASSWORD_FILE")" || { fail_state REPOSITORY_READ_FAILED; return 1; }
  [[ "$generation" == "$CATERING_RESTIC_PASSWORD_GENERATION" ]] || { fail_state REPOSITORY_GENERATION_CHANGED; return 1; }
}
# Do the first complete promotion preflight before creating any provisional
# receipt. A preflight failure must not create receipt/status preparation.
refresh_repository_identity
validate_restore_attestations || fail_state ATTESTATION_INVALID
assert_no_stale_restore_state
receipt_dir="$BACKUP_ROOT/restore-receipts"
if [[ -e "$receipt_dir" ]]; then assert_directory_mode "$receipt_dir" || fail_state STATE_PATH_INVALID; else mkdir -m 700 "$receipt_dir"; fi
assert_directory_mode "$receipt_dir" || fail_state STATE_PATH_INVALID
receipt_path="$receipt_dir/catering-restore-receipt-$run_id"
receipt_payload="status=restore-receipt
version=1
scope=$BACKUP_SCOPE
host_binding=$host_digest
snapshot_id=$snapshot_id
repository_identity=$repository_identity
artifact_path=$artifact_path
artifact_checksum=$artifact_checksum
bundle_path=$bundle_path
bundle_checksum=$bundle_checksum
manifest_path=$manifest_path
manifest_checksum=$manifest_checksum
secret_recovery_reference_sha256=$candidate_secret_reference
restore_postgres_image=$CATERING_RESTORE_POSTGRES_IMAGE
component_sites_checksum=$(record_field "$artifact_record" component_sites_checksum)
component_platform_caddy_data_checksum=$(record_field "$artifact_record" component_platform_caddy_data_checksum)
component_platform_caddy_config_checksum=$(record_field "$artifact_record" component_platform_caddy_config_checksum)
component_shared_edge_caddyfile_checksum=$(record_field "$artifact_record" component_shared_edge_caddyfile_checksum)
component_shared_edge_caddy_data_checksum=$(record_field "$artifact_record" component_shared_edge_caddy_data_checksum)
component_shared_edge_caddy_config_checksum=$(record_field "$artifact_record" component_shared_edge_caddy_config_checksum)
verified_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
"
write_restore_receipt() { atomic_write_record "$receipt_path" "$receipt_payload"; }
refresh_repository_identity
validate_restore_attestations || fail_state ATTESTATION_INVALID
if ! write_restore_receipt; then exit 1; fi
receipt_checksum="$(printf '%s' "$receipt_payload" | sha256sum | awk '{print $1}')"

refresh_repository_identity
validate_restore_attestations || fail_state ATTESTATION_INVALID
status_payload="status=read-only-verified
identity=$repository_identity
host_binding=$host_digest
scope=$BACKUP_SCOPE
verified_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
"
write_repository_status() { atomic_write_record "$REPOSITORY_STATUS_PATH" "$status_payload"; }
if ! write_repository_status; then exit 1; fi

# Prepare every evidence field before the terminal freshness/RTO check.  The
# final block below contains only deterministic expansions and the one
# authoritative atomic publication.
evidence_created_at="$(record_field "$candidate_record" created_at)" || fail_state CANDIDATE_INVALID
evidence_component_sites_checksum="$(record_field "$artifact_record" component_sites_checksum)" || fail_state ARTIFACT_BINDING
evidence_component_platform_caddy_data_checksum="$(record_field "$artifact_record" component_platform_caddy_data_checksum)" || fail_state ARTIFACT_BINDING
evidence_component_platform_caddy_config_checksum="$(record_field "$artifact_record" component_platform_caddy_config_checksum)" || fail_state ARTIFACT_BINDING
evidence_component_shared_edge_caddyfile_checksum="$(record_field "$artifact_record" component_shared_edge_caddyfile_checksum)" || fail_state ARTIFACT_BINDING
evidence_component_shared_edge_caddy_data_checksum="$(record_field "$artifact_record" component_shared_edge_caddy_data_checksum)" || fail_state ARTIFACT_BINDING
evidence_component_shared_edge_caddy_config_checksum="$(record_field "$artifact_record" component_shared_edge_caddy_config_checksum)" || fail_state ARTIFACT_BINDING
refresh_repository_identity
validate_restore_attestations || fail_state ATTESTATION_INVALID
assert_no_stale_restore_state
completed_epoch="$(date -u +%s)"
[[ "$completed_epoch" =~ ^[0-9]+$ ]] || fail_state RESTORE_CLOCK_INVALID
duration_seconds=$(( completed_epoch - started_epoch ))
rto_elapsed_allowed "$duration_seconds" || fail_state RESTORE_CLOCK_INVALID
[[ "$duration_seconds" -le "$RTO_SECONDS" ]] || fail_state RESTORE_TIMEOUT
# A successful restore must still describe a backup inside the RPO window at
# publication; time spent preparing receipt/status also consumes that window.
candidate_age_seconds=$(( completed_epoch - candidate_created_epoch ))
[[ "$candidate_age_seconds" -ge 0 && "$candidate_age_seconds" -le "$RPO_SECONDS" ]] || fail_state CANDIDATE_STALE
evidence_payload="status=success
project=catering-agents-platform
scope=$BACKUP_SCOPE
host_binding=$host_digest
created_at=$evidence_created_at
snapshot_id=$snapshot_id
checksum=$artifact_checksum
artifact_path=$artifact_path
artifact_snapshot_id=$snapshot_id
artifact_checksum=$artifact_checksum
artifact_host_binding=$host_digest
artifact_scope=$BACKUP_SCOPE
artifact_created_at=$evidence_created_at
repository_identity=$repository_identity
repository_status=read-only-verified
receipt_path=$receipt_path
receipt_checksum=$receipt_checksum
secret_recovery_reference_sha256=$candidate_secret_reference
restore_postgres_image=$CATERING_RESTORE_POSTGRES_IMAGE
component_sites_checksum=$evidence_component_sites_checksum
component_platform_caddy_data_checksum=$evidence_component_platform_caddy_data_checksum
component_platform_caddy_config_checksum=$evidence_component_platform_caddy_config_checksum
component_shared_edge_caddyfile_checksum=$evidence_component_shared_edge_caddyfile_checksum
component_shared_edge_caddy_data_checksum=$evidence_component_shared_edge_caddy_data_checksum
component_shared_edge_caddy_config_checksum=$evidence_component_shared_edge_caddy_config_checksum
duration_seconds=$duration_seconds
"
promote_final_evidence() { atomic_write_record "$EVIDENCE_PATH" "$evidence_payload"; }
if ! promote_final_evidence; then exit 1; fi
