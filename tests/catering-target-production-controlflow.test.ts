import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const productionRunner = path.join(root, "platform-infra/scripts/catering-target-production-update.sh");
const fakeCommand = path.join(root, "tests/support/catering-target-production-command.py");

function runProduction(scenario: string, mode: "preflight" | "update" = "update", extraEnv: Record<string, string> = {}) {
  expect(existsSync(fakeCommand), "production command fixture must exist").toBe(true);

  const state = mkdtempSync(path.join(tmpdir(), "catering-target-production-controlflow-"));
  const bin = path.join(state, "bin");
  const fs = require("node:fs") as typeof import("node:fs");
  fs.mkdirSync(bin);
  writeFileSync(path.join(state, "commands.log"), "");

  for (const name of ["ssh", "docker", "rsync"]) {
    symlinkSync(fakeCommand, path.join(bin, name));
  }
  chmodSync(fakeCommand, 0o700);

  const key = path.join(state, "id_ed25519");
  const knownHosts = path.join(state, "known_hosts");
  writeFileSync(key, "synthetic-key\n", { mode: 0o600 });
  writeFileSync(knownHosts, "target.invalid ssh-ed25519 synthetic\n", { mode: 0o600 });

  const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const sourceRoot = path.join(state, "source-root");
  execFileSync("git", ["worktree", "add", "--detach", "--quiet", sourceRoot, commit], { cwd: root });
  let result;
  try {
    result = spawnSync("/bin/bash", [productionRunner, mode === "preflight" ? "--preflight" : "--update"], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: bin + ":" + (process.env.PATH ?? "/usr/bin:/bin"),
        RUNNER_TEMP: state,
        DEPLOY_COMMIT_SHA: commit,
        CATERING_TARGET_SOURCE_ROOT: sourceRoot,
        CATERING_TARGET_CANDIDATE_RUNTIME_IMAGE: "sha256:" + "1".repeat(64),
        CATERING_TARGET_CANDIDATE_WEB_IMAGE: "sha256:" + "2".repeat(64),
        CATERING_TARGET_DEPLOY_HOST: "target.invalid",
        CATERING_TARGET_DEPLOY_USER: "operator",
        CATERING_TARGET_SSH_KEY_FILE: key,
        CATERING_TARGET_SSH_KNOWN_HOSTS_FILE: knownHosts,
        CATERING_TARGET_CONFIRMATION: "UPDATE_CATERING_TARGET",
        CATERING_TARGET_SMOKE_BASIC_AUTH_USER: "synthetic-user",
        CATERING_TARGET_SMOKE_BASIC_AUTH_PASSWORD: "synthetic-password",
        CATERING_TARGET_SMOKE_LOGIN_CODE: "SYNTHETIC",
        CATERING_TARGET_SMOKE_PIN: "123456",
        CATERING_TARGET_FAKE_STATE: state,
        CATERING_TARGET_FAKE_SCENARIO: scenario,
        ...extraEnv
      }
    });
  } finally {
    execFileSync("git", ["worktree", "remove", "--force", sourceRoot], { cwd: root });
  }

  const commands = readFileSync(path.join(state, "commands.log"), "utf8");
  return { state, result, commands };
}

