import { createHash } from "node:crypto";
import {
  createBusinessScopedPersistentCollection,
  type CollectionStorageOptions
} from "./persistence.js";
import type { BusinessContext } from "./business-context.js";
import { areJsonValuesEqual } from "./json-equality.js";
import type { AuditEntry } from "./types.js";

export interface AuditLogWriteResult {
  entry: AuditEntry;
  created: boolean;
}

export class AuditLogEntryConflictError extends Error {
  readonly statusCode = 409;

  constructor(auditId: string) {
    super(`Audit-Eintrag ${auditId} ist bereits mit abweichendem Inhalt vorhanden.`);
    this.name = "AuditLogEntryConflictError";
  }
}

/**
 * The audit file was linked, but a post-publication operation failed.  The
 * entry is explicitly owned by this write attempt and may be compensated by
 * the caller without treating an arbitrary read-back as ownership.
 */
export class AuditLogPostPublishError extends Error {
  readonly created = true;

  constructor(
    readonly entry: AuditEntry,
    readonly cause: unknown
  ) {
    super("Audit-Eintrag wurde veröffentlicht, aber der Schreibvorgang ist danach fehlgeschlagen.");
    this.name = "AuditLogPostPublishError";
  }
}

export function auditIdFor(entry: Omit<AuditEntry, "auditId">, idempotencyKey?: string): string {
  if (idempotencyKey) {
    const fingerprint = createHash("sha256")
      .update([entry.businessId, entry.action, entry.entityType, entry.entityId, idempotencyKey].join(":"))
      .digest("hex");
    return `audit-stable-${fingerprint}`;
  }
  const fingerprint = createHash("sha1")
    .update(
      [
        entry.at,
        entry.businessId,
        entry.action,
        entry.entityType,
        entry.entityId,
        entry.actor.name,
        entry.summary
      ].join(":")
    )
    .digest("hex")
    .slice(0, 8);
  return `audit-${entry.at}-${fingerprint}`;
}

export function actorNameFromHeaders(
  headers: Record<string, string | string[] | undefined>,
  fallback: string
): string {
  const headerValue = headers["x-actor-name"];
  if (Array.isArray(headerValue)) {
    return headerValue[0] ?? fallback;
  }

  return headerValue ?? fallback;
}

export class AuditLogStore {
  private readonly entries;

  constructor(options?: CollectionStorageOptions) {
    this.entries = createBusinessScopedPersistentCollection<AuditEntry>({
      collectionName: "audit/events",
      getId: (entry) => entry.auditId,
      rootDir: options?.rootDir,
      databaseUrl: options?.databaseUrl,
      pgPool: options?.pgPool
    });
  }

  async logFor(
    context: BusinessContext,
    input: Omit<AuditEntry, "auditId" | "at" | "businessId"> & { at?: string; idempotencyKey?: string }
  ): Promise<AuditEntry> {
    const { idempotencyKey, ...auditInput } = input;
    const entryWithoutId: Omit<AuditEntry, "auditId"> = {
      ...auditInput,
      // Session actors carry live authorization state; audit persists only stable identity and provenance.
      actor: {
        name: auditInput.actor.name,
        source: auditInput.actor.source
      },
      businessId: context.businessId,
      at: auditInput.at ?? new Date().toISOString()
    };
    const entry: AuditEntry = {
      ...entryWithoutId,
      auditId: auditIdFor(entryWithoutId, idempotencyKey)
    };
    if (idempotencyKey) {
      const inserted = await this.entries.insert(context, entry);
      if (inserted === "exists") return (await this.entries.get(context, entry.auditId))!;
    } else {
      await this.entries.set(context, entry);
    }
    return entry;
  }

  /**
   * Atomically create or verify an idempotent audit entry.  The collection insert
   * is the ownership decision; an existing record is reusable only when its full
   * persisted content is exactly the entry this operation expected.
   */
  async logForWithResult(
    context: BusinessContext,
    input: Omit<AuditEntry, "auditId" | "at" | "businessId"> & { at?: string; idempotencyKey: string }
  ): Promise<AuditLogWriteResult> {
    const { idempotencyKey, ...auditInput } = input;
    const entryWithoutId: Omit<AuditEntry, "auditId"> = {
      ...auditInput,
      actor: {
        name: auditInput.actor.name,
        source: auditInput.actor.source
      },
      businessId: context.businessId,
      at: auditInput.at ?? new Date().toISOString()
    };
    const entry: AuditEntry = {
      ...entryWithoutId,
      auditId: auditIdFor(entryWithoutId, idempotencyKey)
    };
    const inserted = await this.entries.insertWithResult(context, entry);
    if (inserted.error) throw new AuditLogPostPublishError(entry, inserted.error);
    if (inserted.status === "created") return { entry, created: true };

    const existing = await this.entries.get(context, entry.auditId);
    if (!existing) {
      throw new Error(`Audit-Eintrag ${entry.auditId} war nach dem atomaren Insert nicht lesbar.`);
    }
    if (!areJsonValuesEqual(existing, entry)) {
      throw new AuditLogEntryConflictError(entry.auditId);
    }
    return { entry: existing, created: false };
  }

  async listRecentFor(context: BusinessContext, limit = 50): Promise<AuditEntry[]> {
    const items = await this.entries.list(context);
    return items
      .sort((left, right) => right.at.localeCompare(left.at))
      .slice(0, limit);
  }

  async getFor(context: BusinessContext, auditId: string): Promise<AuditEntry | undefined> {
    return this.entries.get(context, auditId);
  }

  async deleteIfExact(
    context: BusinessContext,
    entry: AuditEntry
  ): Promise<"deleted" | "conflict" | "missing"> {
    return this.entries.deleteIfExact(context, entry.auditId, entry);
  }

  async countFor(context: BusinessContext): Promise<number> {
    const items = await this.entries.list(context);
    return items.length;
  }
}
