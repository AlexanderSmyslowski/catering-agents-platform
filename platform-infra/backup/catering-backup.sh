#!/usr/bin/env bash
set -euo pipefail
umask 077
backup_started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# The candidate is accepted by downstream evidence only within this age.
# shellcheck disable=SC2034
readonly RPO_SECONDS="21600"
readonly BACKUP_SCOPE="postgres,sites,platform-caddy,shared-edge-caddy"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
# shellcheck source=platform-infra/backup/catering-backup-common.sh
source "$SCRIPT_DIR/catering-backup-common.sh"

: "${CATERING_BACKUP_EXPECTED_HOST_SHA256:?CATERING_BACKUP_EXPECTED_HOST_SHA256 is required}"
: "${CATERING_BACKUP_SOURCE_COMMIT:?CATERING_BACKUP_SOURCE_COMMIT is required}"
: "${CATERING_BACKUP_SOURCE_TREE:?CATERING_BACKUP_SOURCE_TREE is required}"
: "${CATERING_BACKUP_REPOSITORY_FILE:?CATERING_BACKUP_REPOSITORY_FILE is required}"
: "${CATERING_BACKUP_PASSWORD_FILE:?CATERING_BACKUP_PASSWORD_FILE is required}"
: "${CATERING_BACKUP_EXPECTED_REPOSITORY_SHA256:?CATERING_BACKUP_EXPECTED_REPOSITORY_SHA256 is required}"
: "${CATERING_BACKUP_EXPECTED_REPOSITORY_ID:?CATERING_BACKUP_EXPECTED_REPOSITORY_ID is required}"
: "${CATERING_BACKUP_PRODUCTION_HOST_SHA256:?CATERING_BACKUP_PRODUCTION_HOST_SHA256 is required}"
: "${CATERING_BACKUP_PRODUCTION_ADDRESSES_SHA256:?CATERING_BACKUP_PRODUCTION_ADDRESSES_SHA256 is required}"
: "${CATERING_OFFHOST_ATTESTATION_FILE:?CATERING_OFFHOST_ATTESTATION_FILE is required}"
: "${CATERING_OFFHOST_ATTESTATION_SHA256:?CATERING_OFFHOST_ATTESTATION_SHA256 is required}"
: "${CATERING_SECRET_RECOVERY_ATTESTATION_FILE:?CATERING_SECRET_RECOVERY_ATTESTATION_FILE is required}"
: "${CATERING_SECRET_RECOVERY_ATTESTATION_SHA256:?CATERING_SECRET_RECOVERY_ATTESTATION_SHA256 is required}"
: "${CATERING_SECRET_RECOVERY_REFERENCE_SHA256:?CATERING_SECRET_RECOVERY_REFERENCE_SHA256 is required}"
: "${CATERING_REQUIRED_SECRET_SCHEMA_SHA256:?CATERING_REQUIRED_SECRET_SCHEMA_SHA256 is required}"
: "${CATERING_SECRET_RECOVERY_SOURCE_TYPE:?CATERING_SECRET_RECOVERY_SOURCE_TYPE is required}"
: "${CATERING_SECRET_RECOVERY_SOURCE_REFERENCE:?CATERING_SECRET_RECOVERY_SOURCE_REFERENCE is required}"
: "${CATERING_RESTORE_POSTGRES_IMAGE:?CATERING_RESTORE_POSTGRES_IMAGE is required}"

if [[ "${CATERING_BACKUP_TEST_MODE:-0}" != 1 ]]; then
  [[ "$(id -u)" == 0 && "${CATERING_BACKUP_EXPECTED_UID:-0}" == 0 ]] || fail_state PRIVILEGE_INVALID
fi

require_commit "$CATERING_BACKUP_SOURCE_COMMIT" || fail_state SOURCE_COMMIT_INVALID
[[ "$CATERING_BACKUP_SOURCE_TREE" =~ ^[0-9a-f]{40}$ ]] || fail_state SOURCE_TREE_INVALID
require_digest "$CATERING_BACKUP_EXPECTED_HOST_SHA256" || fail_state HOST_BINDING_INVALID
require_digest "$CATERING_BACKUP_EXPECTED_REPOSITORY_SHA256" || fail_state REPOSITORY_BINDING_INVALID
require_digest "$CATERING_BACKUP_EXPECTED_REPOSITORY_ID" || fail_state REPOSITORY_ID_INVALID
require_digest "$CATERING_BACKUP_PRODUCTION_HOST_SHA256" || fail_state PRODUCTION_HOST_INVALID
require_digest "$CATERING_BACKUP_PRODUCTION_ADDRESSES_SHA256" || fail_state PRODUCTION_ADDRESSES_INVALID
require_digest "$CATERING_SECRET_RECOVERY_REFERENCE_SHA256" || fail_state SECRET_REFERENCE_INVALID
require_digest "$CATERING_REQUIRED_SECRET_SCHEMA_SHA256" || fail_state SECRET_SCHEMA_INVALID
[[ "$CATERING_RESTORE_POSTGRES_IMAGE" =~ ^[^[:space:]@]+@sha256:[0-9a-f]{64}$ ]] || fail_state POSTGRES_IMAGE_INVALID

