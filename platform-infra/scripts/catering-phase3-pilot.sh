#!/usr/bin/env bash

set -euo pipefail

readonly MINIMUM_COMPOSE_VERSION="2.24.4"
readonly PILOT_OWNER="catering-agents-platform"
readonly PILOT_SCHEMA="phase3.1"
# Production keeps the canonical /opt paths. The explicit path inputs make the
# same remote transaction executable against an isolated deterministic backend;
# every caller still supplies fixed allowlisted paths on real hosts.
readonly PILOT_ROOT="${CATERING_PHASE3_REMOTE_ROOT:-/opt/catering-phase3}"
readonly PLATFORM_LOCK="${CATERING_PHASE3_PLATFORM_LOCK:-/opt/catering-agents-platform.deploy-lock}"
readonly EDGE_LOCK="${CATERING_PHASE3_EDGE_LOCK:-/opt/shared-edge.deploy-lock}"
readonly DEFAULT_PLATFORM_SOURCE="/opt/catering-phase3/platform-compose.phase3.yml"
readonly DEFAULT_EDGE_SOURCE="/opt/catering-phase3/edge-compose.phase3.yml"
readonly DEFAULT_ACTIVATION_MARKER="/opt/catering-phase3/phase3.activation"
readonly DEFAULT_BASELINE_MANIFEST="/opt/catering-phase3/phase3.transaction-baseline.manifest"
readonly DEFAULT_RESTORE_PROOF_ARCHIVE="/opt/catering-phase3/phase3.rollback-restore-proof.archive"
readonly DEFAULT_COMPLETION_RECEIPT="/opt/catering-phase3/phase3.rollback-completion.receipt"
readonly DEFAULT_RESTORE_EVIDENCE_RECORD="/opt/catering-phase3/phase3.restore-evidence.record"
readonly DEFAULT_ADOPTION_JOURNAL="/opt/catering-phase3/phase3.network-adoption.journal"
readonly PLATFORM_SOURCE="${CATERING_PHASE3_PLATFORM_SOURCE:-${PILOT_ROOT}/platform-compose.phase3.yml}"
readonly EDGE_SOURCE="${CATERING_PHASE3_EDGE_SOURCE:-${PILOT_ROOT}/edge-compose.phase3.yml}"
readonly ACTIVATION_MARKER="${CATERING_PHASE3_ACTIVATION_MARKER:-${PILOT_ROOT}/phase3.activation}"
readonly BASELINE_MANIFEST="${CATERING_PHASE3_BASELINE_MANIFEST:-${PILOT_ROOT}/phase3.transaction-baseline.manifest}"
readonly RESTORE_PROOF_ARCHIVE="${CATERING_PHASE3_RESTORE_PROOF_ARCHIVE:-${PILOT_ROOT}/phase3.rollback-restore-proof.archive}"
readonly COMPLETION_RECEIPT="${CATERING_PHASE3_COMPLETION_RECEIPT:-${PILOT_ROOT}/phase3.rollback-completion.receipt}"
readonly RESTORE_EVIDENCE_RECORD="${CATERING_PHASE3_RESTORE_EVIDENCE_RECORD:-${PILOT_ROOT}/phase3.restore-evidence.record}"
readonly ADOPTION_JOURNAL="${CATERING_PHASE3_ADOPTION_JOURNAL:-${PILOT_ROOT}/phase3.network-adoption.journal}"
readonly PLATFORM_RUNTIME_DIR="${CATERING_PHASE3_PLATFORM_DIR:-/opt/catering-agents-platform/platform-infra}"
readonly EDGE_RUNTIME_DIR="${CATERING_PHASE3_EDGE_DIR:-/opt/shared-edge}"
readonly REMOTE_STAGE_ROOT="${CATERING_PHASE3_REMOTE_TMP_ROOT:-/tmp}"

# Stable callers use the complete Phase-2 chain. An active marker permits only
# read-only config inspection of the protected fourth file until a separately
# reviewed checkpoint replaces the immutable rollback authority.
readonly PLATFORM_INACTIVE_CHAIN="docker-compose.yml docker-compose.production.yml docker-compose.edge-cutover.yml"
readonly PLATFORM_ACTIVE_CHAIN="docker-compose.yml docker-compose.production.yml docker-compose.edge-cutover.yml platform-compose.phase3.yml"
readonly EDGE_INACTIVE_CHAIN="docker-compose.yml"
readonly EDGE_ACTIVE_CHAIN="docker-compose.yml edge-compose.phase3.yml"

readonly STAGES="S0 S1 S2 S3 D1 D2 D3 D4 D5 D6 S4"
readonly PLATFORM_WEB="platform-infra-web-1"
readonly PLATFORM_POSTGRES="platform-infra-postgres-1"
readonly PLATFORM_INTAKE="platform-infra-intake-1"
readonly PLATFORM_OFFER="platform-infra-offer-1"
readonly PLATFORM_PRODUCTION="platform-infra-production-1"
readonly PLATFORM_EXPORTS="platform-infra-exports-1"
readonly SHARED_EDGE="shared-edge-edge-1"
readonly ZEITERFASSUNG_APP="zeiterfassung-app-1"
readonly EVENTOS_APP="commcats-eventos-app"
readonly EVENTOS_POSTGRES="commcats-eventos-postgres"
readonly IRANMONITOR_WEB="deploy-web-1"
readonly IRANMONITOR_INGEST="deploy-ingest-1"
readonly IRANMONITOR_DB="deploy-db-1"
readonly CATERING_INTAKE_PORT="3101"
readonly CATERING_OFFER_PORT="3102"
readonly CATERING_PRODUCTION_PORT="3103"
readonly CATERING_EXPORTS_PORT="3104"
readonly EVENTOS_HTTP_PORT="3045"
readonly EVENTOS_UPSTREAM="commcats-eventos-app:3045"
readonly ZEITERFASSUNG_HTTP_PORT="3040"
readonly PRIVATE_SERVICE_PORTS="postgres:5432 intake:3101 offer:3102 production:3103 exports:3104"
readonly FOREIGN_CONTAINERS=(
  "${ZEITERFASSUNG_APP}"
  "${EVENTOS_APP}"
  "${EVENTOS_POSTGRES}"
  "${IRANMONITOR_WEB}"
  "${IRANMONITOR_INGEST}"
  "${IRANMONITOR_DB}"
)
readonly SEMANTIC_SMOKE_SERVICE="service=intake-service"
readonly SEMANTIC_SMOKE_STATUS="status=ok"
readonly ROLLBACK_RECEIPT_BINDING_FIELDS="restore_evidence_sha256 restore_proof_archive_path restore_proof_archive_sha256 archive receipt"
readonly MANIFEST_BINDING_FIELDS="container_id RestartCount NetworkSettings Aliases PortBindings Mounts secret_ref manifest_sha256 marker_sha256 archive_sha256 receipt_sha256 network_driver network_scope network_internal network_ipam network_enable_ipv6 network_ipam_options network_ipam_config network_labels catering_ingress_network_labels catering_private_network_labels catering_ingress_baseline_members catering_ingress_baseline_aliases catering_private_baseline_members catering_private_baseline_aliases network_members network_aliases baseline_smoke_evidence baseline_smoke_sha256"
readonly VALID_RESUME_STATES="candidate|active|rolling_back"
: "${DEFAULT_PLATFORM_SOURCE}" "${DEFAULT_EDGE_SOURCE}" "${DEFAULT_ACTIVATION_MARKER}"
: "${DEFAULT_BASELINE_MANIFEST}" "${DEFAULT_RESTORE_PROOF_ARCHIVE}" "${DEFAULT_COMPLETION_RECEIPT}"
: "${DEFAULT_RESTORE_EVIDENCE_RECORD}"
: "${DEFAULT_ADOPTION_JOURNAL}"
: "${PILOT_OWNER}" "${PILOT_SCHEMA}" "${PLATFORM_INACTIVE_CHAIN}" "${PLATFORM_ACTIVE_CHAIN}"
: "${EDGE_INACTIVE_CHAIN}" "${EDGE_ACTIVE_CHAIN}" "${STAGES}"
: "${PLATFORM_WEB}" "${PLATFORM_POSTGRES}" "${PLATFORM_INTAKE}" "${PLATFORM_OFFER}"
: "${PLATFORM_PRODUCTION}" "${PLATFORM_EXPORTS}" "${SHARED_EDGE}"
: "${ZEITERFASSUNG_APP}" "${EVENTOS_APP}" "${EVENTOS_POSTGRES}"
: "${IRANMONITOR_WEB}" "${IRANMONITOR_INGEST}" "${IRANMONITOR_DB}"
: "${CATERING_INTAKE_PORT}" "${CATERING_OFFER_PORT}" "${CATERING_PRODUCTION_PORT}" "${CATERING_EXPORTS_PORT}" "${EVENTOS_HTTP_PORT}" "${EVENTOS_UPSTREAM}" "${ZEITERFASSUNG_HTTP_PORT}"
: "${PRIVATE_SERVICE_PORTS}"
: "${SEMANTIC_SMOKE_SERVICE}"
: "${SEMANTIC_SMOKE_STATUS}" "${ROLLBACK_RECEIPT_BINDING_FIELDS}"
: "${MANIFEST_BINDING_FIELDS}"
: "${VALID_RESUME_STATES}"
: "${FOREIGN_CONTAINERS[*]}"

no_go() {
  printf '%s\n' "PILOT: NO-GO" >&2
  exit 1
}

run_harness() {
  [[ "${CATERING_PHASE3_TEST_MODE:-}" == "1" ]] || no_go
  local helper_dir
  helper_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  exec bash "${helper_dir}/phase3-fake-backend.sh" "${CATERING_PHASE3_HARNESS_SCENARIO:?Set CATERING_PHASE3_HARNESS_SCENARIO}"
}

if [[ "${1:-}" == "--harness" ]]; then
  run_harness
  exit 0
fi

PILOT_COMMAND="run"
case "${1:-}" in
  "") ;;
  --resume) PILOT_COMMAND="resume"; shift ;;
  --rollback) PILOT_COMMAND="rollback"; shift ;;
  *) no_go ;;
esac
[[ "$#" -eq 0 ]] || no_go

# Real-host execution is deliberately explicit. Repository templates alone are
# inert and absent/inactive never authorizes adoption of changed source state.
[[ "${CATERING_PHASE3_ENVIRONMENT:-}" == "production" ]] || no_go
[[ "${CATERING_PHASE3_EXECUTE:-}" == "1" ]] || no_go
DEPLOY_HOST="${DEPLOY_HOST:?Set DEPLOY_HOST}"
DEPLOY_USER="${DEPLOY_USER:?Set DEPLOY_USER}"
readonly DEPLOY_HOST DEPLOY_USER
readonly REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"

for command_name in ssh scp sha256sum cmp; do
  command -v "${command_name}" >/dev/null 2>&1 || no_go
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
readonly REPO_ROOT
readonly PLATFORM_TEMPLATE="${REPO_ROOT}/platform-infra/docker-compose.phase3-catering-pilot.yml"
readonly EDGE_TEMPLATE="${REPO_ROOT}/edge-infra/docker-compose.phase3-catering-pilot.yml"
[[ -f "${PLATFORM_TEMPLATE}" && -f "${EDGE_TEMPLATE}" ]] || no_go
EXPECTED_PLATFORM_SOURCE_SHA256="$(sha256sum "${PLATFORM_TEMPLATE}" | awk '{print $1}')"
readonly EXPECTED_PLATFORM_SOURCE_SHA256
EXPECTED_EDGE_SOURCE_SHA256="$(sha256sum "${EDGE_TEMPLATE}" | awk '{print $1}')"
readonly EXPECTED_EDGE_SOURCE_SHA256
EGRESS_EXERCISE="${CATERING_PHASE3_EGRESS_EXERCISE:-0}"
EGRESS_URL="${CATERING_PHASE3_EGRESS_URL:-}"
case "${EGRESS_EXERCISE}" in
  0|1) ;;
  *) no_go ;;
esac
# The enabled provider path must carry an explicit HTTPS probe URL. When the
# active Catering service reports the provider disabled, the remote transaction
# records not_exercised instead; an empty URL is therefore valid only for that
# disabled, read-back-proven state.
if [[ "${EGRESS_EXERCISE}" == 1 ]]; then
  [[ "${EGRESS_URL}" == https://* ]] || no_go
fi

if [[ "${PILOT_COMMAND}" != run ]]; then
  # resume state/lock validation is mandatory before an explicit rollback can
  # be selected; neither command is a blind continuation.
  readonly CONTROL_RUN_ID="${CATERING_PHASE3_RUN_ID:?CATERING_PHASE3_RUN_ID is required for resume/rollback}"
  [[ "${CONTROL_RUN_ID}" =~ ^phase3-[A-Za-z0-9._-]+$ ]] || no_go
  ssh "${REMOTE}" bash -s -- \
    "${PILOT_COMMAND}" "${CONTROL_RUN_ID}" "${PILOT_OWNER}" "${PILOT_SCHEMA}" \
    "${PLATFORM_LOCK}" "${EDGE_LOCK}" "${ACTIVATION_MARKER}" "${BASELINE_MANIFEST}" \
    "${RESTORE_PROOF_ARCHIVE}" "${COMPLETION_RECEIPT}" "${RESTORE_EVIDENCE_RECORD}" \
    "${ADOPTION_JOURNAL}" \
    "${PLATFORM_SOURCE}" "${EDGE_SOURCE}" \
    "${EXPECTED_PLATFORM_SOURCE_SHA256}" "${EXPECTED_EDGE_SOURCE_SHA256}" "${PILOT_ROOT}" \
    "${EGRESS_EXERCISE}" <<'REMOTE_CONTROL'
set -euo pipefail

command_name="$1"
run_id="$2"
owner="$3"
schema="$4"
platform_lock="$5"
edge_lock="$6"
activation_marker="$7"
baseline_manifest="$8"
restore_proof_archive="$9"
completion_receipt="${10}"
restore_evidence_record="${11}"
adoption_journal="${12}"
platform_source="${13}"
edge_source="${14}"
expected_platform_source_sha256="${15}"
expected_edge_source_sha256="${16}"
pilot_root="${17}"
egress_exercise="${18}"
lock_token="${owner}:${run_id}"
readonly PLATFORM_PRODUCTION="platform-infra-production-1"
readonly TRANSACTION_MANIFEST_SCHEMA="phase3.2.transaction-baseline"
readonly LEGACY_TRANSACTION_MANIFEST_SCHEMA="phase3.1.transaction-baseline"

fail() { printf '%s\n' 'PILOT: NO-GO' >&2; exit 1; }
command -v docker >/dev/null 2>&1 || fail
command -v sha256sum >/dev/null 2>&1 || fail
command -v cmp >/dev/null 2>&1 || fail
for remote_path in "${platform_lock}" "${edge_lock}" "${pilot_root}" "${activation_marker}" \
  "${baseline_manifest}" "${restore_proof_archive}" "${completion_receipt}" \
  "${restore_evidence_record}" "${adoption_journal}" "${platform_source}" "${edge_source}"; do
  [[ "${remote_path}" == /* && "${remote_path}" != *".."* && ! -L "${remote_path}" ]] || fail
done
[[ "${activation_marker}" == "${pilot_root}/phase3.activation" && "${baseline_manifest}" == "${pilot_root}/phase3.transaction-baseline.manifest" ]] || fail
[[ "${restore_proof_archive}" == "${pilot_root}/phase3.rollback-restore-proof.archive" && "${completion_receipt}" == "${pilot_root}/phase3.rollback-completion.receipt" ]] || fail
[[ "${restore_evidence_record}" == "${pilot_root}/phase3.restore-evidence.record" ]] || fail
[[ "${adoption_journal}" == "${pilot_root}/phase3.network-adoption.journal" ]] || fail
[[ "${platform_source}" == "${pilot_root}/platform-compose.phase3.yml" && "${edge_source}" == "${pilot_root}/edge-compose.phase3.yml" ]] || fail
[[ "${platform_lock##*/}" == catering-agents-platform.deploy-lock && "${edge_lock##*/}" == shared-edge.deploy-lock ]] || fail

require_regular() { [[ -f "$1" && ! -L "$1" ]] || fail; }
field() { sed -n "s/^$2=//p" "$1" | tail -n 1; }
require_field() { [[ "$(field "$1" "$2")" == "$3" ]] || fail; }
canonical_network_id() {
  local value="$1"
  [[ "${value}" =~ ^[0-9a-f]{64}$ ]] || fail
  printf '%s' "${value}"
}
network_id() {
  local network="$1" value
  value="$(docker network inspect --format '{{.Id}}' "${network}")" || fail
  canonical_network_id "${value}"
}
network_present_by_name() {
  local network="$1" listing count
  listing="$(docker network ls --no-trunc --filter "name=^${network}$" --format '{{.ID}}')" || fail
  count="$(printf '%s\n' "${listing}" | awk 'NF {n++} END {print n+0}')"
  [[ "${count}" == 0 || "${count}" == 1 ]] || fail
  [[ "${count}" == 1 ]]
}
network_id_present_anywhere() {
  local expected_id="$1" listing
  listing="$(docker network ls --no-trunc --format '{{.ID}}')" || fail
  printf '%s\n' "${listing}" | grep -Fxq "${expected_id}"
}
validate_kv_file() {
  local file="$1" kind="$2" line key seen=""
  require_regular "${file}"
  while IFS= read -r line || [[ -n "${line}" ]]; do
    [[ "${line}" != *$'\r'* && "${line}" == *=* ]] || fail
    key="${line%%=*}"
    [[ "${key}" =~ ^[A-Za-z][A-Za-z0-9_-]+$ ]] || fail
    case " ${seen} " in *" ${key} "*) printf '%s\n' "duplicate ${kind} field: ${key}" >&2; fail ;; esac
    seen="${seen} ${key}"
    case "${kind}:${key}" in
      manifest:schema|manifest:owner|manifest:transaction_id|manifest:prior_marker_state|manifest:prior_marker_sha256|manifest:prior_marker_content_b64|manifest:platform_source_prior|manifest:edge_source_prior|manifest:catering_ingress_baseline|manifest:catering_private_baseline|manifest:catering_ingress_baseline_id|manifest:catering_private_baseline_id|manifest:catering_ingress_created_by_run_authorized|manifest:catering_private_created_by_run_authorized|manifest:network_create_order|manifest:platform_network_baseline_id|manifest:platform_network_baseline_members|manifest:platform_network_baseline_aliases|manifest:zeiterfassung_network_baseline_id|manifest:zeiterfassung_network_baseline_members|manifest:zeiterfassung_network_baseline_aliases|manifest:catering_path_baseline|manifest:expected_platform_source_sha256|manifest:expected_edge_source_sha256|manifest:baseline_smoke_evidence|manifest:baseline_smoke_sha256|manifest:container_id|manifest:RestartCount|manifest:StartedAt|manifest:Status|manifest:Image|manifest:ComposeProject|manifest:ComposeService|manifest:NetworkSettings|manifest:Aliases|manifest:PortBindings|manifest:Mounts|manifest:secret_ref|manifest:network_driver|manifest:network_scope|manifest:network_internal|manifest:network_ipam|manifest:network_enable_ipv6|manifest:network_ipam_options|manifest:network_ipam_config|manifest:network_labels|manifest:catering_ingress_network_labels|manifest:catering_private_network_labels|manifest:catering_ingress_baseline_members|manifest:catering_ingress_baseline_aliases|manifest:catering_private_baseline_members|manifest:catering_private_baseline_aliases|manifest:network_members|manifest:network_aliases|manifest:manifest_sha256|manifest:marker_sha256|manifest:archive_sha256|manifest:receipt_sha256|manifest:foreign_invariants_sha256|manifest:container_id_*|manifest:RestartCount_*|manifest:StartedAt_*|manifest:Status_*|manifest:Image_*|manifest:ComposeProject_*|manifest:ComposeService_*|manifest:NetworkSettings_*|manifest:Aliases_*|manifest:PortBindings_*|manifest:Mounts_*|manifest:secret_ref_*) ;;
      archive:schema|archive:transaction_id|archive:transaction_manifest_path|archive:transaction_manifest_sha256|archive:marker_sha256|archive:prior_marker_state|archive:prior_marker_sha256|archive:restore_evidence_path|archive:restore_evidence_sha256|archive:restore_proof_archive_path|archive:archive_sha256) ;;
      receipt:schema|receipt:transaction_id|receipt:transaction_manifest_path|receipt:transaction_manifest_sha256|receipt:marker_sha256|receipt:prior_marker_state|receipt:prior_marker_sha256|receipt:restore_evidence_path|receipt:restore_evidence_sha256|receipt:restore_proof_archive_path|receipt:restore_proof_archive_sha256|receipt:archive_sha256|receipt:receipt_sha256) ;;
      journal:schema|journal:owner|journal:transaction_id|journal:transaction_manifest_path|journal:transaction_manifest_sha256|journal:expected_platform_source_sha256|journal:expected_edge_source_sha256|journal:network_create_order|journal:adoption_order|journal:adoption_count|journal:next_network|journal:adoption_phase|journal:catering_ingress_id|journal:catering_private_id|journal:catering_ingress_owner|journal:catering_private_owner|journal:catering_ingress_phase|journal:catering_private_phase|journal:catering_ingress_transaction|journal:catering_private_transaction|journal:catering_ingress_members_b64|journal:catering_private_members_b64|journal:catering_ingress_aliases_b64|journal:catering_private_aliases_b64|journal:source_readback_sha256|journal:journal_sha256) ;;
      restore:schema|restore:owner|restore:transaction_id|restore:baseline_manifest_sha256|restore:foreign_invariants_sha256|restore:shared_edge_baseline_sha256|restore:shared_edge_restore_sha256|restore:platform_source_expected_sha256|restore:edge_source_expected_sha256|restore:platform_source_readback|restore:edge_source_readback|restore:platform_network_baseline_id|restore:platform_network_baseline_members|restore:platform_network_baseline_aliases|restore:zeiterfassung_network_baseline_id|restore:zeiterfassung_network_baseline_members|restore:zeiterfassung_network_baseline_aliases|restore:catering_path_baseline|restore:catering_ingress_target|restore:catering_private_target|restore:smoke_readback_sha256) ;;
      *) printf '%s\n' "unknown ${kind} field: ${key}" >&2; fail ;;
    esac
  done <"${file}"
}
canonical_marker_sha256() {
  local file="$1" canonical
  canonical="${file}.canonical.$$"
  sed -E 's/^marker_sha256=.*/marker_sha256=absent/' "${file}" >"${canonical}"
  sha256sum "${canonical}" | awk '{print $1}'
  unlink "${canonical}"
}
canonical_archive_sha256() {
  local file="$1" canonical
  canonical="${file}.canonical.$$"
  sed -E 's/^archive_sha256=.*/archive_sha256=absent/' "${file}" >"${canonical}"
  sha256sum "${canonical}" | awk '{print $1}'
  unlink "${canonical}"
}
validate_marker_file() {
  local file="$1" line key seen=""
  require_regular "${file}"
  while IFS= read -r line || [[ -n "${line}" ]]; do
    [[ "${line}" != *$'\r'* && "${line}" == *=* ]] || fail
    key="${line%%=*}"
    case " ${seen} " in *" ${key} "*) fail ;; esac
    seen="${seen} ${key}"
    case "${key}" in
      schema|state|owner|transaction_id|transaction_manifest_path|transaction_manifest_sha256|manifest_sha256|marker_sha256|prior_marker_state|prior_marker_sha256|expected_platform_source_sha256|expected_edge_source_sha256|platform_override_sha256|edge_override_sha256|baseline_network_status|catering_ingress_id|catering_private_id|platform_source_progress|edge_source_progress|archive_sha256|receipt_sha256|egress|egress_requested|egress_url_b64|stage|foreign_invariants_sha256|smoke_readback_sha256|source_readback_sha256|adoption_count|adoption_proof) ;;
      *) fail ;;
    esac
  done <"${file}"
  for required in state owner transaction_id transaction_manifest_path transaction_manifest_sha256 \
    manifest_sha256 prior_marker_state prior_marker_sha256 expected_platform_source_sha256 \
    expected_edge_source_sha256 platform_override_sha256 edge_override_sha256 baseline_network_status \
    catering_ingress_id catering_private_id platform_source_progress edge_source_progress archive_sha256 \
    receipt_sha256 egress egress_requested egress_url_b64 stage foreign_invariants_sha256 smoke_readback_sha256 source_readback_sha256 \
    adoption_count adoption_proof; do
    grep -Eq "^${required}=" "${file}" || fail
  done
  [[ "$(canonical_marker_sha256 "${file}")" == "$(field "${file}" marker_sha256)" ]] || fail
}
canonical_adoption_journal_sha256() {
  local file="$1" canonical
  canonical="${file}.canonical.$$"
  sed -E 's/^journal_sha256=.*/journal_sha256=absent/' "${file}" >"${canonical}"
  sha256sum "${canonical}" | awk '{print $1}'
  unlink "${canonical}"
}
rollback_preexisting_members_relaxed=false
rollback_mixed_s2_authorized=false
validate_adoption_journal() {
  local allow_absent_networks="${1:-false}" allow_run_created_partial="${2:-false}" network id actual members expected_members aliases expected_aliases order count next phase created_by_run relax_members transaction_label expected_network_labels manifest_transaction_label
  [[ "${allow_absent_networks}" == true || "${allow_absent_networks}" == false ]] || fail
  [[ "${allow_run_created_partial}" == true || "${allow_run_created_partial}" == false ]] || fail
  validate_kv_file "${adoption_journal}" journal
  require_field "${adoption_journal}" schema "phase3.1.network-adoption"
  require_field "${adoption_journal}" owner "${owner}"
  require_field "${adoption_journal}" transaction_id "${run_id}"
  require_field "${adoption_journal}" transaction_manifest_path "${baseline_manifest}"
  require_field "${adoption_journal}" transaction_manifest_sha256 "${manifest_sha256}"
  require_field "${adoption_journal}" expected_platform_source_sha256 "${expected_platform_source_sha256}"
  require_field "${adoption_journal}" expected_edge_source_sha256 "${expected_edge_source_sha256}"
  require_field "${adoption_journal}" network_create_order "catering_ingress,catering_private"
  [[ "$(canonical_adoption_journal_sha256 "${adoption_journal}")" == "$(field "${adoption_journal}" journal_sha256)" ]] || fail
  order="$(field "${adoption_journal}" adoption_order)"
  count="$(field "${adoption_journal}" adoption_count)"
  next="$(field "${adoption_journal}" next_network)"
  phase="$(field "${adoption_journal}" adoption_phase)"
  [[ "${order}" == "" || "${order}" == catering_ingress || "${order}" == catering_ingress,catering_private ]] || fail
  [[ "${count}" == 0 || "${count}" == 1 || "${count}" == 2 ]] || fail
  [[ "${phase}" == prepared || "${phase}" == created || "${phase}" == memberships_verified ]] || fail
  if [[ "${count}" == 0 ]]; then [[ -z "${order}" && "${next}" == catering_ingress ]] || fail; fi
  if [[ "${count}" == 1 ]]; then [[ "${order}" == catering_ingress && "${next}" == catering_private ]] || fail; fi
  if [[ "${count}" == 2 ]]; then [[ "${order}" == catering_ingress,catering_private && "${next}" == complete ]] || fail; fi
  for network in catering_ingress catering_private; do
    id="$(field "${adoption_journal}" "${network}_id")"
    if [[ "${id}" == absent ]]; then
      [[ "$(field "${adoption_journal}" "${network}_members_b64")" == absent && "$(field "${adoption_journal}" "${network}_aliases_b64")" == absent ]] || fail
      continue
    fi
    [[ "${id}" =~ ^[0-9a-f]{64}$ ]] || fail
    if [[ "${allow_absent_networks}" == true ]] && ! network_present_by_name "${network}"; then
      continue
    fi
    [[ "$(network_id "${network}")" == "${id}" ]] || fail
    [[ "$(docker network inspect --format '{{index .Labels "com.catering.owner"}}' "${id}")" == "${owner}" ]] || fail
    [[ "$(docker network inspect --format '{{index .Labels "com.catering.phase"}}' "${id}")" == "${schema}" ]] || fail
    created_by_run="$(field "${baseline_manifest}" "${network}_created_by_run_authorized")"
    if [[ "${created_by_run}" == true ]]; then
      [[ "$(docker network inspect --format '{{index .Labels "com.catering.transaction"}}' "${id}")" == "${run_id}" ]] || fail
    else
      transaction_label="$(docker network inspect --format '{{index .Labels "com.catering.transaction"}}' "${id}")"
      expected_network_labels="$(field "${baseline_manifest}" "${network}_network_labels")"
      manifest_transaction_label="$(printf '%s\n' "${expected_network_labels}" | awk -F';' '{ for (i = 1; i <= NF; i++) if ($i ~ /^transaction=/) { sub(/^transaction=/, "", $i); print $i; exit } }')"
      if [[ -z "${transaction_label}" || "${transaction_label}" == "<no value>" ]]; then
        [[ -z "${manifest_transaction_label}" ]] || fail
      else
        [[ "${transaction_label}" == "${run_id}" && "${manifest_transaction_label}" == "${run_id}" ]] || fail
      fi
    fi
    members="$(docker network inspect --format '{{json .Containers}}' "${id}")" || fail
    expected_members="$(printf '%s' "$(field "${adoption_journal}" "${network}_members_b64")" | base64 -d)" || fail
    expected_aliases="$(printf '%s' "$(field "${adoption_journal}" "${network}_aliases_b64")" | base64 -d)" || fail
    relax_members=false
    [[ "${rollback_preexisting_members_relaxed:-false}" == true && "${created_by_run}" == false ]] && relax_members=true
    [[ "${allow_run_created_partial}" == true && "${created_by_run}" == true ]] && relax_members=partial
    python3 - "${expected_members}" "${expected_aliases}" "${members}" "${relax_members}" "${network}" <<'PYTHON' || fail
import json
import sys

expected_members, expected_aliases, actual = (json.loads(value) for value in sys.argv[1:4])

def canonical(value):
    if not isinstance(value, dict):
        raise SystemExit('network member record is not an object')
    result = {}
    for key, item in value.items():
        if not isinstance(key, str) or not isinstance(item, dict):
            raise SystemExit('network member record is malformed')
        name = str(item.get('Name', '')).lstrip('/')
        aliases = item.get('Aliases', [])
        if not name or not isinstance(aliases, list):
            raise SystemExit('network member aliases are malformed')
        result[key] = {'Name': name, 'Aliases': sorted(str(alias) for alias in aliases)}
    return result

if canonical(expected_members) != canonical(expected_aliases):
    raise SystemExit('network member or alias set mismatch')
if sys.argv[4] == 'partial':
    # A crash before the first membership connect leaves the durable adoption
    # journal with an empty, but truthful, membership snapshot.  Treat only an
    # empty journal paired with an empty live network as the zero-length
    # rollback prefix; any live member still fails closed below.
    if not expected_members:
        if actual:
            raise SystemExit('network membership is not a rollback prefix')
        raise SystemExit(0)
    order = {
        'catering_private': [
            'platform-infra-postgres-1',
            'platform-infra-intake-1',
            'platform-infra-offer-1',
            'platform-infra-production-1',
            'platform-infra-exports-1',
            'platform-infra-web-1',
        ],
        'catering_ingress': ['platform-infra-web-1', 'shared-edge-edge-1'],
    }.get(sys.argv[5])
    if order is None:
        raise SystemExit('unknown rollback network')
    expected = canonical(expected_members)
    actual = canonical(actual)
    expected_by_name = {record['Name']: (key, record) for key, record in expected.items()}
    if set(expected_by_name) != set(order):
        raise SystemExit('rollback journal membership order is not canonical')
    for removed_count in range(len(order) + 1):
        removed = set(order[:removed_count])
        remaining = {key: record for name, (key, record) in expected_by_name.items() if name not in removed}
        if actual == remaining:
            break
    else:
        raise SystemExit('network membership is not a rollback prefix')
elif sys.argv[4] != 'true' and canonical(expected_members) != canonical(actual):
    raise SystemExit('network member or alias set mismatch')
PYTHON
  done
}

