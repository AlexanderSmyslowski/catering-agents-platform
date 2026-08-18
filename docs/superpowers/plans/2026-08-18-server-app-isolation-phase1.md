# Server Application Isolation Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the current shared proxy preserve Zeiterfassung connectivity on production deploys without making the external Zeiterfassung network a prerequisite for local Catering Compose startup.

**Architecture:** Keep `platform-infra/docker-compose.yml` self-contained. Add a production-only Compose override that attaches only `web` to the existing external `zeiterfassung_default` network, and make the Hetzner deploy script use the explicit base+production file set. Add static/contract coverage and memory documentation; do not alter application code, databases, or secrets.

**Tech Stack:** Docker Compose, Bash, Node/Jest repository tests, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-18-server-app-isolation-design.md`

## Global Constraints

- Base Compose must start on a clean machine without `zeiterfassung_default`.
- Production deployment must explicitly use the production override.
- Only the `web` service may join `zeiterfassung_default` during this transitional phase.
- No database, application-secret, EventOS, Zeiterfassung app or persistent-data mutation.
- Preserve all existing Caddy site imports and current Catering service topology.
- Record the new production invariant in `memory.md`.
- Do not deploy Zeiterfassung `0.4.145` until this phase is merged and production route recovery is verified.

---

### Task 1: Move the external network attachment out of base Compose

**Files:**
- Modify: `platform-infra/docker-compose.yml`
- Create: `platform-infra/docker-compose.production.yml`
- Test: `tests/platform-infra-production-network.test.ts`

**Interfaces:**
- Consumes: existing `web` service in `platform-infra/docker-compose.yml`.
- Produces: production override attaching `web` to `default` and external `zeiterfassung_default` while leaving base Compose independent.

- [ ] **Step 1: Write a failing contract test**

Create a test that reads both Compose files and asserts:

```ts
expect(base).not.toContain('zeiterfassung_default:');
expect(production).toContain('zeiterfassung_default:');
expect(production).toContain('external: true');
expect(production).toContain('name: zeiterfassung_default');
expect(production).toMatch(/web:[\s\S]*networks:[\s\S]*default[\s\S]*zeiterfassung_default/);
```

Also assert no non-`web` service is assigned to `zeiterfassung_default` in the override.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx jest tests/platform-infra-production-network.test.ts --runInBand
```

Expected: FAIL because the production override does not exist and base Compose currently contains the external-network change on the PR branch.

- [ ] **Step 3: Restore base Compose and add the production override**

`platform-infra/docker-compose.production.yml` must contain only:

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

Remove the corresponding `web.networks` and top-level `zeiterfassung_default` additions from base Compose.

- [ ] **Step 4: Validate both Compose contracts**

Run base config with only the base file and production config with both files:

```bash
docker compose -f platform-infra/docker-compose.yml config >/dev/null
docker compose -f platform-infra/docker-compose.yml -f platform-infra/docker-compose.production.yml config >/dev/null
```

Expected: both syntactically valid; the first does not reference `zeiterfassung_default`, the second does.

- [ ] **Step 5: Run focused test and verify GREEN**

```bash
npx jest tests/platform-infra-production-network.test.ts --runInBand
```

Expected: PASS.

---

### Task 2: Pin the production deploy to base + production override

**Files:**
- Modify: `platform-infra/scripts/deploy-hetzner.sh`
- Test: `tests/platform-infra-deploy-contract.test.ts`

**Interfaces:**
- Consumes: `platform-infra/docker-compose.yml` and `platform-infra/docker-compose.production.yml`.
- Produces: exact production Compose invocation that cannot silently fall back to the base file alone.

- [ ] **Step 1: Write a failing deploy-contract test**

Assert the deploy script contains one canonical Compose file array equivalent to:

```bash
COMPOSE_FILES=(-f docker-compose.yml -f docker-compose.production.yml)
```

and uses it for production `config` and `up --build -d` commands.

Also assert no bare production `docker compose up --build -d` remains.

- [ ] **Step 2: Run focused test and verify RED**

