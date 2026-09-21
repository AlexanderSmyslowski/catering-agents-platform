#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CONTRACT_PATH="${REPO_ROOT}/platform-infra/catering-target-update-contract.json"
HARNESS_PATH="${SCRIPT_DIR}/catering-target-update-harness.py"
DEPLOY_COMMIT_SHA="${DEPLOY_COMMIT_SHA:-}"
MODE="${1:-}"
SCENARIO="${2:-}"
STATE_FILE=""

fail() {
  printf '%s\n' "$*" >&2
  exit 1
}

load_contract() {
  [[ -f "${CONTRACT_PATH}" && ! -L "${CONTRACT_PATH}" ]] || fail "target update contract missing"
  python3 - "${CONTRACT_PATH}" <<'PY'
import json, sys
value = json.load(open(sys.argv[1], encoding="utf-8"))
required = {
    "schemaVersion", "targetId", "deployPath", "edgePath", "releaseRoot",
    "platformComposeFiles", "edgeComposeFiles", "applicationServices",
    "databaseService", "requiredNetworks", "forbiddenNetworks",
    "protectedRemotePaths", "migrationPolicy",
}
if set(value) != required:
    raise SystemExit("unexpected target update contract fields")
if value["schemaVersion"] != 1:
    raise SystemExit("unsupported target update contract version")
PY
}

validate_exact_commit() {
  [[ "${DEPLOY_COMMIT_SHA}" =~ ^[0-9a-fA-F]{40}$ ]] || fail "DEPLOY_COMMIT_SHA must be an exact 40-character Git commit SHA"
}

prepare_harness_state() {
  [[ "${CATERING_TARGET_TEST_MODE:-}" == "1" ]] || fail "harness mode requires CATERING_TARGET_TEST_MODE=1"
  local root="${CATERING_TARGET_FAKE_ROOT:?CATERING_TARGET_FAKE_ROOT is required in harness mode}"
  [[ -n "${SCENARIO}" ]] || fail "harness scenario required"
  python3 "${HARNESS_PATH}" --prepare "${SCENARIO}" "${root}"
  STATE_FILE="${root}/state.json"
}

read_target_state() {
  [[ -n "${STATE_FILE}" && -f "${STATE_FILE}" && ! -L "${STATE_FILE}" ]] || fail "target state unavailable"
  python3 - "${STATE_FILE}" <<'PY'
import json, sys
value = json.load(open(sys.argv[1], encoding="utf-8"))
required = {
    "targetId", "deployPath", "runtimeExists", "backupReady", "lockState",
    "networks", "serviceNetworks", "publishedPorts", "services",
}
if set(value) != required:
    raise SystemExit("unexpected target state fields")
PY
}

verify_target_identity() {
  python3 - "${CONTRACT_PATH}" "${STATE_FILE}" <<'PY'
import json, sys
contract = json.load(open(sys.argv[1], encoding="utf-8"))
state = json.load(open(sys.argv[2], encoding="utf-8"))
if state["targetId"] != contract["targetId"]:
    raise SystemExit("target identity mismatch")
if state["deployPath"] != contract["deployPath"]:
    raise SystemExit("target deploy path mismatch")
if state["runtimeExists"] is not True:
    raise SystemExit("target runtime file missing")
PY
}

verify_network_contract() {
  python3 - "${CONTRACT_PATH}" "${STATE_FILE}" <<'PY'
import json, sys
contract = json.load(open(sys.argv[1], encoding="utf-8"))
state = json.load(open(sys.argv[2], encoding="utf-8"))
required = set(contract["requiredNetworks"])
if not required.issubset(set(state["networks"])):
    raise SystemExit("required target network missing")
expected = {
    "postgres": {"catering_private"},
    "intake": {"catering_private"},
    "offer": {"catering_private"},
    "production": {"catering_private"},
    "exports": {"catering_private"},
    "web": {"catering_private", "catering_ingress"},
    "edge": {"catering_ingress", "catering_public"},
}
if set(state["serviceNetworks"]) != set(expected):
    raise SystemExit("unexpected target service network map")
for service, networks in expected.items():
    actual = set(state["serviceNetworks"][service])
    if actual != networks:
        raise SystemExit(f"network topology drift for {service}")
for forbidden in contract["forbiddenNetworks"]:
    if any(forbidden in networks for networks in state["serviceNetworks"].values()):
        raise SystemExit(f"forbidden network present: {forbidden}")
PY
}

