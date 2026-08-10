import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  AuditLogStore,
  createEventRequestFromText,
  createOfferDraft,
  validateProductionDraft,
  type ProductionHandoff
} from "@catering/shared-core";
import { buildOfferApp } from "../offer-service/src/app.js";
import { buildProductionApp } from "../production-service/src/app.js";
import { HttpProductionHandoffReader } from "../production-service/src/gateways/http-production-handoff-reader.js";
import { ProductionStore } from "../production-service/src/repositories/production-store.js";

const sharedSecret = "shared-secret";
const localBusiness = { businessId: "local" };
const requestedHandoffId = `handoff-${"a".repeat(64)}`;
const productionHeaders = {
  "x-catering-trusted-secret": sharedSecret,
  "x-catering-actor-name": "Produktions-Mitarbeiter",
  "x-catering-business-id": "local"
};

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

function buildPoisonedProductionDraft(handoff: ProductionHandoff) {
  return validateProductionDraft({
    schemaVersion: handoff.eventSpecSnapshot.schemaVersion,
    businessId: handoff.businessId,
    draftId: `production-draft-handoff-${handoff.handoffId}`,
    revision: 1,
    status: "pending_review",
    createdAt: handoff.createdAt,
    source: { kind: "manual_import", receivedAt: handoff.createdAt, sourceRef: "manual-poison" },
    guardrails: { draftOnly: true, humanApprovalRequired: true, writesProductObjects: false, rawProviderPayloadStored: false, knowledgeWritePolicy: "reviewed_only" },
    reviewCards: [{
      cardId: "card-poison", kind: "event_data", title: "Poisoned draft",
      summary: "This record must never satisfy a handoff identity.", decision: "pending",
      targetPath: "$.draftArtifacts.eventSpec", targetId: handoff.eventSpecSnapshot.specId,
      requiredApproval: true
    }],
    draftArtifacts: {
      eventSpec: {
        ...structuredClone(handoff.eventSpecSnapshot),
        event: { ...handoff.eventSpecSnapshot.event, title: "Substituted event" }
      }
    }
  });
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
    const approved = await offerApp.inject({ method: "POST", url: `/v1/offers/drafts/${draft.draftId}/decision`, headers: offerHeaders, payload: { decision: "approved", revision: 1, variantId: draft.variantSet[0]!.variantId } });
    const approvedOfferId = approved.json<{ approvedOffer: { approvedOfferId: string } }>().approvedOffer.approvedOfferId;
    const createdHandoff = await offerApp.inject({ method: "POST", url: `/v1/offers/approved/${approvedOfferId}/handoffs`, headers: offerHeaders, payload: {} });
    const handoffId = createdHandoff.json<{ handoff: { handoffId: string } }>().handoff.handoffId;
    const reader = new HttpProductionHandoffReader({ offerServiceUrl: "http://offer.internal", trustedServiceSecret: sharedSecret, fetch: injectedFetch(offerApp) });
    const productionApp = buildProductionApp({ dataRoot: rootDir, trustedActorSecret: sharedSecret, handoffReader: reader });

    const entered = await productionApp.inject({ method: "POST", url: `/v1/production/drafts/from-handoff/${handoffId}`, headers: productionHeaders });
    expect(entered.statusCode).toBe(201);
    expect(entered.json()).toMatchObject({ draft: { businessId: "local", source: { sourceRef: `offer-handoff:${handoffId}` } } });

    const forbiddenMutation = await offerApp.inject({ method: "POST", url: `/v1/offers/drafts/${draft.draftId}/decision`, headers: productionHeaders, payload: { decision: "rejected", revision: 1 } });
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
    await expect(store.listProductionDrafts(localBusiness)).resolves.toHaveLength(0);
    await app.close();
  });

  it("isolates handoff-derived drafts from every other business read and mutation path", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-handoff-draft-scope-"));
    const store = new ProductionStore({ rootDir });
    const handoff = buildHandoff({ businessId: "alpha" });
    const app = buildProductionApp({
      dataRoot: rootDir,
      store,
      trustedActorSecret: sharedSecret,
      handoffReader: { async getHandoff() { return handoff; } }
    });
    const headersFor = (businessId: string) => ({
      "x-catering-trusted-secret": sharedSecret,
      "x-catering-actor-name": "Produktions-Mitarbeiter",
      "x-catering-business-id": businessId
    });

    const created = await app.inject({
      method: "POST",
      url: `/v1/production/drafts/from-handoff/${handoff.handoffId}`,
      headers: headersFor("alpha")
    });
    expect(created.statusCode).toBe(201);
    const draft = created.json<{ draft: ReturnType<typeof buildPoisonedProductionDraft> }>().draft;

    const alphaList = await app.inject({
      method: "GET",
      url: "/v1/production/drafts",
      headers: headersFor("alpha")
    });
    const betaList = await app.inject({
      method: "GET",
      url: "/v1/production/drafts",
      headers: headersFor("beta")
    });
    const betaReview = await app.inject({
      method: "PATCH",
      url: `/v1/production/drafts/${draft.draftId}/review-cards/${draft.reviewCards[0]!.cardId}`,
      headers: headersFor("beta"),
      payload: { decision: "fits" }
    });
    const betaRevision = await app.inject({
      method: "POST",
      url: `/v1/production/drafts/${draft.draftId}/revise`,
      headers: headersFor("beta")
    });
    const betaDecision = await app.inject({
      method: "POST",
      url: `/v1/production/drafts/${draft.draftId}/decision`,
      headers: headersFor("beta"),
      payload: { decision: "rejected" }
    });
    const betaApply = await app.inject({
      method: "POST",
      url: `/v1/production/drafts/${draft.draftId}/apply`,
      headers: headersFor("beta")
    });
    const betaImport = await app.inject({
      method: "POST",
      url: "/v1/production/drafts",
      headers: headersFor("beta"),
      payload: {
        ...draft,
        draftId: "production-draft-alpha-imported-by-beta",
        source: { ...draft.source, sourceRef: "manual-cross-business-import" }
      }
    });
    expect(alphaList.json<{ items: unknown[] }>().items).toHaveLength(1);
    expect(betaList.json<{ items: unknown[] }>().items).toHaveLength(0);
    expect(await store.getProductionDraft({ businessId: "alpha" }, draft.draftId)).toEqual(draft);
    expect(await store.getProductionDraft({ businessId: "beta" }, draft.draftId)).toBeUndefined();
    expect([betaReview.statusCode, betaRevision.statusCode, betaDecision.statusCode, betaApply.statusCode])
      .toEqual([404, 404, 404, 404]);
    expect(betaImport.statusCode).toBe(422);

    await app.close();
  });

  it("fails closed when the deterministic handoff draft ID is occupied by divergent content", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-handoff-collision-"));
    const store = new ProductionStore({ rootDir });
    const handoff = buildHandoff();
    const poison = buildPoisonedProductionDraft(handoff);
    await store.saveProductionDraft(localBusiness, poison);
    const app = buildProductionApp({
      dataRoot: rootDir, store, trustedActorSecret: sharedSecret,
      handoffReader: { async getHandoff() { return handoff; } }
    });

    const response = await app.inject({
      method: "POST", url: `/v1/production/drafts/from-handoff/${handoff.handoffId}`,
      headers: productionHeaders
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).not.toHaveProperty("draft");
    await expect(store.getProductionDraft(localBusiness, poison.draftId)).resolves.toEqual(poison);
    await app.close();
  });

  it("prevents a concurrent manual import from overwriting the handoff draft identity", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-handoff-manual-race-"));
    const store = new ProductionStore({ rootDir });
    const handoff = buildHandoff();
    const poison = buildPoisonedProductionDraft(handoff);
    const getProductionDraft = store.getProductionDraft.bind(store);
    let releaseManualLookup!: () => void;
    const releaseManual = new Promise<void>((resolve) => { releaseManualLookup = resolve; });
    let manualLookupObserved!: () => void;
    const manualLookup = new Promise<void>((resolve) => { manualLookupObserved = resolve; });
    let blockFirstLookup = true;
    store.getProductionDraft = async (context, draftId) => {
      const captured = await getProductionDraft(context, draftId);
      if (blockFirstLookup && draftId === poison.draftId) {
        blockFirstLookup = false;
        manualLookupObserved();
        await releaseManual;
      }
      return captured;
    };
    const app = buildProductionApp({
      dataRoot: rootDir, store, trustedActorSecret: sharedSecret,
      handoffReader: { async getHandoff() { return handoff; } }
    });

    const manualImportPromise = app.inject({
      method: "POST", url: "/v1/production/drafts", headers: productionHeaders, payload: poison
    });
    await manualLookup;
    const handoffEntry = await app.inject({
      method: "POST", url: `/v1/production/drafts/from-handoff/${handoff.handoffId}`,
      headers: productionHeaders
    });
    releaseManualLookup();
    const manualImport = await manualImportPromise;

    expect(handoffEntry.statusCode).toBe(201);
    expect(manualImport.statusCode).toBe(409);
    await expect(getProductionDraft(localBusiness, poison.draftId)).resolves.toMatchObject({
      businessId: "local",
      source: { sourceRef: `offer-handoff:${handoff.handoffId}` }
    });
    await app.close();
  });

  it("creates a handoff draft insert-only and emits one audit under concurrent entry", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-handoff-concurrent-"));
    const store = new ProductionStore({ rootDir });
    const auditLog = new AuditLogStore({ rootDir });
    const handoff = buildHandoff();
    let waitingReaders = 0;
    let releaseReaders!: () => void;
    const readerBarrier = new Promise<void>((resolve) => { releaseReaders = resolve; });
    const handoffReader = { async getHandoff() {
      waitingReaders += 1;
      if (waitingReaders === 2) releaseReaders();
      await readerBarrier;
      return handoff;
    } };
    const app = buildProductionApp({
      dataRoot: rootDir, store, auditLog, trustedActorSecret: sharedSecret,
      handoffReader
    });
    const request = () => app.inject({
      method: "POST" as const, url: `/v1/production/drafts/from-handoff/${handoff.handoffId}`,
      headers: productionHeaders
    });

    const responses = await Promise.all([request(), request()]);

    expect(responses.map((response) => response.statusCode)).toEqual([201, 201]);
    await expect(store.listProductionDrafts(localBusiness)).resolves.toHaveLength(1);
    const audits = (await auditLog.listRecentFor({ businessId: "local" }, 20))
      .filter((entry) => entry.action === "production.draft_created_from_handoff");
    expect(audits).toHaveLength(1);
    await app.close();
  });

  it("repairs production handoff-entry audit evidence after draft publication", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-handoff-audit-retry-"));
    const store = new ProductionStore({ rootDir });
    const auditLog = new AuditLogStore({ rootDir });
    const handoff = buildHandoff();
    const logFor = auditLog.logFor.bind(auditLog);
    let injectFailure = true;
    auditLog.logFor = async (...args) => {
      if (injectFailure && args[1].action === "production.draft_created_from_handoff") {
        injectFailure = false;
        throw new Error("injected production handoff audit failure");
      }
      return logFor(...args);
    };
    const app = buildProductionApp({
      dataRoot: rootDir, store, auditLog, trustedActorSecret: sharedSecret,
      handoffReader: { async getHandoff() { return handoff; } }
    });
    const request = () => app.inject({
      method: "POST" as const, url: `/v1/production/drafts/from-handoff/${handoff.handoffId}`,
      headers: productionHeaders
    });

    const first = await request();
    const retry = await request();

    expect(first.statusCode).toBe(500);
    expect(retry.statusCode).toBe(201);
    await expect(store.listProductionDrafts(localBusiness)).resolves.toHaveLength(1);
    const audits = (await auditLog.listRecentFor({ businessId: "local" }, 20))
      .filter((entry) => entry.action === "production.draft_created_from_handoff");
    expect(audits).toHaveLength(1);
    await app.close();
  });
});
