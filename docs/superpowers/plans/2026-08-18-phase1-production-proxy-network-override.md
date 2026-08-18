# Phase 1 Production Proxy Network Override Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the current production shared proxy retain Zeiterfassung connectivity across Catering platform deploys without making the base/local Compose stack depend on a production-only external network.

**Architecture:** Keep `platform-infra/docker-compose.yml` self-contained. Add a production-only Compose override that attaches only `web` to the external `zeiterfassung_default` network, and make the Hetzner deploy script explicitly use base + production override. Add contract tests and record the new production invariant in `memory.md`.

**Tech Stack:** Docker Compose, Bash, Node.js test runner/Jest as already used by the repository, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-18-server-app-isolation-edge-design.md`

## Global Constraints

- Base/local Compose must work without `zeiterfassung_default`.
- Production deploy must fail closed if `zeiterfassung_default` does not exist.
- Only the `web` service may join the external Zeiterfassung network in Phase 1.
- Do not change Postgres, intake, offer, production, exports, data volumes, secrets, Caddy site imports, DNS, or application business logic.
- Do not deploy Zeiterfassung 0.4.145 as part of this PR.
- Record the production-only network invariant in `memory.md`.
- Preserve existing rollback snapshot behavior in `deploy-hetzner.sh`.

---

### Task 1: Add production-only Compose override contract

**Files:**
- Create: `platform-infra/docker-compose.production.yml`
- Test: `tests/platform-infra-production-compose.test.ts`

**Interfaces:**
- Consumes: base `platform-infra/docker-compose.yml` service `web`.
- Produces: production overlay in which `web` joins both the base default network and external `zeiterfassung_default`.

- [ ] **Step 1: Write a failing contract test**

Add a test that loads/parses the production override and asserts:

```ts
expect(override.services.web.networks).toEqual(["default", "zeiterfassung_default"]);
expect(override.networks.zeiterfassung_default).toEqual({
  external: true,
  name: "zeiterfassung_default",
});
```

Also assert that no service other than `web` is declared in the override.

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```bash
npx jest tests/platform-infra-production-compose.test.ts --runInBand
```

Expected: FAIL because `platform-infra/docker-compose.production.yml` does not yet exist.

- [ ] **Step 3: Create the minimal production override**

Create exactly:

```yaml
services:
  web:
    networks:
      - default
      - zeiterfassung_default

networks:
  zeiterfassung_default:
    external: true
    name: zeiterfassung_default
```

- [ ] **Step 4: Add merged-Compose assertions**

In the same test, invoke Docker Compose config when Docker is available:

```bash
docker compose \
  -f platform-infra/docker-compose.yml \
  -f platform-infra/docker-compose.production.yml \
  config
```

Assert the merged `web` service contains both networks and no database/internal service joins `zeiterfassung_default`.

The test must skip only the Docker-execution portion if `docker` is unavailable; the static YAML contract must always run.

- [ ] **Step 5: Run focused test**

```bash
npx jest tests/platform-infra-production-compose.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add platform-infra/docker-compose.production.yml tests/platform-infra-production-compose.test.ts
git commit -m "fix(infra): add production proxy network override"
```

---

### Task 2: Make production deployment use the override explicitly

**Files:**
- Modify: `platform-infra/scripts/deploy-hetzner.sh`
- Test: `tests/platform-infra-deploy-script.test.ts`

**Interfaces:**
- Consumes: `platform-infra/docker-compose.yml`, `platform-infra/docker-compose.production.yml`.
- Produces: remote deployment command using both files and a fail-closed preflight for the external network.

- [ ] **Step 1: Write failing deploy-script contract tests**

Add assertions that the script contains a remote preflight equivalent to:

```bash
docker network inspect zeiterfassung_default >/dev/null 2>&1 || {
  echo 'Missing required external Docker network: zeiterfassung_default'
  exit 1
}
```

and that the production start command is exactly scoped to both Compose files:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.production.yml \
  up --build -d
```

Also assert there is no `docker compose down`, `docker system prune`, `docker network prune`, or unscoped removal command.

- [ ] **Step 2: Run focused test and verify failure**

```bash
npx jest tests/platform-infra-deploy-script.test.ts --runInBand
```

Expected: FAIL because the deploy script still invokes plain `docker compose up --build -d`.

- [ ] **Step 3: Add external-network preflight**

Immediately before starting Compose on the remote host, add:

```bash
docker network inspect zeiterfassung_default >/dev/null 2>&1 || {
  echo 'Missing required external Docker network: zeiterfassung_default'
  exit 1
}
```

Do not create the network automatically. Its absence is an environment/configuration error and must stop the deploy before container recreation.

- [ ] **Step 4: Use the production override for the remote Compose start**

Replace only the production Compose invocation with:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.production.yml \
  up --build -d