validate_run_created_rollback_order() {
  local private_created ingress_created private_expected ingress_expected private_actual ingress_actual
  private_created="$(field "${baseline_manifest}" catering_private_created_by_run_authorized)"
  ingress_created="$(field "${baseline_manifest}" catering_ingress_created_by_run_authorized)"
  [[ "${private_created}" == true && "${ingress_created}" == true ]] || return 0
  private_expected="$(printf '%s' "$(field "${adoption_journal}" catering_private_members_b64)" | base64 -d)" || fail
  ingress_expected="$(printf '%s' "$(field "${adoption_journal}" catering_ingress_members_b64)" | base64 -d)" || fail
  if network_present_by_name catering_private; then
    private_actual="$(docker network inspect --format '{{json .Containers}}' catering_private)" || fail
  else
    private_actual='{}'
  fi
  if network_present_by_name catering_ingress; then
    ingress_actual="$(docker network inspect --format '{{json .Containers}}' catering_ingress)" || fail
  else
    ingress_actual='{}'
  fi
  python3 - "${private_expected}" "${private_actual}" "${ingress_expected}" "${ingress_actual}" <<'PYTHON' || fail
import json
import sys

private_expected, private_actual, ingress_expected, ingress_actual = (json.loads(value) for value in sys.argv[1:5])

def canonical(value):
    if not isinstance(value, dict):
        raise SystemExit('network member record is not an object')
    result = {}
    for key, item in value.items():
        if not isinstance(key, str) or not isinstance(item, dict):
            raise SystemExit('network member record is malformed')
        name = str(item.get('Name', '')).lstrip('/')
        aliases = item.get('Aliases', [])
        if not name or not isinstance(aliases, list):
            raise SystemExit('network member aliases are malformed')
        result[key] = {'Name': name, 'Aliases': sorted(str(alias) for alias in aliases)}
    return result

def removed_prefix(expected_value, actual_value, order):
    expected = canonical(expected_value)
    actual = canonical(actual_value)
    # The journal can durably precede the first membership connect.  Empty
    # expected and live sets are the only valid zero-length rollback prefix.
    if not expected:
        if actual:
            raise SystemExit('network membership is not a rollback prefix')
        return 0
    expected_by_name = {record['Name']: (key, record) for key, record in expected.items()}
    if set(expected_by_name) != set(order):
        raise SystemExit('rollback journal membership order is not canonical')
    for removed_count in range(len(order) + 1):
        removed = set(order[:removed_count])
        remaining = {key: record for name, (key, record) in expected_by_name.items() if name not in removed}
        if actual == remaining:
            return removed_count
    raise SystemExit('network membership is not a rollback prefix')

private_removed = removed_prefix(private_expected, private_actual, [
    'platform-infra-postgres-1',
    'platform-infra-intake-1',
    'platform-infra-offer-1',
    'platform-infra-production-1',
    'platform-infra-exports-1',
    'platform-infra-web-1',
])
ingress_removed = removed_prefix(ingress_expected, ingress_actual, [
    'platform-infra-web-1',
    'shared-edge-edge-1',
])
if private_removed < 6 and ingress_removed != 0:
    raise SystemExit('ingress rollback started before private rollback completed')
PYTHON
}

phase3_lock_acquire() {
  local lock="$1" mode_var="$2" owner_file owner_tmp lock_real lock_expected_real lock_mode owner_mode
  # mkdir is the ownership claim: two contenders cannot both create the same
  # directory. A loser never installs or overwrites the winner's owner file.
  if sudo mkdir -m 0700 -- "${lock}" 2>/dev/null; then
    lock_real="$(sudo realpath -e -- "${lock}" 2>/dev/null || sudo realpath "${lock}")"
    lock_expected_real="$(sudo realpath -e -- "$(dirname "${lock}")" 2>/dev/null || sudo realpath "$(dirname "${lock}")")/$(basename "${lock}")"
    lock_mode="$(sudo stat -c '%a' "${lock}" 2>/dev/null || sudo stat -f '%Lp' "${lock}")"
    [[ "${lock_real}" == "${lock_expected_real}" && "${lock_mode}" == 700 ]] || fail
    owner_file="${lock}/owner"
    owner_tmp="${owner_file}.pending.${run_id}"
    printf '%s\n' "owner_token=${lock_token}" "owner=${owner}" "run_id=${run_id}" | sudo tee "${owner_tmp}" >/dev/null
    sudo chmod 0600 "${owner_tmp}"
    sudo mv -f "${owner_tmp}" "${owner_file}"
    owner_mode="$(sudo stat -c '%a' "${owner_file}" 2>/dev/null || sudo stat -f '%Lp' "${owner_file}")"
    [[ -f "${owner_file}" && ! -L "${owner_file}" && "${owner_mode}" == 600 ]] || fail
    sudo grep -Fxq "owner_token=${lock_token}" "${owner_file}" || fail
    printf -v "${mode_var}" '%s' acquired
    return 0
  fi
  lock_real="$(sudo realpath -e -- "${lock}" 2>/dev/null || sudo realpath "${lock}")"
  lock_expected_real="$(sudo realpath -e -- "$(dirname "${lock}")" 2>/dev/null || sudo realpath "$(dirname "${lock}")")/$(basename "${lock}")"
  lock_mode="$(sudo stat -c '%a' "${lock}" 2>/dev/null || sudo stat -f '%Lp' "${lock}")"
  owner_file="${lock}/owner"
  owner_mode="$(sudo stat -c '%a' "${owner_file}" 2>/dev/null || sudo stat -f '%Lp' "${owner_file}")"
  [[ -d "${lock}" && ! -L "${lock}" && "${lock_real}" == "${lock_expected_real}" && "${lock_mode}" == 700 ]] || fail
  [[ -f "${owner_file}" && ! -L "${owner_file}" && "${owner_mode}" == 600 ]] || fail
  sudo grep -Fxq "owner_token=${lock_token}" "${owner_file}" || fail
  printf -v "${mode_var}" '%s' reentered
}
acquire_lock() { phase3_lock_acquire "$@"; }
phase3_lock_release() {
  local lock expected_token owner_file lock_real lock_expected_real lock_mode owner_mode
  lock="$1"; expected_token="$2"; owner_file="${lock}/owner"
  lock_real="$(sudo realpath -e -- "${lock}" 2>/dev/null || sudo realpath "${lock}")" || return 1
  lock_expected_real="$(sudo realpath -e -- "$(dirname "${lock}")" 2>/dev/null || sudo realpath "$(dirname "${lock}")")/$(basename "${lock}")" || return 1
  lock_mode="$(sudo stat -c '%a' "${lock}" 2>/dev/null || sudo stat -f '%Lp' "${lock}")" || return 1
  owner_mode="$(sudo stat -c '%a' "${owner_file}" 2>/dev/null || sudo stat -f '%Lp' "${owner_file}")" || return 1
  [[ -d "${lock}" && ! -L "${lock}" && "${lock_real}" == "${lock_expected_real}" && "${lock_mode}" == 700 ]] || return 1
  [[ -f "${owner_file}" && ! -L "${owner_file}" && "${owner_mode}" == 600 ]] || return 1
  sudo grep -Fxq "owner_token=${expected_token}" "${owner_file}" || return 1
  sudo unlink "${owner_file}" || return 1
  sudo rmdir "${lock}" || return 1
  [[ ! -e "${lock}" && ! -L "${lock}" ]]
}
held_platform=absent
held_edge=absent
release_control_locks() {
  local terminal="${1:-normal}"
  set +e
  if [[ "${terminal}" == terminal ]]; then
    if [[ "${held_edge}" == acquired || "${held_edge}" == reentered ]]; then
      if phase3_lock_release "${edge_lock}" "${lock_token}"; then
        held_edge=absent
      else
        printf '%s\n' 'PILOT: RECOVERY_REQUIRED' >&2
        trap - EXIT
        exit 1
      fi
    fi
    if [[ "${held_platform}" == acquired || "${held_platform}" == reentered ]]; then
      if phase3_lock_release "${platform_lock}" "${lock_token}"; then
        held_platform=absent
      else
        printf '%s\n' 'PILOT: RECOVERY_REQUIRED' >&2
        trap - EXIT
        exit 1
      fi
    fi
    return 0
  fi
  if [[ "${held_edge}" == acquired ]]; then
    phase3_lock_release "${edge_lock}" "${lock_token}" || printf '%s\n' 'PILOT: RECOVERY_REQUIRED' >&2
  fi
  if [[ "${held_platform}" == acquired ]]; then
    phase3_lock_release "${platform_lock}" "${lock_token}" || printf '%s\n' 'PILOT: RECOVERY_REQUIRED' >&2
  fi
}
trap release_control_locks EXIT
phase3_lock_acquire "${platform_lock}" held_platform
phase3_lock_acquire "${edge_lock}" held_edge
validate_manifest() {
  local marker_hash manifest_schema required smoke_evidence_hash
  validate_kv_file "${baseline_manifest}" manifest
  require_regular "${baseline_manifest}"
  manifest_schema="$(field "${baseline_manifest}" schema)"
  [[ "${manifest_schema}" == "${TRANSACTION_MANIFEST_SCHEMA}" || "${manifest_schema}" == "${LEGACY_TRANSACTION_MANIFEST_SCHEMA}" ]] || fail
  require_field "${baseline_manifest}" owner "${owner}"
  require_field "${baseline_manifest}" transaction_id "${run_id}"
  grep -Eq '^prior_marker_content_b64=' "${baseline_manifest}" || fail
  for required in container_id RestartCount NetworkSettings Aliases PortBindings Mounts secret_ref \
    network_driver network_scope network_internal network_ipam network_labels network_members network_aliases \
    platform_network_baseline_id platform_network_baseline_members platform_network_baseline_aliases \
    zeiterfassung_network_baseline_id zeiterfassung_network_baseline_members zeiterfassung_network_baseline_aliases \
    catering_path_baseline; do
    grep -Eq "^${required}=" "${baseline_manifest}" || fail
  done
  if [[ "${manifest_schema}" == "${TRANSACTION_MANIFEST_SCHEMA}" ]]; then
    for required in network_enable_ipv6 network_ipam_options network_ipam_config \
      catering_ingress_network_labels catering_private_network_labels \
      catering_ingress_baseline_members catering_ingress_baseline_aliases \
      catering_private_baseline_members catering_private_baseline_aliases; do
      grep -Eq "^${required}=" "${baseline_manifest}" || fail
    done
  fi
  if [[ "${manifest_schema}" == "${TRANSACTION_MANIFEST_SCHEMA}" ]]; then
    for required in baseline_smoke_evidence baseline_smoke_sha256; do
      grep -Eq "^${required}=" "${baseline_manifest}" || fail
    done
    [[ "$(field "${baseline_manifest}" baseline_smoke_sha256)" =~ ^[0-9a-f]{64}$ ]] || fail
    [[ "$(field "${baseline_manifest}" baseline_smoke_evidence)" =~ ^catering:[0-9a-f]{64}\;zeiterfassung:[0-9a-f]{64}\;eventos:[0-9a-f]{64}$ ]] || fail
    smoke_evidence_hash="$(printf '%s\n' "$(field "${baseline_manifest}" baseline_smoke_evidence | tr ';' '\n')" | sha256sum | awk '{print $1}')"
    [[ "${smoke_evidence_hash}" == "$(field "${baseline_manifest}" baseline_smoke_sha256)" ]] || fail
  else
    # The old schema is a recovery-only authority. It may never authorize a
    # forward resume, and it carries no inferred replacement for the missing
    # pre-mutation semantic baseline.
    if [[ "${command_name}" == rollback ]]; then
      [[ "${marker_state}" == candidate || "${marker_state}" == active || "${legacy_rollback_finalize:-0}" == 1 ]] || fail
    elif [[ "${command_name}" == resume ]]; then
      [[ "${marker_state}" == rolling_back ]] || fail
    else
      fail
    fi
    ! grep -Eq '^baseline_smoke_(evidence|sha256)=' "${baseline_manifest}" || fail
  fi
  if grep -Eiq 'secret[^=]*(value|password|token)=' "${baseline_manifest}"; then fail; fi
  marker_hash="$(field "${baseline_manifest}" marker_sha256)"
  [[ -n "${marker_hash}" ]] || fail
}
rehydrate_manifest() {
  # Resume and rollback consume the immutable manifest again; no state is
  # inferred from a partially written marker or from live container guesses.
  validate_manifest
}
validate_marker_file "${activation_marker}"
marker_state="$(field "${activation_marker}" state)"
legacy_rollback_finalize=0
[[ "${marker_state}" == candidate || "${marker_state}" == active || "${marker_state}" == rolling_back ]] || fail
require_field "${activation_marker}" schema "${schema}"
require_field "${activation_marker}" owner "${owner}"
require_field "${activation_marker}" transaction_id "${run_id}"
require_field "${activation_marker}" transaction_manifest_path "${baseline_manifest}"
manifest_sha256="$(sha256sum "${baseline_manifest}" | awk '{print $1}')"
require_field "${activation_marker}" transaction_manifest_sha256 "${manifest_sha256}"
rehydrate_manifest

manifest_network_value() {
  local key="$1" network="$2" raw value
  raw="$(field "${baseline_manifest}" "${key}")"
  value="$(printf '%s\n' "${raw}" | awk -F';' -v network="${network}" '{ for (i = 1; i <= NF; i++) if ($i ~ ("^" network ":")) { sub("^[^:]*:", "", $i); print $i; found = 1; exit } } END { if (!found) exit 1 }')" || fail
  [[ -n "${value}" ]] || fail
  printf '%s' "${value}"
}

manifest_network_labels_for() {
  local network="$1" created_by_run="$2" value
  value="$(field "${baseline_manifest}" "${network}_network_labels")"
  if [[ -n "${value}" ]]; then
    printf '%s' "${value}"
    return 0
  fi
  value="owner=${owner};phase=${schema};kind=${network#catering_}"
  [[ "${created_by_run}" == true ]] && value+=";transaction=${run_id}"
  printf '%s' "${value}"
}

validate_manifest_network_provenance() {
  local expected_labels expected_members expected_aliases
  [[ "$(field "${baseline_manifest}" network_driver)" == "catering_ingress:bridge;catering_private:bridge" ]] || fail
  [[ "$(field "${baseline_manifest}" network_scope)" == "catering_ingress:local;catering_private:local" ]] || fail
  [[ "$(field "${baseline_manifest}" network_internal)" == "catering_ingress:false;catering_private:false" ]] || fail
  [[ "$(field "${baseline_manifest}" network_ipam)" == "catering_ingress:default;catering_private:default" ]] || fail
  [[ "$(field "${baseline_manifest}" network_enable_ipv6)" == "catering_ingress:false;catering_private:false" ]] || fail
  [[ "$(field "${baseline_manifest}" network_ipam_options)" == "catering_ingress:{};catering_private:{}" ]] || fail
  [[ "$(field "${baseline_manifest}" network_ipam_config)" == "catering_ingress:[];catering_private:[]" ]] || fail
  [[ "$(field "${baseline_manifest}" network_labels)" == "owner=${owner};phase=${schema}" ||
    "$(field "${baseline_manifest}" network_labels)" == "owner=${owner};phase=${schema};transaction=${run_id}" ]] || fail
  expected_members="catering_ingress:shared-edge-edge-1,platform-infra-web-1;catering_private:platform-infra-web-1,platform-infra-postgres-1,platform-infra-intake-1,platform-infra-offer-1,platform-infra-production-1,platform-infra-exports-1"
  expected_aliases="catering_ingress:shared-edge-edge-1=edge|shared-edge-edge-1;platform-infra-web-1=web"
  [[ "$(field "${baseline_manifest}" network_members)" == "${expected_members}" ]] || fail
  [[ "$(field "${baseline_manifest}" network_aliases)" == "${expected_aliases}" ]] || fail
}

validate_network_provenance() {
  local network="$1" kind="$2" created_by_run="${3:-true}" id driver scope internal ipam_driver ipam_config options enable_ipv6 labels members manifest_schema expected_driver expected_scope expected_internal expected_ipam_driver expected_ipam_config expected_options expected_enable_ipv6 expected_network_labels
  id="$(network_id "${network}")" || fail
  driver="$(docker network inspect --format '{{.Driver}}' "${id}")" || fail
  scope="$(docker network inspect --format '{{.Scope}}' "${id}")" || fail
  internal="$(docker network inspect --format '{{.Internal}}' "${id}")" || fail
  ipam_driver="$(docker network inspect --format '{{.IPAM.Driver}}' "${id}")" || fail
  ipam_config="$(docker network inspect --format '{{json .IPAM.Config}}' "${id}")" || fail
  options="$(docker network inspect --format '{{json .Options}}' "${id}")" || fail
  enable_ipv6="$(docker network inspect --format '{{.EnableIPv6}}' "${id}")" || fail
  labels="$(docker network inspect --format '{{json .Labels}}' "${id}")" || fail
  members="$(docker network inspect --format '{{json .Containers}}' "${id}")" || fail
  manifest_schema="$(field "${baseline_manifest}" schema)"
  if [[ "${manifest_schema}" == "${TRANSACTION_MANIFEST_SCHEMA}" ]]; then
    expected_driver="$(manifest_network_value network_driver "${network}")"
    expected_scope="$(manifest_network_value network_scope "${network}")"
    expected_internal="$(manifest_network_value network_internal "${network}")"
    expected_ipam_driver="$(manifest_network_value network_ipam "${network}")"
    expected_enable_ipv6="$(manifest_network_value network_enable_ipv6 "${network}")"
    expected_options="$(manifest_network_value network_ipam_options "${network}")"
    expected_ipam_config="$(manifest_network_value network_ipam_config "${network}")"
    validate_manifest_network_provenance
  else
    expected_driver=bridge
    expected_scope=local
    expected_internal=false
    expected_ipam_driver=default
    expected_enable_ipv6=false
    expected_options='{}'
    expected_ipam_config='[]'
  fi
  expected_network_labels="$(manifest_network_labels_for "${network}" "${created_by_run}")"
  [[ "${driver}" == "${expected_driver}" && "${scope}" == "${expected_scope}" && "${internal}" == "${expected_internal}" && "${ipam_driver}" == "${expected_ipam_driver}" && "${enable_ipv6}" == "${expected_enable_ipv6}" && "${ipam_config}" == "${expected_ipam_config}" && "${options}" == "${expected_options}" ]] || fail
  python3 - "${labels}" "${members}" "${expected_network_labels}" <<'PYTHON' || fail
import json
import sys
labels = json.loads(sys.argv[1]) if sys.argv[1] not in ('', '<no value>', 'null') else {}
members = json.loads(sys.argv[2]) if sys.argv[2] not in ('', '<no value>', 'null') else {}
expected = {}
for item in sys.argv[3].split(';'):
    key, separator, value = item.partition('=')
    if not separator or key in expected or key not in {
        'owner', 'phase', 'kind', 'transaction'
    }:
        raise SystemExit('network provenance label record is malformed')
    expected[f'com.catering.{key}'] = value
if labels != expected:
    raise SystemExit('network provenance labels are not exact')
if not isinstance(members, dict):
    raise SystemExit('network member set is not an object')
for key, value in members.items():
    if not isinstance(key, str) or not isinstance(value, dict) or not str(value.get('Name', '')).lstrip('/'):
        raise SystemExit('network member record is malformed')
PYTHON
}

semantic_smoke() {
  local body
  body="$(mktemp)"
  trap '[[ -z "${body:-}" ]] || unlink "${body}" 2>/dev/null || true' RETURN
  docker exec "${SHARED_EDGE:-shared-edge-edge-1}" wget -qO- --timeout=2 http://web:8081/api/intake/health >"${body}" || fail
  grep -Eq '"service"[[:space:]]*:[[:space:]]*"intake-service"' "${body}" || fail
  grep -Eq '"status"[[:space:]]*:[[:space:]]*"ok"' "${body}" || fail
  smoke_readback_sha256="$(sha256sum "${body}" | awk '{print $1}')"
}

smoke_json_control() {
  local label="$1" target="$2" expected_service="$3" body
  body="$(mktemp)"
  if ! docker exec shared-edge-edge-1 wget -qO- --timeout=2 "${target}" >"${body}"; then
    unlink "${body}" 2>/dev/null || true
    return 1
  fi
  if ! grep -Eq '"status"[[:space:]]*:[[:space:]]*"ok"' "${body}"; then
    unlink "${body}" 2>/dev/null || true
    return 1
  fi
  if [[ -n "${expected_service}" ]] && ! grep -Eq "\"service\"[[:space:]]*:[[:space:]]*\"${expected_service}\"" "${body}"; then
    unlink "${body}" 2>/dev/null || true
    return 1
  fi
  printf '%s:%s\n' "${label}" "$(sha256sum "${body}" | awk '{print $1}')" >>"${smoke_evidence_file}"
  unlink "${body}"
}

run_all_host_semantic_smokes() {
  local evidence
  evidence="$(mktemp)"
  smoke_evidence_file="${evidence}"
  if ! smoke_json_control catering "http://web:8081/api/intake/health" intake-service || \
    ! smoke_json_control zeiterfassung "http://zeiterfassung-app-1:3040/healthz" "" || \
    ! smoke_json_control eventos "http://commcats-eventos-app:3045/health" ""; then
    unlink "${evidence}" 2>/dev/null || true
    smoke_evidence_file=
    return 1
  fi
  smoke_readback_sha256="$(sha256sum "${evidence}" | awk '{print $1}')"
  unlink "${evidence}"
  smoke_evidence_file=
}

