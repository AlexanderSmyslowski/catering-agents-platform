# Independent Edge Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move public ports 80/443 from the Catering-owned Caddy lifecycle to an independently deployed edge Caddy without changing application code, databases, secrets or release identities.

**Architecture:** Add a new `edge-infra` deployment unit with its own Compose project, Caddy data/config volumes, deploy lock, validation, rollback and all-hostname smoke checks. During Phase 2 it may attach to the existing `platform-infra_default` and `zeiterfassung_default` networks so the lifecycle split can happen before Phase 3 introduces dedicated ingress/private networks. The existing Catering `web` Caddy remains an application-internal upstream; public 80/443 ownership moves only in the final controlled cutover task.

**Tech Stack:** Docker Compose, Caddy, Bash, GitHub Actions, Vitest contract tests.

**Spec:** `docs/superpowers/specs/2026-08-18-server-app-isolation-design.md`

## Global Constraints

- No application deployment may invoke `docker compose down`, recreate, remove or mutate resources owned by another application.
- The independent edge owns ports 80/443 and has its own deployment lifecycle and rollback.
- Edge Caddy receives no database credentials or application secrets.
- Edge Caddy is not attached to database/private networks beyond the temporary Phase-2 compatibility networks required to reach current public upstreams.
- No host Docker socket is mounted into the edge container.
- Every edge change must validate all managed public hostnames: Zeiterfassung, EventOS and Catering.
- The final cutover must be fail-closed and reversible; no Zeiterfassung 0.4.145 release occurs in this plan.

---

### Task 1: Edge source and static ownership contract

**Files:**
- Create: `edge-infra/docker-compose.yml`
- Create: `edge-infra/Caddyfile`
- Create: `edge-infra/.env.example`
- Create: `tests/edge-infra-contract.test.ts`

**Interfaces:**
- Consumes: existing Docker networks `platform-infra_default` and `zeiterfassung_default`.
- Produces: Compose project source for one service named `edge`, volumes `edge_caddy_data` and `edge_caddy_config`, and environment-driven upstreams.

- [ ] **Step 1: Write the failing contract test**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const compose = readFileSync(new URL('../edge-infra/docker-compose.yml', import.meta.url), 'utf8');
const caddy = readFileSync(new URL('../edge-infra/Caddyfile', import.meta.url), 'utf8');

describe('independent edge infrastructure contract', () => {
  it('owns only edge resources and the two temporary compatibility networks', () => {
    expect(compose).toContain('name: shared-edge');
    expect(compose).toContain('edge:');
    expect(compose).toContain('80:80');
    expect(compose).toContain('443:443');
    expect(compose).toContain('platform-infra_default');
    expect(compose).toContain('zeiterfassung_default');
    expect(compose).not.toMatch(/postgres|database|docker\.sock|\/var\/run\/docker/);
  });

  it('routes public hosts only to application HTTP upstreams', () => {
    expect(caddy).toContain('{$CATERING_PUBLIC_HOST}');
    expect(caddy).toContain('reverse_proxy {$CATERING_UPSTREAM}');
    expect(caddy).toContain('{$ZEITERFASSUNG_PUBLIC_HOST}');
    expect(caddy).toContain('reverse_proxy {$ZEITERFASSUNG_UPSTREAM}');
    expect(caddy).toContain('{$EVENTOS_PUBLIC_HOST}');
    expect(caddy).toContain('reverse_proxy {$EVENTOS_UPSTREAM}');
  });
});
```

- [ ] **Step 2: Run the test to verify RED**

Run: `npx vitest run tests/edge-infra-contract.test.ts`

Expected: FAIL because `edge-infra/docker-compose.yml` and `edge-infra/Caddyfile` do not exist.

- [ ] **Step 3: Add the minimal edge Compose source**

```yaml
name: shared-edge

