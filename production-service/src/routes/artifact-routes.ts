import type { FastifyInstance, FastifyRequest } from "fastify";
import { createHash, randomUUID } from "node:crypto";
import {
  createLlmReadinessAgentAuditRecord,
  createEventRequestFromManualForm,
  createUploadSourceMetadata,
  findLlmReadinessPromptSchemaEntryByInputKind,
  ingestDocument,
  llmReadinessForbiddenPayloadKeys,
  llmReadinessContractVersion,
  multipartLimitsForUpload,
  normalizeEventRequestToSpec,
  readLimitedUploadBuffer,
  uploadErrorResponse,
  validateAcceptedEventSpec,
  validateUploadedDocument,
  validateUploadedDocumentMetadata,
  validateLlmReadinessModelOutputCandidate,
  validateProductionDraft,
  validateProductionPlan,
  validatePurchaseList,
  validateRecipe,
  type AcceptedEventSpec,
  type AuditLogStore,
  type LlmReadinessModelInput,
  type LlmReadinessModelOutputCandidate,
  type LlmReadinessProviderAdapter,
  type LlmReadinessProviderAdapterRequest,
  type LlmReadinessProviderAdapterResponse,
  type ProductionDraft,
  type ProductionDraftReviewCard,
  type ProductionDraftReviewDecision,
  type ProductionPlan,
  type PurchaseList,
  type Recipe,
  type TrustedActor
} from "@catering/shared-core";
import type { IntakeStore } from "@catering/intake-service";
import type { RecipeDiscoveryService } from "../recipe-discovery/service.js";
import type {
  ClarificationDraft,
  ClarificationDraftQuestion,
  ProductionFeedbackDraft,
  ProductionStore
} from "../repositories/production-store.js";
import { buildProductionArtifacts } from "../rules/planning.js";

const operatorProductionDraftReviewDecisions = [
  "fits",
  "change_requested",
  "unclear",
  "blocked"
] as const satisfies readonly Exclude<ProductionDraftReviewDecision, "pending">[];

function sourceLineageRequestIds(eventSpec: AcceptedEventSpec): string[] {
  const ids = new Set<string>();

  for (const source of eventSpec.sourceLineage) {
    const reference = source.reference.trim();
    if (reference) {
      ids.add(reference);
    }
  }

  return [...ids];
}

function hasUnsafeDocumentIngestion(
  rawInputs: Array<{ documentIngestion?: { status?: string; warnings?: string[] } }>
): boolean {
  return rawInputs.some((rawInput) => {
    const status = rawInput.documentIngestion?.status?.trim();
    const warnings = Array.isArray(rawInput.documentIngestion?.warnings)
      ? rawInput.documentIngestion.warnings.map((warning) => warning.trim()).filter(Boolean)
      : [];

    return status === "fallback" || status === "failed" || warnings.length > 0;
  });
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function productionDraftImportValidationMessage(errorMessage: string): string {
  if (errorMessage.includes("review coverage missing")) {
    return "ProductionDraft deckt nicht alle übernehmbaren Artefakte mit Review-Karten ab.";
  }

  return "ProductionDraft ist nicht schema-valide.";
}

async function assertNoDifferentExistingArtifact<T>(
  existing: T | undefined,
  next: T,
  label: string,
  id: string
): Promise<string | undefined> {
  if (!existing || stableJson(existing) === stableJson(next)) {
    return undefined;
  }

  return `${label} ${id} existiert bereits mit abweichendem Inhalt.`;
}

function validateDraftApplyArtifacts(draft: ProductionDraft): {
  eventSpec?: AcceptedEventSpec;
  productionPlan?: ProductionPlan;
  purchaseList?: PurchaseList;
  recipes: Recipe[];
  errors: string[];
} {
  const errors: string[] = [];
  let eventSpec: AcceptedEventSpec | undefined;
  let productionPlan: ProductionPlan | undefined;
  let purchaseList: PurchaseList | undefined;
  const recipes: Recipe[] = [];

  try {
    eventSpec = draft.draftArtifacts.eventSpec
      ? validateAcceptedEventSpec(draft.draftArtifacts.eventSpec)
      : undefined;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "eventSpec ist nicht schema-valide.");
  }

  try {
    productionPlan = draft.draftArtifacts.productionPlan
      ? validateProductionPlan(draft.draftArtifacts.productionPlan)
      : undefined;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "productionPlan ist nicht schema-valide.");
  }

  try {
    purchaseList = draft.draftArtifacts.purchaseList
      ? validatePurchaseList(draft.draftArtifacts.purchaseList)
      : undefined;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "purchaseList ist nicht schema-valide.");
  }

  for (const recipe of draft.draftArtifacts.recipes ?? []) {
    try {
      recipes.push(validateRecipe({
        ...recipe,
        source: {
          ...recipe.source,
          approvalState: "review_required"
        }
      }));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `recipe ${recipe.recipeId} ist nicht schema-valide.`);
    }
  }

  const eventSpecId = eventSpec?.specId;
  const planSpecId = productionPlan?.eventSpecId;
  const purchaseSpecId = purchaseList?.eventSpecId;
  if (eventSpecId && planSpecId && eventSpecId !== planSpecId) {
    errors.push("productionPlan.eventSpecId passt nicht zum eventSpec.specId.");
  }
  if (eventSpecId && purchaseSpecId && eventSpecId !== purchaseSpecId) {
    errors.push("purchaseList.eventSpecId passt nicht zum eventSpec.specId.");
  }
  if (planSpecId && purchaseSpecId && planSpecId !== purchaseSpecId) {
    errors.push("productionPlan.eventSpecId passt nicht zur purchaseList.eventSpecId.");
  }
  if (!eventSpec && !productionPlan && !purchaseList && recipes.length === 0) {
    errors.push("ProductionDraft enthält keine übernehmbaren Produktartefakte.");
  }

  return {
    eventSpec,
    productionPlan,
    purchaseList,
    recipes,
    errors
  };
}

async function hasUnsafeLinkedIntakeSource(
  eventSpec: AcceptedEventSpec,
  intakeStore: IntakeStore
): Promise<boolean> {
  for (const requestId of sourceLineageRequestIds(eventSpec)) {
    const intakeRequest = await intakeStore.getRequest(requestId);
    if (intakeRequest && hasUnsafeDocumentIngestion(intakeRequest.rawInputs)) {
      return true;
    }
  }

  return false;
}

interface RecipeCandidateRepository {
  get(recipeId: string): Promise<Recipe | undefined>;
  save(recipe: Recipe): Promise<void>;
}

interface ProductionDraftDocumentBody {
  filename?: unknown;
  mimeType?: unknown;
  contentBase64?: unknown;
}

interface ProductionDraftDocumentInput {
  filename: string;
  mimeType: string;
  content: Buffer;
}

interface ProductionDraftExtractionComponent {
  label: string;
  course?: string;
  category?: "classic" | "vegetarian" | "vegan";
  note?: string;
}

interface ProductionDraftExtractionQuestion {
  field: string;
  message: string;
  suggestedQuestion?: string;
}

interface ProductionDraftExtraction {
  eventType?: string;
  serviceForm?: string;
  eventDate?: string;
  attendeeCount?: number;
  customerName?: string;
  venueName?: string;
  components: ProductionDraftExtractionComponent[];
  openQuestions: ProductionDraftExtractionQuestion[];
}

