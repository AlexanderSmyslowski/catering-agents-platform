import {
  chmodSync,
  existsSync,
  lstatSync,
  linkSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");
const workflowPath = path.join(repoRoot, ".github/workflows/catering-phase3-isolation-pilot.yml");
const platformBaseComposePath = path.join(repoRoot, "platform-infra/docker-compose.yml");
const platformComposePath = path.join(repoRoot, "platform-infra/docker-compose.phase3-catering-pilot.yml");
const edgeComposePath = path.join(repoRoot, "edge-infra/docker-compose.phase3-catering-pilot.yml");
const helperPath = path.join(repoRoot, "platform-infra/scripts/catering-phase3-pilot.sh");
const fakeBackendPath = path.join(repoRoot, "platform-infra/scripts/phase3-fake-backend.sh");
const fakeDockerPath = path.join(repoRoot, "platform-infra/scripts/phase3-fake-docker.py");
const callerPaths = [
  "platform-infra/scripts/deploy-hetzner.sh",
  "platform-infra/scripts/deploy-web-listener-hetzner.sh",
  "edge-infra/scripts/deploy-hetzner.sh",
  "edge-infra/scripts/cutover-hetzner.sh",
  "edge-infra/scripts/post-cutover-evidence.sh",
].map((relativePath) => path.join(repoRoot, relativePath));
const callerWorkflowPaths = [
  ".github/workflows/deploy-production.yml",
  ".github/workflows/deploy-catering-web-listener.yml",
  ".github/workflows/deploy-edge-production.yml",
  ".github/workflows/cutover-edge-production.yml",
  ".github/workflows/post-cutover-evidence.yml",
].map((relativePath) => path.join(repoRoot, relativePath));
const protectedPaths = [
  "/opt/catering-phase3/platform-compose.phase3.yml",
  "/opt/catering-phase3/edge-compose.phase3.yml",
  "/opt/catering-phase3/phase3.activation",
  "/opt/catering-phase3/phase3.transaction-baseline.manifest",
  "/opt/catering-phase3/phase3.rollback-restore-proof.archive",
  "/opt/catering-phase3/phase3.rollback-completion.receipt",
  "/opt/catering-phase3/phase3.restore-evidence.record",
];
const privateServices = ["postgres", "intake", "offer", "production", "exports"];
const finalServices = [...privateServices, "web"];

function sourceAt(filePath: string) {
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}

function markerFields(filePath: string) {
  return new Map(
    sourceAt(filePath)
      .split("\n")
      .filter((line) => line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)] as const;
      })
  );
}

function initializeFakeState(root: string) {
  mkdirSync(root, { recursive: true });
  const result = spawnSync("python3", [path.join(repoRoot, "platform-infra/scripts/phase3-fake-docker.py"), "--init"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, CATERING_PHASE3_FAKE_HOST_ROOT: root },
  });
  expect(result.status).toBe(0);
}

function sha256(filePath: string) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function canonicalMarkerHash(filePath: string) {
  return createHash("sha256")
    .update(sourceAt(filePath).replace(/^marker_sha256=.*$/m, "marker_sha256=absent"))
    .digest("hex");
}

function canonicalArchiveHash(filePath: string) {
  return createHash("sha256")
    .update(sourceAt(filePath).replace(/^archive_sha256=.*$/m, "archive_sha256=absent"))
    .digest("hex");
}

function uncommented(source: string) {
  return source.replace(/^\s*#(?!\!).*$/gm, "");
}

function workflowHeredoc(source: string, label: string) {
  const marker = `<<'${label}'`;
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) return "";
  const bodyStart = source.indexOf("\n", markerIndex) + 1;
  const terminator = `\n          ${label}`;
  const bodyEnd = source.indexOf(terminator, bodyStart);
  if (bodyEnd < 0) return "";
  const body = source.slice(bodyStart, bodyEnd);
  const firstCodeLine = body.split("\n").find((line) => line.trim().length > 0) ?? "";
  const indentation = firstCodeLine.match(/^\s*/)?.[0].length ?? 0;
  return body
    .split("\n")
    .map((line) => line.slice(Math.min(indentation, line.length)))
    .join("\n");
}

const localSudoScript = [
  "#!/bin/sh",
  "exec \"$@\"",
  "",
].join("\n");

const localStatScript = [
  "#!/bin/sh",
  "if [ \"$1\" = -c ] || [ \"$1\" = -f ]; then",
  "  format=\"$2\"",
  "  target=\"$3\"",
  "  exec node - \"$format\" \"$target\" <<'NODE'",
  "const fs = require(\"node:fs\");",
  "const [format, target] = process.argv.slice(2);",
  "const stats = fs.lstatSync(target);",
  "const mode = (stats.mode & 0o7777).toString(8);",
  "const values = { \"%a\": mode, \"%Lp\": mode, \"%u\": String(stats.uid), \"%g\": String(stats.gid), \"%i\": String(stats.ino), \"%h\": String(stats.nlink), \"%l\": String(stats.nlink) };",
  "const formats = new Set([\"%a\", \"%a %u %g\", \"%a %u %g %i %h\", \"%Lp\", \"%Lp %u %g\", \"%Lp %u %g %i %l\"]);",
  "if (!formats.has(format)) process.exit(2);",
  "process.stdout.write(format.split(\" \").map((field) => values[field]).join(\" \") + \"\\n\");",
  "NODE",
  "fi",
  "exec /usr/bin/stat \"$@\"",
  "",
].join("\n");

function runWorkflowHeredoc(
  label: string,
  args: string[],
  sudoScript = localSudoScript,
  sharedEdgeRoot?: string,
) {
  const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-workflow-shell-"));
  const bin = path.join(root, "bin");
  mkdirSync(bin, { recursive: true });
  writeFileSync(path.join(bin, "sudo"), sudoScript, { mode: 0o700 });
  chmodSync(path.join(bin, "sudo"), 0o700);
  writeFileSync(path.join(bin, "stat"), localStatScript, { mode: 0o700 });
  chmodSync(path.join(bin, "stat"), 0o700);
  const rawBody = workflowHeredoc(uncommented(sourceAt(callerWorkflowPaths[2]!)), label);
  const body = sharedEdgeRoot === undefined ? rawBody : rawBody.replaceAll("/opt/shared-edge", sharedEdgeRoot);
  return {
    root,
    result: spawnSync("/bin/bash", ["-s", "--", ...args], {
      cwd: repoRoot,
      encoding: "utf8",
      input: body,
      env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? "/usr/bin:/bin"}` },
    }),
  };
}

function runBootstrapHeredoc(
  label: string,
  ownerToken: string,
  sharedEdgeRoot: string,
  extraArgs: string[] = [],
  sudoScript?: string,
) {
  return runWorkflowHeredoc(label, [ownerToken, ...extraArgs], sudoScript, sharedEdgeRoot);
}

function requireHelper() {
  expect(existsSync(helperPath)).toBe(true);
  return uncommented(sourceAt(helperPath));
}

function serviceNames(compose: string) {
  const services = compose.match(/^services:\s*\n([\s\S]*?)(?=^networks:|\z)/m)?.[1] ?? "";
  return [...services.matchAll(/^ {2}([a-z][a-z0-9-]*):\s*$/gm)].map((match) => match[1]).sort();
}

function serviceBlock(compose: string, service: string) {
  const match = compose.match(
    new RegExp(`^ {2}${service}:\\s*\\n([\\s\\S]*?)(?=^ {2}[a-z][a-z0-9-]*:|^networks:|\\z)`, "m")
  );
  return match?.[1] ?? "";
}

function serviceNetworks(block: string) {
  const networks = block.match(/^ {4}networks:\s*!override\s*\n((?: {6}- .+\n?)+)/m)?.[1] ?? "";
  return [...networks.matchAll(/^ {6}- ([a-z][a-z0-9_]+)\s*$/gm)].map((match) => match[1]);
}

function rootNetworkNames(compose: string) {
  const networks = compose.match(/^networks:\s*\n([\s\S]*)$/m)?.[1] ?? "";
  return [...networks.matchAll(/^ {2}([a-z][a-z0-9_-]+):\s*$/gm)].map((match) => match[1]).sort();
}

function firstMutationIndex(script: string) {
  return script.search(/\b(?:rsync|ssh|docker(?:-compose)?|curl|gh)\b[\s\S]{0,160}?(?:up\b|run\b|dispatch\b|network\s+(?:create|connect|disconnect)|--delete|\bmv\b|\brm\b)/);
}

function createCommandSandbox(root: string) {
  const bin = path.join(root, "bin");
  const log = path.join(root, "real-command-attempts.log");
  mkdirSync(bin, { recursive: true });
  const body = [
    "#!/usr/bin/env bash",
    "set -eu",
    "printf '%s\\t%s\\n' \"$(basename \"$0\")\" \"$*\" >> \"${CATERING_PHASE3_SANDBOX_LOG:?}\"",
    "exit 86",
  ].join("\n");
  for (const command of ["ssh", "docker", "docker-compose", "gh", "curl", "act"]) {
    const stub = path.join(bin, command);
    try {
      lstatSync(stub);
      unlinkSync(stub);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    writeFileSync(stub, body, { mode: 0o700 });
    chmodSync(stub, 0o700);
  }
  return { bin, log };
}

function runHarness(scenario: string, fakeHostRoot = mkdtempSync(path.join(tmpdir(), "catering-phase3-fake-host-"))) {
  const sandbox = createCommandSandbox(fakeHostRoot);
  const result = spawnSync("/bin/bash", [helperPath, "--harness"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${sandbox.bin}:${process.env.PATH ?? ""}`,
      CATERING_PHASE3_TEST_MODE: "1",
      CATERING_PHASE3_FAKE_HOST_ROOT: fakeHostRoot,
      CATERING_PHASE3_HARNESS_SCENARIO: scenario,
      CATERING_PHASE3_SANDBOX_LOG: sandbox.log,
    },
  });
  return { fakeHostRoot, sandbox, result };
}

