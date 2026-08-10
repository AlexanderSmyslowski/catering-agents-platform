import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildProductionApp,
  buildProductionArtifacts,
  InMemoryRecipeRepository,
  ProductionStore,
  RecipeDiscoveryService
} from "@catering/production-service";
import {
  AuditLogStore,
  createEventRequestFromText,
  normalizeEventRequestToSpec,
  SCHEMA_VERSION,
  type ProductionDraft
} from "@catering/shared-core";

const TRUSTED_SECRET = "production-draft-import-secret";
const localBusiness = { businessId: "local" };
const trustedProductionHeaders = {
  "x-catering-actor-name": "Produktions-Mitarbeiter",
  "x-catering-trusted-secret": TRUSTED_SECRET
};

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-agents-production-draft-import-"));
}

function productionDraft(draftId = "production-draft-import-1"): ProductionDraft {
  const eventSpec = normalizeEventRequestToSpec(
    createEventRequestFromText({
      requestId: "production-draft-import-request-1",
      channel: "text",
      rawText: "Buffet am 2026-09-18 fuer 45 Personen mit Vitello tonnato."
    })
  );

  return {
    schemaVersion: SCHEMA_VERSION,
    draftId,
    status: "pending_review",
    createdAt: "2026-07-01T12:00:00.000Z",
    source: {
      kind: "agent_cli",
      receivedAt: "2026-07-01T12:00:00.000Z",
      sourceRef: "upload:angebot-koepff.pdf",
      providerId: "local-codex-cli",
      modelId: "operator-selected-model",
      inputHash: "sha256:input-redacted",
      outputHash: "sha256:output-structured",
      runId: "run-production-draft-import-1"
    },
    guardrails: {
      draftOnly: true,
      humanApprovalRequired: true,
      writesProductObjects: false,
      rawProviderPayloadStored: false,
      knowledgeWritePolicy: "reviewed_only"
    },
    reviewCards: [
      {
        cardId: "card-event",
        kind: "event_data",
        title: "Buffetdaten pruefen",
        summary: "SECRET_REVIEW_SUMMARY darf nicht im Audit auftauchen.",
        decision: "pending",
        targetPath: "$.draftArtifacts.eventSpec",
        targetId: eventSpec.specId,
        requiredApproval: true
      }
    ],
    draftArtifacts: {
      eventSpec,
      openQuestions: [
        {
          field: "recipe.temperature",
          message: "Kerntemperatur offen.",
          severity: "medium",
          suggestedQuestion: "Welche Kerntemperatur soll fachlich freigegeben werden?"
        }
      ],
      notes: ["SECRET_DRAFT_NOTE bleibt nur im gespeicherten Draft."]
    }
  };
}

async function productionDraftWithUnreviewedPlan(): Promise<ProductionDraft> {
  const draft = productionDraft("production-draft-unreviewed-plan");
  const discoveryService = new RecipeDiscoveryService(
    new InMemoryRecipeRepository(),
    {
      searchRecipes: async () => []
    }
  );
  const artifacts = await buildProductionArtifacts(draft.draftArtifacts.eventSpec!, discoveryService);

  return {
    ...draft,
    draftArtifacts: {
      ...draft.draftArtifacts,
      productionPlan: artifacts.productionPlan
    }
  };
}

