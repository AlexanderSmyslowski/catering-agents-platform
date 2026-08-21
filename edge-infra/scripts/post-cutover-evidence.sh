#!/usr/bin/env bash

set -euo pipefail
umask 077

: "${DEPLOY_HOST:?Set DEPLOY_HOST from the production environment.}"
: "${DEPLOY_USER:?Set DEPLOY_USER from the production environment.}"
: "${EDGE_DEPLOY_PATH:?Set EDGE_DEPLOY_PATH.}"
: "${EDGE_ROLLBACK_ROOT:?Set EDGE_ROLLBACK_ROOT.}"
: "${EXPECTED_CUTOVER_COMMIT:?Set EXPECTED_CUTOVER_COMMIT.}"
: "${CUTOVER_RUN_ID:?Set CUTOVER_RUN_ID.}"
: "${CATERING_SMOKE_URL:?Set CATERING_SMOKE_URL.}"
: "${ZEITERFASSUNG_SMOKE_URL:?Set ZEITERFASSUNG_SMOKE_URL.}"
: "${EVENTOS_SMOKE_URL:?Set EVENTOS_SMOKE_URL.}"
: "${CATERING_SMOKE_BASIC_AUTH_USER:?Set CATERING_SMOKE_BASIC_AUTH_USER.}"
: "${CATERING_SMOKE_BASIC_AUTH_PASSWORD:?Set CATERING_SMOKE_BASIC_AUTH_PASSWORD.}"
: "${EVIDENCE_CONTEXT:?Set EVIDENCE_CONTEXT.}"
: "${EXPECTED_CADDYFILE_SHA256:?Set EXPECTED_CADDYFILE_SHA256 from the checked-out edge Caddyfile.}"

fail() {
  echo "PHASE 2: NO-GO — $1"
  exit 1
}

readonly EXPECTED_EDGE_DEPLOY_PATH="/opt/shared-edge"
readonly EXPECTED_EDGE_ROLLBACK_ROOT="/opt/shared-edge-rollbacks"
readonly EXPECTED_CUTOVER_COMMIT_VALUE="6703d2aa9bb426c7f44d6601306dc623219741be"
readonly EXPECTED_CUTOVER_RUN_ID="32417734936"
readonly EXPECTED_CATERING_URL="https://catering.the-one.catering"
readonly EXPECTED_ZEITERFASSUNG_URL="https://zeit.the-one.catering"
readonly EXPECTED_EVENTOS_URL="https://eventos.commcats.de"

[[ "${EVIDENCE_CONTEXT}" == github-production ]] || fail "evidence context is not the protected GitHub production context."
[[ "${GITHUB_ACTIONS:-}" == true ]] || fail "evidence must run in GitHub Actions."
[[ "${GITHUB_REF_NAME:-}" == main ]] || fail "evidence must run from main."
[[ "${EDGE_DEPLOY_PATH}" == "${EXPECTED_EDGE_DEPLOY_PATH}" ]] || fail "shared-edge path is not the exact allowlisted path."
[[ "${EDGE_ROLLBACK_ROOT}" == "${EXPECTED_EDGE_ROLLBACK_ROOT}" ]] || fail "shared-edge rollback path is not the exact allowlisted path."
[[ "${EXPECTED_CUTOVER_COMMIT}" == "${EXPECTED_CUTOVER_COMMIT_VALUE}" ]] || fail "cutover commit is not the accepted Cutover #6 commit."
[[ "${EXPECTED_CUTOVER_COMMIT}" =~ ^[0-9a-fA-F]{40}$ ]] || fail "expected cutover commit is not a full SHA."
[[ "${CUTOVER_RUN_ID}" == "${EXPECTED_CUTOVER_RUN_ID}" ]] || fail "cutover run identifier is not the accepted Cutover #6 run."
[[ "${DEPLOY_USER}" =~ ^[A-Za-z_][A-Za-z0-9_.-]*$ ]] || fail "production user is invalid."
[[ "${DEPLOY_HOST}" =~ ^[A-Za-z0-9][A-Za-z0-9.-]*[A-Za-z0-9]$ ]] || fail "production host is not an allowlisted DNS/IP shape."
[[ "${DEPLOY_HOST}" != *..* ]] || fail "production host contains an empty DNS label."

IFS='.' read -r -a DEPLOY_HOST_SEGMENTS <<< "${DEPLOY_HOST}"
for host_label in "${DEPLOY_HOST_SEGMENTS[@]}"; do
  [[ "${host_label}" =~ ^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?$ ]] || fail "production host contains an invalid DNS label."
  [[ "${#host_label}" -le 63 ]] || fail "production host DNS label is too long."
done

[[ "${CATERING_SMOKE_URL}" == "${EXPECTED_CATERING_URL}" ]] || fail "Catering smoke URL is not the exact canonical URL."
[[ "${ZEITERFASSUNG_SMOKE_URL}" == "${EXPECTED_ZEITERFASSUNG_URL}" ]] || fail "Zeiterfassung smoke URL is not the exact canonical URL."
[[ "${EVENTOS_SMOKE_URL}" == "${EXPECTED_EVENTOS_URL}" ]] || fail "EventOS smoke URL is not the exact canonical URL."
[[ "${EXPECTED_CADDYFILE_SHA256}" =~ ^[0-9a-f]{64}$ ]] || fail "expected Caddyfile SHA-256 is invalid."
[[ "${CATERING_SMOKE_BASIC_AUTH_USER}" != *$'\n'* && "${CATERING_SMOKE_BASIC_AUTH_USER}" != *$'\r'* ]] || fail "Catering smoke user contains a control character."
[[ "${CATERING_SMOKE_BASIC_AUTH_PASSWORD}" != *$'\n'* && "${CATERING_SMOKE_BASIC_AUTH_PASSWORD}" != *$'\r'* ]] || fail "Catering smoke password contains a control character."
[[ "${CATERING_SMOKE_BASIC_AUTH_USER}" != *'"'* && "${CATERING_SMOKE_BASIC_AUTH_USER}" != *\\* ]] || fail "Catering smoke user contains unsupported curl-config characters."
[[ "${CATERING_SMOKE_BASIC_AUTH_PASSWORD}" != *'"'* && "${CATERING_SMOKE_BASIC_AUTH_PASSWORD}" != *\\* ]] || fail "Catering smoke password contains unsupported curl-config characters."

for command_name in ssh curl python3 docker ss realpath sha256sum; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    fail "${command_name} is required on the hosted runner."
  fi
done

SSH_KEY="${HOME}/.ssh/id_ed25519"
SSH_KNOWN_HOSTS="${HOME}/.ssh/known_hosts"
test -r "${SSH_KEY}" || fail "the production SSH key is unavailable."
test -r "${SSH_KNOWN_HOSTS}" || fail "the production known-hosts file is unavailable."

REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"
SSH_ARGS=(
  -i "${SSH_KEY}"
  -o IdentitiesOnly=yes
  -o BatchMode=yes
  -o StrictHostKeyChecking=yes
  -o UserKnownHostsFile="${SSH_KNOWN_HOSTS}"
  -o ConnectTimeout=10
  -p 22
)

