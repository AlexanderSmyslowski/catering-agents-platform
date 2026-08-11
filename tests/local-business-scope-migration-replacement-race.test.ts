import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { newDb } from "pg-mem";
import { describe, expect, it, vi } from "vitest";

const replacementRace = vi.hoisted(() => ({
  armed: false,
  recordId: "",
  entered: undefined as (() => void) | undefined,
  release: undefined as Promise<void> | undefined
}));

vi.mock("../shared-core/src/persistence.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../shared-core/src/persistence.js")>();
  const createCollection = (<T>(options: import("../shared-core/src/persistence.js").PersistentCollectionOptions<T>) => {
    const collection = actual.createBusinessScopedPersistentCollection(options);
    if (options.collectionName !== "production/drafts") return collection;

    const pauseReplacement = async (recordId: string) => {
      if (!replacementRace.armed || replacementRace.recordId !== recordId) return;
      replacementRace.armed = false;
      replacementRace.entered?.();
      await replacementRace.release;
    };
    const exactReplace = (collection as unknown as {
      compareAndSetExact?: (...args: unknown[]) => Promise<unknown>;
    }).compareAndSetExact?.bind(collection);

    return {
      list: collection.list.bind(collection),
      get: async (...args: Parameters<typeof collection.get>) => {
        const value = await collection.get(...args);
        await pauseReplacement(args[1]);
        return value;
      },
      set: collection.set.bind(collection),
      insert: collection.insert.bind(collection),
      compareAndSet: collection.compareAndSet.bind(collection),
      ...(exactReplace
        ? {
          compareAndSetExact: async (...args: unknown[]) => {
            await pauseReplacement(String(args[1]));
            return exactReplace(...args);
          }
        }
        : {})
    };
  }) as typeof actual.createBusinessScopedPersistentCollection;

  return { ...actual, createBusinessScopedPersistentCollection: createCollection };
});

import {
  createEventRequestFromText,
  normalizeEventRequestToSpec,
  SCHEMA_VERSION,
  validateProductionDraft,
  type BusinessScopedPersistentCollection,
  type ProductionDraft,
  type Queryable
} from "../shared-core/src/index.js";
import {
  createBusinessScopedPersistentCollection,
  createPersistentCollection,
  type CollectionStorageOptions
} from "../shared-core/src/persistence.js";
import { runLocalBusinessScopeMigration } from "../scripts/migrate-local-business-scope.js";

const context = { businessId: "local" } as const;

function approvedLegacyDraft(draftId: string): ProductionDraft {
  const eventSpec = normalizeEventRequestToSpec(createEventRequestFromText({
    requestId: `request-${draftId}`,
    channel: "text",
    rawText: "Lunch fuer 20 Personen."
  }));
  return validateProductionDraft({
    schemaVersion: SCHEMA_VERSION,
    businessId: context.businessId,
    draftId,
    revision: 1,
    status: "approved",
    createdAt: "2026-08-10T00:00:00.000Z",
    source: {
      kind: "manual_import",
      receivedAt: "2026-08-10T00:00:00.000Z",
      sourceRef: "legacy-approved-draft"
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
      decision: "fits",
      targetPath: "$.draftArtifacts.eventSpec",
      targetId: eventSpec.specId,
      requiredApproval: true,
      decidedBy: "Legacy Operator",
      decidedAt: "2026-08-09T11:59:00.000Z"
    }],
    draftArtifacts: { eventSpec },
    approvalRequestId: `approval-${"a".repeat(64)}`,
    approvedBy: "Legacy Operator",
    approvedAt: "2026-08-09T12:00:00.000Z"
  });
}

function concurrentDraft(approved: ProductionDraft): ProductionDraft {
  return validateProductionDraft({
    ...approved,
    status: "pending_review",
    source: { ...approved.source, sourceRef: "concurrent-scoped-writer" },
    reviewCards: approved.reviewCards.map((card) => {
      const { decidedAt: _decidedAt, decidedBy: _decidedBy, ...pending } = card;
      return { ...pending, decision: "pending" };
    }),
    approvalRequestId: undefined,
    approvedBy: undefined,
    approvedAt: undefined
  });
}