write_control_marker() {
  local state="$1" adoption="$2" proof="$3" tmp marker_hash final stage source_hash smoke_value
  local journal_ingress_id=absent journal_private_id=absent
  case "${state}" in candidate) stage=S3 ;; active) stage=S4 ;; rolling_back) stage=RB ;; inactive) stage=S0 ;; *) fail ;; esac
  if [[ -f "${adoption_journal}" ]]; then
    journal_ingress_id="$(field "${adoption_journal}" catering_ingress_id)"
    journal_private_id="$(field "${adoption_journal}" catering_private_id)"
  fi
  if [[ -f "${platform_source}" && -f "${edge_source}" && ! -L "${platform_source}" && ! -L "${edge_source}" ]]; then
    source_hash="$(printf '%s\n' "platform=$(sha256sum "${platform_source}" | awk '{print $1}')" "edge=$(sha256sum "${edge_source}" | awk '{print $1}')" | sha256sum | awk '{print $1}')"
  else
    source_hash=pending
  fi
  smoke_value="${smoke_readback_sha256:-$(field "${activation_marker}" smoke_readback_sha256)}"
  tmp="$(mktemp)"
  awk -v state="${state}" -v stage="${stage}" -v adoption="${adoption}" \
    -v proof="${proof}" -v smoke="${smoke_value}" -v source="${source_hash}" \
    -v egress_value="${egress:-}" \
    -v journal_ingress_id="${journal_ingress_id}" -v journal_private_id="${journal_private_id}" \
    'BEGIN { OFS="=" }
     {
       key=$0; sub(/=.*/, "", key); value=$0; sub(/^[^=]*=/, "", value)
       if (key == "state") value=state
       else if (key == "stage") value=stage
       else if (key == "adoption_count") value=adoption
       else if (key == "adoption_proof") value=proof
       else if (key == "catering_ingress_id" && journal_ingress_id != "absent") value=journal_ingress_id
       else if (key == "catering_private_id" && journal_private_id != "absent") value=journal_private_id
       else if (key == "marker_sha256") value="absent"
       else if (key == "smoke_readback_sha256") value=smoke
       else if (key == "source_readback_sha256") value=source
       else if (key == "egress" && egress_value != "") value=egress_value
       print key, value
     }' "${activation_marker}" >"${tmp}"
  marker_hash="$(sed -E 's/^marker_sha256=.*/marker_sha256=absent/' "${tmp}" | sha256sum | awk '{print $1}')"
  final="${tmp}.final"
  sed "s/^marker_sha256=absent$/marker_sha256=${marker_hash}/" "${tmp}" >"${final}"
  sudo install -m 0640 "${final}" "${activation_marker}.pending.${run_id}"
  sudo mv -f "${activation_marker}.pending.${run_id}" "${activation_marker}"
  unlink "${tmp}"
  unlink "${final}"
  validate_marker_file "${activation_marker}"
  [[ -f "${activation_marker}" && ! -L "${activation_marker}" ]] || fail
  grep -Fxq "owner=${owner}" "${activation_marker}" || fail
  grep -Fxq "transaction_id=${run_id}" "${activation_marker}" || fail
  grep -Fxq "transaction_manifest_sha256=${manifest_sha256}" "${activation_marker}" || fail
  grep -Fxq "marker_sha256=${marker_hash}" "${activation_marker}" || fail
  grep -Fxq "adoption_count=${adoption}" "${activation_marker}" || fail
}

write_control_adoption_journal_intent() {
  local journal_tmp journal_final journal_hash
  [[ ! -e "${adoption_journal}" ]] || return 0
  journal_tmp="$(mktemp)"
  printf '%s\n' \
    "schema=phase3.1.network-adoption" "owner=${owner}" "transaction_id=${run_id}" \
    "transaction_manifest_path=${baseline_manifest}" "transaction_manifest_sha256=${manifest_sha256}" \
    "expected_platform_source_sha256=${expected_platform_source_sha256}" "expected_edge_source_sha256=${expected_edge_source_sha256}" \
    "network_create_order=catering_ingress,catering_private" "adoption_order=" \
    "adoption_count=0" "next_network=catering_ingress" "adoption_phase=prepared" \
    "catering_ingress_id=absent" "catering_private_id=absent" \
    "catering_ingress_owner=${owner}" "catering_private_owner=${owner}" \
    "catering_ingress_phase=${schema}" "catering_private_phase=${schema}" \
    "catering_ingress_transaction=${run_id}" "catering_private_transaction=${run_id}" \
    "catering_ingress_members_b64=absent" "catering_private_members_b64=absent" \
    "catering_ingress_aliases_b64=absent" "catering_private_aliases_b64=absent" \
    "source_readback_sha256=pending" "journal_sha256=absent" >"${journal_tmp}"
  journal_hash="$(canonical_adoption_journal_sha256 "${journal_tmp}")"
  journal_final="${journal_tmp}.final"
  sed "s/^journal_sha256=absent$/journal_sha256=${journal_hash}/" "${journal_tmp}" >"${journal_final}"
  sudo install -m 0640 "${journal_final}" "${adoption_journal}.pending.${run_id}"
  sudo mv -f "${adoption_journal}.pending.${run_id}" "${adoption_journal}"
  cmp -s "${journal_final}" "${adoption_journal}" || fail
  unlink "${journal_tmp}"
  unlink "${journal_final}"
}

write_control_adoption_journal() {
  local network="$1" id="$2" members members_b64 journal_tmp journal_final journal_hash
  canonical_network_id "${id}" >/dev/null
  members="$(docker network inspect --format '{{json .Containers}}' "${id}")" || fail
  members_b64="$(printf '%s' "${members}" | base64 | tr -d '\n')"
  journal_tmp="$(mktemp)"
  case "${network}" in
    catering_ingress)
      sed -e "s/^catering_ingress_id=.*/catering_ingress_id=${id}/" \
        -e "s/^catering_ingress_members_b64=.*/catering_ingress_members_b64=${members_b64}/" \
        -e "s/^catering_ingress_aliases_b64=.*/catering_ingress_aliases_b64=${members_b64}/" \
        -e 's/^adoption_order=.*/adoption_order=catering_ingress/' \
        -e 's/^adoption_count=.*/adoption_count=1/' \
        -e 's/^next_network=.*/next_network=catering_private/' \
        -e 's/^adoption_phase=.*/adoption_phase=created/' \
        -e 's/^journal_sha256=.*/journal_sha256=absent/' \
        "${adoption_journal}" >"${journal_tmp}" ;;
    catering_private)
      sed -e "s/^catering_private_id=.*/catering_private_id=${id}/" \
        -e "s/^catering_private_members_b64=.*/catering_private_members_b64=${members_b64}/" \
        -e "s/^catering_private_aliases_b64=.*/catering_private_aliases_b64=${members_b64}/" \
        -e 's/^adoption_order=.*/adoption_order=catering_ingress,catering_private/' \
        -e 's/^adoption_count=.*/adoption_count=2/' \
        -e 's/^next_network=.*/next_network=complete/' \
        -e 's/^adoption_phase=.*/adoption_phase=created/' \
        -e 's/^journal_sha256=.*/journal_sha256=absent/' \
        "${adoption_journal}" >"${journal_tmp}" ;;
    *) fail ;;
  esac
  journal_hash="$(canonical_adoption_journal_sha256 "${journal_tmp}")"
  journal_final="${journal_tmp}.final"
  sed "s/^journal_sha256=absent$/journal_sha256=${journal_hash}/" "${journal_tmp}" >"${journal_final}"
  sudo install -m 0640 "${journal_final}" "${adoption_journal}.pending.${run_id}"
  sudo mv -f "${adoption_journal}.pending.${run_id}" "${adoption_journal}"
  cmp -s "${journal_final}" "${adoption_journal}" || fail
  unlink "${journal_tmp}"
  unlink "${journal_final}"
}

write_control_membership_journal() {
  local ingress_members private_members ingress_b64 private_b64 journal_tmp journal_final journal_hash
  ingress_members="$(docker network inspect --format '{{json .Containers}}' catering_ingress)" || fail
  private_members="$(docker network inspect --format '{{json .Containers}}' catering_private)" || fail
  ingress_b64="$(printf '%s' "${ingress_members}" | base64 | tr -d '\n')"
  private_b64="$(printf '%s' "${private_members}" | base64 | tr -d '\n')"
  journal_tmp="$(mktemp)"
  sed -e "s/^catering_ingress_members_b64=.*/catering_ingress_members_b64=${ingress_b64}/" \
    -e "s/^catering_ingress_aliases_b64=.*/catering_ingress_aliases_b64=${ingress_b64}/" \
    -e "s/^catering_private_members_b64=.*/catering_private_members_b64=${private_b64}/" \
    -e "s/^catering_private_aliases_b64=.*/catering_private_aliases_b64=${private_b64}/" \
    -e 's/^adoption_phase=.*/adoption_phase=memberships_verified/' \
    -e 's/^journal_sha256=.*/journal_sha256=absent/' \
    "${adoption_journal}" >"${journal_tmp}"
  journal_hash="$(canonical_adoption_journal_sha256 "${journal_tmp}")"
  journal_final="${journal_tmp}.final"
  sed "s/^journal_sha256=absent$/journal_sha256=${journal_hash}/" "${journal_tmp}" >"${journal_final}"
  sudo install -m 0640 "${journal_final}" "${adoption_journal}.pending.${run_id}"
  sudo mv -f "${adoption_journal}.pending.${run_id}" "${adoption_journal}"
  cmp -s "${journal_final}" "${adoption_journal}" || fail
  unlink "${journal_tmp}"
  unlink "${journal_final}"
  validate_adoption_journal
}

adopt_candidate_networks() {
  local network kind id next members expected_id created_by_run
  write_control_adoption_journal_intent
  validate_adoption_journal
  for network in catering_ingress catering_private; do
    id="$(field "${adoption_journal}" "${network}_id")"
    if [[ "${id}" == absent ]]; then
      next="$(field "${adoption_journal}" next_network)"
      [[ "${next}" == "${network}" ]] || fail
      kind="${network#catering_}"
      created_by_run="$(field "${baseline_manifest}" "${network}_created_by_run_authorized")"
      if [[ "${created_by_run}" == false ]]; then
        expected_id="$(field "${baseline_manifest}" "${network}_baseline_id")"
        network_present_by_name "${network}" || fail
        id="$(network_id "${network}")"
        [[ "${id}" == "${expected_id}" ]] || fail
        validate_network_provenance "${network}" "${kind}" false
        members="$(docker network inspect --format '{{json .Containers}}' "${id}")" || fail
        [[ "${members}" == "{}" ]] || fail
      else
        docker network create --driver bridge --internal=false --ipam-driver default \
          --label "com.catering.owner=${owner}" --label "com.catering.phase=${schema}" \
          --label "com.catering.kind=${kind}" --label "com.catering.transaction=${run_id}" \
          "${network}" >/dev/null || fail
        id="$(network_id "${network}")"
        members="$(docker network inspect --format '{{json .Containers}}' "${id}")" || fail
        [[ "${members}" == "{}" ]] || fail
      fi
      write_control_adoption_journal "${network}" "${id}"
    else
      [[ "$(network_id "${network}")" == "${id}" ]] || fail
    fi
  done
  validate_adoption_journal
}

connect_resume_if_missing() {
  local network="$1" alias="$2" container="$3" networks
  networks="$(docker inspect --format '{{json .NetworkSettings.Networks}}' "${container}")" || fail
  [[ "${networks}" == *"\"${network}\""* ]] || docker network connect --alias "${alias}" "${network}" "${container}" || fail
}
disconnect_resume_if_attached() {
  local network="$1" container="$2" networks
  docker network inspect "${network}" >/dev/null 2>&1 || return 0
  networks="$(docker inspect --format '{{json .NetworkSettings.Networks}}' "${container}")" || fail
  [[ "${networks}" != *"\"${network}\""* ]] || docker network disconnect "${network}" "${container}" || fail
}
resume_candidate_networks() {
  connect_resume_if_missing catering_ingress edge shared-edge-edge-1
  connect_resume_if_missing catering_ingress web platform-infra-web-1
  connect_resume_if_missing catering_private postgres platform-infra-postgres-1
  connect_resume_if_missing catering_private intake platform-infra-intake-1
  connect_resume_if_missing catering_private offer platform-infra-offer-1
  connect_resume_if_missing catering_private production platform-infra-production-1
  connect_resume_if_missing catering_private exports platform-infra-exports-1
  connect_resume_if_missing catering_private web platform-infra-web-1
  validate_target_members catering_ingress "platform-infra-web-1,shared-edge-edge-1"
  validate_target_members catering_private "platform-infra-web-1,platform-infra-postgres-1,platform-infra-intake-1,platform-infra-offer-1,platform-infra-production-1,platform-infra-exports-1"
  semantic_smoke
  disconnect_resume_if_attached platform-infra_default platform-infra-postgres-1
  disconnect_resume_if_attached platform-infra_default platform-infra-intake-1
  disconnect_resume_if_attached platform-infra_default platform-infra-offer-1
  disconnect_resume_if_attached platform-infra_default platform-infra-production-1
  disconnect_resume_if_attached platform-infra_default platform-infra-exports-1
  disconnect_resume_if_attached zeiterfassung_default platform-infra-web-1
  disconnect_resume_if_attached platform-infra_default platform-infra-web-1
  validate_final_isolation
  write_control_membership_journal
}

validate_resume_host_smokes() {
  local evidence body label target
  evidence="$(mktemp)"
  trap '[[ -z "${evidence:-}" ]] || unlink "${evidence}" 2>/dev/null || true' RETURN
  semantic_smoke
  printf '%s:%s\n' catering "${smoke_readback_sha256}" >"${evidence}"
  for label in zeiterfassung eventos; do
    case "${label}" in
      zeiterfassung) target=http://zeiterfassung-app-1:3040/healthz ;;
      eventos) target=http://commcats-eventos-app:3045/health ;;
      *) fail ;;
    esac
    body="$(mktemp)"
    docker exec shared-edge-edge-1 wget -qO- --timeout=2 "${target}" >"${body}" || fail
    grep -Eq '"status"[[:space:]]*:[[:space:]]*"ok"' "${body}" || fail
    printf '%s:%s\n' "${label}" "$(sha256sum "${body}" | awk '{print $1}')" >>"${evidence}"
    unlink "${body}"
  done
  smoke_readback_sha256="$(sha256sum "${evidence}" | awk '{print $1}')"
}

validate_resume_egress() {
  local requested marker_url_b64 provider_value provider_url egress_body production_networks
  requested="$(field "${activation_marker}" egress_requested)"
  marker_url_b64="$(field "${activation_marker}" egress_url_b64)"
  [[ "${requested}" == "${egress_exercise}" ]] || fail
  [[ "${requested}" == 0 || "${requested}" == 1 ]] || fail
  [[ "$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "${PLATFORM_PRODUCTION}")" == platform-infra ]] || fail
  [[ "$(docker inspect --format '{{index .Config.Labels "com.docker.compose.service"}}' "${PLATFORM_PRODUCTION}")" == production ]] || fail
  production_networks="$(docker inspect --format '{{json .NetworkSettings.Networks}}' "${PLATFORM_PRODUCTION}")" || fail
  [[ "${production_networks}" == *'"catering_private"'* && "${production_networks}" != *'"platform-infra_default"'* ]] || fail
  provider_value="$(docker exec "${PLATFORM_PRODUCTION}" sh -c 'value="$(printenv CATERING_ENABLE_WEB_RECIPE_SEARCH 2>/dev/null || true)"; if [ -n "${value}" ]; then printf "%s" "${value}"; else printf "%s" "__absent__"; fi')" || fail
  provider_value="$(printf '%s' "${provider_value}" | tr '[:upper:]' '[:lower:]')"
  case "${requested}:${provider_value}" in
    0:0|0:false)
      [[ "${marker_url_b64}" == absent ]] || fail
      egress=not_exercised
      ;;
    1:1|1:true)
      [[ "${marker_url_b64}" != absent && "${marker_url_b64}" =~ ^[A-Za-z0-9+/]+={0,2}$ ]] || fail
      provider_url="$(printf '%s' "${marker_url_b64}" | base64 -d 2>/dev/null)" || fail
      [[ "${provider_url}" == https://* && "${provider_url}" != *$'\n'* && "${provider_url}" != *$'\r'* ]] || fail
      egress_body="$(mktemp)"
      trap '[[ -z "${egress_body:-}" ]] || unlink "${egress_body}" 2>/dev/null || true' RETURN
      printf '%s\n' "${provider_url}" | docker exec -i "${PLATFORM_PRODUCTION}" sh -c 'IFS= read -r url && wget -qO- --timeout=10 "${url}"' >"${egress_body}" || fail
      [[ -s "${egress_body}" ]] || fail
      grep -Eiq '(^|[[:space:]])(http|status|ok|success|fl|ip)=' "${egress_body}" || fail
      egress=exercised
      ;;
    *)
      fail
      ;;
  esac
}

validate_restore_archive() {
  validate_kv_file "${restore_proof_archive}" archive
  validate_restore_evidence
  require_regular "${restore_proof_archive}"
  require_field "${restore_proof_archive}" schema "phase3.1.rollback-restore-proof"
  require_field "${restore_proof_archive}" transaction_id "${run_id}"
  require_field "${restore_proof_archive}" transaction_manifest_path "${baseline_manifest}"
  require_field "${restore_proof_archive}" transaction_manifest_sha256 "${manifest_sha256}"
  require_field "${restore_proof_archive}" restore_evidence_path "${restore_evidence_record}"
  require_field "${restore_proof_archive}" restore_evidence_sha256 "$(sha256sum "${restore_evidence_record}" | awk '{print $1}')"
  require_field "${restore_proof_archive}" marker_sha256 "$(canonical_marker_sha256 "${activation_marker}")"
  archive_hash="$(canonical_archive_sha256 "${restore_proof_archive}")"
  [[ "${archive_hash}" =~ ^[0-9a-f]{64}$ ]] || fail
  require_field "${restore_proof_archive}" archive_sha256 "${archive_hash}"
}

validate_receipt() {
  validate_restore_archive
  validate_kv_file "${completion_receipt}" receipt
  require_regular "${completion_receipt}"
  require_field "${completion_receipt}" transaction_id "${run_id}"
  require_field "${completion_receipt}" schema "phase3.1.rollback-completion"
  require_field "${completion_receipt}" transaction_manifest_path "${baseline_manifest}"
  require_field "${completion_receipt}" transaction_manifest_sha256 "${manifest_sha256}"
  require_field "${completion_receipt}" restore_evidence_path "${restore_evidence_record}"
  require_field "${completion_receipt}" restore_evidence_sha256 "$(sha256sum "${restore_evidence_record}" | awk '{print $1}')"
  require_field "${completion_receipt}" marker_sha256 "$(canonical_marker_sha256 "${activation_marker}")"
  require_field "${completion_receipt}" restore_proof_archive_sha256 "${archive_hash}"
  require_field "${completion_receipt}" archive_sha256 "${archive_hash}"
  receipt_hash="$(sed -E 's/^receipt_sha256=.*/receipt_sha256=absent/' "${completion_receipt}" | sha256sum | awk '{print $1}')"
  require_field "${completion_receipt}" receipt_sha256 "${receipt_hash}"
}

validate_source_readback() {
  local source_hash
  require_regular "${platform_source}"
  require_regular "${edge_source}"
  [[ "$(sha256sum "${platform_source}" | awk '{print $1}')" == "${expected_platform_source_sha256}" ]] || fail
  [[ "$(sha256sum "${edge_source}" | awk '{print $1}')" == "${expected_edge_source_sha256}" ]] || fail
  source_hash="$(printf '%s\n' "platform=$(sha256sum "${platform_source}" | awk '{print $1}')" "edge=$(sha256sum "${edge_source}" | awk '{print $1}')" | sha256sum | awk '{print $1}')"
  [[ "$(field "${activation_marker}" source_readback_sha256)" == "${source_hash}" ]] || fail
}

validate_foreign_evidence() {
  local container current expected key
  local current_snapshot
  current_snapshot="$(mktemp)"
  for container in zeiterfassung-app-1 commcats-eventos-app commcats-eventos-postgres deploy-web-1 deploy-ingest-1 deploy-db-1; do
    for key in container_id RestartCount StartedAt Status Image ComposeProject ComposeService NetworkSettings PortBindings; do
      case "${key}" in
        container_id) current="$(docker inspect --format '{{.Id}}' "${container}")" ;;
        RestartCount) current="$(docker inspect --format '{{.RestartCount}}' "${container}")" ;;
        StartedAt) current="$(docker inspect --format '{{.State.StartedAt}}' "${container}")" ;;
        Status) current="$(docker inspect --format '{{.State.Status}}' "${container}")" ;;
        Image) current="$(docker inspect --format '{{.Image}}' "${container}")" ;;
        ComposeProject) current="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "${container}")" ;;
        ComposeService) current="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.service"}}' "${container}")" ;;
        NetworkSettings) current="$(docker inspect --format '{{json .NetworkSettings.Networks}}' "${container}")" ;;
        PortBindings) current="$(docker inspect --format '{{json .HostConfig.PortBindings}}' "${container}")" ;;
      esac
      expected="$(field "${baseline_manifest}" "${key}_${container}")"
      [[ "${current}" == "${expected}" ]] || fail
    done
    docker inspect --format '{{.Id}}|{{.RestartCount}}|{{.State.StartedAt}}|{{.State.Status}}|{{.Image}}|{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.service"}}|{{json .NetworkSettings.Networks}}|{{json .HostConfig.PortBindings}}' "${container}" >>"${current_snapshot}" || fail
  done
  [[ "$(sha256sum "${current_snapshot}" | awk '{print $1}')" == "$(field "${baseline_manifest}" foreign_invariants_sha256)" ]] || fail
  unlink "${current_snapshot}"
}

validate_compatibility_baseline_control() {
  local network id_field members_field aliases_field expected_id expected_members actual_id actual_members
  for network in platform-infra_default zeiterfassung_default; do
    if [[ "${network}" == platform-infra_default ]]; then
      id_field=platform_network_baseline_id; members_field=platform_network_baseline_members; aliases_field=platform_network_baseline_aliases
    else
      id_field=zeiterfassung_network_baseline_id; members_field=zeiterfassung_network_baseline_members; aliases_field=zeiterfassung_network_baseline_aliases
    fi
    expected_id="$(field "${baseline_manifest}" "${id_field}")"
    expected_members="$(field "${baseline_manifest}" "${members_field}")"
    [[ "${expected_members}" == "$(field "${baseline_manifest}" "${aliases_field}")" ]] || fail
    actual_id="$(network_id "${network}")" || fail
    actual_members="$(docker network inspect --format '{{json .Containers}}' "${network}")" || fail
    [[ "${actual_id}" == "${expected_id}" ]] || fail
    python3 - "${expected_members}" "${actual_members}" <<'PYTHON' || fail
import base64
import json
import sys
expected = json.loads(base64.b64decode(sys.argv[1]).decode())
actual = json.loads(sys.argv[2])
def canonical(value):
    return {key: {"Name": item.get("Name", ""), "Aliases": sorted(item.get("Aliases", []))} for key, item in value.items()}
if canonical(expected) != canonical(actual):
    raise SystemExit('compatibility baseline mismatch')
PYTHON
  done
}

shared_edge_restore_snapshot_control() {
  local output="$1" current expected container_id restart_count started_at status image project service ports mounts networks
  container_id="$(docker inspect --format '{{.Id}}' shared-edge-edge-1)"
  restart_count="$(docker inspect --format '{{.RestartCount}}' shared-edge-edge-1)"
  started_at="$(docker inspect --format '{{.State.StartedAt}}' shared-edge-edge-1)"
  status="$(docker inspect --format '{{.State.Status}}' shared-edge-edge-1)"
  image="$(docker inspect --format '{{.Image}}' shared-edge-edge-1)"
  project="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' shared-edge-edge-1)"
  service="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.service"}}' shared-edge-edge-1)"
  ports="$(docker inspect --format '{{json .HostConfig.PortBindings}}' shared-edge-edge-1)"
  mounts="$(docker inspect --format '{{json .Mounts}}' shared-edge-edge-1)"
  networks="$(docker inspect --format '{{json .NetworkSettings.Networks}}' shared-edge-edge-1)"
  for key in container_id RestartCount StartedAt Status Image ComposeProject ComposeService PortBindings Mounts NetworkSettings; do
    case "${key}" in
      container_id) current="${container_id}" ;;
      RestartCount) current="${restart_count}" ;;
      StartedAt) current="${started_at}" ;;
      Status) current="${status}" ;;
      Image) current="${image}" ;;
      ComposeProject) current="${project}" ;;
      ComposeService) current="${service}" ;;
      PortBindings) current="${ports}" ;;
      Mounts) current="${mounts}" ;;
      NetworkSettings) current="${networks}" ;;
    esac
    expected="$(field "${baseline_manifest}" "${key}_shared-edge-edge-1")"
    [[ "${current}" == "${expected}" ]] || fail
  done
  printf '%s\n' "${container_id}|${restart_count}|${started_at}|${status}|${image}|${project}|${service}|${ports}|${mounts}|${networks}" >"${output}"
}

validate_restore_evidence() {
  local network created expected_target actual_target shared_snapshot shared_hash
  validate_kv_file "${restore_evidence_record}" restore
  require_field "${restore_evidence_record}" schema "phase3.1.restore-evidence"
  require_field "${restore_evidence_record}" owner "${owner}"
  require_field "${restore_evidence_record}" transaction_id "${run_id}"
  require_field "${restore_evidence_record}" baseline_manifest_sha256 "${manifest_sha256}"
  require_field "${restore_evidence_record}" foreign_invariants_sha256 "$(field "${baseline_manifest}" foreign_invariants_sha256)"
  require_field "${restore_evidence_record}" platform_source_expected_sha256 "${expected_platform_source_sha256}"
  require_field "${restore_evidence_record}" edge_source_expected_sha256 "${expected_edge_source_sha256}"
  require_field "${restore_evidence_record}" platform_source_readback absent
  require_field "${restore_evidence_record}" edge_source_readback absent
  require_field "${restore_evidence_record}" platform_network_baseline_id "$(field "${baseline_manifest}" platform_network_baseline_id)"
  require_field "${restore_evidence_record}" platform_network_baseline_members "$(field "${baseline_manifest}" platform_network_baseline_members)"
  require_field "${restore_evidence_record}" platform_network_baseline_aliases "$(field "${baseline_manifest}" platform_network_baseline_aliases)"
  require_field "${restore_evidence_record}" zeiterfassung_network_baseline_id "$(field "${baseline_manifest}" zeiterfassung_network_baseline_id)"
  require_field "${restore_evidence_record}" zeiterfassung_network_baseline_members "$(field "${baseline_manifest}" zeiterfassung_network_baseline_members)"
  require_field "${restore_evidence_record}" zeiterfassung_network_baseline_aliases "$(field "${baseline_manifest}" zeiterfassung_network_baseline_aliases)"
  require_field "${restore_evidence_record}" catering_path_baseline "$(field "${baseline_manifest}" catering_path_baseline)"
  [[ -n "$(field "${restore_evidence_record}" smoke_readback_sha256)" ]] || fail
  for network in catering_ingress catering_private; do
    created="$(field "${baseline_manifest}" "${network}_created_by_run_authorized")"
    if [[ "${created}" == true ]]; then
      docker network inspect "${network}" >/dev/null 2>&1 && fail
      actual_target=absent
    else
      target="$(network_id "${network}")" || fail
      actual_target="present:${target}"
    fi
    expected_target="$(field "${restore_evidence_record}" "${network}_target")"
    [[ "${actual_target}" == "${expected_target}" ]] || fail
  done
  shared_snapshot="$(mktemp)"
  shared_edge_restore_snapshot_control "${shared_snapshot}"
  shared_hash="$(sha256sum "${shared_snapshot}" | awk '{print $1}')"
  unlink "${shared_snapshot}"
  require_field "${restore_evidence_record}" shared_edge_restore_sha256 "${shared_hash}"
}

validate_target_members() {
  local network="$1" expected_members="$2" members
  members="$(docker network inspect --format '{{json .Containers}}' "${network}")" || fail
  python3 - "${expected_members}" "${members}" <<'PYTHON' || fail
import json
import sys
expected = set(sys.argv[1].split(','))
actual = {str(item.get('Name', '')).lstrip('/') for item in json.loads(sys.argv[2]).values()}
if actual != expected:
    raise SystemExit('target network membership is incomplete')
PYTHON
}

