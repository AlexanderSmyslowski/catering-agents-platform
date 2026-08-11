import { createHash, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  CaseStoreConflictError,
  copyCaseForNewEvent,
  formatCaseDisplayName,
  formatEventTypeLabel,
  summarizeCase,
  type ProductionCase,
  type TrustedActor
} from "@catering/shared-core";
import type { ProductionHandoffReader } from "../ports/production-handoff-reader.js";
import type { ProductionStore } from "../repositories/production-store.js";

interface ProductionCaseCreateBody {
  customerName?: unknown;
  eventTypeLabel?: unknown;
  eventDate?: unknown;
  attendeeCount?: unknown;
}

interface CaseMessageBody {
  text?: unknown;
  sourceId?: unknown;
}

export interface ProductionCaseRouteDependencies {
  store: ProductionStore;
  handoffReader?: ProductionHandoffReader;
  trustedActorSecret?: string;
  allowDevActorHeader: boolean;
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

function hasOnlyKeys(value: unknown, allowed: readonly string[]): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).every((key) => allowed.includes(key));
}

function optionalText(value: unknown, maxLength = 320): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new Error("Textfeld ist ungültig.");
  const normalized = value.normalize("NFKC").replace(/\s+/gu, " ").trim();
  if (!normalized || normalized.length > maxLength) throw new Error("Textfeld ist ungültig.");
  return normalized;
}

function createInput(body: unknown): {
  customerName?: string;
  eventTypeLabel?: string;
  eventDate?: string;
  attendeeCount?: number;
} {
  if (!hasOnlyKeys(body, ["customerName", "eventTypeLabel", "eventDate", "attendeeCount"])) {
    throw new Error("Auftragsdaten enthalten nicht erlaubte Felder.");
  }
  if (body.attendeeCount !== undefined &&
    (!Number.isSafeInteger(body.attendeeCount) || (body.attendeeCount as number) <= 0)) {
    throw new Error("Teilnehmerzahl ist ungültig.");
  }
  return {
    ...(body.customerName !== undefined ? { customerName: optionalText(body.customerName) } : {}),
    ...(body.eventTypeLabel !== undefined ? { eventTypeLabel: optionalText(body.eventTypeLabel) } : {}),
    ...(body.eventDate !== undefined ? { eventDate: optionalText(body.eventDate, 80) } : {}),
    ...(body.attendeeCount !== undefined ? { attendeeCount: body.attendeeCount as number } : {})
  };
}

function messageInput(body: unknown): { text: string; sourceId?: string } {
  if (!hasOnlyKeys(body, ["text", "sourceId"])) {
    throw new Error("Nachricht enthält nicht erlaubte Felder.");
  }
  const text = optionalText(body.text, 10_000);
  if (!text) throw new Error("Nachrichtentext fehlt.");
  const sourceId = body.sourceId === undefined ? undefined : optionalText(body.sourceId, 240);
  return { text, ...(sourceId ? { sourceId } : {}) };
}

function newProductionCase(
  actor: TrustedActor,
  input: ReturnType<typeof createInput>,
  now: string,
  productionHandoffId?: string,
  caseId = `production-case-${randomUUID()}`
): ProductionCase {
  return {
    schemaVersion: "1.0",
    businessId: actor.businessId,
    caseId,
    product: "production",
    displayName: formatCaseDisplayName({ ...input, fallbackDate: now }),
    status: "open",
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...(productionHandoffId ? { productionHandoffId } : {})
  };
}

function productionCaseIdForHandoff(actor: TrustedActor, handoffId: string): string {
  return `production-case-handoff-${createHash("sha256")
    .update(`${actor.businessId}\0${handoffId}`)
    .digest("hex")}`;
}