remote_snapshot() {
  ssh "${SSH_ARGS[@]}" -- "${REMOTE}" bash -s -- "${EXPECTED_CADDYFILE_SHA256}" <<'REMOTE_SCRIPT'
set -euo pipefail

expected_caddyfile_sha256="$1"
edge_path="/opt/shared-edge"
rollback_root="/opt/shared-edge-rollbacks"
expected_commit="6703d2aa9bb426c7f44d6601306dc623219741be"
edge_lock_path="${edge_path}.deploy-lock"

remote_fail() {
  printf 'remote evidence gate failed: %s\n' "$1" >&2
  exit 1
}

validate_deploy_lock_absent() {
  local lock_path="${1:-${edge_lock_path}}"
  [[ ! -e "${lock_path}" && ! -L "${lock_path}" ]] || remote_fail "shared-edge deploy lock is active or ambiguous."
  printf 'LOCK\tabsent\n'
}

validate_manifest_file() {
  local manifest_file="$1"
  local expected_root="$2"
  local expected_manifest_commit="${3:-}"
  local expected_mode="${4:-}"
  local line_count unknown_count key key_count manifest_commit manifest_mode manifest_time manifest_rollback_root

  [[ -f "${manifest_file}" && ! -L "${manifest_file}" ]] || remote_fail "deployment manifest is not a regular non-symlink file."
  line_count="$(awk 'END { print NR + 0 }' "${manifest_file}")"
  [[ "${line_count}" == 4 ]] || remote_fail "deployment manifest has an unexpected line count."
  for key in commit mode deployed_at rollback_root; do
    key_count="$(grep -c "^${key}=" "${manifest_file}" || true)"
    [[ "${key_count}" == 1 ]] || remote_fail "deployment manifest has a missing or duplicate ${key} field."
  done
  unknown_count="$(awk -F '=' '$0 == "" || NF != 2 || $1 !~ /^(commit|mode|deployed_at|rollback_root)$/ { count += 1 } END { print count + 0 }' "${manifest_file}")"
  [[ "${unknown_count}" == 0 ]] || remote_fail "deployment manifest contains an unknown or malformed field."

  manifest_commit="$(sed -n 's/^commit=//p' "${manifest_file}")"
  manifest_mode="$(sed -n 's/^mode=//p' "${manifest_file}")"
  manifest_time="$(sed -n 's/^deployed_at=//p' "${manifest_file}")"
  manifest_rollback_root="$(sed -n 's/^rollback_root=//p' "${manifest_file}")"
  [[ "${manifest_commit}" =~ ^[0-9a-f]{40}$ ]] || remote_fail "deployment manifest commit is not lowercase hexadecimal."
  [[ "${manifest_mode}" == cutover || "${manifest_mode}" == rehearsal ]] || remote_fail "deployment manifest mode is invalid."
  [[ "${manifest_time}" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]] || remote_fail "deployment manifest timestamp is invalid."
  python3 -c 'from datetime import datetime; import sys; datetime.strptime(sys.argv[1], "%Y-%m-%dT%H:%M:%SZ")' "${manifest_time}" || remote_fail "deployment manifest timestamp is not a valid UTC timestamp."
  [[ "${manifest_rollback_root}" == "${expected_root}" ]] || remote_fail "deployment manifest rollback root is unexpected."
  if [[ -n "${expected_manifest_commit}" ]]; then
    [[ "${manifest_commit}" == "${expected_manifest_commit}" ]] || remote_fail "deployed shared-edge commit differs from Cutover #6."
  fi
  if [[ -n "${expected_mode}" ]]; then
    [[ "${manifest_mode}" == "${expected_mode}" ]] || remote_fail "shared-edge manifest is not in cutover mode."
  fi
}

validate_rollback_evidence() {
  local root="${1:-${rollback_root}}"
  local pointer pointer_line_count rollback_target rollback_target_real sidecar sidecar_real
  local archive_entries archive_details archive_sha256 entry required_entry required_count

  [[ -d "${root}" && ! -L "${root}" ]] || remote_fail "shared-edge rollback root is not a regular directory."
  pointer="${root}/latest"
  [[ -f "${pointer}" && ! -L "${pointer}" ]] || remote_fail "shared-edge rollback pointer is not a regular non-symlink file."
  pointer_line_count="$(awk 'END { print NR + 0 }' "${pointer}")"
  [[ "${pointer_line_count}" == 1 ]] || remote_fail "shared-edge rollback pointer must contain exactly one line."
  rollback_target="$(sed -n '1p' "${pointer}")"
  [[ -n "${rollback_target}" && "${rollback_target}" != *$'\r'* ]] || remote_fail "shared-edge rollback pointer is malformed."
  rollback_target_real="$(realpath -e "${rollback_target}")" || remote_fail "shared-edge rollback archive cannot be resolved."
  [[ "$(dirname "${rollback_target_real}")" == "${root}" ]] || remote_fail "shared-edge rollback archive is outside the documented rollback root."
  [[ "$(basename "${rollback_target_real}")" =~ ^shared-edge-[0-9]{8}T[0-9]{6}Z\.tar\.gz$ ]] || remote_fail "shared-edge rollback archive name is invalid."
  [[ -f "${rollback_target_real}" && ! -L "${rollback_target_real}" ]] || remote_fail "shared-edge rollback archive is not a regular non-symlink file."

  archive_entries="$(tar -tzf "${rollback_target_real}")" || remote_fail "shared-edge rollback archive is not a readable tar.gz archive."
  [[ -n "${archive_entries}" ]] || remote_fail "shared-edge rollback archive is empty."
  archive_details="$(tar -tvzf "${rollback_target_real}")" || remote_fail "shared-edge rollback archive listing is unavailable."
  while IFS= read -r entry; do
    [[ -n "${entry}" ]] || continue
    [[ "${entry}" == ./* && "${entry}" != *'..'* && "${entry}" != *$'\r'* ]] || remote_fail "shared-edge rollback archive contains an unsafe path."
    [[ "${entry}" != ./.env && "${entry}" != ./.env/* && "${entry}" != ./.deploy-manifest && "${entry}" != ./.deploy-manifest/* ]] || remote_fail "shared-edge rollback archive contains protected state."
  done <<< "${archive_entries}"
  while IFS= read -r entry; do
    [[ -n "${entry}" ]] || continue
    [[ "${entry:0:1}" == - || "${entry:0:1}" == d ]] || remote_fail "shared-edge rollback archive contains an unsupported special entry."
  done <<< "${archive_details}"
  for required_entry in ./Caddyfile ./docker-compose.yml; do
    required_count="$(printf '%s\n' "${archive_entries}" | grep -Fxc -- "${required_entry}" || true)"
    [[ "${required_count}" == 1 ]] || remote_fail "shared-edge rollback archive is missing ${required_entry}."
  done
  archive_sha256="$(sha256sum "${rollback_target_real}" | awk '{ print $1 }')"
  [[ "${archive_sha256}" =~ ^[0-9a-f]{64}$ ]] || remote_fail "shared-edge rollback archive SHA-256 is invalid."

  sidecar="${rollback_target_real}.manifest"
  [[ -f "${sidecar}" && ! -L "${sidecar}" ]] || remote_fail "shared-edge rollback sidecar manifest is not a regular non-symlink file."
  sidecar_real="$(realpath -e "${sidecar}")" || remote_fail "shared-edge rollback sidecar manifest cannot be resolved."
  [[ "${sidecar_real}" == "${sidecar}" && "$(dirname "${sidecar_real}")" == "${root}" ]] || remote_fail "shared-edge rollback sidecar manifest is outside the documented rollback root."
  validate_manifest_file "${sidecar}" "${root}"
  printf 'ROLLBACK\t%s\t%s\n' "${rollback_target_real}" "${archive_sha256}"
  printf 'ROLLBACK_MANIFEST\t%s\t%s\t%s\n' \
    "$(sed -n 's/^commit=//p' "${sidecar}")" \
    "$(sed -n 's/^mode=//p' "${sidecar}")" \
    "$(sed -n 's/^rollback_root=//p' "${sidecar}")"
}

read_edge_generation() {
  local root="${1:-${edge_path}}"
  local file path digest
  for file in .deploy-manifest docker-compose.yml Caddyfile; do
    path="${root}/${file}"
    [[ -f "${path}" && ! -L "${path}" ]] || remote_fail "shared-edge ${file} is not a regular non-symlink file."
    digest="$(sha256sum "${path}" | awk '{ print $1 }')"
    [[ "${digest}" =~ ^[0-9a-f]{64}$ ]] || remote_fail "shared-edge ${file} generation digest is invalid."
    printf 'GENERATION\t%s\t%s\n' "${file}" "${digest}"
  done
}

read_eventos_release_marker() {
  local canonical_current="/opt/commcats-eventos/current"
  local marker="${1:-${canonical_current}/.eventos-release-sha}"
  local release_root="/opt/commcats-eventos/releases"
  local release_path marker_path marker_line_count marker_sha

  if [[ "$#" == 0 ]]; then
    [[ -L "${canonical_current}" ]] || remote_fail "EventOS current release is not a symlink."
    release_path="$(realpath -e "${canonical_current}")" || remote_fail "EventOS current release cannot be resolved."
    [[ -d "${release_path}" && "$(dirname "${release_path}")" == "${release_root}" ]] || remote_fail "EventOS current release escapes the canonical release root."
    marker="${canonical_current}/.eventos-release-sha"
    marker_path="$(realpath -e "${marker}")" || remote_fail "EventOS release marker cannot be resolved."
    [[ "${marker_path}" == "${release_path}/.eventos-release-sha" ]] || remote_fail "EventOS release marker is outside the current release."
  fi
  [[ -f "${marker}" && ! -L "${marker}" ]] || remote_fail "EventOS release marker is not a regular non-symlink file."
  marker_line_count="$(awk 'END { print NR + 0 }' "${marker}")"
  [[ "${marker_line_count}" == 1 ]] || remote_fail "EventOS release marker must contain exactly one line."
  marker_sha="$(sed -n '1p' "${marker}")"
  [[ "${marker_sha}" =~ ^[0-9a-f]{40}$ ]] || remote_fail "EventOS release marker is not exactly 40 lowercase hexadecimal characters."
  EVENTOS_RELEASE_SHA="${marker_sha}"
}

read_eventos_container_identity() {
  local container_id="$1"
  local image compose_release compose_release_count working_dir compose_missing
  compose_missing="$(printf '\074no value\076')"
  image="$(docker inspect --format '{{.Config.Image}}' "${container_id}")"
  compose_release="$(docker inspect --format '{{range .Config.Env}}{{if contains . "EVENTOS_RELEASE_SHA="}}{{println .}}{{end}}{{end}}' "${container_id}")" || remote_fail "EventOS release identity inspection failed."
  compose_release_count="$(printf '%s\n' "${compose_release}" | awk 'NF { count += 1 } END { print count + 0 }')"
  [[ "${compose_release_count}" == 1 ]] || remote_fail "EventOS Compose release identity is missing or duplicated."
  compose_release="${compose_release#EVENTOS_RELEASE_SHA=}"
  working_dir="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' "${container_id}")"
  [[ -n "${working_dir}" && "${working_dir}" != "${compose_missing}" ]] || remote_fail "EventOS Compose working-dir identity is missing."
  [[ "${compose_release}" == "${EVENTOS_RELEASE_SHA}" ]] || remote_fail "EventOS Compose release identity does not match the immutable release marker."
  [[ "${image}" =~ ^commcats-eventos-app@sha256:[0-9a-f]{64}$ ]] || remote_fail "EventOS image identity is not an immutable digest for the documented owner contract."
  EVENTOS_IMAGE="${image}"
  EVENTOS_COMPOSE_RELEASE_SHA="${compose_release}"
  EVENTOS_WORKING_DIR="${working_dir}"
  printf 'EVENTOS_IDENTITY\t%s\t%s\t%s\n' "${EVENTOS_IMAGE}" "${EVENTOS_COMPOSE_RELEASE_SHA}" "${EVENTOS_WORKING_DIR}"
}

test -d "${edge_path}" || remote_fail "shared-edge path is unavailable."
snapshot_lock_before="$(validate_deploy_lock_absent "${edge_lock_path}")"
validate_manifest_file "${edge_path}/.deploy-manifest" "${rollback_root}" "${expected_commit}" cutover
manifest_commit="$(sed -n 's/^commit=//p' "${edge_path}/.deploy-manifest")"
manifest_mode="$(sed -n 's/^mode=//p' "${edge_path}/.deploy-manifest")"
manifest_time="$(sed -n 's/^deployed_at=//p' "${edge_path}/.deploy-manifest")"
snapshot_manifest_before="$(sha256sum "${edge_path}/.deploy-manifest" | awk '{ print $1 }')"
[[ "${snapshot_manifest_before}" =~ ^[0-9a-f]{64}$ ]] || remote_fail "shared-edge snapshot manifest digest is invalid."
validate_rollback_evidence "${rollback_root}"
snapshot_generation_before="$(read_edge_generation "${edge_path}")"
EVENTOS_RELEASE_SHA=""
read_eventos_release_marker

ZEITERFASSUNG_CONTAINER_IMAGE=""
ZEITERFASSUNG_COMPOSE_WORKING_DIR=""
EVENTOS_IMAGE=""
EVENTOS_COMPOSE_RELEASE_SHA=""
EVENTOS_WORKING_DIR=""

assert_zeiterfassung_container_metadata() {
  local working_dir="$1"
  local image="$2"
  local compose_missing
  compose_missing="$(printf '\074no value\076')"

  [[ -n "${working_dir}" && "${working_dir}" != "${compose_missing}" ]] || \
    remote_fail "Zeiterfassung Compose working-dir label is missing."
  [[ "${working_dir}" == /* && "${working_dir}" != *$'\n'* && "${working_dir}" != *$'\r'* ]] || \
    remote_fail "Zeiterfassung Compose working-dir label is malformed."
  [[ -n "${image}" && "${image}" != "${compose_missing}" ]] || \
    remote_fail "Zeiterfassung container image identity is missing."
  [[ "${image}" =~ ^zeiterfassung-app:(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z.-]+)?$ || "${image}" =~ ^zeiterfassung-app@sha256:[0-9a-f]{64}$ ]] || \
    remote_fail "Zeiterfassung container image identity is not allowlisted."
}

read_zeiterfassung_container_metadata() {
  local container_id="$1"
  local image working_dir
  image="$(docker inspect --format '{{.Config.Image}}' "${container_id}")" || remote_fail "Zeiterfassung container image inspection failed."
  working_dir="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' "${container_id}")" || remote_fail "Zeiterfassung Compose working-dir label inspection failed."
  assert_zeiterfassung_container_metadata "${working_dir}" "${image}"
  ZEITERFASSUNG_CONTAINER_IMAGE="${image}"
  ZEITERFASSUNG_COMPOSE_WORKING_DIR="${working_dir}"
}

network_listing="$(docker network ls --no-trunc --format '{{.Name}}\t{{.ID}}\t{{.Driver}}\t{{.Scope}}')"

resolve_compose_container() {
  local project="$1" service="$2" expected_name="$3" ids id actual_name actual_project actual_service oneoff number compose_missing
  compose_missing="$(printf '\074no value\076')"
  ids="$(docker ps --no-trunc --filter status=running \
    --filter "label=com.docker.compose.project=${project}" \
    --filter "label=com.docker.compose.service=${service}" \
    --filter "name=^/${expected_name}$" --format '{{.ID}}')"
  [[ "$(printf '%s\n' "${ids}" | awk 'NF { count += 1 } END { print count + 0 }')" == 1 ]] || \
    remote_fail "expected exactly one allowlisted ${project}/${service}/${expected_name} container."
  id="${ids}"
  actual_name="$(docker inspect --format '{{.Name}}' "${id}")"
  actual_name="${actual_name#/}"
  actual_project="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "${id}")"
  actual_service="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.service"}}' "${id}")"
  oneoff="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.oneoff"}}' "${id}")"
  number="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.container-number"}}' "${id}")"
  [[ "${actual_name}" == "${expected_name}" && "${actual_project}" == "${project}" && "${actual_service}" == "${service}" ]] || \
    remote_fail "unexpected Compose identity for ${expected_name}."
  [[ -z "${oneoff}" || "${oneoff}" == "${compose_missing}" || "${oneoff}" == False || "${oneoff}" == false ]] || \
    remote_fail "one-off container is not allowed for ${expected_name}."
  [[ "${number}" == 1 ]] || remote_fail "unexpected Compose container number for ${expected_name}."
  printf '%s' "${id}"
}

container_record() {
  local component="$1"
  local container_id="$2"
  local id name image status started restart ports networks project service oneoff number aliases

  id="$(docker inspect --format '{{.Id}}' "${container_id}")"
  name="$(docker inspect --format '{{.Name}}' "${container_id}")"
  name="${name#/}"
  image="$(docker inspect --format '{{.Config.Image}}' "${container_id}")"
  status="$(docker inspect --format '{{.State.Status}}' "${container_id}")"
  started="$(docker inspect --format '{{.State.StartedAt}}' "${container_id}")"
  restart="$(docker inspect --format '{{.RestartCount}}' "${container_id}")"
  ports="$(docker inspect --format '{{range $port, $bindings := .HostConfig.PortBindings}}{{$port}}={{range $bindings}}{{.HostPort}},{{end}};{{end}}' "${container_id}")"
  networks="$(docker inspect --format '{{range $network_name, $network := .NetworkSettings.Networks}}{{$network_name}}={{join $network.Aliases ","}};{{end}}' "${container_id}" | tr ';' '\n' | LC_ALL=C sort | tr '\n' ';')"
  project="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "${container_id}")"
  service="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.service"}}' "${container_id}")"
  oneoff="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.oneoff"}}' "${container_id}")"
  number="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.container-number"}}' "${container_id}")"
  aliases="$(docker inspect --format '{{range $network_name, $network := .NetworkSettings.Networks}}{{$network_name}}={{join $network.Aliases ","}};{{end}}' "${container_id}")"

  [[ "${id}" =~ ^[0-9a-fA-F]{64}$ ]] || remote_fail "${component} does not expose a full container ID."
  [[ "${status}" == running ]] || remote_fail "${component} is not running."
  [[ -n "${started}" ]] || remote_fail "${component} StartedAt is missing."
  [[ "${restart}" =~ ^[0-9]+$ ]] || remote_fail "${component} RestartCount is invalid."
  [[ -n "${networks}" ]] || remote_fail "${component} has no network attachment."

  if [[ "${component}" == catering-web && "${networks}" != *platform-infra_default=*web* ]]; then
    remote_fail "catering web has no platform-infra_default/web alias."
  fi
  if [[ "${component}" == shared-edge && ( "${networks}" != *platform-infra_default=* || "${networks}" != *zeiterfassung_default=* ) ]]; then
    remote_fail "shared edge network mapping is incomplete."
  fi
  if [[ "${component}" == zeiterfassung-app && "${networks}" != *zeiterfassung_default=* ]]; then
    remote_fail "Zeiterfassung network mapping is incomplete."
  fi

  printf 'STATE\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "${component}" "${id}" "${name}" "${image}" "${status}" "${started}" "${restart}" "${ports}" "${networks}" \
    "${project}" "${service}" "${oneoff}" "${number}" "${aliases}"
}

edge_id="$(resolve_compose_container shared-edge edge shared-edge-edge-1)"
web_id="$(resolve_compose_container platform-infra web platform-infra-web-1)"
postgres_id="$(resolve_compose_container platform-infra postgres platform-infra-postgres-1)"
intake_id="$(resolve_compose_container platform-infra intake platform-infra-intake-1)"
offer_id="$(resolve_compose_container platform-infra offer platform-infra-offer-1)"
production_id="$(resolve_compose_container platform-infra production platform-infra-production-1)"
exports_id="$(resolve_compose_container platform-infra exports platform-infra-exports-1)"
zeiterfassung_id="$(resolve_compose_container zeiterfassung app zeiterfassung-app-1)"
eventos_id="$(resolve_compose_container commcats-eventos app commcats-eventos-app)"
eventos_postgres_id="$(resolve_compose_container commcats-eventos postgres commcats-eventos-postgres)"
read_eventos_container_identity "${eventos_id}"

edge_state="$(container_record shared-edge "${edge_id}")"
web_state="$(container_record catering-web "${web_id}")"
postgres_state="$(container_record catering-postgres "${postgres_id}")"
intake_state="$(container_record catering-intake "${intake_id}")"
offer_state="$(container_record catering-offer "${offer_id}")"
production_state="$(container_record catering-production "${production_id}")"
exports_state="$(container_record catering-exports "${exports_id}")"
zeiterfassung_state="$(container_record zeiterfassung-app "${zeiterfassung_id}")"
eventos_state="$(container_record eventos-app "${eventos_id}")"
eventos_postgres_state="$(container_record eventos-postgres "${eventos_postgres_id}")"
read_zeiterfassung_container_metadata "${zeiterfassung_id}"

read_effective_upstreams() {
  local container_id="$1"
  local env_lines line expected actual_count expected_count
  local expected_values=(
    'CATERING_UPSTREAM=http://web:8081'
    'ZEITERFASSUNG_UPSTREAM=zeiterfassung-app-1:3040'
    'EVENTOS_UPSTREAM=commcats-eventos-app:3045'
  )

  env_lines="$(docker inspect --format '{{range .Config.Env}}{{if contains . "_UPSTREAM="}}{{println .}}{{end}}{{end}}' "${container_id}")" || remote_fail "shared-edge effective upstream inspection failed."
  actual_count="$(printf '%s\n' "${env_lines}" | awk 'NF { count += 1 } END { print count + 0 }')"
  [[ "${actual_count}" == 3 ]] || remote_fail "shared-edge effective upstream set is missing, duplicated or unexpected."
  while IFS= read -r line; do
    [[ -n "${line}" && "${line}" != *$'\r'* ]] || remote_fail "shared-edge effective upstream entry is malformed."
    case " ${expected_values[*]} " in
      *" ${line} "*) ;;
      *) remote_fail "shared-edge effective upstream value is not allowlisted." ;;
    esac
  done <<< "${env_lines}"
  for expected in "${expected_values[@]}"; do
    expected_count="$(printf '%s\n' "${env_lines}" | grep -Fxc -- "${expected}" || true)"
    [[ "${expected_count}" == 1 ]] || remote_fail "shared-edge effective upstream is missing or duplicated."
  done
  printf 'UPSTREAM\tcatering\thttp://web:8081\tcatering-web\n'
  printf 'UPSTREAM\tzeiterfassung\tzeiterfassung-app-1:3040\tzeiterfassung-app\n'
  printf 'UPSTREAM\teventos\tcommcats-eventos-app:3045\teventos-app\n'
}

read_effective_upstreams "${edge_id}"

read_effective_edge_value() {
  local container_id="$1"
  local key="$2"
  local values count value
  values="$(docker inspect --format "{{range .Config.Env}}{{if contains . \"${key}=\"}}{{println .}}{{end}}{{end}}" "${container_id}")" || remote_fail "shared-edge effective ${key} inspection failed."
  count="$(printf '%s\n' "${values}" | awk 'NF { count += 1 } END { print count + 0 }')"
  [[ "${count}" == 1 ]] || remote_fail "shared-edge effective ${key} is missing or duplicated."
  value="${values#${key}=}"
  [[ "${value}" != *$'\r'* && -n "${value}" ]] || remote_fail "shared-edge effective ${key} is malformed."
  printf '%s' "${value}"
}

validate_effective_caddy_config() {
  local caddy_path="${edge_path}/Caddyfile"
  local caddy_hash caddy_mount mount_count mount_source mount_destination mount_mode mount_rw
  local catering_host zeiterfassung_host eventos_host

  [[ -f "${caddy_path}" && ! -L "${caddy_path}" ]] || remote_fail "shared-edge Caddyfile is not a regular non-symlink file."
  caddy_hash="$(sha256sum "${caddy_path}" | awk '{ print $1 }')"
  [[ "${caddy_hash}" == "${expected_caddyfile_sha256}" ]] || remote_fail "shared-edge Caddyfile hash differs from the checked-out evidence hash."

  caddy_mount="$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/etc/caddy/Caddyfile"}}{{.Source}}\t{{.Destination}}\t{{.Mode}}\t{{.RW}}{{end}}{{end}}' "${edge_id}")" || remote_fail "shared-edge Caddyfile mount inspection failed."
  mount_count="$(printf '%s\n' "${caddy_mount}" | awk 'NF { count += 1 } END { print count + 0 }')"
  [[ "${mount_count}" == 1 ]] || remote_fail "shared-edge Caddyfile mount is missing or ambiguous."
  IFS=$'\t' read -r mount_source mount_destination mount_mode mount_rw <<< "${caddy_mount}"
  [[ "${mount_destination}" == /etc/caddy/Caddyfile && "${mount_mode}" == ro && "${mount_rw}" == false ]] || remote_fail "shared-edge Caddyfile mount is not read-only."
  [[ "$(realpath -e "${mount_source}")" == "$(realpath -e "${caddy_path}")" ]] || remote_fail "shared-edge Caddyfile mount source is not the checked-out edge file."

  catering_host="$(read_effective_edge_value "${edge_id}" CATERING_PUBLIC_HOST)"
  zeiterfassung_host="$(read_effective_edge_value "${edge_id}" ZEITERFASSUNG_PUBLIC_HOST)"
  eventos_host="$(read_effective_edge_value "${edge_id}" EVENTOS_PUBLIC_HOST)"
  [[ "${catering_host}" == catering.the-one.catering ]] || remote_fail "Catering Caddy host identity is not the canonical public host."
  [[ "${zeiterfassung_host}" == zeit.the-one.catering ]] || remote_fail "Zeiterfassung Caddy host identity is not the canonical public host."
  [[ "${eventos_host}" == eventos.commcats.de ]] || remote_fail "EventOS Caddy host identity is not the canonical public host."

  python3 - "${caddy_path}" <<'PYTHON'
import re
import sys

text = open(sys.argv[1], encoding="utf-8").read()
if re.search(r"(?m)^\s*import\b", text):
    raise SystemExit("Caddyfile import is not allowlisted")
host_vars = re.findall(r"(?m)^\{\$([A-Z0-9_]+)\}\s*\{\s*$", text)
if sorted(host_vars) != sorted(["CATERING_PUBLIC_HOST", "ZEITERFASSUNG_PUBLIC_HOST", "EVENTOS_PUBLIC_HOST"]):
    raise SystemExit(1)
proxy_vars = re.findall(r"(?m)^\s*reverse_proxy\s+\{\$([A-Z0-9_]+)\}", text)
if sorted(proxy_vars) != sorted(["CATERING_UPSTREAM", "ZEITERFASSUNG_UPSTREAM", "EVENTOS_UPSTREAM"]):
    raise SystemExit(1)
expected_fragments = [
    "{$CATERING_PUBLIC_HOST} {\n  reverse_proxy {$CATERING_UPSTREAM} {\n    header_up Host {$CATERING_PUBLIC_HOST}\n  }\n}",
    "{$ZEITERFASSUNG_PUBLIC_HOST} {\n  reverse_proxy {$ZEITERFASSUNG_UPSTREAM}\n}",
    "{$EVENTOS_PUBLIC_HOST} {\n  reverse_proxy {$EVENTOS_UPSTREAM}\n}",
]
if any(fragment not in text for fragment in expected_fragments):
    raise SystemExit(1)
PYTHON
  printf 'CADDY\t%s\t%s\t%s\t%s\n' "${caddy_hash}" "${catering_host}" "${zeiterfassung_host}" "${eventos_host}"
}

validate_effective_caddy_config

edge_ports="$(printf '%s\n' "${edge_state}" | awk -F '\t' '{ print $9 }')"
[[ "${edge_ports}" == *80/tcp=80,* ]] || remote_fail "shared edge does not own host port 80."
[[ "${edge_ports}" == *443/tcp=443,* ]] || remote_fail "shared edge does not own host port 443."

for app_state in "${web_state}" "${postgres_state}" "${intake_state}" "${offer_state}" "${production_state}" "${exports_state}" "${zeiterfassung_state}" "${eventos_state}" "${eventos_postgres_state}"; do
  app_ports="$(printf '%s\n' "${app_state}" | awk -F '\t' '{ print $9 }')"
  [[ "${app_ports}" != *80/tcp=* ]] || remote_fail "an application container still publishes port 80."
  [[ "${app_ports}" != *443/tcp=* ]] || remote_fail "an application container still publishes port 443."
done
eventos_ports="$(printf '%s\n' "${eventos_state}" | awk -F '\t' '{ print $9 }')"
eventos_postgres_ports="$(printf '%s\n' "${eventos_postgres_state}" | awk -F '\t' '{ print $9 }')"
[[ "${eventos_ports}" != *3000/tcp=* && "${eventos_ports}" != *5432/tcp=* ]] || remote_fail "EventOS publishes a forbidden host port."
[[ -z "${eventos_postgres_ports}" ]] || remote_fail "EventOS Postgres has a host port."

validate_public_listener_ownership() {
  local container_id="$1"
  local edge_pid edge_ips listeners public_port listener_line listener_pid_matches listener_pid_match listener_pid
  local cgroup cmdline exe correlated container_ip
  local -a listener_lines

  edge_pid="$(docker inspect --format '{{.State.Pid}}' "${container_id}")"
  [[ "${edge_pid}" =~ ^[1-9][0-9]*$ ]] || remote_fail "Shared Edge container PID is unavailable."
  edge_ips="$(docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}\n{{end}}' "${container_id}")"
  [[ -n "${edge_ips}" ]] || remote_fail "Shared Edge container IP is unavailable for listener correlation."
  listeners="$(ss -ltnp)" || remote_fail "TCP listener inspection failed."

  for public_port in 80 443; do
    mapfile -t listener_lines < <(printf '%s\n' "${listeners}" | awk -v port=":${public_port}" '$1 == "LISTEN" && substr($4, length($4) - length(port) + 1) == port { print }')
    [[ "${#listener_lines[@]}" -gt 0 ]] || remote_fail "TCP ${public_port} has no listening process."
    for listener_line in "${listener_lines[@]}"; do
      listener_pid_matches="$(printf '%s\n' "${listener_line}" | grep -oE 'pid=[0-9]+' || true)"
      [[ "$(printf '%s\n' "${listener_pid_matches}" | awk 'NF { count += 1 } END { print count + 0 }')" == 1 ]] || remote_fail "TCP ${public_port} listener PID is missing or ambiguous."
      listener_pid_match="${listener_pid_matches%%$'\n'*}"
      listener_pid="${listener_pid_match#pid=}"
      [[ -r "/proc/${listener_pid}/cgroup" && -r "/proc/${listener_pid}/cmdline" ]] || remote_fail "TCP ${public_port} listener PID cannot be inspected."
      cgroup="$(tr '\n' ' ' < "/proc/${listener_pid}/cgroup")"
      cmdline="$(tr '\0' ' ' < "/proc/${listener_pid}/cmdline")"
      exe="$(readlink -f "/proc/${listener_pid}/exe" || true)"
      correlated=false
      [[ "${listener_pid}" == "${edge_pid}" ]] && correlated=true
      [[ "${cgroup}" == *"${container_id}"* ]] && correlated=true
      if [[ "${cmdline}" == *docker-proxy* || "${exe}" == */docker-proxy ]]; then
        for container_ip in ${edge_ips}; do
          if [[ "${cmdline}" == *"-container-ip ${container_ip}"* && "${cmdline}" == *"-container-port ${public_port}"* ]]; then
            correlated=true
          fi
        done
      fi
      [[ "${correlated}" == true ]] || remote_fail "TCP ${public_port} listener PID is not correlated to the exact Shared Edge container."
      printf 'LISTENER\t%s\tpid=%s\tcontainer=%s\n' "${listener_line}" "${listener_pid}" "${container_id}"
    done
  done
}

validate_public_listener_ownership "${edge_id}"

all_container_ids="$(docker ps --no-trunc --format '{{.ID}}')"
for container_id in ${all_container_ids}; do
  inventory_name="$(docker inspect --format '{{.Name}}' "${container_id}")"
  inventory_name="${inventory_name#/}"
  inventory_project="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "${container_id}")"
  inventory_service="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.service"}}' "${container_id}")"
  case "${inventory_project}/${inventory_service}/${inventory_name}" in
    shared-edge/edge/shared-edge-edge-1|platform-infra/postgres/platform-infra-postgres-1|platform-infra/intake/platform-infra-intake-1|platform-infra/offer/platform-infra-offer-1|platform-infra/production/platform-infra-production-1|platform-infra/exports/platform-infra-exports-1|platform-infra/web/platform-infra-web-1|zeiterfassung/app/zeiterfassung-app-1|commcats-eventos/app/commcats-eventos-app|commcats-eventos/postgres/commcats-eventos-postgres) ;;
    *) remote_fail "unknown runtime container or network consumer is outside the allowlist." ;;
  esac
