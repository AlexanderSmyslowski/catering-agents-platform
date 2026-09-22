# CateringOS Target-Server Update Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Build a dedicated, fail-closed update path for the isolated CateringOS target server without reintroducing the historical zeiterfassung_default or shared-edge deployment chain.

**Architecture:** Reuse the existing target Compose snapshots as the topology contract. Add a secret-free update contract, a target-specific updater that builds immutable application images and applies only an application-image override, plus a manual main-only GitHub workflow. All remote behavior is pinned by local harness tests; implementation CI performs no real server access.

**Tech Stack:** Bash, Docker Compose JSON, Node.js 22, TypeScript/Vitest, Python, GitHub Actions.

**Spec:** docs/superpowers/specs/2026-09-21-catering-target-update-path-design.md

## Global Constraints

- Do not modify .github/workflows/deploy-production.yml or platform-infra/scripts/deploy-hetzner.sh.
- Do not use, create, connect, inspect, or require zeiterfassung_default in the new update path.
- Preserve the four existing catering-target Compose JSON files as the topology baseline.
- Implementation CI must never SSH to a real server or mutate DNS, proxy, firewall, timers, data, or production secrets.
- Runtime env, Edge/Caddy state, database volumes, backup configuration, and target-specific protected files remain server-owned.
- Updates accept only an exact 40-character commit SHA from current main.
- Critical-state read failures are hard failures.
- Automatic rollback is allowed only before an incompatible data/schema change; otherwise retain the lock and report manual_recovery_required.
- A green branch is only GO for deployment preparation, not permission to execute a real update.

## Review Focus

1. Unexpected foreign network beside the expected Catering networks: reject before mutation.
2. Rsync would delete a protected target-owned file: prevent by contract and test.
3. Candidate image does not resolve to immutable sha256 ID: never activate.
4. Health smoke passes but postflight topology/ports drift: fail and recover.
5. Failure after schema mutation starts: retain lock and report manual_recovery_required.

## File Map

**Create**
- platform-infra/catering-target-update-contract.json
- platform-infra/scripts/update-catering-target.sh
- platform-infra/scripts/catering-target-update-harness.py
- tests/catering-target-update-contract.test.ts
- tests/catering-target-update-runner.test.ts
- tests/catering-target-update-workflow.test.ts
- .github/workflows/update-catering-target.yml
- docs/operations/CATERING_TARGET_UPDATE.md

**Modify after verification**
- memory.md
- docs/agent-memory/2026-09-21-gate-c-main-integration.md

**Must remain unchanged**
- .github/workflows/deploy-production.yml
- platform-infra/scripts/deploy-hetzner.sh
- existing target Compose JSON files unless a failing contract test proves a contradiction; that requires a recorded ruling.

---

### Task 1: Pin the machine-readable target update contract

**Files:** Create platform-infra/catering-target-update-contract.json and tests/catering-target-update-contract.test.ts.

**Interfaces:** Produces JSON fields schemaVersion, targetId, deployPath, edgePath, releaseRoot, platformComposeFiles, edgeComposeFiles, applicationServices, databaseService, requiredNetworks, forbiddenNetworks, protectedRemotePaths, migrationPolicy.

- [ ] **Step 1: Write the failing contract test**

~~~ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const contractPath = path.join(root, "platform-infra/catering-target-update-contract.json");

describe("Catering target update contract", () => {
  it("pins only the isolated Catering target topology", () => {
    const contract = JSON.parse(readFileSync(contractPath, "utf8"));
    expect(contract).toMatchObject({
      schemaVersion: 1,
      targetId: "catering-prod-1",
      deployPath: "/opt/catering-agents-platform",
      edgePath: "/opt/catering-edge",
      releaseRoot: "/opt/catering-releases",
      applicationServices: ["intake", "offer", "production", "exports", "web"],
      databaseService: "postgres",
      requiredNetworks: ["catering_private", "catering_ingress", "catering_public"],
      forbiddenNetworks: ["zeiterfassung_default"],
      migrationPolicy: { mode: "explicit-only", supportedCommand: null }
    });
  });

  it("protects server-owned paths from sync", () => {
    const contract = JSON.parse(readFileSync(contractPath, "utf8"));
    expect(contract.protectedRemotePaths).toEqual(expect.arrayContaining([
      "/etc/catering-target/runtime.env",
      "/opt/catering-edge/Caddyfile",
      "/opt/catering-agents-platform/platform-infra/.env",
      "/opt/catering-agents-platform/platform-infra/sites",
      "/opt/catering-agents-platform/data"
    ]));
  });
});
~~~

