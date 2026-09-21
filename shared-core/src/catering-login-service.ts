import { createHmac } from "node:crypto";
import type { BusinessContext } from "./business-context.js";
import { verifyCateringPin } from "./catering-pin-crypto.js";
import {
  CateringUserStore,
  type CateringUserLookup,
  type CateringUserRecord
} from "./catering-user-store.js";

const ACCOUNT_FAILURE_LIMIT = 12;
const SOURCE_FAILURE_LIMIT = 60;
const FAILURE_WINDOW_MS = 15 * 60 * 1_000;
const ACCOUNT_LOCK_MS = 10 * 60 * 1_000;
const MAX_TRUSTED_SOURCE_BUCKETS = 128;
const SOURCE_KEY_MAX_LENGTH = 256;
const SIX_ASCII_DIGITS = /^[0-9]{6}$/;
const PRINTABLE_ASCII = /^[\x21-\x7e]+$/;
const FORWARDED_SOURCE_VALUE = /^(?:x-forwarded-for|forwarded|for)\s*(?::|=)/i;
const SOURCE_KEY_HMAC_DOMAIN = "catering-auth-rate-limit-v1\u0000";
const DUMMY_PIN = "000000";
const DUMMY_PIN_HASH = "scrypt$16384$8$1$000102030405060708090a0b0c0d0e0f$" + "00".repeat(32);
// Node's default libuv worker pool has four threads, so this fixed cap prevents unbounded scrypt queue growth without deployment tuning.
const KDF_CONCURRENCY_LIMIT = 4;
const KDF_RETRY_AFTER_SECONDS = 1;

let activeKdfReservations = 0;

export type CateringLoginResult =
  | { kind: "success"; user: CateringUserRecord }
  | { kind: "invalid" }
  | { kind: "rate_limited"; retryAfterSeconds: number };

export interface CateringLoginAttempt {
  businessContext: BusinessContext;
  loginCode: string;
  pin: string;
  sourceKey: string;
}

interface SourceBucket {
  failures: number;
  windowStartedAtMs: number;
}

type SourceBucketReference =
  | { kind: "fallback" }
  | { kind: "trusted"; key: string };

interface CateringLoginAttemptSnapshot {
  businessContext: BusinessContext;
  loginCode: string;
  pin: string;
  sourceKey: unknown;
}

function invalid(): CateringLoginResult {
  return { kind: "invalid" };
}

