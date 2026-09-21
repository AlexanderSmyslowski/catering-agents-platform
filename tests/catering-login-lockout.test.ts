import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import * as sharedCore from "../shared-core/src/index.js";
import * as cateringPinCrypto from "../shared-core/src/catering-pin-crypto.js";
import { hashCateringPin } from "../shared-core/src/catering-pin-crypto.js";
import {
  CateringLoginService,
  type CateringLoginAttempt
} from "../shared-core/src/catering-login-service.js";
import {
  CateringUserStore,
  createCateringUserRecord,
  type CateringUserRecord
} from "../shared-core/src/catering-user-store.js";
import type { BusinessContext } from "../shared-core/src/business-context.js";

const context: BusinessContext = { businessId: "the-one" };
const validPin = "482731";
const startAt = "2026-08-28T10:00:00.000Z";
const sourceCacheCapacity = 128;
const kdfConcurrencyLimit = 4;

function root(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-login-lockout-"));
}

function clock(initial = startAt) {
  let current = new Date(initial);
  return {
    now: () => new Date(current),
    set: (next: string) => {
      current = new Date(next);
    }
  };
}

function loginAttempt(loginCode: string, pin: string, sourceKey = "trusted-socket-203.0.113.10") {
  return { businessContext: context, loginCode, pin, sourceKey };
}

async function requiredUser(
  store: CateringUserStore,
  userId: string
): Promise<CateringUserRecord> {
  const found = await store.getById(context, userId);
  if (!found) throw new Error(`Benutzer ${userId} wurde nicht gefunden.`);
  return found;
}

async function addUser(
  store: CateringUserStore,
  at: Date,
  input: { userId: string; loginCode: string; pin?: string; active?: boolean }
): Promise<CateringUserRecord> {
  const result = await store.create(context, createCateringUserRecord({
    businessId: context.businessId,
    userId: input.userId,
    loginCode: input.loginCode,
    displayName: `Test ${input.userId}`,
    pinHash: await hashCateringPin(input.pin ?? validPin),
    role: "admin",
    active: input.active ?? true,
    now: at
  }));
  if (result !== "created") throw new Error(`Benutzer ${input.userId} konnte nicht angelegt werden.`);
  return requiredUser(store, input.userId);
}

async function fixture() {
  const currentClock = clock();
  const store = new CateringUserStore({ rootDir: root() });
  const login = new CateringLoginService({
    userStore: store,
    rateLimitSecret: Buffer.alloc(32, 7),
    now: currentClock.now
  });
  return { currentClock, login, store };
}

