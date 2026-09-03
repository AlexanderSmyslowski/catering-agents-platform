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

function remoteDefinitions(): string {
  const workflow = readFileSync(workflowPath, "utf8");
  const marker = "<<'REMOTE_READOUT'\n";
  const start = workflow.indexOf(marker);
  if (start < 0) throw new Error("Missing REMOTE_READOUT start marker");
  const remoteStart = start + marker.length;
  const remoteEnd = workflow.indexOf("\n          REMOTE_READOUT", remoteStart);
  if (remoteEnd < 0) throw new Error("Missing REMOTE_READOUT end marker");
  const remote = workflow.slice(remoteStart, remoteEnd);
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
    "      storage-postgres) printf 'fixture-app\\n' ;;",
    "      *) printf 'fixture-container\\tfixture-short\\trunning\\tUp 5 minutes\\tfixture-image\\n' ;;",
    "    esac",
    "    ;;",
    "  inspect)",
    "    template=\"${3-}\"",
    "    if [[ \"$template\" == *'.RestartCount'* ]]; then",
    "      [[ \"$scenario\" != container-unavailable ]] || exit 55",
    "      if [[ \"$scenario\" == container-no-health && \"$template\" == *'.State.Health'* ]]; then exit 42; fi",
    "      if [[ \"$template\" == *'%d'* ]]; then restart='%!d(json.Number=0)'; else restart=0; fi",
    "      if [[ \"$scenario\" == container-healthy ]]; then health=healthy; else health=absent; fi",
    "      printf 'fixture-container-id\\trunning\\ttrue\\t2026-09-03T12:00:00Z\\t%s\\tsha256:fixture-image-id\\tplatform-infra\\tintake\\t%s\\n' \"$restart\" \"$health\"",
    "      exit 0",
    "    fi",
    "    if [[ \"$template\" == *'NetworkSettings.Networks'* ]]; then",
    "      printf 'platform-infra_default\\tfixture-network-id\\tfixture-container,intake,\\n'",
    "      exit 0",
    "    fi",
    "    if [[ \"$template\" == *'.Mounts'* ]]; then exit 0; fi",
    "    if [[ \"$template\" == *'.Config.Env'* ]]; then",
    "      if [[ \"$scenario\" == storage-postgres && \"$template\" == *'CATERING_DATABASE_URL'* ]]; then",
    "        printf 'CATERING_DATABASE_URL\\n'",
    "      fi",
    "      exit 0",
    "    fi",
    "    exit 66",
    "    ;;",
    "  *) exit 67 ;;",
    "esac",
    "",
  ].join("\n");
}

function runRemote(command: string, scenario: string): ReturnType<typeof spawnSync> {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), "operator-readout-contract-"));
  const dockerPath = path.join(fixtureRoot, "docker");
  writeFileSync(dockerPath, fakeDockerSource(), { mode: 0o755 });
  try {
    return spawnSync(
      "bash",
      ["-c", `set -euo pipefail\n${remoteDefinitions()}\n${command}`],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          FAKE_SCENARIO: scenario,
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

  test("surfaces critical readout loss in a collection-level marker", () => {
    const result = runRemote(
      "container_readout platform-infra; collection_status_readout",
      "container-unavailable",
    );

    expect(result.status, String(result.stderr)).toBe(0);
    expect(result.stdout).toContain("READOUT critical_unavailable area=container_identity subject=fixture-container");
    expect(result.stdout).toContain("READOUT collection_status=partial critical_unavailable_count=1");
  });
});
