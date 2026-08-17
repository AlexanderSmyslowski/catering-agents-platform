import { createHash } from "node:crypto";
import { createBusinessScopedPersistentCollection, type CollectionStorageOptions } from "./persistence.js";
import type { BusinessContext } from "./business-context.js";
import type { AuditEntry } from "./types.js";

function auditIdFor(entry: Omit<AuditEntry, "auditId">, idempotencyKey?: string): string {
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

  async listRecentFor(context: BusinessContext, limit = 50): Promise<AuditEntry[]> {
    const items = await this.entries.list(context);
    return items
      .sort((left, right) => right.at.localeCompare(left.at))
      .slice(0, limit);
  }

  async getFor(context: BusinessContext, auditId: string): Promise<AuditEntry | undefined> {
    return this.entries.get(context, auditId);
  }

  async countFor(context: BusinessContext): Promise<number> {
    const items = await this.entries.list(context);
    return items.length;
  }
}
