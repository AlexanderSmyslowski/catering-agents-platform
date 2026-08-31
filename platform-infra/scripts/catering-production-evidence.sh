#!/usr/bin/env bash
set -euo pipefail

readonly EXPECTED_PROJECT="catering-agents-platform"
readonly BACKUP_EVIDENCE_PATH="/var/lib/catering-backup/catering-backup-evidence"

: "${CATERING_EVIDENCE_SSH_KEY:?CATERING_EVIDENCE_SSH_KEY is required}"
: "${CATERING_EVIDENCE_SSH_KNOWN_HOSTS:?CATERING_EVIDENCE_SSH_KNOWN_HOSTS is required}"
: "${HETZNER_DEPLOY_HOST:?HETZNER_DEPLOY_HOST is required}"
: "${HETZNER_DEPLOY_USER:?HETZNER_DEPLOY_USER is required}"

readonly REMOTE="$HETZNER_DEPLOY_USER@$HETZNER_DEPLOY_HOST"

parse_remote_record() {
  local record_type="${1-}" encoded="${2-}" decoded canonical
  [[ "$#" == 2 ]] || return 1
  case "$record_type" in
    CONTAINER|MOUNT|VOLUME|NETWORK|MEMBER|UNIT|UNIT_STATE|DATA_ROOT|SAFE_ID|CHECKSUM|UTC|UTC_AS_OF|FACT|PROBE_STATUS|PROBE_ERROR) ;;
    *) return 1 ;;
  esac
  [[ "$encoded" =~ ^[A-Za-z0-9+/]+={0,2}$ ]] || return 1
  decoded="$(printf '%s' "$encoded" | base64 --decode 2>/dev/null)" || return 1
  canonical="$(printf '%s' "$decoded" | base64 | tr -d '\n')" || return 1
  [[ "$encoded" == "$canonical" ]] || return 1
  [[ "$decoded" != *$'\t'* && "$decoded" != *$'\n'* && "$decoded" != *$'\r'* ]] || return 1
  printf '%s\t%s' "$record_type" "$decoded"
}

# Keep cardinality validation in the same local parser that consumes the
# remote protocol.  The remote probe only emits records; it must not own a
# second interpretation of their identity.
record_identity() {
  local record_type="${1-}" record_key="${2-}" record_value="${3-}"
  local first second third fourth
  case "$record_type" in
    MOUNT)
      IFS=: read -r first second third fourth <<< "$record_value"
      printf '%s|%s|%s|%s|%s' "$record_type" "$record_key" "$first" "$second" "$third:$fourth" ;;
    VOLUME)
      first="${record_value%%:*}"
      printf '%s|%s|%s' "$record_type" "$record_key" "$first" ;;
    MEMBER)
      first="${record_value%%:*}"
      printf '%s|%s|%s' "$record_type" "$record_key" "$first" ;;
    UNIT)
      printf '%s|%s|%s' "$record_type" "$record_key" "$record_value" ;;
    UNIT_STATE)
      first="${record_value%%=*}"
      printf '%s|%s|%s' "$record_type" "$record_key" "$first" ;;
    *) return 1 ;;
  esac
}

register_record() {
  local record_type="${1-}" record_key="${2-}" record_value="${3-}" identity
  local first second third fourth remainder
  local index
  case "$record_type" in
    MOUNT|VOLUME|MEMBER|UNIT|UNIT_STATE)
      [[ -n "$record_key" && -n "$record_value" && "$record_value" != *$'\t'* && "$record_value" != *$'\n'* && "$record_value" != *$'\r'* ]] || return 1
      case "$record_type" in
        MOUNT)
          IFS=: read -r first second third fourth remainder <<< "$record_value"
          [[ -n "$first" && -n "$second" && -n "$third" && -n "$fourth" && -z "${remainder-}" ]] || return 1
          ;;
        VOLUME)
          first="${record_value%%:*}"
          [[ -n "$first" && "$record_value" == *:* ]] || return 1
          ;;
        MEMBER)
          first="${record_value%%:*}"
          [[ "$first" =~ ^[0-9a-fA-F]{64}$ && "$record_value" == *:* ]] || return 1
          ;;
        UNIT)
          [[ "$record_value" =~ ^[A-Za-z0-9_.:-]+$ ]] || return 1
          ;;
        UNIT_STATE)
          first="${record_value%%=*}"
          [[ -n "$first" && "$record_value" == *=* ]] || return 1
          [[ "$first" =~ ^[A-Za-z0-9_.:-]+$ ]] || return 1
          ;;
      esac
      identity="$(record_identity "$record_type" "$record_key" "$record_value")" || return 1
      for index in "${!seen_set_identities[@]}"; do
        if [[ "${seen_set_identities[$index]}" == "$identity" ]]; then
          [[ "${seen_set_values[$index]}" == "$record_value" ]] || return 1
          return 1
        fi
      done
      seen_set_identities+=("$identity")
      seen_set_values+=("$record_value")
      ;;
    *) return 0 ;;
  esac
}

classify_backup_evidence() {
  local success=${BACKUP_EVIDENCE_SUCCESS-false}
  local scope_ok=${BACKUP_SCOPE_OK-false}
  local host_bound=${BACKUP_HOST_BOUND-false}
  local artifact_bound=${BACKUP_ARTIFACT_BOUND-false}
  local repository_bound=${BACKUP_REPOSITORY_BOUND-false}
  if [[ "$success" == true && "$scope_ok" == true && "$host_bound" == true && "$artifact_bound" == true && "$repository_bound" == true ]]; then
    printf 'CLASSIFICATION\tbackup_channel\tBELEGT\n'
  else
    printf 'CLASSIFICATION\tbackup_channel\tNICHT BELEGT\n'
  fi
}