services:
  edge:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    environment:
      CADDY_EMAIL: ${CADDY_EMAIL:?set CADDY_EMAIL}
      CATERING_PUBLIC_HOST: ${CATERING_PUBLIC_HOST:-catering.the-one.catering}
      CATERING_UPSTREAM: ${CATERING_UPSTREAM:-web:80}
      ZEITERFASSUNG_PUBLIC_HOST: ${ZEITERFASSUNG_PUBLIC_HOST:-zeit.the-one.catering}
      ZEITERFASSUNG_UPSTREAM: ${ZEITERFASSUNG_UPSTREAM:-app:3040}
      EVENTOS_PUBLIC_HOST: ${EVENTOS_PUBLIC_HOST:-eventos.commcats.de}
      EVENTOS_UPSTREAM: ${EVENTOS_UPSTREAM:-commcats-eventos-app:3045}
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - edge_caddy_data:/data
      - edge_caddy_config:/config
    networks:
      - platform-infra_default
      - zeiterfassung_default

networks:
  platform-infra_default:
    external: true
  zeiterfassung_default:
    external: true

volumes:
  edge_caddy_data:
  edge_caddy_config:
```

- [ ] **Step 4: Add the edge Caddyfile**

```caddy
{
  email {$CADDY_EMAIL}
}

{$CATERING_PUBLIC_HOST} {
  reverse_proxy {$CATERING_UPSTREAM}
}

{$ZEITERFASSUNG_PUBLIC_HOST} {
  reverse_proxy {$ZEITERFASSUNG_UPSTREAM}
}

{$EVENTOS_PUBLIC_HOST} {
  reverse_proxy {$EVENTOS_UPSTREAM}
}
```

Use the production Catering hostname already configured in the protected environment when setting `CATERING_PUBLIC_HOST`; do not invent or commit a secret value. The default exists only for local config validation.

- [ ] **Step 5: Add a non-secret example environment**

```dotenv
CADDY_EMAIL=ops@example.com
CATERING_PUBLIC_HOST=catering.the-one.catering
CATERING_UPSTREAM=web:80
ZEITERFASSUNG_PUBLIC_HOST=zeit.the-one.catering
ZEITERFASSUNG_UPSTREAM=app:3040
EVENTOS_PUBLIC_HOST=eventos.commcats.de
EVENTOS_UPSTREAM=commcats-eventos-app:3045
```

- [ ] **Step 6: Run static config tests**

Run: `npx vitest run tests/edge-infra-contract.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add edge-infra tests/edge-infra-contract.test.ts
git commit -m "feat(edge): add independent edge source"
```

---

### Task 2: Edge validation, rollback and all-hostname smoke scripts

**Files:**
- Create: `edge-infra/scripts/validate.sh`
- Create: `edge-infra/scripts/smoke-all.sh`
- Create: `edge-infra/scripts/deploy-hetzner.sh`
- Create: `tests/edge-deploy-contract.test.ts`

**Interfaces:**
- Consumes: `DEPLOY_HOST`, `DEPLOY_USER`, `EDGE_DEPLOY_PATH`, `EDGE_ROLLBACK_ROOT`, `CATERING_SMOKE_URL`, `ZEITERFASSUNG_SMOKE_URL`, `EVENTOS_SMOKE_URL`.
- Produces: a fail-closed edge deploy that validates Compose/Caddy before mutation, snapshots the prior edge directory, starts only project `shared-edge`, then checks every public hostname.

- [ ] **Step 1: Write failing deployment-contract tests**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const deploy = readFileSync(new URL('../edge-infra/scripts/deploy-hetzner.sh', import.meta.url), 'utf8');
const smoke = readFileSync(new URL('../edge-infra/scripts/smoke-all.sh', import.meta.url), 'utf8');

describe('edge deploy safety contract', () => {
  it('uses an explicit project and never tears down application projects', () => {
    expect(deploy).toContain('docker compose -p shared-edge');
    expect(deploy).not.toMatch(/docker compose down|docker system prune|docker network prune|docker volume prune/);
  });

  it('checks every managed public application after the edge change', () => {
    expect(smoke).toContain('/healthz');
    expect(smoke).toContain('/readyz');
    expect(smoke).toContain('/api/public/config');
    expect(smoke).toContain('EVENTOS_SMOKE_URL');
    expect(smoke).toContain('CATERING_SMOKE_URL');
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/edge-deploy-contract.test.ts`

