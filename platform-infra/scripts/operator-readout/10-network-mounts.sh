
decode_mount_q() {
  local encoded="$1" first_char last_char decoded
  [[ ${#encoded} -ge 2 ]] || return 1
  first_char="${encoded:0:1}"
  last_char="${encoded:${#encoded}-1:1}"
  [[ "$first_char" == '"' && "$last_char" == '"' ]] || return 1
  decoded="${encoded:1:${#encoded}-2}"
  [[ "$decoded" != *\\* && "$decoded" =~ ^[A-Za-z0-9._/@=:-]*$ ]] || return 1
  printf '%s' "$decoded"
}

mount_field_safe() {
  [[ "$1" =~ ^[A-Za-z0-9._/@:-]*$ ]]
}

canonical_container_path() {
  local value="$1" segment canonical=
  local -a segments=()
  safe_path "$value" || return 1
  IFS=/ read -r -a segments <<<"$value"
  for segment in "${segments[@]}"; do
    case "$segment" in
      ""|.) continue ;;
      ..) return 1 ;;
      *) canonical="${canonical}/${segment}" ;;
    esac
  done
  [[ -n "$canonical" ]] || canonical=/
  printf '%s' "$canonical"
}

container_path_has_mount_prefix() {
  local path="$1" mount_destination="$2"
  [[ "$mount_destination" == / || "$path" == "$mount_destination" || "$path" == "$mount_destination/"* ]]
}

resolve_mount_source_path() {
  local path="$1" mount_destination="$2" mount_source="$3" suffix resolved
  [[ "$mount_source" != absent ]] && safe_path "$mount_source" || return 1
  mount_source="$(canonical_container_path "$mount_source")" || return 1
  if [[ "$mount_destination" == / ]]; then
    suffix="$path"
  else
    suffix="${path#"$mount_destination"}"
  fi
  if [[ -z "$suffix" ]]; then
    resolved="$mount_source"
  else
    resolved="${mount_source%/}$suffix"
  fi
  canonical_container_path "$resolved"
}

mount_records_readout() {
  local container="$1" mount_lines mount_line mount_type volume_name source destination writable
  local encoded_type encoded_name encoded_source encoded_destination mount_without_separator separator_count
  local -a parsed_records=()
  if ! mount_lines="$(docker inspect --format '{{range .Mounts}}{{printf "%q\x1f%q\x1f%q\x1f%q\x1f%t" .Type .Name .Source .Destination .RW}}{{println}}{{end}}' "$container" 2>/dev/null)"; then
    return 1
  fi
  while IFS= read -r mount_line; do
    [[ -n "$mount_line" ]] || continue
    mount_without_separator="${mount_line//$'\x1f'/}"
    separator_count=$(( ${#mount_line} - ${#mount_without_separator} ))
    if (( separator_count != 4 )) || [[ "$mount_line" == *$'\t'* || "$mount_line" == *$'\r'* || "$mount_line" == *$'\033'* ]]; then
      return 1
    fi
    IFS=$'\x1f' read -r encoded_type encoded_name encoded_source encoded_destination writable <<<"$mount_line"
    if ! mount_type="$(decode_mount_q "$encoded_type")" || ! volume_name="$(decode_mount_q "$encoded_name")" || ! source="$(decode_mount_q "$encoded_source")" || ! destination="$(decode_mount_q "$encoded_destination")"; then
      return 1
    fi
    if ! mount_field_safe "$mount_type" || ! mount_field_safe "$volume_name" || ! mount_field_safe "$source" || ! mount_field_safe "$destination"; then
      return 1
    fi
    destination="$(canonical_container_path "$destination")" || return 1
    [[ -n "$mount_type" && -n "$destination" ]] || return 1
    [[ "$writable" == true || "$writable" == false ]] || return 1
    [[ -n "$volume_name" ]] || volume_name=absent
    [[ -n "$source" ]] || source=absent
    parsed_records+=("$mount_type"$'\t'"$volume_name"$'\t'"$source"$'\t'"$destination"$'\t'"$writable")
  done <<<"$mount_lines"
  if ((${#parsed_records[@]} > 0)); then
    printf '%s\n' "${parsed_records[@]}"
  fi
}
