import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildOfferApp } from "../offer-service/src/app.js";
import { OfferStore } from "../offer-service/src/store.js";

const trustedSecret = "offer-handoff-test-secret";
const trustedHeaders = {
  "x-catering-trusted-secret": trustedSecret,
  "x-catering-actor-name": "Angebots-Mitarbeiter",
  "x-catering-business-id": "local"
};

describe("offer production handoff", () => {
  it("creates an idempotent immutable snapshot from an approved offer", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-offer-handoff-"));
    const store = new OfferStore({ rootDir });
    const app = buildOfferApp({
      rootDir,
      store,
      trustedActorSecret: trustedSecret
    });
    const draftResponse = await app.inject({
      method: "POST",
      url: "/v1/offers/from-text",
      headers: trustedHeaders,
      payload: { text: "Business Lunch fuer 35 Personen." }
    });
    const draft = draftResponse.json<{ draftId: string; variantSet: Array<{ variantId: string }> }>();
    const decisionResponse = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", variantId: draft.variantSet[0]?.variantId }
    });
    const approvedOfferId = decisionResponse.json<{ approvedOffer: { approvedOfferId: string } }>().approvedOffer.approvedOfferId;
    const originalDraft = await store.getDraft({ businessId: "local" }, draft.draftId);
    await expect(store.saveDraft({ businessId: "local" }, { ...originalDraft!, customerFacingText: "mutiert" })).rejects.toThrow("darf nicht nachträglich verändert");

    const first = await app.inject({
      method: "POST",
      url: `/v1/offers/approved/${approvedOfferId}/handoffs`,
      headers: trustedHeaders,
      payload: {}
    });
    const second = await app.inject({
      method: "POST",
      url: `/v1/offers/approved/${approvedOfferId}/handoffs`,
      headers: trustedHeaders,
      payload: {}
    });

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(second.json()).toEqual(first.json());
    const handoff = first.json<{ handoff: { handoffId: string; eventSpecSnapshot: { lifecycle: { commercialState: string } } } }>().handoff;
    expect(handoff.eventSpecSnapshot.lifecycle.commercialState).toBe("accepted");
    const read = await app.inject({ method: "GET", url: `/v1/offers/handoffs/${handoff.handoffId}`, headers: trustedHeaders });
    expect(read.statusCode).toBe(200);
    expect(read.json()).toEqual({ handoff });
  });
});
