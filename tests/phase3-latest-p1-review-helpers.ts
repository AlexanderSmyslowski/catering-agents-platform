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
import { expect } from "vitest";

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

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
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

function runHarness(
  scenario: string,
  root = mkdtempSync(path.join(tmpdir(), "catering-phase3-latest-p1-")),
  extraEnv: Record<string, string> = {},
) {
  const sandbox = commandSandbox(root);
  const result = spawnSync("/bin/bash", [helperPath, "--harness"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      ...extraEnv,
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

function runExistingControl(
  root: string,
  sandbox: ReturnType<typeof commandSandbox>,
  command: "resume" | "rollback",
  prependPath = "",
) {
  const result = spawnSync("/bin/bash", [helperPath, `--${command}`], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${prependPath ? `${prependPath}:` : ""}${path.join(root, "bin")}:${sandbox.bin}:${process.env.PATH ?? ""}`,
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

function runExistingResume(root: string, sandbox: ReturnType<typeof commandSandbox>, prependPath = "") {
  return runExistingControl(root, sandbox, "resume", prependPath);
}

function runExistingRollback(root: string, sandbox: ReturnType<typeof commandSandbox>, prependPath = "") {
  return runExistingControl(root, sandbox, "rollback", prependPath);
}

function installCrashAfterFirstNetworkDisconnect(root: string) {
  const shimBin = path.join(root, "disconnect-crash-docker-shim");
  const flagPath = path.join(root, "disconnect-crash-docker-shim.once");
  mkdirSync(shimBin, { recursive: true });
  writeFileSync(
    path.join(shimBin, "docker"),
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      `real=${shellQuote(fakeDockerPath)}`,
      `flag=${shellQuote(flagPath)}`,
      'if [[ "${1:-}" == network && "${2:-}" == disconnect && ! -e "$flag" ]]; then',
      '  set +e',
      '  python3 "$real" "$@"',
      '  status=$?',
      '  set -e',
      '  if [[ "$status" == 0 ]]; then',
      '    : >"$flag"',
      '    kill -KILL "$PPID"',
      '  fi',
      '  exit "$status"',
      "fi",
      'exec python3 "$real" "$@"',
      "",
    ].join("\n"),
    { mode: 0o700 },
  );
  return { shimBin, flagPath };
}

function installCrashAfterIngressDisconnect(root: string) {
  const shimBin = path.join(root, "ingress-disconnect-crash-docker-shim");
  const flagPath = path.join(root, "ingress-disconnect-crash-docker-shim.once");
  mkdirSync(shimBin, { recursive: true });
  writeFileSync(
    path.join(shimBin, "docker"),
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      `real=${shellQuote(fakeDockerPath)}`,
      `flag=${shellQuote(flagPath)}`,
      'if [[ "${1:-}" == network && "${2:-}" == disconnect && "${3:-}" == catering_ingress && ! -e "$flag" ]]; then',
      '  set +e',
      '  python3 "$real" "$@"',
      '  status=$?',
      '  set -e',
      '  if [[ "$status" == 0 ]]; then',
      '    : >"$flag"',
      '    kill -KILL "$PPID"',
      '  fi',
      '  exit "$status"',
      "fi",
      'exec python3 "$real" "$@"',
      "",
    ].join("\n"),
    { mode: 0o700 },
  );
  return { shimBin, flagPath };
}

function installCrashAfterCompatibilityConnect(root: string, reconnectCount: number) {
  const shimBin = path.join(root, `compatibility-crash-docker-shim-${reconnectCount}`);
  const flagPath = path.join(shimBin, "crashed");
  const countPath = path.join(shimBin, "connect-count");
  mkdirSync(shimBin, { recursive: true });
  writeFileSync(
    path.join(shimBin, "docker"),
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      `real=${shellQuote(fakeDockerPath)}`,
      `flag=${shellQuote(flagPath)}`,
      `count_file=${shellQuote(countPath)}`,
      `limit=${reconnectCount}`,
      'if [[ "${1:-}" == network && "${2:-}" == connect ]] && [[ " $* " == *" platform-infra_default "* || " $* " == *" zeiterfassung_default "* ]]; then',
      '  if [[ -e "$flag" ]]; then exec python3 "$real" "$@"; fi',
      '  count=0',
      '  [[ -e "$count_file" ]] && count="$(cat "$count_file")"',
      '  if (( count < limit )); then',
      '    set +e',
      '    python3 "$real" "$@"',
      '    status=$?',
      '    set -e',
      '    [[ "$status" == 0 ]] || exit "$status"',
      '    count=$((count + 1))',
      '    printf "%s\\n" "$count" >"$count_file"',
      '  fi',
      '  if (( count >= limit )); then',
      '    : >"$flag"',
      '    exit 137',
      '  fi',
      '  exit 0',
      'fi',
      'exec python3 "$real" "$@"',
      "",
    ].join("\n"),
    { mode: 0o700 },
  );
  return { shimBin, flagPath, countPath };
}

function installMembershipJournalWriteFailure(root: string) {
  const shimBin = path.join(root, "membership-journal-write-failure-shim");
  const failureFlag = path.join(shimBin, "triggered");
  const countFile = path.join(shimBin, "journal-write-count");
  mkdirSync(shimBin, { recursive: true });
  writeFileSync(
    path.join(shimBin, "sudo"),
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      `real=${shellQuote(path.join(root, "bin/sudo"))}`,
      `flag=${shellQuote(failureFlag)}`,
      `count_file=${shellQuote(countFile)}`,
      'if [[ "${1:-}" == install && "${!#}" == *"/phase3.network-adoption.journal.pending."* ]]; then',
      '  count=0; [[ -e "$count_file" ]] && count="$(cat "$count_file")"',
      '  count=$((count + 1)); printf "%s\n" "$count" >"$count_file"',
      '  if [[ "$count" == 17 ]]; then : >"$flag"; exit 97; fi',
      "fi",
      'exec "$real" "$@"',
      "",
    ].join("\n"),
    { mode: 0o700 },
  );
  return { shimBin, failureFlag, countFile };
}

function restoreCompatibilityBaselineExcept(root: string, missing: string) {
  const expected = [
    ["platform-infra_default", "postgres", "platform-infra-postgres-1"],
    ["platform-infra_default", "intake", "platform-infra-intake-1"],
    ["platform-infra_default", "offer", "platform-infra-offer-1"],
    ["platform-infra_default", "production", "platform-infra-production-1"],
    ["platform-infra_default", "exports", "platform-infra-exports-1"],
    ["platform-infra_default", "web", "platform-infra-web-1"],
    ["zeiterfassung_default", "web", "platform-infra-web-1"],
  ] as const;
  for (const [network, alias, container] of expected) {
    if (container === missing) continue;
    const result = fakeDocker(root, ["network", "connect", "--alias", alias, network, container]);
    expect(result.status).toBe(0);
  }
}

type PartialRollbackState = {
  networks: Record<string, { containers: Record<string, { Name: string; Aliases: string[] }> }>;
};

function prepareNormalMixedS2State(root: string, preExistingNetwork: "catering_ingress" | "catering_private") {
  initializeFakeState(root);
  const statePath = path.join(root, "fake-docker-state.json");
  const state = JSON.parse(textAt(statePath)) as {
    networks: Record<string, {
      driver: string;
      enable_ipv6: boolean;
      id: string;
      internal: boolean;
      ipam_config: unknown[];
      ipam_driver: string;
      labels: Record<string, string>;
      options: Record<string, string>;
      scope: string;
      containers: Record<string, unknown>;
    }>;
  };
  const kind = preExistingNetwork.replace(/^catering_/, "");
  state.networks[preExistingNetwork] = {
    driver: "bridge",
    enable_ipv6: false,
    id: digest(`network:${preExistingNetwork}`),
    internal: false,
    ipam_config: [],
    ipam_driver: "default",
    labels: {
      "com.catering.owner": "catering-agents-platform",
      "com.catering.phase": "phase3.1",
      "com.catering.kind": kind,
    },
    options: {},
    scope: "local",
    containers: {},
  };
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function prepareNormalAllPreExistingS2State(root: string) {
  initializeFakeState(root);
  const statePath = path.join(root, "fake-docker-state.json");
  const state = JSON.parse(textAt(statePath)) as {
    networks: Record<string, {
      driver: string;
      enable_ipv6: boolean;
      id: string;
      internal: boolean;
      ipam_config: unknown[];
      ipam_driver: string;
      labels: Record<string, string>;
      options: Record<string, string>;
      scope: string;
      containers: Record<string, unknown>;
    }>;
    containers: Record<string, {
      config: Record<string, unknown>;
    }>;
  };
  for (const network of ["catering_ingress", "catering_private"] as const) {
    const kind = network.replace(/^catering_/, "");
    state.networks[network] = {
      driver: "bridge",
      enable_ipv6: false,
      id: digest(`network:${network}`),
      internal: false,
      ipam_config: [],
      ipam_driver: "default",
      labels: {
        "com.catering.owner": "catering-agents-platform",
        "com.catering.phase": "phase3.1",
        "com.catering.kind": kind,
      },
      options: {},
      scope: "local",
      containers: {},
    };
  }
  state.containers["platform-infra-production-1"].config = {
    env: { CATERING_ENABLE_WEB_RECIPE_SEARCH: "1" },
  };
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function prepareNormalAllPreExistingS2NullIpamState(root: string) {
  prepareNormalAllPreExistingS2State(root);
  const statePath = path.join(root, "fake-docker-state.json");
  const state = JSON.parse(textAt(statePath)) as {
    networks: Record<string, { ipam_config: unknown }>;
  };
  for (const network of ["catering_ingress", "catering_private"]) {
    state.networks[network].ipam_config = null;
  }
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function setFakeNetworkIpamConfig(root: string, value: unknown) {
  const statePath = path.join(root, "fake-docker-state.json");
  const state = JSON.parse(textAt(statePath)) as {
    networks: Record<string, { ipam_config: unknown }>;
  };
  for (const network of ["catering_ingress", "catering_private"]) {
    state.networks[network].ipam_config = value;
  }
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function runNormalMixedS2(preExistingNetwork: "catering_ingress" | "catering_private") {
  const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-normal-mixed-s2-red-"));
  prepareNormalMixedS2State(root, preExistingNetwork);
  const beforeState = textAt(path.join(root, "fake-docker-state.json"));
  const run = runHarness("normal", root);
  return { root, run, beforeState };
}

function installPreExistingNetworkLabelShim(root: string) {
  const shimBin = path.join(root, "pre-existing-docker-shim");
  mkdirSync(shimBin, { recursive: true });
  const dockerPath = path.join(shimBin, "docker");
  writeFileSync(
    dockerPath,
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      `if [[ "$*" == *'{{index .Labels "com.catering.transaction"}}'* ]]; then`,
      `  value="$(python3 ${shellQuote(fakeDockerPath)} "$@")"`,
      '  [[ "$value" == "<no value>" ]] && exit 0',
      '  printf "%s\\n" "$value"',
      "  exit 0",
      "fi",
      `exec python3 ${shellQuote(fakeDockerPath)} "$@"`,
      "",
    ].join("\n"),
    { mode: 0o700 },
  );
  return shimBin;
}

function encodeFakeDockerJson(value: unknown) {
  return Buffer.from(`${JSON.stringify(value)}\n`).toString("base64");
}

function preparePreExistingExactS2Crash(root: string) {
  const statePath = path.join(root, "fake-docker-state.json");
  const markerPath = path.join(root, "phase3.activation");
  const manifestPath = path.join(root, "phase3.transaction-baseline.manifest");
  const journalPath = path.join(root, "phase3.network-adoption.journal");
  const state = JSON.parse(textAt(statePath)) as {
    fault: string;
    fault_triggered: boolean;
    networks: Record<string, {
      driver: string;
      enable_ipv6: boolean;
      id: string;
      internal: boolean;
      ipam_config: unknown[];
      ipam_driver: string;
      labels: Record<string, string>;
      options: Record<string, string>;
      scope: string;
      containers: Record<string, unknown>;
    }>;
  };
  const ingress = state.networks.catering_ingress;
  expect(ingress).toBeDefined();
  const privateId = digest("network:catering_private");
  delete ingress.labels["com.catering.transaction"];
  ingress.containers = {};
  state.networks.catering_private = {
    driver: "bridge",
    enable_ipv6: false,
    id: privateId,
    internal: false,
    ipam_config: [],
    ipam_driver: "default",
    labels: {
      "com.catering.owner": "catering-agents-platform",
      "com.catering.phase": "phase3.1",
      "com.catering.kind": "private",
    },
    options: {},
    scope: "local",
    containers: {},
  };
  state.fault = "";
  state.fault_triggered = false;
  writeFileSync(statePath, JSON.stringify(state, null, 2));

  rewriteFields(manifestPath, {
    catering_ingress_baseline: "pre-existing-exact",
    catering_private_baseline: "pre-existing-exact",
    catering_ingress_baseline_id: ingress.id,
    catering_private_baseline_id: privateId,
    catering_ingress_created_by_run_authorized: "false",
    catering_private_created_by_run_authorized: "false",
    catering_ingress_network_labels: "owner=catering-agents-platform;phase=phase3.1;kind=ingress",
    catering_private_network_labels: "owner=catering-agents-platform;phase=phase3.1;kind=private",
    catering_ingress_baseline_members: encodeFakeDockerJson(ingress.containers),
    catering_ingress_baseline_aliases: encodeFakeDockerJson(ingress.containers),
    catering_private_baseline_members: encodeFakeDockerJson({}),
    catering_private_baseline_aliases: encodeFakeDockerJson({}),
  });
  const manifestHash = digestFile(manifestPath);
  const quarantine = path.join(root, "pre-existing-crash-evidence");
  mkdirSync(quarantine, { recursive: true });
  const movedJournal = spawnSync("mv", [journalPath, path.join(quarantine, "phase3.network-adoption.journal")], {
    encoding: "utf8",
  });
  expect(movedJournal.status).toBe(0);
  rewriteFields(markerPath, {
    transaction_manifest_sha256: manifestHash,
    baseline_network_status: "catering_ingress=pre-existing-exact;catering_private=pre-existing-exact",
    catering_ingress_id: "absent",
    catering_private_id: "absent",
    stage: "S2",
    adoption_count: "0",
    adoption_proof: "not_adopted",
    marker_sha256: "absent",
  });
  rewriteFields(markerPath, { marker_sha256: canonicalSelfHash(markerPath, "marker_sha256") });
  const dockerShimBin = installPreExistingNetworkLabelShim(root);
  return { ingressId: ingress.id, privateId, beforeState: textAt(statePath), dockerShimBin };
}

function prepareMixedPreExistingS2Crash(root: string) {
  const statePath = path.join(root, "fake-docker-state.json");
  const markerPath = path.join(root, "phase3.activation");
  const manifestPath = path.join(root, "phase3.transaction-baseline.manifest");
  const journalPath = path.join(root, "phase3.network-adoption.journal");
  const state = JSON.parse(textAt(statePath)) as {
    fault: string;
    fault_triggered: boolean;
    networks: Record<string, {
      driver: string;
      enable_ipv6: boolean;
      id: string;
      internal: boolean;
      ipam_config: unknown[];
      ipam_driver: string;
      labels: Record<string, string>;
      options: Record<string, string>;
      scope: string;
      containers: Record<string, unknown>;
    }>;
  };
  const ingress = state.networks.catering_ingress;
  expect(ingress).toBeDefined();
  delete ingress.labels["com.catering.transaction"];
  ingress.containers = {};
  delete state.networks.catering_private;
  state.fault = "";
  state.fault_triggered = false;
  writeFileSync(statePath, JSON.stringify(state, null, 2));

  rewriteFields(manifestPath, {
    catering_ingress_baseline: "pre-existing-exact",
    catering_private_baseline: "absent",
    catering_ingress_baseline_id: ingress.id,
    catering_private_baseline_id: "absent",
    catering_ingress_created_by_run_authorized: "false",
    catering_private_created_by_run_authorized: "true",
    catering_ingress_network_labels: "owner=catering-agents-platform;phase=phase3.1;kind=ingress",
    catering_ingress_baseline_members: encodeFakeDockerJson(ingress.containers),
    catering_ingress_baseline_aliases: encodeFakeDockerJson(ingress.containers),
    catering_private_network_labels: "owner=catering-agents-platform;phase=phase3.1;kind=private;transaction=phase3-harness",
    catering_private_baseline_members: "absent",
    catering_private_baseline_aliases: "absent",
  });
  const quarantine = path.join(root, "mixed-pre-existing-crash-evidence");
  mkdirSync(quarantine, { recursive: true });
  const movedJournal = spawnSync("mv", [journalPath, path.join(quarantine, "phase3.network-adoption.journal")], {
    encoding: "utf8",
  });
  expect(movedJournal.status).toBe(0);
  const manifestHash = digestFile(manifestPath);
  rewriteFields(markerPath, {
    transaction_manifest_sha256: manifestHash,
    baseline_network_status: "catering_ingress=pre-existing-exact;catering_private=absent",
    catering_ingress_id: "absent",
    catering_private_id: "absent",
    stage: "S2",
    adoption_count: "0",
    adoption_proof: "not_adopted",
    marker_sha256: "absent",
  });
  rewriteFields(markerPath, { marker_sha256: canonicalSelfHash(markerPath, "marker_sha256") });
  return { ingressId: ingress.id, beforeState: textAt(statePath), dockerShimBin: installPreExistingNetworkLabelShim(root) };
}

function prepareInverseMixedPreExistingS2Crash(root: string) {
  const statePath = path.join(root, "fake-docker-state.json");
  const markerPath = path.join(root, "phase3.activation");
  const manifestPath = path.join(root, "phase3.transaction-baseline.manifest");
  const journalPath = path.join(root, "phase3.network-adoption.journal");
  const state = JSON.parse(textAt(statePath)) as {
    fault: string;
    fault_triggered: boolean;
    networks: Record<string, {
      driver: string;
      enable_ipv6: boolean;
      id: string;
      internal: boolean;
      ipam_config: unknown[];
      ipam_driver: string;
      labels: Record<string, string>;
      options: Record<string, string>;
      scope: string;
      containers: Record<string, unknown>;
    }>;
  };
  const privateId = digest("network:catering_private");
  delete state.networks.catering_ingress;
  state.networks.catering_private = {
    driver: "bridge",
    enable_ipv6: false,
    id: privateId,
    internal: false,
    ipam_config: [],
    ipam_driver: "default",
    labels: {
      "com.catering.owner": "catering-agents-platform",
      "com.catering.phase": "phase3.1",
      "com.catering.kind": "private",
    },
    options: {},
    scope: "local",
    containers: {},
  };
  state.fault = "";
  state.fault_triggered = false;
  writeFileSync(statePath, JSON.stringify(state, null, 2));

  rewriteFields(manifestPath, {
    catering_ingress_baseline: "absent",
    catering_private_baseline: "pre-existing-exact",
    catering_ingress_baseline_id: "absent",
    catering_private_baseline_id: privateId,
    catering_ingress_created_by_run_authorized: "true",
    catering_private_created_by_run_authorized: "false",
    catering_ingress_network_labels: "owner=catering-agents-platform;phase=phase3.1;kind=ingress;transaction=phase3-harness",
    catering_ingress_baseline_members: "absent",
    catering_ingress_baseline_aliases: "absent",
    catering_private_network_labels: "owner=catering-agents-platform;phase=phase3.1;kind=private",
    catering_private_baseline_members: encodeFakeDockerJson(state.networks.catering_private.containers),
    catering_private_baseline_aliases: encodeFakeDockerJson(state.networks.catering_private.containers),
  });
  const quarantine = path.join(root, "inverse-mixed-pre-existing-crash-evidence");
  mkdirSync(quarantine, { recursive: true });
  const movedJournal = spawnSync("mv", [journalPath, path.join(quarantine, "phase3.network-adoption.journal")], {
    encoding: "utf8",
  });
  expect(movedJournal.status).toBe(0);
  const manifestHash = digestFile(manifestPath);
  rewriteFields(markerPath, {
    transaction_manifest_sha256: manifestHash,
    baseline_network_status: "catering_ingress=absent;catering_private=pre-existing-exact",
    catering_ingress_id: "absent",
    catering_private_id: "absent",
    stage: "S2",
    adoption_count: "0",
    adoption_proof: "not_adopted",
    marker_sha256: "absent",
  });
  rewriteFields(markerPath, { marker_sha256: canonicalSelfHash(markerPath, "marker_sha256") });
  return { privateId, beforeState: textAt(statePath), dockerShimBin: installPreExistingNetworkLabelShim(root) };
}

function preparePreExistingRollbackProgress(root: string, preserveRunLabel = false) {
  const statePath = path.join(root, "fake-docker-state.json");
  const markerPath = path.join(root, "phase3.activation");
  const manifestPath = path.join(root, "phase3.transaction-baseline.manifest");
  const state = JSON.parse(textAt(statePath)) as {
    fault: string;
    fault_triggered: boolean;
    networks: Record<string, {
      id: string;
      labels: Record<string, string>;
      containers: Record<string, unknown>;
    }>;
    containers: Record<string, { networks: Record<string, unknown> }>;
  };
  for (const network of ["catering_ingress", "catering_private"]) {
    expect(state.networks[network]).toBeDefined();
    if (!preserveRunLabel) delete state.networks[network].labels["com.catering.transaction"];
    state.networks[network].containers = {};
  }
  for (const container of Object.values(state.containers)) {
    delete container.networks.catering_ingress;
    delete container.networks.catering_private;
  }
  state.fault = "";
  state.fault_triggered = false;
  writeFileSync(statePath, JSON.stringify(state, null, 2));

  const ingressId = state.networks.catering_ingress.id;
  const privateId = state.networks.catering_private.id;
  rewriteFields(manifestPath, {
    catering_ingress_baseline: "pre-existing-exact",
    catering_private_baseline: "pre-existing-exact",
    catering_ingress_baseline_id: ingressId,
    catering_private_baseline_id: privateId,
    catering_ingress_created_by_run_authorized: "false",
    catering_private_created_by_run_authorized: "false",
    catering_ingress_network_labels: `owner=catering-agents-platform;phase=phase3.1;kind=ingress${preserveRunLabel ? ";transaction=phase3-harness" : ""}`,
    catering_private_network_labels: `owner=catering-agents-platform;phase=phase3.1;kind=private${preserveRunLabel ? ";transaction=phase3-harness" : ""}`,
    catering_ingress_baseline_members: encodeFakeDockerJson(state.networks.catering_ingress.containers),
    catering_ingress_baseline_aliases: encodeFakeDockerJson(state.networks.catering_ingress.containers),
    catering_private_baseline_members: encodeFakeDockerJson(state.networks.catering_private.containers),
    catering_private_baseline_aliases: encodeFakeDockerJson(state.networks.catering_private.containers),
  });
  rebindManifestReferences(root);
  rewriteFields(markerPath, {
    state: "rolling_back",
    baseline_network_status: "catering_ingress=pre-existing-exact;catering_private=pre-existing-exact",
    catering_ingress_id: ingressId,
    catering_private_id: privateId,
    stage: "RB",
    adoption_count: "0",
    adoption_proof: "not_adopted",
    marker_sha256: "absent",
  });
  rewriteFields(markerPath, { marker_sha256: canonicalSelfHash(markerPath, "marker_sha256") });
  return { beforeState: textAt(statePath), dockerShimBin: installPreExistingNetworkLabelShim(root) };
}

function prepareInverseMixedActiveRollback(root: string) {
  const statePath = path.join(root, "fake-docker-state.json");
  const markerPath = path.join(root, "phase3.activation");
  const manifestPath = path.join(root, "phase3.transaction-baseline.manifest");
  const state = JSON.parse(textAt(statePath)) as {
    networks: Record<string, {
      id: string;
      labels: Record<string, string>;
      containers: Record<string, unknown>;
    }>;
    containers: Record<string, { networks: Record<string, unknown> }>;
    fault: string;
    fault_triggered: boolean;
  };
  const ingress = state.networks.catering_ingress;
  const privateNetwork = state.networks.catering_private;
  expect(ingress).toBeDefined();
  expect(privateNetwork).toBeDefined();
  const ingressId = ingress.id;
  const privateId = privateNetwork.id;
  delete state.networks.catering_ingress;
  privateNetwork.labels = {
    "com.catering.owner": "catering-agents-platform",
    "com.catering.phase": "phase3.1",
    "com.catering.kind": "private",
  };
  privateNetwork.containers = {};
  for (const container of Object.values(state.containers)) {
    delete container.networks.catering_ingress;
    delete container.networks.catering_private;
  }
  state.fault = "";
  state.fault_triggered = false;
  writeFileSync(statePath, JSON.stringify(state, null, 2));

  rewriteFields(manifestPath, {
    catering_ingress_baseline: "absent",
    catering_private_baseline: "pre-existing-exact",
    catering_ingress_baseline_id: "absent",
    catering_private_baseline_id: privateId,
    catering_ingress_created_by_run_authorized: "true",
    catering_private_created_by_run_authorized: "false",
    catering_ingress_network_labels: "owner=catering-agents-platform;phase=phase3.1;kind=ingress;transaction=phase3-harness",
    catering_ingress_baseline_members: "absent",
    catering_ingress_baseline_aliases: "absent",
    catering_private_network_labels: "owner=catering-agents-platform;phase=phase3.1;kind=private",
    catering_private_baseline_members: encodeFakeDockerJson({}),
    catering_private_baseline_aliases: encodeFakeDockerJson({}),
  });
  rebindManifestReferences(root);
  rewriteFields(markerPath, {
    state: "rolling_back",
    stage: "RB",
    baseline_network_status: "catering_ingress=absent;catering_private=pre-existing-exact",
    catering_ingress_id: ingressId,
    catering_private_id: privateId,
    adoption_count: "0",
    adoption_proof: "not_adopted",
    marker_sha256: "absent",
  });
  rewriteFields(markerPath, { marker_sha256: canonicalSelfHash(markerPath, "marker_sha256") });
  return { beforeState: textAt(statePath), dockerShimBin: installPreExistingNetworkLabelShim(root) };
}

function removeFakeNetwork(root: string, network: string, containers: string[]) {
  for (const container of containers) {
    expect(fakeDocker(root, ["network", "disconnect", network, container]).status).toBe(0);
  }
  expect(fakeDocker(root, ["network", "rm", network]).status).toBe(0);
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
    "membership_rollback_preflight() { :; }",
    "membership_reconcile_compatibility_baseline() { :; }",
    "membership_mutation() { :; }",
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

function remoteMembershipPrimitive() {
  const source = readFileSync(helperPath, "utf8");
  const marker = "<<'REMOTE_MEMBERSHIP_PRIMITIVE'";
  const markerIndex = source.indexOf(marker);
  const bodyStart = markerIndex >= 0 ? source.indexOf("\n", markerIndex) + 1 : -1;
  const bodyEnd = source.indexOf("\nREMOTE_MEMBERSHIP_PRIMITIVE", bodyStart);
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
  const membershipPrimitive = remoteMembershipPrimitive();
  const releaseStart = body.indexOf("release_control_locks() {");
  const releaseEnd = body.indexOf("\ntrap release_control_locks EXIT", releaseStart);
  const rollbackControlStart = body.indexOf("continue_rollback_control() {");
  const dispatcherStart = body.indexOf("dispatch_recovery_transition() {");
  const dispatcherEnd = body.indexOf("\ndispatch_recovery_transition", dispatcherStart);
  const rollbackControlEnd = body.indexOf("\ndispatch_recovery_transition() {", rollbackControlStart);
  expect(releaseStart).toBeGreaterThanOrEqual(0);
  expect(releaseEnd).toBeGreaterThan(releaseStart);
  expect(rollbackControlStart).toBeGreaterThanOrEqual(0);
  expect(rollbackControlEnd).toBeGreaterThan(rollbackControlStart);
  expect(dispatcherStart).toBeGreaterThanOrEqual(0);
  expect(dispatcherEnd).toBeGreaterThan(dispatcherStart);
  expect(membershipPrimitive).not.toBe("");
  const rollbackControl = body.slice(rollbackControlStart, rollbackControlEnd);
  const dispatcher = body.slice(dispatcherStart, dispatcherEnd);
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
    "recovery_class=active:rollback",
    "run_id=phase3-explicit-rollback",
    "owner=catering-agents-platform",
    "schema=phase3.1",
    `platform_lock=${shellQuote(platformLock)}`,
    `edge_lock=${shellQuote(edgeLock)}`,
    "marker_state=active",
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
    "  if [[ \"$1\" == network && \"$2\" == inspect ]]; then printf '{}'; return 0; fi",
    "  return 0",
    "}",
    "field() {",
    "  case \"$2\" in",
    "    platform_source_prior|edge_source_prior|prior_marker_state) printf 'absent' ;;",
    "    catering_private_created_by_run_authorized|catering_ingress_created_by_run_authorized) printf 'true' ;;",
    "    *) printf 'absent' ;;",
    "  esac",
    "}",
    "fail() { printf '%s\\n' 'PILOT: NO-GO' >&2; return 1; }",
    membershipPrimitive,
    "membership_reconcile_compatibility_baseline() { :; }",
    "validate_resume_evidence() { :; }",
    "membership_wal_recover() { :; }",
    "retain_recovery_locks=false",
    "validate_compatibility_baseline_control() { :; }",
    "validate_network_provenance() { :; }",
    "network_present_by_name() { return 1; }",
    "validate_receipt() { :; }",
    "canonical_marker_sha256() { printf 'markerhash'; }",
    "canonical_archive_sha256() { printf 'archivehash'; }",
    "write_control_marker() { printf 'marker=%s\\n' \"$1\" >> \"$event_log\"; printf 'state=%s\\nsmoke_readback_sha256=pending\\n' \"$1\" > \"$activation_marker\"; }",
    "run_all_host_semantic_smokes() {",
    `  printf '%s\\n' 'post-restore-smoke:catering,zeiterfassung,eventos' >> \"$event_log\"; [[ \"${smokeFails ? 1 : 0}\" == 0 ]] || return 1; smoke_readback_sha256=smokehash;`,
    "}",
    "run_rollback_host_semantic_smokes() { run_all_host_semantic_smokes; }",
    "write_restore_evidence_control() { printf '%s\\n' evidence >> \"$event_log\"; printf '%s\\n' evidence > \"$restore_evidence_record\"; }",
    "write_restore_archive_control() { printf '%s\\n' archive >> \"$event_log\"; printf '%s\\n' archive > \"$restore_proof_archive\"; }",
    "write_completion_receipt_control() { printf '%s\\n' receipt >> \"$event_log\"; printf '%s\\n' receipt > \"$completion_receipt\"; }",
    "finalize_rolling_back_resume() { printf '%s\\n' finalize >> \"$event_log\"; unlink \"$activation_marker\"; unlink \"$baseline_manifest\"; unlink \"$completion_receipt\" 2>/dev/null || true; }",
    "phase3_lock_release() { printf 'release=%s\\n' \"$1\" >> \"$event_log\"; rmdir \"$1\"; }",
    body.slice(releaseStart, releaseEnd),
    rollbackControl,
    dispatcher,
    "trap release_control_locks EXIT",
    "dispatch_recovery_transition",
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

export {
  repoRoot,
  helperPath,
  fakeDockerPath,
  edgeDeployPath,
  webListenerPath,
  edgeWorkflowPath,
  textAt,
  fieldsAt,
  digest,
  canonicalJson,
  digestFile,
  rewriteFields,
  canonicalSelfHash,
  rebindManifestReferences,
  convertManifestToLegacy,
  canonicalArchiveDigest,
  initializeFakeState,
  fakeDocker,
  commandSandbox,
  runHarness,
  runExistingControl,
  runExistingResume,
  runExistingRollback,
  installCrashAfterFirstNetworkDisconnect,
  installCrashAfterIngressDisconnect,
  installCrashAfterCompatibilityConnect,
  installMembershipJournalWriteFailure,
  restoreCompatibilityBaselineExcept,
  prepareNormalMixedS2State,
  prepareNormalAllPreExistingS2State,
  prepareNormalAllPreExistingS2NullIpamState,
  setFakeNetworkIpamConfig,
  runNormalMixedS2,
  installPreExistingNetworkLabelShim,
  encodeFakeDockerJson,
  preparePreExistingExactS2Crash,
  prepareMixedPreExistingS2Crash,
  prepareInverseMixedPreExistingS2Crash,
  preparePreExistingRollbackProgress,
  prepareInverseMixedActiveRollback,
  removeFakeNetwork,
  remotePilotBody,
  shellQuote,
  remoteScriptAt,
  runEdgeRollbackCleanupReproducer,
  runWebListenerRollbackCleanupReproducer,
  runPostRestoreSmokeFailureReproducer,
  remoteControlBody,
  remoteMembershipPrimitive,
  runReenteredControlRelease,
  runExplicitRollbackReproducer,
  runForeignEdgeLockReproducer,
  runSuccessReleaseBlock,
  runPreCandidateAcquiredCleanup,
  runRollbackReleaseCleanup,
};
export type { PartialRollbackState };