# The root is a trust boundary.  Validate every existing ancestor before the
# first mkdir, and reject a configured root or ancestor that is a symlink.
prepare_backup_root() {
  python3 - "$BACKUP_ROOT" <<'PY'
import os, stat, sys
root = os.path.abspath(sys.argv[1])
if not root.startswith("/") or root in ("/", ""):
    raise SystemExit(1)
parts = root.strip("/").split("/")
cursor = "/"
for part in parts[:-1]:
    cursor = os.path.join(cursor, part)
    try:
        info = os.lstat(cursor)
    except FileNotFoundError:
        raise SystemExit(1)
    if stat.S_ISLNK(info.st_mode) or not stat.S_ISDIR(info.st_mode):
        raise SystemExit(1)
try:
    info = os.lstat(root)
except FileNotFoundError:
    os.mkdir(root, 0o700)
    info = os.lstat(root)
if stat.S_ISLNK(info.st_mode) or not stat.S_ISDIR(info.st_mode):
    raise SystemExit(1)
if info.st_uid != 0 or stat.S_IMODE(info.st_mode) != 0o700:
    raise SystemExit(1)
PY
}
prepare_backup_root || fail_state STATE_ROOT_INVALID
assert_root_mode_600 "$CATERING_BACKUP_REPOSITORY_FILE"
assert_root_mode_600 "$CATERING_BACKUP_PASSWORD_FILE"

assert_off_host_repository() { validate_offhost_repository "${1-}"; }
readonly DOCKER_CMD="${CATERING_DOCKER_COMMAND:-docker}"
readonly PG_DUMP_CMD="${CATERING_PG_DUMP_COMMAND:-pg_dump}"
repository_value="$(read_secure_single_line "$CATERING_BACKUP_REPOSITORY_FILE")" || fail_state REPOSITORY_READ_FAILED
assert_off_host_repository "$repository_value" || fail_state REPOSITORY_INVALID
repository_locator_digest="$(printf '%s' "$repository_value" | sha256sum | awk '{print $1}')"
[[ "$repository_locator_digest" == "$CATERING_BACKUP_EXPECTED_REPOSITORY_SHA256" ]] || fail_state REPOSITORY_BINDING_MISMATCH
restic_cmd() { secure_restic "$@" 2>/dev/null; }
secure_restic_init_generation "$CATERING_BACKUP_REPOSITORY_FILE" "$CATERING_BACKUP_PASSWORD_FILE" || fail_state REPOSITORY_READ_FAILED

read_repository_identity() {
  local config identity generation
  config="$(restic_cmd cat config --json --no-lock)" || { fail_state REPOSITORY_READ_FAILED; return 1; }
  identity="$(printf '%s' "$config" | python3 -c 'import json,sys; value=json.load(sys.stdin).get("id", ""); print(value if isinstance(value, str) else "")' 2>/dev/null)" || { fail_state REPOSITORY_ID_INVALID; return 1; }
  require_digest "$identity" || { fail_state REPOSITORY_ID_INVALID; return 1; }
  # Restic's admitted descriptors do not prevent replacement of their paths
  # during the final query before candidate-pointer publication.
  generation="$(secure_file_generation "$CATERING_BACKUP_REPOSITORY_FILE")" || { fail_state REPOSITORY_READ_FAILED; return 1; }
  [[ "$generation" == "$CATERING_RESTIC_REPOSITORY_GENERATION" ]] || { fail_state REPOSITORY_GENERATION_CHANGED; return 1; }
  generation="$(secure_file_generation "$CATERING_BACKUP_PASSWORD_FILE")" || { fail_state REPOSITORY_READ_FAILED; return 1; }
  [[ "$generation" == "$CATERING_RESTIC_PASSWORD_GENERATION" ]] || { fail_state REPOSITORY_GENERATION_CHANGED; return 1; }
  printf '%s' "$identity"
}

record_field_from_status() {
  local record="${1-}" wanted="${2-}" line key value found="" count=0
  while IFS= read -r line || [[ -n "$line" ]]; do
    key="${line%%=*}"; value="${line#*=}"
    if [[ "$key" == "$wanted" ]]; then found="$value"; count=$((count + 1)); fi
  done <<< "$record"
  [[ "$count" == 1 ]] || return 1
  printf '%s' "$found"
}

host_name="$(hostname -s)"
host_digest="$(printf '%s' "$host_name" | sha256sum | awk '{print $1}')"
[[ "$host_digest" == "$CATERING_BACKUP_EXPECTED_HOST_SHA256" && "$host_digest" == "$CATERING_BACKUP_PRODUCTION_HOST_SHA256" ]] || fail_state HOST_BINDING_MISMATCH

