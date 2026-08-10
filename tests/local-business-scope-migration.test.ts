import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { newDb } from "pg-mem";
import { afterEach, describe, expect, it } from "vitest";
import { AuditLogStore } from "../shared-core/src/audit-log.js";
import {
  createEventRequestFromText,
  createOfferDraft,
  normalizeEventRequestToSpec,
  SCHEMA_VERSION,
  validateProductionDraft,
  type AuditEntry,
  type OfferDraft,
  type ProductionDraft,
  type Queryable
} from "../shared-core/src/index.js";
import { runLocalBusinessScopeMigration } from "../scripts/migrate-local-business-scope.js";
import { createBusinessScopedPersistentCollection, createPersistentCollection } from "../shared-core/src/persistence.js";

const dataRoots: string[] = [];

function legacyProductionDraft(draftId: string): ProductionDraft {
  const eventSpec = normalizeEventRequestToSpec(createEventRequestFromText({
    requestId: `request-${draftId}`,
    channel: "text",
    rawText: "Lunch fuer 20 Personen."
  }));
  return validateProductionDraft({
    schemaVersion: SCHEMA_VERSION,
    draftId,
    status: "pending_review",
    createdAt: "2026-08-10T00:00:00.000Z",
    source: {
      kind: "manual_import",
      receivedAt: "2026-08-10T00:00:00.000Z",
      sourceRef: "legacy-production-draft"
    },
    guardrails: {
      draftOnly: true,
      humanApprovalRequired: true,
      writesProductObjects: false,
      rawProviderPayloadStored: false,
      knowledgeWritePolicy: "reviewed_only"
    },
    reviewCards: [{
      cardId: `card-${draftId}`,
      kind: "event_data",
      title: "Event pruefen",
      summary: "Legacy-Entwurf",
      decision: "pending",
      targetPath: "$.draftArtifacts.eventSpec",
      targetId: eventSpec.specId,
      requiredApproval: true
    }],
    draftArtifacts: { eventSpec }
  });
}

afterEach(async () => {
  await Promise.all(dataRoots.splice(0).map((rootDir) => rm(rootDir, { recursive: true, force: true })));
});

