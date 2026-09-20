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

describe("latest independent Phase-3 P1 review reproducers", () => {
  const absentOnlyMatrix = [
    ["happy absent/absent", "normal", "GO"],
    ["precondition ingress-present", "normal", "NO-GO"],
    ["precondition private-present", "normal", "NO-GO"],
    ["precondition both-present", "normal", "NO-GO"],
    ["prepared/no-network cleanup", "candidate-rollback", "ROLLED BACK"],
    ["crash after run-created ingress", "crash-after-ingress", "resume"],
    ["crash after run-created private", "crash-after-private", "resume"],
    ["membership WAL prefix", "crash-after-active", "rollback"],
    ["partial disconnect rollback", "crash-after-rollback", "resume"],
    ["active rollback", "active", "rollback"],
    ["provenance drift", "drift", "NO-GO"],
  ] as const;

  test("RED matrix declares one finite absent-only recovery table", () => {
    expect(absentOnlyMatrix.map(([name]) => name)).toEqual([
      "happy absent/absent",
      "precondition ingress-present",
      "precondition private-present",
      "precondition both-present",
      "prepared/no-network cleanup",
      "crash after run-created ingress",
      "crash after run-created private",
      "membership WAL prefix",
      "partial disconnect rollback",
      "active rollback",
      "provenance drift",
    ]);
    expect(new Set(absentOnlyMatrix.map(([name]) => name)).size).toBe(absentOnlyMatrix.length);
  });

  test.each([
    ["ingress-present", (root: string) => prepareNormalMixedS2State(root, "catering_ingress")],
    ["private-present", (root: string) => prepareNormalMixedS2State(root, "catering_private")],
    ["both-present", (root: string) => prepareNormalAllPreExistingS2State(root)],
  ] as const)("RED: absent-only precondition rejects %s before durable mutation", (_name, prepare) => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-absent-only-precondition-red-"));
    prepare(root);
    const statePath = path.join(root, "fake-docker-state.json");
    const beforeState = textAt(statePath);
    const run = runHarness("normal", root);
    const output = `${run.result.stdout}${run.result.stderr}`;
    const log = textAt(path.join(root, "fake-docker.log"));

    expect(run.result.status).not.toBe(0);
    expect(output).toContain("PILOT: NO-GO");
    expect(log).not.toMatch(/network (?:create|connect|disconnect|rm) catering_(?:private|ingress)/);
    expect(JSON.parse(textAt(statePath))).toEqual(JSON.parse(beforeState));
    expect(existsSync(path.join(root, "phase3.activation"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.transaction-baseline.manifest"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.network-adoption.journal"))).toBe(false);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(false);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(false);
  }, 120_000);

  test("GREEN: absent-only baseline completes the normal run with terminal locks free", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-absent-only-happy-green-"));
    const run = runHarness("normal", root);
    const output = `${run.result.stdout}${run.result.stderr}`;
    const state = JSON.parse(textAt(path.join(root, "fake-docker-state.json"))) as {
      networks: Record<string, { id: string; labels: Record<string, string> }>;
    };

    expect(run.result.status).toBe(0);
    expect(output).toContain("PILOT: GO");
    expect(fieldsAt(path.join(root, "phase3.activation")).get("state")).toBe("active");
    expect(state.networks.catering_ingress.labels["com.catering.transaction"]).toBe("phase3-harness");
    expect(state.networks.catering_private.labels["com.catering.transaction"]).toBe("phase3-harness");
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(false);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(false);
  }, 120_000);

  test("RED: a membership crash leaves an authenticated WAL prefix for exact recovery", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-membership-wal-red-"));
    const crashed = runHarness("crash-after-active", root);
    expect(crashed.result.status).not.toBe(0);

    const disconnectCrash = installCrashAfterFirstNetworkDisconnect(root);
    const rollback = runExistingRollback(root, crashed.sandbox, disconnectCrash.shimBin);
    expect(rollback.result.status).not.toBe(0);
    const journal = fieldsAt(path.join(root, "phase3.network-adoption.journal"));
    expect(journal.get("membership_wal_phase")).toBe("pending");
    expect(journal.get("membership_wal_action")).toBe("disconnect");
    expect(journal.get("membership_wal_network")).toBe("catering_private");
    expect(journal.get("membership_wal_container")).toBe("platform-infra-postgres-1");
    expect(journal.get("membership_wal_before_b64")).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(journal.get("membership_wal_after_b64")).toMatch(/^[A-Za-z0-9+/=]+$/);

    const resumed = runExistingResume(root, crashed.sandbox);
    expect(resumed.result.status).toBe(0);
    expect(`${resumed.result.stdout}${resumed.result.stderr}`).toContain("PILOT: ROLLED BACK");
  }, 240_000);

  test("RED: resume fails closed when a non-leading target alias drifts", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-alias-matrix-red-"));
    const run = runHarness("normal", root);
    expect(run.result.status).toBe(0);

    const statePath = path.join(root, "fake-docker-state.json");
    const state = JSON.parse(textAt(statePath)) as any;
    const web = state.containers["platform-infra-web-1"];
    web.networks.catering_ingress.aliases = ["wrong-web-alias"];
    state.networks.catering_ingress.containers[web.id].Aliases = ["wrong-web-alias"];
    writeFileSync(statePath, JSON.stringify(state));
    const journalPath = path.join(root, "phase3.network-adoption.journal");
    const driftedIngress = encodeFakeDockerJson(state.networks.catering_ingress.containers);
    rewriteFields(journalPath, {
      catering_ingress_members_b64: driftedIngress,
      catering_ingress_aliases_b64: driftedIngress,
      journal_sha256: "absent",
    });
    rewriteFields(journalPath, { journal_sha256: canonicalSelfHash(journalPath, "journal_sha256") });

    const resumed = runExistingResume(root, run.sandbox);
    const output = `${resumed.result.stdout}${resumed.result.stderr}`;
    expect(resumed.result.status).not.toBe(0);
    expect(output).toContain("PILOT: NO-GO");
    expect(output).not.toContain("PILOT: GO\n");
    expect(fieldsAt(path.join(root, "phase3.activation")).get("state")).toBe("active");
  }, 120_000);

  test("RED: active rollback rejects compatibility drift before its first mutation", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-rollback-preflight-red-"));
    const run = runHarness("normal", root);
    expect(run.result.status).toBe(0);

    const statePath = path.join(root, "fake-docker-state.json");
    const state = JSON.parse(textAt(statePath)) as any;
    const foreign = state.containers["commcats-eventos-app"];
    expect(foreign.networks["platform-infra_default"]).toBeDefined();
    expect(state.networks["platform-infra_default"].containers[foreign.id]).toBeDefined();
    delete foreign.networks["platform-infra_default"];
    delete state.networks["platform-infra_default"].containers[foreign.id];
    writeFileSync(statePath, JSON.stringify(state));
    const beforeState = textAt(statePath);
    const beforeLog = textAt(path.join(root, "fake-docker.log"));

    const rolledBack = runExistingRollback(root, run.sandbox);
    const output = `${rolledBack.result.stdout}${rolledBack.result.stderr}`;
    const addedLog = textAt(path.join(root, "fake-docker.log")).slice(beforeLog.length);
    expect(rolledBack.result.status).not.toBe(0);
    expect(output).toContain("PILOT: NO-GO");
    expect(addedLog).not.toMatch(/network (?:create|connect|disconnect|rm)/);
    expect(JSON.parse(textAt(statePath))).toEqual(JSON.parse(beforeState));
    expect(fieldsAt(path.join(root, "phase3.activation")).get("state")).toBe("active");
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(true);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(true);
  }, 120_000);

  test("RED: pending membership WAL is not replayed before foreign-invariant preflight", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-wal-preflight-order-red-"));
    const run = runHarness("normal", root);
    expect(run.result.status).toBe(0);

    const statePath = path.join(root, "fake-docker-state.json");
    const markerPath = path.join(root, "phase3.activation");
    const journalPath = path.join(root, "phase3.network-adoption.journal");
    const logPath = path.join(root, "fake-docker.log");
    const activeState = textAt(statePath);
    const crashShim = installCrashAfterFirstNetworkDisconnect(root);
    const crashed = runExistingRollback(root, run.sandbox, crashShim.shimBin);
    expect(crashed.result.status).not.toBe(0);
    expect(fieldsAt(markerPath).get("state")).toBe("rolling_back");
    expect(fieldsAt(journalPath).get("membership_wal_phase")).toBe("pending");
    expect(fieldsAt(journalPath).get("membership_wal_action")).toBe("disconnect");

    writeFileSync(statePath, activeState);
    const state = JSON.parse(textAt(statePath)) as any;
    const foreign = state.containers["commcats-eventos-app"];
    expect(foreign.networks["platform-infra_default"]).toBeDefined();
    expect(state.networks["platform-infra_default"].containers[foreign.id]).toBeDefined();
    delete foreign.networks["platform-infra_default"];
    delete state.networks["platform-infra_default"].containers[foreign.id];
    writeFileSync(statePath, JSON.stringify(state));
    const beforeResumeState = textAt(statePath);
    const beforeResumeLog = textAt(logPath);

    const resumed = runExistingResume(root, run.sandbox);
    const output = `${resumed.result.stdout}${resumed.result.stderr}`;
    const addedLog = textAt(logPath).slice(beforeResumeLog.length);
    expect(resumed.result.status).not.toBe(0);
    expect(output).toContain("PILOT: NO-GO");
    expect(addedLog).not.toMatch(/network (?:connect|disconnect)/);
    expect(textAt(statePath)).toBe(beforeResumeState);
    expect(fieldsAt(markerPath).get("state")).toBe("rolling_back");
    expect(fieldsAt(journalPath).get("membership_wal_phase")).toBe("pending");
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(true);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(true);
  }, 120_000);

  test.each([0, 1, 3])("RED: monotonic rollback resumes after %s compatibility reconnects", (reconnectCount) => {
    const root = mkdtempSync(path.join(tmpdir(), `catering-phase3-monotonic-crash-${reconnectCount}-red-`));
    const crashed = runHarness("crash-after-active", root);
    expect(crashed.result.status).not.toBe(0);
    const crashShim = installCrashAfterCompatibilityConnect(root, reconnectCount);
    const rollback = runExistingRollback(root, crashed.sandbox, crashShim.shimBin);
    expect(rollback.result.status).not.toBe(0);
    expect(fieldsAt(path.join(root, "phase3.activation")).get("state")).toBe("rolling_back");
    const resumed = runExistingResume(root, crashed.sandbox);
    const output = `${resumed.result.stdout}${resumed.result.stderr}`;
    expect(resumed.result.status).toBe(0);
    expect(output).toContain("PILOT: ROLLED BACK");
    expect(existsSync(path.join(root, "phase3.activation"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.transaction-baseline.manifest"))).toBe(false);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(false);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(false);
  }, 180_000);

  test("RED: a complete compatibility baseline makes rolling_back resume a terminal no-op", () => {
    const timingA = process.hrtime.bigint();
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-monotonic-complete-red-"));
    const crashed = runHarness("crash-after-active", root);
    const timingB = process.hrtime.bigint();
    console.info("PHASE3_CI_TIMING", JSON.stringify({ phase: "setup", elapsedMs: Number(timingB - timingA) / 1e6, exitCode: crashed.result.status, signal: crashed.result.signal, spawnError: Boolean(crashed.result.error) }));
    expect(crashed.result.status).not.toBe(0);
    const crashShim = installCrashAfterCompatibilityConnect(root, 7);
    const rollback = runExistingRollback(root, crashed.sandbox, crashShim.shimBin);
    const timingC = process.hrtime.bigint();
    console.info("PHASE3_CI_TIMING", JSON.stringify({ phase: "rollback", elapsedMs: Number(timingC - timingB) / 1e6, exitCode: rollback.result.status, signal: rollback.result.signal, spawnError: Boolean(rollback.result.error) }));
    expect(rollback.result.status).not.toBe(0);
    const resumed = runExistingResume(root, crashed.sandbox);
    const timingD = process.hrtime.bigint();
    console.info("PHASE3_CI_TIMING", JSON.stringify({ phase: "resume_cleanup", elapsedMs: Number(timingD - timingC) / 1e6, exitCode: resumed.result.status, signal: resumed.result.signal, spawnError: Boolean(resumed.result.error) }));
    const output = `${resumed.result.stdout}${resumed.result.stderr}`;
    expect(resumed.result.status).toBe(0);
    expect(output).toContain("PILOT: ROLLED BACK");
    expect(existsSync(path.join(root, "phase3.activation"))).toBe(false);
  }, 180_000);

  test("RED: exactly one missing compatibility connection is the only forward delta", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-monotonic-single-delta-red-"));
    const run = runHarness("normal", root);
    expect(run.result.status).toBe(0);
    restoreCompatibilityBaselineExcept(root, "platform-infra-postgres-1");
    const markerPath = path.join(root, "phase3.activation");
    rewriteFields(markerPath, { state: "rolling_back", stage: "RB", marker_sha256: "absent" });
    rewriteFields(markerPath, { marker_sha256: canonicalSelfHash(markerPath, "marker_sha256") });
    const logPath = path.join(root, "fake-docker.log");
    const beforeLog = textAt(logPath);
    const rollback = runExistingResume(root, run.sandbox);
    const output = `${rollback.result.stdout}${rollback.result.stderr}`;
    const addedLog = textAt(logPath).slice(beforeLog.length);
    expect(rollback.result.status).toBe(0);
    expect(output).toContain("PILOT: ROLLED BACK");
    expect((addedLog.match(/^docker network connect .*platform-infra_default platform-infra-postgres-1$/gm) ?? []).length).toBe(1);
    expect(addedLog).not.toMatch(/network connect .*platform-infra_default (?:platform-infra-(?:intake|offer|production|exports|web)-1)/);
  }, 120_000);

  test("RED: compatibility member or alias provenance drift fails before rollback mutation", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-monotonic-provenance-red-"));
    const run = runHarness("normal", root);
    expect(run.result.status).toBe(0);
    const statePath = path.join(root, "fake-docker-state.json");
    const state = JSON.parse(textAt(statePath)) as any;
    const foreign = state.containers["commcats-eventos-app"];
    state.networks["platform-infra_default"].containers[foreign.id] = {
      Name: "/commcats-eventos-app",
      Aliases: ["unexpected"],
    };
    foreign.networks["platform-infra_default"] = { aliases: ["unexpected"] };
    writeFileSync(statePath, JSON.stringify(state));
    const beforeState = textAt(statePath);
    const beforeLog = textAt(path.join(root, "fake-docker.log"));
    const rollback = runExistingRollback(root, run.sandbox);
    const output = `${rollback.result.stdout}${rollback.result.stderr}`;
    const addedLog = textAt(path.join(root, "fake-docker.log")).slice(beforeLog.length);
    expect(rollback.result.status).not.toBe(0);
    expect(output).toContain("PILOT: NO-GO");
    expect(addedLog).not.toMatch(/network (?:connect|disconnect|rm)/);
    expect(textAt(statePath)).toBe(beforeState);
    expect(fieldsAt(path.join(root, "phase3.activation")).get("state")).toBe("active");
  }, 120_000);

  test("RED: target network cleanup follows full compatibility readback and frees locks", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-monotonic-cleanup-gate-red-"));
    const run = runHarness("normal", root);
    expect(run.result.status).toBe(0);
    const logPath = path.join(root, "fake-docker.log");
    const beforeLog = textAt(logPath);
    const rollback = runExistingRollback(root, run.sandbox);
    const output = `${rollback.result.stdout}${rollback.result.stderr}`;
    const addedLog = textAt(logPath).slice(beforeLog.length);
    expect(rollback.result.status).toBe(0);
    expect(output).toContain("PILOT: ROLLED BACK");
    const firstRm = addedLog.search(/^docker network rm catering_/m);
    expect(firstRm).toBeGreaterThan(0);
    const beforeCleanup = addedLog.slice(0, firstRm);
    const lastCompatibilityInspect = Math.max(
      beforeCleanup.lastIndexOf("docker network inspect --format {{json .Containers}} platform-infra_default"),
      beforeCleanup.lastIndexOf("docker network inspect --format {{json .Containers}} zeiterfassung_default"),
    );
    expect(lastCompatibilityInspect).toBeGreaterThanOrEqual(0);
    expect(firstRm).toBeGreaterThan(lastCompatibilityInspect);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(false);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(false);
  }, 120_000);

  test("RED: repeated resume on the terminal absent target state is idempotent", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-monotonic-repeat-red-"));
    const run = runHarness("normal", root);
    expect(run.result.status).toBe(0);
    const rollback = runExistingRollback(root, run.sandbox);
    expect(rollback.result.status).toBe(0);
    const repeated = runExistingResume(root, run.sandbox);
    const output = `${repeated.result.stdout}${repeated.result.stderr}`;
    expect(repeated.result.status).toBe(0);
    expect(output).toContain("PILOT: ROLLED BACK");
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(false);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(false);
  }, 120_000);

  test("RED: terminal absent target keeps absent IDs and snapshots through replay", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-terminal-absent-representation-red-"));
    const crashed = runHarness("crash-after-candidate", root, {
      CATERING_PHASE3_FAKE_PRE_NETWORK_CRASH: "1",
    });
    expect(crashed.result.status).not.toBe(0);
    const rollback = runExistingRollback(root, crashed.sandbox);
    expect(rollback.result.status).toBe(0);
    const journal = fieldsAt(path.join(root, "phase3.network-adoption.journal"));
    expect(journal.get("catering_ingress_id")).toBe("absent");
    expect(journal.get("catering_private_id")).toBe("absent");
    expect(journal.get("catering_ingress_members_b64")).toBe("absent");
    expect(journal.get("catering_private_members_b64")).toBe("absent");
    const repeated = runExistingResume(root, crashed.sandbox);
    const output = `${repeated.result.stdout}${repeated.result.stderr}`;
    expect(repeated.result.status).toBe(0);
    expect(output).toContain("PILOT: ROLLED BACK");
  }, 120_000);

  test("RED: terminal present target rejects noncanonical equivalent snapshots", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-terminal-canonical-red-"));
    const run = runHarness("normal", root);
    expect(run.result.status).toBe(0);
    const rollback = runExistingRollback(root, run.sandbox);
    expect(rollback.result.status).toBe(0);
    const journalPath = path.join(root, "phase3.network-adoption.journal");
    const journal = fieldsAt(journalPath);
    const snapshot = journal.get("catering_ingress_members_b64");
    expect(snapshot).toMatch(/^[A-Za-z0-9+/=]+$/);
    const nonCanonical = Buffer.from(JSON.stringify(JSON.parse(Buffer.from(snapshot!, "base64").toString("utf8")), null, 2)).toString("base64");
    rewriteFields(journalPath, {
      catering_ingress_members_b64: nonCanonical,
      catering_ingress_aliases_b64: nonCanonical,
      journal_sha256: "absent",
    });
    rewriteFields(journalPath, { journal_sha256: canonicalSelfHash(journalPath, "journal_sha256") });
    const repeated = runExistingResume(root, run.sandbox);
    const output = `${repeated.result.stdout}${repeated.result.stderr}`;
    expect(repeated.result.status).not.toBe(0);
    expect(output).toContain("PILOT: NO-GO");
  }, 120_000);

  test("RED: rollback:candidate keeps recovery authority when terminal journal write fails", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-terminal-journal-failure-red-"));
    const crashed = runHarness("crash-after-active", root);
    expect(crashed.result.status).not.toBe(0);
    const markerPath = path.join(root, "phase3.activation");
    rewriteFields(markerPath, { state: "candidate", marker_sha256: "absent" });
    rewriteFields(markerPath, { marker_sha256: canonicalSelfHash(markerPath, "marker_sha256") });
    expect(fieldsAt(markerPath).get("state")).toBe("candidate");
    const failure = installMembershipJournalWriteFailure(root);
    const rollback = runExistingRollback(root, crashed.sandbox, failure.shimBin);
    const output = `${rollback.result.stdout}${rollback.result.stderr}`;

    expect(existsSync(failure.failureFlag)).toBe(true);
    expect(textAt(failure.countFile).trim()).toBe("17");
    expect(rollback.result.status).not.toBe(0);
    expect(output).not.toContain("PILOT: ROLLED BACK");
    expect(fieldsAt(markerPath).get("state")).toBe("rolling_back");
    expect(existsSync(path.join(root, "phase3.transaction-baseline.manifest"))).toBe(true);
    expect(existsSync(path.join(root, "phase3.rollback-completion.receipt"))).toBe(true);
    expect(existsSync(path.join(root, "phase3.restore-evidence.record"))).toBe(true);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(true);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(true);
  }, 120_000);

  test("harness self-integrity survives two runs with the same backend root", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-harness-integrity-"));
    const beforeBytes = readFileSync(fakeDockerPath).length;
    const beforeSha256 = digestFile(fakeDockerPath);

    runHarness("crash-after-ingress", root);
    runHarness("crash-after-ingress", root);

    expect(readFileSync(fakeDockerPath).length).toBe(beforeBytes);
    expect(digestFile(fakeDockerPath)).toBe(beforeSha256);
  }, 120_000);

  test.each([
    ["ingress=pre-existing-exact/private=absent", "catering_ingress" as const],
    ["ingress=absent/private=pre-existing-exact", "catering_private" as const],
  ])("RED: normal path rejects %s before any durable mutation", (_name, preExistingNetwork) => {
    const { root, run, beforeState } = runNormalMixedS2(preExistingNetwork);
    const output = `${run.result.stdout}${run.result.stderr}`;
    expect(run.result.status).not.toBe(0);
    expect(output).toContain("PILOT: NO-GO");
    const log = textAt(path.join(root, "fake-docker.log"));
    expect(log).not.toMatch(/network (?:create|connect|disconnect|rm) catering_(?:private|ingress)/);
    expect(JSON.parse(textAt(path.join(root, "fake-docker-state.json")))).toEqual(JSON.parse(beforeState));
    expect(existsSync(path.join(root, "phase3.activation"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.transaction-baseline.manifest"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.network-adoption.journal"))).toBe(false);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(false);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(false);
  }, 120_000);

  test("RED: normal generated manifest labels recover pre-existing S2 networks", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-preexisting-generated-labels-red-"));
    const crashed = runHarness("crash-after-ingress", root);
    expect(crashed.result.status).not.toBe(0);
    const prepared = preparePreExistingExactS2Crash(root);
    const manifestPath = path.join(root, "phase3.transaction-baseline.manifest");
    expect(fieldsAt(manifestPath).get("network_labels")).toBe(
      "owner=catering-agents-platform;phase=phase3.1;transaction=phase3-harness",
    );
    const logPath = path.join(root, "fake-docker.log");
    const beforeState = textAt(path.join(root, "fake-docker-state.json"));
    const beforeLog = textAt(logPath);

    const rolledBack = runExistingRollback(root, crashed.sandbox, prepared.dockerShimBin);
    const terminal = `${rolledBack.result.stdout}${rolledBack.result.stderr}`;
    const addedLog = textAt(logPath).slice(beforeLog.length);
    expect(rolledBack.result.status).not.toBe(0);
    expect(terminal).toContain("PILOT: NO-GO");
    expect(JSON.parse(textAt(path.join(root, "fake-docker-state.json")))).toEqual(JSON.parse(beforeState));
    expect(addedLog).not.toMatch(/network (?:create|connect|disconnect|rm) catering_(?:private|ingress)/);
    expect(fieldsAt(path.join(root, "phase3.activation")).get("state")).toBe("candidate");
    expect(existsSync(path.join(root, "phase3.transaction-baseline.manifest"))).toBe(true);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(true);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(true);
  }, 120_000);

  test("RED: mixed pre-existing and absent S2 baselines rollback without target mutation", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-mixed-s2-rollback-red-"));
    const crashed = runHarness("crash-after-ingress", root);
    expect(crashed.result.status).not.toBe(0);
    const prepared = prepareMixedPreExistingS2Crash(root);
    const logPath = path.join(root, "fake-docker.log");
    const beforeLog = textAt(logPath);

    const rolledBack = runExistingRollback(root, crashed.sandbox, prepared.dockerShimBin);
    const terminal = `${rolledBack.result.stdout}${rolledBack.result.stderr}`;
    const addedLog = textAt(logPath).slice(beforeLog.length);
    expect(rolledBack.result.status).not.toBe(0);
    expect(terminal).toContain("PILOT: NO-GO");
    expect(JSON.parse(textAt(path.join(root, "fake-docker-state.json")))).toEqual(JSON.parse(prepared.beforeState));
    expect(addedLog).not.toMatch(/network (?:create|connect|disconnect|rm) catering_(?:private|ingress)/);
    expect(fieldsAt(path.join(root, "phase3.activation")).get("state")).toBe("candidate");
    expect(existsSync(path.join(root, "phase3.transaction-baseline.manifest"))).toBe(true);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(true);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(true);
  }, 120_000);

  test("RED: inverse mixed pre-existing and absent S2 baselines rollback without target mutation", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-inverse-mixed-s2-rollback-red-"));
    const crashed = runHarness("crash-after-ingress", root);
    expect(crashed.result.status).not.toBe(0);
    const prepared = prepareInverseMixedPreExistingS2Crash(root);
    const logPath = path.join(root, "fake-docker.log");
    const beforeLog = textAt(logPath);

    const rolledBack = runExistingRollback(root, crashed.sandbox, prepared.dockerShimBin);
    const terminal = `${rolledBack.result.stdout}${rolledBack.result.stderr}`;
    const addedLog = textAt(logPath).slice(beforeLog.length);
    expect(rolledBack.result.status).not.toBe(0);
    expect(terminal).toContain("PILOT: NO-GO");
    expect(JSON.parse(textAt(path.join(root, "fake-docker-state.json")))).toEqual(JSON.parse(prepared.beforeState));
    expect(addedLog).not.toMatch(/network (?:create|connect|disconnect|rm) catering_(?:private|ingress)/);
    expect(fieldsAt(path.join(root, "phase3.activation")).get("state")).toBe("candidate");
    expect(existsSync(path.join(root, "phase3.transaction-baseline.manifest"))).toBe(true);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(true);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(true);
  }, 120_000);

  test("RED: rolling_back validates preserved networks against immutable baseline after membership rollback", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-preserved-rollback-progress-red-"));
    const crashed = runHarness("crash-after-active", root);
    expect(crashed.result.status).not.toBe(0);
    const prepared = preparePreExistingRollbackProgress(root);
    const logPath = path.join(root, "fake-docker.log");
    const beforeLog = textAt(logPath);

    const resumed = runExistingResume(root, crashed.sandbox, prepared.dockerShimBin);
    const terminal = `${resumed.result.stdout}${resumed.result.stderr}`;
    const addedLog = textAt(logPath).slice(beforeLog.length);
    expect(resumed.result.status).not.toBe(0);
    expect(terminal).toContain("PILOT: NO-GO");
    const finalState = JSON.parse(textAt(path.join(root, "fake-docker-state.json"))) as {
      networks: Record<string, unknown>;
    };
    const preparedState = JSON.parse(prepared.beforeState) as { networks: Record<string, unknown> };
    expect(finalState.networks.catering_ingress).toEqual(preparedState.networks.catering_ingress);
    expect(finalState.networks.catering_private).toEqual(preparedState.networks.catering_private);
    expect(addedLog).not.toMatch(/network (?:create|connect|disconnect|rm) catering_(?:private|ingress)/);
    expect(fieldsAt(path.join(root, "phase3.activation")).get("state")).toBe("rolling_back");
    expect(existsSync(path.join(root, "phase3.transaction-baseline.manifest"))).toBe(true);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(true);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(true);
  }, 120_000);

  test("RED: pre-existing manifest-bound transaction labels remain recovery-bound", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-preexisting-transaction-label-red-"));
    const crashed = runHarness("crash-after-active", root);
    expect(crashed.result.status).not.toBe(0);
    const prepared = preparePreExistingRollbackProgress(root, true);
    const manifest = fieldsAt(path.join(root, "phase3.transaction-baseline.manifest"));
    expect(manifest.get("catering_ingress_network_labels")).toBe(
      "owner=catering-agents-platform;phase=phase3.1;kind=ingress;transaction=phase3-harness",
    );
    expect(manifest.get("catering_private_network_labels")).toBe(
      "owner=catering-agents-platform;phase=phase3.1;kind=private;transaction=phase3-harness",
    );
    const logPath = path.join(root, "fake-docker.log");
    const beforeLog = textAt(logPath);

    const resumed = runExistingResume(root, crashed.sandbox, prepared.dockerShimBin);
    const terminal = `${resumed.result.stdout}${resumed.result.stderr}`;
    const addedLog = textAt(logPath).slice(beforeLog.length);
    expect(resumed.result.status).not.toBe(0);
    expect(terminal).toContain("PILOT: NO-GO");
    const finalState = JSON.parse(textAt(path.join(root, "fake-docker-state.json"))) as {
      networks: Record<string, unknown>;
    };
    const preparedState = JSON.parse(prepared.beforeState) as { networks: Record<string, unknown> };
    expect(finalState.networks.catering_ingress).toEqual(preparedState.networks.catering_ingress);
    expect(finalState.networks.catering_private).toEqual(preparedState.networks.catering_private);
    expect(addedLog).not.toMatch(/network (?:create|connect|disconnect|rm) catering_(?:private|ingress)/);
    expect(fieldsAt(path.join(root, "phase3.activation")).get("state")).toBe("rolling_back");
    expect(existsSync(path.join(root, "phase3.transaction-baseline.manifest"))).toBe(true);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(true);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(true);
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

  test("RED: pre-existing-exact S2 crash terminalizes explicit rollback without network mutation", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-preexisting-s2-rollback-red-"));
    const crashed = runHarness("crash-after-ingress", root);
    expect(crashed.result.status).not.toBe(0);
    const prepared = preparePreExistingExactS2Crash(root);
    const logPath = path.join(root, "fake-docker.log");
    const beforeLog = textAt(logPath);

    const rolledBack = runExistingRollback(root, crashed.sandbox, prepared.dockerShimBin);
    const terminal = `${rolledBack.result.stdout}${rolledBack.result.stderr}`;
    const addedLog = textAt(logPath).slice(beforeLog.length);
    expect(rolledBack.result.status).not.toBe(0);
    expect(terminal).toContain("PILOT: NO-GO");
    expect(JSON.parse(textAt(path.join(root, "fake-docker-state.json")))).toEqual(JSON.parse(prepared.beforeState));
    expect(addedLog).not.toMatch(/network (?:create|connect|disconnect|rm) catering_(?:private|ingress)/);
    expect(fieldsAt(path.join(root, "phase3.activation")).get("state")).toBe("candidate");
    expect(existsSync(path.join(root, "phase3.transaction-baseline.manifest"))).toBe(true);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(true);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(true);
  }, 120_000);

  test("RED: pre-existing-exact S2 crash resumes adoption without recreating networks", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-preexisting-s2-resume-red-"));
    const crashed = runHarness("crash-after-ingress", root);
    expect(crashed.result.status).not.toBe(0);
    const prepared = preparePreExistingExactS2Crash(root);
    const logPath = path.join(root, "fake-docker.log");
    const beforeLog = textAt(logPath);

    const resumed = runExistingResume(root, crashed.sandbox, prepared.dockerShimBin);
    const terminal = `${resumed.result.stdout}${resumed.result.stderr}`;
    const addedLog = textAt(logPath).slice(beforeLog.length);
    expect(resumed.result.status).not.toBe(0);
    expect(terminal).toContain("PILOT: NO-GO");
    const state = JSON.parse(textAt(path.join(root, "fake-docker-state.json"))) as {
      networks: Record<string, { id: string; labels: Record<string, string> }>;
    };
    expect(state.networks.catering_ingress.id).toBe(prepared.ingressId);
    expect(state.networks.catering_private.id).toBe(prepared.privateId);
    expect(state.networks.catering_ingress.labels).toEqual({
      "com.catering.owner": "catering-agents-platform",
      "com.catering.phase": "phase3.1",
      "com.catering.kind": "ingress",
    });
    expect(state.networks.catering_private.labels).toEqual({
      "com.catering.owner": "catering-agents-platform",
      "com.catering.phase": "phase3.1",
      "com.catering.kind": "private",
    });
    expect(fieldsAt(path.join(root, "phase3.activation")).get("state")).toBe("candidate");
    expect(existsSync(path.join(root, "phase3.transaction-baseline.manifest"))).toBe(true);
    expect(addedLog).not.toMatch(/network create catering_(?:private|ingress)/);
    expect(addedLog).not.toMatch(/network rm catering_(?:private|ingress)/);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(true);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(true);
  }, 120_000);

  test("RED: phase3.2 pre-existing S2 rolling_back prefix resumes after a crash", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-preexisting-s2-rolling-back-red-"));
    const crashed = runHarness("crash-after-ingress", root);
    expect(crashed.result.status).not.toBe(0);
    const prepared = preparePreExistingExactS2Crash(root);
    const statePath = path.join(root, "fake-docker-state.json");
    const markerPath = path.join(root, "phase3.activation");
    const logPath = path.join(root, "fake-docker.log");
    const state = JSON.parse(textAt(statePath)) as { fault: string; fault_triggered: boolean };
    state.fault = "crash-after-rollback";
    state.fault_triggered = false;
    writeFileSync(statePath, JSON.stringify(state));

    const rollback = runExistingRollback(root, crashed.sandbox, prepared.dockerShimBin);
    expect(rollback.result.status).not.toBe(0);
    expect(fieldsAt(markerPath).get("state")).toBe("candidate");
    expect(fieldsAt(markerPath).get("stage")).toBe("S2");
    expect(fieldsAt(markerPath).get("catering_ingress_id")).toBe("absent");
    expect(fieldsAt(markerPath).get("catering_private_id")).toBe("absent");
    expect(existsSync(path.join(root, "phase3.restore-evidence.record"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.rollback-restore-proof.archive"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.rollback-completion.receipt"))).toBe(false);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(true);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(true);

    const beforeResumeLog = textAt(logPath);
    const resumed = runExistingResume(root, rollback.sandbox, prepared.dockerShimBin);
    const terminal = `${resumed.result.stdout}${resumed.result.stderr}`;
    const addedLog = textAt(logPath).slice(beforeResumeLog.length);
    expect(resumed.result.status).not.toBe(0);
    expect(terminal).toContain("PILOT: NO-GO");
    expect(terminal).not.toContain("PILOT: ROLLED BACK");
    expect(addedLog).not.toMatch(/network (?:create|connect|disconnect|rm) catering_(?:private|ingress)/);
    expect(existsSync(markerPath)).toBe(true);
    expect(existsSync(path.join(root, "phase3.transaction-baseline.manifest"))).toBe(true);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(true);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(true);
  }, 120_000);

  test("RED: phase3.2 inverse mixed rolling_back prefix resumes after ingress removal", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-inverse-mixed-rolling-back-red-"));
    const crashed = runHarness("crash-after-active", root);
    expect(crashed.result.status).not.toBe(0);
    const prepared = prepareInverseMixedActiveRollback(root);
    const markerPath = path.join(root, "phase3.activation");
    const logPath = path.join(root, "fake-docker.log");
    const beforeLog = textAt(logPath);

    const resumed = runExistingResume(root, crashed.sandbox, prepared.dockerShimBin);
    const terminal = `${resumed.result.stdout}${resumed.result.stderr}`;
    const addedLog = textAt(logPath).slice(beforeLog.length);
    expect(resumed.result.status).not.toBe(0);
    expect(terminal).toContain("PILOT: NO-GO");
    expect(terminal).not.toContain("PILOT: ROLLED BACK");
    expect(addedLog).not.toMatch(/network (?:create|connect) catering_(?:private|ingress)/);
    expect(addedLog).not.toMatch(/network disconnect catering_ingress/);
    expect(addedLog).not.toMatch(/network rm catering_ingress/);
    expect(existsSync(markerPath)).toBe(true);
    expect(existsSync(path.join(root, "phase3.transaction-baseline.manifest"))).toBe(true);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(true);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(true);
  }, 120_000);

});