- [ ] **Step 2: Verify RED**

Run: npx vitest run tests/catering-target-update-contract.test.ts --maxWorkers=1

Expected: FAIL because the contract file is absent.

- [ ] **Step 3: Add the minimal contract**

~~~json
{
  "schemaVersion": 1,
  "targetId": "catering-prod-1",
  "deployPath": "/opt/catering-agents-platform",
  "edgePath": "/opt/catering-edge",
  "releaseRoot": "/opt/catering-releases",
  "platformComposeFiles": [
    "platform-infra/docker-compose.catering-target.json",
    "platform-infra/docker-compose.catering-target.operations.json"
  ],
  "edgeComposeFiles": [
    "edge-infra/docker-compose.catering-target.json",
    "edge-infra/docker-compose.catering-target.operations.json"
  ],
  "applicationServices": ["intake", "offer", "production", "exports", "web"],
  "databaseService": "postgres",
  "requiredNetworks": ["catering_private", "catering_ingress", "catering_public"],
  "forbiddenNetworks": ["zeiterfassung_default"],
  "protectedRemotePaths": [
    "/etc/catering-target/runtime.env",
    "/opt/catering-edge/Caddyfile",
    "/opt/catering-agents-platform/platform-infra/.env",
    "/opt/catering-agents-platform/platform-infra/sites",
    "/opt/catering-agents-platform/data"
  ],
  "migrationPolicy": { "mode": "explicit-only", "supportedCommand": null }
}
~~~

- [ ] **Step 4: Extend the test to parse all four target Compose JSON files**

Assert application service set, postgres network, absence of zeiterfassung_default, Edge-only TCP 80/443 publication, no application host ports, and internal/IPv6-off/isolated private networks.

- [ ] **Step 5: Run GREEN**

Run:
- npx vitest run tests/catering-target-update-contract.test.ts --maxWorkers=1
- python3 -m unittest tests/catering_target_isolation_test.py tests/catering_target_operations_test.py

Expected: PASS.

- [ ] **Step 6: Commit**

git add platform-infra/catering-target-update-contract.json tests/catering-target-update-contract.test.ts
git commit -m "test: pin isolated Catering target update contract"

---

### Task 2: Add a fail-closed preflight and synthetic command boundary

**Files:** Create platform-infra/scripts/update-catering-target.sh, platform-infra/scripts/catering-target-update-harness.py, tests/catering-target-update-runner.test.ts.

**Interfaces:** Runner modes --preflight, --harness <scenario>, normal mode. Result states preflight_ok, updated, rolled_back, manual_recovery_required. Harness replaces command boundaries but executes the real shell control flow.

- [ ] **Step 1: Write RED tests**

~~~ts
import { mkdtempSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const runner = path.join(root, "platform-infra/scripts/update-catering-target.sh");

function runScenario(scenario: string, commit = "a".repeat(40)) {
  const state = mkdtempSync(path.join(tmpdir(), "catering-target-update-"));
  const result = spawnSync("/bin/bash", [runner, "--harness", scenario], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, CATERING_TARGET_TEST_MODE: "1", CATERING_TARGET_FAKE_ROOT: state, DEPLOY_COMMIT_SHA: commit }
  });
  return { state, result };
}

describe("Catering target updater", () => {
  it("rejects a non-exact commit before mutation", () => {
    const { state, result } = runScenario("healthy", "main");
    expect(result.status).not.toBe(0);
    expect(readFileSync(path.join(state, "mutations.log"), "utf8")).toBe("");
  });

  it.each(["forbidden-network", "extra-foreign-network", "missing-runtime", "bad-target-path", "backup-not-ready", "lock-held", "topology-drift"])("fails closed before mutation for %s", (scenario) => {
    const { state, result } = runScenario(scenario);
    expect(result.status).not.toBe(0);
    expect(readFileSync(path.join(state, "mutations.log"), "utf8")).toBe("");
  });
});
~~~