function armReplacementRace(recordId: string): { entered: Promise<void>; release: () => void } {
  let entered!: () => void;
  let release!: () => void;
  const enteredPromise = new Promise<void>((resolve) => { entered = resolve; });
  const releasePromise = new Promise<void>((resolve) => { release = resolve; });
  replacementRace.armed = true;
  replacementRace.recordId = recordId;
  replacementRace.entered = entered;
  replacementRace.release = releasePromise;
  return { entered: enteredPromise, release };
}

async function prepareRace(input: {
  storage: CollectionStorageOptions;
  migrationOptions: CollectionStorageOptions & {
    businessId: string;
    legacyFileWritersQuiesced?: boolean;
    testOnlyAllowPgMemCooperativeFence?: boolean;
  };
  clearStageFourCompletion: () => Promise<void>;
}) {
  const approved = approvedLegacyDraft(`legacy-replacement-race-${Math.random().toString(16).slice(2)}`);
  const legacy = createPersistentCollection<Record<string, unknown>>({
    collectionName: "production/drafts",
    getId: (draft) => String(draft.draftId),
    ...input.storage
  });
  await legacy.set({ ...approved, businessId: undefined });
  await runLocalBusinessScopeMigration(input.migrationOptions);

  const scoped = createBusinessScopedPersistentCollection<ProductionDraft>({
    collectionName: "production/drafts",
    getId: (draft) => draft.draftId,
    validate: validateProductionDraft,
    ...input.storage
  });
  await scoped.set(context, approved);
  await input.clearStageFourCompletion();
  return { approved, concurrent: concurrentDraft(approved), scoped };
}

async function expectRaceRejected(input: {
  migrationOptions: CollectionStorageOptions & {
    businessId: string;
    legacyFileWritersQuiesced?: boolean;
    testOnlyAllowPgMemCooperativeFence?: boolean;
  };
  approved: ProductionDraft;
  concurrent: ProductionDraft;
  scoped: BusinessScopedPersistentCollection<ProductionDraft>;
  completionExists: () => Promise<boolean>;
}) {
  const gate = armReplacementRace(input.approved.draftId);
  const migration = runLocalBusinessScopeMigration(input.migrationOptions);
  await gate.entered;
  await input.scoped.set(context, input.concurrent);
  gate.release();

  await expect(migration).rejects.toThrow(/Legacy-Projektion|gleichzeitig|konflikt/i);
  await expect(input.scoped.get(context, input.approved.draftId)).resolves.toEqual(input.concurrent);
  await expect(input.completionExists()).resolves.toBe(false);
}

describe("stage-a-004 exact legacy replacement", () => {
  it("does not overwrite a concurrent file-backed scoped writer or publish completion", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-migration-exact-file-"));
    const manifestPath = path.join(rootDir, "businesses/local/migrations/business-scope-manifest.json");
    const race = await prepareRace({
      storage: { rootDir },
      migrationOptions: { rootDir, businessId: "local", legacyFileWritersQuiesced: true },
      clearStageFourCompletion: async () => {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
        delete manifest.completed["stage-a-004-production-v2"];
        writeFileSync(manifestPath, JSON.stringify(manifest));
      }
    });

    await expectRaceRejected({
      migrationOptions: { rootDir, businessId: "local", legacyFileWritersQuiesced: true },
      ...race,
      completionExists: async () => Boolean(
        JSON.parse(readFileSync(manifestPath, "utf8")).completed["stage-a-004-production-v2"]
      )
    });
  });

  it("does not overwrite a concurrent PostgreSQL scoped writer or publish completion", async () => {
    const { Pool } = newDb({ noAstCoverageCheck: true }).adapters.createPg();
    const pool: Queryable = new Pool();
    const race = await prepareRace({
      storage: { pgPool: pool },
      migrationOptions: {
        pgPool: pool,
        businessId: "local",
        testOnlyAllowPgMemCooperativeFence: true
      },
      clearStageFourCompletion: async () => {
        await pool.query(
          "DELETE FROM catering_business_migrations WHERE business_id = $1 AND unit_name = $2",
          ["local", "stage-a-004-production-v2"]
        );
      }
    });

    await expectRaceRejected({
      migrationOptions: {
        pgPool: pool,
        businessId: "local",
        testOnlyAllowPgMemCooperativeFence: true
      },
      ...race,
      completionExists: async () => (await pool.query(
        "SELECT unit_name FROM catering_business_migrations WHERE business_id = $1 AND unit_name = $2",
        ["local", "stage-a-004-production-v2"]
      )).rows.length > 0
    });
  });
});
