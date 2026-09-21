import { createHash } from "node:crypto";
import { isMinimalMvpRole, type MinimalMvpRole } from "./access-control.js";
import { assertBusinessId, type BusinessContext, type BusinessId } from "./business-context.js";
import { normalizeCateringLoginCode } from "./catering-pin-crypto.js";
import {
  createBusinessScopedPersistentCollection,
  type BusinessScopedPersistentCollection,
  type CollectionStorageOptions,
  type Queryable
} from "./persistence.js";
import { withBusinessTargetCriticalSection } from "./target-critical-section.js";

const CATERING_USER_SCHEMA_VERSION = "1.0";
const MAX_INT32 = 2_147_483_647;
const CANONICAL_PIN_HASH = /^scrypt\$16384\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{64}$/;
const CATERING_USER_FIELDS = new Set([
  "schemaVersion",
  "businessId",
  "userId",
  "loginCodeCanonical",
  "displayName",
  "pinHash",
  "role",
  "active",
  "authEpoch",
  "failedLoginCount",
  "failureWindowStartedAt",
  "lockedUntil",
  "version",
  "createdAt",
  "updatedAt"
]);
const CATERING_USER_REQUIRED_FIELDS = [
  "schemaVersion",
  "businessId",
  "userId",
  "loginCodeCanonical",
  "displayName",
  "pinHash",
  "role",
  "active",
  "authEpoch",
  "failedLoginCount",
  "version",
  "createdAt",
  "updatedAt"
] as const;
const CATERING_USER_OPTIONAL_FIELDS = ["failureWindowStartedAt", "lockedUntil"] as const;

export interface CateringUserRecord {
  schemaVersion: "1.0";
  businessId: BusinessId;
  userId: string;
  loginCodeCanonical: string;
  displayName: string;
  pinHash: string;
  role: MinimalMvpRole;
  active: boolean;
  authEpoch: number;
  failedLoginCount: number;
  failureWindowStartedAt?: string;
  lockedUntil?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type CateringUserLookup =
  | { kind: "missing" }
  | { kind: "unique"; user: CateringUserRecord }
  | { kind: "ambiguous" };

export type CateringUserMutation =
  | { kind: "updated"; user: CateringUserRecord }
  | { kind: "conflict" }
  | { kind: "missing" };

interface CreateCateringUserRecordInput {
  businessId: BusinessId;
  userId: string;
  loginCode: string;
  displayName: string;
  pinHash: string;
  role: MinimalMvpRole;
  active: boolean;
  now: Date;
}

interface CateringUserSecurityChange {
  pinHash?: string;
  role?: MinimalMvpRole;
  active?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInt32(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= MAX_INT32;
}

function isCanonicalIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function assertUserId(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("Benutzer-ID ist ungültig.");
  }
}

function assertCanonicalPinHash(value: unknown): asserts value is string {
  if (typeof value !== "string" || !CANONICAL_PIN_HASH.test(value)) {
    throw new Error("PIN-Hash ist ungültig.");
  }
}

function timestampFor(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error("Zeitpunkt ist ungültig.");
  }
  return now.toISOString();
}

function snapshotCateringUserRecord(value: Record<string, unknown>): Record<string, unknown> {
  // The store must keep only own, allowlisted primitives so caller mutation or an inherited serializer cannot change data after validation.
  const snapshot = Object.create(null) as Record<string, unknown>;
  for (const field of CATERING_USER_REQUIRED_FIELDS) {
    snapshot[field] = value[field];
  }
  for (const field of CATERING_USER_OPTIONAL_FIELDS) {
    if (Object.hasOwn(value, field)) snapshot[field] = value[field];
  }
  return snapshot;
}