export interface ProductionArtifactRouteDependencies {
  store: ProductionStore;
  intakeStore: IntakeStore;
  repository: RecipeCandidateRepository;
  discoveryService: RecipeDiscoveryService;
  auditLog: AuditLogStore;
  buildLlmAdapter: () => LlmReadinessProviderAdapter;
  trustedActorSecret?: string;
  allowDevActorHeader: boolean;
  isProductionOperator: (
    request: { headers: Record<string, string | string[] | undefined> },
    trustedActorSecret?: string,
    allowDevActorHeader?: boolean
  ) => boolean;
  requireProductionOperator: (
    request: { headers: Record<string, string | string[] | undefined> },
    reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } },
    trustedActorSecret?: string,
    allowDevActorHeader?: boolean
  ) => unknown | undefined;
  actorForRequest: (
    request: { headers: Record<string, string | string[] | undefined> },
    trustedActorSecret?: string,
    allowDevActorHeader?: boolean
  ) => TrustedActor;
}

function normalizeOptionalText(value: unknown, maxLength = 240): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > 0 ? trimmed.slice(0, maxLength) : undefined;
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }

  return Math.trunc(value);
}

function normalizeMenuCategory(value: unknown): ProductionDraftExtractionComponent["category"] | undefined {
  return value === "classic" || value === "vegetarian" || value === "vegan" ? value : undefined;
}

function slugifyForDraft(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "item";
}

function parseProductionDraftExtraction(outputCandidate?: LlmReadinessModelOutputCandidate): {
  extraction?: ProductionDraftExtraction;
  errors: string[];
} {
  const errors = validateLlmReadinessModelOutputCandidate(outputCandidate).errors.map((error) =>
    `outputCandidate.${error}`
  );
  if (!outputCandidate) {
    return { errors };
  }
  if (outputCandidate.kind !== "production_draft_extraction") {
    errors.push("outputCandidate.kind must be production_draft_extraction");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(outputCandidate.text);
  } catch {
    errors.push("outputCandidate.text must be valid production draft extraction JSON");
  }

  if (!isPlainRecord(parsed)) {
    errors.push("outputCandidate.text must contain a JSON object");
    return { errors: [...new Set(errors)] };
  }

  const rawComponents = Array.isArray(parsed.components) ? parsed.components : [];
  const components = rawComponents.flatMap((component, index): ProductionDraftExtractionComponent[] => {
    if (!isPlainRecord(component)) {
      errors.push(`components[${index}] must be an object`);
      return [];
    }
    const label = normalizeOptionalText(component.label, 320);
    if (!label) {
      errors.push(`components[${index}].label must be non-empty`);
      return [];
    }

    return [{
      label,
      course: normalizeOptionalText(component.course, 80),
      category: normalizeMenuCategory(component.category),
      note: normalizeOptionalText(component.note, 500)
    }];
  });

  const rawQuestions = Array.isArray(parsed.openQuestions) ? parsed.openQuestions : [];
  const openQuestions = rawQuestions.flatMap((question, index): ProductionDraftExtractionQuestion[] => {
    if (!isPlainRecord(question)) {
      errors.push(`openQuestions[${index}] must be an object`);
      return [];
    }
    const field = normalizeOptionalText(question.field, 120);
    const message = normalizeOptionalText(question.message, 500);
    if (!field || !message) {
      errors.push(`openQuestions[${index}] needs field and message`);
      return [];
    }

    return [{
      field,
      message,
      suggestedQuestion: normalizeOptionalText(question.suggestedQuestion, 500)
    }];
  });

  if (components.length === 0 && openQuestions.length === 0) {
    errors.push("production draft extraction must contain components or openQuestions");
  }

  if (errors.length > 0) {
    return { errors: [...new Set(errors)] };
  }

  return {
    extraction: {
      eventType: normalizeOptionalText(parsed.eventType, 120),
      serviceForm: normalizeOptionalText(parsed.serviceForm, 120),
      eventDate: normalizeOptionalText(parsed.eventDate, 40),
      attendeeCount: normalizeOptionalNumber(parsed.attendeeCount),
      customerName: normalizeOptionalText(parsed.customerName, 240),
      venueName: normalizeOptionalText(parsed.venueName, 240),
      components,
      openQuestions
    },
    errors: []
  };
}

async function productionDraftDocumentFromRequest(
  request: FastifyRequest
): Promise<ProductionDraftDocumentInput> {
  const multipartRequest = request as FastifyRequest & {
    isMultipart: () => boolean;
    file: (options?: { limits?: { fileSize?: number; files?: number; fields?: number; parts?: number } }) => Promise<
      | {
          filename: string;
          mimetype: string;
          file: AsyncIterable<Buffer | Uint8Array>;
          toBuffer: () => Promise<Buffer>;
        }
      | undefined
    >;
  };

  if (multipartRequest.isMultipart?.()) {
    const file = await multipartRequest.file({ limits: multipartLimitsForUpload("intake") });
    if (!file) {
      throw new Error("No production source file provided.");
    }
    validateUploadedDocumentMetadata({ filename: file.filename, mimeType: file.mimetype });
    const content = await readLimitedUploadBuffer(file.file, "intake");
    const document = { filename: file.filename, mimeType: file.mimetype, content };
    validateUploadedDocument(document, "intake");
    return document;
  }

  const body = request.body as ProductionDraftDocumentBody | undefined;
  const filename = normalizeOptionalText(body?.filename, 240);
  const mimeType = normalizeOptionalText(body?.mimeType, 120);
  if (!filename || !mimeType || typeof body?.contentBase64 !== "string") {
    throw new Error("filename, mimeType und contentBase64 sind erforderlich.");
  }
  const content = Buffer.from(body.contentBase64, "base64");
  const document = { filename, mimeType, content };
  validateUploadedDocument(document, "intake");
  return document;
}

