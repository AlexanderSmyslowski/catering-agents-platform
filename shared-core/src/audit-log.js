import { createHash } from "node:crypto";
import { createPersistentCollection } from "./persistence.js";
function auditIdFor(entry) {
    const fingerprint = createHash("sha1")
        .update([
        entry.at,
        entry.action,
        entry.entityType,
        entry.entityId,
        entry.actor.name,
        entry.summary
    ].join(":"))
        .digest("hex")
        .slice(0, 8);
    return `audit-${entry.at}-${fingerprint}`;
}
export function actorNameFromHeaders(headers, fallback) {
    const headerValue = headers["x-actor-name"];
    if (Array.isArray(headerValue)) {
        return headerValue[0] ?? fallback;
    }
    return headerValue ?? fallback;
}
export class AuditLogStore {
    entries;
    constructor(options) {
        this.entries = createPersistentCollection({
            collectionName: "audit/events",
            getId: (entry) => entry.auditId,
            rootDir: options?.rootDir,
            databaseUrl: options?.databaseUrl,
            pgPool: options?.pgPool
        });
    }
    async log(input) {
        const entryWithoutId = {
            ...input,
            at: input.at ?? new Date().toISOString()
        };
        const entry = {
            ...entryWithoutId,
            auditId: auditIdFor(entryWithoutId)
        };
        await this.entries.set(entry);
        return entry;
    }
    async listRecent(limit = 50) {
        const items = await this.entries.list();
        return items
            .sort((left, right) => right.at.localeCompare(left.at))
            .slice(0, limit);
    }
    async count() {
        const items = await this.entries.list();
        return items.length;
    }
}