validate_final_isolation() {
  local service port
  for service in postgres intake offer production exports; do
    case "${service}" in
      postgres) port=5432 ;;
      intake) port=3101 ;;
      offer) port=3102 ;;
      production) port=3103 ;;
      exports) port=3104 ;;
    esac
    if [[ "${service}" == postgres ]]; then
      docker exec shared-edge-edge-1 sh -c 'command -v nc >/dev/null 2>&1' >/dev/null 2>&1 || fail
      docker exec shared-edge-edge-1 sh -c '! nc -z -w 2 postgres 5432' >/dev/null 2>&1 || fail
    else
      docker exec shared-edge-edge-1 sh -c "! wget -qO- --timeout=2 http://${service}:${port}/health" >/dev/null 2>&1 || fail
    fi
  done
}

validate_resume_evidence() {
  local state="$1" ingress_id_value private_id_value marker_stage adoption_value adoption_proof_value smoke_value
  validate_manifest
  if [[ -e "${adoption_journal}" ]]; then
    validate_adoption_journal
  elif [[ "${state}" == candidate && "$(field "${activation_marker}" stage)" == S2 &&
    "$(field "${baseline_manifest}" catering_ingress_baseline)" == pre-existing-exact &&
    "$(field "${baseline_manifest}" catering_private_baseline)" == pre-existing-exact ]]; then
    :
  else
    fail
  fi
  validate_marker_file "${activation_marker}"
  require_field "${activation_marker}" state "${state}"
  require_field "${activation_marker}" owner "${owner}"
  require_field "${activation_marker}" transaction_id "${run_id}"
  [[ "$(field "${activation_marker}" transaction_manifest_sha256)" == "${manifest_sha256}" ]] || fail
  marker_stage="$(field "${activation_marker}" stage)"
  adoption_value="$(field "${activation_marker}" adoption_count)"
  adoption_proof_value="$(field "${activation_marker}" adoption_proof)"
  [[ "$(field "${activation_marker}" foreign_invariants_sha256)" == "$(field "${baseline_manifest}" foreign_invariants_sha256)" ]] || fail
  smoke_value="$(field "${activation_marker}" smoke_readback_sha256)"
  if [[ "${state}" == active ]]; then
    [[ "${smoke_value}" =~ ^[0-9a-f]{64}$ ]] || fail
  else
    # A crash immediately after network-create adoption can leave the
    # durable candidate before any semantic smoke was recorded. Resume must
    # rebuild that proof before writing active/GO; it may not treat `pending`
    # as terminal evidence.
    [[ "${smoke_value}" == pending || "${smoke_value}" =~ ^[0-9a-f]{64}$ ]] || fail
  fi
  [[ "${adoption_value}" == 0 || "${adoption_value}" == 1 ]] || fail
  validate_source_readback
  validate_foreign_evidence
  ingress_id_value="$(field "${activation_marker}" catering_ingress_id)"
  private_id_value="$(field "${activation_marker}" catering_private_id)"
  if [[ "${state}" == active || ( "${ingress_id_value}" =~ ^[0-9a-f]{64}$ && "${private_id_value}" =~ ^[0-9a-f]{64}$ ) ]]; then
    [[ "${ingress_id_value}" =~ ^[0-9a-f]{64}$ ]] || fail
    [[ "${private_id_value}" =~ ^[0-9a-f]{64}$ ]] || fail
    [[ "$(network_id catering_ingress)" == "${ingress_id_value}" ]] || fail
    [[ "$(network_id catering_private)" == "${private_id_value}" ]] || fail
    validate_network_provenance catering_ingress ingress "$(field "${baseline_manifest}" catering_ingress_created_by_run_authorized)"
    validate_network_provenance catering_private private "$(field "${baseline_manifest}" catering_private_created_by_run_authorized)"
    validate_target_members catering_ingress "platform-infra-web-1,shared-edge-edge-1"
    validate_target_members catering_private "platform-infra-web-1,platform-infra-postgres-1,platform-infra-intake-1,platform-infra-offer-1,platform-infra-production-1,platform-infra-exports-1"
    [[ "${state}" != active ]] || validate_final_isolation
  elif [[ "${state}" == candidate ]]; then
    if [[ "$(field "${baseline_manifest}" catering_ingress_baseline)" == pre-existing-exact &&
      "$(field "${baseline_manifest}" catering_private_baseline)" == pre-existing-exact &&
      "${marker_stage}" == S2 ]]; then
      validate_pre_existing_exact_candidate
    else
      [[ -e "${adoption_journal}" ]] || fail
      [[ "$(field "${adoption_journal}" adoption_count)" == 1 || "$(field "${adoption_journal}" adoption_count)" == 2 ]] || fail
    fi
  else
    fail
  fi
  case "${state}" in
    candidate)
      [[ "${marker_stage}" == S2 || "${marker_stage}" == S3 || "${marker_stage}" == S4 ]] || fail
      [[ "${adoption_value}" == 0 && "${adoption_proof_value}" == not_adopted ]] || fail
      ;;
    active)
      [[ "${marker_stage}" == S4 && "${adoption_value}" == 1 && "${adoption_proof_value}" != not_adopted ]] || fail
      ;;
    *) fail ;;
  esac
}

validate_rolling_back_evidence() {
  local network created
  validate_manifest
  validate_marker_file "${activation_marker}"
  require_field "${activation_marker}" state rolling_back
  require_field "${activation_marker}" stage RB
  validate_receipt
  validate_foreign_evidence
  validate_compatibility_baseline_control
  [[ ! -e "${platform_source}" && ! -e "${edge_source}" ]] || fail
  for network in catering_ingress catering_private; do
    created="$(field "${baseline_manifest}" "${network}_created_by_run_authorized")"
    if [[ "${created}" == true ]]; then
      if docker network inspect "${network}" >/dev/null 2>&1; then fail; fi
    fi
  done
}

validate_legacy_rollback_network_progress() {
  local network created expected_id journal_id current_id manifest_schema ingress_baseline private_baseline ingress_created private_created
  manifest_schema="$(field "${baseline_manifest}" schema)"
  if [[ "${manifest_schema}" == "${TRANSACTION_MANIFEST_SCHEMA}" &&
    "${marker_state}" == rolling_back &&
    "$(field "${activation_marker}" catering_ingress_id)" == absent &&
    "$(field "${activation_marker}" catering_private_id)" == absent ]]; then
    validate_phase32_mixed_rollback_prefix
    return 0
  fi
  if [[ "${manifest_schema}" == "${LEGACY_TRANSACTION_MANIFEST_SCHEMA}" &&
    "${marker_state}" == rolling_back &&
    "$(field "${activation_marker}" catering_ingress_id)" == absent &&
    "$(field "${activation_marker}" catering_private_id)" == absent ]]; then
    validate_initial_candidate_absence
    return 0
  fi
  if [[ ( "${manifest_schema}" == "${TRANSACTION_MANIFEST_SCHEMA}" ||
    "${manifest_schema}" == "${LEGACY_TRANSACTION_MANIFEST_SCHEMA}" ) &&
    "${marker_state}" == rolling_back &&
    "$(field "${activation_marker}" catering_ingress_id)" =~ ^[0-9a-f]{64}$ &&
    "$(field "${activation_marker}" catering_private_id)" == absent ]]; then
    validate_phase32_ingress_adoption_prefix rolling_back
    rollback_private_present_before=false
    if network_present_by_name catering_ingress; then
      rollback_ingress_present_before=true
    else
      rollback_ingress_present_before=false
    fi
    return 0
  fi
  rollback_preexisting_members_relaxed=false
  if [[ "$(field "${baseline_manifest}" schema)" == "${TRANSACTION_MANIFEST_SCHEMA}" &&
    ( "$(field "${baseline_manifest}" catering_ingress_baseline)" == pre-existing-exact ||
      "$(field "${baseline_manifest}" catering_private_baseline)" == pre-existing-exact ) ]]; then
    rollback_preexisting_members_relaxed=true
  fi
  if [[ "$(field "${baseline_manifest}" schema)" == "${TRANSACTION_MANIFEST_SCHEMA}" ]]; then
    validate_adoption_journal true true
    validate_run_created_rollback_order
  else
    validate_adoption_journal "true"
  fi
  rollback_private_present_before=false
  rollback_ingress_present_before=false
  if network_present_by_name catering_private; then
    rollback_private_present_before=true
  fi
  if network_present_by_name catering_ingress; then
    rollback_ingress_present_before=true
  fi
  # Rollback removes private before ingress for two run-created networks. The
  # inverse mixed S2 baseline is the one bounded exception: ingress was the
  # only run-created network and may already be absent while preserved private
  # remains, but only with the exact immutable manifest provenance.
  if [[ "${rollback_private_present_before}" == true && "${rollback_ingress_present_before}" != true ]]; then
    ingress_baseline="$(field "${baseline_manifest}" catering_ingress_baseline)"
    private_baseline="$(field "${baseline_manifest}" catering_private_baseline)"
    ingress_created="$(field "${baseline_manifest}" catering_ingress_created_by_run_authorized)"
    private_created="$(field "${baseline_manifest}" catering_private_created_by_run_authorized)"
    [[ "${manifest_schema}" == "${TRANSACTION_MANIFEST_SCHEMA}" &&
      "${ingress_baseline}" == absent && "${private_baseline}" == pre-existing-exact &&
      "${ingress_created}" == true && "${private_created}" == false &&
      "$(field "${activation_marker}" baseline_network_status)" == "catering_ingress=absent;catering_private=pre-existing-exact" ]] || fail
    rollback_mixed_s2_authorized=true
  fi
  for network in catering_private catering_ingress; do
    created="$(field "${baseline_manifest}" "${network}_created_by_run_authorized")"
    expected_id="$(field "${activation_marker}" "${network}_id")"
    journal_id="$(field "${adoption_journal}" "${network}_id")"
    [[ "${expected_id}" =~ ^[0-9a-f]{64}$ ]] || fail
    [[ "${expected_id}" == "${journal_id}" ]] || fail
    if ! network_present_by_name "${network}"; then
      # Only a run-created network has an authorized absent target. A
      # pre-existing network must remain present and bound to its baseline ID.
      [[ "${created}" == true ]] || fail
      # An expected ID that still exists under another name is not a completed
      # removal; accepting it would detach the name/identity binding.
      if network_id_present_anywhere "${expected_id}"; then fail; fi
      continue
    fi
    current_id="$(network_id "${network}")" || fail
    [[ "${current_id}" == "${expected_id}" ]] || fail
    if [[ "${created}" == false ]]; then
      validate_pre_existing_rollback_network "${network}"
    else
      validate_network_provenance "${network}" "${network#catering_}" "${created}"
    fi
  done
  rollback_preexisting_members_relaxed=false
}

validate_rolling_back_prefix() {
  local has_evidence=false has_archive=false has_receipt=false
  validate_manifest
  validate_marker_file "${activation_marker}"
  require_field "${activation_marker}" state rolling_back
  require_field "${activation_marker}" stage RB
  validate_foreign_evidence
  validate_compatibility_baseline_control
  [[ ! -e "${platform_source}" && ! -e "${edge_source}" ]] || fail
  validate_legacy_rollback_network_progress
  [[ -e "${restore_evidence_record}" ]] && has_evidence=true
  [[ -e "${restore_proof_archive}" ]] && has_archive=true
  [[ -e "${completion_receipt}" ]] && has_receipt=true
  [[ "${has_archive}" == false || "${has_evidence}" == true ]] || fail
  [[ "${has_receipt}" == false || ( "${has_evidence}" == true && "${has_archive}" == true ) ]] || fail
  if [[ "${has_evidence}" == true ]]; then
    validate_restore_evidence
  fi
  if [[ "${has_archive}" == true ]]; then
    validate_restore_archive
  fi
  if [[ "${has_receipt}" == true ]]; then
    validate_receipt
  fi
}

finalize_rolling_back_resume() {
  validate_rolling_back_evidence
  prior_state="$(field "${baseline_manifest}" prior_marker_state)"
  if [[ "${prior_state}" == absent ]]; then
    sudo unlink "${activation_marker}" 2>/dev/null || true
    [[ ! -e "${activation_marker}" ]] || fail
  elif [[ "${prior_state}" == inactive ]]; then
    prior_tmp="$(mktemp)"
    printf '%s' "$(field "${baseline_manifest}" prior_marker_content_b64)" | base64 -d >"${prior_tmp}" || fail
    [[ "$(sha256sum "${prior_tmp}" | awk '{print $1}')" == "$(field "${baseline_manifest}" prior_marker_sha256)" ]] || fail
    sudo install -m 0640 "${prior_tmp}" "${activation_marker}.pending.${run_id}"
    sudo mv -f "${activation_marker}.pending.${run_id}" "${activation_marker}"
    unlink "${prior_tmp}"
  else
    fail
  fi
  sudo unlink "${baseline_manifest}" || fail
  [[ ! -e "${baseline_manifest}" ]] || fail
  sudo unlink "${completion_receipt}" || fail
  [[ ! -e "${completion_receipt}" ]] || fail
}

resume_legacy_rolling_back_control() {
  local has_evidence=false has_archive=false has_receipt=false
  # Legacy recovery accepts only the monotonic proof prefixes produced by a
  # crash; every missing suffix is rebuilt under the already-held locks.
  [[ -e "${restore_evidence_record}" ]] && has_evidence=true
  [[ -e "${restore_proof_archive}" ]] && has_archive=true
  [[ -e "${completion_receipt}" ]] && has_receipt=true
  if [[ "${has_evidence}" == false && "${has_archive}" == false && "${has_receipt}" == false ]]; then
    validate_legacy_rollback_network_progress
    continue_rollback_control 0
    return 0
  fi
  validate_rolling_back_prefix
  if [[ "${has_archive}" == false ]]; then
    write_restore_archive_control
  fi
  if [[ "${has_receipt}" == false ]]; then
    write_completion_receipt_control
  fi
  legacy_rollback_finalize=1
  finalize_rolling_back_resume
  release_control_locks terminal
  printf '%s\n' 'PILOT: ROLLED BACK'
}

write_restore_evidence_control() {
  local target_tmp target network created shared_snapshot shared_hash smoke_value
  target_tmp="$(mktemp)"
  for network in catering_ingress catering_private; do
    created="$(field "${baseline_manifest}" "${network}_created_by_run_authorized")"
    if [[ "${created}" == true ]]; then
      docker network inspect "${network}" >/dev/null 2>&1 && fail
      target=absent
    else
      target="present:$(network_id "${network}")" || fail
    fi
    printf '%s_target=%s\n' "${network}" "${target}" >>"${target_tmp}"
  done
  shared_snapshot="$(mktemp)"
  shared_edge_restore_snapshot_control "${shared_snapshot}"
  shared_hash="$(sha256sum "${shared_snapshot}" | awk '{print $1}')"
  unlink "${shared_snapshot}"
  smoke_value="$(field "${activation_marker}" smoke_readback_sha256)"
  [[ -n "${smoke_value}" ]] || fail
  evidence_tmp="$(mktemp)"
  printf '%s\n' \
    "schema=phase3.1.restore-evidence" \
    "owner=${owner}" \
    "transaction_id=${run_id}" \
    "baseline_manifest_sha256=${manifest_sha256}" \
    "foreign_invariants_sha256=$(field "${baseline_manifest}" foreign_invariants_sha256)" \
    "shared_edge_baseline_sha256=${shared_hash}" \
    "shared_edge_restore_sha256=${shared_hash}" \
    "platform_source_expected_sha256=${expected_platform_source_sha256}" \
    "edge_source_expected_sha256=${expected_edge_source_sha256}" \
    "platform_source_readback=absent" \
    "edge_source_readback=absent" \
    "platform_network_baseline_id=$(field "${baseline_manifest}" platform_network_baseline_id)" \
    "platform_network_baseline_members=$(field "${baseline_manifest}" platform_network_baseline_members)" \
    "platform_network_baseline_aliases=$(field "${baseline_manifest}" platform_network_baseline_aliases)" \
    "zeiterfassung_network_baseline_id=$(field "${baseline_manifest}" zeiterfassung_network_baseline_id)" \
    "zeiterfassung_network_baseline_members=$(field "${baseline_manifest}" zeiterfassung_network_baseline_members)" \
    "zeiterfassung_network_baseline_aliases=$(field "${baseline_manifest}" zeiterfassung_network_baseline_aliases)" \
    "catering_path_baseline=$(field "${baseline_manifest}" catering_path_baseline)" \
    "smoke_readback_sha256=${smoke_value}" \
    "$(cat "${target_tmp}")" >"${evidence_tmp}"
  sudo install -m 0640 "${evidence_tmp}" "${restore_evidence_record}.pending.${run_id}"
  sudo mv -f "${restore_evidence_record}.pending.${run_id}" "${restore_evidence_record}"
  unlink "${target_tmp}"
  unlink "${evidence_tmp}"
  validate_restore_evidence
}

write_restore_archive_control() {
  local archive_tmp archive_hash marker_sha256 restore_evidence_sha256
  validate_restore_evidence
  restore_evidence_sha256="$(sha256sum "${restore_evidence_record}" | awk '{print $1}')"
  marker_sha256="$(canonical_marker_sha256 "${activation_marker}")"
  archive_tmp="$(mktemp)"
  printf '%s\n' "schema=phase3.1.rollback-restore-proof" "transaction_id=${run_id}" \
    "transaction_manifest_path=${baseline_manifest}" "transaction_manifest_sha256=${manifest_sha256}" \
    "marker_sha256=${marker_sha256}" "prior_marker_state=$(field "${baseline_manifest}" prior_marker_state)" \
    "prior_marker_sha256=$(field "${baseline_manifest}" prior_marker_sha256)" \
    "restore_evidence_path=${restore_evidence_record}" "restore_evidence_sha256=${restore_evidence_sha256}" \
    "restore_proof_archive_path=${restore_proof_archive}" "archive_sha256=absent" >"${archive_tmp}"
  archive_hash="$(canonical_archive_sha256 "${archive_tmp}")"
  sed "s/^archive_sha256=absent$/archive_sha256=${archive_hash}/" "${archive_tmp}" >"${archive_tmp}.final"
  sudo install -m 0640 "${archive_tmp}.final" "${restore_proof_archive}.pending.${run_id}"
  sudo mv -f "${restore_proof_archive}.pending.${run_id}" "${restore_proof_archive}"
  unlink "${archive_tmp}"
  unlink "${archive_tmp}.final"
  validate_restore_archive
}

write_completion_receipt_control() {
  local receipt_tmp receipt_hash archive_hash marker_sha256 restore_evidence_sha256
  validate_restore_archive
  archive_hash="$(canonical_archive_sha256 "${restore_proof_archive}")"
  restore_evidence_sha256="$(sha256sum "${restore_evidence_record}" | awk '{print $1}')"
  marker_sha256="$(canonical_marker_sha256 "${activation_marker}")"
  receipt_tmp="$(mktemp)"
  printf '%s\n' "schema=phase3.1.rollback-completion" "transaction_id=${run_id}" \
    "transaction_manifest_path=${baseline_manifest}" "transaction_manifest_sha256=${manifest_sha256}" \
    "marker_sha256=${marker_sha256}" "prior_marker_state=$(field "${baseline_manifest}" prior_marker_state)" \
    "prior_marker_sha256=$(field "${baseline_manifest}" prior_marker_sha256)" \
    "restore_evidence_path=${restore_evidence_record}" "restore_evidence_sha256=${restore_evidence_sha256}" \
    "restore_proof_archive_path=${restore_proof_archive}" \
    "restore_proof_archive_sha256=${archive_hash}" "archive_sha256=${archive_hash}" "receipt_sha256=absent" >"${receipt_tmp}"
  receipt_hash="$(sed -E 's/^receipt_sha256=.*/receipt_sha256=absent/' "${receipt_tmp}" | sha256sum | awk '{print $1}')"
  sed "s/^receipt_sha256=absent$/receipt_sha256=${receipt_hash}/" "${receipt_tmp}" >"${receipt_tmp}.final"
  mv -f "${receipt_tmp}.final" "${receipt_tmp}"
  sudo install -m 0640 "${receipt_tmp}" "${completion_receipt}.pending.${run_id}"
  sudo mv -f "${completion_receipt}.pending.${run_id}" "${completion_receipt}"
  unlink "${receipt_tmp}"
  validate_receipt
}

validate_pre_existing_baseline_network() {
  local network="$1" expected_id actual_id expected_members expected_aliases actual_members actual_aliases
  expected_id="$(field "${baseline_manifest}" "${network}_baseline_id")"
  [[ "${expected_id}" =~ ^[0-9a-f]{64}$ ]] || fail
  expected_members="$(field "${baseline_manifest}" "${network}_baseline_members")"
  expected_aliases="$(field "${baseline_manifest}" "${network}_baseline_aliases")"
  [[ "${expected_members}" != absent && -n "${expected_members}" && "${expected_aliases}" != absent && -n "${expected_aliases}" ]] || fail
  network_present_by_name "${network}" || fail
  actual_id="$(network_id "${network}")" || fail
  [[ "${actual_id}" == "${expected_id}" ]] || fail
  validate_network_provenance "${network}" "${network#catering_}" false
  actual_members="$(docker network inspect --format '{{json .Containers}}' "${network}" | base64 | tr -d '\n')" || fail
  actual_aliases="${actual_members}"
  [[ "${actual_members}" == "${expected_members}" && "${actual_aliases}" == "${expected_aliases}" ]] || fail
}

validate_pre_existing_rollback_network() {
  local network="$1" expected_id marker_id journal_id
  expected_id="$(field "${baseline_manifest}" "${network}_baseline_id")"
  marker_id="$(field "${activation_marker}" "${network}_id")"
  journal_id="$(field "${adoption_journal}" "${network}_id")"
  [[ "${expected_id}" =~ ^[0-9a-f]{64}$ && "${marker_id}" == "${expected_id}" && "${journal_id}" == "${expected_id}" ]] || fail
  validate_pre_existing_baseline_network "${network}"
}

validate_mixed_candidate_baseline() {
  local network marker_id journal_id baseline_status created_by_run expected_stage="${1:-S2}" expected_status
  [[ "$(field "${activation_marker}" stage)" == "${expected_stage}" ]] || fail
  [[ "$(field "${baseline_manifest}" network_create_order)" == "catering_ingress,catering_private" ]] || fail
  expected_status="catering_ingress=$(field "${baseline_manifest}" catering_ingress_baseline);catering_private=$(field "${baseline_manifest}" catering_private_baseline)"
  [[ "$(field "${activation_marker}" baseline_network_status)" == "${expected_status}" ]] || fail
  [[ "$(field "${activation_marker}" catering_ingress_id)" == absent &&
    "$(field "${activation_marker}" catering_private_id)" == absent ]] || fail
  [[ "$(field "${activation_marker}" adoption_count)" == 0 &&
    "$(field "${activation_marker}" adoption_proof)" == not_adopted ]] || fail
  if [[ -e "${adoption_journal}" ]]; then
    validate_adoption_journal false
    [[ "$(field "${adoption_journal}" adoption_order)" == "" &&
      "$(field "${adoption_journal}" adoption_count)" == 0 &&
      "$(field "${adoption_journal}" next_network)" == catering_ingress &&
      "$(field "${adoption_journal}" adoption_phase)" == prepared ]] || fail
  fi
  for network in catering_ingress catering_private; do
    marker_id="$(field "${activation_marker}" "${network}_id")"
    [[ "${marker_id}" == absent ]] || fail
    baseline_status="$(field "${baseline_manifest}" "${network}_baseline")"
    created_by_run="$(field "${baseline_manifest}" "${network}_created_by_run_authorized")"
    case "${baseline_status}:${created_by_run}" in
      absent:true)
        [[ "$(field "${baseline_manifest}" "${network}_baseline_id")" == absent &&
          "$(field "${baseline_manifest}" "${network}_baseline_members")" == absent &&
          "$(field "${baseline_manifest}" "${network}_baseline_aliases")" == absent &&
          "$(field "${baseline_manifest}" "${network}_network_labels")" == "owner=${owner};phase=${schema};kind=${network#catering_};transaction=${run_id}" ]] || fail
        network_present_by_name "${network}" && fail
        ;;
      pre-existing-exact:false)
        validate_pre_existing_baseline_network "${network}"
        ;;
      *) fail ;;
    esac
    if [[ -e "${adoption_journal}" ]]; then
      journal_id="$(field "${adoption_journal}" "${network}_id")"
      [[ "${journal_id}" == absent ]] || fail
    fi
  done
}

validate_phase32_mixed_rollback_prefix() {
  [[ "$(field "${baseline_manifest}" schema)" == "${TRANSACTION_MANIFEST_SCHEMA}" ]] || fail
  [[ "${marker_state}" == rolling_back && "$(field "${activation_marker}" stage)" == RB ]] || fail
  if [[ "$(field "${baseline_manifest}" catering_ingress_baseline)" == pre-existing-exact ||
    "$(field "${baseline_manifest}" catering_private_baseline)" == pre-existing-exact ]]; then
    rollback_preexisting_members_relaxed=true
  fi
  validate_mixed_candidate_baseline RB
  rollback_mixed_s2_authorized=true
}

validate_initial_candidate_absence() {
  local network marker_id journal_id baseline_status created_by_run manifest_schema
  [[ ( "${command_name}" == rollback && "${marker_state}" == candidate ) ||
    ( "${command_name}" == resume && "${marker_state}" == rolling_back ) ]] || fail
  manifest_schema="$(field "${baseline_manifest}" schema)"
  [[ "${manifest_schema}" == "${TRANSACTION_MANIFEST_SCHEMA}" ||
    "${manifest_schema}" == "${LEGACY_TRANSACTION_MANIFEST_SCHEMA}" ]] || fail
  # The legacy schema is recovery-only: an absent-network candidate may enter
  # explicit rollback, and its durable rolling_back prefix may only resume.
  if [[ "${manifest_schema}" == "${LEGACY_TRANSACTION_MANIFEST_SCHEMA}" ]]; then
    [[ ( "${command_name}" == rollback && "${marker_state}" == candidate ) ||
      ( "${command_name}" == resume && "${marker_state}" == rolling_back ) ]] || fail
  fi
  [[ "$(field "${activation_marker}" baseline_network_status)" == "catering_ingress=absent;catering_private=absent" ]] || fail
  [[ "$(field "${activation_marker}" adoption_count)" == 0 && "$(field "${activation_marker}" adoption_proof)" == not_adopted ]] || fail
  if [[ -e "${adoption_journal}" ]]; then
    validate_adoption_journal false
    [[ "$(field "${adoption_journal}" adoption_order)" == "" ]] || fail
    [[ "$(field "${adoption_journal}" adoption_count)" == 0 ]] || fail
    [[ "$(field "${adoption_journal}" next_network)" == catering_ingress ]] || fail
    [[ "$(field "${adoption_journal}" adoption_phase)" == prepared ]] || fail
  fi
  for network in catering_ingress catering_private; do
    marker_id="$(field "${activation_marker}" "${network}_id")"
    [[ "${marker_id}" == absent ]] || fail
    baseline_status="$(field "${baseline_manifest}" "${network}_baseline")"
    created_by_run="$(field "${baseline_manifest}" "${network}_created_by_run_authorized")"
    [[ "${baseline_status}" == absent && "${created_by_run}" == true ]] || fail
    if [[ -e "${adoption_journal}" ]]; then
      journal_id="$(field "${adoption_journal}" "${network}_id")"
      [[ "${journal_id}" == absent ]] || fail
    fi
    if network_present_by_name "${network}"; then
      fail
    fi
  done
  :
}

