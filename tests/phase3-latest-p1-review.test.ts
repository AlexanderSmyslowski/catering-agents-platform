import {
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
      CATERING_PHASE3_FAKE_HOST_ROOT: root,
      CATERING_PHASE3_HARNESS_SCENARIO: scenario,
      CATERING_PHASE3_SANDBOX_LOG: sandbox.log,
    },
  });
  return { root, sandbox, result };
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
});
