#!/usr/bin/env bash
set -euo pipefail

bundle_dir="${CATERING_TARGET_PREBUILT_BUNDLE_DIR:?CATERING_TARGET_PREBUILT_BUNDLE_DIR is required}"
manifest="${bundle_dir}/manifest.json"

fail() {
  printf 'CATERING_TARGET_PREBUILT_ADAPTER_FAIL line=%s\n' "${BASH_LINENO[0]:-0}" >&2
  exit 1
}

[[ -d "${bundle_dir}" && ! -L "${bundle_dir}" ]] || fail
[[ -f "${manifest}" && ! -L "${manifest}" ]] || fail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" || fail
head="$(git -C "${repo_root}" rev-parse HEAD 2>/dev/null)" || fail
[[ "${head}" =~ ^[0-9a-f]{40}$ ]] || fail
[[ -z "$(git -C "${repo_root}" status --porcelain)" ]] || fail

manifest_values="$(
  python3 - "${manifest}" "${bundle_dir}" "${head}" <<'PY'
import gzip
import hashlib
import io
import json
import pathlib
import re
import sys
import tarfile

manifest_path = pathlib.Path(sys.argv[1])
bundle = pathlib.Path(sys.argv[2])
head = sys.argv[3]
value = json.loads(manifest_path.read_text(encoding="utf-8"))
expected_keys = {
    "schemaVersion", "sourceCommit",
    "runtimeConfigImage", "runtimeTargetImage",
    "webConfigImage", "webTargetImage",
    "files",
}
if set(value) != expected_keys:
    raise SystemExit(1)
if value["schemaVersion"] != 2 or value["sourceCommit"] != head:
    raise SystemExit(1)
pattern = re.compile(r"^sha256:[0-9a-f]{64}$")
for key in ("runtimeConfigImage", "runtimeTargetImage", "webConfigImage", "webTargetImage"):
    if not pattern.fullmatch(value[key]):
        raise SystemExit(1)
expected_files = {"runtime-image.tar.gz", "web-image.tar.gz"}
if set(value["files"]) != expected_files:
    raise SystemExit(1)

def verify_archive(name, config_key, target_key):
    expected_archive = value["files"][name]
    if not re.fullmatch(r"[0-9a-f]{64}", expected_archive):
        raise SystemExit(1)
    path = bundle / name
    if not path.is_file() or path.is_symlink():
        raise SystemExit(1)
    archive_bytes = path.read_bytes()
    if hashlib.sha256(archive_bytes).hexdigest() != expected_archive:
        raise SystemExit(1)
    try:
        tar_bytes = gzip.decompress(archive_bytes)
        archive = tarfile.open(fileobj=io.BytesIO(tar_bytes), mode="r:")
        index_member = archive.getmember("index.json")
        index = json.load(archive.extractfile(index_member))
    except Exception:
        raise SystemExit(1)
    manifests = index.get("manifests")
    if index.get("schemaVersion") != 2 or not isinstance(manifests, list) or len(manifests) != 1:
        raise SystemExit(1)
    descriptor = manifests[0]
    if descriptor.get("mediaType") != "application/vnd.oci.image.manifest.v1+json":
        raise SystemExit(1)
    target = descriptor.get("digest")
    if target != value[target_key] or not pattern.fullmatch(target):
        raise SystemExit(1)
    target_hex = target.split(":", 1)[1]
    manifest_name = f"blobs/sha256/{target_hex}"
    try:
        manifest_bytes = archive.extractfile(archive.getmember(manifest_name)).read()
    except Exception:
        raise SystemExit(1)
    if hashlib.sha256(manifest_bytes).hexdigest() != target_hex:
        raise SystemExit(1)
    image_manifest = json.loads(manifest_bytes)
    config = image_manifest.get("config") or {}
    config_digest = config.get("digest")
    if config_digest != value[config_key] or not pattern.fullmatch(config_digest):
        raise SystemExit(1)
    config_hex = config_digest.split(":", 1)[1]
    config_name = f"blobs/sha256/{config_hex}"
    try:
        config_bytes = archive.extractfile(archive.getmember(config_name)).read()
    except Exception:
        raise SystemExit(1)
    if hashlib.sha256(config_bytes).hexdigest() != config_hex:
        raise SystemExit(1)

verify_archive("runtime-image.tar.gz", "runtimeConfigImage", "runtimeTargetImage")
verify_archive("web-image.tar.gz", "webConfigImage", "webTargetImage")
print(value["runtimeTargetImage"])
print(value["webTargetImage"])
PY
)" || fail
runtime_image="$(printf '%s\n' "${manifest_values}" | sed -n '1p')"
web_image="$(printf '%s\n' "${manifest_values}" | sed -n '2p')"
[[ "${runtime_image}" =~ ^sha256:[0-9a-f]{64}$ && "${web_image}" =~ ^sha256:[0-9a-f]{64}$ ]] || fail

command_name="${1:-}"
shift || true
case "${command_name}" in
  build)
    iidfile=""
    tag=""
    dockerfile=""
    context=""
    while [[ "$#" -gt 0 ]]; do
      case "$1" in
        --iidfile)
          [[ "$#" -ge 2 && -z "${iidfile}" ]] || fail
          iidfile="$2"; shift 2
          ;;
        --tag)
          [[ "$#" -ge 2 && -z "${tag}" ]] || fail
          tag="$2"; shift 2
          ;;
        --file)
          [[ "$#" -ge 2 && -z "${dockerfile}" ]] || fail
          dockerfile="$2"; shift 2
          ;;
        --*)
          fail
          ;;
        *)
          [[ -z "${context}" && "$#" -eq 1 ]] || fail
          context="$1"; shift
          ;;
      esac
    done
    [[ -n "${iidfile}" && -n "${tag}" && -n "${dockerfile}" && -n "${context}" ]] || fail
    context_real="$(cd "${context}" && pwd -P)" || fail
    [[ "${context_real}" == "${repo_root}" ]] || fail
    dockerfile_real="$(cd "$(dirname "${dockerfile}")" && pwd -P)/$(basename "${dockerfile}")"
    case "${dockerfile_real}" in
      "${repo_root}/platform-infra/docker/Dockerfile.runtime")
        [[ "${tag}" == "catering-target-runtime:${head}" ]] || fail
        image="${runtime_image}"
        ;;
      "${repo_root}/platform-infra/docker/Dockerfile.web")
        [[ "${tag}" == "catering-target-web:${head}" ]] || fail
        image="${web_image}"
        ;;
      *)
        fail
        ;;
    esac
    [[ ! -L "${iidfile}" ]] || fail
    printf '%s\n' "${image}" > "${iidfile}"
    ;;
  save)
    [[ "$#" -eq 1 ]] || fail
    case "$1" in
      "${runtime_image}") archive="${bundle_dir}/runtime-image.tar.gz" ;;
      "${web_image}") archive="${bundle_dir}/web-image.tar.gz" ;;
      *) fail ;;
    esac
    gzip -dc -- "${archive}"
    ;;
  *)
    fail
    ;;
esac
