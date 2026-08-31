import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { newDb } from "pg-mem";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createEventRequestFromText,
  createOfferDraft,
  internalRecipes,
  type ProductionCase,
  type ProductionDraft,
  type ProductionHandoff
} from "@catering/shared-core";
import { buildProductionApp } from "../production-service/src/app.js";
import type { ProductionHandoffReader } from "../production-service/src/ports/production-handoff-reader.js";
import { projectProductionDraft } from "../production-service/src/routes/production-response-projection.js";
import {
  ProductionStore,
  productionDecisionRepositoryFor
} from "../production-service/src/repositories/production-store.js";
import { InMemoryRecipeRepository } from "../production-service/src/repositories/in-memory-recipe-repository.js";
import { InMemoryIntakeRecordsPort } from "./support/in-memory-intake-records-port.js";
import { trustedActorFromHeaders } from "../shared-core/src/access-control.js";

const trustedSecret = "production-case-route-secret";
const alphaHeaders = {
  "x-catering-trusted-secret": trustedSecret,
  "x-catering-actor-name": "Produktions-Mitarbeiter",
  "x-catering-business-id": "alpha"
};
const alphaAdminHeaders = {
  ...alphaHeaders,
  "x-catering-actor-name": "Administrator"
};
const alphaActor = trustedActorFromHeaders(alphaHeaders, {
  fallbackActorName: "Produktions-Mitarbeiter",
  fallbackBusinessId: "alpha",
  trustedActorSecret: trustedSecret
});
const roots: string[] = [];

function handoff(overrides: Partial<ProductionHandoff> = {}): ProductionHandoff {
  const offerDraft = createOfferDraft(createEventRequestFromText({
    requestId: "production-case-handoff-request",
    channel: "text",
    rawText: "Empfang für 45 Personen am 14.06.2026."
  }));
  const eventSpecSnapshot = {
    ...offerDraft.variantSet[0]!.proposedEventSpec,
    customer: { name: "CommCats" },
    event: {
      ...offerDraft.variantSet[0]!.proposedEventSpec.event,
      date: "2026-06-14"
    }
  };
  return {
    schemaVersion: "1.0",
    businessId: "alpha",
    handoffId: `handoff-${"a".repeat(64)}`,
    approvedOfferId: `approved-offer-${"b".repeat(64)}`,
    approvalRequestId: `approval-${"c".repeat(64)}`,
    createdAt: "2026-06-01T08:00:00.000Z",
    eventSpecSnapshot,
    pricingSnapshot: eventSpecSnapshot.budgetContext!.pricingSummary!,
    source: {
      draftId: offerDraft.draftId,
      revision: 1,
      selectedVariantId: offerDraft.variantSet[0]!.variantId
    },
    ...overrides
  };
}

/**
 * These route tests exercise approved production writes, so their event spec
 * must carry the same explicit recipe decision as the canonical workflow.
 * The production guard remains responsible for requiring evidence on a
 * handoff-bound draft; the fixture only supplies the already-decided inputs.
 */
function productionReadyEventSpec(
  spec: ReturnType<typeof handoff>["eventSpecSnapshot"],
  specId = spec.specId
) {
  return {
    ...structuredClone(spec),
    specId,
    menuPlan: spec.menuPlan.map((component) => ({
      ...component,
      menuCategory: component.menuCategory ?? "classic",
      recipeOverrideId: "recipe-caesar-salad",
      productionDecision: {
        ...(component.productionDecision ?? {}),
        mode: "scratch" as const
      }
    }))
  };
}

function buildHarness(handoffReader?: ProductionHandoffReader) {
  const rootDir = mkdtempSync(path.join(tmpdir(), "catering-production-case-routes-"));
  roots.push(rootDir);
  const store = new ProductionStore({ rootDir });
  const repository = new InMemoryRecipeRepository({ rootDir });
  const intakeRecords = new InMemoryIntakeRecordsPort();
  const app = buildProductionApp({
    dataRoot: rootDir,
    repository,
    store,
    intakeRecords,
    handoffReader,
    trustedActorSecret: trustedSecret,
    env: {
      CATERING_DEV_AUTH: "1",
      CATERING_DEFAULT_BUSINESS_ID: "alpha",
      CATERING_TRUSTED_ACTOR_SECRET: trustedSecret
    }
  });
  return { app, store, repository, intakeRecords };
}