emit_classifications() {
  printf 'CLASSIFICATION\tpersistence\t%s\n' "$PERSISTENCE_STATUS"
  printf 'CLASSIFICATION\tdata_root\t%s\n' "$DATA_ROOT_STATUS"
  classify_backup_evidence
  printf 'CLASSIFICATION\tcaddy_shared_edge\t%s\n' "$CADDY_STATUS"
  printf 'CLASSIFICATION\tconfig_secrets\t%s\n' "$SECRETS_STATUS"
}

classify_remote_failure() {
  local remote_status="${1-}" remote_output="${2-}"
  local record_type record_key encoded extra parsed decoded
  if [[ "$remote_status" == 255 ]]; then
    printf '%s' REMOTE_TRANSPORT_FAILED
    return 0
  fi
  if [[ -z "$remote_output" ]]; then
    if [[ "$remote_status" == 0 ]]; then
      printf '%s' REMOTE_OUTPUT_EMPTY
    else
      printf '%s' REMOTE_TRANSPORT_FAILED
    fi
    return 0
  fi
  if [[ "$remote_output" == *$'\n'* ]]; then
    printf '%s' REMOTE_OUTPUT_INVALID
    return 0
  fi
  IFS=$'\t' read -r record_type record_key encoded extra <<< "$remote_output"
  if [[ "$record_type" != PROBE_ERROR || -z "$record_key" || -z "$encoded" || -n "$extra" ]]; then
    printf '%s' REMOTE_OUTPUT_INVALID
    return 0
  fi
  if ! [[ "$record_key" =~ ^(persistence|data_root|backup_channel|caddy_shared_edge|config_secrets)$ ]]; then
    printf '%s' REMOTE_OUTPUT_INVALID
    return 0
  fi
  if ! parsed="$(parse_remote_record "$record_type" "$encoded")"; then
    printf '%s' REMOTE_OUTPUT_INVALID
    return 0
  fi
  decoded="${parsed#*$'\t'}"
  [[ -n "$decoded" ]] || {
    printf '%s' REMOTE_OUTPUT_INVALID
    return 0
  }
  if [[ "$remote_status" == 0 ]]; then
    printf '%s' REMOTE_OUTPUT_INVALID
  else
    printf 'REMOTE_PROBE_FAILED:%s' "$record_key"
  fi
}

emit_failure_class() {
  local failure_class="${1-REMOTE_OUTPUT_INVALID}"
  case "$failure_class" in
    REMOTE_TRANSPORT_FAILED|REMOTE_OUTPUT_EMPTY|REMOTE_OUTPUT_INVALID) ;;
    REMOTE_PROBE_FAILED:*)
      [[ "${failure_class#REMOTE_PROBE_FAILED:}" =~ ^(persistence|data_root|backup_channel|caddy_shared_edge|config_secrets)$ ]] || failure_class=REMOTE_OUTPUT_INVALID
      ;;
    *) failure_class=REMOTE_OUTPUT_INVALID ;;
  esac
  printf 'EVIDENCE_ERROR\t%s\n' "$failure_class"
}

fail_closed() {
  emit_failure_class "${1-REMOTE_OUTPUT_INVALID}"
  printf 'EVIDENCE_STATUS\tUNKNOWN\n'
  return 1
}

remote_evidence() {
  ssh -i "$CATERING_EVIDENCE_SSH_KEY" \
    -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes \
    -o UserKnownHostsFile="$CATERING_EVIDENCE_SSH_KNOWN_HOSTS" \
    -o ConnectTimeout=10 -p 22 -- "$REMOTE" bash -s -- "$EXPECTED_PROJECT" "$BACKUP_EVIDENCE_PATH" "/var/lib/catering-backup/catering-backup-repository-status" <<'REMOTE_EVIDENCE'
set -euo pipefail
readonly EXPECTED_PROJECT="$1"
readonly BACKUP_EVIDENCE_PATH="$2"
readonly BACKUP_REPOSITORY_READONLY_STATUS_PATH="$3"
encode_field() {
  [[ "$1" != *$'\t'* && "$1" != *$'\n'* && "$1" != *$'\r'* ]] || return 1
  printf '%s' "$1" | base64 | tr -d '\n'
}
emit() {
  local record_type="$1" record_key="$2" record_value="$3" encoded
  [[ "$record_type" =~ ^[A-Z_]+$ ]] || return 1
  [[ "$record_key" =~ ^[A-Za-z0-9_.:-]+$ ]] || return 1
  encoded="$(encode_field "$record_value")" || return 1
  printf '%s\t%s\t%s\n' "$record_type" "$record_key" "$encoded"
}
probe_error() {
  local probe_key
  probe_key="$(canonical_probe_key "${1-}")" || exit 1
  emit PROBE_ERROR "$probe_key" "${2-}"
  exit 1
}
canonical_probe_key() {
  case "${1-}" in
    persistence|data_root|backup_channel|caddy_shared_edge|config_secrets)
      printf '%s' "$1" ;;
    data-root:*)
      printf '%s' data_root ;;
    edge_volumes|edge-volume:*)
      printf '%s' caddy_shared_edge ;;
    timers|services|service-state:*|host_identity|backup_clock|backup_evidence|backup_artifact|backup_repository|command_sha256sum|command_hostname|command_date|command_restic)
      printf '%s' backup_channel ;;
    command_docker|command_systemctl|command_findmnt|command_mount|command_ss|command_stat|command_realpath|command_readlink|command_find|command_base64|command_tr|containers|platform_volumes|inspect:*|service:*|mounts:*|volume:*|network_list|network:*|members:*)
      printf '%s' persistence ;;
    *)
      return 1 ;;
  esac
}
safe_token() { [[ "$1" =~ ^[A-Za-z0-9_.:-]+$ ]]; }
safe_path() { [[ "$1" =~ ^[A-Za-z0-9_./:@+-]+$ ]]; }
safe_member() { [[ "$1" =~ ^[A-Za-z0-9_.:,-]+$ ]]; }

