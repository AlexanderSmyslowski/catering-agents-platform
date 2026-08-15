import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  utimesSync
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return {
    ...actual,
    platform: () => "darwin",
    hostname: () => "darwin-test-host"
  };
});

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return {
    ...actual,
    execFileSync: () => {
      throw new Error("ps denied by sandbox");
    }
  };
});

const context = { businessId: "local" };
const target = {
  kind: "production_draft",
  artifactId: "darwin-fingerprint-target",
  revision: 1
};

function lockPath(rootDir: string): string {
  const identity = JSON.stringify({ businessId: context.businessId, ...target });
  return path.join(
    rootDir,
    "businesses",
    context.businessId,
    "critical-tests",
    ".decision-target-locks",
    `${createHash("sha256").update(identity).digest("hex")}.lock`
  );
}

function input(rootDir: string, operation: () => Promise<void>) {
  return {
    storage: { rootDir },
    context,
    target,
    collectionNamespace: "critical-tests",
    queueFullMessage: "queue full",
    timeoutMessage: "target lock timed out",
    legacyTimeoutMessage: "legacy lock timed out",
    postgresPoolMessage: "pool required",
    operation
  };
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

describe("Darwin process fingerprint fallback", () => {
  it("does not release a live ticket when module instances observe different fallback times", async () => {
    vi.resetModules();
    const now = vi.spyOn(Date, "now");
    const uptime = vi.spyOn(process, "uptime");
    uptime.mockReturnValue(100);
    now.mockReturnValue(1_000_000);
    // @ts-expect-error Vitest query imports intentionally load a separate module instance.
    const firstModule = await import("../shared-core/src/target-critical-section.ts?darwin-fallback-first");
    vi.resetModules();
    now.mockReturnValue(1_000_001);
    // @ts-expect-error Vitest query imports intentionally load a separate module instance.
    const secondModule = await import("../shared-core/src/target-critical-section.ts?darwin-fallback-second");
    expect(secondModule.withBusinessTargetCriticalSection).not.toBe(firstModule.withBusinessTargetCriticalSection);
    expect((await import("node:os")).platform()).toBe("darwin");
    expect(process.uptime()).toBe(100);
    const childProcess = await import("node:child_process");
    expect(() => childProcess.execFileSync("ps")).toThrow("ps denied");
    now.mockRestore();
    uptime.mockRestore();

    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-critical-darwin-fingerprint-"));
    let releaseOwner!: () => void;
    let signalOwner!: () => void;
    const ownerEntered = new Promise<void>((resolve) => { signalOwner = resolve; });
    let competingEntered = false;
    const owner = firstModule.withBusinessTargetCriticalSection(input(rootDir, async () => {
      signalOwner();
      await new Promise<void>((resolve) => { releaseOwner = resolve; });
    }));
    let competitor: Promise<void> | undefined;

    try {
      await ownerEntered;
      const queuePath = `${lockPath(rootDir)}.queue`;
      const ticketName = readdirSync(queuePath).find((name) => name.startsWith("ticket-"));
      expect(ticketName).toBeDefined();
      const ticketPath = path.join(queuePath, ticketName!);
      const ownerMetadata = JSON.parse(readFileSync(ticketPath, "utf8")) as Record<string, unknown>;
      expect(ownerMetadata.processFingerprint).toBeUndefined();
      const expired = new Date(Date.now() - 60_000);
      utimesSync(ticketPath, expired, expired);
      utimesSync(lockPath(rootDir), expired, expired);

      competitor = secondModule.withBusinessTargetCriticalSection(input(rootDir, async () => {
        competingEntered = true;
      }));
      await delay(100);
      expect(competingEntered).toBe(false);

      releaseOwner();
      await Promise.all([owner, competitor]);
      expect(competingEntered).toBe(true);
    } finally {
      releaseOwner?.();
      await Promise.allSettled([owner, competitor].filter((value): value is Promise<void> => value !== undefined));
      rmSync(rootDir, { recursive: true, force: true });
      vi.restoreAllMocks();
    }
  });
});
