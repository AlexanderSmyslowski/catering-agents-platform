import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  utimesSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import { hostname, platform } from "node:os";
import { assertBusinessId, type BusinessContext } from "./business-context.js";
import {
  resolveCollectionQueryable,
  resolveDataRoot,
  type CollectionStorageOptions,
  type Queryable
} from "./persistence.js";

const targetMutexes = new Map<string, Promise<void>>();
const processFingerprintCache = new Map<number, { checkedAt: number; value?: string }>();
const PROCESS_INSTANCE_ID = randomUUID();
const CURRENT_HOSTNAME = hostname();
const TARGET_LOCK_TIMEOUT_MS = 10_000;
const INVALID_TARGET_LOCK_STALE_MS = 30_000;
const FILE_TARGET_LOCK_HEARTBEAT_MS = 5_000;
const MAX_TARGET_LOCK_TICKETS = 4_096;

export interface CriticalSectionTarget {
  kind: string;
  artifactId: string;
  revision: number;
}

/**
 * An internal compatibility alias for a historical file-lock namespace. PostgreSQL advisory
 * locks intentionally remain namespace-independent, while the file backend must fence both
 * namespace paths during the same critical section.
 */
export interface CriticalSectionNamespaceTarget {
  collectionNamespace: string;
  target: CriticalSectionTarget;
}

export interface BusinessTargetCriticalSectionOptions<T> {
  storage: CollectionStorageOptions;
  context: BusinessContext;
  target: CriticalSectionTarget;
  compatibilityTargets?: readonly CriticalSectionTarget[];
  compatibilityNamespaceTargets?: readonly CriticalSectionNamespaceTarget[];
  collectionNamespace: string;
  queueFullMessage: string;
  queueExhaustedMessage?: string;
  timeoutMessage: string;
  legacyTimeoutMessage: string;
  postgresPoolMessage: string;
  operation: (transactionalQueryable?: Queryable) => Promise<T>;
}

interface TransactionClient extends Queryable {
  release: () => void;
}

interface ConnectableQueryable extends Queryable {
  connect: () => Promise<TransactionClient>;
}

interface FileTargetLockMetadata {
  pid: number;
  token: string;
  lease?: "heartbeat-v1";
  hostname?: string;
  processFingerprint?: string;
  processInstanceId?: string;
}

type FileTargetLockRead =
  | { kind: "missing" }
  | { kind: "invalid" }
  | { kind: "valid"; metadata: FileTargetLockMetadata };

const FILE_TARGET_LOCK_KEYS = new Set([
  "pid",
  "token",
  "lease",
  "hostname",
  "processFingerprint",
  "processInstanceId"
]);

interface FileTargetLockTicket {
  sequence: number;
  path: string;
}

class PgMemAdvisoryLockUnavailable extends Error {}

function targetIdentity(context: BusinessContext, target: CriticalSectionTarget): string {
  // JSONB may reorder target keys, so the lock hashes a freshly constructed semantic identity.
  return JSON.stringify({
    businessId: assertBusinessId(context.businessId),
    kind: target.kind,
    artifactId: target.artifactId,
    revision: target.revision
  });
}

function targetLockHash(context: BusinessContext, target: CriticalSectionTarget): string {
  return createHash("sha256").update(targetIdentity(context, target)).digest("hex");
}

function targetAdvisoryLockKey(context: BusinessContext, target: CriticalSectionTarget): string {
  return createHash("sha256").update(targetIdentity(context, target)).digest().readBigInt64BE(0).toString();
}

function orderedCriticalSectionTargets<T>(
  input: BusinessTargetCriticalSectionOptions<T>
): CriticalSectionTarget[] {
  const targetsByIdentity = new Map<string, CriticalSectionTarget>();
  for (const target of [
    input.target,
    ...(input.compatibilityTargets ?? []),
    ...(input.compatibilityNamespaceTargets ?? []).map((entry) => entry.target)
  ]) {
    targetsByIdentity.set(targetIdentity(input.context, target), target);
  }
  return [...targetsByIdentity.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, target]) => target);
}