function buildProductionDraftFromExtraction(input: {
  extraction: ProductionDraftExtraction;
  source: {
    filename: string;
    sha256: string;
    ingestedAt: string;
  };
  outputCandidate: LlmReadinessModelOutputCandidate;
  adapterResponse: LlmReadinessProviderAdapterResponse;
}): ProductionDraft {
  const requestId = `production-draft-source-${input.source.sha256.slice(0, 16)}`;
  const eventRequest = createEventRequestFromManualForm({
    requestId,
    eventType: input.extraction.eventType ?? "Buffet",
    eventDate: input.extraction.eventDate,
    attendeeCount: input.extraction.attendeeCount,
    serviceForm: input.extraction.serviceForm ?? "Buffet",
    menuItems: input.extraction.components.map((component) => component.label),
    customerName: input.extraction.customerName,
    venueName: input.extraction.venueName,
    notes: "KI-Extraktion aus operatorfreigegebenem Angebotsdokument; fachliche Prüfung erforderlich."
  });
  const eventSpec = normalizeEventRequestToSpec(eventRequest, {
    sourceType: "pdf",
    reference: `sha256:${input.source.sha256}`,
    commercialState: "provisional"
  });
  const menuPlan = input.extraction.components.map((component, index) => ({
    ...eventSpec.menuPlan[index],
    componentId: `${slugifyForDraft(component.label)}-${index + 1}`,
    label: component.label,
    course: component.course ?? eventSpec.menuPlan[index]?.course,
    menuCategory: component.category ?? eventSpec.menuPlan[index]?.menuCategory,
    serviceStyle: input.extraction.serviceForm ?? eventSpec.servicePlan.serviceForm,
    servings: input.extraction.attendeeCount ?? eventSpec.attendees.expected,
    ...(component.note
      ? {
          productionDecision: {
            notes: component.note
          }
        }
      : {})
  }));
  const openQuestions = input.extraction.openQuestions.map((question) => ({
    field: question.field,
    message: question.message,
    severity: "medium" as const,
    suggestedQuestion: question.suggestedQuestion
  }));
  const draftEventSpec = validateAcceptedEventSpec({
    ...eventSpec,
    menuPlan,
    uncertainties: openQuestions.length > 0
      ? [...(eventSpec.uncertainties ?? []), ...openQuestions]
      : eventSpec.uncertainties
  });
  const reviewCards: ProductionDraftReviewCard[] = [
    {
      cardId: "card-event-data",
      kind: "event_data",
      title: "Eventdaten aus PDF prüfen",
      summary: `${input.extraction.eventType ?? "Event"} · ${input.extraction.attendeeCount ?? "Personenzahl offen"} Personen · ${input.extraction.eventDate ?? "Datum offen"}`,
      decision: "pending",
      targetPath: "$.draftArtifacts.eventSpec",
      targetId: draftEventSpec.specId,
      requiredApproval: true
    },
    ...draftEventSpec.menuPlan.map((component, index): ProductionDraftReviewCard => ({
      cardId: `card-menu-component-${index + 1}`,
      kind: "menu_component",
      title: component.label,
      summary: "Menükomponente aus PDF-Extraktion prüfen; keine automatische Rezeptzuordnung.",
      decision: "pending",
      targetPath: `$.draftArtifacts.eventSpec.menuPlan[${index}]`,
      targetId: component.componentId,
      requiredApproval: true
    })),
    ...openQuestions.map((question, index): ProductionDraftReviewCard => ({
      cardId: `card-open-question-${index + 1}`,
      kind: "open_question",
      title: question.field,
      summary: question.suggestedQuestion ?? question.message,
      decision: "pending",
      riskLevel: "medium",
      requiredApproval: true
    }))
  ];

  return validateProductionDraft({
    schemaVersion: draftEventSpec.schemaVersion,
    draftId: `production-draft-${randomUUID()}`,
    status: "pending_review",
    createdAt: new Date().toISOString(),
    source: {
      kind: input.adapterResponse.providerId === "codex-cli"
        ? "agent_cli"
        : input.adapterResponse.adapterMode === "fixture_only"
          ? "fixture"
          : "ai_provider",
      receivedAt: input.source.ingestedAt,
      sourceRef: `upload:${input.source.filename}`,
      providerId: input.adapterResponse.providerId ?? input.adapterResponse.adapterId,
      modelId: input.adapterResponse.adapterMode,
      inputHash: `sha256:${input.source.sha256}`,
      outputHash: hashText(input.outputCandidate.text),
      runId: input.adapterResponse.providerRequestId
    },
    guardrails: {
      draftOnly: true,
      humanApprovalRequired: true,
      writesProductObjects: false,
      rawProviderPayloadStored: false,
      knowledgeWritePolicy: "reviewed_only"
    },
    reviewCards,
    draftArtifacts: {
      eventSpec: draftEventSpec,
      openQuestions
    }
  });
}

