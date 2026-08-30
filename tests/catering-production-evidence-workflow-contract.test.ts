import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { describe, expect, test } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");
const workflowRelativePath = ".github/workflows/catering-production-evidence.yml";
const helperRelativePath = "platform-infra/scripts/catering-production-evidence.sh";
const workflowPath = path.join(repoRoot, workflowRelativePath);
const helperPath = path.join(repoRoot, helperRelativePath);

function source(relativePath: string): string {
  const filePath = path.join(repoRoot, relativePath);
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}

function executableLines(value: string): string {
  return value
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .map((line) => line.replace(/#.*/, ""))
    .join("\n");
}

function extractFunction(value: string, name: string): string {
  const match = value.match(new RegExp(`${name}\\(\\) \\{[\\s\\S]*?\\n\\}`));
  if (!match) throw new Error(`Missing helper function ${name}`);
  return match[0];
}

function runFixture(functionSource: string, environment: Record<string, string>): ReturnType<typeof spawnSync> {
  return spawnSync("bash", ["-c", `set -euo pipefail\n${functionSource}\nclassify_backup_evidence`], {
    encoding: "utf8",
    env: { ...process.env, ...environment },
  });
}

type EvidenceFixtureOptions = {
  dataRootStatus?: "matched" | "absent";
  includeBackupEvidenceProbe?: boolean;
};

function encodedRecord(recordType: string, recordKey: string, value: string): string {
  return `${recordType}\t${recordKey}\t${Buffer.from(value, "utf8").toString("base64")}`;
}

function syntheticRemoteEvidence(options: EvidenceFixtureOptions = {}): string {
  const dataRootStatus = options.dataRootStatus ?? "matched";
  const includeBackupEvidenceProbe = options.includeBackupEvidenceProbe ?? true;
  const commandFacts = [
    "command_docker",
    "command_systemctl",
    "command_findmnt",
    "command_mount",
    "command_ss",
    "command_stat",
    "command_realpath",
    "command_readlink",
    "command_find",
    "command_sha256sum",
    "command_hostname",
    "command_date",
    "command_base64",
    "command_tr",
    "command_restic",
  ].map((key) => ["FACT", key, "available"] as const);
  const facts = [
    ...commandFacts,
    ["FACT", "postgres_seen", "true"],
    ["FACT", "persistence_container_count", "1"],
    ["FACT", "platform_expected_volume_count", "3"],
    ["FACT", "data_root_status", dataRootStatus],
    ["FACT", "edge_volume_count", "1"],
    ["FACT", "backup_timer_active", "true"],
    ["FACT", "backup_success", "true"],
    ["FACT", "backup_scope_ok", "true"],
    ["FACT", "backup_host_bound", "true"],
    ["FACT", "backup_host_binding", "true"],
    ["FACT", "backup_artifact_bound", "true"],
    ["FACT", "backup_repository_bound", "true"],
    ["FACT", "backup_timestamp", "2026-08-30T00:00:00Z"],
    ["FACT", "backup_age_seconds", "3600"],
    ["FACT", "secret_source", "github-production-environment"],
    ["FACT", "data_root_source", "docker-targeted-variable"],
  ] as const;
  const probes = [
    ["containers", "success"],
    ["platform_volumes", "success"],
    ["edge_volumes", "success"],
    ["network_list", "success"],
    ["timers", "success"],
    ["services", "success"],
    ["backup_artifact", "success"],
    ["backup_repository", "success"],
    ["backup_clock", "success"],
    ["host_identity", "success"],
    ["command_restic", "success"],
  ];
  const networkNames = [
    "platform-infra_default",
    "zeiterfassung_default",
    "catering_ingress",
    "catering_private",
    "deploy_default",
    "commcats-eventos_default",
  ];
  const records = [
    ...facts,
    ...probes.map(([key, value]) => ["PROBE_STATUS", key, value] as const),
    ...networkNames.map((name) => ["PROBE_STATUS", `network:${name}`, "absent"] as const),
  ];
  if (includeBackupEvidenceProbe) {
    records.push(["PROBE_STATUS", "backup_evidence", "success"]);
  }
  return records.map(([type, key, value]) => encodedRecord(type, key, value)).join("\n");
}

type FakeSshOptions = {
  exitCode?: number;
  stderr?: string;
};

function runHelperWithSshFixture(
  remoteEvidence: string,
  options: FakeSshOptions = {},
): ReturnType<typeof spawnSync> {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), "catering-production-evidence-"));
  const sshPath = path.join(fixtureRoot, "ssh");
  const fakeSsh = [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    "cat <<'REMOTE_FIXTURE'",
    remoteEvidence,
    "REMOTE_FIXTURE",
    ...(options.stderr ? [`printf '%s\\n' ${JSON.stringify(options.stderr)} >&2`] : []),
    `exit ${options.exitCode ?? 0}`,
    "",
  ].join("\n");
  writeFileSync(sshPath, fakeSsh, { mode: 0o755 });
  try {
    return spawnSync(process.env.CATERING_EVIDENCE_TEST_BASH ?? "bash", [helperPath], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${fixtureRoot}:${process.env.PATH ?? ""}`,
        CATERING_EVIDENCE_SSH_KEY: "fixture-key",
        CATERING_EVIDENCE_SSH_KNOWN_HOSTS: "fixture-known-hosts",
        HETZNER_DEPLOY_HOST: "fixture.invalid",
        HETZNER_DEPLOY_USER: "fixture-user",
      },
    });
  } finally {
    spawnSync("/usr/bin/trash", [fixtureRoot], { stdio: "ignore" });
  }
}

function runHelperWithSyntheticRemote(remoteEvidence: string): ReturnType<typeof spawnSync> {
  return runHelperWithSshFixture(remoteEvidence);
}

function runRemoteBackupSuccessFragment(): ReturnType<typeof spawnSync> {
  const helper = source(helperRelativePath);
  const remoteScript = helper.split("<<'REMOTE_EVIDENCE'\n")[1]?.split("\nREMOTE_EVIDENCE")[0] ?? "";
  const blockStart = remoteScript.indexOf('if [[ "$backup_repository_bound" == true ]]; then');
  const blockEnd = remoteScript.indexOf("\n    fi\n  fi\nelse", blockStart);
  expect(blockStart).toBeGreaterThanOrEqual(0);
  expect(blockEnd).toBeGreaterThan(blockStart);
  const block = remoteScript.slice(blockStart, blockEnd + "\n    fi".length);
  return spawnSync("bash", ["-c", `set -euo pipefail
backup_repository_bound=true
backup_timestamp=2026-08-30T00:00:00Z
backup_success=false
backup_scope_ok=false
backup_host_bound=false
backup_artifact_bound=false
backup_repository_bound=true
backup_snapshot=fixture-snapshot
backup_checksum=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
emit() { printf '%s\\t%s\\t%s\\n' "$1" "$2" "$3"; }
probe_error() { return 1; }
date() { printf '1000'; }
${block}`], {
    encoding: "utf8",
    env: process.env,
  });
}

describe("Catering production evidence workflow contract", () => {
  test("requires a dedicated workflow and read-only helper", () => {
    expect(existsSync(workflowPath)).toBe(true);
    expect(existsSync(helperPath)).toBe(true);
  });

  test("workflow is main-only, production-protected, and exact-checkout", () => {
    const workflow = source(workflowRelativePath);
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toMatch(/^\s*(?:push|pull_request):/m);
    expect(workflow).toContain("if: github.ref == 'refs/heads/main'");
    expect(workflow).toContain("permissions:\n  contents: read");
    expect(workflow).toContain("environment: production");
    expect(workflow).toContain("ref: ${{ github.sha }}");
    expect(workflow).toContain("persist-credentials: false");
    expect(workflow).toContain("cancel-in-progress: false");
    expect(workflow).toContain("catering-production-evidence");
    expect(workflow).toContain("timeout-minutes:");
  });

  test("workflow reuses only the established SSH secret names and cleans runner files", () => {
    const workflow = source(workflowRelativePath);
    for (const secretName of [
      "HETZNER_SSH_PRIVATE_KEY",
      "HETZNER_SSH_KNOWN_HOSTS",
      "HETZNER_DEPLOY_HOST",
      "HETZNER_DEPLOY_USER",
    ]) {
      expect(workflow).toContain(`secrets.${secretName}`);
    }
    expect(workflow).toContain("RUNNER_TEMP");
    expect(workflow).toMatch(/(?:trap[\s\S]{0,500}(?:rm -f|rmdir)|(?:rm -f|rmdir)[\s\S]{0,500}trap)/);
    expect(workflow).toContain("IdentitiesOnly=yes");
    expect(workflow).toContain("BatchMode=yes");
    expect(workflow).toContain("StrictHostKeyChecking=yes");
    expect(workflow).toContain("UserKnownHostsFile");
    expect(workflow).toContain("ConnectTimeout=10");
    expect(workflow).toMatch(/-p 22/);
    expect(workflow).not.toMatch(/set -x/);
    expect(workflow).toMatch(/printf '%s\\n' \"\$HETZNER_SSH_PRIVATE_KEY\" >\"\$ssh_key\"/);
    expect(workflow).toMatch(/printf '%s\\n' \"\$HETZNER_SSH_KNOWN_HOSTS\" >\"\$known_hosts\"/);
  });

  test("workflow cannot dispatch the pilot or any mutating deployment path", () => {
    const workflow = source(workflowRelativePath);
    expect(workflow).toContain("catering-production-evidence.sh");
    expect(workflow).not.toMatch(/catering-phase3-pilot\.sh|catering-phase3-isolation-pilot\.yml/);
    expect(workflow).not.toMatch(/docker (?:run|exec|cp|create|start|stop|restart|rm|prune)/);
    expect(workflow).not.toMatch(/(?:compose|systemctl|restic)\s+(?:up|down|run|exec|start|stop|restart|backup|restore|prune|forget)/);
  });

  test("helper uses only the declared read-only Docker/Systemd operations", () => {
    const helper = executableLines(source(helperRelativePath));
    expect(helper).toContain("docker ps");
    expect(helper).toContain("docker inspect");
    expect(helper).toContain("docker network inspect");
    expect(helper).toContain("docker volume inspect");
    expect(helper).toContain("systemctl show");
    expect(helper).toContain("systemctl list-timers");
    expect(helper).toContain("findmnt");
    expect(helper).toContain("stat");
    expect(helper).toContain("realpath");
    expect(helper).toContain("readlink");
    expect(helper).toContain("command -v");
    expect(helper).not.toMatch(/\bdocker\s+(?:run|exec|cp|create|start|stop|restart|rm|prune)\b/);
    expect(helper).not.toMatch(/\bdocker\s+network\s+(?:connect|disconnect|create|rm|prune)\b/);
    expect(helper).not.toMatch(/\bdocker\s+volume\s+(?:create|rm|prune)\b/);
    expect(helper).not.toMatch(/\bdocker\s+compose\s+(?:up|down|run|exec|start|stop|restart|rm)\b/);
    expect(helper).not.toMatch(/\bsystemctl\s+(?:start|stop|restart|enable|disable|mask|unmask|reset-failed)\b/);
    expect(helper).not.toMatch(/\brestic\s+(?:backup|restore|forget|prune|check|init)\b/);
    expect(helper).not.toMatch(/\b(?:journalctl|printenv)\b|\/proc\/[^\s]+\/environ/);
  });

  test("helper never writes remote files or uses a remote file-mutating primitive", () => {
    const helper = executableLines(source(helperRelativePath));
    expect(helper).not.toMatch(/\b(?:mkdir|mktemp|install|tee|cp|mv|rm|unlink|chmod|chown|touch)\b/);
    expect(helper).not.toMatch(/(^|[;&|[:space:]])(?:[0-9]+)?>>?\s*(?!\/dev\/null)[^=]/m);
    expect(helper).not.toMatch(/\bsudo\b/);
  });

  test("helper reads only the single requested data-root variable", () => {
    const helper = source(helperRelativePath);
    expect(helper).toContain("CATERING_DATA_ROOT");
    expect(helper).toContain("MOUNT");
    expect(helper).toContain("Destination");
    expect(helper).not.toMatch(/\{\{\s*json\s+\.Config\.Env/);
    expect(helper).not.toMatch(/\{\{\s*range\s+\.Config\.Env\s*\}\}\s*\{\{\s*println\s+\.\s*\}\}/);
    expect(helper).not.toMatch(/(?:cat|sed|awk|grep)\s+[^\n]*(?:\.env|environment|Config\.Env)/i);
  });

  test("backup status requires explicit success, scope, and host binding; timer activity alone is insufficient", () => {
    const helper = source(helperRelativePath);
    expect(helper).toContain("BACKUP_EVIDENCE");
    expect(helper).toContain("backup_success");
    expect(helper).toContain("backup_scope");
    expect(helper).toContain("backup_host_binding");
    expect(helper).toContain("NICHT BELEGT");
    const classify = extractFunction(helper, "classify_backup_evidence");
    const timerOnly = runFixture(classify, {
      BACKUP_TIMER_ACTIVE: "true",
      BACKUP_EVIDENCE_SUCCESS: "false",
      BACKUP_SCOPE_OK: "false",
      BACKUP_HOST_BOUND: "false",
    });
    expect(timerOnly.status).toBe(0);
    expect(timerOnly.stdout).toContain("NICHT BELEGT");
    const complete = runFixture(classify, {
      BACKUP_TIMER_ACTIVE: "true",
      BACKUP_EVIDENCE_SUCCESS: "true",
      BACKUP_SCOPE_OK: "true",
      BACKUP_HOST_BOUND: "true",
      BACKUP_ARTIFACT_BOUND: "true",
      BACKUP_REPOSITORY_BOUND: "true",
    });
    expect(complete.status).toBe(0);
    expect(complete.stdout).toContain("BELEGT");
  });

  test("helper emits only redacted classifications and safe identity fields", () => {
    const helper = source(helperRelativePath);
    for (const area of ["persistence", "data_root", "backup_channel", "caddy_shared_edge", "config_secrets"]) {
      expect(helper).toContain(`CLASSIFICATION\\t${area}\\t`);
    }
    for (const status of ["BELEGT", "NICHT BELEGT", "BETREIBERENTSCHEIDUNG NÖTIG"]) {
      expect(helper).toContain(status);
    }
    expect(helper).toContain("UTC_AS_OF");
    expect(helper).toContain("SAFE_ID");
    expect(helper).toContain("CHECKSUM");
    expect(helper).not.toMatch(/(?:^|[;&|][[:space:]]*)(?:printf|echo|cat)\b[^\n]*(?:PRIVATE_KEY|PASSWORD|SECRET_VALUE|\.env)/im);
    expect(helper).not.toMatch(/docker inspect[^\n]*(?:\.Config\.Environment|--format '\{\{json)/i);
  });

  test("helper binds persistence and Caddy evidence to allowlisted names without full environment dumps", () => {
    const helper = source(helperRelativePath);
    expect(helper).toContain("platform-infra");
    expect(helper).toContain("postgres");
    expect(helper).toContain("caddy_data");
    expect(helper).toContain("caddy_config");
    expect(helper).toContain("shared-edge");
    expect(helper).toContain("volume inspect");
    expect(helper).not.toContain("docker inspect --format '{{json .Config.Env}}'");
    expect(helper).not.toContain("docker inspect --format '{{json .Config}}'");
  });

  test("unknown or ambiguous evidence remains fail-closed", () => {
    const helper = source(helperRelativePath);
    expect(helper).toContain("BETREIBERENTSCHEIDUNG NÖTIG");
    expect(helper).toMatch(/UNKNOWN|NICHT BELEGT/);
    expect(helper).toMatch(/fail|return 1|exit 1/);
    expect(helper).toContain("EVIDENCE_STATUS");
  });

  test("remote probe failures are explicit and fail closed", () => {
    const helper = source(helperRelativePath);
    const remoteScript = helper.split("<<'REMOTE_EVIDENCE'\n")[1]?.split("\nREMOTE_EVIDENCE")[0] ?? "";
    expect(remoteScript).toContain("PROBE_STATUS");
    expect(remoteScript).toContain("PROBE_ERROR");
    expect(remoteScript).not.toMatch(/\b(?:docker|systemctl|findmnt|mount|ss|stat|realpath|readlink|find|sha256sum|hostname|date)\b[^\n]*\|\|\s*true/);
    expect(helper).toContain("EVIDENCE_STATUS\\tUNKNOWN");
  });

  test("transport failure emits a redacted failure class and remains fail closed", () => {
    const run = runHelperWithSshFixture("", {
      exitCode: 255,
      stderr: "ssh: PRIVATE_KEY=attacker-secret host=production.example denied",
    });

    expect(run.status).not.toBe(0);
    expect(String(run.stdout).trim().split("\n")).toEqual([
      "EVIDENCE_ERROR\tREMOTE_TRANSPORT_FAILED",
      "EVIDENCE_STATUS\tUNKNOWN",
    ]);
    expect(run.stdout).not.toContain("attacker-secret");
    expect(run.stdout).not.toContain("production.example");
    expect(run.stderr).not.toContain("attacker-secret");
    expect(run.stderr).not.toContain("production.example");
  });

  test("successful transport with empty output is classified without evidence", () => {
    const run = runHelperWithSshFixture("", { exitCode: 0 });

    expect(run.status).not.toBe(0);
    expect(String(run.stdout).trim().split("\n")).toEqual([
      "EVIDENCE_ERROR\tREMOTE_OUTPUT_EMPTY",
      "EVIDENCE_STATUS\tUNKNOWN",
    ]);
  });

  test("one canonical remote probe error becomes an area-bound failure class", () => {
    const probeError = encodedRecord("PROBE_ERROR", "data_root", "command_failed");
    const run = runHelperWithSshFixture(probeError, { exitCode: 1 });

    expect(run.status).not.toBe(0);
    expect(String(run.stdout).trim().split("\n")).toEqual([
      "EVIDENCE_ERROR\tREMOTE_PROBE_FAILED:data_root",
      "EVIDENCE_STATUS\tUNKNOWN",
    ]);
  });

  test("valid remote prefix followed by terminal probe error remains area-bound and redacted", () => {
    const remoteEvidence = [
      encodedRecord("FACT", "postgres_seen", "true"),
      encodedRecord("PROBE_STATUS", "containers", "success"),
      encodedRecord("PROBE_ERROR", "data_root", "command_failed"),
    ].join("\n");
    const run = runHelperWithSshFixture(remoteEvidence, { exitCode: 1 });

    expect(run.status).not.toBe(0);
    expect(String(run.stdout).trim().split("\n")).toEqual([
      "EVIDENCE_ERROR\tREMOTE_PROBE_FAILED:data_root",
      "EVIDENCE_STATUS\tUNKNOWN",
    ]);
    expect(run.stdout).not.toContain("postgres_seen");
    expect(run.stdout).not.toContain("command_failed");
    expect(run.stderr).toBe("");
  });

  test("malformed, unknown, or multiple probe errors are invalid protocol", () => {
    const invalidCases = [
      { remoteEvidence: "not-a-record", exitCode: 0 },
      { remoteEvidence: encodedRecord("PROBE_ERROR", "unknown", "command_failed"), exitCode: 0 },
      {
        remoteEvidence: [
          encodedRecord("CONTAINER", "safe", "redacted-value"),
          "not-a-record",
        ].join("\n"),
        exitCode: 0,
      },
      {
        remoteEvidence: [
          encodedRecord("PROBE_ERROR", "data_root", "command_failed"),
          encodedRecord("PROBE_ERROR", "backup_channel", "command_failed"),
        ].join("\n"),
        exitCode: 1,
      },
      {
        remoteEvidence: [
          encodedRecord("PROBE_ERROR", "data_root", "command_failed"),
          encodedRecord("FACT", "postgres_seen", "true"),
        ].join("\n"),
        exitCode: 1,
      },
    ];

    for (const { remoteEvidence, exitCode } of invalidCases) {
      const run = runHelperWithSshFixture(remoteEvidence, { exitCode });

      expect(run.status).not.toBe(0);
      expect(String(run.stdout).trim().split("\n")).toEqual([
        "EVIDENCE_ERROR\tREMOTE_OUTPUT_INVALID",
        "EVIDENCE_STATUS\tUNKNOWN",
      ]);
      expect(run.stdout).not.toContain(remoteEvidence);
    }
  });

  test("evidence and pilot share the existing serialization group", () => {
    const workflow = source(workflowRelativePath);
    expect(workflow).toContain("group: catering-phase3-isolation-pilot");
    expect(workflow).not.toContain("group: catering-production-evidence");
    expect(workflow).toContain("cancel-in-progress: false");
  });

  test("backup BELEGT requires a bound read-only artifact, not only formal fields", () => {
    const helper = source(helperRelativePath);
    expect(helper).toContain("BACKUP_ARTIFACT_BOUND");
    const classify = extractFunction(helper, "classify_backup_evidence");
    const unbound = runFixture(classify, {
      BACKUP_EVIDENCE_SUCCESS: "true",
      BACKUP_SCOPE_OK: "true",
      BACKUP_HOST_BOUND: "true",
      BACKUP_ARTIFACT_BOUND: "false",
    });
    expect(unbound.status).toBe(0);
    expect(unbound.stdout).toContain("NICHT BELEGT");
    const bound = runFixture(classify, {
      BACKUP_EVIDENCE_SUCCESS: "true",
      BACKUP_SCOPE_OK: "true",
      BACKUP_HOST_BOUND: "true",
      BACKUP_ARTIFACT_BOUND: "true",
      BACKUP_REPOSITORY_BOUND: "true",
    });
    expect(bound.status).toBe(0);
    expect(bound.stdout).toContain("BELEGT");
  });

  test("canonical record parsing rejects delimiter injection and accepts safe reversible fields", () => {
    const helper = source(helperRelativePath);
    expect(helper).toContain("encode_field");
    const parser = extractFunction(helper, "parse_remote_record");
    const injected = Buffer.from("safe\tinjected", "utf8").toString("base64");
    const rejected = spawnSync("bash", ["-c", "set -euo pipefail\n" + parser + "\nparse_remote_record MOUNT " + JSON.stringify(injected)], {
      encoding: "utf8",
      env: process.env,
    });
    expect(rejected.status).toBe(1);
    const safe = Buffer.from("/var/lib/catering", "utf8").toString("base64");
    const accepted = spawnSync("bash", ["-c", "set -euo pipefail\n" + parser + "\nparse_remote_record MOUNT " + JSON.stringify(safe)], {
      encoding: "utf8",
      env: process.env,
    });
    expect(accepted.status).toBe(0);
    expect(accepted.stdout).toContain("MOUNT\t/var/lib/catering");
  });

  test("backup evidence binds one read-only descriptor and an independent repository query", () => {
    const helper = source(helperRelativePath);
    const remoteScript = helper.split("<<'REMOTE_EVIDENCE'\n")[1]?.split("\nREMOTE_EVIDENCE")[0] ?? "";
    expect(remoteScript).toContain("bind_readonly_source()");
    expect(remoteScript).toContain("/dev/fd/");
    expect(remoteScript).toContain("BACKUP_REPOSITORY_READONLY_STATUS_PATH");
    expect(remoteScript).toContain("restic snapshots --json");
    expect(remoteScript).toContain("restic cat config --json");
    expect(remoteScript).toContain("restic_repository_match");
    expect(remoteScript).toContain("restic_snapshot_match");
    expect(remoteScript).toContain('"$repository_identity" =~ ^[0-9a-f]{64}$');
    expect(remoteScript).toContain("sha256sum");
    expect(remoteScript).toContain('done <&"$evidence_fd"');
    expect(remoteScript).not.toContain('done < "$BACKUP_EVIDENCE_PATH"');
    expect(remoteScript).not.toContain('done < "$BACKUP_REPOSITORY_READONLY_STATUS_PATH"');
    expect(remoteScript).toContain('path_before');
    expect(remoteScript).toContain('BOUND_SOURCE_DEVICE');
    expect(remoteScript).toContain('BOUND_SOURCE_INODE');
  });

  test("canonical set-record identity accepts cardinality and rejects duplicates or conflicts", () => {
    const helper = source(helperRelativePath);
    expect(helper).toContain("record_identity()");
    expect(helper).toContain("register_record()");
    const identity = extractFunction(helper, "record_identity");
    const register = extractFunction(helper, "register_record");
    const records = [
      ["MOUNT", "catering-api", "bind:uploads:/srv/uploads:/app/uploads"],
      ["MOUNT", "catering-api", "bind:config:/srv/config:/app/config"],
      ["VOLUME", "platform", "catering_pg:local:/var/lib/postgresql"],
      ["VOLUME", "platform", "catering_uploads:local:/var/lib/uploads"],
      ["MEMBER", "catering_ingress", `${"a".repeat(64)}:api:api`],
      ["MEMBER", "catering_ingress", `${"b".repeat(64)}:web:web`],
      ["UNIT", "timer", "catering-backup.timer"],
      ["UNIT", "timer", "catering-evidence.timer"],
      ["UNIT_STATE", "catering-backup.service", "ActiveState=active"],
      ["UNIT_STATE", "catering-backup.service", "SubState=running"],
    ] as const;
    const encodedScript = records
      .map(([type, key, value]) => `register_record ${JSON.stringify(type)} ${JSON.stringify(key)} ${JSON.stringify(value)}`)
      .join("\n");
    const run = (body: string) =>
      spawnSync("bash", ["-c", `set -euo pipefail\nseen_set_identities=()\nseen_set_values=()\n${identity}\n${register}\n${body}`], {
        encoding: "utf8",
        env: process.env,
      });
    const accepted = run(encodedScript);
    expect(accepted.status).toBe(0);
    const reordered = run(records
      .slice()
      .reverse()
      .map(([type, key, value]) => `register_record ${JSON.stringify(type)} ${JSON.stringify(key)} ${JSON.stringify(value)}`)
      .join("\n"));
    expect(reordered.status).toBe(0);
    const duplicate = run(`${encodedScript}\nregister_record VOLUME platform catering_pg:local:/var/lib/postgresql`);
    expect(duplicate.status).toBe(1);
    const conflict = run(`${encodedScript}\nregister_record VOLUME platform catering_pg:nfs:/var/lib/postgresql`);
    expect(conflict.status).toBe(1);
    const memberConflict = run(`${encodedScript}\nregister_record MEMBER catering_ingress ${JSON.stringify(`${"a".repeat(64)}:web:api`)}`);
    expect(memberConflict.status).toBe(1);
    const stateConflict = run(`${encodedScript}\nregister_record UNIT_STATE catering-backup.service ActiveState=inactive`);
    expect(stateConflict.status).toBe(1);
  });

  test("RED: fully validated backup evidence reaches the success probe", () => {
    const fragment = runRemoteBackupSuccessFragment();
    const successWasEmitted = fragment.status === 0 && fragment.stdout.includes("PROBE_STATUS\tbackup_evidence\tsuccess");
    const run = runHelperWithSyntheticRemote(syntheticRemoteEvidence({ includeBackupEvidenceProbe: successWasEmitted }));
    expect(fragment.status).toBe(0);
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("EVIDENCE_STATUS\tSAFE_REDACTED");
    expect(run.stdout).not.toContain("EVIDENCE_STATUS\tUNKNOWN");
  });

  test("RED: absent CATERING_DATA_ROOT is an area-level non-evidence result", () => {
    const run = runHelperWithSyntheticRemote(
      syntheticRemoteEvidence({ dataRootStatus: "absent" }),
    );
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("CLASSIFICATION\tdata_root\tNICHT BELEGT");
    expect(run.stdout).not.toContain("EVIDENCE_STATUS\tUNKNOWN");
  });

  test("RED: local parser integrates register_record for legitimate set records", () => {
    const helper = source(helperRelativePath);
    const parser = [
      extractFunction(helper, "parse_remote_record"),
      extractFunction(helper, "record_identity"),
      extractFunction(helper, "register_record"),
    ].join("\n");
    const loopStart = helper.indexOf("while IFS=$'\\t' read -r record_type record_key record_value extra");
    const loopEndMarker = '\ndone <<< "$remote_output"';
    const loopEnd = helper.indexOf(loopEndMarker, loopStart);
    expect(loopStart).toBeGreaterThanOrEqual(0);
    expect(loopEnd).toBeGreaterThan(loopStart);
    const parserLoop = helper.slice(loopStart, loopEnd + loopEndMarker.length);
    const records = [
      ["MOUNT", "catering-api", "bind:uploads:/srv/uploads:/app/uploads"],
      ["MOUNT", "catering-api", "bind:config:/srv/config:/app/config"],
      ["VOLUME", "platform", "catering_pg:local:/var/lib/postgresql"],
      ["VOLUME", "platform", "catering_uploads:local:/var/lib/uploads"],
      ["MEMBER", "catering_ingress", `${"a".repeat(64)}:api:api`],
      ["MEMBER", "catering_ingress", `${"b".repeat(64)}:web:web`],
      ["UNIT", "timer", "catering-backup.timer"],
      ["UNIT", "timer", "catering-evidence.timer"],
      ["UNIT_STATE", "catering-backup.service", "ActiveState=active"],
      ["UNIT_STATE", "catering-backup.service", "SubState=running"],
    ] as const;
    const remoteOutput = records
      .map(([type, key, value]) => `${type}\t${key}\t${Buffer.from(value, "utf8").toString("base64")}`)
      .join("\n");
    const run = (output: string) => spawnSync("bash", ["-c", `set -u\nPERSISTENCE_STATUS=NICHT_BELEGT\nDATA_ROOT_STATUS=NICHT_BELEGT\nCADDY_STATUS=NICHT_BELEGT\nSECRETS_STATUS=BETREIBERENTSCHEIDUNG NÖTIG\nBACKUP_EVIDENCE_SUCCESS=false\nBACKUP_SCOPE_OK=false\nBACKUP_HOST_BOUND=false\nBACKUP_ARTIFACT_BOUND=false\nBACKUP_REPOSITORY_BOUND=false\nambiguous=false\ndeclare -A seen_records=() seen_facts=() seen_probes=()\nseen_set_identities=()\nseen_set_values=()\n${parser}\nremote_output=$(cat <<'RECORDS'\n${output}\nRECORDS\n)\n${parserLoop}\n[[ "$ambiguous" == false ]]`], {
      encoding: "utf8",
      env: process.env,
    });
    const red = run(remoteOutput);
    expect(red.status).toBe(0);
    expect(red.stderr).not.toMatch(/register_record: command not found/);
  });
});