Expected: FAIL because the scripts do not exist.

- [ ] **Step 3: Implement `validate.sh`**

The script must:

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose -p shared-edge --env-file .env config >/dev/null
docker run --rm \
  --env-file .env \
  -v "$PWD/Caddyfile:/etc/caddy/Caddyfile:ro" \
  caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile
```

- [ ] **Step 4: Implement `smoke-all.sh`**

Use `curl --fail --silent --show-error --location --max-time 15` and require:

```bash
curl "$ZEITERFASSUNG_SMOKE_URL/healthz"
curl "$ZEITERFASSUNG_SMOKE_URL/readyz"
curl "$ZEITERFASSUNG_SMOKE_URL/api/public/config"
curl "$EVENTOS_SMOKE_URL/"
curl "$CATERING_SMOKE_URL/"
```

The script exits non-zero on any failed check. It prints only endpoint labels/status and never response bodies that could contain protected data.

- [ ] **Step 5: Implement `deploy-hetzner.sh`**

Required order:

```text
1. Require SSH/rsync and exact environment variables.
2. Verify both external networks exist with `docker network inspect`.
3. Validate local Compose/Caddy source before any remote write.
4. Create a timestamped rollback tarball of the existing edge directory if present.
5. Rsync only `edge-infra/` to `EDGE_DEPLOY_PATH` while preserving remote `.env`.
6. On the host run `docker compose -p shared-edge --env-file .env config`.
7. On the host run `docker compose -p shared-edge --env-file .env up -d`.
8. Run `smoke-all.sh` from the GitHub runner against public URLs.
9. Record the deployed Git SHA in `${EDGE_DEPLOY_PATH}/.deploy-manifest` through the same privileged temp+rename pattern already proven for Catering.
```

The script must not call `down`, prune commands, `docker rm`, `docker network rm`, or any application project Compose command.

- [ ] **Step 6: Run the contract tests**

Run: `npx vitest run tests/edge-deploy-contract.test.ts tests/edge-infra-contract.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add edge-infra/scripts tests/edge-deploy-contract.test.ts
git commit -m "feat(edge): add fail-closed deploy and smoke gates"
```

---

### Task 3: Independent GitHub workflow and non-cutover rehearsal mode

**Files:**
- Create: `.github/workflows/deploy-edge-production.yml`
- Modify: `edge-infra/docker-compose.yml`
- Create: `edge-infra/docker-compose.rehearsal.yml`
- Create: `tests/edge-workflow-contract.test.ts`

**Interfaces:**
- Consumes: existing production SSH secrets plus new edge-specific protected environment variables/secrets.
- Produces: `Deploy edge production` workflow and a rehearsal override that binds `18080:80` and `18443:443` instead of public ports.

- [ ] **Step 1: Add the failing workflow contract**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(new URL('../.github/workflows/deploy-edge-production.yml', import.meta.url), 'utf8');
const rehearsal = readFileSync(new URL('../edge-infra/docker-compose.rehearsal.yml', import.meta.url), 'utf8');

describe('edge workflow contract', () => {
  it('has an independent lock and exact edge entrypoint', () => {
    expect(workflow).toContain('group: shared-edge-production-deploy');
    expect(workflow).toContain('bash edge-infra/scripts/deploy-hetzner.sh');
    expect(workflow).not.toContain('platform-infra/scripts/deploy-hetzner.sh');
  });

  it('supports a no-cutover rehearsal binding', () => {
    expect(rehearsal).toContain('18080:80');
    expect(rehearsal).toContain('18443:443');
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/edge-workflow-contract.test.ts`

Expected: FAIL because workflow/override do not exist.

- [ ] **Step 3: Add rehearsal override**

```yaml
services:
  edge:
    ports: !override
      - "18080:80"
      - "18443:443"
```

