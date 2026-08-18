#!/usr/bin/env bash

set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:?Set DEPLOY_HOST}"
DEPLOY_USER="${DEPLOY_USER:-root}"
EDGE_DEPLOY_PATH="${EDGE_DEPLOY_PATH:?Set EDGE_DEPLOY_PATH}"
EDGE_ROLLBACK_ROOT="${EDGE_ROLLBACK_ROOT:-${EDGE_DEPLOY_PATH}-rollbacks}"
EDGE_DEPLOY_COMMIT_SHA="${EDGE_DEPLOY_COMMIT_SHA:?Set EDGE_DEPLOY_COMMIT_SHA}"
CATERING_SMOKE_URL="${CATERING_SMOKE_URL:?Set CATERING_SMOKE_URL}"
ZEITERFASSUNG_SMOKE_URL="${ZEITERFASSUNG_SMOKE_URL:?Set ZEITERFASSUNG_SMOKE_URL}"
EVENTOS_SMOKE_URL="${EVENTOS_SMOKE_URL:?Set EVENTOS_SMOKE_URL}"
DEPLOY_RSYNC_PATH="${DEPLOY_RSYNC_PATH:-rsync}"

if [[ ! "${EDGE_DEPLOY_COMMIT_SHA}" =~ ^[0-9a-fA-F]{40}$ ]]; then
  echo "EDGE_DEPLOY_COMMIT_SHA must be an exact 40-character Git commit SHA." >&2
  exit 1
fi

for command_name in ssh rsync docker; do
  command -v "${command_name}" >/dev/null 2>&1 || {
    echo "${command_name} is required for edge deployment." >&2
    exit 1
  }
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EDGE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"

# Validate repository source before any remote write. The example environment is
# intentionally non-secret; the protected production environment is validated
# again on the host before the edge container is started.
EDGE_ENV_FILE="${EDGE_DIR}/.env.example" bash "${SCRIPT_DIR}/validate.sh"

# Fail closed before touching remote files.
ssh "${REMOTE}" "
  set -euo pipefail
  docker network inspect platform-infra_default >/dev/null 2>&1 || {
    echo 'Missing required external Docker network: platform-infra_default' >&2
    exit 1
  }
  docker network inspect zeiterfassung_default >/dev/null 2>&1 || {
    echo 'Missing required external Docker network: zeiterfassung_default' >&2
    exit 1
  }
  test -f '${EDGE_DEPLOY_PATH}/.env' || {
    echo 'Missing protected edge .env on server.' >&2
    exit 1
  }
"

echo "Creating edge rollback snapshot..."
ssh "${REMOTE}" "
  set -euo pipefail
  sudo mkdir -p '${EDGE_ROLLBACK_ROOT}'
  if test -d '${EDGE_DEPLOY_PATH}'; then
    timestamp=\$(date -u +%Y%m%dT%H%M%SZ)
    archive='${EDGE_ROLLBACK_ROOT}/shared-edge-'\"\${timestamp}\"'.tar.gz'
    sudo tar -czf \"\${archive}\" \
      --exclude=./.env \
      --exclude=./.deploy-manifest \
      -C '${EDGE_DEPLOY_PATH}' .
    printf '%s\n' \"\${archive}\" | sudo tee '${EDGE_ROLLBACK_ROOT}/latest' >/dev/null
  fi
"

echo "Syncing edge source..."
rsync -az --delete \
  --rsync-path="${DEPLOY_RSYNC_PATH}" \
  --exclude ".env" \
  --exclude ".deploy-manifest" \
  "${EDGE_DIR}/" "${REMOTE}:${EDGE_DEPLOY_PATH}/"

# Validate the protected production environment before runtime mutation.
ssh "${REMOTE}" "
  set -euo pipefail
  cd '${EDGE_DEPLOY_PATH}'
  docker compose -p shared-edge --env-file .env config >/dev/null
  docker run --rm \
    --env-file .env \
    -v '${EDGE_DEPLOY_PATH}/Caddyfile:/etc/caddy/Caddyfile:ro' \
    caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile
  docker compose -p shared-edge --env-file .env up -d
"

CATERING_SMOKE_URL="${CATERING_SMOKE_URL}" \
ZEITERFASSUNG_SMOKE_URL="${ZEITERFASSUNG_SMOKE_URL}" \
EVENTOS_SMOKE_URL="${EVENTOS_SMOKE_URL}" \
CATERING_SMOKE_BASIC_AUTH_USER="${CATERING_SMOKE_BASIC_AUTH_USER:-}" \
CATERING_SMOKE_BASIC_AUTH_PASSWORD="${CATERING_SMOKE_BASIC_AUTH_PASSWORD:-}" \
bash "${SCRIPT_DIR}/smoke-all.sh"

echo "Recording edge deployment manifest..."
ssh "${REMOTE}" "
  set -euo pipefail
  manifest='${EDGE_DEPLOY_PATH}/.deploy-manifest'
  temporary=\"\${manifest}.tmp.\$$\"
  printf '%s\n' \
    'commit=${EDGE_DEPLOY_COMMIT_SHA}' \
    \"deployed_at=\$(date -u +%Y-%m-%dT%H:%M:%SZ)\" \
    'rollback_root=${EDGE_ROLLBACK_ROOT}' \
    | sudo tee \"\${temporary}\" >/dev/null
  sudo mv \"\${temporary}\" \"\${manifest}\"
"

echo "Edge deployment completed."
