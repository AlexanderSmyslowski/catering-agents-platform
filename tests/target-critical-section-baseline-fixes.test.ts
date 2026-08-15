import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
  mkdirSync,
  unlinkSync
} from "node:fs";
import { createHash } from "node:crypto";
import { hostname, tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { withBusinessTargetCriticalSection } from "@catering/shared-core";
import type { CriticalSectionTarget } from "@catering/shared-core";

const context = { businessId: "local" };
const target: CriticalSectionTarget = {
  kind: "production_draft",
  artifactId: "baseline-fix-target",
  revision: 1
};

function lockPath(rootDir: string): string {
  const lockRoot = path.join(rootDir, "businesses", context.businessId, "critical-tests", ".decision-target-locks");
  const identity = JSON.stringify({ businessId: context.businessId, ...target });
  return path.join(lockRoot, `${createHash("sha256").update(identity).digest("hex")}.lock`);
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

describe("critical-section baseline regressions", () => {
  it("reclaims expired PID-reuse tickets only when the process identity is verifiable", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-critical-baseline-fingerprint-"));
    let releaseOwner!: () => void;
    let signalOwner!: () => void;
    const ownerEntered = new Promise<void>((resolve) => { signalOwner = resolve; });
    const owner = withBusinessTargetCriticalSection(input(rootDir, async () => {
      signalOwner();
      await new Promise<void>((resolve) => { releaseOwner = resolve; });
    }));

    try {
      await ownerEntered;
      const ownerLock = lockPath(rootDir);
      const queuePath = `${ownerLock}.queue`;
      const ticketName = readdirSync(queuePath).find((name) => name.startsWith("ticket-"));
      expect(ticketName).toBeDefined();
      const metadata = JSON.parse(readFileSync(path.join(queuePath, ticketName!), "utf8")) as Record<string, unknown>;
      const fingerprintVerified = typeof metadata.processFingerprint === "string";

      releaseOwner();
      await owner;

      const staleTicket = path.join(queuePath, "ticket-000000000002.json");
      writeFileSync(staleTicket, JSON.stringify({
        pid: process.pid,
        token: "old-incarnation",
        lease: "heartbeat-v1",
        hostname: hostname(),
        processFingerprint: "different-process-incarnation",
        processInstanceId: "old-module-instance"
      }));
      const expired = new Date(Date.now() - 60_000);
      utimesSync(staleTicket, expired, expired);

      let entered = false;
      const pending = withBusinessTargetCriticalSection(input(rootDir, async () => { entered = true; }));
      if (fingerprintVerified) {
        await pending;
        expect(entered).toBe(true);
        expect(readdirSync(queuePath).filter((name) => name === "released-000000000002")).toHaveLength(1);
      } else {
        await delay(100);
        expect(entered).toBe(false);
        expect(readdirSync(queuePath).filter((name) => name === "released-000000000002")).toHaveLength(0);
        writeFileSync(path.join(queuePath, "released-000000000002"), "");
        await pending;
        expect(entered).toBe(true);
      }
    } finally {
      releaseOwner?.();
      await owner.catch(() => undefined);
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("does not reclaim a stale same-PID ticket when its identity is unprovable", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-critical-baseline-fail-closed-"));
    const lockFile = lockPath(rootDir);
    mkdirSync(path.dirname(lockFile), { recursive: true });
    const queuePath = `${lockFile}.queue`;
    mkdirSync(queuePath, { recursive: true });
    const ticketPath = path.join(queuePath, "ticket-000000000001.json");
    writeFileSync(ticketPath, JSON.stringify({
      pid: process.pid,
      token: "missing-identity",
      lease: "heartbeat-v1",
      hostname: hostname(),
      processInstanceId: "unknown-worker"
    }));
    const expired = new Date(Date.now() - 60_000);
    utimesSync(ticketPath, expired, expired);

    let entered = false;
    const pending = withBusinessTargetCriticalSection(input(rootDir, async () => { entered = true; }));
    try {
      await delay(100);
      expect(entered).toBe(false);
      expect(existsSync(path.join(queuePath, "released-000000000001"))).toBe(false);
      writeFileSync(path.join(queuePath, "released-000000000001"), "");
      await pending;
    } finally {
      if (!existsSync(path.join(queuePath, "released-000000000001"))) {
        writeFileSync(path.join(queuePath, "released-000000000001"), "");
      }
      await pending.catch(() => undefined);
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  const malformedTicketCases = [
    ["malformed JSON", "{not-json"],
    ["truncated JSON", `{"pid":${process.pid},"token":"truncated"`],
    ["invalid schema", JSON.stringify({ pid: "not-a-pid", token: "invalid" })],
    ["wrong field type", JSON.stringify({ pid: process.pid, token: 42 })],
    ["unknown lease version", JSON.stringify({
      pid: 999_999_999,
      token: "future-lease",
      lease: "heartbeat-v2",
      hostname: hostname()
    })],
    ["unknown format version", JSON.stringify({
      pid: 999_999_999,
      token: "future-format",
      formatVersion: 2
    })]
  ] as const;

  it.each(malformedTicketCases)("keeps %s stale queue tickets active and unchanged", async (_label, raw) => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-critical-malformed-ticket-"));
    const lockFile = lockPath(rootDir);
    const queuePath = `${lockFile}.queue`;
    const ticketPath = path.join(queuePath, "ticket-000000000001.json");
    mkdirSync(queuePath, { recursive: true });
    writeFileSync(ticketPath, raw);
    const expired = new Date(Date.now() - 60_000);
    utimesSync(ticketPath, expired, expired);
    let entered = false;
    const pending = withBusinessTargetCriticalSection(input(rootDir, async () => { entered = true; }));

    try {
      await delay(100);
      expect(entered).toBe(false);
      expect(existsSync(path.join(queuePath, "released-000000000001"))).toBe(false);
      expect(readFileSync(ticketPath, "utf8")).toBe(raw);
      writeFileSync(path.join(queuePath, "released-000000000001"), "");
      await Promise.race([
        pending,
        delay(500).then(() => { throw new Error("malformed ticket did not unblock after explicit release"); })
      ]);
      expect(entered).toBe(true);
      expect(readFileSync(ticketPath, "utf8")).toBe(raw);
    } finally {
      if (!existsSync(path.join(queuePath, "released-000000000001"))) {
        writeFileSync(path.join(queuePath, "released-000000000001"), "");
      }
      await pending.catch(() => undefined);
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  const strictSchemaTicketCases = [
    ["unknown extra field", JSON.stringify({
      pid: 999_999_999,
      token: "dead-owner",
      lease: "heartbeat-v1",
      unexpectedField: "x"
    })],
    ["wrong lease type", JSON.stringify({ pid: 999_999_999, token: "dead-owner", lease: 42 })],
    ["wrong hostname type", JSON.stringify({ pid: 999_999_999, token: "dead-owner", hostname: 42 })],
    ["wrong process fingerprint type", JSON.stringify({
      pid: 999_999_999,
      token: "dead-owner",
      processFingerprint: 42
    })],
    ["wrong process instance type", JSON.stringify({
      pid: 999_999_999,
      token: "dead-owner",
      processInstanceId: 42
    })],
    ["zero pid", JSON.stringify({ pid: 0, token: "dead-owner" })],
    ["negative pid", JSON.stringify({ pid: -1, token: "dead-owner" })],
    ["fractional pid", JSON.stringify({ pid: 1.5, token: "dead-owner" })],
    ["unsafe pid", JSON.stringify({ pid: Number.MAX_SAFE_INTEGER + 1, token: "dead-owner" })],
    ["missing token", JSON.stringify({ pid: 999_999_999 })],
    ["empty token", JSON.stringify({ pid: 999_999_999, token: "" })],
    ["wrong token type", JSON.stringify({ pid: 999_999_999, token: 42 })],
    ["array", JSON.stringify([{ pid: 999_999_999, token: "dead-owner" }])],
    ["null", "null"],
    ["primitive", "7"],
    ["malformed", "{not-json"],
    ["truncated", '{"pid":999999999,"token":"dead-owner"']
  ] as const;

  it.each(strictSchemaTicketCases)("keeps %s stale queue ticket active and unchanged", async (_label, raw) => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-critical-strict-schema-queue-"));
    const lockFile = lockPath(rootDir);
    const queuePath = `${lockFile}.queue`;
    const ticketPath = path.join(queuePath, "ticket-000000000001.json");
    mkdirSync(queuePath, { recursive: true });
    writeFileSync(ticketPath, raw);
    const expired = new Date(Date.now() - 60_000);
    utimesSync(ticketPath, expired, expired);
    let entered = false;
    const pending = withBusinessTargetCriticalSection(input(rootDir, async () => { entered = true; }));

    try {
      await delay(100);
      expect(entered).toBe(false);
      expect(existsSync(path.join(queuePath, "released-000000000001"))).toBe(false);
      expect(readFileSync(ticketPath, "utf8")).toBe(raw);
      writeFileSync(path.join(queuePath, "released-000000000001"), "");
      await Promise.race([
        pending,
        delay(500).then(() => { throw new Error("strict-schema ticket did not unblock after explicit release"); })
      ]);
      expect(entered).toBe(true);
      expect(readFileSync(ticketPath, "utf8")).toBe(raw);
    } finally {
      if (!existsSync(path.join(queuePath, "released-000000000001"))) {
        writeFileSync(path.join(queuePath, "released-000000000001"), "");
      }
      await pending.catch(() => undefined);
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it.each(strictSchemaTicketCases)("keeps %s stale legacy lock active and unchanged", async (_label, raw) => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-critical-strict-schema-legacy-"));
    const lockFile = lockPath(rootDir);
    mkdirSync(path.dirname(lockFile), { recursive: true });
    writeFileSync(lockFile, raw);
    const expired = new Date(Date.now() - 60_000);
    utimesSync(lockFile, expired, expired);
    let entered = false;
    const pending = withBusinessTargetCriticalSection(input(rootDir, async () => { entered = true; }));

    try {
      await delay(100);
      expect(entered).toBe(false);
      expect(existsSync(lockFile)).toBe(true);
      expect(readFileSync(lockFile, "utf8")).toBe(raw);
      unlinkSync(lockFile);
      await Promise.race([
        pending,
        delay(500).then(() => { throw new Error("strict-schema legacy lock did not unblock after explicit removal"); })
      ]);
      expect(entered).toBe(true);
    } finally {
      if (existsSync(lockFile)) unlinkSync(lockFile);
      await pending.catch(() => undefined);
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("does not treat a non-ENOENT ticket read error as a missing or releasable ticket", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-critical-ticket-read-error-"));
    const lockFile = lockPath(rootDir);
    const queuePath = `${lockFile}.queue`;
    const ticketPath = path.join(queuePath, "ticket-000000000001.json");
    mkdirSync(ticketPath, { recursive: true });
    const expired = new Date(Date.now() - 60_000);
    utimesSync(ticketPath, expired, expired);
    let entered = false;

    try {
      let failure: unknown;
      try {
        await withBusinessTargetCriticalSection(input(rootDir, async () => { entered = true; }));
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeDefined();
      expect((failure as NodeJS.ErrnoException).code).not.toBe("ENOENT");
      expect(entered).toBe(false);
      expect(existsSync(path.join(queuePath, "released-000000000001"))).toBe(false);
      expect(existsSync(ticketPath)).toBe(true);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("distinguishes an absent earlier ticket from a damaged ticket for normal queue creation", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-critical-missing-ticket-"));
    let entered = false;
    try {
      await withBusinessTargetCriticalSection(input(rootDir, async () => { entered = true; }));
      expect(entered).toBe(true);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("keeps a damaged ticket fenced while parallel reclaimers wait boundedly", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-critical-parallel-malformed-"));
    const lockFile = lockPath(rootDir);
    const queuePath = `${lockFile}.queue`;
    const ticketPath = path.join(queuePath, "ticket-000000000001.json");
    mkdirSync(queuePath, { recursive: true });
    const raw = "{not-json";
    writeFileSync(ticketPath, raw);
    const expired = new Date(Date.now() - 60_000);
    utimesSync(ticketPath, expired, expired);
    let entered = 0;
    const first = withBusinessTargetCriticalSection(input(rootDir, async () => { entered += 1; }));
    const second = withBusinessTargetCriticalSection(input(rootDir, async () => { entered += 1; }));

    try {
      await delay(100);
      expect(entered).toBe(0);
      expect(existsSync(path.join(queuePath, "released-000000000001"))).toBe(false);
      expect(readFileSync(ticketPath, "utf8")).toBe(raw);
      writeFileSync(path.join(queuePath, "released-000000000001"), "");
      await Promise.race([
        Promise.all([first, second]),
        delay(500).then(() => { throw new Error("parallel reclaimers did not terminate after explicit release"); })
      ]);
      expect(entered).toBe(2);
      expect(readFileSync(ticketPath, "utf8")).toBe(raw);
    } finally {
      if (!existsSync(path.join(queuePath, "released-000000000001"))) {
        writeFileSync(path.join(queuePath, "released-000000000001"), "");
      }
      await Promise.allSettled([first, second]);
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("serializes parallel operations and leaves only durable release markers", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-critical-baseline-parallel-"));
    let releaseFirst!: () => void;
    let signalFirst!: () => void;
    const firstEntered = new Promise<void>((resolve) => { signalFirst = resolve; });
    const first = withBusinessTargetCriticalSection(input(rootDir, async () => {
      signalFirst();
      await new Promise<void>((resolve) => { releaseFirst = resolve; });
    }));
    let secondEntered = false;
    const second = withBusinessTargetCriticalSection(input(rootDir, async () => { secondEntered = true; }));

    try {
      await firstEntered;
      await delay(100);
      expect(secondEntered).toBe(false);
      releaseFirst();
      await Promise.all([first, second]);
      const queuePath = `${lockPath(rootDir)}.queue`;
      const ticketNames = readdirSync(queuePath).filter((name) => name.startsWith("ticket-") && name.endsWith(".json"));
      expect(ticketNames).toHaveLength(2);
      expect(ticketNames.every((name) => existsSync(
        path.join(queuePath, name.replace("ticket-", "released-").replace(".json", ""))
      ))).toBe(true);
    } finally {
      releaseFirst?.();
      await Promise.allSettled([first, second]);
      rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