export function registerProductionArtifactRoutes(
  app: FastifyInstance,
  deps: ProductionArtifactRouteDependencies
) {
  const {
    store,
    intakeStore,
    repository,
    discoveryService,
    auditLog,
    buildLlmAdapter,
    trustedActorSecret,
    allowDevActorHeader,
    isProductionOperator,
    requireProductionOperator,
    actorForRequest
  } = deps;

  app.post<{ Body: { eventSpec: AcceptedEventSpec; sourceReviewConfirmed?: boolean } }>(
    "/v1/production/plans",
    async (request, reply) => {
      if (!isProductionOperator(request, trustedActorSecret, allowDevActorHeader)) {
        return reply.code(403).send({
          message: "Produktions-Operator erforderlich."
        });
      }

      const eventSpec = validateAcceptedEventSpec(request.body.eventSpec);
      const sourceReviewRequired = await hasUnsafeLinkedIntakeSource(eventSpec, intakeStore);
      if (sourceReviewRequired && request.body.sourceReviewConfirmed !== true) {
        return reply.code(422).send({
          message: "Quellenprüfung erforderlich, bevor Produktionsartefakte berechnet werden."
        });
      }
      const artifacts = await buildProductionArtifacts(eventSpec, discoveryService);
      await store.savePlan(artifacts.productionPlan);
      await store.savePurchaseList(artifacts.purchaseList);
      await auditLog.log({
        action: "production.plan_created",
        entityType: "ProductionPlan",
        entityId: artifacts.productionPlan.planId,
        actor: actorForRequest(request, trustedActorSecret, allowDevActorHeader),
        summary: "Produktionsplan erstellt.",
        details: {
          specId: eventSpec.specId,
          purchaseListId: artifacts.purchaseList.purchaseListId,
          readiness: artifacts.productionPlan.readiness.status,
          recipeSelections: artifacts.productionPlan.recipeSelections.length,
          sourceReviewConfirmed: sourceReviewRequired ? true : undefined
        }
      });
      return reply.code(201).send(artifacts);
    }
  );

  app.get("/v1/production/plans", async (request, reply) => {
    const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
    if (forbidden) {
      return forbidden;
    }

    return reply.send({
      items: await store.listPlans()
    });
  });

  app.get<{ Params: { planId: string } }>("/v1/production/plans/:planId", async (request, reply) => {
    const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
    if (forbidden) {
      return forbidden;
    }

    const plan = await store.getPlan(request.params.planId);
    if (!plan) {
      return reply.code(404).send({ message: "ProductionPlan nicht gefunden." });
    }

    return reply.send(plan);
  });

  app.get<{ Params: { purchaseListId: string } }>(
    "/v1/production/purchase-lists/:purchaseListId",
    async (request, reply) => {
      const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
      if (forbidden) {
        return forbidden;
      }

      const list = await store.getPurchaseList(request.params.purchaseListId);
      if (!list) {
        return reply.code(404).send({ message: "PurchaseList nicht gefunden." });
      }

      return reply.send(list);
    }
  );

  app.get("/v1/production/purchase-lists", async (request, reply) => {
    const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
    if (forbidden) {
      return forbidden;
    }

    return reply.send({
      items: await store.listPurchaseLists()
    });
  });

  app.post<{ Body: ProductionDraftDocumentBody }>(
    "/v1/production/drafts/from-document",
    async (request, reply) => {
      const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
      if (forbidden) {
        return forbidden;
      }

      let document: ProductionDraftDocumentInput;
      try {
        document = await productionDraftDocumentFromRequest(request);
      } catch (error) {
        const uploadError = uploadErrorResponse(error, "intake");
        return reply.code(uploadError.statusCode).send({ message: uploadError.message });
      }

      const sourceMetadata = createUploadSourceMetadata({
        filename: document.filename,
        mimeType: document.mimeType,
        content: document.content,
        uploadContext: "production"
      });
      const ingestion = await ingestDocument({
        document: {
          ...document,
          sourceMetadata
        },
        context: "production"
      });

      if (ingestion.status !== "extracted" || !ingestion.extractedText?.trim()) {
        return reply.code(422).send({
          message: "Angebotsdokument konnte nicht sicher als Text gelesen werden.",
          errors: ingestion.warnings
        });
      }

      const promptSchema = findLlmReadinessPromptSchemaEntryByInputKind("production_draft_request");
      if (!promptSchema) {
        return reply.code(500).send({ message: "Prompt-Schema für ProductionDraft-Extraktion nicht registriert." });
      }

      const input: LlmReadinessModelInput = {
        contractVersion: llmReadinessContractVersion,
        inputId: `input-production-draft-${sourceMetadata.sha256.slice(0, 16)}`,
        kind: "production_draft_request",
        sourceRefs: [
          {
            objectType: "safe_source_anchor",
            objectId: `sha256:${sourceMetadata.sha256}`,
            label: sourceMetadata.filename
          }
        ],
        policy: {
          providerCalls: "disabled",
          dataMode: "synthetic_or_demo_only",
          allowedToolEffects: ["read", "draft"]
        }
      };
      const adapterRequest: LlmReadinessProviderAdapterRequest = {
        input,
        promptSchemaId: promptSchema.promptSchemaId,
        promptContext: ingestion.extractedText
      };
      const draftSeed = `draft-${sourceMetadata.sha256.slice(0, 16)}-${randomUUID()}`;

      let adapter: LlmReadinessProviderAdapter;
      try {
        adapter = buildLlmAdapter();
      } catch (error) {
        return reply.code(500).send({
          message: error instanceof Error ? error.message : "BYO-LLM-Adapter konnte nicht gestartet werden."
        });
      }

      const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
      const adapterResponse = await adapter.run(adapterRequest).catch(async (error: unknown) => {
        await auditLog.log({
          action: "production.production_draft_document_rejected",
          entityType: "ProductionDraft",
          entityId: draftSeed,
          actor,
          summary: "ProductionDraft-Extraktion aus Dokument verworfen.",
          details: compactAuditDetails({
            inputId: input.inputId,
            adapterId: adapter.adapterId,
            adapterMode: adapter.adapterMode,
            promptSchemaId: promptSchema.promptSchemaId,
            sourceSha256: sourceMetadata.sha256,
            errorCount: 1,
            errorType: error instanceof Error ? error.name : typeof error
          })
        });
        return undefined;
      });
      if (!adapterResponse) {
        return reply.code(422).send({
          message: "ProductionDraft-Extraktion konnte nicht erzeugt werden.",
          errors: ["BYO-LLM-Aufruf ist fehlgeschlagen."]
        });
      }

      const auditBuild = createLlmReadinessAgentAuditRecord({
        auditId: `agent-audit-${draftSeed}`,
        request: adapterRequest,
        response: adapterResponse
      });
      const extractionBuild = parseProductionDraftExtraction(adapterResponse.outputCandidate);
      const responseErrors = [
        ...(adapterResponse.ok ? [] : adapterResponse.errors),
        ...extractionBuild.errors,
        ...auditBuild.errors.map((error) => `agentAudit.${error}`)
      ];

      if (!adapterResponse.ok || responseErrors.length > 0 || !extractionBuild.extraction || !auditBuild.auditRecord) {
        await auditLog.log({
          action: "production.production_draft_document_rejected",
          entityType: "ProductionDraft",
          entityId: draftSeed,
          actor,
          summary: "ProductionDraft-Extraktion aus Dokument verworfen.",
          details: compactAuditDetails({
            inputId: input.inputId,
            adapterId: adapterResponse.adapterId,
            adapterMode: adapterResponse.adapterMode,
            promptSchemaId: adapterResponse.promptSchemaId ?? promptSchema.promptSchemaId,
            providerId: adapterResponse.providerId,
            providerRequestId: adapterResponse.providerRequestId,
            sourceSha256: sourceMetadata.sha256,
            errorCount: responseErrors.length
          })
        });
        return reply.code(422).send({
          message: "ProductionDraft-Extraktion ist nicht schema-valide.",
          errors: [...new Set(responseErrors)]
        });
      }

      const draft = buildProductionDraftFromExtraction({
        extraction: extractionBuild.extraction,
        source: {
          filename: sourceMetadata.filename,
          sha256: sourceMetadata.sha256,
          ingestedAt: sourceMetadata.ingestedAt
        },
        outputCandidate: adapterResponse.outputCandidate!,
        adapterResponse
      });
      await store.saveProductionDraft(draft);
      await auditLog.log({
        action: "production.production_draft_document_created",
        entityType: "ProductionDraft",
        entityId: draft.draftId,
        actor,
        summary: "ProductionDraft aus Dokumentextraktion angelegt.",
        details: compactAuditDetails({
          draftId: draft.draftId,
          agentAuditId: auditBuild.auditRecord.auditId,
          inputId: input.inputId,
          outputId: adapterResponse.outputCandidate?.outputId,
          sourceSha256: sourceMetadata.sha256,
          adapterId: adapterResponse.adapterId,
          adapterMode: adapterResponse.adapterMode,
          promptSchemaId: adapterResponse.promptSchemaId ?? promptSchema.promptSchemaId,
          providerId: adapterResponse.providerId,
          providerRequestId: adapterResponse.providerRequestId,
          reviewCardCount: draft.reviewCards.length,
          componentCount: draft.draftArtifacts.eventSpec?.menuPlan.length ?? 0,
          openQuestionCount: draft.draftArtifacts.openQuestions?.length ?? 0,
          outputTextHash: adapterResponse.outputCandidate
            ? hashText(adapterResponse.outputCandidate.text)
            : undefined,
          humanApprovalRequired: true,
          writesProductObject: false
        })
      });

      return reply.code(201).send({ draft });
    }
  );

  app.post<{ Body: ProductionDraft }>("/v1/production/drafts", async (request, reply) => {
    const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
    if (forbidden) {
      return forbidden;
    }

    let draft: ProductionDraft;
    try {
      draft = validateProductionDraft(request.body);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unbekannter Validierungsfehler.";
      return reply.code(422).send({
        message: productionDraftImportValidationMessage(errorMessage),
        errors: [errorMessage]
      });
    }

    if (draft.status !== "pending_review") {
      return reply.code(422).send({
        message: "ProductionDraft-Import akzeptiert nur Entwürfe im Status pending_review.",
        errors: ["status must be pending_review for draft-only import"]
      });
    }
    if (await store.getProductionDraft(draft.draftId)) {
      return reply.code(409).send({
        message: "ProductionDraft mit dieser ID existiert bereits."
      });
    }

    await store.saveProductionDraft(draft);
    const artifacts = draft.draftArtifacts;
    await auditLog.log({
      action: "production.production_draft_imported",
      entityType: "ProductionDraft",
      entityId: draft.draftId,
      actor: actorForRequest(request, trustedActorSecret, allowDevActorHeader),
      summary: "ProductionDraft importiert und zur Review vorgemerkt.",
      details: compactAuditDetails({
        draftId: draft.draftId,
        status: draft.status,
        sourceKind: draft.source.kind,
        providerId: draft.source.providerId,
        modelId: draft.source.modelId,
        inputHash: draft.source.inputHash,
        outputHash: draft.source.outputHash,
        reviewCardCount: draft.reviewCards.length,
        hasEventSpec: Boolean(artifacts.eventSpec),
        hasProductionPlan: Boolean(artifacts.productionPlan),
        hasPurchaseList: Boolean(artifacts.purchaseList),
        recipeCount: artifacts.recipes?.length ?? 0,
        openQuestionCount: artifacts.openQuestions?.length ?? 0,
        noteCount: artifacts.notes?.length ?? 0,
        humanApprovalRequired: draft.guardrails.humanApprovalRequired,
        writesProductObject: draft.guardrails.writesProductObjects
      })
    });

    return reply.code(201).send({ draft });
  });

  app.get("/v1/production/drafts", async (request, reply) => {
    const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
    if (forbidden) {
      return forbidden;
    }

    return reply.send({
      items: await store.listProductionDrafts()
    });
  });

  app.patch<{
    Params: { draftId: string; cardId: string };
    Body: { decision?: unknown; operatorComment?: unknown };
  }>(
    "/v1/production/drafts/:draftId/review-cards/:cardId",
    async (request, reply) => {
      const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
      if (forbidden) {
        return forbidden;
      }

      const decision = productionDraftReviewDecisionFromBody(request.body?.decision);
      if (!decision) {
        return reply.code(400).send({
          message: "decision muss fits, change_requested, unclear oder blocked sein."
        });
      }

      const operatorComment = operatorCommentFromBody(request.body?.operatorComment);
      if (operatorComment === false) {
        return reply.code(400).send({
          message: "operatorComment muss Text mit maximal 1000 Zeichen sein."
        });
      }

      const draft = await store.getProductionDraft(request.params.draftId);
      if (!draft) {
        return reply.code(404).send({ message: "ProductionDraft nicht gefunden." });
      }
      if (draft.status !== "pending_review") {
        return reply.code(409).send({ message: "ProductionDraft wurde bereits entschieden." });
      }

      const cardIndex = draft.reviewCards.findIndex((card) => card.cardId === request.params.cardId);
      if (cardIndex < 0) {
        return reply.code(404).send({ message: "Review-Karte nicht gefunden." });
      }

      const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
      const decidedAt = new Date().toISOString();
      const reviewCards = draft.reviewCards.map((card, index) =>
        index === cardIndex
          ? {
            ...card,
            decision,
            decidedBy: actor.name,
            decidedAt,
            ...(operatorComment ? { operatorComment } : {})
          }
          : card
      );
      const reviewedDraft = validateProductionDraft({
        ...draft,
        reviewCards
      });

      await store.saveProductionDraft(reviewedDraft);
      const card = reviewedDraft.reviewCards[cardIndex];
      await auditLog.log({
        action: "production.production_draft_review_card_decided",
        entityType: "ProductionDraft",
        entityId: reviewedDraft.draftId,
        actor,
        summary: "ProductionDraft-Review-Karte entschieden.",
        details: compactAuditDetails({
          draftId: reviewedDraft.draftId,
          cardId: card.cardId,
          cardKind: card.kind,
          decision: card.decision,
          targetId: card.targetId,
          riskLevel: card.riskLevel,
          requiredApproval: card.requiredApproval
        })
      });

      return reply.send({
        draft: reviewedDraft,
        reviewCard: card
      });
    }
  );

  app.post<{ Params: { draftId: string }; Body: { approve?: unknown } }>(
    "/v1/production/drafts/:draftId/decision",
    async (request, reply) => {
      const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
      if (forbidden) {
        return forbidden;
      }

      if (typeof request.body?.approve !== "boolean") {
        return reply.code(400).send({ message: "approve muss true oder false sein." });
      }

      const draft = await store.getProductionDraft(request.params.draftId);
      if (!draft) {
        return reply.code(404).send({ message: "ProductionDraft nicht gefunden." });
      }
      if (draft.status !== "pending_review") {
        return reply.code(409).send({ message: "ProductionDraft wurde bereits entschieden." });
      }

      const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
      const decidedAt = new Date().toISOString();
      let decidedDraft: ProductionDraft;
      if (request.body.approve) {
        const openCards = draft.reviewCards.filter((card) => card.decision !== "fits");
        const blockingCards = draft.reviewCards.filter((card) => card.riskLevel === "blocking");
        if (openCards.length > 0 || blockingCards.length > 0) {
          return reply.code(422).send({
            message: "ProductionDraft kann erst freigegeben werden, wenn alle Review-Karten passen und keine Blocking-Risiken offen sind.",
            errors: [
              ...openCards.map((card) => `reviewCard ${card.cardId} is ${card.decision}`),
              ...blockingCards.map((card) => `reviewCard ${card.cardId} has blocking risk`)
            ]
          });
        }
        decidedDraft = validateProductionDraft({
          ...draft,
          status: "approved",
          approvedBy: actor.name,
          approvedAt: decidedAt
        });
      } else {
        decidedDraft = validateProductionDraft({
          ...draft,
          status: "rejected"
        });
      }

      await store.saveProductionDraft(decidedDraft);
      await auditLog.log({
        action: request.body.approve
          ? "production.production_draft_approved"
          : "production.production_draft_rejected",
        entityType: "ProductionDraft",
        entityId: decidedDraft.draftId,
        actor,
        summary: request.body.approve
          ? "ProductionDraft nach Review freigegeben."
          : "ProductionDraft nach Review verworfen.",
        details: compactAuditDetails({
          draftId: decidedDraft.draftId,
          status: decidedDraft.status,
          reviewCardCount: decidedDraft.reviewCards.length,
          fittingReviewCardCount: decidedDraft.reviewCards.filter((card) => card.decision === "fits").length,
          blockingReviewCardCount: decidedDraft.reviewCards.filter((card) => card.riskLevel === "blocking").length,
          humanApprovalRequired: decidedDraft.guardrails.humanApprovalRequired,
          writesProductObject: decidedDraft.guardrails.writesProductObjects
        })
      });

      return reply.send({ draft: decidedDraft });
    }
  );

  app.post<{ Params: { draftId: string } }>(
    "/v1/production/drafts/:draftId/apply",
    async (request, reply) => {
      const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
      if (forbidden) {
        return forbidden;
      }

      const draft = await store.getProductionDraft(request.params.draftId);
      if (!draft) {
        return reply.code(404).send({ message: "ProductionDraft nicht gefunden." });
      }
      if (draft.status !== "approved") {
        return reply.code(409).send({ message: "ProductionDraft muss vor der Übernahme freigegeben sein." });
      }
      if (draft.appliedAt) {
        return reply.code(409).send({ message: "ProductionDraft wurde bereits übernommen." });
      }

      const artifacts = validateDraftApplyArtifacts(draft);
      if (artifacts.errors.length > 0) {
        return reply.code(422).send({
          message: "ProductionDraft kann nicht übernommen werden.",
          errors: artifacts.errors
        });
      }

      const conflictErrors = [
        artifacts.eventSpec
          ? await assertNoDifferentExistingArtifact(
            await intakeStore.getSpec(artifacts.eventSpec.specId),
            artifacts.eventSpec,
            "AcceptedEventSpec",
            artifacts.eventSpec.specId
          )
          : undefined,
        artifacts.productionPlan
          ? await assertNoDifferentExistingArtifact(
            await store.getPlan(artifacts.productionPlan.planId),
            artifacts.productionPlan,
            "ProductionPlan",
            artifacts.productionPlan.planId
          )
          : undefined,
        artifacts.purchaseList
          ? await assertNoDifferentExistingArtifact(
            await store.getPurchaseList(artifacts.purchaseList.purchaseListId),
            artifacts.purchaseList,
            "PurchaseList",
            artifacts.purchaseList.purchaseListId
          )
          : undefined,
        ...(await Promise.all(artifacts.recipes.map(async (recipe) =>
          assertNoDifferentExistingArtifact(
            await repository.get(recipe.recipeId),
            recipe,
            "Recipe",
            recipe.recipeId
          )
        )))
      ].filter((error): error is string => Boolean(error));

      if (conflictErrors.length > 0) {
        return reply.code(409).send({
          message: "ProductionDraft-Übernahme würde bestehende Produktobjekte überschreiben.",
          errors: conflictErrors
        });
      }

      if (artifacts.eventSpec) {
        await intakeStore.saveSpec(artifacts.eventSpec);
      }
      if (artifacts.productionPlan) {
        await store.savePlan(artifacts.productionPlan);
      }
      if (artifacts.purchaseList) {
        await store.savePurchaseList(artifacts.purchaseList);
      }
      for (const recipe of artifacts.recipes) {
        await repository.save(recipe);
      }

      const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
      const appliedAt = new Date().toISOString();
      const appliedArtifactIds = {
        ...(artifacts.eventSpec ? { specId: artifacts.eventSpec.specId } : {}),
        ...(artifacts.productionPlan ? { planId: artifacts.productionPlan.planId } : {}),
        ...(artifacts.purchaseList ? { purchaseListId: artifacts.purchaseList.purchaseListId } : {}),
        ...(artifacts.recipes.length > 0 ? { recipeIds: artifacts.recipes.map((recipe) => recipe.recipeId) } : {})
      };
      const appliedDraft = validateProductionDraft({
        ...draft,
        appliedBy: actor.name,
        appliedAt,
        appliedArtifactIds
      });
      await store.saveProductionDraft(appliedDraft);
      await auditLog.log({
        action: "production.production_draft_applied",
        entityType: "ProductionDraft",
        entityId: appliedDraft.draftId,
        actor,
        summary: "Freigegebener ProductionDraft in Produktobjekte übernommen.",
        details: compactAuditDetails({
          draftId: appliedDraft.draftId,
          specId: artifacts.eventSpec?.specId,
          planId: artifacts.productionPlan?.planId,
          purchaseListId: artifacts.purchaseList?.purchaseListId,
          hasEventSpec: Boolean(artifacts.eventSpec),
          hasProductionPlan: Boolean(artifacts.productionPlan),
          hasPurchaseList: Boolean(artifacts.purchaseList),
          recipeCandidateCount: artifacts.recipes.length,
          skippedOpenQuestionCount: draft.draftArtifacts.openQuestions?.length ?? 0,
          writesProductObject: true,
          rawProviderPayloadStored: false
        })
      });

      return reply.send({
        draft: appliedDraft,
        applied: appliedDraft.appliedArtifactIds
      });
    }
  );

  app.post<{
    Body: {
      target?: unknown;
      feedback?: unknown;
      summary?: unknown;
      observations?: unknown;
      changeRequests?: unknown;
    };
  }>(
    "/v1/production/feedback-drafts",
    async (request, reply) => {
      const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
      if (forbidden) {
        return forbidden;
      }

      const parsed = productionFeedbackFromBody(request.body);
      if (parsed.errors.length > 0 || !parsed.feedback) {
        return reply.code(422).send({
          message: "Produktionsfeedback-Entwurf ist nicht valide.",
          errors: [...new Set(parsed.errors)]
        });
      }

      const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
      const now = new Date().toISOString();
      const draft: ProductionFeedbackDraft = {
        feedbackId: `production-feedback-${randomUUID()}`,
        status: "pending_review",
        createdAt: now,
        updatedAt: now,
        createdBy: {
          name: actor.name,
          source: actor.source
        },
        ...(parsed.target ? { target: parsed.target } : {}),
        feedback: parsed.feedback,
        guardrails: {
          draftOnly: true,
          humanApprovalRequired: true,
          rawProviderPayloadStored: false,
          knowledgeWritePolicy: "reviewed_only"
        }
      };

      try {
        await store.saveProductionFeedbackDraft(draft);
      } catch (error) {
        return reply.code(422).send({
          message: "Produktionsfeedback-Entwurf ist nicht valide.",
          errors: [error instanceof Error ? error.message : "Unbekannter Validierungsfehler."]
        });
      }

      await auditLog.log({
        action: "production.feedback_draft_created",
        entityType: "ProductionFeedbackDraft",
        entityId: draft.feedbackId,
        actor,
        summary: "Produktionsfeedback als prüfpflichtiger Entwurf angelegt.",
        details: compactAuditDetails({
          feedbackId: draft.feedbackId,
          status: draft.status,
          targetSpecId: draft.target?.specId,
          targetPlanId: draft.target?.planId,
          targetRecipeId: draft.target?.recipeId,
          targetComponentId: draft.target?.componentId,
          feedbackTextHash: hashText(draft.feedback.summary),
          observationCount: draft.feedback.observations.length,
          changeRequestCount: draft.feedback.changeRequests.length,
          humanApprovalRequired: true,
          writesProductObject: false
        })
      });

      return reply.code(201).send({ draft });
    }
  );

  app.post<{ Params: { feedbackId: string }; Body: { approve?: unknown } }>(
    "/v1/production/feedback-drafts/:feedbackId/decision",
    async (request, reply) => {
      const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
      if (forbidden) {
        return forbidden;
      }

      if (typeof request.body?.approve !== "boolean") {
        return reply.code(400).send({ message: "approve muss true oder false sein." });
      }

      const draft = await store.getProductionFeedbackDraft(request.params.feedbackId);
      if (!draft) {
        return reply.code(404).send({ message: "ProductionFeedbackDraft nicht gefunden." });
      }
      if (draft.status !== "pending_review") {
        return reply.code(409).send({ message: "ProductionFeedbackDraft wurde bereits entschieden." });
      }

      const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
      const now = new Date().toISOString();
      const decidedDraft: ProductionFeedbackDraft = request.body.approve
        ? {
          ...draft,
          status: "approved",
          updatedAt: now,
          approvedBy: {
            name: actor.name,
            source: actor.source
          },
          approvedAt: now
        }
        : {
          ...draft,
          status: "rejected",
          updatedAt: now,
          rejectedBy: {
            name: actor.name,
            source: actor.source
          },
          rejectedAt: now
        };

      await store.saveProductionFeedbackDraft(decidedDraft);
      await auditLog.log({
        action: request.body.approve
          ? "production.feedback_draft_approved"
          : "production.feedback_draft_rejected",
        entityType: "ProductionFeedbackDraft",
        entityId: decidedDraft.feedbackId,
        actor,
        summary: request.body.approve
          ? "Produktionsfeedback nach Review als Wissen freigegeben."
          : "Produktionsfeedback nach Review verworfen.",
        details: compactAuditDetails({
          feedbackId: decidedDraft.feedbackId,
          status: decidedDraft.status,
          feedbackTextHash: hashText(decidedDraft.feedback.summary),
          writesReviewedKnowledge: request.body.approve
        })
      });

      return reply.send({ draft: decidedDraft });
    }
  );

  app.get("/v1/production/knowledge/production-feedback", async (request, reply) => {
    const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
    if (forbidden) {
      return forbidden;
    }

    return reply.send({
      items: await store.listReviewedProductionFeedbackKnowledge()
    });
  });

  app.get<{ Params: { specId: string } }>(
    "/v1/production/specs/:specId/clarification-drafts",
    async (request, reply) => {
      const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
      if (forbidden) {
        return forbidden;
      }

      const spec = await intakeStore.getSpec(request.params.specId);
      if (!spec) {
        return reply.code(404).send({ message: "AcceptedEventSpec nicht gefunden." });
      }

      return reply.send({
        items: await store.listClarificationDrafts(request.params.specId)
      });
    }
  );

  app.post<{ Params: { specId: string } }>(
    "/v1/production/specs/:specId/clarification-drafts",
    async (request, reply) => {
      const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
      if (forbidden) {
        return forbidden;
      }

      const spec = await intakeStore.getSpec(request.params.specId);
      if (!spec) {
        return reply.code(404).send({ message: "AcceptedEventSpec nicht gefunden." });
      }

      const promptSchema = findLlmReadinessPromptSchemaEntryByInputKind("clarification_draft_request");
      if (!promptSchema) {
        return reply.code(500).send({ message: "Prompt-Schema für Rückfragen-Entwurf nicht registriert." });
      }

      const input = buildClarificationDraftInput(spec);
      const adapterRequest: LlmReadinessProviderAdapterRequest = {
        input,
        promptSchemaId: promptSchema.promptSchemaId
      };
      const draftSeed = `draft-${spec.specId}-${randomUUID()}`;
      let adapter: LlmReadinessProviderAdapter;
      try {
        adapter = buildLlmAdapter();
      } catch (error) {
        return reply.code(500).send({
          message: error instanceof Error ? error.message : "BYO-LLM-Adapter konnte nicht gestartet werden."
        });
      }

      const adapterResponse = await adapter.run(adapterRequest).catch(async (error: unknown) => {
        await auditLog.log({
          action: "production.clarification_draft_rejected",
          entityType: "ClarificationDraft",
          entityId: draftSeed,
          actor: actorForRequest(request, trustedActorSecret, allowDevActorHeader),
          summary: `KI-Rückfragen-Entwurf für ${spec.specId} verworfen.`,
          details: compactAuditDetails({
            specId: spec.specId,
            inputId: input.inputId,
            adapterId: adapter.adapterId,
            adapterMode: adapter.adapterMode,
            promptSchemaId: promptSchema.promptSchemaId,
            errorCount: 1,
            errorType: error instanceof Error ? error.name : typeof error
          })
        });
        return undefined;
      });
      if (!adapterResponse) {
        return reply.code(422).send({
          message: "KI-Rückfragen-Entwurf konnte nicht erzeugt werden.",
          errors: ["BYO-LLM-Aufruf ist fehlgeschlagen."]
        });
      }
      const auditBuild = createLlmReadinessAgentAuditRecord({
        auditId: `agent-audit-${draftSeed}`,
        request: adapterRequest,
        response: adapterResponse
      });
      const questionsBuild = questionsFromOutput(adapterResponse.outputCandidate);
      const responseErrors = [
        ...(adapterResponse.ok ? [] : adapterResponse.errors),
        ...questionsBuild.errors,
        ...auditBuild.errors.map((error) => `agentAudit.${error}`)
      ];

      if (!adapterResponse.ok || responseErrors.length > 0 || !questionsBuild.questions || !auditBuild.auditRecord) {
        await auditLog.log({
          action: "production.clarification_draft_rejected",
          entityType: "ClarificationDraft",
          entityId: draftSeed,
          actor: actorForRequest(request, trustedActorSecret, allowDevActorHeader),
          summary: `KI-Rückfragen-Entwurf für ${spec.specId} verworfen.`,
          details: compactAuditDetails({
            specId: spec.specId,
            inputId: input.inputId,
            adapterId: adapterResponse.adapterId,
            adapterMode: adapterResponse.adapterMode,
            promptSchemaId: adapterResponse.promptSchemaId ?? promptSchema.promptSchemaId,
            fixtureId: adapterResponse.fixtureId,
            providerId: adapterResponse.providerId,
            providerRequestId: adapterResponse.providerRequestId,
            errorCount: responseErrors.length
          })
        });
        return reply.code(422).send({
          message: "KI-Rückfragen-Entwurf ist nicht schema-valide.",
          errors: [...new Set(responseErrors)]
        });
      }

      const now = new Date().toISOString();
      const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
      const draft: ClarificationDraft = {
        draftId: draftSeed,
        specId: spec.specId,
        questions: questionsBuild.questions,
        status: "pending_review",
        createdAt: now,
        updatedAt: now,
        createdBy: {
          name: actor.name,
          source: actor.source
        },
        modelMetadata: {
          adapterId: adapterResponse.adapterId,
          adapterMode: adapterResponse.adapterMode,
          inputId: input.inputId,
          outputId: adapterResponse.outputCandidate?.outputId,
          outputKind: adapterResponse.outputCandidate?.kind,
          promptSchemaId: adapterResponse.promptSchemaId ?? promptSchema.promptSchemaId,
          fixtureId: adapterResponse.fixtureId,
          providerId: adapterResponse.providerId,
          providerRequestId: adapterResponse.providerRequestId
        },
        agentAudit: auditBuild.auditRecord
      };
      await store.saveClarificationDraft(draft);
      await auditLog.log({
        action: "production.clarification_draft_created",
        entityType: "ClarificationDraft",
        entityId: draft.draftId,
        actor,
        summary: `KI-Rückfragen-Entwurf für ${spec.specId} angelegt.`,
        details: compactAuditDetails({
          specId: spec.specId,
          draftId: draft.draftId,
          agentAuditId: auditBuild.auditRecord.auditId,
          inputId: input.inputId,
          outputId: adapterResponse.outputCandidate?.outputId,
          outputTextHash: hashText(questionsBuild.questions.map((question) => question.text).join("\n")),
          adapterId: adapterResponse.adapterId,
          adapterMode: adapterResponse.adapterMode,
          promptSchemaId: draft.modelMetadata.promptSchemaId,
          fixtureId: adapterResponse.fixtureId,
          providerId: adapterResponse.providerId,
          providerRequestId: adapterResponse.providerRequestId,
          humanApprovalRequired: true,
          writesProductObject: false
        })
      });

      return reply.code(201).send({ draft });
    }
  );

  app.post<{ Params: { draftId: string }; Body: { approve?: unknown } }>(
    "/v1/production/clarification-drafts/:draftId/decision",
    async (request, reply) => {
      const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
      if (forbidden) {
        return forbidden;
      }

      if (typeof request.body?.approve !== "boolean") {
        return reply.code(400).send({ message: "approve muss true oder false sein." });
      }

      const draft = await store.getClarificationDraft(request.params.draftId);
      if (!draft) {
        return reply.code(404).send({ message: "ClarificationDraft nicht gefunden." });
      }
      if (draft.status !== "pending_review") {
        return reply.code(409).send({ message: "ClarificationDraft wurde bereits entschieden." });
      }

      const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
      const now = new Date().toISOString();
      const decidedDraft: ClarificationDraft = {
        ...draft,
        status: request.body.approve ? "approved" : "rejected",
        updatedAt: now,
        decidedAt: now,
        decisionBy: {
          name: actor.name,
          source: actor.source
        }
      };

      let acceptedEventSpec: AcceptedEventSpec | undefined;
      if (request.body.approve) {
        const spec = await intakeStore.getSpec(draft.specId);
        if (!spec) {
          return reply.code(404).send({ message: "AcceptedEventSpec nicht gefunden." });
        }
        acceptedEventSpec = applyApprovedDraftToSpec(spec, draft);
        await intakeStore.saveSpec(acceptedEventSpec);
      }

      await store.saveClarificationDraft(decidedDraft);
      await auditLog.log({
        action: request.body.approve
          ? "production.clarification_draft_approved"
          : "production.clarification_draft_rejected_by_operator",
        entityType: "ClarificationDraft",
        entityId: draft.draftId,
        actor,
        summary: request.body.approve
          ? `KI-Rückfragen-Entwurf für ${draft.specId} übernommen.`
          : `KI-Rückfragen-Entwurf für ${draft.specId} verworfen.`,
        details: compactAuditDetails({
          specId: draft.specId,
          draftId: draft.draftId,
          questionCount: draft.questions.length,
          status: decidedDraft.status,
          outputTextHash: hashText(draft.questions.map((question) => question.text).join("\n"))
        })
      });

      return reply.send({
        draft: decidedDraft,
        ...(acceptedEventSpec ? { acceptedEventSpec } : {})
      });
    }
  );
}