function failNextDraftTimelineEvent(store: ProductionStore): void {
  const original = (store as any).appendEventInCollections.bind(store);
  let failed = false;
  vi.spyOn(store as any, "appendEventInCollections").mockImplementation(async (...args: any[]) => {
    const input = args[2] as { kind?: string };
    if (!failed && (input.kind === "draft_created" || input.kind === "revision_created")) {
      failed = true;
      throw new Error("injected draft-created event failure");
    }
    return original(...args);
  });
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

async function createProductionCase(
  app: ReturnType<typeof buildProductionApp>,
  overrides: Record<string, unknown> = {}
) {
  const response = await app.inject({
    method: "POST",
    url: "/v1/production/cases",
    headers: alphaHeaders,
    payload: {
      customerName: "CommCats",
      eventTypeLabel: "Empfang",
      eventDate: "2026-06-14",
      attendeeCount: 45,
      ...overrides
    }
  });
  expect(response.statusCode, response.body).toBe(201);
  return response.json<{ case: ProductionCase }>().case;
}

async function approveDraftForCase(
  app: ReturnType<typeof buildProductionApp>,
  intakeRecords: InMemoryIntakeRecordsPort,
  caseId: string,
  spec: ReturnType<typeof handoff>["eventSpecSnapshot"]
) {
  await intakeRecords.insertSpec({ businessId: "alpha" }, spec);
  const created = await app.inject({
    method: "POST",
    url: "/v1/production/drafts",
    headers: alphaHeaders,
    payload: { caseId, specId: spec.specId }
  });
  expect(created.statusCode, created.body).toBe(201);

  const prepared = await app.inject({
    method: "POST",
    url: `/v1/production/drafts/${created.json().draft.draftId}/prepare`,
    headers: alphaHeaders,
    payload: {}
  });
  expect(prepared.statusCode, prepared.body).toBe(201);

  for (const card of prepared.json().draft.reviewCards) {
    const reviewed = await app.inject({
      method: "PATCH",
      url: `/v1/production/drafts/${prepared.json().draft.draftId}/review-cards/${card.cardId}`,
      headers: alphaHeaders,
      payload: { decision: "fits" }
    });
    expect(reviewed.statusCode, reviewed.body).toBe(200);
  }

  const approved = await app.inject({
    method: "POST",
    url: `/v1/production/drafts/${prepared.json().draft.draftId}/decision`,
    headers: alphaHeaders,
    payload: { decision: "approved" }
  });
  expect(approved.statusCode, approved.body).toBe(201);
  return {
    createdDraftId: created.json().draft.draftId as string,
    draftId: prepared.json().draft.draftId as string,
    approvedProductionSpecId: approved.json().approvedProductionSpec.approvedProductionSpecId as string
  };
}

async function completeProductionCase(
  store: ProductionStore,
  caseId: string
): Promise<ProductionCase> {
  const current = await store.getCase({ businessId: "alpha" }, caseId);
  expect(current).toBeDefined();
  const completedAt = new Date(Date.parse(current!.updatedAt) + 1).toISOString();
  const completed: ProductionCase = {
    ...current!,
    status: "completed",
    approvedProductionSpecId: `approved-production-spec-${current!.version}`,
    currentPlanId: `production-plan-${current!.version}`,
    currentPurchaseListId: `purchase-list-${current!.version}`,
    version: current!.version + 1,
    updatedAt: completedAt
  };
  expect(await store.updateCase(
    { businessId: "alpha" },
    caseId,
    current!.version,
    completed
  )).toBe("updated");
  await store.appendEvent({ businessId: "alpha" }, caseId, {
    at: completedAt,
    role: "system",
    kind: "result",
    text: "Vorheriger Produktionsplan und Einkaufsliste erstellt.",
    artifactId: completed.currentPlanId
  }, `test-result:${completed.version}`);
  return completed;
}

describe("production case routes", () => {
  it("creates server-owned cases and rejects client-owned identity fields", async () => {
    const { app } = buildHarness();
    const rejected = await app.inject({
      method: "POST",
      url: "/v1/production/cases",
      headers: alphaHeaders,
      payload: {
        eventTypeLabel: "Empfang",
        caseId: "client-controlled",
        businessId: "beta",
        status: "completed"
      }
    });

    expect(rejected.statusCode).toBe(422);
    const created = await createProductionCase(app);
    expect(created).toMatchObject({
      businessId: "alpha",
      product: "production",
      displayName: "CommCats - Empfang - 14.06.2026 - 45 Personen",
      status: "open",
      version: 1
    });
    expect(created.caseId).toMatch(/^production-case-/);
  });

  it("lists only trusted-business cases and supports search", async () => {
    const { app, store } = buildHarness();
    const alpha = await createProductionCase(app);
    await createProductionCase(app, {
      customerName: "Andere Firma",
      eventTypeLabel: "Lunch",
      eventDate: "2026-07-01",
      attendeeCount: 20
    });
    await store.createCase({ businessId: "beta" }, {
      ...alpha,
      businessId: "beta",
      caseId: "production-case-beta"
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/production/cases?search=empfang",
      headers: alphaHeaders
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().items).toEqual([{
      caseId: alpha.caseId,
      product: "production",
      displayName: alpha.displayName,
      status: "open",
      createdAt: alpha.createdAt,
      updatedAt: alpha.updatedAt
    }]);
  });

  it("returns case history without exposing a case owned by another business", async () => {
    const { app, store } = buildHarness();
    const alpha = await createProductionCase(app);
    await store.createCase({ businessId: "beta" }, {
      ...alpha,
      businessId: "beta",
      caseId: "production-case-beta"
    });

    const detail = await app.inject({
      method: "GET",
      url: `/v1/production/cases/${alpha.caseId}`,
      headers: alphaHeaders
    });
    const hidden = await app.inject({
      method: "GET",
      url: "/v1/production/cases/production-case-beta",
      headers: alphaHeaders
    });

    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({
      case: { caseId: alpha.caseId },
      events: [{ sequence: 1, role: "system", kind: "case_created" }]
    });
    expect(hidden.statusCode).toBe(404);
  });

  it("keeps commercial administrator messages out of the non-commercial production history", async () => {
    const { app, store } = buildHarness();
    const productionCase = await createProductionCase(app);
    const commercialSentinel = "Verkaufspreis 9.876,54 EUR bei Marge 31 Prozent.";
    const operationalInstruction = "Roastbeef vor dem Anschnitt zehn Minuten ruhen lassen.";

    const commercialMessage = await app.inject({
      method: "POST",
      url: `/v1/production/cases/${productionCase.caseId}/messages`,
      headers: alphaAdminHeaders,
      payload: { text: commercialSentinel, sourceId: "commercial-source-9876" }
    });
    const productionMessage = await app.inject({
      method: "POST",
      url: `/v1/production/cases/${productionCase.caseId}/messages`,
      headers: alphaHeaders,
      payload: { text: operationalInstruction, sourceId: "production-source-roastbeef" }
    });
    const historicalSentinel = "Historische Kalkulation 7.314,29 EUR.";
    await store.appendEvent({ businessId: "alpha" }, productionCase.caseId, {
      at: new Date().toISOString(),
      role: "user",
      kind: "instruction",
      text: historicalSentinel,
      sourceId: "historical-source-7314"
    });

    expect(commercialMessage.statusCode, commercialMessage.body).toBe(201);
    expect(productionMessage.statusCode, productionMessage.body).toBe(201);

    const productionDetail = await app.inject({
      method: "GET",
      url: `/v1/production/cases/${productionCase.caseId}`,
      headers: alphaHeaders
    });
    const adminDetail = await app.inject({
      method: "GET",
      url: `/v1/production/cases/${productionCase.caseId}`,
      headers: alphaAdminHeaders
    });

    expect(productionDetail.statusCode, productionDetail.body).toBe(200);
    expect(productionDetail.body).not.toContain(commercialSentinel);
    expect(productionDetail.body).not.toContain("commercial-source-9876");
    expect(productionDetail.body).not.toContain(historicalSentinel);
    expect(productionDetail.body).not.toContain("historical-source-7314");
    expect(productionDetail.json().events.filter(
      (event: { text?: string }) => event.text === "Vertrauliche Nachricht ausgeblendet."
    )).toHaveLength(2);
    expect(productionDetail.body).toContain(operationalInstruction);
    expect(adminDetail.statusCode, adminDetail.body).toBe(200);
    expect(adminDetail.body).toContain(commercialSentinel);
    expect(adminDetail.body).toContain(historicalSentinel);
    expect(adminDetail.body).toContain(operationalInstruction);

    await expect(store.listEvents({ businessId: "alpha" }, productionCase.caseId)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: commercialSentinel, visibility: "commercial" }),
        expect.objectContaining({ text: operationalInstruction, visibility: "operational" })
      ])
    );
  });

  it("copies into a new open case without inherited approvals or result references", async () => {
    const { app, store } = buildHarness();
    const source: ProductionCase = {
      schemaVersion: "1.0",
      businessId: "alpha",
      caseId: "production-case-approved-source",
      product: "production",
      displayName: "CommCats - Empfang - 14.06.2026 - 45 Personen",
      status: "completed",
      version: 4,
      createdAt: "2026-06-01T08:00:00.000Z",
      updatedAt: "2026-06-14T12:00:00.000Z",
      productionHandoffId: "handoff-source",
      approvedProductionSpecId: "approved-production-source",
      currentPlanId: "plan-source",
      currentPurchaseListId: "purchase-source"
    };
    await store.createCase({ businessId: "alpha" }, source);

    const response = await app.inject({
      method: "POST",
      url: `/v1/production/cases/${source.caseId}/copies`,
      headers: alphaHeaders,
      payload: {}
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().case).toMatchObject({
      product: "production",
      copiedFromCaseId: source.caseId,
      displayName: source.displayName,
      status: "open",
      version: 1
    });
    expect(response.json().case.caseId).not.toBe(source.caseId);
    expect(response.json().case.productionHandoffId).toBeUndefined();
    expect(response.json().case.approvedProductionSpecId).toBeUndefined();
    expect(response.json().case.currentPlanId).toBeUndefined();
    expect(response.json().case.currentPurchaseListId).toBeUndefined();
    expect(response.json().events).toMatchObject([{
      sequence: 1,
      kind: "case_copied",
      artifactId: source.caseId
    }]);
  });

  it("creates a production case from an immutable handoff read through the port", async () => {
    const approvedHandoff = handoff();
    const get = vi.fn(async () => approvedHandoff);
    const { app } = buildHarness({ get });

    const response = await app.inject({
      method: "POST",
      url: `/v1/production/cases/from-handoff/${approvedHandoff.handoffId}`,
      headers: alphaHeaders,
      payload: {}
    });

    expect(response.statusCode, response.body).toBe(201);
    expect(get).toHaveBeenCalledWith(expect.objectContaining({ businessId: "alpha" }), approvedHandoff.handoffId);
    expect(response.json().case).toMatchObject({
      businessId: "alpha",
      product: "production",
      productionHandoffId: approvedHandoff.handoffId,
      displayName: "CommCats - Empfang - 14.06.2026 - 45 Personen",
      status: "open",
      version: 1
    });
  });

  it("reuses the production case when the same immutable handoff is submitted again", async () => {
    const approvedHandoff = handoff();
    const { app, store } = buildHarness({ get: vi.fn(async () => approvedHandoff) });
    const request = () => app.inject({
      method: "POST" as const,
      url: `/v1/production/cases/from-handoff/${approvedHandoff.handoffId}`,
      headers: alphaHeaders,
      payload: {}
    });

    const first = await request();
    const createdCase = first.json<{ case: ProductionCase }>().case;
    expect(await store.updateCase({ businessId: "alpha" }, createdCase.caseId, createdCase.version, {
      ...createdCase,
      status: "completed",
      currentPlanId: "plan-after-handoff",
      version: createdCase.version + 1,
      updatedAt: "2026-06-02T08:00:00.000Z"
    })).toBe("updated");

    const retry = await request();

    expect(first.statusCode, first.body).toBe(201);
    expect(retry.statusCode, retry.body).toBe(201);
    expect(retry.json().case.caseId).toBe(first.json().case.caseId);
    expect(retry.json().case).toMatchObject({
      status: "completed",
      currentPlanId: "plan-after-handoff",
      version: 2
    });
    await expect(store.listCases({ businessId: "alpha" })).resolves.toHaveLength(1);
  });

  it("repairs one draft-created case event when a handoff entry is retried after event persistence failed", async () => {
    const approvedHandoff = handoff();
    const { app, store } = buildHarness({ get: vi.fn(async () => approvedHandoff) });
    const caseResponse = await app.inject({
      method: "POST",
      url: `/v1/production/cases/from-handoff/${approvedHandoff.handoffId}`,
      headers: alphaHeaders,
      payload: {}
    });
    expect(caseResponse.statusCode, caseResponse.body).toBe(201);
    const caseId = caseResponse.json<{ case: ProductionCase }>().case.caseId;
    let injectFailure = true;
    const withPlanningEvidenceCriticalSection = store.withPlanningEvidenceCriticalSection.bind(store);
    vi.spyOn(store, "withPlanningEvidenceCriticalSection").mockImplementation(
      async (context, scopedCaseId, draftId, draftRevision, operation) => {
        return withPlanningEvidenceCriticalSection(context, scopedCaseId, draftId, draftRevision, async (scope) => {
          const appendDraftCreatedEvent = scope.appendDraftCreatedEvent;
          return operation({
            ...scope,
            appendDraftCreatedEvent: async (draft) => {
              if (injectFailure) {
                injectFailure = false;
                throw new Error("injected draft-created event failure");
              }
              return appendDraftCreatedEvent(draft);
            }
          });
        });
      }
    );
    const request = () => app.inject({
      method: "POST" as const,
      url: `/v1/production/drafts/from-handoff/${approvedHandoff.handoffId}`,
      headers: alphaHeaders,
      payload: { caseId }
    });

    const first = await request();
    const retry = await request();
    const secondRetry = await request();

    expect(first.statusCode).toBe(500);
    expect(retry.statusCode, retry.body).toBe(201);
    expect(secondRetry.statusCode, secondRetry.body).toBe(201);
    await expect(store.listProductionDrafts({ businessId: "alpha" })).resolves.toHaveLength(1);
    const events = await store.listEvents({ businessId: "alpha" }, caseId);
    expect(events.filter((event) => event.kind === "draft_created")).toEqual([
      expect.objectContaining({
        artifactId: retry.json().draft.draftId,
        revisionRef: expect.objectContaining({ artifactType: "ProductionDraft", revision: 1 })
      })
    ]);
  });

  it("rejects client-authored handoff case identity and persists nothing", async () => {
    const approvedHandoff = handoff();
    const { app, store } = buildHarness({ get: vi.fn(async () => approvedHandoff) });

    const response = await app.inject({
      method: "POST",
      url: `/v1/production/cases/from-handoff/${approvedHandoff.handoffId}`,
      headers: alphaHeaders,
      payload: { caseId: "client-controlled" }
    });

    expect(response.statusCode).toBe(422);
    await expect(store.listCases({ businessId: "alpha" })).resolves.toHaveLength(0);
  });

  it("creates a case-bound draft from a canonical spec reference and records the successful write", async () => {
    const { app, store, intakeRecords } = buildHarness();
    const productionCase = await createProductionCase(app);
    const spec = handoff().eventSpecSnapshot;
    await intakeRecords.insertSpec({ businessId: "alpha" }, spec);

    const response = await app.inject({
      method: "POST",
      url: "/v1/production/drafts",
      headers: alphaHeaders,
      payload: { caseId: productionCase.caseId, specId: spec.specId }
    });

    expect(response.statusCode, response.body).toBe(201);
    const draft = response.json().draft;
    expect(draft).toMatchObject({
      businessId: "alpha",
      status: "pending_review",
      source: { sourceRef: `accepted-event-spec:${spec.specId}` },
      draftArtifacts: { eventSpec: { specId: spec.specId } }
    });
    expect(await store.listEvents({ businessId: "alpha" }, productionCase.caseId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "draft_created",
          artifactId: draft.draftId,
          revisionRef: expect.objectContaining({ artifactType: "ProductionDraft", revision: 1 })
        })
      ])
    );
  });

  it("does not bind a production case when its owning draft cannot be persisted", async () => {
    const { app, store, intakeRecords } = buildHarness();
    const productionCase = await createProductionCase(app);
    const spec = handoff().eventSpecSnapshot;
    await intakeRecords.insertSpec({ businessId: "alpha" }, spec);
    vi.spyOn(productionDecisionRepositoryFor(store), "withTargetCriticalSection")
      .mockImplementationOnce(async () => {
        throw new Error("injected production draft persistence failure");
      });

    const failed = await app.inject({
      method: "POST",
      url: "/v1/production/drafts",
      headers: alphaHeaders,
      payload: { caseId: productionCase.caseId, specId: spec.specId }
    });

    expect(failed.statusCode).toBe(500);
    const unchangedCase = await store.getCase({ businessId: "alpha" }, productionCase.caseId);
    expect(unchangedCase?.sourceSpecId).toBeUndefined();
    expect(unchangedCase?.version).toBe(productionCase.version);
    await expect(store.listProductionDrafts({ businessId: "alpha" })).resolves.toHaveLength(0);
  });

  it("rolls back a PostgreSQL draft when the case changes after the draft mutation", async () => {
    const database = newDb();
    const { Pool } = database.adapters.createPg();
    const rawPool = new Pool();
    const transactionCommands: string[] = [];
    const pgPool = {
      query: rawPool.query.bind(rawPool),
      async connect() {
        const client = await rawPool.connect();
        let transactionBackup: ReturnType<typeof database.backup> | undefined;
        return {
          async query(sql: string, params?: unknown[]) {
            if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
              transactionCommands.push(sql);
            }
            if (sql === "BEGIN") transactionBackup = database.backup();
            if (sql === "ROLLBACK") {
              const result = await client.query(sql, params);
              // pg-mem records transaction commands but does not restore data on rollback.
              // Restoring its snapshot here models the guarantee this test exercises in PostgreSQL.
              transactionBackup?.restore();
              transactionBackup = undefined;
              return result;
            }
            if (sql === "COMMIT") transactionBackup = undefined;
            if (sql.startsWith("SELECT pg_catalog.pg_advisory_xact_lock")) return { rows: [] };
            if (
              sql.startsWith("UPDATE catering_business_records SET payload") &&
              params?.[1] === "production/cases"
            ) {
              return { rows: [] };
            }
            return client.query(sql, params);
          },
          release: () => client.release()
        };
      }
    };
    const store = new ProductionStore({ pgPool });
    const context = { businessId: "alpha" };
    const createdAt = "2026-06-01T08:00:00.000Z";
    const productionCase: ProductionCase = {
      schemaVersion: "1.0",
      businessId: "alpha",
      caseId: "production-case-postgres-rollback",
      product: "production",
      displayName: "CommCats - Empfang - 14.06.2026 - 45 Personen",
      status: "open",
      version: 1,
      createdAt,
      updatedAt: createdAt
    };
    const spec = handoff().eventSpecSnapshot;
    const draft: ProductionDraft = {
      schemaVersion: spec.schemaVersion,
      businessId: "alpha",
      draftId: "production-draft-postgres-rollback",
      revision: 1,
      status: "pending_review",
      createdAt,
      source: {
        kind: "manual_import",
        receivedAt: createdAt,
        sourceRef: `accepted-event-spec:${spec.specId}`,
        inputHash: `sha256:${"d".repeat(64)}`
      },
      guardrails: {
        draftOnly: true,
        humanApprovalRequired: true,
        writesProductObjects: false,
        rawProviderPayloadStored: false,
        knowledgeWritePolicy: "reviewed_only"
      },
      reviewCards: [{
        cardId: "card-event-spec",
        kind: "event_data",
        title: "Veranstaltungsdaten prüfen",
        summary: "Kanonische Spezifikation für die Produktionsprüfung.",
        decision: "pending",
        targetPath: "$.draftArtifacts.eventSpec",
        targetId: spec.specId,
        requiredApproval: true
      }],
      draftArtifacts: { eventSpec: spec }
    };

    try {
      expect(await store.createCase(context, productionCase)).toBe("created");
      transactionCommands.length = 0;
      const result = await store.commitDraftForCaseSource(context, {
        caseId: productionCase.caseId,
        expectedSourceSpecId: undefined,
        nextSourceSpecId: spec.specId,
        at: "2026-06-01T08:01:00.000Z",
        draftTarget: {
          kind: "production_draft",
          artifactId: draft.draftId,
          revision: draft.revision
        },
        commitDraft: async (scope) => {
          expect(await scope.insertDraft(draft)).toBe("created");
          return { status: "committed" as const, value: draft };
        }
      });

      expect(result).toEqual({ status: "case_conflict" });
      expect(transactionCommands).toContain("ROLLBACK");
      expect(transactionCommands).not.toContain("COMMIT");
      await expect(store.getProductionDraft(context, draft.draftId)).resolves.toBeUndefined();
      const caseAfterRollback = await store.getCase(context, productionCase.caseId);
      expect(caseAfterRollback).toMatchObject({
        displayName: productionCase.displayName,
        version: 1
      });
      expect(caseAfterRollback?.sourceSpecId).toBeUndefined();
      await expect(store.listEvents(context, productionCase.caseId)).resolves.toHaveLength(1);
    } finally {
      await rawPool.end();
    }
  });

  it("reuses one case-bound draft and one draft-created event when the same spec import is retried", async () => {
    const { app, store, intakeRecords } = buildHarness();
    const productionCase = await createProductionCase(app);
    const spec = handoff().eventSpecSnapshot;
    await intakeRecords.insertSpec({ businessId: "alpha" }, spec);
    const request = () => app.inject({
      method: "POST" as const,
      url: "/v1/production/drafts",
      headers: alphaHeaders,
      payload: { caseId: productionCase.caseId, specId: spec.specId }
    });

    const first = await request();
    const retry = await request();

    expect(first.statusCode, first.body).toBe(201);
    expect(retry.statusCode, retry.body).toBe(201);
    expect(retry.json().draft.draftId).toBe(first.json().draft.draftId);
    await expect(store.listProductionDrafts({ businessId: "alpha" })).resolves.toHaveLength(1);
    const events = await store.listEvents({ businessId: "alpha" }, productionCase.caseId);
    expect(events.filter((event) => event.kind === "draft_created")).toEqual([
      expect.objectContaining({ artifactId: first.json().draft.draftId })
    ]);
  });

  it("creates one new draft for changed content under the bound spec identity and reopens the completed case once", async () => {
    const { app, store, intakeRecords } = buildHarness();
    const productionCase = await createProductionCase(app);
    const spec = handoff().eventSpecSnapshot;
    await intakeRecords.insertSpec({ businessId: "alpha" }, spec);
    const request = () => app.inject({
      method: "POST" as const,
      url: "/v1/production/drafts",
      headers: alphaHeaders,
      payload: { caseId: productionCase.caseId, specId: spec.specId }
    });
    const first = await request();
    expect(first.statusCode, first.body).toBe(201);

    const boundCase = await store.getCase({ businessId: "alpha" }, productionCase.caseId);
    const completedAt = new Date(Date.parse(boundCase!.updatedAt) + 1).toISOString();
    const completedCase: ProductionCase = {
      ...boundCase!,
      status: "completed",
      approvedProductionSpecId: "approved-production-spec-previous",
      currentPlanId: "production-plan-previous",
      currentPurchaseListId: "purchase-list-previous",
      version: boundCase!.version + 1,
      updatedAt: completedAt
    };
    expect(await store.updateCase(
      { businessId: "alpha" },
      productionCase.caseId,
      boundCase!.version,
      completedCase
    )).toBe("updated");
    await store.appendEvent({ businessId: "alpha" }, productionCase.caseId, {
      at: completedAt,
      role: "system",
      kind: "result",
      text: "Vorheriger Produktionsplan und Einkaufsliste erstellt.",
      artifactId: completedCase.currentPlanId
    });

    const changedSpec = {
      ...spec,
      attendees: {
        ...spec.attendees,
        expected: (spec.attendees.expected ?? 45) + 5
      }
    };
    await intakeRecords.replaceSpec({ businessId: "alpha" }, spec, changedSpec);
    const changed = await request();
    const retried = await request();

    expect(changed.statusCode, changed.body).toBe(201);
    expect(retried.statusCode, retried.body).toBe(201);
    expect(changed.json().draft.draftId).not.toBe(first.json().draft.draftId);
    expect(retried.json().draft.draftId).toBe(changed.json().draft.draftId);
    await expect(store.listProductionDrafts({ businessId: "alpha" })).resolves.toHaveLength(2);
    const events = await store.listEvents({ businessId: "alpha" }, productionCase.caseId);
    expect(events.filter((event) => event.kind === "draft_created")).toEqual([
      expect.objectContaining({
        artifactId: first.json().draft.draftId
      }),
      expect.objectContaining({ artifactId: changed.json().draft.draftId })
    ]);
    const reopened = await store.getCase({ businessId: "alpha" }, productionCase.caseId);
    expect(reopened).toMatchObject({
      status: "open",
      version: completedCase.version + 1,
      sourceSpecId: spec.specId
    });
    expect(reopened?.approvedProductionSpecId).toBeUndefined();
    expect(reopened?.currentPlanId).toBeUndefined();
    expect(reopened?.currentPurchaseListId).toBeUndefined();
  });

  it("keeps the successor timeline marker when source CAS loses and retries the reopen idempotently", async () => {
    const { app, store, intakeRecords } = buildHarness();
    const productionCase = await createProductionCase(app);
    const spec = handoff().eventSpecSnapshot;
    await intakeRecords.insertSpec({ businessId: "alpha" }, spec);
    const first = await app.inject({
      method: "POST",
      url: "/v1/production/drafts",
      headers: alphaHeaders,
      payload: { caseId: productionCase.caseId, specId: spec.specId }
    });
    expect(first.statusCode, first.body).toBe(201);
    const sourceDraft = first.json<{ draft: ProductionDraft }>().draft;
    const current = await store.getCase({ businessId: "alpha" }, productionCase.caseId);
    expect(current).toBeDefined();
    const completedAt = new Date(Date.parse(current!.updatedAt) + 1_000).toISOString();
    const continuationAt = new Date(Date.parse(completedAt) + 1_000).toISOString();
    const completedCase: ProductionCase = {
      ...current!,
      status: "completed",
      approvedProductionSpecId: "approved-production-spec-before-cas-race",
      currentPlanId: "production-plan-before-cas-race",
      currentPurchaseListId: "purchase-list-before-cas-race",
      version: current!.version + 1,
      updatedAt: completedAt
    };
    expect(await store.updateCase(
      { businessId: "alpha" },
      productionCase.caseId,
      current!.version,
      completedCase
    )).toBe("updated");
    await store.appendEvent({ businessId: "alpha" }, productionCase.caseId, {
      at: completedCase.updatedAt,
      role: "system",
      kind: "result",
      text: "Vorheriger Produktionsstand.",
      artifactId: completedCase.currentPlanId
    });

    const nextSpecId = `${spec.specId}-cas-race`;
    const continuation: ProductionDraft = {
      ...structuredClone(sourceDraft),
      draftId: `${sourceDraft.draftId}-cas-race`,
      revision: sourceDraft.revision + 1,
      status: "pending_review",
      createdAt: continuationAt,
      supersedesDraftId: sourceDraft.draftId,
      approvalRequestId: undefined,
      approvedBy: undefined,
      approvedAt: undefined,
      draftArtifacts: {
        ...structuredClone(sourceDraft.draftArtifacts),
        eventSpec: { ...structuredClone(spec), specId: nextSpecId }
      }
    };
    const cases = (store as any).cases;
    const originalCompareAndSet = cases.compareAndSet.bind(cases);
    let injected = false;
    (vi.spyOn(cases, "compareAndSet") as any).mockImplementation(async (
      context: { businessId: string },
      caseId: string,
      expectedVersion: number,
      next: ProductionCase
    ) => {
      if (!injected && caseId === productionCase.caseId && next.sourceSpecId === nextSpecId) {
        injected = true;
        const raced = await store.getCase(context, caseId);
        if (!raced) throw new Error("CAS-Test konnte den Produktionsfall nicht lesen.");
        await originalCompareAndSet(context, caseId, raced.version, {
          ...raced,
          version: raced.version + 1,
          updatedAt: new Date(Date.parse(raced.updatedAt) + 500).toISOString()
        });
        return "conflict";
      }
      return originalCompareAndSet(context, caseId, expectedVersion, next);
    });

    const commit = () => store.commitDraftForCaseSource({ businessId: "alpha" }, {
      caseId: productionCase.caseId,
      expectedSourceSpecId: spec.specId,
      nextSourceSpecId: nextSpecId,
      at: continuation.createdAt,
      draftTarget: {
        kind: "production_draft",
        artifactId: sourceDraft.draftId,
        revision: sourceDraft.revision
      },
      draftForCaseEvent: continuation,
      commitDraft: async (scope) => {
        const inserted = await scope.insertDraft(continuation);
        const persisted = inserted === "created" ? continuation : await scope.getDraft(continuation.draftId);
        return persisted
          ? { status: "committed" as const, value: persisted }
          : { status: "conflict" as const };
      }
    });

    try {
      const firstCommit = await commit();
      expect(firstCommit).toEqual({ status: "case_conflict" });
      expect(await store.getProductionDraft({ businessId: "alpha" }, continuation.draftId)).toEqual(continuation);
      const eventsAfterCasConflict = await store.listEvents({ businessId: "alpha" }, productionCase.caseId);
      expect(eventsAfterCasConflict.filter((event) => event.kind === "revision_created")).toEqual([
        expect.objectContaining({
          artifactId: continuation.draftId,
          revisionRef: expect.objectContaining({
            supersedesArtifactId: sourceDraft.draftId,
            revision: continuation.revision
          })
        })
      ]);
      await expect(store.getCase({ businessId: "alpha" }, productionCase.caseId)).resolves.toMatchObject({
        status: "completed",
        approvedProductionSpecId: completedCase.approvedProductionSpecId,
        currentPlanId: completedCase.currentPlanId,
        currentPurchaseListId: completedCase.currentPurchaseListId,
        sourceSpecId: spec.specId
      });

      vi.restoreAllMocks();
      const retry = await commit();
      expect(retry).toEqual({ status: "committed", value: continuation });
      const eventsAfterRetry = await store.listEvents({ businessId: "alpha" }, productionCase.caseId);
      expect(eventsAfterRetry.filter((event) => event.kind === "revision_created")).toHaveLength(1);
      const reopened = await store.getCase({ businessId: "alpha" }, productionCase.caseId);
      expect(reopened).toMatchObject({ status: "open", sourceSpecId: nextSpecId });
      expect(reopened?.approvedProductionSpecId).toBeUndefined();
      expect(reopened?.currentPlanId).toBeUndefined();
      expect(reopened?.currentPurchaseListId).toBeUndefined();
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("recovers idempotently when reopen fails after successor event and source CAS", async () => {
    const { app, store, intakeRecords } = buildHarness();
    const productionCase = await createProductionCase(app);
    const spec = handoff().eventSpecSnapshot;
    await intakeRecords.insertSpec({ businessId: "alpha" }, spec);
    const first = await app.inject({
      method: "POST",
      url: "/v1/production/drafts",
      headers: alphaHeaders,
      payload: { caseId: productionCase.caseId, specId: spec.specId }
    });
    expect(first.statusCode, first.body).toBe(201);
    const sourceDraft = first.json<{ draft: ProductionDraft }>().draft;
    const current = await store.getCase({ businessId: "alpha" }, productionCase.caseId);
    expect(current).toBeDefined();
    const completedAt = new Date(Date.parse(current!.updatedAt) + 1_000).toISOString();
    const completedCase: ProductionCase = {
      ...current!,
      status: "completed",
      approvedProductionSpecId: "approved-production-spec-before-reopen-failure",
      currentPlanId: "production-plan-before-reopen-failure",
      currentPurchaseListId: "purchase-list-before-reopen-failure",
      version: current!.version + 1,
      updatedAt: completedAt
    };
    expect(await store.updateCase(
      { businessId: "alpha" },
      productionCase.caseId,
      current!.version,
      completedCase
    )).toBe("updated");
    await store.appendEvent({ businessId: "alpha" }, productionCase.caseId, {
      at: completedAt,
      role: "system",
      kind: "result",
      text: "Vorheriger Produktionsstand.",
      artifactId: completedCase.currentPlanId
    });

    const nextSpecId = `${spec.specId}-reopen-failure`;
    const continuation: ProductionDraft = {
      ...structuredClone(sourceDraft),
      draftId: `${sourceDraft.draftId}-reopen-failure`,
      revision: sourceDraft.revision + 1,
      status: "pending_review",
      createdAt: new Date(Date.parse(completedAt) + 1_000).toISOString(),
      supersedesDraftId: sourceDraft.draftId,
      approvalRequestId: undefined,
      approvedBy: undefined,
      approvedAt: undefined,
      draftArtifacts: {
        ...structuredClone(sourceDraft.draftArtifacts),
        eventSpec: { ...structuredClone(spec), specId: nextSpecId }
      }
    };
    const cases = (store as any).cases;
    const originalCompareAndSet = cases.compareAndSet.bind(cases);
    let caseWrites = 0;
    (vi.spyOn(cases, "compareAndSet") as any).mockImplementation(async (
      context: { businessId: string },
      caseId: string,
      expectedVersion: number,
      next: ProductionCase
    ) => {
      if (caseId === productionCase.caseId && next.sourceSpecId === nextSpecId) {
        caseWrites += 1;
        if (caseWrites === 2) throw new Error("simulated reopen failure");
      }
      return originalCompareAndSet(context, caseId, expectedVersion, next);
    });

    const commit = () => store.commitDraftForCaseSource({ businessId: "alpha" }, {
      caseId: productionCase.caseId,
      expectedSourceSpecId: spec.specId,
      nextSourceSpecId: nextSpecId,
      at: continuation.createdAt,
      draftTarget: {
        kind: "production_draft",
        artifactId: sourceDraft.draftId,
        revision: sourceDraft.revision
      },
      draftForCaseEvent: continuation,
      commitDraft: async (scope) => {
        const inserted = await scope.insertDraft(continuation);
        const persisted = inserted === "created" ? continuation : await scope.getDraft(continuation.draftId);
        return persisted
          ? { status: "committed" as const, value: persisted }
          : { status: "conflict" as const };
      }
    });

    try {
      await expect(commit()).rejects.toThrow("simulated reopen failure");
      expect(caseWrites).toBe(2);
      const eventsAfterFailure = await store.listEvents({ businessId: "alpha" }, productionCase.caseId);
      expect(eventsAfterFailure.filter((event) => event.kind === "revision_created")).toHaveLength(1);
      await expect(store.getCase({ businessId: "alpha" }, productionCase.caseId)).resolves.toMatchObject({
        status: "completed",
        sourceSpecId: nextSpecId,
        approvedProductionSpecId: completedCase.approvedProductionSpecId,
        currentPlanId: completedCase.currentPlanId,
        currentPurchaseListId: completedCase.currentPurchaseListId
      });

      vi.restoreAllMocks();
      await expect(commit()).resolves.toEqual({ status: "committed", value: continuation });
      const eventsAfterRetry = await store.listEvents({ businessId: "alpha" }, productionCase.caseId);
      expect(eventsAfterRetry.filter((event) => event.kind === "revision_created")).toHaveLength(1);
      const reopened = await store.getCase({ businessId: "alpha" }, productionCase.caseId);
      expect(reopened).toMatchObject({ status: "open", sourceSpecId: nextSpecId });
      expect(reopened?.approvedProductionSpecId).toBeUndefined();
      expect(reopened?.currentPlanId).toBeUndefined();
      expect(reopened?.currentPurchaseListId).toBeUndefined();
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("rejects a different canonical spec after a production case is bound", async () => {
    const { app, store, intakeRecords } = buildHarness();
    const productionCase = await createProductionCase(app);
    const firstSpec = handoff().eventSpecSnapshot;
    const otherSpec = {
      ...firstSpec,
      specId: "spec-other-production-case"
    };
    await intakeRecords.insertSpec({ businessId: "alpha" }, firstSpec);
    await intakeRecords.insertSpec({ businessId: "alpha" }, otherSpec);

    const first = await app.inject({
      method: "POST",
      url: "/v1/production/drafts",
      headers: alphaHeaders,
      payload: { caseId: productionCase.caseId, specId: firstSpec.specId }
    });
    const rejected = await app.inject({
      method: "POST",
      url: "/v1/production/drafts",
      headers: alphaHeaders,
      payload: { caseId: productionCase.caseId, specId: otherSpec.specId }
    });

    expect(first.statusCode, first.body).toBe(201);
    expect(rejected.statusCode, rejected.body).toBe(409);
    expect(rejected.json()).toEqual({
      message: "Produktionsauftrag ist bereits an eine andere Spezifikation gebunden."
    });
    await expect(store.getCase({ businessId: "alpha" }, productionCase.caseId)).resolves.toMatchObject({
      sourceSpecId: firstSpec.specId
    });
    await expect(store.listProductionDrafts({ businessId: "alpha" })).resolves.toHaveLength(1);
    const events = await store.listEvents({ businessId: "alpha" }, productionCase.caseId);
    expect(events.filter((event) => event.kind === "draft_created")).toHaveLength(1);
  });

  it("atomically binds an empty production case to only one of concurrent specs", async () => {
    const { app, store, intakeRecords } = buildHarness();
    const productionCase = await createProductionCase(app);
    const firstSpec = handoff().eventSpecSnapshot;
    const otherSpec = {
      ...firstSpec,
      specId: "spec-concurrent-production-case"
    };
    await intakeRecords.insertSpec({ businessId: "alpha" }, firstSpec);
    await intakeRecords.insertSpec({ businessId: "alpha" }, otherSpec);

    const responses = await Promise.all([firstSpec, otherSpec].map((spec) => app.inject({
      method: "POST",
      url: "/v1/production/drafts",
      headers: alphaHeaders,
      payload: { caseId: productionCase.caseId, specId: spec.specId }
    })));

    expect(responses.map((response) => response.statusCode).sort()).toEqual([201, 409]);
    const accepted = responses.find((response) => response.statusCode === 201)!;
    const boundSpecId = accepted.json().draft.draftArtifacts.eventSpec.specId;
    await expect(store.getCase({ businessId: "alpha" }, productionCase.caseId)).resolves.toMatchObject({
      sourceSpecId: boundSpecId
    });
    await expect(store.listProductionDrafts({ businessId: "alpha" })).resolves.toHaveLength(1);
    const events = await store.listEvents({ businessId: "alpha" }, productionCase.caseId);
    expect(events.filter((event) => event.kind === "draft_created")).toHaveLength(1);
  });

  it("keeps copies of the same immutable spec isolated in distinct production cases", async () => {
    const { app, store, intakeRecords } = buildHarness();
    const firstCase = await createProductionCase(app);
    const secondCase = await createProductionCase(app, { customerName: "Kopierter Auftrag" });
    const spec = handoff().eventSpecSnapshot;
    await intakeRecords.insertSpec({ businessId: "alpha" }, spec);

    const first = await app.inject({
      method: "POST",
      url: "/v1/production/drafts",
      headers: alphaHeaders,
      payload: { caseId: firstCase.caseId, specId: spec.specId }
    });
    const second = await app.inject({
      method: "POST",
      url: "/v1/production/drafts",
      headers: alphaHeaders,
      payload: { caseId: secondCase.caseId, specId: spec.specId }
    });

    expect(first.statusCode, first.body).toBe(201);
    expect(second.statusCode, second.body).toBe(201);
    expect(second.json().draft.draftId).not.toBe(first.json().draft.draftId);
    await expect(store.listProductionDrafts({ businessId: "alpha" })).resolves.toHaveLength(2);
    const firstEvents = await store.listEvents({ businessId: "alpha" }, firstCase.caseId);
    const secondEvents = await store.listEvents({ businessId: "alpha" }, secondCase.caseId);
    expect(firstEvents.filter((event) => event.kind === "draft_created")).toEqual([
      expect.objectContaining({ artifactId: first.json().draft.draftId })
    ]);
    expect(secondEvents.filter((event) => event.kind === "draft_created")).toEqual([
      expect.objectContaining({ artifactId: second.json().draft.draftId })
    ]);
  });

  it("lists only drafts linked to the requested production case", async () => {
    const { app, intakeRecords } = buildHarness();
    const firstCase = await createProductionCase(app);
    const secondCase = await createProductionCase(app, { customerName: "Zweiter Auftrag" });
    const spec = handoff().eventSpecSnapshot;
    await intakeRecords.insertSpec({ businessId: "alpha" }, spec);

    const first = await app.inject({
      method: "POST",
      url: "/v1/production/drafts",
      headers: alphaHeaders,
      payload: { caseId: firstCase.caseId, specId: spec.specId }
    });
    const second = await app.inject({
      method: "POST",
      url: "/v1/production/drafts",
      headers: alphaHeaders,
      payload: { caseId: secondCase.caseId, specId: spec.specId }
    });
    expect(first.statusCode, first.body).toBe(201);
    expect(second.statusCode, second.body).toBe(201);

    const firstScoped = await app.inject({
      method: "GET",
      url: `/v1/production/drafts?caseId=${firstCase.caseId}`,
      headers: alphaHeaders
    });
    const secondScoped = await app.inject({
      method: "GET",
      url: `/v1/production/drafts?caseId=${secondCase.caseId}`,
      headers: alphaHeaders
    });

    expect(firstScoped.statusCode, firstScoped.body).toBe(200);
    expect(secondScoped.statusCode, secondScoped.body).toBe(200);
    expect(firstScoped.json().items.map((draft: { draftId: string }) => draft.draftId)).toEqual([
      first.json().draft.draftId
    ]);
    expect(secondScoped.json().items.map((draft: { draftId: string }) => draft.draftId)).toEqual([
      second.json().draft.draftId
    ]);
  });

  it("does not return approval projections belonging to another production case", async () => {
    const { app, intakeRecords, repository } = buildHarness();
    await repository.seed({ businessId: "alpha" }, [
      internalRecipes.find((recipe) => recipe.recipeId === "recipe-caesar-salad")!
    ]);
    const firstCase = await createProductionCase(app);
    const secondCase = await createProductionCase(app, { customerName: "Zweiter Auftrag" });
    const firstSpec = productionReadyEventSpec(handoff().eventSpecSnapshot, "spec-route-case-a");
    const secondSpec = productionReadyEventSpec(handoff().eventSpecSnapshot, "spec-route-case-b");
    const emptyScoped = await app.inject({
      method: "GET",
      url: `/v1/production/drafts?caseId=${firstCase.caseId}`,
      headers: alphaHeaders
    });
    const unknownScoped = await app.inject({
      method: "GET",
      url: "/v1/production/drafts?caseId=production-case-unknown",
      headers: alphaHeaders
    });
    expect(emptyScoped.statusCode, emptyScoped.body).toBe(200);
    expect(emptyScoped.json()).toEqual({ items: [], approvedProductionSpecs: [] });
    expect(unknownScoped.statusCode, unknownScoped.body).toBe(200);
    expect(unknownScoped.json()).toEqual({ items: [], approvedProductionSpecs: [] });
    const firstApproval = await approveDraftForCase(app, intakeRecords, firstCase.caseId, firstSpec);
    const secondApproval = await approveDraftForCase(app, intakeRecords, secondCase.caseId, secondSpec);

    const firstScoped = await app.inject({
      method: "GET",
      url: `/v1/production/drafts?caseId=${firstCase.caseId}`,
      headers: alphaHeaders
    });
    const secondScoped = await app.inject({
      method: "GET",
      url: `/v1/production/drafts?caseId=${secondCase.caseId}`,
      headers: alphaHeaders
    });

    expect(firstScoped.statusCode, firstScoped.body).toBe(200);
    expect(secondScoped.statusCode, secondScoped.body).toBe(200);
    expect(firstScoped.json().items.map((draft: { draftId: string }) => draft.draftId)).toEqual([
      firstApproval.draftId,
      firstApproval.createdDraftId
    ]);
    expect(secondScoped.json().items.map((draft: { draftId: string }) => draft.draftId)).toEqual([
      secondApproval.draftId,
      secondApproval.createdDraftId
    ]);
    expect(firstScoped.json().approvedProductionSpecs).toEqual([{
      approvedProductionSpecId: firstApproval.approvedProductionSpecId,
      sourceDraft: { draftId: firstApproval.draftId, revision: 2 },
      applied: false
    }]);
    expect(secondScoped.json().approvedProductionSpecs).toEqual([{
      approvedProductionSpecId: secondApproval.approvedProductionSpecId,
      sourceDraft: { draftId: secondApproval.draftId, revision: 2 },
      applied: false
    }]);
    expect(JSON.stringify(firstScoped.json())).not.toContain(secondApproval.approvedProductionSpecId);
    expect(JSON.stringify(firstScoped.json())).not.toContain(secondApproval.draftId);
    expect(JSON.stringify(secondScoped.json())).not.toContain(firstApproval.approvedProductionSpecId);
    expect(JSON.stringify(secondScoped.json())).not.toContain(firstApproval.draftId);
  });

  it("repairs one draft-created event when a canonical spec import is retried after event persistence failed", async () => {
    const { app, store, intakeRecords } = buildHarness();
    const productionCase = await createProductionCase(app);
    const spec = handoff().eventSpecSnapshot;
    await intakeRecords.insertSpec({ businessId: "alpha" }, spec);
    failNextDraftTimelineEvent(store);
    const request = () => app.inject({
      method: "POST" as const,
      url: "/v1/production/drafts",
      headers: alphaHeaders,
      payload: { caseId: productionCase.caseId, specId: spec.specId }
    });

    const first = await request();
    const retry = await request();
    const secondRetry = await request();

    expect(first.statusCode).toBe(500);
    expect(retry.statusCode, retry.body).toBe(201);
    expect(secondRetry.statusCode, secondRetry.body).toBe(201);
    expect(secondRetry.json().draft.draftId).toBe(retry.json().draft.draftId);
    await expect(store.listProductionDrafts({ businessId: "alpha" })).resolves.toHaveLength(1);
    const events = await store.listEvents({ businessId: "alpha" }, productionCase.caseId);
    expect(events.filter((event) => event.kind === "draft_created")).toEqual([
      expect.objectContaining({
        artifactId: retry.json().draft.draftId,
        revisionRef: expect.objectContaining({ artifactType: "ProductionDraft", revision: 1 })
      })
    ]);
  });

  it("rejects browser-authored production snapshots instead of accepting a second canonical path", async () => {
    const { app, store } = buildHarness();
    const productionCase = await createProductionCase(app);

    const response = await app.inject({
      method: "POST",
      url: "/v1/production/drafts",
      headers: alphaHeaders,
      payload: {
        caseId: productionCase.caseId,
        specId: "spec-client",
        draftId: "client-controlled",
        draftArtifacts: { eventSpec: handoff().eventSpecSnapshot }
      }
    });

    expect(response.statusCode).toBe(422);
    await expect(store.listProductionDrafts({ businessId: "alpha" })).resolves.toHaveLength(0);
  });

  it("records review, approval and applied result only after their product writes succeed", async () => {
    const baseHandoff = handoff();
    const approvedHandoff = {
      ...baseHandoff,
      eventSpecSnapshot: productionReadyEventSpec(baseHandoff.eventSpecSnapshot),
      pricingSnapshot: baseHandoff.pricingSnapshot
    };
    const { app, store, repository, intakeRecords } = buildHarness({
      get: async (_context, handoffId) => handoffId === approvedHandoff.handoffId ? approvedHandoff : undefined
    });
    await repository.seed({ businessId: "alpha" }, [
      internalRecipes.find((recipe) => recipe.recipeId === "recipe-caesar-salad")!
    ]);
    const caseResponse = await app.inject({
      method: "POST",
      url: `/v1/production/cases/from-handoff/${approvedHandoff.handoffId}`,
      headers: alphaHeaders,
      payload: {}
    });
    expect(caseResponse.statusCode, caseResponse.body).toBe(201);
    const productionCase = caseResponse.json<{ case: ProductionCase }>().case;
    const spec = approvedHandoff.eventSpecSnapshot;
    await intakeRecords.insertSpec({ businessId: "alpha" }, spec);
    const created = await app.inject({
      method: "POST",
      url: `/v1/production/drafts/from-handoff/${approvedHandoff.handoffId}`,
      headers: alphaHeaders,
      payload: { caseId: productionCase.caseId }
    });
    expect(created.statusCode, created.body).toBe(201);
    const initialDraft = created.json().draft;
    for (const [index, component] of approvedHandoff.eventSpecSnapshot.menuPlan.entries()) {
      const evidence = await app.inject({
        method: "POST",
        url: `/v1/production/cases/${productionCase.caseId}/planning-evidence`,
        headers: alphaHeaders,
        payload: {
          draftId: initialDraft.draftId,
          draftRevision: initialDraft.revision,
          componentId: component.componentId,
          recipeId: "recipe-caesar-salad",
          quantityDecision: {
            decisionId: `production-case-route-quantity-${index}`,
            eventSpecId: approvedHandoff.eventSpecSnapshot.specId,
            componentId: component.componentId,
            guestCount: approvedHandoff.eventSpecSnapshot.attendees.expected,
            serviceFormat: approvedHandoff.eventSpecSnapshot.servicePlan.serviceForm,
            dishRole: "other",
            basis: "servings_per_person",
            perUnitAmount: 1,
            perUnitUnit: "servings",
            targetAmount: approvedHandoff.eventSpecSnapshot.attendees.expected,
            targetUnit: "servings",
            rationale: "Explizite kanonische Mengenentscheidung der Fixture.",
            evidence: { kind: "operator_instruction", reference: "production-case-route" },
            reviewStatus: "approved"
          },
          recipeEventUseReview: {
            eventSpecId: approvedHandoff.eventSpecSnapshot.specId,
            recipeId: "recipe-caesar-salad",
            reviewedBy: "Produktions-Mitarbeiter",
            reviewedAt: "2026-08-30T12:00:00.000Z",
            decision: "accepted_for_event",
            confirmations: {
              quantitiesAndYield: true,
              methodAndEquipment: true,
              allergensAndDiet: true,
              holdingAndRegeneration: true
            }
          }
        }
      });
      expect(evidence.statusCode, evidence.body).toBe(201);
    }
    const prepared = await app.inject({
      method: "POST",
      url: `/v1/production/drafts/${initialDraft.draftId}/prepare`,
      headers: alphaHeaders,
      payload: {}
    });
    expect(prepared.statusCode, prepared.body).toBe(201);
    const preparedDraft = prepared.json().draft;

    const prematureApproval = await app.inject({
      method: "POST",
      url: `/v1/production/drafts/${preparedDraft.draftId}/decision`,
      headers: alphaHeaders,
      payload: { decision: "approved" }
    });
    expect(prematureApproval.statusCode, prematureApproval.body).toBe(422);
    expect((await store.listEvents({ businessId: "alpha" }, productionCase.caseId)).map((event) => event.kind)).toEqual([
      "case_created",
      "draft_created",
      "revision_created"
    ]);

    for (const card of preparedDraft.reviewCards) {
      const reviewed = await app.inject({
        method: "PATCH",
        url: `/v1/production/drafts/${preparedDraft.draftId}/review-cards/${card.cardId}`,
        headers: alphaHeaders,
        payload: { decision: "fits" }
      });
      expect(reviewed.statusCode, reviewed.body).toBe(200);
    }

    const approved = await app.inject({
      method: "POST",
      url: `/v1/production/drafts/${preparedDraft.draftId}/decision`,
      headers: alphaHeaders,
      payload: { decision: "approved" }
    });
    expect(approved.statusCode, approved.body).toBe(201);
    const approvedProductionSpecId = approved.json().approvedProductionSpec.approvedProductionSpecId as string;
    const applied = await app.inject({
      method: "POST",
      url: `/v1/production/approved-specs/${approvedProductionSpecId}/apply`,
      headers: alphaHeaders,
      payload: {}
    });
    expect(applied.statusCode, applied.body).toBe(200);

    const events = await store.listEvents({ businessId: "alpha" }, productionCase.caseId);
    expect(events.map((event) => event.kind)).toEqual([
      "case_created",
      "draft_created",
      "revision_created",
      ...preparedDraft.reviewCards.map(() => "review_decision"),
      "review_decision",
      "approval",
      "result"
    ]);
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "review_decision",
        artifactId: approved.json().approval.approvalRequestId
      }),
      expect.objectContaining({
        kind: "approval",
        artifactId: approvedProductionSpecId
      }),
      expect.objectContaining({
        kind: "result",
        artifactId: applied.json().plan.planId
      })
    ]));
    expect(await store.getCase({ businessId: "alpha" }, productionCase.caseId)).toMatchObject({
      approvedProductionSpecId,
      currentPlanId: applied.json().plan.planId,
      currentPurchaseListId: applied.json().purchaseList.purchaseListId,
      status: "completed"
    });
  });

  it("recovers one prepared revision after event persistence fails and reopens only a genuine continuation", async () => {
    const { app, store, intakeRecords } = buildHarness();
    const productionCase = await createProductionCase(app);
    const spec = handoff().eventSpecSnapshot;
    await intakeRecords.insertSpec({ businessId: "alpha" }, spec);
    const created = await app.inject({
      method: "POST",
      url: "/v1/production/drafts",
      headers: alphaHeaders,
      payload: { caseId: productionCase.caseId, specId: spec.specId }
    });
    expect(created.statusCode, created.body).toBe(201);
    const sourceDraft = created.json().draft;
    const completedBeforePreparation = await completeProductionCase(store, productionCase.caseId);
    const appendEventForArtifactCase = store.appendEventForArtifactCase.bind(store);
    let failRevisionEventOnce = true;
    vi.spyOn(store, "appendEventForArtifactCase").mockImplementation(
      async (context, artifactId, input, eventIdentity) => {
        if (input.kind === "revision_created" && failRevisionEventOnce) {
          failRevisionEventOnce = false;
          throw new Error("simulated event persistence failure after prepared revision write");
        }
        return appendEventForArtifactCase(context, artifactId, input, eventIdentity);
      }
    );
    const prepare = () => app.inject({
      method: "POST" as const,
      url: `/v1/production/drafts/${sourceDraft.draftId}/prepare`,
      headers: alphaHeaders,
      payload: {}
    });

    const first = await prepare();
    const persistedAfterFailure = (await store.listProductionDrafts({ businessId: "alpha" }))
      .find((draft) => draft.supersedesDraftId === sourceDraft.draftId);
    const caseAfterFailure = await store.getCase({ businessId: "alpha" }, productionCase.caseId);
    const retry = await prepare();
    const secondRetry = await prepare();
    const caseAfterRecovery = await store.getCase({ businessId: "alpha" }, productionCase.caseId);

    expect(first.statusCode).toBe(500);
    expect(persistedAfterFailure).toBeDefined();
    expect(caseAfterFailure).toEqual(completedBeforePreparation);
    expect(retry.statusCode, retry.body).toBe(201);
    expect(secondRetry.statusCode, secondRetry.body).toBe(201);
    expect(retry.json().draft).toEqual(projectProductionDraft(alphaActor, persistedAfterFailure!));
    expect(secondRetry.json().draft).toEqual(projectProductionDraft(alphaActor, persistedAfterFailure!));
    const persistedAfterRecovery = await store.getProductionDraft({ businessId: "alpha" }, persistedAfterFailure!.draftId);
    expect(persistedAfterRecovery).toEqual(persistedAfterFailure);
    expect(persistedAfterRecovery!.source.processingPolicy)
      .toEqual(persistedAfterFailure!.source.processingPolicy);
    expect(await store.listProductionDrafts({ businessId: "alpha" })).toHaveLength(2);
    expect((await store.listEvents({ businessId: "alpha" }, productionCase.caseId))
      .filter((event) => event.kind === "revision_created")).toEqual([
      expect.objectContaining({ artifactId: persistedAfterFailure!.draftId })
    ]);
    expect(caseAfterRecovery).toMatchObject({
      status: "open",
      version: completedBeforePreparation.version + 1
    });
    expect(caseAfterRecovery?.approvedProductionSpecId).toBeUndefined();
    expect(caseAfterRecovery?.currentPlanId).toBeUndefined();
    expect(caseAfterRecovery?.currentPurchaseListId).toBeUndefined();

    const completedAfterRevision = await completeProductionCase(store, productionCase.caseId);
    const oldRevisionRetry = await prepare();
    expect(oldRevisionRetry.statusCode, oldRevisionRetry.body).toBe(201);
    expect(oldRevisionRetry.json().draft).toEqual(projectProductionDraft(alphaActor, persistedAfterFailure!));
    expect(await store.getCase({ businessId: "alpha" }, productionCase.caseId))
      .toEqual(completedAfterRevision);
    expect((await store.listEvents({ businessId: "alpha" }, productionCase.caseId))
      .filter((event) => event.kind === "revision_created")).toHaveLength(1);
  });

  it("returns the stored review decision and keeps one event when the normalized request is retried", async () => {
    const { app, store, intakeRecords } = buildHarness();
    const productionCase = await createProductionCase(app);
    const spec = handoff().eventSpecSnapshot;
    await intakeRecords.insertSpec({ businessId: "alpha" }, spec);
    const created = await app.inject({
      method: "POST",
      url: "/v1/production/drafts",
      headers: alphaHeaders,
      payload: { caseId: productionCase.caseId, specId: spec.specId }
    });
    expect(created.statusCode, created.body).toBe(201);
    const draft = created.json().draft;
    const cardId = draft.reviewCards[0].cardId as string;

    try {
      const first = await app.inject({
        method: "PATCH",
        url: `/v1/production/drafts/${draft.draftId}/review-cards/${cardId}`,
        headers: alphaHeaders,
        payload: { decision: "fits", operatorComment: "  Mengen geprueft.  " }
      });
      await new Promise((resolve) => setTimeout(resolve, 5));
      const retry = await app.inject({
        method: "PATCH",
        url: `/v1/production/drafts/${draft.draftId}/review-cards/${cardId}`,
        headers: alphaHeaders,
        payload: { decision: "fits", operatorComment: "Mengen geprueft." }
      });

      expect(first.statusCode, first.body).toBe(200);
      expect(retry.statusCode, retry.body).toBe(200);
      expect(retry.json().reviewCard).toEqual(first.json().reviewCard);
      const reviewEvents = (await store.listEvents({ businessId: "alpha" }, productionCase.caseId))
        .filter((event) => event.kind === "review_decision");
      expect(reviewEvents).toHaveLength(1);
    } finally {
      await app.close();
    }
  });
});
