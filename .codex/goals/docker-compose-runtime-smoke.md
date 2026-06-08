# Docker Compose Runtime Smoke

## Objective

Verify the Docker Compose runtime path actually starts and routes traffic through the intended Docker network without weakening local runtime safety.

## Hard constraints

Do not:
- add product behavior
- add UI behavior
- change auth semantics
- change persistence semantics
- expose internal service ports publicly unless already intended
- weaken 127.0.0.1 defaults outside Docker
- change BYO-LLM or recipe behavior
- perform broad infra refactors

Keep the patch minimal.

## Current context

- Services bind to 127.0.0.1 by default outside Docker.
- Docker Compose explicitly opts service containers into 0.0.0.0 binds.
- Runtime service smoke exists for local dev commands.
- Auth is fail-closed.
- Dev auth is explicit.
- TS-source-only runtime is guarded.
- Mutating route auth matrix is complete.

## Tasks

1. Inspect:
   - platform-infra/docker-compose.yml
   - Caddy config, if present
   - service Dockerfiles or compose build contexts
   - healthcheck configuration
   - exposed/published ports

2. Run the correct compose config command for this repo and verify:
   - intake gets INTAKE_HOST=0.0.0.0
   - offer gets OFFER_HOST=0.0.0.0
   - production gets PRODUCTION_HOST=0.0.0.0
   - print-export gets PRINT_EXPORT_HOST=0.0.0.0
   - local non-Docker defaults remain 127.0.0.1

3. Start the minimal compose stack needed to reach:
   - intake /health
   - offer /health
   - production /health
   - print-export /health

4. Prefer reaching services through the intended Caddy/proxy route if configured and stable.
   If proxy paths are unclear, verify internal Docker-network reachability with docker compose exec/curl.

5. Verify:
   - services start
   - health endpoints respond
   - services are reachable through the intended Docker path
   - no unintended host-public service port exposure is added

6. Add stable automation only if safe:
   - scripts/smoke-docker-compose.sh
   or
   - tests/docker-compose-runtime-smoke.test.ts

7. Tear down the stack cleanly.

8. Run:
   - npm test
   - npm run build
   - any targeted smoke script/test added

## Success criteria

- compose config is valid
- compose runtime starts, or a clear external blocker is reported
- MVP services are reachable through the intended Docker path
- host-local runtime safety remains unchanged
- tests pass
- build passes
- no product behavior changed
- remaining risks are explicit

## Output

Report:
1. Branch name
2. Changed files
3. Removed files
4. Commands run
5. Compose config result
6. Runtime smoke result per service
7. Test/build result
8. Remaining risks
9. Whether this is commit-worthy

## Stop conditions

Stop and report if:
- Docker is unavailable.
- Compose needs unavailable secrets.
- Stack startup requires product behavior changes.
- Passing the smoke would require exposing internal service ports publicly.
- Caddy/proxy paths are ambiguous and would require redesign.