done
port_owner_lines=""
for container_id in ${all_container_ids}; do
  owner_id="$(docker inspect --format '{{.Id}}' "${container_id}")"
  owner_name="$(docker inspect --format '{{.Name}}' "${container_id}")"
  owner_name="${owner_name#/}"
  owner_ports="$(docker inspect --format '{{range $port, $bindings := .HostConfig.PortBindings}}{{$port}}={{range $bindings}}{{.HostPort}},{{end}};{{end}}' "${container_id}")"
  for public_port in 80 443; do
    if [[ "${owner_ports}" == *"${public_port}/tcp="* ]]; then
      port_owner_lines+="PORT_OWNER\t${public_port}\t${owner_id}\t${owner_name}\n"
    fi
  done
done
printf '%b' "${port_owner_lines}"
for public_port in 80 443; do
  owner_count="$(printf '%b' "${port_owner_lines}" | awk -F '\t' -v port="${public_port}" '$1 == "PORT_OWNER" && $2 == port { count += 1 } END { print count + 0 }')"
  [[ "${owner_count}" == 1 ]] || remote_fail "public 80/443 ownership is ambiguous for port ${public_port}."
  printf '%b' "${port_owner_lines}" | awk -F '\t' -v port="${public_port}" '$1 == "PORT_OWNER" && $2 == port && $4 != "shared-edge-edge-1" { exit 1 }' || remote_fail "foreign public port owner detected for port ${public_port}."
