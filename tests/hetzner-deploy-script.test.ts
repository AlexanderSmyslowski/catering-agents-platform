import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");
const deployScript = path.join(repoRoot, "platform-infra/scripts/deploy-hetzner.sh");
const tempDirs: string[] = [];

function createTempDir(): string {
  const directory = mkdtempSync(path.join(tmpdir(), "catering-hetzner-deploy-"));
  tempDirs.push(directory);
  return directory;
}

function writeExecutable(filePath: string, content: string): void {
  writeFileSync(filePath, content, "utf8");
  chmodSync(filePath, 0o755);
}

function runDeploy(binDir: string, extraEnv: Record<string, string> = {}) {
  return spawnSync("bash", [deployScript], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
      DEPLOY_HOST: "deployment.test",
      DEPLOY_BASE_URL: "http://deployment.test",
      ...extraEnv
    }
  });
}

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("Hetzner deployment script", () => {
  test("stops before rsync when the remote environment file is missing", () => {
    const root = createTempDir();
    const binDir = path.join(root, "bin");
    const callLog = path.join(root, "calls.log");
    mkdirSync(binDir);
    writeFileSync(callLog, "", "utf8");
    writeExecutable(
      path.join(binDir, "ssh"),
      "#!/usr/bin/env bash\necho ssh >> \"$CALL_LOG\"\nexit 23\n"
    );
    writeExecutable(
      path.join(binDir, "rsync"),
      "#!/usr/bin/env bash\necho rsync >> \"$CALL_LOG\"\nexit 0\n"
    );

    const result = runDeploy(binDir, { CALL_LOG: callLog });

    expect(result.status).not.toBe(0);
    expect(readFileSync(callLog, "utf8")).toBe("ssh\n");
    expect(`${result.stdout}${result.stderr}`).toContain("Missing platform-infra/.env on server");
  });

  test("excludes the server-only environment file from repository synchronization", () => {
    const root = createTempDir();
    const binDir = path.join(root, "bin");
    const rsyncLog = path.join(root, "rsync.log");
    mkdirSync(binDir);
    writeExecutable(path.join(binDir, "ssh"), "#!/usr/bin/env bash\nexit 0\n");
    writeExecutable(
      path.join(binDir, "rsync"),
      "#!/usr/bin/env bash\nprintf '%s\\n' \"$@\" > \"$RSYNC_LOG\"\nexit 0\n"
    );
    writeExecutable(path.join(binDir, "curl"), "#!/usr/bin/env bash\nexit 0\n");

    const result = runDeploy(binDir, {
      DEPLOY_RSYNC_PATH: "sudo rsync",
      RSYNC_LOG: rsyncLog
    });

    expect(result.status).toBe(0);
    const rsyncArguments = readFileSync(rsyncLog, "utf8");
    expect(rsyncArguments).toContain("platform-infra/.env");
    expect(rsyncArguments).toContain("--rsync-path=sudo rsync");
  });
});