describe("Catering login lockout", () => {
  it("exports the login service through the shared-core public surface", () => {
    expect((sharedCore as Record<string, unknown>).CateringLoginService).toBe(CateringLoginService);
  });

  it("locks the account on the twelfth failure inside fifteen minutes", async () => {
    const { currentClock, login, store } = await fixture();
    await addUser(store, currentClock.now(), { userId: "user-admin", loginCode: "admin" });

    for (let attempt = 1; attempt <= 12; attempt += 1) {
      await expect(login.authenticate(loginAttempt("admin", "000000"))).resolves.toEqual({ kind: "invalid" });
    }

    const stored = await requiredUser(store, "user-admin");
    expect(stored.failedLoginCount).toBe(12);
    expect(stored.failureWindowStartedAt).toBe(startAt);
    expect(stored.lockedUntil).toBe("2026-08-28T10:10:00.000Z");
    await expect(login.authenticate(loginAttempt("admin", validPin))).resolves.toEqual({ kind: "invalid" });
  });

  it("persists twelve wrong-PIN failures in admission-sized parallel batches before locking the account", async () => {
    const { currentClock, login, store } = await fixture();
    await addUser(store, currentClock.now(), { userId: "user-parallel", loginCode: "parallel" });
    const expectedAttempts = 12;
    const realVerifier = cateringPinCrypto.verifyCateringPin;
    const verifier = vi.spyOn(cateringPinCrypto, "verifyCateringPin");

    try {
      const results = [];
      for (let batchStart = 0; batchStart < expectedAttempts; batchStart += kdfConcurrencyLimit) {
        let verifiedAttempts = 0;
        let releaseVerifiedAttempts!: () => void;
        const allVerified = new Promise<void>((resolve) => {
          releaseVerifiedAttempts = resolve;
        });
        verifier.mockImplementation(async (pin, storedHash) => {
          const result = await realVerifier(pin, storedHash);
          verifiedAttempts += 1;
          if (verifiedAttempts === kdfConcurrencyLimit) releaseVerifiedAttempts();
          await allVerified;
          return result;
        });
        results.push(...await Promise.all(Array.from(
          { length: kdfConcurrencyLimit },
          () => login.authenticate(loginAttempt("parallel", "000000"))
        )));
      }

      expect(results).toEqual(Array.from({ length: expectedAttempts }, () => ({ kind: "invalid" })));
      const stored = await requiredUser(store, "user-parallel");
      expect(stored.failedLoginCount).toBe(12);
      expect(stored.lockedUntil).toBe("2026-08-28T10:10:00.000Z");
    } finally {
      verifier.mockRestore();
    }
  });

  it("returns the same external result for unknown, inactive, locked and wrong-PIN users", async () => {
    const { currentClock, login, store } = await fixture();
    await addUser(store, currentClock.now(), { userId: "user-inactive", loginCode: "inactive", active: false });
    await addUser(store, currentClock.now(), { userId: "user-locked", loginCode: "locked" });
    await addUser(store, currentClock.now(), { userId: "user-known", loginCode: "known" });
    const locked = await requiredUser(store, "user-locked");
    const lockUpdate = await store.replaceExact(context, locked, {
      ...locked,
      failedLoginCount: 12,
      failureWindowStartedAt: startAt,
      lockedUntil: "2026-08-28T10:10:00.000Z",
      version: locked.version + 1,
      updatedAt: startAt
    });
    if (lockUpdate.kind !== "updated") throw new Error("Sperrfixture konnte nicht angelegt werden.");

    const results = await Promise.all([
      login.authenticate(loginAttempt("missing", "111111")),
      login.authenticate(loginAttempt("inactive", "111111")),
      login.authenticate(loginAttempt("locked", validPin)),
      login.authenticate(loginAttempt("known", "111111"))
    ]);

    expect(results).toEqual(results.map(() => ({ kind: "invalid" })));
  });

  it("performs exactly one dummy scrypt for unknown and malformed credential attempts", async () => {
    const { login } = await fixture();
    const verifier = vi.spyOn(cateringPinCrypto, "verifyCateringPin");

    try {
      await expect(login.authenticate(loginAttempt("missing-user", validPin))).resolves.toEqual({ kind: "invalid" });
      expect(verifier).toHaveBeenCalledTimes(1);
      expect(verifier).toHaveBeenLastCalledWith(
        validPin,
        expect.stringMatching(/^scrypt\$16384\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{64}$/)
      );

      verifier.mockClear();
      await expect(login.authenticate(loginAttempt("missing-user", "not-a-pin"))).resolves.toEqual({ kind: "invalid" });
      expect(verifier).toHaveBeenCalledTimes(1);
      expect(verifier).toHaveBeenLastCalledWith(
        "000000",
        expect.stringMatching(/^scrypt\$16384\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{64}$/)
      );

      verifier.mockClear();
      await expect(login.authenticate(loginAttempt("!", validPin))).resolves.toEqual({ kind: "invalid" });
      expect(verifier).toHaveBeenCalledTimes(1);
      expect(verifier).toHaveBeenLastCalledWith(
        validPin,
        expect.stringMatching(/^scrypt\$16384\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{64}$/)
      );
    } finally {
      verifier.mockRestore();
    }
  });

  it("never verifies a malformed PIN against the matching real account hash", async () => {
    const { currentClock, login, store } = await fixture();
    const user = await addUser(store, currentClock.now(), {
      userId: "user-zero-pin",
      loginCode: "zero-pin",
      pin: "000000"
    });
    const verifier = vi.spyOn(cateringPinCrypto, "verifyCateringPin");

    try {
      await expect(login.authenticate(loginAttempt("zero-pin", "not-a-pin"))).resolves.toEqual({ kind: "invalid" });
      expect(verifier).toHaveBeenCalledTimes(1);
      const [observedPin, observedHash] = verifier.mock.calls[0] ?? ["", ""];
      expect(observedPin).toBe("000000");
      expect(observedHash).not.toBe(user.pinHash);
    } finally {
      verifier.mockRestore();
    }
  });

  it("uses one dummy scrypt and a generic invalid result when sourceKey access throws", async () => {
    const { currentClock, login, store } = await fixture();
    const user = await addUser(store, currentClock.now(), { userId: "user-source-accessor", loginCode: "source-accessor" });
    const verifier = vi.spyOn(cateringPinCrypto, "verifyCateringPin");
    const attempt = {
      businessContext: context,
      loginCode: "source-accessor",
      pin: validPin,
      get sourceKey(): string {
        throw new Error("sourceKey getter must not escape the login boundary");
      }
    };

    try {
      await expect(login.authenticate(attempt as CateringLoginAttempt)).resolves.toEqual({ kind: "invalid" });
      expect(verifier).toHaveBeenCalledTimes(1);
      const [observedPin, observedHash] = verifier.mock.calls[0] ?? ["", ""];
      expect(observedPin).toBe("000000");
      expect(observedHash).toMatch(/^scrypt\$16384\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
      expect(observedHash).not.toBe(user.pinHash);
    } finally {
      verifier.mockRestore();
    }
  });

  it("uses one dummy scrypt and a generic invalid result when pin access throws", async () => {
    const { currentClock, login, store } = await fixture();
    const user = await addUser(store, currentClock.now(), { userId: "user-pin-accessor", loginCode: "pin-accessor" });
    const verifier = vi.spyOn(cateringPinCrypto, "verifyCateringPin");
    const attempt = {
      businessContext: context,
      loginCode: "pin-accessor",
      sourceKey: "trusted-socket-203.0.113.61",
      get pin(): string {
        throw new Error("PIN getter must not escape the login boundary");
      }
    };

    try {
      await expect(login.authenticate(attempt as CateringLoginAttempt)).resolves.toEqual({ kind: "invalid" });
      expect(verifier).toHaveBeenCalledTimes(1);
      const [observedPin, observedHash] = verifier.mock.calls[0] ?? ["", ""];
      expect(observedPin).toBe("000000");
      expect(observedHash).toMatch(/^scrypt\$16384\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
      expect(observedHash).not.toBe(user.pinHash);
    } finally {
      verifier.mockRestore();
    }
  });

  it("resets an expired account failure window before counting the next wrong PIN", async () => {
    const { currentClock, login, store } = await fixture();
    await addUser(store, currentClock.now(), { userId: "user-window", loginCode: "window" });

    await expect(login.authenticate(loginAttempt("window", "000000"))).resolves.toEqual({ kind: "invalid" });
    currentClock.set("2026-08-28T10:16:00.000Z");
    await expect(login.authenticate(loginAttempt("window", "000000"))).resolves.toEqual({ kind: "invalid" });

    const stored = await requiredUser(store, "user-window");
    expect(stored.failedLoginCount).toBe(1);
    expect(stored.failureWindowStartedAt).toBe("2026-08-28T10:16:00.000Z");
    expect(stored.lockedUntil).toBeUndefined();
  });

  it("shares a sixty-failure source budget across login codes and keeps other trusted sources separate", async () => {
    const { login, store } = await fixture();
    const sharedSource = "trusted-socket-203.0.113.30";
    const verifier = vi.spyOn(cateringPinCrypto, "verifyCateringPin");

    try {
      for (let attempt = 1; attempt <= 60; attempt += 1) {
        await expect(login.authenticate(loginAttempt(`missing-${attempt}`, "000000", sharedSource))).resolves.toEqual({ kind: "invalid" });
      }

      verifier.mockClear();
      const lookup = vi.spyOn(store, "findByLoginCode");
      await expect(login.authenticate(loginAttempt("missing-after-limit", "000000", sharedSource))).resolves.toEqual({
        kind: "rate_limited",
        retryAfterSeconds: 900
      });
      expect(verifier).not.toHaveBeenCalled();
      expect(lookup).not.toHaveBeenCalled();
      await expect(login.authenticate(loginAttempt("missing-other-source", "000000", "trusted-socket-203.0.113.31"))).resolves.toEqual({
        kind: "invalid"
      });
    } finally {
      verifier.mockRestore();
    }
  });

  it("admits at most four concurrent KDF checks across sources and releases reservations when verification throws", async () => {
    const { login } = await fixture();
    let releaseVerifiers!: () => void;
    const verifiersMayFinish = new Promise<void>((resolve) => {
      releaseVerifiers = resolve;
    });
    const verifier = vi.spyOn(cateringPinCrypto, "verifyCateringPin").mockImplementation(async () => {
      await verifiersMayFinish;
      throw new Error("synthetic verifier failure");
    });
    const admittedAttempts: Array<Promise<Awaited<ReturnType<CateringLoginService["authenticate"]>>>> = [];
    let overflowAttempt: Promise<Awaited<ReturnType<CateringLoginService["authenticate"]>>> | undefined;

    try {
      for (let attempt = 1; attempt <= kdfConcurrencyLimit; attempt += 1) {
        admittedAttempts.push(login.authenticate(loginAttempt(
          `concurrent-${attempt}`,
          "000000",
          `trusted-socket-198.51.100.${attempt}`
        )));
      }
      await vi.waitFor(() => expect(verifier).toHaveBeenCalledTimes(kdfConcurrencyLimit));

      let overflowSettled = false;
      overflowAttempt = login.authenticate(loginAttempt(
        "concurrent-overflow",
        "000000",
        "trusted-socket-198.51.100.250"
      )).finally(() => {
        overflowSettled = true;
      });
      await vi.waitFor(() => {
        expect(overflowSettled || verifier.mock.calls.length > kdfConcurrencyLimit).toBe(true);
      });
      const verifierCallsBeforeRelease = verifier.mock.calls.length;

      releaseVerifiers();
      const [admittedResults, overflowResult] = await Promise.all([
        Promise.all(admittedAttempts),
        overflowAttempt
      ]);

      expect(verifierCallsBeforeRelease).toBe(kdfConcurrencyLimit);
      expect(admittedResults).toEqual(Array.from({ length: kdfConcurrencyLimit }, () => ({ kind: "invalid" })));
      expect(overflowResult).toEqual({ kind: "rate_limited", retryAfterSeconds: 1 });

      await expect(login.authenticate(loginAttempt(
        "concurrent-after-throw",
        "000000",
        "trusted-socket-198.51.100.251"
      ))).resolves.toEqual({ kind: "invalid" });
      expect(verifier).toHaveBeenCalledTimes(kdfConcurrencyLimit + 1);
    } finally {
      releaseVerifiers();
      await Promise.allSettled([
        ...admittedAttempts,
        ...(overflowAttempt ? [overflowAttempt] : [])
      ]);
      verifier.mockRestore();
    }
  });

  it("uses one strict fallback bucket for unknown sources and ignores forwarding-header values", async () => {
    const { login } = await fixture();

    for (let attempt = 1; attempt <= 60; attempt += 1) {
      const unknownSource = attempt % 2 === 0 ? "" : " \t ";
      await expect(login.authenticate(loginAttempt(`fallback-${attempt}`, "000000", unknownSource))).resolves.toEqual({ kind: "invalid" });
    }

    await expect(login.authenticate(loginAttempt("forwarded-probe", "000000", "X-Forwarded-For: 198.51.100.40"))).resolves.toEqual({
      kind: "rate_limited",
      retryAfterSeconds: 900
    });
    await expect(login.authenticate(loginAttempt("forwarded-value-probe", "000000", "for=198.51.100.41"))).resolves.toEqual({
      kind: "rate_limited",
      retryAfterSeconds: 900
    });
  });

  it("evicts the least-recent source bucket when the bounded limiter cache fills", async () => {
    const { login } = await fixture();
    const evictedSource = "trusted-socket-203.0.113.50";

    for (let attempt = 1; attempt <= 60; attempt += 1) {
      await expect(login.authenticate(loginAttempt(`evicted-${attempt}`, "000000", evictedSource))).resolves.toEqual({ kind: "invalid" });
    }

    for (let source = 1; source <= sourceCacheCapacity; source += 1) {
      await expect(login.authenticate(loginAttempt(
        `cache-fill-${source}`,
        "000000",
        `trusted-socket-198.51.100.${source}`
      ))).resolves.toEqual({ kind: "invalid" });
    }

    await expect(login.authenticate(loginAttempt("evicted-after-fill", "000000", evictedSource))).resolves.toEqual({ kind: "invalid" });
  });

  it("returns the current exact user only after a successful login-state CAS", async () => {
    const { currentClock, login, store } = await fixture();
    const before = await addUser(store, currentClock.now(), { userId: "user-success", loginCode: "success" });

    const result = await login.authenticate(loginAttempt("success", validPin));
    const stored = await requiredUser(store, "user-success");

    expect(result).toEqual({ kind: "success", user: stored });
    expect(stored.version).toBe(before.version + 1);
    expect(stored.failedLoginCount).toBe(0);
    expect(stored.failureWindowStartedAt).toBeUndefined();
    expect(stored.lockedUntil).toBeUndefined();
  });

  it("fails closed when the post-PIN CAS races", async () => {
    const { currentClock, login, store } = await fixture();
    await addUser(store, currentClock.now(), { userId: "user-race", loginCode: "race" });
    vi.spyOn(store, "replaceExact").mockResolvedValue({ kind: "conflict" });

    await expect(login.authenticate(loginAttempt("race", validPin))).resolves.toEqual({ kind: "invalid" });
  });
});
