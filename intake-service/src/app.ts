import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { createHash, randomUUID } from "node:crypto";
import {
  AuditLogStore,
  BoundaryGuardedLlmAdapter,
  buildBoundaryGuardedLlmAdapterFromEnv,
  loadByoLlmExternalProcessingApprovalFromEnv,
  createTrustedActorResolver,
  type CollectionStorageOptions,
  createLlmReadinessAgentAuditRecord,
  createEventRequestFromManualForm,
  findLlmReadinessPromptSchemaEntryByInputKind,
  getDemoIntakeRequests,
  getDemoProductionAnsweredClarificationAnchor,
  hostedMultiBusinessReady,
  isDevAuthEnabled,
  llmReadinessContractVersion,
  normalizeEventRequestToSpec,
  resolveMinimalMvpRoleFromTrustedActor,
  DOCUMENT_UPLOAD_LIMITS,
  withEvaluatedReadiness,
  validateAcceptedEventSpec,
  validateEventRequest,
  type LlmReadinessModelOutputCandidate,
  type ByoLlmProviderDescriptor,
  type LlmReadinessProviderAdapter,
  type LlmReadinessProviderAdapterResponse,
  type AcceptedEventSpec,
  type EventRequest,
  type EventScheduleItem,
  type OperationalArchiveReasonCode
} from "@catering/shared-core";
import { buildEventRequestFromText } from "./extraction.js";
import {
  IntakeStore,
  type IntakeShadowDifference,
  type IntakeShadowRun,
  type IntakeShadowSafetyMode,
  type IntakeShadowValueSummary
} from "./store.js";
import {
  registerIntakeWorkItemRoutes,
  type SpecUpdateBody
} from "./routes/work-item-routes.js";
import { registerIntakeDocumentRoutes } from "./routes/document-routes.js";
import { registerSourceDocumentRoutes } from "./routes/source-document-routes.js";
import {
  createSourceDocumentStore,
  type SourceDocumentStore
} from "./source-document-store.js";

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

interface IntakeShadowBody {
  text?: unknown;
  channel?: EventRequest["source"]["channel"];
  requestId?: unknown;
  safetyMode?: unknown;
  sourceRef?: unknown;
}

interface IntakeShadowExtraction {
  eventType?: string;
  serviceForm?: string;
  eventDate?: string;
  attendeeCount?: number;
  menuItems: string[];
}

const intakeShadowSafetyModes = new Set<IntakeShadowSafetyMode>([
  "synthetic_demo",
  "anonymized_reference"
]);

function normalizeOptionalText(value: unknown, maxLength = 240): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > 0 ? trimmed.slice(0, maxLength) : undefined;
}