validate_pre_existing_exact_candidate() {
  local network expected_id actual_id members
  [[ "${marker_state}" == candidate && "$(field "${activation_marker}" stage)" == S2 ]] || fail
  [[ "$(field "${activation_marker}" baseline_network_status)" == "catering_ingress=pre-existing-exact;catering_private=pre-existing-exact" ]] || fail
  [[ "$(field "${baseline_manifest}" network_create_order)" == "catering_ingress,catering_private" ]] || fail
  [[ "$(field "${baseline_manifest}" network_labels)" == "owner=${owner};phase=${schema}" ||
    "$(field "${baseline_manifest}" network_labels)" == "owner=${owner};phase=${schema};transaction=${run_id}" ]] || fail
  [[ "$(field "${activation_marker}" catering_ingress_id)" == absent &&
    "$(field "${activation_marker}" catering_private_id)" == absent ]] || fail
  [[ "$(field "${activation_marker}" adoption_count)" == 0 &&
    "$(field "${activation_marker}" adoption_proof)" == not_adopted ]] || fail
  for network in catering_ingress catering_private; do
    [[ "$(field "${baseline_manifest}" ${network}_baseline)" == pre-existing-exact ]] || fail
    [[ "$(field "${baseline_manifest}" ${network}_created_by_run_authorized)" == false ]] || fail
    expected_id="$(field "${baseline_manifest}" ${network}_baseline_id)"
    [[ "${expected_id}" =~ ^[0-9a-f]{64}$ ]] || fail
    network_present_by_name "${network}" || fail
    actual_id="$(network_id "${network}")" || fail
    [[ "${actual_id}" == "${expected_id}" ]] || fail
    validate_network_provenance "${network}" "${network#catering_}" false
    members="$(docker network inspect --format '{{json .Containers}}' "${network}")" || fail
    [[ "${members}" == "{}" ]] || fail
  done
  if [[ -e "${adoption_journal}" ]]; then
    validate_adoption_journal false
    [[ "$(field "${adoption_journal}" adoption_order)" == "" &&
      "$(field "${adoption_journal}" adoption_count)" == 0 &&
      "$(field "${adoption_journal}" next_network)" == catering_ingress &&
      "$(field "${adoption_journal}" adoption_phase)" == prepared ]] || fail
    [[ "$(field "${adoption_journal}" catering_ingress_id)" == absent &&
      "$(field "${adoption_journal}" catering_private_id)" == absent ]] || fail
  fi
}

validate_phase32_ingress_adoption_prefix() {
  local recovery_state="$1"
  local network journal_id marker_id baseline_status created_by_run manifest_schema
  manifest_schema="$(field "${baseline_manifest}" schema)"
  [[ "${manifest_schema}" == "${TRANSACTION_MANIFEST_SCHEMA}" ||
    "${manifest_schema}" == "${LEGACY_TRANSACTION_MANIFEST_SCHEMA}" ]] || fail
  # A legacy manifest can prove only the historical candidate rollback prefix;
  # candidate is never a resume authority, while rolling_back resumes only its
  # durable rollback.
  if [[ "${manifest_schema}" == "${LEGACY_TRANSACTION_MANIFEST_SCHEMA}" ]]; then
    [[ ( "${recovery_state}" == candidate && "${command_name}" == rollback &&
      "${marker_state}" == candidate ) ||
      ( "${recovery_state}" == rolling_back && "${command_name}" == resume &&
        "${marker_state}" == rolling_back ) ]] || fail
  fi
  [[ "$(field "${activation_marker}" baseline_network_status)" == "catering_ingress=absent;catering_private=absent" ]] || fail
  for network in catering_ingress catering_private; do
    baseline_status="$(field "${baseline_manifest}" "${network}_baseline")"
    created_by_run="$(field "${baseline_manifest}" "${network}_created_by_run_authorized")"
    [[ "${baseline_status}" == absent && "${created_by_run}" == true ]] || fail
  done
  case "${recovery_state}" in
    candidate)
      [[ "${command_name}" == rollback && "${marker_state}" == candidate ]] || fail
      [[ "$(field "${activation_marker}" stage)" == S2 ]] || fail
      [[ "$(field "${activation_marker}" catering_ingress_id)" == absent &&
        "$(field "${activation_marker}" catering_private_id)" == absent ]] || fail
      [[ "$(field "${activation_marker}" adoption_count)" == 0 &&
        "$(field "${activation_marker}" adoption_proof)" == not_adopted ]] || fail
      [[ "$(field "${activation_marker}" platform_source_progress)" == verified &&
        "$(field "${activation_marker}" edge_source_progress)" == verified ]] || fail
      validate_adoption_journal false
      ;;
    rolling_back)
      [[ "${command_name}" == resume && "${marker_state}" == rolling_back ]] || fail
      [[ "$(field "${activation_marker}" stage)" == RB ]] || fail
      [[ "$(field "${activation_marker}" catering_private_id)" == absent ]] || fail
      [[ "$(field "${activation_marker}" catering_ingress_id)" =~ ^[0-9a-f]{64}$ ]] || fail
      validate_adoption_journal true
      ;;
    *)
      fail
      ;;
  esac
  [[ "$(field "${adoption_journal}" adoption_order)" == catering_ingress &&
    "$(field "${adoption_journal}" adoption_count)" == 1 &&
    "$(field "${adoption_journal}" next_network)" == catering_private &&
    "$(field "${adoption_journal}" adoption_phase)" == created ]] || fail
  journal_id="$(field "${adoption_journal}" catering_ingress_id)"
  [[ "${journal_id}" =~ ^[0-9a-f]{64}$ ]] || fail
  [[ "$(field "${adoption_journal}" catering_private_id)" == absent ]] || fail
  for network in catering_ingress catering_private; do
    require_field "${adoption_journal}" "${network}_owner" "${owner}"
    require_field "${adoption_journal}" "${network}_phase" "${schema}"
    require_field "${adoption_journal}" "${network}_transaction" "${run_id}"
  done
  if [[ "${recovery_state}" == rolling_back ]]; then
    [[ "$(field "${activation_marker}" catering_ingress_id)" == "${journal_id}" ]] || fail
  fi
  if network_present_by_name catering_private; then
    fail
  fi
  if network_present_by_name catering_ingress; then
    [[ "$(network_id catering_ingress)" == "${journal_id}" ]] || fail
    validate_network_provenance catering_ingress ingress true
  else
    [[ "${recovery_state}" == rolling_back ]] || fail
    if network_id_present_anywhere "${journal_id}"; then
      fail
    fi
  fi
}

continue_rollback_control() {
  local initialize_marker="$1"
  local network created_by_run expected_id container members
  local candidate_absent_networks_authorized=false
  local journalized_ingress_adoption_authorized=false
  local mixed_s2_rollback_authorized=false
  [[ "${initialize_marker}" != 1 || "${marker_state}" != rolling_back ]] || fail
  rollback_private_present_before=false
  smoke_readback_sha256=pending
  if [[ "${initialize_marker}" == 1 ]]; then
    if [[ "${marker_state}" == candidate ]]; then
      if [[ "$(field "${activation_marker}" catering_ingress_id)" == absent &&
        "$(field "${activation_marker}" catering_private_id)" == absent ]]; then
        if [[ -e "${adoption_journal}" && "$(field "${adoption_journal}" adoption_count)" == 1 ]]; then
          validate_phase32_ingress_adoption_prefix candidate
          journalized_ingress_adoption_authorized=true
        elif [[ "$(field "${activation_marker}" stage)" == S2 &&
          "$(field "${baseline_manifest}" schema)" == "${TRANSACTION_MANIFEST_SCHEMA}" ]]; then
          validate_mixed_candidate_baseline
          candidate_absent_networks_authorized=true
          mixed_s2_rollback_authorized=true
        elif [[ "$(field "${activation_marker}" stage)" == S2 &&
          "$(field "${baseline_manifest}" catering_ingress_baseline)" == pre-existing-exact &&
          "$(field "${baseline_manifest}" catering_private_baseline)" == pre-existing-exact ]]; then
          validate_pre_existing_exact_candidate
          candidate_absent_networks_authorized=true
        else
          validate_initial_candidate_absence
          candidate_absent_networks_authorized=true
        fi
      fi
    fi
    write_control_marker rolling_back 0 not_adopted
  else
    if [[ "$(field "${baseline_manifest}" schema)" == "${TRANSACTION_MANIFEST_SCHEMA}" &&
      "${marker_state}" == rolling_back &&
      "$(field "${activation_marker}" catering_ingress_id)" == absent &&
      "$(field "${activation_marker}" catering_private_id)" == absent ]]; then
      validate_phase32_mixed_rollback_prefix
      candidate_absent_networks_authorized=true
      mixed_s2_rollback_authorized=true
    elif [[ "$(field "${baseline_manifest}" schema)" == "${TRANSACTION_MANIFEST_SCHEMA}" &&
      "${marker_state}" == rolling_back &&
      "$(field "${activation_marker}" catering_ingress_id)" =~ ^[0-9a-f]{64}$ &&
      "$(field "${activation_marker}" catering_private_id)" == absent ]]; then
      validate_phase32_ingress_adoption_prefix rolling_back
      journalized_ingress_adoption_authorized=true
    else
      validate_legacy_rollback_network_progress
      mixed_s2_rollback_authorized="${rollback_mixed_s2_authorized}"
    fi
  fi
  connect_if_missing_control() {
    local network alias container networks
    network="$1"; alias="$2"; container="$3"
    networks="$(docker inspect --format '{{json .NetworkSettings.Networks}}' "${container}")" || fail
    [[ "${networks}" == *"\"${network}\""* ]] || docker network connect --alias "${alias}" "${network}" "${container}" || fail
  }
  disconnect_if_attached_control() {
    local network="$1" container="$2" networks
    if ! network_present_by_name "${network}"; then
      [[ "${initialize_marker}" == 0 || "${candidate_absent_networks_authorized}" == true ||
        "${journalized_ingress_adoption_authorized}" == true ]] || fail
      return 0
    fi
    networks="$(docker inspect --format '{{json .NetworkSettings.Networks}}' "${container}")" || fail
    [[ "${networks}" != *"\"${network}\""* ]] || docker network disconnect "${network}" "${container}" || fail
  }
  connect_if_missing_control platform-infra_default postgres platform-infra-postgres-1
  connect_if_missing_control platform-infra_default intake platform-infra-intake-1
  connect_if_missing_control platform-infra_default offer platform-infra-offer-1
  connect_if_missing_control platform-infra_default production platform-infra-production-1
  connect_if_missing_control platform-infra_default exports platform-infra-exports-1
  connect_if_missing_control platform-infra_default web platform-infra-web-1
  connect_if_missing_control zeiterfassung_default web platform-infra-web-1
  disconnect_if_attached_control catering_private platform-infra-postgres-1
  disconnect_if_attached_control catering_private platform-infra-intake-1
  disconnect_if_attached_control catering_private platform-infra-offer-1
  disconnect_if_attached_control catering_private platform-infra-production-1
  disconnect_if_attached_control catering_private platform-infra-exports-1
  disconnect_if_attached_control catering_private platform-infra-web-1
  disconnect_if_attached_control catering_ingress platform-infra-web-1
  disconnect_if_attached_control catering_ingress shared-edge-edge-1
  validate_compatibility_baseline_control
  # Only exact owner/run-labelled networks and known Catering containers are
  # eligible. No foreign container or broad network cleanup is permitted.
  for network in catering_private catering_ingress; do
    created_by_run="$(field "${baseline_manifest}" "${network}_created_by_run_authorized")"
    if ! network_present_by_name "${network}"; then
      [[ "${initialize_marker}" == 0 || "${candidate_absent_networks_authorized}" == true ||
        "${journalized_ingress_adoption_authorized}" == true ]] || fail
      [[ "${created_by_run}" == true ]] || fail
      if [[ "${network}" == catering_ingress ]]; then
        [[ "${rollback_private_present_before}" != true || "${mixed_s2_rollback_authorized}" == true ]] || fail
      fi
      continue
    fi
    if [[ "${initialize_marker}" == 0 || "${journalized_ingress_adoption_authorized}" == true ]]; then
      if [[ "${mixed_s2_rollback_authorized}" == true && "${created_by_run}" == false ]]; then
        if [[ "$(field "${activation_marker}" "${network}_id")" =~ ^[0-9a-f]{64}$ ]]; then
          validate_pre_existing_rollback_network "${network}"
        else
          validate_pre_existing_baseline_network "${network}"
        fi
      else
        expected_id="$(field "${activation_marker}" "${network}_id")"
        [[ "$(network_id "${network}")" == "${expected_id}" ]] || fail
      fi
    fi
    validate_network_provenance "${network}" "${network#catering_}" "${created_by_run}"
    [[ "${created_by_run}" == true ]] || continue
    for container in platform-infra-postgres-1 platform-infra-intake-1 platform-infra-offer-1 \
      platform-infra-production-1 platform-infra-exports-1 platform-infra-web-1 shared-edge-edge-1; do
      docker network disconnect "${network}" "${container}" >/dev/null 2>&1 || true
    done
    members="$(docker network inspect --format '{{len .Containers}}' "${network}")"
    [[ "${members}" == 0 ]] || fail
    docker network rm "${network}" >/dev/null
  done
  [[ "$(field "${baseline_manifest}" platform_source_prior)" == absent || "$(field "${baseline_manifest}" platform_source_prior)" == inactive ]] || fail
  if [[ -e "${platform_source}" ]]; then
    [[ "$(sha256sum "${platform_source}" | awk '{print $1}')" == "${expected_platform_source_sha256}" ]] || fail
    sudo unlink "${platform_source}"
  fi
  if [[ -e "${edge_source}" ]]; then
    [[ "$(sha256sum "${edge_source}" | awk '{print $1}')" == "${expected_edge_source_sha256}" ]] || fail
    sudo unlink "${edge_source}"
  fi
  if ! run_all_host_semantic_smokes; then
    printf '%s\n' 'PILOT: RECOVERY_REQUIRED' >&2
    trap - EXIT
    exit 1
  fi
  write_control_marker rolling_back 0 not_adopted
  write_restore_evidence_control
  write_restore_archive_control
  write_completion_receipt_control
  validate_receipt
  legacy_rollback_finalize=1
  finalize_rolling_back_resume
  release_control_locks terminal
  printf '%s\n' 'PILOT: ROLLED BACK'
}

if [[ "${command_name}" == resume ]]; then
  case "${marker_state}" in
    candidate)
      validate_resume_evidence candidate
      if [[ "$(field "${activation_marker}" catering_ingress_id)" != "$(field "${adoption_journal}" catering_ingress_id)" || "$(field "${activation_marker}" catering_private_id)" != "$(field "${adoption_journal}" catering_private_id)" ]]; then
        adopt_candidate_networks
      fi
      resume_candidate_networks
      validate_resume_host_smokes
      validate_resume_egress
      adoption_proof="resume:${run_id}:$(field "${activation_marker}" marker_sha256)"
      write_control_marker active 1 "${adoption_proof}"
      ;;
    active)
      validate_resume_evidence active
      validate_resume_host_smokes
      validate_resume_egress
      write_control_marker active 1 "$(field "${activation_marker}" adoption_proof)"
      ;;
    rolling_back)
      resume_legacy_rolling_back_control
      exit 0
      ;;
    *) fail ;;
  esac
  release_control_locks terminal
  printf '%s\n' 'PILOT: GO'
elif [[ "${command_name}" == rollback ]]; then
  continue_rollback_control 1
else
  fail
fi
REMOTE_CONTROL
  exit 0
fi

# The normal path begins with a read-only host preflight. The mutation engine is
# intentionally isolated in one remote transaction that holds both owner locks.
ssh "${REMOTE}" bash -s -- \
  "${MINIMUM_COMPOSE_VERSION}" \
  "${PILOT_ROOT}" \
  "${ACTIVATION_MARKER}" \
  "${BASELINE_MANIFEST}" \
  "${RESTORE_PROOF_ARCHIVE}" \
  "${COMPLETION_RECEIPT}" \
  "${RESTORE_EVIDENCE_RECORD}" \
  "${ADOPTION_JOURNAL}" \
  "${PLATFORM_SOURCE}" \
  "${EDGE_SOURCE}" \
  "${PLATFORM_RUNTIME_DIR}" \
  "${EDGE_RUNTIME_DIR}" <<'READ_ONLY_PREFLIGHT'
set -euo pipefail
minimum_compose_version="$1"
pilot_root="$2"
activation_marker="$3"
baseline_manifest="$4"
restore_proof_archive="$5"
completion_receipt="$6"
restore_evidence_record="$7"
adoption_journal="$8"
platform_source="$9"
edge_source="${10}"
platform_dir="${11}"
edge_dir="${12}"

