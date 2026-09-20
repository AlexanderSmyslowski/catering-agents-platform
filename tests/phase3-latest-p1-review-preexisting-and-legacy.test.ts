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
  test.each([
    ["manifest network order drift", (root: string) => {
      const manifestPath = path.join(root, "phase3.transaction-baseline.manifest");
      rewriteFields(manifestPath, { network_create_order: "catering_private,catering_ingress" });
      rebindManifestReferences(root);
    }],
    ["manifest network label drift", (root: string) => {
      const manifestPath = path.join(root, "phase3.transaction-baseline.manifest");
      rewriteFields(manifestPath, { network_labels: "owner=foreign-owner;phase=phase3.1" });
      rebindManifestReferences(root);
    }],
    ["manifest baseline ID drift", (root: string) => {
      const manifestPath = path.join(root, "phase3.transaction-baseline.manifest");
      rewriteFields(manifestPath, { catering_ingress_baseline_id: "f".repeat(64) });
      rebindManifestReferences(root);
    }],
    ["manifest baseline status drift", (root: string) => {
      const manifestPath = path.join(root, "phase3.transaction-baseline.manifest");
      rewriteFields(manifestPath, { catering_ingress_baseline: "absent" });
      rebindManifestReferences(root);
    }],
    ["live network ID drift", (root: string) => {
      const statePath = path.join(root, "fake-docker-state.json");
      const state = JSON.parse(textAt(statePath)) as {
        networks: Record<string, { id: string }>;
      };
      state.networks.catering_ingress.id = "e".repeat(64);
      writeFileSync(statePath, JSON.stringify(state));
    }],
    ["foreign owner label", (root: string) => {
      const statePath = path.join(root, "fake-docker-state.json");
      const state = JSON.parse(textAt(statePath)) as {
        networks: Record<string, { labels: Record<string, string> }>;
      };
      state.networks.catering_ingress.labels["com.catering.owner"] = "foreign-owner";
      writeFileSync(statePath, JSON.stringify(state));
    }],
    ["foreign transaction label", (root: string) => {
      const statePath = path.join(root, "fake-docker-state.json");
      const state = JSON.parse(textAt(statePath)) as {
        networks: Record<string, { labels: Record<string, string> }>;
      };
      state.networks.catering_ingress.labels["com.catering.transaction"] = "phase3-foreign-run";
      writeFileSync(statePath, JSON.stringify(state));
    }],
    ["network engine parameter drift", (root: string) => {
      const statePath = path.join(root, "fake-docker-state.json");
      const state = JSON.parse(textAt(statePath)) as {
        networks: Record<string, { driver: string }>;
      };
      state.networks.catering_ingress.driver = "host";
      writeFileSync(statePath, JSON.stringify(state));
    }],
    ["network member or alias drift", (root: string) => {
      const statePath = path.join(root, "fake-docker-state.json");
      const state = JSON.parse(textAt(statePath)) as {
        networks: Record<string, { containers: Record<string, unknown> }>;
      };
      state.networks.catering_ingress.containers.foreign = {
        Name: "/foreign",
        Aliases: ["foreign"],
      };
      writeFileSync(statePath, JSON.stringify(state));
    }],
    ["missing pre-existing network", (root: string) => {
      const statePath = path.join(root, "fake-docker-state.json");
      const state = JSON.parse(textAt(statePath)) as { networks: Record<string, unknown> };
      delete state.networks.catering_private;
      writeFileSync(statePath, JSON.stringify(state));
    }],
  ])("pre-existing-exact S2 rejects %s before any network mutation", (_name, mutate) => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-preexisting-s2-negative-"));
    const crashed = runHarness("crash-after-ingress", root);
    expect(crashed.result.status).not.toBe(0);
    const prepared = preparePreExistingExactS2Crash(root);
    mutate(root);
    const statePath = path.join(root, "fake-docker-state.json");
    const markerPath = path.join(root, "phase3.activation");
    const logPath = path.join(root, "fake-docker.log");
    const beforeState = textAt(statePath);
    const beforeLog = textAt(logPath);

    const rolledBack = runExistingRollback(root, crashed.sandbox, prepared.dockerShimBin);
    const terminal = `${rolledBack.result.stdout}${rolledBack.result.stderr}`;
    const addedLog = textAt(logPath).slice(beforeLog.length);
    expect(rolledBack.result.status).not.toBe(0);
    expect(terminal).toContain("PILOT: NO-GO");
    expect(terminal).not.toContain("PILOT: ROLLED BACK");
    expect(addedLog).not.toMatch(/network (?:create|connect|disconnect|rm) catering_(?:private|ingress)/);
    expect(fieldsAt(markerPath).get("state")).toBe("candidate");
    expect(textAt(statePath)).toBe(beforeState);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(true);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(true);
  }, 120_000);

  test.each([
    ["manifest driver drift", { network_driver: "catering_ingress:host;catering_private:bridge" }],
    ["manifest scope drift", { network_scope: "catering_ingress:global;catering_private:local" }],
    ["manifest internal drift", { network_internal: "catering_ingress:true;catering_private:false" }],
    ["manifest IPAM driver drift", { network_ipam: "catering_ingress:host;catering_private:default" }],
    ["manifest EnableIPv6 drift", { network_enable_ipv6: "catering_ingress:true;catering_private:false" }],
    ["manifest IPAM options drift", { network_ipam_options: 'catering_ingress:{"com.example.drift":"1"};catering_private:{}' }],
    ["manifest IPAM config drift", { network_ipam_config: 'catering_ingress:[{"Subnet":"10.0.0.0/24"}];catering_private:[]' }],
    ["manifest member provenance drift", { network_members: "catering_ingress:foreign;catering_private:platform-infra-web-1" }],
    ["manifest alias provenance drift", { network_aliases: "catering_ingress:foreign=foreign" }],
  ])("GREEN: pre-existing-exact S2 rejects %s after manifest rebinding", (_name, fields) => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-preexisting-s2-manifest-red-"));
    const crashed = runHarness("crash-after-ingress", root);
    expect(crashed.result.status).not.toBe(0);
    const prepared = preparePreExistingExactS2Crash(root);
    rewriteFields(path.join(root, "phase3.transaction-baseline.manifest"), fields);
    rebindManifestReferences(root);

    const statePath = path.join(root, "fake-docker-state.json");
    const markerPath = path.join(root, "phase3.activation");
    const logPath = path.join(root, "fake-docker.log");
    const beforeState = textAt(statePath);
    const beforeLog = textAt(logPath);
    const rolledBack = runExistingRollback(root, crashed.sandbox, prepared.dockerShimBin);
    const terminal = `${rolledBack.result.stdout}${rolledBack.result.stderr}`;
    const addedLog = textAt(logPath).slice(beforeLog.length);
    expect(rolledBack.result.status).not.toBe(0);
    expect(terminal).toContain("PILOT: NO-GO");
    expect(addedLog).not.toMatch(/network (?:create|connect|disconnect|rm) catering_(?:private|ingress)/);
    expect(fieldsAt(markerPath).get("state")).toBe("candidate");
    expect(textAt(statePath)).toBe(beforeState);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(true);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(true);
  }, 120_000);

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

  test.each(["crash-after-candidate", "crash-after-active"])("RED: legacy %s manifest is rejected before rollback", (scenario) => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-legacy-rollback-red-"));
    const crashed = runHarness(scenario, root);
    expect(crashed.result.status).not.toBe(0);
    convertManifestToLegacy(root);

    const rolledBack = runExistingRollback(root, crashed.sandbox);
    const terminal = `${rolledBack.result.stdout}${rolledBack.result.stderr}`;
    expect(rolledBack.result.status).not.toBe(0);
    expect(terminal).toContain("PILOT: NO-GO");
    expect(fieldsAt(path.join(root, "phase3.activation")).get("state")).toBe(scenario === "crash-after-active" ? "active" : "candidate");
    expect(existsSync(path.join(root, "phase3.transaction-baseline.manifest"))).toBe(true);
  }, 120_000);

  test("RED: legacy rolling_back manifest is rejected before rollback finalization", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-legacy-rolling-back-red-"));
    const crashed = runHarness("crash-after-receipt", root);
    expect(crashed.result.status).not.toBe(0);
    expect(fieldsAt(path.join(root, "phase3.activation")).get("state")).toBe("rolling_back");
    convertManifestToLegacy(root);

    const resumed = runExistingResume(root, crashed.sandbox);
    const terminal = `${resumed.result.stdout}${resumed.result.stderr}`;
    expect(resumed.result.status).not.toBe(0);
    expect(terminal).toContain("PILOT: NO-GO");
    expect(fieldsAt(path.join(root, "phase3.activation")).get("state")).toBe("rolling_back");
    expect(existsSync(path.join(root, "phase3.transaction-baseline.manifest"))).toBe(true);
    expect(existsSync(path.join(root, "phase3.rollback-completion.receipt"))).toBe(true);
  }, 120_000);

  test("RED: legacy rolling_back crash before evidence remains fail-closed", () => {
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
    expect(resumed.result.status).not.toBe(0);
    expect(terminal).toContain("PILOT: NO-GO");
    expect(terminal).not.toContain("PILOT: ROLLED BACK");
    expect(addedLog).not.toMatch(/network (?:create|connect|disconnect|rm)/);
    expect(fieldsAt(path.join(root, "phase3.activation")).get("state")).toBe("rolling_back");
    expect(existsSync(path.join(root, "phase3.transaction-baseline.manifest"))).toBe(true);
    expect(existsSync(path.join(root, "phase3.rollback-restore-proof.archive"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.restore-evidence.record"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.rollback-completion.receipt"))).toBe(false);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(true);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(true);
  }, 120_000);

  test("RED: legacy rolling_back resumes after private network removal", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-legacy-rolling-back-private-remove-red-"));
    const crashed = runHarness("crash-after-rollback", root);
    expect(crashed.result.status).not.toBe(0);
    const markerPath = path.join(root, "phase3.activation");
    const statePath = path.join(root, "fake-docker-state.json");
    expect(fieldsAt(markerPath).get("state")).toBe("rolling_back");
    const beforeNetworkRemoval = textAt(path.join(root, "fake-docker.log"));
    removeFakeNetwork(root, "catering_private", [
      "platform-infra-postgres-1",
      "platform-infra-intake-1",
      "platform-infra-offer-1",
      "platform-infra-production-1",
      "platform-infra-exports-1",
      "platform-infra-web-1",
    ]);
    const removalLog = textAt(path.join(root, "fake-docker.log")).slice(beforeNetworkRemoval.length);
    expect(removalLog).toContain("docker network rm catering_private");
    expect(removalLog).not.toContain("docker network rm catering_ingress");
    const state = JSON.parse(textAt(statePath)) as { networks: Record<string, unknown> };
    expect(state.networks.catering_private).toBeUndefined();
    expect(state.networks.catering_ingress).toBeDefined();
    convertManifestToLegacy(root);

    const resumed = runExistingResume(root, crashed.sandbox);
    const terminal = `${resumed.result.stdout}${resumed.result.stderr}`;
    expect(resumed.result.status).not.toBe(0);
    expect(terminal).toContain("PILOT: NO-GO");
    expect(terminal).not.toContain("PILOT: ROLLED BACK");
    expect(existsSync(markerPath)).toBe(true);
    expect(fieldsAt(markerPath).get("state")).toBe("rolling_back");
    expect(existsSync(path.join(root, "phase3.transaction-baseline.manifest"))).toBe(true);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(true);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(true);
  }, 120_000);

  test("legacy rolling_back rejects ingress absence while private remains", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-legacy-rolling-back-out-of-order-red-"));
    const crashed = runHarness("crash-after-rollback", root);
    expect(crashed.result.status).not.toBe(0);
    removeFakeNetwork(root, "catering_ingress", ["platform-infra-web-1", "shared-edge-edge-1"]);
    convertManifestToLegacy(root);

    const beforeLog = textAt(path.join(root, "fake-docker.log"));
    const resumed = runExistingResume(root, crashed.sandbox);
    const terminal = `${resumed.result.stdout}${resumed.result.stderr}`;
    const addedLog = textAt(path.join(root, "fake-docker.log")).slice(beforeLog.length);
    expect(resumed.result.status).not.toBe(0);
    expect(terminal).toContain("PILOT: NO-GO");
    expect(terminal).not.toContain("PILOT: GO\n");
    expect(addedLog).not.toMatch(/network (?:create|connect|disconnect|rm) catering_(?:private|ingress)/);
    expect(fieldsAt(path.join(root, "phase3.activation")).get("state")).toBe("rolling_back");
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(true);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(true);
  }, 120_000);

  test("legacy rolling_back rejects a foreign same-name network replacement", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-legacy-rolling-back-foreign-network-red-"));
    const crashed = runHarness("crash-after-rollback", root);
    expect(crashed.result.status).not.toBe(0);
    const statePath = path.join(root, "fake-docker-state.json");
    const state = JSON.parse(textAt(statePath)) as {
      networks: Record<string, { id: string; labels: Record<string, string> }>;
    };
    state.networks.catering_private.id = "f".repeat(64);
    state.networks.catering_private.labels = {
      "com.catering.owner": "foreign-owner",
      "com.catering.phase": "phase3.1",
      "com.catering.kind": "private",
      "com.catering.transaction": "foreign-run",
    };
    writeFileSync(statePath, JSON.stringify(state));
    convertManifestToLegacy(root);

    const beforeLog = textAt(path.join(root, "fake-docker.log"));
    const resumed = runExistingResume(root, crashed.sandbox);
    const terminal = `${resumed.result.stdout}${resumed.result.stderr}`;
    const addedLog = textAt(path.join(root, "fake-docker.log")).slice(beforeLog.length);
    expect(resumed.result.status).not.toBe(0);
    expect(terminal).toContain("PILOT: NO-GO");
    expect(terminal).not.toContain("PILOT: GO\n");
    expect(addedLog).not.toMatch(/network (?:create|connect|disconnect|rm) catering_(?:private|ingress)/);
    expect(fieldsAt(path.join(root, "phase3.activation")).get("state")).toBe("rolling_back");
  }, 120_000);

  test("legacy rolling_back rejects an expected network ID under another name", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-legacy-rolling-back-network-id-name-red-"));
    const crashed = runHarness("crash-after-rollback", root);
    expect(crashed.result.status).not.toBe(0);
    const statePath = path.join(root, "fake-docker-state.json");
    const state = JSON.parse(textAt(statePath)) as { networks: Record<string, unknown> };
    const privateNetwork = state.networks.catering_private;
    delete state.networks.catering_private;
    state.networks["renamed-private"] = privateNetwork;
    writeFileSync(statePath, JSON.stringify(state));
    convertManifestToLegacy(root);

    const beforeLog = textAt(path.join(root, "fake-docker.log"));
    const resumed = runExistingResume(root, crashed.sandbox);
    const terminal = `${resumed.result.stdout}${resumed.result.stderr}`;
    const addedLog = textAt(path.join(root, "fake-docker.log")).slice(beforeLog.length);
    expect(resumed.result.status).not.toBe(0);
    expect(terminal).toContain("PILOT: NO-GO");
    expect(terminal).not.toContain("PILOT: GO\n");
    expect(addedLog).not.toMatch(/network (?:create|connect|disconnect|rm) catering_(?:private|ingress)/);
    expect(fieldsAt(path.join(root, "phase3.activation")).get("state")).toBe("rolling_back");
  }, 120_000);

  test("legacy rolling_back rejects a valid marker ID drift from the adoption journal", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-legacy-rolling-back-id-drift-red-"));
    const crashed = runHarness("crash-after-rollback", root);
    expect(crashed.result.status).not.toBe(0);
    expect(fieldsAt(path.join(root, "phase3.activation")).get("state")).toBe("rolling_back");
    removeFakeNetwork(root, "catering_private", [
      "platform-infra-postgres-1",
      "platform-infra-intake-1",
      "platform-infra-offer-1",
      "platform-infra-production-1",
      "platform-infra-exports-1",
      "platform-infra-web-1",
    ]);
    convertManifestToLegacy(root);
    const journalPath = path.join(root, "phase3.network-adoption.journal");
    const journalBefore = textAt(journalPath);
    const markerPath = path.join(root, "phase3.activation");
    rewriteFields(markerPath, { catering_private_id: "a".repeat(64) });
    rewriteFields(markerPath, { marker_sha256: "absent" });
    rewriteFields(markerPath, { marker_sha256: canonicalSelfHash(markerPath, "marker_sha256") });

    const beforeLog = textAt(path.join(root, "fake-docker.log"));
    const resumed = runExistingResume(root, crashed.sandbox);
    const terminal = `${resumed.result.stdout}${resumed.result.stderr}`;
    const addedLog = textAt(path.join(root, "fake-docker.log")).slice(beforeLog.length);
    expect(resumed.result.status).not.toBe(0);
    expect(terminal).toContain("PILOT: NO-GO");
    expect(terminal).not.toContain("PILOT: GO\n");
    expect(addedLog).not.toMatch(/network (?:create|connect|disconnect|rm) catering_(?:private|ingress)/);
    expect(fieldsAt(markerPath).get("state")).toBe("rolling_back");
    expect(textAt(journalPath)).toBe(journalBefore);
    expect(existsSync(path.join(root, "phase3.transaction-baseline.manifest"))).toBe(true);
    expect(existsSync(path.join(root, "phase3.restore-evidence.record"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.rollback-restore-proof.archive"))).toBe(false);
    expect(existsSync(path.join(root, "phase3.rollback-completion.receipt"))).toBe(false);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(true);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(true);
  }, 120_000);

  test.each([
    ["crash-after-evidence", "evidence-only"],
    ["crash-after-archive", "evidence-and-archive"],
  ])("RED: legacy rolling_back %s proof prefix resumes idempotently", (scenario, prefix) => {
    const root = mkdtempSync(path.join(tmpdir(), `catering-phase3-legacy-rolling-back-${prefix}-red-`));
    const crashed = runHarness(scenario, root);
    expect(crashed.result.status).not.toBe(0);
    expect(fieldsAt(path.join(root, "phase3.activation")).get("state")).toBe("rolling_back");
    convertManifestToLegacy(root);

    const evidence = path.join(root, "phase3.restore-evidence.record");
    const archive = path.join(root, "phase3.rollback-restore-proof.archive");
    const receipt = path.join(root, "phase3.rollback-completion.receipt");
    expect(existsSync(evidence)).toBe(true);
    expect(existsSync(archive)).toBe(prefix === "evidence-and-archive");
    expect(existsSync(receipt)).toBe(false);

    const beforeLog = textAt(path.join(root, "fake-docker.log"));
    const resumed = runExistingResume(root, crashed.sandbox);
    const terminal = `${resumed.result.stdout}${resumed.result.stderr}`;
    const addedLog = textAt(path.join(root, "fake-docker.log")).slice(beforeLog.length);
    expect(resumed.result.status).not.toBe(0);
    expect(terminal).toContain("PILOT: NO-GO");
    expect(terminal).not.toContain("PILOT: ROLLED BACK");
    expect(addedLog).not.toMatch(/network (?:create|connect|disconnect|rm)/);
    expect(fieldsAt(path.join(root, "phase3.activation")).get("state")).toBe("rolling_back");
    expect(existsSync(path.join(root, "phase3.transaction-baseline.manifest"))).toBe(true);
    expect(existsSync(receipt)).toBe(false);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(true);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(true);
  }, 120_000);

  test("RED: legacy rolling_back inconsistent partial evidence remains fail-closed", () => {
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

  test("RED: legacy candidate with prepared adoption intent explicitly rolls back before either network exists", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-legacy-candidate-prepared-intent-red-"));
    const crashed = runHarness("crash-after-candidate", root, {
      CATERING_PHASE3_FAKE_PRE_NETWORK_CRASH: "1",
    });
    expect(crashed.result.status).not.toBe(0);
    const markerPath = path.join(root, "phase3.activation");
    const manifestPath = path.join(root, "phase3.transaction-baseline.manifest");
    const journalPath = path.join(root, "phase3.network-adoption.journal");
    expect(fieldsAt(markerPath).get("state")).toBe("candidate");
    expect(fieldsAt(markerPath).get("catering_ingress_id")).toBe("absent");
    expect(fieldsAt(markerPath).get("catering_private_id")).toBe("absent");
    expect(fieldsAt(journalPath).get("adoption_phase")).toBe("prepared");
    expect(fieldsAt(journalPath).get("adoption_count")).toBe("0");
    expect(fieldsAt(journalPath).get("catering_ingress_id")).toBe("absent");
    expect(fieldsAt(journalPath).get("catering_private_id")).toBe("absent");
    expect(JSON.parse(textAt(path.join(root, "fake-docker-state.json"))).networks.catering_ingress).toBeUndefined();
    expect(JSON.parse(textAt(path.join(root, "fake-docker-state.json"))).networks.catering_private).toBeUndefined();
    convertManifestToLegacy(root);

    const resumed = runExistingResume(root, crashed.sandbox);
    expect(resumed.result.status).not.toBe(0);
    expect(`${resumed.result.stdout}${resumed.result.stderr}`).not.toContain("PILOT: GO");
    expect(fieldsAt(markerPath).get("state")).toBe("candidate");

    const rolledBack = runExistingRollback(root, crashed.sandbox);
    const terminal = `${rolledBack.result.stdout}${rolledBack.result.stderr}`;
    expect(rolledBack.result.status).not.toBe(0);
    expect(terminal).toContain("PILOT: NO-GO");
    expect(terminal).not.toContain("PILOT: GO");
    expect(fieldsAt(markerPath).get("state")).toBe("candidate");
    expect(existsSync(manifestPath)).toBe(true);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(true);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(true);
  }, 120_000);

  test("RED: legacy candidate with durable ingress adoption explicitly rolls back the exact live ingress", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-legacy-candidate-ingress-adopted-red-"));
    const crashed = runHarness("crash-after-ingress", root);
    expect(crashed.result.status).not.toBe(0);
    const markerPath = path.join(root, "phase3.activation");
    const manifestPath = path.join(root, "phase3.transaction-baseline.manifest");
    const journalPath = path.join(root, "phase3.network-adoption.journal");
    const statePath = path.join(root, "fake-docker-state.json");
    const state = JSON.parse(textAt(statePath)) as {
      networks: Record<string, { id: string; labels: Record<string, string>; containers: Record<string, unknown> }>;
    };
    const ingress = state.networks.catering_ingress;
    expect(fieldsAt(markerPath).get("state")).toBe("candidate");
    expect(fieldsAt(markerPath).get("catering_ingress_id")).toBe("absent");
    expect(fieldsAt(markerPath).get("catering_private_id")).toBe("absent");
    expect(fieldsAt(journalPath).get("adoption_order")).toBe("catering_ingress");
    expect(fieldsAt(journalPath).get("adoption_count")).toBe("1");
    expect(fieldsAt(journalPath).get("adoption_phase")).toBe("created");
    expect(fieldsAt(journalPath).get("catering_ingress_id")).toBe(ingress.id);
    expect(fieldsAt(journalPath).get("catering_private_id")).toBe("absent");
    expect(ingress.labels["com.catering.owner"]).toBe("catering-agents-platform");
    expect(ingress.labels["com.catering.phase"]).toBe("phase3.1");
    expect(ingress.labels["com.catering.kind"]).toBe("ingress");
    expect(ingress.labels["com.catering.transaction"]).toBe("phase3-harness");
    expect(Object.keys(ingress.containers)).toHaveLength(0);
    expect(state.networks.catering_private).toBeUndefined();
    convertManifestToLegacy(root);

    const resumed = runExistingResume(root, crashed.sandbox);
    expect(resumed.result.status).not.toBe(0);
    expect(`${resumed.result.stdout}${resumed.result.stderr}`).not.toContain("PILOT: GO");
    expect(fieldsAt(markerPath).get("state")).toBe("candidate");

    const ingressId = fieldsAt(journalPath).get("catering_ingress_id");
    expect(ingressId).toMatch(/^[0-9a-f]{64}$/);
    expect(fieldsAt(journalPath).get("transaction_manifest_path")).toBe(manifestPath);
    expect(fieldsAt(journalPath).get("transaction_manifest_sha256")).toBe(digestFile(manifestPath));
    const faultState = JSON.parse(textAt(statePath)) as { fault: string; fault_triggered: boolean };
    faultState.fault = "crash-after-rollback";
    faultState.fault_triggered = false;
    writeFileSync(statePath, JSON.stringify(faultState));

    const beforeRollbackState = textAt(statePath);
    const beforeRollbackLog = textAt(path.join(root, "fake-docker.log"));
    const rejectedRollback = runExistingRollback(root, crashed.sandbox);
    const rejectedOutput = `${rejectedRollback.result.stdout}${rejectedRollback.result.stderr}`;
    const rejectedAddedLog = textAt(path.join(root, "fake-docker.log")).slice(beforeRollbackLog.length);
    expect(rejectedRollback.result.status).not.toBe(0);
    expect(rejectedOutput).toContain("PILOT: NO-GO");
    expect(rejectedAddedLog).not.toMatch(/network (?:create|connect|disconnect|rm)/);
    expect(textAt(statePath)).toBe(beforeRollbackState);
    expect(fieldsAt(markerPath).get("state")).toBe("candidate");
    expect(existsSync(manifestPath)).toBe(true);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(true);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(true);
  }, 120_000);

  test.each([
    ["foreign owner", (root: string) => {
      const statePath = path.join(root, "fake-docker-state.json");
      const state = JSON.parse(textAt(statePath)) as {
        networks: Record<string, { labels: Record<string, string> }>;
      };
      state.networks.catering_ingress.labels["com.catering.owner"] = "foreign-owner";
      writeFileSync(statePath, JSON.stringify(state));
    }],
    ["foreign run", (root: string) => {
      const statePath = path.join(root, "fake-docker-state.json");
      const state = JSON.parse(textAt(statePath)) as {
        networks: Record<string, { labels: Record<string, string> }>;
      };
      state.networks.catering_ingress.labels["com.catering.transaction"] = "phase3-foreign-run";
      writeFileSync(statePath, JSON.stringify(state));
    }],
    ["divergent manifest path", (root: string) => {
      const journalPath = path.join(root, "phase3.network-adoption.journal");
      rewriteFields(journalPath, {
        transaction_manifest_path: path.join(root, "foreign-baseline.manifest"),
        journal_sha256: "absent",
      });
      rewriteFields(journalPath, { journal_sha256: canonicalSelfHash(journalPath, "journal_sha256") });
    }],
    ["divergent manifest hash", (root: string) => {
      const markerPath = path.join(root, "phase3.activation");
      rewriteFields(markerPath, {
        transaction_manifest_sha256: "0".repeat(64),
        marker_sha256: "absent",
      });
      rewriteFields(markerPath, { marker_sha256: canonicalSelfHash(markerPath, "marker_sha256") });
    }],
    ["incomplete network provenance", (root: string) => {
      const statePath = path.join(root, "fake-docker-state.json");
      const state = JSON.parse(textAt(statePath)) as {
        networks: Record<string, { labels: Record<string, string> }>;
      };
      delete state.networks.catering_ingress.labels["com.catering.kind"];
      writeFileSync(statePath, JSON.stringify(state));
    }],
  ])("phase3.1 candidate rejects %s before any network mutation", (_name, mutate) => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-phase3-legacy-candidate-negative-red-"));
    const crashed = runHarness("crash-after-ingress", root);
    expect(crashed.result.status).not.toBe(0);
    convertManifestToLegacy(root);
    mutate(root);

    const markerPath = path.join(root, "phase3.activation");
    const statePath = path.join(root, "fake-docker-state.json");
    const logPath = path.join(root, "fake-docker.log");
    const beforeRollbackLog = textAt(logPath);
    const beforeState = textAt(statePath);
    const rolledBack = runExistingRollback(root, crashed.sandbox);
    const terminal = `${rolledBack.result.stdout}${rolledBack.result.stderr}`;
    const addedLog = textAt(logPath).slice(beforeRollbackLog.length);
    expect(rolledBack.result.status).not.toBe(0);
    expect(terminal).toContain("PILOT: NO-GO");
    expect(terminal).not.toContain("PILOT: ROLLED BACK");
    expect(addedLog).not.toMatch(/network (?:create|connect|disconnect|rm) catering_(?:private|ingress)/);
    expect(fieldsAt(markerPath).get("state")).toBe("candidate");
    expect(textAt(statePath)).toBe(beforeState);
    expect(existsSync(path.join(root, "phase3.transaction-baseline.manifest"))).toBe(true);
    expect(existsSync(path.join(root, "phase3.network-adoption.journal"))).toBe(true);
    expect(existsSync(path.join(root, "locks/catering-agents-platform.deploy-lock"))).toBe(true);
    expect(existsSync(path.join(root, "locks/shared-edge.deploy-lock"))).toBe(true);
  }, 120_000);

});
