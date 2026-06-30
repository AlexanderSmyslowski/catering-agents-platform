import type { FastifyInstance } from "fastify";
import {
  createEventRequestFromText,
  createCuratedOfferDraft,
  createOfferDraft,
  normalizeEventRequestToSpec,
  promoteOfferVariant,
  validateAcceptedEventSpec,
  validateEventRequest,
  validateOfferDraft,
  type AuditLogStore,
  type EventRequest,
  type TrustedActor
} from "@catering/shared-core";
import type { IntakeStore } from "@catering/intake-service";
import { selectCuratedPackage } from "../../../shared-core/src/rules/curated-offer-selection.js";
import type { OfferStore } from "../store.js";

export interface OfferDraftRouteDependencies {
  store: OfferStore;
  intakeStore: IntakeStore;
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
    intakeStore,
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
    const draft = validateOfferDraft(createPortfolioAwareOfferDraft(eventRequest));
    await store.saveDraft(draft);
    await auditLog.log({
      action: "offer.draft_created",
      entityType: "OfferDraft",
      entityId: draft.draftId,
      actor: actorForRequest(request, trustedActorSecret, allowDevActorHeader),
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
    const draft = validateOfferDraft(createPortfolioAwareOfferDraft(eventRequest));
    await store.saveDraft(draft);
    await auditLog.log({
      action: "offer.draft_created_from_text",
      entityType: "OfferDraft",
      entityId: draft.draftId,
      actor: actorForRequest(request, trustedActorSecret, allowDevActorHeader),
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
      items: await store.listDrafts()
    });
  });

  app.get<{ Params: { draftId: string } }>("/v1/offers/drafts/:draftId", async (request, reply) => {
    const forbidden = requireOfferOperator(request, reply, trustedActorSecret, allowDevActorHeader);
    if (forbidden) {
      return forbidden;
    }

    const draft = await store.getDraft(request.params.draftId);
    if (!draft) {
      return reply.code(404).send({ message: "OfferDraft nicht gefunden." });
    }

    return reply.send(draft);
  });

  app.post<{ Params: { draftId: string }; Body: { variantId?: string } }>(
    "/v1/offers/drafts/:draftId/promote",
    async (request, reply) => {
      const forbidden = requireOfferOperator(request, reply, trustedActorSecret, allowDevActorHeader);
      if (forbidden) {
        return forbidden;
      }

      const draft = await store.getDraft(request.params.draftId);
      if (!draft) {
        return reply.code(404).send({ message: "OfferDraft nicht gefunden." });
      }

      const promoted = validateAcceptedEventSpec(
        promoteOfferVariant(draft, request.body?.variantId)
      );
      await intakeStore.saveSpec(promoted);
      await auditLog.log({
        action: "offer.promoted_variant",
        entityType: "AcceptedEventSpec",
        entityId: promoted.specId,
        actor: actorForRequest(request, trustedActorSecret, allowDevActorHeader),
        summary: `Angebotsvariante in operative Event-Spezifikation übernommen.`,
        details: {
          draftId: draft.draftId,
          variantId: request.body?.variantId ?? draft.variantSet[0]?.variantId,
          readiness: promoted.readiness.status
        }
      });

      return reply.code(201).send(promoted);
    }
  );
}