command -v docker >/dev/null
command -v sha256sum >/dev/null
command -v cmp >/dev/null
command -v python3 >/dev/null
for remote_path in "${pilot_root}" "${activation_marker}" "${baseline_manifest}" \
  "${restore_proof_archive}" "${completion_receipt}" "${restore_evidence_record}" "${adoption_journal}" "${platform_source}" \
  "${edge_source}" "${platform_dir}" "${edge_dir}"; do
  [[ "${remote_path}" == /* && "${remote_path}" != *".."* && ! -L "${remote_path}" ]] || exit 1
done
compose_version="$(docker compose version --short | sed 's/^v//')"
python3 - "${compose_version}" "${minimum_compose_version}" <<'PYTHON'
import sys
def version(value):
    return tuple(int(part) for part in value.split("."))
if version(sys.argv[1]) < version(sys.argv[2]):
    raise SystemExit(1)
PYTHON

# Render both stable and pilot file chains before taking any mutation path.
# Compose config is read-only and proves that the hosted engine understands the
# !override tags used by the inert templates.
test -f "${platform_dir}/docker-compose.yml"
test -f "${platform_dir}/docker-compose.production.yml"
test -f "${platform_dir}/docker-compose.edge-cutover.yml"
test -f "${edge_dir}/docker-compose.yml"
test -f "${edge_dir}/.env"
docker compose -p platform-infra --env-file "${platform_dir}/.env" \
  -f "${platform_dir}/docker-compose.yml" \
  -f "${platform_dir}/docker-compose.production.yml" \
  -f "${platform_dir}/docker-compose.edge-cutover.yml" config >/dev/null
docker compose -p shared-edge --env-file "${edge_dir}/.env" \
  -f "${edge_dir}/docker-compose.yml" config >/dev/null

# Stable+manifest without its receipt/archive proof and rolling_back without its
# immutable manifest are ambiguous crash states and always fail closed.
state="absent"
if [[ -e "${activation_marker}" ]]; then
  [[ -f "${activation_marker}" && ! -L "${activation_marker}" ]] || exit 1
  state="$(sed -n 's/^state=//p' "${activation_marker}")"
fi
case "${state}" in
  absent|inactive)
    if [[ -e "${baseline_manifest}" ]]; then
      [[ -f "${restore_proof_archive}" && -f "${completion_receipt}" && -f "${restore_evidence_record}" ]] || exit 1
    fi
    ;;
  candidate|active)
    [[ -f "${baseline_manifest}" ]] || exit 1
    ;;
  rolling_back)
    [[ -f "${baseline_manifest}" ]] || exit 1
    ;;
  *) exit 1 ;;
esac
[[ "${state}" == absent || "${state}" == inactive ]] || exit 1
[[ ! -e "${platform_source}" && ! -e "${edge_source}" ]] || exit 1
[[ ! -L "${pilot_root}" ]] || exit 1
READ_ONLY_PREFLIGHT

# Source transfer uses unique staging names. They are not protected state and do
# not become authoritative until the remote transaction validates manifest and
# candidate, then atomically installs and reads each source back.
transaction_id="${CATERING_PHASE3_TRANSACTION_ID:-phase3-$(date -u +%Y%m%d-%H%M%S)-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}}"
[[ "${transaction_id}" =~ ^phase3-[A-Za-z0-9._-]+$ ]] || no_go
remote_platform_stage="${REMOTE_STAGE_ROOT}/catering-phase3-platform.${transaction_id}"
remote_edge_stage="${REMOTE_STAGE_ROOT}/catering-phase3-edge.${transaction_id}"
scp "${PLATFORM_TEMPLATE}" "${REMOTE}:${remote_platform_stage}"
scp "${EDGE_TEMPLATE}" "${REMOTE}:${remote_edge_stage}"

ssh "${REMOTE}" bash -s -- \
  "${transaction_id}" "${remote_platform_stage}" "${remote_edge_stage}" \
  "${EXPECTED_PLATFORM_SOURCE_SHA256}" "${EXPECTED_EDGE_SOURCE_SHA256}" \
  "${PILOT_ROOT}" "${PLATFORM_LOCK}" "${EDGE_LOCK}" \
  "${PLATFORM_SOURCE}" "${EDGE_SOURCE}" "${ACTIVATION_MARKER}" \
  "${BASELINE_MANIFEST}" "${RESTORE_PROOF_ARCHIVE}" "${COMPLETION_RECEIPT}" \
  "${RESTORE_EVIDENCE_RECORD}" "${ADOPTION_JOURNAL}" \
  "${EGRESS_EXERCISE}" "${EGRESS_URL}" \
  "${PLATFORM_RUNTIME_DIR}" "${EDGE_RUNTIME_DIR}" <<'REMOTE_PILOT'
set -euo pipefail

transaction_id="$1"
platform_stage="$2"
edge_stage="$3"
expected_platform_source_sha256="$4"
expected_edge_source_sha256="$5"
pilot_root="$6"
platform_lock="$7"
edge_lock="$8"
platform_source="$9"
edge_source="${10}"
activation_marker="${11}"
baseline_manifest="${12}"
restore_proof_archive="${13}"
completion_receipt="${14}"
restore_evidence_record="${15}"
adoption_journal="${16}"
egress_exercise="${17}"
egress_url="${18}"
platform_dir="${19}"
edge_dir="${20}"

for remote_path in "${pilot_root}" "${platform_lock}" "${edge_lock}" "${platform_source}" \
  "${edge_source}" "${activation_marker}" "${baseline_manifest}" \
  "${restore_proof_archive}" "${completion_receipt}" "${restore_evidence_record}" "${adoption_journal}" \
  "${platform_dir}" "${edge_dir}"; do
  [[ "${remote_path}" == /* && "${remote_path}" != *".."* && ! -L "${remote_path}" ]] || exit 1
done
[[ "${activation_marker}" == "${pilot_root}/phase3.activation" && "${baseline_manifest}" == "${pilot_root}/phase3.transaction-baseline.manifest" ]] || exit 1
[[ "${restore_proof_archive}" == "${pilot_root}/phase3.rollback-restore-proof.archive" && "${completion_receipt}" == "${pilot_root}/phase3.rollback-completion.receipt" ]] || exit 1
[[ "${restore_evidence_record}" == "${pilot_root}/phase3.restore-evidence.record" ]] || exit 1
[[ "${adoption_journal}" == "${pilot_root}/phase3.network-adoption.journal" ]] || exit 1
[[ "${platform_source}" == "${pilot_root}/platform-compose.phase3.yml" && "${edge_source}" == "${pilot_root}/edge-compose.phase3.yml" ]] || exit 1
[[ "${platform_lock##*/}" == catering-agents-platform.deploy-lock && "${edge_lock##*/}" == shared-edge.deploy-lock ]] || exit 1

owner="catering-agents-platform"
schema="phase3.1"
transaction_manifest_schema="phase3.2.transaction-baseline"
FOREIGN_CONTAINERS=(
  zeiterfassung-app-1
  commcats-eventos-app
  commcats-eventos-postgres
  deploy-web-1
  deploy-ingest-1
  deploy-db-1
)
MANAGED_CONTAINERS=(
  platform-infra-web-1
  platform-infra-postgres-1
  platform-infra-intake-1
  platform-infra-offer-1
  platform-infra-production-1
  platform-infra-exports-1
  shared-edge-edge-1
)
PLATFORM_WEB=platform-infra-web-1
PLATFORM_POSTGRES=platform-infra-postgres-1
PLATFORM_INTAKE=platform-infra-intake-1
PLATFORM_OFFER=platform-infra-offer-1
PLATFORM_PRODUCTION=platform-infra-production-1
PLATFORM_EXPORTS=platform-infra-exports-1
SHARED_EDGE=shared-edge-edge-1
ZEITERFASSUNG_APP=zeiterfassung-app-1
EVENTOS_APP=commcats-eventos-app
CATERING_INTAKE_PORT=3101
CATERING_OFFER_PORT=3102
CATERING_PRODUCTION_PORT=3103
CATERING_EXPORTS_PORT=3104
EVENTOS_HTTP_PORT=3045
ZEITERFASSUNG_HTTP_PORT=3040
platform_lock_held=false
edge_lock_held=false
platform_lock_mode=absent
edge_lock_mode=absent
candidate_written=false
rollback_started=false
rollback_complete=false
pilot_stage=S0
adoption_count=0
adoption_proof=not_adopted
smoke_readback_sha256=pending
source_readback_sha256=pending
temp_files=()
register_temp() { temp_files+=("$1"); }
temp_cleanup() {
  local temp_file
  for temp_file in "${temp_files[@]}"; do
    [[ -e "${temp_file}" ]] && unlink "${temp_file}" 2>/dev/null || true
  done
}
prior_marker_backup="$(mktemp)"
register_temp "${prior_marker_backup}"

fail() { printf '%s\n' "PILOT: NO-GO" >&2; exit 1; }
canonical_network_id() {
  local value="$1"
  [[ "${value}" =~ ^[0-9a-f]{64}$ ]] || fail
  printf '%s' "${value}"
}
network_id() {
  local network="$1" value
  value="$(docker network inspect --format '{{.Id}}' "${network}")" || fail
  canonical_network_id "${value}"
}
phase3_lock_acquire() {
  local lock="$1" mode_var="$2" owner_token="${owner}:${transaction_id}"
  local owner_file owner_tmp lock_real lock_expected_real lock_mode owner_mode
  if sudo mkdir -m 0700 -- "${lock}" 2>/dev/null; then
    printf -v "${mode_var}" '%s' acquired
    lock_real="$(sudo realpath -e -- "${lock}" 2>/dev/null || sudo realpath "${lock}")"
    lock_expected_real="$(sudo realpath -e -- "$(dirname "${lock}")" 2>/dev/null || sudo realpath "$(dirname "${lock}")")/$(basename "${lock}")"
    lock_mode="$(sudo stat -c '%a' "${lock}" 2>/dev/null || sudo stat -f '%Lp' "${lock}")"
    [[ "${lock_real}" == "${lock_expected_real}" && "${lock_mode}" == 700 ]] || fail
    owner_file="${lock}/owner"
    owner_tmp="${owner_file}.pending.${transaction_id}"
    printf '%s\n' "owner_token=${owner_token}" "owner=${owner}" "transaction_id=${transaction_id}" | sudo tee "${owner_tmp}" >/dev/null
    sudo chmod 0600 "${owner_tmp}"
    sudo mv -f "${owner_tmp}" "${owner_file}"
    owner_mode="$(sudo stat -c '%a' "${owner_file}" 2>/dev/null || sudo stat -f '%Lp' "${owner_file}")"
    [[ -f "${owner_file}" && ! -L "${owner_file}" && "${owner_mode}" == 600 ]] || fail
    sudo grep -Fxq "owner_token=${owner_token}" "${owner_file}" || fail
    return 0
  fi
  lock_real="$(sudo realpath -e -- "${lock}" 2>/dev/null || sudo realpath "${lock}")"
  lock_expected_real="$(sudo realpath -e -- "$(dirname "${lock}")" 2>/dev/null || sudo realpath "$(dirname "${lock}")")/$(basename "${lock}")"
  lock_mode="$(sudo stat -c '%a' "${lock}" 2>/dev/null || sudo stat -f '%Lp' "${lock}")"
  owner_file="${lock}/owner"
  owner_mode="$(sudo stat -c '%a' "${owner_file}" 2>/dev/null || sudo stat -f '%Lp' "${owner_file}")"
  [[ -d "${lock}" && ! -L "${lock}" && "${lock_real}" == "${lock_expected_real}" && "${lock_mode}" == 700 ]] || fail
  [[ -f "${owner_file}" && ! -L "${owner_file}" && "${owner_mode}" == 600 ]] || fail
  sudo grep -Fxq "owner_token=${owner_token}" "${owner_file}" || fail
  printf -v "${mode_var}" '%s' reentered
}
acquire_lock() { phase3_lock_acquire "$@"; }
phase3_lock_release() {
  local lock expected_token owner_file lock_real lock_expected_real lock_mode owner_mode
  lock="$1"; expected_token="$2"; owner_file="${lock}/owner"
  lock_real="$(sudo realpath -e -- "${lock}" 2>/dev/null || sudo realpath "${lock}")"
  lock_expected_real="$(sudo realpath -e -- "$(dirname "${lock}")" 2>/dev/null || sudo realpath "$(dirname "${lock}")")/$(basename "${lock}")"
  lock_mode="$(sudo stat -c '%a' "${lock}" 2>/dev/null || sudo stat -f '%Lp' "${lock}")"
  owner_mode="$(sudo stat -c '%a' "${owner_file}" 2>/dev/null || sudo stat -f '%Lp' "${owner_file}")"
  [[ -d "${lock}" && ! -L "${lock}" && "${lock_real}" == "${lock_expected_real}" && "${lock_mode}" == 700 ]] || fail
  [[ -f "${owner_file}" && ! -L "${owner_file}" && "${owner_mode}" == 600 ]] || fail
  sudo grep -Fxq "owner_token=${expected_token}" "${owner_file}" || fail
  sudo unlink "${owner_file}"
  sudo rmdir "${lock}"
}
phase3_lock_release_checked() {
  local lock="$1" expected_token="$2" owner_file lock_real lock_expected_real lock_mode owner_mode
  owner_file="${lock}/owner"
  lock_real="$(sudo realpath -e -- "${lock}" 2>/dev/null || sudo realpath "${lock}")" || return 1
  lock_expected_real="$(sudo realpath -e -- "$(dirname "${lock}")" 2>/dev/null || sudo realpath "$(dirname "${lock}")")/$(basename "${lock}")" || return 1
  lock_mode="$(sudo stat -c '%a' "${lock}" 2>/dev/null || sudo stat -f '%Lp' "${lock}")" || return 1
  owner_mode="$(sudo stat -c '%a' "${owner_file}" 2>/dev/null || sudo stat -f '%Lp' "${owner_file}")" || return 1
  [[ -d "${lock}" && ! -L "${lock}" && "${lock_real}" == "${lock_expected_real}" && "${lock_mode}" == 700 ]] || return 1
  [[ -f "${owner_file}" && ! -L "${owner_file}" && "${owner_mode}" == 600 ]] || return 1
  sudo grep -Fxq "owner_token=${expected_token}" "${owner_file}" || return 1
  sudo unlink "${owner_file}" || return 1
  sudo rmdir "${lock}" || return 1
  [[ ! -e "${lock}" && ! -L "${lock}" ]]
}
cleanup_temp_files() {
  local status=$?
  local uncertain_recovery=false
  local recovery_required=false
  trap - ERR
  trap '' TERM INT HUP
  set +e
  case "${status}" in
    129|130|137|143) uncertain_recovery=true ;;
  esac
  # A pre-candidate failure leaves only locks that this invocation acquired
  # eligible for cleanup. Prove and release both in reverse acquisition order;
  # a reentered or foreign lock is never treated as ours.
  if [[ "${status}" -ne 0 && "${candidate_written}" == false ]]; then
    if [[ "${platform_lock_mode}" == acquired && "${edge_lock_mode}" == acquired ]]; then
      if phase3_lock_release_checked "${edge_lock}" "${owner}:${transaction_id}"; then
        edge_lock_mode=absent
        edge_lock_held=false
      else
        recovery_required=true
      fi
      if [[ "${recovery_required}" == false ]] && phase3_lock_release_checked "${platform_lock}" "${owner}:${transaction_id}"; then
        platform_lock_mode=absent
        platform_lock_held=false
      else
        recovery_required=true
      fi
    elif [[ "${platform_lock_mode}" == acquired && "${edge_lock_mode}" == absent ]]; then
      if phase3_lock_release_checked "${platform_lock}" "${owner}:${transaction_id}"; then
        platform_lock_mode=absent
        platform_lock_held=false
      else
        recovery_required=true
      fi
    fi
  fi
  # A signal/137 boundary provides no proof that the restore completed. Keep
  # the candidate evidence and owner locks for an exact, run-bound resume;
  # only an ordinary, observable error may enter the compensating rollback.
  if [[ "${status}" -ne 0 && "${uncertain_recovery}" == false && "${candidate_written}" == true && "${rollback_started}" == false ]]; then
    rollback_started=true
    if ! rollback_transaction; then
      recovery_required=true
    fi
  fi
  if [[ "${recovery_required}" == true ]]; then
    printf '%s\n' 'PILOT: RECOVERY_REQUIRED' >&2
  elif [[ "${rollback_complete}" == true ]]; then
    [[ -e "${platform_stage}" ]] && unlink "${platform_stage}"
    [[ -e "${edge_stage}" ]] && unlink "${edge_stage}"
    if [[ "${edge_lock_mode}" == reentered || "${platform_lock_mode}" == reentered ]]; then
      recovery_required=true
    fi
    if [[ "${recovery_required}" == false && "${edge_lock_mode}" == acquired ]]; then
      if phase3_lock_release_checked "${edge_lock}" "${owner}:${transaction_id}"; then
        edge_lock_mode=absent
        edge_lock_held=false
      else
        recovery_required=true
      fi
    fi
    if [[ "${recovery_required}" == false && "${platform_lock_mode}" == acquired ]]; then
      if phase3_lock_release_checked "${platform_lock}" "${owner}:${transaction_id}"; then
        platform_lock_mode=absent
        platform_lock_held=false
      else
        recovery_required=true
      fi
    fi
    if [[ "${recovery_required}" == true ]]; then
      printf '%s\n' 'PILOT: RECOVERY_REQUIRED' >&2
    else
      [[ "${edge_lock_mode}" == absent && "${platform_lock_mode}" == absent ]] || recovery_required=true
      if [[ "${recovery_required}" == true ]]; then
        printf '%s\n' 'PILOT: RECOVERY_REQUIRED' >&2
      else
        [[ -e "${prior_marker_backup}" ]] && unlink "${prior_marker_backup}" 2>/dev/null || true
        printf '%s\n' 'PILOT: ROLLED BACK' >&2
      fi
    fi
  else
    printf '%s\n' 'PILOT: NO-GO' >&2
  fi
  temp_cleanup
  exit "${status}"
}
trap cleanup_temp_files EXIT
trap 'exit 143' TERM
trap 'exit 130' INT
trap 'exit 129' HUP
trap 'cleanup_temp_files' ERR

platform_lock_mode=absent
edge_lock_mode=absent
phase3_lock_acquire "${platform_lock}" platform_lock_mode
platform_lock_held=true
phase3_lock_acquire "${edge_lock}" edge_lock_mode
edge_lock_held=true

atomic_install() {
  local source="$1" destination="$2" expected_sha="$3" pending
  pending="${destination}.pending.${transaction_id}"
  sudo install -d -m 0750 "${pilot_root}"
  sudo install -m 0640 "${source}" "${pending}"
  sudo cmp -s "${source}" "${pending}" || fail
  [[ "$(sudo sha256sum "${pending}" | awk '{print $1}')" == "${expected_sha}" ]] || fail
  sudo mv -f "${pending}" "${destination}"
  sudo cmp -s "${source}" "${destination}" || fail
  [[ "$(sudo sha256sum "${destination}" | awk '{print $1}')" == "${expected_sha}" ]] || fail
}

atomic_record() {
  local destination="$1" source="$2" pending
  pending="${destination}.pending.${transaction_id}"
  sudo install -m 0640 "${source}" "${pending}"
  sudo cmp -s "${source}" "${pending}" || fail
  sudo mv -f "${pending}" "${destination}"
  sudo cmp -s "${source}" "${destination}" || fail
}

canonical_adoption_journal_sha256() {
  local file="$1" canonical
  canonical="${file}.canonical.$$"
  sed -E 's/^journal_sha256=.*/journal_sha256=absent/' "${file}" >"${canonical}"
  sha256sum "${canonical}" | awk '{print $1}'
  unlink "${canonical}"
}
journal_field_normal() { sed -n "s/^$2=//p" "$1" | tail -n 1; }

adoption_order=""
adoption_count=0
adoption_phase=prepared
adoption_next_network=catering_ingress
adoption_ingress_id=absent
adoption_private_id=absent
adoption_ingress_members_b64=absent
adoption_private_members_b64=absent
adoption_ingress_aliases_b64=absent
adoption_private_aliases_b64=absent

write_adoption_journal() {
  local network="$1" id="$2" members aliases source_hash journal_tmp journal_final journal_hash
  if [[ -f "${adoption_journal}" && ! -L "${adoption_journal}" ]]; then
    # create_or_verify_network is called through command substitution to
    # return the ID. Rehydrate the prior durable step so the second network
    # cannot lose the first network's adoption proof in the subshell.
    adoption_order="$(journal_field_normal "${adoption_journal}" adoption_order)"
    adoption_count="$(journal_field_normal "${adoption_journal}" adoption_count)"
    adoption_phase="$(journal_field_normal "${adoption_journal}" adoption_phase)"
    adoption_next_network="$(journal_field_normal "${adoption_journal}" next_network)"
    adoption_ingress_id="$(journal_field_normal "${adoption_journal}" catering_ingress_id)"
    adoption_private_id="$(journal_field_normal "${adoption_journal}" catering_private_id)"
    adoption_ingress_members_b64="$(journal_field_normal "${adoption_journal}" catering_ingress_members_b64)"
    adoption_private_members_b64="$(journal_field_normal "${adoption_journal}" catering_private_members_b64)"
    adoption_ingress_aliases_b64="$(journal_field_normal "${adoption_journal}" catering_ingress_aliases_b64)"
    adoption_private_aliases_b64="$(journal_field_normal "${adoption_journal}" catering_private_aliases_b64)"
  fi
  canonical_network_id "${id}" >/dev/null
  members="$(docker network inspect --format '{{json .Containers}}' "${id}")" || fail
  aliases="${members}"
  case "${network}" in
    catering_ingress)
      adoption_ingress_id="${id}"
      adoption_ingress_members_b64="$(printf '%s' "${members}" | base64 | tr -d '\n')"
      adoption_ingress_aliases_b64="$(printf '%s' "${aliases}" | base64 | tr -d '\n')"
      [[ "${adoption_order}" == "" ]] && adoption_order=catering_ingress
      ;;
    catering_private)
      [[ "${adoption_ingress_id}" =~ ^[0-9a-f]{64}$ ]] || fail
      [[ "${adoption_order}" == catering_ingress ]] || fail
      adoption_private_id="${id}"
      adoption_private_members_b64="$(printf '%s' "${members}" | base64 | tr -d '\n')"
      adoption_private_aliases_b64="$(printf '%s' "${aliases}" | base64 | tr -d '\n')"
      adoption_order=catering_ingress,catering_private
      ;;
    *) fail ;;
  esac
  adoption_count=0
  [[ "${adoption_ingress_id}" =~ ^[0-9a-f]{64}$ ]] && adoption_count=$((adoption_count + 1))
  [[ "${adoption_private_id}" =~ ^[0-9a-f]{64}$ ]] && adoption_count=$((adoption_count + 1))
  if [[ "${adoption_count}" == 2 ]]; then adoption_next_network=complete; else adoption_next_network=catering_private; fi
  adoption_phase=created
  if [[ -f "${platform_source}" && -f "${edge_source}" && ! -L "${platform_source}" && ! -L "${edge_source}" ]]; then
    source_hash="$(printf '%s\n' "platform=$(sha256sum "${platform_source}" | awk '{print $1}')" "edge=$(sha256sum "${edge_source}" | awk '{print $1}')" | sha256sum | awk '{print $1}')"
  else
    source_hash=pending
  fi
  journal_tmp="$(mktemp)"
  register_temp "${journal_tmp}"
  printf '%s\n' \
    "schema=phase3.1.network-adoption" \
    "owner=${owner}" \
    "transaction_id=${transaction_id}" \
    "transaction_manifest_path=${baseline_manifest}" \
    "transaction_manifest_sha256=${transaction_manifest_sha256}" \
    "expected_platform_source_sha256=${expected_platform_source_sha256}" \
    "expected_edge_source_sha256=${expected_edge_source_sha256}" \
    "network_create_order=catering_ingress,catering_private" \
    "adoption_order=${adoption_order}" \
    "adoption_count=${adoption_count}" \
    "next_network=${adoption_next_network}" \
    "adoption_phase=${adoption_phase}" \
    "catering_ingress_id=${adoption_ingress_id}" \
    "catering_private_id=${adoption_private_id}" \
    "catering_ingress_owner=${owner}" \
    "catering_private_owner=${owner}" \
    "catering_ingress_phase=${schema}" \
    "catering_private_phase=${schema}" \
    "catering_ingress_transaction=${transaction_id}" \
    "catering_private_transaction=${transaction_id}" \
    "catering_ingress_members_b64=${adoption_ingress_members_b64}" \
    "catering_private_members_b64=${adoption_private_members_b64}" \
    "catering_ingress_aliases_b64=${adoption_ingress_aliases_b64}" \
    "catering_private_aliases_b64=${adoption_private_aliases_b64}" \
    "source_readback_sha256=${source_hash}" \
    "journal_sha256=absent" >"${journal_tmp}"
  journal_hash="$(canonical_adoption_journal_sha256 "${journal_tmp}")"
  journal_final="${journal_tmp}.final"
  sed "s/^journal_sha256=absent$/journal_sha256=${journal_hash}/" "${journal_tmp}" >"${journal_final}"
  atomic_record "${adoption_journal}" "${journal_final}"
  unlink "${journal_final}"
  [[ "$(canonical_adoption_journal_sha256 "${adoption_journal}")" == "$(journal_field_normal "${adoption_journal}" journal_sha256)" ]] || fail
}

write_adoption_journal_intent() {
  local network="$1" journal_tmp journal_final journal_hash
  [[ -e "${adoption_journal}" ]] && return 0
  journal_tmp="$(mktemp)"
  register_temp "${journal_tmp}"
  printf '%s\n' \
    "schema=phase3.1.network-adoption" "owner=${owner}" "transaction_id=${transaction_id}" \
    "transaction_manifest_path=${baseline_manifest}" "transaction_manifest_sha256=${transaction_manifest_sha256}" \
    "expected_platform_source_sha256=${expected_platform_source_sha256}" "expected_edge_source_sha256=${expected_edge_source_sha256}" \
    "network_create_order=catering_ingress,catering_private" "adoption_order=${adoption_order}" \
    "adoption_count=${adoption_count}" "next_network=${network}" "adoption_phase=prepared" \
    "catering_ingress_id=${adoption_ingress_id}" "catering_private_id=${adoption_private_id}" \
    "catering_ingress_owner=${owner}" "catering_private_owner=${owner}" \
    "catering_ingress_phase=${schema}" "catering_private_phase=${schema}" \
    "catering_ingress_transaction=${transaction_id}" "catering_private_transaction=${transaction_id}" \
    "catering_ingress_members_b64=${adoption_ingress_members_b64}" "catering_private_members_b64=${adoption_private_members_b64}" \
    "catering_ingress_aliases_b64=${adoption_ingress_aliases_b64}" "catering_private_aliases_b64=${adoption_private_aliases_b64}" \
    "source_readback_sha256=pending" "journal_sha256=absent" >"${journal_tmp}"
  journal_hash="$(canonical_adoption_journal_sha256 "${journal_tmp}")"
  journal_final="${journal_tmp}.final"
  sed "s/^journal_sha256=absent$/journal_sha256=${journal_hash}/" "${journal_tmp}" >"${journal_final}"
  atomic_record "${adoption_journal}" "${journal_final}"
  unlink "${journal_final}"
}

write_membership_adoption_journal_normal() {
  local ingress_members private_members ingress_b64 private_b64 journal_tmp journal_final journal_hash
  ingress_members="$(docker network inspect --format '{{json .Containers}}' catering_ingress)" || fail
  private_members="$(docker network inspect --format '{{json .Containers}}' catering_private)" || fail
  ingress_b64="$(printf '%s' "${ingress_members}" | base64 | tr -d '\n')"
  private_b64="$(printf '%s' "${private_members}" | base64 | tr -d '\n')"
  journal_tmp="$(mktemp)"
  register_temp "${journal_tmp}"
  sed -e "s/^catering_ingress_members_b64=.*/catering_ingress_members_b64=${ingress_b64}/" \
    -e "s/^catering_ingress_aliases_b64=.*/catering_ingress_aliases_b64=${ingress_b64}/" \
    -e "s/^catering_private_members_b64=.*/catering_private_members_b64=${private_b64}/" \
    -e "s/^catering_private_aliases_b64=.*/catering_private_aliases_b64=${private_b64}/" \
    -e 's/^adoption_phase=.*/adoption_phase=memberships_verified/' \
    -e 's/^journal_sha256=.*/journal_sha256=absent/' \
    "${adoption_journal}" >"${journal_tmp}"
  journal_hash="$(canonical_adoption_journal_sha256 "${journal_tmp}")"
  journal_final="${journal_tmp}.final"
  register_temp "${journal_final}"
  sed "s/^journal_sha256=absent$/journal_sha256=${journal_hash}/" "${journal_tmp}" >"${journal_final}"
  atomic_record "${adoption_journal}" "${journal_final}"
  [[ "$(canonical_adoption_journal_sha256 "${adoption_journal}")" == "$(journal_field_normal "${adoption_journal}" journal_sha256)" ]] || fail
}

network_status() {
  local network="$1" count id driver scope internal ipam_driver enable_ipv6 options ipam_config owner_label phase_label kind_label transaction_label members
  count="$(docker network ls --no-trunc --filter "name=^${network}$" --format '{{.ID}}' | awk 'NF {n++} END {print n+0}')"
  [[ "${count}" == 0 || "${count}" == 1 ]] || fail
  if [[ "${count}" == 0 ]]; then printf '%s' absent; return; fi
  id="$(network_id "${network}")"
  driver="$(docker network inspect --format '{{.Driver}}' "${id}")"
  scope="$(docker network inspect --format '{{.Scope}}' "${id}")"
  internal="$(docker network inspect --format '{{.Internal}}' "${id}")"
  ipam_driver="$(docker network inspect --format '{{.IPAM.Driver}}' "${id}")"
  ipam_config="$(docker network inspect --format '{{json .IPAM.Config}}' "${id}")"
  enable_ipv6="$(docker network inspect --format '{{.EnableIPv6}}' "${id}")"
  options="$(docker network inspect --format '{{json .Options}}' "${id}")"
  owner_label="$(docker network inspect --format '{{index .Labels "com.catering.owner"}}' "${id}")"
  phase_label="$(docker network inspect --format '{{index .Labels "com.catering.phase"}}' "${id}")"
  kind_label="$(docker network inspect --format '{{index .Labels "com.catering.kind"}}' "${id}")"
  transaction_label="$(docker network inspect --format '{{index .Labels "com.catering.transaction"}}' "${id}")"
  members="$(docker network inspect --format '{{len .Containers}}' "${id}")"
  [[ "${driver}" == bridge && "${scope}" == local && "${internal}" == false && "${ipam_driver}" == default && "${enable_ipv6}" == false && "${options}" == '{}' && ( "${ipam_config}" == '[]' || "${ipam_config}" == 'null' ) && "${owner_label}" == "${owner}" && "${phase_label}" == "phase3.1" && "${kind_label}" == "${network#catering_}" && ( -z "${transaction_label}" || "${transaction_label}" == "<no value>" || "${transaction_label}" == "${transaction_id}" ) && "${members}" == 0 ]] || fail
  printf '%s' pre-existing-exact
}

network_label_provenance() {
  local network="$1" owner_label phase_label kind_label transaction_label value
  owner_label="$(docker network inspect --format '{{index .Labels "com.catering.owner"}}' "${network}")" || fail
  phase_label="$(docker network inspect --format '{{index .Labels "com.catering.phase"}}' "${network}")" || fail
  kind_label="$(docker network inspect --format '{{index .Labels "com.catering.kind"}}' "${network}")" || fail
  transaction_label="$(docker network inspect --format '{{index .Labels "com.catering.transaction"}}' "${network}")" || fail
  [[ "${owner_label}" == "${owner}" && "${phase_label}" == "${schema}" && "${kind_label}" == "${network#catering_}" ]] || fail
  value="owner=${owner_label};phase=${phase_label};kind=${kind_label}"
  if [[ -n "${transaction_label}" && "${transaction_label}" != "<no value>" ]]; then
    [[ "${transaction_label}" == "${transaction_id}" ]] || fail
    value+=";transaction=${transaction_label}"
  fi
  printf '%s' "${value}"
}

