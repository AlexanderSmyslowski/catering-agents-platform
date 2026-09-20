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
import {
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
} from "./phase3-latest-p1-review-helpers.js";
import type { PartialRollbackState } from "./phase3-latest-p1-review-helpers.js";

describe("latest independent Phase-3 P1 review reproducers", () => {
  test("RED: phase3.2 candidate before network creation explicitly rolls back absent targets", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-candidate-pre-network-rollback-red-"));
    const crashed = runHarness("crash-after-candidate", root, {
      CATERING_PHASE3_FAKE_PRE_NETWORK_CRASH: "1",
    });
    const markerPath = path.join(root, "phase3.activation");
    const manifestPath = path.join(root, "phase3.transaction-baseline.manifest");
    const journalPath = path.join(root, "phase3.network-adoption.journal");
    const logPath = path.join(root, "fake-docker.log");
    expect(crashed.result.status).not.toBe(0);
    expect(fieldsAt(markerPath).get("state")).toBe("candidate");
    expect(fieldsAt(markerPath).get("catering_ingress_id")).toBe("absent");
    expect(fieldsAt(markerPath).get("catering_private_id")).toBe("absent");
    expect(fieldsAt(journalPath).get("catering_ingress_id")).toBe("absent");
    expect(fieldsAt(journalPath).get("catering_private_id")).toBe("absent");
    expect(JSON.parse(textAt(path.join(root, "fake-docker-state.json"))).networks.catering_ingress).toBeUndefined();
    expect(JSON.parse(textAt(path.join(root, "fake-docker-state.json"))).networks.catering_private).toBeUndefined();
    expect(textAt(logPath)).not.toMatch(/network create catering_(?:private|ingress)/);
    expect(existsSync(manifestPath)).toBe(true);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(true);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(true);

    const beforeRollbackLog = textAt(logPath);
    const rolledBack = runExistingRollback(root, crashed.sandbox);
    const terminal = `${rolledBack.result.stdout}${rolledBack.result.stderr}`;
    const addedLog = textAt(logPath).slice(beforeRollbackLog.length);
    expect(rolledBack.result.status).toBe(0);
    expect(terminal).toContain("PILOT: ROLLED BACK");
    expect(terminal).not.toContain("PILOT: GO\n");
    expect(addedLog).not.toMatch(/network create catering_(?:private|ingress)/);
    expect(addedLog).not.toMatch(/network rm catering_(?:private|ingress)/);
    expect(addedLog).not.toMatch(/network disconnect catering_(?:private|ingress)/);
    expect(existsSync(markerPath)).toBe(false);
    expect(existsSync(manifestPath)).toBe(false);
    expect(existsSync(path.join(root, "phase3.restore-evidence.record"))).toBe(true);
    expect(existsSync(path.join(root, "phase3.rollback-restore-proof.archive"))).toBe(true);
    expect(existsSync(path.join(root, "phase3.rollback-completion.receipt"))).toBe(false);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(false);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(false);
  }, 120_000);

  test("RED: phase3.2 rolling_back crash before proof resumes the same rollback idempotently", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-rolling-back-pre-proof-red-"));
    const crashed = runHarness("crash-after-candidate", root, {
      CATERING_PHASE3_FAKE_PRE_NETWORK_CRASH: "1",
    });
    expect(crashed.result.status).not.toBe(0);
    const markerPath = path.join(root, "phase3.activation");
    const statePath = path.join(root, "fake-docker-state.json");
    const logPath = path.join(root, "fake-docker.log");
    const state = JSON.parse(textAt(statePath)) as { fault: string; fault_triggered: boolean };
    state.fault = "crash-after-rollback";
    state.fault_triggered = false;
    writeFileSync(statePath, JSON.stringify(state));

    const rollback = runExistingRollback(root, crashed.sandbox);
    expect(rollback.result.status).not.toBe(0);
    expect(fieldsAt(markerPath).get("state")).toBe("rolling_back");
    expect(existsSync(path.join(root, "phase3.restore-evidence.record"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.rollback-restore-proof.archive"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.rollback-completion.receipt"))).toBe(false);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(true);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(true);

    const beforeResumeLog = textAt(logPath);
    const resumed = runExistingResume(root, crashed.sandbox);
    const terminal = `${resumed.result.stdout}${resumed.result.stderr}`;
    const addedLog = textAt(logPath).slice(beforeResumeLog.length);
    expect(resumed.result.status).toBe(0);
    expect(terminal).toContain("PILOT: ROLLED BACK");
    expect(terminal).not.toContain("PILOT: GO\n");
    expect(addedLog).not.toMatch(/network create catering_(?:private|ingress)/);
    expect(addedLog).not.toMatch(/network (?:disconnect|rm) catering_(?:private|ingress)/);
    expect(existsSync(markerPath)).toBe(false);
    expect(existsSync(path.join(root, "phase3.transaction-baseline.manifest"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.restore-evidence.record"))).toBe(true);
    expect(existsSync(path.join(root, "phase3.rollback-restore-proof.archive"))).toBe(true);
    expect(existsSync(path.join(root, "phase3.rollback-completion.receipt"))).toBe(false);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(false);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(false);
  }, 120_000);

  test("RED: resume after a partial run-created network disconnect completes the same rollback", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-partial-disconnect-red-"));
    const crashed = runHarness("crash-after-active", root);
    expect(crashed.result.status).not.toBe(0);
    const markerPath = path.join(root, "phase3.activation");
    const statePath = path.join(root, "fake-docker-state.json");
    const logPath = path.join(root, "fake-docker.log");
    const beforeState = JSON.parse(textAt(statePath)) as {
      networks: Record<string, { id: string; containers: Record<string, { Name: string }> }>;
    };
    const privateBefore = Object.values(beforeState.networks.catering_private.containers)
      .map((member) => member.Name.replace(/^\//, ""))
      .sort();
    const ingressBefore = Object.values(beforeState.networks.catering_ingress.containers)
      .map((member) => member.Name.replace(/^\//, ""))
      .sort();
    expect(privateBefore).toEqual([
      "platform-infra-exports-1",
      "platform-infra-intake-1",
      "platform-infra-offer-1",
      "platform-infra-postgres-1",
      "platform-infra-production-1",
      "platform-infra-web-1",
    ]);
    expect(ingressBefore).toEqual(["platform-infra-web-1", "shared-edge-edge-1"]);

    const disconnectCrash = installCrashAfterFirstNetworkDisconnect(root);
    const rollback = runExistingRollback(root, crashed.sandbox, disconnectCrash.shimBin);
    expect(rollback.result.status).not.toBe(0);
    expect(fieldsAt(markerPath).get("state")).toBe("rolling_back");
    const afterCrash = JSON.parse(textAt(statePath)) as {
      networks: Record<string, { containers: Record<string, { Name: string }> }>;
    };
    const privateAfter = Object.values(afterCrash.networks.catering_private.containers)
      .map((member) => member.Name.replace(/^\//, ""))
      .sort();
    const ingressAfter = Object.values(afterCrash.networks.catering_ingress.containers)
      .map((member) => member.Name.replace(/^\//, ""))
      .sort();
    expect(privateAfter).toEqual([
      "platform-infra-exports-1",
      "platform-infra-intake-1",
      "platform-infra-offer-1",
      "platform-infra-production-1",
      "platform-infra-web-1",
    ]);
    expect(ingressAfter).toEqual(ingressBefore);
    expect(existsSync(path.join(root, "phase3.restore-evidence.record"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.rollback-restore-proof.archive"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.rollback-completion.receipt"))).toBe(false);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(true);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(true);

    const beforeResumeLog = textAt(logPath);
    const resumed = runExistingResume(root, crashed.sandbox);
    const terminal = `${resumed.result.stdout}${resumed.result.stderr}`;
    const resumeLog = textAt(logPath).slice(beforeResumeLog.length);
    expect(resumed.result.status).toBe(0);
    expect(terminal).toContain("PILOT: ROLLED BACK");
    expect(terminal).not.toContain("PILOT: GO\n");
    expect(resumeLog).toMatch(/network disconnect catering_private/);
    expect(resumeLog).toMatch(/network disconnect catering_ingress/);
    expect(resumeLog).toMatch(/network rm catering_private/);
    expect(resumeLog).toMatch(/network rm catering_ingress/);
    expect(existsSync(path.join(root, "phase3.activation"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.transaction-baseline.manifest"))).toBe(false);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(false);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(false);
  }, 120_000);

  test("RED: preserves the private snapshot through ingress rollback", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-private-snapshot-red-"));
    const crashed = runHarness("crash-after-active", root);
    expect(crashed.result.status).not.toBe(0);
    const markerPath = path.join(root, "phase3.activation");
    const journalPath = path.join(root, "phase3.network-adoption.journal");
    const statePath = path.join(root, "fake-docker-state.json");
    const logPath = path.join(root, "fake-docker.log");
    const privateSnapshot = fieldsAt(journalPath).get("catering_private_members_b64");
    expect(privateSnapshot).toMatch(/^[A-Za-z0-9+/=]+$/);
    const beforeRollbackLog = textAt(logPath);
    const disconnectCrash = installCrashAfterIngressDisconnect(root);

    const rollback = runExistingRollback(root, crashed.sandbox, disconnectCrash.shimBin);
    expect(rollback.result.status).not.toBe(0);
    expect(existsSync(disconnectCrash.flagPath)).toBe(true);
    expect(fieldsAt(markerPath).get("state")).toBe("rolling_back");
    const rollbackLog = textAt(logPath).slice(beforeRollbackLog.length);
    const rollbackLines = rollbackLog.split("\n").filter(Boolean);
    const privateDisconnects = rollbackLines.filter((line) => line.startsWith("docker network disconnect catering_private "));
    const ingressDisconnectIndex = rollbackLines.findIndex((line) => line === "docker network disconnect catering_ingress platform-infra-web-1");
    expect(privateDisconnects).toHaveLength(6);
    expect(ingressDisconnectIndex).toBeGreaterThan(rollbackLines.lastIndexOf(privateDisconnects.at(-1)!));
    expect(ingressDisconnectIndex).toBeGreaterThanOrEqual(0);
    const afterCrashJournal = fieldsAt(journalPath);
    expect(afterCrashJournal.get("membership_wal_phase")).toBe("pending");
    expect(afterCrashJournal.get("membership_wal_network")).toBe("catering_ingress");
    expect(afterCrashJournal.get("catering_private_members_b64")).toBe(privateSnapshot);
    const afterCrashState = JSON.parse(textAt(statePath)) as {
      networks: Record<string, { containers: Record<string, unknown> }>;
    };
    expect(afterCrashState.networks.catering_private.containers).toEqual({});
    expect(Object.keys(afterCrashState.networks.catering_ingress.containers)).toHaveLength(1);

    const resumed = runExistingResume(root, crashed.sandbox);
    const terminal = `${resumed.result.stdout}${resumed.result.stderr}`;
    expect(resumed.result.status).toBe(0);
    expect(terminal).toContain("PILOT: ROLLED BACK");
    expect(existsSync(markerPath)).toBe(false);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(false);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(false);
  }, 120_000);

  test.each([
    ["out-of-order subset", (state: PartialRollbackState, before: PartialRollbackState) => {
      const current = state.networks.catering_private.containers;
      const original = before.networks.catering_private.containers;
      const postgresEntry = Object.entries(original).find(([, member]) => member.Name === "/platform-infra-postgres-1");
      const intakeId = Object.keys(current).find((id) => current[id].Name === "/platform-infra-intake-1");
      expect(postgresEntry).toBeDefined();
      expect(intakeId).toBeDefined();
      current[postgresEntry![0]] = postgresEntry![1];
      delete current[intakeId!];
    }],
    ["foreign member", (state: PartialRollbackState, _before?: PartialRollbackState) => {
      state.networks.catering_private.containers["foreign-container-id"] = { Name: "/foreign", Aliases: ["foreign"] };
    }],
    ["alias drift", (state: PartialRollbackState, _before?: PartialRollbackState) => {
      const web = Object.values(state.networks.catering_private.containers).find((member) => member.Name === "/platform-infra-web-1");
      expect(web).toBeDefined();
      web!.Aliases = ["foreign"];
    }],
  ])("partial run-created rollback rejects %s", (_name, mutate) => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-partial-disconnect-negative-"));
    const crashed = runHarness("crash-after-active", root);
    expect(crashed.result.status).not.toBe(0);
    const statePath = path.join(root, "fake-docker-state.json");
    const beforeState = JSON.parse(textAt(statePath)) as PartialRollbackState;
    const disconnectCrash = installCrashAfterFirstNetworkDisconnect(root);
    const rollback = runExistingRollback(root, crashed.sandbox, disconnectCrash.shimBin);
    expect(rollback.result.status).not.toBe(0);
    const state = JSON.parse(textAt(statePath)) as PartialRollbackState;
    mutate(state, beforeState);
    writeFileSync(statePath, JSON.stringify(state));
    const logPath = path.join(root, "fake-docker.log");
    const beforeResumeLog = textAt(logPath);
    const resumed = runExistingResume(root, crashed.sandbox);
    const terminal = `${resumed.result.stdout}${resumed.result.stderr}`;
    const resumeLog = textAt(logPath).slice(beforeResumeLog.length);
    expect(resumed.result.status).not.toBe(0);
    expect(terminal).toContain("PILOT: NO-GO");
    expect(terminal).not.toContain("PILOT: ROLLED BACK");
    expect(resumeLog).not.toMatch(/network (?:disconnect|rm) catering_(?:private|ingress)/);
    expect(fieldsAt(path.join(root, "phase3.activation")).get("state")).toBe("rolling_back");
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(true);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(true);
  }, 120_000);

  test.each(["marker", "journal"])("phase3.2 initial rollback rejects an absent target claimed by the %s", (claimSource) => {
    const root = mkdtempSync(path.join(tmpdir(), `catering-phase3-absent-target-${claimSource}-red-`));
    const crashed = runHarness("crash-after-candidate", root, {
      CATERING_PHASE3_FAKE_PRE_NETWORK_CRASH: "1",
    });
    expect(crashed.result.status).not.toBe(0);
    const markerPath = path.join(root, "phase3.activation");
    const journalPath = path.join(root, "phase3.network-adoption.journal");
    const logPath = path.join(root, "fake-docker.log");
    const claimedId = "a".repeat(64);
    if (claimSource === "marker") {
      rewriteFields(markerPath, { catering_private_id: claimedId, marker_sha256: "absent" });
      rewriteFields(markerPath, { marker_sha256: canonicalSelfHash(markerPath, "marker_sha256") });
    } else {
      rewriteFields(journalPath, {
        adoption_order: "catering_ingress",
        adoption_count: "1",
        next_network: "catering_private",
        adoption_phase: "created",
        catering_ingress_id: claimedId,
        catering_ingress_members_b64: "e30=",
        catering_ingress_aliases_b64: "e30=",
        journal_sha256: "absent",
      });
      rewriteFields(journalPath, { journal_sha256: canonicalSelfHash(journalPath, "journal_sha256") });
    }
    const beforeRollbackLog = textAt(logPath);
    const beforeRollbackMarker = textAt(markerPath);
    const rolledBack = runExistingRollback(root, crashed.sandbox);
    const terminal = `${rolledBack.result.stdout}${rolledBack.result.stderr}`;
    const addedLog = textAt(logPath).slice(beforeRollbackLog.length);
    expect(rolledBack.result.status).not.toBe(0);
    expect(terminal).toContain("PILOT: NO-GO");
    expect(terminal).not.toContain("PILOT: ROLLED BACK");
    expect(addedLog).not.toMatch(/network create catering_(?:private|ingress)/);
    expect(addedLog).not.toMatch(/network (?:disconnect|rm) catering_(?:private|ingress)/);
    expect(fieldsAt(markerPath).get("state")).toBe("candidate");
    expect(textAt(markerPath)).toBe(beforeRollbackMarker);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(true);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(true);
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

    const beforeResumeLog = textAt(path.join(root, "fake-docker.log"));
    const resumed = runHarness("resume-after-ingress", root);
    expect(resumed.result.status).toBe(0);
    expect(`${resumed.result.stdout}${resumed.result.stderr}`).toContain("PILOT: GO");
    expect(fieldsAt(markerPath).get("state")).toBe("active");
    const addedLog = textAt(path.join(root, "fake-docker.log")).slice(beforeResumeLog.length);
    expect(addedLog).not.toMatch(/network create .*catering_ingress$/m);
    expect(addedLog.match(/^docker network create .* catering_private$/gm) ?? []).toHaveLength(1);
  }, 120_000);

  test("RED: durable ingress journal before marker update strands explicit rollback", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-ingress-rollback-red-"));
    const crashed = runHarness("crash-after-ingress", root);
    const markerPath = path.join(root, "phase3.activation");
    const manifestPath = path.join(root, "phase3.transaction-baseline.manifest");
    const journalPath = path.join(root, "phase3.network-adoption.journal");
    const statePath = path.join(root, "fake-docker-state.json");
    const logPath = path.join(root, "fake-docker.log");
    expect(crashed.result.status).not.toBe(0);

    const marker = fieldsAt(markerPath);
    const manifest = fieldsAt(manifestPath);
    const journal = fieldsAt(journalPath);
    expect(marker.get("state")).toBe("candidate");
    expect(marker.get("stage")).toBe("S2");
    expect(marker.get("catering_ingress_id")).toBe("absent");
    expect(marker.get("catering_private_id")).toBe("absent");
    expect(journal.get("owner")).toBe("catering-agents-platform");
    expect(journal.get("transaction_id")).toBe("phase3-harness");
    expect(journal.get("transaction_manifest_path")).toBe(manifestPath);
    expect(journal.get("transaction_manifest_sha256")).toBe(digestFile(manifestPath));
    expect(journal.get("adoption_order")).toBe("catering_ingress");
    expect(journal.get("adoption_count")).toBe("1");
    expect(journal.get("next_network")).toBe("catering_private");
    expect(journal.get("adoption_phase")).toBe("created");
    expect(journal.get("catering_ingress_id")).toMatch(/^[0-9a-f]{64}$/);
    expect(journal.get("catering_private_id")).toBe("absent");
    expect(journal.get("catering_ingress_owner")).toBe("catering-agents-platform");
    expect(journal.get("catering_ingress_phase")).toBe("phase3.1");
    expect(journal.get("catering_ingress_transaction")).toBe("phase3-harness");

    const state = JSON.parse(textAt(statePath)) as {
      networks: Record<string, { id: string }>;
    };
    expect(state.networks.catering_ingress?.id).toBe(journal.get("catering_ingress_id"));
    expect(state.networks.catering_private).toBeUndefined();
    const createLines = textAt(logPath).split("\n").filter((line) => line.includes("network create"));
    expect(createLines.filter((line) => line.endsWith(" catering_ingress")).length).toBe(1);
    expect(createLines.filter((line) => line.endsWith(" catering_private")).length).toBe(0);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(true);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(true);

    const beforeRollbackLog = textAt(logPath);
    const rolledBack = runExistingRollback(root, crashed.sandbox);
    const terminal = `${rolledBack.result.stdout}${rolledBack.result.stderr}`;
    const addedLog = textAt(logPath).slice(beforeRollbackLog.length);
    expect(rolledBack.result.status).toBe(0);
    expect(terminal).toContain("PILOT: ROLLED BACK");
    expect(terminal).not.toContain("PILOT: GO\n");
    expect(addedLog).not.toMatch(/network create/);
    expect(addedLog.match(/^docker network rm catering_ingress$/gm) ?? []).toHaveLength(1);
    expect(addedLog).not.toMatch(/network rm catering_private/);
    expect(fieldsAt(markerPath).get("state")).toBeUndefined();
    expect(JSON.parse(textAt(statePath)).networks.catering_ingress).toBeUndefined();
    expect(existsSync(path.join(root, "phase3.restore-evidence.record"))).toBe(true);
    expect(existsSync(path.join(root, "phase3.rollback-restore-proof.archive"))).toBe(true);
    expect(existsSync(path.join(root, "phase3.rollback-completion.receipt"))).toBe(false);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(false);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(false);
  }, 120_000);

  test("RED: all-pre-existing S2 adoption is rejected before any durable mutation", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-all-preexisting-precondition-red-"));
    prepareNormalAllPreExistingS2State(root);
    const statePath = path.join(root, "fake-docker-state.json");
    const logPath = path.join(root, "fake-docker.log");
    const beforeState = JSON.parse(textAt(statePath));
    const beforeLog = textAt(logPath);
    const run = runHarness("normal", root);
    const output = `${run.result.stdout}${run.result.stderr}`;
    const addedLog = textAt(logPath).slice(beforeLog.length);
    expect(run.result.status).not.toBe(0);
    expect(output).toContain("PILOT: NO-GO");
    const afterState = JSON.parse(textAt(statePath));
    afterState.fault = "";
    afterState.fault_triggered = false;
    expect(afterState).toEqual(beforeState);
    expect(addedLog).not.toMatch(/network (?:create|connect|disconnect|rm) catering_(?:private|ingress)/);
    expect(existsSync(path.join(root, "phase3.activation"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.transaction-baseline.manifest"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.network-adoption.journal"))).toBe(false);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(false);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(false);
  }, 120_000);

  test("RED: all-pre-existing S2 resume is rejected before IPAM inspection", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-all-preexisting-ipam-null-resume-red-"));
    prepareNormalAllPreExistingS2NullIpamState(root);
    const statePath = path.join(root, "fake-docker-state.json");
    const logPath = path.join(root, "fake-docker.log");
    const beforeState = JSON.parse(textAt(statePath));
    const beforeLog = textAt(logPath);
    const run = runHarness("normal", root);
    const output = `${run.result.stdout}${run.result.stderr}`;
    const addedLog = textAt(logPath).slice(beforeLog.length);
    expect(run.result.status).not.toBe(0);
    expect(output).toContain("PILOT: NO-GO");
    expect(JSON.parse(textAt(statePath))).toEqual(beforeState);
    expect(addedLog).not.toMatch(/network (?:create|connect|disconnect|rm) catering_(?:private|ingress)/);
    expect(existsSync(path.join(root, "phase3.activation"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.transaction-baseline.manifest"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.network-adoption.journal"))).toBe(false);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(false);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(false);
  }, 120_000);

  test("RED: all-pre-existing S2 rollback is rejected before IPAM inspection", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-all-preexisting-ipam-null-rollback-red-"));
    prepareNormalAllPreExistingS2NullIpamState(root);
    const statePath = path.join(root, "fake-docker-state.json");
    const logPath = path.join(root, "fake-docker.log");
    const beforeState = JSON.parse(textAt(statePath));
    const beforeLog = textAt(logPath);
    const run = runHarness("normal", root);
    const output = `${run.result.stdout}${run.result.stderr}`;
    const addedLog = textAt(logPath).slice(beforeLog.length);
    expect(run.result.status).not.toBe(0);
    expect(output).toContain("PILOT: NO-GO");
    expect(JSON.parse(textAt(statePath))).toEqual(beforeState);
    expect(addedLog).not.toMatch(/network (?:create|connect|disconnect|rm) catering_(?:private|ingress)/);
    expect(existsSync(path.join(root, "phase3.activation"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.transaction-baseline.manifest"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.network-adoption.journal"))).toBe(false);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(false);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(false);
  }, 120_000);

  test.each(["resume", "rollback"] as const)("RED: absent-only precondition rejects nonempty live IPAM before %s", (command) => {
    const root = mkdtempSync(path.join(tmpdir(), `catering-phase3-ipam-nonempty-${command}-negative-`));
    prepareNormalAllPreExistingS2NullIpamState(root);
    setFakeNetworkIpamConfig(root, [{ Subnet: "10.0.0.0/24" }]);
    const statePath = path.join(root, "fake-docker-state.json");
    const logPath = path.join(root, "fake-docker.log");
    const beforeState = JSON.parse(textAt(statePath));
    const beforeLog = textAt(logPath);
    const run = runHarness("normal", root);
    const output = `${run.result.stdout}${run.result.stderr}`;
    const addedLog = textAt(logPath).slice(beforeLog.length);
    expect(run.result.status).not.toBe(0);
    expect(output).toContain("PILOT: NO-GO");
    expect(addedLog).not.toMatch(/network (?:create|connect|disconnect|rm) catering_(?:private|ingress)/);
    expect(JSON.parse(textAt(statePath))).toEqual(beforeState);
    expect(existsSync(path.join(root, "phase3.activation"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.transaction-baseline.manifest"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.network-adoption.journal"))).toBe(false);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(false);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(false);
  }, 120_000);

  test("RED: absent-only precondition rejects an invalid live IPAM type", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-ipam-invalid-type-negative-"));
    prepareNormalAllPreExistingS2NullIpamState(root);
    setFakeNetworkIpamConfig(root, { Subnet: "10.0.0.0/24" });
    const statePath = path.join(root, "fake-docker-state.json");
    const logPath = path.join(root, "fake-docker.log");
    const beforeState = JSON.parse(textAt(statePath));
    const beforeLog = textAt(logPath);
    const run = runHarness("normal", root);
    const output = `${run.result.stdout}${run.result.stderr}`;
    const addedLog = textAt(logPath).slice(beforeLog.length);
    expect(run.result.status).not.toBe(0);
    expect(output).toContain("PILOT: NO-GO");
    expect(addedLog).not.toMatch(/network (?:create|connect|disconnect|rm) catering_(?:private|ingress)/);
    expect(JSON.parse(textAt(statePath))).toEqual(beforeState);
    expect(existsSync(path.join(root, "phase3.activation"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.transaction-baseline.manifest"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.network-adoption.journal"))).toBe(false);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(false);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(false);
  }, 120_000);

  test("RED: run-created active resume rejects an IPAM manifest drift", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-ipam-manifest-mismatch-negative-"));
    const crashed = runHarness("crash-after-active", root);
    expect(crashed.result.status).not.toBe(0);
    const statePath = path.join(root, "fake-docker-state.json");
    const manifestPath = path.join(root, "phase3.transaction-baseline.manifest");
    rewriteFields(manifestPath, {
      network_ipam_config: 'catering_ingress:[{"Subnet":"10.0.0.0/24"}];catering_private:[]',
    });
    rebindManifestReferences(root);
    const beforeState = JSON.parse(textAt(statePath));
    const beforeLog = textAt(path.join(root, "fake-docker.log"));
    const resumed = runExistingResume(root, crashed.sandbox);
    const output = `${resumed.result.stdout}${resumed.result.stderr}`;
    const addedLog = textAt(path.join(root, "fake-docker.log")).slice(beforeLog.length);
    expect(resumed.result.status).not.toBe(0);
    expect(output).toContain("PILOT: NO-GO");
    expect(addedLog).not.toMatch(/network (?:create|connect|disconnect|rm) catering_(?:private|ingress)/);
    expect(JSON.parse(textAt(statePath))).toEqual(beforeState);
    expect(fieldsAt(path.join(root, "phase3.activation")).get("state")).toBe("active");
    expect(existsSync(path.join(root, "phase3.transaction-baseline.manifest"))).toBe(true);
    expect(existsSync(path.join(root, "phase3.network-adoption.journal"))).toBe(true);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(true);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(true);
  }, 120_000);

  test("RED: mixed pre-existing adoption is rejected before durable mutation", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-mixed-adoption-precondition-red-"));
    prepareNormalMixedS2State(root, "catering_ingress");
    const statePath = path.join(root, "fake-docker-state.json");
    const logPath = path.join(root, "fake-docker.log");
    const beforeState = JSON.parse(textAt(statePath));
    const beforeLog = textAt(logPath);
    const run = runHarness("normal", root);
    const output = `${run.result.stdout}${run.result.stderr}`;
    const addedLog = textAt(logPath).slice(beforeLog.length);
    expect(run.result.status).not.toBe(0);
    expect(output).toContain("PILOT: NO-GO");
    expect(JSON.parse(textAt(statePath))).toEqual(beforeState);
    expect(addedLog).not.toMatch(/network (?:create|connect|disconnect|rm) catering_(?:private|ingress)/);
    expect(existsSync(path.join(root, "phase3.activation"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.transaction-baseline.manifest"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.network-adoption.journal"))).toBe(false);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(false);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(false);
  }, 120_000);

  test("RED: inverse mixed adoption is rejected before durable mutation", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-inverse-mixed-adoption-precondition-red-"));
    prepareNormalMixedS2State(root, "catering_private");
    const statePath = path.join(root, "fake-docker-state.json");
    const logPath = path.join(root, "fake-docker.log");
    const beforeState = JSON.parse(textAt(statePath));
    const beforeLog = textAt(logPath);
    const run = runHarness("normal", root);
    const output = `${run.result.stdout}${run.result.stderr}`;
    const addedLog = textAt(logPath).slice(beforeLog.length);
    expect(run.result.status).not.toBe(0);
    expect(output).toContain("PILOT: NO-GO");
    expect(JSON.parse(textAt(statePath))).toEqual(beforeState);
    expect(addedLog).not.toMatch(/network (?:create|connect|disconnect|rm) catering_(?:private|ingress)/);
    expect(existsSync(path.join(root, "phase3.activation"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.transaction-baseline.manifest"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.network-adoption.journal"))).toBe(false);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(false);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(false);
  }, 120_000);

  test("RED: mixed adoption is rejected before durable mutation", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-mixed-adoption-member-drift-red-"));
    prepareNormalMixedS2State(root, "catering_ingress");
    const statePath = path.join(root, "fake-docker-state.json");
    const markerPath = path.join(root, "phase3.activation");
    const manifestPath = path.join(root, "phase3.transaction-baseline.manifest");
    const journalPath = path.join(root, "phase3.network-adoption.journal");
    const logPath = path.join(root, "fake-docker.log");
    const beforeState = JSON.parse(textAt(statePath));
    const beforeLog = textAt(logPath);
    const run = runHarness("crash-after-ingress", root);
    const terminal = `${run.result.stdout}${run.result.stderr}`;
    const addedLog = textAt(logPath).slice(beforeLog.length);
    const afterState = JSON.parse(textAt(statePath));
    expect(run.result.status).not.toBe(0);
    expect(terminal).toContain("PILOT: NO-GO");
    expect(afterState.networks).toEqual(beforeState.networks);
    expect(afterState.containers).toEqual(beforeState.containers);
    expect(addedLog).not.toMatch(/network (?:create|connect|disconnect|rm) catering_(?:private|ingress)/);
    expect(existsSync(markerPath)).toBe(false);
    expect(existsSync(manifestPath)).toBe(false);
    expect(existsSync(journalPath)).toBe(false);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(false);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(false);
  }, 120_000);

  test("phase3.2 rolling_back after ingress journal crash resumes the same rollback", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-ingress-rolling-back-red-"));
    const crashed = runHarness("crash-after-ingress", root);
    expect(crashed.result.status).not.toBe(0);
    const statePath = path.join(root, "fake-docker-state.json");
    const markerPath = path.join(root, "phase3.activation");
    const logPath = path.join(root, "fake-docker.log");
    const state = JSON.parse(textAt(statePath)) as { fault: string; fault_triggered: boolean };
    state.fault = "crash-after-rollback";
    state.fault_triggered = false;
    writeFileSync(statePath, JSON.stringify(state));

    const rollback = runExistingRollback(root, crashed.sandbox);
    expect(rollback.result.status).not.toBe(0);
    expect(fieldsAt(markerPath).get("state")).toBe("rolling_back");
    expect(fieldsAt(markerPath).get("catering_ingress_id")).toMatch(/^[0-9a-f]{64}$/);
    expect(fieldsAt(markerPath).get("catering_private_id")).toBe("absent");
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(true);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(true);

    const beforeExplicitRetryLog = textAt(logPath);
    const explicitRetry = runExistingRollback(root, crashed.sandbox);
    const explicitRetryTerminal = `${explicitRetry.result.stdout}${explicitRetry.result.stderr}`;
    const explicitRetryLog = textAt(logPath).slice(beforeExplicitRetryLog.length);
    expect(explicitRetry.result.status).not.toBe(0);
    expect(explicitRetryTerminal).toContain("PILOT: NO-GO");
    expect(explicitRetryLog).not.toMatch(/network (?:create|connect|disconnect|rm) catering_(?:private|ingress)/);
    expect(fieldsAt(markerPath).get("state")).toBe("rolling_back");

    const beforeResumeLog = textAt(logPath);
    const resumed = runExistingResume(root, crashed.sandbox);
    const terminal = `${resumed.result.stdout}${resumed.result.stderr}`;
    const addedLog = textAt(logPath).slice(beforeResumeLog.length);
    expect(resumed.result.status).toBe(0);
    expect(terminal).toContain("PILOT: ROLLED BACK");
    expect(terminal).not.toContain("PILOT: GO\n");
    expect(addedLog).not.toMatch(/network create/);
    expect(addedLog.match(/^docker network rm catering_ingress$/gm) ?? []).toHaveLength(1);
    expect(addedLog).not.toMatch(/network rm catering_private/);
    expect(existsSync(markerPath)).toBe(false);
    expect(existsSync(path.join(root, "phase3.transaction-baseline.manifest"))).toBe(false);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(false);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(false);
  }, 120_000);

  test.each([
    ["foreign owner", (root: string) => {
      const journalPath = path.join(root, "phase3.network-adoption.journal");
      rewriteFields(journalPath, { owner: "foreign-owner", journal_sha256: "absent" });
      rewriteFields(journalPath, { journal_sha256: canonicalSelfHash(journalPath, "journal_sha256") });
    }],
    ["foreign run", (root: string) => {
      const journalPath = path.join(root, "phase3.network-adoption.journal");
      rewriteFields(journalPath, { transaction_id: "phase3-foreign-run", journal_sha256: "absent" });
      rewriteFields(journalPath, { journal_sha256: canonicalSelfHash(journalPath, "journal_sha256") });
    }],
    ["manifest hash drift", (root: string) => {
      const journalPath = path.join(root, "phase3.network-adoption.journal");
      rewriteFields(journalPath, { transaction_manifest_sha256: "0".repeat(64), journal_sha256: "absent" });
      rewriteFields(journalPath, { journal_sha256: canonicalSelfHash(journalPath, "journal_sha256") });
    }],
    ["network ID drift", (root: string) => {
      const journalPath = path.join(root, "phase3.network-adoption.journal");
      rewriteFields(journalPath, { catering_ingress_id: "b".repeat(64), journal_sha256: "absent" });
      rewriteFields(journalPath, { journal_sha256: canonicalSelfHash(journalPath, "journal_sha256") });
    }],
    ["marker ID contradiction", (root: string) => {
      const markerPath = path.join(root, "phase3.activation");
      rewriteFields(markerPath, { catering_ingress_id: "a".repeat(64), marker_sha256: "absent" });
      rewriteFields(markerPath, { marker_sha256: canonicalSelfHash(markerPath, "marker_sha256") });
    }],
    ["out-of-order journal", (root: string) => {
      const journalPath = path.join(root, "phase3.network-adoption.journal");
      rewriteFields(journalPath, {
        adoption_order: "catering_private",
        next_network: "complete",
        journal_sha256: "absent",
      });
      rewriteFields(journalPath, { journal_sha256: canonicalSelfHash(journalPath, "journal_sha256") });
    }],
    ["membership provenance drift", (root: string) => {
      const journalPath = path.join(root, "phase3.network-adoption.journal");
      rewriteFields(journalPath, {
        catering_ingress_members_b64: "eyJmb3JlaWduIjp7Ik5hbWUiOiIvZm9yZWlnbiIsIkFsaWFzZXMiOlsiZm9yZWlnbiJdfX0=",
        journal_sha256: "absent",
      });
      rewriteFields(journalPath, { journal_sha256: canonicalSelfHash(journalPath, "journal_sha256") });
    }],
    ["same-name replacement", (root: string) => {
      const statePath = path.join(root, "fake-docker-state.json");
      const state = JSON.parse(textAt(statePath)) as {
        networks: Record<string, { id: string; labels: Record<string, string> }>;
      };
      state.networks.catering_ingress.id = "f".repeat(64);
      state.networks.catering_ingress.labels = {
        "com.catering.owner": "foreign-owner",
        "com.catering.phase": "phase3.1",
        "com.catering.kind": "ingress",
        "com.catering.transaction": "foreign-run",
      };
      writeFileSync(statePath, JSON.stringify(state));
    }],
    ["renamed network", (root: string) => {
      const statePath = path.join(root, "fake-docker-state.json");
      const state = JSON.parse(textAt(statePath)) as { networks: Record<string, unknown> };
      state.networks["renamed-ingress"] = state.networks.catering_ingress;
      delete state.networks.catering_ingress;
      writeFileSync(statePath, JSON.stringify(state));
    }],
  ])("phase3.2 explicit rollback rejects %s ingress-prefix evidence", (_name, mutate) => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-ingress-rollback-negative-red-"));
    const crashed = runHarness("crash-after-ingress", root);
    expect(crashed.result.status).not.toBe(0);
    mutate(root);
    const markerPath = path.join(root, "phase3.activation");
    const logPath = path.join(root, "fake-docker.log");
    const beforeRollbackLog = textAt(logPath);
    const rolledBack = runExistingRollback(root, crashed.sandbox);
    const terminal = `${rolledBack.result.stdout}${rolledBack.result.stderr}`;
    const addedLog = textAt(logPath).slice(beforeRollbackLog.length);
    expect(rolledBack.result.status).not.toBe(0);
    expect(terminal).toContain("PILOT: NO-GO");
    expect(terminal).not.toContain("PILOT: ROLLED BACK");
    expect(addedLog).not.toMatch(/network (?:create|connect|disconnect|rm) catering_(?:private|ingress)/);
    expect(fieldsAt(markerPath).get("state")).toMatch(/^(candidate|rolling_back)$/);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(true);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(true);
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
