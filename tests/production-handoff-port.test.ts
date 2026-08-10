import { describe, expect, it } from "vitest";
import { createEventRequestFromText, createOfferDraft } from "@catering/shared-core";
import { HttpProductionHandoffReader } from "../production-service/src/gateways/http-production-handoff-reader.js";

describe("production handoff port", () => {
  it("passes the trusted service identity and business context to the offer boundary", async () => {
    const requests: Array<{ url: string; headers: HeadersInit }> = [];
    const draft = createOfferDraft(createEventRequestFromText({ requestId: "handoff-port", channel: "text", rawText: "Lunch fuer 20 Personen." }));
    const reader = new HttpProductionHandoffReader({
      offerServiceUrl: "http://offer.internal",
      trustedServiceSecret: "shared-secret",
      fetch: async (url, init) => {
        requests.push({ url: String(url), headers: init?.headers ?? {} });
        return new Response(JSON.stringify({ handoff: {
          schemaVersion: "1.0", businessId: "local", handoffId: `handoff-${"a".repeat(64)}`,
          approvedOfferId: `approved-offer-${"b".repeat(64)}`, approvalRequestId: `approval-${"c".repeat(64)}`,
          createdAt: "2026-08-10T00:00:00.000Z", eventSpecSnapshot: draft.variantSet[0]!.proposedEventSpec,
          pricingSnapshot: draft.pricingSummary, source: { draftId: draft.draftId, revision: 1, selectedVariantId: draft.variantSet[0]!.variantId }
        } }), { status: 200 });
      }
    });

    await expect(reader.getHandoff({ businessId: "local" }, "handoff-1")).resolves.toMatchObject({ handoffId: `handoff-${"a".repeat(64)}` });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("http://offer.internal/v1/offers/handoffs/handoff-1");
    expect(requests[0]?.headers).toMatchObject({
      "x-catering-trusted-secret": "shared-secret",
      "x-catering-business-id": "local",
      "x-catering-actor-name": "Produktions-Mitarbeiter"
    });
  });
});
