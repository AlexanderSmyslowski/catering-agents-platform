import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const productionRunner = path.join(root, "platform-infra/scripts/catering-target-production-update.sh");
const fakeCommand = path.join(root, "tests/support/catering-target-production-command.py");
const fakePythonCommand = path.join(root, "tests/support/catering-target-python-command.sh");

function runProduction(scenario: string, mode: "preflight" | "update" | "stage" | "apply" | "verify" = "update", extraEnv: Record<string, string> = {}) {
  expect(existsSync(fakeCommand), "production command fixture must exist").toBe(true);

  const state = mkdtempSync(path.join(tmpdir(), "catering-target-production-controlflow-"));
  const bin = path.join(state, "bin");
  const fs = require("node:fs") as typeof import("node:fs");
  fs.mkdirSync(bin);
  writeFileSync(path.join(state, "commands.log"), "");
  const realPython = execFileSync("/bin/sh", ["-c", "command -v python3"], { encoding: "utf8" }).trim();
  const bundle = path.join(state, "bundle");
  fs.mkdirSync(bundle);
  for (const artifact of ["candidate-images.json", "manifest.json", "runtime-image.tar.gz", "web-image.tar.gz"]) {
    writeFileSync(path.join(bundle, artifact), "synthetic-bound-artifact\n");
  }
  const sourceSyncRoot = path.join(state, "source");
  const sourcePlatform = path.join(sourceSyncRoot, "platform-infra");
  fs.mkdirSync(sourcePlatform, { recursive: true });
  chmodSync(sourceSyncRoot, 0o755);
  chmodSync(sourcePlatform, 0o755);
  const composeFiles = [
    "docker-compose.catering-target.json",
    "docker-compose.catering-target.operations.json",
  ];
  const sourceFiles = Object.fromEntries(composeFiles.map((name, index) => {
    const relative = `platform-infra/${name}`;
    const content = JSON.stringify({ source: index }) + "\n";
    writeFileSync(path.join(sourcePlatform, name), content, { mode: 0o644 });
    chmodSync(path.join(sourcePlatform, name), 0o644);
    return [relative, createHash("sha256").update(content).digest("hex")];
  }));
  const runtimeImage = "sha256:" + "0".repeat(63) + "1";
  const webImage = "sha256:" + "0".repeat(63) + "2";
  const candidate = { services: {
    intake: { image: runtimeImage }, offer: { image: runtimeImage }, production: { image: runtimeImage },
    exports: { image: runtimeImage }, web: { image: webImage },
  } };
  const candidateText = JSON.stringify(candidate) + "\n";
  writeFileSync(path.join(bundle, "candidate-images.json"), candidateText, { mode: 0o644 });
  const sourceTreeRecords = [
    ["directory", "platform-infra", "0755"],
    ...Object.keys(sourceFiles).sort().map((relative) => ["file", relative, "0644", sourceFiles[relative]]),
  ];
  const sourceTreeSha256 = createHash("sha256").update(JSON.stringify(sourceTreeRecords)).digest("hex");
  const artifacts = Object.fromEntries(
    ["candidate-images.json", "runtime-image.tar.gz", "web-image.tar.gz"].map((name) => [
      name, createHash("sha256").update(readFileSync(path.join(bundle, name))).digest("hex"),
    ]),
  );
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const manifestText = JSON.stringify({
    schemaVersion: 3,
    repository: "AlexanderSmyslowski/catering-agents-platform",
    targetId: "catering-prod-1",
    platform: "linux/amd64",
    productCommit: commit,
    operationsCommit: commit,
    images: {
      runtime: { imageId: runtimeImage, archive: "runtime-image.tar.gz", services: ["intake", "offer", "production", "exports"] },
      web: { imageId: webImage, archive: "web-image.tar.gz", services: ["web"] },
    },
    artifacts,
    sourceFiles,
    sourceTreeSha256,
  });
  writeFileSync(path.join(bundle, "manifest.json"), manifestText, { mode: 0o644 });
  const manifestSha256 = createHash("sha256").update(manifestText).digest("hex");
  if (scenario === "operator-stage-source-root-mismatch") {
    writeFileSync(path.join(sourcePlatform, composeFiles[0]), '{"services":{"web":{"privileged":true}}}\n');
  }

  for (const name of ["ssh", "docker", "rsync"]) {
    symlinkSync(fakeCommand, path.join(bin, name));
  }
  symlinkSync(fakePythonCommand, path.join(bin, "python3"));
  chmodSync(fakeCommand, 0o700);

  const key = path.join(state, "id ed25519");
  const knownHosts = path.join(state, "known hosts");
  writeFileSync(key, "synthetic-key\n", { mode: 0o600 });
  writeFileSync(knownHosts, "target.invalid ssh-ed25519 synthetic\n", { mode: 0o600 });

  const eventPath = path.join(state, "event.json");
  writeFileSync(eventPath, JSON.stringify({ inputs: { commit_sha: commit, confirmation: "UPDATE_CATERING_TARGET" } }));
  const compatibilityContext = mode === "update" && scenario !== "direct-unbound";
  const operatorPhase = ["stage", "apply", "verify"].includes(mode) || scenario.startsWith("operator-");
  const runnerMode = { preflight: "--preflight", update: "--update", stage: "--stage", apply: "--apply", verify: "--verify" }[mode];
  const result = spawnSync("/bin/bash", [productionRunner, runnerMode], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: bin + ":" + (process.env.PATH ?? "/usr/bin:/bin"),
      CATERING_TARGET_REAL_PYTHON3: realPython,
      RUNNER_TEMP: state,
      DEPLOY_COMMIT_SHA: commit,
      CATERING_TARGET_OPERATIONS_COMMIT: operatorPhase ? commit : "",
      CATERING_TARGET_BUNDLE_DIR: operatorPhase ? bundle : "",
      CATERING_TARGET_MANIFEST_SHA256: operatorPhase ? manifestSha256 : "",
      CATERING_TARGET_SOURCE_SYNC_ROOT: mode === "stage" ? sourceSyncRoot : "",
      CATERING_TARGET_DEPLOY_HOST: "target.invalid",
      CATERING_TARGET_DEPLOY_USER: "operator",
      CATERING_TARGET_SSH_KEY_FILE: key,
      CATERING_TARGET_SSH_KNOWN_HOSTS_FILE: knownHosts,
      CATERING_TARGET_CONFIRMATION: mode === "stage" ? "STAGE_CATERING_TARGET" : mode === "apply" ? "ACTIVATE_CATERING_TARGET" : "UPDATE_CATERING_TARGET",
      CATERING_TARGET_SMOKE_BASIC_AUTH_USER: "synthetic-user",
      CATERING_TARGET_SMOKE_BASIC_AUTH_PASSWORD: "synthetic-password",
      CATERING_TARGET_SMOKE_LOGIN_CODE: "SYNTHETIC",
      CATERING_TARGET_SMOKE_PIN: "123456",
      CATERING_TARGET_FAKE_STATE: state,
      CATERING_TARGET_FAKE_SCENARIO: scenario,
      CATERING_TARGET_FAKE_MODE: mode,
      GITHUB_ACTIONS: compatibilityContext ? "true" : "",
      GITHUB_REPOSITORY: compatibilityContext ? "AlexanderSmyslowski/catering-agents-platform" : "",
      GITHUB_WORKFLOW: compatibilityContext ? "Update Catering target" : "",
      GITHUB_EVENT_NAME: compatibilityContext ? "workflow_dispatch" : "",
      GITHUB_REF: compatibilityContext ? "refs/heads/main" : "",
      GITHUB_WORKFLOW_REF: compatibilityContext ? "AlexanderSmyslowski/catering-agents-platform/.github/workflows/update-catering-target.yml@refs/heads/main" : "",
      GITHUB_WORKFLOW_SHA: compatibilityContext ? commit : "",
      GITHUB_EVENT_PATH: compatibilityContext ? eventPath : "",
      ...extraEnv
    }
  });

  const commands = readFileSync(path.join(state, "commands.log"), "utf8");
  return { state, result, commands };
}