- [ ] **Step 2: Verify RED**

npx vitest run tests/catering-target-update-runner.test.ts --maxWorkers=1

Expected: FAIL because runner/harness are absent.

- [ ] **Step 3: Implement deterministic harness scenarios**

The Python harness creates state.json, an empty mutations.log, and command shims. Scenarios: healthy, forbidden-network, extra-foreign-network, missing-runtime, bad-target-path, backup-not-ready, lock-held, topology-drift, plus Task 3/4 failure scenarios. Shims must never fall through to real ssh, docker, systemctl, rsync, or curl.

- [ ] **Step 4: Implement read-only preflight functions**

The runner must implement and call load_contract, validate_exact_commit, read_target_state, verify_target_identity, verify_network_contract, verify_port_contract, verify_backup_readiness, verify_lock_available. Any failed read exits before lock acquisition or mutation.

- [ ] **Step 5: Verify GREEN**

Run:
- npx vitest run tests/catering-target-update-runner.test.ts --maxWorkers=1
- bash -n platform-infra/scripts/update-catering-target.sh
- python3 -m py_compile platform-infra/scripts/catering-target-update-harness.py

Expected: PASS.

- [ ] **Step 6: Commit**

git add platform-infra/scripts/update-catering-target.sh platform-infra/scripts/catering-target-update-harness.py tests/catering-target-update-runner.test.ts
git commit -m "feat: add fail-closed Catering target preflight"


---

### Task 3: Build immutable application candidates and protected sync

**Files:** Modify platform-infra/scripts/update-catering-target.sh, platform-infra/scripts/catering-target-update-harness.py, tests/catering-target-update-runner.test.ts.

**Interfaces:** Produces /opt/catering-releases/<commit>/ and an application-only Compose override with immutable images for intake, offer, production, exports, web; never replaces postgres or Edge.

- [ ] **Step 1: Add RED candidate/sync tests**

~~~ts
it("builds candidate application images before activation", () => {
  const { state, result } = runScenario("healthy");
  expect(result.status).toBe(0);
  const events = readFileSync(path.join(state, "mutations.log"), "utf8");
  expect(events).toContain("build runtime");
  expect(events).toContain("build web");
  expect(events.indexOf("build runtime")).toBeLessThan(events.indexOf("activate"));
  expect(events.indexOf("build web")).toBeLessThan(events.indexOf("activate"));
  expect(events).not.toContain("build postgres");
  expect(events).not.toContain("build edge");
});

it("excludes server-owned paths from rsync delete", () => {
  const { state, result } = runScenario("healthy");
  expect(result.status).toBe(0);
  const argv = readFileSync(path.join(state, "rsync-argv.txt"), "utf8");
  for (const value of ["platform-infra/.env", "platform-infra/sites", "data"]) {
    expect(argv).toContain("--exclude=" + value);
  }
});
~~~

- [ ] **Step 2: Verify RED** for those tests.

- [ ] **Step 3: Implement release preparation**

After lock acquisition:
1. create allowlisted release directory;
2. bind previous installed commit and current application image IDs;
3. require acceptable recovery point through the existing Catering backup status contract;
4. rsync repository source with --delete and explicit protected excludes;
5. build one runtime image from platform-infra/docker/Dockerfile.runtime;
6. build one web image from platform-infra/docker/Dockerfile.web;
7. resolve both to immutable sha256 IDs;
8. generate an image-only override: runtime image for intake/offer/production/exports and web image for web;
9. render target base + operations + candidate override before activation.

- [ ] **Step 4: Add RED candidate-image-missing scenario** and require no activation.

- [ ] **Step 5: Implement candidate validation**

Require each image ID to match sha256:[0-9a-f]{64}. Reject override keys other than services.<application>.image; no postgres, Edge, networks, ports, volumes, or environment.

- [ ] **Step 6: Run GREEN**

npx vitest run tests/catering-target-update-runner.test.ts --maxWorkers=1

- [ ] **Step 7: Commit**

git add platform-infra/scripts/update-catering-target.sh platform-infra/scripts/catering-target-update-harness.py tests/catering-target-update-runner.test.ts
git commit -m "feat: prepare immutable Catering target application candidates"

---

