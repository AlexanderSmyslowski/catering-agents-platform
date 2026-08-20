#!/usr/bin/env bash

set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:?Set DEPLOY_HOST}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_PATH="${DEPLOY_PATH:?Set DEPLOY_PATH}"
DEPLOY_BASE_URL="${DEPLOY_BASE_URL:?Set DEPLOY_BASE_URL}"
DEPLOY_RSYNC_PATH="${DEPLOY_RSYNC_PATH:-rsync}"
DEPLOY_COMMIT_SHA="${DEPLOY_COMMIT_SHA:?Set DEPLOY_COMMIT_SHA}"
SMOKE_BASIC_AUTH_USER="${SMOKE_BASIC_AUTH_USER:?Set SMOKE_BASIC_AUTH_USER}"
SMOKE_BASIC_AUTH_PASSWORD="${SMOKE_BASIC_AUTH_PASSWORD:?Set SMOKE_BASIC_AUTH_PASSWORD}"
DEPLOY_ROLLBACK_ROOT="${DEPLOY_ROLLBACK_ROOT:-${DEPLOY_PATH}-rollbacks}"

if [[ ! "${DEPLOY_COMMIT_SHA}" =~ ^[0-9a-fA-F]{40}$ ]]; then
  echo "DEPLOY_COMMIT_SHA must be an exact 40-character Git commit SHA." >&2
  exit 1
fi

for command_name in ssh rsync curl python3; do
  command -v "${command_name}" >/dev/null 2>&1 || {
    echo "${command_name} is required for the web-listener deployment." >&2
    exit 1
  }
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"
previous_web_image_id=""
previous_web_image_ref="platform-infra-web:latest"
WEB_CHANGED=false

rollback_web() {
  local failure_status=$?
  trap - ERR
  set +e

  if [[ "${WEB_CHANGED}" != "true" || -z "${previous_web_image_id}" ]]; then
    exit "${failure_status}"
  fi

  echo "Catering web listener deployment failed; restoring previous web image." >&2
  ssh "${REMOTE}" bash -s -- "${DEPLOY_PATH}" "${previous_web_image_id}" "${previous_web_image_ref}" <<'REMOTE_SCRIPT'
set -euo pipefail
deploy_path="$1"
previous_web_image_id="$2"
previous_web_image_ref="$3"
cd "${deploy_path}/platform-infra"
docker image inspect "${previous_web_image_id}" >/dev/null
docker image tag "${previous_web_image_id}" "${previous_web_image_ref}"
docker compose -p platform-infra -f docker-compose.yml -f docker-compose.production.yml \
  up -d --no-deps --force-recreate --no-build web
REMOTE_SCRIPT
  local rollback_status=$?
  if [[ "${rollback_status}" -ne 0 ]]; then
    echo "Catering web rollback failed; operator intervention is required." >&2
  fi
  exit "${failure_status}"
}
trap 'rollback_web' ERR

ssh "${REMOTE}" bash -s -- "${DEPLOY_PATH}" <<'REMOTE_SCRIPT'
set -euo pipefail
deploy_path="$1"
test -f "${deploy_path}/platform-infra/.env"
test -f "${deploy_path}/platform-infra/docker-compose.yml"
test -f "${deploy_path}/platform-infra/docker-compose.production.yml"
docker network inspect platform-infra_default >/dev/null
REMOTE_SCRIPT

previous_web_image_id="$(ssh "${REMOTE}" bash -s -- "${DEPLOY_PATH}" <<'REMOTE_SCRIPT'
set -euo pipefail
deploy_path="$1"
cd "${deploy_path}/platform-infra"
docker compose -p platform-infra -f docker-compose.yml -f docker-compose.production.yml ps -q web | \
  xargs -r docker inspect --format '{{.Image}}' | head -n 1
REMOTE_SCRIPT
)"
if [[ -z "${previous_web_image_id}" ]]; then
  echo "Could not determine the currently running Catering web image; refusing targeted deployment." >&2
  exit 1
fi

echo "Creating source rollback snapshot before the web-only update..."
ssh "${REMOTE}" bash -s -- "${DEPLOY_PATH}" "${DEPLOY_ROLLBACK_ROOT}" "${DEPLOY_COMMIT_SHA}" <<'REMOTE_SCRIPT'
set -euo pipefail
deploy_path="$1"
rollback_root="$2"
commit_sha="$3"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
sudo mkdir -p "${rollback_root}"
archive="${rollback_root}/catering-web-listener-${timestamp}-${commit_sha:0:12}.tar.gz"
sudo tar -czf "${archive}" \
  --exclude=./data \
  --exclude=./platform-infra/.env \
  --exclude=./platform-infra/sites \
  -C "${deploy_path}" .
printf '%s\n' "${archive}" | sudo tee "${rollback_root}/latest-web-listener" >/dev/null
echo "Web-listener rollback snapshot: ${archive}"
REMOTE_SCRIPT

