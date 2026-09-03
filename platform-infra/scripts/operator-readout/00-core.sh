set -u -o pipefail

expected_sha="${1-unknown}"

safe_scalar() {
  local value="${1-unknown}"
  value="${value//$'\t'/ }"
  value="${value//$'\r'/ }"
  value="${value//$'\n'/ }"
  value="${value//$'\033'/ }"
  printf '%s' "${value:0:180}"
}

short_id() {
  local value
  value="$(safe_scalar "${1-unknown}")"
  printf '%s' "${value:0:12}"
}

critical_unavailable_count=0

critical_unavailable() {
  local area="$1" subject="$2"
  critical_unavailable_count=$((critical_unavailable_count + 1))
  printf 'READOUT critical_unavailable area=%s subject=%s\n' \
    "$(safe_scalar "$area")" "$(safe_scalar "$subject")"
}

collection_status_readout() {
  if ((critical_unavailable_count > 0)); then
    printf 'READOUT collection_status=partial critical_unavailable_count=%s\n' \
      "$critical_unavailable_count"
    printf 'READOUT collection=partial\n'
  else
    printf 'READOUT collection_status=complete critical_unavailable_count=0\n'
    printf 'READOUT collection=complete\n'
  fi
}

safe_path() {
  local value="${1-}"
  [[ "$value" == /* && "$value" != *$'\t'* && "$value" != *$'\n'* && "$value" != *$'\r'* ]] || return 1
  [[ "$value" != *".."* && ( "$value" == / || "$value" =~ ^/[A-Za-z0-9._/-]+$ ) ]]
}

path_absence_is_authoritative() {
  local target="$1" candidate parent
  [[ ! -e "$target" && ! -L "$target" ]] || return 1
  candidate="$(dirname -- "$target")"
  while true; do
    [[ -L "$candidate" ]] && return 1
    if [[ -e "$candidate" ]]; then
      [[ -d "$candidate" && -r "$candidate" && -x "$candidate" ]] || return 1
    fi
    parent="$(dirname -- "$candidate")"
    [[ "$parent" != "$candidate" ]] || return 0
    candidate="$parent"
  done
}

readout_path() {
  local label="$1" path="$2" metadata
  if metadata="$(stat -c '%F:%u:%a:%s:%Y' -- "$path" 2>/dev/null)"; then
    if [[ -L "$path" ]]; then
      printf 'READOUT path=%s status=symlink\n' "$(safe_scalar "$label")"
      critical_unavailable path "$label"
      return 0
    fi
    printf 'READOUT path=%s status=present metadata=%s\n' \
      "$(safe_scalar "$label")" "$(safe_scalar "$metadata")"
  elif path_absence_is_authoritative "$path"; then
    printf 'READOUT path=%s status=absent\n' "$(safe_scalar "$label")"
  else
    printf 'READOUT path=%s status=unavailable\n' "$(safe_scalar "$label")"
    critical_unavailable path "$label"
  fi
}

network_readout() {
  local network="$1" names name_found=false metadata name id driver scope internal ipv6
  if ! names="$(docker network ls --format '{{.Name}}' 2>/dev/null)"; then
    printf 'READOUT network=%s status=unavailable\n' "$(safe_scalar "$network")"
    critical_unavailable network "$network"
    return 0
  fi
  while IFS= read -r name; do
    [[ "$name" == "$network" ]] && name_found=true
  done <<<"$names"
  if [[ "$name_found" != true ]]; then
    printf 'READOUT network=%s status=absent\n' "$(safe_scalar "$network")"
    return 0
  fi
  if ! metadata="$(docker network inspect --format '{{printf "%s\t%s\t%s\t%s\t%t\t%t" .Name .Id .Driver .Scope .Internal .EnableIPv6}}' "$network" 2>/dev/null)"; then
    printf 'READOUT network=%s status=unavailable\n' "$(safe_scalar "$network")"
    critical_unavailable network "$network"
    return 0
  fi
  IFS=$'\t' read -r name id driver scope internal ipv6 <<<"$metadata"
  printf 'READOUT network=%s status=present id=%s driver=%s scope=%s internal=%s ipv6=%s\n' \
    "$(safe_scalar "$name")" "$(short_id "$id")" "$(safe_scalar "$driver")" \
    "$(safe_scalar "$scope")" "$(safe_scalar "$internal")" "$(safe_scalar "$ipv6")"
}
