import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync
} from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const roots: string[] = [];

function writeExecutable(filePath: string, content: string): void {
  writeFileSync(filePath, content);
  chmodSync(filePath, 0o755);
}

function createLauncherHarness(prefix: string): {
  root: string;
  dataRoot: string;
  startScript: string;
  binDir: string;
  npmMarker: string;
} {
  const root = mkdtempSync(path.join(tmpdir(), prefix));
  roots.push(root);
  const scriptsDir = path.join(root, "scripts");
  const binDir = path.join(root, "bin");
  const dataRoot = path.join(root, "shared-data");
  const npmMarker = path.join(root, "npm-called");
  mkdirSync(scriptsDir, { recursive: true });
  mkdirSync(binDir, { recursive: true });
  mkdirSync(dataRoot, { recursive: true });
  const startScript = path.join(scriptsDir, "start-local-stack.sh");
  copyFileSync("scripts/start-local-stack.sh", startScript);
  writeExecutable(path.join(binDir, "screen"), "#!/bin/sh\nexit 0\n");
  writeExecutable(path.join(binDir, "pgrep"), "#!/bin/sh\nexit 1\n");
  writeExecutable(path.join(binDir, "lsof"), "#!/bin/sh\nexit 1\n");
  writeExecutable(path.join(binDir, "launchctl"), "#!/bin/sh\nexit 1\n");
  writeExecutable(path.join(binDir, "npm"), [
    "#!/bin/sh",
    `printf '%s\\n' "$$:$*" >>${JSON.stringify(npmMarker)}`,
    "sleep \"${TEST_MIGRATION_SLEEP_SECONDS:-0}\"",
    "exit \"${TEST_NPM_EXIT:-99}\""
  ].join("\n"));
  return { root, dataRoot, startScript, binDir, npmMarker };
}

function launcherEnv(
  harness: ReturnType<typeof createLauncherHarness>,
  extra: Record<string, string | undefined> = {}
): Record<string, string | undefined> {
  const dataRoot = extra.CATERING_DATA_ROOT ?? harness.dataRoot;
  return {
    ...process.env,
    PATH: `${harness.binDir}:${process.env.PATH ?? ""}`,
    CATERING_DATA_ROOT: dataRoot,
    CATERING_LOCAL_START_LOCK_FILE: path.join(dataRoot, ".test-production-startup-3103.lock"),
    CATERING_NODE_BIN: path.join(harness.binDir, "npm"),
    ...extra
  };
}

function runLauncher(
  harness: ReturnType<typeof createLauncherHarness>,
  env: Record<string, string | undefined>
): Promise<{ status: number | null; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("bash", [harness.startScript], {
      cwd: harness.root,
      env,
      stdio: ["ignore", "ignore", "pipe"]
    });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (status) => resolve({ status, stderr }));
  });
}