```bash
npx jest tests/platform-infra-deploy-contract.test.ts --runInBand
```

Expected: FAIL because current production deploy uses bare `docker compose up --build -d`.

- [ ] **Step 3: Implement explicit Compose file selection**

In the remote deployment shell block, define:

```bash
compose_files=(-f docker-compose.yml -f docker-compose.production.yml)
docker compose "${compose_files[@]}" config >/dev/null
docker compose "${compose_files[@]}" up --build -d
```

Before `up`, fail with a clear message if `docker-compose.production.yml` is absent.

- [ ] **Step 4: Run focused test**

```bash
npx jest tests/platform-infra-deploy-contract.test.ts --runInBand
```

Expected: PASS.

---

### Task 3: Record the production invariant and regression intent

**Files:**
- Modify: `memory.md`
- Modify: `docs/superpowers/specs/2026-08-18-server-app-isolation-design.md` only if implementation evidence reveals a contradiction.

**Interfaces:**
- Produces: versioned operational memory that future agents read before touching production infrastructure.

- [ ] **Step 1: Append a new memory version**

Add a new version-history entry describing:

- 2026-08-18 repeated Zeiterfassung outage caused by Catering-owned shared Caddy recreation;
- temporary production override solution;
- base Compose must stay self-contained;
- eventual independent edge proxy is the approved architecture target;
- no application deployment may own unrelated app ingress lifecycle.

Do not overwrite existing history.

- [ ] **Step 2: Run memory/format checks used by the repository**

Use the repository's existing lint/test commands; no new formatter is introduced.

---

### Task 4: Full Phase-1 verification and PR cleanup

**Files:**
- Review all Phase-1 changed files.
- PR: `#629`.

**Interfaces:**
- Produces: a mergeable, review-clean Phase-1 PR.

- [ ] **Step 1: Run focused tests**

```bash
npx jest tests/platform-infra-production-network.test.ts tests/platform-infra-deploy-contract.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run repository CI-equivalent checks**

Run the established build/test/lint/smoke commands for this repository. Base Compose smoke must remain runnable without `zeiterfassung_default`.

- [ ] **Step 3: Address the two existing Codex review threads**

Reply with the production-override resolution and memory update, then resolve both threads only after the new head contains the fixes.

- [ ] **Step 4: Verify PR diff**

Expected scope:

- base Compose no longer contains `zeiterfassung_default`;
- new production override contains the external network;
- deploy script explicitly uses both files;
- tests + memory + approved spec/plan only;
- no application code or data changes.

- [ ] **Step 5: Merge only after exact-head CI is green**

Squash merge PR #629 to `main` with expected-head protection. Do not trigger Zeiterfassung `0.4.145` deployment until the production shared proxy is confirmed healthy after the merged platform deployment.

---

### Task 5: Production recovery validation after merge

**Files:** none unless a new defect is proven.

**Interfaces:**
- Consumes: merged Phase-1 production deploy.
- Produces: restored public Zeiterfassung route and proof that the transitional fix survives a real proxy recreate.

- [ ] **Step 1: Deploy the merged Catering infrastructure through its canonical production workflow**

Do not manually edit server Compose files. The production override must be synced and used by `deploy-hetzner.sh`.

- [ ] **Step 2: Verify the proxy is on both required networks**

Expected during transition:

```text
platform-infra-web-1 -> platform-infra_default + zeiterfassung_default
zeiterfassung-app-1  -> zeiterfassung_default
```

- [ ] **Step 3: Verify public Zeiterfassung health**

Expected:

- `/healthz` HTTP 200 with current Zeiterfassung version/SHA;
- `/readyz` HTTP 200;
- `/api/public/config` reachable according to its public contract.

- [ ] **Step 4: Verify other proxy sites**

`https://eventos.commcats.de/` and Catering's own production smoke must remain successful.

- [ ] **Step 5: Stop Phase 1 if the production deployment still recreates unrelated application resources or removes ingress connectivity**

No manual workaround is accepted as Phase-1 completion.
