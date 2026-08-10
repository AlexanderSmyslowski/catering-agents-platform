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
  findLlmReadinessPromptArtifactByInputKind,
  llmReadinessContractVersion,
  type LlmReadinessProviderAdapter,
  type LlmReadinessProviderAdapterRequest,
  type ProductionDraft
} from "@catering/shared-core";

const TRUSTED_SECRET = "production-draft-document-byo-secret";
const localBusiness = { businessId: "local" };
const trustedProductionHeaders = {
  "x-catering-actor-name": "Produktions-Mitarbeiter",
  "x-catering-trusted-secret": TRUSTED_SECRET
};

const documentText = [
  "AB 16.30 UHR | WELCOME DRINK",
  "HERZHAFTES GEBÄCK ZUM WEIN | KÄSEGEBÄCK - KLEINE BREZEL",
  "AB 19.00 UHR | BUFFET",
  "VITELLO TONNATO | RIESENKAPERN | WEISSER THUNFISCH",
  "ROTGARNELEN | AVOKADO-WASABI-CREME",
  "KOKOS-CHEESECAKE | BROMBEERE",
  "WEINGLÄSER",
  "8 MENÜSCHILDER | BILDERRAHMEN"
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
          { label: "Herzhaftes Gebäck zum Wein | Käsegebäck - kleine Brezel", course: "starter", category: "classic", categoryEvidence: null, note: null },
          { label: "Vitello Tonnato | Riesenkapern | weisser Thunfisch", course: "starter", category: "classic", categoryEvidence: null, note: null },
          { label: "Rotgarnelen | Avokado-Wasabi-Creme", course: "main", category: "classic", categoryEvidence: null, note: null },
          { label: "Kokos-Cheesecake | Brombeere", course: "dessert", category: "classic", categoryEvidence: null, note: null }
        ],
        openQuestions: [
          {
            field: "service.welcome-drink",
            message: "Der Welcome Drink ist als Servicezeit erkennbar, sein Produktionsumfang bleibt offen.",
            suggestedQuestion: "Welche Getränke und Mengen gehören zum Welcome Drink?"
          },
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
      const auditJson = JSON.stringify(await auditLog.listRecentFor({ businessId: "local" }, 10));

      expect(response.statusCode, response.body).toBe(201);
      expect(requests).toHaveLength(1);
      expect(requests[0].input.kind).toBe("production_draft_request");
      expect(requests[0].input.policy.dataMode).toBe("synthetic_or_demo_only");
      expect(requests[0].promptContext).toContain("VITELLO TONNATO");
      expect(requests[0].promptContext).toContain("WEINGLÄSER");
      expect(requests[0].promptContext).toContain("8 MENÜSCHILDER");
      expect(draft.status).toBe("pending_review");
      expect(draft.guardrails).toMatchObject({
        draftOnly: true,
        humanApprovalRequired: true,
        writesProductObjects: false,
        rawProviderPayloadStored: false
      });
      expect(draft.draftArtifacts.eventSpec?.menuPlan.map((component) => component.label)).toEqual([
        "Herzhaftes Gebäck zum Wein | Käsegebäck - kleine Brezel",
        "Vitello Tonnato | Riesenkapern | weisser Thunfisch",
        "Rotgarnelen | Avokado-Wasabi-Creme",
        "Kokos-Cheesecake | Brombeere"
      ]);
      expect(draft.draftArtifacts.eventSpec?.menuPlan.map((component) => component.label)).not.toEqual(
        expect.arrayContaining([expect.stringMatching(/Weingläser|Menüschilder|19\.00 Uhr/i)])
      );
      expect(draft.reviewCards.map((card) => card.title)).toEqual(
        expect.arrayContaining([
          "Herzhaftes Gebäck zum Wein | Käsegebäck - kleine Brezel",
          "Vitello Tonnato | Riesenkapern | weisser Thunfisch",
          "Rotgarnelen | Avokado-Wasabi-Creme",
          "Kokos-Cheesecake | Brombeere",
          "recipe.vitello-tonnato",
          "service.welcome-drink"
        ])
      );
      const promptArtifact = findLlmReadinessPromptArtifactByInputKind("production_draft_request");
      expect(promptArtifact?.userPromptTemplate).toContain("genau einmal");
      expect(promptArtifact?.userPromptTemplate).toContain("Glaeser");
      expect(promptArtifact?.userPromptTemplate).toContain("keine Menuekomponenten");
      expect(draft.draftArtifacts.recipes).toBeUndefined();
      expect(await store.listPlans(localBusiness)).toHaveLength(0);
      expect(await store.listPurchaseLists(localBusiness)).toHaveLength(0);
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

  it("creates a new pending revision from a commented change request without product writes", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const auditLog = new AuditLogStore({ rootDir: dataRoot });
    const requests: LlmReadinessProviderAdapterRequest[] = [];
    const changeRequest = "CHEESECAKE_CHANGE_REQUEST_MARKER: Je Törtchen nur zwei frische Brombeeren anlegen.";
    const adapter: LlmReadinessProviderAdapter = {
      adapterId: "mock-byo-production-draft-adapter",
      adapterMode: "synthetic_live",
      run: async (request) => {
        requests.push(request);
        if (requests.length === 1) {
          return extractionResponse(request);
        }

        const response = extractionResponse(request);
        const extraction = JSON.parse(response.outputCandidate.text) as {
          components: Array<{ label: string; note: string | null }>;
        };
        extraction.components = extraction.components.map((component) =>
          component.label.startsWith("Kokos-Cheesecake")
            ? { ...component, note: "Je Törtchen zwei frische Brombeeren anlegen." }
            : component
        );
        return {
          ...response,
          providerRequestId: "req-production-draft-revision-2",
          outputCandidate: {
            ...response.outputCandidate,
            outputId: "output-production-draft-revision-2",
            text: JSON.stringify(extraction)
          }
        };
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
      const created = await app.inject({
        method: "POST",
        url: "/v1/production/drafts/from-document",
        headers: trustedProductionHeaders,
        payload: documentPayload()
      });
      const originalDraft = created.json<{ draft: ProductionDraft }>().draft;
      const reviewed = await app.inject({
        method: "PATCH",
        url: `/v1/production/drafts/${originalDraft.draftId}/review-cards/card-menu-component-4`,
        headers: trustedProductionHeaders,
        payload: {
          decision: "change_requested",
          operatorComment: changeRequest
        }
      });
      const revised = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${originalDraft.draftId}/revise`,
        headers: trustedProductionHeaders,
        payload: {}
      });
      const revision = revised.json<{ draft: ProductionDraft }>().draft;
      const storedOriginal = await store.getProductionDraft(localBusiness, originalDraft.draftId);
      const auditJson = JSON.stringify(await auditLog.listRecentFor({ businessId: "local" }, 20));

      expect(created.statusCode, created.body).toBe(201);
      expect(reviewed.statusCode, reviewed.body).toBe(200);
      expect(revised.statusCode, revised.body).toBe(201);
      expect(requests).toHaveLength(2);
      expect(requests[1].input.kind).toBe("production_draft_request");
      expect(requests[1].promptContext).toContain(changeRequest);
      expect(requests[1].promptContext).toContain("Vitello Tonnato");
      expect(revision.status).toBe("pending_review");
      expect(revision.supersedesDraftId).toBe(originalDraft.draftId);
      expect(revision.draftId).not.toBe(originalDraft.draftId);
      expect(revision.reviewCards.every((card) => card.decision === "pending")).toBe(true);
      expect(revision.draftArtifacts.eventSpec?.menuPlan).toHaveLength(4);
      expect(revision.draftArtifacts.eventSpec?.sourceLineage).toEqual(
        expect.arrayContaining(originalDraft.draftArtifacts.eventSpec?.sourceLineage ?? [])
      );
      expect(storedOriginal?.status).toBe("superseded");
      expect(await store.listPlans(localBusiness)).toHaveLength(0);
      expect(await store.listPurchaseLists(localBusiness)).toHaveLength(0);
      expect(auditJson).toContain("production.production_draft_revision_created");
      expect(auditJson).not.toContain(changeRequest);
      expect(auditJson).not.toContain("promptContext");
    } finally {
      await app.close();
    }
  });

  it("does not call the provider when a requested change has no operator comment", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
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
      llmAdapter: adapter,
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });

    try {
      const created = await app.inject({
        method: "POST",
        url: "/v1/production/drafts/from-document",
        headers: trustedProductionHeaders,
        payload: documentPayload()
      });
      const originalDraft = created.json<{ draft: ProductionDraft }>().draft;
      await app.inject({
        method: "PATCH",
        url: `/v1/production/drafts/${originalDraft.draftId}/review-cards/card-menu-component-4`,
        headers: trustedProductionHeaders,
        payload: { decision: "change_requested" }
      });

      const revised = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${originalDraft.draftId}/revise`,
        headers: trustedProductionHeaders,
        payload: {}
      });
      const storedDrafts = await store.listProductionDrafts(localBusiness);

      expect(revised.statusCode, revised.body).toBe(422);
      expect(revised.body).toContain("konkret kommentierter Änderungswunsch");
      expect(requests).toHaveLength(1);
      expect(storedDrafts).toHaveLength(1);
      expect(storedDrafts[0].status).toBe("pending_review");
    } finally {
      await app.close();
    }
  });

  it("does not use the extraction revision path for recipe or planning cards", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
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
      llmAdapter: adapter,
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });

    try {
      const created = await app.inject({
        method: "POST",
        url: "/v1/production/drafts/from-document",
        headers: trustedProductionHeaders,
        payload: documentPayload()
      });
      const originalDraft = created.json<{ draft: ProductionDraft }>().draft;
      await store.saveProductionDraft(localBusiness, {
        ...originalDraft,
        reviewCards: [
          ...originalDraft.reviewCards,
          {
            cardId: "card-recipe-change",
            kind: "recipe",
            title: "Rezept ändern",
            summary: "Kerntemperatur ergänzen.",
            decision: "change_requested",
            operatorComment: "Kerntemperatur im Rezept ergänzen.",
            decidedBy: "Produktions-Mitarbeiter",
            decidedAt: new Date().toISOString(),
            requiredApproval: true
          }
        ]
      });

      const revised = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${originalDraft.draftId}/revise`,
        headers: trustedProductionHeaders,
        payload: {}
      });

      expect(revised.statusCode, revised.body).toBe(422);
      expect(revised.body).toContain("Rezept- und Planänderungen");
      expect(requests).toHaveLength(1);
      expect(await store.listProductionDrafts(localBusiness)).toHaveLength(1);
    } finally {
      await app.close();
    }
  });

  it("keeps the original draft pending when the revision output is invalid", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const auditLog = new AuditLogStore({ rootDir: dataRoot });
    const requests: LlmReadinessProviderAdapterRequest[] = [];
    const changeRequest = "INVALID_REVISION_COMMENT_MARKER";
    const adapter: LlmReadinessProviderAdapter = {
      adapterId: "mock-byo-production-draft-adapter",
      adapterMode: "synthetic_live",
      run: async (request) => {
        requests.push(request);
        if (requests.length === 1) {
          return extractionResponse(request);
        }

        const response = extractionResponse(request);
        return {
          ...response,
          outputCandidate: {
            ...response.outputCandidate,
            outputId: "invalid-production-draft-revision-output",
            text: JSON.stringify({ components: [], openQuestions: [] })
          }
        };
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
      const created = await app.inject({
        method: "POST",
        url: "/v1/production/drafts/from-document",
        headers: trustedProductionHeaders,
        payload: documentPayload()
      });
      const originalDraft = created.json<{ draft: ProductionDraft }>().draft;
      await app.inject({
        method: "PATCH",
        url: `/v1/production/drafts/${originalDraft.draftId}/review-cards/card-menu-component-4`,
        headers: trustedProductionHeaders,
        payload: {
          decision: "change_requested",
          operatorComment: changeRequest
        }
      });

      const revised = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${originalDraft.draftId}/revise`,
        headers: trustedProductionHeaders,
        payload: {}
      });
      const storedDrafts = await store.listProductionDrafts(localBusiness);
      const auditJson = JSON.stringify(await auditLog.listRecentFor({ businessId: "local" }, 20));

      expect(revised.statusCode, revised.body).toBe(422);
      expect(requests).toHaveLength(2);
      expect(storedDrafts).toHaveLength(1);
      expect(storedDrafts[0]).toMatchObject({
        draftId: originalDraft.draftId,
        status: "pending_review"
      });
      expect(auditJson).toContain("production.production_draft_revision_rejected");
      expect(auditJson).not.toContain(changeRequest);
      expect(auditJson).not.toContain("promptContext");
    } finally {
      await app.close();
    }
  });

  it("rejects a revision that silently drops an unchanged menu component", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const requests: LlmReadinessProviderAdapterRequest[] = [];
    const adapter: LlmReadinessProviderAdapter = {
      adapterId: "mock-byo-production-draft-adapter",
      adapterMode: "synthetic_live",
      run: async (request) => {
        requests.push(request);
        const response = extractionResponse(request);
        if (requests.length === 1) {
          return response;
        }

        const extraction = JSON.parse(response.outputCandidate.text) as {
          components: Array<{ label: string }>;
        };
        extraction.components = extraction.components.filter((component) =>
          !component.label.startsWith("Vitello Tonnato")
        );
        return {
          ...response,
          outputCandidate: {
            ...response.outputCandidate,
            outputId: "incomplete-production-draft-revision-output",
            text: JSON.stringify(extraction)
          }
        };
      }
    };
    const app = buildProductionApp({
      dataRoot,
      store,
      llmAdapter: adapter,
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });

    try {
      const created = await app.inject({
        method: "POST",
        url: "/v1/production/drafts/from-document",
        headers: trustedProductionHeaders,
        payload: documentPayload()
      });
      const originalDraft = created.json<{ draft: ProductionDraft }>().draft;
      await app.inject({
        method: "PATCH",
        url: `/v1/production/drafts/${originalDraft.draftId}/review-cards/card-menu-component-4`,
        headers: trustedProductionHeaders,
        payload: {
          decision: "change_requested",
          operatorComment: "Cheesecake mit zwei frischen Brombeeren anrichten."
        }
      });

      const revised = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${originalDraft.draftId}/revise`,
        headers: trustedProductionHeaders,
        payload: {}
      });
      const storedDrafts = await store.listProductionDrafts(localBusiness);

      expect(revised.statusCode, revised.body).toBe(422);
      expect(revised.body).toContain("Vitello Tonnato");
      expect(storedDrafts).toHaveLength(1);
      expect(storedDrafts[0].status).toBe("pending_review");
    } finally {
      await app.close();
    }
  });

  it("uses the server-approved pseudonymized mode even when the client claims another mode", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
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
      auditLog,
      llmAdapter: adapter,
      trustedActorSecret: TRUSTED_SECRET,
      env: {
        CATERING_PRODUCTION_DRAFT_DATA_MODE: "pseudonymized_approved"
      }
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/production/drafts/from-document",
        headers: trustedProductionHeaders,
        payload: {
          ...documentPayload(),
          dataMode: "synthetic_or_demo_only"
        }
      });
      const auditJson = JSON.stringify(await auditLog.listRecentFor({ businessId: "local" }, 10));

      expect(response.statusCode, response.body).toBe(201);
      expect(requests).toHaveLength(1);
      expect(requests[0].input.policy.dataMode).toBe("pseudonymized_approved");
      expect(auditJson).toContain('"dataMode":"pseudonymized_approved"');
    } finally {
      await app.close();
    }
  });

  it("keeps only source-backed component categories and raises one review question for unsupported claims", async () => {
    const sourceText = [
      "VEGAN | GRILLGEMÜSE | RAUKEPESTO",
      "Das Sortiment ist vegan, vegetarisch und traditionell angelegt.",
      "RICOTTACREME | BEERENSAUCE",
      "ORANGEN-MANDELKUCHEN"
    ].join("\n");
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const adapter: LlmReadinessProviderAdapter = {
      adapterId: "mock-category-evidence-adapter",
      adapterMode: "synthetic_live",
      run: async (request) => ({
        ok: true,
        errors: [],
        adapterId: "mock-category-evidence-adapter",
        adapterMode: "synthetic_live",
        providerId: "mock-category-evidence-provider",
        promptSchemaId: request.promptSchemaId,
        outputCandidate: {
          contractVersion: llmReadinessContractVersion,
          outputId: "output-category-evidence",
          kind: "production_draft_extraction",
          sourceRefs: request.input.sourceRefs,
          humanApprovalRequired: true,
          writesProductObject: false,
          text: JSON.stringify({
            eventType: "reception",
            serviceForm: "buffet",
            eventDate: null,
            attendeeCount: 100,
            customerName: null,
            venueName: null,
            components: [
              {
                label: "Grillgemüse | Raukepesto",
                course: null,
                category: "vegan",
                categoryEvidence: "VEGAN | GRILLGEMÜSE | RAUKEPESTO",
                note: null
              },
              {
                label: "Ricottacreme | Beerensauce",
                course: null,
                category: "vegetarian",
                categoryEvidence: "RICOTTACREME | BEERENSAUCE",
                note: null
              },
              {
                label: "Orangen-Mandelkuchen",
                course: null,
                category: "vegan",
                categoryEvidence: "Das Sortiment ist vegan, vegetarisch und traditionell angelegt.",
                note: null
              }
            ],
            openQuestions: []
          })
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
        payload: documentPayload(sourceText)
      });
      expect(response.statusCode, response.body).toBe(201);
      const draft = response.json<{ draft: ProductionDraft }>().draft;
      const menuPlan = draft.draftArtifacts.eventSpec?.menuPlan ?? [];

      expect(menuPlan.find((component) => component.label.startsWith("Grillgemüse"))?.menuCategory).toBe("vegan");
      expect(menuPlan.find((component) => component.label.startsWith("Ricottacreme"))?.menuCategory).toBeUndefined();
      expect(menuPlan.find((component) => component.label.startsWith("Orangen-Mandelkuchen"))?.menuCategory).toBeUndefined();
      expect(draft.draftArtifacts.openQuestions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: "components.category",
            message: expect.stringContaining("Ricottacreme | Beerensauce"),
            suggestedQuestion: expect.stringContaining("Ernährungsformen")
          })
        ])
      );
    } finally {
      await app.close();
    }
  });

  it("rejects an invalid server data-mode configuration at startup", () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);

    expect(() => buildProductionApp({
      dataRoot,
      env: {
        CATERING_PRODUCTION_DRAFT_DATA_MODE: "raw_customer_data"
      }
    })).toThrow(
      'CATERING_PRODUCTION_DRAFT_DATA_MODE must be "synthetic_or_demo_only" or "pseudonymized_approved".'
    );
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
      expect(await store.listProductionDrafts(localBusiness)).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it("reports a missing active AI connection without falling back to parser product writes", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const app = buildProductionApp({
      dataRoot,
      store,
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/production/drafts/from-document",
        headers: trustedProductionHeaders,
        payload: documentPayload("Buffet mit Vitello Tonnato für 45 Personen")
      });

      expect(response.statusCode).toBe(422);
      expect(response.body).toContain("Keine aktive KI-Verbindung für dieses Dokument");
      expect(await store.listProductionDrafts(localBusiness)).toHaveLength(0);
      expect(await store.listPlans(localBusiness)).toHaveLength(0);
      expect(await store.listPurchaseLists(localBusiness)).toHaveLength(0);
    } finally {
      await app.close();
    }
  });
});
