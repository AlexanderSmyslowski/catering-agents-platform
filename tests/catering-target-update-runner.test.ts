import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const runner = path.join(root, "platform-infra/scripts/update-catering-target.sh");

function runScenario(scenario: string, commit = "a".repeat(40)) {
  const state = mkdtempSync(path.join(tmpdir(), "catering-target-update-"));
  writeFileSync(path.join(state, "mutations.log"), "");
  const result = spawnSync("/bin/bash", [runner, "--harness", scenario], {
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
