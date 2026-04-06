import Fastify, { type FastifyRequest } from "fastify";
import multipart from "@fastify/multipart";
import {
  actorNameFromHeaders,
  AuditLogStore,
  type CollectionStorageOptions,
  createEventRequestFromManualForm,
  validateEventDemand,
  getDemoIntakeRequests,
  normalizeEventRequestToSpec,
  withEvaluatedReadiness,
  validateAcceptedEventSpec,
  validateEventRequest,
  type AcceptedEventSpec,
  type DocumentInput,
  type EventDemand,
  type EventRequest
} from "@catering/shared-core";
import { buildEventRequestFromText, extractTextFromDocument } from "./extraction.js";
import {
  IntakeStore,
  type ApprovalRequestRecord,
  type ApprovalRole,
  type DocumentImportRecord,
  type ExtractedContextRecord,
  type ExtractedField,
  type SpecGovernanceStateRecord,
  type SpecHistoryEntryRecord
} from "./store.js";
import { IntakeStoreAcceptedEventSpecAdapter } from "./spec-governance/accepted-event-spec-adapter.js";
import { applyApprovalTrigger, type PersistedApprovalStatus } from "./spec-governance/approval-trigger.js";
import { SpecGovernanceService } from "./spec-governance/spec-governance-service.js";

interface DocumentBody {
  documents: {
    filename: string;
    mimeType: string;
    contentBase64: string;
  }[];
  channel?: EventRequest["source"]["channel"];
  requestId?: string;
}

interface SpecUpdateBody {
  eventDate?: string;
  attendeeCount?: number;
  serviceForm?: string;
  eventType?: string;
  menuItems?: string[];
  componentUpdates?: Array<{
    componentId: string;
    menuCategory?: "classic" | "vegetarian" | "vegan";
    productionMode?: "scratch" | "hybrid" | "convenience_purchase" | "external_finished";
    purchasedElements?: string[];
    recipeOverrideId?: string;
    notes?: string;
  }>;
}

interface ManualSpecBody {
  eventType?: string;
  eventDate?: string;
  attendeeCount?: number;
  serviceForm?: string;
  menuItems?: string[];
  customerName?: string;
  venueName?: string;
  notes?: string;
}

interface ArchiveSpecBody {
  reason?: string;
}

interface ApprovalDecisionBody {
  note?: string;
}

interface FinalizeSpecGovernanceBody {
  specId?: string;
  changeSetId?: string;
  confirmCriticalFinalize?: boolean;
}

let specHistorySequence = 0;

interface EventDemandBody {
  pax: number;
  serviceForm: string;
  menuOrServiceWish: string;
  eventType?: string;
  date?: string;
  budgetContext?: {
    targetBudget?: {
      amount: number;
      currency: string;
    };
  };
  customerType?: "company" | "university" | "public" | "private" | "unknown";
  restrictions?: string[];
}

interface MultipartDocumentUpload {
  requestId?: string;
  channel?: EventRequest["source"]["channel"];
  documents: DocumentInput[];
}

function rawInputKindForMimeType(
  mimeType: string
): EventRequest["rawInputs"][number]["kind"] {
  if (mimeType.includes("pdf")) {
    return "pdf";
  }
  if (mimeType.includes("message/rfc822")) {
    return "email";
  }
  if (mimeType.includes("json")) {
    return "json";
  }
  return "text";
}

function normalizeMenuItems(input: string[] | undefined): string[] | undefined {
  if (!input) {
    return undefined;
  }

  const items = input.map((item) => item.trim()).filter(Boolean);
  return items.length > 0 ? items : [];
}

function normalizeRestrictions(input: string[] | undefined): string[] | undefined {
  if (!input) {
    return undefined;
  }

  const items = input.map((item) => item.trim()).filter(Boolean);
  return items.length > 0 ? items : [];
}

function eventDemandFromBody(demandId: string, body: EventDemandBody): EventDemand {
  return validateEventDemand({
    schemaVersion: "1.0.0",
    demandId,
    ownershipContext: "customer",
    pax: body.pax,
    serviceForm: body.serviceForm?.trim() ?? "",
    menuOrServiceWish: body.menuOrServiceWish?.trim() ?? "",
    eventType: body.eventType?.trim() || undefined,
    date: body.date?.trim() || undefined,
    budgetContext: body.budgetContext?.targetBudget
      ? {
          targetBudget: body.budgetContext.targetBudget
        }
      : undefined,
    customerType: body.customerType,
    restrictions: normalizeRestrictions(body.restrictions)
  });
}

function dietaryTagsForCategory(category?: "classic" | "vegetarian" | "vegan"): string[] {
  if (category === "vegan") {
    return ["vegan"];
  }
  if (category === "vegetarian") {
    return ["vegetarian"];
  }
  return [];
}