function productionDraftReviewDecisionFromBody(
  value: unknown
): Exclude<ProductionDraftReviewDecision, "pending"> | undefined {
  return typeof value === "string" &&
    operatorProductionDraftReviewDecisions.includes(value as Exclude<ProductionDraftReviewDecision, "pending">)
    ? value as Exclude<ProductionDraftReviewDecision, "pending">
    : undefined;
}

function operatorCommentFromBody(value: unknown): string | false | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  return trimmed.length <= 1000 ? trimmed : false;
}

function buildClarificationDraftInput(spec: AcceptedEventSpec): LlmReadinessModelInput {
  return {
    contractVersion: llmReadinessContractVersion,
    inputId: `input-${spec.specId}-clarification-draft`,
    kind: "clarification_draft_request",
    sourceRefs: [
      {
        objectType: "accepted_event_spec",
        objectId: spec.specId,
        label: "accepted event spec"
      }
    ],
    policy: {
      providerCalls: "disabled",
      dataMode: "synthetic_or_demo_only",
      allowedToolEffects: ["read", "draft"]
    }
  };
}

function questionsFromOutput(outputCandidate?: LlmReadinessModelOutputCandidate): {
  questions?: ClarificationDraftQuestion[];
  errors: string[];
} {
  const errors = validateLlmReadinessModelOutputCandidate(outputCandidate).errors.map((error) =>
    `outputCandidate.${error}`
  );
  if (!outputCandidate) {
    return { errors };
  }

  if (outputCandidate.kind !== "clarification_question_draft") {
    errors.push("outputCandidate.kind must be clarification_question_draft");
  }
  if (outputCandidate.humanApprovalRequired !== true) {
    errors.push("outputCandidate.humanApprovalRequired must be true");
  }
  if (outputCandidate.writesProductObject !== false) {
    errors.push("outputCandidate.writesProductObject must be false");
  }

  const text = outputCandidate.text.trim();
  const reason = outputCandidate.structuredCandidate?.reason;
  const reasonCode = outputCandidate.structuredCandidate?.reasonCode;
  if (!text) {
    errors.push("outputCandidate.text must be non-empty");
  }
  if (typeof reason !== "string" || reason.trim().length === 0) {
    errors.push("outputCandidate.structuredCandidate.reason must be a non-empty string");
  }
  if (typeof reasonCode !== "string" || reasonCode.trim().length === 0) {
    errors.push("outputCandidate.structuredCandidate.reasonCode must be a non-empty string");
  }

  if (errors.length > 0 || typeof reason !== "string" || typeof reasonCode !== "string") {
    return { errors: [...new Set(errors)] };
  }

  return {
    questions: [
      {
        text,
        reason: reason.trim(),
        reasonCode: reasonCode.trim()
      }
    ],
    errors: []
  };
}