validate_backup_attestations() {
  local expected_id="${1-}" locator current_locator_digest
  locator="$(read_secure_single_line "$CATERING_BACKUP_REPOSITORY_FILE")" || { fail_state REPOSITORY_READ_FAILED; return 1; }
  [[ "$locator" == "$repository_value" ]] || { fail_state REPOSITORY_PATH_CHANGED; return 1; }
  current_locator_digest="$(printf '%s' "$locator" | sha256sum | awk '{print $1}')"
  CATERING_BACKUP_REPOSITORY_VALUE="$locator" validate_operator_attestations "$expected_id" "$host_digest" "$current_locator_digest" "" "$CATERING_BACKUP_PRODUCTION_HOST_SHA256" "" "" 21600 || return 1
}
validate_backup_attestations "$CATERING_BACKUP_EXPECTED_REPOSITORY_ID" || fail_state ATTESTATION_INVALID

# Resolve exactly one running Compose PostgreSQL container once.  All later
# inspection and the dump use this immutable full ID, never a mutable name.
postgres_container_id="$("$DOCKER_CMD" ps --no-trunc --filter label=com.docker.compose.project=platform-infra --filter label=com.docker.compose.service=postgres --format '{{.ID}}' 2>/dev/null)" || fail_state POSTGRES_IDENTITY_INVALID
[[ "$postgres_container_id" =~ ^[0-9a-f]{64}$ ]] || fail_state POSTGRES_IDENTITY_INVALID
inspect_container() { "$DOCKER_CMD" inspect --format "$1" "$postgres_container_id" 2>/dev/null; }
[[ "$(inspect_container '{{.Id}}')" == "$postgres_container_id" ]] || fail_state POSTGRES_IDENTITY_INVALID
[[ "$(inspect_container '{{.Name}}')" == "/platform-infra-postgres-1" ]] || fail_state POSTGRES_IDENTITY_INVALID
[[ "$(inspect_container '{{index .Config.Labels "com.docker.compose.project"}}')" == platform-infra ]] || fail_state POSTGRES_IDENTITY_INVALID
[[ "$(inspect_container '{{index .Config.Labels "com.docker.compose.service"}}')" == postgres ]] || fail_state POSTGRES_IDENTITY_INVALID
[[ "$(inspect_container '{{index .Config.Labels "com.docker.compose.container-number"}}')" == 1 ]] || fail_state POSTGRES_IDENTITY_INVALID
[[ "$(inspect_container '{{.State.Status}}')" == running && "$(inspect_container '{{.State.Health.Status}}')" == healthy ]] || fail_state POSTGRES_IDENTITY_INVALID
postgres_image_id="$(inspect_container '{{.Image}}')"
[[ "$postgres_image_id" =~ ^sha256:[0-9a-f]{64}$ ]] || fail_state POSTGRES_IDENTITY_INVALID
postgres_config_image="$(inspect_container '{{.Config.Image}}')"
[[ "$postgres_config_image" =~ ^[^[:space:]@]+$ ]] || fail_state POSTGRES_IDENTITY_INVALID
POSTGRES_REPO_DIGEST="$("$DOCKER_CMD" image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' "$postgres_image_id" 2>/dev/null)" || fail_state POSTGRES_IDENTITY_INVALID
postgres_repo_digest_matches=false
postgres_repo_digest_count=0
while IFS= read -r postgres_digest; do
  [[ -n "$postgres_digest" && "$postgres_digest" =~ ^[^[:space:]@]+@sha256:[0-9a-f]{64}$ ]] || fail_state POSTGRES_IDENTITY_INVALID
  postgres_repo_digest_count=$((postgres_repo_digest_count + 1))
  [[ "$postgres_digest" == "$CATERING_RESTORE_POSTGRES_IMAGE" ]] && postgres_repo_digest_matches=true
done <<< "$POSTGRES_REPO_DIGEST"
[[ "$postgres_repo_digest_count" -gt 0 && "$postgres_repo_digest_matches" == true ]] || fail_state POSTGRES_IDENTITY_INVALID
postgres_env="$(inspect_container '{{range .Config.Env}}{{println .}}{{end}}')"
postgres_db="" postgres_user="" postgres_db_count=0 postgres_user_count=0
while IFS= read -r env_line || [[ -n "$env_line" ]]; do
  case "$env_line" in
    POSTGRES_DB=*) postgres_db="${env_line#POSTGRES_DB=}"; postgres_db_count=$((postgres_db_count + 1)) ;;
    POSTGRES_USER=*) postgres_user="${env_line#POSTGRES_USER=}"; postgres_user_count=$((postgres_user_count + 1)) ;;
  esac
