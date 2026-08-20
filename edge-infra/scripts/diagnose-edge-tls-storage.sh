#!/usr/bin/env bash

set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:?Set DEPLOY_HOST}"
DEPLOY_USER="${DEPLOY_USER:-root}"
EDGE_DEPLOY_PATH="${EDGE_DEPLOY_PATH:-/opt/shared-edge}"
REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"

ssh "${REMOTE}" bash -s -- "${EDGE_DEPLOY_PATH}" <<'REMOTE_SCRIPT'
set -euo pipefail
edge_path="$1"

echo "Shared-edge TLS storage diagnostic"
echo "== Docker/compose state =="
if [[ -f "${edge_path}/docker-compose.yml" && -f "${edge_path}/.env" ]]; then
  cd "${edge_path}"
  docker compose -p shared-edge -f docker-compose.yml --env-file .env ps || true
fi

echo "== Shared-edge Caddy data volume =="
volume_name="$(docker volume ls \
  --filter label=com.docker.compose.project=shared-edge \
  --filter label=com.docker.compose.volume=edge_caddy_data \
  --format '{{.Name}}' | head -n 1)"
if [[ -z "${volume_name}" ]]; then
  echo "No shared-edge edge_caddy_data volume found."
  exit 0
fi
printf 'volume=%s\n' "${volume_name}"
docker volume inspect --format 'driver={{.Driver}} mountpoint={{.Mountpoint}}' "${volume_name}"

echo "== Certificate inventory (paths and sizes only; no key contents) =="
docker run --rm -v "${volume_name}:/data:ro" alpine:3.21 sh -c '
  if [ ! -d /data/caddy/certificates ]; then
    echo "certificate_store=absent"
  else
    find /data/caddy/certificates -type f \( -name "*.crt" -o -name "*.key" -o -name "*.json" \) \
      -printf "%p\t%s bytes\n" 2>/dev/null | sort
  fi
'

echo "== Persisted cutover TLS runtime evidence (bounded, filtered) =="
docker run --rm -v "${volume_name}:/data:ro" alpine:3.21 sh -c '
  if [ ! -f /data/cutover-runtime.log ]; then
    echo "cutover_runtime_log=absent"
    exit 0
  fi
  tail -n 250 /data/cutover-runtime.log \
    | grep -Ei "tls|acme|certificate|challenge|issuer|obtain|renew|error|warn" \
    | tail -n 120 \
    || true
'

echo "== ACME/account directory inventory (names only) =="
docker run --rm -v "${volume_name}:/data:ro" alpine:3.21 sh -c '
  if [ -d /data/caddy/acme ]; then
    find /data/caddy/acme -maxdepth 4 -mindepth 1 -type d -print | sort
  else
    echo "acme_store=absent"
  fi
'

echo "== DNS A-resolution from production host =="
for host in catering.the-one.catering zeit.the-one.catering eventos.commcats.de; do
  echo "host=${host}"
  getent ahostsv4 "${host}" | awk '{print $1}' | sort -u || true
done

echo "== Current public TLS certificate summaries =="
for host in catering.the-one.catering zeit.the-one.catering eventos.commcats.de; do
  echo "host=${host}"
  timeout 10 openssl s_client -connect "${host}:443" -servername "${host}" </dev/null 2>/dev/null \
    | openssl x509 -noout -subject -issuer -dates 2>/dev/null || echo "certificate_summary=unavailable"
done
REMOTE_SCRIPT