describe("Catering target production control flow", () => {
  it("rejects an unbound direct mutating update before contacting the target", () => {
    const { result, commands } = runProduction("direct-unbound", "update");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("direct target mutation requires an approved operator binding");
    expect(commands).toBe("");
  });

  it("keeps healthy preflight read-only", () => {
    const { result, commands } = runProduction("healthy", "preflight");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("TARGET_PREFLIGHT_OK");
    expect(commands).toContain("ssh preflight");
    expect(commands).not.toContain("lock");
    expect(commands).not.toContain("local_docker build");
    expect(commands).not.toContain("rsync");
  });

  it("executes the real healthy update control flow in order", () => {
    const { result, commands } = runProduction("healthy");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("TARGET_UPDATE_RESULT updated");

    const expected = [
      "ssh preflight",
      "local_docker build runtime",
      "local_docker build web",
      "ssh lock",
      "ssh preflight",
      "ssh release",
      "rsync source",
      "rsync artifacts",
      "ssh load",
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

  it("stages bound artifacts without loading images or activating services", () => {
    const { result, commands } = runProduction("operator-stage", "stage");
    expect(result.status, result.stderr + "\n" + commands).toBe(0);
    expect(result.stdout).toContain("TARGET_UPDATE_RESULT staged");
    expect(commands).toContain("rsync source");
    expect(commands).toContain("rsync artifacts");
    expect(commands).toContain("ssh stage receipt write");
    expect(commands).not.toContain("local_docker build");
    expect(commands).not.toContain("ssh load");
    expect(commands).not.toContain("ssh activate");
  });

  it("reuses an identical completed stage without transferring or rewriting artifacts", () => {
    const { result, commands } = runProduction("operator-stage-reused", "stage");
    expect(result.status, result.stderr + "\n" + commands).toBe(0);
    expect(result.stdout).toContain("TARGET_UPDATE_RESULT staged_reused");
    expect(commands).toContain("ssh stage inspect reusable");
    expect(commands).not.toContain("rsync source");
    expect(commands).not.toContain("rsync artifacts");
    expect(commands).not.toContain("ssh stage receipt write");
    expect(commands).not.toContain("ssh load");
    expect(commands).not.toContain("ssh activate");
  });

  it("fails closed on a partial existing stage without overwriting or deleting it", () => {
    const { result, commands } = runProduction("operator-stage-partial", "stage");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("existing release is not a safely reusable stage");
    expect(commands).toContain("ssh stage inspect rejected");
    expect(commands).not.toContain("rsync source");
    expect(commands).not.toContain("rsync artifacts");
    expect(commands).not.toContain("ssh stage receipt write");
  });

  it("distinguishes an already installed matching release from a reusable stage", () => {
    const { result, commands } = runProduction("operator-stage-installed", "stage");
    expect(result.status, result.stderr + "\n" + commands).toBe(0);
    expect(result.stdout).toContain("TARGET_UPDATE_RESULT already_installed");
    expect(commands).toContain("ssh stage inspect installed");
    expect(commands).not.toContain("rsync source");
    expect(commands).not.toContain("rsync artifacts");
    expect(commands).not.toContain("ssh stage receipt write");
  });

  it("does not reacquire the lock or activate a matching installed release", () => {
    const { result, commands } = runProduction("operator-apply-installed", "apply");
    expect(result.status, result.stderr + "\n" + commands).toBe(0);
    expect(result.stdout).toContain("TARGET_UPDATE_RESULT already_installed");
    expect(commands).toContain("ssh stage inspect installed");
    expect(commands).toContain("ssh verify install receipt");
    expect(commands).not.toContain("ssh lock");
    expect(commands).not.toContain("ssh load");
    expect(commands).not.toContain("ssh activate candidate");
  });

  it("rejects a source-root Compose mismatch before contacting the target", () => {
    const { result, commands } = runProduction("operator-stage-source-root-mismatch", "stage");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("staged product Compose bindings are invalid");
    expect(commands).not.toContain("ssh preflight");
    expect(commands).not.toContain("rsync source");
  });

  it("fails closed on a stage binding changed before apply", () => {
    const { result, commands } = runProduction("operator-stage-binding-drift", "apply");
    expect(result.status).not.toBe(0);
    expect(commands).toContain("ssh stage receipt verify failed");
    expect(commands).not.toContain("ssh load");
    expect(commands).not.toContain("ssh activate candidate");
    expect(commands).not.toContain("ssh lock");
    expect(commands).not.toContain("ssh unlock");
    expect(result.stdout + result.stderr).not.toContain("lock_retained=true");
  });

  it("rechecks bound stage artifacts in the same remote command before image loading", () => {
    const { result, commands } = runProduction("operator-stage-binding-drift-before-load", "apply");
    expect(result.status).not.toBe(0);
    expect(commands).toContain("ssh stage receipt verify capture failed");
    expect(commands).not.toContain("ssh load");
    expect(commands).not.toContain("ssh activate candidate");
  });

  it("keeps the standalone target verification phase GitHub-free", () => {
    const { result, commands } = runProduction("operator-verify", "verify");
    expect(result.status, result.stderr + "\n" + commands).toBe(0);
    expect(result.stdout).toContain("TARGET_UPDATE_VERIFY status=success");
    expect(commands).toContain("local_bundle_bindings");
    expect(commands).not.toContain("operator_gate");
    expect(commands).not.toContain("operator_bundle_bindings");
  });

  it("finishes GitHub gates before activation and performs later checks offline", () => {
    const { result, commands } = runProduction("operator-offline-after-activate", "apply");
    expect(result.status, result.stderr + "\n" + commands).toBe(0);
    const activation = commands.indexOf("ssh activate candidate");
    expect(activation).toBeGreaterThan(-1);
    expect(commands.lastIndexOf("operator_gate", activation)).toBeGreaterThan(-1);
    expect(commands.slice(activation + 1)).not.toContain("operator_gate");
    expect(commands.slice(activation + 1)).not.toContain("operator_bundle_bindings");
    expect(commands).toContain("ssh receipt");
    expect(commands).not.toContain("rsync source");
    expect(commands).not.toContain("rsync artifacts");
    expect(commands).not.toContain("local_docker build");
  });

  it("rolls back through the real previous-image path when candidate activation fails", () => {
    const { result, commands } = runProduction("activate-fails");
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("TARGET_UPDATE_RESULT rolled_back");
    expect(commands).toContain("ssh activate candidate");
    expect(commands).toContain("ssh activate previous");
    expect(commands).toContain("ssh verify previous");
    expect(commands).toContain("ssh unlock");
  });

  it("uses the release observed under the acquired lock when another update wins the race", () => {
    const { result, commands } = runProduction("operator-rollback-snapshot-race", "apply");
    const releaseA = "a".repeat(40);
    const releaseB = "b".repeat(40);
    expect(result.status).not.toBe(0);
    expect(result.stdout, result.stderr + "\n" + commands).toContain("TARGET_UPDATE_RESULT rolled_back");
    expect(commands).toContain(`ssh preflight release=${releaseA}`);
    expect(commands).toContain(`ssh preflight release=${releaseB}`);
    expect(commands).toContain(`ssh verify rollback ${releaseB}`);
    expect(commands).not.toContain(`ssh verify rollback ${releaseA}`);
    expect(commands).toContain("ssh activate previous");
    expect(commands).toContain("ssh unlock");
  });

  it("runs the operations-bound smoke through stdin without putting credentials in the remote command", () => {
    const { result, commands } = runProduction("operator-smoke", "apply");
    expect(result.status, result.stderr + "\n" + commands).toBe(0);
    expect(result.stdout).toContain("TARGET_UPDATE_RESULT activated");
    expect(commands).toContain("ssh smoke operator plans");
    expect(commands).toContain("ssh receipt");
    expect(commands).toContain("ssh unlock");
    expect(commands).not.toContain("synthetic-password");
    expect(commands).not.toContain("synthetic-user");
  });

  it("rejects missing smoke credentials before contacting the target", () => {
    const { result, commands } = runProduction("operator-smoke", "apply", { CATERING_TARGET_SMOKE_PIN: "" });
    expect(result.status, result.stderr + "\n" + commands).not.toBe(0);
    expect(result.stderr).toContain("CATERING_TARGET_SMOKE_PIN is required");
    expect(commands).toBe("");
  });

  it("completes bundle verification before activation and does not recheck GitHub in postflight", () => {
    const { result, commands } = runProduction("operator-postflight-bundle-fails", "apply");
    expect(result.status, result.stderr + "\n" + commands).toBe(0);
    const activation = commands.indexOf("ssh activate candidate");
    expect(activation).toBeGreaterThan(-1);
    expect(commands.lastIndexOf("ssh verify bundle", activation)).toBeGreaterThan(-1);
    expect(commands.slice(activation + 1)).not.toContain("ssh verify bundle");
    expect(commands).toContain("ssh receipt");
  });

  it("rolls back after an authenticated smoke failure", () => {
    const { result, commands } = runProduction("smoke-fails");
    expect(result.status).not.toBe(0);
    expect(commands).toContain("ssh verify candidate");
    expect(commands).toContain("ssh smoke");
    expect(commands).toContain("ssh activate previous");
    expect(commands).toContain("ssh verify previous");
    expect(commands).toContain("ssh unlock");
    expect(commands).not.toContain("ssh receipt");
  });

  it("retains the production lock when rollback cannot be proven", () => {
    const { result, commands } = runProduction("rollback-fails");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("manual_recovery_required lock_retained=true");
    expect(commands).toContain("ssh activate candidate");
    expect(commands).toContain("ssh activate previous");
    expect(commands).not.toContain("ssh unlock");
    expect(commands).not.toContain("ssh receipt");
  });

  it("fails before every mutation when initial remote preflight fails", () => {
    const { result, commands } = runProduction("preflight-fails");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("TARGET_PREFLIGHT_FAIL gate=remote_target_invariants");
    expect(commands).toContain("ssh preflight");
    expect(commands).not.toContain("local_docker build");
    expect(commands).not.toContain("ssh lock");
    expect(commands).not.toContain("rsync");
  });

  it.each(["writer-disabled", "schema-version-old"])("rejects unsafe target state before build or lock: %s", (scenario) => {
    const { result, commands } = runProduction(scenario);
    expect(result.status).not.toBe(0);
    expect(commands).toContain("ssh preflight");
    expect(commands).not.toContain("local_docker build");
    expect(commands).not.toContain("ssh lock");
    expect(commands).not.toContain("rsync");
  });

  it("rejects runtime schema-migration source drift before build or lock", () => {
    const { result, commands } = runProduction("migration-source-drift");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("runtime schema migration drift");
    expect(commands).toContain("ssh schema-source");
    expect(commands).not.toContain("local_docker build");
    expect(commands).not.toContain("ssh lock");
    expect(commands).not.toContain("rsync");
  });

  it("rejects runtime DDL drift outside the business-records migration before build or lock", () => {
    const { result, commands } = runProduction("source-document-ddl-drift");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("runtime DDL drift");
    expect(commands).toContain("ssh ddl-manifest");
    expect(commands).not.toContain("local_docker build");
    expect(commands).not.toContain("ssh lock");
    expect(commands).not.toContain("rsync");
  });

  it("blocks a declared migration before remote preflight or build", () => {
    const { result, commands } = runProduction("healthy", "update", { CATERING_TARGET_MIGRATION_REQUIRED: "1" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("manual_migration_approval_required");
    expect(commands).toBe("");
  });
});