function applySpecUpdates(
  spec: AcceptedEventSpec,
  body: SpecUpdateBody
) {
  const nextEventType = body.eventType?.trim() || spec.event.type || spec.servicePlan.eventType;
  const nextServiceForm = body.serviceForm?.trim() || spec.event.serviceForm || spec.servicePlan.serviceForm;
  const nextOfferPax = spec.attendees.expected;
  const nextProductionPax = body.attendeeCount ?? spec.attendees.productionPax;
  const nextOperationalPax = nextProductionPax ?? nextOfferPax;
  const nextMenuItems = normalizeMenuItems(body.menuItems);
  const componentUpdates = new Map(
    (body.componentUpdates ?? []).map((item) => [item.componentId, item])
  );
  const nextRecipeOverrideId = (
    componentId: string,
    currentRecipeOverrideId?: string
  ) => {
    const componentUpdate = componentUpdates.get(componentId);
    if (!componentUpdate) {
      return currentRecipeOverrideId;
    }

    if (!Object.prototype.hasOwnProperty.call(componentUpdate, "recipeOverrideId")) {
      return currentRecipeOverrideId;
    }

    return componentUpdate.recipeOverrideId?.trim() || undefined;
  };

  const nextSpec = {
    ...spec,
    event: {
      ...spec.event,
      type: nextEventType,
      date: body.eventDate?.trim() || spec.event.date,
      serviceForm: nextServiceForm
    },
    attendees: {
      ...spec.attendees,
      expected: nextOfferPax,
      productionPax: nextProductionPax
    },
    servicePlan: {
      ...spec.servicePlan,
      eventType: nextEventType ?? spec.servicePlan.eventType,
      serviceForm: nextServiceForm
    },
    menuPlan:
      nextMenuItems === undefined
        ? spec.menuPlan.map((item) => ({
            ...item,
            serviceStyle: nextServiceForm,
            servings: nextOperationalPax,
            menuCategory: componentUpdates.get(item.componentId)?.menuCategory ?? item.menuCategory,
            dietaryTags:
              componentUpdates.get(item.componentId)?.menuCategory
                ? dietaryTagsForCategory(componentUpdates.get(item.componentId)?.menuCategory)
                : item.dietaryTags,
            recipeOverrideId: nextRecipeOverrideId(item.componentId, item.recipeOverrideId),
            productionDecision: componentUpdates.get(item.componentId)
              ? {
                  mode: componentUpdates.get(item.componentId)?.productionMode,
                  purchasedElements: componentUpdates.get(item.componentId)?.purchasedElements,
                  notes: componentUpdates.get(item.componentId)?.notes
                }
              : item.productionDecision
          }))
        : nextMenuItems.map((label, index) => ({
            componentId: `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "menu"}-${index + 1}`,
            label,
            course: spec.menuPlan[index]?.course ?? "main",
            menuCategory:
              componentUpdates.get(spec.menuPlan[index]?.componentId ?? "")?.menuCategory ??
              spec.menuPlan[index]?.menuCategory,
            serviceStyle: nextServiceForm,
            desiredRecipeTags: spec.menuPlan[index]?.desiredRecipeTags ?? (nextEventType ? [nextEventType] : []),
            servings: nextOperationalPax,
            dietaryTags:
              componentUpdates.get(spec.menuPlan[index]?.componentId ?? "")?.menuCategory
                ? dietaryTagsForCategory(componentUpdates.get(spec.menuPlan[index]?.componentId ?? "")?.menuCategory)
                : spec.menuPlan[index]?.dietaryTags ?? [],
            recipeOverrideId: nextRecipeOverrideId(
              spec.menuPlan[index]?.componentId ?? "",
              spec.menuPlan[index]?.recipeOverrideId
            ),
            productionDecision:
              componentUpdates.get(spec.menuPlan[index]?.componentId ?? "")
                ? {
                    mode: componentUpdates.get(spec.menuPlan[index]?.componentId ?? "")?.productionMode,
                    purchasedElements:
                      componentUpdates.get(spec.menuPlan[index]?.componentId ?? "")?.purchasedElements,
                    notes: componentUpdates.get(spec.menuPlan[index]?.componentId ?? "")?.notes
                  }
                : spec.menuPlan[index]?.productionDecision
          }))
  };

  return withEvaluatedReadiness(nextSpec);
}

function roleFromHeaders(
  headers: Record<string, string | string[] | undefined>
): ApprovalRole {
  const raw = headers["x-actor-role"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) {
    return "Approver";
  }
  if (
    value === "KitchenEditor" ||
    value === "ProcurementEditor" ||
    value === "Approver"
  ) {
    return value;
  }
  throw new Error("Unbekannte Rolle.");
}

function criticalFieldsForSpecUpdate(body: SpecUpdateBody): string[] {
  const criticalFields = new Set<string>();

  if (Object.prototype.hasOwnProperty.call(body, "eventDate")) {
    criticalFields.add("eventDate");
  }
  if (Object.prototype.hasOwnProperty.call(body, "attendeeCount")) {
    criticalFields.add("attendeeCount");
  }
  if (Object.prototype.hasOwnProperty.call(body, "serviceForm")) {
    criticalFields.add("serviceForm");
  }
  if (Object.prototype.hasOwnProperty.call(body, "eventType")) {
    criticalFields.add("eventType");
  }
  if (Object.prototype.hasOwnProperty.call(body, "menuItems")) {
    criticalFields.add("menuItems");
  }

  for (const update of body.componentUpdates ?? []) {
    if (Object.prototype.hasOwnProperty.call(update, "menuCategory")) {
      criticalFields.add("menuCategory");
    }
    if (Object.prototype.hasOwnProperty.call(update, "productionMode")) {
      criticalFields.add("productionMode");
    }
    if (Object.prototype.hasOwnProperty.call(update, "purchasedElements")) {
      criticalFields.add("purchasedElements");
    }
    if (Object.prototype.hasOwnProperty.call(update, "recipeOverrideId")) {
      criticalFields.add("recipeOverrideId");
    }
  }

  return [...criticalFields];
}

function isHarmlessNotesOnlyUpdate(body: SpecUpdateBody): boolean {
  const topLevelKeys = Object.keys(body);
  if (topLevelKeys.length === 0) {
    return false;
  }

  return topLevelKeys.every((key) => key === "componentUpdates") &&
    (body.componentUpdates ?? []).length > 0 &&
    (body.componentUpdates ?? []).every((update) => {
      const keys = Object.keys(update);
      return (
        keys.length > 0 &&
        keys.every((key) => key === "componentId" || key === "notes")
      );
    });
}

