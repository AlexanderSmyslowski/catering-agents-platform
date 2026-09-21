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
