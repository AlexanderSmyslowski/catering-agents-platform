import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const runner = path.join(root, "platform-infra/scripts/update-catering-target.sh");

function runScenario(scenario: string, commit = "a".repeat(40), mode: "preflight" | "update" = "preflight") {
  const state = mkdtempSync(path.join(tmpdir(), "catering-target-update-"));
  writeFileSync(path.join(state, "mutations.log"), "");
  const result = spawnSync("/bin/bash", [runner, mode === "update" ? "--harness-update" : "--harness", scenario], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      CATERING_TARGET_TEST_MODE: "1",
      CATERING_TARGET_FAKE_ROOT: state,
      DEPLOY_COMMIT_SHA: commit
    }
  });
  return { state, result };
}

describe("Catering target updater preflight", () => {
  it("accepts a healthy synthetic target without mutating it", () => {
    const { state, result } = runScenario("healthy");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("preflight_ok");
    expect(readFileSync(path.join(state, "mutations.log"), "utf8")).toBe("");
  });

  it("rejects a non-exact commit before mutation", () => {
    const { state, result } = runScenario("healthy", "main");
    expect(result.status).not.toBe(0);
    expect(readFileSync(path.join(state, "mutations.log"), "utf8")).toBe("");
  });

  it.each([
    "forbidden-network",
    "extra-foreign-network",
    "missing-runtime",
    "bad-target-path",
    "backup-not-ready",
    "lock-held",
    "topology-drift"
  ])("fails closed before mutation for %s", (scenario) => {
    const { state, result } = runScenario(scenario);
    expect(result.status).not.toBe(0);
    expect(readFileSync(path.join(state, "mutations.log"), "utf8")).toBe("");
  });
});


describe("Catering target updater candidate preparation", () => {
  it("builds all candidate application images before activation and never replaces postgres or edge", () => {
    const { state, result } = runScenario("healthy", "a".repeat(40), "update");
    expect(result.status, result.stderr).toBe(0);
    const events = readFileSync(path.join(state, "mutations.log"), "utf8");
    expect(events).toContain("build runtime");
    expect(events).toContain("build web");
    expect(events).toContain("candidate ready");
    expect(events.indexOf("build runtime")).toBeLessThan(events.indexOf("candidate ready"));
    expect(events.indexOf("build web")).toBeLessThan(events.indexOf("candidate ready"));
    expect(events).not.toContain("activate");
    expect(events).not.toContain("build postgres");
    expect(events).not.toContain("build edge");
  });

  it("excludes server-owned paths from rsync delete", () => {
    const { state, result } = runScenario("healthy", "a".repeat(40), "update");
    expect(result.status, result.stderr).toBe(0);
    const argv = readFileSync(path.join(state, "rsync-argv.txt"), "utf8");
    for (const value of ["platform-infra/.env", "platform-infra/sites", "data"]) {
      expect(argv).toContain("--exclude=" + value);
    }
  });

  it("does not activate when a candidate image is not immutable", () => {
    const { state, result } = runScenario("candidate-image-missing", "a".repeat(40), "update");
    expect(result.status).not.toBe(0);
    const events = readFileSync(path.join(state, "mutations.log"), "utf8");
    expect(events).not.toContain("candidate ready");
    expect(events).not.toContain("activate");
  });
});


describe("Catering target updater activation and recovery", () => {
  it("marks a healthy synthetic update as installed only after postflight", () => {
    const { state, result } = runScenario("healthy", "a".repeat(40), "update");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("updated");
    expect(readFileSync(path.join(state, "result.txt"), "utf8")).toBe("updated\n");
    const events = readFileSync(path.join(state, "mutations.log"), "utf8");
    expect(events).toContain("activate");
    expect(events).toContain("smoke");
    expect(events).toContain("postflight");
    expect(events).toContain("install receipt");
    expect(events.indexOf("postflight")).toBeLessThan(events.indexOf("install receipt"));
    expect(readFileSync(path.join(state, "lock-state.txt"), "utf8")).toBe("free\n");
  });

  it.each(["activate-fails", "smoke-fails", "postflight-port-drift", "postflight-network-drift"])(
    "rolls back a failed update for %s before schema mutation",
    (scenario) => {
      const { state, result } = runScenario(scenario, "a".repeat(40), "update");
      expect(result.status).not.toBe(0);
      expect(readFileSync(path.join(state, "result.txt"), "utf8")).toBe("rolled_back\n");
      const events = readFileSync(path.join(state, "mutations.log"), "utf8");
      expect(events).toContain("rollback");
      expect(readFileSync(path.join(state, "lock-state.txt"), "utf8")).toBe("free\n");
    }
  );

  it("retains the lock when rollback cannot be proven", () => {
    const { state, result } = runScenario("rollback-fails", "a".repeat(40), "update");
    expect(result.status).not.toBe(0);
    expect(readFileSync(path.join(state, "result.txt"), "utf8")).toBe("manual_recovery_required\n");
    expect(readFileSync(path.join(state, "lock-state.txt"), "utf8")).toBe("held\n");
  });

  it("blocks an undeclared migration before sync, build, or activation", () => {
    const { state, result } = runScenario("migration-required", "a".repeat(40), "update");
    expect(result.status).not.toBe(0);
    expect(readFileSync(path.join(state, "result.txt"), "utf8")).toBe("manual_migration_approval_required\n");
    const events = readFileSync(path.join(state, "mutations.log"), "utf8");
    expect(events).not.toContain("sync release");
    expect(events).not.toContain("build runtime");
    expect(events).not.toContain("activate");
  });
});
