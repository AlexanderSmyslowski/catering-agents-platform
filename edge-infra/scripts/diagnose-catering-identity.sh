#!/usr/bin/env bash

set -u -o pipefail

CATERING_HOST="${1:-}"
CANDIDATE_STATUS="${2:-unknown}"
CANDIDATE_CONTENT_TYPE="${3:-unknown}"
CANDIDATE_BODY_FILE="${4:-}"
DOCKER_BIN="${DOCKER_BIN:-docker}"
NETWORK_NAME="${CATERING_DIAGNOSTIC_NETWORK:-platform-infra_default}"
BODY_PREVIEW_LIMIT="${CATERING_DIAGNOSTIC_BODY_PREVIEW_LIMIT:-800}"

case "${BODY_PREVIEW_LIMIT}" in
  ''|*[!0-9]*) BODY_PREVIEW_LIMIT=800 ;;
esac
if (( BODY_PREVIEW_LIMIT < 1 || BODY_PREVIEW_LIMIT > 1000 )); then
  BODY_PREVIEW_LIMIT=800
fi

safe_scalar() {
  printf '%s' "${1:-unknown}" | LC_ALL=C tr '\r\n\t' '   ' | head -c 200
}

print_body_preview() {
  local label="$1"
  local body_file="$2"

  if [[ -z "${body_file}" || ! -r "${body_file}" ]]; then
    printf '%s body-preview (max %s bytes): <unavailable>\n' "${label}" "${BODY_PREVIEW_LIMIT}"
    return 0
  fi

  if ! python3 - "${label}" "${body_file}" "${BODY_PREVIEW_LIMIT}" <<'PYTHON'
import base64
import os
from pathlib import Path
import sys

label = sys.argv[1]
body_path = Path(sys.argv[2])
limit = int(sys.argv[3])
try:
    data = body_path.read_bytes()
except OSError:
    print(f"{label} body-preview (max {limit} bytes): <unavailable>")
    raise SystemExit(0)

truncated = len(data) > limit
text = data[:limit].decode("utf-8", errors="replace")
user = os.environ.get("CATERING_SMOKE_BASIC_AUTH_USER", "")
password = os.environ.get("CATERING_SMOKE_BASIC_AUTH_PASSWORD", "")
secrets = [secret for secret in (user, password) if secret]
if user or password:
    raw = f"{user}:{password}".encode("utf-8")
    secrets.append(base64.b64encode(raw).decode("ascii"))
for secret in sorted(set(secrets), key=len, reverse=True):
    text = text.replace(secret, "[REDACTED]")
text = "".join(
    character if character in "\t\r\n" or ord(character) >= 32 else "�"
    for character in text
)
text = " ".join(text.split())
if not text:
    text = "<empty>"
suffix = " …[truncated]" if truncated else ""
print(f"{label} body-preview (max {limit} bytes): {text}{suffix}")
PYTHON
  then
    printf '%s body-preview (max %s bytes): <preview failed>\n' "${label}" "${BODY_PREVIEW_LIMIT}"
  fi
}

printf 'Catering diagnostic candidate: status=%s content-type=%s\n' \
  "$(safe_scalar "${CANDIDATE_STATUS}")" \
  "$(safe_scalar "${CANDIDATE_CONTENT_TYPE}")"
print_body_preview "Catering diagnostic candidate" "${CANDIDATE_BODY_FILE}"

