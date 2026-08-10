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
  writeFileSync
} from "node:fs";
import path from "node:path";
import {
  createBusinessScopedPersistentCollection,
  areJsonValuesEqual,
  assertBusinessId,
  resolveCollectionQueryable,
  resolveDataRoot,
  type ApprovalRequestRecord,
  type ApprovedOffer,
  type BusinessContext,
  type BusinessScopedPersistentCollection,
  type CollectionStorageOptions,
  type OfferDraft,
  type ProductionHandoff,
  type Queryable,
  validateApprovalRequestRecord,
  validateApprovedOffer,
  validateOfferDraft,
  validateProductionHandoff
} from "@catering/shared-core";
import {
  validateOfferDecisionAggregate,
  type OfferDecisionAggregate
} from "./offer-decision-aggregate.js";

const decisionRepositories = new WeakMap<OfferStore, InternalOfferDecisionRepository>();
const targetMutexes = new Map<string, Promise<void>>();
const TARGET_LOCK_TIMEOUT_MS = 10_000;
const INVALID_TARGET_LOCK_STALE_MS = 30_000;
const MAX_TARGET_LOCK_TICKETS = 4_096;

interface OfferDecisionCollections {
  drafts: BusinessScopedPersistentCollection<OfferDraft>;
  decisionAggregates: BusinessScopedPersistentCollection<OfferDecisionAggregate>;
  approvals: BusinessScopedPersistentCollection<ApprovalRequestRecord>;
  approvedOffers: BusinessScopedPersistentCollection<ApprovedOffer>;
}

export interface OfferDecisionTargetScope {
  getDraft: (draftId: string) => Promise<OfferDraft | undefined>;
  insertDecisionAggregate: (aggregate: OfferDecisionAggregate) => Promise<"created" | "exists">;
  getDecisionAggregate: (approvalRequestId: string) => Promise<OfferDecisionAggregate | undefined>;
  getApproval: (approvalRequestId: string) => Promise<ApprovalRequestRecord | undefined>;
  listApprovalsForTarget: () => Promise<ApprovalRequestRecord[]>;
  getApprovedOffer: (approvedOfferId: string) => Promise<ApprovedOffer | undefined>;
  insertApproval: (approval: ApprovalRequestRecord) => Promise<"created" | "exists">;
  insertApprovedOffer: (offer: ApprovedOffer) => Promise<"created" | "exists">;
}

export interface OfferDecisionRepository {
  insertDecisionAggregate: (context: BusinessContext, aggregate: OfferDecisionAggregate) => Promise<"created" | "exists">;
  getDecisionAggregate: (context: BusinessContext, approvalRequestId: string) => Promise<OfferDecisionAggregate | undefined>;
  listDecisionAggregatesForApprovedOffer: (context: BusinessContext, approvedOfferId: string) => Promise<OfferDecisionAggregate[]>;
  withTargetCriticalSection: <T>(
    context: BusinessContext,
    target: ApprovalRequestRecord["target"],
    operation: (scope: OfferDecisionTargetScope) => Promise<T>
  ) => Promise<T>;
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
}

interface FileTargetLockTicket {
  sequence: number;
  path: string;
}

class PgMemAdvisoryLockUnavailable extends Error {}

function createOfferDecisionCollections(options: CollectionStorageOptions): OfferDecisionCollections {
  const storage = { rootDir: options.rootDir, databaseUrl: options.databaseUrl, pgPool: options.pgPool };
  return {
    drafts: createBusinessScopedPersistentCollection({ collectionName: "offers/drafts", getId: (draft: OfferDraft) => draft.draftId, getVersion: (draft: OfferDraft) => draft.revision, validate: validateOfferDraft, ...storage }),
    decisionAggregates: createBusinessScopedPersistentCollection({ collectionName: "offers/decision-aggregates", getId: (aggregate: OfferDecisionAggregate) => aggregate.approval.approvalRequestId, validate: validateOfferDecisionAggregate, ...storage }),
    approvals: createBusinessScopedPersistentCollection({ collectionName: "offers/approvals", getId: (approval: ApprovalRequestRecord) => approval.approvalRequestId, validate: validateApprovalRequestRecord, ...storage }),
    approvedOffers: createBusinessScopedPersistentCollection({ collectionName: "offers/approved", getId: (offer: ApprovedOffer) => offer.approvedOfferId, validate: validateApprovedOffer, ...storage })
  };
}

