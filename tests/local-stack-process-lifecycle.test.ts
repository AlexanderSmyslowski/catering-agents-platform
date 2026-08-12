import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const roots: string[] = [];

function writeExecutable(filePath: string, content: string): void {
  writeFileSync(filePath, content);
  chmodSync(filePath, 0o755);
}

function createHarness(): {
  root: string;
  lifecycleScript: string;
  watchdogPidFile: string;
  listenerPidFile: string;
  checkChildPidFile: string;
  eventFile: string;
  portFile: string;
} {
  const root = mkdtempSync(path.join(tmpdir(), "catering-local-stack-lifecycle-"));
  roots.push(root);
  const scriptsDir = path.join(root, "scripts");
  mkdirSync(scriptsDir, { recursive: true });
  const lifecycleScript = path.join(scriptsDir, "check-browser-rehearsal-full-fresh.sh");
  const startFreshScript = path.join(scriptsDir, "start-fresh-local-stack.sh");
  const stopScript = path.join(scriptsDir, "stop-local-stack.sh");
  const checkScript = path.join(scriptsDir, "check-browser-rehearsal.sh");
  const dummyService = path.join(root, "dummy-service.mjs");
  const watchdog = path.join(root, "watchdog.sh");
  const watchdogPidFile = path.join(root, "watchdog-pids");
  const listenerPidFile = path.join(root, "listener-pids");
  const checkChildPidFile = path.join(root, "check-child-pids");
  const eventFile = path.join(root, "events");
  const portFile = path.join(root, "ports");

  writeFileSync(lifecycleScript, readFileSync("scripts/check-browser-rehearsal-full-fresh.sh"));
  writeFileSync(
    dummyService,
    [
      "import { appendFileSync } from 'node:fs';",
      "import net from 'node:net';",
      "const [eventFile, portFile] = process.argv.slice(2);",
      "let stopping = false;",
      "const server = net.createServer((socket) => socket.end('ok'));",
      "const stop = () => {",
      "  if (stopping) return;",
      "  stopping = true;",
      "  appendFileSync(eventFile, `stop:${process.pid}\\n`);",
      "  server.close(() => process.exit(0));",
      "};",
      "process.on('SIGTERM', stop);",
      "process.on('SIGINT', stop);",
      "server.listen(0, '127.0.0.1', () => {",
      "  const address = server.address();",
      "  if (!address || typeof address === 'string') process.exit(2);",
      "  appendFileSync(eventFile, `start:${process.pid}\\n`);",
      "  appendFileSync(portFile, `${address.port}\\n`);",
      "});",
      "setInterval(() => {}, 1_000);"
    ].join("\n")
  );

  writeExecutable(
    watchdog,
    [
      "#!/bin/bash",
      "set -u",
      `node_path=${JSON.stringify(process.execPath)}`,
      `listener=${JSON.stringify(dummyService)}`,
      `listener_pids=${JSON.stringify(listenerPidFile)}`,
      "event_file=\"$1\"",
      "port_file=\"$2\"",
      "child_pid=\"\"",
      "stop() {",
      "  if [[ -n \"${child_pid}\" ]]; then",
      "    kill -TERM \"${child_pid}\" 2>/dev/null || true",
      "    wait \"${child_pid}\" 2>/dev/null || true",
      "  fi",
      "  printf 'watchdog-stop:%s\\n' \"$$\" >>\"${event_file}\"",
      "  exit 0",
      "}",
      "trap stop TERM INT HUP",
      "while true; do",
      "  \"${node_path}\" \"${listener}\" \"${event_file}\" \"${port_file}\" &",
      "  child_pid=\"$!\"",
      "  printf '%s\\n' \"${child_pid}\" >>\"${listener_pids}\"",
      "  printf 'watchdog-start:%s\\n' \"$$\" >>\"${event_file}\"",
      "  wait \"${child_pid}\" || true",
      "  child_pid=\"\"",
      "  sleep 0.05",
      "done"
    ].join("\n")
  );

  writeExecutable(
    startFreshScript,
    [
      "#!/bin/bash",
      "set -euo pipefail",
      `stop_script=${JSON.stringify(stopScript)}`,
      `watchdog=${JSON.stringify(watchdog)}`,
      `watchdog_pids=${JSON.stringify(watchdogPidFile)}`,
      `listener_pids=${JSON.stringify(listenerPidFile)}`,
      `port_file=${JSON.stringify(portFile)}`,
      `event_file=${JSON.stringify(eventFile)}`,
      "bash \"${stop_script}\"",
      "previous_listener_count=0",
      "if [[ -f \"${listener_pids}\" ]]; then previous_listener_count=\"$(wc -l <\"${listener_pids}\")\"; fi",
      "previous_port_count=0",
      "if [[ -f \"${port_file}\" ]]; then previous_port_count=\"$(wc -l <\"${port_file}\")\"; fi",
      "\"${watchdog}\" \"${event_file}\" \"${port_file}\" &",
      "printf '%s\\n' \"$!\" >>\"${watchdog_pids}\"",
      "for _ in {1..100}; do",
      "  current_listener_count=0",
      "  if [[ -f \"${listener_pids}\" ]]; then current_listener_count=\"$(wc -l <\"${listener_pids}\")\"; fi",
      "  current_port_count=0",
      "  if [[ -f \"${port_file}\" ]]; then current_port_count=\"$(wc -l <\"${port_file}\")\"; fi",
      "  if (( current_listener_count > previous_listener_count && current_port_count > previous_port_count )); then break; fi",
      "  sleep 0.01",
      "done",
      "printf 'start-fresh\\n' >>\"${event_file}\""
    ].join("\n")
  );
  writeExecutable(
    stopScript,
    [
      "#!/bin/bash",
      "set -euo pipefail",
      `watchdog_pids=${JSON.stringify(watchdogPidFile)}`,
      `listener_pids=${JSON.stringify(listenerPidFile)}`,
      `event_file=${JSON.stringify(eventFile)}`,
      "for pid_file in \"${watchdog_pids}\" \"${listener_pids}\"; do",
      "  [[ -f \"${pid_file}\" ]] || continue",
      "  while IFS= read -r pid; do",
      "    [[ -n \"${pid}\" ]] || continue",
      "    kill -TERM \"${pid}\" 2>/dev/null || true",
      "  done <\"${pid_file}\"",
      "done",
      "sleep 0.1",
      "printf 'stop-stack\\n' >>\"${event_file}\""
    ].join("\n")
  );
  writeExecutable(
    checkScript,
    [
      "#!/bin/bash",
      "set -euo pipefail",
      `event_file=${JSON.stringify(eventFile)}`,
      `check_child_pids=${JSON.stringify(checkChildPidFile)}`,
      "printf 'check\\n' >>\"${event_file}\"",
      "if [[ \"${CATERING_TEST_REHEARSAL_ABORT:-0}\" == \"1\" ]]; then",
      "  sleep 30 &",
      "  printf '%s\\n' \"$!\" >>\"${check_child_pids}\"",
      "  wait \"$!\"",
      "fi"
    ].join("\n")
  );

  return { root, lifecycleScript, watchdogPidFile, listenerPidFile, checkChildPidFile, eventFile, portFile };
}

function harnessEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH ?? ""}`,
    CATERING_TEST_REHEARSAL_ABORT: "0",
    ...extra
  };
}

function recordedPids(filePath: string): number[] {
  if (!existsSync(filePath)) return [];
  return readFileSync(filePath, "utf8")
    .split(/\s+/u)
    .filter(Boolean)
    .map((pid) => Number(pid));
}

function allRecordedPids(harness: ReturnType<typeof createHarness>): number[] {
  return [
    ...recordedPids(harness.watchdogPidFile),
    ...recordedPids(harness.listenerPidFile),
    ...recordedPids(harness.checkChildPidFile)
  ];
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function waitForText(filePath: string, text: string, timeoutMs = 3_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const poll = () => {
      if (existsSync(filePath) && readFileSync(filePath, "utf8").includes(text)) {
        resolve();
        return;
      }
      if (Date.now() >= deadline) {
        reject(new Error(`Timed out waiting for ${text} in ${filePath}`));
        return;
      }
      setTimeout(poll, 20);
    };
    poll();
  });
}

function portIsOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const finish = (open: boolean) => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(100, () => finish(false));
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });
}

function waitForPidsStopped(pids: number[], timeoutMs = 3_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const poll = () => {
      if (pids.every((pid) => !processIsAlive(pid))) {
        resolve();
        return;
      }
      if (Date.now() >= deadline) {
        reject(new Error(`Timed out waiting for processes to stop: ${pids.join(", ")}`));
        return;
      }
      setTimeout(poll, 20);
    };
    poll();
  });
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    const pidFiles = ["watchdog-pids", "listener-pids", "check-child-pids"];
    for (const pidFile of pidFiles) {
      const filePath = path.join(root, pidFile);
      if (!existsSync(filePath)) continue;
      for (const pid of readFileSync(filePath, "utf8").split(/\s+/u).filter(Boolean)) {
        try {
          process.kill(Number(pid), "SIGTERM");
        } catch {
          // The assertion path may already have stopped the dummy service.
        }
      }
    }
    spawnSync("/usr/bin/trash", [root], { stdio: "ignore" });
  }
});

describe("local stack process lifecycle", () => {
  it("stops all dummy listeners after repeated normal fresh rehearsals", async () => {
    const harness = createHarness();

    for (let run = 0; run < 2; run += 1) {
      const result = spawnSync("bash", [harness.lifecycleScript], {
        cwd: harness.root,
        encoding: "utf8",
        env: harnessEnv()
      });
      expect(result.status, result.stderr).toBe(0);
      expect(readFileSync(harness.eventFile, "utf8")).toContain("stop-stack");
    }

    const watchdogPids = recordedPids(harness.watchdogPidFile);
    const listenerPids = recordedPids(harness.listenerPidFile);
    expect(watchdogPids).toHaveLength(8);
    expect(listenerPids).toHaveLength(8);
    const pids = [...watchdogPids, ...listenerPids];
    await waitForPidsStopped(pids);
    const ports = readFileSync(harness.portFile, "utf8").trim().split(/\s+/u).map(Number);
    expect(ports).toHaveLength(8);
    for (const port of ports) expect(await portIsOpen(port)).toBe(false);
  });

  it("stops the active dummy listener when the rehearsal receives SIGTERM", async () => {
    const harness = createHarness();
    const child = spawn("bash", [harness.lifecycleScript], {
      cwd: harness.root,
      env: harnessEnv({ CATERING_TEST_REHEARSAL_ABORT: "1" }),
      stdio: "ignore"
    });
    const closed = new Promise<number | null>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    });

    await waitForText(harness.eventFile, "start:");
    await waitForText(harness.checkChildPidFile, "\n");
    const checkChildPids = recordedPids(harness.checkChildPidFile);
    expect(checkChildPids).toHaveLength(1);
    child.kill("SIGTERM");
    expect(await closed).not.toBe(0);
    expect(readFileSync(harness.eventFile, "utf8")).toContain("stop-stack");
    await waitForPidsStopped(checkChildPids);
    await waitForPidsStopped(allRecordedPids(harness));
  }, 10_000);
});