function hashText(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function stableHash(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  return hashText(JSON.stringify(value));
}

function summarizeValue(value: string | number | string[] | undefined): IntakeShadowValueSummary {
  if (typeof value === "number") {
    return {
      present: Number.isFinite(value),
      numericValue: Number.isFinite(value) ? value : undefined,
      valueHash: Number.isFinite(value) ? stableHash(value) : undefined
    };
  }

  if (Array.isArray(value)) {
    const normalized = value.map((item) => item.trim()).filter(Boolean).sort();
    return {
      present: normalized.length > 0,
      valueHash: normalized.length > 0 ? stableHash(normalized) : undefined
    };
  }

  const normalized = value?.replace(/\s+/g, " ").trim();
  return {
    present: Boolean(normalized),
    valueHash: normalized ? stableHash(normalized.toLowerCase()) : undefined
  };
}

function summarizeAcceptedSpec(spec: AcceptedEventSpec): Record<IntakeShadowDifference["field"], IntakeShadowValueSummary> {
  return {
    eventType: summarizeValue(spec.event.type ?? spec.servicePlan.eventType),
    serviceForm: summarizeValue(spec.event.serviceForm ?? spec.servicePlan.serviceForm),
    eventDate: summarizeValue(spec.event.date),
    attendeeCount: summarizeValue(spec.attendees.expected),
    menuItems: summarizeValue(spec.menuPlan.map((item) => item.label))
  };
}

function summarizeIntakeExtraction(
  extraction: IntakeShadowExtraction
): Record<IntakeShadowDifference["field"], IntakeShadowValueSummary> {
  return {
    eventType: summarizeValue(extraction.eventType),
    serviceForm: summarizeValue(extraction.serviceForm),
    eventDate: summarizeValue(extraction.eventDate),
    attendeeCount: summarizeValue(extraction.attendeeCount),
    menuItems: summarizeValue(extraction.menuItems)
  };
}

function compareIntakeSummaries(
  baseline: Record<IntakeShadowDifference["field"], IntakeShadowValueSummary>,
  llm: Record<IntakeShadowDifference["field"], IntakeShadowValueSummary>
): IntakeShadowDifference[] {
  return (["eventType", "serviceForm", "eventDate", "attendeeCount", "menuItems"] as const).map((field) => ({
    field,
    matches: baseline[field].present === llm[field].present && baseline[field].valueHash === llm[field].valueHash,
    baseline: baseline[field],
    llm: llm[field]
  }));
}

function parseIntakeShadowSafetyMode(value: unknown): IntakeShadowSafetyMode | undefined {
  return typeof value === "string" && intakeShadowSafetyModes.has(value as IntakeShadowSafetyMode)
    ? value as IntakeShadowSafetyMode
    : undefined;
}

function processingPolicyAuditDetails(policy: LlmReadinessProviderAdapterResponse["processingPolicy"]): Record<string, string | number | boolean | null | undefined> {
  if (!policy) return { policySuccessClass: "missing" };
  return {
    policyApprovalId: policy.approvalId,
    policyBusinessId: policy.businessId,
    policyProviderKind: policy.providerKind,
    policyProviderModel: policy.providerModel,
    policyCapability: policy.capability,
    policyActualRegion: policy.actualRegion,
    policyEndpoint: policy.endpoint,
    policyMaximumEstimatedCostEur: policy.maximumEstimatedCostEur,
    policyRetentionPolicy: policy.retentionPolicy,
    policyTrainingUse: policy.trainingUse,
    policyPurpose: policy.purpose,
    policyDataClass: policy.dataClass,
    policySourceHash: policy.sourceHash,
    policyProjectionHash: policy.projectionHash,
    policyInputHash: policy.inputHash,
    policyOutputHash: policy.outputHash,
    policySuccessClass: policy.successClass
  };
}

function parseIntakeShadowExtraction(outputCandidate?: LlmReadinessModelOutputCandidate): {
  extraction?: IntakeShadowExtraction;
  errors: string[];
} {
  const errors: string[] = [];
  if (!outputCandidate) {
    return { errors: ["outputCandidate is required"] };
  }
  if (outputCandidate.kind !== "intake_shadow_extraction") {
    errors.push("outputCandidate.kind must be intake_shadow_extraction");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(outputCandidate.text);
  } catch {
    return {
      errors: [...errors, "outputCandidate.text must be valid intake shadow extraction JSON"]
    };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {
      errors: [...errors, "outputCandidate.text must contain a JSON object"]
    };
  }

  const record = parsed as Record<string, unknown>;
  const menuItems = Array.isArray(record.menuItems)
    ? record.menuItems.map((item) => normalizeOptionalText(item, 320)).filter((item): item is string => Boolean(item))
    : [];
  if (!Array.isArray(record.menuItems)) {
    errors.push("menuItems must be an array");
  }

  const attendeeCount = typeof record.attendeeCount === "number" && Number.isFinite(record.attendeeCount)
    ? Math.trunc(record.attendeeCount)
    : undefined;

  if (errors.length > 0) {
    return { errors: [...new Set(errors)] };
  }

  return {
    extraction: {
      eventType: normalizeOptionalText(record.eventType, 120),
      serviceForm: normalizeOptionalText(record.serviceForm, 120),
      eventDate: normalizeOptionalText(record.eventDate, 40),
      attendeeCount,
      menuItems
    },
    errors: []
  };
}

function normalizeMenuItems(input: string[] | undefined): string[] | undefined {
  if (!input) {
    return undefined;
  }

  const items = input.map((item) => item.trim()).filter(Boolean);
  return items.length > 0 ? items : [];
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

function normalizeEventSchedule(input: SpecUpdateBody["eventSchedule"]): EventScheduleItem[] | undefined {
  if (!input) {
    return undefined;
  }

  const items = input
    .map((item) => ({
      label: String(item.label ?? "").trim() || "Service",
      start: item.start?.trim() || undefined,
      end: item.end?.trim() || undefined
    }))
    .filter((item) => item.label || item.start || item.end);

  return items.length > 0 ? items : undefined;
}

function resolvedUncertaintyFields(body: SpecUpdateBody): Set<string> {
  const fields = new Set<string>();
  if (body.eventType?.trim()) {
    fields.add("event.type");
  }
  if (body.eventDate?.trim()) {
    fields.add("event.date");
    fields.add("event.date_or_schedule");
  }
  if (normalizeEventSchedule(body.eventSchedule)?.length) {
    fields.add("event.schedule");
    fields.add("event.date_or_schedule");
  }
  if (typeof body.attendeeCount === "number" && Number.isFinite(body.attendeeCount) && body.attendeeCount > 0) {
    fields.add("attendees.expected");
  }
  if (body.serviceForm?.trim()) {
    fields.add("event.serviceForm");
    fields.add("servicePlan.serviceForm");
  }
  if (normalizeMenuItems(body.menuItems)?.length) {
    fields.add("menuPlan");
  }
  return fields;
}

const archiveReasonCodes = new Set<OperationalArchiveReasonCode>([
  "wrong_upload",
  "duplicate_test_data",
  "operator_rehearsal_cleanup"
]);

function parseArchiveReasonCode(
  value: unknown
): OperationalArchiveReasonCode | undefined {
  if (value === undefined || value === null || value === "") {
    return "wrong_upload";
  }
  if (typeof value !== "string") {
    return undefined;
  }

  return archiveReasonCodes.has(value as OperationalArchiveReasonCode)
    ? (value as OperationalArchiveReasonCode)
    : undefined;
}

function includeArchivedFromQuery(query: unknown): boolean {
  const value = (query as { includeArchived?: unknown } | undefined)?.includeArchived;
  return value === true || value === "true" || value === "1";
}

function applySpecUpdates(
  spec: AcceptedEventSpec,
  body: SpecUpdateBody
) {
  const nextEventType = body.eventType?.trim() || spec.event.type || spec.servicePlan.eventType;
  const nextServiceForm = body.serviceForm?.trim() || spec.event.serviceForm || spec.servicePlan.serviceForm;
  const nextAttendeeCount = body.attendeeCount ?? spec.attendees.expected;
  const nextMenuItems = normalizeMenuItems(body.menuItems);
  const nextEventSchedule = body.eventSchedule !== undefined
    ? normalizeEventSchedule(body.eventSchedule)
    : spec.event.schedule;
  const resolvedFields = resolvedUncertaintyFields(body);
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
      schedule: nextEventSchedule,
      serviceForm: nextServiceForm
    },
    attendees: {
      ...spec.attendees,
      expected: nextAttendeeCount
    },
    servicePlan: {
      ...spec.servicePlan,
      eventType: nextEventType ?? spec.servicePlan.eventType,
      serviceForm: nextServiceForm
    },
    uncertainties: (spec.uncertainties ?? []).filter((uncertainty) => !resolvedFields.has(uncertainty.field)),
    menuPlan:
      nextMenuItems === undefined
        ? spec.menuPlan.map((item) => ({
            ...item,
            serviceStyle: nextServiceForm,
            servings: nextAttendeeCount,
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
            servings: nextAttendeeCount,
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

export interface IntakeAppOptions extends CollectionStorageOptions {
  store?: IntakeStore;
  sourceDocumentStore?: SourceDocumentStore;
  auditLog?: AuditLogStore;
  llmAdapter?: LlmReadinessProviderAdapter;
  llmProviderDescriptor?: ByoLlmProviderDescriptor;
  trustedActorSecret?: string;
  env?: Record<string, string | undefined>;
}

function isIntakeStore(value: IntakeStore | IntakeAppOptions | undefined): value is IntakeStore {
  return value instanceof IntakeStore;
}

export function buildIntakeApp(input: IntakeStore | IntakeAppOptions = {}) {
  const options = isIntakeStore(input) ? { store: input } : input;
  const env = options.env ?? process.env;
  const defaultBusinessContext = { businessId: env.CATERING_DEFAULT_BUSINESS_ID ?? "local" };
  const hosted = env.CATERING_DEPLOYMENT_PROFILE === "hosted";
  if (hosted && !hostedMultiBusinessReady) {
    throw new Error("Hosted Multi-Business-Betrieb ist noch nicht bereit.");
  }
  const trustedActorSecret = options.trustedActorSecret ?? env.CATERING_TRUSTED_ACTOR_SECRET;
  const allowDevActorHeader = isDevAuthEnabled(env);
  const resolveActor = createTrustedActorResolver({
      fallbackActorName: "Intake-Mitarbeiter",
      fallbackBusinessId: defaultBusinessContext.businessId,
      requireTrustedBusinessId: hosted,
      trustedActorSecret,
      allowDevActorHeader
    });
  const actorForRequest = (request: { headers: Record<string, string | string[] | undefined> }, ..._ignored: unknown[]) => resolveActor(request);
  const isIntakeOperator = (request: { headers: Record<string, string | string[] | undefined> }, ..._ignored: unknown[]) =>
    resolveMinimalMvpRoleFromTrustedActor(actorForRequest(request)) === "intake_operator";
  const requireIntakeOperator = (
    request: { headers: Record<string, string | string[] | undefined> },
    reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } },
    ..._ignored: unknown[]
  ): unknown | undefined => isIntakeOperator(request)
    ? undefined
    : reply.code(403).send({ message: "Intake-Operator erforderlich." });
  const isOperationsAuditOperator = (request: { headers: Record<string, string | string[] | undefined> }, ..._ignored: unknown[]) =>
    resolveMinimalMvpRoleFromTrustedActor(actorForRequest(request)) === "operations_audit_operator";
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
  const sourceDocumentStore =
    options.sourceDocumentStore ??
    createSourceDocumentStore({
      rootDir: storageOptions?.rootDir,
      databaseUrl: storageOptions?.databaseUrl,
      pgPool: storageOptions?.pgPool
    });
  if (options.llmAdapter && !options.llmProviderDescriptor) {
    throw new Error("Injected BYO LLM adapters require an explicit server-owned llmProviderDescriptor.");
  }
  const app = Fastify({
    logger: false,
    bodyLimit: DOCUMENT_UPLOAD_LIMITS.intake.maxFileSizeBytes
  });

  app.addHook("onRequest", async (request, reply) => {
    if (request.url.split("?", 1)[0] === "/health") return;
    const actor = actorForRequest(request);
    if (!hosted && actor.businessId !== defaultBusinessContext.businessId) {
      return reply.code(403).send({
        message: "Der vertrauenswürdige Betriebskontext passt nicht zum konfigurierten Betrieb dieses lokalen Dienstes."
      });
    }
  });

  app.register(multipart);

  app.get("/health", async (_request, reply) => {
    if (hosted) {
      return reply.send({ service: "intake-service", status: "ok", timestamp: new Date().toISOString() });
    }
    const [requests, specs, auditEvents] = await Promise.all([
      store.listRequests(defaultBusinessContext),
      store.listSpecs(defaultBusinessContext),
      auditLog.countFor(defaultBusinessContext)
    ]);
    return reply.send({
      service: "intake-service",
      status: "ok",
      timestamp: new Date().toISOString(),
      counts: {
        requests: requests.length,
        acceptedSpecs: specs.length,
        auditEvents
      }
    });
  });

  app.post<{ Body: EventRequest | { text: string; channel?: EventRequest["source"]["channel"]; requestId?: string } }>(
    "/v1/intake/normalize",
    async (request, reply) => {
      if (!isIntakeOperator(request, trustedActorSecret, allowDevActorHeader)) {
        return reply.code(403).send({
          message: "Intake-Operator erforderlich."
        });
      }

      const body = request.body;
      const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
      const rawText = "rawInputs" in body
        ? body.rawInputs.map((input) => input.content).join("\n")
        : body.text;
      if (typeof rawText !== "string" || !rawText.trim()) {
        return reply.code(422).send({
          message: "Bitte Beschreibung eingeben"
        });
      }
      const eventRequest =
        "rawInputs" in body
          ? validateEventRequest(body)
          : buildEventRequestFromText({
              requestId: body.requestId ?? `request-${Date.now()}`,
              channel: body.channel ?? "text",
              rawText: body.text
            });

      await store.saveRequest(actor, eventRequest);
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

      await store.saveSpec(actor, spec);
      await auditLog.logFor(actorForRequest(request, trustedActorSecret, allowDevActorHeader), {
        action: "intake.normalized",
        entityType: "AcceptedEventSpec",
        entityId: spec.specId,
        actor: actorForRequest(request, trustedActorSecret, allowDevActorHeader),
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

  app.post<{ Body: IntakeShadowBody }>("/v1/intake/shadow/normalize", async (request, reply) => {
    if (!isIntakeOperator(request, trustedActorSecret, allowDevActorHeader)) {
      return reply.code(403).send({
        message: "Intake-Operator erforderlich."
      });
    }

    const body = request.body ?? {};
    const safetyMode = parseIntakeShadowSafetyMode(body.safetyMode);
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!safetyMode) {
      return reply.code(422).send({
        message: "Intake-Schattenmodus braucht safetyMode synthetic_demo oder anonymized_reference."
      });
    }
    if (text.length === 0) {
      return reply.code(422).send({
        message: "Intake-Schattenmodus braucht einen freigegebenen Text."
      });
    }

    const inputHash = hashText(text);
    const channel = body.channel ?? "text";
    const requestId = normalizeOptionalText(body.requestId, 120) ?? `shadow-${inputHash.slice(7, 23)}`;
    const sourceRef = normalizeOptionalText(body.sourceRef, 240);
    const eventRequest = buildEventRequestFromText({
      requestId,
      channel,
      rawText: text
    });
    const baselineSpec = validateAcceptedEventSpec(
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
    const baselineSummary = summarizeAcceptedSpec(baselineSpec);
    const promptSchema = findLlmReadinessPromptSchemaEntryByInputKind("intake_shadow_request");
    if (!promptSchema) {
      return reply.code(500).send({ message: "Prompt-Schema für Intake-Schattenmodus nicht registriert." });
    }

    const input = {
      contractVersion: llmReadinessContractVersion,
      inputId: `input-intake-shadow-${inputHash.slice(7, 23)}-${randomUUID()}`,
      kind: "intake_shadow_request" as const,
      sourceRefs: [
        {
          objectType: "safe_source_anchor" as const,
          objectId: inputHash,
          label: `intake-shadow:${safetyMode}`
        }
      ],
      policy: {
        providerCalls: "disabled" as const,
        dataMode: "synthetic_or_demo_only" as const,
        allowedToolEffects: ["read", "draft"] as const
      }
    };
    const adapterRequest = {
      input,
      promptSchemaId: promptSchema.promptSchemaId,
      promptContext: text
    };
    const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
    let adapter: BoundaryGuardedLlmAdapter;
    try {
      adapter = options.llmAdapter && options.llmProviderDescriptor
        ? new BoundaryGuardedLlmAdapter({
            descriptor: options.llmProviderDescriptor,
            delegate: options.llmAdapter,
            approvalResolver: () => loadByoLlmExternalProcessingApprovalFromEnv(env),
            env
          })
        : buildBoundaryGuardedLlmAdapterFromEnv(env, {
            providerRunIdPrefix: "intake-shadow"
          });
    } catch (error) {
      return reply.code(500).send({
        message: error instanceof Error ? error.message : "BYO-LLM-Adapter konnte nicht gestartet werden."
      });
    }

    const adapterResponse: LlmReadinessProviderAdapterResponse | undefined = await adapter.execute(adapterRequest, {
      businessId: actor.businessId,
      // safetyMode is an evaluation label supplied by the caller, never a
      // provider authorization classification for this legacy text endpoint.
      dataClass: "personal_confidential",
      purpose: "intake_shadow_extraction"
    })
      .catch(async (error: unknown) => {
        await auditLog.logFor(actorForRequest(request, trustedActorSecret, allowDevActorHeader), {
          action: "intake.shadow_extraction_rejected",
          entityType: "IntakeShadowRun",
          entityId: input.inputId,
          actor,
          summary: "Intake-Schattenextraktion verworfen.",
          details: {
            inputId: input.inputId,
            inputHash,
            safetyMode,
            errorType: error instanceof Error ? error.name : typeof error
          }
        });
        return undefined;
      });
    if (!adapterResponse) {
      return reply.code(422).send({
        message: "Intake-Schattenextraktion konnte nicht erzeugt werden.",
        errors: ["BYO-LLM-Aufruf ist fehlgeschlagen."]
      });
    }

    const auditBuild = createLlmReadinessAgentAuditRecord({
      auditId: `agent-audit-${input.inputId}`,
      request: adapterRequest,
      response: adapterResponse
    });
    const extractionBuild = parseIntakeShadowExtraction(adapterResponse.outputCandidate);
    const responseErrors = [
      ...(adapterResponse.ok ? [] : adapterResponse.errors),
      ...extractionBuild.errors,
      ...auditBuild.errors.map((error) => `agentAudit.${error}`)
    ];
    if (!adapterResponse.ok || responseErrors.length > 0 || !extractionBuild.extraction || !auditBuild.auditRecord) {
      await auditLog.logFor(actorForRequest(request, trustedActorSecret, allowDevActorHeader), {
        action: "intake.shadow_extraction_rejected",
        entityType: "IntakeShadowRun",
        entityId: input.inputId,
        actor,
        summary: "Intake-Schattenextraktion verworfen.",
        details: {
          inputId: input.inputId,
          inputHash,
          safetyMode,
          adapterId: adapterResponse.adapterId,
          adapterMode: adapterResponse.adapterMode,
          providerId: adapterResponse.providerId,
          providerRequestId: adapterResponse.providerRequestId,
          ...processingPolicyAuditDetails(adapterResponse.processingPolicy),
          errorCount: responseErrors.length
        }
      });
      return reply.code(422).send({
        message: "Intake-Schattenextraktion ist nicht schema-valide.",
        errors: [...new Set(responseErrors)]
      });
    }

    const llmSummary = summarizeIntakeExtraction(extractionBuild.extraction);
    const differences = compareIntakeSummaries(baselineSummary, llmSummary);
    const shadowRun: IntakeShadowRun = {
      shadowRunId: `intake-shadow-${randomUUID()}`,
      createdAt: new Date().toISOString(),
      status: "pending_review",
      safetyMode,
      source: {
        channel: eventRequest.source.channel,
        inputHash,
        sourceRef
      },
      baseline: {
        requestId: eventRequest.requestId,
        specId: baselineSpec.specId,
        summary: baselineSummary
      },
      llm: {
        inputId: input.inputId,
        outputId: adapterResponse.outputCandidate?.outputId,
        outputHash: adapterResponse.outputCandidate ? hashText(adapterResponse.outputCandidate.text) : undefined,
        providerId: adapterResponse.providerId,
        providerRequestId: adapterResponse.providerRequestId,
        adapterId: adapterResponse.adapterId,
        adapterMode: adapterResponse.adapterMode,
        promptSchemaId: adapterResponse.promptSchemaId ?? promptSchema.promptSchemaId,
        summary: llmSummary
      },
      differences,
      guardrails: {
        draftOnly: true,
        humanApprovalRequired: true,
        writesProductObjects: false,
        rawPayloadStored: false,
        dataMode: "synthetic_or_demo_only"
      }
    };
    await store.saveShadowRun(actor, shadowRun);
    await auditLog.logFor(actorForRequest(request, trustedActorSecret, allowDevActorHeader), {
      action: "intake.shadow_extraction_compared",
      entityType: "IntakeShadowRun",
      entityId: shadowRun.shadowRunId,
      actor,
      summary: "Intake-Schattenextraktion gegen Regex-Baseline verglichen.",
      details: {
        shadowRunId: shadowRun.shadowRunId,
        inputId: input.inputId,
        agentAuditId: auditBuild.auditRecord.auditId,
        inputHash,
        outputHash: shadowRun.llm.outputHash,
        safetyMode,
        differenceCount: differences.filter((difference) => !difference.matches).length,
        providerId: adapterResponse.providerId,
        providerRequestId: adapterResponse.providerRequestId,
        ...processingPolicyAuditDetails(adapterResponse.processingPolicy),
        writesProductObject: false
      }
    });

    return reply.code(201).send({ shadowRun });
  });

  registerIntakeDocumentRoutes(app, {
    store,
    sourceDocumentStore,
    auditLog,
    trustedActorSecret,
    allowDevActorHeader,
    isIntakeOperator,
    actorForRequest
  });
  registerSourceDocumentRoutes(app, {
    sourceDocumentStore,
    auditLog,
    trustedActorSecret,
    allowDevActorHeader,
    requireIntakeOperator,
    actorForRequest
  });

  app.post<{ Body: ManualSpecBody }>("/v1/intake/specs/manual", async (request, reply) => {
    if (!isIntakeOperator(request, trustedActorSecret, allowDevActorHeader)) {
      return reply.code(403).send({
        message: "Intake-Operator erforderlich."
      });
    }

    const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
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

    await store.saveRequest(actor, eventRequest);
    await store.saveSpec(actor, spec);
    await auditLog.logFor(actorForRequest(request, trustedActorSecret, allowDevActorHeader), {
      action: "intake.manual_spec_created",
      entityType: "AcceptedEventSpec",
      entityId: spec.specId,
      actor: actorForRequest(request, trustedActorSecret, allowDevActorHeader),
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

  app.post("/v1/intake/seed-demo", async (request, reply) => {
    if (!isOperationsAuditOperator(request, trustedActorSecret, allowDevActorHeader)) {
      return reply.code(403).send({
        message: "Betriebs-/Audit-Operator erforderlich."
      });
    }

    const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
    const seeded = [];
    for (const eventRequest of getDemoIntakeRequests()) {
      await store.saveRequest(actor, eventRequest);
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
      await store.saveSpec(actor, spec);
      seeded.push({
        requestId: eventRequest.requestId,
        specId: spec.specId
      });
    }
    const answeredClarificationAnchor = getDemoProductionAnsweredClarificationAnchor();
    const answeredClarificationSpec = validateAcceptedEventSpec(answeredClarificationAnchor.spec);
    await store.saveRequest(actor, answeredClarificationAnchor.request);
    await store.saveSpec(actor, answeredClarificationSpec);
    seeded.push({
      requestId: answeredClarificationAnchor.request.requestId,
      specId: answeredClarificationSpec.specId
    });
    await auditLog.logFor(actorForRequest(request, trustedActorSecret, allowDevActorHeader), {
      action: "intake.seed_demo",
      entityType: "SeedBatch",
      entityId: `intake-demo-${Date.now()}`,
      actor: actorForRequest(request, trustedActorSecret, allowDevActorHeader),
      summary: `${seeded.length} Intake-Demodatensaetze angelegt.`,
      details: {
        seededCount: seeded.length
      }
    });

    return reply.code(201).send({
      seeded,
      counts: {
        requests: (await store.listRequests(actor)).length,
        acceptedSpecs: (await store.listSpecs(actor)).length
      }
    });
  });

  registerIntakeWorkItemRoutes(app, {
    store,
    auditLog,
    trustedActorSecret,
    allowDevActorHeader,
    includeArchivedFromQuery,
    parseArchiveReasonCode,
    applySpecUpdates,
    isIntakeOperator,
    isOperationsAuditOperator,
    requireIntakeOperator,
    actorForRequest
  });

  return app;
}
