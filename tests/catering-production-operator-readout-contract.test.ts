import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");
const workflowPath = path.join(
  repoRoot,
  ".github/workflows/catering-production-operator-readout.yml",
);

function remoteScript(): string {
  const workflow = readFileSync(workflowPath, "utf8");
  const marker = "<<'REMOTE_READOUT'\n";
  const start = workflow.indexOf(marker);
  if (start < 0) throw new Error("Missing REMOTE_READOUT start marker");
  const remoteStart = start + marker.length;
  const remoteEnd = workflow.indexOf("\n          REMOTE_READOUT", remoteStart);
  if (remoteEnd < 0) throw new Error("Missing REMOTE_READOUT end marker");
  return workflow.slice(remoteStart, remoteEnd);
}

function remoteDefinitions(): string {
  const remote = remoteScript();
  const executionStart = remote.indexOf("\n          printf 'READOUT dispatch_sha=");
  if (executionStart < 0) throw new Error("Missing remote execution boundary");
  return remote.slice(0, executionStart);
}

function fakeDockerSource(): string {
  return [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    "scenario=\"${FAKE_SCENARIO:?}\"",
    "case \"${1-}\" in",
    "  ps)",
    "    case \"$scenario\" in",
    "      storage-postgres|storage-database-url|storage-default-file|storage-default-unmounted|storage-precedence) printf 'fixture-app\\n' ;;",
    "      storage-service-filter) printf 'fixture-postgres\\nfixture-web\\nfixture-app\\n' ;;",
    "      *) printf 'fixture-container\\tfixture-short\\trunning\\tUp 5 minutes\\tfixture-image\\n' ;;",
    "    esac",
    "    ;;",
    "  inspect)",
    "    template=\"${3-}\"",
    "    target=\"${4-}\"",
    "    if [[ \"$template\" == *'.RestartCount'* ]]; then",
    "      [[ \"$scenario\" != container-unavailable ]] || exit 55",
    "      if [[ \"$scenario\" == container-no-health && \"$template\" == *'.State.Health'* ]]; then exit 42; fi",
    "      if [[ \"$template\" == *'%d'* ]]; then restart='%!d(json.Number=0)'; else restart=0; fi",
    "      if [[ \"$scenario\" == container-healthy ]]; then health=healthy; else health=absent; fi",
    "      printf 'fixture-container-id\\trunning\\ttrue\\t2026-09-03T12:00:00Z\\t%s\\tsha256:fixture-image-id\\tplatform-infra\\tintake\\t%s\\n' \"$restart\" \"$health\"",
    "      exit 0",
    "    fi",
    "    if [[ \"$template\" == *'com.docker.compose.service'* ]]; then",
    "      case \"$scenario:$target\" in",
    "        storage-service-filter:fixture-postgres) printf 'postgres\\n' ;;",
    "        storage-service-filter:fixture-web) printf 'web\\n' ;;",
    "        *) printf 'intake\\n' ;;",
    "      esac",
    "      exit 0",
    "    fi",
    "    if [[ \"$template\" == *'NetworkSettings.Networks'* ]]; then",
    "      printf 'platform-infra_default\\tfixture-network-id\\tfixture-container,intake,\\n'",
    "      exit 0",
    "    fi",
    "    if [[ \"$template\" == *'.Mounts'* ]]; then",
    "      if [[ \"$scenario\" == storage-default-file ]]; then",
    "        printf '\"bind\"\\x1f\"\"\\x1f\"%s/default-data\"\\x1f\"/srv/catering/data\"\\x1ftrue\\n' \"${FIXTURE_ROOT:?}\"",
    "      fi",
    "      exit 0",
    "    fi",
    "    if [[ \"$template\" == *'.Config.WorkingDir'* ]]; then",
    "      printf '\"/srv/catering\"\\n'",
    "      exit 0",
    "    fi",
    "    if [[ \"$scenario\" == storage-service-filter && \"$target\" == fixture-app && \"$template\" == *'.Config.Env'* ]]; then",
    "      [[ \"$template\" == *'\"CATERING_DATABASE_URL\"'* ]] && printf 'CATERING_DATABASE_URL\\n'",
    "      exit 0",
    "    fi",
    "    if [[ \"$template\" == *'.Config.Env'* ]]; then",
    "      case \"$scenario\" in",
    "        storage-postgres)",
    "          [[ \"$template\" == *'\"CATERING_DATABASE_URL\"'* ]] && printf 'CATERING_DATABASE_URL\\n'",
    "          ;;",
    "        storage-database-url)",
    "          [[ \"$template\" == *'\"DATABASE_URL\"'* ]] && printf 'DATABASE_URL\\n'",
    "          ;;",
    "        storage-precedence)",
    "          if [[ \"$template\" == *'%q'* ]]; then",
    "            printf '\"CATERING_DATA_ROOT=/legacy-data\"\\n'",
    "          else",
    "            [[ \"$template\" == *'\"CATERING_DATABASE_URL\"'* ]] && printf 'CATERING_DATABASE_URL\\n'",
    "            [[ \"$template\" == *'\"CATERING_DATA_ROOT\"'* ]] && printf 'CATERING_DATA_ROOT\\n'",
    "          fi",
    "          ;;",
    "      esac",
    "      exit 0",
    "    fi",
    "    exit 66",
    "    ;;",
    "  network)",
    "    [[ \"$scenario\" != network-unavailable ]] || exit 55",
    "    exit 67",
    "    ;;",
    "  volume)",
    "    case \"$scenario\" in",
    "      volume-unavailable) exit 56 ;;",
    "      volume-mount-unavailable)",
    "        case \"${2-}\" in",
    "          ls) printf 'fixture-volume\\n' ;;",
    "          inspect) printf 'fixture-volume\\tlocal\\t%s/volume-data\\n' \"${FIXTURE_ROOT:?}\" ;;",
    "          *) exit 57 ;;",
    "        esac",
    "        ;;",
    "      *) exit 68 ;;",
    "    esac",
    "    ;;",
    "  *) exit 69 ;;",
    "esac",
    "",
  ].join("\n");
}