validate_network_provenance() {
  local network="$1" kind="$2" expected_members="$3" expected_aliases="$4" created_by_run="${5:-true}"
  local id driver scope internal ipam_driver ipam_config options enable_ipv6 labels members manifest_labels
  id="$(network_id "${network}")" || fail
  driver="$(docker network inspect --format '{{.Driver}}' "${id}")" || fail
  scope="$(docker network inspect --format '{{.Scope}}' "${id}")" || fail
  internal="$(docker network inspect --format '{{.Internal}}' "${id}")" || fail
  ipam_driver="$(docker network inspect --format '{{.IPAM.Driver}}' "${id}")" || fail
  ipam_config="$(docker network inspect --format '{{json .IPAM.Config}}' "${id}")" || fail
  options="$(docker network inspect --format '{{json .Options}}' "${id}")" || fail
  enable_ipv6="$(docker network inspect --format '{{.EnableIPv6}}' "${id}")" || fail
  labels="$(docker network inspect --format '{{json .Labels}}' "${id}")" || fail
  members="$(docker network inspect --format '{{json .Containers}}' "${id}")" || fail
  manifest_labels="$(manifest_network_labels_for "${network}" "${created_by_run}")" || fail
  [[ "${driver}" == bridge && "${scope}" == local && "${internal}" == false && "${ipam_driver}" == default && "${enable_ipv6}" == false && ( "${ipam_config}" == '[]' || "${ipam_config}" == 'null' ) && "${options}" == '{}' ]] || fail
  python3 - "${labels}" "${members}" "${manifest_labels}" "${owner}" "${schema}" "${kind}" "${transaction_id}" "${expected_members}" "${created_by_run}" <<'PYTHON' || fail
import json
import sys

labels = json.loads(sys.argv[1]) if sys.argv[1] not in ('', '<no value>', 'null') else {}
containers = json.loads(sys.argv[2]) if sys.argv[2] not in ('', '<no value>', 'null') else {}
manifest_labels, owner, schema, kind, transaction = sys.argv[3:8]
expected_members = {item for item in sys.argv[8].split(',') if item}
created_by_run = sys.argv[9]
expected_labels = {}
for item in manifest_labels.split(';'):
    key, separator, value = item.partition('=')
    if not separator or key in expected_labels or key not in {'owner', 'phase', 'kind', 'transaction'}:
        raise SystemExit('network provenance label record is malformed')
    expected_labels[f'com.catering.{key}'] = value
if expected_labels.get('com.catering.owner') != owner or expected_labels.get('com.catering.phase') != schema or expected_labels.get('com.catering.kind') != kind:
    raise SystemExit('network provenance label record is not manifest-bound')
if created_by_run == 'true':
    if expected_labels.get('com.catering.transaction') != transaction:
        raise SystemExit('run-created network lacks its transaction label')
elif 'com.catering.transaction' in expected_labels and expected_labels['com.catering.transaction'] != transaction:
    raise SystemExit('pre-existing network carries a foreign transaction label')
if labels != expected_labels:
    raise SystemExit('network labels are not the exact allowlisted set')
actual_members = {str(value.get('Name', '')).lstrip('/') for value in containers.values() if isinstance(value, dict)}
if expected_members and actual_members != expected_members:
    raise SystemExit('network members are not the exact expected set')
PYTHON
  if [[ -n "${expected_members}" && -n "${expected_aliases}" ]]; then
    local member actual_aliases
    member="${expected_members%%,*}"
    actual_aliases="$(docker inspect --format "{{range \$network_name, \$network := .NetworkSettings.Networks}}{{if eq \"\$network_name\" \"${network}\"}}{{join \$network.Aliases \",\"}}{{end}}{{end}}" "${member}")" || fail
    [[ "${actual_aliases}" == "${expected_aliases}" ]] || fail
  fi
}

validate_post_create_adoption() {
  local network="$1" kind="$2" created_by_run="$3" listing count listed_id id members
  listing="$(docker network ls --no-trunc --filter "name=^${network}$" --format '{{.ID}}')" || fail
  count="$(printf '%s\n' "${listing}" | awk 'NF {n++} END {print n+0}')"
  [[ "${count}" == 1 ]] || fail
  listed_id="$(printf '%s\n' "${listing}" | awk 'NF {print; exit}')"
  id="$(network_id "${network}")" || fail
  [[ "${listed_id}" == "${id}" && "${id}" =~ ^[0-9a-f]{64}$ ]] || fail
  validate_network_provenance "${network}" "${kind}" "" "" "${created_by_run}"
  members="$(docker network inspect --format '{{json .Containers}}' "${id}")" || fail
  python3 - "${members}" <<'PYTHON' || fail
import json
import sys
members = json.loads(sys.argv[1])
if members != {}:
    raise SystemExit('post-create network was adopted before its empty readback')
PYTHON
}

ingress_status="$(network_status catering_ingress)"
private_status="$(network_status catering_private)"
ingress_created_by_run=false
private_created_by_run=false
[[ "${ingress_status}" == absent ]] && ingress_created_by_run=true
[[ "${private_status}" == absent ]] && private_created_by_run=true
ingress_baseline_id=absent
private_baseline_id=absent
if [[ "${ingress_status}" == pre-existing-exact ]]; then
  ingress_baseline_id="$(network_id catering_ingress)" || fail
fi
if [[ "${private_status}" == pre-existing-exact ]]; then
  private_baseline_id="$(network_id catering_private)" || fail
fi
ingress_network_labels="owner=${owner};phase=${schema};kind=ingress"
private_network_labels="owner=${owner};phase=${schema};kind=private"
ingress_baseline_members=absent
ingress_baseline_aliases=absent
private_baseline_members=absent
private_baseline_aliases=absent
if [[ "${ingress_status}" == pre-existing-exact ]]; then
  ingress_network_labels="$(network_label_provenance catering_ingress)" || fail
  ingress_baseline_members="$(docker network inspect --format '{{json .Containers}}' catering_ingress | base64 | tr -d '\n')" || fail
  ingress_baseline_aliases="${ingress_baseline_members}"
else
  ingress_network_labels+=";transaction=${transaction_id}"
fi
if [[ "${private_status}" == pre-existing-exact ]]; then
  private_network_labels="$(network_label_provenance catering_private)" || fail
  private_baseline_members="$(docker network inspect --format '{{json .Containers}}' catering_private | base64 | tr -d '\n')" || fail
  private_baseline_aliases="${private_baseline_members}"
else
  private_network_labels+=";transaction=${transaction_id}"
fi

# Phase-2 compatibility networks are immutable rollback inputs. Capture their
# exact IDs and Docker membership/alias records before any Catering mutation;
# rollback compares the decoded records before it is allowed to clean up.
network_baseline_id() {
  network_id "$1"
}
network_baseline_members() {
  docker network inspect --format '{{json .Containers}}' "$1" | base64 | tr -d '\n'
}
platform_network_baseline_id="$(network_baseline_id platform-infra_default)" || fail
platform_network_baseline_members="$(network_baseline_members platform-infra_default)" || fail
platform_network_baseline_aliases="${platform_network_baseline_members}"
zeiterfassung_network_baseline_id="$(network_baseline_id zeiterfassung_default)" || fail
zeiterfassung_network_baseline_members="$(network_baseline_members zeiterfassung_default)" || fail
zeiterfassung_network_baseline_aliases="${zeiterfassung_network_baseline_members}"
catering_path_baseline='web:8081;postgres:5432;intake:3101;offer:3102;production:3103;exports:3104'

prior_marker_state=absent
prior_marker_sha256=absent
prior_marker_content_b64=absent
if [[ -e "${activation_marker}" ]]; then
  [[ -f "${activation_marker}" && ! -L "${activation_marker}" ]] || fail
  prior_marker_state="$(sudo sed -n 's/^state=//p' "${activation_marker}")"
  [[ "${prior_marker_state}" == inactive ]] || fail
  prior_marker_sha256="$(sudo sha256sum "${activation_marker}" | awk '{print $1}')"
  sudo cat "${activation_marker}" >"${prior_marker_backup}" || fail
  prior_marker_content_b64="$(base64 <"${prior_marker_backup}" | tr -d '\n')"
fi

# Capture foreign identities before source or network mutation. Every later gate
# compares ID, RestartCount, StartedAt/status, image, Compose labels, exact
# NetworkSettings aliases, and HostConfig.PortBindings byte-for-byte.
foreign_snapshot="$(mktemp)"
register_temp "${foreign_snapshot}"
for container in "${FOREIGN_CONTAINERS[@]}"; do
  docker inspect --format '{{.Id}}|{{.RestartCount}}|{{.State.StartedAt}}|{{.State.Status}}|{{.Image}}|{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.service"}}|{{json .NetworkSettings.Networks}}|{{json .HostConfig.PortBindings}}' "${container}" >>"${foreign_snapshot}" || fail
done
smoke_evidence_file="$(mktemp)"
register_temp "${smoke_evidence_file}"
shared_edge_snapshot="$(mktemp)"
register_temp "${shared_edge_snapshot}"
docker inspect --format '{{.Id}}|{{.RestartCount}}|{{.State.StartedAt}}|{{.State.Status}}|{{.Image}}|{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.service"}}|{{json .HostConfig.PortBindings}}|{{json .Mounts}}|{{json .NetworkSettings.Networks}}' "${SHARED_EDGE}" >"${shared_edge_snapshot}" || fail

assert_foreign_invariants() {
  local check_file shared_check container
  check_file="$(mktemp)"
  register_temp "${check_file}"
  for container in "${FOREIGN_CONTAINERS[@]}"; do
    docker inspect --format '{{.Id}}|{{.RestartCount}}|{{.State.StartedAt}}|{{.State.Status}}|{{.Image}}|{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.service"}}|{{json .NetworkSettings.Networks}}|{{json .HostConfig.PortBindings}}' "${container}" >>"${check_file}" || fail
  done
  cmp -s "${foreign_snapshot}" "${check_file}" || fail
  unlink "${check_file}"
  shared_check="$(mktemp)"
  register_temp "${shared_check}"
  docker inspect --format '{{.Id}}|{{.RestartCount}}|{{.State.StartedAt}}|{{.State.Status}}|{{.Image}}|{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.service"}}|{{json .HostConfig.PortBindings}}|{{json .Mounts}}|{{json .NetworkSettings.Networks}}' "${SHARED_EDGE}" >"${shared_check}" || fail
  python3 - "${shared_edge_snapshot}" "${shared_check}" <<'PYTHON' || fail
import json
import sys

baseline = open(sys.argv[1], encoding='utf-8').read().rstrip('\n').split('|', 9)
current = open(sys.argv[2], encoding='utf-8').read().rstrip('\n').split('|', 9)
if len(baseline) != 10 or len(current) != 10:
    raise SystemExit('shared-edge snapshot shape changed')
for index in range(9):
    if baseline[index] != current[index]:
        raise SystemExit('shared-edge immutable field changed')
baseline_networks = json.loads(baseline[9])
current_networks = json.loads(current[9])
for network in ('catering_ingress', 'catering_private'):
    baseline_networks.pop(network, None)
    current_networks.pop(network, None)
if baseline_networks != current_networks:
    raise SystemExit('shared-edge foreign network membership changed')
PYTHON
  unlink "${shared_check}"
}

# Define the baseline smoke at the same pre-mutation boundary where its
# evidence is captured; the remote script executes stdin incrementally.
smoke_json() {
  local label="$1" target="$2" expected_service="$3" smoke_file
  smoke_file="$(mktemp)"
  register_temp "${smoke_file}"
  docker exec "${SHARED_EDGE}" wget -qO- --timeout=2 "${target}" >"${smoke_file}" || { printf '%s\n' "${label} smoke request failed" >&2; fail; }
  grep -Eq '"status"[[:space:]]*:[[:space:]]*"ok"' "${smoke_file}" || { printf '%s\n' "${label} smoke status is not ok" >&2; fail; }
  if [[ -n "${expected_service}" ]]; then
    grep -Eq "\"service\"[[:space:]]*:[[:space:]]*\"${expected_service}\"" "${smoke_file}" || { printf '%s\n' "${label} smoke service identity is unexpected" >&2; fail; }
  fi
  printf '%s:%s\n' "${label}" "$(sha256sum "${smoke_file}" | awk '{print $1}')" >>"${smoke_evidence_file}"
  smoke_readback_sha256="$(sha256sum "${smoke_evidence_file}" | awk '{print $1}')"
}

run_all_host_semantic_smokes() {
  # The terminal public Catering contract is served by the web identity. The
  # private intake alias is intentionally not a required Edge route after the
  # platform detach; private reachability is proved separately from platform-web.
  smoke_json catering "http://web:8081/api/intake/health" intake-service
  smoke_json zeiterfassung "http://${ZEITERFASSUNG_APP}:${ZEITERFASSUNG_HTTP_PORT}/healthz" ""
  smoke_json eventos "http://${EVENTOS_APP}:${EVENTOS_HTTP_PORT}/health" ""
}

# Bind the complete host semantic baseline to this transaction before the
# immutable manifest exists. The temporary evidence is hash-recorded in that
# manifest; no source, marker, network, or other Phase-3 target mutation is
# permitted until this gate has passed.
run_all_host_semantic_smokes
baseline_smoke_evidence="$(tr '\n' ';' <"${smoke_evidence_file}" | sed 's/;$//')"
baseline_smoke_sha256="$(sha256sum "${smoke_evidence_file}" | awk '{print $1}')"
[[ "${baseline_smoke_sha256}" =~ ^[0-9a-f]{64}$ ]] || fail
[[ "${baseline_smoke_evidence}" =~ ^catering:[0-9a-f]{64}\;zeiterfassung:[0-9a-f]{64}\;eventos:[0-9a-f]{64}$ ]] || fail
smoke_evidence_file="$(mktemp)"
register_temp "${smoke_evidence_file}"
smoke_readback_sha256=pending

manifest_tmp="$(mktemp)"
register_temp "${manifest_tmp}"
printf '%s\n' \
  "schema=${transaction_manifest_schema}" \
  "owner=${owner}" \
  "transaction_id=${transaction_id}" \
  "prior_marker_state=${prior_marker_state}" \
  "prior_marker_sha256=${prior_marker_sha256}" \
  "prior_marker_content_b64=${prior_marker_content_b64}" \
  "platform_source_prior=absent" \
  "edge_source_prior=absent" \
  "catering_ingress_baseline=${ingress_status}" \
  "catering_private_baseline=${private_status}" \
  "catering_ingress_baseline_id=${ingress_baseline_id}" \
  "catering_private_baseline_id=${private_baseline_id}" \
  "catering_ingress_created_by_run_authorized=$([[ "${ingress_status}" == absent ]] && printf true || printf false)" \
  "catering_private_created_by_run_authorized=$([[ "${private_status}" == absent ]] && printf true || printf false)" \
  "network_create_order=catering_ingress,catering_private" \
  "platform_network_baseline_id=${platform_network_baseline_id}" \
  "platform_network_baseline_members=${platform_network_baseline_members}" \
  "platform_network_baseline_aliases=${platform_network_baseline_aliases}" \
  "zeiterfassung_network_baseline_id=${zeiterfassung_network_baseline_id}" \
  "zeiterfassung_network_baseline_members=${zeiterfassung_network_baseline_members}" \
  "zeiterfassung_network_baseline_aliases=${zeiterfassung_network_baseline_aliases}" \
  "catering_path_baseline=${catering_path_baseline}" \
  "expected_platform_source_sha256=${expected_platform_source_sha256}" \
  "expected_edge_source_sha256=${expected_edge_source_sha256}" \
  "baseline_smoke_evidence=${baseline_smoke_evidence}" \
  "baseline_smoke_sha256=${baseline_smoke_sha256}" \
  "container_id=${SHARED_EDGE}:$(docker inspect --format '{{.Id}}' "${SHARED_EDGE}")" \
  "RestartCount=${SHARED_EDGE}:$(docker inspect --format '{{.RestartCount}}' "${SHARED_EDGE}")" \
  "NetworkSettings=${SHARED_EDGE}:$(docker inspect --format '{{json .NetworkSettings.Networks}}' "${SHARED_EDGE}")" \
  "Aliases=${SHARED_EDGE}:$(docker inspect --format '{{json .NetworkSettings.Networks}}' "${SHARED_EDGE}")" \
  "PortBindings=${SHARED_EDGE}:$(docker inspect --format '{{json .HostConfig.PortBindings}}' "${SHARED_EDGE}")" \
  "Mounts=${SHARED_EDGE}:$(docker inspect --format '{{json .Mounts}}' "${SHARED_EDGE}")" \
  "secret_ref=${SHARED_EDGE}:$(docker inspect --format '{{range .Config.Secrets}}{{.Name}};{{end}}' "${SHARED_EDGE}")" \
  "network_driver=catering_ingress:bridge;catering_private:bridge" \
  "network_scope=catering_ingress:local;catering_private:local" \
  "network_internal=catering_ingress:false;catering_private:false" \
  "network_ipam=catering_ingress:default;catering_private:default" \
  "network_enable_ipv6=catering_ingress:false;catering_private:false" \
  "network_ipam_options=catering_ingress:{};catering_private:{}" \
  "network_ipam_config=catering_ingress:[];catering_private:[]" \
  "network_labels=owner=${owner};phase=${schema};transaction=${transaction_id}" \
  "catering_ingress_network_labels=${ingress_network_labels}" \
  "catering_private_network_labels=${private_network_labels}" \
  "catering_ingress_baseline_members=${ingress_baseline_members}" \
  "catering_ingress_baseline_aliases=${ingress_baseline_aliases}" \
  "catering_private_baseline_members=${private_baseline_members}" \
  "catering_private_baseline_aliases=${private_baseline_aliases}" \
  "network_members=catering_ingress:${SHARED_EDGE},${PLATFORM_WEB};catering_private:${PLATFORM_WEB},${PLATFORM_POSTGRES},${PLATFORM_INTAKE},${PLATFORM_OFFER},${PLATFORM_PRODUCTION},${PLATFORM_EXPORTS}" \
  "network_aliases=catering_ingress:${SHARED_EDGE}=edge|shared-edge-edge-1;${PLATFORM_WEB}=web" \
  "manifest_sha256=absent" \
  "marker_sha256=absent" \
  "archive_sha256=absent" \
  "receipt_sha256=absent" \
  "foreign_invariants_sha256=$(sha256sum "${foreign_snapshot}" | awk '{print $1}')" \
  >"${manifest_tmp}"
for container in "${MANAGED_CONTAINERS[@]}" "${FOREIGN_CONTAINERS[@]}"; do
  printf '%s\n' \
    "container_id_${container}=$(docker inspect --format '{{.Id}}' "${container}")" \
    "RestartCount_${container}=$(docker inspect --format '{{.RestartCount}}' "${container}")" \
    "StartedAt_${container}=$(docker inspect --format '{{.State.StartedAt}}' "${container}")" \
    "Status_${container}=$(docker inspect --format '{{.State.Status}}' "${container}")" \
    "Image_${container}=$(docker inspect --format '{{.Image}}' "${container}")" \
    "ComposeProject_${container}=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "${container}")" \
    "ComposeService_${container}=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.service"}}' "${container}")" \
    "NetworkSettings_${container}=$(docker inspect --format '{{json .NetworkSettings.Networks}}' "${container}")" \
    "Aliases_${container}=$(docker inspect --format '{{json .NetworkSettings.Networks}}' "${container}")" \
    "PortBindings_${container}=$(docker inspect --format '{{json .HostConfig.PortBindings}}' "${container}")" \
    "Mounts_${container}=$(docker inspect --format '{{json .Mounts}}' "${container}")" \
    "secret_ref_${container}=$(docker inspect --format '{{range .Config.Secrets}}{{.Name}};{{end}}' "${container}")" \
    >>"${manifest_tmp}" || fail
done
[[ ! -e "${baseline_manifest}" ]] || fail
atomic_record "${baseline_manifest}" "${manifest_tmp}"
transaction_manifest_sha256="$(sudo sha256sum "${baseline_manifest}" | awk '{print $1}')"
validate_manifest_fields() {
  local line key seen=""
  while IFS= read -r line || [[ -n "${line}" ]]; do
    [[ "${line}" != *$'\r'* && "${line}" == *=* ]] || fail
    key="${line%%=*}"
    [[ "${key}" =~ ^[A-Za-z][A-Za-z0-9_-]*$ ]] || fail
    case " ${seen} " in *" ${key} "*) fail ;; esac
    seen="${seen} ${key}"
    case "${key}" in
      schema|owner|transaction_id|prior_marker_state|prior_marker_sha256|prior_marker_content_b64|platform_source_prior|edge_source_prior|catering_ingress_baseline|catering_private_baseline|catering_ingress_baseline_id|catering_private_baseline_id|catering_ingress_created_by_run_authorized|catering_private_created_by_run_authorized|network_create_order|platform_network_baseline_id|platform_network_baseline_members|platform_network_baseline_aliases|zeiterfassung_network_baseline_id|zeiterfassung_network_baseline_members|zeiterfassung_network_baseline_aliases|catering_path_baseline|expected_platform_source_sha256|expected_edge_source_sha256|baseline_smoke_evidence|baseline_smoke_sha256|container_id|RestartCount|StartedAt|Status|Image|ComposeProject|ComposeService|NetworkSettings|Aliases|PortBindings|Mounts|secret_ref|network_driver|network_scope|network_internal|network_ipam|network_enable_ipv6|network_ipam_options|network_ipam_config|network_labels|catering_ingress_network_labels|catering_private_network_labels|catering_ingress_baseline_members|catering_ingress_baseline_aliases|catering_private_baseline_members|catering_private_baseline_aliases|network_members|network_aliases|manifest_sha256|marker_sha256|archive_sha256|receipt_sha256|foreign_invariants_sha256|container_id_*|RestartCount_*|StartedAt_*|Status_*|Image_*|ComposeProject_*|ComposeService_*|NetworkSettings_*|Aliases_*|PortBindings_*|Mounts_*|secret_ref_*) ;;
      *) fail ;;
    esac
  done <"${baseline_manifest}"
  if grep -Eiq 'secret[^=]*(value|password|token)=' "${baseline_manifest}"; then fail; fi
}
manifest_field() { sed -n "s/^$1=//p" "${baseline_manifest}" | tail -n 1; }

manifest_network_labels_for() {
  local network="$1" created_by_run="$2" value
  value="$(manifest_field "${network}_network_labels")"
  if [[ -n "${value}" ]]; then
    printf '%s' "${value}"
    return 0
  fi
  value="owner=${owner};phase=${schema};kind=${network#catering_}"
  [[ "${created_by_run}" == true ]] && value+=";transaction=${transaction_id}"
  printf '%s' "${value}"
}

validate_manifest() {
  local required smoke_evidence_hash
  [[ -f "${baseline_manifest}" && ! -L "${baseline_manifest}" ]] || fail
  validate_manifest_fields
  [[ "$(manifest_field schema)" == "${transaction_manifest_schema}" ]] || fail
  [[ "$(sudo sha256sum "${baseline_manifest}" | awk '{print $1}')" == "${transaction_manifest_sha256}" ]] || fail
  for required in container_id RestartCount NetworkSettings Aliases PortBindings Mounts secret_ref \
    network_driver network_scope network_internal network_ipam network_labels network_members network_aliases \
    platform_network_baseline_id platform_network_baseline_members platform_network_baseline_aliases \
    zeiterfassung_network_baseline_id zeiterfassung_network_baseline_members zeiterfassung_network_baseline_aliases \
    catering_path_baseline baseline_smoke_evidence baseline_smoke_sha256; do
    grep -Eq "^${required}=" "${baseline_manifest}" || fail
  done
  if [[ "$(manifest_field schema)" == "${transaction_manifest_schema}" ]]; then
    for required in network_enable_ipv6 network_ipam_options network_ipam_config \
      catering_ingress_network_labels catering_private_network_labels \
      catering_ingress_baseline_members catering_ingress_baseline_aliases \
      catering_private_baseline_members catering_private_baseline_aliases; do
      grep -Eq "^${required}=" "${baseline_manifest}" || fail
    done
  fi
  [[ "$(manifest_field baseline_smoke_sha256)" =~ ^[0-9a-f]{64}$ ]] || fail
  [[ "$(manifest_field baseline_smoke_evidence)" =~ ^catering:[0-9a-f]{64}\;zeiterfassung:[0-9a-f]{64}\;eventos:[0-9a-f]{64}$ ]] || fail
  smoke_evidence_hash="$(printf '%s\n' "$(manifest_field baseline_smoke_evidence | tr ';' '\n')" | sha256sum | awk '{print $1}')"
  [[ "${smoke_evidence_hash}" == "$(manifest_field baseline_smoke_sha256)" ]] || fail
  if grep -Eiq 'secret[^=]*(value|password|token)=' "${baseline_manifest}"; then fail; fi
}
validate_manifest

assert_compatibility_baseline() {
  local network="$1" id_field="$2" members_field="$3" aliases_field="$4"
  local expected_id expected_members expected_aliases actual_id actual_members
  expected_id="$(manifest_field "${id_field}")"
  expected_members="$(manifest_field "${members_field}")"
  expected_aliases="$(manifest_field "${aliases_field}")"
  actual_id="$(network_id "${network}")" || return 1
  actual_members="$(docker network inspect --format '{{json .Containers}}' "${network}")" || return 1
  [[ "${actual_id}" == "${expected_id}" ]] || return 1
  [[ "${expected_members}" == "${expected_aliases}" ]] || return 1
  python3 - "${expected_members}" "${actual_members}" <<'PYTHON'
import base64
import json
import sys

expected = json.loads(base64.b64decode(sys.argv[1]).decode())
actual = json.loads(sys.argv[2])
def canonical(value):
    return {
        key: {
            "Name": item.get("Name", ""),
            "Aliases": sorted(item.get("Aliases", [])),
        }
        for key, item in value.items()
    }
if canonical(expected) != canonical(actual):
    raise SystemExit("compatibility network membership or aliases changed")
PYTHON
}

assert_marker_readback() {
  local marker_hash
  [[ -f "${activation_marker}" && ! -L "${activation_marker}" ]] || fail
  grep -Fxq "owner=${owner}" "${activation_marker}" || fail
  grep -Fxq "transaction_id=${transaction_id}" "${activation_marker}" || fail
  grep -Fxq "transaction_manifest_path=${baseline_manifest}" "${activation_marker}" || fail
  grep -Fxq "transaction_manifest_sha256=${transaction_manifest_sha256}" "${activation_marker}" || fail
  grep -Fxq "catering_ingress_id=${ingress_id}" "${activation_marker}" || fail
  grep -Fxq "catering_private_id=${private_id}" "${activation_marker}" || fail
  grep -Eq '^stage=(S[0-4]|D[1-6]|RB)$' "${activation_marker}" || fail
  grep -Eq '^foreign_invariants_sha256=[0-9a-f]{64}$' "${activation_marker}" || fail
  grep -Eq '^adoption_count=[01]$' "${activation_marker}" || fail
  grep -Eq '^adoption_proof=.+$' "${activation_marker}" || fail
  marker_hash="$(canonical_marker_sha256 "${activation_marker}")"
  grep -Fxq "marker_sha256=${marker_hash}" "${activation_marker}" || fail
}

canonical_marker_sha256() {
  local file="$1" canonical
  canonical="${file}.canonical.$$"
  sed -E 's/^marker_sha256=.*/marker_sha256=absent/' "${file}" >"${canonical}"
  sha256sum "${canonical}" | awk '{print $1}'
  unlink "${canonical}"
}

canonical_archive_sha256() {
  local file="$1" canonical
  canonical="${file}.canonical.$$"
  sed -E 's/^archive_sha256=.*/archive_sha256=absent/' "${file}" >"${canonical}"
  sha256sum "${canonical}" | awk '{print $1}'
  unlink "${canonical}"
}

write_marker() {
  local state="$1" platform_progress="$2" edge_progress="$3" ingress_id="$4" private_id="$5" marker_tmp marker_hash marker_final
  if [[ -f "${platform_source}" && ! -L "${platform_source}" && -f "${edge_source}" && ! -L "${edge_source}" ]]; then
    source_readback_sha256="$(printf '%s\n' "platform=$(sudo sha256sum "${platform_source}" | awk '{print $1}')" "edge=$(sudo sha256sum "${edge_source}" | awk '{print $1}')" | sha256sum | awk '{print $1}')"
  else
    source_readback_sha256=pending
  fi
  if [[ -s "${smoke_evidence_file}" ]]; then
    smoke_readback_sha256="$(sudo sha256sum "${smoke_evidence_file}" | awk '{print $1}')"
  else
    smoke_readback_sha256=pending
  fi
  marker_tmp="$(mktemp)"
  register_temp "${marker_tmp}"
  printf '%s\n' \
    "schema=${schema}" \
    "state=${state}" \
    "owner=${owner}" \
    "transaction_id=${transaction_id}" \
    "transaction_manifest_path=${baseline_manifest}" \
    "transaction_manifest_sha256=${transaction_manifest_sha256}" \
    "manifest_sha256=${transaction_manifest_sha256}" \
    "marker_sha256=absent" \
    "prior_marker_state=${prior_marker_state}" \
    "prior_marker_sha256=${prior_marker_sha256}" \
    "expected_platform_source_sha256=${expected_platform_source_sha256}" \
    "expected_edge_source_sha256=${expected_edge_source_sha256}" \
    "platform_override_sha256=${expected_platform_source_sha256}" \
    "edge_override_sha256=${expected_edge_source_sha256}" \
    "baseline_network_status=catering_ingress=${ingress_status};catering_private=${private_status}" \
    "catering_ingress_id=${ingress_id}" \
    "catering_private_id=${private_id}" \
    "platform_source_progress=${platform_progress}" \
    "edge_source_progress=${edge_progress}" \
    "stage=${pilot_stage}" \
    "foreign_invariants_sha256=$(sudo sha256sum "${foreign_snapshot}" | awk '{print $1}')" \
    "smoke_readback_sha256=${smoke_readback_sha256}" \
    "source_readback_sha256=${source_readback_sha256}" \
    "adoption_count=${adoption_count}" \
    "adoption_proof=${adoption_proof}" \
    "egress_requested=${egress_exercise}" \
    "egress_url_b64=$(if [[ "${egress_exercise}" == 1 ]]; then printf '%s' "${egress_url}" | base64 | tr -d '\n'; else printf absent; fi)" \
    "archive_sha256=$(if [[ -f "${restore_proof_archive}" ]]; then sudo sha256sum "${restore_proof_archive}" | awk '{print $1}'; else printf pending; fi)" \
    "receipt_sha256=$(if [[ -f "${completion_receipt}" ]]; then sudo sha256sum "${completion_receipt}" | awk '{print $1}'; else printf pending; fi)" \
    "egress=${egress:-not_exercised}" \
    >"${marker_tmp}"
  marker_hash="$(canonical_marker_sha256 "${marker_tmp}")"
  marker_final="${marker_tmp}.final"
  sed "s/^marker_sha256=absent$/marker_sha256=${marker_hash}/" "${marker_tmp}" >"${marker_final}"
  atomic_record "${activation_marker}" "${marker_final}"
  unlink "${marker_final}"
  assert_marker_readback
}

restore_field_normal() { sed -n "s/^$2=//p" "$1" | tail -n 1; }

write_restore_evidence_normal() {
  local target_tmp evidence_tmp network target shared_baseline_hash shared_restore_hash smoke_hash
  target_tmp="$(mktemp)"
  register_temp "${target_tmp}"
  for network in catering_ingress catering_private; do
    if docker network inspect "${network}" >/dev/null 2>&1; then
      target="present:$(network_id "${network}")" || return 1
    else
      target=absent
    fi
    printf '%s_target=%s\n' "${network}" "${target}" >>"${target_tmp}"
  done
  [[ "${ingress_status}" != absent || "$(restore_field_normal "${target_tmp}" catering_ingress_target)" == absent ]] || return 1
  [[ "${private_status}" != absent || "$(restore_field_normal "${target_tmp}" catering_private_target)" == absent ]] || return 1
  shared_baseline_hash="$(sha256sum "${shared_edge_snapshot}" | awk '{print $1}')"
  shared_restore_hash="$(sha256sum "${shared_edge_restore}" | awk '{print $1}')"
  smoke_hash="$(sha256sum "${smoke_evidence_file}" | awk '{print $1}')"
  evidence_tmp="$(mktemp)"
  register_temp "${evidence_tmp}"
  printf '%s\n' \
    "schema=phase3.1.restore-evidence" \
    "owner=${owner}" \
    "transaction_id=${transaction_id}" \
    "baseline_manifest_sha256=${transaction_manifest_sha256}" \
    "foreign_invariants_sha256=$(sha256sum "${foreign_restore}" | awk '{print $1}')" \
    "shared_edge_baseline_sha256=${shared_baseline_hash}" \
    "shared_edge_restore_sha256=${shared_restore_hash}" \
    "platform_source_expected_sha256=${expected_platform_source_sha256}" \
    "edge_source_expected_sha256=${expected_edge_source_sha256}" \
    "platform_source_readback=absent" \
    "edge_source_readback=absent" \
    "platform_network_baseline_id=$(manifest_field platform_network_baseline_id)" \
    "platform_network_baseline_members=$(manifest_field platform_network_baseline_members)" \
    "platform_network_baseline_aliases=$(manifest_field platform_network_baseline_aliases)" \
    "zeiterfassung_network_baseline_id=$(manifest_field zeiterfassung_network_baseline_id)" \
    "zeiterfassung_network_baseline_members=$(manifest_field zeiterfassung_network_baseline_members)" \
    "zeiterfassung_network_baseline_aliases=$(manifest_field zeiterfassung_network_baseline_aliases)" \
    "catering_path_baseline=$(manifest_field catering_path_baseline)" \
    "smoke_readback_sha256=${smoke_hash}" \
    "$(cat "${target_tmp}")" >"${evidence_tmp}"
  atomic_record "${restore_evidence_record}" "${evidence_tmp}" || return 1
  restore_evidence_sha256="$(sudo sha256sum "${restore_evidence_record}" | awk '{print $1}')"
  validate_restore_evidence_normal || return 1
}

