import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, test } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");

const files = {
  backup: "platform-infra/backup/catering-backup.sh",
  restore: "platform-infra/backup/catering-restore-probe.sh",
  service: "platform-infra/backup/catering-backup.service",
  timer: "platform-infra/backup/catering-backup.timer",
  restoreService: "platform-infra/backup/catering-restore-probe.service",
  env: "platform-infra/backup/catering-backup.env.example",
  runbook: "docs/operations/CATERING_BACKUP_RESTORE.md",
} as const;

function source(relativePath: string): string {
  const absolute = path.join(repoRoot, relativePath);
  return existsSync(absolute) ? readFileSync(absolute, "utf8") : "";
}

function executableLines(value: string): string {
  return value
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .join("\n");
}

function syntax(relativePath: string): ReturnType<typeof spawnSync> {
  return spawnSync("bash", ["-n", path.join(repoRoot, relativePath)], {
    encoding: "utf8",
  });
}

describe("Catering backup and isolated restore repository contract", () => {
  test("contains the complete inert repository slice", () => {
    for (const relativePath of Object.values(files)) {
      expect(existsSync(path.join(repoRoot, relativePath)), relativePath).toBe(true);
    }
  });

  test("both shell entrypoints are syntactically valid and fail-closed", () => {
    for (const relativePath of [files.backup, files.restore]) {
      const value = source(relativePath);
      expect(value).toContain("#!/usr/bin/env bash");
      expect(value).toContain("set -euo pipefail");
      expect(value).toContain("umask 077");
      const result = syntax(relativePath);
      expect(result.status, result.stderr).toBe(0);
    }
  });

  test("backup binds the fixed six-hour RPO, scope, host and source identity", () => {
    const backup = source(files.backup);
    expect(backup).toContain('readonly RPO_SECONDS="21600"');
    expect(backup).toContain('readonly BACKUP_SCOPE="postgres,data,sites,shared-edge"');
    expect(backup).toContain("CATERING_BACKUP_EXPECTED_HOST_SHA256");
    expect(backup).toContain("CATERING_BACKUP_SOURCE_COMMIT");
    expect(backup).toContain("CATERING_BACKUP_SOURCE_TREE");
    expect(backup).toContain("hostname");
    expect(backup).toContain("sha256sum");
    expect(backup).toMatch(/\^\[0-9a-f\]\{40\}\$/);
    expect(backup).toMatch(/\^\[0-9a-f\]\{64\}\$/);
  });

  test("backup discovers only the exact production PostgreSQL service and fixed volumes", () => {
    const backup = source(files.backup);
    expect(backup).toContain("com.docker.compose.project=platform-infra");
    expect(backup).toContain("com.docker.compose.service=postgres");
    for (const volume of [
      "platform-infra_caddy_data",
      "platform-infra_caddy_config",
      "shared-edge_edge_caddy_data",
      "shared-edge_edge_caddy_config",
    ]) {
      expect(backup).toContain(volume);
    }
    expect(backup).toContain("/opt/catering-agents-platform/platform-infra/sites");
    expect(backup).toContain("/opt/shared-edge/Caddyfile");
    expect(backup).not.toMatch(/\bdocker\s+compose\b/);
  });

  test("backup uses a custom PostgreSQL dump and closes over every persisted component", () => {
    const backup = source(files.backup);
    expect(backup).toContain("pg_dump");
    expect(backup).toContain("--format=custom");
    expect(backup).toContain("--no-owner");
    expect(backup).toContain("--no-privileges");
    expect(backup).toContain("catering_business_records");
    expect(backup).toContain("catering_source_documents");
    for (const component of [
      "postgres_dump",
      "sites_archive",
      "platform_caddy_data_archive",
      "platform_caddy_config_archive",
      "shared_edge_caddyfile_archive",
      "shared_edge_caddy_data_archive",
      "shared_edge_caddy_config_archive",
    ]) {
      expect(backup).toContain(component);
    }
  });

  test("backup requires protected non-local Restic configuration and verifies remote readback", () => {
    const backup = source(files.backup);
    expect(backup).toContain("CATERING_BACKUP_REPOSITORY_FILE");
    expect(backup).toContain("CATERING_BACKUP_PASSWORD_FILE");
    expect(backup).toContain("assert_root_mode_600");
    expect(backup).toContain("assert_off_host_repository");
    expect(backup).toContain("restic");
    expect(backup).toContain("backup");
    expect(backup).toContain("cat config");
    expect(backup).toContain("dump");
    expect(backup).toContain("repository_identity");
    expect(backup).not.toMatch(/\b(?:echo|printf)\b[^\n]*(?:PASSWORD_FILE|repository_value)/i);
  });

  test("backup publishes only a versioned candidate and never advances final evidence", () => {
    const backup = source(files.backup);
    expect(backup).toContain("/candidates/");
    expect(backup).toContain("catering-backup-candidate");
    expect(backup).toContain("status=candidate");
    expect(backup).not.toContain("catering-backup-evidence");
    expect(backup).not.toContain("catering-backup-repository-status");
    expect(backup).toContain("atomic_replace");
  });

  test("durable publication uses fsync, atomic replacement and parent-directory fsync", () => {
    for (const value of [source(files.backup), source(files.restore)]) {
      expect(value).toContain("os.fsync");
      expect(value).toContain("os.replace");
      expect(value).toContain("os.O_DIRECTORY");
      expect(value).toContain("atomic_replace");
    }
  });

  test("restore is bound to the exact candidate, snapshot, repository, host and checksums", () => {
    const restore = source(files.restore);
    expect(restore).toContain("catering-backup-candidate");
    expect(restore).toContain("candidate_path");
    expect(restore).toContain("snapshot_id");
    expect(restore).toContain("repository_identity");
    expect(restore).toContain("artifact_checksum");
    expect(restore).toContain("host_binding");
    expect(restore).toContain("source_commit");
    expect(restore).toContain("source_tree");
    expect(restore).toContain('readonly BACKUP_SCOPE="postgres,data,sites,shared-edge"');
    expect(restore).toContain('readonly RTO_SECONDS="14400"');
  });

  test("restore retrieves the exact Restic snapshot before any Docker mutation", () => {
    const restore = executableLines(source(files.restore));
    const resticIndex = restore.indexOf('restic_cmd restore "$snapshot_id"');
    const dockerRunIndex = restore.indexOf("docker run");
    expect(resticIndex).toBeGreaterThanOrEqual(0);
    expect(dockerRunIndex).toBeGreaterThan(resticIndex);
    expect(restore).toContain("verify_component");
    expect(restore.indexOf("verify_component")).toBeLessThan(dockerRunIndex);
  });

  test("restore uses one digest-pinned, networkless PostgreSQL probe with no published ports", () => {
    const restore = executableLines(source(files.restore));
    expect(restore).toContain("CATERING_RESTORE_POSTGRES_IMAGE");
    expect(restore).toMatch(/@sha256:\[0-9a-f\]\{64\}/);
    expect(restore).toContain("--network none");
    expect(restore).toContain("--pull never");
    expect(restore).toContain("--rm");
    expect(restore).not.toMatch(/--network[ =](?:host|platform-infra_default|catering_|shared-edge|zeiterfassung)/);
    expect(restore).not.toMatch(/(?:^|\s)(?:-p|--publish)(?:\s|=)/m);
    expect(restore).not.toMatch(/\bdocker\s+compose\b/);
    expect(restore).not.toMatch(/\b(?:curl|wget|ssh|scp)\b/);
  });

  test("restore proves both authoritative PostgreSQL tables and the four-hour RTO", () => {
    const restore = source(files.restore);
    expect(restore).toContain("catering_business_records");
    expect(restore).toContain("catering_source_documents");
    expect(restore).toContain("pg_restore");
    expect(restore).toContain("--exit-on-error");
    expect(restore).toContain("duration_seconds");
    expect(restore).toContain("rto_seconds=14400");
    expect(restore).toContain("duration_seconds > RTO_SECONDS");
  });

  test("only a successful restore promotes the existing evidence contract", () => {
    const restore = executableLines(source(files.restore));
    for (const target of [
      "catering-backup-evidence",
      "catering-backup-repository-status",
      "catering-restore-evidence",
    ]) {
      expect(restore).toContain(target);
    }
    const verifyIndex = restore.indexOf("restored_schema=verified");
    const cleanupIndex = restore.indexOf("probe_cleanup=verified");
    const evidenceIndex = restore.indexOf('atomic_replace "$evidence_tmp" "$EVIDENCE_PATH"');
    expect(verifyIndex).toBeGreaterThanOrEqual(0);
    expect(cleanupIndex).toBeGreaterThan(verifyIndex);
    expect(evidenceIndex).toBeGreaterThan(cleanupIndex);
  });

  test("the timer defines the exact six-hour UTC schedule and remains inert in Git", () => {
    const timer = source(files.timer);
    expect(timer).toContain("OnCalendar=*-*-* 00,06,12,18:00:00 UTC");
    expect(timer).toContain("Persistent=true");
    expect(timer).toContain("Unit=catering-backup.service");
    expect(timer).not.toMatch(/RandomizedDelaySec=(?!0\b)/);
  });

  test("the future oneshot cycle runs backup before restore and has a four-hour ceiling", () => {
    const service = source(files.service);
    const backupIndex = service.indexOf("catering-backup.sh");
    const restoreIndex = service.indexOf("catering-restore-probe.sh");
    expect(backupIndex).toBeGreaterThanOrEqual(0);
    expect(restoreIndex).toBeGreaterThan(backupIndex);
    expect(service).toContain("Type=oneshot");
    expect(service).toContain("TimeoutStartSec=4h");
    expect(service).toContain("EnvironmentFile=/etc/catering-backup/catering-backup.env");
    expect(service).toContain("NoNewPrivileges=true");
    expect(service).toContain("ProtectSystem=strict");

    const restoreService = source(files.restoreService);
    expect(restoreService).toContain("catering-restore-probe.sh");
    expect(restoreService).toContain("TimeoutStartSec=4h");
    expect(restoreService).not.toContain("WantedBy=");
  });

  test("the environment schema contains names and placeholders but no usable secrets", () => {
    const env = source(files.env);
    for (const name of [
      "CATERING_BACKUP_EXPECTED_HOST_SHA256",
      "CATERING_BACKUP_SOURCE_COMMIT",
      "CATERING_BACKUP_SOURCE_TREE",
      "CATERING_BACKUP_REPOSITORY_FILE",
      "CATERING_BACKUP_PASSWORD_FILE",
      "CATERING_RESTORE_POSTGRES_IMAGE",
      "CATERING_SECRET_RECOVERY_REFERENCE_SHA256",
    ]) {
      expect(env).toContain(`${name}=`);
    }
    expect(env).not.toMatch(/(?:password|secret|token|private[_-]?key)\s*=\s*\S+/i);
  });

  test("the runbook keeps installation and every real operation behind separate gates", () => {
    const runbook = source(files.runbook);
    expect(runbook).toContain("RPO: 6 Stunden");
    expect(runbook).toContain("RTO: 4 Stunden");
    expect(runbook).toContain("repository-only");
    expect(runbook).toContain("kein Backup ausgeführt");
    expect(runbook).toContain("kein Restore ausgeführt");
    expect(runbook).toContain("separate Freigabe");
    expect(runbook).toContain("Phase 3");
    expect(runbook).toContain("Ports 80/443");
  });
});