describe("local business scope migration", () => {
  it("copies legacy audit records once and preserves the source", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-business-migration-"));
    dataRoots.push(rootDir);
    const legacyAudit = createPersistentCollection<Omit<AuditEntry, "businessId">>({
      collectionName: "audit/events",
      getId: (entry) => entry.auditId,
      rootDir
    });
    await legacyAudit.set({
      auditId: "audit-legacy-1",
      at: "2026-08-10T00:00:00.000Z",
      action: "legacy.audit",
      entityType: "Legacy",
      entityId: "legacy-1",
      actor: { name: "Operator", source: "test" },
      summary: "legacy entry"
    });

    await expect(runLocalBusinessScopeMigration({ rootDir, businessId: "local" })).resolves.toMatchObject({
      units: [
        { name: "stage-a-001-audit", status: "migrated" },
        { name: "stage-a-002-offers", status: "migrated" },
        { name: "stage-a-003-production-drafts", status: "migrated" }
      ]
    });
    await expect(runLocalBusinessScopeMigration({ rootDir, businessId: "local" })).resolves.toMatchObject({
      units: [
        { name: "stage-a-001-audit", status: "already_migrated" },
        { name: "stage-a-002-offers", status: "already_migrated" },
        { name: "stage-a-003-production-drafts", status: "already_migrated" }
      ]
    });

    await expect(legacyAudit.list()).resolves.toHaveLength(1);
    await expect(new AuditLogStore({ rootDir }).listRecentFor({ businessId: "local" }, 10)).resolves.toHaveLength(1);
  });

  it("reports the empty offer unit on first run and retry", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-business-migration-empty-"));
    dataRoots.push(rootDir);

    await expect(runLocalBusinessScopeMigration({ rootDir, businessId: "local" })).resolves.toEqual({
      units: [
        { name: "stage-a-001-audit", status: "migrated" },
        { name: "stage-a-002-offers", status: "migrated" },
        { name: "stage-a-003-production-drafts", status: "migrated" }
      ]
    });
    await expect(runLocalBusinessScopeMigration({ rootDir, businessId: "local" })).resolves.toEqual({
      units: [
        { name: "stage-a-001-audit", status: "already_migrated" },
        { name: "stage-a-002-offers", status: "already_migrated" },
        { name: "stage-a-003-production-drafts", status: "already_migrated" }
      ]
    });
  });

  it("records file evidence for every discarded handoff while preserving the legacy source", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-business-migration-offers-"));
    dataRoots.push(rootDir);
    const legacy = createPersistentCollection<Record<string, unknown>>({ collectionName: "offers/drafts", getId: (draft) => String(draft.draftId), rootDir });
    const draft = createOfferDraft(createEventRequestFromText({ requestId: "legacy-offer", channel: "text", rawText: "Lunch fuer 20 Personen." }));
    const legacyDraft = { ...draft, productionHandoff: { legacy: true } };
    await legacy.set(legacyDraft);

    await expect(runLocalBusinessScopeMigration({ rootDir, businessId: "local" })).resolves.toMatchObject({
      units: [
        { name: "stage-a-001-audit", status: "migrated" },
        { name: "stage-a-002-offers", status: "migrated" },
        { name: "stage-a-003-production-drafts", status: "migrated" }
      ]
    });

    await expect(legacy.list()).resolves.toEqual([legacyDraft]);
    const scoped = createBusinessScopedPersistentCollection<OfferDraft>({ collectionName: "offers/drafts", getId: (item) => item.draftId, rootDir });
    const migrated = await scoped.get({ businessId: "local" }, draft.draftId);
    expect(migrated).not.toHaveProperty("productionHandoff");
    const manifest = JSON.parse(readFileSync(path.join(rootDir, "businesses/local/migrations/business-scope-manifest.json"), "utf8"));
    expect(manifest.completed["stage-a-002-offers"]).toMatchObject({
      sourceCount: 1,
      targetCount: 1,
      legacyHandoffDiscarded: true,
      discardedHandoffCount: 1
    });
    expect(manifest.completed["stage-a-002-offers"].hash).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.completed["stage-a-002-offers"].strippedHandoffHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("resumes the file offer migration after records publish before completion", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-business-migration-resume-"));
    dataRoots.push(rootDir);
    const legacy = createPersistentCollection<Record<string, unknown>>({ collectionName: "offers/drafts", getId: (draft) => String(draft.draftId), rootDir });
    await legacy.set({ ...createOfferDraft(createEventRequestFromText({ requestId: "legacy-resume", channel: "text", rawText: "Lunch fuer 20 Personen." })), productionHandoff: { legacy: true } });

    await expect(runLocalBusinessScopeMigration({
      rootDir,
      businessId: "local",
      faultInjector: (phase) => { if (phase === "after_offer_record_publish") throw new Error("stop"); }
    })).rejects.toThrow("stop");
    await expect(runLocalBusinessScopeMigration({ rootDir, businessId: "local" })).resolves.toMatchObject({
      units: [
        { status: "already_migrated" },
        { name: "stage-a-002-offers", status: "migrated" },
        { name: "stage-a-003-production-drafts", status: "migrated" }
      ]
    });
  });

  it("records and retries PostgreSQL offer completion evidence without deleting legacy records", async () => {
    const { Pool } = newDb({ noAstCoverageCheck: true }).adapters.createPg();
    const pool: Queryable = new Pool();
    const legacy = createPersistentCollection<Record<string, unknown>>({ collectionName: "offers/drafts", getId: (draft) => String(draft.draftId), pgPool: pool });
    const legacyDraft = { ...createOfferDraft(createEventRequestFromText({ requestId: "legacy-pg", channel: "text", rawText: "Lunch fuer 20 Personen." })), productionHandoff: { legacy: true } };
    await legacy.set(legacyDraft);

    await expect(runLocalBusinessScopeMigration({ pgPool: pool, businessId: "local" })).resolves.toMatchObject({
      units: [
        { status: "migrated" },
        { name: "stage-a-002-offers", status: "migrated" },
        { name: "stage-a-003-production-drafts", status: "migrated" }
      ]
    });
    await expect(runLocalBusinessScopeMigration({ pgPool: pool, businessId: "local" })).resolves.toEqual({
      units: [
        { name: "stage-a-001-audit", status: "already_migrated" },
        { name: "stage-a-002-offers", status: "already_migrated" },
        { name: "stage-a-003-production-drafts", status: "already_migrated" }
      ]
    });
    await expect(legacy.list()).resolves.toEqual([legacyDraft]);
    const completion = await pool.query("SELECT source_count, target_count, hash, legacy_handoff_discarded, discarded_handoff_count, stripped_handoff_hash FROM catering_business_migrations WHERE business_id = $1 AND unit_name = $2", ["local", "stage-a-002-offers"]);
    expect(completion.rows[0]).toMatchObject({ source_count: 1, target_count: 1, legacy_handoff_discarded: true, discarded_handoff_count: 1 });
    expect(completion.rows[0]?.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(completion.rows[0]?.stripped_handoff_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("resumes PostgreSQL offer migration after record publication", async () => {
    const { Pool } = newDb({ noAstCoverageCheck: true }).adapters.createPg();
    const pool: Queryable = new Pool();
    const legacy = createPersistentCollection<Record<string, unknown>>({ collectionName: "offers/drafts", getId: (draft) => String(draft.draftId), pgPool: pool });
    await legacy.set({ ...createOfferDraft(createEventRequestFromText({ requestId: "legacy-pg-resume", channel: "text", rawText: "Lunch fuer 20 Personen." })), productionHandoff: { legacy: true } });

    await expect(runLocalBusinessScopeMigration({
      pgPool: pool,
      businessId: "local",
      faultInjector: (phase) => { if (phase === "after_offer_record_publish") throw new Error("stop"); }
    })).rejects.toThrow("stop");
    await expect(runLocalBusinessScopeMigration({ pgPool: pool, businessId: "local" })).resolves.toMatchObject({
      units: [
        { status: "already_migrated" },
        { name: "stage-a-002-offers", status: "migrated" },
        { name: "stage-a-003-production-drafts", status: "migrated" }
      ]
    });
  });

  it("backfills discarded-handoff evidence for already-complete file and PostgreSQL units", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-business-migration-backfill-"));
    dataRoots.push(rootDir);
    const legacyFile = createPersistentCollection<Record<string, unknown>>({ collectionName: "offers/drafts", getId: (draft) => String(draft.draftId), rootDir });
    await legacyFile.set({ ...createOfferDraft(createEventRequestFromText({ requestId: "legacy-backfill-file", channel: "text", rawText: "Lunch fuer 20 Personen." })), productionHandoff: { legacy: true } });
    const manifestPath = path.join(rootDir, "businesses/local/migrations/business-scope-manifest.json");
    mkdirSync(path.dirname(manifestPath), { recursive: true });
    writeFileSync(manifestPath, JSON.stringify({ completed: {
      "stage-a-001-audit": { completedAt: "2026-08-10T00:00:00.000Z", sourceCount: 0, targetCount: 0, hash: "a".repeat(64) },
      "stage-a-002-offers": { completedAt: "2026-08-10T00:00:00.000Z", sourceCount: 1, targetCount: 1, hash: "b".repeat(64), legacyHandoffDiscarded: true, strippedHandoffHash: "c".repeat(64) }
    } }));
    await expect(runLocalBusinessScopeMigration({ rootDir, businessId: "local" })).resolves.toMatchObject({
      units: [
        { status: "already_migrated" },
        { status: "already_migrated" },
        { name: "stage-a-003-production-drafts", status: "migrated" }
      ]
    });
    const backfilledManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    expect(backfilledManifest.completed["stage-a-002-offers"].discardedHandoffCount).toBe(1);

    const { Pool } = newDb({ noAstCoverageCheck: true }).adapters.createPg();
    const pool: Queryable = new Pool();
    const legacyPg = createPersistentCollection<Record<string, unknown>>({ collectionName: "offers/drafts", getId: (draft) => String(draft.draftId), pgPool: pool });
    await legacyPg.set({ ...createOfferDraft(createEventRequestFromText({ requestId: "legacy-backfill-pg", channel: "text", rawText: "Lunch fuer 20 Personen." })), productionHandoff: { legacy: true } });
    await pool.query("CREATE TABLE catering_business_migrations (business_id TEXT NOT NULL, unit_name TEXT NOT NULL, completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), source_count INTEGER NOT NULL, target_count INTEGER NOT NULL, hash TEXT NOT NULL, PRIMARY KEY (business_id, unit_name))");
    await pool.query("INSERT INTO catering_business_migrations (business_id, unit_name, source_count, target_count, hash) VALUES ('local', 'stage-a-001-audit', 0, 0, $1), ('local', 'stage-a-002-offers', 1, 1, $2)", ["a".repeat(64), "b".repeat(64)]);
    await expect(runLocalBusinessScopeMigration({ pgPool: pool, businessId: "local" })).resolves.toMatchObject({
      units: [
        { status: "already_migrated" },
        { status: "already_migrated" },
        { name: "stage-a-003-production-drafts", status: "migrated" }
      ]
    });
    const completion = await pool.query("SELECT legacy_handoff_discarded, discarded_handoff_count, stripped_handoff_hash FROM catering_business_migrations WHERE unit_name = 'stage-a-002-offers'");
    expect(completion.rows[0]).toMatchObject({ legacy_handoff_discarded: true, discarded_handoff_count: 1 });
    expect(completion.rows[0]?.stripped_handoff_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("resumes an append-only file migration of legacy ProductionDrafts with count and hash evidence", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-business-migration-production-drafts-"));
    dataRoots.push(rootDir);
    const legacy = createPersistentCollection<ProductionDraft>({
      collectionName: "production/drafts",
      getId: (draft) => draft.draftId,
      validate: validateProductionDraft,
      rootDir
    });
    const source = legacyProductionDraft("production-draft-legacy-file");
    await legacy.set(source);

    await expect(runLocalBusinessScopeMigration({
      rootDir,
      businessId: "local",
      faultInjector: (phase: string) => {
        if (phase === "after_production_draft_record_publish") throw new Error("stop");
      }
    })).rejects.toThrow("stop");
    await expect(runLocalBusinessScopeMigration({ rootDir, businessId: "local" })).resolves.toMatchObject({
      units: [{ status: "already_migrated" }, { status: "already_migrated" }, {
        name: "stage-a-003-production-drafts",
        status: "migrated"
      }]
    });
    await expect(runLocalBusinessScopeMigration({ rootDir, businessId: "local" })).resolves.toMatchObject({
      units: [{ status: "already_migrated" }, { status: "already_migrated" }, {
        name: "stage-a-003-production-drafts",
        status: "already_migrated"
      }]
    });

    await expect(legacy.list()).resolves.toEqual([source]);
    const scoped = createBusinessScopedPersistentCollection<ProductionDraft>({
      collectionName: "production/drafts",
      getId: (draft) => draft.draftId,
      validate: validateProductionDraft,
      rootDir
    });
    await expect(scoped.get({ businessId: "local" }, source.draftId)).resolves.toEqual({
      ...source,
      businessId: "local"
    });
    const manifest = JSON.parse(readFileSync(
      path.join(rootDir, "businesses/local/migrations/business-scope-manifest.json"),
      "utf8"
    ));
    expect(manifest.completed["stage-a-003-production-drafts"]).toMatchObject({
      sourceCount: 1,
      targetCount: 1
    });
    expect(manifest.completed["stage-a-003-production-drafts"].hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("migrates legacy PostgreSQL ProductionDrafts once and preserves completion evidence", async () => {
    const { Pool } = newDb({ noAstCoverageCheck: true }).adapters.createPg();
    const pool: Queryable = new Pool();
    const legacy = createPersistentCollection<ProductionDraft>({
      collectionName: "production/drafts",
      getId: (draft) => draft.draftId,
      validate: validateProductionDraft,
      pgPool: pool
    });
    const source = legacyProductionDraft("production-draft-legacy-pg");
    await legacy.set(source);

    await expect(runLocalBusinessScopeMigration({ pgPool: pool, businessId: "local" })).resolves.toMatchObject({
      units: [{ status: "migrated" }, { status: "migrated" }, {
        name: "stage-a-003-production-drafts",
        status: "migrated"
      }]
    });
    await expect(runLocalBusinessScopeMigration({ pgPool: pool, businessId: "local" })).resolves.toMatchObject({
      units: [{ status: "already_migrated" }, { status: "already_migrated" }, {
        name: "stage-a-003-production-drafts",
        status: "already_migrated"
      }]
    });

    await expect(legacy.list()).resolves.toEqual([source]);
    const scoped = createBusinessScopedPersistentCollection<ProductionDraft>({
      collectionName: "production/drafts",
      getId: (draft) => draft.draftId,
      validate: validateProductionDraft,
      pgPool: pool
    });
    await expect(scoped.get({ businessId: "local" }, source.draftId)).resolves.toEqual({
      ...source,
      businessId: "local"
    });
    const completion = await pool.query(
      "SELECT source_count, target_count, hash FROM catering_business_migrations WHERE business_id = $1 AND unit_name = $2",
      ["local", "stage-a-003-production-drafts"]
    );
    expect(completion.rows[0]).toMatchObject({ source_count: 1, target_count: 1 });
    expect(completion.rows[0]?.hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