describe("Catering target production control flow", () => {
  it("keeps healthy preflight read-only", () => {
    const { result, commands } = runProduction("healthy", "preflight");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("TARGET_PREFLIGHT_OK");
    expect(commands).toContain("ssh preflight");
    expect(commands).not.toContain("lock");
    expect(commands).not.toContain("local_docker");
    expect(commands).not.toContain("rsync");
  });

  it("executes the real healthy update control flow in order", () => {
    const { result, commands } = runProduction("healthy");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("TARGET_UPDATE_RESULT updated");

    const expected = [
      "ssh preflight",
      "ssh lock",
      "ssh preflight",
      "ssh release",
      "rsync source",
      "rsync artifacts",
      "ssh release-ownership",
      "ssh candidate-bind",
      "ssh activate candidate",
      "ssh preflight",
      "ssh verify candidate",
      "ssh smoke",
      "ssh receipt",
      "ssh unlock"
    ];
    let cursor = -1;
    for (const marker of expected) {
      const next = commands.indexOf(marker, cursor + 1);
      expect(next, marker + "\n" + commands).toBeGreaterThan(cursor);
      cursor = next;
    }
  });

  it("rolls back through the real previous-image path when candidate activation fails", () => {
    const { result, commands } = runProduction("activate-fails");
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("TARGET_UPDATE_RESULT rolled_back");
    expect(commands).toContain("ssh activate candidate");
    expect(commands).toContain("ssh restore-current");
    expect(commands).toContain("ssh verify previous");
    expect(commands).toContain("ssh unlock");
  });

  it("rolls back after an authenticated smoke failure", () => {
    const { result, commands } = runProduction("smoke-fails");
    expect(result.status).not.toBe(0);
    expect(commands).toContain("ssh verify candidate");
    expect(commands).toContain("ssh smoke");
    expect(commands).toContain("ssh restore-current");
    expect(commands).toContain("ssh verify previous");
    expect(commands).toContain("ssh unlock");
    expect(commands).not.toContain("ssh receipt");
  });

  it("retains the production lock when rollback cannot be proven", () => {
    const { result, commands } = runProduction("rollback-fails");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("manual_recovery_required lock_retained=true");
    expect(commands).toContain("ssh activate candidate");
    expect(commands).toContain("ssh restore-current");
    expect(commands).not.toContain("ssh unlock");
    expect(commands).not.toContain("ssh receipt");
  });

  it("fails before every mutation when initial remote preflight fails", () => {
    const { result, commands } = runProduction("preflight-fails");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("TARGET_PREFLIGHT_FAIL gate=remote_target_invariants");
    expect(commands).toContain("ssh preflight");
    expect(commands).not.toContain("local_docker");
    expect(commands).not.toContain("ssh lock");
    expect(commands).not.toContain("rsync");
  });

  it.each(["writer-disabled", "schema-version-old"])("rejects unsafe target state before candidate binding or lock: %s", (scenario) => {
    const { result, commands } = runProduction(scenario);
    expect(result.status).not.toBe(0);
    expect(commands).toContain("ssh preflight");
    expect(commands).not.toContain("local_docker");
    expect(commands).not.toContain("ssh lock");
    expect(commands).not.toContain("rsync");
  });

  it("rejects runtime schema-migration source drift before candidate binding or lock", () => {
    const { result, commands } = runProduction("migration-source-drift");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("runtime schema migration drift");
    expect(commands).toContain("ssh schema-source");
    expect(commands).not.toContain("local_docker");
    expect(commands).not.toContain("ssh lock");
    expect(commands).not.toContain("rsync");
  });

  it("rejects runtime DDL drift outside the business-records migration before candidate binding or lock", () => {
    const { result, commands } = runProduction("source-document-ddl-drift");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("runtime DDL drift");
    expect(commands).toContain("ssh ddl-manifest");
    expect(commands).not.toContain("local_docker");
    expect(commands).not.toContain("ssh lock");
    expect(commands).not.toContain("rsync");
  });

  it("rejects a malformed fixed candidate before lock or sync", () => {
    const { result, commands } = runProduction("healthy", "update", {
      CATERING_TARGET_CANDIDATE_RUNTIME_IMAGE: "sha256:bad"
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("runtime candidate is not an immutable sha256 image");
    expect(commands).toContain("ssh preflight");
    expect(commands).not.toContain("ssh lock");
    expect(commands).not.toContain("rsync");
  });

  it("blocks a declared migration before remote preflight or candidate binding", () => {
    const { result, commands } = runProduction("healthy", "update", { CATERING_TARGET_MIGRATION_REQUIRED: "1" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("manual_migration_approval_required");
    expect(commands).toBe("");
  });
});