function reserveKdf(): (() => void) | undefined {
  if (activeKdfReservations >= KDF_CONCURRENCY_LIMIT) return undefined;

  activeKdfReservations += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeKdfReservations -= 1;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidAttemptSnapshot(): CateringLoginAttemptSnapshot {
  return {
    businessContext: { businessId: "" },
    loginCode: "",
    pin: "",
    sourceKey: ""
  };
}

function snapshotAttempt(value: unknown): CateringLoginAttemptSnapshot {
  try {
    if (!isRecord(value)) return invalidAttemptSnapshot();

    const businessContext = value.businessContext;
    const loginCode = value.loginCode;
    const pin = value.pin;
    const sourceKey = value.sourceKey;
    if (!isRecord(businessContext)) return invalidAttemptSnapshot();

    const businessId = businessContext.businessId;
    if (
      typeof businessId !== "string"
      || typeof loginCode !== "string"
      || typeof pin !== "string"
    ) {
      return invalidAttemptSnapshot();
    }

    return {
      businessContext: { businessId },
      loginCode,
      pin,
      sourceKey
    };
  } catch {
    // Untrusted request objects can contain accessors or proxies; an incomplete snapshot must not select a real user.
    return invalidAttemptSnapshot();
  }
}

function normalizedSourceKey(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (
    trimmed.length === 0
    || trimmed.length > SOURCE_KEY_MAX_LENGTH
    || !PRINTABLE_ASCII.test(trimmed)
    || trimmed.includes(",")
    || FORWARDED_SOURCE_VALUE.test(trimmed)
  ) {
    return undefined;
  }

  // Source keys come from the immediate server-side peer; forwarded-header syntax is deliberately never a second source of truth.
  return trimmed.toLowerCase();
}

function validPinForWork(value: unknown): string {
  return typeof value === "string" && SIX_ASCII_DIGITS.test(value) ? value : DUMMY_PIN;
}

function nowFrom(clock: () => Date): Date | undefined {
  try {
    const current = clock();
    if (!(current instanceof Date) || Number.isNaN(current.getTime())) return undefined;
    return new Date(current.getTime());
  } catch {
    return undefined;
  }
}

function isActiveFailureWindow(user: CateringUserRecord, now: Date): boolean {
  if (!user.failureWindowStartedAt) return false;
  const startedAtMs = new Date(user.failureWindowStartedAt).getTime();
  return Number.isFinite(startedAtMs) && now.getTime() - startedAtMs < FAILURE_WINDOW_MS;
}

function isLocked(user: CateringUserRecord, now: Date): boolean {
  if (!user.lockedUntil) return false;
  const lockedUntilMs = new Date(user.lockedUntil).getTime();
  return Number.isFinite(lockedUntilMs) && lockedUntilMs > now.getTime();
}

function failedLoginReplacement(user: CateringUserRecord, now: Date): CateringUserRecord {
  const activeWindow = isActiveFailureWindow(user, now);
  const failedLoginCount = activeWindow ? user.failedLoginCount + 1 : 1;
  const failureWindowStartedAt = activeWindow ? user.failureWindowStartedAt! : now.toISOString();
  const lockedUntil = failedLoginCount >= ACCOUNT_FAILURE_LIMIT
    ? new Date(now.getTime() + ACCOUNT_LOCK_MS).toISOString()
    : undefined;
  const { failureWindowStartedAt: _previousWindow, lockedUntil: _previousLock, ...unchanged } = user;

  return {
    ...unchanged,
    failedLoginCount,
    failureWindowStartedAt,
    ...(lockedUntil ? { lockedUntil } : {}),
    version: user.version + 1,
    updatedAt: now.toISOString()
  };
}

function successfulLoginReplacement(user: CateringUserRecord, now: Date): CateringUserRecord {
  const { failureWindowStartedAt: _previousWindow, lockedUntil: _previousLock, ...unchanged } = user;

  return {
    ...unchanged,
    failedLoginCount: 0,
    version: user.version + 1,
    updatedAt: now.toISOString()
  };
}

function hasSameRetryableLoginSubject(
  verifiedUser: CateringUserRecord,
  currentUser: CateringUserRecord
): boolean {
  // Only the login state may drift after PIN verification; any business, subject, credential, or authorization change fails closed.
  return (
    verifiedUser.schemaVersion === currentUser.schemaVersion
    && verifiedUser.businessId === currentUser.businessId
    && verifiedUser.userId === currentUser.userId
    && verifiedUser.loginCodeCanonical === currentUser.loginCodeCanonical
    && verifiedUser.displayName === currentUser.displayName
    && verifiedUser.pinHash === currentUser.pinHash
    && verifiedUser.role === currentUser.role
    && verifiedUser.active === currentUser.active
    && verifiedUser.authEpoch === currentUser.authEpoch
    && verifiedUser.createdAt === currentUser.createdAt
  );
}

class BoundedSourceLimiter {
  private readonly trustedBuckets = new Map<string, SourceBucket>();
  private fallbackBucket: SourceBucket | undefined;
  private readonly secret: Buffer;

  constructor(secret: Buffer) {
    this.secret = Buffer.from(secret);
  }

  referenceFor(sourceKey: unknown): SourceBucketReference {
    const normalized = normalizedSourceKey(sourceKey);
    if (!normalized) return { kind: "fallback" };

    return {
      kind: "trusted",
      key: createHmac("sha256", this.secret)
        .update(SOURCE_KEY_HMAC_DOMAIN, "utf8")
        .update(normalized, "utf8")
        .digest("hex")
    };
  }

  rateLimitFor(reference: SourceBucketReference, now: Date): CateringLoginResult | undefined {
    const bucket = this.currentBucket(reference, now);
    if (!bucket || bucket.failures < SOURCE_FAILURE_LIMIT) return undefined;

    return {
      kind: "rate_limited",
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((bucket.windowStartedAtMs + FAILURE_WINDOW_MS - now.getTime()) / 1_000)
      )
    };
  }

  recordFailure(reference: SourceBucketReference, now: Date): CateringLoginResult | undefined {
    const current = this.currentBucket(reference, now);
    if (current && current.failures >= SOURCE_FAILURE_LIMIT) {
      return this.rateLimitFor(reference, now);
    }

    const next: SourceBucket = current
      ? { ...current, failures: current.failures + 1 }
      : { failures: 1, windowStartedAtMs: now.getTime() };
    this.storeBucket(reference, next, now);
    return undefined;
  }

  private currentBucket(reference: SourceBucketReference, now: Date): SourceBucket | undefined {
    if (reference.kind === "fallback") {
      if (this.fallbackBucket && this.isExpired(this.fallbackBucket, now)) {
        this.fallbackBucket = undefined;
      }
      return this.fallbackBucket;
    }

    const bucket = this.trustedBuckets.get(reference.key);
    if (!bucket) return undefined;
    if (this.isExpired(bucket, now)) {
      this.trustedBuckets.delete(reference.key);
      return undefined;
    }

    // Reinsert on access so eviction removes the least recently used trusted source first.
    this.trustedBuckets.delete(reference.key);
    this.trustedBuckets.set(reference.key, bucket);
    return bucket;
  }

  private storeBucket(reference: SourceBucketReference, bucket: SourceBucket, now: Date): void {
    if (reference.kind === "fallback") {
      this.fallbackBucket = bucket;
      return;
    }

    this.removeExpiredTrustedBuckets(now);
    this.trustedBuckets.delete(reference.key);
    if (this.trustedBuckets.size >= MAX_TRUSTED_SOURCE_BUCKETS) {
      const oldest = this.trustedBuckets.keys().next().value;
      if (oldest) this.trustedBuckets.delete(oldest);
    }
    this.trustedBuckets.set(reference.key, bucket);
  }

  private removeExpiredTrustedBuckets(now: Date): void {
    for (const [key, bucket] of this.trustedBuckets) {
      if (this.isExpired(bucket, now)) this.trustedBuckets.delete(key);
    }
  }

  private isExpired(bucket: SourceBucket, now: Date): boolean {
    return bucket.windowStartedAtMs + FAILURE_WINDOW_MS <= now.getTime();
  }
}