function validateCateringUserRecord(value: CateringUserRecord): CateringUserRecord {
  try {
    if (
      !isRecord(value)
      || Object.getOwnPropertyNames(value).some((key) => !CATERING_USER_FIELDS.has(key))
      || Object.getOwnPropertySymbols(value).length > 0
      || CATERING_USER_REQUIRED_FIELDS.some((field) => !Object.hasOwn(value, field))
    ) {
      throw new Error("invalid record shape");
    }
    const snapshot = snapshotCateringUserRecord(value);

    if (snapshot.schemaVersion !== CATERING_USER_SCHEMA_VERSION) throw new Error("invalid schema version");
    if (typeof snapshot.businessId !== "string") throw new Error("invalid business id");
    assertBusinessId(snapshot.businessId);
    assertUserId(snapshot.userId);
    if (typeof snapshot.loginCodeCanonical !== "string" || normalizeCateringLoginCode(snapshot.loginCodeCanonical) !== snapshot.loginCodeCanonical) {
      throw new Error("invalid login code");
    }
    if (typeof snapshot.displayName !== "string" || snapshot.displayName.trim().length === 0 || snapshot.displayName !== snapshot.displayName.trim()) {
      throw new Error("invalid display name");
    }
    assertCanonicalPinHash(snapshot.pinHash);
    if (typeof snapshot.role !== "string" || !isMinimalMvpRole(snapshot.role)) throw new Error("invalid role");
    if (typeof snapshot.active !== "boolean") throw new Error("invalid active state");
    if (!isNonNegativeInt32(snapshot.authEpoch) || !isNonNegativeInt32(snapshot.failedLoginCount) || !isNonNegativeInt32(snapshot.version)) {
      throw new Error("invalid counter");
    }
    if (!isCanonicalIsoTimestamp(snapshot.createdAt) || !isCanonicalIsoTimestamp(snapshot.updatedAt)) {
      throw new Error("invalid timestamps");
    }
    for (const field of ["failureWindowStartedAt", "lockedUntil"] as const) {
      if (Object.hasOwn(snapshot, field) && !isCanonicalIsoTimestamp(snapshot[field])) {
        throw new Error("invalid optional timestamp");
      }
    }
    return snapshot as unknown as CateringUserRecord;
  } catch {
    throw new Error("Ungültiger Catering-Benutzerdatensatz.");
  }
}

function assertRecordMatchesContext(context: BusinessContext, user: CateringUserRecord): void {
  assertBusinessId(context.businessId);
  if (user.businessId !== context.businessId) {
    throw new Error("Payload passt nicht zum vertrauenswürdigen Betriebskontext.");
  }
}

function assertImmutableNonSecurityReplacement(
  expected: CateringUserRecord,
  replacement: CateringUserRecord
): void {
  if (
    expected.businessId !== replacement.businessId ||
    expected.userId !== replacement.userId ||
    expected.loginCodeCanonical !== replacement.loginCodeCanonical ||
    expected.schemaVersion !== replacement.schemaVersion ||
    expected.createdAt !== replacement.createdAt
  ) {
    throw new Error("Benutzer-Subject und Anmeldecode sind unveränderlich.");
  }
  if (replacement.version !== expected.version + 1) {
    throw new Error("Benutzeraktualisierungen müssen die Version genau einmal erhöhen.");
  }
  if (replacement.authEpoch !== expected.authEpoch) {
    throw new Error("Sicherheitsänderungen müssen über updateSecurity erfolgen.");
  }
  if (
    replacement.pinHash !== expected.pinHash ||
    replacement.role !== expected.role ||
    replacement.active !== expected.active
  ) {
    throw new Error("Sicherheitsänderungen müssen über updateSecurity erfolgen.");
  }
}

function loginCodeTarget(loginCodeCanonical: string) {
  // Lock paths must never expose a login code; the stable SHA-256 identifier still serializes equal canonical codes.
  return {
    kind: "catering-user-login-code",
    artifactId: createHash("sha256").update(loginCodeCanonical).digest("hex"),
    revision: 1
  };
}

export function createCateringUserRecord(input: CreateCateringUserRecordInput): CateringUserRecord {
  assertUserId(input.userId);
  const record: CateringUserRecord = {
    schemaVersion: CATERING_USER_SCHEMA_VERSION,
    businessId: assertBusinessId(input.businessId),
    userId: input.userId,
    loginCodeCanonical: normalizeCateringLoginCode(input.loginCode),
    displayName: typeof input.displayName === "string" ? input.displayName.trim() : "",
    pinHash: input.pinHash,
    role: input.role,
    active: input.active,
    authEpoch: 0,
    failedLoginCount: 0,
    version: 0,
    createdAt: timestampFor(input.now),
    updatedAt: timestampFor(input.now)
  };

  return validateCateringUserRecord(record);
}

export class CateringUserStore {
  private readonly storage: CollectionStorageOptions;
  private readonly users: BusinessScopedPersistentCollection<CateringUserRecord>;

  constructor(options: CollectionStorageOptions = {}) {
    this.storage = { ...options };
    this.users = this.collectionFor();
  }

