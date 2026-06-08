import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

type RuntimeService = {
  name: string;
  command: string;
  args: string[];
  expectedService: string;
};

const services: RuntimeService[] = [
  {
    name: "intake",
    command: "npm",
    args: ["run", "dev:intake"],
    expectedService: "intake-service"
  },
  {
    name: "offer",
    command: "npm",
    args: ["run", "dev:offer"],
    expectedService: "offer-service"
  },
  {
    name: "production",
    command: "npm",
    args: ["run", "dev:production"],
    expectedService: "production-service"
  },
  {
    name: "print-export",
    command: "npm",
    args: ["run", "dev:exports"],
    expectedService: "print-export"
  }
];

const runningProcesses: ChildProcessWithoutNullStreams[] = [];

async function freeLocalPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (typeof address === "object" && address !== null) {
        const port = address.port;
        server.close(() => resolve(port));
        return;
      }

      server.close(() => reject(new Error("Could not allocate a local port.")));
    });
  });
}

function commandExists(command: string): boolean {
  try {
    execFileSync("sh", ["-c", `command -v ${command}`], {
      stdio: "ignore"
    });
    return true;
  } catch {
    return false;
  }
}

function listenerReport(port: number): string {
  if (commandExists("lsof")) {
    return execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"], {
      encoding: "utf8"
    });
  }

  if (commandExists("ss")) {
    return execFileSync("ss", ["-ltn"], {
      encoding: "utf8"
    })
      .split("\n")
      .filter((line) => line.includes(`:${port}`))
      .join("\n");
  }

  throw new Error("Neither lsof nor ss is available for runtime bind verification.");
}

async function waitForListenerReport(port: number): Promise<string> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const listeners = listenerReport(port);
      if (listeners.includes(`:${port}`)) {
        return listeners;
      }
      lastError = new Error(`No listener line for port ${port}.`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw lastError instanceof Error ? lastError : new Error("Listener probe did not complete.");
}

async function waitForHealth(port: number): Promise<{ service: string; status: string }> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) {
        return (await response.json()) as { service: string; status: string };
      }
      lastError = new Error(`Unexpected health response ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw lastError instanceof Error ? lastError : new Error("Health probe did not complete.");
}

async function stopProcess(process: ChildProcessWithoutNullStreams): Promise<void> {
  if (process.exitCode !== null || process.killed) {
    return;
  }

  process.kill();
  await new Promise<void>((resolve) => {
    process.once("exit", () => resolve());
    setTimeout(resolve, 2_000);
  });
}

afterEach(async () => {
  await Promise.all(runningProcesses.splice(0).map((process) => stopProcess(process)));
});

describe("runtime service smoke", () => {
  it.each(services)("starts $name on localhost only", async (service) => {
    const dataRoot = mkdtempSync(join(tmpdir(), `catering-${service.name}-`));
    const port = await freeLocalPort();
    const logs: string[] = [];

    const child = spawn(service.command, service.args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CATERING_DATA_ROOT: dataRoot,
        PORT: String(port),
        HOST: undefined
      }
    });
    runningProcesses.push(child);

    child.stdout.on("data", (chunk) => logs.push(String(chunk)));
    child.stderr.on("data", (chunk) => logs.push(String(chunk)));

    try {
      const health = await waitForHealth(port);

      expect(health).toMatchObject({
        service: service.expectedService,
        status: "ok"
      });

      const listeners = await waitForListenerReport(port);
      expect(listeners).toContain(`127.0.0.1:${port}`);
      expect(listeners).not.toContain(`0.0.0.0:${port}`);

      await stopProcess(child);
      expect(child.killed || child.exitCode !== null).toBe(true);
    } catch (error) {
      throw new Error(
        `${service.name} runtime smoke failed: ${error instanceof Error ? error.message : String(error)}\n${logs.join("")}`
      );
    } finally {
      rmSync(dataRoot, {
        force: true,
        recursive: true
      });
    }
  }, 20_000);
});
