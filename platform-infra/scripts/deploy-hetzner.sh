#!/usr/bin/env bash

set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:?Set DEPLOY_HOST to the server hostname or IP.}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/catering-agents-platform}"
DEPLOY_BASE_URL="${DEPLOY_BASE_URL:-http://${DEPLOY_HOST}}"
DEPLOY_RSYNC_PATH="${DEPLOY_RSYNC_PATH:-rsync}"
DEPLOY_ROLLBACK_ROOT="${DEPLOY_ROLLBACK_ROOT:-${DEPLOY_PATH}-rollbacks}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"
DEPLOY_COMMIT_SHA="${DEPLOY_COMMIT_SHA:-$(git -C "${REPO_ROOT}" rev-parse HEAD 2>/dev/null || true)}"

if [[ ! "${DEPLOY_COMMIT_SHA}" =~ ^[0-9a-fA-F]{40}$ ]]; then
  echo "DEPLOY_COMMIT_SHA must be an exact 40-character Git commit SHA."
  exit 1
fi

if ! command -v rsync >/dev/null 2>&1; then
  echo "rsync is required for deployment."
  exit 1
fi

if ! command -v ssh >/dev/null 2>&1; then
  echo "ssh is required for deployment."
  exit 1
fi

echo "Checking remote deployment configuration..."
if ! ssh "${REMOTE}" "test -f '${DEPLOY_PATH}/platform-infra/.env'"; then
  echo "Missing platform-infra/.env on server."
  exit 1
fi

echo "Creating rollback snapshot on ${REMOTE}..."
ssh "${REMOTE}" "
  set -euo pipefail
  rollback_root='${DEPLOY_ROLLBACK_ROOT}'
  timestamp=\$(date -u +%Y%m%dT%H%M%SZ)
  sudo mkdir -p \"\${rollback_root}\"
  archive=\"\${rollback_root}/catering-agents-platform-\${timestamp}.tar.gz\"
  sudo tar -czf \"\${archive}\" \\
    --exclude=./data \\
    --exclude=./platform-infra/.env \\
    --exclude=./platform-infra/sites \\
    -C '${DEPLOY_PATH}' .
  printf '%s\n' \"\${archive}\" | sudo tee \"\${rollback_root}/latest\" >/dev/null
  echo \"Rollback snapshot: \${archive}\"
"

echo "Syncing repository to ${REMOTE}:${DEPLOY_PATH}..."
rsync -az --delete \
  --rsync-path="${DEPLOY_RSYNC_PATH}" \
  --exclude ".git" \
  --exclude ".deploy-manifest" \
  --exclude "node_modules" \
  --exclude "data" \
  --exclude "backoffice-ui/dist" \
  --exclude "Kochbücher" \
  --exclude "platform-infra/.env" \
  --exclude "platform-infra/sites" \
  "${REPO_ROOT}/" "${REMOTE}:${DEPLOY_PATH}/"

echo "Ensuring remote deployment directory access..."
ssh "${REMOTE}" "sudo chmod 755 '${DEPLOY_PATH}'"

echo "Starting Docker Compose on ${REMOTE}..."
ssh "${REMOTE}" "
  set -euo pipefail
  cd '${DEPLOY_PATH}/platform-infra'
  test -f .env || { echo 'Missing platform-infra/.env on server.'; exit 1; }
  docker compose up --build -d
"

echo "Running smoke checks against ${DEPLOY_BASE_URL}..."
"${SCRIPT_DIR}/smoke-check.sh" "${DEPLOY_BASE_URL}"

echo "Recording deployed commit ${DEPLOY_COMMIT_SHA}..."
ssh "${REMOTE}" "
  set -euo pipefail
  manifest='${DEPLOY_PATH}/.deploy-manifest'
  temporary=\"\${manifest}.tmp.\$$\"
  printf '%s\n' \\
    'commit=${DEPLOY_COMMIT_SHA}' \\
    \"deployed_at=\$(date -u +%Y-%m-%dT%H:%M:%SZ)\" \\
    'rollback_root=${DEPLOY_ROLLBACK_ROOT}' \\
    | sudo tee \"\${temporary}\" >/dev/null
  sudo mv \"\${temporary}\" \"\${manifest}\"
"

echo "Deployment completed."
