import Fastify from "fastify";
import multipart from "@fastify/multipart";
import {
  actorNameFromHeaders,
  AuditLogStore,
  type CollectionStorageOptions,
  getDemoIntakeRequests,
  normalizeEventRequestToSpec,
  withEvaluatedReadiness,
  validateAcceptedEventSpec,
  validateEventRequest,
  type AcceptedEventSpec,
  type DocumentInput,
  type EventRequest
} from "@catering/shared-core";
import { buildEventRequestFromText, extractTextFromDocument } from "./extraction.js";
import { IntakeStore } from "./store.js";

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

function applySpecUpdates(
  spec: AcceptedEventSpec,
  body: SpecUpdateBody
) {
  const nextEventType = body.eventType?.trim() || spec.event.type || spec.servicePlan.eventType;
  const nextServiceForm = body.serviceForm?.trim() || spec.event.serviceForm || spec.servicePlan.serviceForm;
  const nextAttendeeCount = body.attendeeCount ?? spec.attendees.expected;
  const nextMenuItems = normalizeMenuItems(body.menuItems);

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
      expected: nextAttendeeCount
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
            servings: nextAttendeeCount
          }))
        : nextMenuItems.map((label, index) => ({
            componentId: `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "menu"}-${index + 1}`,
            label,
            course: spec.menuPlan[index]?.course ?? "main",
            serviceStyle: nextServiceForm,
            desiredRecipeTags: spec.menuPlan[index]?.desiredRecipeTags ?? (nextEventType ? [nextEventType] : []),
            servings: nextAttendeeCount,
            dietaryTags: spec.menuPlan[index]?.dietaryTags ?? []
          }))
  };

  return withEvaluatedReadiness(nextSpec);
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
    logger: false
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

    const extracted = await Promise.all(
      documents.map(async (document, index) => ({
        documentId: `${body.requestId ?? "document"}-${index + 1}`,
        mimeType: document.mimeType,
        text: await extractTextFromDocument(document)
      }))
    );

    const eventRequest: EventRequest = {
      schemaVersion: "1.0.0",
      requestId: body.requestId ?? `request-${Date.now()}`,
      source: {
        channel: body.channel ?? "pdf_upload",
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

    await store.saveRequest(validatedRequest);
    await store.saveSpec(spec);
    await auditLog.log({
      action: "intake.documents_normalized",
      entityType: "AcceptedEventSpec",
      entityId: spec.specId,
      actor: actorForRequest(request),
      summary: `${documents.length} hochgeladene(s) Dokument(e) in AcceptedEventSpec normalisiert.`,
      details: {
        requestId: validatedRequest.requestId,
        documentCount: documents.length,
        readiness: spec.readiness.status
      }
    });

    return reply.code(201).send({
      eventRequest: validatedRequest,
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

      const updatedSpec = validateAcceptedEventSpec(applySpecUpdates(spec, request.body));
      await store.saveSpec(updatedSpec);
      await auditLog.log({
        action: "intake.spec_updated",
        entityType: "AcceptedEventSpec",
        entityId: updatedSpec.specId,
        actor: actorForRequest(request),
        summary: "AcceptedEventSpec manuell nachbearbeitet.",
        details: {
          eventDate: updatedSpec.event.date,
          attendeeCount: updatedSpec.attendees.expected,
          serviceForm: updatedSpec.servicePlan.serviceForm,
          readiness: updatedSpec.readiness.status
        }
      });

      return reply.send({
        acceptedEventSpec: updatedSpec
      });
    }
  );

  return app;
}
