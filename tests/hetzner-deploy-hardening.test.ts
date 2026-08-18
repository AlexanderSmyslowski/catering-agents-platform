import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");
const deployScript = path.join(repoRoot, "platform-infra/scripts/deploy-hetzner.sh");
const deployWorkflow = path.join(repoRoot, ".github/workflows/deploy-production.yml");
const tempDirs: string[] = [];

function createTempDir(): string {
  const directory = mkdtempSync(path.join(tmpdir(), "catering-deploy-hardening-"));
  tempDirs.push(directory);
  return directory;
}

function writeExecutable(filePath: string, content: string): void {
  writeFileSync(filePath, content, "utf8");
  chmodSync(filePath, 0o755);
}

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("Hetzner deployment hardening", () => {
  test("creates a server-side rollback archive before rsync and records the deployed commit only after smoke", () => {
    const root = createTempDir();
    const binDir = path.join(root, "bin");
    const callLog = path.join(root, "calls.log");
    mkdirSync(binDir);
    writeFileSync(callLog, "", "utf8");

    writeExecutable(
      path.join(binDir, "ssh"),
      [
        "#!/usr/bin/env bash",
        "printf 'ssh %s\\n' \"$*\" >> \"$CALL_LOG\"",
        "exit 0"
      ].join("\n") + "\n"
    );
    writeExecutable(
      path.join(binDir, "rsync"),
      "#!/usr/bin/env bash\nprintf 'rsync %s\\n' \"$*\" >> \"$CALL_LOG\"\nexit 0\n"
    );
    writeExecutable(
      path.join(binDir, "curl"),
      "#!/usr/bin/env bash\nprintf '{\"status\":\"ok\"}'\nexit 0\n"
    );

    const result = spawnSync("bash", [deployScript], {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH ?? ""}`,
        CALL_LOG: callLog,
        DEPLOY_HOST: "deployment.test",
        DEPLOY_BASE_URL: "http://deployment.test",
        DEPLOY_COMMIT_SHA: "0123456789abcdef0123456789abcdef01234567"
      }
    });

    expect(result.status).toBe(0);
    const calls = readFileSync(callLog, "utf8");
    const snapshotIndex = calls.indexOf("tar -czf");
    const rsyncIndex = calls.indexOf("rsync ");
    const manifestIndex = calls.indexOf(".deploy-manifest");

    expect(snapshotIndex).toBeGreaterThan(-1);
    expect(snapshotIndex).toBeLessThan(rsyncIndex);
    expect(calls).toContain("catering-agents-platform-rollbacks");
    expect(calls).toContain("--exclude=./data");
    expect(calls).toContain("--exclude=./platform-infra/.env");
    expect(calls).toContain("--exclude=./platform-infra/sites");
    expect(manifestIndex).toBeGreaterThan(rsyncIndex);
    expect(calls).toContain("0123456789abcdef0123456789abcdef01234567");
  });

  test("codex deployment user requires sudo for rollback writes", () => {
    const root = createTempDir();
    const binDir = path.join(root, "bin");
    const callLog = path.join(root, "calls.log");
    mkdirSync(binDir);
    writeFileSync(callLog, "", "utf8");

    writeExecutable(
      path.join(binDir, "ssh"),
      [
        "#!/usr/bin/env bash",
        "command=\"$*\"",
        "printf 'ssh %s\\n' \"$command\" >> \"$CALL_LOG\"",
        "if [[ \"$command\" == *\"tar -czf\"* ]]; then",
        "  [[ \"$command\" == *\"sudo mkdir -p\"* ]] || exit 13",
        "  [[ \"$command\" == *\"sudo tar -czf\"* ]] || exit 13",
        "  [[ \"$command\" == *\"sudo tee\"* ]] || exit 13",
        "fi",
        "exit 0"
      ].join("\n") + "\n"
    );
    writeExecutable(
      path.join(binDir, "rsync"),
      "#!/usr/bin/env bash\nprintf 'rsync %s\\n' \"$*\" >> \"$CALL_LOG\"\nexit 0\n"
    );
    writeExecutable(
      path.join(binDir, "curl"),
      "#!/usr/bin/env bash\nprintf '{\"status\":\"ok\"}'\nexit 0\n"
    );

    const result = spawnSync("bash", [deployScript], {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH ?? ""}`,
        CALL_LOG: callLog,
        DEPLOY_HOST: "deployment.test",
        DEPLOY_BASE_URL: "http://deployment.test",
        DEPLOY_COMMIT_SHA: "0123456789abcdef0123456789abcdef01234567"
      }
    });

    expect(result.status).toBe(0);
    const calls = readFileSync(callLog, "utf8");
    const snapshotStart = calls.indexOf("rollback_root='");
    const snapshotEnd = calls.indexOf("Rollback snapshot", snapshotStart);
    const snapshotCommand = calls.slice(snapshotStart, snapshotEnd);
    const snapshotIndex = calls.indexOf("tar -czf");
    const rsyncIndex = calls.indexOf("rsync ");

    expect(snapshotStart).toBeGreaterThan(-1);
    expect(snapshotEnd).toBeGreaterThan(snapshotStart);
    expect(snapshotCommand).toContain("sudo mkdir -p");
    expect(snapshotCommand).toContain("sudo tar -czf");
    expect(snapshotCommand).toContain("sudo tee");
    expect(snapshotCommand).not.toMatch(/sudo\s+(?:sh|bash)\s+-c/);
    expect(snapshotCommand).toContain("--exclude=./data");
    expect(snapshotCommand).toContain("--exclude=./platform-infra/.env");
    expect(snapshotCommand).toContain("--exclude=./platform-infra/sites");
    expect(snapshotIndex).toBeLessThan(rsyncIndex);
  });

  test("ships a manual production workflow with a protected environment and pinned deployment identity", () => {
    expect(existsSync(deployWorkflow)).toBe(true);
    if (!existsSync(deployWorkflow)) return;

    const workflow = readFileSync(deployWorkflow, "utf8");

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("environment: production");
    expect(workflow).toContain("permissions:");
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("concurrency:");
    expect(workflow).toContain("HETZNER_SSH_PRIVATE_KEY");
    expect(workflow).toContain("HETZNER_SSH_KNOWN_HOSTS");
    expect(workflow).toContain("HETZNER_DEPLOY_HOST");
    expect(workflow).toContain("HETZNER_DEPLOY_BASE_URL");
    expect(workflow).toContain("SMOKE_BASIC_AUTH_USER");
    expect(workflow).toContain("SMOKE_BASIC_AUTH_PASSWORD");
    expect(workflow).toContain("DEPLOY_COMMIT_SHA: ${{ github.sha }}");
    expect(workflow).toContain("bash platform-infra/scripts/deploy-hetzner.sh");
    expect(workflow).not.toContain("StrictHostKeyChecking=no");
  });
});
