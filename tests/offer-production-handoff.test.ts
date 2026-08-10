import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";
import {
  AuditLogStore,
  createEventRequestFromText,
  createOfferDraft,
  validateOfferDraft,
  type OfferDraft,
  type Queryable
} from "@catering/shared-core";
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

  it("snapshots the selected variant pricing in both approved artifacts", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-offer-pricing-"));
    const app = buildOfferApp({ rootDir, trustedActorSecret: trustedSecret });
    const draftResponse = await app.inject({ method: "POST", url: "/v1/offers/from-text", headers: trustedHeaders, payload: { text: "Business Lunch fuer 35 Personen." } });
    const draft = draftResponse.json<{ draftId: string; pricingSummary: { subtotal: { amount: number } }; variantSet: Array<{ variantId: string; proposedEventSpec: { budgetContext: { pricingSummary: { subtotal: { amount: number }; perPerson: { amount: number } } } } }> }>();
    const selectedVariant = draft.variantSet[0]!;
    expect(selectedVariant.proposedEventSpec.budgetContext.pricingSummary.subtotal.amount).not.toBe(draft.pricingSummary.subtotal.amount);

    const decision = await app.inject({ method: "POST", url: `/v1/offers/drafts/${draft.draftId}/decision`, headers: trustedHeaders, payload: { decision: "approved", variantId: selectedVariant.variantId } });
    expect(decision.statusCode).toBe(201);
    const approvedOffer = decision.json<{ approvedOffer: { approvedOfferId: string; pricingSummary: unknown } }>().approvedOffer;
    expect(approvedOffer.pricingSummary).toEqual(selectedVariant.proposedEventSpec.budgetContext.pricingSummary);

    const handoff = await app.inject({ method: "POST", url: `/v1/offers/approved/${approvedOffer.approvedOfferId}/handoffs`, headers: trustedHeaders, payload: {} });
    expect(handoff.statusCode).toBe(201);
    expect(handoff.json<{ handoff: { pricingSnapshot: unknown } }>().handoff.pricingSnapshot)
      .toEqual(selectedVariant.proposedEventSpec.budgetContext.pricingSummary);
    await app.close();
  });

  it("repairs handoff audit evidence after publication and keeps concurrent retries idempotent", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-offer-handoff-audit-"));
    const store = new OfferStore({ rootDir });
    const auditLog = new AuditLogStore({ rootDir });
    const app = buildOfferApp({ rootDir, store, auditLog, trustedActorSecret: trustedSecret });
    const draftResponse = await app.inject({
      method: "POST", url: "/v1/offers/from-text", headers: trustedHeaders,
      payload: { text: "Business Lunch fuer 35 Personen." }
    });
    const draft = draftResponse.json<{ draftId: string; variantSet: Array<{ variantId: string }> }>();
    const decision = await app.inject({
      method: "POST", url: `/v1/offers/drafts/${draft.draftId}/decision`, headers: trustedHeaders,
      payload: { decision: "approved", variantId: draft.variantSet[0]!.variantId }
    });
    const approvedOfferId = decision.json<{ approvedOffer: { approvedOfferId: string } }>().approvedOffer.approvedOfferId;
    const logFor = auditLog.logFor.bind(auditLog);
    let injectFailure = true;
    auditLog.logFor = async (...args) => {
      if (injectFailure && args[1].action === "offer.production_handoff_created") {
        injectFailure = false;
        throw new Error("injected handoff audit failure");
      }
      return logFor(...args);
    };
    const request = () => app.inject({
      method: "POST" as const, url: `/v1/offers/approved/${approvedOfferId}/handoffs`,
      headers: trustedHeaders, payload: {}
    });

    const first = await request();
    const retries = await Promise.all([request(), request()]);

    expect(first.statusCode).toBe(500);
    expect(retries.map((response) => response.statusCode)).toEqual([201, 201]);
    const audits = (await auditLog.listRecentFor({ businessId: "local" }, 20))
      .filter((entry) => entry.action === "offer.production_handoff_created");
    expect(audits).toHaveLength(1);
    await app.close();
  });

  it.each(["file", "postgres"] as const)("publishes one immutable payload for concurrent equal draft identities in %s mode", async (mode) => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-offer-draft-identity-"));
    const pgPool: Queryable | undefined = mode === "postgres" ? new (newDb().adapters.createPg().Pool)() : undefined;
    const store = new OfferStore({ rootDir, pgPool });
    const base = validateOfferDraft({
      ...createOfferDraft(createEventRequestFromText({ requestId: `identity-${mode}`, channel: "text", rawText: "Lunch fuer 20 Personen." })),
      businessId: "local",
      revision: 1
    });
    const first: OfferDraft = { ...base, customerFacingText: "payload A" };
    const second: OfferDraft = { ...base, customerFacingText: "payload B" };

    const results = await Promise.allSettled([
      store.saveDraft({ businessId: "local" }, first),
      store.saveDraft({ businessId: "local" }, second)
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(["payload A", "payload B"]).toContain((await store.getDraft({ businessId: "local" }, base.draftId))?.customerFacingText);
  });

  it("accepts an identical PostgreSQL draft retry after JSONB key reordering", async () => {
    const { Pool } = newDb().adapters.createPg();
    const pool = new Pool();
    const store = new OfferStore({ pgPool: pool });
    const draft = validateOfferDraft({
      ...createOfferDraft(createEventRequestFromText({ requestId: "jsonb-draft", channel: "text", rawText: "Lunch fuer 20 Personen." })),
      businessId: "local",
      revision: 1
    });
    await store.saveDraft({ businessId: "local" }, draft);
    const stored = await pool.query("SELECT payload FROM catering_business_records WHERE collection_name = 'offers/drafts'");
    const reordered = Object.fromEntries(Object.entries(stored.rows[0]!.payload as Record<string, unknown>).reverse());
    await pool.query("UPDATE catering_business_records SET payload = $1::jsonb WHERE collection_name = 'offers/drafts'", [JSON.stringify(reordered)]);

    await expect(store.saveDraft({ businessId: "local" }, draft)).resolves.toBeUndefined();
  });

  it("keeps the legacy promotion helper and HTTP route removed", async () => {
    expect(readFileSync("shared-core/src/rules/offer.ts", "utf8")).not.toContain("promoteOfferVariant");
    const app = buildOfferApp({ rootDir: mkdtempSync(path.join(tmpdir(), "catering-offer-legacy-route-")), trustedActorSecret: trustedSecret });
    const response = await app.inject({ method: "POST", url: "/v1/offers/drafts/legacy/promote", headers: trustedHeaders, payload: {} });
    expect(response.statusCode).toBe(404);
    await app.close();
  });
});