function orderedFileCriticalSectionTargets<T>(
  input: BusinessTargetCriticalSectionOptions<T>
): CriticalSectionNamespaceTarget[] {
  const targetsByIdentity = new Map<string, CriticalSectionNamespaceTarget>();
  const add = (collectionNamespace: string, target: CriticalSectionTarget) => {
    const identity = `${collectionNamespace}\0${targetIdentity(input.context, target)}`;
    targetsByIdentity.set(identity, { collectionNamespace, target });
  };
  add(input.collectionNamespace, input.target);
  for (const target of input.compatibilityTargets ?? []) {
    add(input.collectionNamespace, target);
  }
  for (const entry of input.compatibilityNamespaceTargets ?? []) {
    add(entry.collectionNamespace, entry.target);
  }
  return [...targetsByIdentity.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, target]) => target);
}

function isConnectableQueryable(queryable: Queryable): queryable is ConnectableQueryable {
  return typeof (queryable as Partial<ConnectableQueryable>).connect === "function";
}

function isPgMemMissingAdvisoryLock(error: unknown): boolean {
  return error instanceof Error &&
    (error.stack ?? "").includes("node_modules/pg-mem/") &&
    error.message.includes("pg_advisory_xact_lock");
}

function isPostgresLockTimeout(error: unknown): boolean {
  return error instanceof Error && (error as Error & { code?: string }).code === "55P03";
}

async function withTargetMutex<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = targetMutexes.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const tail = previous.then(() => current);
  targetMutexes.set(key, tail);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (targetMutexes.get(key) === tail) targetMutexes.delete(key);
  }
}

async function withTargetMutexes<T>(keys: string[], operation: () => Promise<T>): Promise<T> {
  const [key, ...remaining] = keys;
  return key === undefined
    ? operation()
    : withTargetMutex(key, () => withTargetMutexes(remaining, operation));
}

function fileTargetLockPath(
  storage: CollectionStorageOptions,
  context: BusinessContext,
  target: CriticalSectionTarget,
  collectionNamespace: string
): string {
  return path.join(
    resolveDataRoot(storage.rootDir),
    "businesses",
    assertBusinessId(context.businessId),
    collectionNamespace,
    ".decision-target-locks",
    `${targetLockHash(context, target)}.lock`
  );
}