- [ ] **Step 4: Add the independent workflow**

The workflow must use:

```yaml
name: Deploy edge production
on:
  workflow_dispatch:
permissions:
  contents: read
concurrency:
  group: shared-edge-production-deploy
  cancel-in-progress: false
```

It configures SSH exactly as the current Catering production workflow does, but calls only `edge-infra/scripts/deploy-hetzner.sh`. Environment inputs include edge deploy path/rollback root, public smoke URLs, `EDGE_MODE=rehearsal|cutover`, and the protected edge `.env` already present on the server.

- [ ] **Step 5: Make deploy script choose explicit file set**

For rehearsal:

```bash
docker compose -p shared-edge \
  -f docker-compose.yml \
  -f docker-compose.rehearsal.yml \
  --env-file .env up -d
```

For cutover:

```bash
docker compose -p shared-edge \
  -f docker-compose.yml \
  --env-file .env up -d
```

`EDGE_MODE` accepts only `rehearsal` or `cutover`; any other value exits before remote mutation.

- [ ] **Step 6: Run workflow contracts**

Run: `npx vitest run tests/edge-workflow-contract.test.ts tests/edge-deploy-contract.test.ts tests/edge-infra-contract.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/deploy-edge-production.yml edge-infra tests/edge-workflow-contract.test.ts
git commit -m "ci(edge): add independent edge deployment workflow"
```

---

### Task 4: Catering compatibility change for final public-port handoff

**Files:**
- Create: `platform-infra/docker-compose.edge-cutover.yml`
- Modify: `platform-infra/scripts/deploy-hetzner.sh`
- Create: `tests/platform-infra-edge-cutover-contract.test.ts`

**Interfaces:**
- Consumes: `EDGE_EXTERNAL=true` only after independent edge rehearsal is green.
- Produces: a Catering production Compose file set in which service `web` no longer publishes host 80/443 but remains reachable as `web:80` on `platform-infra_default`.

- [ ] **Step 1: Write failing contract test**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const override = readFileSync(new URL('../platform-infra/docker-compose.edge-cutover.yml', import.meta.url), 'utf8');
const deploy = readFileSync(new URL('../platform-infra/scripts/deploy-hetzner.sh', import.meta.url), 'utf8');