done

container_ids=(
  "${edge_id}"
  "${web_id}"
  "${postgres_id}"
  "${intake_id}"
  "${offer_id}"
  "${production_id}"
  "${exports_id}"
  "${zeiterfassung_id}"
  "${eventos_id}"
  "${eventos_postgres_id}"
)
network_names="$(for container_id in "${container_ids[@]}"; do
  docker inspect --format '{{range $network_name, $network := .NetworkSettings.Networks}}{{$network_name}}\n{{end}}' "${container_id}"
done | LC_ALL=C sort -u)"

printf '%s\n' "${network_listing}" | awk -F '\t' '$1 == "platform-infra_default" || $1 == "zeiterfassung_default" || $1 == "commcats-eventos_default" { printf "NETWORK_LS\t%s\n", $0 }'
printf '%s\n' "${network_names}" | while IFS= read -r network_name; do
  [[ -n "${network_name}" ]] || continue
  network_details="$(docker network inspect --format '{{.Name}}\t{{.Id}}\t{{.Driver}}\t{{.Scope}}' "${network_name}")"
  network_members="$(docker network inspect --format '{{range $container_id, $container := .Containers}}{{$container.Name}}={{join $container.Aliases ","}};{{end}}' "${network_name}" | tr ';' '\n' | LC_ALL=C sort | tr '\n' ';')"
  printf 'NETWORK\t%s\t%s\n' "${network_details}" "${network_members}"
