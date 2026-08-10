import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createEventRequestFromText,
  createOfferDraft,
  type ProductionHandoff
} from "@catering/shared-core";
import { buildOfferApp } from "../offer-service/src/app.js";
import { buildProductionApp } from "../production-service/src/app.js";
import { HttpProductionHandoffReader } from "../production-service/src/gateways/http-production-handoff-reader.js";
import { ProductionStore } from "../production-service/src/repositories/production-store.js";

const sharedSecret = "shared-secret";
const localBusiness = { businessId: "local" };
const requestedHandoffId = `handoff-${"a".repeat(64)}`;

function buildHandoff(overrides: Partial<ProductionHandoff> = {}): ProductionHandoff {
  const draft = createOfferDraft(createEventRequestFromText({
    requestId: "handoff-port",
    channel: "text",
    rawText: "Lunch fuer 20 Personen."
  }));
  return {
    schemaVersion: "1.0",
    businessId: "local",
    handoffId: requestedHandoffId,
    approvedOfferId: `approved-offer-${"b".repeat(64)}`,
    approvalRequestId: `approval-${"c".repeat(64)}`,
    createdAt: "2026-08-10T00:00:00.000Z",
    eventSpecSnapshot: draft.variantSet[0]!.proposedEventSpec,
    pricingSnapshot: draft.variantSet[0]!.proposedEventSpec.budgetContext!.pricingSummary!,
    source: { draftId: draft.draftId, revision: 1, selectedVariantId: draft.variantSet[0]!.variantId },
    ...overrides
  };
}

function injectedFetch(app: ReturnType<typeof buildOfferApp>): typeof fetch {
  return async (input, init) => {
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    const response = await app.inject({
      method: "GET",
      url: new URL(String(input)).pathname,
      headers
    });
    return new Response(response.body, {
      status: response.statusCode,
      headers: { "content-type": response.headers["content-type"] ?? "application/json" }
    });
  };
}

describe("production handoff port", () => {
  it("passes the trusted service identity and business context to the offer boundary", async () => {
    const requests: Array<{ url: string; headers: HeadersInit }> = [];
    const reader = new HttpProductionHandoffReader({
      offerServiceUrl: "http://offer.internal",
      trustedServiceSecret: sharedSecret,
      fetch: async (url, init) => {
        requests.push({ url: String(url), headers: init?.headers ?? {} });
        return new Response(JSON.stringify({ handoff: buildHandoff() }), { status: 200 });
      }
    });

    await expect(reader.getHandoff(localBusiness, requestedHandoffId)).resolves.toMatchObject({ handoffId: requestedHandoffId });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe(`http://offer.internal/v1/offers/handoffs/${requestedHandoffId}`);
    expect(requests[0]?.headers).toMatchObject({
      "x-catering-trusted-secret": sharedSecret,
      "x-catering-business-id": "local",
      "x-catering-actor-name": "Produktions-Mitarbeiter"
    });
  });

  it.each([
    ["missing envelope", {}],
    ["mismatched handoff id", { handoff: buildHandoff({ handoffId: `handoff-${"d".repeat(64)}` }) }],
    ["mismatched business", { handoff: buildHandoff({ businessId: "other" }) }]
  ])("rejects a successful upstream response with %s", async (_label, payload) => {
    const reader = new HttpProductionHandoffReader({
      offerServiceUrl: "http://offer.internal",
      fetch: async () => new Response(JSON.stringify(payload), { status: 200 })
    });

    await expect(reader.getHandoff(localBusiness, requestedHandoffId)).rejects.toThrow("Produktionsübergabe");
  });

  it("maps only an upstream 404 to an absent handoff", async () => {
    const reader = new HttpProductionHandoffReader({
      offerServiceUrl: "http://offer.internal",
      fetch: async () => new Response(JSON.stringify({ message: "missing" }), { status: 404 })
    });

    await expect(reader.getHandoff(localBusiness, requestedHandoffId)).resolves.toBeUndefined();
  });

  it("connects the real offer app, HTTP reader, and production route through a read-only service identity", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-handoff-integration-"));
    const offerApp = buildOfferApp({ rootDir, trustedActorSecret: sharedSecret });
    const offerHeaders = {
      "x-catering-trusted-secret": sharedSecret,
      "x-catering-actor-name": "Angebots-Mitarbeiter",
      "x-catering-business-id": "local"
    };
    const productionHeaders = {
      "x-catering-trusted-secret": sharedSecret,
      "x-catering-actor-name": "Produktions-Mitarbeiter",
      "x-catering-business-id": "local"
    };
    const createdDraft = await offerApp.inject({ method: "POST", url: "/v1/offers/from-text", headers: offerHeaders, payload: { text: "Business Lunch fuer 35 Personen." } });
    const draft = createdDraft.json<{ draftId: string; variantSet: Array<{ variantId: string }> }>();
    const approved = await offerApp.inject({ method: "POST", url: `/v1/offers/drafts/${draft.draftId}/decision`, headers: offerHeaders, payload: { decision: "approved", variantId: draft.variantSet[0]!.variantId } });
    const approvedOfferId = approved.json<{ approvedOffer: { approvedOfferId: string } }>().approvedOffer.approvedOfferId;
    const createdHandoff = await offerApp.inject({ method: "POST", url: `/v1/offers/approved/${approvedOfferId}/handoffs`, headers: offerHeaders, payload: {} });
    const handoffId = createdHandoff.json<{ handoff: { handoffId: string } }>().handoff.handoffId;
    const reader = new HttpProductionHandoffReader({ offerServiceUrl: "http://offer.internal", trustedServiceSecret: sharedSecret, fetch: injectedFetch(offerApp) });
    const productionApp = buildProductionApp({ dataRoot: rootDir, trustedActorSecret: sharedSecret, handoffReader: reader });

    const entered = await productionApp.inject({ method: "POST", url: `/v1/production/drafts/from-handoff/${handoffId}`, headers: productionHeaders });
    expect(entered.statusCode).toBe(201);
    expect(entered.json()).toMatchObject({ draft: { businessId: "local", source: { sourceRef: `offer-handoff:${handoffId}` } } });

    const forbiddenMutation = await offerApp.inject({ method: "POST", url: `/v1/offers/drafts/${draft.draftId}/decision`, headers: productionHeaders, payload: { decision: "rejected" } });
    expect(forbiddenMutation.statusCode).toBe(403);

    await productionApp.close();
    await offerApp.close();
  });

  it("rejects a cross-business handoff before persistence", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-handoff-business-"));
    const store = new ProductionStore({ rootDir });
    const app = buildProductionApp({
      dataRoot: rootDir,
      store,
      trustedActorSecret: sharedSecret,
      handoffReader: { async getHandoff() { return buildHandoff({ businessId: "other" }); } }
    });
    const response = await app.inject({
      method: "POST",
      url: `/v1/production/drafts/from-handoff/${requestedHandoffId}`,
      headers: {
        "x-catering-trusted-secret": sharedSecret,
        "x-catering-actor-name": "Produktions-Mitarbeiter",
        "x-catering-business-id": "local"
      }
    });

    expect(response.statusCode).toBe(502);
    await expect(store.listProductionDrafts()).resolves.toHaveLength(0);
    await app.close();
  });
});