function approvalRequestForBlockedSpecUpdate(
  specId: string,
  body: SpecUpdateBody,
  actor: { name: string },
  role: ApprovalRole
): ApprovalRequestRecord {
  return {
    approvalRequestId: `approval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    specId,
    status: "pending",
    requestedAt: new Date().toISOString(),
    requestedBy: {
      name: actor.name,
      role
    },
    criticalFields: criticalFieldsForSpecUpdate(body),
    requestedChange: body as Record<string, unknown>
  };
}

function createSpecHistoryEntry(
  input: Omit<SpecHistoryEntryRecord, "historyEntryId" | "at" | "sequence">
): SpecHistoryEntryRecord {
  const at = new Date().toISOString();
  specHistorySequence += 1;
  return {
    historyEntryId: `history-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at,
    sequence: specHistorySequence,
    ...input
  };
}

export interface IntakeAppOptions extends CollectionStorageOptions {
  store?: IntakeStore;
  auditLog?: AuditLogStore;
}

function isIntakeStore(value: IntakeStore | IntakeAppOptions | undefined): value is IntakeStore {
  return value instanceof IntakeStore;
}

function actorForRequest(request: { headers: Record<string, string | string[] | undefined> }) {
  return {
    name: actorNameFromHeaders(request.headers, "Intake-Mitarbeiter"),
    source: request.headers["x-actor-name"] ? "header:x-actor-name" : "service-default"
  };
}

function effectiveApprovalStatus(
  state: SpecGovernanceStateRecord | undefined
): PersistedApprovalStatus {
  return state?.approvalStatus ?? "approved";
}

function buildSpecGovernanceState(input: {
  specId: string;
  approvalStatus: PersistedApprovalStatus;
  highestImpactLevel?: SpecGovernanceStateRecord["highestImpactLevel"];
  summary?: string | null;
  latestApprovalRequestId?: string;
}): SpecGovernanceStateRecord {
  return {
    specId: input.specId,
    approvalStatus: input.approvalStatus,
    updatedAt: new Date().toISOString(),
    highestImpactLevel: input.highestImpactLevel ?? null,
    summary: input.summary ?? undefined,
    latestApprovalRequestId: input.latestApprovalRequestId
  };
}

function selectVisibleChangeSet(
  changeSets: Awaited<ReturnType<IntakeStore["listSpecChangeSetsForSpec"]>>
) {
  const openChangeSet = changeSets.find((record) => record.status === "open");
  if (openChangeSet) {
    return openChangeSet;
  }

  return [...changeSets]
    .sort(
      (left, right) =>
        String(right.finalizedAt ?? "").localeCompare(String(left.finalizedAt ?? "")) ||
        String(right.updatedAt ?? "").localeCompare(String(left.updatedAt ?? ""))
    )[0];
}

function multipartFieldValue(
  fields: Record<string, unknown>,
  fieldName: string
): string | undefined {
  const field = fields[fieldName] as { value?: string } | Array<{ value?: string }> | undefined;
  if (Array.isArray(field)) {
    return field[0]?.value;
  }

  return field?.value;
}

async function extractMultipartDocuments(
  request: FastifyRequest
): Promise<MultipartDocumentUpload> {
  const multipartRequest = request as FastifyRequest & {
    isMultipart: () => boolean;
    parts: () => AsyncIterable<{
      type: "file" | "field";
      fieldname: string;
      filename?: string;
      mimetype?: string;
      value?: string;
      toBuffer?: () => Promise<Buffer>;
    }>;
  };

  if (!multipartRequest.isMultipart()) {
    throw new Error("Es wurde kein Multipart-Upload gesendet.");
  }

  const documents: DocumentInput[] = [];
  let channel: EventRequest["source"]["channel"] | undefined;
  let requestId: string | undefined;

  for await (const part of multipartRequest.parts()) {
    if (part.type === "file") {
      if (!part.toBuffer || !part.filename) {
        continue;
      }

      documents.push({
        filename: part.filename,
        mimeType: part.mimetype ?? "application/octet-stream",
        content: await part.toBuffer()
      });
      continue;
    }

    if (part.fieldname === "channel" && typeof part.value === "string") {
      channel = part.value as EventRequest["source"]["channel"];
    }
    if (part.fieldname === "requestId" && typeof part.value === "string") {
      requestId = part.value;
    }
  }

  if (documents.length === 0) {
    throw new Error("Es wurde keine Dokumentdatei mitgesendet.");
  }

  return {
    requestId,
    channel,
    documents
  };
}