done

snapshot_lock_after="$(validate_deploy_lock_absent "${edge_lock_path}")"
validate_manifest_file "${edge_path}/.deploy-manifest" "${rollback_root}" "${expected_commit}" cutover
snapshot_manifest_after="$(sha256sum "${edge_path}/.deploy-manifest" | awk '{ print $1 }')"
snapshot_generation_after="$(read_edge_generation "${edge_path}")"
[[ "${snapshot_lock_before}" == "${snapshot_lock_after}" ]] || remote_fail "snapshot lock state changed during evidence collection."
[[ "${snapshot_manifest_before}" == "${snapshot_manifest_after}" ]] || remote_fail "snapshot manifest changed during evidence collection."
[[ "${snapshot_generation_before}" == "${snapshot_generation_after}" ]] || remote_fail "snapshot generation changed during evidence collection."
printf '%s\n' "${snapshot_lock_before}" "${snapshot_generation_before}"

printf 'ZEITERFASSUNG_CONTAINER\t%s\t%s\n' \
  "${ZEITERFASSUNG_CONTAINER_IMAGE}" "${ZEITERFASSUNG_COMPOSE_WORKING_DIR}"
printf 'EVENTOS_RELEASE\t%s\n' "${EVENTOS_RELEASE_SHA}"
printf 'METADATA\tshared-edge-commit\t%s\n' "${manifest_commit}"
printf 'METADATA\tshared-edge-mode\t%s\n' "${manifest_mode}"
printf 'METADATA\tshared-edge-deployed-at\t%s\n' "${manifest_time}"
printf '%s\n' "${edge_state}" "${web_state}" "${postgres_state}" "${intake_state}" "${offer_state}" "${production_state}" "${exports_state}" "${zeiterfassung_state}" "${eventos_state}" "${eventos_postgres_state}"
REMOTE_SCRIPT
}

state_line() {
  local snapshot="$1"
  local component="$2"
  local line
  if ! line="$(printf '%s\n' "${snapshot}" | awk -F '\t' -v component="${component}" '$1 == "STATE" && $2 == component { print; count += 1 } END { if (count != 1) exit 1 }')"; then
    fail "missing or ambiguous container state for ${component}."
  fi
  printf '%s' "${line}"
}

state_field() {
  local line="$1"
  local field_number="$2"
  printf '%s\n' "${line}" | awk -F '\t' -v field_number="${field_number}" '{ print $field_number }'
}

zeiterfassung_container_line() {
  local snapshot="$1"
  local line
  if ! line="$(printf '%s\n' "${snapshot}" | awk -F '\t' '$1 == "ZEITERFASSUNG_CONTAINER" { print; count += 1 } END { if (count != 1) exit 1 }')"; then
    fail "missing or ambiguous Zeiterfassung container metadata."
  fi
  printf '%s' "${line}"
}

eventos_release_line() {
  local snapshot="$1"
  local line
  if ! line="$(printf '%s\n' "${snapshot}" | awk -F '\t' '$1 == "EVENTOS_RELEASE" { print; count += 1 } END { if (count != 1) exit 1 }')"; then
    fail "missing or ambiguous EventOS release marker evidence."
  fi
  printf '%s' "${line}"
}

eventos_identity_line() {
  local snapshot="$1"
  local line
  if ! line="$(printf '%s\n' "${snapshot}" | awk -F '\t' '$1 == "EVENTOS_IDENTITY" { print; count += 1 } END { if (count != 1) exit 1 }')"; then
    fail "missing or ambiguous EventOS immutable container identity."
  fi
  printf '%s' "${line}"
}

upstream_evidence() {
  local snapshot="$1"
  local actual expected
  actual="$(printf '%s\n' "${snapshot}" | awk -F '\t' '$1 == "UPSTREAM" { print }')"
  expected=$'UPSTREAM\tcatering\thttp://web:8081\tcatering-web\nUPSTREAM\tzeiterfassung\tzeiterfassung-app-1:3040\tzeiterfassung-app\nUPSTREAM\teventos\tcommcats-eventos-app:3045\teventos-app'
  [[ "${actual}" == "${expected}" ]] || fail "effective shared-edge upstream evidence is missing, duplicated or drifted."
  printf '%s' "${actual}"
}

lock_line() {
  local snapshot="$1"
  local line
  if ! line="$(printf '%s\n' "${snapshot}" | awk -F '\t' '$1 == "LOCK" { print; count += 1 } END { if (count != 1) exit 1 }')"; then
    fail "missing or ambiguous deploy-lock evidence."
  fi
  [[ "${line}" == $'LOCK\tabsent' ]] || fail "shared-edge deploy lock is active or ambiguous."
  printf '%s' "${line}"
}

generation_line() {
  local snapshot="$1"
  local file="$2"
  local line
  if ! line="$(printf '%s\n' "${snapshot}" | awk -F '\t' -v expected_file="${file}" '$1 == "GENERATION" && $2 == expected_file { print; count += 1 } END { if (count != 1) exit 1 }')"; then
    fail "missing or ambiguous ${file} generation evidence."
  fi
  [[ "$(state_field "${line}" 3)" =~ ^[0-9a-f]{64}$ ]] || fail "${file} generation digest is invalid."
  printf '%s' "${line}"
}

compare_generation_invariants() {
  local file before_line after_line
  for file in .deploy-manifest docker-compose.yml Caddyfile; do
    before_line="$(generation_line "${before_snapshot}" "${file}")"
    after_line="$(generation_line "${after_snapshot}" "${file}")"
    [[ "${before_line}" == "${after_line}" ]] || fail "shared-edge ${file} generation changed during evidence collection."
  done
}

compare_network_invariants() {
  local network_name before_line after_line
  for network_name in platform-infra_default zeiterfassung_default commcats-eventos_default; do
    before_line="$(printf '%s\n' "${before_snapshot}" | awk -F '\t' -v name="${network_name}" '$1 == "NETWORK" && $2 == name { print; count += 1 } END { if (count != 1) exit 1 }')" || fail "missing or ambiguous before network evidence for ${network_name}."
    after_line="$(printf '%s\n' "${after_snapshot}" | awk -F '\t' -v name="${network_name}" '$1 == "NETWORK" && $2 == name { print; count += 1 } END { if (count != 1) exit 1 }')" || fail "missing or ambiguous after network evidence for ${network_name}."
    [[ "${before_line}" == "${after_line}" ]] || fail "network ID, driver, scope, member or alias set changed for ${network_name}."
  done
}

load_eventos_release_marker() {
  local snapshot="$1"
  local line release_sha
  line="$(eventos_release_line "${snapshot}")"
  release_sha="$(state_field "${line}" 2)"
  [[ "${release_sha}" =~ ^[0-9a-f]{40}$ ]] || fail "EventOS release marker evidence is invalid."
  EVENTOS_RELEASE_SHA="${release_sha}"
}

