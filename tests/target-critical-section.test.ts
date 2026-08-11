import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  unlinkSync,
  utimesSync,
  writeFileSync
} from "node:fs";
import { hostname, tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  withBusinessTargetCriticalSection,
  type CollectionStorageOptions,
  type CriticalSectionTarget,
  type Queryable
} from "@catering/shared-core";

const context = { businessId: "local" };
const target = { kind: "production_draft", artifactId: "draft-lock-test", revision: 1 };
const namespace = "lock-tests";

function targetLockPath(rootDir: string, lockTarget: CriticalSectionTarget = target): string {
  const identity = JSON.stringify({ businessId: context.businessId, ...lockTarget });
  return path.join(
    rootDir,
    "businesses",
    context.businessId,
    namespace,
    ".decision-target-locks",
    `${createHash("sha256").update(identity).digest("hex")}.lock`
  );
}

function lockInput<T>(
  storage: CollectionStorageOptions,
  operation: (transactionalQueryable?: Queryable) => Promise<T>,
  options: {
    target?: CriticalSectionTarget;
    compatibilityTargets?: CriticalSectionTarget[];
  } = {}
) {
  return {
    storage,
    context,
    target: options.target ?? target,
    ...(options.compatibilityTargets ? { compatibilityTargets: options.compatibilityTargets } : {}),
    collectionNamespace: namespace,
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

class MockPostgresAdvisoryLocks {
  private readonly holders = new Set<string>();
  private readonly waiters = new Map<string, Array<() => void>>();

  pool() {
    return {
      query: async () => ({ rows: [] }),
      connect: async () => {
        const held: string[] = [];
        const releaseHeld = () => {
          for (const key of held.splice(0).reverse()) {
            this.holders.delete(key);
            for (const wake of this.waiters.get(key) ?? []) wake();
            this.waiters.delete(key);
          }
        };
        return {
          query: async (sql: string, params: unknown[] = []) => {
            if (sql.includes("pg_advisory_xact_lock")) {
              const key = String(params[0]);
              while (this.holders.has(key)) {
                await new Promise<void>((resolve) => {
                  const waiters = this.waiters.get(key) ?? [];
                  waiters.push(resolve);
                  this.waiters.set(key, waiters);
                });
              }
              this.holders.add(key);
              held.push(key);
            } else if (sql === "COMMIT" || sql === "ROLLBACK") {
              releaseHeld();
            }
            return { rows: [] };
          },
          release: () => releaseHeld()
        };
      }
    };
  }
}

function pgMemPool() {
  const missingAdvisoryLock = new Error("function pg_advisory_xact_lock(bigint) does not exist");
  missingAdvisoryLock.stack = `${missingAdvisoryLock.message}\nnode_modules/pg-mem/index.js`;
  return {
    query: async () => ({ rows: [] }),
    connect: async () => ({
      query: async (sql: string) => {
        if (sql.includes("pg_advisory_xact_lock")) throw missingAdvisoryLock;
        return { rows: [] };
      },
      release: () => undefined
    })
  };
}

describe("business target critical section", () => {
  it("sets a ten-second PostgreSQL lock timeout and translates lock expiry", async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const timeoutError = Object.assign(new Error("canceling statement due to lock timeout"), {
      code: "55P03"
    });
    const client = {
      async query(sql: string, params: unknown[] = []) {
        calls.push({ sql, params });
        if (sql.includes("pg_advisory_xact_lock")) throw timeoutError;
        return { rows: [] };
      },
      release: vi.fn()
    };
    const pgPool = {
      async query() {
        return { rows: [] };
      },
      async connect() {
        return client;
      }
    };

    await expect(withBusinessTargetCriticalSection(lockInput(
      { pgPool },
      async () => undefined
    ))).rejects.toThrow("target lock timed out");

    const timeoutCall = calls.find(({ sql }) => sql.includes("set_config") && sql.includes("lock_timeout"));
    expect(timeoutCall?.params).toEqual(["10000ms"]);
    expect(calls.map(({ sql }) => sql)).toEqual([
      "BEGIN",
      expect.stringContaining("lock_timeout"),
      "SELECT pg_catalog.pg_advisory_xact_lock($1::bigint)",
      "ROLLBACK"
    ]);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("retains the documented in-process pg-mem fallback", async () => {
    const missingAdvisoryLock = new Error("function pg_advisory_xact_lock(bigint) does not exist");
    missingAdvisoryLock.stack = `${missingAdvisoryLock.message}\nnode_modules/pg-mem/index.js`;
    const client = {
      async query(sql: string) {
        if (sql.includes("pg_advisory_xact_lock")) throw missingAdvisoryLock;
        return { rows: [] };
      },
      release: vi.fn()
    };
    const operation = vi.fn(async (transactionalQueryable?: Queryable) => {
      expect(transactionalQueryable).toBeUndefined();
      return "fallback-result";
    });
    const pgPool = {
      async query() {
        return { rows: [] };
      },
      async connect() {
        return client;
      }
    };

    await expect(withBusinessTargetCriticalSection(lockInput(
      { pgPool },
      operation
    ))).resolves.toBe("fallback-result");
    expect(operation).toHaveBeenCalledOnce();
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("waits for a legacy revision file lock before entering through the canonical target", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-target-file-compatibility-"));
    const legacyTarget = { ...target, revision: 1 };
    const canonicalTarget = { ...target, revision: 0 };
    let releaseLegacy!: () => void;
    const legacyGate = new Promise<void>((resolve) => { releaseLegacy = resolve; });
    let signalLegacyEntered!: () => void;
    const legacyEntered = new Promise<void>((resolve) => { signalLegacyEntered = resolve; });
    const legacy = withBusinessTargetCriticalSection(lockInput(
      { rootDir },
      async () => {
        signalLegacyEntered();
        await legacyGate;
      },
      { target: legacyTarget }
    ));
    let canonicalEntered = false;
    let canonical: Promise<void> | undefined;

    try {
      await legacyEntered;
      canonical = withBusinessTargetCriticalSection(lockInput(
        { rootDir },
        async () => { canonicalEntered = true; },
        { target: canonicalTarget, compatibilityTargets: [legacyTarget, canonicalTarget] }
      ));
      await delay(100);
      expect(canonicalEntered).toBe(false);
      releaseLegacy();
      await Promise.all([legacy, canonical]);
      expect(canonicalEntered).toBe(true);
    } finally {
      releaseLegacy();
      await Promise.allSettled([legacy, ...(canonical ? [canonical] : [])]);
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("waits for a legacy revision PostgreSQL lock before entering through the canonical target", async () => {
    const locks = new MockPostgresAdvisoryLocks();
    const pgPool = locks.pool();
    const legacyTarget = { ...target, revision: 1 };
    const canonicalTarget = { ...target, revision: 0 };
    let releaseLegacy!: () => void;
    const legacyGate = new Promise<void>((resolve) => { releaseLegacy = resolve; });
    let signalLegacyEntered!: () => void;
    const legacyEntered = new Promise<void>((resolve) => { signalLegacyEntered = resolve; });
    const legacy = withBusinessTargetCriticalSection(lockInput(
      { pgPool },
      async () => {
        signalLegacyEntered();
        await legacyGate;
      },
      { target: legacyTarget }
    ));
    let canonicalEntered = false;
    let canonical: Promise<void> | undefined;

    try {
      await legacyEntered;
      canonical = withBusinessTargetCriticalSection(lockInput(
        { pgPool },
        async () => { canonicalEntered = true; },
        { target: canonicalTarget, compatibilityTargets: [legacyTarget] }
      ));
      await delay(100);
      expect(canonicalEntered).toBe(false);
      releaseLegacy();
      await Promise.all([legacy, canonical]);
      expect(canonicalEntered).toBe(true);
    } finally {
      releaseLegacy();
      await Promise.allSettled([legacy, ...(canonical ? [canonical] : [])]);
    }
  });

  it("orders opposite pg-mem compatibility target inputs without deadlocking", async () => {
    const pgPool = pgMemPool();
    const revisionZero = { ...target, revision: 0 };
    const revisionOne = { ...target, revision: 1 };
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    let signalFirstEntered!: () => void;
    const firstEntered = new Promise<void>((resolve) => { signalFirstEntered = resolve; });
    const first = withBusinessTargetCriticalSection(lockInput(
      { pgPool },
      async () => {
        signalFirstEntered();
        await firstGate;
      },
      { target: revisionOne, compatibilityTargets: [revisionZero] }
    ));
    let secondEntered = false;
    let second: Promise<void> | undefined;

    try {
      await firstEntered;
      second = withBusinessTargetCriticalSection(lockInput(
        { pgPool },
        async () => { secondEntered = true; },
        { target: revisionZero, compatibilityTargets: [revisionOne] }
      ));
      await delay(100);
      expect(secondEntered).toBe(false);
      releaseFirst();
      await Promise.all([first, second]);
      expect(secondEntered).toBe(true);
    } finally {
      releaseFirst();
      await Promise.allSettled([first, ...(second ? [second] : [])]);
    }
  });

  it("reclaims an expired file ticket even when its PID has been reused", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-target-lease-stale-"));
    const lockPath = targetLockPath(rootDir);
    const queuePath = `${lockPath}.queue`;
    const staleTicketPath = path.join(queuePath, "ticket-000000000001.json");
    mkdirSync(queuePath, { recursive: true });
    writeFileSync(staleTicketPath, JSON.stringify({
      pid: process.pid,
      token: "previous-process",
      lease: "heartbeat-v1",
      hostname: hostname(),
      processFingerprint: "definitely-not-the-current-process",
      processInstanceId: "previous-process-instance"
    }));
    const expired = new Date(Date.now() - 60_000);
    utimesSync(staleTicketPath, expired, expired);
    let entered = false;
    const pending = withBusinessTargetCriticalSection(lockInput(
      { rootDir },
      async () => { entered = true; }
    ));

    try {
      await Promise.race([
        pending,
        delay(250).then(() => { throw new Error("expired ticket was not reclaimed"); })
      ]);
      expect(entered).toBe(true);
      expect(existsSync(path.join(queuePath, "released-000000000001"))).toBe(true);
    } finally {
      if (!existsSync(path.join(queuePath, "released-000000000001"))) {
        writeFileSync(path.join(queuePath, "released-000000000001"), "");
      }
      await pending.catch(() => undefined);
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("renews the file-ticket lease while the owning operation is active", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-08-11T00:00:00.000Z"));
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-target-lease-active-"));
    const lockPath = targetLockPath(rootDir);
    const queuePath = `${lockPath}.queue`;
    let releaseOperation!: () => void;
    const operationGate = new Promise<void>((resolve) => { releaseOperation = resolve; });
    let signalEntered!: () => void;
    const entered = new Promise<void>((resolve) => { signalEntered = resolve; });
    const first = withBusinessTargetCriticalSection(lockInput(
      { rootDir },
      async () => {
        signalEntered();
        await operationGate;
      }
    ));

    try {
      await entered;
      const firstTicketName = readdirSync(queuePath).find((name) => name.startsWith("ticket-"));
      expect(firstTicketName).toBeDefined();
      const firstTicketPath = path.join(queuePath, firstTicketName!);
      const initialMtime = statSync(firstTicketPath).mtimeMs;

      await vi.advanceTimersByTimeAsync(35_000);
      expect(statSync(firstTicketPath).mtimeMs).toBeGreaterThan(initialMtime);
      expect(Date.now() - statSync(firstTicketPath).mtimeMs).toBeLessThan(30_000);
      expect(existsSync(path.join(
        queuePath,
        firstTicketName!.replace("ticket-", "released-").replace(".json", "")
      ))).toBe(false);
    } finally {
      releaseOperation();
      await first.catch(() => undefined);
      vi.useRealTimers();
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("does not evict a live same-process owner from another worker when its heartbeat is stale", async () => {
    const ownerRoot = mkdtempSync(path.join(tmpdir(), "catering-target-owner-identity-"));
    const probeRoot = mkdtempSync(path.join(tmpdir(), "catering-target-owner-probe-"));
    let releaseOwner!: () => void;
    const ownerGate = new Promise<void>((resolve) => { releaseOwner = resolve; });
    let signalOwnerEntered!: () => void;
    const ownerEntered = new Promise<void>((resolve) => { signalOwnerEntered = resolve; });
    const owner = withBusinessTargetCriticalSection(lockInput(
      { rootDir: ownerRoot },
      async () => {
        signalOwnerEntered();
        await ownerGate;
      }
    ));
    let probe: Promise<void> | undefined;

    try {
      await ownerEntered;
      const ownerQueuePath = `${targetLockPath(ownerRoot)}.queue`;
      const ownerTicketName = readdirSync(ownerQueuePath).find((name) => name.startsWith("ticket-"));
      const ownerMetadata = JSON.parse(
        readFileSync(path.join(ownerQueuePath, ownerTicketName!), "utf8")
      ) as Record<string, unknown>;
      expect(ownerMetadata.processFingerprint).toEqual(expect.any(String));
      const probeQueuePath = `${targetLockPath(probeRoot)}.queue`;
      mkdirSync(probeQueuePath, { recursive: true });
      const copiedTicket = path.join(probeQueuePath, "ticket-000000000001.json");
      writeFileSync(copiedTicket, JSON.stringify({
        ...ownerMetadata,
        processInstanceId: "different-worker-module-instance"
      }));
      const expired = new Date(Date.now() - 60_000);
      utimesSync(copiedTicket, expired, expired);
      let probeEntered = false;
      probe = withBusinessTargetCriticalSection(lockInput(
        { rootDir: probeRoot },
        async () => { probeEntered = true; }
      ));

      await delay(100);
      expect(probeEntered).toBe(false);
      expect(existsSync(path.join(probeQueuePath, "released-000000000001"))).toBe(false);
      writeFileSync(path.join(probeQueuePath, "released-000000000001"), "");
      await probe;
      expect(probeEntered).toBe(true);
    } finally {
      const probeRelease = path.join(`${targetLockPath(probeRoot)}.queue`, "released-000000000001");
      if (probe && !existsSync(probeRelease)) writeFileSync(probeRelease, "");
      await probe?.catch(() => undefined);
      releaseOwner();
      await owner.catch(() => undefined);
      rmSync(ownerRoot, { recursive: true, force: true });
      rmSync(probeRoot, { recursive: true, force: true });
    }
  });

  it("fails closed when a stale same-PID worker ticket has no process fingerprint", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-target-worker-lease-"));
    const queuePath = `${targetLockPath(rootDir)}.queue`;
    mkdirSync(queuePath, { recursive: true });
    writeFileSync(path.join(queuePath, "ticket-000000000001.json"), JSON.stringify({
      pid: process.pid,
      token: "other-worker",
      lease: "heartbeat-v1",
      processInstanceId: "different-module-instance"
    }));
    let entered = false;
    const pending = withBusinessTargetCriticalSection(lockInput(
      { rootDir },
      async () => { entered = true; }
    ));

    try {
      await delay(100);
      expect(entered).toBe(false);
      expect(existsSync(path.join(queuePath, "released-000000000001"))).toBe(false);
      const expired = new Date(Date.now() - 60_000);
      utimesSync(path.join(queuePath, "ticket-000000000001.json"), expired, expired);
      await delay(100);
      expect(entered).toBe(false);
      expect(existsSync(path.join(queuePath, "released-000000000001"))).toBe(false);
      writeFileSync(path.join(queuePath, "released-000000000001"), "");
      await pending;
      expect(entered).toBe(true);
    } finally {
      if (!existsSync(path.join(queuePath, "released-000000000001"))) {
        writeFileSync(path.join(queuePath, "released-000000000001"), "");
      }
      await pending;
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("reclaims a stale same-host ticket from a terminated legacy owner without a fingerprint", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-target-legacy-ticket-dead-"));
    const queuePath = `${targetLockPath(rootDir)}.queue`;
    const ticketPath = path.join(queuePath, "ticket-000000000001.json");
    mkdirSync(queuePath, { recursive: true });
    writeFileSync(ticketPath, JSON.stringify({
      pid: 999_999_999,
      token: "terminated-legacy-owner",
      lease: "heartbeat-v1",
      hostname: hostname()
    }));
    const expired = new Date(Date.now() - 60_000);
    utimesSync(ticketPath, expired, expired);
    let entered = false;

    try {
      await expect(withBusinessTargetCriticalSection(lockInput(
        { rootDir },
        async () => { entered = true; }
      ))).resolves.toBeUndefined();
      expect(entered).toBe(true);
      expect(existsSync(path.join(queuePath, "released-000000000001"))).toBe(true);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("fails closed for a stale queue ticket owned by another host", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-target-foreign-ticket-"));
    const lockPath = targetLockPath(rootDir);
    const queuePath = `${lockPath}.queue`;
    const foreignOwner = {
      pid: 999_999_999,
      token: "foreign-host-owner",
      lease: "heartbeat-v1",
      hostname: "another-host.invalid",
      processFingerprint: "foreign:process"
    };
    mkdirSync(queuePath, { recursive: true });
    const ticketPath = path.join(queuePath, "ticket-000000000001.json");
    writeFileSync(ticketPath, JSON.stringify(foreignOwner));
    const expired = new Date(Date.now() - 60_000);
    utimesSync(ticketPath, expired, expired);
    let entered = false;
    const pending = withBusinessTargetCriticalSection(lockInput(
      { rootDir },
      async () => { entered = true; }
    ));

    try {
      await delay(100);
      expect(entered).toBe(false);
      expect(existsSync(ticketPath)).toBe(true);
      expect(existsSync(path.join(queuePath, "released-000000000001"))).toBe(false);
      writeFileSync(path.join(queuePath, "released-000000000001"), "");
      await pending;
      expect(entered).toBe(true);
    } finally {
      if (!existsSync(path.join(queuePath, "released-000000000001"))) {
        writeFileSync(path.join(queuePath, "released-000000000001"), "");
      }
      await pending.catch(() => undefined);
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("fails closed for a stale legacy lock owned by another host", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-target-foreign-legacy-"));
    const lockPath = targetLockPath(rootDir);
    mkdirSync(path.dirname(lockPath), { recursive: true });
    writeFileSync(lockPath, JSON.stringify({
      pid: 999_999_999,
      token: "foreign-host-owner",
      lease: "heartbeat-v1",
      hostname: "another-host.invalid",
      processFingerprint: "foreign:process"
    }));
    const expired = new Date(Date.now() - 60_000);
    utimesSync(lockPath, expired, expired);
    let entered = false;
    const pending = withBusinessTargetCriticalSection(lockInput(
      { rootDir },
      async () => { entered = true; }
    ));

    try {
      await delay(100);
      expect(entered).toBe(false);
      expect(existsSync(lockPath)).toBe(true);
      unlinkSync(lockPath);
      await pending;
      expect(entered).toBe(true);
    } finally {
      if (existsSync(lockPath)) unlinkSync(lockPath);
      await pending.catch(() => undefined);
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("holds the legacy lock boundary while the queued operation is active", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-target-legacy-race-"));
    const lockPath = targetLockPath(rootDir);
    let releaseOperation!: () => void;
    const operationGate = new Promise<void>((resolve) => { releaseOperation = resolve; });
    let signalEntered!: () => void;
    const entered = new Promise<void>((resolve) => { signalEntered = resolve; });
    const pending = withBusinessTargetCriticalSection(lockInput(
      { rootDir },
      async () => {
        signalEntered();
        await operationGate;
      }
    ));

    try {
      await entered;
      expect(() => writeFileSync(
        lockPath,
        JSON.stringify({ pid: process.pid, token: "legacy-owner" }),
        { flag: "wx" }
      )).toThrow(expect.objectContaining({ code: "EEXIST" }));
    } finally {
      releaseOperation();
      await pending;
      rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
