import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  copyCaseForNewEvent,
  formatCaseDisplayName,
  summarizeCase,
  type OfferCase,
  type TrustedActor
} from "@catering/shared-core";
import type { OfferStore } from "../store.js";

interface OfferCaseCreateBody {
  customerName?: unknown;
  eventTypeLabel?: unknown;
  eventDate?: unknown;
  attendeeCount?: unknown;
}

interface CaseMessageBody {
  text?: unknown;
  sourceId?: unknown;
}

export interface OfferCaseRouteDependencies {
  store: OfferStore;
  trustedActorSecret?: string;
  allowDevActorHeader: boolean;
  requireOfferOperator: (
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

export function registerOfferCaseRoutes(
  app: FastifyInstance,
  deps: OfferCaseRouteDependencies
): void {
  const {
    store,
    trustedActorSecret,
    allowDevActorHeader,
    requireOfferOperator,
    actorForRequest
  } = deps;

  const actor = (request: { headers: Record<string, string | string[] | undefined> }) =>
    actorForRequest(request, trustedActorSecret, allowDevActorHeader);
  const forbid = (
    request: { headers: Record<string, string | string[] | undefined> },
    reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } }
  ) => requireOfferOperator(request, reply, trustedActorSecret, allowDevActorHeader);

  app.get<{ Querystring: { search?: string } }>("/v1/offers/cases", async (request, reply) => {
    const forbidden = forbid(request, reply);
    if (forbidden) return forbidden;
    const query = typeof request.query?.search === "string" ? request.query.search : "";
    return reply.send({ items: (await store.searchCases(actor(request), query)).map(summarizeCase) });
  });

  app.post<{ Body: OfferCaseCreateBody }>("/v1/offers/cases", async (request, reply) => {
    const forbidden = forbid(request, reply);
    if (forbidden) return forbidden;
    let input: ReturnType<typeof createInput>;
    try {
      input = createInput(request.body);
    } catch (error) {
      return reply.code(422).send({ message: error instanceof Error ? error.message : "Auftragsdaten sind ungültig." });
    }
    const trustedActor = actor(request);
    const now = new Date().toISOString();
    const offerCase: OfferCase = {
      schemaVersion: "1.0",
      businessId: trustedActor.businessId,
      caseId: `offer-case-${randomUUID()}`,
      product: "offer",
      displayName: formatCaseDisplayName({ ...input, fallbackDate: now }),
      status: "open",
      version: 1,
      createdAt: now,
      updatedAt: now
    };
    await store.createCase(trustedActor, offerCase);
    return reply.code(201).send({ case: offerCase });
  });

  app.get<{ Params: { caseId: string } }>("/v1/offers/cases/:caseId", async (request, reply) => {
    const forbidden = forbid(request, reply);
    if (forbidden) return forbidden;
    const trustedActor = actor(request);
    const offerCase = await store.getCase(trustedActor, request.params.caseId);
    if (!offerCase) return reply.code(404).send({ message: "Angebotsauftrag nicht gefunden." });
    return reply.send({ case: offerCase, events: await store.listEvents(trustedActor, offerCase.caseId) });
  });

  app.post<{ Params: { caseId: string }; Body: Record<string, never> }>(
    "/v1/offers/cases/:caseId/copies",
    async (request, reply) => {
      const forbidden = forbid(request, reply);
      if (forbidden) return forbidden;
      if (!hasOnlyKeys(request.body ?? {}, [])) {
        return reply.code(422).send({ message: "Kopie-Auftrag enthält nicht erlaubte Felder." });
      }
      const trustedActor = actor(request);
      const source = await store.getCase(trustedActor, request.params.caseId);
      if (!source) return reply.code(404).send({ message: "Angebotsauftrag nicht gefunden." });
      const copy = copyCaseForNewEvent(source, {
        caseId: `offer-case-${randomUUID()}`,
        now: new Date().toISOString()
      });
      await store.createCase(trustedActor, copy.case);
      return reply.code(201).send({
        case: copy.case,
        events: await store.listEvents(trustedActor, copy.case.caseId)
      });
    }
  );

  app.post<{ Params: { caseId: string }; Body: CaseMessageBody }>(
    "/v1/offers/cases/:caseId/messages",
    async (request, reply) => {
      const forbidden = forbid(request, reply);
      if (forbidden) return forbidden;
      let input: ReturnType<typeof messageInput>;
      try {
        input = messageInput(request.body);
      } catch (error) {
        return reply.code(422).send({ message: error instanceof Error ? error.message : "Nachricht ist ungültig." });
      }
      const trustedActor = actor(request);
      if (!await store.getCase(trustedActor, request.params.caseId)) {
        return reply.code(404).send({ message: "Angebotsauftrag nicht gefunden." });
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