```

Keep local development commands and base Compose unchanged.

- [ ] **Step 5: Run focused tests**

```bash
npx jest tests/platform-infra-deploy-script.test.ts tests/platform-infra-production-compose.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add platform-infra/scripts/deploy-hetzner.sh tests/platform-infra-deploy-script.test.ts
git commit -m "fix(infra): preserve proxy network on production deploy"
```

---

### Task 3: Preserve standalone/local Compose behavior

**Files:**
- Modify: `tests/platform-infra-production-compose.test.ts`
- Modify if required by existing test organization: `platform-infra/scripts/smoke-compose-runtime.sh`

**Interfaces:**
- Consumes: unchanged base Compose.
- Produces: regression proof that local/base workflows do not require the production external network.

- [ ] **Step 1: Add base-Compose regression assertions**

Assert statically that `platform-infra/docker-compose.yml` does not contain `zeiterfassung_default` and that `web` has no production-only network declaration.

- [ ] **Step 2: Add Docker-backed base config check where Docker is available**

Run:

```bash
docker compose -f platform-infra/docker-compose.yml config
```

Expected: PASS without creating or requiring `zeiterfassung_default`.

- [ ] **Step 3: Verify existing runtime smoke continues to use base Compose unless explicitly production-scoped**

Inspect `platform-infra/scripts/smoke-compose-runtime.sh`. If it calls base Compose already, leave it unchanged and assert that behavior in the test. Do not inject the production override into local smoke.

- [ ] **Step 4: Run focused tests**

```bash
npx jest tests/platform-infra-production-compose.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/platform-infra-production-compose.test.ts platform-infra/scripts/smoke-compose-runtime.sh
git commit -m "test(infra): keep base compose self contained"
```

Only include `smoke-compose-runtime.sh` in the commit if its content actually changed.

---

### Task 4: Record the production invariant and incident linkage

**Files:**
- Modify: `memory.md`
- Modify: `INCIDENT_SHARED_PROXY_ROUTE_REMOVED_2026-07-12.md`

**Interfaces:**
- Produces: operator/agent memory that a production Catering deploy currently requires `zeiterfassung_default` until the standalone Edge migration is completed.

- [ ] **Step 1: Append a new `memory.md` version entry**

Append, do not overwrite history. Record:

- 2026-08-18 repeat incident caused by `platform-infra-web-1` recreation dropping runtime-only Zeiterfassung network membership;
- Phase-1 production override location;
- base Compose intentionally remains independent;
- `zeiterfassung_default` is a temporary production dependency until Edge extraction;
- application deploys must not manually recreate shared proxy outside the production override contract.

Increment the memory version consistently with repository convention.

- [ ] **Step 2: Extend the existing incident document**

Add a dated recurrence section explaining that the 2026-08-18 platform deployment reproduced the documented failure mode and that the production override is an interim containment, not the final architecture.

Reference the approved isolation spec:

`docs/superpowers/specs/2026-08-18-server-app-isolation-edge-design.md`

- [ ] **Step 3: Run documentation/format checks**

Run the repository's normal lint/test commands that cover Markdown/source hygiene.

- [ ] **Step 4: Commit**

```bash
git add memory.md INCIDENT_SHARED_PROXY_ROUTE_REMOVED_2026-07-12.md
git commit -m "docs(infra): record shared proxy isolation invariant"
```

---

### Task 5: Full verification and PR replacement

**Files:**
- No new functional files beyond Tasks 1–4.
- PR metadata: supersede PR #629 after the replacement PR exists.

**Interfaces:**
- Produces: reviewable Phase-1 PR based on current `main`, with Codex P1 concerns addressed.

- [ ] **Step 1: Run focused infra tests**

```bash
npx jest \
  tests/platform-infra-production-compose.test.ts \
  tests/platform-infra-deploy-script.test.ts \
  --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run repository verification**

```bash
npm test -- --maxWorkers=1
npm run build
npm audit --omit=dev
git diff --check
```

Expected: all required gates PASS; if environment-specific tests are skipped, report the exact reason rather than weakening them.

- [ ] **Step 3: Review final diff**

Confirm:

- base `platform-infra/docker-compose.yml` unchanged;
- only production override joins `zeiterfassung_default`;
- only `web` joins the external network;
- deploy script uses the override explicitly;
- no foreign-resource prune/down behavior;
- memory/incident docs updated;
- no Zeiterfassung/EventOS source changes.

- [ ] **Step 4: Push and open replacement PR**

Open a new PR targeting `main` titled:

`fix(infra): isolate production proxy network contract`

Explain that it supersedes #629 because #629 placed a production-only external network in the base Compose file.

- [ ] **Step 5: Wait for GitHub CI and Codex review**

Do not merge until required CI is green and all P1/P0 review threads are resolved on the exact head.

- [ ] **Step 6: Close #629 as superseded**

Only after the replacement PR is open and linked.

- [ ] **Step 7: Merge by squash when green**

Use expected-head protection. After merge, verify `main` CI on the exact merge SHA before any production deploy.

- [ ] **Step 8: Production rollout via existing deployment workflow**

Deploy only after `main` CI is green. Verify before/after:

- `zeit.the-one.catering/healthz` -> HTTP 200
- `zeit.the-one.catering/readyz` -> HTTP 200
- `zeit.the-one.catering/api/public/config` -> expected successful public response
- `eventos.commcats.de/` -> HTTP 200
- Catering public route -> expected authenticated/healthy response
- Caddy container remains attached to `zeiterfassung_default` after the platform deploy

If any cross-app check regresses, fail closed and use the platform rollback snapshot; do not continue to Zeiterfassung 0.4.145.