load_zeiterfassung_container_metadata() {
  local snapshot="$1"
  local line image working_dir
  line="$(zeiterfassung_container_line "${snapshot}")"
  image="$(state_field "${line}" 2)"
  working_dir="$(state_field "${line}" 3)"
  [[ "${working_dir}" == /* && "${working_dir}" != *$'\n'* && "${working_dir}" != *$'\r'* ]] || fail "Zeiterfassung container metadata working-dir label is invalid."
  [[ "${image}" =~ ^zeiterfassung-app:(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z.-]+)?$ || "${image}" =~ ^zeiterfassung-app@sha256:[0-9a-f]{64}$ ]] || fail "Zeiterfassung container metadata image is invalid."
}

validate_allowlisted_inventory() {
  local snapshot="${1:-}"
  local expected_components actual_components component line id name project service oneoff number networks network_name aliases member_count port_line port_count network_line network_id driver scope members member_name compose_missing
  local actual_network_count expected_network_count expected_component_aliases normalized_aliases expected_member_aliases normalized_members expected_members_normalized
  compose_missing="$(printf '\074no value\076')"
  expected_components=$'catering-exports\ncatering-intake\ncatering-offer\ncatering-postgres\ncatering-production\ncatering-web\neventos-app\neventos-postgres\nshared-edge\nzeiterfassung-app'
  actual_components="$(printf '%s\n' "${snapshot}" | awk -F '\t' '$1 == "STATE" { print $2 }' | LC_ALL=C sort)"
  [[ "${actual_components}" == "${expected_components}" ]] || fail "unknown network consumer or runtime inventory component allowlist mismatch."

  normalize_aliases() {
    printf '%s\n' "$1" | tr ',' '\n' | awk 'NF { print }' | LC_ALL=C sort | awk 'BEGIN { separator="" } { printf "%s%s", separator, $0; separator="," } END { printf "\n" }'
  }

  expected_aliases_for_component() {
    case "$1" in
      shared-edge) printf '%s' 'edge,shared-edge-edge-1' ;;
      catering-web) printf '%s' 'web,platform-infra-web-1' ;;
      catering-postgres) printf '%s' 'postgres,platform-infra-postgres-1' ;;
      catering-intake) printf '%s' 'intake,platform-infra-intake-1' ;;
      catering-offer) printf '%s' 'offer,platform-infra-offer-1' ;;
      catering-production) printf '%s' 'production,platform-infra-production-1' ;;
      catering-exports) printf '%s' 'exports,platform-infra-exports-1' ;;
      zeiterfassung-app) printf '%s' 'app,zeiterfassung-app-1' ;;
      eventos-app) printf '%s' 'app,commcats-eventos-app' ;;
      eventos-postgres) printf '%s' 'postgres,commcats-eventos-postgres' ;;
      *) fail "unknown runtime inventory component." ;;
    esac
  }

  while IFS= read -r component; do
    line="$(state_line "${snapshot}" "${component}")"
    id="$(state_field "${line}" 3)"
    name="$(state_field "${line}" 4)"
    project="$(state_field "${line}" 11)"
    service="$(state_field "${line}" 12)"
    oneoff="$(state_field "${line}" 13)"
    number="$(state_field "${line}" 14)"
    networks="$(state_field "${line}" 10)"
    [[ "${id}" =~ ^[0-9a-fA-F]{64}$ ]] || fail "${component} full container ID is invalid."
    [[ "$(state_field "${line}" 6)" == running && -n "$(state_field "${line}" 7)" ]] || fail "${component} is not running or has no StartedAt."
    [[ "$(state_field "${line}" 8)" =~ ^[0-9]+$ ]] || fail "${component} RestartCount is invalid."
    [[ "${oneoff}" == "${compose_missing}" || "${oneoff}" == False || "${oneoff}" == false || -z "${oneoff}" ]] || fail "unexpected one-off Compose container."
    [[ "${number}" == 1 ]] || fail "unexpected Compose container number."
    case "${component}" in
      shared-edge) expected_name=shared-edge-edge-1; expected_project=shared-edge; expected_service=edge; expected_networks='platform-infra_default zeiterfassung_default' ;;
      catering-web) expected_name=platform-infra-web-1; expected_project=platform-infra; expected_service=web; expected_networks='platform-infra_default zeiterfassung_default' ;;
      catering-postgres) expected_name=platform-infra-postgres-1; expected_project=platform-infra; expected_service=postgres; expected_networks='platform-infra_default' ;;
      catering-intake) expected_name=platform-infra-intake-1; expected_project=platform-infra; expected_service=intake; expected_networks='platform-infra_default' ;;
      catering-offer) expected_name=platform-infra-offer-1; expected_project=platform-infra; expected_service=offer; expected_networks='platform-infra_default' ;;
      catering-production) expected_name=platform-infra-production-1; expected_project=platform-infra; expected_service=production; expected_networks='platform-infra_default' ;;
      catering-exports) expected_name=platform-infra-exports-1; expected_project=platform-infra; expected_service=exports; expected_networks='platform-infra_default' ;;
      zeiterfassung-app) expected_name=zeiterfassung-app-1; expected_project=zeiterfassung; expected_service=app; expected_networks='zeiterfassung_default' ;;
      eventos-app) expected_name=commcats-eventos-app; expected_project=commcats-eventos; expected_service=app; expected_networks='commcats-eventos_default platform-infra_default' ;;
      eventos-postgres) expected_name=commcats-eventos-postgres; expected_project=commcats-eventos; expected_service=postgres; expected_networks='commcats-eventos_default' ;;
      *) fail "unknown runtime inventory component." ;;
    esac
    [[ "${name}" == "${expected_name}" && "${project}" == "${expected_project}" && "${service}" == "${expected_service}" ]] || fail "unexpected Compose label or container name for ${component}."
    actual_network_count="$(printf '%s' "${networks}" | tr ';' '\n' | awk 'NF { count += 1 } END { print count + 0 }')"
    expected_network_count="$(printf '%s\n' "${expected_networks}" | tr ' ' '\n' | awk 'NF { count += 1 } END { print count + 0 }')"
    [[ "${actual_network_count}" == "${expected_network_count}" ]] || fail "${component} has an unknown or duplicate network attachment."
    expected_component_aliases="$(expected_aliases_for_component "${component}")"
    for expected_network in ${expected_networks}; do
      [[ "${networks}" == *"${expected_network}="* ]] || fail "${component} network mapping is incomplete."
    done
    while IFS='=' read -r network_name aliases; do
      [[ -n "${network_name}" ]] || continue
      case " ${expected_networks} " in *" ${network_name} "*) ;; *) fail "unknown network consumer or unexpected network on ${component}." ;; esac
      normalized_aliases="$(normalize_aliases "${aliases}")"
      [[ "${normalized_aliases}" == "$(normalize_aliases "${expected_component_aliases}")" ]] || fail "unexpected network alias set on ${component}."
    done < <(printf '%s' "${networks}" | tr ';' '\n')
  done <<< "${expected_components}"

  for network_name in platform-infra_default zeiterfassung_default commcats-eventos_default; do
    network_ls_line="$(printf '%s\n' "${snapshot}" | awk -F '\t' -v name="${network_name}" '$1 == "NETWORK_LS" && $2 == name { print; count += 1 } END { if (count != 1) exit 1 }')" || fail "missing or ambiguous docker network ls evidence for ${network_name}."
    network_line="$(printf '%s\n' "${snapshot}" | awk -F '\t' -v name="${network_name}" '$1 == "NETWORK" && $2 == name { print; count += 1 } END { if (count != 1) exit 1 }')" || fail "missing or ambiguous network ID for ${network_name}."
    [[ "$(state_field "${network_ls_line}" 3)" == "$(state_field "${network_line}" 3)" && "$(state_field "${network_ls_line}" 4)" == "$(state_field "${network_line}" 4)" && "$(state_field "${network_ls_line}" 5)" == "$(state_field "${network_line}" 5)" ]] || fail "docker network ls and inspect evidence disagree for ${network_name}."
    network_id="$(state_field "${network_line}" 3)"
    driver="$(state_field "${network_line}" 4)"
    scope="$(state_field "${network_line}" 5)"
    members="$(state_field "${network_line}" 6)"
    [[ "${network_id}" =~ ^[0-9a-fA-F]{64}$ ]] || fail "network ID is not full length for ${network_name}."
    [[ "${driver}" == bridge && "${scope}" == local ]] || fail "unexpected network driver or scope for ${network_name}."
    case "${network_name}" in
      platform-infra_default) expected_members='commcats-eventos-app platform-infra-exports-1 platform-infra-intake-1 platform-infra-offer-1 platform-infra-postgres-1 platform-infra-production-1 platform-infra-web-1 shared-edge-edge-1' ;;
      zeiterfassung_default) expected_members='platform-infra-web-1 shared-edge-edge-1 zeiterfassung-app-1' ;;
      commcats-eventos_default) expected_members='commcats-eventos-app commcats-eventos-postgres' ;;
    esac
    case "${network_name}" in
      platform-infra_default) expected_members_normalized='commcats-eventos-app=app,commcats-eventos-app;platform-infra-exports-1=exports,platform-infra-exports-1;platform-infra-intake-1=intake,platform-infra-intake-1;platform-infra-offer-1=offer,platform-infra-offer-1;platform-infra-postgres-1=platform-infra-postgres-1,postgres;platform-infra-production-1=platform-infra-production-1,production;platform-infra-web-1=platform-infra-web-1,web;shared-edge-edge-1=edge,shared-edge-edge-1' ;;
      zeiterfassung_default) expected_members_normalized='platform-infra-web-1=platform-infra-web-1,web;shared-edge-edge-1=edge,shared-edge-edge-1;zeiterfassung-app-1=app,zeiterfassung-app-1' ;;
      commcats-eventos_default) expected_members_normalized='commcats-eventos-app=app,commcats-eventos-app;commcats-eventos-postgres=commcats-eventos-postgres,postgres' ;;
    esac
    while IFS='=' read -r member_name aliases; do
      [[ -n "${member_name}" ]] || continue
      case " ${expected_members} " in *" ${member_name} "*) ;; *) fail "unknown network consumer on ${network_name}." ;; esac
      case "${network_name}/${member_name}" in
        platform-infra_default/commcats-eventos-app|commcats-eventos_default/commcats-eventos-app) expected_member_aliases='app,commcats-eventos-app' ;;
        platform-infra_default/platform-infra-exports-1) expected_member_aliases='exports,platform-infra-exports-1' ;;
        platform-infra_default/platform-infra-intake-1) expected_member_aliases='intake,platform-infra-intake-1' ;;
        platform-infra_default/platform-infra-offer-1) expected_member_aliases='offer,platform-infra-offer-1' ;;
        platform-infra_default/platform-infra-postgres-1) expected_member_aliases='postgres,platform-infra-postgres-1' ;;
        platform-infra_default/platform-infra-production-1) expected_member_aliases='production,platform-infra-production-1' ;;
        platform-infra_default/platform-infra-web-1|zeiterfassung_default/platform-infra-web-1) expected_member_aliases='web,platform-infra-web-1' ;;
        platform-infra_default/shared-edge-edge-1|zeiterfassung_default/shared-edge-edge-1) expected_member_aliases='edge,shared-edge-edge-1' ;;
        zeiterfassung_default/zeiterfassung-app-1) expected_member_aliases='app,zeiterfassung-app-1' ;;
        commcats-eventos_default/commcats-eventos-postgres) expected_member_aliases='postgres,commcats-eventos-postgres' ;;
        *) fail "unknown network consumer or alias contract on ${network_name}." ;;
      esac
      [[ "$(normalize_aliases "${aliases}")" == "$(normalize_aliases "${expected_member_aliases}")" ]] || fail "unexpected network alias set on ${network_name}."
    done < <(printf '%s' "${members}" | tr ';' '\n')
    normalized_members="$(while IFS='=' read -r member_name aliases; do [[ -n "${member_name}" ]] && printf '%s=%s\n' "${member_name}" "$(normalize_aliases "${aliases}")"; done < <(printf '%s' "${members}" | tr ';' '\n') | LC_ALL=C sort | awk 'BEGIN { separator="" } { printf "%s%s", separator, $0; separator=";" } END { printf "\n" }')"
    [[ "${normalized_members}" == "${expected_members_normalized}" ]] || fail "network member or alias set is not exact on ${network_name}."
    member_count="$(printf '%s' "${members}" | tr ';' '\n' | awk 'NF { count += 1 } END { print count + 0 }')"
    expected_count="$(printf '%s\n' "${expected_members}" | tr ' ' '\n' | awk 'NF { count += 1 } END { print count + 0 }')"
    [[ "${member_count}" == "${expected_count}" ]] || fail "unknown network consumer on ${network_name}."
  done

  for public_port in 80 443; do
    port_count="$(printf '%s\n' "${snapshot}" | awk -F '\t' -v port="${public_port}" '$1 == "PORT_OWNER" && $2 == port { count += 1 } END { print count + 0 }')"
    [[ "${port_count}" == 1 ]] || fail "public 80/443 ownership is ambiguous."
    port_line="$(printf '%s\n' "${snapshot}" | awk -F '\t' -v port="${public_port}" '$1 == "PORT_OWNER" && $2 == port { print }')"
    [[ "$(state_field "${port_line}" 4)" == shared-edge-edge-1 ]] || fail "foreign public port owner detected."
    [[ "$(state_field "${port_line}" 3)" =~ ^[0-9a-fA-F]{64}$ ]] || fail "public port owner ID is not full length."
  done
}

print_container_summary() {
  local phase="$1"
  local snapshot="$2"
  local component line id
  for component in "${COMPONENTS[@]}"; do
    line="$(state_line "${snapshot}" "${component}")"
    id="$(state_field "${line}" 3)"
    # Keep the full container ID as non-secret identity evidence, not only a display prefix.
    printf 'CONTAINER\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
      "${phase}" "${component}" "${id}" \
      "$(state_field "${line}" 4)" "$(state_field "${line}" 5)" \
      "$(state_field "${line}" 6)" "$(state_field "${line}" 7)" \
      "$(state_field "${line}" 8)" "$(state_field "${line}" 9)" "$(state_field "${line}" 10)"
  done
}

compare_identity_invariants() {
  local component before_line after_line before_id after_id before_restart after_restart before_networks after_networks before_container_metadata after_container_metadata before_upstreams after_upstreams before_eventos after_eventos before_eventos_identity after_eventos_identity before_lock after_lock
  for component in "${COMPONENTS[@]}"; do
    before_line="$(state_line "${before_snapshot}" "${component}")"
    after_line="$(state_line "${after_snapshot}" "${component}")"
    before_id="$(state_field "${before_line}" 3)"
    after_id="$(state_field "${after_line}" 3)"
    before_restart="$(state_field "${before_line}" 8)"
    after_restart="$(state_field "${after_line}" 8)"
    before_networks="$(state_field "${before_line}" 10)"
    after_networks="$(state_field "${after_line}" 10)"
    [[ "${before_id}" == "${after_id}" ]] || fail "Container ID changed for ${component}."
    [[ "${before_restart}" == "${after_restart}" ]] || fail "RestartCount increased or changed for ${component}."
    [[ "${before_networks}" == "${after_networks}" ]] || fail "network mapping changed for ${component}."
  done
  before_container_metadata="$(zeiterfassung_container_line "${before_snapshot}")"
  after_container_metadata="$(zeiterfassung_container_line "${after_snapshot}")"
  [[ "${before_container_metadata}" == "${after_container_metadata}" ]] || fail "Zeiterfassung container metadata changed."
  before_upstreams="$(upstream_evidence "${before_snapshot}")"
  after_upstreams="$(upstream_evidence "${after_snapshot}")"
  [[ "${before_upstreams}" == "${after_upstreams}" ]] || fail "effective shared-edge upstream changed."
  before_eventos="$(eventos_release_line "${before_snapshot}")"
  after_eventos="$(eventos_release_line "${after_snapshot}")"
  [[ "${before_eventos}" == "${after_eventos}" ]] || fail "EventOS release marker changed."
  before_eventos_identity="$(eventos_identity_line "${before_snapshot}")"
  after_eventos_identity="$(eventos_identity_line "${after_snapshot}")"
  [[ "${before_eventos_identity}" == "${after_eventos_identity}" ]] || fail "EventOS immutable container identity changed."
  before_lock="$(lock_line "${before_snapshot}")"
  after_lock="$(lock_line "${after_snapshot}")"
  [[ "${before_lock}" == "${after_lock}" ]] || fail "shared-edge deploy lock state changed or became ambiguous."
  compare_generation_invariants
  compare_network_invariants
}

ZEITERFASSUNG_RELEASE_VERSION=""
ZEITERFASSUNG_RELEASE_GIT_SHA=""
EVENTOS_RELEASE_SHA=""

HTTP_STATUS=""
HTTP_CONTENT_TYPE=""
HTTP_CACHE_CONTROL=""
HTTP_BODY=""
CURL_ARGS=(--fail --silent --show-error --max-time 15 --proto '=https' --tlsv1.2)

validate_curl_args() {
  local argument insecure_short insecure_long
  insecure_short="$(printf '%s%s' '-' 'k')"
  insecure_long="$(printf '%s%s' '--' 'insecure')"
  for argument in "${CURL_ARGS[@]}"; do
    [[ "${argument}" != "${insecure_short}" && "${argument}" != "${insecure_long}" ]] || fail "insecure TLS option is forbidden."
  done
  printf '%s\n' "${CURL_ARGS[@]}" | grep -Fx -- '--fail' >/dev/null || fail "curl must fail closed on HTTP errors."
  printf '%s\n' "${CURL_ARGS[@]}" | grep -Fx -- '--proto' >/dev/null || fail "curl protocol allowlist is missing."
  printf '%s\n' "${CURL_ARGS[@]}" | grep -Fx -- '=https' >/dev/null || fail "curl must allow only HTTPS."
  printf '%s\n' "${CURL_ARGS[@]}" | grep -Fx -- '--tlsv1.2' >/dev/null || fail "curl TLS minimum is missing."
}

fetch_https() {
  local url="$1"
  local auth_mode="$2"
  local raw metadata
  case "${auth_mode}" in
    basic) raw="$(curl "${CURL_ARGS[@]}" --basic --config <(printf 'user = "%s:%s"\n' "${CATERING_SMOKE_BASIC_AUTH_USER}" "${CATERING_SMOKE_BASIC_AUTH_PASSWORD}") --write-out $'\n%{http_code}\t%{content_type}\t%{header.cache-control}' "${url}")" || return 1 ;;
    public) raw="$(curl "${CURL_ARGS[@]}" --write-out $'\n%{http_code}\t%{content_type}\t%{header.cache-control}' "${url}")" || return 1 ;;
    json) raw="$(curl "${CURL_ARGS[@]}" --header 'Accept: application/json' --write-out $'\n%{http_code}\t%{content_type}\t%{header.cache-control}' "${url}")" || return 1 ;;
    *) fail "unexpected HTTPS smoke mode." ;;
  esac
  metadata="${raw##*$'\n'}"
  HTTP_BODY="${raw%$'\n'*}"
  HTTP_STATUS="${metadata%%$'\t'*}"
  metadata="${metadata#*$'\t'}"
  HTTP_CONTENT_TYPE="${metadata%%$'\t'*}"
  HTTP_CACHE_CONTROL="${metadata#*$'\t'}"
  [[ "${HTTP_STATUS}" == 200 ]]
}

retry_https() {
  local label="$1"
  local url="$2"
  local auth_mode="$3"
  local attempt
  for attempt in 1 2 3; do
    if fetch_https "${url}" "${auth_mode}"; then
      return 0
    fi
    if (( attempt < 3 )); then
      sleep 2
    fi
  done
  fail "HTTPS/TLS smoke failed for ${label}."
}

lowercase() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

assert_zeiterfassung_identity() {
  [[ "$(lowercase "${HTTP_CONTENT_TYPE}")" == application/json* ]] || fail "Zeiterfassung content type is not JSON."
  printf '%s' "${HTTP_BODY}" | python3 -c 'import json, sys
try:
    payload = json.load(sys.stdin)
except (ValueError, TypeError):
    raise SystemExit(1)
if not isinstance(payload, dict) or payload.get("ok") is not True:
    raise SystemExit(1)
version = payload.get("version")
git_sha = payload.get("gitSha")
if not isinstance(version, str) or not isinstance(git_sha, str):
    raise SystemExit(1)
if version != sys.argv[1] or git_sha != sys.argv[2]:
    raise SystemExit(1)
' "${ZEITERFASSUNG_RELEASE_VERSION}" "${ZEITERFASSUNG_RELEASE_GIT_SHA}" || fail "Zeiterfassung semantic identity failed."
}

assert_zeiterfassung_release_identity() {
  [[ "$(lowercase "${HTTP_CONTENT_TYPE}")" == application/json* ]] || fail "Zeiterfassung healthz content type is not JSON."
  local identity
  identity="$(printf '%s' "${HTTP_BODY}" | python3 -c 'import json, re, sys
try:
    payload = json.load(sys.stdin)
except (ValueError, TypeError):
    raise SystemExit(1)
if not isinstance(payload, dict) or payload.get("ok") is not True:
    raise SystemExit(1)
version = payload.get("version")
git_sha = payload.get("gitSha")
if not isinstance(version, str) or version == "unknown":
    raise SystemExit(1)
version_pattern = r"(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?"
if not re.fullmatch(version_pattern, version):
    raise SystemExit(1)
if not isinstance(git_sha, str) or git_sha == "unknown" or not re.fullmatch(r"[0-9a-f]{40}", git_sha):
    raise SystemExit(1)
print(f"{version}\t{git_sha}")' )" || fail "Zeiterfassung release identity failed."
  IFS=$'\t' read -r ZEITERFASSUNG_RELEASE_VERSION ZEITERFASSUNG_RELEASE_GIT_SHA <<< "${identity}"
  [[ -n "${ZEITERFASSUNG_RELEASE_VERSION}" && -n "${ZEITERFASSUNG_RELEASE_GIT_SHA}" ]] || fail "Zeiterfassung release identity is incomplete."
}

assert_zeiterfassung_config_identity() {
  [[ "$(lowercase "${HTTP_CONTENT_TYPE}")" == application/json* ]] || fail "Zeiterfassung public config content type is not JSON."
  printf '%s' "${HTTP_BODY}" | python3 -c 'import json, sys
try:
    payload = json.load(sys.stdin)
except (ValueError, TypeError):
    raise SystemExit(1)
if not isinstance(payload, dict):
    raise SystemExit(1)
if payload.get("ok") is not True or payload.get("environmentLabel") != "Produktiv":
    raise SystemExit(1)
version = payload.get("version")
git_sha = payload.get("gitSha")
if not isinstance(version, str) or not isinstance(git_sha, str):
    raise SystemExit(1)
if version != sys.argv[1] or git_sha != sys.argv[2]:
    raise SystemExit(1)
if payload.get("appUrl") != "https://zeit.the-one.catering" or payload.get("platformCustomersEnabled") is not False:
    raise SystemExit(1)
' "${ZEITERFASSUNG_RELEASE_VERSION}" "${ZEITERFASSUNG_RELEASE_GIT_SHA}" || fail "Zeiterfassung public config identity failed."
}

assert_eventos_identity() {
  [[ "$(lowercase "${HTTP_CONTENT_TYPE}")" == application/json* ]] || fail "EventOS content type is not JSON."
  printf '%s' "${HTTP_BODY}" | python3 -c 'import json, sys
try:
    payload = json.load(sys.stdin)
except (ValueError, TypeError):
    raise SystemExit(1)
if not isinstance(payload, dict) or payload.get("ok") is not True or payload.get("service") != "commcats-eventos":
    raise SystemExit(1)
version = payload.get("version")
revision = payload.get("revision")
if not isinstance(version, str) or not version.strip():
    raise SystemExit(1)
if not isinstance(revision, str) or revision != sys.argv[1]:
    raise SystemExit(1)
if any(key not in {"ok", "revision", "service", "version", "checks", "timestamp"} for key in payload):
    raise SystemExit(1)
' "${EVENTOS_RELEASE_SHA}" || fail "EventOS public identity failed."
}

assert_eventos_health_identity() {
  assert_eventos_identity
  printf '%s' "${HTTP_BODY}" | python3 -c 'import json, sys
try:
    payload = json.load(sys.stdin)
except (ValueError, TypeError):
    raise SystemExit(1)
if set(payload) != {"ok", "revision", "service", "version"}:
    raise SystemExit(1)
' || fail "EventOS health identity payload is not exact."
}

assert_eventos_ready_identity() {
  assert_eventos_identity
  printf '%s' "${HTTP_BODY}" | python3 -c 'import json, sys
try:
    payload = json.load(sys.stdin)
except (ValueError, TypeError):
    raise SystemExit(1)
checks = payload.get("checks")
if not isinstance(checks, list) or len(checks) != 1 or checks[0] != {"name": "database", "ok": True}:
    raise SystemExit(1)
' || fail "EventOS ready database check failed."
}

assert_catering_identity() {
  [[ "$(lowercase "${HTTP_CONTENT_TYPE}")" == application/json* ]] || fail "Catering intake content type is not JSON."
  printf '%s' "${HTTP_BODY}" | python3 -c 'import json, sys
try:
    payload = json.load(sys.stdin)
except (ValueError, TypeError):
    raise SystemExit(1)
if not isinstance(payload, dict):
    raise SystemExit(1)
if payload.get("service") != "intake-service" or payload.get("status") != "ok":
    raise SystemExit(1)
' || fail "Catering intake identity failed."
}

assert_catering_health_identity() {
  local expected_service="$1"
  [[ "$(lowercase "${HTTP_CONTENT_TYPE}")" == application/json* ]] || fail "Catering health content type is not JSON."
  printf '%s' "${HTTP_BODY}" | python3 -c 'import json, sys
try:
    payload = json.load(sys.stdin)
except (ValueError, TypeError):
    raise SystemExit(1)
if not isinstance(payload, dict) or payload.get("status") != "ok" or payload.get("service") != sys.argv[1]:
    raise SystemExit(1)
' "${expected_service}" || fail "Catering health identity failed."
}

COMPONENTS=(
  shared-edge
  catering-web
  catering-postgres
  catering-intake
  catering-offer
  catering-production
  catering-exports
  zeiterfassung-app
  eventos-app
  eventos-postgres
)

validate_curl_args
echo "Collecting read-only pre-smoke evidence."
before_snapshot="$(remote_snapshot)"
validate_allowlisted_inventory "${before_snapshot}"
load_zeiterfassung_container_metadata "${before_snapshot}"
load_eventos_release_marker "${before_snapshot}"
upstream_evidence "${before_snapshot}" >/dev/null
lock_line "${before_snapshot}" >/dev/null
for generation_file in .deploy-manifest docker-compose.yml Caddyfile; do
  generation_line "${before_snapshot}" "${generation_file}" >/dev/null
done
print_container_summary before "${before_snapshot}"
printf '%s\n' "${before_snapshot}" | awk -F '\t' '$1 == "NETWORK_LS" || $1 == "NETWORK" || $1 == "UPSTREAM" || $1 == "ZEITERFASSUNG_CONTAINER" || $1 == "EVENTOS_RELEASE" || $1 == "METADATA" || $1 == "ROLLBACK" || $1 == "GENERATION" || $1 == "LOCK" || $1 == "LISTENER" { print }'
printf 'METADATA\tcutover-workflow\tCut over shared edge production #6\n'
printf 'METADATA\tcutover-run-id\t%s\n' "${CUTOVER_RUN_ID}"

retry_https "Zeiterfassung healthz" "${ZEITERFASSUNG_SMOKE_URL%/}/healthz" public
assert_zeiterfassung_release_identity
printf 'ZEITERFASSUNG_IDENTITY\t%s\t%s\n' "${ZEITERFASSUNG_RELEASE_VERSION}" "${ZEITERFASSUNG_RELEASE_GIT_SHA}"
printf 'SMOKE\tZeiterfassung healthz\tHTTP 200\tok=true,version/gitSha exact\tTLS verified\n'

retry_https "Zeiterfassung readyz" "${ZEITERFASSUNG_SMOKE_URL%/}/readyz" public
assert_zeiterfassung_identity
[[ "$(lowercase "${HTTP_CACHE_CONTROL}")" == *no-store* ]] || fail "Zeiterfassung readyz lacks Cache-Control no-store."
printf 'SMOKE\tZeiterfassung readyz\tHTTP 200\tok=true,Cache-Control=no-store\tTLS verified\n'

retry_https "Zeiterfassung public config" "${ZEITERFASSUNG_SMOKE_URL%/}/api/public/config" json
assert_zeiterfassung_config_identity
printf 'SMOKE\tZeiterfassung public config\tHTTP 200\tProduktiv/appUrl/platformCustomers exact\tTLS verified\n'

for catering_path in / /angebot /produktion; do
  retry_https "Catering ${catering_path}" "${CATERING_SMOKE_URL%/}${catering_path}" basic
  [[ "$(lowercase "${HTTP_CONTENT_TYPE}")" == text/html* || "$(lowercase "${HTTP_CONTENT_TYPE}")" == application/xhtml* ]] || fail "Catering UI identity is not HTML."
  printf 'SMOKE\tCatering %s\tHTTP 200\tHTML UI\tTLS verified\n' "${catering_path}"
done

retry_https "Catering intake" "${CATERING_SMOKE_URL%/}/api/intake/health" basic
assert_catering_identity
printf 'SMOKE\tCatering intake\tHTTP 200\tservice=intake-service,status=ok\tTLS verified\n'

for catering_api in /api/offers/health /api/production/health /api/exports/health; do
  retry_https "Catering ${catering_api}" "${CATERING_SMOKE_URL%/}${catering_api}" basic
  case "${catering_api}" in
    /api/offers/health) catering_service=offer-service ;;
    /api/production/health) catering_service=production-service ;;
    /api/exports/health) catering_service=print-export ;;
    *) fail "unexpected Catering health path." ;;
  esac
  assert_catering_health_identity "${catering_service}"
  printf 'SMOKE\tCatering %s\tHTTP 200\tstatus=ok\tTLS verified\n' "${catering_api}"
done

for eventos_path in /api/health /api/ready; do
  retry_https "EventOS ${eventos_path}" "${EVENTOS_SMOKE_URL%/}${eventos_path}" public
  case "${eventos_path}" in
    /api/health) assert_eventos_health_identity ;;
    /api/ready) assert_eventos_ready_identity ;;
    *) fail "unexpected EventOS identity path." ;;
  esac
  printf 'SMOKE\tEventOS %s\tHTTP 200\tok=true,service/version/revision exact\tTLS verified\n' "${eventos_path}"
done

echo "Collecting read-only post-smoke evidence."
after_snapshot="$(remote_snapshot)"
validate_allowlisted_inventory "${after_snapshot}"
load_eventos_release_marker "${after_snapshot}"
compare_identity_invariants
print_container_summary after "${after_snapshot}"
printf '%s\n' "${after_snapshot}" | awk -F '\t' '$1 == "LISTENER" || $1 == "ZEITERFASSUNG_CONTAINER" || $1 == "EVENTOS_RELEASE" || $1 == "METADATA" || $1 == "ROLLBACK" || $1 == "GENERATION" || $1 == "LOCK" { print }'

echo "All read-only Shared Edge ownership, identity, network, TLS, smoke and restart gates passed."
echo "public 80/443 ownership verified by Shared Edge bindings and ss process owners."
echo "PHASE 2: GO"
