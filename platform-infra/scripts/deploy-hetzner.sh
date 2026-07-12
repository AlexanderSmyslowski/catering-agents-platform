#!/usr/bin/env bash

set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:?Set DEPLOY_HOST to the server hostname or IP.}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/catering-agents-platform}"
DEPLOY_BASE_URL="${DEPLOY_BASE_URL:-http://${DEPLOY_HOST}}"
DEPLOY_RSYNC_PATH="${DEPLOY_RSYNC_PATH:-rsync}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"

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

echo "Syncing repository to ${REMOTE}:${DEPLOY_PATH}..."
rsync -az --delete \
  --rsync-path="${DEPLOY_RSYNC_PATH}" \
  --exclude ".git" \
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

echo "Deployment completed."