### Task 4: Activation, postflight, rollback, and migration boundary

**Files:** Modify the runner, harness, runner tests, and contract only for the already-specified migration policy.

**Interfaces:** Returns updated, rolled_back, manual_recovery_required, or manual_migration_approval_required.

- [ ] **Step 1: Write RED failure-path tests**

Scenarios: activate-fails, smoke-fails, postflight-port-drift, postflight-network-drift, rollback-fails, migration-required.

~~~ts
it("retains the lock when rollback cannot be proven", () => {
  const { state, result } = runScenario("rollback-fails");
  expect(result.status).not.toBe(0);
  expect(readFileSync(path.join(state, "result.txt"), "utf8")).toContain("manual_recovery_required");
  expect(readFileSync(path.join(state, "lock-state.txt"), "utf8")).toBe("held\n");
});
~~~

- [ ] **Step 2: Verify RED** for all new scenarios.

- [ ] **Step 3: Implement activation**

Only update application services using target platform base JSON + target operations JSON + candidate image override. Do not modify Edge. Do not change PostgreSQL image or volume identity.

- [ ] **Step 4: Implement postflight**

Require:
- five application services healthy/running;
- PostgreSQL same volume identity;
- exact expected network membership;
- no application host ports;
- Edge remains the only TCP 80/443 publisher;
- authenticated existing read-smoke succeeds;
- installed commit marker equals DEPLOY_COMMIT_SHA.

Only then atomically write release receipt, release lock, and report updated.

- [ ] **Step 5: Implement rollback**

If schema_mutation_started=false, restore previous application image override/source release, reactivate, and rerun topology/health checks. If proof succeeds report rolled_back with nonzero update status. If proof fails, retain lock and report manual_recovery_required.

- [ ] **Step 6: Implement migration fail-closed**

With migrationPolicy.supportedCommand null, any declared migration need returns manual_migration_approval_required before sync/build/activation. Do not infer migration safety from source diffs.

- [ ] **Step 7: Run GREEN**

npx vitest run tests/catering-target-update-contract.test.ts tests/catering-target-update-runner.test.ts --maxWorkers=1

Also run shell/Python syntax checks.

- [ ] **Step 8: Commit**

git add platform-infra/catering-target-update-contract.json platform-infra/scripts/update-catering-target.sh platform-infra/scripts/catering-target-update-harness.py tests/catering-target-update-runner.test.ts
git commit -m "feat: add recoverable Catering target activation"

---

### Task 5: Add a manual main-only GitHub workflow

**Files:** Create .github/workflows/update-catering-target.yml and tests/catering-target-update-workflow.test.ts.

**Interfaces:** Required commit_sha; required confirmation UPDATE_CATERING_TARGET; dedicated target SSH/known-host/smoke secrets; no automatic trigger.

- [ ] **Step 1: Write RED workflow tests**

~~~ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const source = () => readFileSync(path.join(root, ".github/workflows/update-catering-target.yml"), "utf8");

describe("Catering target update workflow", () => {
  it("is manual and main-only", () => {
    const text = source();
    expect(text).toContain("workflow_dispatch:");
    expect(text).not.toMatch(/^\s*push:/m);
    expect(text).not.toMatch(/^\s*pull_request:/m);
    expect(text).toContain("refs/heads/main");
  });

  it("never invokes the historical deploy chain", () => {
    const text = source();
    expect(text).toContain("platform-infra/scripts/update-catering-target.sh");
    expect(text).not.toContain("deploy-hetzner.sh");
    expect(text).not.toContain("zeiterfassung_default");
  });

  it("requires exact commit input and explicit confirmation", () => {
    const text = source();
    expect(text).toContain("commit_sha");
    expect(text).toContain("UPDATE_CATERING_TARGET");
  });
});
~~~

- [ ] **Step 2: Verify RED**

npx vitest run tests/catering-target-update-workflow.test.ts --maxWorkers=1

- [ ] **Step 3: Implement workflow**

Requirements:
- workflow_dispatch only;
- required commit_sha and confirmation inputs;
- job guard for refs/heads/main;
- fetch/check current remote main equals input commit;
- checkout exact commit with persist-credentials: false;
- strict known-host SSH;
- dedicated target secrets;
- read-only preflight first;
- mutating runner only after exact confirmation;
- redacted evidence artifact;
- no automatic retry;
- no old deploy script.

