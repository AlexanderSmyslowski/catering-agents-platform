import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");
const helperPath = path.join(repoRoot, "platform-infra/scripts/catering-phase3-pilot.sh");
const fakeDockerPath = path.join(repoRoot, "platform-infra/scripts/phase3-fake-docker.py");
const edgeDeployPath = path.join(repoRoot, "edge-infra/scripts/deploy-hetzner.sh");
const webListenerPath = path.join(repoRoot, "platform-infra/scripts/deploy-web-listener-hetzner.sh");
const edgeWorkflowPath = path.join(repoRoot, ".github/workflows/deploy-edge-production.yml");

function textAt(filePath: string) {
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}

function fieldsAt(filePath: string) {
  return new Map(
    textAt(filePath)
      .split("\n")
      .filter((line) => line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)] as const;
      })
  );
}

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function digestFile(filePath: string) {
  return digest(readFileSync(filePath, "utf8"));
}

function rewriteFields(filePath: string, updates: Record<string, string>, removals: string[] = []) {
  const remove = new Set(removals);
  const lines = textAt(filePath).split("\n").filter(Boolean);
  const seen = new Set<string>();
  const rewritten = lines.flatMap((line) => {
    const separator = line.indexOf("=");
    if (separator < 0) return [line];
    const key = line.slice(0, separator);
    if (remove.has(key)) return [];
    if (Object.hasOwn(updates, key)) {
      seen.add(key);
      return [`${key}=${updates[key]}`];
    }
    return [line];
  });
  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) rewritten.push(`${key}=${value}`);
  }
  writeFileSync(filePath, `${rewritten.join("\n")}\n`);
}

function canonicalSelfHash(filePath: string, fieldName: string) {
  return digest(textAt(filePath).replace(new RegExp(`^${fieldName}=.*$`, "m"), `${fieldName}=absent`));
}

function rebindManifestReferences(root: string) {
  const manifest = path.join(root, "phase3.transaction-baseline.manifest");
  const marker = path.join(root, "phase3.activation");
  const journal = path.join(root, "phase3.network-adoption.journal");
  const manifestHash = digestFile(manifest);
  rewriteFields(marker, { transaction_manifest_sha256: manifestHash, marker_sha256: "absent" });
  rewriteFields(marker, { marker_sha256: canonicalSelfHash(marker, "marker_sha256") });
  if (existsSync(journal)) {
    rewriteFields(journal, { transaction_manifest_sha256: manifestHash, journal_sha256: "absent" });
    rewriteFields(journal, { journal_sha256: canonicalSelfHash(journal, "journal_sha256") });
  }
  return { manifestHash, markerHash: canonicalSelfHash(marker, "marker_sha256") };
}

function convertManifestToLegacy(root: string) {
  const manifest = path.join(root, "phase3.transaction-baseline.manifest");
  rewriteFields(
    manifest,
    { schema: "phase3.1.transaction-baseline" },
    ["baseline_smoke_evidence", "baseline_smoke_sha256"],
  );
  const bindings = rebindManifestReferences(root);
  const restoreEvidence = path.join(root, "phase3.restore-evidence.record");
  let restoreEvidenceHash = "";
  if (existsSync(restoreEvidence)) {
    rewriteFields(restoreEvidence, { baseline_manifest_sha256: bindings.manifestHash });
    restoreEvidenceHash = digestFile(restoreEvidence);
  }
  const archive = path.join(root, "phase3.rollback-restore-proof.archive");
  if (existsSync(archive)) {
    rewriteFields(archive, {
      transaction_manifest_sha256: bindings.manifestHash,
      marker_sha256: bindings.markerHash,
      ...(restoreEvidenceHash ? { restore_evidence_sha256: restoreEvidenceHash } : {}),
      archive_sha256: "absent",
    });
    rewriteFields(archive, { archive_sha256: canonicalSelfHash(archive, "archive_sha256") });
  }
  const receipt = path.join(root, "phase3.rollback-completion.receipt");
  if (existsSync(receipt)) {
    const archiveHash = existsSync(archive) ? fieldsAt(archive).get("archive_sha256") ?? "" : "";
    rewriteFields(receipt, {
      transaction_manifest_sha256: bindings.manifestHash,
      marker_sha256: bindings.markerHash,
      ...(restoreEvidenceHash ? { restore_evidence_sha256: restoreEvidenceHash } : {}),
      restore_proof_archive_sha256: archiveHash,
      archive_sha256: archiveHash,
      receipt_sha256: "absent",
    });
    rewriteFields(receipt, { receipt_sha256: canonicalSelfHash(receipt, "receipt_sha256") });
  }
}

function canonicalArchiveDigest(filePath: string) {
  return digest(textAt(filePath).replace(/^archive_sha256=.*$/m, "archive_sha256=absent"));
}

function initializeFakeState(root: string) {
  mkdirSync(root, { recursive: true });
  const result = spawnSync("python3", [fakeDockerPath, "--init"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, CATERING_PHASE3_FAKE_HOST_ROOT: root },
  });
  expect(result.status).toBe(0);
}

function fakeDocker(root: string, args: string[]) {
  return spawnSync("python3", [fakeDockerPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, CATERING_PHASE3_FAKE_HOST_ROOT: root },
  });
}

function commandSandbox(root: string) {
  // The fake backend owns root/bin and replaces its entries with symlinks to
  // the repository fakes. Keep command wrappers in an independent directory
  // so a second harness run can never follow those symlinks into source files.
  const sandboxRoot = mkdtempSync(path.join(tmpdir(), "catering-phase3-command-sandbox-"));
  const bin = path.join(sandboxRoot, "bin");
  const log = path.join(sandboxRoot, "real-command-attempts.log");
  mkdirSync(bin, { recursive: true });
  const body = [
    "#!/usr/bin/env bash",
    "set -eu",
    "printf '%s\\t%s\\n' \"$(basename \"$0\")\" \"$*\" >> \"${CATERING_PHASE3_SANDBOX_LOG:?}\"",
    "exit 86",
  ].join("\n");
  for (const command of ["ssh", "docker", "docker-compose", "gh", "curl", "act"]) {
    writeFileSync(path.join(bin, command), body, { mode: 0o700 });
  }
  return { bin, log };
}

function runHarness(scenario: string, root = mkdtempSync(path.join(tmpdir(), "catering-phase3-latest-p1-"))) {
  const sandbox = commandSandbox(root);
  const result = spawnSync("/bin/bash", [helperPath, "--harness"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${sandbox.bin}:${process.env.PATH ?? ""}`,
      CATERING_PHASE3_TEST_MODE: "1",
      CATERING_PHASE3_ENVIRONMENT: "production",
      CATERING_PHASE3_EXECUTE: "1",
      CATERING_PHASE3_FAKE_HOST_ROOT: root,
      CATERING_PHASE3_HARNESS_SCENARIO: scenario,
      CATERING_PHASE3_SANDBOX_LOG: sandbox.log,
    },
  });
  return { root, sandbox, result };
}

function runExistingControl(root: string, sandbox: ReturnType<typeof commandSandbox>, command: "resume" | "rollback") {
  const result = spawnSync("/bin/bash", [helperPath, `--${command}`], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${path.join(root, "bin")}:${sandbox.bin}:${process.env.PATH ?? ""}`,
      CATERING_PHASE3_TEST_MODE: "1",
      CATERING_PHASE3_ENVIRONMENT: "production",
      CATERING_PHASE3_EXECUTE: "1",
      CATERING_PHASE3_FAKE_HOST_ROOT: root,
      CATERING_PHASE3_SANDBOX_LOG: sandbox.log,
      CATERING_PHASE3_TRANSACTION_ID: "phase3-harness",
      CATERING_PHASE3_RUN_ID: "phase3-harness",
      CATERING_PHASE3_REMOTE_ROOT: root,
      CATERING_PHASE3_PLATFORM_LOCK: path.join(root, "locks/catering-agents-platform.deploy-lock"),
      CATERING_PHASE3_EDGE_LOCK: path.join(root, "locks/shared-edge.deploy-lock"),
      CATERING_PHASE3_PLATFORM_DIR: path.join(root, "platform-infra"),
      CATERING_PHASE3_EDGE_DIR: path.join(root, "edge-infra"),
      CATERING_PHASE3_REMOTE_TMP_ROOT: path.join(root, "tmp"),
      CATERING_PHASE3_EGRESS_EXERCISE: "1",
      CATERING_PHASE3_EGRESS_URL: "https://egress.invalid/health",
      DEPLOY_HOST: "phase3.invalid",
      DEPLOY_USER: "harness",
    },
  });
  return { root, sandbox, result };
}