# Bind the path once, then use the resulting descriptor for every read.  The
# device/inode readback makes a path replacement observable while preserving a
# stable handle for the data that was authenticated.
bind_readonly_source() {
  local path="${1-}" expected_uid="${2-}" expected_mode="${3-}" fd fd_meta path_meta path_before
  local path_before_type path_before_device path_before_inode
  local path_type path_device path_inode
  local fd_type fd_mode fd_uid fd_gid fd_device fd_inode
  [[ "$path" == /* && "$path" != *$'\t'* && "$path" != *$'\n'* && "$path" != *$'\r'* ]] || return 1
  [[ ! -L "$path" ]] || return 1
  if ! path_before="$(stat --format '%F:%d:%i' "$path" 2>/dev/null)"; then
    return 1
  fi
  IFS=: read -r path_before_type path_before_device path_before_inode <<< "$path_before"
  [[ "$path_before_type" == "regular file" ]] || return 1
  exec {fd}<"$path" || return 1
  if ! fd_meta="$(stat --format '%F:%a:%u:%g:%d:%i' "/dev/fd/$fd" 2>/dev/null)"; then
    exec {fd}<&-
    return 1
  fi
  IFS=: read -r fd_type fd_mode fd_uid fd_gid fd_device fd_inode <<< "$fd_meta"
  if ! [[ "$fd_type" == "regular file" && "$fd_uid" == "$expected_uid" && "$fd_mode" == "$expected_mode" ]]; then
    exec {fd}<&-
    return 1
  fi
  if [[ -L "$path" ]]; then
    exec {fd}<&-
    return 1
  fi
  if ! path_meta="$(stat --format '%F:%d:%i' "$path" 2>/dev/null)"; then
    exec {fd}<&-
    return 1
  fi
  IFS=: read -r path_type path_device path_inode <<< "$path_meta"
  if ! [[ "$path_type" == "regular file" && "$path_before_device:$path_before_inode" == "$path_device:$path_inode" && "$fd_device:$fd_inode" == "$path_device:$path_inode" ]]; then
    exec {fd}<&-
    return 1
  fi
  BOUND_SOURCE_FD="$fd"
  BOUND_SOURCE_DEVICE="$fd_device"
  BOUND_SOURCE_INODE="$fd_inode"
  BOUND_SOURCE_META="$fd_type:$fd_mode:$fd_uid:$fd_gid:$BOUND_SOURCE_DEVICE:$BOUND_SOURCE_INODE"
}

for command_name in docker systemctl findmnt mount ss stat realpath readlink find sha256sum hostname date base64 tr restic; do
  if command -v "$command_name" >/dev/null 2>&1; then
    emit FACT "command_$command_name" available
    emit PROBE_STATUS "command_$command_name" success
  else
    emit FACT "command_$command_name" missing
    case "$command_name" in
      restic) emit PROBE_STATUS "command_$command_name" absent ;;
      *) probe_error "command_$command_name" unavailable ;;
    esac
  fi
done

if ! containers="$(docker ps --filter label=com.docker.compose.project=platform-infra --format '{{.Names}}' 2>/dev/null)"; then
  probe_error containers command_failed
fi
emit PROBE_STATUS containers success
postgres_seen=false
data_root_status=unknown
container_count=0
while IFS= read -r container_name; do
  [[ -n "$container_name" ]] || continue
  safe_token "$container_name" || probe_error containers invalid_name
  container_count=$((container_count + 1))
  if ! inspect_line="$(docker inspect --format '{{printf "%s:%s:%s:%s" .Id .RestartCount .State.Status .Config.Image}}' "$container_name" 2>/dev/null)"; then
    probe_error "inspect:$container_name" command_failed
  fi
  emit PROBE_STATUS "inspect:$container_name" success
  [[ -n "$inspect_line" && "$inspect_line" != *$'\n'* && "$inspect_line" != *$'\r'* ]] || probe_error "inspect:$container_name" malformed
  emit CONTAINER "$container_name" "$inspect_line"
  if ! service_name="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.service"}}' "$container_name" 2>/dev/null)"; then
    probe_error "service:$container_name" command_failed
  fi
  emit PROBE_STATUS "service:$container_name" success
  [[ "$service_name" == postgres ]] && postgres_seen=true
  safe_token "$service_name" || probe_error "service:$container_name" missing
  emit SAFE_ID "$container_name"_service "$service_name"
  if ! mounts="$(docker inspect --format '{{range .Mounts}}{{printf "%s:%s:%s:%s" .Type .Name .Source .Destination}}{{"\n"}}{{end}}' "$container_name" 2>/dev/null)"; then
    probe_error "mounts:$container_name" command_failed
  fi
  emit PROBE_STATUS "mounts:$container_name" success
  while IFS=: read -r mount_type mount_name mount_source mount_destination; do
    [[ -n "$mount_type" ]] || continue
    safe_token "$mount_type" && safe_token "$mount_name" && safe_path "$mount_source" && safe_path "$mount_destination" || probe_error "mounts:$container_name" malformed
    emit MOUNT "$container_name" "$mount_type:$mount_name:$mount_source:$mount_destination"
  done <<< "$mounts"
  if ! data_root_lines="$(docker inspect --format '{{range .Config.Env}}{{if contains . "CATERING_DATA_ROOT="}}{{println .}}{{end}}{{end}}' "$container_name" 2>/dev/null)"; then
    probe_error "data-root:$container_name" command_failed
  fi
  emit PROBE_STATUS "data-root:$container_name" success
  data_root_count=0
  data_root_value=
  while IFS= read -r data_root_line; do
    [[ -n "$data_root_line" ]] || continue
    data_root_count=$((data_root_count + 1))
    [[ "$data_root_line" == CATERING_DATA_ROOT=* ]] || probe_error "data-root:$container_name" malformed
    data_root_value=${data_root_line#CATERING_DATA_ROOT=}
  done <<< "$data_root_lines"
  if [[ "$data_root_count" == 1 ]] && safe_path "$data_root_value"; then
    data_root_status=unmatched
    while IFS=: read -r mount_type mount_name mount_source mount_destination; do
      [[ "$mount_destination" == "$data_root_value" ]] && data_root_status=matched
    done <<< "$mounts"
    [[ "$data_root_status" == matched ]] && emit DATA_ROOT "$container_name" "$data_root_value"
  elif [[ "$data_root_count" == 0 ]]; then
    data_root_status=absent
  else
    data_root_status=ambiguous
  fi
done <<< "$containers"
emit FACT postgres_seen "$postgres_seen"
emit FACT persistence_container_count "$container_count"
emit FACT data_root_status "$data_root_status"

if ! volumes="$(docker volume ls --filter label=com.docker.compose.project=platform-infra --format '{{.Name}}' 2>/dev/null)"; then
  probe_error platform_volumes command_failed
fi
emit PROBE_STATUS platform_volumes success
expected_volumes=0
while IFS= read -r volume_name; do
  [[ -n "$volume_name" ]] || continue
  safe_token "$volume_name" || probe_error platform_volumes invalid_name
  if ! volume_line="$(docker volume inspect --format '{{printf "%s:%s:%s" .Name .Driver .Mountpoint}}' "$volume_name" 2>/dev/null)"; then
    probe_error "volume:$volume_name" command_failed
  fi
  emit PROBE_STATUS "volume:$volume_name" success
  [[ -n "$volume_line" && "$volume_line" != *$'\n'* && "$volume_line" != *$'\r'* ]] || probe_error "volume:$volume_name" malformed
  emit VOLUME platform "$volume_line"
  case "$volume_name" in *postgres_data|*caddy_data|*caddy_config) expected_volumes=$((expected_volumes + 1));; esac
done <<< "$volumes"
emit FACT platform_expected_volume_count "$expected_volumes"

if ! edge_volumes="$(docker volume ls --filter label=com.docker.compose.project=shared-edge --format '{{.Name}}' 2>/dev/null)"; then
  probe_error edge_volumes command_failed
fi
emit PROBE_STATUS edge_volumes success
edge_volume_count=0
while IFS= read -r volume_name; do
  [[ -n "$volume_name" ]] || continue
  safe_token "$volume_name" || probe_error edge_volumes invalid_name
  edge_volume_count=$((edge_volume_count + 1))
  if ! volume_line="$(docker volume inspect --format '{{printf "%s:%s:%s" .Name .Driver .Mountpoint}}' "$volume_name" 2>/dev/null)"; then
    probe_error "edge-volume:$volume_name" command_failed
  fi
  emit PROBE_STATUS "edge-volume:$volume_name" success
  [[ -n "$volume_line" && "$volume_line" != *$'\n'* && "$volume_line" != *$'\r'* ]] || probe_error "edge-volume:$volume_name" malformed
  emit VOLUME shared_edge "$volume_line"
done <<< "$edge_volumes"
emit FACT edge_volume_count "$edge_volume_count"

if ! network_names="$(docker network ls --format '{{.Name}}' 2>/dev/null)"; then
  probe_error network_list command_failed
fi
emit PROBE_STATUS network_list success
for network_name in platform-infra_default zeiterfassung_default catering_ingress catering_private deploy_default commcats-eventos_default; do
  network_present=false
  while IFS= read -r listed_network; do
    [[ -n "$listed_network" ]] || continue
    safe_token "$listed_network" || probe_error network_list malformed
    [[ "$listed_network" == "$network_name" ]] && network_present=true
  done <<< "$network_names"
  if [[ "$network_present" != true ]]; then
    emit PROBE_STATUS "network:$network_name" absent
    continue
  fi
  if ! network_line="$(docker network inspect --format '{{printf "%s:%s:%s:%s" .Name .Id .Driver .Scope}}' "$network_name" 2>/dev/null)"; then
    probe_error "network:$network_name" command_failed
  fi
  emit PROBE_STATUS "network:$network_name" success
  [[ -n "$network_line" && "$network_line" != *$'\n'* && "$network_line" != *$'\r'* ]] || probe_error "network:$network_name" malformed
  emit NETWORK "$network_name" "$network_line"
  if ! members="$(docker network inspect --format '{{range $id, $container := .Containers}}{{printf "%s:%s:%s" $id $container.Name (join $container.Aliases ",")}}{{"\n"}}{{end}}' "$network_name" 2>/dev/null)"; then
    probe_error "members:$network_name" command_failed
  fi
  emit PROBE_STATUS "members:$network_name" success
  while IFS=: read -r member_id member_name member_aliases; do
    [[ -n "$member_id" ]] || continue
    [[ "$member_id" =~ ^[0-9a-fA-F]{64}$ ]] || probe_error "members:$network_name" malformed
    safe_token "$member_name" && safe_member "$member_aliases" || probe_error "members:$network_name" malformed
    emit MEMBER "$network_name" "$member_id:$member_name:$member_aliases"
  done <<< "$members"
done

if ! timers="$(systemctl list-timers --all --no-legend --no-pager 2>/dev/null)"; then
  probe_error timers command_failed
fi
emit PROBE_STATUS timers success
backup_timer_active=false
while IFS= read -r timer_line; do
  read -r timer_name _ <<< "$timer_line"
  case "$timer_name" in
    *backup*|*restic*|*borg*|*rclone*|*catering*)
      safe_token "$timer_name" || probe_error timers malformed
      emit UNIT timer "$timer_name"
      backup_timer_active=true
      ;;
  esac
done <<< "$timers"
emit FACT backup_timer_active "$backup_timer_active"

if ! services="$(systemctl list-unit-files --type=service --no-legend --no-pager 2>/dev/null)"; then
  probe_error services command_failed
fi
emit PROBE_STATUS services success
while IFS= read -r service_line; do
  read -r unit_name _ <<< "$service_line"
  case "$unit_name" in
    *backup*|*restic*|*borg*|*rclone*|*catering*)
      safe_token "$unit_name" || probe_error services malformed
      emit UNIT service "$unit_name"
      if ! state="$(systemctl show --no-pager --property=Id,LoadState,ActiveState,SubState,ExecMainStatus "$unit_name" 2>/dev/null)"; then
        probe_error "service-state:$unit_name" command_failed
      fi
      emit PROBE_STATUS "service-state:$unit_name" success
      while IFS= read -r state_line; do
        case "$state_line" in
          Id=*|LoadState=*|ActiveState=*|SubState=*|ExecMainStatus=*)
            state_key=${state_line%%=*}; state_value=${state_line#*=}
            safe_token "$state_key" && safe_path "$state_value" || probe_error "service-state:$unit_name" malformed
            emit UNIT_STATE "$unit_name" "$state_key=$state_value"
            ;;
        esac
      done <<< "$state"
      ;;
  esac
done <<< "$services"

backup_success=false
backup_scope_ok=false
backup_host_bound=false
backup_artifact_bound=false
backup_repository_bound=false
backup_timestamp=absent
if bind_readonly_source "$BACKUP_EVIDENCE_PATH" 0 600; then
  evidence_fd="$BOUND_SOURCE_FD"
  evidence_meta="$BOUND_SOURCE_META"
  declare -A evidence_values=() evidence_counts=()
  if ! while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" == *=* && "$line" != *$'\t'* && "$line" != *$'\n'* && "$line" != *$'\r'* ]] || probe_error backup_evidence malformed
    field=${line%%=*}
    value=${line#*=}
    case "$field" in
      status|project|scope|host_binding|created_at|snapshot_id|checksum|artifact_path|artifact_snapshot_id|artifact_checksum|artifact_host_binding|artifact_scope|artifact_created_at|repository_identity|repository_status)
        evidence_counts["$field"]=$(( ${evidence_counts["$field"]:-0} + 1 ))
        evidence_values["$field"]="$value"
        ;;
      *) probe_error backup_evidence unexpected_field ;;
    esac
  done <&"$evidence_fd"; then
    probe_error backup_evidence read_failed
  fi
  if ! evidence_readback="$(stat --format '%F:%a:%u:%g:%d:%i' "/dev/fd/$evidence_fd" 2>/dev/null)"; then
    exec {evidence_fd}<&-
    probe_error backup_evidence readback_failed
  fi
  [[ "$evidence_readback" == "$evidence_meta" ]] || {
    exec {evidence_fd}<&-
    probe_error backup_evidence identity_drift
  }
  exec {evidence_fd}<&-
  for field in status project scope host_binding created_at snapshot_id checksum; do
    [[ "${evidence_counts[$field]:-0}" == 1 ]] || probe_error backup_evidence missing_field
  done
  backup_status="${evidence_values[status]}"
  backup_project="${evidence_values[project]}"
  backup_scope="${evidence_values[scope]}"
  backup_host="${evidence_values[host_binding]}"
  backup_timestamp="${evidence_values[created_at]}"
  backup_snapshot="${evidence_values[snapshot_id]}"
  backup_checksum="${evidence_values[checksum]}"
  if ! host_name="$(hostname 2>/dev/null)"; then
    probe_error host_identity command_failed
  fi
  if ! host_digest="$(printf '%s' "$host_name" | sha256sum | { read -r digest _; printf '%s' "$digest"; })"; then
    probe_error host_identity digest_failed
  fi
  emit PROBE_STATUS host_identity success
  [[ "$backup_status" == success && "$backup_project" == "$EXPECTED_PROJECT" && "$backup_scope" == postgres,data,sites,shared-edge && "$backup_host" == "$host_digest" && "$backup_timestamp" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ && "$backup_snapshot" =~ ^[A-Za-z0-9_.:-]+$ && "$backup_checksum" =~ ^[0-9a-f]{64}$ ]] || probe_error backup_evidence invalid_fields
  artifact_field_count=0
  for field in artifact_path artifact_snapshot_id artifact_checksum artifact_host_binding artifact_scope artifact_created_at repository_identity repository_status; do
    artifact_field_count=$((artifact_field_count + ${evidence_counts[$field]:-0}))
  done
  if [[ "$artifact_field_count" == 0 ]]; then
    emit PROBE_STATUS backup_artifact absent
    emit PROBE_STATUS backup_repository absent
  elif [[ "$artifact_field_count" != 8 ]]; then
    probe_error backup_artifact incomplete_binding
  else
    artifact_path="${evidence_values[artifact_path]}"
    artifact_snapshot_id="${evidence_values[artifact_snapshot_id]}"
    artifact_checksum="${evidence_values[artifact_checksum]}"
    artifact_host_binding="${evidence_values[artifact_host_binding]}"
    artifact_scope="${evidence_values[artifact_scope]}"
    artifact_created_at="${evidence_values[artifact_created_at]}"
    repository_identity="${evidence_values[repository_identity]}"
    repository_status="${evidence_values[repository_status]}"
    [[ "$artifact_path" =~ ^/var/lib/catering-backup/snapshots/[A-Za-z0-9_.:-]+$ && "$artifact_snapshot_id" == "$backup_snapshot" && "$artifact_checksum" == "$backup_checksum" && "$artifact_host_binding" == "$host_digest" && "$artifact_scope" == "$backup_scope" && "$artifact_created_at" == "$backup_timestamp" && "$repository_identity" =~ ^[0-9a-f]{64}$ && "$repository_status" == read-only-verified ]] || probe_error backup_artifact invalid_binding
    if ! bind_readonly_source "$artifact_path" 0 600; then
      probe_error backup_artifact unreadable_or_unbound
    fi
    artifact_fd="$BOUND_SOURCE_FD"
    artifact_meta="$BOUND_SOURCE_META"
    if ! artifact_readback="$(sha256sum "/dev/fd/$artifact_fd" 2>/dev/null)"; then
      exec {artifact_fd}<&-
      probe_error backup_artifact read_failed
    fi
    artifact_actual_checksum=${artifact_readback%% *}
    if ! artifact_meta_readback="$(stat --format '%F:%a:%u:%g:%d:%i' "/dev/fd/$artifact_fd" 2>/dev/null)"; then
      exec {artifact_fd}<&-
      probe_error backup_artifact readback_failed
    fi
    [[ "$artifact_meta_readback" == "$artifact_meta" && "$artifact_actual_checksum" == "$artifact_checksum" ]] || {
      exec {artifact_fd}<&-
      probe_error backup_artifact checksum_or_identity_drift
    }
    exec {artifact_fd}<&-
    emit PROBE_STATUS backup_artifact success
    if bind_readonly_source "$BACKUP_REPOSITORY_READONLY_STATUS_PATH" 0 600; then
      repository_fd="$BOUND_SOURCE_FD"
      repository_meta="$BOUND_SOURCE_META"
      declare -A repository_values=() repository_counts=()
      if ! while IFS= read -r line || [[ -n "$line" ]]; do
        [[ "$line" == *=* && "$line" != *$'\t'* && "$line" != *$'\n'* && "$line" != *$'\r'* ]] || probe_error backup_repository malformed
        field=${line%%=*}
        value=${line#*=}
        case "$field" in
          status|identity|snapshot_id|checksum|host_binding|scope|verified_at)
            repository_counts["$field"]=$(( ${repository_counts["$field"]:-0} + 1 ))
            repository_values["$field"]="$value"
            ;;
          *) probe_error backup_repository unexpected_field ;;
        esac
      done <&"$repository_fd"; then
        exec {repository_fd}<&-
        probe_error backup_repository read_failed
      fi
      if ! repository_readback="$(stat --format '%F:%a:%u:%g:%d:%i' "/dev/fd/$repository_fd" 2>/dev/null)"; then
        exec {repository_fd}<&-
        probe_error backup_repository readback_failed
      fi
      [[ "$repository_readback" == "$repository_meta" ]] || {
        exec {repository_fd}<&-
        probe_error backup_repository identity_drift
      }
      exec {repository_fd}<&-
      for field in status identity snapshot_id checksum host_binding scope verified_at; do
        [[ "${repository_counts[$field]:-0}" == 1 ]] || probe_error backup_repository missing_field
      done
      [[ "${repository_values[status]}" == read-only-verified && "${repository_values[identity]}" == "$repository_identity" && "${repository_values[snapshot_id]}" == "$backup_snapshot" && "${repository_values[checksum]}" == "$backup_checksum" && "${repository_values[host_binding]}" == "$host_digest" && "${repository_values[scope]}" == "$backup_scope" && "${repository_values[verified_at]}" == "$backup_timestamp" ]] || probe_error backup_repository binding_drift
      restic_repository_match=false
      restic_snapshot_match=false
      if command -v restic >/dev/null 2>&1 && command -v python3 >/dev/null 2>&1; then
        if restic_config_json="$(restic cat config --json --no-lock 2>/dev/null)" && restic_snapshot_json="$(restic snapshots --json --no-lock 2>/dev/null)"; then
          if restic_repository_id="$(printf '%s' "$restic_config_json" | python3 -c 'import json,sys; value=json.load(sys.stdin).get("id", ""); print(value if isinstance(value, str) else "")' 2>/dev/null)"; then
            [[ "$restic_repository_id" == "$repository_identity" ]] && restic_repository_match=true
          fi
          if restic_snapshot_id="$(printf '%s' "$restic_snapshot_json" | python3 -c 'import json,sys; expected=sys.argv[1]; rows=json.load(sys.stdin); print("true" if any(isinstance(row, dict) and row.get("id") == expected for row in rows) else "false")' "$backup_snapshot" 2>/dev/null)"; then
            [[ "$restic_snapshot_id" == true ]] && restic_snapshot_match=true
          fi
        fi
      fi
      if [[ "$restic_repository_match" == true && "$restic_snapshot_match" == true ]]; then
        backup_repository_bound=true
        emit PROBE_STATUS backup_repository success
      else
        emit PROBE_STATUS backup_repository unavailable
      fi
    else
      if [[ -e "$BACKUP_REPOSITORY_READONLY_STATUS_PATH" || -L "$BACKUP_REPOSITORY_READONLY_STATUS_PATH" ]]; then
        probe_error backup_repository unreadable
      fi
      emit PROBE_STATUS backup_repository absent
    fi
    if [[ "$backup_repository_bound" == true ]]; then
      emit PROBE_STATUS backup_evidence success
      if ! now_epoch="$(date -u +%s 2>/dev/null)"; then
        probe_error backup_clock command_failed
      fi
      if ! created_epoch="$(date -u -d "$backup_timestamp" +%s 2>/dev/null)"; then
        probe_error backup_clock parse_failed
      fi
      [[ "$now_epoch" =~ ^[0-9]+$ && "$created_epoch" =~ ^[0-9]+$ && "$created_epoch" -le "$now_epoch" ]] || probe_error backup_clock invalid_time
      emit PROBE_STATUS backup_clock success
      backup_age=$((now_epoch - created_epoch))
      if (( backup_age <= 86400 )); then
        backup_success=true
        backup_scope_ok=true
        backup_host_bound=true
        backup_artifact_bound=true
        emit SAFE_ID backup_snapshot "$backup_snapshot"
        emit SAFE_ID backup_checksum "$backup_checksum"
        emit CHECKSUM backup_checksum "$backup_checksum"
        emit UTC backup_created_at "$backup_timestamp"
        emit FACT backup_age_seconds "$backup_age"
      fi
    fi
  fi
else
  if [[ -e "$BACKUP_EVIDENCE_PATH" || -L "$BACKUP_EVIDENCE_PATH" ]]; then
    probe_error backup_evidence unreadable
  fi
  emit PROBE_STATUS backup_evidence absent
  emit PROBE_STATUS backup_artifact absent
  emit PROBE_STATUS backup_repository absent
fi
emit FACT backup_success "$backup_success"
emit FACT backup_scope_ok "$backup_scope_ok"
emit FACT backup_host_bound "$backup_host_bound"
emit FACT backup_host_binding "$backup_host_bound"
emit FACT backup_artifact_bound "$backup_artifact_bound"
emit FACT backup_repository_bound "$backup_repository_bound"
emit FACT backup_timestamp "$backup_timestamp"
emit FACT secret_source github-production-environment
emit FACT data_root_source docker-targeted-variable
REMOTE_EVIDENCE
}

remote_status=0
remote_output="$(remote_evidence 2>/dev/null)" || remote_status=$?
if [[ "$remote_status" == 255 || -z "$remote_output" ]]; then
  remote_failure="$(classify_remote_failure "$remote_status" "$remote_output")"
  fail_closed "$remote_failure"
fi

PERSISTENCE_STATUS="NICHT BELEGT"
DATA_ROOT_STATUS="NICHT BELEGT"
CADDY_STATUS="NICHT BELEGT"
SECRETS_STATUS="BETREIBERENTSCHEIDUNG NÖTIG"
BACKUP_EVIDENCE_SUCCESS=false
BACKUP_SCOPE_OK=false
BACKUP_HOST_BOUND=false
BACKUP_ARTIFACT_BOUND=false
BACKUP_REPOSITORY_BOUND=false
ambiguous=false
probe_error_seen=false
probe_error_key=""
declare -A seen_records=() seen_facts=() seen_probes=()
safe_records=()
# The record-registration arrays are consumed by the parser defined in the
# remote heredoc; keep ShellCheck from treating their local initialization as
# dead code.
# shellcheck disable=SC2034
seen_set_identities=()
# shellcheck disable=SC2034
seen_set_values=()

while IFS=$'\t' read -r record_type record_key record_value extra || [[ -n "$record_type$record_key$record_value$extra" ]]; do
  if [[ "${probe_error_seen:-false}" == true ]]; then
    ambiguous=true
    continue
  fi
  if [[ -z "$record_type" || -z "$record_key" || -z "$record_value" || -n "$extra" || ! "$record_key" =~ ^[A-Za-z0-9_.:-]+$ ]]; then
    ambiguous=true
    continue
  fi
  parsed_record="$(parse_remote_record "$record_type" "$record_value")" || {
    ambiguous=true
    continue
  }
  decoded_value=${parsed_record#*$'\t'}
  case "$record_type" in
    MOUNT|VOLUME|MEMBER|UNIT|UNIT_STATE)
      register_record "$record_type" "$record_key" "$decoded_value" || ambiguous=true
      ;;
    *)
      record_identity="$record_type:$record_key"
      if [[ "${seen_records[$record_identity]:-false}" == true ]]; then
        ambiguous=true
        continue
      fi
      seen_records["$record_identity"]=true
      ;;
  esac
  case "$record_type" in
    FACT)
      seen_facts["$record_key"]=true
      case "$record_key" in
        command_docker|command_systemctl|command_findmnt|command_mount|command_ss|command_stat|command_realpath|command_readlink|command_find|command_sha256sum|command_hostname|command_date|command_base64|command_tr)
          [[ "$decoded_value" == available ]] || ambiguous=true ;;
        command_restic)
          [[ "$decoded_value" == available || "$decoded_value" == missing ]] || ambiguous=true ;;
        postgres_seen)
          [[ "$decoded_value" == true || "$decoded_value" == false ]] || ambiguous=true
          [[ "$decoded_value" == true ]] && PERSISTENCE_STATUS="BELEGT" ;;
        persistence_container_count)
          [[ "$decoded_value" =~ ^[0-9]+$ ]] || ambiguous=true ;;
        platform_expected_volume_count)
          case "$decoded_value" in 3|4|5|6|7|8|9) ;; *) PERSISTENCE_STATUS="NICHT BELEGT"; ambiguous=true ;; esac ;;
        data_root_status)
          case "$decoded_value" in
            matched) DATA_ROOT_STATUS="BELEGT" ;;
            absent) DATA_ROOT_STATUS="NICHT BELEGT" ;;
            ambiguous|unmatched) ambiguous=true ;;
            *) ambiguous=true ;;
          esac ;;
        edge_volume_count)
          [[ "$decoded_value" =~ ^[0-9]+$ ]] || ambiguous=true
          [[ "$decoded_value" =~ ^[1-9][0-9]*$ ]] && CADDY_STATUS="BELEGT" ;;
        backup_timer_active)
          [[ "$decoded_value" == true || "$decoded_value" == false ]] || ambiguous=true ;;
        backup_success|backup_scope_ok|backup_host_bound|backup_host_binding|backup_artifact_bound|backup_repository_bound)
          [[ "$decoded_value" == true || "$decoded_value" == false ]] || ambiguous=true
          case "$record_key" in
            backup_success) BACKUP_EVIDENCE_SUCCESS="$decoded_value" ;;
            backup_scope_ok) BACKUP_SCOPE_OK="$decoded_value" ;;
            backup_host_bound|backup_host_binding) BACKUP_HOST_BOUND="$decoded_value" ;;
            backup_artifact_bound) BACKUP_ARTIFACT_BOUND="$decoded_value" ;;
            backup_repository_bound) BACKUP_REPOSITORY_BOUND="$decoded_value" ;;
          esac
          ;;
        backup_timestamp)
          [[ "$decoded_value" == absent || "$decoded_value" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]] || ambiguous=true ;;
        secret_source) [[ "$decoded_value" == github-production-environment ]] || ambiguous=true ;;
        data_root_source) [[ "$decoded_value" == docker-targeted-variable ]] || ambiguous=true ;;
        backup_age_seconds) [[ "$decoded_value" =~ ^[0-9]+$ ]] || ambiguous=true ;;
        *) ambiguous=true ;;
      esac
      ;;
    PROBE_STATUS)
      case "$record_key" in
        containers|platform_volumes|edge_volumes|network_list|timers|services|backup_evidence|backup_artifact|backup_repository|command_restic|network:*|inspect:*|service:*|mounts:*|data-root:*|volume:*|edge-volume:*|members:*|service-state:*|backup_clock|host_identity)
          case "$decoded_value" in
            success) seen_probes["$record_key"]=true ;;
            absent)
              case "$record_key" in
                network:*|backup_artifact|backup_repository|command_restic) seen_probes["$record_key"]=true ;;
                *) ambiguous=true ;;
              esac
              ;;
            unavailable)
              [[ "$record_key" == backup_repository ]] && seen_probes["$record_key"]=true || ambiguous=true
              ;;
            *) ambiguous=true ;;
          esac
          ;;
        *) ambiguous=true ;;
      esac
      ;;
    PROBE_ERROR)
      if [[ "${remote_status:-0}" == 0 || -n "${probe_error_key:-}" || ! "$record_key" =~ ^(persistence|data_root|backup_channel|caddy_shared_edge|config_secrets)$ ]]; then
        ambiguous=true
        continue
      fi
      [[ -n "$decoded_value" ]] || {
        ambiguous=true
        continue
      }
      probe_error_key="$record_key"
      probe_error_seen=true
      ;;
    CONTAINER|MOUNT|VOLUME|NETWORK|MEMBER|UNIT|UNIT_STATE|DATA_ROOT|SAFE_ID|CHECKSUM|UTC|UTC_AS_OF)
      if ! declare -p safe_records >/dev/null 2>&1; then safe_records=(); fi
      safe_records+=("$record_type"$'\t'"$record_key"$'\t'"$decoded_value")
      ;;
    *) ambiguous=true ;;
  esac
done <<< "$remote_output"

if [[ "$remote_status" != 0 ]]; then
  if [[ -n "$probe_error_key" && "$ambiguous" == false ]]; then
    fail_closed "REMOTE_PROBE_FAILED:$probe_error_key"
  fi
  fail_closed REMOTE_OUTPUT_INVALID
fi

for required_fact in command_docker command_systemctl command_findmnt command_mount command_ss command_stat command_realpath command_readlink command_find command_sha256sum command_hostname command_date command_base64 command_tr postgres_seen persistence_container_count platform_expected_volume_count data_root_status edge_volume_count backup_timer_active backup_success backup_scope_ok backup_host_bound backup_host_binding backup_artifact_bound backup_repository_bound backup_timestamp secret_source data_root_source; do
  [[ "${seen_facts[$required_fact]:-false}" == true ]] || ambiguous=true
done
for required_probe in containers platform_volumes edge_volumes network_list timers services backup_evidence backup_repository; do
  [[ "${seen_probes[$required_probe]:-false}" == true ]] || ambiguous=true
done
for network_name in platform-infra_default zeiterfassung_default catering_ingress catering_private deploy_default commcats-eventos_default; do
  [[ "${seen_probes[network:$network_name]:-false}" == true ]] || ambiguous=true
done

export BACKUP_EVIDENCE_SUCCESS BACKUP_SCOPE_OK BACKUP_HOST_BOUND BACKUP_ARTIFACT_BOUND BACKUP_REPOSITORY_BOUND
if [[ "$ambiguous" == true ]]; then fail_closed REMOTE_OUTPUT_INVALID; fi
for safe_record in "${safe_records[@]}"; do printf '%s\n' "$safe_record"; done
if ! utc_as_of="$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null)"; then fail_closed; fi
printf 'UTC_AS_OF\t%s\n' "$utc_as_of"
emit_classifications
printf 'EVIDENCE_STATUS\tSAFE_REDACTED\n'