collect_network_evidence() {
  local network_file
  network_file="$(mktemp)"
  if ! "${DOCKER_BIN}" network inspect "${NETWORK_NAME}" >"${network_file}" 2>/dev/null; then
    printf 'Catering diagnostic network: unavailable (could not inspect %s)\n' "$(safe_scalar "${NETWORK_NAME}")"
    rm -f "${network_file}"
    return 0
  fi

  if ! python3 - "${network_file}" "${NETWORK_NAME}" "${DOCKER_BIN}" <<'PYTHON'
import json
from pathlib import Path
import subprocess
import sys

network_path = Path(sys.argv[1])
network_name = sys.argv[2]
docker_bin = sys.argv[3]


def safe(value: object) -> str:
    return str(value if value not in (None, "") else "-").replace("\r", "?").replace("\n", "?")


try:
    network_payload = json.loads(network_path.read_text(encoding="utf-8"))
    network = network_payload[0]
except (OSError, UnicodeError, json.JSONDecodeError, IndexError, TypeError):
    print("Catering diagnostic network: unavailable (invalid inspect response)")
    raise SystemExit(0)

members = []
for container_id, summary in (network.get("Containers") or {}).items():
    inspection = None
    result = subprocess.run(
        [docker_bin, "inspect", container_id],
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode == 0:
        try:
            inspection = json.loads(result.stdout)[0]
        except (json.JSONDecodeError, IndexError, TypeError):
            inspection = None

    if inspection is None:
        name = summary.get("Name") or container_id[:12]
        image = "-"
        endpoint = {}
        project = "-"
        service = "-"
    else:
        name = str(inspection.get("Name") or "").lstrip("/") or container_id[:12]
        config = inspection.get("Config") or {}
        image = config.get("Image") or "-"
        endpoint = (
            ((inspection.get("NetworkSettings") or {}).get("Networks") or {}).get(network_name)
            or {}
        )
        labels = config.get("Labels") or {}
        project = labels.get("com.docker.compose.project") or "-"
        service = labels.get("com.docker.compose.service") or "-"

    ip_address = (
        endpoint.get("IPAddress")
        or str(summary.get("IPv4Address") or "").split("/", 1)[0]
        or "-"
    )
    aliases = sorted({str(alias) for alias in (endpoint.get("Aliases") or []) if alias})
    members.append(
        {
            "id": container_id[:12],
            "name": name,
            "image": image,
            "ip": ip_address,
            "aliases": aliases,
            "project": project,
            "service": service,
        }
    )

members.sort(key=lambda member: (member["name"], member["id"]))
if not members:
    print(f"Catering diagnostic network {safe(network_name)}: no attached containers")
for member in members:
    aliases = ",".join(member["aliases"]) or "-"
    print(
        "Catering diagnostic network-member: "
        f"name={safe(member['name'])} id={safe(member['id'])} image={safe(member['image'])} "
        f"ipv4={safe(member['ip'])} aliases={safe(aliases)} "
        f"compose={safe(member['project'])}/{safe(member['service'])}"
    )

for alias in ("web", "intake"):
    owners = [
        f"{member['name']}@{member['ip']}"
        for member in members
        if alias in member["aliases"]
    ]
    owner_text = ",".join(owners) if owners else "<none>"
    print(f"Catering diagnostic alias {alias} owners: {safe(owner_text)}")
PYTHON
  then
    printf 'Catering diagnostic network: metadata parser failed\n'
  fi
  rm -f "${network_file}"
}

parse_wget_metadata() {
  local header_file="$1"
  local client_status="$2"
  python3 - "${header_file}" "${client_status}" <<'PYTHON'
from pathlib import Path
import re
import sys

try:
    text = Path(sys.argv[1]).read_text(encoding="utf-8", errors="replace")
except OSError:
    text = ""
statuses = re.findall(
    r"^\s*HTTP/\S+\s+(\d{3})\b",
    text,
    flags=re.IGNORECASE | re.MULTILINE,
)
content_types = re.findall(
    r"^\s*Content-Type:\s*([^\r\n]+)",
    text,
    flags=re.IGNORECASE | re.MULTILINE,
)
peers = re.findall(
    r"Connecting to [^\r\n]*\(([^)]+)\)",
    text,
    flags=re.IGNORECASE,
)
status = statuses[-1] if statuses else "unknown"
content_type = content_types[-1].strip() if content_types else "unknown"
peer = peers[-1].strip() if peers else "unknown"
print("\t".join((status, content_type, peer, sys.argv[2])))
PYTHON
}

probe_from_edge() {
  local label="$1"
  local edge_container="$2"
  local url="$3"
  local use_auth="$4"
  local auth_b64="$5"
  local body_file header_file client_status metadata status content_type peer reported_client_status
  body_file="$(mktemp)"
  header_file="$(mktemp)"

  if [[ "${use_auth}" == "true" ]]; then
    "${DOCKER_BIN}" exec \
      -e "CATERING_DIAGNOSTIC_HOST=${CATERING_HOST}" \
      -e "CATERING_DIAGNOSTIC_AUTH_B64=${auth_b64}" \
      "${edge_container}" sh -c '
        set -eu
        exec wget -S -O - \
          --header "Host: ${CATERING_DIAGNOSTIC_HOST}" \
          --header "Authorization: Basic ${CATERING_DIAGNOSTIC_AUTH_B64}" \
          "$1"
      ' sh "${url}" >"${body_file}" 2>"${header_file}"
    client_status=$?
  else
    "${DOCKER_BIN}" exec "${edge_container}" sh -c '
      set -eu
      exec wget -S -O - "$1"
    ' sh "${url}" >"${body_file}" 2>"${header_file}"
    client_status=$?
  fi

  metadata="$(
    parse_wget_metadata "${header_file}" "${client_status}" 2>/dev/null \
      || printf 'unknown\tunknown\tunknown\t%s\n' "${client_status}"
  )"
  IFS=$'\t' read -r status content_type peer reported_client_status <<<"${metadata}"
  printf '%s: status=%s content-type=%s peer=%s client-exit=%s\n' \
    "${label}" \
    "$(safe_scalar "${status}")" \
    "$(safe_scalar "${content_type}")" \
    "$(safe_scalar "${peer}")" \
    "$(safe_scalar "${reported_client_status}")"
  print_body_preview "${label}" "${body_file}"
  rm -f "${body_file}" "${header_file}"
}