validate_restore_evidence_normal() {
  local network created actual_target expected_target shared_hash
  [[ -f "${restore_evidence_record}" && ! -L "${restore_evidence_record}" ]] || return 1
  [[ "$(restore_field_normal "${restore_evidence_record}" schema)" == phase3.1.restore-evidence ]] || return 1
  [[ "$(restore_field_normal "${restore_evidence_record}" owner)" == "${owner}" ]] || return 1
  [[ "$(restore_field_normal "${restore_evidence_record}" transaction_id)" == "${transaction_id}" ]] || return 1
  [[ "$(restore_field_normal "${restore_evidence_record}" baseline_manifest_sha256)" == "${transaction_manifest_sha256}" ]] || return 1
  [[ "$(restore_field_normal "${restore_evidence_record}" foreign_invariants_sha256)" == "$(manifest_field foreign_invariants_sha256)" ]] || return 1
  [[ "$(restore_field_normal "${restore_evidence_record}" platform_source_readback)" == absent && "$(restore_field_normal "${restore_evidence_record}" edge_source_readback)" == absent ]] || return 1
  [[ -n "$(restore_field_normal "${restore_evidence_record}" smoke_readback_sha256)" ]] || return 1
  for network in catering_ingress catering_private; do
    created="$(manifest_field "${network}_created_by_run_authorized")"
    if docker network inspect "${network}" >/dev/null 2>&1; then
      actual_target="present:$(network_id "${network}")" || return 1
    else
      actual_target=absent
    fi
    expected_target="$(restore_field_normal "${restore_evidence_record}" "${network}_target")"
    [[ "${actual_target}" == "${expected_target}" ]] || return 1
    [[ "${created}" != true || "${actual_target}" == absent ]] || return 1
  done
  [[ ! -e "${platform_source}" && ! -e "${edge_source}" ]] || return 1
  assert_compatibility_baseline platform-infra_default platform_network_baseline_id platform_network_baseline_members platform_network_baseline_aliases || return 1
  assert_compatibility_baseline zeiterfassung_default zeiterfassung_network_baseline_id zeiterfassung_network_baseline_members zeiterfassung_network_baseline_aliases || return 1
  assert_foreign_invariants || return 1
  cmp -s "${shared_edge_snapshot}" "${shared_edge_restore}" || return 1
  shared_hash="$(sha256sum "${shared_edge_restore}" | awk '{print $1}')"
  [[ "$(restore_field_normal "${restore_evidence_record}" shared_edge_restore_sha256)" == "${shared_hash}" ]] || return 1
}

validate_completion_receipt_normal() {
  local archive_hash receipt_hash evidence_hash
  validate_restore_evidence_normal || return 1
  evidence_hash="$(sudo sha256sum "${restore_evidence_record}" | awk '{print $1}')"
  archive_hash="$(canonical_archive_sha256 "${restore_proof_archive}")"
  [[ "${archive_hash}" =~ ^[0-9a-f]{64}$ ]] || return 1
  [[ "$(restore_field_normal "${restore_proof_archive}" archive_sha256)" == "${archive_hash}" ]] || return 1
  [[ "$(restore_field_normal "${restore_proof_archive}" restore_evidence_path)" == "${restore_evidence_record}" ]] || return 1
  [[ "$(restore_field_normal "${restore_proof_archive}" restore_evidence_sha256)" == "${evidence_hash}" ]] || return 1
  [[ "$(restore_field_normal "${completion_receipt}" restore_evidence_path)" == "${restore_evidence_record}" ]] || return 1
  [[ "$(restore_field_normal "${completion_receipt}" restore_evidence_sha256)" == "${evidence_hash}" ]] || return 1
  [[ "$(restore_field_normal "${completion_receipt}" restore_proof_archive_sha256)" == "${archive_hash}" ]] || return 1
  [[ "$(restore_field_normal "${completion_receipt}" archive_sha256)" == "${archive_hash}" ]] || return 1
  receipt_hash="$(sed -E 's/^receipt_sha256=.*/receipt_sha256=absent/' "${completion_receipt}" | sha256sum | awk '{print $1}')"
  [[ "$(restore_field_normal "${completion_receipt}" receipt_sha256)" == "${receipt_hash}" ]] || return 1
}

run_rollback_host_semantic_smokes() {
  # smoke_json uses the terminal fail() exit contract. Run the complete set in
  # a child shell so rollback can convert any smoke failure into recovery
  # without skipping its caller's authenticated cleanup decision.
  if (run_all_host_semantic_smokes); then
    smoke_readback_sha256="$(sudo sha256sum "${smoke_evidence_file}" | awk '{print $1}')"
    return 0
  fi
  return 1
}

rollback_transaction() {
  # Rollback is deliberately owner-scoped and only runs after a durable
  # candidate marker exists. Any uncertain readback leaves rolling_back plus
  # the immutable manifest for an authenticated resume; it never broad-cleans.
  set +e
  local ingress_id_value="${ingress_id:-absent}"
  local private_id_value="${private_id:-absent}"
  pilot_stage=RB
  write_marker rolling_back pending pending "${ingress_id_value}" "${private_id_value}" || return 1

  # Restore the exact old Catering memberships before removing pilot links.
  connect_if_missing() {
    local network="$1" alias="$2" container="$3" networks
    networks="$(docker inspect --format '{{json .NetworkSettings.Networks}}' "${container}")" || return 1
    [[ "${networks}" == *"\"${network}\""* ]] || docker network connect --alias "${alias}" "${network}" "${container}" || return 1
  }
  disconnect_if_attached() {
    local network="$1" container="$2" networks
    docker network inspect "${network}" >/dev/null 2>&1 || return 0
    networks="$(docker inspect --format '{{json .NetworkSettings.Networks}}' "${container}")" || return 1
    if [[ "${networks}" == *"\"${network}\""* ]]; then
      docker network disconnect "${network}" "${container}" || return 1
    fi
  }
  connect_if_missing platform-infra_default postgres platform-infra-postgres-1 || return 1
  connect_if_missing platform-infra_default intake platform-infra-intake-1 || return 1
  connect_if_missing platform-infra_default offer platform-infra-offer-1 || return 1
  connect_if_missing platform-infra_default production platform-infra-production-1 || return 1
  connect_if_missing platform-infra_default exports platform-infra-exports-1 || return 1
  connect_if_missing zeiterfassung_default web platform-infra-web-1 || return 1
  connect_if_missing platform-infra_default web platform-infra-web-1 || return 1

  # Remove only the pilot-owned memberships; foreign containers are never
  # addressed. A failed disconnect is uncertainty and stops the transaction.
  disconnect_if_attached catering_private platform-infra-postgres-1 || return 1
  disconnect_if_attached catering_private platform-infra-intake-1 || return 1
  disconnect_if_attached catering_private platform-infra-offer-1 || return 1
  disconnect_if_attached catering_private platform-infra-production-1 || return 1
  disconnect_if_attached catering_private platform-infra-exports-1 || return 1
  disconnect_if_attached catering_private platform-infra-web-1 || return 1
  disconnect_if_attached catering_ingress platform-infra-web-1 || return 1
  disconnect_if_attached catering_ingress shared-edge-edge-1 || return 1

  # Verify every Phase-2 compatibility membership and alias before any target
  # network or source cleanup. Compatibility networks are never broad-deleted.
  assert_compatibility_baseline platform-infra_default platform_network_baseline_id platform_network_baseline_members platform_network_baseline_aliases || return 1
  assert_compatibility_baseline zeiterfassung_default zeiterfassung_network_baseline_id zeiterfassung_network_baseline_members zeiterfassung_network_baseline_aliases || return 1

  # Restore only protected sources whose previous state was absent. A
  # pre-existing source is intentionally not guessed or overwritten.
  [[ "${prior_marker_state}" == absent || "${prior_marker_state}" == inactive ]] || return 1
  if [[ -e "${platform_source}" ]]; then
    [[ "$(sudo sha256sum "${platform_source}" | awk '{print $1}')" == "${expected_platform_source_sha256}" ]] || return 1
    sudo unlink "${platform_source}" || return 1
  fi
  if [[ -e "${edge_source}" ]]; then
    [[ "$(sudo sha256sum "${edge_source}" | awk '{print $1}')" == "${expected_edge_source_sha256}" ]] || return 1
    sudo unlink "${edge_source}" || return 1
  fi

  # Remove only networks created by this transaction after proving exact
  # owner/phase/transaction labels and an empty membership set.
  remove_owned_network() {
    local network="$1" expected_kind="$2" created="$3"
    [[ "${created}" == absent ]] || return 0
    local id owner_label phase_label transaction_label members kind
    if ! id="$(network_id "${network}")"; then
      [[ "${created}" == absent ]] && return 0
      return 1
    fi
    owner_label="$(docker network inspect --format '{{index .Labels "com.catering.owner"}}' "${id}")" || return 1
    phase_label="$(docker network inspect --format '{{index .Labels "com.catering.phase"}}' "${id}")" || return 1
    transaction_label="$(docker network inspect --format '{{index .Labels "com.catering.transaction"}}' "${id}")" || return 1
    kind="$(docker network inspect --format '{{index .Labels "com.catering.kind"}}' "${id}")" || return 1
    members="$(docker network inspect --format '{{len .Containers}}' "${id}")" || return 1
    [[ "${owner_label}" == "${owner}" && "${phase_label}" == "${schema}" && "${transaction_label}" == "${transaction_id}" && "${kind}" == "${expected_kind}" && "${members}" == 0 ]] || return 1
    docker network rm "${network}" >/dev/null || return 1
  }
  remove_owned_network catering_private private "${private_status}" || return 1
  remove_owned_network catering_ingress ingress "${ingress_status}" || return 1

  foreign_restore="$(mktemp)"
  register_temp "${foreign_restore}"
  for container in "${FOREIGN_CONTAINERS[@]}"; do
    docker inspect --format '{{.Id}}|{{.RestartCount}}|{{.State.StartedAt}}|{{.State.Status}}|{{.Image}}|{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.service"}}|{{json .NetworkSettings.Networks}}|{{json .HostConfig.PortBindings}}' "${container}" >>"${foreign_restore}" || return 1
  done
  cmp -s "${foreign_snapshot}" "${foreign_restore}" || return 1
  shared_edge_restore="$(mktemp)"
  register_temp "${shared_edge_restore}"
  docker inspect --format '{{.Id}}|{{.RestartCount}}|{{.State.StartedAt}}|{{.State.Status}}|{{.Image}}|{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.service"}}|{{json .HostConfig.PortBindings}}|{{json .Mounts}}|{{json .NetworkSettings.Networks}}' "${SHARED_EDGE}" >"${shared_edge_restore}" || return 1
  cmp -s "${shared_edge_snapshot}" "${shared_edge_restore}" || return 1

  # Fresh post-restore host smokes are part of the rollback proof. A failed
  # smoke leaves recovery active and prevents evidence, archive, receipt, and
  # cleanup from being written.
  run_rollback_host_semantic_smokes || return 1

  [[ ! -e "${restore_proof_archive}" && ! -e "${completion_receipt}" ]] || return 1
  write_restore_evidence_normal || return 1
  restore_evidence_sha256="$(sudo sha256sum "${restore_evidence_record}" | awk '{print $1}')"
  marker_sha256="$(canonical_marker_sha256 "${activation_marker}")"
  proof_tmp="$(mktemp)"
  register_temp "${proof_tmp}"
  register_temp "${proof_tmp}.final"
  printf '%s\n' \
    "schema=phase3.1.rollback-restore-proof" \
    "transaction_id=${transaction_id}" \
    "transaction_manifest_path=${baseline_manifest}" \
    "transaction_manifest_sha256=${transaction_manifest_sha256}" \
    "marker_sha256=${marker_sha256}" \
    "prior_marker_state=${prior_marker_state}" \
    "prior_marker_sha256=${prior_marker_sha256}" \
    "restore_evidence_path=${restore_evidence_record}" \
    "restore_evidence_sha256=${restore_evidence_sha256}" \
    "restore_proof_archive_path=${restore_proof_archive}" \
    "archive_sha256=absent" \
    >"${proof_tmp}"
  restore_proof_archive_sha256="$(canonical_archive_sha256 "${proof_tmp}")"
  sed "s/^archive_sha256=absent$/archive_sha256=${restore_proof_archive_sha256}/" "${proof_tmp}" >"${proof_tmp}.final"
  atomic_record "${restore_proof_archive}" "${proof_tmp}.final" || return 1
  [[ "$(canonical_archive_sha256 "${restore_proof_archive}")" == "${restore_proof_archive_sha256}" ]] || return 1
  receipt_tmp="$(mktemp)"
  register_temp "${receipt_tmp}"
  printf '%s\n' \
    "schema=phase3.1.rollback-completion" \
    "transaction_id=${transaction_id}" \
    "transaction_manifest_path=${baseline_manifest}" \
    "transaction_manifest_sha256=${transaction_manifest_sha256}" \
    "marker_sha256=${marker_sha256}" \
    "prior_marker_state=${prior_marker_state}" \
    "prior_marker_sha256=${prior_marker_sha256}" \
    "restore_evidence_path=${restore_evidence_record}" \
    "restore_evidence_sha256=${restore_evidence_sha256}" \
    "restore_proof_archive_path=${restore_proof_archive}" \
    "restore_proof_archive_sha256=${restore_proof_archive_sha256}" \
    "archive_sha256=${restore_proof_archive_sha256}" \
    "receipt_sha256=absent" \
    >"${receipt_tmp}"
  receipt_hash="$(sed -E 's/^receipt_sha256=.*/receipt_sha256=absent/' "${receipt_tmp}" | sha256sum | awk '{print $1}')"
  sed "s/^receipt_sha256=absent$/receipt_sha256=${receipt_hash}/" "${receipt_tmp}" >"${receipt_tmp}.final"
  mv -f "${receipt_tmp}.final" "${receipt_tmp}"
  atomic_record "${completion_receipt}" "${receipt_tmp}" || return 1
  [[ -f "${completion_receipt}" && ! -L "${completion_receipt}" ]] || return 1
  grep -Fxq "transaction_id=${transaction_id}" "${completion_receipt}" || return 1
  grep -Fxq "transaction_manifest_sha256=${transaction_manifest_sha256}" "${completion_receipt}" || return 1
  grep -Fxq "marker_sha256=${marker_sha256}" "${completion_receipt}" || return 1
  validate_completion_receipt_normal || return 1

  if [[ "${prior_marker_state}" == absent ]]; then
    sudo unlink "${activation_marker}" 2>/dev/null || true
    [[ ! -e "${activation_marker}" ]] || return 1
  else
    atomic_record "${activation_marker}" "${prior_marker_backup}" || return 1
    cmp -s "${prior_marker_backup}" "${activation_marker}" || return 1
  fi
  sudo unlink "${baseline_manifest}" || return 1
  [[ ! -e "${baseline_manifest}" ]] || return 1
  sudo unlink "${completion_receipt}" || return 1
  [[ ! -e "${completion_receipt}" ]] || return 1
  rollback_complete=true
  return 0
}

write_marker candidate pending pending absent absent
candidate_written=true
printf '%s\n' "PILOT: GO CANDIDATE"
atomic_install "${platform_stage}" "${platform_source}" "${expected_platform_source_sha256}"
assert_foreign_invariants
pilot_stage=S1
write_marker candidate verified pending absent absent
atomic_install "${edge_stage}" "${edge_source}" "${expected_edge_source_sha256}"
assert_foreign_invariants
pilot_stage=S2
write_marker candidate verified verified absent absent

# The active chain is rendered only after both protected copies have passed
# their candidate-bound readback/hash gates.
docker compose -p platform-infra --env-file "${platform_dir}/.env" \
  -f "${platform_dir}/docker-compose.yml" \
  -f "${platform_dir}/docker-compose.production.yml" \
  -f "${platform_dir}/docker-compose.edge-cutover.yml" \
  -f "${platform_source}" config >/dev/null
docker compose -p shared-edge --env-file "${edge_dir}/.env" \
  -f "${edge_dir}/docker-compose.yml" \
  -f "${edge_source}" config >/dev/null

create_or_verify_network() {
  local network="$1" kind="$2" baseline="$3" id created_by_run=true
  write_adoption_journal_intent "${network}"
  if [[ "${baseline}" == absent ]]; then
    docker network create --driver bridge --internal=false --ipam-driver default \
      --label "com.catering.owner=${owner}" \
      --label "com.catering.phase=phase3.1" \
      --label "com.catering.kind=${kind}" \
      --label "com.catering.transaction=${transaction_id}" \
      "${network}" >/dev/null
  else
    created_by_run=false
  fi
  id="$(network_id "${network}")"
  [[ -n "${id}" ]] || fail
  validate_post_create_adoption "${network}" "${kind}" "${created_by_run}"
  write_adoption_journal "${network}" "${id}"
  # The adapter's crash boundary is after the durable journal readback and
  # before the legacy activation-marker write below.
  docker network inspect --format '{{.Id}}' "${network}" >/dev/null
  assert_foreign_invariants
  printf '%s' "${id}"
}

ingress_id="$(create_or_verify_network catering_ingress ingress "${ingress_status}")"
pilot_stage=S3
write_marker candidate verified verified "${ingress_id}" absent
private_id="$(create_or_verify_network catering_private private "${private_status}")"
write_marker candidate verified verified "${ingress_id}" "${private_id}"

# Each network mutation is surrounded by the full evidence set. This makes a
# foreign restart, alias drift, public semantic regression, or private-route
# leak fail before the next mutation can compound it.
assert_private_reachability() {
  docker exec "${PLATFORM_WEB}" wget -qO- --timeout=2 "http://intake:${CATERING_INTAKE_PORT}/health" >/dev/null || fail
  if docker exec "${PLATFORM_WEB}" sh -c 'wget -qO- --timeout=2 http://postgres:5432/' >/dev/null 2>&1; then
    fail
  fi
}

probe_provider_egress() {
  egress="not_exercised"
  [[ "$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "${PLATFORM_PRODUCTION}")" == platform-infra ]] || fail
  [[ "$(docker inspect --format '{{index .Config.Labels "com.docker.compose.service"}}' "${PLATFORM_PRODUCTION}")" == production ]] || fail
  production_networks="$(docker inspect --format '{{json .NetworkSettings.Networks}}' "${PLATFORM_PRODUCTION}")" || fail
  [[ "${production_networks}" == *'"catering_private"'* && "${production_networks}" != *'"platform-infra_default"'* ]] || fail
  egress_provider="$(docker exec "${PLATFORM_PRODUCTION}" sh -c 'value="$(printenv CATERING_ENABLE_WEB_RECIPE_SEARCH 2>/dev/null || true)"; if [ -n "${value}" ]; then printf "%s" "${value}"; else printf "%s" "__absent__"; fi')" || fail
  egress_provider="$(printf '%s' "${egress_provider}" | tr '[:upper:]' '[:lower:]')"
  case "${egress_provider}" in
    0|false)
      egress="not_exercised"
      ;;
    1|true)
      [[ "${egress_exercise}" == 1 && "${egress_url}" == https://* ]] || fail
      egress_body="$(mktemp)"
      register_temp "${egress_body}"
      docker exec "${PLATFORM_PRODUCTION}" wget -qO- --timeout=10 "${egress_url}" >"${egress_body}" || fail
      [[ -s "${egress_body}" ]] || fail
      grep -Eiq '(^|[[:space:]])(http|status|ok|success|fl|ip)=' "${egress_body}" || fail
      egress="exercised"
      ;;
    *)
      fail
      ;;
  esac
}

assert_isolation_gate() {
  negative_edge_probes_all
}

negative_edge_probe() {
  local service="$1" port
  case "${service}" in
    postgres) port=5432 ;;
    intake) port="${CATERING_INTAKE_PORT}" ;;
    offer) port="${CATERING_OFFER_PORT}" ;;
    production) port="${CATERING_PRODUCTION_PORT}" ;;
    exports) port="${CATERING_EXPORTS_PORT}" ;;
    *) fail ;;
  esac
  docker exec "${SHARED_EDGE}" sh -c "! wget -qO- --timeout=2 http://${service}:${port}/health" >/dev/null 2>&1 || fail
  printf '%s\n' "negative-edge-probe:${service}:blocked" >/dev/null
}

negative_edge_probes_all() {
  local service
  for service in postgres intake offer production exports; do
    negative_edge_probe "${service}"
  done
}

before_network_mutation() {
  assert_foreign_invariants
  validate_network_provenance catering_ingress ingress "" "" "${ingress_created_by_run}"
  validate_network_provenance catering_private private "" "" "${private_created_by_run}"
  run_all_host_semantic_smokes
}

after_network_mutation() {
  assert_foreign_invariants
  run_all_host_semantic_smokes
}

network_connect_checked() {
  local network="$1" container="$2"; shift 2
  before_network_mutation
  docker network connect "$@" "${network}" "${container}"
  after_network_mutation
}

network_disconnect_checked() {
  local network="$1" container="$2" members
  before_network_mutation
  docker network disconnect "${network}" "${container}"
  members="$(docker network inspect --format '{{json .Containers}}' "${network}")" || fail
  [[ "${members}" != *"${container}"* ]] || fail
  after_network_mutation
}

last_consumer_gate() {
  local network="$1" container="$2" members
  members="$(docker network inspect --format '{{json .Containers}}' "${network}")" || fail
  [[ "${members}" == *"${container}"* ]] || fail
  # The old path is never removed here. A removal caller may proceed only after
  # the final Catering consumer is proven absent and this complete evidence set
  # has already passed.
  run_all_host_semantic_smokes
  assert_foreign_invariants
}

removal_gate() {
  local network="$1" members
  members="$(docker network inspect --format '{{json .Containers}}' "${network}")" || fail
  [[ "${members}" == *'commcats-eventos-app'* && "${members}" == *'shared-edge-edge-1'* ]] || fail
  for forbidden in platform-infra-web-1 platform-infra-postgres-1 platform-infra-intake-1 platform-infra-offer-1 platform-infra-production-1 platform-infra-exports-1; do
    [[ "${members}" != *"${forbidden}"* ]] || fail
  done
  run_all_host_semantic_smokes
  assert_foreign_invariants
  printf '%s\n' 'removal-gate:last-consumer-and-evidence-proved' >/dev/null
}

# S0 -> S1 -> S2 -> S3 additive membership, followed by the exact P2 detach
# stages D1..D6 and S4. Only Catering-owned containers and Shared Edge are touched.
network_connect_checked catering_ingress "${PLATFORM_WEB}" --alias web
network_connect_checked catering_private "${PLATFORM_POSTGRES}" --alias postgres
network_connect_checked catering_private "${PLATFORM_INTAKE}" --alias intake
network_connect_checked catering_private "${PLATFORM_OFFER}" --alias offer
network_connect_checked catering_private "${PLATFORM_PRODUCTION}" --alias production
network_connect_checked catering_private "${PLATFORM_EXPORTS}" --alias exports
network_connect_checked catering_private "${PLATFORM_WEB}" --alias web
network_connect_checked catering_ingress "${SHARED_EDGE}" --alias edge --alias "${SHARED_EDGE}"
validate_network_provenance catering_ingress ingress "${SHARED_EDGE},${PLATFORM_WEB}" "edge,${SHARED_EDGE}" "${ingress_created_by_run}"
validate_network_provenance catering_private private "${PLATFORM_POSTGRES},${PLATFORM_INTAKE},${PLATFORM_OFFER},${PLATFORM_PRODUCTION},${PLATFORM_EXPORTS},${PLATFORM_WEB}" "postgres" "${private_created_by_run}"
assert_private_reachability

# Semantic smoke: body must contain both exact fields; credentials and headers
# are never printed. Egress is evaluated after the old compatibility path has
# been detached and read back from the active internal Catering service.
run_all_host_semantic_smokes

network_disconnect_checked platform-infra_default "${PLATFORM_POSTGRES}"
negative_edge_probe postgres
network_disconnect_checked platform-infra_default "${PLATFORM_INTAKE}"
negative_edge_probe intake
network_disconnect_checked platform-infra_default "${PLATFORM_OFFER}"
negative_edge_probe offer
network_disconnect_checked platform-infra_default "${PLATFORM_PRODUCTION}"
probe_provider_egress
negative_edge_probe production
network_disconnect_checked platform-infra_default "${PLATFORM_EXPORTS}"
negative_edge_probe exports
network_disconnect_checked zeiterfassung_default "${PLATFORM_WEB}"
last_consumer_gate platform-infra_default "${PLATFORM_WEB}"
network_disconnect_checked platform-infra_default "${PLATFORM_WEB}"
negative_edge_probes_all
removal_gate platform-infra_default
assert_isolation_gate
write_membership_adoption_journal_normal

# Re-read immutable foreign invariants and exact active identity before terminal GO.
foreign_after="$(mktemp)"
register_temp "${foreign_after}"
for container in "${FOREIGN_CONTAINERS[@]}"; do
  docker inspect --format '{{.Id}}|{{.RestartCount}}|{{.State.StartedAt}}|{{.State.Status}}|{{.Image}}|{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.service"}}|{{json .NetworkSettings.Networks}}|{{json .HostConfig.PortBindings}}' "${container}" >>"${foreign_after}" || fail
done
cmp -s "${foreign_snapshot}" "${foreign_after}" || fail
pilot_stage=S4
adoption_count=1
adoption_proof="normal-run:${transaction_id}"
write_marker active verified verified "${ingress_id}" "${private_id}"
grep -Fxq 'state=active' "${activation_marker}" || fail
run_all_host_semantic_smokes
assert_foreign_invariants
assert_isolation_gate

# A successful transaction may emit GO only after both owner locks have been
# released and their directories have been read back as absent. Any release
# failure keeps the EXIT/ERR recovery gates armed and therefore cannot claim GO.
[[ -e "${platform_stage}" ]] && unlink "${platform_stage}"
[[ -e "${edge_stage}" ]] && unlink "${edge_stage}"
if [[ "${edge_lock_mode}" == acquired ]]; then
  phase3_lock_release "${edge_lock}" "${owner}:${transaction_id}"
  [[ ! -e "${edge_lock}" && ! -L "${edge_lock}" ]] || fail
fi
if [[ "${platform_lock_mode}" == acquired ]]; then
  phase3_lock_release "${platform_lock}" "${owner}:${transaction_id}"
fi
[[ "${platform_lock_mode}" != acquired || ! -e "${platform_lock}" ]] || fail
[[ "${edge_lock_mode}" != acquired || ! -e "${edge_lock}" ]] || fail
temp_cleanup
trap - ERR TERM INT HUP
trap - EXIT
printf '%s\n' "PILOT: GO"

# Rollback authority retained for a future invocation: rolling_back keeps the
# same manifest hash, restores exact sources/memberships, removes only empty
# run-created owner networks, then installs archive before receipt. The receipt
# fields are transaction_id, transaction_manifest_path,
# transaction_manifest_sha256, prior_marker_state, prior_marker_sha256,
# restore_evidence_sha256, restore_proof_archive_path, and
# restore_proof_archive_sha256. Restore prior absent/inactive with manifest,
# archive and receipt present; unlink manifest, then receipt last. The archive
# remains non-authoritative evidence. Any rollback failure emits PILOT: NO-GO;
# only complete readback may emit PILOT: ROLLED BACK.
REMOTE_PILOT