async function waitForPath(filePath: string, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(filePath)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for ${filePath}`);
}

async function waitForFileContent(filePath: string, content: string, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(filePath) && readFileSync(filePath, "utf8").includes(content)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for ${content} in ${filePath}`);
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("local stack migration guard", () => {
  it("refuses to migrate while an existing local stack session can still write legacy data", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-local-stack-migration-guard-"));
    roots.push(root);
    const scriptsDir = path.join(root, "scripts");
    const binDir = path.join(root, "bin");
    const npmMarker = path.join(root, "npm-called");
    mkdirSync(scriptsDir, { recursive: true });
    mkdirSync(binDir, { recursive: true });
    const startScript = path.join(scriptsDir, "start-local-stack.sh");
    copyFileSync("scripts/start-local-stack.sh", startScript);

    const screen = path.join(binDir, "screen");
    writeFileSync(screen, [
      "#!/bin/sh",
      "if [ \"${1:-}\" = \"-ls\" ]; then",
      "  printf 'There is a screen on:\\n\\t123.catering-production\\t(Detached)\\n'",
      "fi"
    ].join("\n"));
    chmodSync(screen, 0o755);

    const npm = path.join(binDir, "npm");
    writeFileSync(npm, `#!/bin/sh\nprintf called >${JSON.stringify(npmMarker)}\nexit 99\n`);
    chmodSync(npm, 0o755);

    const result = spawnSync("bash", [startScript], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH ?? ""}`,
        CATERING_DATA_ROOT: path.join(root, "data"),
        CATERING_NODE_BIN: npm
      }
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("npm run local:stop");
    expect(existsSync(npmMarker)).toBe(false);
  });

  it("confirms quiescence to the migration only after the stack session check passes", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-local-stack-migration-confirmation-"));
    roots.push(root);
    const scriptsDir = path.join(root, "scripts");
    const binDir = path.join(root, "bin");
    const npmMarker = path.join(root, "npm-args");
    mkdirSync(scriptsDir, { recursive: true });
    mkdirSync(binDir, { recursive: true });
    const startScript = path.join(scriptsDir, "start-local-stack.sh");
    copyFileSync("scripts/start-local-stack.sh", startScript);

    const screen = path.join(binDir, "screen");
    writeFileSync(screen, "#!/bin/sh\nexit 0\n");
    chmodSync(screen, 0o755);

    const npm = path.join(binDir, "npm");
    writeFileSync(npm, `#!/bin/sh\nprintf '%s' "$*" >${JSON.stringify(npmMarker)}\nexit 99\n`);
    chmodSync(npm, 0o755);

    const result = spawnSync("bash", [startScript], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH ?? ""}`,
        CATERING_DATA_ROOT: path.join(root, "data"),
        CATERING_NODE_BIN: npm
      }
    });

    expect(result.status).toBe(99);
    expect(readFileSync(npmMarker, "utf8")).toContain("--confirm-legacy-file-writers-quiesced");
  });

  it("allows only one concurrent launcher to reach migration for one production port", async () => {
    const firstHarness = createLauncherHarness("catering-local-start-mutex-a-");
    const secondHarness = createLauncherHarness("catering-local-start-mutex-b-");
    const sharedLockFile = path.join(firstHarness.root, "shared-production-port.lock");
    const firstEnv = launcherEnv(firstHarness, {
      CATERING_LOCAL_START_LOCK_FILE: sharedLockFile,
      TEST_MIGRATION_SLEEP_SECONDS: "0.5",
      TEST_NPM_EXIT: "99"
    });
    const secondEnv = launcherEnv(secondHarness, {
      CATERING_LOCAL_START_LOCK_FILE: sharedLockFile,
      TEST_MIGRATION_SLEEP_SECONDS: "0.5",
      TEST_NPM_EXIT: "99"
    });

    const [first, second] = await Promise.all([
      runLauncher(firstHarness, firstEnv),
      runLauncher(secondHarness, secondEnv)
    ]);

    expect([first.status, second.status].sort()).toEqual([1, 99]);
    expect(
      [firstHarness.npmMarker, secondHarness.npmMarker].filter((marker) => existsSync(marker))
    ).toHaveLength(1);
    expect(`${first.stderr}\n${second.stderr}`).toContain("Start-Sperre");
  });

  it("allows only one concurrent launcher to reclaim one stale startup mutex", async () => {
    const firstHarness = createLauncherHarness("catering-local-stale-race-a-");
    const secondHarness = createLauncherHarness("catering-local-stale-race-b-");
    const sharedDataRoot = firstHarness.dataRoot;
    const mutexFile = path.join(sharedDataRoot, ".test-production-startup-3103.lock");
    writeFileSync(mutexFile, "999999999\n");
    // shlock intentionally gives a freshly changed lock one grace interval before reclaiming it.
    await new Promise((resolve) => setTimeout(resolve, 2_100));

    const [first, second] = await Promise.all([
      runLauncher(firstHarness, launcherEnv(firstHarness, {
        CATERING_DATA_ROOT: sharedDataRoot,
        TEST_MIGRATION_SLEEP_SECONDS: "0.5",
        TEST_NPM_EXIT: "99"
      })),
      runLauncher(secondHarness, launcherEnv(secondHarness, {
        CATERING_DATA_ROOT: sharedDataRoot,
        TEST_MIGRATION_SLEEP_SECONDS: "0.5",
        TEST_NPM_EXIT: "99"
      }))
    ]);

    expect([first.status, second.status].sort()).toEqual([1, 99]);
    expect(
      [firstHarness.npmMarker, secondHarness.npmMarker].filter((marker) => existsSync(marker))
    ).toHaveLength(1);
    expect(`${first.stderr}\n${second.stderr}`).toContain("Start-Sperre");
  });

  it("terminates the launcher and releases its mutex on SIGTERM", async () => {
    const harness = createLauncherHarness("catering-local-start-signal-");
    const screenMarker = path.join(harness.root, "screen-started");
    writeExecutable(path.join(harness.binDir, "screen"), [
      "#!/bin/sh",
      "if [ \"${1:-}\" = \"-dmS\" ]; then",
      "  printf started >\"${SCREEN_MARKER}\"",
      "fi",
      "exit 0"
    ].join("\n"));

    const child = spawn("bash", [harness.startScript], {
      cwd: harness.root,
      detached: true,
      env: launcherEnv(harness, {
        SCREEN_MARKER: screenMarker,
        TEST_MIGRATION_SLEEP_SECONDS: "30",
        TEST_NPM_EXIT: "99"
      }),
      stdio: ["ignore", "ignore", "pipe"]
    });
    const closed = new Promise<number | null>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    });

    await waitForPath(harness.npmMarker);
    process.kill(-child.pid!, "SIGTERM");
    const status = await closed;

    expect(status).toBe(143);
    expect(existsSync(screenMarker)).toBe(false);
    const retry = spawnSync("bash", [harness.startScript], {
      cwd: harness.root,
      encoding: "utf8",
      env: launcherEnv(harness, { TEST_NPM_EXIT: "99" })
    });
    expect(retry.status).toBe(99);
  });

  it("does not overlap migrations after the launcher is killed without its child", async () => {
    const harness = createLauncherHarness("catering-local-start-orphan-");
    writeExecutable(path.join(harness.binDir, "npm"), [
      "#!/bin/sh",
      `printf 'start:%s\\n' \"$$\" >>${JSON.stringify(harness.npmMarker)}`,
      "sleep \"${TEST_MIGRATION_SLEEP_SECONDS:-0}\"",
      `printf 'end:%s\\n' \"$$\" >>${JSON.stringify(harness.npmMarker)}`,
      "exit \"${TEST_NPM_EXIT:-99}\""
    ].join("\n"));
    const child = spawn("bash", [harness.startScript], {
      cwd: harness.root,
      env: launcherEnv(harness, {
        TEST_MIGRATION_SLEEP_SECONDS: "2.2",
        TEST_NPM_EXIT: "99"
      }),
      stdio: ["ignore", "ignore", "pipe"]
    });
    const launcherExited = new Promise<void>((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", () => resolve());
    });

    await waitForFileContent(harness.npmMarker, "start:");
    child.kill("SIGKILL");
    await launcherExited;

    const blocked = spawnSync("bash", [harness.startScript], {
      cwd: harness.root,
      encoding: "utf8",
      env: launcherEnv(harness, { TEST_NPM_EXIT: "99" })
    });
    expect(blocked.status).toBe(1);
    expect(readFileSync(harness.npmMarker, "utf8").match(/^start:/gm)).toHaveLength(1);

    await waitForFileContent(harness.npmMarker, "end:");
    const retry = spawnSync("bash", [harness.startScript], {
      cwd: harness.root,
      encoding: "utf8",
      env: launcherEnv(harness, { TEST_NPM_EXIT: "99" })
    });
    expect(retry.status).toBe(99);
    expect(readFileSync(harness.npmMarker, "utf8").match(/^start:/gm)).toHaveLength(2);
  }, 10_000);

  it("requires the canonical production lock protocol in the health response", () => {
    const startScript = readFileSync("scripts/start-local-stack.sh", "utf8");
    expect(startScript).toContain('"targetLockProtocol":"canonical-v2"');
    expect(startScript).toContain("wait_for_production_protocol");
  });

  it("runs migration in the PID that owns the activity lock", () => {
    const startScript = readFileSync("scripts/start-local-stack.sh", "utf8");
    expect(startScript).toContain('"${MIGRATION_NODE_BIN}" --import tsx');
    expect(startScript).not.toContain("npm run migrate:business-scope");
  });

  it("rejects a production session that appears after migration", () => {
    const harness = createLauncherHarness("catering-local-start-late-session-");
    const sessionMarker = path.join(harness.root, "late-production-session");
    writeExecutable(path.join(harness.binDir, "screen"), [
      "#!/bin/sh",
      "if [ \"${1:-}\" = \"-ls\" ] && [ -f \"${SESSION_MARKER}\" ]; then",
      "  printf 'There is a screen on:\\n\\t123.catering-production\\t(Detached)\\n'",
      "fi"
    ].join("\n"));
    writeExecutable(path.join(harness.binDir, "npm"), [
      "#!/bin/sh",
      "printf appeared >\"${SESSION_MARKER}\"",
      "exit 0"
    ].join("\n"));

    const result = spawnSync("bash", [harness.startScript], {
      cwd: harness.root,
      encoding: "utf8",
      env: launcherEnv(harness, { SESSION_MARKER: sessionMarker })
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Production-screen-Sitzung");
  });

  it("does not accept an old production health response", () => {
    const harness = createLauncherHarness("catering-local-start-old-health-");
    writeExecutable(path.join(harness.binDir, "npm"), "#!/bin/sh\nexit 0\n");
    writeExecutable(path.join(harness.binDir, "curl"), [
      "#!/bin/sh",
      "case \"$*\" in",
      "  *3103/health*) printf '{\"service\":\"production-service\",\"status\":\"ok\",\"targetLockProtocol\":\"canonical-v2\",\"startupToken\":\"another-launcher\"}' ;;",
      "  *) printf '{\"status\":\"ok\"}' ;;",
      "esac",
      "exit 0"
    ].join("\n"));

    const result = spawnSync("bash", [harness.startScript], {
      cwd: harness.root,
      encoding: "utf8",
      env: launcherEnv(harness, {
        CATERING_LOCAL_START_ATTEMPTS: "1",
        CATERING_LOCAL_CURL_MAX_TIME_SECONDS: "1"
      })
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("erwartete Sperrprotokoll canonical-v2");
  });
});
