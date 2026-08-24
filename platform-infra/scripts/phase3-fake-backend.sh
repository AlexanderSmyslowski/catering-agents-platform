#!/usr/bin/env bash
set -euo pipefail
umask 077

scenario="${1:?scenario required}"
root="${CATERING_PHASE3_FAKE_HOST_ROOT:?CATERING_PHASE3_FAKE_HOST_ROOT is required}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
helper="${script_dir}/catering-phase3-pilot.sh"
fake_docker="${script_dir}/phase3-fake-docker.py"
fake_ssh="${script_dir}/phase3-fake-ssh.sh"
fake_scp="${script_dir}/phase3-fake-scp.sh"
fake_sudo="${script_dir}/phase3-fake-sudo.sh"
bin="${root}/bin"
state="${root}/fake-docker-state.json"

mkdir -p "${root}" "${root}/tmp" "${root}/locks" "${root}/platform-infra" "${root}/edge-infra" "${bin}"
for runtime_file in \
  "${root}/platform-infra/docker-compose.yml" \
  "${root}/platform-infra/docker-compose.production.yml" \
  "${root}/platform-infra/docker-compose.edge-cutover.yml" \
  "${root}/platform-infra/.env" \
  "${root}/edge-infra/docker-compose.yml" \
  "${root}/edge-infra/.env"; do
  [[ -e "${runtime_file}" ]] || printf '%s\n' '# deterministic fake runtime input' >"${runtime_file}"
done

# The fake starts from the same disabled default as the authoritative
# Production service; named scenarios then model explicit runtime states.
production_compose="${script_dir}/../docker-compose.yml"
production_env="$(awk '
  /^  production:$/ { in_production=1; next }
  in_production && /^  [a-z][a-z0-9_-]*:/ { exit }
  in_production && /^      CATERING_ENABLE_WEB_RECIPE_SEARCH:/ { print; exit }
' "${production_compose}" | sed -n 's/.*:-\([01]\)}$/\1/p')"
[[ "${production_env}" == 0 ]] || { printf '%s\n' 'authoritative Production Compose default is not disabled' >&2; exit 1; }
production_env=1
production_project=platform-infra
production_service=production
case "${scenario}" in
  egress-disabled) production_env=0 ;;
  egress-missing) production_env=__absent__ ;;
  egress-malformed) production_env=maybe ;;
  egress-foreign) production_project=foreign-platform ;;
esac

if [[ ! -e "${state}" ]]; then
  CATERING_PHASE3_FAKE_HOST_ROOT="${root}" CATERING_PHASE3_HARNESS_SCENARIO="${scenario}" \
    CATERING_PHASE3_FAKE_PRODUCTION_ENV="${production_env}" \
    CATERING_PHASE3_FAKE_PRODUCTION_PROJECT="${production_project}" \
    CATERING_PHASE3_FAKE_PRODUCTION_SERVICE="${production_service}" \
    python3 "${fake_docker}" --init
fi

fault=
case "${scenario}" in
  crash-after-candidate|crash-after-ingress|crash-after-private|crash-after-active|crash-after-rollback|crash-after-receipt|semantic-smoke-fail|semantic-smoke-incomplete|egress-fail|egress-disabled|egress-missing|egress-malformed|egress-foreign|compose-render-fail|network-provenance-fail)
    fault="${scenario}" ;;
  *) fault= ;;
esac
CATERING_PHASE3_FAKE_HOST_ROOT="${root}" python3 "${fake_docker}" --set-fault "${fault}"

for command_name in docker ssh scp sudo; do
  [[ ! -e "${bin}/${command_name}" && ! -L "${bin}/${command_name}" ]] || unlink "${bin}/${command_name}"
done
ln -s "${fake_docker}" "${bin}/docker"
ln -s "${fake_ssh}" "${bin}/ssh"
ln -s "${fake_scp}" "${bin}/scp"
ln -s "${fake_sudo}" "${bin}/sudo"

if [[ "${scenario}" == lock-contention ]]; then
  mkdir -p "${root}/locks/catering-agents-platform.deploy-lock"
  printf '%s\n' 'owner_token=foreign:run' >"${root}/locks/catering-agents-platform.deploy-lock/owner"
fi

pilot_args=()
case "${scenario}" in
  resume-candidate|resume-after-ingress|resume-after-private|resume-active|resume-rolling-back)
    pilot_args=(--resume) ;;
  rollback|rollback-active)
    pilot_args=(--rollback) ;;
esac

export PATH="${bin}:${PATH}"
export CATERING_PHASE3_ENVIRONMENT=production
export CATERING_PHASE3_EXECUTE=1
export CATERING_PHASE3_TRANSACTION_ID=phase3-harness
export CATERING_PHASE3_RUN_ID=phase3-harness
export CATERING_PHASE3_REMOTE_ROOT="${root}"
export CATERING_PHASE3_PLATFORM_LOCK="${root}/locks/catering-agents-platform.deploy-lock"
export CATERING_PHASE3_EDGE_LOCK="${root}/locks/shared-edge.deploy-lock"
export CATERING_PHASE3_PLATFORM_DIR="${root}/platform-infra"
export CATERING_PHASE3_EDGE_DIR="${root}/edge-infra"
export CATERING_PHASE3_REMOTE_TMP_ROOT="${root}/tmp"
export CATERING_PHASE3_EGRESS_EXERCISE=1
export CATERING_PHASE3_EGRESS_URL=https://egress.invalid/health
export DEPLOY_HOST=phase3.invalid
export DEPLOY_USER=harness

# The final exec is the production entrypoint. This adapter only prepares an
# isolated command surface and Docker state; it never writes pilot artifacts or
# advances a transaction state itself.
if ((${#pilot_args[@]})); then
  exec /bin/bash "${helper}" "${pilot_args[@]}"
else
  exec /bin/bash "${helper}"
fi