function fakeSystemctlSource(): string {
  return [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    "[[ \"${FAKE_SCENARIO:?}\" != systemd-unavailable ]] || exit 55",
    "exit 66",
    "",
  ].join("\n");
}

function fakeFindmntSource(): string {
  return [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    "[[ \"${FAKE_SCENARIO:?}\" != volume-mount-unavailable ]] || exit 55",
    "printf '/dev/root ext4 rw\\n'",
    "",
  ].join("\n");
}

function runRemote(command: string, scenario: string): ReturnType<typeof spawnSync> {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), "operator-readout-contract-"));
  writeFileSync(path.join(fixtureRoot, "docker"), fakeDockerSource(), { mode: 0o755 });
  writeFileSync(path.join(fixtureRoot, "systemctl"), fakeSystemctlSource(), { mode: 0o755 });
  writeFileSync(path.join(fixtureRoot, "findmnt"), fakeFindmntSource(), { mode: 0o755 });
  try {
    return spawnSync(
      "bash",
      ["-c", `set -euo pipefail\n${remoteDefinitions()}\n${command}`],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          FAKE_SCENARIO: scenario,
          FIXTURE_ROOT: fixtureRoot,
          PATH: `${fixtureRoot}:${process.env.PATH ?? ""}`,
        },
      },
    );
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