async function normalizeUploadedDocuments(
  payload: { documents: DocumentInput[]; requestId?: string; channel?: EventRequest["source"]["channel"] }
) {
  const extracted = await Promise.all(
    payload.documents.map(async (document, index) => ({
      documentId: `${payload.requestId ?? "document"}-${index + 1}`,
      mimeType: document.mimeType,
      text: await extractTextFromDocument(document)
    }))
  );

  const eventRequest: EventRequest = {
    schemaVersion: "1.0.0",
    requestId: payload.requestId ?? `request-${Date.now()}`,
    source: {
      channel: payload.channel ?? "pdf_upload",
      receivedAt: new Date().toISOString()
    },
    rawInputs: extracted.map((item) => ({
      kind: rawInputKindForMimeType(item.mimeType),
      content: item.text,
      mimeType: item.mimeType,
      documentId: item.documentId
    }))
  };

  const validatedRequest = validateEventRequest(eventRequest);
  const spec = validateAcceptedEventSpec(
    normalizeEventRequestToSpec(validatedRequest, {
      sourceType:
        validatedRequest.source.channel === "email"
          ? "email"
          : validatedRequest.source.channel === "pdf_upload"
            ? "pdf"
            : "manual_input",
      reference: validatedRequest.requestId,
      commercialState: "manual"
    })
  );

  const documentImport: DocumentImportRecord = {
    documentImportId: `document-import-${validatedRequest.requestId}`,
    requestId: validatedRequest.requestId,
    sourceChannel: validatedRequest.source.channel,
    createdAt: new Date().toISOString(),
    documents: payload.documents.map((document, index) => ({
      documentId: extracted[index]?.documentId ?? `${validatedRequest.requestId}-${index + 1}`,
      filename: document.filename,
      mimeType: document.mimeType,
      sizeBytes: document.content.byteLength,
      extractedTextPreview: extracted[index]?.text.slice(0, 240) ?? ""
    }))
  };

  const fieldStatusFor = <T,>(
    value: T | undefined,
    options?: {
      missingFieldCodes?: string[];
      uncertaintyFields?: string[];
      note?: string;
    }
  ): ExtractedField<T> => {
    const missing = (options?.missingFieldCodes ?? []).some((field) =>
      spec.missingFields?.includes(field)
    );
    const uncertain = (options?.uncertaintyFields ?? []).some((field) =>
      spec.uncertainties?.some((entry) => entry.field === field)
    );

    if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
      return {
        status: "missing",
        note: options?.note
      };
    }

    return {
      value,
      status: missing || uncertain ? "uncertain" : "extracted",
      note: options?.note
    };
  };

  const extractedContext: ExtractedContextRecord = {
    extractedContextId: `extracted-context-${validatedRequest.requestId}`,
    documentImportId: documentImport.documentImportId,
    requestId: validatedRequest.requestId,
    specId: spec.specId,
    status: "draft",
    fields: {
      pax: fieldStatusFor(spec.attendees.expected, {
        missingFieldCodes: ["attendees.expected"],
        uncertaintyFields: ["attendees.expected"]
      }),
      serviceForm: fieldStatusFor(spec.servicePlan.serviceForm, {
        note: "Automatisch aus Dokumenttext oder Eventtyp abgeleitet."
      }),
      menuOrServiceWish: fieldStatusFor(
        spec.menuPlan.map((item) => item.label).filter(Boolean).join(", "),
        {
          missingFieldCodes: ["menuPlan"],
          uncertaintyFields: ["menuPlan"]
        }
      ),
      budgetTarget: fieldStatusFor(spec.budgetContext?.targetBudget, {
        missingFieldCodes: ["budgetContext.targetBudget"]
      }),
      eventType: fieldStatusFor(spec.servicePlan.eventType, {
        note: "Automatisch aus Dokumenttext oder Defaults abgeleitet."
      }),
      date: fieldStatusFor(spec.event.date, {
        missingFieldCodes: ["event.date"],
        uncertaintyFields: ["event.date"]
      }),
      restrictions: fieldStatusFor(spec.productionConstraints, {
        missingFieldCodes: ["productionConstraints"]
      })
    },
    uncertainties: (spec.uncertainties ?? []).map((entry) => entry.message),
    missingFields: spec.missingFields ?? []
  };

  return {
    documentImport,
    extractedContext,
    eventRequest: validatedRequest,
    acceptedEventSpec: spec
  };
}