function applyApprovedDraftToSpec(spec: AcceptedEventSpec, draft: ClarificationDraft): AcceptedEventSpec {
  const existing = spec.uncertainties ?? [];
  const additions = draft.questions.map((question) => ({
    field: question.reasonCode,
    message: `KI-Rückfragen-Entwurf: ${question.reason}`,
    severity: "medium" as const,
    suggestedQuestion: question.text
  }));
  const deduped = new Map<string, (typeof additions)[number] | (typeof existing)[number]>();

  for (const uncertainty of existing) {
    const key = [uncertainty.field, uncertainty.suggestedQuestion ?? uncertainty.message].join("::");
    deduped.set(key, uncertainty);
  }
  for (const uncertainty of additions) {
    const key = [uncertainty.field, uncertainty.suggestedQuestion ?? uncertainty.message].join("::");
    if (!deduped.has(key)) {
      deduped.set(key, uncertainty);
    }
  }

  return {
    ...spec,
    uncertainties: [...deduped.values()]
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectForbiddenProductionFeedbackBodyKeys(value: unknown, path = "$"): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectForbiddenProductionFeedbackBodyKeys(item, `${path}[${index}]`));
  }
  if (!isPlainRecord(value)) {
    return [];
  }

  const errors: string[] = [];
  for (const [key, nested] of Object.entries(value)) {
    if (llmReadinessForbiddenPayloadKeys.includes(key as (typeof llmReadinessForbiddenPayloadKeys)[number])) {
      errors.push(`${path}.${key} ist in Produktionsfeedback nicht erlaubt.`);
    }
    errors.push(...collectForbiddenProductionFeedbackBodyKeys(nested, `${path}.${key}`));
  }
  return errors;
}