echo "Syncing exact repository source without protected state..."
rsync -az --delete \
  --rsync-path="${DEPLOY_RSYNC_PATH}" \
  --exclude ".git" \
  --exclude ".deploy-manifest" \
  --exclude ".web-listener-deploy-manifest" \
  --exclude "node_modules" \
  --exclude "data" \
  --exclude "backoffice-ui/dist" \
  --exclude "Kochbücher" \
  --exclude "platform-infra/.env" \
  --exclude "platform-infra/sites" \
  "${REPO_ROOT}/" "${REMOTE}:${DEPLOY_PATH}/"

ssh "${REMOTE}" bash -s -- "${DEPLOY_PATH}" <<'REMOTE_SCRIPT'
set -euo pipefail
deploy_path="$1"
cd "${deploy_path}/platform-infra"
docker compose -p platform-infra -f docker-compose.yml -f docker-compose.production.yml config >/dev/null
docker compose -p platform-infra -f docker-compose.yml -f docker-compose.production.yml build web
REMOTE_SCRIPT

WEB_CHANGED=true
ssh "${REMOTE}" bash -s -- "${DEPLOY_PATH}" <<'REMOTE_SCRIPT'
set -euo pipefail
deploy_path="$1"
cd "${deploy_path}/platform-infra"
docker compose -p platform-infra -f docker-compose.yml -f docker-compose.production.yml \
  up -d --no-deps --force-recreate --no-build web
REMOTE_SCRIPT

AUTH_B64="$(printf '%s' "${SMOKE_BASIC_AUTH_USER}:${SMOKE_BASIC_AUTH_PASSWORD}" | base64 | tr -d '\n')"
ssh "${REMOTE}" bash -s -- "${DEPLOY_PATH}" "${AUTH_B64}" <<'REMOTE_SCRIPT'
set -euo pipefail
deploy_path="$1"
auth_b64="$2"
cd "${deploy_path}/platform-infra"
body_file="$(mktemp)"
cleanup() { rm -f "${body_file}"; }
trap cleanup EXIT

probe_ok=false
for attempt in $(seq 1 15); do
  : >"${body_file}"
  if docker compose -p platform-infra -f docker-compose.yml -f docker-compose.production.yml \
    exec -T -e "CATERING_PROBE_AUTH_B64=${auth_b64}" web sh -c '
      exec wget -qO- --timeout=5 \
        --header "Authorization: Basic ${CATERING_PROBE_AUTH_B64}" \
        http://127.0.0.1:8081/api/intake/health
    ' >"${body_file}" 2>/dev/null; then
    if python3 - "${body_file}" <<'PYTHON'
import json
import sys

try:
    with open(sys.argv[1], encoding="utf-8") as response:
        payload = json.load(response)
except (OSError, UnicodeError, json.JSONDecodeError):
    raise SystemExit(1)
if not isinstance(payload, dict):
    raise SystemExit(1)
if payload.get("status") != "ok":
    raise SystemExit(1)
if payload.get("service") != "intake-service":
    raise SystemExit(1)
PYTHON
    then
      probe_ok=true
      break
    fi
  fi
  sleep 1
done

if [[ "${probe_ok}" != "true" ]]; then
  echo "Dedicated Catering listener failed exact intake-service identity probe on web:8081." >&2
  exit 1
fi

echo "Catering internal listener: ok (web:8081 -> intake-service, exact identity confirmed)"
REMOTE_SCRIPT

public_body="$(mktemp)"
cleanup_public() { rm -f "${public_body}"; }
trap cleanup_public EXIT
public_ok=false
for attempt in $(seq 1 10); do
  : >"${public_body}"
  if curl --silent --show-error --fail --max-time 8 \
    --basic --user "${SMOKE_BASIC_AUTH_USER}:${SMOKE_BASIC_AUTH_PASSWORD}" \
    --output "${public_body}" \
    "${DEPLOY_BASE_URL%/}/api/intake/health"; then
    if python3 - "${public_body}" <<'PYTHON'
import json
import sys

try:
    with open(sys.argv[1], encoding="utf-8") as response:
        payload = json.load(response)
except (OSError, UnicodeError, json.JSONDecodeError):
    raise SystemExit(1)
if not isinstance(payload, dict):
    raise SystemExit(1)
if payload.get("status") != "ok":
    raise SystemExit(1)
if payload.get("service") != "intake-service":
    raise SystemExit(1)
PYTHON
    then
      public_ok=true
      break
    fi
  fi
  sleep 1
done
if [[ "${public_ok}" != "true" ]]; then
  echo "Existing public Catering path failed exact intake-service identity probe after web recreate." >&2
  exit 1
fi
echo "Public Catering path: ok (exact intake-service identity confirmed)"
rm -f "${public_body}"
trap - EXIT

ssh "${REMOTE}" bash -s -- "${DEPLOY_PATH}" "${DEPLOY_COMMIT_SHA}" <<'REMOTE_SCRIPT'
set -euo pipefail
deploy_path="$1"
commit_sha="$2"
manifest="${deploy_path}/.web-listener-deploy-manifest"
temporary="${manifest}.tmp.$$"
printf '%s\n' \
  "commit=${commit_sha}" \
  "scope=web-listener" \
  "deployed_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  | sudo tee "${temporary}" >/dev/null
sudo mv "${temporary}" "${manifest}"
REMOTE_SCRIPT

WEB_CHANGED=false
trap - ERR
echo "Catering web-only listener deployment completed without restarting application services."
