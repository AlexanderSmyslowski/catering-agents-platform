import { fork, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Pool as PostgresPool } from "pg";
import { afterEach, describe, expect, it } from "vitest";
import { ProductionStore } from "../production-service/src/repositories/production-store.js";
import { productionDecisionRepositoryFor } from "../production-service/src/repositories/production-decision-repository.js";

const roots: string[] = [];
const children = new Set<ChildProcess>();
const postgresConnectionString = process.env.CATERING_TEST_POSTGRES_URL;
const itWithPostgres = postgresConnectionString ? it : it.skip;

afterEach(async () => {
  for (const child of children) {
    if (child.exitCode === null) child.kill("SIGTERM");
  }
  children.clear();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function waitForMessage(child: ChildProcess, expected: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onMessage = (message: unknown) => {
      if (message !== expected) return;
      cleanup();
      resolve();
    };
    const onExit = (code: number | null) => {
      cleanup();
      reject(new Error(`Lock-Child endete vor ${expected} mit ${code}.`));
    };
    const cleanup = () => {
      child.off("message", onMessage);
      child.off("exit", onExit);
    };
    child.on("message", onMessage);
    child.on("exit", onExit);
  });
}

function startChild(rootDir: string, artifactId: string): ChildProcess {
  const child = fork(
    path.resolve("tests/fixtures/production-target-lock-child.ts"),
    [rootDir, artifactId],
    { execArgv: ["--import", "tsx"], stdio: ["ignore", "ignore", "inherit", "ipc"] }
  );
  children.add(child);
  return child;
}

describe("Production decision critical section", () => {
  it("serialisiert dasselbe Ziel über getrennte Dateiprozesse", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "production-process-lock-"));
    roots.push(rootDir);
    const first = startChild(rootDir, "draft-process-lock");
    await waitForMessage(first, "entered");
    const second = startChild(rootDir, "draft-process-lock");
    let secondEntered = false;
    second.on("message", (message) => { if (message === "entered") secondEntered = true; });

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(secondEntered).toBe(false);
    first.send("release");
    await waitForMessage(first, "done");
    await waitForMessage(second, "entered");
    second.send("release");
    await waitForMessage(second, "done");
  }, 15_000);

  itWithPostgres("serialisiert dasselbe Ziel über echte PostgreSQL-Verbindungen", async () => {
    const postgres = new PostgresPool({ connectionString: postgresConnectionString });
    const target = { kind: "production_draft" as const, artifactId: "draft-real-pg-lock", revision: 1 };
    const firstRepository = productionDecisionRepositoryFor(new ProductionStore({ pgPool: postgres }));
    const secondRepository = productionDecisionRepositoryFor(new ProductionStore({ pgPool: postgres }));
    let releaseFirst!: () => void;
    let signalFirstEntered!: () => void;
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const firstEntered = new Promise<void>((resolve) => { signalFirstEntered = resolve; });
    let secondEntered = false;
    try {
      const first = firstRepository.withTargetCriticalSection(
        { businessId: "local" },
        target,
        async () => {
          signalFirstEntered();
          await firstGate;
        }
      );
      await firstEntered;
      const second = secondRepository.withTargetCriticalSection(
        { businessId: "local" },
        target,
        async () => { secondEntered = true; }
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(secondEntered).toBe(false);
      releaseFirst();
      await Promise.all([first, second]);
      expect(secondEntered).toBe(true);
    } finally {
      releaseFirst?.();
      await postgres.end();
    }
  }, 20_000);
});
