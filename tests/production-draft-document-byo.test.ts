import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildProductionApp as buildBaseProductionApp,
  ProductionStore
} from "@catering/production-service";
import type { SourceDocumentReader } from "../production-service/src/ports/source-document-reader.js";
import { productionDecisionRepositoryFor } from "../production-service/src/repositories/production-store.js";
import { InMemoryIntakeRecordsPort } from "./support/in-memory-intake-records-port.js";
import {
  AuditLogStore,
  findLlmReadinessPromptArtifactByInputKind,
  llmReadinessContractVersion,
  type ByoLlmDataClass,
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

const sourceDocuments = new Map<string, {
  metadata: Awaited<ReturnType<SourceDocumentReader["getMetadata"]>>;
  content: Uint8Array;
}>();

const sourceDocumentReader: SourceDocumentReader = {
  async getMetadata(context, documentId) {
    const stored = sourceDocuments.get(documentId)?.metadata;
    return stored?.businessId === context.businessId ? stored : undefined;
  },
  async getContent(context, documentId) {
    const stored = sourceDocuments.get(documentId);
    return stored?.metadata?.businessId === context.businessId ? stored.content : undefined;
  }
};

const externalProviderDescriptor = {
  providerKind: "openai" as const,
  dataLeavesInstallation: true,
  providerModel: "mock-openai-production-document-test",
  capability: "structured_output" as const,
  actualRegion: "eu-test-1",
  maximumEstimatedCostEur: 0.01,
  retentionPolicy: "zero-retention",
  trainingUse: "contractually_excluded" as const,
  endpoint: "https://api.example.test/v1/responses",
  metadataVerified: true
};

function writeExternalProcessingApproval(dataRoot: string): string {
  const approvalPath = path.join(dataRoot, "external-processing-approval.json");
  writeFileSync(approvalPath, JSON.stringify({
    approvalId: "approval-local-production-document-test-v1",
    businessId: "local",
    providerKind: "openai",
    allowedDataClasses: ["personal_confidential", "pseudonymized"],
    allowedPurposes: ["production_draft_extraction", "production_draft_revision"],
    allowedModels: [externalProviderDescriptor.providerModel],
    allowedCapabilities: [externalProviderDescriptor.capability],
    allowedRegions: [externalProviderDescriptor.actualRegion],
    allowedEndpoints: [externalProviderDescriptor.endpoint],
    maxCostEurPerCall: externalProviderDescriptor.maximumEstimatedCostEur,
    retentionPolicy: externalProviderDescriptor.retentionPolicy,
    trainingUse: externalProviderDescriptor.trainingUse,
    legalBasisReference: "test-processing-approval",
    approvedBy: "test-operator",
    approvedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2027-01-01T00:00:00.000Z"
  }), { mode: 0o600 });
  chmodSync(approvalPath, 0o600);
  return approvalPath;
}

function buildProductionApp(
  options: Parameters<typeof buildBaseProductionApp>[0] = {}
) {
  const approvalPath = options.llmAdapter && options.dataRoot
    ? writeExternalProcessingApproval(options.dataRoot)
    : undefined;
  return buildBaseProductionApp({
    ...options,
    ...(options.llmAdapter ? {
      llmProviderDescriptor: externalProviderDescriptor
    } : {}),
    env: approvalPath
      ? {
          ...options.env,
          CATERING_SYNTHETIC_LLM_SLICE: "1",
          CATERING_LLM_PROCESSING_APPROVAL_FILE: approvalPath
        }
      : options.env,
    sourceDocumentReader: options.sourceDocumentReader ?? sourceDocumentReader
  });
}

async function documentPayload(
  app: ReturnType<typeof buildProductionApp>,
  text = documentText,
  dataClass: ByoLlmDataClass = "personal_confidential"
) {
  const caseResponse = await app.inject({
    method: "POST",
    url: "/v1/production/cases",
    headers: trustedProductionHeaders,
    payload: { eventTypeLabel: "Empfang", attendeeCount: 45 }
  });
  expect(caseResponse.statusCode, caseResponse.body).toBe(201);
  const caseId = caseResponse.json<{ case: { caseId: string } }>().case.caseId;
  const content = Buffer.from(text, "utf8");
  const documentId = `source-document-${randomUUID()}`;
  sourceDocuments.set(documentId, {
    metadata: {
      businessId: "local",
      documentId,
      filename: "angebot-flying-buffet-anonymisiert.txt",
      mimeType: "text/plain",
      sizeBytes: content.byteLength,
      sha256: createHash("sha256").update(content).digest("hex"),
      dataClass,
      createdAt: "2026-06-14T09:00:00.000Z"
    },
    content
  });
  return { caseId, documentId };
}

async function completeProductionCase(
  store: ProductionStore,
  caseId: string
) {
  const current = await store.getCase(localBusiness, caseId);
  expect(current).toBeDefined();
  const completedAt = new Date(Date.parse(current!.updatedAt) + 1).toISOString();
  const completed = {
    ...current!,
    status: "completed" as const,
    approvedProductionSpecId: "approved-production-spec-previous",
    currentPlanId: "production-plan-previous",
    currentPurchaseListId: "purchase-list-previous",
    version: current!.version + 1,
    updatedAt: completedAt
  };
  expect(await store.updateCase(localBusiness, caseId, current!.version, completed)).toBe("updated");
  await store.appendEvent(localBusiness, caseId, {
    at: completedAt,
    role: "system",
    kind: "result",
    text: "Vorheriger Produktionsplan und Einkaufsliste erstellt.",
    artifactId: completed.currentPlanId
  });
  return completed;
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
      sourceDocumentReader,
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });

    try {
      const payload = await documentPayload(app);
      const response = await app.inject({
        method: "POST",
        url: "/v1/production/drafts/from-document",
        headers: trustedProductionHeaders,
        payload
      });
      const draft = response.json<{ draft: ProductionDraft }>().draft;
      const audits = await auditLog.listRecentFor({ businessId: "local" }, 10);
      const auditJson = JSON.stringify(audits);
      const createdAudit = audits.find((entry) =>
        entry.action === "production.production_draft_document_created"
      );

      expect(response.statusCode, response.body).toBe(201);
      expect(requests).toHaveLength(1);
      expect(requests[0].input.kind).toBe("production_draft_request");
      expect(requests[0].input.policy.dataMode).toBe("synthetic_or_demo_only");
      expect(requests[0].promptContext).toContain("VITELLO TONNATO");
      expect(requests[0].promptContext).toContain("WEINGLÄSER");
      expect(requests[0].promptContext).toContain("8 MENÜSCHILDER");
      expect(draft.status).toBe("pending_review");
      await expect(store.getCase(localBusiness, payload.caseId)).resolves.toMatchObject({
        sourceSpecId: draft.draftArtifacts.eventSpec?.specId
      });
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
      expect(await store.listEvents(localBusiness, payload.caseId)).toEqual([
        expect.objectContaining({ kind: "case_created" }),
        expect.objectContaining({
          kind: "source_added",
          sourceId: payload.documentId,
          sourceRef: expect.objectContaining({
            documentId: payload.documentId,
            filename: "angebot-flying-buffet-anonymisiert.txt",
            mimeType: "text/plain",
            dataClass: "personal_confidential"
          })
        }),
        expect.objectContaining({
          kind: "draft_created",
          artifactId: draft.draftId,
          revisionRef: expect.objectContaining({
            artifactType: "ProductionDraft",
            artifactId: draft.draftId,
            revision: 1
          })
        })
      ]);
      expect(await store.listPlans(localBusiness)).toHaveLength(0);
      expect(await store.listPurchaseLists(localBusiness)).toHaveLength(0);
      expect(auditJson).toContain("production.production_draft_document_created");
      expect(createdAudit?.details).toMatchObject({
        draftId: draft.draftId,
        caseId: payload.caseId,
        documentId: payload.documentId,
        sourceSha256: draft.source.inputHash?.replace(/^sha256:/, ""),
        providerId: draft.source.providerId,
        modelId: draft.source.modelId,
        runId: draft.source.runId,
        reviewCardCount: draft.reviewCards.length,
        componentCount: draft.draftArtifacts.eventSpec?.menuPlan.length,
        openQuestionCount: draft.draftArtifacts.openQuestions?.length,
        outputTextHash: draft.source.outputHash,
        humanApprovalRequired: true,
        writesProductObject: false
      });
      expect(createdAudit?.details).toMatchObject({
        policyProviderKind: "openai",
        policyPurpose: "production_draft_extraction",
        policyDataClass: "personal_confidential",
        policySuccessClass: "success",
        policyInputHash: expect.stringMatching(/^sha256:/),
        policyOutputHash: expect.stringMatching(/^sha256:/)
      });
      expect(auditJson).not.toContain("VITELLO TONNATO");
      expect(auditJson).not.toContain("KOKOS-CHEESECAKE");
      expect(auditJson).not.toContain("promptContext");
      expect(auditJson).not.toContain("systemPrompt");
      expect(auditJson).not.toContain("providerResponse");
    } finally {
      await app.close();
    }
  });

  it("records one source event when the same case document is processed concurrently", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const adapter: LlmReadinessProviderAdapter = {
      adapterId: "mock-concurrent-source-adapter",
      adapterMode: "synthetic_live",
      run: async (request) => extractionResponse(request)
    };
    const app = buildProductionApp({
      dataRoot,
      store,
      llmAdapter: adapter,
      trustedActorSecret: TRUSTED_SECRET,
      env: { CATERING_SYNTHETIC_LLM_SLICE: "1" }
    });

    try {
      const payload = await documentPayload(app);
      const appendEvent = store.appendEvent.bind(store);
      let waitingAppends = 0;
      let releaseAppends!: () => void;
      const appendBarrier = new Promise<void>((resolve) => { releaseAppends = resolve; });
      vi.spyOn(store, "appendEvent").mockImplementation(async (context, caseId, input, eventIdentity) => {
        if (input.kind === "source_added" && waitingAppends < 2) {
          waitingAppends += 1;
          if (waitingAppends === 2) releaseAppends();
          await appendBarrier;
        }
        return appendEvent(context, caseId, input, eventIdentity);
      });
      const request = () => app.inject({
        method: "POST" as const,
        url: "/v1/production/drafts/from-document",
        headers: trustedProductionHeaders,
        payload
      });

      const responses = await Promise.all([request(), request()]);

      expect(responses.map((response) => response.statusCode)).toEqual([201, 201]);
      const responseDrafts = responses.map((response) => response.json<{ draft: ProductionDraft }>().draft);
      const events = await store.listEvents(localBusiness, payload.caseId);
      const sourceEvents = events
        .filter((event) => event.kind === "source_added");
      expect(sourceEvents).toEqual([
        expect.objectContaining({
          sourceId: payload.documentId,
          sourceRef: expect.objectContaining({ documentId: payload.documentId })
        })
      ]);
      expect(responseDrafts[0]).toEqual(responseDrafts[1]);
      expect(await store.listProductionDrafts(localBusiness)).toEqual([responseDrafts[0]]);
      expect(events.filter((event) => event.kind === "draft_created")).toEqual([
        expect.objectContaining({ artifactId: responseDrafts[0].draftId })
      ]);
    } finally {
      await app.close();
    }
  });

  it("reuses the case-scoped document draft after a lost response and repairs one draft-created event without recalling the provider", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const run = vi.fn(async (request: LlmReadinessProviderAdapterRequest) => extractionResponse(request));
    const adapter: LlmReadinessProviderAdapter = {
      adapterId: "mock-document-retry-adapter",
      adapterMode: "synthetic_live",
      run
    };
    const app = buildProductionApp({
      dataRoot,
      store,
      llmAdapter: adapter,
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });

    try {
      const payload = await documentPayload(app);
      const appendEvent = store.appendEvent.bind(store);
      let failDraftEventOnce = true;
      vi.spyOn(store, "appendEvent").mockImplementation(async (context, caseId, input, eventIdentity) => {
        if (input.kind === "draft_created" && failDraftEventOnce) {
          failDraftEventOnce = false;
          throw new Error("simulated response loss after draft persistence");
        }
        return appendEvent(context, caseId, input, eventIdentity);
      });

      const first = await app.inject({
        method: "POST",
        url: "/v1/production/drafts/from-document",
        headers: trustedProductionHeaders,
        payload
      });
      const persistedAfterLoss = await store.listProductionDrafts(localBusiness);
      const retried = await app.inject({
        method: "POST",
        url: "/v1/production/drafts/from-document",
        headers: trustedProductionHeaders,
        payload
      });
      const retriedDraft = retried.json<{ draft: ProductionDraft }>().draft;
      const draftEvents = (await store.listEvents(localBusiness, payload.caseId))
        .filter((event) => event.kind === "draft_created");

      expect(first.statusCode).toBe(500);
      expect(persistedAfterLoss).toHaveLength(1);
      expect(retried.statusCode, retried.body).toBe(201);
      expect(retriedDraft).toEqual(persistedAfterLoss[0]);
      expect(await store.listProductionDrafts(localBusiness)).toEqual([persistedAfterLoss[0]]);
      expect(run).toHaveBeenCalledTimes(1);
      expect(draftEvents).toEqual([
        expect.objectContaining({
          artifactId: persistedAfterLoss[0].draftId,
          revisionRef: expect.objectContaining({ artifactId: persistedAfterLoss[0].draftId })
        })
      ]);
    } finally {
      await app.close();
    }
  });

  it("reopens a completed case exactly once when a new document draft survives a lost response", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const run = vi.fn(async (request: LlmReadinessProviderAdapterRequest) => extractionResponse(request));
    const app = buildProductionApp({
      dataRoot,
      store,
      llmAdapter: {
        adapterId: "mock-document-continuation-adapter",
        adapterMode: "synthetic_live",
        run
      },
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });

    try {
      const payload = await documentPayload(app);
      const completed = await completeProductionCase(store, payload.caseId);
      const appendEvent = store.appendEvent.bind(store);
      let failDraftEventOnce = true;
      vi.spyOn(store, "appendEvent").mockImplementation(async (context, caseId, input, eventIdentity) => {
        if (input.kind === "draft_created" && failDraftEventOnce) {
          failDraftEventOnce = false;
          throw new Error("simulated response loss after continuation draft persistence");
        }
        return appendEvent(context, caseId, input, eventIdentity);
      });
      const request = () => app.inject({
        method: "POST" as const,
        url: "/v1/production/drafts/from-document",
        headers: trustedProductionHeaders,
        payload
      });

      const first = await request();
      expect(first.statusCode).toBe(500);
      const afterLostResponse = await store.getCase(localBusiness, payload.caseId);
      expect(afterLostResponse).toMatchObject({
        status: "completed",
        approvedProductionSpecId: completed.approvedProductionSpecId,
        currentPlanId: completed.currentPlanId,
        currentPurchaseListId: completed.currentPurchaseListId,
        sourceSpecId: expect.any(String)
      });

      const retry = await request();
      const afterRetry = await store.getCase(localBusiness, payload.caseId);
      const secondRetry = await request();
      const afterSecondRetry = await store.getCase(localBusiness, payload.caseId);

      expect(retry.statusCode, retry.body).toBe(201);
      expect(secondRetry.statusCode, secondRetry.body).toBe(201);
      expect(afterRetry).toMatchObject({
        status: "open",
        version: afterLostResponse!.version + 1
      });
      expect(afterRetry?.approvedProductionSpecId).toBeUndefined();
      expect(afterRetry?.currentPlanId).toBeUndefined();
      expect(afterRetry?.currentPurchaseListId).toBeUndefined();
      expect(afterSecondRetry).toEqual(afterRetry);
      expect(run).toHaveBeenCalledTimes(1);
      expect((await store.listEvents(localBusiness, payload.caseId))
        .filter((event) => event.kind === "draft_created")).toHaveLength(1);
    } finally {
      await app.close();
    }
  });

  it("keeps a completed case unchanged when its already-applied document draft is retried", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const run = vi.fn(async (request: LlmReadinessProviderAdapterRequest) => extractionResponse(request));
    const app = buildProductionApp({
      dataRoot,
      store,
      llmAdapter: {
        adapterId: "mock-applied-document-retry-adapter",
        adapterMode: "synthetic_live",
        run
      },
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });

    try {
      const payload = await documentPayload(app);
      const created = await app.inject({
        method: "POST",
        url: "/v1/production/drafts/from-document",
        headers: trustedProductionHeaders,
        payload
      });
      expect(created.statusCode, created.body).toBe(201);
      const completed = await completeProductionCase(store, payload.caseId);

      const retried = await app.inject({
        method: "POST",
        url: "/v1/production/drafts/from-document",
        headers: trustedProductionHeaders,
        payload
      });

      expect(retried.statusCode, retried.body).toBe(201);
      expect(await store.getCase(localBusiness, payload.caseId)).toEqual(completed);
      expect(run).toHaveBeenCalledTimes(1);
      expect((await store.listEvents(localBusiness, payload.caseId))
        .filter((event) => event.kind === "draft_created")).toHaveLength(1);
    } finally {
      await app.close();
    }
  });

  it("does not reopen a completed case when document draft generation fails before persistence", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const app = buildProductionApp({
      dataRoot,
      store,
      llmAdapter: {
        adapterId: "mock-rejected-document-continuation-adapter",
        adapterMode: "synthetic_live",
        run: async (request) => ({
          ...extractionResponse(request),
          ok: false,
          errors: ["simulated invalid provider output"]
        })
      },
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });

    try {
      const payload = await documentPayload(app);
      const completed = await completeProductionCase(store, payload.caseId);
      const response = await app.inject({
        method: "POST",
        url: "/v1/production/drafts/from-document",
        headers: trustedProductionHeaders,
        payload
      });

      expect(response.statusCode).toBe(422);
      expect(await store.getCase(localBusiness, payload.caseId)).toEqual(completed);
      expect(await store.listProductionDrafts(localBusiness)).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it("repairs one creation audit entry after audit persistence fails without recalling the provider", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const auditLog = new AuditLogStore({ rootDir: dataRoot });
    const run = vi.fn(async (request: LlmReadinessProviderAdapterRequest) => extractionResponse(request));
    const adapter: LlmReadinessProviderAdapter = {
      adapterId: "mock-document-audit-retry-adapter",
      adapterMode: "synthetic_live",
      run
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
      const payload = await documentPayload(app);
      const logFor = auditLog.logFor.bind(auditLog);
      let failCreatedAuditOnce = true;
      vi.spyOn(auditLog, "logFor").mockImplementation(async (context, input) => {
        if (input.action === "production.production_draft_document_created" && failCreatedAuditOnce) {
          failCreatedAuditOnce = false;
          throw new Error("simulated audit persistence failure");
        }
        return logFor(context, input);
      });

      const request = () => app.inject({
        method: "POST" as const,
        url: "/v1/production/drafts/from-document",
        headers: trustedProductionHeaders,
        payload
      });
      const first = await request();
      const persistedAfterAuditFailure = await store.listProductionDrafts(localBusiness);
      const retried = await request();
      const audits = (await auditLog.listRecentFor(localBusiness, 20))
        .filter((entry) => entry.action === "production.production_draft_document_created");

      expect(first.statusCode).toBe(500);
      expect(persistedAfterAuditFailure).toHaveLength(1);
      expect(retried.statusCode, retried.body).toBe(201);
      expect(retried.json<{ draft: ProductionDraft }>().draft).toEqual(persistedAfterAuditFailure[0]);
      expect(run).toHaveBeenCalledTimes(1);
      const persistedDraft = persistedAfterAuditFailure[0];
      expect(persistedDraft.source.processingPolicy).toMatchObject({
        approvalId: "approval-local-production-document-test-v1",
        businessId: "local",
        providerKind: "openai",
        providerModel: externalProviderDescriptor.providerModel,
        capability: externalProviderDescriptor.capability,
        actualRegion: externalProviderDescriptor.actualRegion,
        endpoint: "https://api.example.test",
        maximumEstimatedCostEur: externalProviderDescriptor.maximumEstimatedCostEur,
        retentionPolicy: externalProviderDescriptor.retentionPolicy,
        trainingUse: "contractually_excluded",
        purpose: "production_draft_extraction",
        dataClass: "personal_confidential",
        inputHash: expect.stringMatching(/^sha256:/),
        sourceHash: expect.stringMatching(/^sha256:/),
        projectionHash: expect.stringMatching(/^sha256:/),
        outputHash: expect.stringMatching(/^sha256:/),
        successClass: "success"
      });
      expect(audits).toEqual([
        expect.objectContaining({
          entityId: persistedDraft.draftId,
          action: "production.production_draft_document_created",
          details: {
            draftId: persistedDraft.draftId,
            caseId: payload.caseId,
            documentId: payload.documentId,
            sourceSha256: persistedDraft.source.inputHash?.replace(/^sha256:/, ""),
            providerId: persistedDraft.source.providerId,
            modelId: persistedDraft.source.modelId,
            runId: persistedDraft.source.runId,
            reviewCardCount: persistedDraft.reviewCards.length,
            componentCount: persistedDraft.draftArtifacts.eventSpec?.menuPlan.length,
            openQuestionCount: persistedDraft.draftArtifacts.openQuestions?.length,
            outputTextHash: persistedDraft.source.outputHash,
            policyApprovalId: "approval-local-production-document-test-v1",
            policyBusinessId: "local",
            policyProviderKind: "openai",
            policyProviderModel: externalProviderDescriptor.providerModel,
            policyCapability: externalProviderDescriptor.capability,
            policyRegion: externalProviderDescriptor.actualRegion,
            policyEndpoint: "https://api.example.test",
            policyMaximumEstimatedCostEur: externalProviderDescriptor.maximumEstimatedCostEur,
            policyRetentionPolicy: externalProviderDescriptor.retentionPolicy,
            policyTrainingUse: "contractually_excluded",
            policyPurpose: "production_draft_extraction",
            policyDataClass: "personal_confidential",
            policyInputHash: expect.stringMatching(/^sha256:/),
            policySourceHash: expect.stringMatching(/^sha256:/),
            policyProjectionHash: expect.stringMatching(/^sha256:/),
            policyOutputHash: expect.stringMatching(/^sha256:/),
            policySuccessClass: "success",
            humanApprovalRequired: true,
            writesProductObject: false
          }
        })
      ]);
      expect(JSON.stringify(audits)).not.toContain("promptContext");
      expect(JSON.stringify(audits)).not.toContain("providerResponse");
    } finally {
      await app.close();
    }
  });

  it("rejects a deterministic document draft whose persisted source lineage no longer matches the case source", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const run = vi.fn(async (request: LlmReadinessProviderAdapterRequest) => extractionResponse(request));
    const adapter: LlmReadinessProviderAdapter = {
      adapterId: "mock-document-lineage-adapter",
      adapterMode: "synthetic_live",
      run
    };
    const app = buildProductionApp({
      dataRoot,
      store,
      llmAdapter: adapter,
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });

    try {
      const payload = await documentPayload(app);
      const created = await app.inject({
        method: "POST",
        url: "/v1/production/drafts/from-document",
        headers: trustedProductionHeaders,
        payload
      });
      const draft = created.json<{ draft: ProductionDraft }>().draft;
      await store.saveProductionDraft(localBusiness, {
        ...draft,
        source: {
          ...draft.source,
          inputHash: `sha256:${"0".repeat(64)}`
        }
      });

      const retried = await app.inject({
        method: "POST",
        url: "/v1/production/drafts/from-document",
        headers: trustedProductionHeaders,
        payload
      });

      expect(created.statusCode, created.body).toBe(201);
      expect(retried.statusCode, retried.body).toBe(409);
      expect(retried.json()).toMatchObject({ message: expect.stringContaining("Quelldokument") });
      expect(run).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
    }
  });

  it("creates distinct case-scoped drafts when the same document is used for copied production cases", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const run = vi.fn(async (request: LlmReadinessProviderAdapterRequest) => extractionResponse(request));
    const adapter: LlmReadinessProviderAdapter = {
      adapterId: "mock-copied-case-document-adapter",
      adapterMode: "synthetic_live",
      run
    };
    const app = buildProductionApp({
      dataRoot,
      store,
      llmAdapter: adapter,
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });

    try {
      const firstPayload = await documentPayload(app);
      const copiedCaseResponse = await app.inject({
        method: "POST",
        url: "/v1/production/cases",
        headers: trustedProductionHeaders,
        payload: { eventTypeLabel: "Empfang", attendeeCount: 45 }
      });
      const copiedCaseId = copiedCaseResponse.json<{ case: { caseId: string } }>().case.caseId;
      const createDraft = (caseId: string) => app.inject({
        method: "POST" as const,
        url: "/v1/production/drafts/from-document",
        headers: trustedProductionHeaders,
        payload: { caseId, documentId: firstPayload.documentId }
      });

      const first = await createDraft(firstPayload.caseId);
      const copied = await createDraft(copiedCaseId);
      const firstDraft = first.json<{ draft: ProductionDraft }>().draft;
      const copiedDraft = copied.json<{ draft: ProductionDraft }>().draft;

      expect(first.statusCode, first.body).toBe(201);
      expect(copied.statusCode, copied.body).toBe(201);
      expect(firstDraft.draftId).not.toBe(copiedDraft.draftId);
      expect(await store.listProductionDrafts(localBusiness)).toHaveLength(2);
      expect(run).toHaveBeenCalledTimes(2);
      expect(await store.listEvents(localBusiness, firstPayload.caseId)).toEqual(
        expect.arrayContaining([expect.objectContaining({ kind: "draft_created", artifactId: firstDraft.draftId })])
      );
      expect(await store.listEvents(localBusiness, copiedCaseId)).toEqual(
        expect.arrayContaining([expect.objectContaining({ kind: "draft_created", artifactId: copiedDraft.draftId })])
      );
    } finally {
      await app.close();
    }
  });

  it("keeps corrected source documents as immutable revisions in the same production case", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const run = vi.fn(async (request: LlmReadinessProviderAdapterRequest) => extractionResponse(request));
    const app = buildProductionApp({
      dataRoot,
      store,
      llmAdapter: {
        adapterId: "mock-corrected-document-adapter",
        adapterMode: "synthetic_live",
        run
      },
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });

    try {
      const firstPayload = await documentPayload(app);
      const correctedContent = Buffer.from(`${documentText}\nKORREKTUR: 50 PERSONEN`, "utf8");
      const correctedDocumentId = `source-document-${randomUUID()}`;
      const correctedSha256 = createHash("sha256").update(correctedContent).digest("hex");
      sourceDocuments.set(correctedDocumentId, {
        metadata: {
          businessId: "local",
          documentId: correctedDocumentId,
          filename: "angebot-flying-buffet-korrigiert.txt",
          mimeType: "text/plain",
          sizeBytes: correctedContent.byteLength,
          sha256: correctedSha256,
          dataClass: "personal_confidential",
          createdAt: "2026-06-14T10:00:00.000Z"
        },
        content: correctedContent
      });
      const createDraft = (documentId: string) => app.inject({
        method: "POST" as const,
        url: "/v1/production/drafts/from-document",
        headers: trustedProductionHeaders,
        payload: { caseId: firstPayload.caseId, documentId }
      });

      const first = await createDraft(firstPayload.documentId);
      const firstDraft = first.json<{ draft: ProductionDraft }>().draft;
      const corrected = await createDraft(correctedDocumentId);
      const correctedDraft = corrected.json<{ draft: ProductionDraft }>().draft;
      const correctedRetry = await createDraft(correctedDocumentId);
      const events = await store.listEvents(localBusiness, firstPayload.caseId);

      expect(first.statusCode, first.body).toBe(201);
      expect(corrected.statusCode, corrected.body).toBe(201);
      expect(correctedRetry.statusCode, correctedRetry.body).toBe(201);
      expect(correctedRetry.json<{ draft: ProductionDraft }>().draft).toEqual(correctedDraft);
      expect(firstDraft.status).toBe("pending_review");
      expect(correctedDraft).toMatchObject({
        status: "pending_review",
        revision: firstDraft.revision + 1,
        supersedesDraftId: firstDraft.draftId
      });
      expect(correctedDraft.draftArtifacts.eventSpec?.sourceLineage).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ reference: firstDraft.source.inputHash }),
          expect.objectContaining({ reference: `sha256:${correctedSha256}` })
        ])
      );
      expect(await store.getProductionDraft(localBusiness, firstDraft.draftId)).toEqual({
        ...firstDraft,
        status: "superseded"
      });
      expect(await store.listProductionDrafts(localBusiness)).toHaveLength(2);
      expect(await store.getCase(localBusiness, firstPayload.caseId)).toMatchObject({
        sourceSpecId: correctedDraft.draftArtifacts.eventSpec?.specId
      });
      expect(events.filter((event) => event.kind === "source_added")).toHaveLength(2);
      expect(events.filter((event) => event.kind === "draft_created")).toEqual([
        expect.objectContaining({ artifactId: firstDraft.draftId }),
        expect.objectContaining({
          artifactId: correctedDraft.draftId,
          revisionRef: expect.objectContaining({
            supersedesArtifactId: firstDraft.draftId,
            revision: firstDraft.revision + 1
          })
        })
      ]);
      expect(run).toHaveBeenCalledTimes(2);
    } finally {
      await app.close();
    }
  });

  it("finishes a corrected document commit after the new draft was published before the case advanced", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const run = vi.fn(async (request: LlmReadinessProviderAdapterRequest) => extractionResponse(request));
    const app = buildProductionApp({
      dataRoot,
      store,
      llmAdapter: {
        adapterId: "mock-corrected-document-recovery-adapter",
        adapterMode: "synthetic_live",
        run
      },
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });

    try {
      const firstPayload = await documentPayload(app);
      const first = await app.inject({
        method: "POST",
        url: "/v1/production/drafts/from-document",
        headers: trustedProductionHeaders,
        payload: firstPayload
      });
      expect(first.statusCode, first.body).toBe(201);
      const firstDraft = first.json<{ draft: ProductionDraft }>().draft;
      const caseBeforeCorrection = await store.getCase(localBusiness, firstPayload.caseId);

      const correctedContent = Buffer.from(`${documentText}\nKORREKTUR: 50 PERSONEN`, "utf8");
      const correctedDocumentId = `source-document-${randomUUID()}`;
      const correctedSha256 = createHash("sha256").update(correctedContent).digest("hex");
      sourceDocuments.set(correctedDocumentId, {
        metadata: {
          businessId: "local",
          documentId: correctedDocumentId,
          filename: "angebot-flying-buffet-korrigiert-recovery.txt",
          mimeType: "text/plain",
          sizeBytes: correctedContent.byteLength,
          sha256: correctedSha256,
          dataClass: "personal_confidential",
          createdAt: "2026-06-14T10:00:00.000Z"
        },
        content: correctedContent
      });

      const repository = productionDecisionRepositoryFor(store);
      const originalCriticalSection = repository.withTargetCriticalSection.bind(repository);
      let failAfterPublish = true;
      vi.spyOn(repository, "withTargetCriticalSection").mockImplementation(
        (context, target, operation) => originalCriticalSection(context, target, (scope) => operation({
          ...scope,
          insertDraft: async (draft) => {
            const result = await scope.insertDraft(draft);
            if (result === "created" && failAfterPublish) {
              failAfterPublish = false;
              throw new Error("injected failure after corrected draft publish");
            }
            return result;
          }
        }))
      );
      const requestCorrection = () => app.inject({
        method: "POST" as const,
        url: "/v1/production/drafts/from-document",
        headers: trustedProductionHeaders,
        payload: { caseId: firstPayload.caseId, documentId: correctedDocumentId }
      });

      const failed = await requestCorrection();
      const draftsAfterFailure = await store.listProductionDrafts(localBusiness);
      const publishedCorrection = draftsAfterFailure.find((draft) => draft.supersedesDraftId === firstDraft.draftId);

      expect(failed.statusCode).toBe(500);
      expect(publishedCorrection).toMatchObject({ status: "pending_review" });
      expect(await store.getProductionDraft(localBusiness, firstDraft.draftId)).toEqual(firstDraft);
      expect(await store.getCase(localBusiness, firstPayload.caseId)).toEqual(caseBeforeCorrection);
      expect((await store.listEvents(localBusiness, firstPayload.caseId))
        .filter((event) => event.kind === "draft_created" && event.artifactId === publishedCorrection?.draftId))
        .toHaveLength(0);

      const retry = await requestCorrection();
      const recoveredDraft = retry.json<{ draft: ProductionDraft }>().draft;
      const draftsAfterRecovery = await store.listProductionDrafts(localBusiness);

      expect(retry.statusCode, retry.body).toBe(201);
      expect(recoveredDraft).toEqual(publishedCorrection);
      expect(run).toHaveBeenCalledTimes(2);
      expect(draftsAfterRecovery).toHaveLength(2);
      expect(draftsAfterRecovery.filter((draft) => draft.status === "pending_review")).toEqual([recoveredDraft]);
      expect(await store.getProductionDraft(localBusiness, firstDraft.draftId)).toEqual({
        ...firstDraft,
        status: "superseded"
      });
      expect(await store.getCase(localBusiness, firstPayload.caseId)).toMatchObject({
        sourceSpecId: recoveredDraft.draftArtifacts.eventSpec?.specId
      });
      expect((await store.listEvents(localBusiness, firstPayload.caseId))
        .filter((event) => event.kind === "draft_created" && event.artifactId === recoveredDraft.draftId))
        .toHaveLength(1);
    } finally {
      await app.close();
    }
  });

  it("continues an applied document draft without rewriting its approved predecessor", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const run = vi.fn(async (request: LlmReadinessProviderAdapterRequest) => extractionResponse(request));
    const app = buildProductionApp({
      dataRoot,
      store,
      intakeRecords: new InMemoryIntakeRecordsPort(),
      llmAdapter: {
        adapterId: "mock-applied-document-continuation-adapter",
        adapterMode: "synthetic_live",
        run
      },
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });

    try {
      const firstPayload = await documentPayload(app);
      const firstResponse = await app.inject({
        method: "POST",
        url: "/v1/production/drafts/from-document",
        headers: trustedProductionHeaders,
        payload: firstPayload
      });
      const firstDraft = firstResponse.json<{ draft: ProductionDraft }>().draft;
      const preparedResponse = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${firstDraft.draftId}/prepare`,
        headers: trustedProductionHeaders,
        payload: {}
      });
      const preparedDraft = preparedResponse.json<{ draft: ProductionDraft }>().draft;
      for (const card of preparedDraft.reviewCards) {
        const reviewed = await app.inject({
          method: "PATCH",
          url: `/v1/production/drafts/${preparedDraft.draftId}/review-cards/${card.cardId}`,
          headers: trustedProductionHeaders,
          payload: { decision: "fits" }
        });
        expect(reviewed.statusCode, reviewed.body).toBe(200);
      }
      const approved = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${preparedDraft.draftId}/decision`,
        headers: trustedProductionHeaders,
        payload: { decision: "approved" }
      });
      const approvedProductionSpecId = approved.json<{
        approvedProductionSpec: { approvedProductionSpecId: string };
      }>().approvedProductionSpec.approvedProductionSpecId;
      const applied = await app.inject({
        method: "POST",
        url: `/v1/production/approved-specs/${approvedProductionSpecId}/apply`,
        headers: trustedProductionHeaders,
        payload: {}
      });
      const approvedPredecessor = await store.getProductionDraft(localBusiness, preparedDraft.draftId);
      const completedCase = await store.getCase(localBusiness, firstPayload.caseId);

      const correctedContent = Buffer.from(`${documentText}\nKORREKTUR: DESSERT ENTFÄLLT`, "utf8");
      const correctedDocumentId = `source-document-${randomUUID()}`;
      const correctedSha256 = createHash("sha256").update(correctedContent).digest("hex");
      sourceDocuments.set(correctedDocumentId, {
        metadata: {
          businessId: "local",
          documentId: correctedDocumentId,
          filename: "angebot-flying-buffet-korrigiert-ohne-dessert.txt",
          mimeType: "text/plain",
          sizeBytes: correctedContent.byteLength,
          sha256: correctedSha256,
          dataClass: "personal_confidential",
          createdAt: "2026-06-15T09:00:00.000Z"
        },
        content: correctedContent
      });

      const corrected = await app.inject({
        method: "POST",
        url: "/v1/production/drafts/from-document",
        headers: trustedProductionHeaders,
        payload: { caseId: firstPayload.caseId, documentId: correctedDocumentId }
      });
      const correctedDraft = corrected.json<{ draft: ProductionDraft }>().draft;
      const correctedRetry = await app.inject({
        method: "POST",
        url: "/v1/production/drafts/from-document",
        headers: trustedProductionHeaders,
        payload: { caseId: firstPayload.caseId, documentId: correctedDocumentId }
      });
      const reopenedCase = await store.getCase(localBusiness, firstPayload.caseId);

      expect(firstResponse.statusCode, firstResponse.body).toBe(201);
      expect(preparedResponse.statusCode, preparedResponse.body).toBe(201);
      expect(approved.statusCode, approved.body).toBe(201);
      expect(applied.statusCode, applied.body).toBe(200);
      expect(approvedPredecessor).toMatchObject({
        status: "approved"
      });
      expect(await store.getApplyManifest(localBusiness, approvedProductionSpecId)).toBeDefined();
      expect(completedCase).toMatchObject({
        status: "completed",
        approvedProductionSpecId,
        currentPlanId: expect.any(String),
        currentPurchaseListId: expect.any(String)
      });
      expect(corrected.statusCode, corrected.body).toBe(201);
      expect(correctedDraft).toMatchObject({
        status: "pending_review",
        revision: preparedDraft.revision + 1,
        supersedesDraftId: preparedDraft.draftId
      });
      expect(await store.getProductionDraft(localBusiness, preparedDraft.draftId)).toEqual(approvedPredecessor);
      expect(correctedRetry.statusCode, correctedRetry.body).toBe(201);
      expect(correctedRetry.json<{ draft: ProductionDraft }>().draft).toEqual(correctedDraft);
      expect(reopenedCase).toMatchObject({
        status: "open",
        sourceSpecId: correctedDraft.draftArtifacts.eventSpec?.specId
      });
      expect(reopenedCase?.approvedProductionSpecId).toBeUndefined();
      expect(reopenedCase?.currentPlanId).toBeUndefined();
      expect(reopenedCase?.currentPurchaseListId).toBeUndefined();
      expect(correctedDraft.draftArtifacts.eventSpec?.sourceLineage).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ reference: firstDraft.source.inputHash }),
          expect.objectContaining({ reference: `sha256:${correctedSha256}` })
        ])
      );
      expect(run).toHaveBeenCalledTimes(2);
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
      const payload = await documentPayload(app);
      const created = await app.inject({
        method: "POST",
        url: "/v1/production/drafts/from-document",
        headers: trustedProductionHeaders,
        payload
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
      expect((await store.listEvents(localBusiness, payload.caseId)).map((event) => event.kind)).toEqual([
        "case_created",
        "source_added",
        "draft_created",
        "review_decision",
        "revision_created"
      ]);
      expect(await store.listEvents(localBusiness, payload.caseId)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "review_decision",
            artifactId: originalDraft.draftId,
            text: expect.stringContaining("Änderung nötig")
          }),
          expect.objectContaining({
            kind: "revision_created",
            artifactId: revision.draftId,
            revisionRef: expect.objectContaining({
              artifactType: "ProductionDraft",
              artifactId: revision.draftId,
              revision: 2,
              supersedesArtifactId: originalDraft.draftId
            })
          })
        ])
      );
      expect(await store.listPlans(localBusiness)).toHaveLength(0);
      expect(await store.listPurchaseLists(localBusiness)).toHaveLength(0);
      expect(auditJson).toContain("production.production_draft_revision_created");
      expect(auditJson).not.toContain(changeRequest);
      expect(auditJson).not.toContain("promptContext");
    } finally {
      await app.close();
    }
  });

  it("recovers one persisted revision after a lost response without recalling the provider", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const auditLog = new AuditLogStore({ rootDir: dataRoot });
    const run = vi.fn(async (request: LlmReadinessProviderAdapterRequest) => {
      const response = extractionResponse(request);
      if (run.mock.calls.length === 1) return response;

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
        providerRequestId: "req-production-draft-revision-recovery",
        outputCandidate: {
          ...response.outputCandidate,
          outputId: "output-production-draft-revision-recovery",
          text: JSON.stringify(extraction)
        }
      };
    });
    const app = buildProductionApp({
      dataRoot,
      store,
      auditLog,
      llmAdapter: {
        adapterId: "mock-byo-production-draft-recovery-adapter",
        adapterMode: "synthetic_live",
        run
      },
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });

    try {
      const payload = await documentPayload(app);
      const created = await app.inject({
        method: "POST",
        url: "/v1/production/drafts/from-document",
        headers: trustedProductionHeaders,
        payload
      });
      const originalDraft = created.json<{ draft: ProductionDraft }>().draft;
      const reviewed = await app.inject({
        method: "PATCH",
        url: `/v1/production/drafts/${originalDraft.draftId}/review-cards/card-menu-component-4`,
        headers: trustedProductionHeaders,
        payload: {
          decision: "change_requested",
          operatorComment: "Je Törtchen nur zwei frische Brombeeren anlegen."
        }
      });
      expect(reviewed.statusCode, reviewed.body).toBe(200);
      const completed = await completeProductionCase(store, payload.caseId);
      const appendEventForArtifactCase = store.appendEventForArtifactCase.bind(store);
      let failRevisionEventOnce = true;
      vi.spyOn(store, "appendEventForArtifactCase").mockImplementation(
        async (context, artifactId, input, eventIdentity) => {
          if (input.kind === "revision_created" && failRevisionEventOnce) {
            failRevisionEventOnce = false;
            throw new Error("simulated response loss after revision persistence");
          }
          return appendEventForArtifactCase(context, artifactId, input, eventIdentity);
        }
      );
      const request = () => app.inject({
        method: "POST" as const,
        url: `/v1/production/drafts/${originalDraft.draftId}/revise`,
        headers: trustedProductionHeaders,
        payload: {}
      });

      const first = await request();
      const persistedAfterLoss = (await store.listProductionDrafts(localBusiness))
        .find((draft) => draft.supersedesDraftId === originalDraft.draftId);
      const caseAfterLoss = await store.getCase(localBusiness, payload.caseId);
      const retry = await request();
      const recoveredDraft = retry.json<{ draft: ProductionDraft }>().draft;
      const caseAfterRetry = await store.getCase(localBusiness, payload.caseId);
      const secondRetry = await request();
      const caseAfterSecondRetry = await store.getCase(localBusiness, payload.caseId);
      const revisionEvents = (await store.listEvents(localBusiness, payload.caseId))
        .filter((event) => event.kind === "revision_created");
      const revisionAudits = (await auditLog.listRecentFor(localBusiness, 20))
        .filter((entry) => entry.action === "production.production_draft_revision_created");

      expect(first.statusCode).toBe(500);
      expect(persistedAfterLoss).toBeDefined();
      expect(caseAfterLoss).toMatchObject({
        status: "completed",
        approvedProductionSpecId: completed.approvedProductionSpecId,
        currentPlanId: completed.currentPlanId,
        currentPurchaseListId: completed.currentPurchaseListId
      });
      expect(retry.statusCode, retry.body).toBe(201);
      expect(secondRetry.statusCode, secondRetry.body).toBe(201);
      expect(recoveredDraft).toEqual(persistedAfterLoss);
      expect(secondRetry.json<{ draft: ProductionDraft }>().draft).toEqual(persistedAfterLoss);
      expect(await store.listProductionDrafts(localBusiness)).toHaveLength(2);
      expect(run).toHaveBeenCalledTimes(2);
      expect(revisionEvents).toEqual([
        expect.objectContaining({ artifactId: persistedAfterLoss!.draftId })
      ]);
      expect(revisionAudits).toHaveLength(1);
      expect(persistedAfterLoss?.source.processingPolicy).toMatchObject({
        approvalId: "approval-local-production-document-test-v1",
        businessId: "local",
        providerKind: "openai",
        providerModel: externalProviderDescriptor.providerModel,
        capability: externalProviderDescriptor.capability,
        actualRegion: externalProviderDescriptor.actualRegion,
        maximumEstimatedCostEur: externalProviderDescriptor.maximumEstimatedCostEur,
        purpose: "production_draft_revision",
        dataClass: "personal_confidential",
        inputHash: expect.stringMatching(/^sha256:/),
        sourceHash: expect.stringMatching(/^sha256:/),
        projectionHash: expect.stringMatching(/^sha256:/),
        outputHash: expect.stringMatching(/^sha256:/)
      });
      expect(revisionAudits[0]?.details).toMatchObject({
        policyApprovalId: "approval-local-production-document-test-v1",
        policyBusinessId: "local",
        policyProviderKind: "openai",
        policyProviderModel: externalProviderDescriptor.providerModel,
        policyCapability: externalProviderDescriptor.capability,
        policyRegion: externalProviderDescriptor.actualRegion,
        policyMaximumEstimatedCostEur: externalProviderDescriptor.maximumEstimatedCostEur,
        policyPurpose: "production_draft_revision",
        policyDataClass: "personal_confidential",
        policyInputHash: expect.stringMatching(/^sha256:/),
        policySourceHash: expect.stringMatching(/^sha256:/),
        policyProjectionHash: expect.stringMatching(/^sha256:/),
        policyOutputHash: expect.stringMatching(/^sha256:/)
      });
      expect(JSON.stringify(revisionAudits)).not.toContain("promptContext");
      expect(JSON.stringify(revisionAudits)).not.toContain("providerResponse");
      expect(caseAfterRetry).toMatchObject({
        status: "open",
        version: caseAfterLoss!.version + 1
      });
      expect(caseAfterRetry?.approvedProductionSpecId).toBeUndefined();
      expect(caseAfterRetry?.currentPlanId).toBeUndefined();
      expect(caseAfterRetry?.currentPurchaseListId).toBeUndefined();
      expect(caseAfterSecondRetry).toEqual(caseAfterRetry);
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
      const payload = await documentPayload(app);
      const created = await app.inject({
        method: "POST",
        url: "/v1/production/drafts/from-document",
        headers: trustedProductionHeaders,
        payload
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
      const payload = await documentPayload(app);
      const created = await app.inject({
        method: "POST",
        url: "/v1/production/drafts/from-document",
        headers: trustedProductionHeaders,
        payload
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
      const payload = await documentPayload(app);
      const created = await app.inject({
        method: "POST",
        url: "/v1/production/drafts/from-document",
        headers: trustedProductionHeaders,
        payload
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
      const retry = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${originalDraft.draftId}/revise`,
        headers: trustedProductionHeaders,
        payload: {}
      });
      const storedDrafts = await store.listProductionDrafts(localBusiness);
      const audits = await auditLog.listRecentFor({ businessId: "local" }, 20);
      const auditJson = JSON.stringify(audits);

      expect(revised.statusCode, revised.body).toBe(422);
      expect(retry.statusCode, retry.body).toBe(422);
      expect(requests).toHaveLength(3);
      expect(storedDrafts).toHaveLength(1);
      expect(storedDrafts[0]).toMatchObject({
        draftId: originalDraft.draftId,
        status: "pending_review"
      });
      expect(auditJson).toContain("production.production_draft_revision_rejected");
      expect(auditJson).not.toContain(changeRequest);
      expect(auditJson).not.toContain("promptContext");
      expect(audits.filter((entry) => entry.action === "production.production_draft_revision_rejected"))
        .toHaveLength(1);
      expect((await store.listEvents(localBusiness, payload.caseId)).map((message) => message.kind))
        .toEqual(["case_created", "source_added", "draft_created", "review_decision", "error"]);
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
        payload: await documentPayload(app)
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

  it("uses the server-approved pseudonymized mode for a stable document reference", async () => {
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
        payload: await documentPayload(app, documentText, "pseudonymized")
      });
      const audits = await auditLog.listRecentFor({ businessId: "local" }, 10);
      const auditJson = JSON.stringify(audits);
      const createdAudit = audits.find((entry) =>
        entry.action === "production.production_draft_document_created"
      );

      expect(response.statusCode, response.body).toBe(201);
      expect(requests).toHaveLength(1);
      expect(requests[0].input.policy.dataMode).toBe("pseudonymized_approved");
      expect(createdAudit?.details).toMatchObject({
        policyProviderKind: "openai",
        policyPurpose: "production_draft_extraction",
        policyDataClass: "pseudonymized"
      });
      expect(auditJson).not.toContain('"dataMode"');
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
        payload: await documentPayload(app, sourceText)
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
      const payload = await documentPayload(app);
      const response = await app.inject({
        method: "POST",
        url: "/v1/production/drafts/from-document",
        headers: trustedProductionHeaders,
        payload
      });

      expect(response.statusCode).toBe(422);
      expect(response.body).toContain("ProductionDraft-Extraktion ist nicht schema-valide.");
      expect(await store.listProductionDrafts(localBusiness)).toHaveLength(0);
      expect((await store.listEvents(localBusiness, payload.caseId)).map((event) => event.kind)).toEqual([
        "case_created",
        "source_added",
        "error"
      ]);
    } finally {
      await app.close();
    }
  });

  it("reports a missing active AI connection without falling back to parser product writes", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const auditLog = new AuditLogStore({ rootDir: dataRoot });
    const adapter: LlmReadinessProviderAdapter = {
      adapterId: "mock-unavailable-production-draft-adapter",
      adapterMode: "synthetic_live",
      run: async (request) => ({
        ok: false,
        errors: ["no synthetic fixture matches input"],
        adapterId: "mock-unavailable-production-draft-adapter",
        adapterMode: "synthetic_live",
        promptSchemaId: request.promptSchemaId
      })
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
      const payload = await documentPayload(app, "Buffet mit Vitello Tonnato für 45 Personen");
      const response = await app.inject({
        method: "POST",
        url: "/v1/production/drafts/from-document",
        headers: trustedProductionHeaders,
        payload
      });
      const retry = await app.inject({
        method: "POST",
        url: "/v1/production/drafts/from-document",
        headers: trustedProductionHeaders,
        payload
      });

      expect(response.statusCode).toBe(422);
      expect(retry.statusCode).toBe(422);
      expect(response.body).toContain("Keine aktive KI-Verbindung für dieses Dokument");
      expect(await store.listProductionDrafts(localBusiness)).toHaveLength(0);
      expect(await store.listPlans(localBusiness)).toHaveLength(0);
      expect(await store.listPurchaseLists(localBusiness)).toHaveLength(0);
      expect((await store.listEvents(localBusiness, payload.caseId)).map((event) => event.kind)).toEqual([
        "case_created",
        "source_added",
        "error"
      ]);
      expect((await auditLog.listRecentFor(localBusiness, 20))
        .filter((entry) => entry.action === "production.production_draft_document_rejected"))
        .toHaveLength(1);
    } finally {
      await app.close();
    }
  });
});