  async create(
    context: BusinessContext,
    user: CateringUserRecord
  ): Promise<"created" | "duplicate_login_code" | "duplicate_user_id"> {
    const candidate = validateCateringUserRecord(user);
    assertRecordMatchesContext(context, candidate);

    return withBusinessTargetCriticalSection({
      storage: this.storage,
      context,
      target: loginCodeTarget(candidate.loginCodeCanonical),
      collectionNamespace: "auth/users",
      queueFullMessage: "Warteschlange für Catering-Benutzer ist voll.",
      timeoutMessage: "Zeitüberschreitung beim Sperren der Catering-Benutzerkennung.",
      legacyTimeoutMessage: "Zeitüberschreitung beim Sperren der Catering-Benutzerkennung.",
      postgresPoolMessage: "PostgreSQL-Pool für Catering-Benutzer erforderlich.",
      operation: async (transactionalQueryable) => {
        const users = this.collectionFor(transactionalQueryable);
        const sameLoginCode = (await users.list(context)).some(
          (existing) => existing.loginCodeCanonical === candidate.loginCodeCanonical
        );
        if (sameLoginCode) return "duplicate_login_code";

        return (await users.insert(context, candidate)) === "created" ? "created" : "duplicate_user_id";
      }
    });
  }

  async getById(context: BusinessContext, userId: string): Promise<CateringUserRecord | undefined> {
    assertUserId(userId);
    return this.users.get(context, userId);
  }

  async findByLoginCode(context: BusinessContext, loginCode: string): Promise<CateringUserLookup> {
    const canonical = normalizeCateringLoginCode(loginCode);
    const matches = (await this.users.list(context)).filter(
      (user) => user.loginCodeCanonical === canonical
    );
    if (matches.length === 0) return { kind: "missing" };
    if (matches.length === 1) return { kind: "unique", user: matches[0] };
    return { kind: "ambiguous" };
  }

  async replaceExact(
    context: BusinessContext,
    expected: CateringUserRecord,
    replacement: CateringUserRecord
  ): Promise<CateringUserMutation> {
    const expectedRecord = validateCateringUserRecord(expected);
    const replacementRecord = validateCateringUserRecord(replacement);
    assertRecordMatchesContext(context, expectedRecord);
    assertRecordMatchesContext(context, replacementRecord);
    assertImmutableNonSecurityReplacement(expectedRecord, replacementRecord);

    const result = await this.users.compareAndSetExact(
      context,
      expectedRecord.userId,
      expectedRecord,
      replacementRecord
    );
    if (result === "updated") return { kind: "updated", user: replacementRecord };
    return { kind: result };
  }

  async updateSecurity(
    context: BusinessContext,
    expected: CateringUserRecord,
    change: CateringUserSecurityChange,
    now: Date
  ): Promise<CateringUserMutation> {
    const expectedRecord = validateCateringUserRecord(expected);
    assertRecordMatchesContext(context, expectedRecord);
    const rawChange: unknown = change;
    if (!isRecord(rawChange) || Object.keys(rawChange).some((key) => !["pinHash", "role", "active"].includes(key))) {
      throw new Error("Sicherheitsänderung ist ungültig.");
    }

    const pinHash = change.pinHash ?? expectedRecord.pinHash;
    const role = change.role ?? expectedRecord.role;
    const active = change.active ?? expectedRecord.active;
    assertCanonicalPinHash(pinHash);
    if (!isMinimalMvpRole(role) || typeof active !== "boolean") {
      throw new Error("Sicherheitsänderung ist ungültig.");
    }
    const securityChanged =
      pinHash !== expectedRecord.pinHash ||
      role !== expectedRecord.role ||
      active !== expectedRecord.active;
    const replacement = validateCateringUserRecord({
      ...expectedRecord,
      pinHash,
      role,
      active,
      authEpoch: expectedRecord.authEpoch + (securityChanged ? 1 : 0),
      version: expectedRecord.version + 1,
      updatedAt: timestampFor(now)
    });

    const result = await this.users.compareAndSetExact(
      context,
      expectedRecord.userId,
      expectedRecord,
      replacement
    );
    if (result === "updated") return { kind: "updated", user: replacement };
    return { kind: result };
  }

  private collectionFor(transactionalQueryable?: Queryable): BusinessScopedPersistentCollection<CateringUserRecord> {
    return createBusinessScopedPersistentCollection<CateringUserRecord>({
      collectionName: "auth/users",
      getId: (user) => user.userId,
      validate: validateCateringUserRecord,
      fileDirectoryMode: 0o700,
      fileRecordMode: 0o600,
      rootDir: this.storage.rootDir,
      databaseUrl: this.storage.databaseUrl,
      pgPool: transactionalQueryable ?? this.storage.pgPool
    });
  }
}