export function registerProductionCaseRoutes(
  app: FastifyInstance,
  deps: ProductionCaseRouteDependencies
): void {
  const {
    store,
    handoffReader,
    trustedActorSecret,
    allowDevActorHeader,
    requireProductionOperator,
    actorForRequest
  } = deps;
  const actor = (request: { headers: Record<string, string | string[] | undefined> }) =>
    actorForRequest(request, trustedActorSecret, allowDevActorHeader);
  const forbid = (
    request: { headers: Record<string, string | string[] | undefined> },
    reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } }
  ) => requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);

  app.get<{ Querystring: { search?: string } }>("/v1/production/cases", async (request, reply) => {
    const forbidden = forbid(request, reply);
    if (forbidden) return forbidden;
    const query = typeof request.query?.search === "string" ? request.query.search : "";
    return reply.send({ items: (await store.searchCases(actor(request), query)).map(summarizeCase) });
  });

  app.post<{ Body: ProductionCaseCreateBody }>("/v1/production/cases", async (request, reply) => {
    const forbidden = forbid(request, reply);
    if (forbidden) return forbidden;
    let input: ReturnType<typeof createInput>;
    try {
      input = createInput(request.body);
    } catch (error) {
      return reply.code(422).send({
        message: error instanceof Error ? error.message : "Auftragsdaten sind ungültig."
      });
    }
    const trustedActor = actor(request);
    const productionCase = newProductionCase(trustedActor, input, new Date().toISOString());
    await store.createCase(trustedActor, productionCase);
    return reply.code(201).send({ case: productionCase });
  });

  app.get<{ Params: { caseId: string } }>("/v1/production/cases/:caseId", async (request, reply) => {
    const forbidden = forbid(request, reply);
    if (forbidden) return forbidden;
    const trustedActor = actor(request);
    const productionCase = await store.getCase(trustedActor, request.params.caseId);
    if (!productionCase) return reply.code(404).send({ message: "Produktionsauftrag nicht gefunden." });
    return reply.send({
      case: productionCase,
      events: await store.listEvents(trustedActor, productionCase.caseId)
    });
  });

  app.post<{ Params: { caseId: string }; Body: Record<string, never> }>(
    "/v1/production/cases/:caseId/copies",
    async (request, reply) => {
      const forbidden = forbid(request, reply);
      if (forbidden) return forbidden;
      if (!hasOnlyKeys(request.body ?? {}, [])) {
        return reply.code(422).send({ message: "Kopie-Auftrag enthält nicht erlaubte Felder." });
      }
      const trustedActor = actor(request);
      const source = await store.getCase(trustedActor, request.params.caseId);
      if (!source) return reply.code(404).send({ message: "Produktionsauftrag nicht gefunden." });
      const copy = copyCaseForNewEvent(source, {
        caseId: `production-case-${randomUUID()}`,
        now: new Date().toISOString()
      });
      await store.createCase(trustedActor, copy.case);
      return reply.code(201).send({
        case: copy.case,
        events: await store.listEvents(trustedActor, copy.case.caseId)
      });
    }
  );

  app.post<{ Params: { handoffId: string }; Body: Record<string, never> }>(
    "/v1/production/cases/from-handoff/:handoffId",
    async (request, reply) => {
      const forbidden = forbid(request, reply);
      if (forbidden) return forbidden;
      if (!hasOnlyKeys(request.body ?? {}, [])) {
        return reply.code(422).send({ message: "Handoff-Auftrag enthält nicht erlaubte Felder." });
      }
      if (!handoffReader) {
        return reply.code(503).send({ message: "Angebotsübergaben sind nicht konfiguriert." });
      }
      const trustedActor = actor(request);
      let handoff;
      try {
        handoff = await handoffReader.get(trustedActor, request.params.handoffId);
      } catch {
        return reply.code(502).send({ message: "Produktionsübergabe konnte nicht geladen werden." });
      }
      if (!handoff) return reply.code(404).send({ message: "Produktionsübergabe nicht gefunden." });
      if (handoff.businessId !== trustedActor.businessId || handoff.handoffId !== request.params.handoffId) {
        return reply.code(502).send({ message: "Produktionsübergabe passt nicht zum Produktionsauftrag." });
      }
      const spec = handoff.eventSpecSnapshot;
      const productionCase = newProductionCase(trustedActor, {
        ...(spec.customer?.name ? { customerName: spec.customer.name } : {}),
        eventTypeLabel: formatEventTypeLabel(spec.servicePlan.eventType) ?? spec.servicePlan.eventType,
        ...(spec.event.date ? { eventDate: spec.event.date } : {}),
        ...(spec.attendees.expected ? { attendeeCount: spec.attendees.expected } : {})
      }, handoff.createdAt, handoff.handoffId, productionCaseIdForHandoff(trustedActor, handoff.handoffId));
      productionCase.sourceSpecId = spec.specId;
      const existingCase = await store.getCase(trustedActor, productionCase.caseId);
      if (existingCase) {
        return existingCase.productionHandoffId === handoff.handoffId
          ? reply.code(201).send({ case: existingCase })
          : reply.code(409).send({ message: "Bestehender Produktionsauftrag passt nicht zur Übergabe." });
      }
      try {
        await store.createCase(trustedActor, productionCase);
        return reply.code(201).send({ case: productionCase });
      } catch (error) {
        if (!(error instanceof CaseStoreConflictError)) throw error;
        const racedCase = await store.getCase(trustedActor, productionCase.caseId);
        return racedCase?.productionHandoffId === handoff.handoffId
          ? reply.code(201).send({ case: racedCase })
          : reply.code(409).send({ message: "Bestehender Produktionsauftrag passt nicht zur Übergabe." });
      }
    }
  );

  app.post<{ Params: { caseId: string }; Body: CaseMessageBody }>(
    "/v1/production/cases/:caseId/messages",
    async (request, reply) => {
      const forbidden = forbid(request, reply);
      if (forbidden) return forbidden;
      let input: ReturnType<typeof messageInput>;
      try {
        input = messageInput(request.body);
      } catch (error) {
        return reply.code(422).send({
          message: error instanceof Error ? error.message : "Nachricht ist ungültig."
        });
      }
      const trustedActor = actor(request);
      if (!await store.getCase(trustedActor, request.params.caseId)) {
        return reply.code(404).send({ message: "Produktionsauftrag nicht gefunden." });
      }
      const event = await store.appendEvent(trustedActor, request.params.caseId, {
        at: new Date().toISOString(),
        role: "user",
        kind: "instruction",
        text: input.text,
        ...(input.sourceId ? { sourceId: input.sourceId } : {})
      });
      return reply.code(201).send({ event });
    }
  );
}