function processIsAlive(pid: number): boolean {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

function readProcessFingerprint(pid: number): string | undefined {
  try {
    if (platform() === "linux") {
      const processStat = readFileSync(`/proc/${pid}/stat`, "utf8");
      const commandEnd = processStat.lastIndexOf(")");
      if (commandEnd < 0) return undefined;
      const fieldsAfterCommand = processStat.slice(commandEnd + 2).trim().split(/\s+/);
      const startTimeTicks = fieldsAfterCommand[19];
      return startTimeTicks ? `linux:${startTimeTicks}` : undefined;
    }
    if (platform() === "darwin") {
      try {
        const startedAt = execFileSync("ps", ["-o", "lstart=", "-p", String(pid)], {
          encoding: "utf8",
          env: { ...process.env, LC_ALL: "C" },
          stdio: ["ignore", "pipe", "ignore"]
        }).trim();
        if (startedAt) return `darwin:${startedAt}`;
      } catch {
        // Sandboxed macOS runners may deny process inspection. A module-local time estimate is
        // not a process identity: independently loaded workers can disagree by one millisecond.
        // Keep the owner unverifiable so lease age cannot release a live critical section.
        return undefined;
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function processFingerprint(pid: number): string | undefined {
  const cached = processFingerprintCache.get(pid);
  if (cached && Date.now() - cached.checkedAt < 1_000) return cached.value;
  const value = readProcessFingerprint(pid);
  processFingerprintCache.set(pid, { checkedAt: Date.now(), value });
  return value;
}

const CURRENT_PROCESS_FINGERPRINT = processFingerprint(process.pid);

function currentFileTargetLockMetadata(token: string): FileTargetLockMetadata {
  return {
    pid: process.pid,
    token,
    lease: "heartbeat-v1",
    hostname: CURRENT_HOSTNAME,
    ...(CURRENT_PROCESS_FINGERPRINT ? { processFingerprint: CURRENT_PROCESS_FINGERPRINT } : {}),
    processInstanceId: PROCESS_INSTANCE_ID
  };
}

function readFileTargetLock(lockPath: string): FileTargetLockRead {
  try {
    const parsed: unknown = JSON.parse(readFileSync(lockPath, "utf8"));
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { kind: "invalid" };
    }
    const metadata = parsed as Record<string, unknown>;
    if (!Object.keys(metadata).every((key) => FILE_TARGET_LOCK_KEYS.has(key))) {
      return { kind: "invalid" };
    }
    if (
      !Number.isSafeInteger(metadata.pid) ||
      (metadata.pid as number) <= 0 ||
      typeof metadata.token !== "string" ||
      metadata.token.length === 0 ||
      (Object.prototype.hasOwnProperty.call(metadata, "lease") && metadata.lease !== "heartbeat-v1") ||
      (["hostname", "processFingerprint", "processInstanceId"] as const).some((key) =>
        Object.prototype.hasOwnProperty.call(metadata, key) && typeof metadata[key] !== "string"
      )
    ) {
      return { kind: "invalid" };
    }
    return {
      kind: "valid",
      metadata: {
        pid: metadata.pid as number,
        token: metadata.token,
        ...(metadata.lease === "heartbeat-v1" ? { lease: metadata.lease } : {}),
        ...(typeof metadata.hostname === "string" ? { hostname: metadata.hostname } : {}),
        ...(typeof metadata.processFingerprint === "string"
          ? { processFingerprint: metadata.processFingerprint }
          : {}),
        ...(typeof metadata.processInstanceId === "string"
          ? { processInstanceId: metadata.processInstanceId }
          : {})
      }
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { kind: "missing" };
    if (error instanceof SyntaxError) return { kind: "invalid" };
    throw error;
  }
}

function invalidFileTargetLockIsStale(lockPath: string): boolean {
  try {
    return Date.now() - statSync(lockPath).mtimeMs >= INVALID_TARGET_LOCK_STALE_MS;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function startFileTargetLeaseHeartbeat(paths: string[]): () => void {
  const refresh = () => {
    const now = new Date(Date.now());
    for (const targetPath of paths) {
      try {
        utimesSync(targetPath, now, now);
      } catch {
        // Same-host contenders also verify the OS process incarnation, so a missed refresh cannot
        // evict a live owner. A missing path means release or crash recovery already won the race.
      }
    }
  };
  refresh();
  const timer = setInterval(refresh, FILE_TARGET_LOCK_HEARTBEAT_MS);
  timer.unref();
  return () => clearInterval(timer);
}

function fileTargetOwnerIsCurrentIncarnation(owner: FileTargetLockMetadata): boolean | undefined {
  if (owner.hostname && owner.hostname !== CURRENT_HOSTNAME) return undefined;
  if (owner.processInstanceId === PROCESS_INSTANCE_ID && owner.pid === process.pid) return true;
  if (!processIsAlive(owner.pid)) return false;
  // Worker threads share an OS process but load this module independently. Their instance IDs differ,
  // so only the OS fingerprint can disprove ownership without evicting a still-running worker.
  if (!owner.processFingerprint) return undefined;
  const liveFingerprint = processFingerprint(owner.pid);
  return liveFingerprint === undefined ? undefined : liveFingerprint === owner.processFingerprint;
}

function unlinkIfPresent(filePath: string): void {
  try {
    unlinkSync(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

function targetTicketName(sequence: number): string {
  return `ticket-${String(sequence).padStart(12, "0")}.json`;
}

function targetTicketReleaseName(sequence: number): string {
  return `released-${String(sequence).padStart(12, "0")}`;
}

function targetTicketSequence(name: string): number | undefined {
  const match = /^ticket-(\d{12})\.json$/.exec(name);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

function markFileTargetTicketReleased(queuePath: string, sequence: number): void {
  const releasePath = path.join(queuePath, targetTicketReleaseName(sequence));
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let fd: number | undefined;
    try {
      // Existence is the complete release record, so publication has no partial-content state.
      fd = openSync(releasePath, "wx", 0o600);
      closeSync(fd);
      return;
    } catch (error) {
      if (fd !== undefined) {
        try { closeSync(fd); } catch { /* file existence still proves release */ }
      }
      if ((error as NodeJS.ErrnoException).code === "EEXIST" || existsSync(releasePath)) return;
      if (attempt === 2) throw error;
    }
  }
}

function listFileTargetTicketSequences(queuePath: string): number[] {
  return readdirSync(queuePath)
    .map(targetTicketSequence)
    .filter((value): value is number => value !== undefined)
    .sort((left, right) => left - right);
}

function allocateFileTargetTicket(
  queuePath: string,
  queueFullMessage: string,
  queueExhaustedMessage: string
): FileTargetLockTicket {
  const token = randomUUID();
  const candidatePath = path.join(queuePath, `.candidate-${process.pid}-${token}.json`);
  let fd: number | undefined;
  try {
    fd = openSync(candidatePath, "wx", 0o600);
    writeFileSync(fd, JSON.stringify(currentFileTargetLockMetadata(token)));
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    for (;;) {
      const existing = listFileTargetTicketSequences(queuePath);
      const activeCount = existing.reduce(
        (count, sequence) => count + (fileTargetTicketIsActive(queuePath, sequence) ? 1 : 0),
        0
      );
      // Released markers are durable history, not queue pressure. Counting them would brick a target after 4096 uses.
      if (activeCount >= MAX_TARGET_LOCK_TICKETS) throw new Error(queueFullMessage);
      const sequence = (existing.at(-1) ?? 0) + 1;
      if (!Number.isSafeInteger(sequence) || sequence > 999_999_999_999) {
        throw new Error(queueExhaustedMessage);
      }
      const ticketPath = path.join(queuePath, targetTicketName(sequence));
      try {
        // The hard link publishes complete metadata and the queue position in one atomic filesystem step.
        linkSync(candidatePath, ticketPath);
        return { sequence, path: ticketPath };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") continue;
        throw error;
      }
    }
  } finally {
    if (fd !== undefined) {
      try { closeSync(fd); } catch { /* cleanup below remains best-effort */ }
    }
    try {
      unlinkIfPresent(candidatePath);
    } catch {
      // Candidate files are never read by the queue; residue must not mask the real operation error.
    }
  }
}

function fileTargetTicketIsActive(queuePath: string, sequence: number): boolean {
  if (existsSync(path.join(queuePath, targetTicketReleaseName(sequence)))) return false;
  const ticketPath = path.join(queuePath, targetTicketName(sequence));
  try {
    statSync(ticketPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
  const ownerRead = readFileTargetLock(ticketPath);
  // A present ticket that cannot be fully decoded is still an active fence. Age cannot prove
  // ownership ended when the ticket identity itself is unavailable.
  if (ownerRead.kind === "invalid") return true;
  if (ownerRead.kind === "missing") return false;
  const owner = ownerRead.metadata;
  // Lease age only permits cleanup after the OS fingerprint proves this PID belongs to a different
  // process. It never proves owner death by itself.
  const leaseExpired = invalidFileTargetLockIsStale(ticketPath);
  if (owner) {
    const currentIncarnation = fileTargetOwnerIsCurrentIncarnation(owner);
    // Unknown includes foreign hosts and owners without a verifiable OS fingerprint. The file backend
    // cannot fence those safely, so it times out instead of treating lease age as proof of death.
    if (currentIncarnation !== false || !leaseExpired) return true;
  }
  if (leaseExpired) {
    markFileTargetTicketReleased(queuePath, sequence);
    return false;
  }
  return true;
}

function firstActiveFileTargetTicket(queuePath: string): number | undefined {
  for (const sequence of listFileTargetTicketSequences(queuePath)) {
    if (fileTargetTicketIsActive(queuePath, sequence)) return sequence;
  }
  return undefined;
}

function releaseFileTargetTicket(queuePath: string, ticket: FileTargetLockTicket): void {
  try {
    markFileTargetTicketReleased(queuePath, ticket.sequence);
  } catch (markerError) {
    try {
      // Only the owning closure can remove this immutable path, and it runs at most once.
      unlinkIfPresent(ticket.path);
    } catch {
      throw markerError;
    }
  }
}

async function waitForLegacyFileTargetLock(
  lockPath: string,
  deadline: number,
  legacyTimeoutMessage: string
): Promise<void> {
  while (existsSync(lockPath)) {
    const ownerRead = readFileTargetLock(lockPath);
    if (ownerRead.kind === "missing") continue;
    // A present lock with an unknown schema remains an active fence. Its age cannot prove that
    // an owner ended, so stale cleanup must never unlink it automatically.
    if (ownerRead.kind === "invalid") {
      if (Date.now() >= deadline) throw new Error(legacyTimeoutMessage);
      await new Promise((resolve) => setTimeout(resolve, 10));
      continue;
    }
    const owner = ownerRead.metadata;
    const expiredHeartbeatLease = owner?.lease === "heartbeat-v1" &&
      invalidFileTargetLockIsStale(lockPath) &&
      fileTargetOwnerIsCurrentIncarnation(owner) === false;
    if (owner && expiredHeartbeatLease) {
      unlinkIfPresent(lockPath);
      continue;
    }
    if (Date.now() >= deadline) throw new Error(legacyTimeoutMessage);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

async function acquireLegacyFileTargetLock(
  lockPath: string,
  deadline: number,
  legacyTimeoutMessage: string
): Promise<{ release: () => void; path: string }> {
  const token = randomUUID();
  const candidatePath = `${lockPath}.candidate-${process.pid}-${token}`;
  let fd: number | undefined;
  try {
    fd = openSync(candidatePath, "wx", 0o600);
    writeFileSync(fd, JSON.stringify(currentFileTargetLockMetadata(token)));
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;

    for (;;) {
      try {
        // The leader owns the legacy path as well as its queue ticket. This closes the rolling-version
        // race in which an older process could otherwise enter after the one-time preflight.
        linkSync(candidatePath, lockPath);
        return {
          path: lockPath,
          release: () => {
            const ownerRead = readFileTargetLock(lockPath);
            if (
              ownerRead.kind === "valid" &&
              ownerRead.metadata.pid === process.pid &&
              ownerRead.metadata.token === token
            ) {
              unlinkIfPresent(lockPath);
            }
          }
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        await waitForLegacyFileTargetLock(lockPath, deadline, legacyTimeoutMessage);
        if (Date.now() >= deadline) throw new Error(legacyTimeoutMessage);
      }
    }
  } finally {
    if (fd !== undefined) {
      try { closeSync(fd); } catch { /* cleanup below remains best-effort */ }
    }
    unlinkIfPresent(candidatePath);
  }
}

async function acquireFileTargetLock(input: {
  lockPath: string;
  queueFullMessage: string;
  queueExhaustedMessage?: string;
  timeoutMessage: string;
  legacyTimeoutMessage: string;
}): Promise<() => void> {
  mkdirSync(path.dirname(input.lockPath), { recursive: true });
  const deadline = Date.now() + TARGET_LOCK_TIMEOUT_MS;
  const queuePath = `${input.lockPath}.queue`;
  mkdirSync(queuePath, { recursive: true, mode: 0o700 });
  const ticket = allocateFileTargetTicket(
    queuePath,
    input.queueFullMessage,
    input.queueExhaustedMessage ?? input.queueFullMessage
  );
  let blockingSequence: number | undefined;
  try {
    for (;;) {
      if (Date.now() >= deadline) throw new Error(input.timeoutMessage);
      if (blockingSequence === undefined || !fileTargetTicketIsActive(queuePath, blockingSequence)) {
        blockingSequence = firstActiveFileTargetTicket(queuePath);
      }
      if (blockingSequence === ticket.sequence) {
        // Only the canonical queue leader may inspect or reclaim the legacy path. A pre-queue
        // stale check lets two processes delete a freshly replaced lock from an old observation.
        const legacyLock = await acquireLegacyFileTargetLock(
          input.lockPath,
          deadline,
          input.legacyTimeoutMessage
        );
        const stopHeartbeat = startFileTargetLeaseHeartbeat([ticket.path, legacyLock.path]);
        let released = false;
        return () => {
          if (released) return;
          stopHeartbeat();
          try {
            legacyLock.release();
          } finally {
            releaseFileTargetTicket(queuePath, ticket);
            released = true;
          }
        };
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  } catch (error) {
    releaseFileTargetTicket(queuePath, ticket);
    throw error;
  }
}

async function withPostgresTransaction<T>(
  queryable: ConnectableQueryable,
  input: BusinessTargetCriticalSectionOptions<T>
): Promise<T> {
  const client = await queryable.connect();
  let transactionStarted = false;
  try {
    await client.query("BEGIN");
    transactionStarted = true;
    try {
      await client.query("SELECT pg_catalog.set_config('lock_timeout', $1, true)", [
        `${TARGET_LOCK_TIMEOUT_MS}ms`
      ]);
      for (const target of orderedCriticalSectionTargets(input)) {
        await client.query("SELECT pg_catalog.pg_advisory_xact_lock($1::bigint)", [
          targetAdvisoryLockKey(input.context, target)
        ]);
      }
    } catch (error) {
      if (isPgMemMissingAdvisoryLock(error)) throw new PgMemAdvisoryLockUnavailable();
      if (isPostgresLockTimeout(error)) throw new Error(input.timeoutMessage);
      throw error;
    }
    const result = await input.operation(client);
    await client.query("COMMIT");
    transactionStarted = false;
    return result;
  } catch (error) {
    if (transactionStarted) await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function withBusinessTargetCriticalSection<T>(
  input: BusinessTargetCriticalSectionOptions<T>
): Promise<T> {
  const queryable = resolveCollectionQueryable(input.storage);
  if (!queryable) {
    const releases: Array<() => void> = [];
    try {
      for (const { collectionNamespace, target } of orderedFileCriticalSectionTargets(input)) {
        releases.push(await acquireFileTargetLock({
          lockPath: fileTargetLockPath(
            input.storage,
            input.context,
            target,
            collectionNamespace
          ),
          queueFullMessage: input.queueFullMessage,
          queueExhaustedMessage: input.queueExhaustedMessage,
          timeoutMessage: input.timeoutMessage,
          legacyTimeoutMessage: input.legacyTimeoutMessage
        }));
      }
      return await input.operation();
    } finally {
      let releaseError: unknown;
      for (const release of releases.reverse()) {
        try {
          release();
        } catch (error) {
          releaseError ??= error;
        }
      }
      if (releaseError !== undefined) throw releaseError;
    }
  }

  if (!isConnectableQueryable(queryable)) throw new Error(input.postgresPoolMessage);
  try {
    return await withPostgresTransaction(queryable, input);
  } catch (error) {
    if (!(error instanceof PgMemAdvisoryLockUnavailable)) throw error;
    // pg-mem has no advisory locks; only its in-process test adapter may use this fallback.
    return withTargetMutexes(
      orderedFileCriticalSectionTargets(input).map(
        ({ collectionNamespace, target }) => `${collectionNamespace}:${targetIdentity(input.context, target)}`
      ),
      () => input.operation()
    );
  }
}