function productionFeedbackText(value: unknown, field: string, errors: string[]): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${field} muss Text enthalten.`);
    return "";
  }

  const text = value.trim();
  if (text.length > 1000) {
    errors.push(`${field} darf maximal 1000 Zeichen enthalten.`);
  }
  return text;
}

function productionFeedbackTextList(value: unknown, field: string, errors: string[]): string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    errors.push(`${field} muss eine Textliste sein.`);
    return [];
  }
  if (value.length > 50) {
    errors.push(`${field} darf maximal 50 Einträge enthalten.`);
  }

  return value
    .map((item, index) => productionFeedbackText(item, `${field}[${index}]`, errors))
    .filter(Boolean);
}

function productionFeedbackTarget(
  value: unknown,
  errors: string[]
): ProductionFeedbackDraft["target"] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isPlainRecord(value)) {
    errors.push("target muss ein Objekt sein.");
    return undefined;
  }

  const target: NonNullable<ProductionFeedbackDraft["target"]> = {};
  for (const key of ["specId", "planId", "recipeId", "componentId"] as const) {
    if (value[key] !== undefined) {
      target[key] = productionFeedbackText(value[key], `target.${key}`, errors);
    }
  }
  if (Object.keys(target).length === 0) {
    errors.push("target muss mindestens eine stabile Referenz enthalten.");
  }
  return target;
}

function productionFeedbackFromBody(body: unknown): {
  target?: ProductionFeedbackDraft["target"];
  feedback?: ProductionFeedbackDraft["feedback"];
  errors: string[];
} {
  const errors = collectForbiddenProductionFeedbackBodyKeys(body);
  if (!isPlainRecord(body)) {
    return {
      errors: [...errors, "Body muss ein Objekt sein."]
    };
  }

  const feedbackBody = isPlainRecord(body.feedback) ? body.feedback : body;
  const feedback: ProductionFeedbackDraft["feedback"] = {
    summary: productionFeedbackText(feedbackBody.summary, "feedback.summary", errors),
    observations: productionFeedbackTextList(feedbackBody.observations, "feedback.observations", errors),
    changeRequests: productionFeedbackTextList(feedbackBody.changeRequests, "feedback.changeRequests", errors)
  };
  const target = productionFeedbackTarget(body.target, errors);

  return {
    ...(target ? { target } : {}),
    feedback,
    errors
  };
}

function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function compactAuditDetails(details: Record<string, string | number | boolean | undefined>) {
  return Object.fromEntries(
    Object.entries(details).filter((entry): entry is [string, string | number | boolean] =>
      entry[1] !== undefined
    )
  );
}