verify_port_contract() {
  python3 - "${CONTRACT_PATH}" "${STATE_FILE}" <<'PY'
import json, sys
contract = json.load(open(sys.argv[1], encoding="utf-8"))
state = json.load(open(sys.argv[2], encoding="utf-8"))
for service in [contract["databaseService"], *contract["applicationServices"]]:
    if state["publishedPorts"].get(service) != []:
        raise SystemExit(f"unexpected host ports for {service}")
if set(state["publishedPorts"].get("edge", [])) != {"80/tcp", "443/tcp"}:
    raise SystemExit("edge public port contract drift")
PY
}

verify_backup_readiness() {
  python3 - "${STATE_FILE}" <<'PY'
import json, sys
state = json.load(open(sys.argv[1], encoding="utf-8"))
if state["backupReady"] is not True:
    raise SystemExit("backup/recovery preflight not ready")
PY
}

verify_lock_available() {
  python3 - "${STATE_FILE}" <<'PY'
import json, sys
state = json.load(open(sys.argv[1], encoding="utf-8"))
if state["lockState"] != "free":
    raise SystemExit("target update lock is not available")
PY
}

record_mutation() {
  local root="${CATERING_TARGET_FAKE_ROOT:?CATERING_TARGET_FAKE_ROOT is required}"
  printf '%s\n' "$1" >> "${root}/mutations.log"
}

prepare_candidate_release() {
  local root="${CATERING_TARGET_FAKE_ROOT:?CATERING_TARGET_FAKE_ROOT is required}"
  local release_dir="${root}/releases/${DEPLOY_COMMIT_SHA}"
  mkdir -p "${release_dir}"
  printf '%s\n' \
    "rsync" "-az" "--delete" \
    "--exclude=platform-infra/.env" \
    "--exclude=platform-infra/sites" \
    "--exclude=data" \
    > "${root}/rsync-argv.txt"
  record_mutation "sync release"
  record_mutation "build runtime"
  record_mutation "build web"

  local runtime_image="sha256:$(printf '1%.0s' {1..64})"
  local web_image="sha256:$(printf '2%.0s' {1..64})"
  if [[ "${SCENARIO}" == "candidate-image-missing" ]]; then
    web_image="missing"
  fi

  python3 - "${release_dir}/candidate-images.json" "${runtime_image}" "${web_image}" <<'PY'
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
    json.dump(value, handle, indent=2)
    handle.write("\\n")
PY

  python3 - "${release_dir}/candidate-images.json" "${CONTRACT_PATH}" <<'PY'
import json, re, sys
candidate = json.load(open(sys.argv[1], encoding="utf-8"))
contract = json.load(open(sys.argv[2], encoding="utf-8"))
if set(candidate) != {"services"}:
    raise SystemExit("candidate override may contain services only")
if set(candidate["services"]) != set(contract["applicationServices"]):
    raise SystemExit("candidate override service set mismatch")
pattern = re.compile(r"^sha256:[0-9a-f]{64}$")
for service, config in candidate["services"].items():
    if set(config) != {"image"}:
        raise SystemExit(f"candidate override for {service} must contain image only")
    if not pattern.fullmatch(config["image"]):
        raise SystemExit(f"candidate image for {service} is not immutable")
PY
  record_mutation "candidate ready"
}

run_preflight() {
  load_contract
  validate_exact_commit
  read_target_state
  verify_target_identity
  verify_network_contract
  verify_port_contract
  verify_backup_readiness
  verify_lock_available
  printf '%s\n' "preflight_ok"
}

case "${MODE}" in
  --harness)
    prepare_harness_state
    run_preflight
    ;;
  --harness-update)
    prepare_harness_state
    run_preflight
    prepare_candidate_release
    printf '%s\n' "candidate_ready"
    ;;
  --preflight)
    fail "normal target preflight is not enabled until the dedicated workflow boundary is implemented"
    ;;
  *)
    fail "usage: update-catering-target.sh --harness SCENARIO | --harness-update SCENARIO | --preflight"
    ;;
esac
