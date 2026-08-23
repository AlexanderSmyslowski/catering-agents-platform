#!/usr/bin/env bash
set -euo pipefail

log_file="${CATERING_PHASE3_FAKE_HOST_ROOT:?CATERING_PHASE3_FAKE_HOST_ROOT is required}/fake-scp.log"
source_path="${1:?source path is required}"
destination="${2:?destination is required}"
remote_path="${destination#*:}"
[[ "${remote_path}" == /* && "${remote_path}" != *".."* ]] || exit 86
mkdir -p "$(dirname "${remote_path}")"
cp "${source_path}" "${remote_path}"
printf 'scp %s -> %s\n' "${source_path}" "${remote_path}" >>"${log_file}"