describe("ProductionDraft import", () => {
  const dataRoots: string[] = [];

  afterEach(() => {
    for (const dataRoot of dataRoots.splice(0)) {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });

  it("imports and lists a pending ProductionDraft without creating production product objects", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const auditLog = new AuditLogStore({ rootDir: dataRoot });
    const app = buildProductionApp({
      dataRoot,
      store,
      auditLog,
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/production/drafts",
        headers: trustedProductionHeaders,
        payload: productionDraft()
      });
      const listResponse = await app.inject({
        method: "GET",
        url: "/v1/production/drafts",
        headers: trustedProductionHeaders
      });
      const auditJson = JSON.stringify(await auditLog.listRecentFor({ businessId: "local" }, 5));

      expect(response.statusCode).toBe(201);
      expect(response.json<{ draft: ProductionDraft }>().draft.status).toBe("pending_review");
      expect(listResponse.statusCode).toBe(200);
      expect(listResponse.json<{ items: ProductionDraft[] }>().items).toHaveLength(1);
      expect(await store.listPlans()).toHaveLength(0);
      expect(await store.listPurchaseLists()).toHaveLength(0);
      expect(auditJson).toContain("production.production_draft_imported");
      expect(auditJson).toContain("sha256:output-structured");
      expect(auditJson).not.toContain("SECRET_REVIEW_SUMMARY");
      expect(auditJson).not.toContain("SECRET_DRAFT_NOTE");
      expect(auditJson).not.toContain("systemPrompt");
      expect(auditJson).not.toContain("providerResponse");
    } finally {
      await app.close();
    }
  });

  it("rejects schema-invalid or raw-leaking drafts with 422 and does not persist them", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const app = buildProductionApp({
      dataRoot,
      store,
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });
    const invalidDraft = structuredClone(productionDraft());
    const eventSpec = invalidDraft.draftArtifacts.eventSpec as unknown as Record<string, unknown>;
    eventSpec.prompt = "SECRET_RAW_PROMPT_PAYLOAD";

    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/production/drafts",
        headers: trustedProductionHeaders,
        payload: invalidDraft
      });

      expect(response.statusCode).toBe(422);
      expect(response.body).toContain("ProductionDraft ist nicht schema-valide.");
      expect(response.body).not.toContain("SECRET_RAW_PROMPT_PAYLOAD");
      expect(await store.listProductionDrafts(localBusiness)).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it("rejects non-pending drafts at the import boundary without persisting them", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const app = buildProductionApp({
      dataRoot,
      store,
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });
    const rejectedDraft: ProductionDraft = {
      ...productionDraft(),
      status: "rejected"
    };

    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/production/drafts",
        headers: trustedProductionHeaders,
        payload: rejectedDraft
      });

      expect(response.statusCode).toBe(422);
      expect(response.body).toContain("pending_review");
      expect(await store.listProductionDrafts(localBusiness)).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it("rejects import when a material draft artifact has no matching review card", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const app = buildProductionApp({
      dataRoot,
      store,
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });
    const draft = await productionDraftWithUnreviewedPlan();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/production/drafts",
        headers: trustedProductionHeaders,
        payload: draft
      });

      expect(response.statusCode).toBe(422);
      expect(response.body).toContain("Review-Karten");
      expect(response.body).toContain("productionPlan");
      expect(await store.listProductionDrafts(localBusiness)).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it("rejects duplicate draft IDs without overwriting the existing draft", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const app = buildProductionApp({
      dataRoot,
      store,
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });
    const originalDraft = productionDraft("production-draft-duplicate");
    const duplicateDraft: ProductionDraft = {
      ...originalDraft,
      source: {
        ...originalDraft.source,
        outputHash: "sha256:attempted-overwrite"
      }
    };

    try {
      const imported = await app.inject({
        method: "POST",
        url: "/v1/production/drafts",
        headers: trustedProductionHeaders,
        payload: originalDraft
      });
      const duplicate = await app.inject({
        method: "POST",
        url: "/v1/production/drafts",
        headers: trustedProductionHeaders,
        payload: duplicateDraft
      });

      expect(imported.statusCode).toBe(201);
      expect(duplicate.statusCode).toBe(409);
      expect(duplicate.body).toContain("ProductionDraft mit dieser ID existiert bereits.");
      expect((await store.getProductionDraft(localBusiness, originalDraft.draftId))?.source.outputHash).toBe(
        "sha256:output-structured"
      );
    } finally {
      await app.close();
    }
  });
});
