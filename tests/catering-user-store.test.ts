import { chmodSync, lstatSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";
import * as sharedCore from "../shared-core/src/index.js";
import { hashCateringPin } from "../shared-core/src/catering-pin-crypto.js";
import {
  CateringUserStore,
  createCateringUserRecord,
  type CateringUserRecord
} from "../shared-core/src/catering-user-store.js";
import type { BusinessContext } from "../shared-core/src/business-context.js";
import { createBusinessScopedPersistentCollection } from "../shared-core/src/persistence.js";

const context: BusinessContext = { businessId: "the-one" };
const now = new Date("2026-08-28T09:00:00.000Z");
const later = new Date("2026-08-28T09:01:00.000Z");

function root(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-user-store-"));
}

function permissionMode(filePath: string): number {
  return lstatSync(filePath).mode & 0o777;
}

function user(input: {
  businessId?: string;
  userId: string;
  loginCode: string;
  displayName?: string;
  pinHash: string;
  role?: CateringUserRecord["role"];
  active?: boolean;
  at?: Date;
}): CateringUserRecord {
  return createCateringUserRecord({
    businessId: input.businessId ?? context.businessId,
    userId: input.userId,
    loginCode: input.loginCode,
    displayName: input.displayName ?? "Admin Test",
    pinHash: input.pinHash,
    role: input.role ?? "admin",
    active: input.active ?? true,
    now: input.at ?? now
  });
}

async function requiredUser(
  store: CateringUserStore,
  businessContext: BusinessContext,
  userId: string
): Promise<CateringUserRecord> {
  const found = await store.getById(businessContext, userId);
  if (!found) throw new Error(`Benutzer ${userId} wurde nicht gefunden.`);
  return found;
}

describe("Catering user store", () => {
  it("exports the user store through the shared-core public surface", () => {
    expect(sharedCore.CateringUserStore).toBe(CateringUserStore);
    expect(sharedCore.createCateringUserRecord).toBe(createCateringUserRecord);
  });

  it("creates a file-backed user record with owner-only POSIX modes under a permissive umask", async () => {
    const dataRoot = root();
    const previousUmask = process.umask(0);
    try {
      const store = new CateringUserStore({ rootDir: dataRoot });
      const pinHash = await hashCateringPin("482731");

      await expect(store.create(context, user({
        userId: "user-permissions-create",
        loginCode: "permissions-create",
        pinHash
      }))).resolves.toBe("created");

      const userDirectory = path.join(dataRoot, "businesses", context.businessId, "auth", "users");
      expect({
        directory: permissionMode(userDirectory),
        record: permissionMode(path.join(userDirectory, "user-permissions-create.json"))
      }).toEqual({ directory: 0o700, record: 0o600 });
    } finally {
      process.umask(previousUmask);
    }
  });

  it("restores owner-only POSIX modes during a file-backed security replacement", async () => {
    const dataRoot = root();
    const store = new CateringUserStore({ rootDir: dataRoot });
    const pinHash = await hashCateringPin("482731");
    await store.create(context, user({
      userId: "user-permissions-replace",
      loginCode: "permissions-replace",
      pinHash
    }));
    const before = await requiredUser(store, context, "user-permissions-replace");
    const userDirectory = path.join(dataRoot, "businesses", context.businessId, "auth", "users");
    const userFile = path.join(userDirectory, "user-permissions-replace.json");
    chmodSync(userDirectory, 0o777);
    chmodSync(userFile, 0o666);

    const previousUmask = process.umask(0);
    try {
      await expect(store.updateSecurity(context, before, {
        role: "read_only_operator"
      }, later)).resolves.toMatchObject({ kind: "updated" });

      expect({
        directory: permissionMode(userDirectory),
        record: permissionMode(userFile)
      }).toEqual({ directory: 0o700, record: 0o600 });
    } finally {
      process.umask(previousUmask);
    }
  });

  it("keeps userId as immutable subject and rejects a duplicate canonical login code", async () => {
    const store = new CateringUserStore({ rootDir: root() });
    const pinHash = await hashCateringPin("482731");
    const first = await store.create(context, user({
      userId: "user-admin",
      loginCode: " Admin ",
      displayName: "Admin Test",
      pinHash,
      role: "admin",
      active: true
    }));
    const duplicate = await store.create(context, user({
      userId: "user-other",
      loginCode: "admin",
      displayName: "Other",
      pinHash,
      role: "read_only_operator",
      active: true
    }));

    expect(first).toBe("created");
    expect(duplicate).toBe("duplicate_login_code");
    await expect(store.findByLoginCode(context, "ADMIN")).resolves.toMatchObject({
      kind: "unique",
      user: { userId: "user-admin", role: "admin" }
    });

    const stored = await requiredUser(store, context, "user-admin");
    await expect(store.replaceExact(context, stored, {
      ...stored,
      userId: "different-subject",
      version: stored.version + 1,
      updatedAt: later.toISOString()
    })).rejects.toThrow();
  });

  it("rejects a record outside the trusted business context and keeps equal IDs isolated", async () => {
    const store = new CateringUserStore({ rootDir: root() });
    const pinHash = await hashCateringPin("482731");

    await expect(store.create(context, user({
      businessId: "other-business",
      userId: "user-admin",
      loginCode: "admin",
      pinHash
    }))).rejects.toThrow("Betriebskontext");

    await expect(store.create(context, user({
      userId: "user-admin",
      loginCode: "admin",
      pinHash
    }))).resolves.toBe("created");
    await expect(store.getById({ businessId: "other-business" }, "user-admin")).resolves.toBeUndefined();
  });

  it("allows exactly one parallel creator for a canonical login code", async () => {
    const dataRoot = root();
    const firstStore = new CateringUserStore({ rootDir: dataRoot });
    const secondStore = new CateringUserStore({ rootDir: dataRoot });
    const pinHash = await hashCateringPin("482731");

    const results = await Promise.all([
      firstStore.create(context, user({ userId: "user-one", loginCode: "operator", pinHash })),
      secondStore.create(context, user({ userId: "user-two", loginCode: " OPERATOR ", pinHash }))
    ]);

    expect(results.filter((result) => result === "created")).toHaveLength(1);
    expect(results.filter((result) => result === "duplicate_login_code")).toHaveLength(1);
    await expect(firstStore.findByLoginCode(context, "operator")).resolves.toMatchObject({ kind: "unique" });
  });

  it("snapshots a create input before asynchronous locking", async () => {
    const store = new CateringUserStore({ rootDir: root() });
    const pinHash = await hashCateringPin("482731");
    const supplied = user({ userId: "user-snapshot", loginCode: "original", pinHash });

    const creation = store.create(context, supplied);
    supplied.loginCodeCanonical = "rewritten";
    supplied.role = "read_only_operator";
    supplied.active = false;

    await expect(creation).resolves.toBe("created");
    await expect(store.findByLoginCode(context, "original")).resolves.toMatchObject({
      kind: "unique",
      user: { userId: "user-snapshot", role: "admin", active: true }
    });
    await expect(store.findByLoginCode(context, "rewritten")).resolves.toEqual({ kind: "missing" });
  });

  it("persists a flat snapshot instead of an inherited toJSON payload", async () => {
    const store = new CateringUserStore({ rootDir: root() });
    const pinHash = await hashCateringPin("482731");
    const record = user({ userId: "user-json", loginCode: "original-json", pinHash });
    const supplied = Object.assign(
      Object.create({
        toJSON: () => ({
          ...record,
          loginCodeCanonical: "rewritten-json",
          role: "read_only_operator",
          active: false
        })
      }),
      record
    ) as CateringUserRecord;

    await expect(store.create(context, supplied)).resolves.toBe("created");
    await expect(store.findByLoginCode(context, "original-json")).resolves.toMatchObject({
      kind: "unique",
      user: { userId: "user-json", role: "admin", active: true }
    });
    await expect(store.findByLoginCode(context, "rewritten-json")).resolves.toEqual({ kind: "missing" });
  });

  it("reports exact-CAS conflicts instead of overwriting a concurrent record", async () => {
    const store = new CateringUserStore({ rootDir: root() });
    const pinHash = await hashCateringPin("482731");
    await store.create(context, user({ userId: "user-production", loginCode: "production", pinHash }));
    const before = await requiredUser(store, context, "user-production");
    const updated = await store.replaceExact(context, before, {
      ...before,
      failedLoginCount: before.failedLoginCount + 1,
      version: before.version + 1,
      updatedAt: later.toISOString()
    });

    expect(updated).toMatchObject({ kind: "updated", user: { failedLoginCount: 1 } });
    await expect(store.replaceExact(context, before, {
      ...before,
      failedLoginCount: before.failedLoginCount + 1,
      version: before.version + 1,
      updatedAt: later.toISOString()
    })).resolves.toEqual({ kind: "conflict" });
  });

  it("snapshots exact-CAS records before PostgreSQL serialization", async () => {
    const { Pool } = newDb({ noAstCoverageCheck: true }).adapters.createPg();
    const store = new CateringUserStore({ pgPool: new Pool() });
    const pinHash = await hashCateringPin("482731");
    const replacementPinHash = await hashCateringPin("947162");
    await store.create(context, user({ userId: "user-postgres", loginCode: "postgres-user", pinHash }));
    const before = await requiredUser(store, context, "user-postgres");
    const replacement = {
      ...before,
      failedLoginCount: before.failedLoginCount + 1,
      version: before.version + 1,
      updatedAt: later.toISOString()
    };

    const update = store.replaceExact(context, before, replacement);
    replacement.loginCodeCanonical = "rewritten-postgres";
    replacement.pinHash = replacementPinHash;
    replacement.role = "read_only_operator";
    replacement.active = false;

    await expect(update).resolves.toMatchObject({
      kind: "updated",
      user: {
        loginCodeCanonical: "postgres-user",
        pinHash,
        role: "admin",
        active: true,
        failedLoginCount: 1
      }
    });
    await expect(store.findByLoginCode(context, "postgres-user")).resolves.toMatchObject({
      kind: "unique",
      user: { pinHash, role: "admin", active: true, failedLoginCount: 1 }
    });
    await expect(store.findByLoginCode(context, "rewritten-postgres")).resolves.toEqual({ kind: "missing" });
  });

  it("increments authEpoch once for role, PIN or active changes but not login failures", async () => {
    const store = new CateringUserStore({ rootDir: root() });
    const pinHash = await hashCateringPin("482731");
    const replacementPinHash = await hashCateringPin("947162");
    await store.create(context, user({ userId: "user-production", loginCode: "production", pinHash }));
    const before = await requiredUser(store, context, "user-production");
    const failed = await store.replaceExact(context, before, {
      ...before,
      failedLoginCount: before.failedLoginCount + 1,
      version: before.version + 1,
      updatedAt: now.toISOString()
    });

    expect(failed).toMatchObject({ kind: "updated", user: { authEpoch: before.authEpoch } });
    if (failed.kind !== "updated") throw new Error("expected login-state update");
    const changedRole = await store.updateSecurity(context, failed.user, {
      role: "read_only_operator"
    }, later);
    expect(changedRole).toMatchObject({
      kind: "updated",
      user: { authEpoch: before.authEpoch + 1, role: "read_only_operator" }
    });
    if (changedRole.kind !== "updated") throw new Error("expected role update");
    const changedPin = await store.updateSecurity(context, changedRole.user, {
      pinHash: replacementPinHash
    }, new Date("2026-08-28T09:02:00.000Z"));
    expect(changedPin).toMatchObject({ kind: "updated", user: { authEpoch: before.authEpoch + 2 } });
    if (changedPin.kind !== "updated") throw new Error("expected PIN update");
    const changedActive = await store.updateSecurity(context, changedPin.user, {
      active: false
    }, new Date("2026-08-28T09:03:00.000Z"));
    expect(changedActive).toMatchObject({
      kind: "updated",
      user: { authEpoch: before.authEpoch + 3, active: false }
    });
  });

  it("fails closed for invalid records and ambiguous legacy login codes", async () => {
    const invalidRoot = root();
    const invalidStore = new CateringUserStore({ rootDir: invalidRoot });
    const invalidRawUsers = createBusinessScopedPersistentCollection<Record<string, unknown>>({
      collectionName: "auth/users",
      getId: (record) => String(record.userId),
      rootDir: invalidRoot
    });
    const pinHash = await hashCateringPin("482731");
    const valid = user({ userId: "user-valid", loginCode: "valid-user", pinHash });

    await invalidRawUsers.insert(context, { ...valid, role: "not-a-role" });
    await expect(invalidStore.getById(context, "user-valid")).rejects.toThrow("Catering-Benutzerdatensatz");

    const ambiguousRoot = root();
    const ambiguousStore = new CateringUserStore({ rootDir: ambiguousRoot });
    const ambiguousRawUsers = createBusinessScopedPersistentCollection<Record<string, unknown>>({
      collectionName: "auth/users",
      getId: (record) => String(record.userId),
      rootDir: ambiguousRoot
    });
    const first = user({ userId: "legacy-one", loginCode: "legacy", pinHash });
    const second = user({ userId: "legacy-two", loginCode: "legacy", pinHash });
    await ambiguousRawUsers.insert(context, first as unknown as Record<string, unknown>);
    await ambiguousRawUsers.insert(context, second as unknown as Record<string, unknown>);
    await expect(ambiguousStore.findByLoginCode(context, "legacy")).resolves.toEqual({ kind: "ambiguous" });
  });
});