export function buildIntakeApp(input: IntakeStore | IntakeAppOptions = {}) {
  const options = isIntakeStore(input) ? { store: input } : input;
  const storageOptions = isIntakeStore(input) ? input.storageOptions : options;
  const store =
    options.store ??
    new IntakeStore({
      rootDir: options.rootDir,
      databaseUrl: options.databaseUrl,
      pgPool: options.pgPool
    });
  const auditLog =
    options.auditLog ??
    new AuditLogStore({
      rootDir: storageOptions?.rootDir,
      databaseUrl: storageOptions?.databaseUrl,
      pgPool: storageOptions?.pgPool
    });
  const app = Fastify({
    logger: false,
    bodyLimit: 25 * 1024 * 1024
  });
  const specGovernance = new SpecGovernanceService(
    new IntakeStoreAcceptedEventSpecAdapter(store),
    store
  );

  app.register(multipart);

  app.get("/health", async (_request, reply) => {
    const [requests, eventDemands, specs, approvalRequests, documentImports, extractedContexts, specHistoryEntries, auditEvents] = await Promise.all([
      store.listRequests(),
      store.listEventDemands(),
      store.listSpecs(),
      store.listApprovalRequests(),
      store.listDocumentImports(),
      store.listExtractedContexts(),
      store.listSpecHistoryEntries(),
      auditLog.count()
    ]);
    return reply.send({
      service: "intake-service",
      status: "ok",
      timestamp: new Date().toISOString(),
      counts: {
        requests: requests.length,
        eventDemands: eventDemands.length,
        acceptedSpecs: specs.length,
        approvalRequests: approvalRequests.length,
        documentImports: documentImports.length,
        extractedContexts: extractedContexts.length,
        specHistoryEntries: specHistoryEntries.length,
        auditEvents
      }
    });
  });

  app.post<{ Body: EventRequest | { text: string; channel?: EventRequest["source"]["channel"]; requestId?: string } }>(
    "/v1/intake/normalize",
    async (request, reply) => {
      const body = request.body;
      const eventRequest =
        "rawInputs" in body
          ? validateEventRequest(body)
          : buildEventRequestFromText({
              requestId: body.requestId ?? `request-${Date.now()}`,
              channel: body.channel ?? "text",
              rawText: body.text
            });

      await store.saveRequest(eventRequest);
      const spec = validateAcceptedEventSpec(
        normalizeEventRequestToSpec(eventRequest, {
          sourceType:
            eventRequest.source.channel === "pdf_upload"
              ? "pdf"
              : eventRequest.source.channel === "email"
                ? "email"
                : "manual_input",
          reference: eventRequest.requestId,
          commercialState: "manual"
        })
      );

      await store.saveSpec(spec);
      await auditLog.log({
        action: "intake.normalized",
        entityType: "AcceptedEventSpec",
        entityId: spec.specId,
        actor: actorForRequest(request),
        summary: `Intake aus ${eventRequest.source.channel} in AcceptedEventSpec normalisiert.`,
        details: {
          requestId: eventRequest.requestId,
          channel: eventRequest.source.channel,
          readiness: spec.readiness.status
        }
      });
      return reply.code(201).send({
        eventRequest,
        acceptedEventSpec: spec
      });
    }
  );

  app.post<{ Body: DocumentBody }>("/v1/intake/documents", async (request, reply) => {
    const body = request.body;
    const documents: DocumentInput[] = body.documents.map((document) => ({
      filename: document.filename,
      mimeType: document.mimeType,
      content: Buffer.from(document.contentBase64, "base64")
    }));
    const normalized = await normalizeUploadedDocuments({
      documents,
      requestId: body.requestId,
      channel: body.channel
    });

    await store.saveRequest(normalized.eventRequest);
    await store.saveDocumentImport(normalized.documentImport);
    await store.saveExtractedContext(normalized.extractedContext);
    await store.saveSpec(normalized.acceptedEventSpec);
    await auditLog.log({
      action: "intake.documents_imported",
      entityType: "DocumentImport",
      entityId: normalized.documentImport.documentImportId,
      actor: actorForRequest(request),
      summary: `${documents.length} hochgeladene(s) Dokument(e) als Extraktionsentwurf übernommen.`,
      details: {
        requestId: normalized.eventRequest.requestId,
        documentCount: documents.length,
        readiness: normalized.acceptedEventSpec.readiness.status,
        extractedContextId: normalized.extractedContext.extractedContextId,
        uploadMode: "json_base64"
      }
    });

    return reply.code(201).send(normalized);
  });

  app.post("/v1/intake/documents/upload", async (request, reply) => {
    const upload = await extractMultipartDocuments(request);
    const normalized = await normalizeUploadedDocuments(upload);

    await store.saveRequest(normalized.eventRequest);
    await store.saveDocumentImport(normalized.documentImport);
    await store.saveExtractedContext(normalized.extractedContext);
    await store.saveSpec(normalized.acceptedEventSpec);
    await auditLog.log({
      action: "intake.documents_imported",
      entityType: "DocumentImport",
      entityId: normalized.documentImport.documentImportId,
      actor: actorForRequest(request),
      summary: `${upload.documents.length} hochgeladene(s) Dokument(e) per Direkt-Upload als Extraktionsentwurf übernommen.`,
      details: {
        requestId: normalized.eventRequest.requestId,
        documentCount: upload.documents.length,
        readiness: normalized.acceptedEventSpec.readiness.status,
        extractedContextId: normalized.extractedContext.extractedContextId,
        uploadMode: "multipart"
      }
    });

    return reply.code(201).send(normalized);
  });

  app.post<{ Body: ManualSpecBody }>("/v1/intake/specs/manual", async (request, reply) => {
    const eventRequest = validateEventRequest(
      createEventRequestFromManualForm({
        requestId: `manual-${Date.now()}`,
        ...request.body
      })
    );

    const spec = validateAcceptedEventSpec(
      normalizeEventRequestToSpec(eventRequest, {
        sourceType: "manual_input",
        reference: eventRequest.requestId,
        commercialState: "manual"
      })
    );

    await store.saveRequest(eventRequest);
    await store.saveSpec(spec);
    await store.saveSpecHistoryEntry(
      createSpecHistoryEntry({
        eventType: "spec_manual_created",
        specId: spec.specId,
        entityType: "AcceptedEventSpec",
        entityRefId: spec.specId,
        summary: "Operative Spezifikation manuell angelegt.",
        actor: actorForRequest(request)
      })
    );
    await auditLog.log({
      action: "intake.manual_spec_created",
      entityType: "AcceptedEventSpec",
      entityId: spec.specId,
      actor: actorForRequest(request),
      summary: "AcceptedEventSpec aus manuellem Formular erstellt.",
      details: {
        requestId: eventRequest.requestId,
        readiness: spec.readiness.status,
        attendeeCount: spec.attendees.expected
      }
    });

    return reply.code(201).send({
      eventRequest,
      acceptedEventSpec: spec
    });
  });

  app.post("/v1/intake/seed-demo", async (_request, reply) => {
    const seeded = [];
    for (const eventRequest of getDemoIntakeRequests()) {
      await store.saveRequest(eventRequest);
      const spec = validateAcceptedEventSpec(
        normalizeEventRequestToSpec(eventRequest, {
          sourceType:
            eventRequest.source.channel === "pdf_upload"
              ? "pdf"
              : eventRequest.source.channel === "email"
                ? "email"
                : "manual_input",
          reference: eventRequest.requestId,
          commercialState: "manual"
        })
      );
      await store.saveSpec(spec);
      seeded.push({
        requestId: eventRequest.requestId,
        specId: spec.specId
      });
    }
    await auditLog.log({
      action: "intake.seed_demo",
      entityType: "SeedBatch",
      entityId: `intake-demo-${Date.now()}`,
      actor: actorForRequest(_request),
      summary: `${seeded.length} Intake-Demodatensaetze angelegt.`,
      details: {
        seededCount: seeded.length
      }
    });

    return reply.code(201).send({
      seeded,
      counts: {
        requests: (await store.listRequests()).length,
        acceptedSpecs: (await store.listSpecs()).length
      }
    });
  });

  app.get("/v1/intake/requests", async (_request, reply) => {
    return reply.send({
      items: await store.listRequests()
    });
  });

  app.post<{ Body: EventDemandBody }>("/v1/intake/event-demands", async (request, reply) => {
    const eventDemand = eventDemandFromBody(`event-demand-${Date.now()}`, request.body);
    await store.saveEventDemand(eventDemand);
    await auditLog.log({
      action: "intake.event_demand_created",
      entityType: "EventDemand",
      entityId: eventDemand.demandId,
      actor: actorForRequest(request),
      summary: "EventDemand angelegt.",
      details: {
        pax: eventDemand.pax,
        serviceForm: eventDemand.serviceForm
      }
    });

    return reply.code(201).send({
      eventDemand
    });
  });

  app.get("/v1/intake/event-demands", async (_request, reply) => {
    return reply.send({
      items: await store.listEventDemands()
    });
  });

  app.get("/v1/intake/document-imports", async (_request, reply) => {
    return reply.send({
      items: await store.listDocumentImports()
    });
  });

  app.get<{ Params: { documentImportId: string } }>(
    "/v1/intake/document-imports/:documentImportId",
    async (request, reply) => {
      const documentImport = await store.getDocumentImport(request.params.documentImportId);
      if (!documentImport) {
        return reply.code(404).send({ message: "DocumentImport nicht gefunden." });
      }

      return reply.send(documentImport);
    }
  );

  app.get("/v1/intake/extracted-contexts", async (_request, reply) => {
    return reply.send({
      items: await store.listExtractedContexts()
    });
  });

  app.get<{ Params: { extractedContextId: string } }>(
    "/v1/intake/extracted-contexts/:extractedContextId",
    async (request, reply) => {
      const extractedContext = await store.getExtractedContext(request.params.extractedContextId);
      if (!extractedContext) {
        return reply.code(404).send({ message: "ExtractedContext nicht gefunden." });
      }

      return reply.send(extractedContext);
    }
  );

  app.get("/v1/intake/approval-requests", async (_request, reply) => {
    return reply.send({
      items: await store.listApprovalRequests()
    });
  });

  app.get<{ Querystring: { specId?: string } }>("/v1/intake/spec-governance", async (request, reply) => {
    const specId = request.query.specId?.trim();
    const scopedSpec = specId ? await store.getSpec(specId) : undefined;
    const specs = specId ? (scopedSpec ? [scopedSpec] : []) : await store.listSpecs();

    const items = await Promise.all(
      specs
        .filter((entry): entry is AcceptedEventSpec => Boolean(entry))
        .map(async (entry) => {
          const [governanceState, changeSets] = await Promise.all([
            store.getSpecGovernanceState(entry.specId),
            store.listSpecChangeSetsForSpec(entry.specId)
          ]);
          const visibleChangeSet = selectVisibleChangeSet(changeSets);

          return {
            specId: entry.specId,
            approvalStatus: governanceState?.approvalStatus ?? "approved",
            updatedAt: governanceState?.updatedAt,
            latestApprovalRequestId: governanceState?.latestApprovalRequestId,
            changeSet: visibleChangeSet
              ? {
                  changeSetId: visibleChangeSet.changeSetId,
                  status: visibleChangeSet.status,
                  summary: visibleChangeSet.summary,
                  highestImpactLevel: visibleChangeSet.highestImpactLevel,
                  activeRuleKeys: visibleChangeSet.activeRuleKeys,
                  updatedAt: visibleChangeSet.updatedAt,
                  updatedBy: visibleChangeSet.updatedBy,
                  finalizedAt: visibleChangeSet.finalizedAt,
                  finalizedBy: visibleChangeSet.finalizedBy
                }
              : null
          };
        })
    );

    return reply.send({ items });
  });

  app.post<{ Body: FinalizeSpecGovernanceBody }>("/v1/intake/spec-governance/finalize", async (request, reply) => {
    const specId = request.body.specId?.trim();
    const changeSetId = request.body.changeSetId?.trim();
    const confirmCriticalFinalize = request.body.confirmCriticalFinalize === true;

    if (!specId && !changeSetId) {
      return reply.code(400).send({
        message: "Es muss eine specId oder changeSetId uebergeben werden."
      });
    }

    const openChangeSet = changeSetId
      ? await store.getSpecChangeSet(changeSetId)
      : specId
        ? await store.getOpenSpecChangeSetForSpec(specId)
        : undefined;

    if (
      openChangeSet?.status === "open" &&
      openChangeSet.highestImpactLevel === "L3" &&
      !confirmCriticalFinalize
    ) {
      return reply.code(409).send({
        message: "Dieses ChangeSet enthält kritische Änderungen (L3) und muss explizit bestätigt werden."
      });
    }

    try {
      const finalizedChangeSet = await specGovernance.finalizeChangeSet({
        specId,
        changeSetId,
        actorName: actorForRequest(request).name
      });

      return reply.send({
        changeSet: {
          changeSetId: finalizedChangeSet.changeSetId,
          specId: finalizedChangeSet.specId,
          status: finalizedChangeSet.status,
          summary: finalizedChangeSet.summary,
          highestImpactLevel: finalizedChangeSet.highestImpactLevel,
          activeRuleKeys: finalizedChangeSet.activeRuleKeys,
          updatedAt: finalizedChangeSet.updatedAt,
          updatedBy: finalizedChangeSet.updatedBy,
          finalizedAt: finalizedChangeSet.finalizedAt,
          finalizedBy: finalizedChangeSet.finalizedBy
        }
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "ChangeSet konnte nicht finalisiert werden.";
      const statusCode = /Kein offenes SpecChangeSet gefunden/.test(message) ? 409 : 400;
      return reply.code(statusCode).send({ message });
    }
  });

  app.get<{ Querystring: { specId?: string } }>("/v1/intake/spec-history", async (request, reply) => {
    const specId = request.query.specId?.trim();
    return reply.send({
      items: specId
        ? await store.listSpecHistoryEntriesForSpec(specId)
        : await store.listSpecHistoryEntries()
    });
  });

  app.get<{ Params: { demandId: string } }>("/v1/intake/event-demands/:demandId", async (request, reply) => {
    const eventDemand = await store.getEventDemand(request.params.demandId);
    if (!eventDemand) {
      return reply.code(404).send({ message: "EventDemand nicht gefunden." });
    }

    return reply.send(eventDemand);
  });

  app.patch<{ Params: { demandId: string }; Body: EventDemandBody }>(
    "/v1/intake/event-demands/:demandId",
    async (request, reply) => {
      const existing = await store.getEventDemand(request.params.demandId);
      if (!existing) {
        return reply.code(404).send({ message: "EventDemand nicht gefunden." });
      }

      const eventDemand = eventDemandFromBody(existing.demandId, request.body);
      await store.saveEventDemand(eventDemand);
      await auditLog.log({
        action: "intake.event_demand_updated",
        entityType: "EventDemand",
        entityId: eventDemand.demandId,
        actor: actorForRequest(request),
        summary: "EventDemand aktualisiert.",
        details: {
          pax: eventDemand.pax,
          serviceForm: eventDemand.serviceForm
        }
      });

      return reply.send({
        eventDemand
      });
    }
  );

  app.get("/v1/intake/specs", async (_request, reply) => {
    return reply.send({
      items: await store.listSpecs()
    });
  });

  app.get<{ Params: { specId: string } }>("/v1/intake/specs/:specId", async (request, reply) => {
    const spec = await store.getSpec(request.params.specId);
    if (!spec) {
      return reply.code(404).send({ message: "AcceptedEventSpec nicht gefunden." });
    }

    return reply.send(spec);
  });

  app.patch<{ Params: { specId: string }; Body: SpecUpdateBody }>(
    "/v1/intake/specs/:specId",
    async (request, reply) => {
      const spec = await store.getSpec(request.params.specId);
      if (!spec) {
        return reply.code(404).send({ message: "AcceptedEventSpec nicht gefunden." });
      }

      let role: ApprovalRole;
      try {
        role = roleFromHeaders(request.headers);
      } catch (error) {
        return reply.code(400).send({
          message: error instanceof Error ? error.message : "Unbekannte Rolle."
        });
      }

      const actor = actorForRequest(request);
      const updatedSpec = validateAcceptedEventSpec(applySpecUpdates(spec, request.body));
      const governanceState = await store.getSpecGovernanceState(spec.specId);
      const governanceResult = await specGovernance.classifyAndTrack({
        specId: spec.specId,
        nextDocument: updatedSpec,
        actorName: actor.name
      });
      const approvalOutcome = applyApprovalTrigger({
        currentApprovalStatus: effectiveApprovalStatus(governanceState),
        items: governanceResult.classifiedChangeSet.items
      });
      const criticalFields = criticalFieldsForSpecUpdate(request.body);
      if (approvalOutcome.newApprovalStatus === "pending_reapproval" && role !== "Approver") {
        const existingPendingApprovalRequest = (await store.listApprovalRequests()).find(
          (record) => record.specId === spec.specId && record.status === "pending"
        );
        const approvalRequest = existingPendingApprovalRequest
          ? {
              ...existingPendingApprovalRequest,
              requestedAt: new Date().toISOString(),
              requestedBy: {
                name: actor.name,
                role
              },
              criticalFields,
              requestedChange: request.body as Record<string, unknown>
            }
          : approvalRequestForBlockedSpecUpdate(
              spec.specId,
              request.body,
              actor,
              role
            );
        await store.saveApprovalRequest(approvalRequest);
        await store.saveSpecGovernanceState(
          buildSpecGovernanceState({
            specId: spec.specId,
            approvalStatus: approvalOutcome.newApprovalStatus,
            highestImpactLevel: governanceResult.finalizedChangeSet.highestImpactLevel,
            summary: governanceResult.finalizedChangeSet.summary,
            latestApprovalRequestId: approvalRequest.approvalRequestId
          })
        );
        await store.saveSpecHistoryEntry(
          createSpecHistoryEntry({
            eventType: "approval_requested",
            specId: spec.specId,
            entityType: "ApprovalRequest",
            entityRefId: approvalRequest.approvalRequestId,
            summary: "Freigabe für kritische Änderung angefordert.",
            actor: {
              ...actor,
              role
            },
            detail:
              approvalRequest.criticalFields.length > 0
                ? approvalRequest.criticalFields.join(", ")
                : undefined
          })
        );
        await auditLog.log({
          action: "intake.spec_update_blocked",
          entityType: "ApprovalRequest",
          entityId: approvalRequest.approvalRequestId,
          actor,
          summary: "Kritische Änderung an AcceptedEventSpec zur Freigabe vorgelegt.",
          details: {
            specId: spec.specId,
            role,
            criticalFields: criticalFields.join(", ")
          }
        });
        return reply.code(409).send({
          message: "Kritische Änderungen sind freigabepflichtig.",
          requiresApproval: true,
          approvalRequest,
          governanceState: {
            approvalStatus: approvalOutcome.newApprovalStatus,
            highestImpactLevel: governanceResult.finalizedChangeSet.highestImpactLevel,
            summary: governanceResult.finalizedChangeSet.summary
          }
        });
      }

      await store.saveSpec(updatedSpec);
      await store.saveSpecGovernanceState(
        buildSpecGovernanceState({
          specId: updatedSpec.specId,
          approvalStatus: role === "Approver" ? "approved" : approvalOutcome.newApprovalStatus,
          highestImpactLevel: governanceResult.finalizedChangeSet.highestImpactLevel,
          summary: governanceResult.finalizedChangeSet.summary
        })
      );
      await store.saveSpecHistoryEntry(
        createSpecHistoryEntry({
          eventType: "spec_updated",
          specId: updatedSpec.specId,
          entityType: "AcceptedEventSpec",
          entityRefId: updatedSpec.specId,
          summary: isHarmlessNotesOnlyUpdate(request.body)
            ? "Operative Spezifikation ergänzt."
            : "Operative Spezifikation wesentlich geändert.",
          actor: {
            ...actor,
            role
          },
          detail: criticalFields.length > 0 ? criticalFields.join(", ") : undefined
        })
      );
      await auditLog.log({
        action: "intake.spec_updated",
        entityType: "AcceptedEventSpec",
        entityId: updatedSpec.specId,
        actor,
        summary: "AcceptedEventSpec manuell nachbearbeitet.",
        details: {
          eventDate: updatedSpec.event.date,
          attendeeCount: updatedSpec.attendees.productionPax ?? updatedSpec.attendees.expected,
          serviceForm: updatedSpec.servicePlan.serviceForm,
          readiness: updatedSpec.readiness.status,
          blocked: false,
          harmlessNotesOnly: isHarmlessNotesOnlyUpdate(request.body)
        }
      });

      return reply.send({
        acceptedEventSpec: updatedSpec
      });
    }
  );

  app.post<{ Params: { approvalRequestId: string }; Body: ApprovalDecisionBody }>(
    "/v1/intake/approval-requests/:approvalRequestId/approve",
    async (request, reply) => {
      let role: ApprovalRole;
      try {
        role = roleFromHeaders(request.headers);
      } catch (error) {
        return reply.code(400).send({
          message: error instanceof Error ? error.message : "Unbekannte Rolle."
        });
      }

      if (role !== "Approver") {
        return reply.code(403).send({ message: "Nur Approver duerfen Freigaben erteilen." });
      }

      const approvalRequest = await store.getApprovalRequest(request.params.approvalRequestId);
      if (!approvalRequest) {
        return reply.code(404).send({ message: "ApprovalRequest nicht gefunden." });
      }
      if (approvalRequest.status !== "pending") {
        return reply.code(409).send({ message: "ApprovalRequest ist bereits bearbeitet." });
      }

      const spec = await store.getSpec(approvalRequest.specId);
      if (!spec) {
        return reply.code(404).send({ message: "AcceptedEventSpec nicht gefunden." });
      }

      const updatedSpec = validateAcceptedEventSpec(
        applySpecUpdates(spec, approvalRequest.requestedChange as SpecUpdateBody)
      );
      const actor = actorForRequest(request);
      const approvedRequest: ApprovalRequestRecord = {
        ...approvalRequest,
        status: "approved",
        approvedAt: new Date().toISOString(),
        approvedBy: {
          name: actor.name,
          role
        }
      };

      await store.saveSpec(updatedSpec);
      await store.saveApprovalRequest(approvedRequest);
      await store.saveSpecGovernanceState(
        buildSpecGovernanceState({
          specId: updatedSpec.specId,
          approvalStatus: "approved",
          highestImpactLevel: "L3",
          summary: "Freigabepflichtige Änderung freigegeben.",
          latestApprovalRequestId: approvedRequest.approvalRequestId
        })
      );
      await store.saveSpecHistoryEntry(
        createSpecHistoryEntry({
          eventType: "approval_approved",
          specId: updatedSpec.specId,
          entityType: "ApprovalRequest",
          entityRefId: approvedRequest.approvalRequestId,
          summary: "Freigabepflichtige Änderung freigegeben.",
          actor: {
            ...actor,
            role
          },
          detail: approvedRequest.criticalFields.join(", ")
        })
      );
      await auditLog.log({
        action: "intake.spec_update_approved",
        entityType: "ApprovalRequest",
        entityId: approvedRequest.approvalRequestId,
        actor,
        summary: "Freigabepflichtige AcceptedEventSpec-Änderung freigegeben.",
        details: {
          specId: updatedSpec.specId,
          criticalFields: approvedRequest.criticalFields.join(", "),
          note: request.body.note?.trim() || undefined
        }
      });

      return reply.send({
        approvalRequest: approvedRequest,
        acceptedEventSpec: updatedSpec
      });
    }
  );

  app.post<{ Params: { specId: string }; Body: ArchiveSpecBody }>(
    "/v1/intake/specs/:specId/archive",
    async (request, reply) => {
      const archived = await store.archiveSpec(request.params.specId);
      if (!archived) {
        return reply.code(404).send({ message: "AcceptedEventSpec nicht gefunden." });
      }

      await store.saveSpecHistoryEntry(
        createSpecHistoryEntry({
          eventType: "spec_archived",
          specId: archived.spec.specId,
          entityType: "AcceptedEventSpec",
          entityRefId: archived.spec.specId,
          summary: "Operative Spezifikation archiviert.",
          actor: actorForRequest(request),
          detail: request.body?.reason?.trim() || undefined
        })
      );

      await auditLog.log({
        action: "intake.spec_archived",
        entityType: "AcceptedEventSpec",
        entityId: archived.spec.specId,
        actor: actorForRequest(request),
        summary: "AcceptedEventSpec als verworfen archiviert.",
        details: {
          archivedAt: archived.archivedAt,
          reason: request.body?.reason?.trim() || "nicht angegeben"
        }
      });

      return reply.send({
        specId: archived.spec.specId,
        archivedAt: archived.archivedAt
      });
    }
  );

  return app;
}