describe("Catering production operator readout contract", () => {
  test("reports a running container that has no Docker healthcheck", () => {
    const result = runRemote("container_readout platform-infra", "container-no-health");

    expect(result.status, String(result.stderr)).toBe(0);
    expect(result.stdout).toContain("READOUT container=fixture-container");
    expect(result.stdout).toContain("state=running running=true health=absent");
    expect(result.stdout).not.toContain("container=fixture-container project=platform-infra status=unavailable");
  });

  test("formats Docker restart counts as plain decimal scalars", () => {
    const result = runRemote("container_readout platform-infra", "container-healthy");

    expect(result.status, String(result.stderr)).toBe(0);
    expect(result.stdout).toContain("restart_count=0");
    expect(result.stdout).not.toContain("%!d(json.Number=");
  });

  test("classifies PostgreSQL-backed Catering storage without exposing its URL", () => {
    const result = runRemote("data_root_readout", "storage-postgres");

    expect(result.status, String(result.stderr)).toBe(0);
    expect(result.stdout).toContain("READOUT storage_backend container=fixture-app mode=postgres");
    expect(result.stdout).toContain("READOUT data_root status=not_applicable backend=postgres");
    expect(result.stdout).not.toContain("postgres://");
  });

  test("recognizes DATABASE_URL as the runtime PostgreSQL fallback", () => {
    const result = runRemote("data_root_readout; collection_status_readout", "storage-database-url");

    expect(result.status, String(result.stderr)).toBe(0);
    expect(result.stdout).toContain("READOUT storage_backend container=fixture-app mode=postgres");
    expect(result.stdout).toContain("READOUT data_root status=not_applicable backend=postgres");
    expect(result.stdout).toContain("READOUT collection=complete");
    expect(result.stdout).not.toContain("postgres://");
    expect(result.stdout).not.toContain("DATABASE_URL");
  });

  test("maps the default file data root from the container working directory", () => {
    const result = runRemote("data_root_readout; collection_status_readout", "storage-default-file");

    expect(result.status, String(result.stderr)).toBe(0);
    expect(result.stdout).toContain("READOUT storage_backend container=fixture-app mode=file");
    expect(result.stdout).toContain(
      "READOUT data_root container=fixture-app status=present path=/srv/catering/data origin=default_workdir",
    );
    expect(result.stdout).toContain("destination=/srv/catering/data writable=true");
    expect(result.stdout).toMatch(
      /source=\/tmp\/operator-readout-contract-[^ ]+\/default-data/,
    );
    expect(result.stdout).toContain("READOUT collection=complete");
  });

  test("marks an unmounted default file data root as a partial collection", () => {
    const result = runRemote(
      "data_root_readout; collection_status_readout",
      "storage-default-unmounted",
    );

    expect(result.status, String(result.stderr)).toBe(0);
    expect(result.stdout).toContain("READOUT storage_backend container=fixture-app mode=file");
    expect(result.stdout).toContain(
      "READOUT data_root container=fixture-app status=unmatched path=/srv/catering/data origin=default_workdir",
    );
    expect(result.stdout).toContain("READOUT critical_unavailable area=data_root subject=fixture-app");
    expect(result.stdout).toContain("READOUT collection=partial");
  });

  test("uses PostgreSQL precedence when a file root is also configured", () => {
    const result = runRemote("data_root_readout; collection_status_readout", "storage-precedence");

    expect(result.status, String(result.stderr)).toBe(0);
    expect(result.stdout).toContain("READOUT storage_backend container=fixture-app mode=postgres");
    expect(result.stdout).toContain("READOUT data_root status=not_applicable backend=postgres");
    expect(result.stdout).toContain("READOUT collection=complete");
    expect(result.stdout).not.toContain("mode=hybrid");
    expect(result.stdout).not.toContain("critical_unavailable area=storage_backend");
  });

  test("skips infrastructure-only containers when classifying Catering storage", () => {
    const result = runRemote(
      "data_root_readout; collection_status_readout",
      "storage-service-filter",
    );

    expect(result.status, String(result.stderr)).toBe(0);
    expect(result.stdout).toContain(
      "READOUT storage_backend container=fixture-postgres mode=not_applicable service=postgres",
    );
    expect(result.stdout).toContain(
      "READOUT storage_backend container=fixture-web mode=not_applicable service=web",
    );
    expect(result.stdout).toContain("READOUT storage_backend container=fixture-app mode=postgres");
    expect(result.stdout).toContain("READOUT data_root status=not_applicable backend=postgres");
    expect(result.stdout).toContain("READOUT collection=complete");
    expect(result.stdout).not.toContain("READOUT data_root container=fixture-postgres");
    expect(result.stdout).not.toContain("READOUT data_root container=fixture-web");
    expect(result.stdout).not.toContain("critical_unavailable area=storage_backend");
  });

  test("surfaces container evidence loss as a partial collection", () => {
    const result = runRemote(
      "container_readout platform-infra; collection_status_readout",
      "container-unavailable",
    );

    expect(result.status, String(result.stderr)).toBe(0);
    expect(result.stdout).toContain("READOUT critical_unavailable area=container_identity subject=fixture-container");
    expect(result.stdout).toContain("READOUT collection_status=partial critical_unavailable_count=1");
    expect(result.stdout).toContain("READOUT collection=partial");
    expect(result.stdout).not.toContain("READOUT collection=complete");
  });

  test("marks an inaccessible state path as a partial collection", () => {
    const result = runRemote(
      'ln -s missing "$FIXTURE_ROOT/blocked"; readout_path phase3_fixture "$FIXTURE_ROOT/blocked/marker"; collection_status_readout',
      "path-unavailable",
    );

    expect(result.status, String(result.stderr)).toBe(0);
    expect(result.stdout).toContain("READOUT path=phase3_fixture status=unavailable");
    expect(result.stdout).toContain("READOUT critical_unavailable area=path subject=phase3_fixture");
    expect(result.stdout).toContain("READOUT collection=partial");
  });

  test("marks unavailable Docker network evidence as a partial collection", () => {
    const result = runRemote(
      "network_readout catering_ingress; collection_status_readout",
      "network-unavailable",
    );

    expect(result.status, String(result.stderr)).toBe(0);
    expect(result.stdout).toContain("READOUT network=catering_ingress status=unavailable");
    expect(result.stdout).toContain("READOUT critical_unavailable area=network subject=catering_ingress");
    expect(result.stdout).toContain("READOUT collection=partial");
  });

  test("marks unavailable Docker volume inventory as a partial collection", () => {
    const result = runRemote(
      "volume_readout platform-infra; collection_status_readout",
      "volume-unavailable",
    );

    expect(result.status, String(result.stderr)).toBe(0);
    expect(result.stdout).toContain("READOUT volumes_project=platform-infra status=unavailable");
    expect(result.stdout).toContain("READOUT critical_unavailable area=volume_inventory subject=platform-infra");
    expect(result.stdout).toContain("READOUT collection=partial");
  });

  test("marks an unreadable Docker volume filesystem as a partial collection", () => {
    const result = runRemote(
      "volume_readout platform-infra; collection_status_readout",
      "volume-mount-unavailable",
    );

    expect(result.status, String(result.stderr)).toBe(0);
    expect(result.stdout).toContain("READOUT volume_mount volume=fixture-volume status=unavailable");
    expect(result.stdout).toContain("READOUT critical_unavailable area=volume_mount subject=fixture-volume");
    expect(result.stdout).toContain("READOUT collection=partial");
  });

  test("marks unavailable systemd evidence as a partial collection", () => {
    const result = runRemote(
      "systemd_readout; collection_status_readout",
      "systemd-unavailable",
    );

    expect(result.status, String(result.stderr)).toBe(0);
    expect(result.stdout).toContain("READOUT systemd_timers status=unavailable");
    expect(result.stdout).toContain("READOUT systemd_units status=unavailable");
    expect(result.stdout).toContain("READOUT critical_unavailable area=systemd_timers subject=host");
    expect(result.stdout).toContain("READOUT critical_unavailable area=systemd_units subject=host");
    expect(result.stdout).toContain("READOUT collection_status=partial critical_unavailable_count=2");
  });

  test("marks unsafe backup evidence as a partial collection", () => {
    const result = runRemote(
      'printf unsafe >"$FIXTURE_ROOT/backup-evidence"; chmod 0666 "$FIXTURE_ROOT/backup-evidence"; backup_file_readout fixture_backup "$FIXTURE_ROOT/backup-evidence"; collection_status_readout',
      "backup-unsafe",
    );

    expect(result.status, String(result.stderr)).toBe(0);
    expect(result.stdout).toContain("READOUT backup_file=fixture_backup status=unsafe");
    expect(result.stdout).toContain("READOUT critical_unavailable area=backup_file subject=fixture_backup");
    expect(result.stdout).toContain("READOUT collection=partial");
  });

  test("emits the legacy complete marker only for authoritative collections", () => {
    const result = runRemote("collection_status_readout", "complete");

    expect(result.status, String(result.stderr)).toBe(0);
    expect(result.stdout).toContain("READOUT collection_status=complete critical_unavailable_count=0");
    expect(result.stdout).toContain("READOUT collection=complete");
    expect(result.stdout).not.toContain("READOUT collection=partial");
  });

  test("delegates the terminal collection marker to collection status", () => {
    const remote = remoteScript();
    const execution = remote.slice(
      remote.indexOf("backup_file_readout catering_backup_repository_status"),
    );

    expect(execution).toContain("collection_status_readout");
    expect(execution).not.toContain("printf 'READOUT collection=complete");
  });
});