export class CateringLoginService {
  private readonly userStore: CateringUserStore;
  private readonly sourceLimiter: BoundedSourceLimiter;
  private readonly now: () => Date;

  constructor(input: {
    userStore: CateringUserStore;
    rateLimitSecret: Buffer;
    now?: () => Date;
  }) {
    if (!input || !input.userStore || !Buffer.isBuffer(input.rateLimitSecret) || input.rateLimitSecret.length === 0) {
      throw new Error("Login-Service-Konfiguration ist ungültig.");
    }
    this.userStore = input.userStore;
    this.sourceLimiter = new BoundedSourceLimiter(input.rateLimitSecret);
    this.now = input.now ?? (() => new Date());
  }

  async authenticate(input: CateringLoginAttempt): Promise<CateringLoginResult> {
    const attempt = snapshotAttempt(input);
    const source = this.sourceLimiter.referenceFor(attempt.sourceKey);
    const now = nowFrom(this.now);
    const sourceRateLimit = now ? this.sourceLimiter.rateLimitFor(source, now) : undefined;
    if (sourceRateLimit) return sourceRateLimit;

    const releaseKdf = reserveKdf();
    if (!releaseKdf) {
      return { kind: "rate_limited", retryAfterSeconds: KDF_RETRY_AFTER_SECONDS };
    }

    let user: CateringUserRecord | undefined;
    let pinMatches = false;

    try {
      const lookup = await this.lookup(attempt);
      user = lookup?.kind === "unique" ? lookup.user : undefined;
      const pinIsCanonical = SIX_ASCII_DIGITS.test(attempt.pin);
      const pin = validPinForWork(attempt.pin);
      // A malformed credential still receives one dummy KDF, but it must never be checked against a real account hash.
      const pinHash = pinIsCanonical && user ? user.pinHash : DUMMY_PIN_HASH;
      try {
        const verifiedPin = await verifyCateringPin(pin, pinHash);
        pinMatches = pinIsCanonical && verifiedPin;
      } catch {
        pinMatches = false;
      }
    } finally {
      releaseKdf();
    }

    if (!now) return invalid();

    const activeUserWithWrongPin = user && user.active && !isLocked(user, now) && !pinMatches;
    if (!user || !pinMatches || !user.active || isLocked(user, now)) {
      const rateLimit = this.sourceLimiter.recordFailure(source, now);
      if (rateLimit) return rateLimit;
      if (!activeUserWithWrongPin || !user) return invalid();

      await this.persistFailedLogin(attempt.businessContext, user, now);
      return invalid();
    }

    try {
      const mutation = await this.userStore.replaceExact(
        attempt.businessContext,
        user,
        successfulLoginReplacement(user, now)
      );
      return mutation.kind === "updated" ? { kind: "success", user: mutation.user } : invalid();
    } catch {
      return invalid();
    }
  }

  private async persistFailedLogin(
    context: BusinessContext,
    verifiedUser: CateringUserRecord,
    now: Date
  ): Promise<void> {
    let expectedUser = verifiedUser;

    for (let attempt = 0; attempt < ACCOUNT_FAILURE_LIMIT; attempt += 1) {
      if (isLocked(expectedUser, now)) return;

      try {
        const mutation = await this.userStore.replaceExact(
          context,
          expectedUser,
          failedLoginReplacement(expectedUser, now)
        );
        if (mutation.kind !== "conflict") return;
      } catch {
        return;
      }

      const currentUser = await this.retryableLoginState(context, verifiedUser);
      if (!currentUser || isLocked(currentUser, now)) return;
      expectedUser = currentUser;
    }
  }

  private async retryableLoginState(
    context: BusinessContext,
    verifiedUser: CateringUserRecord
  ): Promise<CateringUserRecord | undefined> {
    try {
      const currentUser = await this.userStore.getById(context, verifiedUser.userId);
      if (!currentUser || !hasSameRetryableLoginSubject(verifiedUser, currentUser)) {
        return undefined;
      }
      return currentUser;
    } catch {
      return undefined;
    }
  }

  private async lookup(input: CateringLoginAttemptSnapshot): Promise<CateringUserLookup | undefined> {
    try {
      return await this.userStore.findByLoginCode(
        input.businessContext,
        input.loginCode
      );
    } catch {
      return undefined;
    }
  }
}