describe('Catering edge cutover compatibility', () => {
  it('removes host port ownership without removing the internal web service', () => {
    expect(override).toContain('web:');
    expect(override).toContain('ports: !reset []');
  });

  it('requires an explicit edge-external switch before using the cutover override', () => {
    expect(deploy).toContain('EDGE_EXTERNAL');
    expect(deploy).toContain('docker-compose.edge-cutover.yml');
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/platform-infra-edge-cutover-contract.test.ts`

Expected: FAIL.

- [ ] **Step 3: Add the cutover override**

```yaml
services:
  web:
    ports: !reset []
```

- [ ] **Step 4: Extend Catering deploy file selection without changing the default**

Default remains the current Phase-1 production path:

```text
docker-compose.yml + docker-compose.production.yml
```

Only when `EDGE_EXTERNAL=true` is set does the deploy append:

```text
docker-compose.edge-cutover.yml
```

This keeps local startup and the current production state unchanged before the controlled cutover.

- [ ] **Step 5: Run the full infrastructure contract group**

Run: `npx vitest run tests/platform-infra-production-isolation.test.ts tests/platform-infra-production-network.test.ts tests/platform-infra-deploy-contract.test.ts tests/platform-infra-edge-cutover-contract.test.ts tests/edge-*.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add platform-infra/docker-compose.edge-cutover.yml platform-infra/scripts/deploy-hetzner.sh tests/platform-infra-edge-cutover-contract.test.ts
git commit -m "feat(infra): prepare catering for independent edge cutover"
```

---

### Task 5: Controlled rehearsal, cutover and rollback proof

**Files:**
- Modify: `docs/agent-memory/2026-08-18-server-app-isolation.md`
- Modify: `memory.md`
- No application source-code changes.

**Interfaces:**
- Consumes: green merged implementation from Tasks 1-4; production secrets; current public health endpoints.
- Produces: evidence that the independent edge can serve all applications and that Catering no longer owns public ports.

- [ ] **Step 1: Run the independent edge in rehearsal mode**

Trigger `Deploy edge production` with `EDGE_MODE=rehearsal`.

Expected: `shared-edge-edge-1` starts on host ports 18080/18443 only; `platform-infra-web-1` continues to own the existing public listener; no application container is recreated.

- [ ] **Step 2: Verify edge-to-upstream connectivity from the rehearsal container**

On the host, read-only requests from `shared-edge-edge-1` must reach:

```text
web:80
app:3040
commcats-eventos-app:3045
```

Stop if any upstream is unresolved or returns an unexpected response. Do not modify application networks ad hoc during the same step.

- [ ] **Step 3: Capture pre-cutover unrelated container identities**

Record container ID and restart count for at least:

```text
zeiterfassung-app-1
commcats-eventos-app
platform-infra-postgres-1
platform-infra-intake-1
platform-infra-offer-1
platform-infra-production-1
platform-infra-exports-1
```

This evidence contains no secrets.

- [ ] **Step 4: Cut over Catering away from host ports**

Run the canonical Catering production deploy with `EDGE_EXTERNAL=true` so `platform-infra-web-1` is recreated only as necessary to drop host 80/443 bindings while remaining on `platform-infra_default`.

Immediately stop if Catering's own smoke fails.

- [ ] **Step 5: Start the independent edge on public ports**

Trigger `Deploy edge production` with `EDGE_MODE=cutover`.

The edge deploy succeeds only if:

```text
https://zeit.the-one.catering/healthz -> HTTP 200
https://zeit.the-one.catering/readyz -> HTTP 200
https://zeit.the-one.catering/api/public/config -> expected public contract
https://eventos.commcats.de/ -> expected successful response
Catering public UI/API smoke -> success
```

- [ ] **Step 6: Verify unrelated container identity preservation**

Compare the post-cutover IDs/restart counts against Step 3. Zeiterfassung and EventOS application containers must be unchanged by the edge cutover. Catering internal services other than `web` must also be unchanged.

- [ ] **Step 7: Prove rollback before declaring Phase 2 complete**

Rollback sequence if the edge cutover fails:

```text
1. Stop only the `shared-edge` project.
2. Redeploy Catering with `EDGE_EXTERNAL=false` using the already-proven Phase-1 base + production override.
3. Re-run all Zeiterfassung/EventOS/Catering public smokes.
4. Do not deploy Zeiterfassung or EventOS as part of rollback.
```

- [ ] **Step 8: Record the completed invariant**

Append to `docs/agent-memory/2026-08-18-server-app-isolation.md` and root `memory.md`:

```text
Phase 2 complete: public ports 80/443 are owned by Compose project `shared-edge`; Catering, Zeiterfassung and EventOS app deploys no longer own the shared public ingress lifecycle. Phase 3 still must replace temporary compatibility networks with app-specific ingress/private networks.
```

- [ ] **Step 9: Run final CI and commit documentation**

Run: `npm test`

Expected: all tests pass.

```bash
git add docs/agent-memory/2026-08-18-server-app-isolation.md memory.md
git commit -m "docs(infra): record independent edge cutover"
```

---

## Self-Review

- **Spec coverage:** independent lifecycle, ports 80/443 ownership, rollback, all-hostname smoke checks, no application data/secrets and no cross-project destructive commands are covered. Dedicated per-app ingress/private networks remain deliberately deferred to Phase 3, matching the approved migration sequence.
- **Placeholder scan:** no TBD/TODO or unspecified implementation steps remain. Production-only values that are secrets stay in protected environments and are not committed.
- **Interface consistency:** edge project name is always `shared-edge`; Zeiterfassung upstream is `app:3040`; EventOS upstream is `commcats-eventos-app:3045`; Catering upstream is `web:80` on `platform-infra_default`.