done <<< "$postgres_env"
[[ "$postgres_db_count" == 1 && "$postgres_db" == catering_agents && "$postgres_user_count" == 1 && "$postgres_user" == catering ]] || fail_state POSTGRES_IDENTITY_INVALID
postgres_mounts="$(inspect_container '{{range .Mounts}}{{printf "%s|%s|%s|%t" .Type .Name .Destination .RW}}{{println}}{{end}}')"
postgres_mount_count=0
while IFS='|' read -r mount_type mount_name mount_destination mount_rw || [[ -n "$mount_type$mount_name$mount_destination$mount_rw" ]]; do
  mount_type="${mount_type//[[:space:]]/}"; mount_name="${mount_name//[[:space:]]/}"; mount_destination="${mount_destination//[[:space:]]/}"; mount_rw="${mount_rw//[[:space:]]/}"
  [[ -z "$mount_type" || ( "$mount_type" == volume && "$mount_name" == platform-infra_postgres_data && "$mount_destination" == /var/lib/postgresql/data && "$mount_rw" == true ) ]] || fail_state POSTGRES_IDENTITY_INVALID
  [[ -z "$mount_type" ]] || postgres_mount_count=$((postgres_mount_count + 1))
done <<< "$postgres_mounts"
[[ "$postgres_mount_count" == 1 ]] || fail_state POSTGRES_IDENTITY_INVALID
postgres_volume_identity="$("$DOCKER_CMD" volume inspect --format '{{.Name}}|{{index .Labels "com.docker.compose.project"}}|{{index .Labels "com.docker.compose.volume"}}' platform-infra_postgres_data 2>/dev/null)" || fail_state POSTGRES_IDENTITY_INVALID
[[ "$postgres_volume_identity" == "platform-infra_postgres_data|platform-infra|postgres_data" ]] || fail_state POSTGRES_IDENTITY_INVALID
volume_mountpoint() {
  local volume="${1-}" expected="${2-}" details name project label mountpoint parent_name
  details="$("$DOCKER_CMD" volume inspect --format '{{.Name}}|{{index .Labels "com.docker.compose.project"}}|{{index .Labels "com.docker.compose.volume"}}|{{.Mountpoint}}' "$volume" 2>/dev/null)" || { fail_state CADDY_VOLUME_INVALID; return 1; }
  [[ "$details" != *$'\n'* && "$details" != *$'\r'* ]] || { fail_state CADDY_VOLUME_INVALID; return 1; }
  IFS='|' read -r name project label mountpoint <<< "$details"
  parent_name="$(basename "$(dirname "$mountpoint")")"
  [[ "$name|$project|$label" == "$expected" && "$mountpoint" == /* && "$(basename "$mountpoint")" == _data && "$parent_name" == "$volume" && -d "$mountpoint" && ! -L "$mountpoint" ]] || { fail_state CADDY_VOLUME_INVALID; return 1; }
  printf '%s' "$mountpoint"
}
platform_caddy_data_mount="$(volume_mountpoint platform-infra_caddy_data 'platform-infra_caddy_data|platform-infra|caddy_data')"
platform_caddy_config_mount="$(volume_mountpoint platform-infra_caddy_config 'platform-infra_caddy_config|platform-infra|caddy_config')"
shared_edge_caddy_data_mount="$(volume_mountpoint shared-edge_edge_caddy_data 'shared-edge_edge_caddy_data|shared-edge|edge_caddy_data')"
shared_edge_caddy_config_mount="$(volume_mountpoint shared-edge_edge_caddy_config 'shared-edge_edge_caddy_config|shared-edge|edge_caddy_config')"

# A volume name alone is not provenance.  Resolve each Caddy service once and
# bind both inspected volume IDs to their exact destinations.  The only other
# mounts admitted are the service's read-only, staging-owned configuration.
assert_caddy_container_mounts() {
  local project="${1-}" service="${2-}" expected_name="${3-}" data_volume="${4-}" config_volume="${5-}" data_mountpoint="${6-}" config_mountpoint="${7-}" bind_source="${8-}" bind_destination="${9-}"
  local ids id_count=0 id container_name compose_project compose_service state health mounts
  local mount_type mount_name mount_source mount_destination mount_rw data_count=0 config_count=0 bind_count=0
  ids="$("$DOCKER_CMD" ps --no-trunc \
    --filter "label=com.docker.compose.project=$project" \
    --filter "label=com.docker.compose.service=$service" \
    --format '{{.ID}}' 2>/dev/null)" || { fail_state CADDY_CONTAINER_INVALID; return 1; }
  while IFS= read -r id || [[ -n "$id" ]]; do
    [[ -z "$id" ]] && continue
    id_count=$((id_count + 1))
    [[ "$id" =~ ^[0-9a-f]{64}$ ]] || { fail_state CADDY_CONTAINER_INVALID; return 1; }
  done <<< "$ids"
  [[ "$id_count" == 1 ]] || { fail_state CADDY_CONTAINER_INVALID; return 1; }
  id="${ids%%$'\n'*}"
  inspect_caddy() { "$DOCKER_CMD" inspect --format "$1" "$id" 2>/dev/null; }
  [[ "$(inspect_caddy '{{.Id}}')" == "$id" ]] || { fail_state CADDY_CONTAINER_INVALID; return 1; }
  container_name="$(inspect_caddy '{{.Name}}')"
  compose_project="$(inspect_caddy '{{index .Config.Labels "com.docker.compose.project"}}')"
  compose_service="$(inspect_caddy '{{index .Config.Labels "com.docker.compose.service"}}')"
  [[ "$container_name" == "/$expected_name" && "$compose_project" == "$project" && "$compose_service" == "$service" ]] || { fail_state CADDY_CONTAINER_INVALID; return 1; }
  state="$(inspect_caddy '{{.State.Status}}')"
  health="$(inspect_caddy '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}')"
  [[ "$state" == running && ( "$health" == healthy || "$health" == none ) ]] || { fail_state CADDY_CONTAINER_INVALID; return 1; }
  mounts="$(inspect_caddy '{{range .Mounts}}{{printf "%s|%s|%s|%s|%t" .Type .Name .Source .Destination .RW}}{{println}}{{end}}')"
  while IFS='|' read -r mount_type mount_name mount_source mount_destination mount_rw || [[ -n "$mount_type$mount_name$mount_source$mount_destination$mount_rw" ]]; do
    [[ -z "$mount_type" ]] && continue
    case "$mount_type" in
      volume)
        case "$mount_name|$mount_destination|$mount_rw" in
          "$data_volume|/data|true") [[ "$mount_source" == "$data_mountpoint" ]] || { fail_state CADDY_CONTAINER_MOUNT_INVALID; return 1; }; data_count=$((data_count + 1)) ;;
          "$config_volume|/config|true") [[ "$mount_source" == "$config_mountpoint" ]] || { fail_state CADDY_CONTAINER_MOUNT_INVALID; return 1; }; config_count=$((config_count + 1)) ;;
          *) fail_state CADDY_CONTAINER_MOUNT_INVALID; return 1 ;;
        esac
        ;;
      bind)
        [[ -z "$mount_name" && "$mount_source" == "$bind_source" && "$mount_destination" == "$bind_destination" && "$mount_rw" == false ]] || { fail_state CADDY_CONTAINER_MOUNT_INVALID; return 1; }
        bind_count=$((bind_count + 1))
        ;;
      *) fail_state CADDY_CONTAINER_MOUNT_INVALID; return 1 ;;
    esac
  done <<< "$mounts"
  [[ "$data_count" == 1 && "$config_count" == 1 && "$bind_count" == 1 ]] || { fail_state CADDY_CONTAINER_MOUNT_INVALID; return 1; }
  CADDY_LAST_BINDING_DIGEST="$(printf '%s\0%s\0%s\0%s\0' "$project" "$service" "$id" "$mounts" | sha256sum | awk '{print $1}')"
}

assert_caddy_container_mounts platform-infra web platform-infra-web-1 platform-infra_caddy_data platform-infra_caddy_config "$platform_caddy_data_mount" "$platform_caddy_config_mount" /opt/catering-agents-platform/platform-infra/sites /etc/caddy/sites
caddy_binding_before="$CADDY_LAST_BINDING_DIGEST"
assert_caddy_container_mounts shared-edge edge shared-edge-edge-1 shared-edge_edge_caddy_data shared-edge_edge_caddy_config "$shared_edge_caddy_data_mount" "$shared_edge_caddy_config_mount" /opt/shared-edge/Caddyfile /etc/caddy/Caddyfile
caddy_binding_before="$caddy_binding_before|$CADDY_LAST_BINDING_DIGEST"

run_id="$(date -u +%Y%m%dT%H%M%SZ)-$$"
work_root="$BACKUP_ROOT/.work-$run_id"
snapshot_dir="$BACKUP_ROOT/snapshots"
candidate_dir="$BACKUP_ROOT/candidates"
python3 - "$BACKUP_ROOT" "$work_root" "$snapshot_dir" "$candidate_dir" "${CATERING_BACKUP_EXPECTED_UID:-0}" <<'PY' || fail_state STATE_PATH_INVALID
import os, stat, sys
root, *args = sys.argv[1:]
expected_uid = int(args.pop())
root, *children = map(os.path.abspath, [root, *args])
if not os.path.isdir(root) or os.path.islink(root):
    raise SystemExit(1)
for child in children:
    if os.path.dirname(child) != root:
        raise SystemExit(1)
    try:
        info = os.lstat(child)
    except FileNotFoundError:
        os.mkdir(child, 0o700)
        continue
    if (os.path.islink(child) or not stat.S_ISDIR(info.st_mode) or
        info.st_uid != expected_uid or stat.S_IMODE(info.st_mode) != 0o700):
        raise SystemExit(1)
PY

cleanup_work_root() {
  local original="${1:-0}"
  if [[ -n "${work_root:-}" && -e "$work_root" ]]; then
    if ! python3 - "$work_root" "$BACKUP_ROOT" <<'PY'
import os, shutil, sys
work, root = map(os.path.abspath, sys.argv[1:])
if os.path.dirname(work) != root or not os.path.basename(work).startswith(".work-"):
    raise SystemExit(1)
shutil.rmtree(work)
if os.path.lexists(work):
    raise SystemExit(1)
PY
    then
      printf '%s\n' WORK_ROOT_CLEANUP_FAILED >&2
      [[ "$original" -ne 0 ]] || original=1
    fi
  fi
  return "$original"
}
on_exit() { local rc=$?; cleanup_work_root "$rc"; local clean=$?; (( rc == 0 && clean != 0 )) && rc=$clean; exit "$rc"; }
trap on_exit EXIT

postgres_dump="$work_root/postgres_dump"
if ! "$DOCKER_CMD" exec --env PGHOST= --env PGHOSTADDR= --env PGPORT= --env PGSERVICE= --env PGSERVICEFILE= --user postgres "$postgres_container_id" "$PG_DUMP_CMD" \
  --username=catering --dbname=catering_agents --format=custom --no-owner --no-privileges \
  --strict-names --table=public.catering_business_records --table=public.catering_source_documents >"$postgres_dump" 2>/dev/null; then
  fail_state POSTGRES_DUMP_FAILED
fi
sites_path="/opt/catering-agents-platform/platform-infra/sites"
shared_edge_caddyfile_path="/opt/shared-edge/Caddyfile"
# Secret-bearing Caddy data is never materialised locally.  The checksum is
# derived from the exact stream, then that same source set is streamed directly
# into the encrypted Restic snapshot under a generic filename.
bundle_path="catering-backup-stream-$run_id"
manifest_path="$work_root/manifest"
{
  printf 'version=1\n'
  printf 'scope=%s\n' "$BACKUP_SCOPE"
  printf 'source_commit=%s\nsource_tree=%s\n' "$CATERING_BACKUP_SOURCE_COMMIT" "$CATERING_BACKUP_SOURCE_TREE"
  printf 'secret_recovery_reference_sha256=%s\n' "$CATERING_SECRET_RECOVERY_REFERENCE_SHA256"
  printf 'component_postgres_dump_checksum=%s\n' "$(sha256sum "$postgres_dump" | awk '{print $1}')"
} >"$manifest_path"
manifest_checksum="$(sha256sum "$manifest_path" | awk '{print $1}')"
caddy_source_generation_before="$(capture_source_generation "$sites_path" "$platform_caddy_data_mount" "$platform_caddy_config_mount" "$shared_edge_caddyfile_path" "$shared_edge_caddy_data_mount" "$shared_edge_caddy_config_mount")" || fail_state CADDY_CAPTURE_INVALID

# Bind the repository before capture and compare it again after the only
# snapshot/readback.  A repository change may leave an orphan artifact, but it
# must never advance the candidate pointer or alter prior evidence.
repository_identity_before="$(read_repository_identity)"
[[ "$repository_identity_before" == "$CATERING_BACKUP_EXPECTED_REPOSITORY_ID" ]] || fail_state REPOSITORY_ID_MISMATCH
if [[ -e "$REPOSITORY_STATUS_PATH" || -L "$REPOSITORY_STATUS_PATH" ]]; then
  status_record="$(read_bounded_record "$REPOSITORY_STATUS_PATH" "$MAX_RECORD_BYTES" "${CATERING_BACKUP_EXPECTED_UID:-0}")" || fail_state REPOSITORY_STATUS_INVALID
  validate_repository_status_binding "$status_record" "$repository_identity_before" "$host_digest" "$BACKUP_SCOPE" || fail_state REPOSITORY_STATUS_INVALID
  status_identity="$(record_field_from_status "$status_record" identity)"
  [[ "$status_identity" == "$repository_identity_before" ]] || fail_state REPOSITORY_ID_MISMATCH
  status_host_binding="$(record_field_from_status "$status_record" host_binding)"
  [[ "$status_host_binding" == "$host_digest" ]] || fail_state HOST_BINDING_MISMATCH
  status_scope="$(record_field_from_status "$status_record" scope)"
  [[ "$status_scope" == "$BACKUP_SCOPE" ]] || fail_state SCOPE_INVALID
fi

# Re-read the live repository identity and re-capture the immutable
# live/attested address generation immediately before the secret-bearing stream
# reaches Restic.  No endpoint or interface helper runs inside snapshot_stream,
# so this is the final trust check for this run.
repository_identity_before_snapshot="$(read_repository_identity)"
[[ "$repository_identity_before_snapshot" == "$repository_identity_before" ]] || fail_state REPOSITORY_ID_MISMATCH
validate_backup_attestations "$repository_identity_before_snapshot" || fail_state ATTESTATION_INVALID

snapshot_stream() {
  # Python's streaming tar writer gives every secret-bearing source a unique
  # internal component ID without creating an intermediate local archive.
  python3 - "$work_root" "$sites_path" "$platform_caddy_data_mount" "$platform_caddy_config_mount" "$shared_edge_caddyfile_path" "$shared_edge_caddy_data_mount" "$shared_edge_caddy_config_mount" <<'PY'
import os, sys, tarfile
work, sites, p_data, p_config, caddyfile, e_data, e_config = sys.argv[1:]
try:
    with tarfile.open(fileobj=sys.stdout.buffer, mode="w|") as archive:
        archive.add(os.path.join(work, "manifest"), arcname="manifest", recursive=False)
        archive.add(os.path.join(work, "postgres_dump"), arcname="postgres_dump", recursive=False)
        for name, path in (("sites", sites), ("platform_caddy_data", p_data), ("platform_caddy_config", p_config), ("shared_edge_caddyfile", caddyfile), ("shared_edge_caddy_data", e_data), ("shared_edge_caddy_config", e_config)):
            archive.add(path, arcname="components/" + name, recursive=True)
except Exception:
    raise SystemExit(1)
PY
}
snapshot_json="$(snapshot_stream 2>/dev/null | restic_cmd backup --json --stdin --stdin-filename "$bundle_path")" || fail_state RESTIC_BACKUP_FAILED
snapshot_id="$(printf '%s' "$snapshot_json" | python3 -c 'import json,sys; rows=[json.loads(x) for x in sys.stdin if x.strip()]; value=rows[-1].get("snapshot_id", "") if rows else ""; print(value)' 2>/dev/null)" || fail_state SNAPSHOT_INVALID
[[ "$snapshot_id" =~ ^[0-9a-f]{64}$ ]] || fail_state SNAPSHOT_INVALID
assert_caddy_container_mounts platform-infra web platform-infra-web-1 platform-infra_caddy_data platform-infra_caddy_config "$platform_caddy_data_mount" "$platform_caddy_config_mount" /opt/catering-agents-platform/platform-infra/sites /etc/caddy/sites
caddy_binding_after="$CADDY_LAST_BINDING_DIGEST"
assert_caddy_container_mounts shared-edge edge shared-edge-edge-1 shared-edge_edge_caddy_data shared-edge_edge_caddy_config "$shared_edge_caddy_data_mount" "$shared_edge_caddy_config_mount" /opt/shared-edge/Caddyfile /etc/caddy/Caddyfile
caddy_binding_after="$caddy_binding_after|$CADDY_LAST_BINDING_DIGEST"
[[ "$caddy_binding_after" == "$caddy_binding_before" ]] || fail_state CADDY_CAPTURE_DRIFT
caddy_source_generation_after="$(capture_source_generation "$sites_path" "$platform_caddy_data_mount" "$platform_caddy_config_mount" "$shared_edge_caddyfile_path" "$shared_edge_caddy_data_mount" "$shared_edge_caddy_config_mount")" || fail_state CADDY_CAPTURE_INVALID
[[ "$caddy_source_generation_after" == "$caddy_source_generation_before" ]] || fail_state CADDY_CAPTURE_DRIFT
bundle_checksums="$(restic_cmd dump "$snapshot_id" "$bundle_path" | python3 -c '
import hashlib, sys, tarfile

class HashingReader:
    def __init__(self): self.whole = hashlib.sha256()
    def read(self, size=-1):
        value = sys.stdin.buffer.read(size)
        self.whole.update(value)
        return value
    def readinto(self, target):
        value = self.read(len(target))
        target[:len(value)] = value
        return len(value)

reader = HashingReader()
spec = {
    "postgres_dump": ("postgres_dump", False),
    "sites": ("components/sites", True),
    "platform_caddy_data": ("components/platform_caddy_data", True),
    "platform_caddy_config": ("components/platform_caddy_config", True),
    "shared_edge_caddyfile": ("components/shared_edge_caddyfile", False),
    "shared_edge_caddy_data": ("components/shared_edge_caddy_data", True),
    "shared_edge_caddy_config": ("components/shared_edge_caddy_config", True),
}
files = {key: [] for key in spec}
roots = set()
try:
    with tarfile.open(fileobj=reader, mode="r|*") as archive:
        for member in archive:
            name = member.name.rstrip("/")
            for key, (prefix, directory) in spec.items():
                if name != prefix and not (directory and name.startswith(prefix + "/")):
                    continue
                if name == prefix: roots.add(key)
                if member.isfile():
                    source = archive.extractfile(member)
                    if source is None: raise ValueError("member")
                    digest = hashlib.sha256()
                    while True:
                        chunk = source.read(131072)
                        if not chunk: break
                        digest.update(chunk)
                    files[key].append((name, digest.hexdigest()))
                elif not member.isdir():
                    raise ValueError("member")
                break
except (OSError, tarfile.TarError, ValueError):
    raise SystemExit(1)
for key, (_, directory) in spec.items():
    if key not in roots or not files[key]: raise SystemExit(1)
def component_digest(key):
    if not spec[key][1]: return files[key][0][1]
    value = hashlib.sha256()
    for name, digest in sorted(files[key]):
        value.update(name.encode("utf-8")); value.update(b"\0")
        value.update(digest.encode("ascii")); value.update(b"\n")
    return value.hexdigest()
print("\t".join([reader.whole.hexdigest()] + [component_digest(key) for key in spec]))
')" || fail_state BUNDLE_READBACK_FAILED
IFS=$'\t' read -r stream_checksum component_postgres_dump_checksum component_sites_checksum component_platform_caddy_data_checksum component_platform_caddy_config_checksum component_shared_edge_caddyfile_checksum component_shared_edge_caddy_data_checksum component_shared_edge_caddy_config_checksum <<< "$bundle_checksums"
require_digest "$stream_checksum" || fail_state BUNDLE_CHECKSUM_INVALID
for component_checksum in "$component_postgres_dump_checksum" "$component_sites_checksum" "$component_platform_caddy_data_checksum" "$component_platform_caddy_config_checksum" "$component_shared_edge_caddyfile_checksum" "$component_shared_edge_caddy_data_checksum" "$component_shared_edge_caddy_config_checksum"; do
  require_digest "$component_checksum" || fail_state COMPONENT_CHECKSUM_INVALID
done
repository_identity_after="$(read_repository_identity)"
[[ "$repository_identity_after" == "$repository_identity_before" ]] || fail_state REPOSITORY_ID_MISMATCH
validate_backup_attestations "$repository_identity_after" || fail_state ATTESTATION_INVALID
artifact_path="$snapshot_dir/catering-backup-artifact-$run_id"
artifact_payload="status=artifact
scope=$BACKUP_SCOPE
host_binding=$host_digest
source_commit=$CATERING_BACKUP_SOURCE_COMMIT
source_tree=$CATERING_BACKUP_SOURCE_TREE
secret_recovery_reference_sha256=$CATERING_SECRET_RECOVERY_REFERENCE_SHA256
restore_postgres_image=$CATERING_RESTORE_POSTGRES_IMAGE
bundle_path=$bundle_path
bundle_checksum=$stream_checksum
manifest_path=manifest
manifest_checksum=$manifest_checksum
postgres_dump_path=postgres_dump
component_postgres_dump_checksum=$component_postgres_dump_checksum
component_caddy_stream_checksum=$stream_checksum
component_sites_checksum=$component_sites_checksum
component_platform_caddy_data_checksum=$component_platform_caddy_data_checksum
component_platform_caddy_config_checksum=$component_platform_caddy_config_checksum
component_shared_edge_caddyfile_checksum=$component_shared_edge_caddyfile_checksum
component_shared_edge_caddy_data_checksum=$component_shared_edge_caddy_data_checksum
component_shared_edge_caddy_config_checksum=$component_shared_edge_caddy_config_checksum
"
atomic_write_record "$artifact_path" "$artifact_payload"
repository_identity="$repository_identity_after"
artifact_checksum="$(printf '%s' "$artifact_payload" | sha256sum | awk '{print $1}')"
repository_identity_before_candidate="$(read_repository_identity)"
[[ "$repository_identity_before_candidate" == "$repository_identity" ]] || fail_state REPOSITORY_ID_MISMATCH
validate_backup_attestations "$repository_identity_before_candidate" || fail_state ATTESTATION_INVALID

candidate_payload="status=candidate
scope=$BACKUP_SCOPE
host_binding=$host_digest
source_commit=$CATERING_BACKUP_SOURCE_COMMIT
source_tree=$CATERING_BACKUP_SOURCE_TREE
snapshot_id=$snapshot_id
repository_identity=$repository_identity
artifact_path=$artifact_path
artifact_checksum=$artifact_checksum
bundle_path=$bundle_path
bundle_checksum=$stream_checksum
secret_recovery_reference_sha256=$CATERING_SECRET_RECOVERY_REFERENCE_SHA256
restore_postgres_image=$CATERING_RESTORE_POSTGRES_IMAGE
created_at=$backup_started_at
status_timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
"
candidate_path="$candidate_dir/catering-backup-candidate-$run_id"
atomic_write_record "$candidate_path" "$candidate_payload"
candidate_checksum="$(printf '%s' "$candidate_payload" | sha256sum | awk '{print $1}')"
repository_identity_before_pointer="$(read_repository_identity)"
[[ "$repository_identity_before_pointer" == "$repository_identity" ]] || fail_state REPOSITORY_ID_MISMATCH
validate_backup_attestations "$repository_identity_before_pointer" || fail_state ATTESTATION_INVALID
candidate_pointer="status=pointer
candidate_path=$candidate_path
candidate_checksum=$candidate_checksum
created_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
"
# shellcheck disable=SC2153 # CANDIDATE_POINTER is exported by the common primitive.
atomic_write_record "$CANDIDATE_POINTER" "$candidate_pointer"
printf 'BACKUP_CANDIDATE\t%s\n' "$candidate_path"