collect_direct_evidence() {
  local edge_container edge_count auth_b64
  edge_container="$(
    "${DOCKER_BIN}" ps \
      --filter 'label=com.docker.compose.project=shared-edge' \
      --filter 'label=com.docker.compose.service=edge' \
      --filter 'status=running' \
      --format '{{.ID}}' 2>/dev/null | head -n 1
  )"
  edge_count="$(
    "${DOCKER_BIN}" ps \
      --filter 'label=com.docker.compose.project=shared-edge' \
      --filter 'label=com.docker.compose.service=edge' \
      --filter 'status=running' \
      --format '{{.ID}}' 2>/dev/null | sed '/^$/d' | wc -l | tr -d ' '
  )"

  if [[ -z "${edge_container}" ]]; then
    printf 'Catering diagnostic direct-web: unavailable (running shared-edge edge container not found)\n'
    printf 'Catering diagnostic direct-intake: unavailable (running shared-edge edge container not found)\n'
    return 0
  fi
  if [[ "${edge_count}" != "1" ]]; then
    printf 'Catering diagnostic edge-container selection: found %s; using first=%s\n' \
      "$(safe_scalar "${edge_count}")" \
      "$(safe_scalar "${edge_container}")"
  else
    printf 'Catering diagnostic edge-container: id=%s\n' "$(safe_scalar "${edge_container}")"
  fi

  if [[ -z "${CATERING_SMOKE_BASIC_AUTH_USER:-}" || -z "${CATERING_SMOKE_BASIC_AUTH_PASSWORD:-}" ]]; then
    printf 'Catering diagnostic direct-web: unavailable (Basic Auth credentials absent)\n'
    auth_b64=""
  else
    auth_b64="$(python3 - <<'PYTHON'
import base64
import os

raw = f"{os.environ['CATERING_SMOKE_BASIC_AUTH_USER']}:{os.environ['CATERING_SMOKE_BASIC_AUTH_PASSWORD']}".encode("utf-8")
print(base64.b64encode(raw).decode("ascii"))
PYTHON
)"
    probe_from_edge \
      "Catering diagnostic direct-web" \
      "${edge_container}" \
      'http://web:80/api/intake/health' \
      true \
      "${auth_b64}"
  fi

  probe_from_edge \
    "Catering diagnostic direct-intake" \
    "${edge_container}" \
    'http://intake:3101/health' \
    false \
    ""
}

collect_network_evidence
collect_direct_evidence
exit 0