function runExistingResume(root: string, sandbox: ReturnType<typeof commandSandbox>) {
  return runExistingControl(root, sandbox, "resume");
}

function runExistingRollback(root: string, sandbox: ReturnType<typeof commandSandbox>) {
  return runExistingControl(root, sandbox, "rollback");
}

function remotePilotBody() {
  const source = readFileSync(helperPath, "utf8");
  const marker = "<<'REMOTE_PILOT'\n";
  const markerIndex = source.indexOf(marker);
  const bodyStart = markerIndex + marker.length;
  const bodyEnd = source.indexOf("\nREMOTE_PILOT", bodyStart);
  return markerIndex >= 0 && bodyEnd > bodyStart ? source.slice(bodyStart, bodyEnd) : "";
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function remoteScriptAt(filePath: string, anchor: string, marker: string) {
  const source = textAt(filePath);
  const anchorIndex = source.indexOf(anchor);
  expect(anchorIndex).toBeGreaterThanOrEqual(0);
  const markerText = `<<'${marker}'\n`;
  const markerIndex = source.lastIndexOf(markerText, anchorIndex);
  const bodyStart = markerIndex + markerText.length;
  const bodyEnd = source.indexOf(`\n${marker}`, bodyStart);
  expect(markerIndex).toBeGreaterThanOrEqual(0);
  expect(bodyEnd).toBeGreaterThan(bodyStart);
  return source.slice(bodyStart, bodyEnd);
}

function runEdgeRollbackCleanupReproducer() {
  const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-edge-rollback-tree-red-"));
  const deployPath = path.join(root, "shared-edge");
  const archiveStage = path.join(root, "archive-stage");
  const archive = path.join(root, "rollback.tar.gz");
  mkdirSync(path.join(deployPath, "filled", "nested"), { recursive: true });
  mkdirSync(path.join(deployPath, "rollbacks", "keep"), { recursive: true });
  mkdirSync(path.join(archiveStage, "restored", "nested"), { recursive: true });
  writeFileSync(path.join(deployPath, ".env"), "protected-env\n");
  writeFileSync(path.join(deployPath, ".deploy-manifest"), "old-manifest\n");
  writeFileSync(path.join(deployPath, "filled", "nested", "old.txt"), "old\n");
  writeFileSync(path.join(deployPath, "rollbacks", "keep", "audit.txt"), "keep\n");
  writeFileSync(path.join(archiveStage, "restored", "nested", "restored.txt"), "restored\n");
  const archiveResult = spawnSync("tar", ["-czf", archive, "-C", archiveStage, "."], { encoding: "utf8" });
  expect(archiveResult.status).toBe(0);
  writeFileSync(`${archive}.manifest`, "restored-manifest\n");

  const body = remoteScriptAt(edgeDeployPath, 'archive="$2"', "REMOTE_SCRIPT");
  return {
    deployPath,
    result: spawnSync("/bin/bash", ["-s", deployPath, archive, "rehearsal"], {
      cwd: repoRoot,
      encoding: "utf8",
      input: [
        'sudo() { "$@"; }',
        "docker() { return 0; }",
        body,
      ].join("\n"),
    }),
  };
}

function runWebListenerRollbackCleanupReproducer() {
  const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-web-rollback-tree-red-"));
  const deployPath = path.join(root, "catering");
  const archiveStage = path.join(root, "archive-stage");
  const archive = path.join(root, "rollback.tar.gz");
  mkdirSync(path.join(deployPath, "filled", "nested"), { recursive: true });
  mkdirSync(path.join(deployPath, "rollbacks", "keep"), { recursive: true });
  mkdirSync(path.join(deployPath, "data", "runtime", "keep"), { recursive: true });
  mkdirSync(path.join(deployPath, "platform-infra", "sites", "live", "keep"), { recursive: true });
  mkdirSync(path.join(deployPath, "platform-infra", "stale"), { recursive: true });
  mkdirSync(path.join(archiveStage, "restored", "nested"), { recursive: true });
  mkdirSync(path.join(archiveStage, "platform-infra"), { recursive: true });
  writeFileSync(path.join(deployPath, ".env"), "protected-env\n");
  writeFileSync(path.join(deployPath, ".deploy-manifest"), "old-manifest\n");
  writeFileSync(path.join(deployPath, "filled", "nested", "old.txt"), "old\n");
  writeFileSync(path.join(deployPath, "rollbacks", "keep", "audit.txt"), "keep\n");
  writeFileSync(path.join(deployPath, "data", "runtime", "keep", "state.db"), "runtime-state\n");
  writeFileSync(path.join(deployPath, "platform-infra", ".env"), "platform-env\n");
  writeFileSync(path.join(deployPath, "platform-infra", "sites", "live", "keep", "site.conf"), "site-state\n");
  writeFileSync(path.join(deployPath, "platform-infra", "stale", "old.conf"), "stale\n");
  writeFileSync(path.join(archiveStage, ".deploy-manifest"), "restored-manifest\n");
  writeFileSync(path.join(archiveStage, "restored", "nested", "restored.txt"), "restored\n");
  writeFileSync(path.join(archiveStage, "platform-infra", "docker-compose.yml"), "services: {}\n");
  const archiveResult = spawnSync("tar", ["-czf", archive, "-C", archiveStage, "."], { encoding: "utf8" });
  expect(archiveResult.status).toBe(0);

  const body = remoteScriptAt(webListenerPath, 'deploy_path="$1"\narchive="$2"\nmode="$3"', "REMOTE_WEB_RESTORE");
  const expectedPorts = '{"80/tcp":[]}';
  return {
    deployPath,
    result: spawnSync("/bin/bash", ["-s", deployPath, archive, "rehearsal", "image-old", expectedPorts], {
      cwd: repoRoot,
      encoding: "utf8",
      input: [
        'sudo() { "$@"; }',
        'docker() { if [[ "$1" == inspect ]]; then printf "%s" "$expected_ports"; fi; return 0; }',
        body,
      ].join("\n"),
    }),
  };
}

function runPostRestoreSmokeFailureReproducer() {
  const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-post-restore-smoke-red-"));
  const eventLog = path.join(root, "events.log");
  const baselineManifest = path.join(root, "baseline.manifest");
  const foreignSnapshot = path.join(root, "foreign.snapshot");
  const sharedEdgeSnapshot = path.join(root, "shared-edge.snapshot");
  const restoreEvidence = path.join(root, "restore-evidence.record");
  const restoreArchive = path.join(root, "restore-proof.archive");
  const completionReceipt = path.join(root, "completion.receipt");
  const platformLock = path.join(root, "locks", "catering-agents-platform.deploy-lock");
  const edgeLock = path.join(root, "locks", "shared-edge.deploy-lock");
  const marker = path.join(root, "phase3.activation");
  writeFileSync(baselineManifest, "baseline\n");
  writeFileSync(foreignSnapshot, "snapshot\nsnapshot\n");
  writeFileSync(sharedEdgeSnapshot, "snapshot\n");
  mkdirSync(platformLock, { recursive: true });
  mkdirSync(edgeLock, { recursive: true });
  writeFileSync(path.join(platformLock, "owner"), "platform-owner\n");
  writeFileSync(path.join(edgeLock, "owner"), "edge-owner\n");
  writeFileSync(marker, "state=active\n");
  const body = remotePilotBody();
  const cleanupStart = body.indexOf("cleanup_temp_files() {");
  const cleanupEnd = body.indexOf("\ntrap cleanup_temp_files EXIT", cleanupStart);
  const rollbackStart = body.indexOf("rollback_transaction() {");
  const rollbackEnd = body.indexOf("\nwrite_marker candidate", rollbackStart);
  expect(cleanupStart).toBeGreaterThanOrEqual(0);
  expect(cleanupEnd).toBeGreaterThan(cleanupStart);
  expect(rollbackStart).toBeGreaterThanOrEqual(0);
  expect(rollbackEnd).toBeGreaterThan(rollbackStart);
  const prefix = [
    "set +e",
    `event_log=${shellQuote(eventLog)}`,
    `baseline_manifest=${shellQuote(baselineManifest)}`,
    `foreign_snapshot=${shellQuote(foreignSnapshot)}`,
    `shared_edge_snapshot=${shellQuote(sharedEdgeSnapshot)}`,
    `restore_evidence_record=${shellQuote(restoreEvidence)}`,
    `restore_proof_archive=${shellQuote(restoreArchive)}`,
    `completion_receipt=${shellQuote(completionReceipt)}`,
    `activation_marker=${shellQuote(marker)}`,
    `prior_marker_backup=${shellQuote(path.join(root, "prior.marker"))}`,
    `platform_lock=${shellQuote(platformLock)}`,
    `edge_lock=${shellQuote(edgeLock)}`,
    "owner=catering-agents-platform",
    "schema=phase3.1",
    "transaction_id=phase3-post-restore-smoke",
    "transaction_manifest_sha256=manifesthash",
    "prior_marker_state=absent",
    "ingress_id=ingress-id",
    "private_id=private-id",
    "ingress_status=present",
    "private_status=present",
    "platform_source=/tmp/absent-platform-source",
    "edge_source=/tmp/absent-edge-source",
    "SHARED_EDGE=shared-edge-edge-1",
    "FOREIGN_CONTAINERS=(foreign-a foreign-b)",
    "platform_lock_mode=acquired",
    "edge_lock_mode=acquired",
    "candidate_written=true",
    "rollback_started=false",
    "rollback_complete=false",
    'sudo() { "$@"; }',
    'docker() { if [[ "$1" == inspect ]]; then printf "snapshot\\n"; printf "restore-readback\\n" >> "$event_log"; fi; return 0; }',
    "register_temp() { :; }",
    "temp_cleanup() { :; }",
    "write_marker() { printf 'state=%s\\n' \"$1\" > \"$activation_marker\"; }",
    "phase3_lock_release_checked() { printf 'release=%s\\n' \"$1\" >> \"$event_log\"; return 0; }",
    "connect_if_missing() { :; }",
    "disconnect_if_attached() { :; }",
    "assert_compatibility_baseline() { :; }",
    "write_restore_evidence_normal() { printf 'evidence\\n' >> \"$event_log\"; printf 'evidence\\n' > \"$restore_evidence_record\"; }",
    "run_all_host_semantic_smokes() { printf 'post-restore-smoke\\n' >> \"$event_log\"; return 1; }",
    "run_rollback_host_semantic_smokes() { run_all_host_semantic_smokes; }",
    "canonical_marker_sha256() { printf 'markerhash'; }",
    "canonical_archive_sha256() { printf 'archivehash'; }",
    "atomic_record() { cp \"$2\" \"$1\"; printf 'atomic=%s\\n' \"$1\" >> \"$event_log\"; }",
    "validate_completion_receipt_normal() { printf 'receipt-validated\\n' >> \"$event_log\"; }",
  ].join("\n");
  return {
    eventLog,
    restoreEvidence,
    restoreArchive,
    completionReceipt,
    baselineManifest,
    result: spawnSync("/bin/bash", ["-s", "post-restore-smoke-reproducer"], {
      cwd: repoRoot,
      encoding: "utf8",
      input: `${prefix}\n${body.slice(cleanupStart, cleanupEnd)}\n${body.slice(rollbackStart, rollbackEnd)}\nfalse\ncleanup_temp_files\n`,
    }),
  };
}

function remoteControlBody() {
  const source = readFileSync(helperPath, "utf8");
  const marker = "<<'REMOTE_CONTROL'\n";
  const markerIndex = source.indexOf(marker);
  const bodyStart = markerIndex + marker.length;
  const bodyEnd = source.indexOf("\nREMOTE_CONTROL", bodyStart);
  return markerIndex >= 0 && bodyEnd > bodyStart ? source.slice(bodyStart, bodyEnd) : "";
}

function runReenteredControlRelease(failEdge = false) {
  const body = remoteControlBody();
  const start = body.indexOf("release_control_locks()");
  const end = body.indexOf("\ntrap release_control_locks EXIT", start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  const prefix = [
    "set -euo pipefail",
    "held_edge=reentered",
    "held_platform=reentered",
    "edge_lock=/tmp/reentered-edge-lock",
    "platform_lock=/tmp/reentered-platform-lock",
    "lock_token=phase3-owner:phase3-run",
    "phase3_lock_release() {",
    "  printf 'release=%s\\n' \"$1\"",
    `  if [[ "${failEdge ? 1 : 0}" == 1 && "$1" == "$edge_lock" ]]; then return 1; fi`,
    "}",
  ].join("\n");
  return spawnSync("/bin/bash", ["-s"], {
    cwd: repoRoot,
    encoding: "utf8",
    input: `${prefix}\n${body.slice(start, end)}\nrelease_control_locks terminal\n`,
  });
}

function runExplicitRollbackReproducer(smokeFails = false) {
  const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-explicit-rollback-red-"));
  const eventLog = path.join(root, "events.log");
  const marker = path.join(root, "phase3.activation");
  const baselineManifest = path.join(root, "phase3.transaction-baseline.manifest");
  const restoreArchive = path.join(root, "phase3.rollback-restore-proof.archive");
  const completionReceipt = path.join(root, "phase3.rollback-completion.receipt");
  const restoreEvidence = path.join(root, "phase3.restore-evidence.record");
  const platformLock = path.join(root, "locks", "catering-agents-platform.deploy-lock");
  const edgeLock = path.join(root, "locks", "shared-edge.deploy-lock");
  mkdirSync(platformLock, { recursive: true });
  mkdirSync(edgeLock, { recursive: true });
  writeFileSync(marker, "state=active\n");
  writeFileSync(baselineManifest, "baseline\n");

  const body = remoteControlBody();
  const releaseStart = body.indexOf("release_control_locks() {");
  const releaseEnd = body.indexOf("\ntrap release_control_locks EXIT", releaseStart);
  const rollbackStart = body.indexOf('elif [[ "${command_name}" == rollback ]]; then');
  const rollbackEnd = body.indexOf("\nelse\n  fail", rollbackStart);
  expect(releaseStart).toBeGreaterThanOrEqual(0);
  expect(releaseEnd).toBeGreaterThan(releaseStart);
  expect(rollbackStart).toBeGreaterThanOrEqual(0);
  expect(rollbackEnd).toBeGreaterThan(rollbackStart);
  const rollbackBody = body.slice(rollbackStart).slice(body.slice(rollbackStart).indexOf("\n") + 1, rollbackEnd - rollbackStart);
  const prefix = [
    "set -euo pipefail",
    `event_log=${shellQuote(eventLog)}`,
    `activation_marker=${shellQuote(marker)}`,
    `baseline_manifest=${shellQuote(baselineManifest)}`,
    `restore_proof_archive=${shellQuote(restoreArchive)}`,
    `completion_receipt=${shellQuote(completionReceipt)}`,
    `restore_evidence_record=${shellQuote(restoreEvidence)}`,
    `adoption_journal=${shellQuote(path.join(root, "phase3.network-adoption.journal"))}`,
    `platform_source=${shellQuote(path.join(root, "platform-compose.phase3.yml"))}`,
    `edge_source=${shellQuote(path.join(root, "edge-compose.phase3.yml"))}`,
    `pilot_root=${shellQuote(root)}`,
    "command_name=rollback",
    "run_id=phase3-explicit-rollback",
    "owner=catering-agents-platform",
    "schema=phase3.1",
    `platform_lock=${shellQuote(platformLock)}`,
    `edge_lock=${shellQuote(edgeLock)}`,
    "lock_token=catering-agents-platform:phase3-explicit-rollback",
    "manifest_sha256=manifesthash",
    "expected_platform_source_sha256=platformhash",
    "expected_edge_source_sha256=edgehash",
    "egress_exercise=1",
    "held_edge=reentered",
    "held_platform=reentered",
    "sudo() { \"$@\"; }",
    "docker() {",
    "  if [[ \"$1\" == inspect ]]; then printf '{}'; return 0; fi",
    "  if [[ \"$1\" == network && \"$2\" == inspect ]]; then return 0; fi",
    "  return 0",
    "}",
    "field() {",
    "  case \"$2\" in",
    "    platform_source_prior|edge_source_prior|prior_marker_state) printf 'absent' ;;",
    "    catering_private_created_by_run_authorized|catering_ingress_created_by_run_authorized) printf 'false' ;;",
    "    *) printf 'absent' ;;",
    "  esac",
    "}",
    "fail() { printf '%s\\n' 'PILOT: NO-GO' >&2; return 1; }",
    "validate_compatibility_baseline_control() { :; }",
    "validate_network_provenance() { :; }",
    "validate_receipt() { :; }",
    "canonical_marker_sha256() { printf 'markerhash'; }",
    "canonical_archive_sha256() { printf 'archivehash'; }",
    "write_control_marker() { printf 'marker=%s\\n' \"$1\" >> \"$event_log\"; printf 'state=%s\\nsmoke_readback_sha256=pending\\n' \"$1\" > \"$activation_marker\"; }",
    "run_all_host_semantic_smokes() {",
    `  printf '%s\\n' 'post-restore-smoke:catering,zeiterfassung,eventos' >> \"$event_log\"; [[ \"${smokeFails ? 1 : 0}\" == 0 ]] || return 1; smoke_readback_sha256=smokehash;`,
    "}",
    "run_rollback_host_semantic_smokes() { run_all_host_semantic_smokes; }",
    "write_restore_evidence_control() { printf '%s\\n' evidence >> \"$event_log\"; printf '%s\\n' evidence > \"$restore_evidence_record\"; }",
    "finalize_rolling_back_resume() { printf '%s\\n' finalize >> \"$event_log\"; unlink \"$activation_marker\"; unlink \"$baseline_manifest\"; unlink \"$completion_receipt\" 2>/dev/null || true; }",
    "phase3_lock_release() { printf 'release=%s\\n' \"$1\" >> \"$event_log\"; rmdir \"$1\"; }",
    body.slice(releaseStart, releaseEnd),
    `run_explicit_rollback() {\n${rollbackBody}\n}`,
    "trap release_control_locks EXIT",
    "run_explicit_rollback",
  ].join("\n");
  return {
    root,
    marker,
    restoreArchive,
    completionReceipt,
    restoreEvidence,
    platformLock,
    edgeLock,
    eventLog,
    result: spawnSync("/bin/bash", ["-s"], {
      cwd: repoRoot,
      encoding: "utf8",
      input: prefix,
    }),
  };
}

function runForeignEdgeLockReproducer(failPlatformUnlink = false) {
  const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-lock-pair-"));
  const pilotRoot = path.join(root, "pilot");
  const tmpRoot = path.join(root, "tmp");
  const locksRoot = path.join(root, "locks");
  mkdirSync(pilotRoot, { recursive: true });
  mkdirSync(tmpRoot, { recursive: true });
  mkdirSync(locksRoot, { recursive: true });
  const platformLock = path.join(locksRoot, "catering-agents-platform.deploy-lock");
  const edgeLock = path.join(locksRoot, "shared-edge.deploy-lock");
  mkdirSync(edgeLock, { mode: 0o700 });
  const foreignOwner = "owner_token=foreign-owner:foreign-run\nowner=foreign-owner\ntransaction_id=foreign-run\n";
  const edgeOwner = path.join(edgeLock, "owner");
  writeFileSync(edgeOwner, foreignOwner);
  chmodSync(edgeOwner, 0o600);
  const args = [
    "phase3-independent-lock",
    path.join(tmpRoot, "platform-stage"),
    path.join(tmpRoot, "edge-stage"),
    "0".repeat(64),
    "1".repeat(64),
    pilotRoot,
    platformLock,
    edgeLock,
    path.join(pilotRoot, "platform-compose.phase3.yml"),
    path.join(pilotRoot, "edge-compose.phase3.yml"),
    path.join(pilotRoot, "phase3.activation"),
    path.join(pilotRoot, "phase3.transaction-baseline.manifest"),
    path.join(pilotRoot, "phase3.rollback-restore-proof.archive"),
    path.join(pilotRoot, "phase3.rollback-completion.receipt"),
    path.join(pilotRoot, "phase3.restore-evidence.record"),
    path.join(pilotRoot, "phase3.network-adoption.journal"),
    "0",
    "https://egress.invalid/health",
    path.join(root, "platform-runtime"),
    path.join(root, "edge-runtime"),
  ];
  const sudoFunction = [
    "set -euo pipefail",
    "sudo() {",
    `  if [[ "${failPlatformUnlink ? 1 : 0}" == 1 && "$1" == unlink && "$2" == *"catering-agents-platform.deploy-lock/owner" ]]; then return 1; fi`,
    "  command \"$@\"",
    "}",
  ].join("\n");
  const result = spawnSync("/bin/bash", ["-s", "--", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, TMPDIR: tmpRoot },
    input: `${sudoFunction}\n${remotePilotBody()}\n`,
  });
  return { result, platformLock, edgeLock, edgeOwner, foreignOwner };
}

function runSuccessReleaseBlock(failEdge = false) {
  const helper = readFileSync(helperPath, "utf8");
  const successComment = helper.indexOf("# A successful transaction may emit GO only");
  const start = helper.indexOf('[[ -e "${platform_stage}" ]] && unlink "${platform_stage}"', successComment);
  const end = helper.indexOf("\n# Rollback authority", start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  const prefix = [
    "set -euo pipefail",
    "platform_lock_mode=acquired",
    "edge_lock_mode=acquired",
    "platform_lock=/tmp/platform-lock-for-repro",
    "edge_lock=/tmp/edge-lock-for-repro",
    "platform_stage=/tmp/platform-stage-for-repro",
    "edge_stage=/tmp/edge-stage-for-repro",
    "owner=catering-agents-platform",
    "transaction_id=phase3-order-repro",
    "fail() { printf '%s\\n' 'NO-GO'; return 1; }",
    "temp_cleanup() { :; }",
    "phase3_lock_release() {",
    "  printf 'release=%s\\n' \"$1\"",
    `  if [[ "${failEdge ? 1 : 0}" == 1 && "$1" == "$edge_lock" ]]; then return 1; fi`,
    "}",
  ].join("\n");
  return spawnSync("/bin/bash", ["-s"], {
    cwd: repoRoot,
    encoding: "utf8",
    input: `${prefix}\n${helper.slice(start, end)}\n`,
  });
}

function runPreCandidateAcquiredCleanup(failLock: "edge" | "platform" | "none" = "none") {
  const body = remotePilotBody();
  const start = body.indexOf("cleanup_temp_files() {");
  const end = body.indexOf("\ntrap cleanup_temp_files EXIT", start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  const prefix = [
    "set +e",
    "platform_lock_mode=acquired",
    "edge_lock_mode=acquired",
    "platform_lock_held=true",
    "edge_lock_held=true",
    "candidate_written=false",
    "rollback_started=false",
    "rollback_complete=false",
    "platform_lock=/tmp/pre-candidate-platform-lock",
    "edge_lock=/tmp/pre-candidate-edge-lock",
    "owner=catering-agents-platform",
    "transaction_id=phase3-pre-candidate",
    "prior_marker_backup=/tmp/pre-candidate-marker",
    "platform_stage=/tmp/pre-candidate-platform-stage",
    "edge_stage=/tmp/pre-candidate-edge-stage",
    "temp_cleanup() { :; }",
    "phase3_lock_release_checked() {",
    "  printf 'release=%s\\n' \"$1\"",
    `  if [[ \"${failLock}\" == edge && \"$1\" == /tmp/pre-candidate-edge-lock ]] || [[ \"${failLock}\" == platform && \"$1\" == /tmp/pre-candidate-platform-lock ]]; then return 1; fi`,
    "  return 0",
    "}",
    "false",
  ].join("\n");
  return spawnSync("/bin/bash", ["-s"], {
    cwd: repoRoot,
    encoding: "utf8",
    input: `${prefix}\n${body.slice(start, end)}\nfalse\ncleanup_temp_files\n`,
  });
}

function runRollbackReleaseCleanup(failLock: "edge" | "platform" | "none" = "none") {
  const body = remotePilotBody();
  const start = body.indexOf("cleanup_temp_files() {");
  const end = body.indexOf("\ntrap cleanup_temp_files EXIT", start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  const prefix = [
    "set +e",
    "platform_lock_mode=acquired",
    "edge_lock_mode=acquired",
    "platform_lock_held=true",
    "edge_lock_held=true",
    "candidate_written=true",
    "rollback_started=true",
    "rollback_complete=true",
    "platform_lock=/tmp/rollback-platform-lock",
    "edge_lock=/tmp/rollback-edge-lock",
    "owner=catering-agents-platform",
    "transaction_id=phase3-rollback-release",
    "prior_marker_backup=/tmp/rollback-marker",
    "platform_stage=/tmp/rollback-platform-stage",
    "edge_stage=/tmp/rollback-edge-stage",
    "temp_cleanup() { :; }",
    "phase3_lock_release_checked() {",
    "  printf 'checked=%s\\n' \"$1\"",
    `  if [[ \"${failLock}\" == edge && \"$1\" == /tmp/rollback-edge-lock ]] || [[ \"${failLock}\" == platform && \"$1\" == /tmp/rollback-platform-lock ]]; then return 1; fi`,
    "  return 0",
    "}",
    "phase3_lock_release() { printf 'unsafe-release=%s\\n' \"$1\"; return 0; }",
    "false",
  ].join("\n");
  return spawnSync("/bin/bash", ["-s"], {
    cwd: repoRoot,
    encoding: "utf8",
    input: `${prefix}\n${body.slice(start, end)}\nfalse\ncleanup_temp_files\n`,
  });
}

describe("latest independent Phase-3 P1 review reproducers", () => {
  test("harness self-integrity survives two runs with the same backend root", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-harness-integrity-"));
    const beforeBytes = readFileSync(fakeDockerPath).length;
    const beforeSha256 = digestFile(fakeDockerPath);

    runHarness("crash-after-ingress", root);
    runHarness("crash-after-ingress", root);

    expect(readFileSync(fakeDockerPath).length).toBe(beforeBytes);
    expect(digestFile(fakeDockerPath)).toBe(beforeSha256);
  }, 120_000);

  test("RED: fake Docker models shortened network ls IDs and the helper requests canonical full IDs", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-network-id-red-"));
    initializeFakeState(root);
    const short = fakeDocker(root, ["network", "ls", "--filter", "name=^platform-infra_default$", "--format", "{{.ID}"]);
    const full = fakeDocker(root, ["network", "ls", "--no-trunc", "--filter", "name=^platform-infra_default$", "--format", "{{.ID}"]);
    const inspected = fakeDocker(root, ["network", "inspect", "--format", "{{.Id}}", "platform-infra_default"]);
    expect(short.status).toBe(0);
    expect(full.status).toBe(0);
    expect(inspected.status).toBe(0);
    expect(short.stdout.trim()).toMatch(/^[0-9a-f]{12}$/);
    expect(full.stdout.trim()).toMatch(/^[0-9a-f]{64}$/);
    expect(inspected.stdout.trim()).toBe(full.stdout.trim());

    const helper = textAt(helperPath);
    expect(helper).toContain("docker network ls --no-trunc");
    expect(helper).not.toMatch(/\^sha256:/);
    expect(helper).toMatch(/canonical_network_id|network_id/);
  });

  test("RED: a foreign second lock failure releases only this run's first lock", () => {
    const run = runForeignEdgeLockReproducer();
    expect(run.result.status).not.toBe(0);
    expect(existsSync(run.platformLock)).toBe(false);
    expect(existsSync(run.edgeLock)).toBe(true);
    expect(readFileSync(run.edgeOwner, "utf8")).toBe(run.foreignOwner);
  }, 20_000);

  test("RED: partial lock cleanup failure remains recovery-required", () => {
    const run = runForeignEdgeLockReproducer(true);
    expect(run.result.status).not.toBe(0);
    expect(`${run.result.stdout}${run.result.stderr}`).toContain("RECOVERY_REQUIRED");
    expect(existsSync(run.platformLock)).toBe(true);
    expect(existsSync(run.edgeLock)).toBe(true);
    expect(readFileSync(run.edgeOwner, "utf8")).toBe(run.foreignOwner);
  }, 20_000);

  test("RED: terminal recovery releases authenticated reentered locks edge-first", () => {
    const success = runReenteredControlRelease();
    expect(success.status).toBe(0);
    expect(success.stdout.split("\n").filter(Boolean)).toEqual([
      "release=/tmp/reentered-edge-lock",
      "release=/tmp/reentered-platform-lock",
    ]);

    const failedEdge = runReenteredControlRelease(true);
    expect(failedEdge.status).not.toBe(0);
    expect(failedEdge.stdout).toContain("release=/tmp/reentered-edge-lock");
    expect(failedEdge.stdout).not.toContain("release=/tmp/reentered-platform-lock");
    expect(`${failedEdge.stdout}${failedEdge.stderr}`).toContain("RECOVERY_REQUIRED");
  });

  test("RED: explicit rollback releases authenticated reentered locks after restore proof", () => {
    const rollback = runExplicitRollbackReproducer();
    const events = textAt(rollback.eventLog).split("\n").filter(Boolean);
    expect(rollback.result.status).toBe(0);
    expect(`${rollback.result.stdout}${rollback.result.stderr}`).toContain("PILOT: ROLLED BACK");
    expect(events).toContain("post-restore-smoke:catering,zeiterfassung,eventos");
    expect(events.indexOf("post-restore-smoke:catering,zeiterfassung,eventos")).toBeLessThan(events.indexOf("evidence"));
    expect(events.indexOf("evidence")).toBeLessThan(events.indexOf("finalize"));
    expect(events.slice(-2)).toEqual([`release=${rollback.edgeLock}`, `release=${rollback.platformLock}`]);
    expect(existsSync(rollback.edgeLock)).toBe(false);
    expect(existsSync(rollback.platformLock)).toBe(false);
    expect(existsSync(rollback.marker)).toBe(false);
  });

  test("RED: explicit rollback smoke failure keeps marker and locks recovery-required", () => {
    const rollback = runExplicitRollbackReproducer(true);
    const events = textAt(rollback.eventLog);
    const terminal = `${rollback.result.stdout}${rollback.result.stderr}`;
    expect(rollback.result.status).not.toBe(0);
    expect(terminal).toContain("PILOT: RECOVERY_REQUIRED");
    expect(terminal).not.toContain("PILOT: ROLLED BACK");
    expect(events).toContain("post-restore-smoke:catering,zeiterfassung,eventos");
    expect(events).not.toContain("evidence");
    expect(events).not.toContain("finalize");
    expect(events).not.toContain("release=");
    expect(existsSync(rollback.marker)).toBe(true);
    expect(existsSync(rollback.edgeLock)).toBe(true);
    expect(existsSync(rollback.platformLock)).toBe(true);
    expect(existsSync(rollback.restoreEvidence)).toBe(false);
    expect(existsSync(rollback.restoreArchive)).toBe(false);
    expect(existsSync(rollback.completionReceipt)).toBe(false);
  });

  test("RED: resume replays bound provider egress and every host smoke after cutover", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-resume-host-gates-red-"));
    const crashed = runHarness("crash-after-active", root);
    expect(crashed.result.status).not.toBe(0);
    const logPath = path.join(root, "fake-docker.log");
    const beforeLog = textAt(logPath);
    const resumed = runHarness("resume-active", root);
    expect(resumed.result.status).toBe(0);
    expect(`${resumed.result.stdout}${resumed.result.stderr}`).toContain("PILOT: GO");
    const addedLog = textAt(logPath).slice(beforeLog.length);
    expect(addedLog).toContain("exec platform-infra-production-1");
    expect(addedLog).toContain("zeiterfassung-app-1:3040");
    expect(addedLog).toContain("commcats-eventos-app:3045");
    expect(addedLog).not.toContain("https://egress.invalid/health");
    expect(fieldsAt(path.join(root, "phase3.activation")).get("egress")).toBe("exercised");
  }, 120_000);

  test.each(["egress-fail", "foreign-smoke-fail"])("RED: resume fails closed when %s invalidates terminal evidence", (fault) => {
    const root = mkdtempSync(path.join(tmpdir(), `catering-phase3-resume-${fault}-red-`));
    const crashed = runHarness("crash-after-active", root);
    expect(crashed.result.status).not.toBe(0);
    const statePath = path.join(root, "fake-docker-state.json");
    const state = JSON.parse(textAt(statePath)) as { fault: string; fault_triggered: boolean };
    state.fault = fault;
    state.fault_triggered = false;
    writeFileSync(statePath, JSON.stringify(state));
    const resumed = runExistingResume(root, crashed.sandbox);
    expect(resumed.result.status).not.toBe(0);
    expect(`${resumed.result.stdout}${resumed.result.stderr}`).not.toContain("PILOT: GO\n");
    expect(fieldsAt(path.join(root, "phase3.activation")).get("state")).toBe("active");
  }, 120_000);

  test.each(["crash-after-candidate", "crash-after-active"])("RED: legacy %s manifest remains explicitly rollback-recoverable", (scenario) => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-legacy-rollback-red-"));
    const crashed = runHarness(scenario, root);
    expect(crashed.result.status).not.toBe(0);
    convertManifestToLegacy(root);

    const rolledBack = runExistingRollback(root, crashed.sandbox);
    const terminal = `${rolledBack.result.stdout}${rolledBack.result.stderr}`;
    expect(rolledBack.result.status).toBe(0);
    expect(terminal).toContain("PILOT: ROLLED BACK");
    expect(existsSync(path.join(root, "phase3.activation"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.transaction-baseline.manifest"))).toBe(false);
  }, 120_000);

  test("RED: legacy rolling_back manifest resumes only rollback finalization", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-legacy-rolling-back-red-"));
    const crashed = runHarness("crash-after-receipt", root);
    expect(crashed.result.status).not.toBe(0);
    expect(fieldsAt(path.join(root, "phase3.activation")).get("state")).toBe("rolling_back");
    convertManifestToLegacy(root);

    const resumed = runExistingResume(root, crashed.sandbox);
    const terminal = `${resumed.result.stdout}${resumed.result.stderr}`;
    expect(resumed.result.status).toBe(0);
    expect(terminal).toContain("PILOT: ROLLED BACK");
    expect(existsSync(path.join(root, "phase3.activation"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.transaction-baseline.manifest"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.rollback-completion.receipt"))).toBe(false);
  }, 120_000);

  test("RED: legacy rolling_back crash before evidence resumes the rollback idempotently", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-legacy-rolling-back-pre-evidence-red-"));
    const crashed = runHarness("crash-after-rollback", root);
    expect(crashed.result.status).not.toBe(0);
    expect(fieldsAt(path.join(root, "phase3.activation")).get("state")).toBe("rolling_back");
    expect(existsSync(path.join(root, "phase3.rollback-restore-proof.archive"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.rollback-completion.receipt"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.restore-evidence.record"))).toBe(false);
    convertManifestToLegacy(root);

    const beforeLog = textAt(path.join(root, "fake-docker.log"));
    const resumed = runExistingResume(root, crashed.sandbox);
    const terminal = `${resumed.result.stdout}${resumed.result.stderr}`;
    const addedLog = textAt(path.join(root, "fake-docker.log")).slice(beforeLog.length);
    expect(resumed.result.status).toBe(0);
    expect(terminal).toContain("PILOT: ROLLED BACK");
    expect(terminal).not.toContain("PILOT: GO\n");
    expect(addedLog).not.toMatch(/network create/);
    expect(existsSync(path.join(root, "phase3.activation"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.transaction-baseline.manifest"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.rollback-restore-proof.archive"))).toBe(true);
    expect(existsSync(path.join(root, "phase3.restore-evidence.record"))).toBe(true);
    expect(existsSync(path.join(root, "phase3.rollback-completion.receipt"))).toBe(false);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(false);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(false);
  }, 120_000);

  test("RED: legacy rolling_back partial evidence remains fail-closed", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-legacy-rolling-back-partial-evidence-red-"));
    const crashed = runHarness("crash-after-receipt", root);
    expect(crashed.result.status).not.toBe(0);
    convertManifestToLegacy(root);
    writeFileSync(path.join(root, "phase3.rollback-completion.receipt"), "schema=broken\n");

    const resumed = runExistingResume(root, crashed.sandbox);
    const terminal = `${resumed.result.stdout}${resumed.result.stderr}`;
    expect(resumed.result.status).not.toBe(0);
    expect(terminal).toContain("PILOT: NO-GO");
    expect(terminal).not.toContain("PILOT: GO\n");
    expect(fieldsAt(path.join(root, "phase3.activation")).get("state")).toBe("rolling_back");
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(true);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(true);
  }, 120_000);

  test("RED: legacy rolling_back rejects an explicit rollback command", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-legacy-rolling-back-command-red-"));
    const crashed = runHarness("crash-after-receipt", root);
    expect(crashed.result.status).not.toBe(0);
    convertManifestToLegacy(root);
    const beforeLog = textAt(path.join(root, "fake-docker.log"));

    const rolledBack = runExistingRollback(root, crashed.sandbox);
    const terminal = `${rolledBack.result.stdout}${rolledBack.result.stderr}`;
    const addedLog = textAt(path.join(root, "fake-docker.log")).slice(beforeLog.length);
    expect(rolledBack.result.status).not.toBe(0);
    expect(terminal).toContain("PILOT: NO-GO");
    expect(fieldsAt(path.join(root, "phase3.activation")).get("state")).toBe("rolling_back");
    expect(addedLog).not.toMatch(/network (?:create|connect|disconnect)/);
  }, 120_000);

  test("RED: legacy candidate cannot forward-resume or claim GO", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-legacy-forward-resume-red-"));
    const crashed = runHarness("crash-after-candidate", root);
    expect(crashed.result.status).not.toBe(0);
    convertManifestToLegacy(root);
    const beforeLog = textAt(path.join(root, "fake-docker.log"));

    const resumed = runExistingResume(root, crashed.sandbox);
    const terminal = `${resumed.result.stdout}${resumed.result.stderr}`;
    const addedLog = textAt(path.join(root, "fake-docker.log")).slice(beforeLog.length);
    expect(resumed.result.status).not.toBe(0);
    expect(terminal).not.toContain("PILOT: GO\n");
    expect(fieldsAt(path.join(root, "phase3.activation")).get("state")).toBe("candidate");
    expect(addedLog).not.toMatch(/network (?:create|connect|disconnect)/);
  }, 120_000);

  test.each(["baseline_smoke_evidence", "baseline_smoke_sha256"])("RED: new manifest missing %s fails closed", (missingField) => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-new-manifest-required-red-"));
    const crashed = runHarness("crash-after-active", root);
    expect(crashed.result.status).not.toBe(0);
    rewriteFields(path.join(root, "phase3.transaction-baseline.manifest"), {}, [missingField]);
    rebindManifestReferences(root);

    const resumed = runExistingResume(root, crashed.sandbox);
    const terminal = `${resumed.result.stdout}${resumed.result.stderr}`;
    expect(resumed.result.status).not.toBe(0);
    expect(terminal).toContain("PILOT: NO-GO");
    expect(terminal).not.toContain("PILOT: GO\n");
    expect(fieldsAt(path.join(root, "phase3.activation")).get("state")).toBe("active");
  }, 120_000);

  test("RED: new manifest smoke evidence/hash mismatch fails closed", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-new-manifest-hash-red-"));
    const crashed = runHarness("crash-after-active", root);
    expect(crashed.result.status).not.toBe(0);
    rewriteFields(path.join(root, "phase3.transaction-baseline.manifest"), {
      baseline_smoke_sha256: "0".repeat(64),
    });
    rebindManifestReferences(root);

    const resumed = runExistingResume(root, crashed.sandbox);
    const terminal = `${resumed.result.stdout}${resumed.result.stderr}`;
    expect(resumed.result.status).not.toBe(0);
    expect(terminal).toContain("PILOT: NO-GO");
    expect(terminal).not.toContain("PILOT: GO\n");
    expect(fieldsAt(path.join(root, "phase3.activation")).get("state")).toBe("active");
  }, 120_000);

  test("RED: the fake provider is reachable only after compatibility detach", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-egress-topology-red-"));
    initializeFakeState(root);
    expect(fakeDocker(root, ["network", "create", "catering_private"]).status).toBe(0);
    expect(fakeDocker(root, ["network", "connect", "catering_private", "platform-infra-production-1"]).status).toBe(0);
    const beforeDetach = fakeDocker(root, ["exec", "platform-infra-production-1", "wget", "-qO-", "https://egress.invalid/health"]);
    expect(beforeDetach.status).toBe(1);
    expect(fakeDocker(root, ["network", "disconnect", "platform-infra_default", "platform-infra-production-1"]).status).toBe(0);
    const afterDetach = fakeDocker(root, ["exec", "platform-infra-production-1", "wget", "-qO-", "https://egress.invalid/health"]);
    expect(afterDetach.status).toBe(0);
  });

  test("RED: PostgreSQL isolation uses an available protocol-independent TCP probe", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-postgres-tcp-red-"));
    initializeFakeState(root);
    const reachable = fakeDocker(root, ["exec", "shared-edge-edge-1", "sh", "-c", "nc -z -w 2 postgres 5432"]);
    expect(reachable.status).toBe(0);
    expect(fakeDocker(root, ["network", "disconnect", "platform-infra_default", "platform-infra-postgres-1"]).status).toBe(0);
    const blocked = fakeDocker(root, ["exec", "shared-edge-edge-1", "sh", "-c", "nc -z -w 2 postgres 5432"]);
    expect(blocked.status).toBe(1);

    const statePath = path.join(root, "fake-docker-state.json");
    const state = JSON.parse(textAt(statePath)) as { fault: string; fault_triggered: boolean };
    state.fault = "nc-missing";
    state.fault_triggered = false;
    writeFileSync(statePath, JSON.stringify(state));
    const missingTool = fakeDocker(root, ["exec", "shared-edge-edge-1", "sh", "-c", "command -v nc >/dev/null 2>&1"]);
    expect(missingTool.status).not.toBe(0);

    expect(textAt(helperPath)).toContain("nc -z -w 2 postgres 5432");
  });

  test("RED: enabled provider egress is proven after compatibility detach", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-egress-order-red-"));
    const run = runHarness("egress-enabled", root);
    expect(run.result.status).toBe(0);
    const log = textAt(path.join(root, "fake-docker.log")).split("\n");
    const egressIndex = log.findIndex((line) => line.includes("exec platform-infra-production-1") && line.includes("egress.invalid"));
    const detachIndex = log.findIndex((line) => line.includes("network disconnect platform-infra_default platform-infra-production-1"));
    expect(egressIndex).toBeGreaterThan(detachIndex);
  }, 120_000);

  test.each(["semantic-smoke-fail", "semantic-smoke-incomplete"])("RED: %s baseline prevents every Phase-3 target mutation", (scenario) => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-baseline-smoke-red-"));
    const run = runHarness(scenario, root);
    const dockerLog = textAt(path.join(root, "fake-docker.log")).split("\n").filter(Boolean);
    const firstSmoke = dockerLog.findIndex((line) => line.includes("exec shared-edge-edge-1 wget"));
    const firstTargetMutation = dockerLog.findIndex((line) =>
      line.includes("network create") || line.includes("network connect") || line.includes("network disconnect")
    );
    const terminal = `${run.result.stdout}${run.result.stderr}`;
    expect(run.result.status).not.toBe(0);
    expect(terminal).toContain("PILOT: NO-GO");
    expect(firstSmoke).toBeGreaterThanOrEqual(0);
    expect(firstTargetMutation).toBe(-1);
    expect(existsSync(path.join(root, "platform-compose.phase3.yml"))).toBe(false);
    expect(existsSync(path.join(root, "edge-compose.phase3.yml"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.activation"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.transaction-baseline.manifest"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.network-adoption.journal"))).toBe(false);
    expect(existsSync(path.join(root, "locks", "catering-agents-platform.deploy-lock"))).toBe(false);
    expect(existsSync(path.join(root, "locks", "shared-edge.deploy-lock"))).toBe(false);
  }, 120_000);

  test("RED: accepting but non-responding baseline endpoint is bounded before mutation", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-baseline-timeout-red-"));
    const startedAt = Date.now();
    const run = runHarness("baseline-smoke-timeout", root);
    const elapsedMs = Date.now() - startedAt;
    const dockerLog = textAt(path.join(root, "fake-docker.log")).split("\n").filter(Boolean);
    const firstSmoke = dockerLog.findIndex((line) => line.includes("exec shared-edge-edge-1 wget"));
    const firstTargetMutation = dockerLog.findIndex((line) =>
      line.includes("network create") || line.includes("network connect") || line.includes("network disconnect")
    );
    const terminal = `${run.result.stdout}${run.result.stderr}`;
    expect(run.result.status).not.toBe(0);
    expect(terminal).toContain("PILOT: NO-GO");
    expect(firstSmoke).toBeGreaterThanOrEqual(0);
    expect(dockerLog[firstSmoke]).toContain("--timeout=2");
    expect(elapsedMs).toBeLessThan(2_000);
    expect(firstTargetMutation).toBe(-1);
    expect(existsSync(path.join(root, "platform-compose.phase3.yml"))).toBe(false);
    expect(existsSync(path.join(root, "edge-compose.phase3.yml"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.activation"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.transaction-baseline.manifest"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.network-adoption.journal"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.rollback-restore-proof.archive"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.rollback-completion.receipt"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.restore-evidence.record"))).toBe(false);
    expect(existsSync(path.join(root, "locks", "catering-agents-platform.deploy-lock"))).toBe(false);
    expect(existsSync(path.join(root, "locks", "shared-edge.deploy-lock"))).toBe(false);
  }, 120_000);

  test("RED: successful lock release is edge-first and edge failure keeps platform protected", () => {
    const success = runSuccessReleaseBlock();
    expect(success.status).toBe(0);
    expect(success.stdout.split("\n").filter(Boolean).slice(0, 2)).toEqual([
      "release=/tmp/edge-lock-for-repro",
      "release=/tmp/platform-lock-for-repro",
    ]);
    expect(success.stdout).toContain("PILOT: GO");

    const failedEdgeRelease = runSuccessReleaseBlock(true);
    expect(failedEdgeRelease.status).not.toBe(0);
    expect(failedEdgeRelease.stdout).toContain("release=/tmp/edge-lock-for-repro");
    expect(failedEdgeRelease.stdout).not.toContain("release=/tmp/platform-lock-for-repro");
    expect(failedEdgeRelease.stdout).not.toContain("PILOT: GO");
  });

  test("RED: crash after ingress create leaves an adoptable durable journal and ordered resume", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-ingress-adoption-red-"));
    const crashed = runHarness("crash-after-ingress", root);
    expect(crashed.result.status).not.toBe(0);
    const journalPath = path.join(root, "phase3.network-adoption.journal");
    const markerPath = path.join(root, "phase3.activation");
    expect(existsSync(journalPath)).toBe(true);
    expect(fieldsAt(markerPath).get("state")).toBe("candidate");
    const journal = fieldsAt(journalPath);
    expect(journal.get("schema")).toBe("phase3.1.network-adoption");
    expect(journal.get("adoption_order")).toBe("catering_ingress");
    expect(journal.get("adoption_count")).toBe("1");
    expect(journal.get("next_network")).toBe("catering_private");
    expect(journal.get("catering_ingress_id")).toMatch(/^[0-9a-f]{64}$/);
    expect(journal.get("catering_private_id")).toBe("absent");

    const resumed = runHarness("resume-after-ingress", root);
    expect(resumed.result.status).toBe(0);
    expect(`${resumed.result.stdout}${resumed.result.stderr}`).toContain("PILOT: GO");
    expect(fieldsAt(markerPath).get("state")).toBe("active");
  }, 120_000);

  test("RED: crash after private create durably records both networks exactly once and remains idempotent", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-private-adoption-red-"));
    const crashed = runHarness("crash-after-private", root);
    expect(crashed.result.status).not.toBe(0);
    const journalPath = path.join(root, "phase3.network-adoption.journal");
    const journal = fieldsAt(journalPath);
    expect(journal.get("adoption_order")).toBe("catering_ingress,catering_private");
    expect(journal.get("adoption_count")).toBe("2");
    expect(journal.get("next_network")).toBe("complete");
    expect(journal.get("catering_ingress_id")).toMatch(/^[0-9a-f]{64}$/);
    expect(journal.get("catering_private_id")).toMatch(/^[0-9a-f]{64}$/);

    const resumed = runHarness("resume-after-private", root);
    expect(resumed.result.status).toBe(0);
    const resumedAgain = runHarness("resume-active", root);
    expect(resumedAgain.result.status).toBe(0);
    expect(fieldsAt(path.join(root, "phase3.activation")).get("state")).toBe("active");
  }, 120_000);

  test.each([
    ["duplicate adoption", (journal: Map<string, string>) => journal.set("adoption_order", "catering_ingress,catering_ingress")],
    ["wrong owner", (journal: Map<string, string>) => journal.set("owner", "foreign-owner")],
    ["wrong run", (journal: Map<string, string>) => journal.set("transaction_id", "phase3-foreign-run")],
    ["wrong hash", (journal: Map<string, string>) => journal.set("transaction_manifest_sha256", "f".repeat(64))],
  ])("RED: resume fails closed on %s journal evidence", (_name, mutate) => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-journal-negative-red-"));
    const crashed = runHarness("crash-after-ingress", root);
    expect(crashed.result.status).not.toBe(0);
    const journalPath = path.join(root, "phase3.network-adoption.journal");
    const lines = textAt(journalPath).split("\n").filter(Boolean);
    const journal = fieldsAt(journalPath);
    mutate(journal);
    writeFileSync(journalPath, `${[...journal.entries()].map(([key, value]) => `${key}=${value}`).join("\n")}\n`);
    const resumed = runHarness("resume-after-ingress", root);
    expect(resumed.result.status).not.toBe(0);
    expect(fieldsAt(path.join(root, "phase3.activation")).get("state")).toBe("candidate");
    expect(lines.length).toBeGreaterThan(0);
  }, 120_000);

  test("RED: private-only, out-of-order, and membership/alias drift cannot be adopted", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-adoption-negative-red-"));
    const crashed = runHarness("crash-after-private", root);
    expect(crashed.result.status).not.toBe(0);
    const statePath = path.join(root, "fake-docker-state.json");
    const state = JSON.parse(textAt(statePath)) as { networks: Record<string, { containers: Record<string, unknown>; labels: Record<string, string> }> };
    delete state.networks.catering_ingress;
    state.networks.catering_private.containers["foreign"] = { Name: "/foreign", Aliases: ["foreign"] };
    writeFileSync(statePath, JSON.stringify(state));
    const journalPath = path.join(root, "phase3.network-adoption.journal");
    const journal = fieldsAt(journalPath);
    journal.set("adoption_order", "catering_private,catering_ingress");
    writeFileSync(journalPath, `${[...journal.entries()].map(([key, value]) => `${key}=${value}`).join("\n")}\n`);
    const resumed = runHarness("resume-after-private", root);
    expect(resumed.result.status).not.toBe(0);
    expect(fieldsAt(path.join(root, "phase3.activation")).get("state")).toBe("candidate");
  }, 120_000);

  test("RED: restore archive uses a canonical digest, never absent or a raw self-hash", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-archive-binding-red-"));
    const crashed = runHarness("crash-after-receipt", root);
    expect(crashed.result.status).not.toBe(0);
    const archivePath = path.join(root, "phase3.rollback-restore-proof.archive");
    const receiptPath = path.join(root, "phase3.rollback-completion.receipt");
    const archive = fieldsAt(archivePath);
    const receipt = fieldsAt(receiptPath);
    expect(archive.get("archive_sha256")).toMatch(/^[0-9a-f]{64}$/);
    expect(archive.get("archive_sha256")).not.toBe("absent");
    expect(archive.get("archive_sha256")).toBe(canonicalArchiveDigest(archivePath));
    expect(receipt.get("archive_sha256")).toBe(archive.get("archive_sha256"));
    expect(receipt.get("restore_proof_archive_sha256")).toBe(archive.get("archive_sha256"));
    expect(receipt.get("archive_sha256")).not.toBe(digestFile(archivePath));
  }, 120_000);

  test.each(["missing archive", "archive mismatch", "receipt mismatch"])("RED: %s remains recovery-required until the canonical binding is valid", (caseName) => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-archive-negative-red-"));
    const crashed = runHarness("crash-after-receipt", root);
    expect(crashed.result.status).not.toBe(0);
    const archivePath = path.join(root, "phase3.rollback-restore-proof.archive");
    const receiptPath = path.join(root, "phase3.rollback-completion.receipt");
    if (caseName === "missing archive") {
      writeFileSync(archivePath, "");
    } else if (caseName === "archive mismatch") {
      writeFileSync(archivePath, `${textAt(archivePath)}tampered=true\n`);
    } else {
      writeFileSync(receiptPath, textAt(receiptPath).replace(/^archive_sha256=.*$/m, `archive_sha256=${"0".repeat(64)}`));
    }
    const resumed = runHarness("resume-rolling-back", root);
    expect(resumed.result.status).not.toBe(0);
    expect(fieldsAt(path.join(root, "phase3.activation")).get("state")).toBe("rolling_back");
  }, 120_000);

  test("RED: pre-candidate failure releases both acquired locks edge-first", () => {
    const success = runPreCandidateAcquiredCleanup();
    expect(success.status).not.toBe(0);
    expect(success.stdout.split("\n").filter(Boolean)).toEqual([
      "release=/tmp/pre-candidate-edge-lock",
      "release=/tmp/pre-candidate-platform-lock",
    ]);
    expect(`${success.stdout}${success.stderr}`).not.toContain("RECOVERY_REQUIRED");

    const failedEdge = runPreCandidateAcquiredCleanup("edge");
    expect(failedEdge.status).not.toBe(0);
    expect(failedEdge.stdout).toContain("release=/tmp/pre-candidate-edge-lock");
    expect(failedEdge.stdout).not.toContain("release=/tmp/pre-candidate-platform-lock");
    expect(`${failedEdge.stdout}${failedEdge.stderr}`).toContain("RECOVERY_REQUIRED");
  });

  test("RED: workflow releases reentered locks only after verified rollback", () => {
    const workflow = textAt(edgeWorkflowPath);
    const deploy = textAt(edgeDeployPath);
    expect(workflow).toContain("always()");
    expect(workflow).toContain("steps.deploy_edge.outputs.rollback_outcome == 'successful'");
    expect(workflow).not.toMatch(/if:\s*success\(\)/);
    expect(workflow).toContain('[[ ! -e "$lock" && ! -L "$lock" ]]');
    expect(workflow.indexOf('release "$edge_lock"')).toBeLessThan(workflow.indexOf('release "$platform_lock"'));
    expect(deploy).toContain("write_rollback_outcome successful");
    expect(deploy).toContain("write_rollback_outcome recovery_required");
  });

  test("RED: rollback release failure cannot claim ROLLED BACK", () => {
    const success = runRollbackReleaseCleanup();
    expect(success.status).not.toBe(0);
    expect(success.stdout.split("\n").filter(Boolean)).toEqual([
      "checked=/tmp/rollback-edge-lock",
      "checked=/tmp/rollback-platform-lock",
    ]);
    expect(`${success.stdout}${success.stderr}`).toContain("PILOT: ROLLED BACK");
    expect(success.stdout).not.toContain("unsafe-release=");

    const failedEdge = runRollbackReleaseCleanup("edge");
    expect(failedEdge.status).not.toBe(0);
    expect(failedEdge.stdout).toContain("checked=/tmp/rollback-edge-lock");
    expect(failedEdge.stdout).not.toContain("checked=/tmp/rollback-platform-lock");
    expect(`${failedEdge.stdout}${failedEdge.stderr}`).toContain("RECOVERY_REQUIRED");
    expect(`${failedEdge.stdout}${failedEdge.stderr}`).not.toContain("PILOT: ROLLED BACK");
  });

  test("RED: edge rollback removes filled trees while preserving the rollback tree", () => {
    const { deployPath, result } = runEdgeRollbackCleanupReproducer();
    expect(result.status).toBe(0);
    expect(existsSync(path.join(deployPath, "filled", "nested", "old.txt"))).toBe(false);
    expect(existsSync(path.join(deployPath, "restored", "nested", "restored.txt"))).toBe(true);
    expect(textAt(path.join(deployPath, ".env"))).toBe("protected-env\n");
    expect(textAt(path.join(deployPath, ".deploy-manifest"))).toBe("restored-manifest\n");
    expect(textAt(path.join(deployPath, "rollbacks", "keep", "audit.txt"))).toBe("keep\n");
  });

  test("RED: web-listener rollback removes filled trees while preserving the rollback tree", () => {
    const { deployPath, result } = runWebListenerRollbackCleanupReproducer();
    expect(result.status).toBe(0);
    expect(existsSync(path.join(deployPath, "filled", "nested", "old.txt"))).toBe(false);
    expect(existsSync(path.join(deployPath, "restored", "nested", "restored.txt"))).toBe(true);
    expect(textAt(path.join(deployPath, ".env"))).toBe("protected-env\n");
    expect(textAt(path.join(deployPath, ".deploy-manifest"))).toBe("restored-manifest\n");
    expect(textAt(path.join(deployPath, "rollbacks", "keep", "audit.txt"))).toBe("keep\n");
    expect(textAt(path.join(deployPath, "data", "runtime", "keep", "state.db"))).toBe("runtime-state\n");
    expect(textAt(path.join(deployPath, "platform-infra", ".env"))).toBe("platform-env\n");
    expect(textAt(path.join(deployPath, "platform-infra", "sites", "live", "keep", "site.conf"))).toBe("site-state\n");
    expect(existsSync(path.join(deployPath, "platform-infra", "stale", "old.conf"))).toBe(false);
  });

  test("RED: post-restore host smokes gate evidence and rollback cleanup", () => {
    const reproducer = runPostRestoreSmokeFailureReproducer();
    const events = textAt(reproducer.eventLog);
    const terminalLines = `${reproducer.result.stdout}${reproducer.result.stderr}`
      .split("\n")
      .filter((line) => line.startsWith("PILOT:"));
    expect(reproducer.result.status).not.toBe(0);
    expect(terminalLines).toEqual(["PILOT: RECOVERY_REQUIRED"]);
    expect(events).toContain("restore-readback");
    expect(events).toContain("post-restore-smoke");
    expect(events.indexOf("restore-readback")).toBeLessThan(events.indexOf("post-restore-smoke"));
    expect(events).not.toContain("evidence");
    expect(events).not.toContain("atomic=");
    expect(events).not.toContain("release=");
    expect(existsSync(reproducer.restoreEvidence)).toBe(false);
    expect(existsSync(reproducer.restoreArchive)).toBe(false);
    expect(existsSync(reproducer.completionReceipt)).toBe(false);
    expect(existsSync(reproducer.baselineManifest)).toBe(true);
    expect(fieldsAt(path.join(path.dirname(reproducer.baselineManifest), "phase3.activation")).get("state")).toBe("rolling_back");
    expect(existsSync(path.join(path.dirname(reproducer.baselineManifest), "locks", "catering-agents-platform.deploy-lock"))).toBe(true);
    expect(existsSync(path.join(path.dirname(reproducer.baselineManifest), "locks", "shared-edge.deploy-lock"))).toBe(true);
  });
});