function targetIdentity(context: BusinessContext, target: ApprovalRequestRecord["target"]): string {
  // PostgreSQL JSONB may reorder target keys, so hash only a freshly constructed semantic identity.
  return JSON.stringify({
    businessId: assertBusinessId(context.businessId),
    kind: target.kind,
    artifactId: target.artifactId,
    revision: target.revision
  });
}

function targetLockHash(context: BusinessContext, target: ApprovalRequestRecord["target"]): string {
  return createHash("sha256").update(targetIdentity(context, target)).digest("hex");
}

function targetAdvisoryLockKey(context: BusinessContext, target: ApprovalRequestRecord["target"]): string {
  return createHash("sha256").update(targetIdentity(context, target)).digest().readBigInt64BE(0).toString();
}

function isConnectableQueryable(queryable: Queryable): queryable is ConnectableQueryable {
  return typeof (queryable as Partial<ConnectableQueryable>).connect === "function";
}

function isPgMemMissingAdvisoryLock(error: unknown): boolean {
  return error instanceof Error
    && (error.stack ?? "").includes("node_modules/pg-mem/")
    && error.message.includes("pg_advisory_xact_lock");
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

function fileTargetLockPath(
  options: CollectionStorageOptions,
  context: BusinessContext,
  target: ApprovalRequestRecord["target"]
): string {
  return path.join(
    resolveDataRoot(options.rootDir),
    "businesses",
    assertBusinessId(context.businessId),
    "offers",
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

function readFileTargetLock(lockPath: string): FileTargetLockMetadata | undefined {
  try {
    const metadata = JSON.parse(readFileSync(lockPath, "utf8")) as Partial<FileTargetLockMetadata>;
    return typeof metadata.pid === "number" && typeof metadata.token === "string"
      ? { pid: metadata.pid, token: metadata.token }
      : undefined;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    if (error instanceof SyntaxError) return undefined;
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

function allocateFileTargetTicket(queuePath: string): FileTargetLockTicket {
  const token = randomUUID();
  const candidatePath = path.join(queuePath, `.candidate-${process.pid}-${token}.json`);
  let fd: number | undefined;
  try {
    fd = openSync(candidatePath, "wx", 0o600);
    writeFileSync(fd, JSON.stringify({ pid: process.pid, token } satisfies FileTargetLockMetadata));
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    for (;;) {
      const existing = listFileTargetTicketSequences(queuePath);
      if (existing.length >= MAX_TARGET_LOCK_TICKETS) {
        throw new Error("Die Dateisperren-Warteschlange benötigt eine betriebliche Bereinigung.");
      }
      const sequence = (existing.at(-1) ?? 0) + 1;
      if (!Number.isSafeInteger(sequence) || sequence > 999_999_999_999) {
        throw new Error("Die Dateisperren-Warteschlange ist ausgeschöpft.");
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
      // Candidates are never read by the queue; residue is safer than masking a published ticket or its real error.
    }
  }
}

function fileTargetTicketIsActive(queuePath: string, sequence: number): boolean {
  if (existsSync(path.join(queuePath, targetTicketReleaseName(sequence)))) return false;
  const ticketPath = path.join(queuePath, targetTicketName(sequence));
  const owner = readFileTargetLock(ticketPath);
  if (owner && processIsAlive(owner.pid)) return true;
  if (owner || invalidFileTargetLockIsStale(ticketPath)) {
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

async function waitForLegacyFileTargetLock(lockPath: string, deadline: number): Promise<void> {
  while (existsSync(lockPath)) {
    const owner = readFileTargetLock(lockPath);
    if ((owner && !processIsAlive(owner.pid)) || (!owner && invalidFileTargetLockIsStale(lockPath))) {
      // File-backed upgrades stop prior writers before startup, so this path only removes residue from that old protocol.
      unlinkIfPresent(lockPath);
      continue;
    }
    if (Date.now() >= deadline) {
      throw new Error("Die alte zielbezogene Angebotsentscheidung konnte nicht rechtzeitig entsperrt werden.");
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

async function acquireFileTargetLock(lockPath: string): Promise<() => void> {
  mkdirSync(path.dirname(lockPath), { recursive: true });
  const deadline = Date.now() + TARGET_LOCK_TIMEOUT_MS;
  await waitForLegacyFileTargetLock(lockPath, deadline);
  const queuePath = `${lockPath}.queue`;
  mkdirSync(queuePath, { recursive: true, mode: 0o700 });
  const ticket = allocateFileTargetTicket(queuePath);
  let blockingSequence: number | undefined;
  try {
    for (;;) {
      if (Date.now() >= deadline) {
        throw new Error("Die zielbezogene Angebotsentscheidung konnte nicht rechtzeitig gesperrt werden.");
      }
      if (blockingSequence === undefined || !fileTargetTicketIsActive(queuePath, blockingSequence)) {
        blockingSequence = firstActiveFileTargetTicket(queuePath);
      }
      if (blockingSequence === ticket.sequence) {
        let released = false;
        return () => {
          if (released) return;
          releaseFileTargetTicket(queuePath, ticket);
          released = true;
        };
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  } catch (error) {
    releaseFileTargetTicket(queuePath, ticket);
    throw error;
  }
}

class InternalOfferDecisionRepository implements OfferDecisionRepository {
  constructor(
    private readonly owner: OfferStore,
    private readonly options: CollectionStorageOptions,
    private readonly collections: OfferDecisionCollections
  ) {}

  async insertDecisionAggregate(context: BusinessContext, aggregate: OfferDecisionAggregate): Promise<"created" | "exists"> {
    return this.collections.decisionAggregates.insert(context, aggregate);
  }

  async getDecisionAggregate(context: BusinessContext, approvalRequestId: string): Promise<OfferDecisionAggregate | undefined> {
    return this.collections.decisionAggregates.get(context, approvalRequestId);
  }

  async listDecisionAggregatesForApprovedOffer(context: BusinessContext, approvedOfferId: string): Promise<OfferDecisionAggregate[]> {
    return (await this.collections.decisionAggregates.list(context)).filter(
      (aggregate) => aggregate.approvedOffer?.approvedOfferId === approvedOfferId
    );
  }

  async withTargetCriticalSection<T>(
    context: BusinessContext,
    target: ApprovalRequestRecord["target"],
    operation: (scope: OfferDecisionTargetScope) => Promise<T>
  ): Promise<T> {
    const queryable = resolveCollectionQueryable(this.options);
    if (!queryable) {
      const lockPath = fileTargetLockPath(this.options, context, target);
      const release = await acquireFileTargetLock(lockPath);
      try {
        return await operation(this.scopeForOwner(context, target));
      } finally {
        release();
      }
    }

    if (!isConnectableQueryable(queryable)) {
      throw new Error("PostgreSQL-Angebotsentscheidungen benötigen einen Pool mit exklusivem Client-Checkout.");
    }
    try {
      return await this.withPostgresTransaction(queryable, context, target, operation);
    } catch (error) {
      if (!(error instanceof PgMemAdvisoryLockUnavailable)) throw error;
      // pg-mem has no advisory locks; serialize its test adapter in-process while keeping real PostgreSQL transactional.
      return withTargetMutex(targetIdentity(context, target), () => operation(this.scopeForOwner(context, target)));
    }
  }

  private scopeForOwner(context: BusinessContext, target: ApprovalRequestRecord["target"]): OfferDecisionTargetScope {
    return {
      getDraft: (draftId) => this.owner.getDraft(context, draftId),
      insertDecisionAggregate: (aggregate) => this.insertDecisionAggregate(context, aggregate),
      getDecisionAggregate: (approvalRequestId) => this.getDecisionAggregate(context, approvalRequestId),
      getApproval: (approvalRequestId) => this.owner.getApproval(context, approvalRequestId),
      listApprovalsForTarget: () => this.owner.listApprovalsForTarget(context, target),
      getApprovedOffer: (approvedOfferId) => this.owner.getApprovedOffer(context, approvedOfferId),
      insertApproval: (approval) => this.collections.approvals.insert(context, approval),
      insertApprovedOffer: (offer) => this.collections.approvedOffers.insert(context, offer)
    };
  }

  private scopeForCollections(
    collections: OfferDecisionCollections,
    context: BusinessContext,
    target: ApprovalRequestRecord["target"]
  ): OfferDecisionTargetScope {
    return {
      getDraft: (draftId) => collections.drafts.get(context, draftId),
      insertDecisionAggregate: (aggregate) => collections.decisionAggregates.insert(context, aggregate),
      getDecisionAggregate: (approvalRequestId) => collections.decisionAggregates.get(context, approvalRequestId),
      getApproval: (approvalRequestId) => collections.approvals.get(context, approvalRequestId),
      listApprovalsForTarget: async () => (await collections.approvals.list(context)).filter(
        (approval) => approval.target.kind === target.kind
          && approval.target.artifactId === target.artifactId
          && approval.target.revision === target.revision
      ),
      getApprovedOffer: (approvedOfferId) => collections.approvedOffers.get(context, approvedOfferId),
      insertApproval: (approval) => collections.approvals.insert(context, approval),
      insertApprovedOffer: (offer) => collections.approvedOffers.insert(context, offer)
    };
  }

  private async withPostgresTransaction<T>(
    queryable: ConnectableQueryable,
    context: BusinessContext,
    target: ApprovalRequestRecord["target"],
    operation: (scope: OfferDecisionTargetScope) => Promise<T>
  ): Promise<T> {
    const client = await queryable.connect();
    let transactionStarted = false;
    try {
      await client.query("BEGIN");
      transactionStarted = true;
      try {
        await client.query(
          "SELECT pg_catalog.pg_advisory_xact_lock($1::bigint)",
          [targetAdvisoryLockKey(context, target)]
        );
      } catch (error) {
        if (isPgMemMissingAdvisoryLock(error)) throw new PgMemAdvisoryLockUnavailable();
        throw error;
      }
      const transactionalCollections = createOfferDecisionCollections({
        rootDir: this.options.rootDir,
        pgPool: client
      });
      const result = await operation(this.scopeForCollections(transactionalCollections, context, target));
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
}

export function offerDecisionRepositoryFor(store: OfferStore): OfferDecisionRepository {
  const repository = decisionRepositories.get(store);
  if (!repository) throw new Error("OfferStore wurde nicht regulär initialisiert.");
  return repository;
}

export class OfferStore {
  private readonly drafts: BusinessScopedPersistentCollection<OfferDraft>;
  private readonly approvals: BusinessScopedPersistentCollection<ApprovalRequestRecord>;
  private readonly approvedOffers: BusinessScopedPersistentCollection<ApprovedOffer>;
  private readonly handoffs: BusinessScopedPersistentCollection<ProductionHandoff>;

  readonly storageOptions?: CollectionStorageOptions;

  constructor(options?: CollectionStorageOptions) {
    this.storageOptions = options;
    const storage = { rootDir: options?.rootDir, databaseUrl: options?.databaseUrl, pgPool: options?.pgPool };
    const decisionCollections = createOfferDecisionCollections(storage);
    this.drafts = decisionCollections.drafts;
    // This insert-only record is authoritative; Approval and ApprovedOffer stay repairable read projections.
    this.approvals = decisionCollections.approvals;
    this.approvedOffers = decisionCollections.approvedOffers;
    this.handoffs = createBusinessScopedPersistentCollection({ collectionName: "offers/handoffs", getId: (handoff: ProductionHandoff) => handoff.handoffId, validate: validateProductionHandoff, ...storage });
    decisionRepositories.set(this, new InternalOfferDecisionRepository(this, storage, decisionCollections));
  }

  async saveDraft(context: BusinessContext, draft: OfferDraft): Promise<void> {
    if (await this.drafts.insert(context, draft) === "created") return;

    for (;;) {
      const existing = await this.drafts.get(context, draft.draftId);
      if (!existing) {
        if (await this.drafts.insert(context, draft) === "created") return;
        continue;
      }
      if (existing.revision === draft.revision) {
        if (areJsonValuesEqual(existing, draft)) return;
        throw new Error("Eine Angebotsrevision darf nicht nachträglich verändert werden.");
      }
      if (draft.revision < existing.revision) {
        throw new Error("Eine Angebotsrevision darf nicht nachträglich verändert werden.");
      }
      const updated = await this.drafts.compareAndSet(context, draft.draftId, existing.revision, draft);
      if (updated === "updated") return;
    }
  }
  async getDraft(context: BusinessContext, draftId: string): Promise<OfferDraft | undefined> { return this.drafts.get(context, draftId); }
  async listDrafts(context: BusinessContext): Promise<OfferDraft[]> { return this.drafts.list(context); }
  async insertApproval(context: BusinessContext, record: ApprovalRequestRecord): Promise<"created" | "exists"> {
    return offerDecisionRepositoryFor(this).withTargetCriticalSection(
      context,
      record.target,
      (scope) => scope.insertApproval(record)
    );
  }
  async getApproval(context: BusinessContext, approvalRequestId: string): Promise<ApprovalRequestRecord | undefined> { return this.approvals.get(context, approvalRequestId); }
  async listApprovalsForDraft(context: BusinessContext, draftId: string): Promise<ApprovalRequestRecord[]> {
    return (await this.approvals.list(context)).filter(
      (record) => record.target.kind === "offer_draft" && record.target.artifactId === draftId
    );
  }
  async listApprovalsForTarget(context: BusinessContext, target: ApprovalRequestRecord["target"]): Promise<ApprovalRequestRecord[]> {
    return (await this.approvals.list(context)).filter((record) => record.target.kind === target.kind && record.target.artifactId === target.artifactId && record.target.revision === target.revision);
  }
  async insertApprovedOffer(context: BusinessContext, offer: ApprovedOffer): Promise<"created" | "exists"> {
    return offerDecisionRepositoryFor(this).withTargetCriticalSection(
      context,
      { kind: "offer_draft", artifactId: offer.sourceDraft.draftId, revision: offer.sourceDraft.revision },
      async (scope) => {
        const approval = await scope.getApproval(offer.approvalRequestId);
        if (!approval) {
          throw new Error("Freigegebenes Angebot benötigt eine exakt passende genehmigte Approval-Projektion.");
        }
        try {
          validateOfferDecisionAggregate({
            schemaVersion: "1.0",
            businessId: offer.businessId,
            approval,
            approvedOffer: offer
          });
        } catch {
          throw new Error("Freigegebenes Angebot benötigt eine exakt passende genehmigte Approval-Projektion.");
        }
        return scope.insertApprovedOffer(offer);
      }
    );
  }
  async getApprovedOffer(context: BusinessContext, id: string): Promise<ApprovedOffer | undefined> { return this.approvedOffers.get(context, id); }
  async listApprovedOffers(context: BusinessContext): Promise<ApprovedOffer[]> { return this.approvedOffers.list(context); }
  async insertHandoff(context: BusinessContext, handoff: ProductionHandoff): Promise<"created" | "exists"> { return this.handoffs.insert(context, handoff); }
  async getHandoff(context: BusinessContext, id: string): Promise<ProductionHandoff | undefined> { return this.handoffs.get(context, id); }
}
