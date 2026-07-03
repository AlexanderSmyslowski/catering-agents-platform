import Fastify from "fastify";
import multipart from "@fastify/multipart";
import {
  AuditLogStore,
  type CollectionStorageOptions,
  createEventRequestFromManualForm,
  getDemoIntakeRequests,
  getDemoProductionAnsweredClarificationAnchor,
  isDevAuthEnabled,
  normalizeEventRequestToSpec,
  resolveMinimalMvpRoleFromTrustedActor,
  trustedActorFromHeaders,
  DOCUMENT_UPLOAD_LIMITS,
  withEvaluatedReadiness,
  validateAcceptedEventSpec,
  validateEventRequest,
  type AcceptedEventSpec,
  type EventRequest,
  type EventScheduleItem,
  type OperationalArchiveReasonCode
} from "@catering/shared-core";
import { buildEventRequestFromText } from "./extraction.js";
import { IntakeStore } from "./store.js";
import {
  registerIntakeWorkItemRoutes,
  type SpecUpdateBody
} from "./routes/work-item-routes.js";
import { registerIntakeDocumentRoutes } from "./routes/document-routes.js";

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
  auditLog?: AuditLogStore;
  trustedActorSecret?: string;
  env?: Record<string, string | undefined>;
}

function isIntakeStore(value: IntakeStore | IntakeAppOptions | undefined): value is IntakeStore {
  return value instanceof IntakeStore;
}

function actorForRequest(
  request: { headers: Record<string, string | string[] | undefined> },
  trustedActorSecret?: string,
  allowDevActorHeader = false
) {
  return trustedActorFromHeaders(request.headers, {
    fallbackActorName: "Intake-Mitarbeiter",
    trustedActorSecret,
    allowDevActorHeader
  });
}

function isIntakeOperator(
  request: { headers: Record<string, string | string[] | undefined> },
  trustedActorSecret?: string,
  allowDevActorHeader = false
): boolean {
  return resolveMinimalMvpRoleFromTrustedActor(
    actorForRequest(request, trustedActorSecret, allowDevActorHeader)
  ) === "intake_operator";
}

function requireIntakeOperator(
  request: { headers: Record<string, string | string[] | undefined> },
  reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } },
  trustedActorSecret?: string,
  allowDevActorHeader = false
): unknown | undefined {
  if (!isIntakeOperator(request, trustedActorSecret, allowDevActorHeader)) {
    return reply.code(403).send({
      message: "Intake-Operator erforderlich."
    });
  }

  return undefined;
}

function isOperationsAuditOperator(
  request: { headers: Record<string, string | string[] | undefined> },
  trustedActorSecret?: string,
  allowDevActorHeader = false
): boolean {
  return resolveMinimalMvpRoleFromTrustedActor(
    actorForRequest(request, trustedActorSecret, allowDevActorHeader)
  ) === "operations_audit_operator";
}

export function buildIntakeApp(input: IntakeStore | IntakeAppOptions = {}) {
  const options = isIntakeStore(input) ? { store: input } : input;
  const env = options.env ?? process.env;
  const trustedActorSecret = options.trustedActorSecret ?? env.CATERING_TRUSTED_ACTOR_SECRET;
  const allowDevActorHeader = isDevAuthEnabled(env);
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
    bodyLimit: DOCUMENT_UPLOAD_LIMITS.intake.maxFileSizeBytes
  });

  app.register(multipart);

  app.get("/health", async (_request, reply) => {
    const [requests, specs, auditEvents] = await Promise.all([
      store.listRequests(),
      store.listSpecs(),
      auditLog.count()
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

  registerIntakeDocumentRoutes(app, {
    store,
    auditLog,
    trustedActorSecret,
    allowDevActorHeader,
    isIntakeOperator,
    actorForRequest
  });

  app.post<{ Body: ManualSpecBody }>("/v1/intake/specs/manual", async (request, reply) => {
    if (!isIntakeOperator(request, trustedActorSecret, allowDevActorHeader)) {
      return reply.code(403).send({
        message: "Intake-Operator erforderlich."
      });
    }

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
    await auditLog.log({
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
    const answeredClarificationAnchor = getDemoProductionAnsweredClarificationAnchor();
    const answeredClarificationSpec = validateAcceptedEventSpec(answeredClarificationAnchor.spec);
    await store.saveRequest(answeredClarificationAnchor.request);
    await store.saveSpec(answeredClarificationSpec);
    seeded.push({
      requestId: answeredClarificationAnchor.request.requestId,
      specId: answeredClarificationSpec.specId
    });
    await auditLog.log({
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
        requests: (await store.listRequests()).length,
        acceptedSpecs: (await store.listSpecs()).length
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
