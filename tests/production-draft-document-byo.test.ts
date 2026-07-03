import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildProductionApp,
  ProductionStore
} from "@catering/production-service";
import {
  AuditLogStore,
  llmReadinessContractVersion,
  type LlmReadinessProviderAdapter,
  type LlmReadinessProviderAdapterRequest,
  type ProductionDraft
} from "@catering/shared-core";

const TRUSTED_SECRET = "production-draft-document-byo-secret";
const trustedProductionHeaders = {
  "x-catering-actor-name": "Produktions-Mitarbeiter",
  "x-catering-trusted-secret": TRUSTED_SECRET
};

const documentText = [
  "AB 19.00 UHR | BUFFET",
  "VITELLO TONNATO | RIESENKAPERN | WEISSER THUNFISCH",
  "ROTGARNELEN | AVOKADO-WASABI-CREME",
  "KOKOS-CHEESECAKE | BROMBEERE"
].join("\n");

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-agents-production-draft-document-byo-"));
}

function documentPayload(text = documentText) {
  return {
    filename: "angebot-flying-buffet-anonymisiert.txt",
    mimeType: "text/plain",
    contentBase64: Buffer.from(text, "utf8").toString("base64")
  };
}

function extractionResponse(request: LlmReadinessProviderAdapterRequest) {
  return {
    ok: true,
    errors: [],
    adapterId: "mock-byo-production-draft-adapter",
    adapterMode: "synthetic_live" as const,
    providerId: "openai-responses",
    providerRequestId: "req-production-draft-document-1",
    promptSchemaId: request.promptSchemaId,
    outputCandidate: {
      contractVersion: llmReadinessContractVersion,
      outputId: "output-production-draft-document-1",
      kind: "production_draft_extraction" as const,
      sourceRefs: request.input.sourceRefs,
      humanApprovalRequired: true as const,
      writesProductObject: false as const,
      text: JSON.stringify({
        eventType: "reception",
        serviceForm: "flying_buffet",
        eventDate: "2026-06-14",
        attendeeCount: 45,
        customerName: "Frau Dr. Muster",
        venueName: "Veranstaltungshaus",
        components: [
          { label: "Vitello Tonnato | Riesenkapern | weisser Thunfisch", course: "starter", category: "classic", note: null },
          { label: "Rotgarnelen | Avokado-Wasabi-Creme", course: "main", category: "classic", note: null },
          { label: "Kokos-Cheesecake | Brombeere", course: "dessert", category: "classic", note: null }
        ],
        openQuestions: [
          {
            field: "recipe.vitello-tonnato",
            message: "Kein freigegebenes internes Rezept eindeutig zugeordnet.",
            suggestedQuestion: "Soll Vitello Tonnato als neue Rezeptkarte geprueft werden?"
          }
        ]
      })
    }
  };
}

describe("ProductionDraft document BYO extraction", () => {
  const dataRoots: string[] = [];

  afterEach(() => {
    for (const dataRoot of dataRoots.splice(0)) {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });

  it("creates a pending ProductionDraft from an operator-approved document without product writes or raw audit text", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const auditLog = new AuditLogStore({ rootDir: dataRoot });
    const requests: LlmReadinessProviderAdapterRequest[] = [];
    const adapter: LlmReadinessProviderAdapter = {
      adapterId: "mock-byo-production-draft-adapter",
      adapterMode: "synthetic_live",
      run: async (request) => {
        requests.push(request);
        return extractionResponse(request);
      }
    };
    const app = buildProductionApp({
      dataRoot,
      store,
      auditLog,
      llmAdapter: adapter,
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/production/drafts/from-document",
        headers: trustedProductionHeaders,
        payload: documentPayload()
      });
      const draft = response.json<{ draft: ProductionDraft }>().draft;
      const auditJson = JSON.stringify(await auditLog.listRecent(10));

      expect(response.statusCode, response.body).toBe(201);
      expect(requests).toHaveLength(1);
      expect(requests[0].input.kind).toBe("production_draft_request");
      expect(requests[0].promptContext).toContain("VITELLO TONNATO");
      expect(draft.status).toBe("pending_review");
      expect(draft.guardrails).toMatchObject({
        draftOnly: true,
        humanApprovalRequired: true,
        writesProductObjects: false,
        rawProviderPayloadStored: false
      });
      expect(draft.draftArtifacts.eventSpec?.menuPlan.map((component) => component.label)).toEqual([
        "Vitello Tonnato | Riesenkapern | weisser Thunfisch",
        "Rotgarnelen | Avokado-Wasabi-Creme",
        "Kokos-Cheesecake | Brombeere"
      ]);
      expect(draft.reviewCards.map((card) => card.title)).toEqual(
        expect.arrayContaining([
          "Vitello Tonnato | Riesenkapern | weisser Thunfisch",
          "Rotgarnelen | Avokado-Wasabi-Creme",
          "Kokos-Cheesecake | Brombeere",
          "recipe.vitello-tonnato"
        ])
      );
      expect(draft.draftArtifacts.recipes).toBeUndefined();
      expect(await store.listPlans()).toHaveLength(0);
      expect(await store.listPurchaseLists()).toHaveLength(0);
      expect(auditJson).toContain("production.production_draft_document_created");
      expect(auditJson).not.toContain("VITELLO TONNATO");
      expect(auditJson).not.toContain("KOKOS-CHEESECAKE");
      expect(auditJson).not.toContain("promptContext");
      expect(auditJson).not.toContain("systemPrompt");
      expect(auditJson).not.toContain("providerResponse");
    } finally {
      await app.close();
    }
  });

  it("rejects invalid BYO extraction output with 422 and persists no draft", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const adapter: LlmReadinessProviderAdapter = {
      adapterId: "invalid-byo-production-draft-adapter",
      adapterMode: "synthetic_live",
      run: async (request) => ({
        ok: true,
        errors: [],
        adapterId: "invalid-byo-production-draft-adapter",
        adapterMode: "synthetic_live",
        promptSchemaId: request.promptSchemaId,
        outputCandidate: {
          contractVersion: llmReadinessContractVersion,
          outputId: "invalid-production-draft-output",
          kind: "production_draft_extraction",
          sourceRefs: request.input.sourceRefs,
          humanApprovalRequired: true,
          writesProductObject: false,
          text: JSON.stringify({ components: [], openQuestions: [] })
        }
      })
    };
    const app = buildProductionApp({
      dataRoot,
      store,
      llmAdapter: adapter,
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/production/drafts/from-document",
        headers: trustedProductionHeaders,
        payload: documentPayload()
      });

      expect(response.statusCode).toBe(422);
      expect(response.body).toContain("ProductionDraft-Extraktion ist nicht schema-valide.");
      expect(await store.listProductionDrafts()).toHaveLength(0);
    } finally {
      await app.close();
    }
  });
});