- [ ] **Step 4: Add safety assertions** for forbidden triggers/references and missing persist-credentials: false.

- [ ] **Step 5: Run GREEN**

npx vitest run tests/catering-target-update-workflow.test.ts tests/catering-target-update-contract.test.ts tests/catering-target-update-runner.test.ts --maxWorkers=1

Do not dispatch the workflow.

- [ ] **Step 6: Commit**

git add .github/workflows/update-catering-target.yml tests/catering-target-update-workflow.test.ts
git commit -m "ci: add manual isolated Catering target update workflow"


---

### Task 6: Regression verification against existing target and backup contracts

- [ ] **Step 1: Run all new tests**

npx vitest run tests/catering-target-update-contract.test.ts tests/catering-target-update-runner.test.ts tests/catering-target-update-workflow.test.ts --maxWorkers=1

- [ ] **Step 2: Run existing Python target/backup tests**

python3 -m unittest tests/catering_target_isolation_test.py tests/catering_target_operations_test.py tests/catering_backup_tool_integration_test.py

- [ ] **Step 3: Run existing Vitest target/backup contracts**

npx vitest run tests/catering-phase3-pilot-contract.test.ts tests/catering-backup-restore-contract.test.ts tests/catering-production-evidence-workflow-contract.test.ts tests/catering-production-operator-readout-contract.test.ts --maxWorkers=1

- [ ] **Step 4: Run build/typecheck**

npm run build

- [ ] **Step 5: Prove forbidden coupling absent**

grep -R --line-number --fixed-strings 'zeiterfassung_default' platform-infra/catering-target-update-contract.json platform-infra/scripts/update-catering-target.sh .github/workflows/update-catering-target.yml && exit 1 || true

Expected: no matches.

Also run:

git diff d6a9b8dbc0987c281c826a88697bddeeb51a9ff5 -- .github/workflows/deploy-production.yml platform-infra/scripts/deploy-hetzner.sh

Expected: empty.

- [ ] **Step 6: Run full suite**

npm test
npm run build

Do not weaken tests. If local resources are insufficient, push the verified branch and require unchanged GitHub CI as full-suite evidence.

- [ ] **Step 7: Commit only test-derived fixes**

Every behavioral fix must have witnessed RED→GREEN evidence. No speculative cleanup.

---

### Task 7: Document verified implementation and stop before any real deployment

**Files:** Create docs/operations/CATERING_TARGET_UPDATE.md; modify memory.md and docs/agent-memory/2026-09-21-gate-c-main-integration.md.

- [ ] **Step 1: Write operator documentation from actual behavior**

Document workflow/input, target identity, preflight, protected paths, candidate image override, migration policy, rollback versus recovery-required, success evidence, and explicit prohibition of the old Deploy production workflow.

- [ ] **Step 2: Update memory after verification only**

Record branch/head/tree, exact tests and counts, CI run IDs, and that the new workflow has never been dispatched against production. Bump memory once.

- [ ] **Step 3: Consistency check**

grep -R --line-number 'Deploy production' docs/operations/CATERING_TARGET_UPDATE.md docs/agent-memory/2026-09-21-gate-c-main-integration.md memory.md

Every occurrence must be historical/prohibitive, never recommended for the target.

- [ ] **Step 4: Commit docs**

git add docs/operations/CATERING_TARGET_UPDATE.md memory.md docs/agent-memory/2026-09-21-gate-c-main-integration.md
git commit -m "docs: record Catering target update preparation"

- [ ] **Step 5: Push branch and run regular non-deploying CI**

Verify triggers before push. update-catering-target.yml must remain manual-only and therefore must not execute.

- [ ] **Step 6: Independent whole-branch review**

Review against the approved spec, this plan, diff from d6a9b8d…, focused tests, and regular CI. Critical/Important findings get one bounded RED→GREEN fix pass. Minor findings are recorded unless they block a stated contract.

- [ ] **Step 7: HALT**

Required final state:
- implementation branch reviewed;
- tests/CI green;
- no production workflow dispatch;
- no server access;
- no merge to main without separate request;
- first live target update still requires explicit operational approval after a fresh read-only server preflight.
