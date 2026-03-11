import { createHash } from "node:crypto";
import { createPersistentCollection, type CollectionStorageOptions } from "./persistence.js";
import type { AuditEntry } from "./types.js";

function auditIdFor(entry: Omit<AuditEntry, "auditId">): string {
  const fingerprint = createHash("sha1")
    .update(
      [
        entry.at,
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
    this.entries = createPersistentCollection<AuditEntry>({
      collectionName: "audit/events",
      getId: (entry) => entry.auditId,
      rootDir: options?.rootDir,
      databaseUrl: options?.databaseUrl,
      pgPool: options?.pgPool
    });
  }

  async log(input: Omit<AuditEntry, "auditId" | "at"> & { at?: string }): Promise<AuditEntry> {
    const entryWithoutId: Omit<AuditEntry, "auditId"> = {
      ...input,
      at: input.at ?? new Date().toISOString()
    };
    const entry: AuditEntry = {
      ...entryWithoutId,
      auditId: auditIdFor(entryWithoutId)
    };
    await this.entries.set(entry);
    return entry;
  }

  async listRecent(limit = 50): Promise<AuditEntry[]> {
    const items = await this.entries.list();
    return items
      .sort((left, right) => right.at.localeCompare(left.at))
      .slice(0, limit);
  }

  async count(): Promise<number> {
    const items = await this.entries.list();
    return items.length;
  }
}