function runWithBash32(scriptPath: string, env: Record<string, string>) {
  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    ...env,
    PATH: env.PATH ?? process.env.PATH ?? "/usr/bin:/bin",
  };
  delete childEnv.BASHPID;
  return spawnSync("/bin/bash", [scriptPath], {
    cwd: repoRoot,
    encoding: "utf8",
    env: childEnv,
  });
}

describe("Phase-3 Catering isolation pilot contract", () => {
  test("does not dereference unset BASHPID in the platform caller's Bash 3.2 guard", () => {
    const result = runWithBash32(callerPaths[0], {
      DEPLOY_HOST: "phase3.invalid",
      DEPLOY_COMMIT_SHA: "5b0eaed96dc0f57d091c5ea3b4741e121d0b9d47",
    });
    expect(`${result.stdout}${result.stderr}`).not.toContain("BASHPID: unbound variable");
  });

  test("does not dereference unset BASHPID in the edge caller's Bash 3.2 guard", () => {
    const fakeBin = mkdtempSync(path.join(tmpdir(), "catering-phase3-bash32-bin-"));
    for (const command of ["ssh", "rsync", "docker"]) {
      const stub = path.join(fakeBin, command);
      writeFileSync(stub, "#!/bin/sh\nexit 1\n", { mode: 0o700 });
      chmodSync(stub, 0o700);
    }
    const result = runWithBash32(callerPaths[2], {
      PATH: `${fakeBin}:${process.env.PATH ?? "/usr/bin:/bin"}`,
      DEPLOY_HOST: "phase3.invalid",
      EDGE_DEPLOY_PATH: "/opt/shared-edge",
      EDGE_DEPLOY_COMMIT_SHA: "5b0eaed96dc0f57d091c5ea3b4741e121d0b9d47",
      EDGE_MODE: "rehearsal",
      CATERING_SMOKE_URL: "https://catering.invalid",
      ZEITERFASSUNG_SMOKE_URL: "https://zeit.invalid",
      EVENTOS_SMOKE_URL: "https://eventos.invalid",
      CATERING_SMOKE_BASIC_AUTH_USER: "test-user",
      CATERING_SMOKE_BASIC_AUTH_PASSWORD: "test-password",
    });
    expect(`${result.stdout}${result.stderr}`).not.toContain("BASHPID: unbound variable");
  });

  test("adds only the four isolated pilot surfaces before any production runtime mutation", () => {
    expect(existsSync(workflowPath)).toBe(true);
    expect(existsSync(platformComposePath)).toBe(true);
    expect(existsSync(edgeComposePath)).toBe(true);
    expect(existsSync(helperPath)).toBe(true);
  });

  test("makes the pilot an exclusively manual main-production workflow with one owner helper", () => {
    const workflow = uncommented(sourceAt(workflowPath));
    expect(workflow).toMatch(/^on:\s*\n\s*workflow_dispatch:\s*(?:\n|$)/m);
    expect(workflow).not.toMatch(/^\s*(?:push|pull_request|pull_request_target|schedule|workflow_call|workflow_run):/m);
    expect(workflow).toMatch(/github\.ref\s*==\s*['"]refs\/heads\/main['"]/);
    expect(workflow).toMatch(/^\s*environment:\s*production\s*$/m);
    expect(workflow).toMatch(/^permissions:\s*\n\s*contents:\s*read\s*$/m);
    for (const secret of ["HETZNER_DEPLOY_HOST", "HETZNER_DEPLOY_USER", "HETZNER_SSH_PRIVATE_KEY", "HETZNER_KNOWN_HOSTS"]) {
      expect(workflow).toContain(`secrets.${secret}`);
    }
    expect(workflow).not.toMatch(/(?:echo|printf)\b[^\n]*secrets\./i);
    expect(workflow.match(/(?:bash\s+)?platform-infra\/scripts\/catering-phase3-pilot\.sh/g) ?? []).toHaveLength(1);
  });

  test("uses Compose !override and an exact final six-service Catering ownership matrix", () => {
    const compose = uncommented(sourceAt(platformComposePath));
    expect(serviceNames(compose)).toEqual([...finalServices].sort());
    expect(rootNetworkNames(compose)).toEqual(["catering_ingress", "catering_private"]);
    for (const network of ["catering_ingress", "catering_private"]) {
      expect(compose).toMatch(new RegExp(`^ {2}${network}:\\s*\\n {4}external: true\\s*$`, "m"));
    }
    for (const service of privateServices) {
      const block = serviceBlock(compose, service);
      expect(serviceNetworks(block)).toEqual(["catering_private"]);
      expect(block).not.toMatch(/^ {4}ports:/m);
    }
    const web = serviceBlock(compose, "web");
    expect(serviceNetworks(web)).toEqual(["catering_ingress", "catering_private"]);
    expect(compose).toMatch(/^ {2}catering_private:\s*[\s\S]*?^ {4}internal: false\s*$/m);
  });

  test("keeps the Shared Edge runtime identity and adds only the external ingress consumer", () => {
    const compose = uncommented(sourceAt(edgeComposePath));
    const baseCompose = uncommented(sourceAt(path.join(repoRoot, "edge-infra/docker-compose.yml")));
    expect(baseCompose).toMatch(/^name:\s*shared-edge\s*$/m);
    expect(serviceNames(compose)).toEqual(["edge"]);
    expect(rootNetworkNames(compose)).toEqual(["catering_ingress", "platform-infra_default", "zeiterfassung_default"]);
    expect(compose).toMatch(/^ {2}catering_ingress:\s*\n {4}external: true\s*$/m);
    expect(compose).not.toContain("catering_private");
    for (const requiredRuntimeField of ["http://web:8081", "80:80", "443:443", "Caddyfile", "image:", "volumes:"]) {
      expect(baseCompose).toContain(requiredRuntimeField);
    }
    expect(compose).not.toMatch(/^(?: {4})(?:image|restart|ports|environment|volumes):/m);
  });

  test("requires the fixed marker, manifest, lock, source-readback, and rollback protocol", () => {
    const helper = requireHelper();
    expect(helper).toMatch(/^#!\/usr\/bin\/env bash/m);
    expect(helper).toContain("2.24.4");
    for (const fixedPath of protectedPaths) expect(helper).toContain(fixedPath);
    expect(helper.indexOf("/opt/catering-agents-platform.deploy-lock")).toBeLessThan(
      helper.indexOf("/opt/shared-edge.deploy-lock")
    );
    for (const state of ["absent", "inactive", "candidate", "active", "rolling_back"]) expect(helper).toContain(state);
    for (const field of [
      "transaction_id",
      "transaction_manifest_path",
      "transaction_manifest_sha256",
      "expected_platform_source_sha256",
      "expected_edge_source_sha256",
      "baseline_network_status",
      "catering_ingress_id",
      "catering_private_id",
      "restore_evidence_sha256",
      "restore_proof_archive_path",
      "restore_proof_archive_sha256",
    ]) expect(helper).toContain(field);
    expect(helper).toMatch(/sha256sum/);
    expect(helper).toMatch(/\bcmp\b/);
    expect(helper).toMatch(/\bmv\b/);
    expect(helper).toMatch(/archive[^\n]{0,160}receipt|restore-proof[^\n]{0,240}completion.receipt/i);
    expect(helper).toContain("rollback_transaction()");
    expect(helper).toContain("remove_owned_network");
    expect(helper).toContain("docker network rm");
    expect(helper).toContain("candidate_written");
    expect(helper).toContain("rollback_started");
    expect(helper).toMatch(/PILOT:\s*(?:GO|ROLLED BACK|NO-GO)/);
    expect(helper).not.toMatch(/docker compose\s+down|docker (?:system|network|volume) prune|\brm\s+-rf\b/);
  });

  test("exposes owner/run-bound resume and rollback commands with strict rehydration", () => {
    const helper = requireHelper();
    for (const command of ["--resume", "--rollback", "rehydrate_manifest", "validate_receipt", "owner_token", "run_id"]) {
      expect(helper).toContain(command);
    }
    expect(helper).toMatch(/candidate\|active\|rolling_back/);
    expect(helper).toMatch(/manifest[^\n]{0,180}(?:sha256|cmp)[^\n]{0,180}(?:owner|transaction)/i);
    expect(helper).toContain('phase3_lock_acquire "${platform_lock}" held_platform');
    expect(helper).toContain('phase3_lock_acquire "${edge_lock}" held_edge');
    expect(helper).toContain('case "${command_name}:${recovery_class}" in');
  });

  test("uses inactive and active file chains while freezing active identity-changing callers", () => {
    const helper = requireHelper();
    const inactiveChain = ["docker-compose.yml", "docker-compose.production.yml", "docker-compose.edge-cutover.yml"];
    for (const composeFile of inactiveChain) expect(helper).toContain(composeFile);
    expect(helper).toContain("platform-compose.phase3.yml");
    expect(helper).toContain("edge-compose.phase3.yml");
    const active = helper.indexOf("active");
    const firstUpAfterActive = helper.indexOf(" up ", active);
    expect(active).toBeGreaterThanOrEqual(0);
    expect(firstUpAfterActive).toBe(-1);
    expect(helper).toMatch(/active[\s\S]{0,600}(?:read-only|readonly|config)/i);
  });

  test("binds stage-aware P2 membership, aliases, foreign invariants, smokes, and egress", () => {
    const helper = requireHelper();
    for (const stage of ["S0", "S1", "S2", "S3", "D1", "D2", "D3", "D4", "D5", "D6", "S4"]) expect(helper).toContain(stage);
    const orderedDetachTerms = ["postgres", "intake", "offer", "production", "exports", "zeiterfassung_default", "platform-infra_default"];
    let previous = -1;
    for (const term of orderedDetachTerms) {
      const next = helper.indexOf(term, previous + 1);
      expect(next).toBeGreaterThan(previous);
      previous = next;
    }
    for (const symbol of ["platform-infra-web-1", "platform-infra-postgres-1", "platform-infra-intake-1", "platform-infra-offer-1", "platform-infra-production-1", "platform-infra-exports-1", "shared-edge-edge-1", "zeiterfassung-app-1", "commcats-eventos-app", "commcats-eventos-postgres", "deploy-web-1", "deploy-ingest-1", "deploy-db-1"]) expect(helper).toContain(symbol);
    expect(helper).toMatch(/web[^\n]{0,100}platform-infra-web-1|platform-infra-web-1[^\n]{0,100}web/);
    expect(helper).toMatch(/edge[^\n]{0,100}shared-edge-edge-1|shared-edge-edge-1[^\n]{0,100}edge/);
    for (const foreignField of ["RestartCount", "StartedAt", "HostConfig.PortBindings", "com.docker.compose.project", "com.docker.compose.service", "NetworkSettings"]) expect(helper).toContain(foreignField);
    expect(helper).toContain("service=intake-service");
    expect(helper).toContain("status=ok");
    expect(helper).toContain("not_exercised");
    expect(helper).toContain("web:8081");
    expect(helper).toMatch(/shared-edge-edge-1[\s\S]{0,180}foreign|foreign[\s\S]{0,180}shared-edge-edge-1/);
    for (const smoke of ["run_all_host_semantic_smokes", "assert_private_reachability", "assert_isolation_gate", "last_consumer_gate", "negative_edge_probe"]) {
      expect(helper).toContain(smoke);
    }
  });

  test("makes existing callers parse the marker under both locks before their first mutation", () => {
    for (const callerPath of callerPaths) {
      const caller = uncommented(sourceAt(callerPath));
      const marker = caller.indexOf("phase3.activation");
      const manifest = caller.indexOf("phase3.transaction-baseline.manifest");
      const guardDefinition = caller.indexOf("phase3_guard()");
      const guardBlock = caller.slice(guardDefinition, caller.indexOf("\n}", guardDefinition) + 2);
      const platformLock = guardBlock.indexOf("/opt/catering-agents-platform.deploy-lock");
      const edgeLock = guardBlock.indexOf("/opt/shared-edge.deploy-lock");
      const guardInvocation = caller.indexOf("phase3_guard", caller.indexOf("phase3_guard") + 1);
      expect(marker).toBeGreaterThanOrEqual(0);
      expect(manifest).toBeGreaterThanOrEqual(0);
      expect(platformLock).toBeGreaterThanOrEqual(0);
      expect(platformLock).toBeGreaterThanOrEqual(0);
      expect(edgeLock).toBeGreaterThan(platformLock);
      expect(guardInvocation).toBeGreaterThanOrEqual(0);
      const recheck = caller.indexOf("phase3_recheck", guardInvocation);
      if (callerPath.endsWith("post-cutover-evidence.sh")) {
        expect(caller.indexOf("remote_snapshot", guardInvocation)).toBeGreaterThan(guardInvocation);
      } else {
        expect(recheck).toBeGreaterThan(guardInvocation);
      }
    }
    const evidence = uncommented(sourceAt(callerPaths.at(-1)!));
    const phase3Guard = evidence.indexOf("NOT_APPLICABLE_PHASE3");
    const firstProbe = evidence.search(/\b(?:curl|probe|smoke)\b/);
    expect(phase3Guard).toBeGreaterThanOrEqual(0);
    expect(firstProbe).toBeGreaterThan(phase3Guard);
  });

  test("keeps every production caller manual/main/production-only and guards edge bootstrap", () => {
    for (const workflowPath of callerWorkflowPaths) {
      const workflow = uncommented(sourceAt(workflowPath));
      expect(workflow).toMatch(/^on:\s*\n\s*workflow_dispatch:\s*(?:\n|$)/m);
      expect(workflow).not.toMatch(/^\s*(?:push|pull_request|pull_request_target|schedule|workflow_call|workflow_run):/m);
      expect(workflow).toMatch(/^\s*environment:\s*production\s*$/m);
      expect(workflow).toMatch(/^permissions:\s*\n\s*contents:\s*read\s*$/m);
      expect(workflow).toMatch(/github\.ref\s*==\s*['"]refs\/heads\/main['"]|GITHUB_REF_NAME.*main/);
    }
    const edgeWorkflow = uncommented(sourceAt(callerWorkflowPaths[2]!));
    expect(edgeWorkflow.indexOf("Guard Phase 3 owner state before edge bootstrap")).toBeGreaterThanOrEqual(0);
    expect(edgeWorkflow.indexOf("Guard Phase 3 owner state before edge bootstrap")).toBeLessThan(
      edgeWorkflow.indexOf("Bootstrap protected edge env if missing")
    );
    expect(edgeWorkflow.indexOf("/opt/catering-agents-platform.deploy-lock")).toBeLessThan(
      edgeWorkflow.indexOf("/opt/shared-edge.deploy-lock")
    );
    expect(edgeWorkflow).toContain("phase3-lock-release");
  });

  test("keeps caller locks held through mutation and releases only with owner proof", () => {
    for (const callerPath of callerPaths.slice(0, 4)) {
      const caller = uncommented(sourceAt(callerPath));
      expect(caller).toMatch(/phase3_release|phase3-lock-release/);
      expect(caller).toMatch(/phase3_lock_owner|owner_token|PHASE3_LOCK_OWNER/);
      expect(caller).toMatch(/phase3_recheck/);
      expect(caller).toMatch(/owner[^\n]{0,100}(?:token|run|transaction)/i);
    }
  });

  test("executes pre-deploy lock cleanup only for an untouched, exact owner stage", () => {
    const workflow = uncommented(sourceAt(callerWorkflowPaths[2]!));
    const cleanup = workflowHeredoc(workflow, "REMOTE_PHASE3_PREDEPLOY_RELEASE");
    expect(cleanup).not.toBe("");
    expect(workflow).toContain("id: phase3_guard");
    expect(workflow).toContain("id: bootstrap_edge_env");
    expect(workflow).toContain("id: deploy_edge");
    expect(workflow).toMatch(/phase3-lock-predeploy-failure-release[\s\S]{0,500}PHASE3_BOOTSTRAP_OUTCOME: \$\{\{ steps\.bootstrap_edge_env\.outcome \}\}/);
    expect(workflow).toMatch(/failure\(\)[^\n]*steps\.phase3_guard\.outcome == ['\"]success['\"]/);
    expect(workflow).toMatch(/deploy_edge\.outcome == ['\"]skipped['\"]/);
    expect(workflow).not.toMatch(/bootstrap_edge_env\.outcome == ['\"]skipped['\"]/);

    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-predeploy-locks-"));
    const platformLock = path.join(root, "platform.lock");
    const edgeLock = path.join(root, "edge.lock");
    const marker = path.join(root, "phase3.activation");
    const manifest = path.join(root, "phase3.transaction-baseline.manifest");
    const archive = path.join(root, "phase3.rollback-restore-proof.archive");
    const receipt = path.join(root, "phase3.rollback-completion.receipt");
    const evidence = path.join(root, "phase3.restore-evidence.record");
    const journal = path.join(root, "phase3.network-adoption.journal");
    const bootstrapRoot = path.join(root, "shared-edge");
    mkdirSync(bootstrapRoot, { mode: 0o700 });
    const token = "phase3-normal-test-run";
    for (const lock of [platformLock, edgeLock]) {
      mkdirSync(lock, { mode: 0o700 });
      writeFileSync(path.join(lock, "owner"), `owner_token=${token}\nowner=normal-caller-phase3-guard\n`, { mode: 0o600 });
      chmodSync(path.join(lock, "owner"), 0o600);
    }
    const released = runWorkflowHeredoc("REMOTE_PHASE3_PREDEPLOY_RELEASE", [
      token, platformLock, edgeLock, marker, manifest, archive, receipt, evidence, journal,
      "skipped", bootstrapRoot,
    ]);
    expect(released.result.status).toBe(0);
    expect(existsSync(platformLock)).toBe(false);
    expect(existsSync(edgeLock)).toBe(false);

    const guardedRoot = mkdtempSync(path.join(tmpdir(), "catering-phase3-predeploy-stage-"));
    const guardedPlatformLock = path.join(guardedRoot, "platform.lock");
    const guardedEdgeLock = path.join(guardedRoot, "edge.lock");
    const guardedMarker = path.join(guardedRoot, "phase3.activation");
    const guardedBootstrapRoot = path.join(guardedRoot, "shared-edge");
    mkdirSync(guardedBootstrapRoot, { mode: 0o700 });
    for (const lock of [guardedPlatformLock, guardedEdgeLock]) {
      mkdirSync(lock, { mode: 0o700 });
      writeFileSync(path.join(lock, "owner"), `owner_token=${token}\nowner=normal-caller-phase3-guard\n`, { mode: 0o600 });
      chmodSync(path.join(lock, "owner"), 0o600);
    }
    writeFileSync(guardedMarker, "state=candidate\n");
    const untouched = runWorkflowHeredoc("REMOTE_PHASE3_PREDEPLOY_RELEASE", [
      token,
      guardedPlatformLock,
      guardedEdgeLock,
      guardedMarker,
      path.join(guardedRoot, "manifest"),
      path.join(guardedRoot, "archive"),
      path.join(guardedRoot, "receipt"),
      path.join(guardedRoot, "evidence"),
      path.join(guardedRoot, "journal"),
      "skipped", guardedBootstrapRoot,
    ]);
    expect(untouched.result.status).not.toBe(0);
    expect(existsSync(guardedPlatformLock)).toBe(true);
    expect(existsSync(guardedEdgeLock)).toBe(true);

    for (const failureStage of ["validation", "bootstrap"]) {
      const stageRoot = mkdtempSync(path.join(tmpdir(), `catering-phase3-predeploy-${failureStage}-`));
      const stagePlatformLock = path.join(stageRoot, "platform.lock");
      const stageEdgeLock = path.join(stageRoot, "edge.lock");
      const stageBootstrapRoot = path.join(stageRoot, "shared-edge");
      mkdirSync(stageBootstrapRoot, { mode: 0o700 });
      for (const lock of [stagePlatformLock, stageEdgeLock]) {
        mkdirSync(lock, { mode: 0o700 });
        writeFileSync(path.join(lock, "owner"), `owner_token=${token}\nowner=normal-caller-phase3-guard\n`, { mode: 0o600 });
        chmodSync(path.join(lock, "owner"), 0o600);
      }
      if (failureStage === "bootstrap") {
        writeFileSync(
          path.join(stageBootstrapRoot, ".env.bootstrap-state"),
          `schema=1\nowner_token=${token}\nstate=not_started\nstage=bootstrap\n`,
          { mode: 0o600 },
        );
      }
      const preDeployFailure = runWorkflowHeredoc("REMOTE_PHASE3_PREDEPLOY_RELEASE", [
        token,
        stagePlatformLock,
        stageEdgeLock,
        path.join(stageRoot, "phase3.activation"),
        path.join(stageRoot, "manifest"),
        path.join(stageRoot, "archive"),
        path.join(stageRoot, "receipt"),
        path.join(stageRoot, "evidence"),
        path.join(stageRoot, "journal"),
        failureStage === "validation" ? "skipped" : "failure",
        stageBootstrapRoot,
      ]);
      expect(preDeployFailure.result.status, failureStage).toBe(0);
      expect(existsSync(stagePlatformLock), failureStage).toBe(false);
      expect(existsSync(stageEdgeLock), failureStage).toBe(false);
    }

    for (const mutation of ["env", "pending"]) {
      const mutatedRoot = mkdtempSync(path.join(tmpdir(), `catering-phase3-predeploy-mutated-${mutation}-`));
      const mutatedPlatformLock = path.join(mutatedRoot, "platform.lock");
      const mutatedEdgeLock = path.join(mutatedRoot, "edge.lock");
      const mutatedBootstrapRoot = path.join(mutatedRoot, "shared-edge");
      mkdirSync(mutatedBootstrapRoot, { mode: 0o700 });
      for (const lock of [mutatedPlatformLock, mutatedEdgeLock]) {
        mkdirSync(lock, { mode: 0o700 });
        writeFileSync(path.join(lock, "owner"), `owner_token=${token}\nowner=normal-caller-phase3-guard\n`, { mode: 0o600 });
        chmodSync(path.join(lock, "owner"), 0o600);
      }
      if (mutation === "env") {
        writeFileSync(path.join(mutatedBootstrapRoot, ".env"), "PARTIAL_BOOTSTRAP=1\n", { mode: 0o600 });
        writeFileSync(
          path.join(mutatedBootstrapRoot, ".env.bootstrap-state"),
          `schema=1\nowner_token=${token}\nstate=mutation_started\nstage=bootstrap\n`,
          { mode: 0o600 },
        );
      } else {
        writeFileSync(path.join(mutatedBootstrapRoot, ".env.pending.4242"), "PARTIAL_BOOTSTRAP=1\n", { mode: 0o600 });
      }
      const partialMutation = runWorkflowHeredoc("REMOTE_PHASE3_PREDEPLOY_RELEASE", [
        token,
        mutatedPlatformLock,
        mutatedEdgeLock,
        path.join(mutatedRoot, "phase3.activation"),
        path.join(mutatedRoot, "manifest"),
        path.join(mutatedRoot, "archive"),
        path.join(mutatedRoot, "receipt"),
        path.join(mutatedRoot, "evidence"),
        path.join(mutatedRoot, "journal"),
        "failure",
        mutatedBootstrapRoot,
      ]);
      expect(partialMutation.result.status, mutation).not.toBe(0);
      expect(existsSync(mutatedPlatformLock), mutation).toBe(true);
      expect(existsSync(mutatedEdgeLock), mutation).toBe(true);
    }
  });

  test("keeps cleanup fail-closed for foreign owners, hardlinks, and failed state removal", () => {
    const token = "phase3-normal-state-proof";
    const stateContent = [
      "schema=1",
      "owner_token=" + token,
      "state=not_started",
      "stage=bootstrap",
      "",
    ].join("\n");
    const prepare = (prefix: string) => {
      const root = mkdtempSync(path.join(tmpdir(), prefix));
      const platformLock = path.join(root, "platform.lock");
      const edgeLock = path.join(root, "edge.lock");
      const bootstrapRoot = path.join(root, "shared-edge");
      mkdirSync(bootstrapRoot, { mode: 0o700 });
      for (const lock of [platformLock, edgeLock]) {
        mkdirSync(lock, { mode: 0o700 });
        writeFileSync(
          path.join(lock, "owner"),
          "owner_token=" + token + "\nowner=normal-caller-phase3-guard\n",
          { mode: 0o600 },
        );
        chmodSync(path.join(lock, "owner"), 0o600);
      }
      const state = path.join(bootstrapRoot, ".env.bootstrap-state");
      writeFileSync(state, stateContent, { mode: 0o600 });
      return { root, platformLock, edgeLock, bootstrapRoot, state };
    };
    const argsFor = (caseState: ReturnType<typeof prepare>) => [
      token,
      caseState.platformLock,
      caseState.edgeLock,
      path.join(caseState.root, "phase3.activation"),
      path.join(caseState.root, "manifest"),
      path.join(caseState.root, "archive"),
      path.join(caseState.root, "receipt"),
      path.join(caseState.root, "evidence"),
      path.join(caseState.root, "journal"),
      "failure",
      caseState.bootstrapRoot,
    ];

    const hardlinkState = prepare("catering-phase3-hardlink-state-");
    const foreignState = path.join(hardlinkState.root, "foreign-state");
    linkSync(hardlinkState.state, foreignState);
    const hardlink = runWorkflowHeredoc("REMOTE_PHASE3_PREDEPLOY_RELEASE", argsFor(hardlinkState));
    expect(hardlink.result.status, "hardlink").not.toBe(0);
    expect(existsSync(hardlinkState.platformLock), "hardlink").toBe(true);
    expect(existsSync(hardlinkState.edgeLock), "hardlink").toBe(true);
    expect(existsSync(foreignState), "hardlink").toBe(true);
    expect(existsSync(hardlinkState.state), "hardlink").toBe(true);

    const foreignOwnerState = prepare("catering-phase3-foreign-owner-state-");
    const foreignStat = [
      "#!/bin/sh",
      "if [ \"$1\" = stat ] && [ \"$4\" = \"" + foreignOwnerState.state + "\" ]; then",
      "  case \"$3\" in",
      "    %a) printf '%s\\n' 600 ;;",
      "    *%u*|*%g*|*%i*|*%h*) printf '%s\\n' '600 65534 65534 12345 1' ;;",
      "    *) exit 1 ;;",
      "  esac",
      "  exit 0",
      "fi",
      "exec \"$@\"",
      "",
    ].join("\n");
    const foreignOwner = runWorkflowHeredoc(
      "REMOTE_PHASE3_PREDEPLOY_RELEASE",
      argsFor(foreignOwnerState),
      foreignStat,
    );
    expect(foreignOwner.result.status, "foreign-owner").not.toBe(0);
    expect(existsSync(foreignOwnerState.platformLock), "foreign-owner").toBe(true);
    expect(existsSync(foreignOwnerState.edgeLock), "foreign-owner").toBe(true);
    expect(existsSync(foreignOwnerState.state), "foreign-owner").toBe(true);

    const failedRemovalState = prepare("catering-phase3-failed-state-removal-");
    const refusingUnlink = [
      "#!/bin/sh",
      "if [ \"$1\" = unlink ] && [ \"$2\" = \"" + failedRemovalState.state + "\" ]; then exit 77; fi",
      "exec \"$@\"",
      "",
    ].join("\n");
    const failedRemoval = runWorkflowHeredoc(
      "REMOTE_PHASE3_PREDEPLOY_RELEASE",
      argsFor(failedRemovalState),
      refusingUnlink,
    );
    expect(failedRemoval.result.status, "failed-removal").not.toBe(0);
    expect(existsSync(failedRemovalState.platformLock), "failed-removal").toBe(true);
    expect(existsSync(failedRemovalState.edgeLock), "failed-removal").toBe(true);
    expect(existsSync(failedRemovalState.state), "failed-removal").toBe(true);
  });

  test.each(["preexisting", "not_started"])(
    "rejects %s bootstrap success when the state has a foreign hardlink",
    (initialState) => {
      const root = mkdtempSync(path.join(tmpdir(), `catering-phase3-${initialState}-success-hardlink-`));
      const token = `phase3-normal-${initialState}-success`;
      const state = path.join(root, ".env.bootstrap-state");
      mkdirSync(root, { mode: 0o700, recursive: true });
      if (initialState === "preexisting") {
        writeFileSync(path.join(root, ".env"), "EDGE_SECRET=fixture\n", { mode: 0o600 });
      }

      const begin = runBootstrapHeredoc("REMOTE_PHASE3_BOOTSTRAP_BEGIN", token, root);
      expect(begin.result.status, `${initialState} begin`).toBe(0);
      expect(begin.result.stdout.trim(), `${initialState} begin state`).toBe(initialState);
      const foreignState = path.join(root, "foreign-bootstrap-state");
      linkSync(state, foreignState);

      let success;
      if (initialState === "preexisting") {
        success = runWorkflowHeredoc(
          "REMOTE_PHASE3_BOOTSTRAP_PREEXISTING",
          [token],
          undefined,
          root,
        );
      } else {
        const tmp = path.join(root, "edge.env.example");
        writeFileSync(tmp, "EDGE_SECRET=fixture\n", { mode: 0o600 });
        success = runWorkflowHeredoc(
          "REMOTE_SCRIPT",
          [tmp, token],
          undefined,
          root,
        );
      }

      expect(success.result.status, `${initialState} hardlink`).not.toBe(0);
      expect(existsSync(state), `${initialState} canonical state`).toBe(true);
      expect(existsSync(foreignState), `${initialState} foreign state`).toBe(true);
    },
  );

  test("rejects bootstrap success when the state owner UID/GID is foreign", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-bootstrap-foreign-owner-"));
    const token = "phase3-normal-foreign-owner";
    const state = path.join(root, ".env.bootstrap-state");
    mkdirSync(root, { mode: 0o700, recursive: true });
    writeFileSync(path.join(root, ".env"), "EDGE_SECRET=fixture\n", { mode: 0o600 });
    const begin = runBootstrapHeredoc("REMOTE_PHASE3_BOOTSTRAP_BEGIN", token, root);
    expect(begin.result.status).toBe(0);
    const foreignStat = [
      "#!/bin/sh",
      `if [ \"$1\" = stat ] && [ \"$4\" = \"${state}\" ]; then`,
      "  case \"$3\" in",
      "    *%u*|*%g*|*%i*|*%h*) printf '%s\\n' '600 65534 65534 12345 1' ;;",
      "    *) printf '%s\\n' 600 ;;",
      "  esac",
      "  exit 0",
      "fi",
      "exec \"$@\"",
      "",
    ].join("\n");
    const result = runWorkflowHeredoc("REMOTE_PHASE3_BOOTSTRAP_PREEXISTING", [token], foreignStat, root);
    expect(result.result.status).not.toBe(0);
    expect(existsSync(state)).toBe(true);
  });

  test.each(["symlink", "directory"])("keeps bootstrap state unchanged for a %s", (kind) => {
    const root = mkdtempSync(path.join(tmpdir(), `catering-phase3-bootstrap-${kind}-state-`));
    const token = `phase3-normal-${kind}-state`;
    const state = path.join(root, ".env.bootstrap-state");
    mkdirSync(root, { mode: 0o700, recursive: true });
    writeFileSync(path.join(root, ".env"), "EDGE_SECRET=fixture\n", { mode: 0o600 });
    const begin = runBootstrapHeredoc("REMOTE_PHASE3_BOOTSTRAP_BEGIN", token, root);
    expect(begin.result.status).toBe(0);
    unlinkSync(state);
    if (kind === "symlink") {
      const target = path.join(root, "foreign-state");
      writeFileSync(target, "schema=1\n", { mode: 0o600 });
      symlinkSync(target, state);
    } else {
      mkdirSync(state, { mode: 0o700 });
    }
    const result = runWorkflowHeredoc("REMOTE_PHASE3_BOOTSTRAP_PREEXISTING", [token], undefined, root);
    expect(result.result.status).not.toBe(0);
    expect(lstatSync(state).isSymbolicLink(), kind).toBe(kind === "symlink");
  });

  test("rejects bootstrap success when state content contains an unknown field", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-bootstrap-state-content-"));
    const token = "phase3-normal-state-content";
    const state = path.join(root, ".env.bootstrap-state");
    mkdirSync(root, { mode: 0o700, recursive: true });
    writeFileSync(path.join(root, ".env"), "EDGE_SECRET=fixture\n", { mode: 0o600 });
    const begin = runBootstrapHeredoc("REMOTE_PHASE3_BOOTSTRAP_BEGIN", token, root);
    expect(begin.result.status).toBe(0);
    writeFileSync(state, `${sourceAt(state)}unexpected=1\n`, { mode: 0o600 });
    const result = runWorkflowHeredoc("REMOTE_PHASE3_BOOTSTRAP_PREEXISTING", [token], undefined, root);
    expect(result.result.status).not.toBe(0);
    expect(existsSync(state)).toBe(true);
  });

  test("rejects bootstrap success when the state inode changes during readback", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-bootstrap-state-inode-"));
    const token = "phase3-normal-state-inode";
    const state = path.join(root, ".env.bootstrap-state");
    const counter = path.join(root, "stat-counter");
    mkdirSync(root, { mode: 0o700, recursive: true });
    writeFileSync(path.join(root, ".env"), "EDGE_SECRET=fixture\n", { mode: 0o600 });
    const begin = runBootstrapHeredoc("REMOTE_PHASE3_BOOTSTRAP_BEGIN", token, root);
    expect(begin.result.status).toBe(0);
    const unstableStat = [
      "#!/bin/sh",
      `if [ \"$1\" = stat ] && [ \"$4\" = \"${state}\" ] && printf '%s' \"$3\" | grep -q '%i'; then`,
      `  if [ -e \"${counter}\" ]; then inode=222; else inode=111; fi`,
      `  : > \"${counter}\"`,
      `  printf '600 %s %s %s 1\\n' \"$(id -u)\" \"$(id -g)\" \"$inode\"`,
      "  exit 0",
      "fi",
      "exec \"$@\"",
      "",
    ].join("\n");
    const result = runWorkflowHeredoc("REMOTE_PHASE3_BOOTSTRAP_PREEXISTING", [token], unstableStat, root);
    expect(result.result.status).not.toBe(0);
    expect(existsSync(state)).toBe(true);
  });

  test("executes normal, crash-resume, and forced-error rollback through the real pilot helper", () => {
    const normal = runHarness("full-pilot");
    expect(normal.result.status).toBe(0);
    expect(sourceAt(path.join(normal.fakeHostRoot, "fake-ssh.log"))).toMatch(/bash -s --/);
    const normalDockerLog = sourceAt(path.join(normal.fakeHostRoot, "fake-docker.log")).split("\n");
    expect(normalDockerLog.join("\n")).toMatch(/compose/);
    expect(normalDockerLog.join("\n")).toMatch(/network create/);
    expect(normalDockerLog.findIndex((line) => line.includes("exec shared-edge-edge-1 wget"))).toBeLessThan(
      normalDockerLog.findIndex((line) => line.includes("network create")),
    );
    const normalManifest = markerFields(path.join(normal.fakeHostRoot, "phase3.transaction-baseline.manifest"));
    expect(normalManifest.get("schema")).toBe("phase3.2.transaction-baseline");
    expect(normalManifest.get("baseline_smoke_evidence")).toMatch(
      /^catering:[0-9a-f]{64};zeiterfassung:[0-9a-f]{64};eventos:[0-9a-f]{64}$/,
    );
    expect(normalManifest.get("baseline_smoke_sha256")).toMatch(/^[0-9a-f]{64}$/);

    const resumedRoot = mkdtempSync(path.join(tmpdir(), "catering-phase3-real-resume-"));
    const crashed = runHarness("crash-after-candidate", resumedRoot);
    expect(crashed.result.status).not.toBe(0);
    expect(sourceAt(path.join(resumedRoot, "phase3.activation"))).toMatch(/^state=candidate$/m);
    const crashState = JSON.parse(sourceAt(path.join(resumedRoot, "fake-docker-state.json"))) as {
      networks: Record<string, { containers: Record<string, { Name?: string }> }>;
    };
    expect(Object.values(crashState.networks.catering_ingress.containers).map((entry) => entry.Name?.replace(/^\//, "")).sort()).toEqual([
      "platform-infra-web-1",
      "shared-edge-edge-1",
    ]);
    expect(Object.values(crashState.networks.catering_private.containers).map((entry) => entry.Name?.replace(/^\//, "")).sort()).toEqual([
      "platform-infra-exports-1",
      "platform-infra-intake-1",
      "platform-infra-offer-1",
      "platform-infra-postgres-1",
      "platform-infra-production-1",
      "platform-infra-web-1",
    ]);
    const resumed = runHarness("resume-candidate", resumedRoot);
    // The run-created candidate has a complete immutable manifest and may be
    // resumed into the supported active state after the crash.
    expect(resumed.result.status).toBe(0);
    expect(`${resumed.result.stdout}${resumed.result.stderr}`).toContain("PILOT: GO");
    expect(sourceAt(path.join(resumedRoot, "phase3.activation"))).toMatch(/^state=active$/m);
    expect(sourceAt(path.join(resumedRoot, "fake-ssh.log"))).toMatch(/command=resume/);

    const rollingBackRoot = mkdtempSync(path.join(tmpdir(), "catering-phase3-rolling-back-resume-"));
    const crashedRollback = runHarness("crash-after-rollback", rollingBackRoot);
    expect(crashedRollback.result.status).not.toBe(0);
    expect(sourceAt(path.join(rollingBackRoot, "phase3.activation"))).toMatch(/^state=rolling_back$/m);
    const resumedRollingBack = runHarness("resume-rolling-back", rollingBackRoot);
    const resumedRollingBackOutput = `${resumedRollingBack.result.stdout}${resumedRollingBack.result.stderr}`;
    expect(resumedRollingBack.result.status).toBe(0);
    expect(resumedRollingBackOutput).toContain("PILOT: ROLLED BACK");
    expect(resumedRollingBackOutput).not.toContain("PILOT: GO");
    expect(existsSync(path.join(rollingBackRoot, "phase3.activation"))).toBe(false);
    expect(existsSync(path.join(rollingBackRoot, "phase3.transaction-baseline.manifest"))).toBe(false);
    expect(existsSync(path.join(rollingBackRoot, "locks/catering-agents-platform.deploy-lock"))).toBe(false);
    expect(existsSync(path.join(rollingBackRoot, "locks/shared-edge.deploy-lock"))).toBe(false);

    const failed = runHarness("semantic-smoke-fail");
    expect(failed.result.status).not.toBe(0);
    expect(existsSync(path.join(failed.fakeHostRoot, "phase3.rollback-restore-proof.archive"))).toBe(false);
    expect(existsSync(path.join(failed.fakeHostRoot, "phase3.rollback-completion.receipt"))).toBe(false);
    expect(existsSync(path.join(failed.fakeHostRoot, "platform-compose.phase3.yml"))).toBe(false);
    expect(existsSync(path.join(failed.fakeHostRoot, "edge-compose.phase3.yml"))).toBe(false);
    expect(existsSync(path.join(failed.fakeHostRoot, "phase3.activation"))).toBe(false);
    expect(existsSync(path.join(failed.fakeHostRoot, "phase3.transaction-baseline.manifest"))).toBe(false);
    expect(sourceAt(path.join(failed.fakeHostRoot, "fake-docker.log"))).not.toMatch(/network (?:create|connect|disconnect)/);
    const rollbackState = JSON.parse(sourceAt(path.join(failed.fakeHostRoot, "fake-docker-state.json"))) as {
      networks: Record<string, unknown>;
    };
    expect(rollbackState.networks.catering_ingress).toBeUndefined();
    expect(rollbackState.networks.catering_private).toBeUndefined();
  // This multi-process journey is ~74s isolated but reached ~312s under the
  // full Vitest file-parallel load; keep the bound local without weakening any assertion.
  }, 360_000);

  test("resumes complete active evidence and explicitly restores the Phase-2 baseline", () => {
    const partialRoot = mkdtempSync(path.join(tmpdir(), "catering-phase3-partial-rollback-"));
    // A candidate crash leaves the partially switched source/network proof in
    // place; explicit rollback must consume that durable marker and restore
    // the Phase-2 baseline before cleanup.
    const partialCrash = runHarness("crash-after-candidate", partialRoot);
    expect(partialCrash.result.status).not.toBe(0);
    const partialRollback = runHarness("rollback", partialRoot);
    expect(partialRollback.result.status).toBe(0);
    expect(`${partialRollback.result.stdout}${partialRollback.result.stderr}`).toContain("PILOT: ROLLED BACK");
    expect(existsSync(path.join(partialRoot, "phase3.rollback-restore-proof.archive"))).toBe(true);

    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-complete-resume-"));
    const initial = runHarness("full-pilot", root);
    expect(initial.result.status).toBe(0);
    expect(sourceAt(path.join(root, "phase3.activation"))).toMatch(/^state=active$/m);

    const resumed = runHarness("resume-active", root);
    expect(resumed.result.status).toBe(0);
    expect(sourceAt(path.join(root, "phase3.activation"))).toMatch(/^state=active$/m);

    const rolledBack = runHarness("rollback-active", root);
    expect(rolledBack.result.status).toBe(0);
    expect(`${rolledBack.result.stdout}${rolledBack.result.stderr}`).toContain("PILOT: ROLLED BACK");
    expect(existsSync(path.join(root, "phase3.rollback-restore-proof.archive"))).toBe(true);
    const rollbackState = JSON.parse(sourceAt(path.join(root, "fake-docker-state.json"))) as {
      networks: Record<string, { containers: Record<string, unknown> }>;
    };
    expect(rollbackState.networks.catering_ingress).toBeUndefined();
    expect(rollbackState.networks.catering_private).toBeUndefined();
    expect(Object.keys(rollbackState.networks).sort()).toEqual([
      "commcats-eventos_default",
      "deploy_default",
      "platform-infra_default",
      "zeiterfassung_default",
    ]);
  }, 240_000);

  test("preserves the complete active marker across repeated resume and never emits GO after rollback", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-marker-resume-"));
    const initial = runHarness("full-pilot", root);
    expect(initial.result.status).toBe(0);
    const markerPath = path.join(root, "phase3.activation");
    const firstMarker = markerFields(markerPath);
    for (const field of [
      "catering_ingress_id",
      "catering_private_id",
      "baseline_network_status",
      "expected_platform_source_sha256",
      "expected_edge_source_sha256",
      "source_readback_sha256",
      "smoke_readback_sha256",
      "adoption_count",
      "adoption_proof",
    ]) {
      expect(firstMarker.has(field)).toBe(true);
    }

    const firstResume = runHarness("resume-active", root);
    expect(firstResume.result.status).toBe(0);
    const secondMarker = markerFields(markerPath);
    expect([...secondMarker.keys()].sort()).toEqual([...firstMarker.keys()].sort());
    expect(secondMarker.get("catering_ingress_id")).toBe(firstMarker.get("catering_ingress_id"));
    expect(secondMarker.get("catering_private_id")).toBe(firstMarker.get("catering_private_id"));

    const secondResume = runHarness("resume-active", root);
    expect(secondResume.result.status).toBe(0);
    const thirdMarker = markerFields(markerPath);
    expect([...thirdMarker.keys()].sort()).toEqual([...secondMarker.keys()].sort());
    expect(thirdMarker.get("catering_ingress_id")).toBe(secondMarker.get("catering_ingress_id"));
    expect(thirdMarker.get("catering_private_id")).toBe(secondMarker.get("catering_private_id"));

    const rolledBack = runHarness("rollback-active", root);
    expect(rolledBack.result.status).toBe(0);
    const rollbackOutput = `${rolledBack.result.stdout}${rolledBack.result.stderr}`;
    expect(rollbackOutput).toContain("PILOT: ROLLED BACK");
    expect(rollbackOutput).not.toContain("PILOT: GO");
  }, 120_000);

  test("fails closed on a foreign same-name network instead of overwriting it", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-network-conflict-"));
    initializeFakeState(root);
    const statePath = path.join(root, "fake-docker-state.json");
    const state = JSON.parse(sourceAt(statePath)) as {
      networks: Record<string, Record<string, unknown>>;
    };
    const foreignNetworkId = "f".repeat(64);
    state.networks.catering_ingress = {
      driver: "bridge",
      enable_ipv6: false,
      id: foreignNetworkId,
      internal: false,
      ipam_config: [],
      ipam_driver: "default",
      labels: {
        "com.catering.kind": "compatibility",
        "com.catering.owner": "foreign",
        "com.catering.phase": "baseline",
        "com.catering.transaction": "absent",
      },
      options: {},
      scope: "local",
      containers: {},
    };
    writeFileSync(statePath, JSON.stringify(state));

    const createResult = spawnSync(
      "python3",
      [
        fakeDockerPath,
        "network",
        "create",
        "--driver",
        "bridge",
        "--label",
        "com.catering.owner=catering-agents-platform",
        "--label",
        "com.catering.phase=phase3.1",
        "--label",
        "com.catering.kind=ingress",
        "--label",
        "com.catering.transaction=phase3-harness",
        "catering_ingress",
      ],
      {
        cwd: repoRoot,
        encoding: "utf8",
        env: { ...process.env, CATERING_PHASE3_FAKE_HOST_ROOT: root },
      }
    );
    expect(createResult.status).not.toBe(0);
    const afterCreate = JSON.parse(sourceAt(statePath)) as { networks: Record<string, { id?: string; labels?: Record<string, string> }> };
    expect(afterCreate.networks.catering_ingress?.id).toBe(foreignNetworkId);
    expect(afterCreate.networks.catering_ingress?.labels?.["com.catering.owner"]).toBe("foreign");

    const result = runHarness("full-pilot", root);
    expect(result.result.status).not.toBe(0);
    const after = JSON.parse(sourceAt(statePath)) as { networks: Record<string, { id?: string; labels?: Record<string, string> }> };
    expect(after.networks.catering_ingress?.id).toBe(foreignNetworkId);
    expect(after.networks.catering_ingress?.labels?.["com.catering.owner"]).toBe("foreign");
    expect(`${result.result.stdout}${result.result.stderr}`).not.toContain("PILOT: GO\n");
  });

  test("binds post-create adoption to exact network identity and marker readback", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-adoption-"));
    const result = runHarness("full-pilot", root);
    expect(result.result.status).toBe(0);
    const state = JSON.parse(sourceAt(path.join(root, "fake-docker-state.json"))) as {
      networks: Record<string, { id: string; labels: Record<string, string>; containers: Record<string, unknown> }>;
    };
    for (const [network, kind] of [["catering_ingress", "ingress"], ["catering_private", "private"]] as const) {
      expect(state.networks[network].id).toMatch(/^[0-9a-f]{64}$/);
      expect(state.networks[network].labels).toEqual({
        "com.catering.owner": "catering-agents-platform",
        "com.catering.phase": "phase3.1",
        "com.catering.kind": kind,
        "com.catering.transaction": "phase3-harness",
      });
    }
    const marker = markerFields(path.join(root, "phase3.activation"));
    expect(marker.get("catering_ingress_id")).toBe(state.networks.catering_ingress.id);
    expect(marker.get("catering_private_id")).toBe(state.networks.catering_private.id);
    expect(marker.get("stage")).toBe("S4");
    expect(marker.get("marker_sha256")).toBe(canonicalMarkerHash(path.join(root, "phase3.activation")));

    const crashRoot = mkdtempSync(path.join(tmpdir(), "catering-phase3-post-create-crash-"));
    const crashed = runHarness("crash-after-ingress", crashRoot);
    expect(crashed.result.status).not.toBe(0);
    const crashState = JSON.parse(sourceAt(path.join(crashRoot, "fake-docker-state.json"))) as {
      networks: Record<string, { labels: Record<string, string>; containers: Record<string, unknown> }>;
    };
    expect(crashState.networks.catering_ingress).toBeDefined();
    expect(crashState.networks.catering_private).toBeUndefined();
    expect(existsSync(path.join(crashRoot, "phase3.network-adoption.journal"))).toBe(true);
    expect(markerFields(path.join(crashRoot, "phase3.activation")).get("state")).toBe("candidate");
  }, 120_000);

  test("binds archive and completion receipt to the complete restore evidence record", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-restore-evidence-"));
    const crashed = runHarness("crash-after-receipt", root);
    expect(crashed.result.status).not.toBe(0);
    const archivePath = path.join(root, "phase3.rollback-restore-proof.archive");
    const receiptPath = path.join(root, "phase3.rollback-completion.receipt");
    const evidencePath = path.join(root, "phase3.restore-evidence.record");
    expect(existsSync(archivePath)).toBe(true);
    expect(existsSync(receiptPath)).toBe(true);
    expect(existsSync(evidencePath)).toBe(true);
    const archive = markerFields(archivePath);
    const receipt = markerFields(receiptPath);
    const evidence = markerFields(evidencePath);
    for (const field of [
      "baseline_manifest_sha256",
      "foreign_invariants_sha256",
      "shared_edge_restore_sha256",
      "platform_source_readback",
      "edge_source_readback",
      "platform_network_baseline_id",
      "zeiterfassung_network_baseline_id",
      "catering_ingress_target",
      "catering_private_target",
      "smoke_readback_sha256",
    ]) {
      expect(evidence.has(field)).toBe(true);
    }
    const evidenceHash = sha256(evidencePath);
    expect(archive.get("restore_evidence_sha256")).toBe(evidenceHash);
    expect(receipt.get("restore_evidence_sha256")).toBe(evidenceHash);
    const archiveDigest = canonicalArchiveHash(archivePath);
    expect(archive.get("archive_sha256")).toBe(archiveDigest);
    expect(receipt.get("restore_proof_archive_sha256")).toBe(archiveDigest);
    expect(receipt.get("archive_sha256")).toBe(archiveDigest);
    expect(archiveDigest).not.toBe(sha256(archivePath));

    const resumed = runHarness("resume-rolling-back", root);
    expect(resumed.result.status).toBe(0);
    const output = `${resumed.result.stdout}${resumed.result.stderr}`;
    expect(output).toContain("PILOT: ROLLED BACK");
    expect(output).not.toContain("PILOT: GO");
    expect(existsSync(evidencePath)).toBe(true);
  }, 120_000);

  test("keeps the fake backend as a command adapter, not a second pilot state machine", () => {
    const backend = sourceAt(fakeBackendPath);
    expect(backend).not.toMatch(/phase3\.(?:activation|transaction-baseline|rollback-restore|rollback-completion)/);
    expect(backend).not.toMatch(/\b(?:write_marker|run_pilot|resume|rollback)\s*\(/);
    expect(backend).toContain("exec");
    expect(backend).toContain("fake-docker");
    expect(backend).toContain("fake-ssh");
  });

  test("requires a fail-closed CI JSON render/parity gate and mandatory semantic egress", () => {
    const workflow = uncommented(sourceAt(workflowPath));
    expect(workflow).toMatch(/docker compose[^\n]*config[^\n]*--format[= ]json|config[^\n]*--format[= ]json/);
    expect(workflow).toMatch(/command -v docker[\s\S]{0,160}(?:exit 1|fail)/);
    expect(workflow).toContain("CATERING_PHASE3_EGRESS_EXERCISE: \"1\"");
    expect(workflow).toMatch(/CATERING_PHASE3_EGRESS_URL/);
    const helper = requireHelper();
    expect(helper).toMatch(/egress_exercise[^\n]{0,120}== 1/);
    expect(helper).toContain("egress_body");
    expect(helper).toContain("egress=\"exercised\"");
    expect(helper).toMatch(/grep -Eiq[^\n]+egress_body/);
  });

  test("probes enabled egress from the active production service and records disabled egress", () => {
    const productionCompose = serviceBlock(sourceAt(platformBaseComposePath), "production");
    expect(productionCompose).toMatch(/CATERING_ENABLE_WEB_RECIPE_SEARCH:\s*\$\{CATERING_ENABLE_WEB_RECIPE_SEARCH:-0\}/);

    const enabledRoot = mkdtempSync(path.join(tmpdir(), "catering-phase3-egress-enabled-"));
    const enabled = runHarness("full-pilot", enabledRoot);
    expect(enabled.result.status).toBe(0);
    const enabledState = JSON.parse(sourceAt(path.join(enabledRoot, "fake-docker-state.json"))) as {
      containers: Record<string, { config?: { env?: Record<string, string> }; labels?: Record<string, string> }>;
    };
    expect(enabledState.containers["platform-infra-production-1"]?.config?.env).toEqual({ CATERING_ENABLE_WEB_RECIPE_SEARCH: "1" });
    expect(enabledState.containers["platform-infra-production-1"]?.labels).toMatchObject({
      "com.docker.compose.project": "platform-infra",
      "com.docker.compose.service": "production",
    });
    expect(sourceAt(path.join(enabledRoot, "phase3.activation"))).toMatch(/^egress=exercised$/m);
    const enabledExec = sourceAt(path.join(enabledRoot, "fake-docker.log"))
      .split("\n")
      .filter((line) => line.startsWith("docker exec "));
    expect(enabledExec.some((line) => line.includes("exec platform-infra-production-1") && line.includes("CATERING_ENABLE_WEB_RECIPE_SEARCH"))).toBe(true);
    expect(enabledExec.some((line) => line.includes("exec platform-infra-production-1") && line.includes("egress.invalid"))).toBe(true);
    expect(enabledExec.some((line) => line.includes("exec shared-edge-edge-1") && line.includes("egress.invalid"))).toBe(false);

    const disabledRoot = mkdtempSync(path.join(tmpdir(), "catering-phase3-egress-disabled-"));
    const disabled = runHarness("egress-disabled", disabledRoot);
    expect(disabled.result.status).toBe(0);
    const disabledState = JSON.parse(sourceAt(path.join(disabledRoot, "fake-docker-state.json"))) as {
      containers: Record<string, { config?: { env?: Record<string, string> } }>;
    };
    expect(disabledState.containers["platform-infra-production-1"]?.config?.env).toEqual({ CATERING_ENABLE_WEB_RECIPE_SEARCH: "0" });
    expect(sourceAt(path.join(disabledRoot, "phase3.activation"))).toMatch(/^egress=not_exercised$/m);
    const disabledExec = sourceAt(path.join(disabledRoot, "fake-docker.log"))
      .split("\n")
      .filter((line) => line.startsWith("docker exec "));
    expect(disabledExec.some((line) => line.includes("exec platform-infra-production-1") && line.includes("egress.invalid"))).toBe(false);

    for (const scenario of ["egress-fail", "egress-missing", "egress-malformed", "egress-foreign"]) {
      const invalid = runHarness(scenario);
      expect(invalid.result.status, scenario).not.toBe(0);
      expect(`${invalid.result.stdout}${invalid.result.stderr}`, scenario).not.toContain("PILOT: GO\n");
    }
  }, 360_000);

  test("binds manifest, marker, archive, receipt, and network provenance by hashes without secret values", () => {
    const helper = requireHelper();
    for (const field of [
      "container_id", "RestartCount", "NetworkSettings", "Aliases", "PortBindings", "Mounts",
      "secret_ref", "manifest_sha256", "marker_sha256", "archive_sha256", "receipt_sha256",
      "network_driver", "network_scope", "network_internal", "network_ipam", "network_labels",
      "network_members", "network_aliases", "validate_network_provenance",
    ]) expect(helper).toContain(field);
    expect(helper).not.toMatch(/secret[^\n]*(?:value|password|token)=/i);
  });

  test("fails closed when the production platform caller is asked to bypass edge cutover", () => {
    const deploy = sourceAt(callerPaths[0]);
    expect(deploy).toContain("EDGE_EXTERNAL=false is not allowed");
    const result = runWithBash32(callerPaths[0], {
      DEPLOY_HOST: "phase3.invalid",
      DEPLOY_COMMIT_SHA: "5b0eaed96dc0f57d091c5ea3b4741e121d0b9d47",
      EDGE_EXTERNAL: "false",
      PHASE3_LOCK_OWNER: "phase3-test-owner",
    });
    expect(`${result.stdout}${result.stderr}`).toContain("EDGE_EXTERNAL=false is not allowed");
  });

  test("uses a single reentrant lock abstraction without a second shared-edge mkdir", () => {
    const deploy = requireHelper();
    const edgeDeploy = uncommented(sourceAt(callerPaths[2]));
    expect(deploy).toContain("acquire_lock");
    expect(edgeDeploy).toContain("EDGE_LOCK_REENTRANT");
    expect(edgeDeploy).toContain("phase3_lock_acquire");
    expect(edgeDeploy).not.toMatch(/acquire_edge_lock[\s\S]{0,500}sudo mkdir "\$\{EDGE_LOCK_PATH\}"/);
  });

  test("rehydrates resume state only after ordered locks and exact manifest parsing", () => {
    const helper = requireHelper();
    expect(helper).toContain("validate_kv_file");
    expect(helper).toContain("phase3_lock_acquire");
    expect(helper.indexOf("phase3_lock_acquire")).toBeLessThan(helper.indexOf("rehydrate_manifest"));
    expect(helper).toContain("unknown ${kind} field");
    expect(helper).toContain("duplicate ${kind} field");
  });

  test("binds a canonical marker hash and performs a complete rollback receipt sequence", () => {
    const helper = requireHelper();
    expect(helper).toContain("canonical_marker_sha256");
    expect(helper).not.toContain("marker_sha256=readback-pending");
    expect(helper).toMatch(/archive[\s\S]{0,500}receipt[\s\S]{0,500}prior_marker[\s\S]{0,500}(?:manifest|receipt)/i);
    const { fakeHostRoot, result } = runHarness("full-pilot");
    expect(result.status).toBe(0);
    const marker = readFileSync(path.join(fakeHostRoot, "phase3.activation"), "utf8");
    expect(marker).toMatch(/^marker_sha256=[0-9a-f]{64}$/m);
  }, 120_000);

  test("uses the authoritative service ports and never probes Iranmonitor through Edge-internal DNS", () => {
    const helper = requireHelper();
    expect(helper).toContain("intake:3101");
    expect(helper).toContain("commcats-eventos-app:3045");
    expect(helper).not.toContain("deploy-web-1}:8080");
    for (const servicePort of ["postgres:5432", "intake:3101", "offer:3102", "production:3103", "exports:3104"]) {
      expect(helper).toContain(servicePort);
    }
    expect(helper).toContain("negative-edge-probe");
  });

  test("freezes normal callers on the exact marker/manifest/archive/receipt contract", () => {
    for (const callerPath of callerPaths.slice(0, 4)) {
      const caller = uncommented(sourceAt(callerPath));
      expect(caller).toContain("validate_phase3_artifacts");
      expect(caller).not.toMatch(/\[\[ ! -e "\$\{manifest\}" \]\] \|\| exit 1/);
    }
  });

  test("passes remote paths only as positional arguments to bash -s and validates their allowlist", () => {
    for (const callerPath of callerPaths.slice(0, 4)) {
      const caller = uncommented(sourceAt(callerPath));
      expect(caller).toContain("validate_remote_path");
      expect(caller).not.toMatch(/ssh "\$\{REMOTE\}" "[\s\S]*\$\{(?:DEPLOY|EDGE_DEPLOY)_PATH/);
    }
  });

  test("keeps the Phase-3 Compose overrides membership-only and gates complete JSON parity", () => {
    const edgeCompose = uncommented(sourceAt(edgeComposePath));
    for (const forbidden of ["image:", "restart:", "ports:", "environment:", "volumes:"]) {
      expect(edgeCompose).not.toContain(forbidden);
    }
    const workflow = uncommented(sourceAt(workflowPath));
    for (const parity of ["restart", "environment", "volumes", "ports", "CATERING_INTAKE_SERVICE_URL", "3045"]) {
      expect(workflow).toContain(parity);
    }
    expect(workflow).toContain("2.24.4");
    expect(workflow).not.toMatch(/awk[^\n]*\$2\s*>=\s*24/);
  });

  test("does not put AUTH_B64 in an SSH argument and cleans protected probe files per path", () => {
    const deploy = uncommented(sourceAt(callerPaths[1]));
    expect(deploy).not.toContain("AUTH_B64");
    expect(deploy).toContain("remote_auth_file");
    expect(deploy).toContain("scp");
    const workflow = uncommented(sourceAt(workflowPath));
    expect(workflow).toMatch(/unlink "\$render_env"[\s\S]*unlink platform-phase3\.render\.json[\s\S]*unlink edge-phase3\.render\.json/);
  });

  test("installs cutover signal rollback traps before releasing ports and cleans remote overrides", () => {
    const cutover = uncommented(sourceAt(callerPaths[3]));
    expect(cutover).toContain("trap 'rollback_cutover 143' TERM");
    expect(cutover).toContain("trap 'rollback_cutover 130' INT");
    expect(cutover).toContain("trap 'rollback_cutover 129' HUP");
    expect(cutover).toContain("cleanup_remote_override");
    expect(cutover.indexOf("cleanup_remote_override")).toBeLessThan(cutover.indexOf("scp \"${REPO_ROOT}/platform-infra/docker-compose.edge-cutover.yml\""));
  });
});
