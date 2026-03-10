import Fastify from "fastify";
import {
  createOfferDraft,
  promoteOfferVariant,
  validateAcceptedEventSpec,
  validateEventRequest,
  validateOfferDraft,
  type EventRequest
} from "@catering/shared-core";
import { OfferStore } from "./store.js";

export function buildOfferApp(store = new OfferStore()) {
  const app = Fastify({
    logger: false
  });

  app.post<{ Body: EventRequest }>("/v1/offers/drafts", async (request, reply) => {
    const eventRequest = validateEventRequest(request.body);
    const draft = validateOfferDraft(createOfferDraft(eventRequest));
    store.saveDraft(draft);
    return reply.code(201).send(draft);
  });

  app.get<{ Params: { draftId: string } }>("/v1/offers/drafts/:draftId", async (request, reply) => {
    const draft = store.getDraft(request.params.draftId);
    if (!draft) {
      return reply.code(404).send({ message: "OfferDraft not found." });
    }

    return reply.send(draft);
  });

  app.post<{ Params: { draftId: string }; Body: { variantId?: string } }>(
    "/v1/offers/drafts/:draftId/promote",
    async (request, reply) => {
      const draft = store.getDraft(request.params.draftId);
      if (!draft) {
        return reply.code(404).send({ message: "OfferDraft not found." });
      }

      const promoted = validateAcceptedEventSpec(
        promoteOfferVariant(draft, request.body?.variantId)
      );

      return reply.code(201).send(promoted);
    }
  );

  return app;
}

