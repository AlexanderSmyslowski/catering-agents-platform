import type { FastifyInstance } from "fastify";
import {
  createEventRequestFromText,
  createCuratedOfferDraft,
  createOfferDraft,
  normalizeEventRequestToSpec,
  validateEventRequest,
  validateOfferDraft,
  type AuditLogStore,
  type EventRequest,
  type TrustedActor
} from "@catering/shared-core";
import { selectCuratedPackage } from "../../../shared-core/src/rules/curated-offer-selection.js";
import type { OfferStore } from "../store.js";

export interface OfferDraftRouteDependencies {
  store: OfferStore;
  auditLog: AuditLogStore;
  trustedActorSecret?: string;
  allowDevActorHeader: boolean;
  isOfferOperator: (
    request: { headers: Record<string, string | string[] | undefined> },
    trustedActorSecret?: string,
    allowDevActorHeader?: boolean
  ) => boolean;
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

export function registerOfferDraftRoutes(
  app: FastifyInstance,
  deps: OfferDraftRouteDependencies
) {
  const {
    store,
    auditLog,
    trustedActorSecret,
    allowDevActorHeader,
    isOfferOperator,
    requireOfferOperator,
    actorForRequest
  } = deps;

  function createPortfolioAwareOfferDraft(eventRequest: EventRequest) {
    const spec = normalizeEventRequestToSpec(eventRequest, {
      sourceType: "offer_service",
      reference: eventRequest.requestId,
      commercialState: "quoted"
    });
    const packagePreset = selectCuratedPackage(spec);
    return packagePreset ? createCuratedOfferDraft(eventRequest, packagePreset) : createOfferDraft(eventRequest);
  }

  app.post<{ Body: EventRequest }>("/v1/offers/drafts", async (request, reply) => {
    if (!isOfferOperator(request, trustedActorSecret, allowDevActorHeader)) {
      return reply.code(403).send({
        message: "Angebots-Operator erforderlich."
      });
    }

    const eventRequest = validateEventRequest(request.body);
    const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
    const draft = validateOfferDraft({ ...createPortfolioAwareOfferDraft(eventRequest), businessId: actor.businessId, revision: 1 });
    await store.saveDraft(actor, draft);
    await auditLog.logFor(actor, {
      action: "offer.draft_created",
      entityType: "OfferDraft",
      entityId: draft.draftId,
      actor,
      summary: "Angebotsentwurf aus strukturierter Event-Anfrage erstellt.",
      details: {
        requestId: eventRequest.requestId,
        readiness: draft.proposedEventSpec.readiness.status,
        variants: draft.variantSet.length
      }
    });
    return reply.code(201).send(draft);
  });

  app.post<{ Body: { text: string; requestId?: string } }>("/v1/offers/from-text", async (request, reply) => {
    if (!isOfferOperator(request, trustedActorSecret, allowDevActorHeader)) {
      return reply.code(403).send({
        message: "Angebots-Operator erforderlich."
      });
    }

    const eventRequest = createEventRequestFromText({
      requestId: request.body.requestId ?? `request-${Date.now()}`,
      channel: "text",
      rawText: request.body.text
    });
    const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
    const draft = validateOfferDraft({ ...createPortfolioAwareOfferDraft(eventRequest), businessId: actor.businessId, revision: 1 });
    await store.saveDraft(actor, draft);
    await auditLog.logFor(actor, {
      action: "offer.draft_created_from_text",
      entityType: "OfferDraft",
      entityId: draft.draftId,
      actor,
      summary: "Angebotsentwurf aus Freitext erstellt.",
      details: {
        requestId: eventRequest.requestId,
        readiness: draft.proposedEventSpec.readiness.status,
        variants: draft.variantSet.length
      }
    });
    return reply.code(201).send(draft);
  });

  app.get("/v1/offers/drafts", async (request, reply) => {
    const forbidden = requireOfferOperator(request, reply, trustedActorSecret, allowDevActorHeader);
    if (forbidden) {
      return forbidden;
    }

    return reply.send({
      items: await store.listDrafts(actorForRequest(request, trustedActorSecret, allowDevActorHeader))
    });
  });

  app.get<{ Params: { draftId: string } }>("/v1/offers/drafts/:draftId", async (request, reply) => {
    const forbidden = requireOfferOperator(request, reply, trustedActorSecret, allowDevActorHeader);
    if (forbidden) {
      return forbidden;
    }

    const draft = await store.getDraft(actorForRequest(request, trustedActorSecret, allowDevActorHeader), request.params.draftId);
    if (!draft) {
      return reply.code(404).send({ message: "OfferDraft nicht gefunden." });
    }

    return reply.send(draft);
  });

}
